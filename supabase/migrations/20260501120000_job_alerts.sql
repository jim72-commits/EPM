-- Phase 7c: Filter-driven job alerts with double opt-in and digest tracking.
--
-- Users on /jobs subscribe to an alert that captures their current filter set.
-- The alert is stored with a flexible `filters` JSONB so new filters can be
-- added without migrations. Digest workers read confirmed alerts, run the
-- same public job query, and email matches.

create table if not exists public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Normalised filter object: { platform?, role?, remote?, country?, q? }
  -- Empty object `{}` = "all open roles", fully valid.
  filters jsonb not null default '{}'::jsonb,
  frequency text not null default 'weekly' check (frequency in ('weekly')),
  confirm_token text not null unique,
  unsubscribe_token text not null unique,
  confirmed_at timestamptz,
  last_sent_at timestamptz,
  -- IDs of the jobs included in the most recent digest, used to suppress
  -- duplicates if the cron runs more frequently than intended.
  last_sent_job_ids jsonb not null default '[]'::jsonb,
  source text,
  last_sent_confirm_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists job_alerts_email_idx on public.job_alerts (email);
create index if not exists job_alerts_confirmed_at_idx
  on public.job_alerts (confirmed_at);
create index if not exists job_alerts_last_sent_at_idx
  on public.job_alerts (last_sent_at);

alter table public.job_alerts enable row level security;

create policy "job_alerts_admin_select" on public.job_alerts
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
    )
  );

create policy "job_alerts_admin_update" on public.job_alerts
  for update to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
    )
  );

create policy "job_alerts_admin_delete" on public.job_alerts
  for delete to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
    )
  );

-- All writes from public-facing actions go through the service role client.
