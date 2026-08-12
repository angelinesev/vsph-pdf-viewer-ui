#!/usr/bin/env node
/**
 * Migrate legacy pdf_documents / pdf_access_links into brochures / brochure_links
 * under the Virtual Studios Legacy organization.
 *
 * Usage: node scripts/migrate-legacy-to-tenancy.js
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or .env / .env.local).
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { createClient } = require('@supabase/supabase-js');

const LEGACY_ORG_ID = '00000000-0000-4000-8000-000000000010';
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', LEGACY_ORG_ID)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) {
    console.error('Legacy org missing. Run supabase/migrations/002_multi_tenant.sql first.');
    process.exit(1);
  }

  const { data: docs, error: docsError } = await supabase
    .from('pdf_documents')
    .select('id, storage_path, filename, view_type, created_at');

  if (docsError) throw docsError;

  let migratedDocs = 0;
  let migratedLinks = 0;

  for (const doc of docs || []) {
    const { data: existing } = await supabase
      .from('brochures')
      .select('id')
      .eq('legacy_document_id', doc.id)
      .maybeSingle();

    let brochureId = existing?.id;
    if (!brochureId) {
      const { data: inserted, error: insertError } = await supabase
        .from('brochures')
        .insert({
          org_id: LEGACY_ORG_ID,
          storage_path: doc.storage_path,
          filename: doc.filename,
          view_type: doc.view_type || 'brochure',
          size_bytes: 0,
          created_by: 'legacy-migrate',
          legacy_document_id: doc.id,
          created_at: doc.created_at,
        })
        .select('id')
        .single();
      if (insertError) {
        if (String(insertError.message || '').includes('duplicate')) {
          const { data: byPath } = await supabase
            .from('brochures')
            .select('id')
            .eq('storage_path', doc.storage_path)
            .maybeSingle();
          brochureId = byPath?.id;
        } else {
          throw insertError;
        }
      } else {
        brochureId = inserted.id;
        migratedDocs += 1;
      }
    }

    if (!brochureId) continue;

    const { data: links, error: linksError } = await supabase
      .from('pdf_access_links')
      .select('token, view_type, expires_at, created_at')
      .eq('document_id', doc.id);

    if (linksError) throw linksError;

    for (const link of links || []) {
      const { error: linkInsertError } = await supabase
        .from('brochure_links')
        .upsert({
          token: link.token,
          brochure_id: brochureId,
          view_type: link.view_type || doc.view_type || 'brochure',
          expires_at: link.expires_at,
          created_at: link.created_at,
        }, { onConflict: 'token' });
      if (linkInsertError) throw linkInsertError;
      migratedLinks += 1;
    }
  }

  console.log(`Migrated ${migratedDocs} brochures, upserted ${migratedLinks} links into org ${LEGACY_ORG_ID}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
