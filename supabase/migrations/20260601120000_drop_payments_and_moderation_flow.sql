-- Pivot: TheCOE goes free + ad-supported.
--
-- Removes all payment / Stripe surface area from the schema and replaces the
-- former Stripe-webhook publishing path with an admin moderation queue.
--
-- Key model changes:
--   1. Drop the payments table and its policies.
--   2. Drop organizations.stripe_customer_id.
--   3. Rename jobs.listing_kind value 'paid' to 'employer'. Semantics shift
--      from "the employer paid for this slot" to "the employer themselves
--      authored this listing on TheCOE." 'syndicated' stays for future
--      aggregated/scraped sources.
--   4. Add 'pending_review' and 'rejected' to jobs.status. New flow:
--          draft -> pending_review -> open      (employer submit, admin approve)
--                                  -> rejected  (admin reject; employer can fix and resubmit)
--                       open       -> filled    (close-with-outcome, unchanged)
--   5. Add jobs.moderation_note for admin rejection feedback.
--   6. Replace employer RLS policies on jobs: drop the 'listing_kind = paid'
--      and 'status = draft' restrictions; allow draft / unpublished /
--      pending_review / rejected / filled transitions but never 'open' or
--      direct sets to 'rejected' (admin-only).
--
-- Migrations are append-only, so this file leaves the older 'paid'-shaped
-- migrations on disk; running them on a fresh DB still works because this
-- migration (which runs after) brings everything to the new shape.

-- ---------------------------------------------------------------------------
-- 1. Drop payments table.
-- ---------------------------------------------------------------------------
-- Cascading the drop also removes the payments-scoped RLS policies created
-- in 20260427120000_payments_and_stripe.sql.

drop table if exists public.payments cascade;

-- ---------------------------------------------------------------------------
-- 2. Drop the Stripe customer id column on organizations.
-- ---------------------------------------------------------------------------

alter table public.organizations
  drop column if exists stripe_customer_id;

-- ---------------------------------------------------------------------------
-- 3. Rename jobs.listing_kind 'paid' -> 'employer' and tighten the check.
-- ---------------------------------------------------------------------------
-- The check constraint must be dropped before the UPDATE, otherwise the
-- check fires per-row mid-update.

alter table public.jobs
  drop constraint if exists jobs_listing_kind_check;

-- Constraint name above is the auto-generated name from the original
-- `check (listing_kind in ('paid','syndicated'))`. If your installation
-- chose a different name, this is a no-op (drop if exists). The
-- `jobs_paid_requires_body` constraint is named explicitly below.

alter table public.jobs
  drop constraint if exists jobs_paid_requires_body;

update public.jobs
   set listing_kind = 'employer'
 where listing_kind = 'paid';

alter table public.jobs
  add constraint jobs_listing_kind_check
  check (listing_kind in ('employer', 'syndicated'));

alter table public.jobs
  add constraint jobs_employer_requires_body
  check (
    listing_kind <> 'employer'
    or (
      full_description is not null
      and length(trim(full_description)) > 0
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Extend jobs.status with 'pending_review' and 'rejected'.
-- ---------------------------------------------------------------------------

alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
  check (
    status in (
      'draft',
      'pending_review',
      'open',
      'filled',
      'unpublished',
      'rejected'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Moderation note (admin-set when rejecting).
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists moderation_note text
    check (moderation_note is null or length(moderation_note) <= 2000);

-- ---------------------------------------------------------------------------
-- 6. Replace employer RLS policies on jobs.
-- ---------------------------------------------------------------------------
-- The originals from 20260426120000 reference listing_kind = 'paid' and
-- limit status writes to 'draft' (insert) and ('draft','unpublished','filled')
-- (update). They no longer match the new flow.

drop policy if exists "jobs_insert_member" on public.jobs;
drop policy if exists "jobs_update_member" on public.jobs;
drop policy if exists "jobs_delete_member" on public.jobs;

-- Insert: employers can create only 'employer'-kind drafts. The seed must
-- start in 'draft'; transitions to 'pending_review' happen on a subsequent
-- update once the employer hits Submit for Review.
create policy "jobs_insert_member"
  on public.jobs for insert
  to authenticated
  with check (
    public.has_org_membership(organization_id)
    and listing_kind = 'employer'
    and status = 'draft'
  );

-- Update: employers can edit their org's listings and move them through
-- self-serve states. 'open' and 'rejected' are admin-only target states
-- (admin uses the service role and bypasses RLS, so we don't have to allow
-- those here). 'filled' stays allowed because the close-with-outcome
-- trigger runs as security definer and writes via owner privileges, but
-- employers may also want to edit metadata of a closed listing.
create policy "jobs_update_member"
  on public.jobs for update
  to authenticated
  using (public.has_org_membership(organization_id))
  with check (
    public.has_org_membership(organization_id)
    and listing_kind = 'employer'
    and status in (
      'draft',
      'pending_review',
      'unpublished',
      'filled'
    )
  );

create policy "jobs_delete_member"
  on public.jobs for delete
  to authenticated
  using (
    public.has_org_membership(organization_id)
    and status in ('draft', 'rejected')
  );

-- ---------------------------------------------------------------------------
-- 7. Helpful index for the moderation queue.
-- ---------------------------------------------------------------------------

create index if not exists jobs_status_pending_review_idx
  on public.jobs (status, created_at)
  where status = 'pending_review';
