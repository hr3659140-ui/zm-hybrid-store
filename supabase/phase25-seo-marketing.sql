-- ZM Hybrid Store V11 Phase 25 — SEO + Marketing Pro
-- Safe migration: adds SEO defaults and a small admin-only UTM campaign table.

insert into public.site_settings(key,value)
values
 ('seo.title', to_jsonb('ZM Hybrid Store — Beauty, Home & Lifestyle Essentials'::text)),
 ('seo.description', to_jsonb('Shop quality beauty, home & kitchen, watches, fragrance and electronics at ZM Hybrid Store. Cash on delivery available across Pakistan.'::text)),
 ('seo.keywords', to_jsonb('ZM Hybrid Store, online shopping Pakistan, beauty, home kitchen, watches, fragrance, electronics'::text)),
 ('seo.canonical', to_jsonb('https://zm-hybrid-store.pages.dev/'::text)),
 ('seo.og_image', to_jsonb('https://zm-hybrid-store.pages.dev/og-image.svg'::text)),
 ('seo.twitter_card', to_jsonb('summary_large_image'::text)),
 ('seo.google_verification', to_jsonb(''::text)),
 ('seo.bing_verification', to_jsonb(''::text)),
 ('seo.org_description', to_jsonb('ZM Hybrid Store is a Pakistan-wide online store for curated beauty, home, lifestyle and everyday essentials.'::text))
on conflict (key) do nothing;

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  source text not null default 'facebook',
  medium text not null default 'social',
  campaign text,
  content text,
  landing_path text not null default '/catalog/',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_campaigns enable row level security;

drop policy if exists v11_marketing_campaigns_admin on public.marketing_campaigns;
create policy v11_marketing_campaigns_admin
on public.marketing_campaigns
for all
using (public.is_admin())
with check (public.is_admin());

create index if not exists idx_marketing_campaigns_active
on public.marketing_campaigns(active, created_at desc);

create or replace function public.touch_marketing_campaign()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_marketing_campaign on public.marketing_campaigns;
create trigger trg_touch_marketing_campaign
before update on public.marketing_campaigns
for each row execute function public.touch_marketing_campaign();

notify pgrst, 'reload schema';
