#!/usr/bin/env node
/**
 * Applies Supabase schema and verifies bucket/tables.
 * Requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.
 * Optional: DATABASE_URL to run schema.sql via direct Postgres connection.
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'pdfs';

function fail(message) {
  console.error(`\nSetup failed: ${message}`);
  process.exit(1);
}

async function runSchemaViaPg() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }

  const pg = require('pg');
  const sqlPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  await client.connect();
  try {
    await client.query(sql);
    console.log('Ran schema.sql via DATABASE_URL');
    return true;
  } finally {
    await client.end();
  }
}

async function ensureBucket(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new Error(`listBuckets: ${error.message}`);
  }

  if (buckets.some((b) => b.name === bucket || b.id === bucket)) {
    console.log(`Storage bucket "${bucket}" already exists`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 78643200,
    allowedMimeTypes: ['application/pdf'],
  });

  if (createError) {
    throw new Error(`createBucket: ${createError.message}`);
  }

  console.log(`Created storage bucket "${bucket}"`);
}

async function ensureTables(supabase) {
  const { error: linkError } = await supabase.from('pdf_access_links').select('token').limit(1);
  const { error: docError } = await supabase.from('pdf_documents').select('id, view_type').limit(1);

  if (linkError && !String(linkError.message).includes('does not exist')) {
    throw new Error(`pdf_access_links: ${linkError.message}`);
  }

  if (docError && !String(docError.message).includes('does not exist') && !String(docError.message).includes('view_type')) {
    throw new Error(`pdf_documents: ${docError.message}`);
  }

  const tablesExist = !linkError && (!docError || String(docError.message).includes('view_type'));
  const viewTypeOk = !docError;

  return { tablesExist, viewTypeOk };
}

async function runMigrationsViaPg() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }

  const pg = require('pg');
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_add_view_type.sql');
  if (!fs.existsSync(migrationPath)) {
    return false;
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(fs.readFileSync(migrationPath, 'utf8'));
    console.log('Ran migration 001_add_view_type.sql');
    return true;
  } finally {
    await client.end();
  }
}

async function main() {
  if (!url) {
    fail('SUPABASE_URL is missing from .env');
  }

  if (!key) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY is missing from .env\n' +
        'Get it from Supabase Dashboard ? Project Settings ? API ? service_role (secret).\n' +
        'Do NOT use the publishable key (sb_publishable_...).',
    );
  }

  if (key.startsWith('sb_publishable_')) {
    fail('You set the publishable key. Use service_role or sb_secret_ instead.');
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Connecting to ${url} ...`);

  const { tablesExist, viewTypeOk } = await ensureTables(supabase);

  if (!tablesExist) {
    const ranMigration = await runMigrationsViaPg();
    const ranSchema = ranMigration ? false : await runSchemaViaPg();
    if (!ranMigration && !ranSchema) {
      console.log('\nTables missing. Either:');
      console.log('  1. Run supabase/schema.sql in SQL Editor, or');
      console.log('  2. Set DATABASE_URL in .env and run: npm run setup:supabase');
      fail('pdf_documents / pdf_access_links tables not ready');
    }

    const after = await ensureTables(supabase);
    if (!after.tablesExist) {
      fail('Tables still missing after schema run');
    }
  } else if (!viewTypeOk) {
    console.log('Tables exist but view_type column is missing.');
    const ranMigration = await runMigrationsViaPg();
    if (!ranMigration) {
      console.log('Run: npm run migrate:view-type');
      console.log('Or paste supabase/migrations/001_add_view_type.sql into Supabase SQL Editor.');
    } else {
      const after = await ensureTables(supabase);
      if (!after.viewTypeOk) {
        fail('view_type column still missing after migration');
      }
    }
  } else {
    console.log('Tables pdf_documents and pdf_access_links are ready (view_type column ok)');
  }

  await ensureBucket(supabase);
  console.log('\nSupabase setup complete.');
}

main().catch((err) => fail(err.message));
