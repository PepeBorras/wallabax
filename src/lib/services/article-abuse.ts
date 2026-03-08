import { getUtcDayStartIso } from "@/lib/policies/article-limits";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const REQUESTS_PER_IP_PER_HOUR_LIMIT = 30;
const GENERATIONS_PER_IP_PER_DAY_LIMIT = 20;
const MIN_SECONDS_BETWEEN_GENERATIONS = 10;
const CACHE_BUST_REPLAY_WINDOW_MINUTES = 10;

const SPIKE_WARNING_THRESHOLD_PER_HOUR = 20;
const REPEATED_LIMIT_ERRORS_THRESHOLD = 5;
const URL_CHURN_THRESHOLD = 12;

type AuditEventInput = {
  ipAddress: string;
  normalizedSourceUrl: string;
  canonicalSourceKey: string;
  hadQueryParams: boolean;
  statusCode: number;
  wasNewGeneration: boolean;
};

type RequestGuardInput = {
  ipAddress: string;
  normalizedSourceUrl: string;
  canonicalSourceKey: string;
  hadQueryParams: boolean;
};

type GenerationGuardInput = {
  ipAddress: string;
};

export class AbuseLimitError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly retryAfterSeconds: number;

  constructor(message: string, code: string, retryAfterSeconds = 60, statusCode = 429) {
    super(message);
    this.name = "AbuseLimitError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.statusCode = statusCode;
  }
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function getClientIpAddress(headerValue: string | null): string {
  if (!headerValue) {
    return "unknown";
  }

  const [first] = headerValue.split(",");
  const normalized = first?.trim();
  return normalized && normalized.length > 0 ? normalized : "unknown";
}

