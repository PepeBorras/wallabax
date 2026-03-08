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

create table if not exists public.article_request_events (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  normalized_source_url text not null,
  canonical_source_key text not null,
  had_query_params boolean not null default false,
  status_code integer not null,
  was_new_generation boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists article_request_events_ip_created_idx
  on public.article_request_events (ip_address, created_at desc);
create index if not exists article_request_events_ip_generation_created_idx
  on public.article_request_events (ip_address, was_new_generation, created_at desc);
create index if not exists article_request_events_canonical_created_idx
  on public.article_request_events (canonical_source_key, created_at desc);
create index if not exists article_request_events_status_created_idx
  on public.article_request_events (status_code, created_at desc);

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
alter table public.article_request_events enable row level security;

-- Public read access for reader pages. Keep writes server-side via service role.
drop policy if exists "Public can read articles" on public.articles;
create policy "Public can read articles"
on public.articles
for select
to anon, authenticated
using (true);
