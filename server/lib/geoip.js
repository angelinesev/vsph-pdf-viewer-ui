const INVALID_CODES = new Set(['XX', 'T1', 'A1', 'A2', 'O1', '']);
const DEFAULT_COUNTRY = 'PH';
const DEFAULT_COUNTRY_NAME = 'Philippines';

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

function isUnknownCountryCode(code) {
  if (!code) return true;
  return INVALID_CODES.has(String(code).trim().toUpperCase());
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
    h['x-country-code'],
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
  return null;
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

async function lookupIpApiCo(ip) {
  const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country_code/`, {
    headers: { 'User-Agent': 'vsph-pdf-viewer/1.0' },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) return null;
  const text = (await res.text()).trim();
  return normalizeCountryCode(text);
}

async function lookupIpApiCom(ip) {
  const res = await fetch(`https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, {
    headers: { 'User-Agent': 'vsph-pdf-viewer/1.0' },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.status !== 'success') return null;
  return normalizeCountryCode(data.countryCode);
}

async function countryFromIp(ip) {
  if (!ip || isPrivateIp(ip)) return null;
  const cached = cacheGet(ip);
  if (cached !== undefined) {
    return isUnknownCountryCode(cached) ? null : cached;
  }

  try {
    const fromIpApiCo = await lookupIpApiCo(ip);
    if (fromIpApiCo) {
      cacheSet(ip, fromIpApiCo);
      return fromIpApiCo;
    }
  } catch (err) {
    console.warn('geoip ipapi.co lookup failed:', err.message);
  }

  try {
    const fromIpApiCom = await lookupIpApiCom(ip);
    if (fromIpApiCom) {
      cacheSet(ip, fromIpApiCom);
      return fromIpApiCom;
    }
  } catch (err) {
    console.warn('geoip ip-api.com lookup failed:', err.message);
  }

  return null;
}

function defaultCountry(reason) {
  if (reason) console.warn(`geoip: defaulting to ${DEFAULT_COUNTRY} (${reason})`);
  return DEFAULT_COUNTRY;
}

async function resolveCountry(headers = {}) {
  const fromHeaders = countryFromHeaders(headers);
  if (fromHeaders) return fromHeaders;

  const ip = clientIpFromHeaders(headers);
  if (!ip) return defaultCountry('no public IP');

  const fromIp = await countryFromIp(ip);
  if (fromIp) return fromIp;

  return defaultCountry(`lookup failed for ${ip}`);
}

function countryDisplayName(code, locale = 'en') {
  if (isUnknownCountryCode(code)) return DEFAULT_COUNTRY_NAME;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

module.exports = {
  DEFAULT_COUNTRY,
  countryFromHeaders,
  clientIpFromHeaders,
  countryFromIp,
  resolveCountry,
  countryDisplayName,
  isUnknownCountryCode,
};
