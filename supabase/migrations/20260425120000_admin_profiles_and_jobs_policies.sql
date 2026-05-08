-- Admin profiles + job/org write policies (apply after initial schema migration)

-- ---------------------------------------------------------------------------
-- Admin: map auth.users to admin role (bootstrap first row via SQL editor)
-- ---------------------------------------------------------------------------

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

create policy "admin_profiles_select_self"
  on public.admin_profiles for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update policies: only service role (dashboard SQL) adds admins.

-- ---------------------------------------------------------------------------
-- Jobs: split public read; admin read/write all
-- ---------------------------------------------------------------------------

drop policy if exists "jobs_select_public_open" on public.jobs;

create policy "jobs_select_anon"
  on public.jobs for select
  to anon
  using (status = 'open');

create policy "jobs_select_authenticated"
  on public.jobs for select
  to authenticated
  using (
    status = 'open'
    or exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "jobs_insert_admin"
  on public.jobs for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "jobs_update_admin"
  on public.jobs for update
  to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "jobs_delete_admin"
  on public.jobs for delete
  to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Organizations: admin read/write all (public read unchanged)
-- ---------------------------------------------------------------------------

create policy "organizations_select_admin"
  on public.organizations for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "organizations_insert_admin"
  on public.organizations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "organizations_update_admin"
  on public.organizations for update
  to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );
