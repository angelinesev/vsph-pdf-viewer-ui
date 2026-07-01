-- Run in Supabase SQL Editor if pdf_documents already exists without view_type

alter table public.pdf_documents
  add column if not exists view_type text not null default 'brochure';

alter table public.pdf_documents
  drop constraint if exists pdf_documents_view_type_check;

alter table public.pdf_documents
  add constraint pdf_documents_view_type_check
  check (view_type in ('brochure', 'flyer'));

alter table public.pdf_access_links
  add column if not exists view_type text not null default 'brochure';

alter table public.pdf_access_links
  drop constraint if exists pdf_access_links_view_type_check;

alter table public.pdf_access_links
  add constraint pdf_access_links_view_type_check
  check (view_type in ('brochure', 'flyer'));
