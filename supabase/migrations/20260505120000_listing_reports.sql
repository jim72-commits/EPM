-- Phase F: trust & safety — listing reports.
--
-- Design notes
--  - Anyone (including anonymous visitors) can flag a listing for review.
--    We keep the table append-only; reports are never deleted from the UI.
--    Status moves from 'open' to 'dismissed' (false alarm / not actionable)
--    or 'actioned' (admin took the listing down or warned the org).
--  - Reporter is optional. Logged-in reports include user_id so we can
--    de-dupe and follow up. Anonymous reports include reporter_email if
--    the visitor chose to leave one (helps admins ask clarifying questions).
--  - We deliberately do NOT trigger any auto-action from a single report.
--    Listings remain live until an admin reviews and decides. Brigading a
--    legit listing should not be able to take it down.
--  - Reasons are a small enum to keep dashboard counts comparable. 'other'
--    is the escape hatch when none of the buckets fit.

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  reporter_user_id uuid references auth.users (id) on delete set null,
  reporter_email text check (reporter_email is null or length(reporter_email) <= 320),
  reason text not null
    check (reason in ('spam', 'scam', 'misleading', 'off_topic', 'harassment', 'other')),
  details text not null check (length(details) > 0 and length(details) <= 4000),
  status text not null default 'open'
    check (status in ('open', 'dismissed', 'actioned')),
  admin_notes text check (admin_notes is null or length(admin_notes) <= 4000),
  resolved_by_user_id uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists listing_reports_status_created_idx
  on public.listing_reports (status, created_at desc);

create index if not exists listing_reports_job_idx
  on public.listing_reports (job_id, created_at desc);

create index if not exists listing_reports_reporter_idx
  on public.listing_reports (reporter_user_id, created_at desc)
  where reporter_user_id is not null;

-- Stale-resolution sanity: resolved rows must record who closed them and
-- when. Open rows must not. A trigger keeps this true on every transition
-- so the action layer doesn't need to remember it manually.

create or replace function public.sync_listing_report_resolution()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('dismissed', 'actioned') then
    if new.resolved_at is null then
      new.resolved_at := now();
    end if;
    -- resolved_by_user_id is set by the action layer; we don't try to
    -- guess it here.
  else
    new.resolved_at := null;
    new.resolved_by_user_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists listing_reports_sync_resolution on public.listing_reports;
create trigger listing_reports_sync_resolution
  before insert or update on public.listing_reports
  for each row execute procedure public.sync_listing_report_resolution();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.listing_reports enable row level security;

-- Public can insert. We rely on the action layer for shape validation and
-- soft rate-limits; the DB just guarantees the row is well-formed.
create policy "listing_reports_insert_public"
  on public.listing_reports for insert
  to anon, authenticated
  with check (true);

-- Reporters can read their own reports (so we can show them confirmation).
create policy "listing_reports_select_own"
  on public.listing_reports for select
  to authenticated
  using (reporter_user_id = auth.uid());

-- Admins read everything.
create policy "listing_reports_select_admin"
  on public.listing_reports for select
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

-- Only admins update. Org members deliberately can't see or touch reports
-- against their own listings — that path runs through admin moderation, not
-- self-service.
create policy "listing_reports_update_admin"
  on public.listing_reports for update
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

comment on table public.listing_reports is
  'Trust-and-safety reports filed against job listings. Admin-moderated.';
