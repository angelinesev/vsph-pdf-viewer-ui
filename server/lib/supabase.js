const { createClient } = require('@supabase/supabase-js');
const {
  readSupabaseEnv,
  isElevatedKeyType,
  getSupabaseKeyHint,
} = require('./supabase-config');

let client = null;
let clientKey = null;

function resetSupabaseClient() {
  client = null;
  clientKey = null;
}

function getSupabaseConfigError() {
  const { url, key, keyType } = readSupabaseEnv();

  if (!url || !key) {
    return {
      error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      keyType: keyType || 'empty',
    };
  }

  if (!isElevatedKeyType(keyType)) {
    return {
      error: getSupabaseKeyHint(keyType) || 'Invalid Supabase API key type.',
      keyType,
    };
  }

  return null;
}

function getSupabase() {
  const configError = getSupabaseConfigError();
  if (configError) {
    return null;
  }

  const { url, key } = readSupabaseEnv();

  if (client && clientKey === key) {
    return client;
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clientKey = key;

  return client;
}

function isSupabaseConfigured() {
  return getSupabaseConfigError() === null;
}

function getStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || 'pdfs';
}

module.exports = {
  getSupabase,
  isSupabaseConfigured,
  getStorageBucket,
  getSupabaseConfigError,
  resetSupabaseClient,
};
