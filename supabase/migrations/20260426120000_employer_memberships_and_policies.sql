-- Phase 4: employer memberships + employer-scoped RLS policies.
-- Apply after the admin policies migration.

-- ---------------------------------------------------------------------------
-- organization_members: link auth.users to organizations (owner / member)
-- ---------------------------------------------------------------------------

create table if not exists public.organization_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members (user_id);
create index if not exists organization_members_org_idx
  on public.organization_members (organization_id);

alter table public.organization_members enable row level security;

create policy "members_select_self"
  on public.organization_members for select
  to authenticated
  using (user_id = auth.uid());

create policy "members_select_admin"
  on public.organization_members for select
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

create policy "members_insert_admin"
  on public.organization_members for insert
  to authenticated
  with check (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

create policy "members_delete_admin"
  on public.organization_members for delete
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

create policy "members_update_admin"
  on public.organization_members for update
  to authenticated
  using (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Helper: has_org_membership (security definer, stable, no external access)
-- ---------------------------------------------------------------------------

create or replace function public.has_org_membership(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid()
      and m.organization_id = org_id
  );
$$;

revoke all on function public.has_org_membership(uuid) from public;
grant execute on function public.has_org_membership(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Organizations: members can read their own orgs (in addition to existing
-- public read for orgs with open jobs, and admin read).
-- ---------------------------------------------------------------------------

create policy "organizations_select_member"
  on public.organizations for select
  to authenticated
  using (public.has_org_membership(id));

-- ---------------------------------------------------------------------------
-- Jobs: members manage their org's jobs under strict rules.
-- Employers cannot flip status to 'open' (that transition belongs to admin
-- today and to the Stripe webhook in Phase 5) and can only create 'paid'
-- listings.
-- ---------------------------------------------------------------------------

create policy "jobs_select_member"
  on public.jobs for select
  to authenticated
  using (public.has_org_membership(organization_id));

create policy "jobs_insert_member"
  on public.jobs for insert
  to authenticated
  with check (
    public.has_org_membership(organization_id)
    and listing_kind = 'paid'
    and status = 'draft'
  );

create policy "jobs_update_member"
  on public.jobs for update
  to authenticated
  using (public.has_org_membership(organization_id))
  with check (
    public.has_org_membership(organization_id)
    and listing_kind = 'paid'
    and status in ('draft', 'unpublished', 'filled')
  );

create policy "jobs_delete_member"
  on public.jobs for delete
  to authenticated
  using (
    public.has_org_membership(organization_id)
    and status = 'draft'
  );
