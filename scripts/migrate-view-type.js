#!/usr/bin/env node
/**
 * Applies supabase/migrations/001_add_view_type.sql via DATABASE_URL.
 * Get DATABASE_URL from Supabase Dashboard ? Project Settings ? Database ? Connection string.
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_add_view_type.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function runViaPg() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }

  const pg = require('pg');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Applied 001_add_view_type.sql');
    return true;
  } finally {
    await client.end();
  }
}

async function verify() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from('pdf_documents').select('view_type').limit(0);
  if (error && String(error.message).includes('view_type')) {
    console.error('\nMigration ran but view_type column still missing. Wait a minute and retry, or run SQL manually in Supabase SQL Editor.');
    process.exit(1);
  }
  console.log('Verified: view_type column is available');
}

async function main() {
  const ran = await runViaPg();
  if (!ran) {
    console.error('DATABASE_URL is not set in .env or .env.local.\n');
    console.error('Option A — add DATABASE_URL and rerun:');
    console.error('  npm run migrate:view-type\n');
    console.error('Option B — paste this into Supabase SQL Editor (Dashboard ? SQL ? New query):\n');
    console.error(sql);
    process.exit(1);
  }

  await verify();
}

main().catch((err) => {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
});
