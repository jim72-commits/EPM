-- Phase H: weekly profile-match digest for candidates.
--
-- Design notes
--  - Lives on candidate_profiles directly rather than a separate table. This
--    is a per-candidate feature and there's exactly one digest per profile;
--    a join table would be over-engineered.
--  - Default is opt-in. Candidates always have signup-time consent
--    (email confirmation), and the digest content is aggressively scoped
--    (only roles matching their stated work auth + remote prefs), so this
--    matches expectations. They can opt out from /me/profile.
--  - last_sent_job_ids is an array of UUID-as-text; mirroring the
--    job_alerts table's pattern. We use it to skip already-sent jobs in
--    case the same listing happens to land in two consecutive runs.

alter table public.candidate_profiles
  add column if not exists digest_opt_in boolean not null default true;

alter table public.candidate_profiles
  add column if not exists digest_last_sent_at timestamptz;

alter table public.candidate_profiles
  add column if not exists digest_last_job_ids text[] not null default '{}';

-- The cron only cares about candidates who haven't been emailed recently.
-- An index on last_sent_at lets the cron's filter "is null OR < cutoff" hit
-- the index instead of a full scan as the table grows.
create index if not exists candidate_profiles_digest_last_sent_idx
  on public.candidate_profiles (digest_last_sent_at)
  where digest_opt_in = true;
