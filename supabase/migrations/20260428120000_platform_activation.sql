-- Phase 4.5: platform activation flag for Anaplan-first go-live.
-- TheCOE launches as an Anaplan-only board. Other platforms stay seeded in
-- the database so they can be activated later without a migration.

alter table public.platforms
  add column if not exists is_active boolean not null default true;

-- Deactivate every platform except Anaplan for go-live. Admin can flip
-- others on later with a single UPDATE or through a future admin UI.
update public.platforms
set is_active = false
where slug <> 'anaplan';

create index if not exists platforms_is_active_idx
  on public.platforms (is_active);
