import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getArticleByPublicId } from "@/lib/services/get-article";

type ReaderPageProps = {
  params: Promise<{ id: string }>;
};

function getFirstHttpImageFromHtml(html: string): string | null {
  const match = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  const src = match?.[1]?.trim();

  if (!src) {
    return null;
  }

  try {
    const url = new URL(src);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return src;
    }
  } catch {
    return null;
  }

  return null;
}

export async function generateMetadata({ params }: ReaderPageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleByPublicId(id);

  if (!article) {
    return {
      title: "Article Not Found",
    };
  }

  const metadataImage = article.cover_image_url ?? getFirstHttpImageFromHtml(article.cleaned_html);
  const socialImages = metadataImage ? [metadataImage] : undefined;

  return {
    title: article.title,
    description: `Reader copy of: ${article.source_url}`,
    openGraph: {
      title: article.title,
      description: `Reader copy of: ${article.source_url}`,
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: `Reader copy of: ${article.source_url}`,
      images: socialImages,
    },
  };
}

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { id } = await params;
  const article = await getArticleByPublicId(id);

  if (!article) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-medium">Original source</p>
        <Link className="break-all text-slate-900 underline" href={article.source_url} target="_blank">
          {article.source_url}
        </Link>
      </section>

      <article
        className="reader-content max-w-none"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        // `cleaned_html` is generated server-side by `cleanArticleHtml` with a strict allowlist sanitizer.
        dangerouslySetInnerHTML={{ __html: article.cleaned_html }}
      />
    </main>
  );
}
