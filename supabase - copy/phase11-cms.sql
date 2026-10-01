-- ZM Hybrid Store Phase 11 — CMS + Marketing Pro
-- Additive migration. Allows public storefront to read only site_settings.

drop policy if exists v11_site_settings_public_select on public.site_settings;
create policy v11_site_settings_public_select on public.site_settings for select using (true);

create index if not exists idx_banners_active_order on public.banners(active, sort_order);
