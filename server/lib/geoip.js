const INVALID_CODES = new Set(['XX', 'T1', 'A1', 'A2', 'O1', '']);

function normalizeHeaders(headers = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) {
    h[String(k).toLowerCase()] = v;
  }
  return h;
}

function normalizeCountryCode(raw) {
  if (!raw) return null;
  const code = String(raw).trim().toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(code) || INVALID_CODES.has(code)) return null;
  return code;
}

function parseNetlifyGeoHeader(value) {
  if (!value) return null;
  try {
    const geo = typeof value === 'string' ? JSON.parse(value) : value;
    return normalizeCountryCode(
      geo?.country?.code || geo?.country || geo?.country_code || geo?.countryCode
    );
  } catch {
    return null;
  }
}

function isPrivateIp(ip) {
  const s = String(ip).trim();
  if (!s || s === '127.0.0.1' || s === '::1' || s.startsWith('fe80:')) return true;
  if (s.startsWith('10.') || s.startsWith('192.168.') || s.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(s)) return true;
  return false;
}

function clientIpFromHeaders(headers = {}) {
  const h = normalizeHeaders(headers);
  const candidates = [
    h['x-vsph-client-ip'],
    h['x-nf-client-connection-ip'],
    h['client-ip'],
    h['x-real-ip'],
    h['cf-connecting-ip'],
    h['true-client-ip'],
  ];
  const xff = h['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) candidates.unshift(first);
  }
  for (const ip of candidates) {
    if (ip && !isPrivateIp(ip)) return String(ip).trim();
  }
  return null;
}

function countryFromHeaders(headers = {}) {
  const h = normalizeHeaders(headers);
  const candidates = [
    h['x-vsph-country'],
    h['x-country'],
    h['cf-ipcountry'],
    h['x-nf-country-code'],
    h['x-vercel-ip-country'],
    parseNetlifyGeoHeader(h['x-nf-geo']),
  ];
  for (const c of candidates) {
    const code = typeof c === 'string' ? normalizeCountryCode(c) : c;
    if (code) return code;
  }
  return 'XX';
}

const ipCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 5000;

function cacheGet(ip) {
  const entry = ipCache.get(ip);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    ipCache.delete(ip);
    return undefined;
  }
  return entry.code;
}

function cacheSet(ip, code) {
  if (ipCache.size >= CACHE_MAX) {
    const first = ipCache.keys().next().value;
    ipCache.delete(first);
  }
  ipCache.set(ip, { code, expires: Date.now() + CACHE_TTL_MS });
}

async function countryFromIp(ip) {
  if (!ip || isPrivateIp(ip)) return null;
  const cached = cacheGet(ip);
  if (cached !== undefined) return cached === 'XX' ? null : cached;

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country_code/`, {
      headers: { 'User-Agent': 'vsph-pdf-viewer/1.0' },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const text = (await res.text()).trim();
      const code = normalizeCountryCode(text);
      if (code) {
        cacheSet(ip, code);
        return code;
      }
    }
  } catch (err) {
    console.warn('geoip lookup failed:', err.message);
  }

  cacheSet(ip, 'XX');
  return null;
}

async function resolveCountry(headers = {}) {
  const fromHeaders = countryFromHeaders(headers);
  if (fromHeaders !== 'XX') return fromHeaders;

  const ip = clientIpFromHeaders(headers);
  if (!ip) return 'XX';

  const fromIp = await countryFromIp(ip);
  return fromIp || 'XX';
}

function countryDisplayName(code, locale = 'en') {
  if (!code || code === 'XX') return 'Unknown';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

module.exports = {
  countryFromHeaders,
  clientIpFromHeaders,
  countryFromIp,
  resolveCountry,
  countryDisplayName,
};
