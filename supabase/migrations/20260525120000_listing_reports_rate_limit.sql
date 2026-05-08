-- Phase L (admin UAT P2-8): defense-in-depth rate limit on listing_reports.
--
-- Why
--  - The original RLS policy was `with check (true)`, deferring all
--    rate-limiting and shape policing to the action layer. That works for
--    every legitimate path through the app, but a determined caller could
--    hit the Supabase REST endpoint directly with the anon key and flood
--    the moderation queue.
--  - Trust & safety reports are long-tail and inexpensive to ignore, so
--    the bar here is "make abuse meaningfully harder" rather than "perfect
--    cryptographic guarantees". A simple cap-per-window keyed on the same
--    fields the action layer already populates raises that bar.
--
-- Approach
--  - A SECURITY DEFINER helper sees the underlying table without RLS so it
--    can compute counts. The RLS policy delegates the real check to it.
--  - We additionally close a spoofing hole: a logged-in user can no longer
--    set reporter_user_id to anything other than their own auth.uid().
--    (The action layer already does the right thing; this is belt-and-
--    suspenders for direct REST inserts.)
--  - Limits are intentionally generous so good-faith reporters never get
--    blocked. Tighten later from telemetry, not from imagination.

create or replace function public.can_file_listing_report(
  p_job_id uuid,
  p_reporter_user_id uuid,
  p_reporter_email text
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  -- Spoofing guard: if a user_id is supplied, it must be the caller. Anon
  -- callers (auth.uid() is null) can't set a user_id at all.
  if p_reporter_user_id is not null then
    if auth.uid() is null or p_reporter_user_id <> auth.uid() then
      return false;
    end if;

    select count(*) into recent
    from public.listing_reports
    where reporter_user_id = p_reporter_user_id
      and created_at > now() - interval '1 hour';
    return recent < 10;
  end if;

  -- Anonymous-with-email path: throttle on the email field. Helps when the
  -- reporter wants admins to follow up but discourages mass spamming from a
  -- single mailbox.
  if p_reporter_email is not null then
    select count(*) into recent
    from public.listing_reports
    where reporter_email = p_reporter_email
      and reporter_user_id is null
      and created_at > now() - interval '1 hour';
    return recent < 5;
  end if;

  -- Pure anonymous path: there's no stable identity, so we throttle on the
  -- targeted listing — preventing a single attacker (or a brigade) from
  -- piling reports onto one job.
  select count(*) into recent
  from public.listing_reports
  where job_id = p_job_id
    and reporter_user_id is null
    and reporter_email is null
    and created_at > now() - interval '30 minutes';
  return recent < 3;
end;
$$;

grant execute on function public.can_file_listing_report(uuid, uuid, text)
  to anon, authenticated;

drop policy if exists "listing_reports_insert_public" on public.listing_reports;
create policy "listing_reports_insert_public"
  on public.listing_reports for insert
  to anon, authenticated
  with check (
    public.can_file_listing_report(job_id, reporter_user_id, reporter_email)
  );

comment on function public.can_file_listing_report(uuid, uuid, text) is
  'Soft rate-limit + spoofing guard for listing_reports inserts. Called from RLS.';
