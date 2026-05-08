-- Defense-in-depth: refuse to record an outcome unless the underlying job
-- is currently `open`. The action layer already checks this, but admins
-- can also insert outcome rows directly via the `outcomes_insert_admin`
-- policy, and any future caller (cron, script, RPC) would otherwise be
-- able to mark a draft / unpublished listing as `filled` via the
-- after-insert trigger that promotes status.
--
-- We extend the existing apply_job_outcome trigger function rather than
-- adding a separate before-insert trigger, since both run in the same
-- transaction and rolling back here is equivalent. Raising
-- `invalid_parameter_value` (SQLSTATE 22023) gives Postgrest a clean
-- 4xx-shaped failure for the API surface.

create or replace function public.apply_job_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select j.status into v_status
    from public.jobs j
   where j.id = new.job_id;

  if v_status is null then
    raise exception 'Job % does not exist', new.job_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_status <> 'open' then
    raise exception
      'Only open listings can be closed with an outcome (job % is %)',
      new.job_id, v_status
      using errcode = 'invalid_parameter_value';
  end if;

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
