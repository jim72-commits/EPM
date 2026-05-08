-- Allow candidates to withdraw applications that are shortlisted in addition
-- to submitted/under_review. Shortlist is non-terminal: a candidate who
-- accepts another offer should be able to signal that without going
-- out-of-band. Terminal statuses (rejected, hired, withdrawn) remain locked.

drop policy if exists "apps_update_candidate_withdraw" on public.job_applications;

create policy "apps_update_candidate_withdraw"
  on public.job_applications for update
  to authenticated
  using (
    candidate_user_id = auth.uid()
    and status in ('submitted', 'under_review', 'shortlisted')
  )
  with check (
    candidate_user_id = auth.uid()
    and status = 'withdrawn'
  );
