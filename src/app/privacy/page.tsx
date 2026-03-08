import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">Privacy</h1>
      <div className="mt-6 space-y-4 text-slate-700">
        <p>This MVP does not include user accounts, ads, or trackers.</p>
        <p>
          Submitted source URLs are processed server-side to create cleaned article snapshots. Stored snapshots are
          intended to be publicly readable via their reader link.
        </p>
        <p>
          Do not submit private or sensitive source URLs. This tool is intended for public article pages only.
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
