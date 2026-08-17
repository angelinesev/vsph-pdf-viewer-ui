const { toNetlify } = require('./_shared');
const {
  resolveVanityPath,
  logViewEvent,
  getOrCreateShareToken,
  hubHtml,
  VIEWER_PATH,
  RESERVED_ORG_SLUGS,
} = require('../../server/lib/projects-analytics');
const { getSupabase } = require('../../server/lib/supabase');
const { parseViewType } = require('../../server/lib/constants');
const { visitorCookie } = require('../../server/lib/security');

function parseSegments(event) {
  const splat = event.pathParameters?.splat;
  if (splat) {
    return String(splat).split('/').filter(Boolean).map(decodeURIComponent);
  }
  const path = String(event.path || '').replace(/^\/+/, '');
  return path.split('/').filter(Boolean).map(decodeURIComponent);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: {}, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return toNetlify({ status: 405, body: { error: 'Method not allowed' } });
  }

  try {
    const parts = parseSegments(event);
    if (parts.length < 2 || parts.length > 3) {
      return toNetlify({ status: 404, body: { error: 'Not found' } });
    }
    const [orgSlug, projectSlug, brochureSlug] = parts;
    if (RESERVED_ORG_SLUGS.has(String(orgSlug).toLowerCase())) {
      return toNetlify({ status: 404, body: { error: 'Not found' } });
    }

    const resolved = await resolveVanityPath(orgSlug, projectSlug, brochureSlug);
    if (resolved.status !== 200) {
      return toNetlify(resolved);
    }

    const headers = {};
    for (const [k, v] of Object.entries(event.headers || {})) {
      headers[String(k).toLowerCase()] = v;
    }

    if (resolved.kind === 'hub') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: hubHtml(resolved.body),
      };
    }

    const supabase = getSupabase();
    const link = await getOrCreateShareToken(supabase, resolved.brochure);
    const viewType = parseViewType(event.queryStringParameters?.view || link.view_type || resolved.brochure.view_type);
    const fileParam = encodeURIComponent(`/api/pdf/${link.token}`);
    const publicPath = encodeURIComponent(`/${orgSlug}/${projectSlug}/${brochureSlug}`);
    const docTitle = encodeURIComponent(String(resolved.brochure.title || resolved.brochure.filename || '').slice(0, 200));
    const location = `${VIEWER_PATH}?file=${fileParam}&client=1&view=${viewType}&public=${publicPath}&title=${docTitle}`;

    const logged = await logViewEvent({
      orgId: resolved.org.id,
      projectId: resolved.project.id,
      brochureId: resolved.brochure.id,
      linkToken: link.token,
      headers,
    });

    const responseHeaders = { Location: location };
    if (logged.setCookie) {
      responseHeaders['Set-Cookie'] = visitorCookie(logged.vid);
    }

    return {
      statusCode: 302,
      headers: responseHeaders,
      body: '',
    };
  } catch (err) {
    console.warn('[vanity]', err?.message || err);
    return toNetlify({ status: 500, body: { error: 'Internal server error' } });
  }
};
