-- Multi-tenant Brochure SaaS schema
-- Run after schema.sql / 001_add_view_type.sql

-- Plans
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  monthly_brochure_limit integer not null default 10 check (monthly_brochure_limit >= 0),
  max_file_bytes bigint not null default 52428800 check (max_file_bytes > 0),
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists organizations_plan_id_idx on public.organizations (plan_id);

-- Developer codes (tenant gate: code + password)
create table if not exists public.developer_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique,
  password_hash text not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists developer_codes_org_id_idx on public.developer_codes (org_id);

-- Platform admins (Supabase Auth users)
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- Developer sessions (code+password login)
create table if not exists public.developer_sessions (
  token text primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  developer_code_id uuid references public.developer_codes(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists developer_sessions_org_id_idx on public.developer_sessions (org_id);
create index if not exists developer_sessions_expires_at_idx on public.developer_sessions (expires_at);

-- Brochures (tenant documents)
create table if not exists public.brochures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null unique,
  filename text not null,
  view_type text not null default 'brochure' check (view_type in ('brochure', 'flyer')),
  size_bytes bigint not null default 0,
  created_by text,
  legacy_document_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists brochures_org_id_idx on public.brochures (org_id);
create index if not exists brochures_created_at_idx on public.brochures (created_at desc);

-- Share links (null expires_at = never)
create table if not exists public.brochure_links (
  token text primary key,
  brochure_id uuid not null references public.brochures(id) on delete cascade,
  view_type text not null default 'brochure' check (view_type in ('brochure', 'flyer')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists brochure_links_brochure_id_idx on public.brochure_links (brochure_id);
create index if not exists brochure_links_expires_at_idx on public.brochure_links (expires_at);

-- Monthly usage for quota
create table if not exists public.usage_monthly (
  org_id uuid not null references public.organizations(id) on delete cascade,
  year_month text not null check (year_month ~ '^\d{4}-\d{2}$'),
  brochure_count integer not null default 0 check (brochure_count >= 0),
  primary key (org_id, year_month)
);

-- Seed default plans
insert into public.plans (id, name, monthly_brochure_limit, max_file_bytes, features)
values
  ('00000000-0000-4000-8000-000000000001', 'Free', 10, 52428800, '{"flyer": true, "brochure": true}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', 'Pro', 100, 52428800, '{"flyer": true, "brochure": true}'::jsonb)
on conflict (name) do nothing;

-- Legacy catch-all org for migrated documents
insert into public.organizations (id, name, slug, plan_id, status)
values (
  '00000000-0000-4000-8000-000000000010',
  'Virtual Studios Legacy',
  'legacy',
  '00000000-0000-4000-8000-000000000002',
  'active'
)
on conflict (slug) do nothing;

-- RLS: Edge Functions use service_role; no direct anon access
alter table public.plans enable row level security;
alter table public.organizations enable row level security;
alter table public.developer_codes enable row level security;
alter table public.platform_admins enable row level security;
alter table public.developer_sessions enable row level security;
alter table public.brochures enable row level security;
alter table public.brochure_links enable row level security;
alter table public.usage_monthly enable row level security;
