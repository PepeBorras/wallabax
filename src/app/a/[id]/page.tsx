import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getArticleByPublicId } from "@/lib/services/get-article";

type ReaderPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ReaderPageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleByPublicId(id);

  if (!article) {
    return {
      title: "Article Not Found",
    };
  }

  return {
    title: `${article.title} | Wallabax`,
    description: `Reader copy of: ${article.source_url}`,
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
        className="prose prose-slate max-w-none prose-img:rounded-md"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        // `cleaned_html` is generated server-side by `cleanArticleHtml` with a strict allowlist sanitizer.
        dangerouslySetInnerHTML={{ __html: article.cleaned_html }}
      />
    </main>
  );
}
