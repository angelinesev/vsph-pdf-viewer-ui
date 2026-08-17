#!/usr/bin/env node
/**
 * Applies 007_vsph_single_plan.sql when DATABASE_URL is set,
 * then upserts the single VSPH Plan and aligns the pdfs bucket to 50 MB.
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const VSPH_PLAN_ID = '00000000-0000-4000-8000-000000000002';
const MAX_FILE = 52428800; // 50 MB
const MAX_STORAGE = 16106127360; // 15 GB

const VSPH_PLAN = {
  id: VSPH_PLAN_ID,
  name: 'VSPH Plan',
  monthly_brochure_limit: 100,
  max_file_bytes: MAX_FILE,
  max_storage_bytes: MAX_STORAGE,
  features: {
    flyer: true,
    brochure: true,
    analytics: 'advanced',
    branding: 'custom',
    support: 'priority',
    custom_domain: false,
    api_access: false,
  },
};

async function runSqlFile() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) return false;
  const pg = require('pg');
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '007_vsph_single_plan.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Applied 007_vsph_single_plan.sql via DATABASE_URL');
    return true;
  } finally {
    await client.end();
  }
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  let sqlApplied = false;
  try {
    sqlApplied = await runSqlFile();
  } catch (err) {
    console.warn('SQL file apply skipped:', err.message);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: upsertError } = await supabase.from('plans').upsert(VSPH_PLAN, { onConflict: 'id' });
  if (upsertError) {
    console.error('Could not upsert VSPH Plan:', upsertError.message);
    if (!sqlApplied) {
      console.error('Run supabase/migrations/007_vsph_single_plan.sql in the Supabase SQL Editor, then re-run:');
      console.error('  npm run apply:vsph-plan');
    }
    process.exit(1);
  }
  console.log('Upserted VSPH Plan');

  const { error: orgError } = await supabase
    .from('organizations')
    .update({ plan_id: VSPH_PLAN_ID })
    .neq('plan_id', VSPH_PLAN_ID);
  if (orgError) {
    console.warn('org reassignment:', orgError.message);
  } else {
    console.log('Organizations reassigned to VSPH Plan');
  }

  for (const id of [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
  ]) {
    const { error } = await supabase.from('plans').delete().eq('id', id);
    if (error) console.warn(`delete plan ${id}:`, error.message);
  }

  const { error: bucketError } = await supabase.storage.updateBucket('pdfs', {
    fileSizeLimit: MAX_FILE,
    allowedMimeTypes: ['application/pdf'],
  });
  if (bucketError) {
    console.warn('updateBucket:', bucketError.message);
  } else {
    console.log('pdfs bucket file_size_limit = 50 MB');
  }

  const { data, error } = await supabase
    .from('plans')
    .select('id, name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features')
    .order('name');
  if (error) throw new Error(error.message);
  console.log('Plans:', JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
