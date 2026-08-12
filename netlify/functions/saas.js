const { jsonHandler, parseJsonBody, toNetlify } = require('./_shared');
const { routeSaas } = require('../../server/lib/saas-handlers');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-developer-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function routeName(event) {
  const splat = event.pathParameters?.splat || '';
  if (splat) return String(splat).split('/')[0].split('?')[0];
  const match = String(event.path || '').match(/\/api\/saas\/([^/?]+)/);
  return match ? match[1] : '';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    const name = routeName(event);
    const body = event.httpMethod === 'GET' || event.httpMethod === 'DELETE'
      ? {}
      : (parseJsonBody(event) || {});
    if (body === null) {
      return toNetlify({ status: 400, body: { error: 'Invalid JSON body' } });
    }

    const headers = {};
    for (const [k, v] of Object.entries(event.headers || {})) {
      headers[k.toLowerCase()] = v;
    }

    const query = event.queryStringParameters || {};
    const result = await routeSaas(
      name,
      { method: event.httpMethod, headers },
      body,
      query,
    );

    const netlify = toNetlify(result);
    netlify.headers = { ...CORS, ...netlify.headers };
    return netlify;
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
