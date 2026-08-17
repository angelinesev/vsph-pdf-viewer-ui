-- Harden RLS: no direct client access to tenant analytics or project rows.
-- Service role (Netlify SaaS API) bypasses RLS; anon/authenticated must not read.

alter table public.projects enable row level security;
alter table public.view_events enable row level security;
alter table public.brochures enable row level security;
alter table public.brochure_links enable row level security;
alter table public.organizations enable row level security;
alter table public.developer_sessions enable row level security;
alter table public.developer_codes enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.platform_admins enable row level security;
alter table public.plans enable row level security;

-- Explicit deny-all for anon + authenticated (defense in depth; no policies = deny,
-- but naming these makes intent clear in the dashboard).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'view_events' and policyname = 'view_events_no_direct'
  ) then
    create policy view_events_no_direct on public.view_events
      for all to anon, authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'projects_no_direct'
  ) then
    create policy projects_no_direct on public.projects
      for all to anon, authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brochures' and policyname = 'brochures_no_direct'
  ) then
    create policy brochures_no_direct on public.brochures
      for all to anon, authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brochure_links' and policyname = 'brochure_links_no_direct'
  ) then
    create policy brochure_links_no_direct on public.brochure_links
      for all to anon, authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'developer_sessions' and policyname = 'developer_sessions_no_direct'
  ) then
    create policy developer_sessions_no_direct on public.developer_sessions
      for all to anon, authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'developer_codes' and policyname = 'developer_codes_no_direct'
  ) then
    create policy developer_codes_no_direct on public.developer_codes
      for all to anon, authenticated
      using (false) with check (false);
  end if;
end $$;

-- Indexes already cover org_id filters used by the API for tenant isolation.
comment on table public.view_events is
  'Analytics events; readable only via service_role SaaS API scoped by org_id.';
