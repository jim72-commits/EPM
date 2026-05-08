-- Phase G: listing polish — featured slots and org logos.
--
-- Design notes
--  - is_featured + featured_until split the "is this featured *right now*" vs
--    "should we ever feature this listing" decision. This lets admins set a
--    bounded promo window, and lets us promote without micromanaging end-dates
--    by leaving featured_until null. The published-list query computes
--    "actively featured" = is_featured and (featured_until is null or in the
--    future), so expired promos automatically demote without an admin tap.
--  - Org logos go into a public bucket (org-logos). Logos are by definition
--    public — they appear on job cards and in directory pages — so signed URLs
--    add no security and just slow the page down.
--  - logo_storage_path stores the bucket key. We compose the public URL in
--    the app layer rather than denormalize a full URL into the DB so we're
--    insulated from Supabase URL shape changes.

-- ---------------------------------------------------------------------------
-- jobs: featured flag
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists is_featured boolean not null default false;

alter table public.jobs
  add column if not exists featured_until timestamptz;

-- An expired featured_until shouldn't keep matching the "actively featured"
-- query path, so we index the active subset. Nulls last so undated featured
-- promos keep stable ordering against dated ones.
create index if not exists jobs_active_featured_idx
  on public.jobs (is_featured, featured_until desc nulls last)
  where status = 'open' and is_featured = true;

-- ---------------------------------------------------------------------------
-- organizations: logo path
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists logo_storage_path text;

-- ---------------------------------------------------------------------------
-- Storage: org-logos bucket (public)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

-- Public read (matches the `public = true` bucket flag, but explicit policies
-- make intent obvious in the dashboard).
create policy "org_logos_public_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'org-logos');

-- Org members (both roles) can upload/replace/delete logos for their own org.
-- Path layout: <org_id>/<filename>. We extract org_id from the first folder
-- segment and check membership via the existing helper.
create policy "org_logos_member_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-logos'
    and public.has_org_membership((storage.foldername(name))[1]::uuid)
  );

create policy "org_logos_member_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'org-logos'
    and public.has_org_membership((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'org-logos'
    and public.has_org_membership((storage.foldername(name))[1]::uuid)
  );

create policy "org_logos_member_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'org-logos'
    and public.has_org_membership((storage.foldername(name))[1]::uuid)
  );

-- Admins also full-access for moderation (e.g. taking down a logo that violates
-- terms while leaving the listing intact).
create policy "org_logos_admin_all"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'org-logos'
    and exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  )
  with check (
    bucket_id = 'org-logos'
    and exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

-- Allow org members to update organizations.logo_storage_path on their own
-- org. Without this they can upload to storage but can't link the new path
-- back into the row.
create policy "organizations_update_member"
  on public.organizations for update
  to authenticated
  using (public.has_org_membership(id))
  with check (public.has_org_membership(id));
