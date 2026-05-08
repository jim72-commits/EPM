-- Phase 5: Payments table + Stripe linkage on organizations.
-- Apply after employer memberships migration.

-- ---------------------------------------------------------------------------
-- Organizations: store Stripe customer id (one per org)
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists stripe_customer_id text unique;

-- ---------------------------------------------------------------------------
-- payments: one row per Stripe Checkout session initiated for a job.
-- status transitions: pending -> paid | failed | refunded
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  job_id uuid not null references public.jobs (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency in ('usd', 'cad')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);

create index if not exists payments_job_idx on public.payments (job_id);
create index if not exists payments_org_idx on public.payments (organization_id);
create index if not exists payments_status_idx on public.payments (status);

alter table public.payments enable row level security;

-- Admins see everything
create policy "payments_select_admin"
  on public.payments for select
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

-- Org members see their own org's payments
create policy "payments_select_member"
  on public.payments for select
  to authenticated
  using (public.has_org_membership(organization_id));

-- Writes only happen via service role (webhook) or admin; anon/employer never
-- write to payments directly. No insert/update/delete policies for authenticated
-- users means only service_role bypasses RLS.

-- ---------------------------------------------------------------------------
-- Prevent employers from directly inserting/updating jobs to 'open'. The
-- earlier migration already blocks status='open' in the employer policy's
-- WITH CHECK. The webhook uses the service role (bypasses RLS) to flip the
-- status to 'open' after 'checkout.session.completed'.
-- ---------------------------------------------------------------------------
