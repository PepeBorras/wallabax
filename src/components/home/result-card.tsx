import Link from "next/link";

type ResultCardProps = {
  permanentUrl: string;
  title: string;
  isCached: boolean;
  copyState: "idle" | "copied" | "failed";
  onCopy: (link: string) => Promise<void>;
};

export function ResultCard({ permanentUrl, title, isCached, copyState, onCopy }: ResultCardProps) {
  const copyLabel =
    copyState === "copied"
      ? "Copied"
      : copyState === "failed"
        ? "Copy failed"
        : "Copy Link";

  return (
    <div className="space-y-4">
      <span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Success State</span>
      <div className="glass-card rounded-2xl border border-teal-500/20 p-8 shadow-xl">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-teal-600">
            <span aria-hidden>✓</span>
            <span className="text-base font-bold">Article ready!</span>
          </div>

          <p className="text-sm font-semibold text-slate-800">{title}</p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 truncate rounded-xl border-2 border-slate-100 bg-white px-5 py-4 font-mono text-sm font-semibold text-slate-600">
              {permanentUrl}
            </div>
            <button
              className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-teal-500/10 bg-teal-500/10 px-8 py-4 text-sm font-bold text-teal-700 transition-all hover:bg-(--color-primary) hover:text-white"
              type="button"
              onClick={() => onCopy(permanentUrl)}
            >
              <span aria-hidden>⧉</span>
              {copyLabel}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link
              href={permanentUrl}
              className="group inline-flex items-center gap-2 font-bold text-(--color-primary) transition-all hover:text-teal-700"
              target="_blank"
            >
              Open Reader Page
              <span aria-hidden className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                ↗
              </span>
            </Link>
            <span className="text-xs font-semibold text-slate-400">
              {isCached ? "Already existed, returned existing snapshot." : "New snapshot created."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
