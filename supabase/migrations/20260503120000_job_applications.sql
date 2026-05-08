-- Phase B: in-site job applications.
--
-- Design notes
--  - One row per (job, candidate) pair. Unique constraint prevents dupes;
--    candidates who want to "reapply" must withdraw first and live with the
--    withdrawn record — that's the honest signal to employers.
--  - resume_snapshot_path is a *copy* of the candidate's current resume at
--    apply time, not a live reference. The server copies the PDF into an
--    application-owned storage path so later profile edits (including
--    replacing the resume) cannot mutate what the employer sees.
--  - profile_snapshot jsonb freezes name/headline/years/work-auth/etc at
--    apply time for the same reason.
--  - Employers have NO direct SELECT on candidate_profiles or
--    candidate_credentials; everything they need about the applicant lives
--    in the application row's snapshot. Post-application visibility only.
--  - Status transitions are enforced at the server-action layer. The RLS
--    policies only gate *who* can update, not *how* state machines flow,
--    so Phase D's bulk close operation doesn't need to fight constraints.

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  candidate_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'shortlisted', 'rejected', 'hired', 'withdrawn')),
  cover_letter text check (cover_letter is null or length(cover_letter) <= 5000),
  resume_snapshot_path text not null,
  profile_snapshot jsonb not null,
  employer_notes text check (employer_notes is null or length(employer_notes) <= 4000),
  applied_at timestamptz not null default now(),
  status_updated_at timestamptz not null default now(),
  unique (job_id, candidate_user_id)
);

create index if not exists job_applications_job_status_idx
  on public.job_applications (job_id, status, applied_at desc);

create index if not exists job_applications_candidate_idx
  on public.job_applications (candidate_user_id, applied_at desc);

-- ---------------------------------------------------------------------------
-- Keep status_updated_at fresh whenever status changes.
-- ---------------------------------------------------------------------------

create or replace function public.set_application_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists job_applications_status_updated_at on public.job_applications;
create trigger job_applications_status_updated_at
  before update on public.job_applications
  for each row execute procedure public.set_application_status_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.job_applications enable row level security;

-- candidates see their own applications
create policy "apps_select_candidate"
  on public.job_applications for select
  to authenticated
  using (candidate_user_id = auth.uid());

-- employers see applications for jobs owned by one of their orgs
create policy "apps_select_employer"
  on public.job_applications for select
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id
        and public.has_org_membership(j.organization_id)
    )
  );

-- admins see all
create policy "apps_select_admin"
  on public.job_applications for select
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

-- candidates submit applications to open, paid jobs only
create policy "apps_insert_candidate"
  on public.job_applications for insert
  to authenticated
  with check (
    candidate_user_id = auth.uid()
    and status = 'submitted'
    and exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id
        and j.status = 'open'
        and j.listing_kind = 'paid'
    )
  );

-- candidates may withdraw an application before employer action
create policy "apps_update_candidate_withdraw"
  on public.job_applications for update
  to authenticated
  using (
    candidate_user_id = auth.uid()
    and status in ('submitted', 'under_review')
  )
  with check (
    candidate_user_id = auth.uid()
    and status = 'withdrawn'
  );

-- employers update status / notes for applications on their org's jobs
create policy "apps_update_employer"
  on public.job_applications for update
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id
        and public.has_org_membership(j.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id
        and public.has_org_membership(j.organization_id)
    )
  );

-- admin update for ops / cleanup
create policy "apps_update_admin"
  on public.job_applications for update
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );
