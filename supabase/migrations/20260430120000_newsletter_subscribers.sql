-- Phase 7b: Newsletter subscribers with double opt-in.
-- All writes go through the service role client from server actions.
-- RLS blocks anon and authenticated users entirely; only admins and
-- service-role clients can read.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  confirm_token text not null unique,
  unsubscribe_token text not null unique,
  confirmed_at timestamptz,
  source text,
  last_sent_confirm_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists newsletter_subscribers_confirmed_at_idx
  on public.newsletter_subscribers (confirmed_at);
create index if not exists newsletter_subscribers_created_at_idx
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

create policy "newsletter_admin_select" on public.newsletter_subscribers
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
    )
  );

-- Writes are explicitly denied for authenticated users. The service role
-- client bypasses RLS entirely for server-action-driven inserts/updates.
create policy "newsletter_admin_update" on public.newsletter_subscribers
  for update to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
    )
  );

create policy "newsletter_admin_delete" on public.newsletter_subscribers
  for delete to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
    )
  );
