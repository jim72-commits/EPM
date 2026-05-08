-- ---------------------------------------------------------------------------
-- Phase I — Public org page polish: bio + website fields
-- ---------------------------------------------------------------------------
-- The public /employers/[slug] page wants more than name + logo. Two
-- fields, both optional, so legacy rows continue to render with the same
-- fallbacks they have today.
--
-- Length caps protect the UI from runaway pastes; the bio cap matches the
-- candidate bio cap so we have a single mental model.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists website_url text,
  add column if not exists bio text;

alter table public.organizations
  drop constraint if exists organizations_website_url_check,
  add constraint organizations_website_url_check
    check (website_url is null or website_url ~* '^https?://');

alter table public.organizations
  drop constraint if exists organizations_bio_length,
  add constraint organizations_bio_length
    check (bio is null or char_length(bio) <= 4000);
