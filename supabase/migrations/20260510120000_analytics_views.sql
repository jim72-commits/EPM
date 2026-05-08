-- ---------------------------------------------------------------------------
-- Phase J — Analytics deeper-cut
-- ---------------------------------------------------------------------------
-- Two read-only views for the admin analytics dashboard:
--
--   1. job_time_to_first_applicant — per-job latency (publish → first
--      application). Lets admins eyeball outliers and feeds the org-level
--      rollup used on the dashboard.
--
--   2. applicant_funnel_role_family — submitted / shortlisted / hired
--      counts grouped by role family. This is the funnel admins look at to
--      decide which role types convert and which need editorial help.
--
-- Both views run with security_invoker = on, which means they inherit RLS
-- from the underlying tables. The /admin/analytics page is gated by admin
-- auth and admin RLS policies on `jobs` and `job_applications` give admins
-- full read access, so the dashboard sees the unfiltered numbers.
-- ---------------------------------------------------------------------------

create or replace view public.job_time_to_first_applicant
with (security_invoker = on)
as
select
  j.id                              as job_id,
  j.title                           as job_title,
  j.slug                            as job_slug,
  j.organization_id,
  j.role_family_id,
  j.primary_platform_id,
  j.status                          as job_status,
  j.published_at,
  min(a.applied_at)                 as first_applied_at,
  count(a.id)                       as total_applicants,
  case
    when min(a.applied_at) is null then null
    else extract(
      epoch from (min(a.applied_at) - j.published_at)
    ) / 3600.0
  end                               as hours_to_first_applicant
from public.jobs j
left join public.job_applications a on a.job_id = j.id
where j.published_at is not null
group by
  j.id,
  j.title,
  j.slug,
  j.organization_id,
  j.role_family_id,
  j.primary_platform_id,
  j.status,
  j.published_at;

comment on view public.job_time_to_first_applicant is
  'Per-job latency from publish to first application. Includes jobs with zero applicants (NULL hours).';

-- ---------------------------------------------------------------------------
-- Funnel by role family
-- ---------------------------------------------------------------------------
-- left join chain so role families with zero jobs / zero applicants still
-- show up at zero. The dashboard wants gaps highlighted as much as wins.

create or replace view public.applicant_funnel_role_family
with (security_invoker = on)
as
select
  rf.id                                                                        as role_family_id,
  rf.slug                                                                      as role_family_slug,
  rf.name                                                                      as role_family_name,
  rf.sort_order                                                                as role_family_sort_order,
  count(distinct j.id) filter (where j.published_at is not null)               as published_jobs,
  count(a.id)                                                                  as total_applications,
  count(a.id) filter (where a.status = 'submitted')                            as submitted,
  count(a.id) filter (where a.status = 'under_review')                         as under_review,
  count(a.id) filter (where a.status = 'shortlisted')                          as shortlisted,
  count(a.id) filter (where a.status = 'rejected')                             as rejected,
  count(a.id) filter (where a.status = 'hired')                                as hired,
  count(a.id) filter (where a.status = 'withdrawn')                            as withdrawn,
  -- Hire rate = hired / (everything except withdrawn). Withdrawn applicants
  -- are out of the funnel so we don't punish role families when candidates
  -- self-pull.
  case
    when count(a.id) filter (where a.status <> 'withdrawn') = 0 then null
    else
      (count(a.id) filter (where a.status = 'hired'))::numeric
      / nullif(count(a.id) filter (where a.status <> 'withdrawn'), 0)
  end                                                                          as hire_rate
from public.role_families rf
left join public.jobs j on j.role_family_id = rf.id
left join public.job_applications a on a.job_id = j.id
group by rf.id, rf.slug, rf.name, rf.sort_order;

comment on view public.applicant_funnel_role_family is
  'Per-role-family applicant funnel. Withdrawn applications excluded from hire_rate denominator.';
