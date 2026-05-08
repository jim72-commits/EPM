-- Phase 7a: Postgres full-text search on jobs.
-- Adds a generated tsvector column covering title, summary, full_description,
-- and location_label, plus a GIN index. We intentionally keep the config
-- simple (english) and avoid joining the organization name into the vector so
-- updates stay local to the jobs table and index rebuilds stay cheap.

alter table public.jobs
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(full_description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(location_label, '')), 'D')
  ) stored;

create index if not exists jobs_search_vector_idx
  on public.jobs using gin (search_vector);
