-- TheCOE initial schema + reference seed (NA, English product)
-- Apply via Supabase CLI or SQL editor after you create a project.

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0
);

create table public.role_families (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- Organizations (employers and agencies)
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  organization_type text not null check (organization_type in ('direct', 'agency')),
  country_code text not null check (country_code in ('US', 'CA')),
  stripe_customer_id text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  slug text not null unique,
  title text not null,
  primary_platform_id uuid not null references public.platforms (id),
  role_family_id uuid not null references public.role_families (id),
  country_code text not null check (country_code in ('US', 'CA')),
  location_label text,
  remote_policy text not null check (remote_policy in ('remote', 'hybrid', 'onsite', 'flexible')),
  employment_type text not null check (employment_type in ('full_time', 'part_time', 'contract')),
  listing_kind text not null check (listing_kind in ('paid', 'syndicated')),
  status text not null default 'draft' check (status in ('draft', 'open', 'filled', 'unpublished')),
  summary text,
  full_description text,
  external_apply_url text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint jobs_syndicated_requires_summary_and_url check (
    listing_kind <> 'syndicated'
    or (
      summary is not null
      and length(trim(summary)) > 0
      and external_apply_url is not null
      and length(trim(external_apply_url)) > 0
    )
  ),
  constraint jobs_paid_requires_body check (
    listing_kind <> 'paid'
    or (
      full_description is not null
      and length(trim(full_description)) > 0
    )
  )
);

create index jobs_status_platform_idx on public.jobs (status, primary_platform_id);
create index jobs_status_role_idx on public.jobs (status, role_family_id);
create index jobs_status_country_idx on public.jobs (status, country_code);
create index jobs_published_at_idx on public.jobs (published_at desc nulls last);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.platforms enable row level security;
alter table public.role_families enable row level security;
alter table public.organizations enable row level security;
alter table public.jobs enable row level security;

create policy "platforms_select_public"
  on public.platforms for select
  to anon, authenticated
  using (true);

create policy "role_families_select_public"
  on public.role_families for select
  to anon, authenticated
  using (true);

create policy "organizations_select_public_open_jobs"
  on public.organizations for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.organization_id = organizations.id
        and j.status = 'open'
    )
  );

create policy "jobs_select_public_open"
  on public.jobs for select
  to anon, authenticated
  using (status = 'open');

-- ---------------------------------------------------------------------------
-- Seed: platforms & role families (idempotent-ish for dev re-runs: use ON CONFLICT)
-- ---------------------------------------------------------------------------

insert into public.platforms (slug, name, sort_order) values
  ('anaplan', 'Anaplan', 10),
  ('pigment', 'Pigment', 20),
  ('onestream', 'OneStream', 30),
  ('workday-adaptive', 'Workday Adaptive Planning', 40),
  ('tagetik', 'Tagetik', 50),
  ('cube', 'Cube', 60)
on conflict (slug) do nothing;

insert into public.role_families (slug, name, sort_order) values
  ('model-builder', 'Model builder', 10),
  ('solution-architect', 'Solution architect', 20),
  ('business-analyst', 'Business analyst', 30),
  ('project-manager', 'Project manager', 40),
  ('platform-admin', 'Platform admin', 50)
on conflict (slug) do nothing;

-- Optional demo org + jobs (remove demo rows after go-live if you prefer a clean slate)
insert into public.organizations (name, slug, organization_type, country_code, verified)
values ('Demo Corp NA', 'demo-corp-na', 'direct', 'US', false)
on conflict (slug) do nothing;

insert into public.jobs (
  organization_id,
  slug,
  title,
  primary_platform_id,
  role_family_id,
  country_code,
  location_label,
  remote_policy,
  employment_type,
  listing_kind,
  status,
  summary,
  full_description,
  external_apply_url,
  published_at
)
select
  o.id,
  'anaplan-senior-model-builder-remote-us',
  'Senior Anaplan Model Builder',
  p.id,
  r.id,
  'US',
  'Remote — United States',
  'remote',
  'full_time',
  'paid',
  'open',
  null,
  E'## Role\n\nOwn core planning models in Anaplan for US FP&A.\n\n## You\n\n- Multi-year Anaplan experience\n- Strong communication with finance stakeholders\n',
  null,
  now()
from public.organizations o
cross join public.platforms p
cross join public.role_families r
where o.slug = 'demo-corp-na' and p.slug = 'anaplan' and r.slug = 'model-builder'
on conflict (slug) do nothing;

insert into public.jobs (
  organization_id,
  slug,
  title,
  primary_platform_id,
  role_family_id,
  country_code,
  location_label,
  remote_policy,
  employment_type,
  listing_kind,
  status,
  summary,
  full_description,
  external_apply_url,
  published_at
)
select
  o.id,
  'pigment-solution-architect-toronto',
  'Pigment Solution Architect',
  p.id,
  r.id,
  'CA',
  'Toronto, ON (hybrid)',
  'hybrid',
  'full_time',
  'syndicated',
  'open',
  'Lead enterprise planning deployments on Pigment for Canadian customers. Full description and application on the employer site.',
  null,
  'https://example.com/apply/pigment-sa',
  now()
from public.organizations o
cross join public.platforms p
cross join public.role_families r
where o.slug = 'demo-corp-na' and p.slug = 'pigment' and r.slug = 'solution-architect'
on conflict (slug) do nothing;
