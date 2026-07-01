-- Run in Supabase SQL Editor (Dashboard ? SQL ? New query)

-- Private PDF storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pdfs',
  'pdfs',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do nothing;

-- Document metadata
create table if not exists public.pdf_documents (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  filename text not null,
  view_type text not null default 'brochure' check (view_type in ('brochure', 'flyer')),
  created_at timestamptz not null default now()
);

-- Expiring client access tokens
create table if not exists public.pdf_access_links (
  token text primary key,
  document_id uuid not null references public.pdf_documents(id) on delete cascade,
  view_type text not null default 'brochure' check (view_type in ('brochure', 'flyer')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists pdf_access_links_expires_at_idx
  on public.pdf_access_links (expires_at);

create index if not exists pdf_access_links_document_id_idx
  on public.pdf_access_links (document_id);

-- RLS: service role bypasses; anon/authenticated have no direct access
alter table public.pdf_documents enable row level security;
alter table public.pdf_access_links enable row level security;

-- Storage policies: only service role (used by API server) can read/write
create policy "Service role manages pdfs"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'pdfs')
  with check (bucket_id = 'pdfs');
