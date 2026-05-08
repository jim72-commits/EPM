-- Phase D: hiring outcomes for closed listings.
--
-- Design notes
--  - One outcome row per close event. Reopening a listing later (rare;
--    requires admin help) creates a fresh listing rather than overwriting an
--    outcome — outcome history stays append-only by convention. The unique
--    constraint on job_id is intentional: a single listing has at most one
--    final outcome.
--  - `outcome` is a small enum tracking the four states from the original
--    spec: hired through us, hired off-platform, listing closed without
--    hiring (cancelled / role pulled), or actively decided not to hire.
--    Splitting "not hired" into two flavors gives us cleaner success-rate
--    math (cancellations don't drag down the conversion metric).
--  - `hired_application_id` links to the chosen application for double-sided
--    attribution. NULL for any non-`hired_here` outcome. A trigger enforces
--    that consistency rather than a bare check constraint, so we can also
--    flip the chosen application's status to `hired` atomically.
--  - `feedback` is optional free-text — we capture it but don't gate on it.
--  - Admins read everything; org members read their own org; candidates
--    never read this table directly. Their visibility comes through the
--    `hired` status flag on their own application row.

create table if not exists public.job_outcomes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  outcome text not null
    check (outcome in (
      'hired_here',
      'hired_elsewhere',
      'not_hired_cancelled',
      'not_hired_no_fit'
    )),
  hired_application_id uuid references public.job_applications (id) on delete set null,
  feedback text check (feedback is null or length(feedback) <= 4000),
  closed_by_user_id uuid not null references auth.users (id) on delete set null,
  closed_at timestamptz not null default now()
);

-- Hire attribution must line up with the outcome bucket. We want:
--  - hired_here  =>  hired_application_id IS NOT NULL
--  - !hired_here =>  hired_application_id IS NULL
alter table public.job_outcomes
  add constraint job_outcomes_hire_attribution_consistent
  check (
    (outcome = 'hired_here'  and hired_application_id is not null) or
    (outcome <> 'hired_here' and hired_application_id is null)
  );

create index if not exists job_outcomes_org_closed_at_idx
  on public.job_outcomes (organization_id, closed_at desc);

create index if not exists job_outcomes_outcome_idx
  on public.job_outcomes (outcome, closed_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.job_outcomes enable row level security;

-- org members read their org's outcomes
create policy "outcomes_select_org"
  on public.job_outcomes for select
  to authenticated
  using (public.has_org_membership(organization_id));

-- admins read all outcomes
create policy "outcomes_select_admin"
  on public.job_outcomes for select
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

-- org members insert outcomes for jobs they own. The action layer also
-- updates the matching jobs.status to 'filled' inside the same transaction
-- via a trigger below.
create policy "outcomes_insert_org"
  on public.job_outcomes for insert
  to authenticated
  with check (
    public.has_org_membership(organization_id)
    and exists (
      select 1 from public.jobs j
      where j.id = job_outcomes.job_id
        and j.organization_id = job_outcomes.organization_id
    )
  );

-- admins may insert / correct outcomes
create policy "outcomes_insert_admin"
  on public.job_outcomes for insert
  to authenticated
  with check (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- On-close trigger: flip the listing to filled and the picked app to hired.
-- ---------------------------------------------------------------------------
--
-- Doing this in a trigger keeps the side-effects atomic with the outcome
-- insert, so we can never end up with a job_outcomes row that doesn't match
-- a filled job (or a hired_here outcome where the matched application is
-- still in some interim state).

create or replace function public.apply_job_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mark the job as filled at close time. We don't roll forward `published_at`
  -- or other audit fields — that history is preserved as-is.
  update public.jobs
     set status = 'filled'
   where id = new.job_id;

  -- For hired_here outcomes, promote the picked application to `hired` and
  -- drop any other still-pending applications to `rejected` so candidates
  -- get an honest signal.
  if new.outcome = 'hired_here' and new.hired_application_id is not null then
    update public.job_applications
       set status = 'hired'
     where id = new.hired_application_id
       and job_id = new.job_id;

    update public.job_applications
       set status = 'rejected'
     where job_id = new.job_id
       and id <> new.hired_application_id
       and status in ('submitted', 'under_review', 'shortlisted');
  else
    -- For non-hired outcomes, close out remaining open applications by
    -- moving them to 'rejected'. Withdrawn / already-rejected rows stay put.
    update public.job_applications
       set status = 'rejected'
     where job_id = new.job_id
       and status in ('submitted', 'under_review', 'shortlisted');
  end if;

  return new;
end;
$$;

drop trigger if exists job_outcomes_apply on public.job_outcomes;
create trigger job_outcomes_apply
  after insert on public.job_outcomes
  for each row execute procedure public.apply_job_outcome();

-- ---------------------------------------------------------------------------
-- Helper: per-org outcome rollups for the admin dashboard.
-- ---------------------------------------------------------------------------
-- Exposed as a view so we can rely on RLS via the underlying tables. Admins
-- and org members will see their own slice; candidates / anonymous see
-- nothing.

create or replace view public.org_outcome_rollups
with (security_invoker = on)
as
select
  o.organization_id,
  org.slug as organization_slug,
  org.name as organization_name,
  count(*) as total_closed,
  count(*) filter (where o.outcome = 'hired_here') as hired_here,
  count(*) filter (where o.outcome = 'hired_elsewhere') as hired_elsewhere,
  count(*) filter (where o.outcome = 'not_hired_no_fit') as not_hired_no_fit,
  count(*) filter (where o.outcome = 'not_hired_cancelled') as not_hired_cancelled,
  max(o.closed_at) as last_closed_at
from public.job_outcomes o
join public.organizations org on org.id = o.organization_id
group by o.organization_id, org.slug, org.name;

comment on view public.org_outcome_rollups is
  'Aggregated outcome counts per organization. Backed by RLS on job_outcomes.';
