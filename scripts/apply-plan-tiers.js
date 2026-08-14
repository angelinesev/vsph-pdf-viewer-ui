#!/usr/bin/env node
/**
 * Applies 004_plan_tiers.sql when DATABASE_URL is set,
 * then upserts plan rows via the service role and raises the pdfs bucket limit.
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const FREE_ID = '00000000-0000-4000-8000-000000000001';
const PRO_ID = '00000000-0000-4000-8000-000000000002';
const ENT_ID = '00000000-0000-4000-8000-000000000003';
const MAX_FILE = 78643200;

const PLANS = [
  {
    id: FREE_ID,
    name: 'Free',
    monthly_brochure_limit: 5,
    max_file_bytes: 15728640,
    max_storage_bytes: 262144000,
    features: {
      flyer: true,
      brochure: true,
      analytics: 'basic',
      branding: 'your_branding',
      support: 'community',
      custom_domain: false,
      api_access: false,
      max_storage_bytes: 262144000,
    },
  },
  {
    id: PRO_ID,
    name: 'Professional',
    monthly_brochure_limit: 100,
    max_file_bytes: 52428800,
    max_storage_bytes: 10737418240,
    features: {
      flyer: true,
      brochure: true,
      analytics: 'advanced',
      branding: 'custom',
      support: 'priority',
      custom_domain: 'optional',
      api_access: false,
      max_storage_bytes: 10737418240,
    },
  },
  {
    id: ENT_ID,
    name: 'Enterprise',
    monthly_brochure_limit: null,
    max_file_bytes: MAX_FILE,
    max_storage_bytes: null,
    features: {
      flyer: true,
      brochure: true,
      analytics: 'advanced',
      branding: 'white_label',
      support: 'dedicated',
      custom_domain: true,
      api_access: true,
      unlimited_brochures: true,
      unlimited_storage: true,
    },
  },
];

async function runSqlFile() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) return false;
  const pg = require('pg');
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '004_plan_tiers.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Applied 004_plan_tiers.sql via DATABASE_URL');
    return true;
  } finally {
    await client.end();
  }
}

async function upsertPlans(supabase) {
  for (const plan of PLANS) {
    let { error } = await supabase.from('plans').upsert(plan, { onConflict: 'id' });
    if (error && /max_storage_bytes|null value/i.test(error.message)) {
      const fallback = {
        id: plan.id,
        name: plan.name,
        monthly_brochure_limit: plan.monthly_brochure_limit == null ? 2147483647 : plan.monthly_brochure_limit,
        max_file_bytes: plan.max_file_bytes,
        features: plan.features,
      };
      ({ error } = await supabase.from('plans').upsert(fallback, { onConflict: 'id' }));
    }
    if (error) throw new Error(`plans upsert ${plan.name}: ${error.message}`);
    console.log(`Upserted plan ${plan.name}`);
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

  const { error: bucketError } = await supabase.storage.updateBucket('pdfs', {
    fileSizeLimit: MAX_FILE,
    allowedMimeTypes: ['application/pdf'],
  });
  if (bucketError) {
    console.warn('updateBucket:', bucketError.message);
  } else {
    console.log('pdfs bucket file_size_limit = 75 MB');
  }

  try {
    await upsertPlans(supabase);
  } catch (err) {
    if (!sqlApplied) {
      console.error('\nCould not add max_storage_bytes / update plans.');
      console.error('Run supabase/migrations/004_plan_tiers.sql in the Supabase SQL Editor, then re-run:');
      console.error('  npm run apply:plan-tiers');
    }
    throw err;
  }

  const { data, error } = await supabase
    .from('plans')
    .select('name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features')
    .order('name');
  if (error && /max_storage_bytes/i.test(error.message)) {
    const retry = await supabase
      .from('plans')
      .select('name, monthly_brochure_limit, max_file_bytes, features')
      .order('name');
    if (retry.error) throw new Error(retry.error.message);
    console.log('Plans (without max_storage_bytes column — run 004_plan_tiers.sql):');
    console.log(JSON.stringify(retry.data, null, 2));
    return;
  }
  if (error) throw new Error(error.message);
  console.log('Plans:', JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
