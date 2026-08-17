#!/usr/bin/env node
/**
 * Applies 005_projects_analytics.sql when DATABASE_URL is set,
 * otherwise verifies/creates projects + view_events via REST where possible.
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function runSqlFile() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) return false;
  const pg = require('pg');
  const migrations = [
    '005_projects_analytics.sql',
    '006_security_rls_hardening.sql',
  ];
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const file of migrations) {
      const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', file);
      if (!fs.existsSync(sqlPath)) continue;
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log(`Applied ${file} via DATABASE_URL`);
    }
    return true;
  } finally {
    await client.end();
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  try {
    await runSqlFile();
  } catch (err) {
    console.warn('SQL apply skipped:', err.message);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: projectsError } = await supabase.from('projects').select('id').limit(1);
  if (projectsError) {
    console.error('\nMigration 005 not applied yet.');
    console.error('Open Supabase SQL Editor and run in order:');
    console.error('  supabase/migrations/005_projects_analytics.sql');
    console.error('  supabase/migrations/006_security_rls_hardening.sql');
    console.error('Then re-run: npm run apply:projects');
    process.exit(1);
  }

  console.log('Also ensure 006_security_rls_hardening.sql is applied (deny-all RLS policies).');

  const { data: orgs } = await supabase.from('organizations').select('id, name');
  for (const org of orgs || []) {
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('org_id', org.id)
      .eq('slug', 'uncategorized')
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('projects').insert({
        org_id: org.id,
        name: 'Uncategorized',
        slug: 'uncategorized',
      });
      if (error) console.warn('seed project', org.name, error.message);
      else console.log('Seeded Uncategorized for', org.name);
    }
  }

  const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  const { error: veError } = await supabase.from('view_events').select('id').limit(1);
  console.log('projects count:', count);
  console.log('view_events:', veError ? veError.message : 'OK');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
