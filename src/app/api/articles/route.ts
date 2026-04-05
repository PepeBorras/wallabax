import { NextRequest, NextResponse } from "next/server";

import { getArticleQualityScore, isLowQualityArticleHtml } from "@/lib/services/article-quality";
import {
  AbuseLimitError,
  emitAbuseTelemetry,
  enforceGenerationAbuseGuards,
  enforceRequestAbuseGuards,
  getCanonicalSourceKey,
  getClientIpAddress,
  logArticleRequestEvent,
  sourceUrlHasQueryParams,
} from "@/lib/services/article-abuse";
import { cleanArticleHtml } from "@/lib/services/clean-article-html";
import { getDailyGenerationLimitState, purgeExpiredArticles } from "@/lib/services/article-retention";
import { extractXArticle } from "@/lib/services/extract-x-article";
import { getArticleBySourceUrl } from "@/lib/services/get-article";
import { saveArticle } from "@/lib/services/save-article";
import { createArticleRequestSchema, normalizeArticleSourceUrl } from "@/lib/validators/article-url";

function getBaseUrl(request: NextRequest): string {
  const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  return rawBaseUrl.replace(/\/$/, "");
}

function isConfigError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Invalid environment variables");
}

function isMissingArticlesTableError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Could not find the table 'public.articles'");
}

function isMissingAbuseEventsTableError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Could not find the table 'public.article_request_events'");
}

function buildPermanentUrl(baseUrl: string, idOrSlug: string): string {
  return `${baseUrl}/a/${idOrSlug}`;
}

