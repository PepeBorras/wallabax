"use client";

import { useState } from "react";

import { ResultCard } from "@/components/home/result-card";
import { articleSourceUrlSchema } from "@/lib/validators/article-url";

type ApiSuccess = {
  permanentUrl: string;
  article: {
    title: string;
  };
  cached: boolean;
};

export function UrlForm() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSuccess | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyReaderLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setResult(null);
    setCopyState("idle");

    const normalizedInput = sourceUrl.trim();
    const validatedInput = articleSourceUrlSchema.safeParse(normalizedInput);

    if (!validatedInput.success) {
      const firstIssue = validatedInput.error.issues[0];
      setErrorMessage(firstIssue?.message ?? "Enter a valid public X article or status URL.");
      return;
    }

    setSourceUrl(normalizedInput);
    setIsLoading(true);

    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sourceUrl: normalizedInput }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Something went wrong while creating your reader link.";

        setErrorMessage(message);
        return;
      }

      setResult(data as ApiSuccess);
    } catch (error) {
      console.error("Failed submitting URL", error);
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-12">
      <section className="glass-card rounded-2xl p-6 shadow-2xl shadow-indigo-100 transition-all hover:shadow-teal-500/10 md:p-10">
        <form className="flex flex-col gap-8" onSubmit={onSubmit}>
          <label className="flex flex-col gap-3" htmlFor="article-url">
            <span className="ml-1 text-sm font-bold uppercase tracking-wider text-slate-500">
              Paste an X article URL
            </span>
            <div className="relative">
              <input
                id="article-url"
                name="article-url"
                type="url"
                required
                className="w-full rounded-xl border-2 border-slate-100 bg-white/50 px-5 py-5 text-lg font-medium placeholder:text-slate-300 focus:border-(--color-primary) focus:ring-4 focus:ring-teal-500/10 focus:outline-none"
                placeholder="https://x.com/username/status/..."
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </div>
          </label>

          <button
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-(--color-primary) px-8 py-5 text-lg font-extrabold text-white shadow-xl shadow-teal-500/30 transition-all active:scale-[0.98] hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            disabled={isLoading}
            type="submit"
          >
            <span aria-hidden className={isLoading ? "animate-spin" : ""}>
              {isLoading ? "◌" : "🔗"}
            </span>
            {isLoading ? "Processing article..." : "Generate Reader Link"}
          </button>
        </form>
      </section>

      {(isLoading || result || errorMessage) && (
        <section className="border-t border-slate-200/60 pt-12">
          <div className="space-y-10">
            {isLoading ? (
              <div className="space-y-4">
                <span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Loading State</span>
                <div className="glass-card rounded-2xl p-8 opacity-70">
                  <button
                    className="flex w-full cursor-not-allowed items-center justify-center gap-4 rounded-xl bg-slate-100 px-8 py-5 font-bold text-slate-400"
                    disabled
                    type="button"
                  >
                    <span className="animate-spin">◌</span>
                    Processing article...
                  </button>
                </div>
              </div>
            ) : null}

            {result ? (
              <ResultCard
                permanentUrl={result.permanentUrl}
                title={result.article.title}
                isCached={result.cached}
                copyState={copyState}
                onCopy={copyReaderLink}
              />
            ) : null}

            {errorMessage ? (
              <div className="space-y-4">
                <span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Error State</span>
                <div className="flex items-start gap-4 rounded-2xl border-2 border-rose-100 bg-rose-50/50 p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-center rounded-lg bg-rose-100 p-1.5 text-rose-500">
                    <span aria-hidden>⚠</span>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-base font-bold text-rose-900">We couldn&apos;t process that article.</p>
                    <p className="mt-1 text-sm font-medium text-rose-800/70">{errorMessage}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
