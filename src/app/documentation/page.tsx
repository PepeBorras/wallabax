import Link from "next/link";

export default function DocumentationPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">Documentation</h1>
      <div className="mt-6 space-y-4 text-slate-700">
        <p>How to use Wallabax:</p>
        <ol className="list-inside list-decimal space-y-2">
          <li>Paste a public X long-form article URL.</li>
          <li>Generate a permanent reader link.</li>
          <li>Paste that reader link into Wallabag.</li>
        </ol>
        <p>
          If processing fails, verify the URL is public and currently supported (`/i/article(s)/...` or
          `/username/status/...`), then try again.
        </p>
      </div>
      <Link
        className="mt-8 inline-flex rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-600"
        href="/"
      >
        Back to Home
      </Link>
    </main>
  );
}
