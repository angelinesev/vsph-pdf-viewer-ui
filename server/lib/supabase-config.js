const ENV_PREFIXES = [
  'SUPABASE_SERVICE_ROLE_KEY=',
  'SUPABASE_SECRET_KEY=',
];

function normalizeSupabaseUrl(url) {
  if (!url) return '';
  return String(url).trim().replace(/\/$/, '');
}

function normalizeSupabaseKey(raw) {
  if (!raw) return '';

  let key = String(raw).trim().replace(/^["']|["']$/g, '');

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of ENV_PREFIXES) {
      if (key.startsWith(prefix)) {
        key = key.slice(prefix.length).trim();
        changed = true;
      }
    }
  }

  return key;
}

function decodeJwtPayload(key) {
  if (!key.startsWith('eyJ')) return null;

  try {
    const parts = key.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function classifySupabaseKey(key) {
  const normalized = normalizeSupabaseKey(key);
  if (!normalized) return 'empty';
  if (normalized.startsWith('sb_publishable_')) return 'publishable';
  if (normalized.startsWith('sb_secret_')) return 'secret';

  const payload = decodeJwtPayload(normalized);
  if (payload?.role === 'service_role') return 'service_role';
  if (payload?.role === 'anon') return 'anon';
  if (normalized.startsWith('eyJ')) return 'unknown';

  return 'unknown';
}

function isElevatedKeyType(keyType) {
  return keyType === 'service_role' || keyType === 'secret';
}

function getSupabaseKeyHint(keyType) {
  switch (keyType) {
    case 'empty':
      return 'Add SUPABASE_SERVICE_ROLE_KEY to environment variables (paste only the key value).';
    case 'publishable':
    case 'anon':
      return 'Use the secret/service_role key from Supabase (Project Settings ? API), not the publishable or anon key.';
    case 'unknown':
      return 'SUPABASE_SERVICE_ROLE_KEY does not look like a valid secret key. Paste only the key value — not SUPABASE_SERVICE_ROLE_KEY=...';
    default:
      return null;
  }
}

function getInvalidApiKeyHint() {
  return (
    'Supabase rejected the API key. On Netlify, set SUPABASE_SERVICE_ROLE_KEY to the key value only ' +
    '(starting with eyJ... or sb_secret_...). Do not include SUPABASE_SERVICE_ROLE_KEY= in the value field.'
  );
}

function readSupabaseEnv() {
  const url = normalizeSupabaseUrl(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  const key = normalizeSupabaseKey(rawKey);
  const keyType = classifySupabaseKey(key);

  return { url, key, keyType, rawKey };
}

module.exports = {
  normalizeSupabaseUrl,
  normalizeSupabaseKey,
  classifySupabaseKey,
  isElevatedKeyType,
  getSupabaseKeyHint,
  getInvalidApiKeyHint,
  readSupabaseEnv,
};
