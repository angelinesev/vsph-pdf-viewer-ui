const crypto = require('crypto');
const { getSupabase } = require('./supabase');
const { VIEWER_PATH, getBaseUrl } = require('./constants');
const { countryFromHeaders, resolveCountry } = require('./geoip');

const RESERVED_ORG_SLUGS = new Set([
  'api',
  'apps',
  'admin',
  'developer',
  'create',
  'view',
  'external',
  'pdf-turn',
  'netlify',
  'assets',
  'favicon.ico',
]);

function slugify(input, fallback = 'item') {
  const base = String(input || '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || fallback;
}

function visitorDayHash(headers = {}, cookieHeader) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) {
    h[String(k).toLowerCase()] = v;
  }
  let vid = null;
  const cookie = cookieHeader || h.cookie || '';
  const match = String(cookie).match(/(?:^|;\s*)vsph_vid=([a-zA-Z0-9_-]+)/);
  if (match) vid = match[1];
  if (!vid) vid = crypto.randomBytes(16).toString('hex');
  const day = new Date().toISOString().slice(0, 10);
  const hash = crypto.createHash('sha256').update(`${vid}:${day}`).digest('hex').slice(0, 32);
  return { hash, vid, setCookie: !match };
}

async function uniqueSlug(supabase, table, scopeColumn, scopeId, desired, idColumn = 'id') {
  let candidate = slugify(desired);
  for (let i = 0; i < 20; i += 1) {
    const trySlug = i === 0 ? candidate : `${candidate.slice(0, 40)}-${i + 1}`;
    let q = supabase.from(table).select(idColumn).eq('slug', trySlug);
    if (scopeColumn && scopeId) q = q.eq(scopeColumn, scopeId);
    const { data } = await q.maybeSingle();
    if (!data) return trySlug;
  }
  return `${candidate.slice(0, 32)}-${Date.now().toString(36)}`;
}

async function ensureUncategorizedProject(supabase, orgId) {
  const { data: existing } = await supabase
    .from('projects')
    .select('id, name, slug, created_at, archived_at')
    .eq('org_id', orgId)
    .eq('slug', 'uncategorized')
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from('projects')
    .insert({ org_id: orgId, name: 'Uncategorized', slug: 'uncategorized' })
    .select('id, name, slug, created_at, archived_at')
    .single();
  if (error) throw error;
  return data;
}

async function resolveVanityPath(orgSlug, projectSlug, brochureSlug) {
  const { sanitizeSlug } = require('./security');
  const org = sanitizeSlug(orgSlug);
  const project = sanitizeSlug(projectSlug);
  const brochure = brochureSlug ? sanitizeSlug(brochureSlug) : null;
  if (!org || RESERVED_ORG_SLUGS.has(org) || !project || (brochureSlug && !brochure)) {
    return { status: 404, body: { error: 'Not found' } };
  }
  const supabase = getSupabase();
  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, status')
    .eq('slug', org)
    .maybeSingle();
  if (orgError) return { status: 500, body: { error: 'Lookup failed' } };
  if (!orgRow || orgRow.status !== 'active') return { status: 404, body: { error: 'Not found' } };

  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .select('id, name, slug, org_id, archived_at')
    .eq('org_id', orgRow.id)
    .eq('slug', project)
    .maybeSingle();
  if (projectError) return { status: 500, body: { error: 'Lookup failed' } };
  if (!projectRow || projectRow.archived_at) return { status: 404, body: { error: 'Not found' } };

  if (!brochure) {
    const { data: brochures, error } = await supabase
      .from('brochures')
      .select('id, title, filename, slug, view_type, created_at, size_bytes')
      .eq('project_id', projectRow.id)
      .eq('org_id', orgRow.id)
      .order('created_at', { ascending: false });
    if (error) return { status: 500, body: { error: 'Lookup failed' } };
    const base = getBaseUrl();
    return {
      status: 200,
      kind: 'hub',
      body: {
        organization: { name: orgRow.name, slug: orgRow.slug },
        project: { name: projectRow.name, slug: projectRow.slug },
        brochures: (brochures || []).map((b) => ({
          title: b.title || b.filename,
          filename: b.filename,
          slug: b.slug,
          view_type: b.view_type,
          created_at: b.created_at,
          url: `${base}/${orgRow.slug}/${projectRow.slug}/${b.slug}`,
        })),
      },
    };
  }

  const { data: brochureRow, error: brochureError } = await supabase
    .from('brochures')
    .select('id, title, filename, slug, view_type, org_id, project_id, storage_path')
    .eq('project_id', projectRow.id)
    .eq('org_id', orgRow.id)
    .eq('slug', brochure)
    .maybeSingle();
  if (brochureError) return { status: 500, body: { error: 'Lookup failed' } };
  if (!brochureRow) return { status: 404, body: { error: 'Not found' } };

  return {
    status: 200,
    kind: 'brochure',
    org: orgRow,
    project: projectRow,
    brochure: brochureRow,
  };
}

