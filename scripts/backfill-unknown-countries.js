#!/usr/bin/env node
/**
 * Rewrites unknown view_events.country values to PH (Philippines).
 * Run once: node scripts/backfill-unknown-countries.js
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { createClient } = require('@supabase/supabase-js');

const UNKNOWN_CODES = new Set(['XX', 'T1', 'A1', 'A2', 'O1', '']);
const TARGET = 'PH';

function isUnknown(code) {
  if (code == null || code === '') return true;
  return UNKNOWN_CODES.has(String(code).trim().toUpperCase());
}

async function runViaPg() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) return null;

  const pg = require('pg');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const countRes = await client.query(
      `select count(*)::int as n from public.view_events
       where country is null or upper(trim(country)) in ('XX', 'T1', 'A1', 'A2', 'O1', '')`,
    );
    const toUpdate = countRes.rows[0]?.n || 0;
    if (!toUpdate) {
      console.log('No unknown country rows to update.');
      return 0;
    }
    const updateRes = await client.query(
      `update public.view_events
       set country = $1
       where country is null or upper(trim(country)) in ('XX', 'T1', 'A1', 'A2', 'O1', '')`,
      [TARGET],
    );
    console.log(`Updated ${updateRes.rowCount ?? toUpdate} view_events to ${TARGET} via DATABASE_URL`);
    return updateRes.rowCount ?? toUpdate;
  } finally {
    await client.end();
  }
}

async function runViaSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or DATABASE_URL for direct SQL)');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let updated = 0;
  let page = 0;
  const pageSize = 500;

  while (true) {
    const { data: rows, error } = await supabase
      .from('view_events')
      .select('id, country')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!rows?.length) break;

    const ids = rows.filter((r) => isUnknown(r.country)).map((r) => r.id);
    if (ids.length) {
      const { error: updError } = await supabase
        .from('view_events')
        .update({ country: TARGET })
        .in('id', ids);
      if (updError) throw updError;
      updated += ids.length;
    }

    if (rows.length < pageSize) break;
    page += 1;
  }

  if (!updated) console.log('No unknown country rows to update.');
  else console.log(`Updated ${updated} view_events to ${TARGET} via Supabase REST`);
  return updated;
}

async function main() {
  try {
    const viaPg = await runViaPg();
    if (viaPg !== null) return;
  } catch (err) {
    console.warn('DATABASE_URL backfill failed:', err.message);
  }

  await runViaSupabase();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
