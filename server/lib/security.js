const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function requireUuid(value, fieldName = 'id') {
  const v = String(value || '').trim();
  if (!isUuid(v)) {
    return { error: { status: 400, body: { error: `Invalid ${fieldName}` } } };
  }
  return { value: v };
}

function sanitizeSlug(value, { max = 64 } = {}) {
  const raw = String(value || '').trim().toLowerCase().slice(0, max);
  if (!raw || !SLUG_RE.test(raw)) return null;
  return raw;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function publicError(status, message) {
  return { status, body: { error: message } };
}

function safeServerError(err, fallback = 'Request failed') {
  if (err && err.message) {
    console.warn('[saas]', err.message);
  }
  return publicError(500, fallback);
}

function allowedCorsOrigin(requestOrigin) {
  const candidates = [
    process.env.PUBLIC_BASE_URL,
    process.env.BASE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
  ]
    .filter(Boolean)
    .map((u) => String(u).replace(/\/$/, ''));
  const primary = candidates[0] || null;
  const origin = String(requestOrigin || '').replace(/\/$/, '');
  if (!origin) return primary;
  if (candidates.includes(origin)) return origin;
  // Local preview only
  if (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
    return origin;
  }
  return null;
}

function corsHeaders(requestOrigin) {
  const allow = allowedCorsOrigin(requestOrigin);
  const headers = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-developer-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
  if (allow) headers['Access-Control-Allow-Origin'] = allow;
  return headers;
}

function visitorCookie(vid) {
  const secure = String(process.env.PUBLIC_BASE_URL || process.env.BASE_URL || '').startsWith('https');
  const parts = [
    `vsph_vid=${vid}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    'HttpOnly',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

module.exports = {
  isUuid,
  requireUuid,
  sanitizeSlug,
  escapeHtml,
  publicError,
  safeServerError,
  allowedCorsOrigin,
  corsHeaders,
  visitorCookie,
};