export async function POST(request: NextRequest) {
  const ipAddress = getClientIpAddress(request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"));
  let auditContext:
    | {
        ipAddress: string;
        normalizedSourceUrl: string;
        canonicalSourceKey: string;
        hadQueryParams: boolean;
      }
    | null = null;
  let limitsSnapshot: Awaited<ReturnType<typeof getDailyGenerationLimitState>> | null = null;

  async function auditAndRespond(
    payload: Record<string, unknown>,
    status: number,
    options?: {
      wasNewGeneration?: boolean;
      retryAfterSeconds?: number;
      includeLimits?: boolean;
    },
  ) {
    if (options?.includeLimits && !limitsSnapshot) {
      try {
        limitsSnapshot = await getDailyGenerationLimitState();
      } catch {
        // Keep response usable even if limits cannot be loaded in error paths.
      }
    }

    const responseBody =
      options?.includeLimits && limitsSnapshot ? { ...payload, limits: limitsSnapshot } : payload;

    if (auditContext) {
      try {
        await logArticleRequestEvent({
          ipAddress: auditContext.ipAddress,
          normalizedSourceUrl: auditContext.normalizedSourceUrl,
          canonicalSourceKey: auditContext.canonicalSourceKey,
          hadQueryParams: auditContext.hadQueryParams,
          statusCode: status,
          wasNewGeneration: Boolean(options?.wasNewGeneration),
        });
        await emitAbuseTelemetry(auditContext.ipAddress);
      } catch (auditError) {
        console.error("Failed writing abuse audit event", auditError);
      }
    }

    const response = NextResponse.json(responseBody, { status });
    if (options?.retryAfterSeconds) {
      response.headers.set("Retry-After", String(options.retryAfterSeconds));
    }

    return response;
  }

  try {
    const json = await request.json();
    const parsed = createArticleRequestSchema.safeParse(json);

    if (!parsed.success) {
      return auditAndRespond(
        {
          error: "Invalid request payload.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const rawSourceUrl = parsed.data.sourceUrl;
    const sourceUrl = normalizeArticleSourceUrl(parsed.data.sourceUrl);
    const reprocess = parsed.data.reprocess;
    const baseUrl = getBaseUrl(request);

    auditContext = {
      ipAddress,
      normalizedSourceUrl: sourceUrl,
      canonicalSourceKey: getCanonicalSourceKey(rawSourceUrl),
      hadQueryParams: sourceUrlHasQueryParams(rawSourceUrl),
    };

    await purgeExpiredArticles();
    await enforceRequestAbuseGuards(auditContext);

    limitsSnapshot = await getDailyGenerationLimitState();

    const existing = await getArticleBySourceUrl(sourceUrl);
    const existingIsLowQuality = existing ? isLowQualityArticleHtml(existing.cleaned_html) : false;
    const existingQualityScore = existing ? getArticleQualityScore(existing.cleaned_html) : null;

    if (!existing) {
      await enforceGenerationAbuseGuards({ ipAddress });
    }

    if (!existing && limitsSnapshot.remaining <= 0) {
      return auditAndRespond(
        {
          error: "Daily generation limit reached (100 links/day). Try again after reset.",
          code: "global_daily_generation_limited",
        },
        429,
        { includeLimits: true, retryAfterSeconds: 60 * 60 },
      );
    }

    if (existing && !reprocess && !existingIsLowQuality) {
      const idOrSlug = existing.slug ?? existing.id;
      return auditAndRespond(
        {
          permanentUrl: buildPermanentUrl(baseUrl, idOrSlug),
          article: existing,
          cached: true,
        },
        200,
        { includeLimits: true },
      );
    }

    const extracted = await extractXArticle(sourceUrl);
    const cleanedHtml = cleanArticleHtml({
      title: extracted.title,
      author: extracted.author,
      publishedAt: extracted.publishedAt,
      coverImageUrl: extracted.coverImageUrl,
      rawHtml: extracted.rawHtml,
    });

    const extractedIsLowQuality = isLowQualityArticleHtml(cleanedHtml);
    const extractedQualityScore = getArticleQualityScore(cleanedHtml);

    if (existing && extractedQualityScore < (existingQualityScore ?? 0)) {
      const idOrSlug = existing.slug ?? existing.id;
      return auditAndRespond(
        {
          permanentUrl: buildPermanentUrl(baseUrl, idOrSlug),
          article: existing,
          cached: true,
          warning: "Fresh extraction scored lower than existing snapshot; kept existing version.",
        },
        200,
        { includeLimits: true },
      );
    }

    if (extractedIsLowQuality && !reprocess) {
      if (existing) {
        const idOrSlug = existing.slug ?? existing.id;
        return auditAndRespond(
          {
            permanentUrl: buildPermanentUrl(baseUrl, idOrSlug),
            article: existing,
            cached: true,
            warning: "Fresh extraction was low quality; returned existing snapshot.",
          },
          200,
          { includeLimits: true },
        );
      }

      return auditAndRespond(
        {
          error: "Extraction quality is too low for this URL right now. Try again later or pass reprocess=true.",
          code: "low_quality_extraction",
        },
        422,
        { includeLimits: true },
      );
    }

    const saved = await saveArticle({
      sourceUrl,
      title: extracted.title,
      author: extracted.author,
      publishedAt: extracted.publishedAt,
      coverImageUrl: extracted.coverImageUrl,
      cleanedHtml,
      overwriteExisting: Boolean(existing),
    });

    const idOrSlug = saved.slug ?? saved.id;
    if (!existing) {
      limitsSnapshot = await getDailyGenerationLimitState();
    }

    return auditAndRespond(
      {
        permanentUrl: buildPermanentUrl(baseUrl, idOrSlug),
        article: saved,
        cached: false,
      },
      201,
      {
        includeLimits: true,
        wasNewGeneration: !existing,
      },
    );
  } catch (error) {
    console.error("POST /api/articles failed", error);

    if (error instanceof AbuseLimitError) {
      return auditAndRespond(
        {
          error: error.message,
          code: error.code,
        },
        error.statusCode,
        { includeLimits: true, retryAfterSeconds: error.retryAfterSeconds },
      );
    }

    if (isConfigError(error)) {
      return auditAndRespond(
        {
          error:
            "Server configuration is incomplete. Add Supabase environment variables to .env.local and restart the dev server.",
        },
        500,
      );
    }

    if (isMissingArticlesTableError(error)) {
      return auditAndRespond(
        {
          error:
            "Supabase is connected, but the database schema is missing. Run the SQL in supabase/schema.sql in your Supabase SQL Editor.",
        },
        500,
      );
    }

    if (isMissingAbuseEventsTableError(error)) {
      return auditAndRespond(
        {
          error:
            "Supabase abuse-controls schema is missing. Re-run supabase/schema.sql to create article_request_events.",
        },
        500,
      );
    }

    return auditAndRespond(
      {
        error: "Could not process this URL right now. Try another public website URL.",
      },
      500,
    );
  }
}
