-- ---------------------------------------------------------------------------
-- Phase I — Multi-seat org invites
-- ---------------------------------------------------------------------------
-- Owners can invite teammates to their organization. Pattern mirrors
-- candidate-side double-opt-in:
--
--   1. Owner creates an invite. We store a SHA-256 hash of a random token
--      so a database leak doesn't expose live invite links. Plain token
--      is in the email only.
--   2. Recipient clicks the link, signs in (or signs up — Supabase Auth
--      will reuse their session if they already have an account), and the
--      app calls `acceptOrgInvite`, which compares the hashed token and
--      inserts an organization_members row inside a transaction.
--   3. Owner can revoke an outstanding invite at any time. Accepted
--      invites stay around as a record (auditing) — we don't delete.
--
-- We also add `has_org_owner` so policies can require ownership without
-- copying the (member-by-role) join everywhere.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

create or replace function public.has_org_owner(org_id uuid)
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
      and m.role = 'owner'
  );
$$;

revoke all on function public.has_org_owner(uuid) from public;
grant execute on function public.has_org_owner(uuid) to authenticated;

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references auth.users (id) on delete restrict,
  role text not null default 'member' check (role in ('owner', 'member')),
  token_hash text not null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Lookups by token (during accept) must be fast and unique.
create unique index if not exists organization_invites_token_hash_idx
  on public.organization_invites (token_hash);

-- One pending invite per (org, email) at a time.
create unique index if not exists organization_invites_org_email_pending_idx
  on public.organization_invites (organization_id, lower(invited_email))
  where accepted_at is null and revoked_at is null;

create index if not exists organization_invites_org_idx
  on public.organization_invites (organization_id);

create index if not exists organization_invites_status_idx
  on public.organization_invites (organization_id, accepted_at, revoked_at);

alter table public.organization_invites enable row level security;

-- Org members can read invites for their org (owners *and* members; the
-- member-side display is "you can see who's invited even if you can't
-- invite yourself"). Direct token lookups for accept run via a security
-- definer function below, NOT through these select policies.
create policy "invites_select_member"
  on public.organization_invites for select
  to authenticated
  using (public.has_org_membership(organization_id));

create policy "invites_select_admin"
  on public.organization_invites for select
  to authenticated
  using (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));

-- Owners insert (create invite) and update (revoke). Plain members cannot.
create policy "invites_insert_owner"
  on public.organization_invites for insert
  to authenticated
  with check (
    public.has_org_owner(organization_id)
    and invited_by = auth.uid()
    and accepted_at is null
    and accepted_by is null
    and revoked_at is null
    and revoked_by is null
  );

create policy "invites_update_owner"
  on public.organization_invites for update
  to authenticated
  using (public.has_org_owner(organization_id))
  with check (public.has_org_owner(organization_id));

create policy "invites_insert_admin"
  on public.organization_invites for insert
  to authenticated
  with check (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));

create policy "invites_update_admin"
  on public.organization_invites for update
  to authenticated
  using (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));

create policy "invites_delete_admin"
  on public.organization_invites for delete
  to authenticated
  using (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Accept invite via security-definer RPC
-- ---------------------------------------------------------------------------
-- The recipient never sees `organization_invites` directly. They invoke
-- `accept_org_invite(token)` which:
--   - Hashes the supplied token
--   - Validates the invite is unaccepted, unrevoked, unexpired
--   - Inserts an organization_members row (or updates the role if the user
--     is already in the org and the invite asked for owner)
--   - Stamps the invite as accepted
-- All of that happens inside one transaction so a partial failure rolls
-- back. We return a tiny success record so the server action can route
-- the user appropriately.
-- ---------------------------------------------------------------------------

create or replace function public.accept_org_invite(invite_token text)
returns table (organization_id uuid, organization_slug text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.organization_invites%rowtype;
  v_user uuid := auth.uid();
  v_token_hash text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  v_token_hash := encode(digest(invite_token, 'sha256'), 'hex');

  select * into v_invite
  from public.organization_invites
  where token_hash = v_token_hash
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'invite_already_accepted' using errcode = 'P0001';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  insert into public.organization_members (user_id, organization_id, role)
  values (v_user, v_invite.organization_id, v_invite.role)
  on conflict (user_id, organization_id) do update
    set role = case
      when public.organization_members.role = 'owner' then 'owner'
      else excluded.role
    end;

  update public.organization_invites
    set accepted_at = now(),
        accepted_by = v_user
  where id = v_invite.id;

  return query
    select o.id, o.slug, v_invite.role
    from public.organizations o
    where o.id = v_invite.organization_id;
end;
$$;

revoke all on function public.accept_org_invite(text) from public;
grant execute on function public.accept_org_invite(text) to authenticated;
