"use client";

import { useEffect, useMemo, useState } from "react";

import { ResultCard } from "@/components/home/result-card";
import type { DailyLimitState } from "@/lib/policies/article-limits";
import { articleSourceUrlSchema } from "@/lib/validators/article-url";

type ApiSuccess = {
  permanentUrl: string;
  article: {
    title: string;
  };
  cached: boolean;
  limits?: DailyLimitState;
};

type ApiError = {
  error?: string;
  limits?: DailyLimitState;
};

type UrlFormProps = {
  initialLimits: DailyLimitState;
};

export function UrlForm({ initialLimits }: UrlFormProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSuccess | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [limits, setLimits] = useState<DailyLimitState>(initialLimits);

  const resetHoursLabel = useMemo(() => {
    const resetAtMs = new Date(limits.resetsAt).getTime();

    if (Number.isNaN(resetAtMs)) {
      return "UNKNOWN";
    }

    const hours = Math.max(0, Math.ceil((resetAtMs - Date.now()) / (1000 * 60 * 60)));
    return `${hours} HOUR${hours === 1 ? "" : "S"}`;
  }, [limits.resetsAt]);

  useEffect(() => {
    async function refreshLimits() {
      try {
        const response = await fetch("/api/limits", { method: "GET" });
        if (!response.ok) {
          return;
        }

        const data: unknown = await response.json();
        if (typeof data === "object" && data !== null && "limits" in data && typeof data.limits === "object") {
          setLimits(data.limits as DailyLimitState);
        }
      } catch {
        // Keep server-rendered value if background refresh fails.
      }
    }

    refreshLimits();
  }, []);

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

      if (typeof data === "object" && data !== null && "limits" in data && typeof data.limits === "object") {
        setLimits(data.limits as DailyLimitState);
      }

      if (!response.ok) {
        const errorData = data as ApiError;
        const message =
          typeof errorData.error === "string"
            ? errorData.error
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
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="inline-flex items-center justify-center text-teal-600" aria-hidden>
              <svg viewBox="0 0 17 14" fill="currentColor" className="h-3.5 w-[17px]">
                <path d="M7.04167 9.58333C7.375 9.91667 7.80556 10.0799 8.33333 10.0729C8.86111 10.066 9.25 9.875 9.5 9.5L14.1667 2.5L7.16667 7.16667C6.79167 7.41667 6.59375 7.79861 6.57292 8.3125C6.55208 8.82639 6.70833 9.25 7.04167 9.58333Z" />
                <path d="M8.33333 0C9.15278 0 9.94097 0.114583 10.6979 0.34375C11.4549 0.572917 12.1667 0.916667 12.8333 1.375L11.25 2.375C10.7917 2.13889 10.316 1.96181 9.82292 1.84375C9.32986 1.72569 8.83333 1.66667 8.33333 1.66667C6.48611 1.66667 4.91319 2.31597 3.61458 3.61458C2.31597 4.91319 1.66667 6.48611 1.66667 8.33333C1.66667 8.91667 1.74653 9.49306 1.90625 10.0625C2.06597 10.6319 2.29167 11.1667 2.58333 11.6667H14.0833C14.4028 11.1389 14.6354 10.5903 14.7812 10.0208C14.9271 9.45139 15 8.86111 15 8.25C15 7.75 14.941 7.26389 14.8229 6.79167C14.7049 6.31944 14.5278 5.86111 14.2917 5.41667L15.2917 3.83333C15.7083 4.48611 16.0382 5.18056 16.2812 5.91667C16.5243 6.65278 16.6528 7.41667 16.6667 8.20833C16.6806 9 16.5903 9.75694 16.3958 10.4792C16.2014 11.2014 15.9167 11.8889 15.5417 12.5417C15.3889 12.7917 15.1806 12.9861 14.9167 13.125C14.6528 13.2639 14.375 13.3333 14.0833 13.3333H2.58333C2.29167 13.3333 2.01389 13.2639 1.75 13.125C1.48611 12.9861 1.27778 12.7917 1.125 12.5417C0.763889 11.9167 0.486111 11.2535 0.291667 10.5521C0.0972222 9.85069 0 9.11111 0 8.33333C0 7.18056 0.21875 6.10069 0.65625 5.09375C1.09375 4.08681 1.69097 3.20486 2.44792 2.44792C3.20486 1.69097 4.09028 1.09375 5.10417 0.65625C6.11806 0.21875 7.19444 0 8.33333 0Z" />
              </svg>
            </span>
            <span>
              Daily link generation: <strong className="text-teal-600">{limits.remaining}</strong> left of {limits.limit}
            </span>
          </p>
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-wide text-slate-400 uppercase">
            <span className="inline-flex size-4 items-center justify-center" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4l3 2" />
              </svg>
            </span>
            <span>Resets in {resetHoursLabel}</span>
          </p>
        </div>
      </section>

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
            disabled={isLoading || limits.remaining <= 0}
            type="submit"
          >
            <span aria-hidden className={isLoading ? "animate-spin" : ""}>
              {isLoading ? "◌" : "🔗"}
            </span>
            {isLoading
              ? "Processing article..."
              : limits.remaining <= 0
                ? "Daily Limit Reached"
                : "Generate Reader Link"}
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
