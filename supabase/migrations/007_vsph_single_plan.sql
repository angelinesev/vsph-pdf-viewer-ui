-- Single product plan: VSPH Plan
-- Limits: 100 brochures, 50 MB max upload, 15 GB storage
-- Reuses Professional id (...0002) as the canonical plan.

-- Ensure VSPH Plan exists with fixed quotas
insert into public.plans (id, name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features)
values (
  '00000000-0000-4000-8000-000000000002',
  'VSPH Plan',
  100,
  52428800,
  16106127360,
  '{"flyer": true, "brochure": true, "analytics": "advanced", "branding": "custom", "support": "priority", "custom_domain": false, "api_access": false}'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  monthly_brochure_limit = excluded.monthly_brochure_limit,
  max_file_bytes = excluded.max_file_bytes,
  max_storage_bytes = excluded.max_storage_bytes,
  features = excluded.features;

-- Also rename any leftover "Professional" / "Pro" rows pointing at this id (covered by upsert above)

-- Point every organization at VSPH Plan
update public.organizations
set plan_id = '00000000-0000-4000-8000-000000000002'
where plan_id is distinct from '00000000-0000-4000-8000-000000000002';

-- Remove retired tier rows (safe after reassignment)
delete from public.plans
where id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003'
);

delete from public.plans
where name in ('Free', 'Professional', 'Pro', 'Enterprise')
  and id <> '00000000-0000-4000-8000-000000000002';

-- Align storage bucket with 50 MB max upload
update storage.buckets
set file_size_limit = 52428800
where id = 'pdfs';
