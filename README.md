# Wallabax

`Wallabax` is an MVP web app that converts a public X long-form article URL into a permanent, clean reader URL.

## What It Does

- Accepts a public X long-form URL.
- Extracts title, author, publication date, cover image, and body content.
- Cleans article HTML to a reader-friendly format.
- Saves the cleaned snapshot in Supabase Postgres.
- Returns a permanent public URL (`/a/:id-or-slug`) that can be pasted into Wallabag.

## Why It Exists

Wallabag works best with stable, clean reader pages. This project creates permanent snapshots so saved content stays readable even if the source page changes.

## MVP Features

- URL validation with Zod.
- `POST /api/articles` extraction + persistence flow.
- Duplicate prevention by `source_url`.
- Public reader page at `/a/[id]`.
- Beginner-friendly modular service architecture.
- Vercel-compatible extraction baseline (`fetch` + parse), with TODO hooks for future Playwright/worker fallback.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase JS
- Supabase Postgres
- Zod
- Cheerio (server-side HTML parsing)
- Vercel (deployment target)

## Repository

- GitHub: `https://github.com/PepeBorras/wallabax`

## Project Structure

```text
wallabax/
	README.md
	package.json
	tsconfig.json
	next.config.ts
	postcss.config.js
	tailwind.config.ts
	.env.example
	supabase/
		schema.sql
	src/
		app/
			layout.tsx
			globals.css
			page.tsx
			api/
				articles/
					route.ts
			a/
				[id]/
					page.tsx
		components/
			home/
				home-shell.tsx
				url-form.tsx
				result-card.tsx
			ui/
				button.tsx
				input.tsx
				card.tsx
		lib/
			supabase/
				client.ts
				server.ts
			env.ts
			utils.ts
			validators/
				article-url.ts
			services/
				extract-x-article.ts
				clean-article-html.ts
				save-article.ts
				get-article.ts
			types/
				article.ts
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env.local
```

3. Fill in all variables in `.env.local`.

4. Apply SQL schema in your Supabase SQL editor:

```sql
-- paste contents of supabase/schema.sql
```

5. Start local dev server:

```bash
npm run dev
```

## Environment Variables

From `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for trusted writes.
- `NEXT_PUBLIC_APP_URL` (optional): public base URL used for API response links.

## Supabase Setup

1. Create a Supabase project.
2. Copy URL, anon key, and service role key into `.env.local`.
3. Run `supabase/schema.sql` in SQL editor.
4. Confirm `articles` table exists and RLS policy for public reads is created.

## Schema Setup

`supabase/schema.sql` includes:

- `pgcrypto` extension for `gen_random_uuid()`.
- `articles` table with required fields.
- unique indexes on `source_url` and `slug`.
- `updated_at` trigger function.
- public read policy for reader pages.

## Running Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Extraction Flow

1. User submits URL to `POST /api/articles`.
2. Request is validated with Zod.
3. URL is normalized and looked up by `source_url`.
4. If existing row is found, return existing permanent URL.
5. If not found:
	 - extract source HTML (`extract-x-article.ts`)
	 - clean article HTML (`clean-article-html.ts`)
	 - persist snapshot (`save-article.ts`)
6. API returns `{ permanentUrl, article, cached }`.

## Known Limitations

- URL support is intentionally strict to public X/Twitter article and status paths (`/i/article(s)/*` and `/:username/status/:id`).
- Some pages may require JS rendering and fail with pure fetch parsing.
- Cleaner is best-effort and may miss edge-case layout noise.

## Future Improvements

- Add extraction strategy abstraction (fetch parser vs Playwright vs external worker).
- Add retry queue for temporary fetch failures.
- Improve content scoring heuristics for body detection.
- Add structured logging and metrics.
- Add automated tests (unit + integration + route tests).
- Add auth and private article scopes if needed later.

## Vercel Deployment Notes

1. Push repository to GitHub.
2. Import project in Vercel.
3. Add all environment variables in Vercel project settings.
4. Deploy.
5. Set `NEXT_PUBLIC_APP_URL` to production domain for absolute permanent URLs.
	Example: `https://wallabax.vercel.app`

## Troubleshooting

- `Invalid environment variables`: ensure all required env vars are present.
- `Could not process this URL`: verify the URL is a public X long-form article.
- `Failed to fetch source URL`: source may block requests, rate-limit, or require JS.
- Duplicate/constraint errors: verify schema indexes and trigger are installed as-is.
