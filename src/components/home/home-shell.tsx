import Link from "next/link";

import { UrlForm } from "@/components/home/url-form";

export function HomeShell() {
  const githubProfileUrl = process.env.NEXT_PUBLIC_GITHUB_PROFILE_URL || "https://github.com";

  return (
    <div className="mx-auto max-w-180 px-6 py-12 md:py-20">
      <header className="reveal reveal-delay-1 mb-16 flex items-center justify-between md:mb-24">
        <div className="group flex cursor-default items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-(--color-primary) text-white shadow-xl shadow-teal-500/20 transition-transform group-hover:scale-105">
            <span aria-hidden className="text-xl">
              📚
            </span>
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">Wallabax</h1>
        </div>

        <a
          className="text-slate-400 transition-all duration-300 hover:scale-110 hover:text-(--color-primary)"
          href={githubProfileUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open GitHub"
        >
          <svg fill="currentColor" viewBox="0 0 256 256" width="28" height="28" aria-hidden>
            <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />
          </svg>
        </a>
      </header>

      <section className="reveal reveal-delay-2 mb-14">
        <h2 className="font-display mb-6 text-5xl leading-[1.1] font-extrabold tracking-tight text-slate-900 md:text-6xl">
          Turn X articles into{" "}
          <span className="relative inline-block text-(--color-primary)">
            clean reader links
            <span className="absolute bottom-1 left-0 -z-10 h-3 w-full rounded-full bg-teal-500/10" />
          </span>
          .
        </h2>
        <p className="max-w-145 text-lg leading-relaxed font-medium text-slate-500 md:text-xl">
          A minimal utility to save your favorite threads and articles directly to your personal Wallabag
          instance. No noise, just reading.
        </p>
      </section>

      <main className="reveal reveal-delay-3">
        <UrlForm />
      </main>

      <footer className="reveal reveal-delay-4 mt-28 text-center">
        <p className="text-sm font-semibold text-slate-400">Built for readers. No tracking, no ads. Just Wallabag.</p>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Made by{" "}
          <a
            className="font-semibold text-slate-700 transition-colors hover:text-(--color-primary)"
            href="https://www.pepeborras.com/"
            target="_blank"
            rel="noreferrer"
          >
            Pepe Borrás
          </a>
        </p>
        <div className="mt-8 flex justify-center gap-8">
          <Link
            className="text-xs font-bold uppercase tracking-wide text-slate-400 transition-all hover:tracking-widest hover:text-(--color-primary)"
            href="/privacy"
          >
            Privacy
          </Link>
          <Link
            className="text-xs font-bold uppercase tracking-wide text-slate-400 transition-all hover:tracking-widest hover:text-(--color-primary)"
            href="/documentation"
          >
            Documentation
          </Link>
          <a
            className="text-xs font-bold uppercase tracking-wide text-slate-400 transition-all hover:tracking-widest hover:text-(--color-primary)"
            href="https://wallabag.it"
            target="_blank"
            rel="noreferrer"
          >
            Wallabag.it
          </a>
        </div>
      </footer>
    </div>
  );
}
