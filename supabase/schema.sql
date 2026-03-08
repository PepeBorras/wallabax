create extension if not exists pgcrypto;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  slug text unique,
  title text not null,
  author text,
  published_at timestamptz,
  cover_image_url text,
  cleaned_html text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists articles_source_url_idx on public.articles (source_url);
create unique index if not exists articles_slug_idx on public.articles (slug);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at
before update on public.articles
for each row
execute procedure public.set_updated_at();

alter table public.articles enable row level security;

-- Public read access for reader pages. Keep writes server-side via service role.
drop policy if exists "Public can read articles" on public.articles;
create policy "Public can read articles"
on public.articles
for select
to anon, authenticated
using (true);