export function getCanonicalSourceKey(rawSourceUrl: string): string {
  const parsed = new URL(rawSourceUrl);
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  if (parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

export function sourceUrlHasQueryParams(rawSourceUrl: string): boolean {
  const parsed = new URL(rawSourceUrl);
  return parsed.searchParams.size > 0;
}

async function countRequestsByIpSince(ipAddress: string, sinceIso: string): Promise<number> {
  const supabase = getSupabaseServerClient();

  const { count, error } = await supabase
    .from("article_request_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .gte("created_at", sinceIso);

  if (error) {
    throw new Error(`Failed reading request rate data: ${error.message}`);
  }

  return count ?? 0;
}

async function countGenerationEventsByIpSince(ipAddress: string, sinceIso: string): Promise<number> {
  const supabase = getSupabaseServerClient();

  const { count, error } = await supabase
    .from("article_request_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .eq("was_new_generation", true)
    .gte("created_at", sinceIso);

  if (error) {
    throw new Error(`Failed reading generation rate data: ${error.message}`);
  }

  return count ?? 0;
}

async function getLatestGenerationTimestamp(ipAddress: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("article_request_events")
    .select("created_at")
    .eq("ip_address", ipAddress)
    .eq("was_new_generation", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();

  if (error) {
    throw new Error(`Failed reading recent generation timestamp: ${error.message}`);
  }

  return data?.created_at ?? null;
}

async function hasRecentQueryVariant(input: RequestGuardInput): Promise<boolean> {
  if (!input.hadQueryParams) {
    return false;
  }

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("article_request_events")
    .select("normalized_source_url")
    .eq("ip_address", input.ipAddress)
    .eq("canonical_source_key", input.canonicalSourceKey)
    .eq("had_query_params", true)
    .gte("created_at", isoMinutesAgo(CACHE_BUST_REPLAY_WINDOW_MINUTES))
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(`Failed reading query replay data: ${error.message}`);
  }

  const seen = new Set((data ?? []).map((row) => String(row.normalized_source_url)));
  return seen.size > 0 && !seen.has(input.normalizedSourceUrl);
}

async function countRecentLimitErrors(ipAddress: string): Promise<number> {
  const supabase = getSupabaseServerClient();

  const { count, error } = await supabase
    .from("article_request_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .in("status_code", [422, 429])
    .gte("created_at", isoMinutesAgo(15));

  if (error) {
    throw new Error(`Failed reading recent limit error counts: ${error.message}`);
  }

  return count ?? 0;
}

async function countRecentDistinctSources(ipAddress: string): Promise<number> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("article_request_events")
    .select("canonical_source_key")
    .eq("ip_address", ipAddress)
    .gte("created_at", isoMinutesAgo(10))
    .limit(100);

  if (error) {
    throw new Error(`Failed reading source churn data: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => String(row.canonical_source_key))).size;
}

export async function enforceRequestAbuseGuards(input: RequestGuardInput): Promise<void> {
  const hourlyRequestCount = await countRequestsByIpSince(input.ipAddress, isoMinutesAgo(60));

  if (hourlyRequestCount >= REQUESTS_PER_IP_PER_HOUR_LIMIT) {
    throw new AbuseLimitError(
      "Too many requests from this IP (30/hour). Please try again later.",
      "ip_hourly_rate_limited",
      60 * 10,
    );
  }

  const hasReplay = await hasRecentQueryVariant(input);
  if (hasReplay) {
    throw new AbuseLimitError(
      "Repeated cache-busting URL variants were detected for the same source. Please retry without query parameters.",
      "cache_bust_replay_blocked",
      60 * 10,
    );
  }

  if (hourlyRequestCount >= SPIKE_WARNING_THRESHOLD_PER_HOUR) {
    console.warn("Abuse telemetry: high request rate", {
      ipAddress: input.ipAddress,
      hourlyRequestCount,
      limit: REQUESTS_PER_IP_PER_HOUR_LIMIT,
    });
  }
}

export async function enforceGenerationAbuseGuards(input: GenerationGuardInput): Promise<void> {
  const dailyGenerationCount = await countGenerationEventsByIpSince(input.ipAddress, getUtcDayStartIso());
  if (dailyGenerationCount >= GENERATIONS_PER_IP_PER_DAY_LIMIT) {
    throw new AbuseLimitError(
      "This IP reached the daily generation cap (20 new links/day).",
      "ip_daily_generation_limited",
      60 * 60,
    );
  }

  const latestGenerationAt = await getLatestGenerationTimestamp(input.ipAddress);
  if (latestGenerationAt) {
    const elapsedMs = Date.now() - new Date(latestGenerationAt).getTime();
    const minIntervalMs = MIN_SECONDS_BETWEEN_GENERATIONS * 1000;

    if (elapsedMs < minIntervalMs) {
      const retryAfterSeconds = Math.ceil((minIntervalMs - elapsedMs) / 1000);
      throw new AbuseLimitError(
        "Please wait a few seconds before generating another new link from this IP.",
        "ip_generation_cooldown",
        retryAfterSeconds,
      );
    }
  }
}

export async function logArticleRequestEvent(input: AuditEventInput): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from("article_request_events").insert({
    ip_address: input.ipAddress,
    normalized_source_url: input.normalizedSourceUrl,
    canonical_source_key: input.canonicalSourceKey,
    had_query_params: input.hadQueryParams,
    status_code: input.statusCode,
    was_new_generation: input.wasNewGeneration,
  });

  if (error) {
    throw new Error(`Failed writing request audit event: ${error.message}`);
  }
}

export async function emitAbuseTelemetry(ipAddress: string): Promise<void> {
  const [limitErrors, distinctSourceCount] = await Promise.all([
    countRecentLimitErrors(ipAddress),
    countRecentDistinctSources(ipAddress),
  ]);

  if (limitErrors >= REPEATED_LIMIT_ERRORS_THRESHOLD) {
    console.warn("Abuse telemetry: repeated 422/429 responses", {
      ipAddress,
      limitErrors,
      windowMinutes: 15,
    });
  }

  if (distinctSourceCount >= URL_CHURN_THRESHOLD) {
    console.warn("Abuse telemetry: suspicious URL churn", {
      ipAddress,
      distinctSourceCount,
      windowMinutes: 10,
    });
  }
}

export { GENERATIONS_PER_IP_PER_DAY_LIMIT, MIN_SECONDS_BETWEEN_GENERATIONS, REQUESTS_PER_IP_PER_HOUR_LIMIT };
