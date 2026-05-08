-- P2-4: expose close-outcome signals (kind + closed_at) to candidates whose
-- application was on a closed listing, so the in-app banner can match the
-- email body the candidate already received.
--
-- Why a view (not a direct RLS policy on job_outcomes):
--   `feedback` and `closed_by_user_id` are operator-side context that the
--   candidate shouldn't see. Adding a row-level policy would expose the
--   whole row. A view lets us hide the sensitive columns at the schema
--   level, so even a hand-rolled API call can't reach them.
--
-- The view runs as the owner (no security_invoker), so the underlying
-- RLS on job_outcomes doesn't block reads; the view's own WHERE clause
-- restricts visibility to outcomes for jobs the caller applied to.

create or replace view public.candidate_outcome_signals as
select
  o.job_id,
  o.outcome,
  o.closed_at
from public.job_outcomes o
where exists (
  select 1 from public.job_applications ja
  where ja.job_id = o.job_id
    and ja.candidate_user_id = auth.uid()
);

comment on view public.candidate_outcome_signals is
  'Close-outcome metadata (kind + closed_at) for jobs the calling candidate applied to. Excludes operator-only fields like feedback.';

grant select on public.candidate_outcome_signals to authenticated;
