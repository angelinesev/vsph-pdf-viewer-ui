-- Projects (folders), brochure slugs, vanity denorm, view analytics
-- Run after 004_plan_tiers.sql

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (org_id, slug)
);

create index if not exists projects_org_id_idx on public.projects (org_id);
create index if not exists projects_slug_idx on public.projects (slug);

alter table public.brochures
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.brochures
  add column if not exists slug text;

alter table public.brochures
  add column if not exists title text;

create unique index if not exists brochures_project_slug_uidx
  on public.brochures (project_id, slug)
  where project_id is not null and slug is not null;

create index if not exists brochures_project_id_idx on public.brochures (project_id);

alter table public.brochure_links
  add column if not exists org_slug text;

alter table public.brochure_links
  add column if not exists project_slug text;

alter table public.brochure_links
  add column if not exists brochure_slug text;

create index if not exists brochure_links_vanity_idx
  on public.brochure_links (org_slug, project_slug, brochure_slug);

create table if not exists public.view_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  brochure_id uuid references public.brochures(id) on delete cascade,
  link_token text,
  occurred_at timestamptz not null default now(),
  country text not null default 'XX',
  visitor_day_hash text
);

create index if not exists view_events_brochure_occurred_idx
  on public.view_events (brochure_id, occurred_at desc);

create index if not exists view_events_org_occurred_idx
  on public.view_events (org_id, occurred_at desc);

create index if not exists view_events_project_occurred_idx
  on public.view_events (project_id, occurred_at desc);

alter table public.projects enable row level security;
alter table public.view_events enable row level security;

-- Seed Uncategorized project per org and attach orphan brochures
insert into public.projects (org_id, name, slug)
select o.id, 'Uncategorized', 'uncategorized'
from public.organizations o
where not exists (
  select 1 from public.projects p
  where p.org_id = o.id and p.slug = 'uncategorized'
);

update public.brochures b
set project_id = p.id,
    title = coalesce(b.title, b.filename),
    slug = coalesce(
      b.slug,
      lower(regexp_replace(regexp_replace(coalesce(b.filename, 'document'), '\.pdf$', '', 'i'), '[^a-z0-9]+', '-', 'g'))
    )
from public.projects p
where p.org_id = b.org_id
  and p.slug = 'uncategorized'
  and b.project_id is null;

-- Ensure slugs unique within project (append short id if needed)
update public.brochures b
set slug = left(b.slug || '-' || replace(b.id::text, '-', ''), 48)
where b.project_id is not null
  and exists (
    select 1 from public.brochures b2
    where b2.project_id = b.project_id
      and b2.slug = b.slug
      and b2.id < b.id
  );
