import type { ArticleRecord } from "@/lib/types/article";
import { getArticleExpiryCutoffIso } from "@/lib/policies/article-limits";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getArticleBySourceUrl(sourceUrl: string): Promise<ArticleRecord | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("source_url", sourceUrl)
    .gte("created_at", getArticleExpiryCutoffIso())
    .maybeSingle<ArticleRecord>();

  if (error) {
    throw new Error(`Failed reading article by source URL: ${error.message}`);
  }

  return data;
}

export async function getArticleByPublicId(publicId: string): Promise<ArticleRecord | null> {
  const supabase = getSupabaseServerClient();

  const bySlug = await supabase
    .from("articles")
    .select("*")
    .eq("slug", publicId)
    .gte("created_at", getArticleExpiryCutoffIso())
    .maybeSingle<ArticleRecord>();

  if (bySlug.error) {
    throw new Error(`Failed reading article by slug: ${bySlug.error.message}`);
  }

  if (bySlug.data) {
    return bySlug.data;
  }

  if (!UUID_RE.test(publicId)) {
    return null;
  }

  const byId = await supabase
    .from("articles")
    .select("*")
    .eq("id", publicId)
    .gte("created_at", getArticleExpiryCutoffIso())
    .maybeSingle<ArticleRecord>();

  if (byId.error) {
    throw new Error(`Failed reading article by id: ${byId.error.message}`);
  }

  return byId.data;
}
