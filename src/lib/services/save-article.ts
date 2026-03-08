import { randomUUID } from "node:crypto";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ArticleRecord, SaveArticleInput } from "@/lib/types/article";
import { shortId, slugify } from "@/lib/utils";
import { getArticleBySourceUrl } from "@/lib/services/get-article";

function createCandidateSlug(title: string): string {
  const base = slugify(title) || "article";
  return `${base}-${shortId(randomUUID())}`;
}

export async function saveArticle(input: SaveArticleInput): Promise<ArticleRecord> {
  const supabase = getSupabaseServerClient();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = createCandidateSlug(input.title);

    const { data, error } = await supabase
      .from("articles")
      .insert({
        source_url: input.sourceUrl,
        slug,
        title: input.title,
        author: input.author,
        published_at: input.publishedAt,
        cover_image_url: input.coverImageUrl,
        cleaned_html: input.cleanedHtml,
      })
      .select("*")
      .single<ArticleRecord>();

    if (!error && data) {
      return data;
    }

    // PostgreSQL unique violation code.
    if (error?.code === "23505") {
      const existing = await getArticleBySourceUrl(input.sourceUrl);
      if (existing) {
        return existing;
      }

      continue;
    }

    throw new Error(`Failed saving article: ${error?.message ?? "unknown error"}`);
  }

  throw new Error("Failed saving article after retrying slug generation.");
}
