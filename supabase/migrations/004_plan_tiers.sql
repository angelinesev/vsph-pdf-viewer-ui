-- Plan tiers: Free / Professional / Enterprise
-- Active brochure cap lives in monthly_brochure_limit (NULL = unlimited).
-- Storage cap is max_storage_bytes (NULL = custom / unlimited).
-- One developer-code login per organization (not a plan seat).

alter table public.plans
  alter column monthly_brochure_limit drop not null;

alter table public.plans
  add column if not exists max_storage_bytes bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'plans_max_storage_bytes_check'
  ) then
    alter table public.plans
      add constraint plans_max_storage_bytes_check
      check (max_storage_bytes is null or max_storage_bytes > 0);
  end if;
end $$;

-- Free
insert into public.plans (id, name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features)
values (
  '00000000-0000-4000-8000-000000000001',
  'Free',
  5,
  15728640,
  262144000,
  '{"flyer": true, "brochure": true, "analytics": "basic", "branding": "your_branding", "support": "community", "custom_domain": false, "api_access": false}'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  monthly_brochure_limit = excluded.monthly_brochure_limit,
  max_file_bytes = excluded.max_file_bytes,
  max_storage_bytes = excluded.max_storage_bytes,
  features = excluded.features;

-- Professional (was Pro)
insert into public.plans (id, name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features)
values (
  '00000000-0000-4000-8000-000000000002',
  'Professional',
  100,
  52428800,
  10737418240,
  '{"flyer": true, "brochure": true, "analytics": "advanced", "branding": "custom", "support": "priority", "custom_domain": "optional", "api_access": false}'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  monthly_brochure_limit = excluded.monthly_brochure_limit,
  max_file_bytes = excluded.max_file_bytes,
  max_storage_bytes = excluded.max_storage_bytes,
  features = excluded.features;

update public.plans
set name = 'Professional'
where name = 'Pro'
  and id <> '00000000-0000-4000-8000-000000000002';

-- Enterprise
insert into public.plans (id, name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features)
values (
  '00000000-0000-4000-8000-000000000003',
  'Enterprise',
  null,
  78643200,
  null,
  '{"flyer": true, "brochure": true, "analytics": "advanced", "branding": "white_label", "support": "dedicated", "custom_domain": true, "api_access": true}'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  monthly_brochure_limit = excluded.monthly_brochure_limit,
  max_file_bytes = excluded.max_file_bytes,
  max_storage_bytes = excluded.max_storage_bytes,
  features = excluded.features;

update storage.buckets
set file_size_limit = 78643200
where id = 'pdfs';
