#!/usr/bin/env node
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { getHealthAsync } = require('../server/lib/api-handlers');
const { readSupabaseEnv, classifySupabaseKey, normalizeSupabaseKey } = require('../server/lib/supabase-config');

async function main() {
  const { url, key, keyType, rawKey } = readSupabaseEnv();
  const normalized = normalizeSupabaseKey(rawKey);
  const rawType = classifySupabaseKey(rawKey);
  const normalizedType = classifySupabaseKey(normalized);

  console.log('Supabase environment check');
  console.log('-------------------------');
  console.log(`SUPABASE_URL: ${url || '(missing)'}`);
  console.log(`Key present: ${Boolean(normalized)}`);
  console.log(`Key type (raw): ${rawType}`);
  if (rawType !== normalizedType) {
    console.log(`Key type (after normalization): ${normalizedType}`);
    console.log('Note: key was auto-corrected (likely duplicated VAR=value paste).');
  }

  const health = await getHealthAsync();
  console.log(`supabaseOk: ${health.body.supabaseOk}`);
  if (health.body.hint) {
    console.log(`hint: ${health.body.hint}`);
  }

  if (!health.body.supabaseOk) {
    process.exit(1);
  }

  console.log('Environment is valid.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
