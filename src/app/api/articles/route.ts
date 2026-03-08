import { NextRequest, NextResponse } from "next/server";

import { cleanArticleHtml } from "@/lib/services/clean-article-html";
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

function buildPermanentUrl(baseUrl: string, idOrSlug: string): string {
  return `${baseUrl}/a/${idOrSlug}`;
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = createArticleRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const sourceUrl = normalizeArticleSourceUrl(parsed.data.sourceUrl);
    const baseUrl = getBaseUrl(request);

    const existing = await getArticleBySourceUrl(sourceUrl);
    if (existing) {
      const idOrSlug = existing.slug ?? existing.id;
      return NextResponse.json({
        permanentUrl: buildPermanentUrl(baseUrl, idOrSlug),
        article: existing,
        cached: true,
      });
    }

    const extracted = await extractXArticle(sourceUrl);
    const cleanedHtml = cleanArticleHtml({
      title: extracted.title,
      author: extracted.author,
      publishedAt: extracted.publishedAt,
      coverImageUrl: extracted.coverImageUrl,
      rawHtml: extracted.rawHtml,
    });

    const saved = await saveArticle({
      sourceUrl,
      title: extracted.title,
      author: extracted.author,
      publishedAt: extracted.publishedAt,
      coverImageUrl: extracted.coverImageUrl,
      cleanedHtml,
    });

    const idOrSlug = saved.slug ?? saved.id;

    return NextResponse.json(
      {
        permanentUrl: buildPermanentUrl(baseUrl, idOrSlug),
        article: saved,
        cached: false,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/articles failed", error);

    if (isConfigError(error)) {
      return NextResponse.json(
        {
          error:
            "Server configuration is incomplete. Add Supabase environment variables to .env.local and restart the dev server.",
        },
        { status: 500 },
      );
    }

    if (isMissingArticlesTableError(error)) {
      return NextResponse.json(
        {
          error:
            "Supabase is connected, but the database schema is missing. Run the SQL in supabase/schema.sql in your Supabase SQL Editor.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: "Could not process this URL right now. Try another public X article URL.",
      },
      { status: 500 },
    );
  }
}
