import {
  buildDailyLimitState,
  getArticleExpiryCutoffIso,
  getUtcDayStartIso,
  type DailyLimitState,
} from "@/lib/policies/article-limits";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function purgeExpiredArticles(): Promise<number> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("articles")
    .delete()
    .lt("created_at", getArticleExpiryCutoffIso())
    .select("id");

  if (error) {
    throw new Error(`Failed deleting expired articles: ${error.message}`);
  }

  return data?.length ?? 0;
}

export async function getDailyGenerationLimitState(): Promise<DailyLimitState> {
  const supabase = getSupabaseServerClient();

  const { count, error } = await supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", getUtcDayStartIso());

  if (error) {
    throw new Error(`Failed reading daily generation usage: ${error.message}`);
  }

  return buildDailyLimitState(count ?? 0);
}