async function logViewEvent({
  orgId,
  projectId,
  brochureId,
  linkToken,
  headers,
  cookieHeader,
}) {
  const supabase = getSupabase();
  const country = await resolveCountry(headers);
  const { hash, vid, setCookie } = visitorDayHash(headers, cookieHeader);
  const { error } = await supabase.from('view_events').insert({
    org_id: orgId || null,
    project_id: projectId || null,
    brochure_id: brochureId || null,
    link_token: linkToken || null,
    country,
    visitor_day_hash: hash,
  });
  if (error) {
    console.warn('view_events insert failed:', error.message);
  }
  return { setCookie, vid };
}

function viewerRedirectForBrochure(brochure, queryView) {
  const viewType = queryView === 'flyer' || brochure.view_type === 'flyer' ? 'flyer' : 'brochure';
  // Prefer tokenless vanity opens via temporary signed path through brochure id lookup:
  // We still need a token for /api/pdf — ensure a link exists or use brochure id bridge.
  return { viewType };
}

async function getOrCreateShareToken(supabase, brochure) {
  const { data: existing } = await supabase
    .from('brochure_links')
    .select('token, view_type')
    .eq('brochure_id', brochure.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', brochure.org_id)
    .maybeSingle();
  const { data: project } = brochure.project_id
    ? await supabase.from('projects').select('slug').eq('id', brochure.project_id).maybeSingle()
    : { data: null };

  const token = crypto.randomBytes(24).toString('base64url');
  const { data: link, error } = await supabase
    .from('brochure_links')
    .insert({
      token,
      brochure_id: brochure.id,
      view_type: brochure.view_type || 'brochure',
      expires_at: null,
      org_slug: org?.slug || null,
      project_slug: project?.slug || null,
      brochure_slug: brochure.slug || null,
    })
    .select('token, view_type')
    .single();
  if (error) throw error;
  return link;
}

function hubHtml(payload) {
  const { escapeHtml } = require('./security');
  const { organization, project, brochures } = payload;
  const orgName = escapeHtml(organization.name);
  const projectName = escapeHtml(project.name);
  const items = (brochures || [])
    .map((b) => {
      const title = escapeHtml(b.title || b.filename || 'Document');
      const type = escapeHtml(b.view_type || 'brochure');
      const when = b.created_at ? escapeHtml(new Date(b.created_at).toLocaleString()) : '';
      const url = escapeHtml(b.url || '#');
      return `<a class="item" href="${url}"><strong>${title}</strong><span>${type} · ${when}</span></a>`;
    })
    .join('') || '<p class="empty">No brochures in this project yet.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${projectName} — ${orgName}</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;background:#f7f8fa;color:#111827;margin:0;padding:2rem 1.25rem}
    .wrap{max-width:640px;margin:0 auto}
    h1{font-size:1.5rem;margin:0 0 .25rem}
    .muted{color:#6b7280;font-size:.9rem}
    .item{display:block;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1rem 1.1rem;margin:.6rem 0;text-decoration:none;color:inherit}
    .item span{display:block;color:#6b7280;font-size:.8rem;margin-top:.25rem}
    .empty{color:#6b7280}
  </style>
</head>
<body>
  <div class="wrap">
    <p class="muted">${orgName}</p>
    <h1>${projectName}</h1>
    <p class="muted">Brochures &amp; flyers</p>
    ${items}
  </div>
</body>
</html>`;
}

module.exports = {
  RESERVED_ORG_SLUGS,
  slugify,
  uniqueSlug,
  countryFromHeaders,
  visitorDayHash,
  ensureUncategorizedProject,
  resolveVanityPath,
  logViewEvent,
  getOrCreateShareToken,
  viewerRedirectForBrochure,
  hubHtml,
  VIEWER_PATH,
};
