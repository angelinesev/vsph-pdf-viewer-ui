const handlers = require('../../server/lib/api-handlers');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function toNetlify(result) {
  const contentType = result.contentType || 'application/json';
  const headers = {
    ...SECURITY_HEADERS,
    ...result.headers,
  };

  if (result.status !== 302 && !headers['Content-Type']) {
    headers['Content-Type'] = contentType;
  }

  if (result.binary) {
    const body = Buffer.isBuffer(result.body)
      ? result.body.toString('base64')
      : Buffer.from(result.body).toString('base64');
    return {
      statusCode: result.status,
      headers,
      body,
      isBase64Encoded: true,
    };
  }

  let body = result.body;
  if (body !== '' && body != null && contentType === 'application/json' && typeof body !== 'string') {
    body = JSON.stringify(body);
  }

  return {
    statusCode: result.status,
    headers,
    body: body == null ? '' : String(body),
  };
}

function binaryHandler(fn) {
  return jsonHandler(fn);
}

function jsonHandler(fn) {
  return async (event) => {
    try {
      if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: SECURITY_HEADERS, body: '' };
      }
      const result = await fn(event);
      return toNetlify(result);
    } catch (err) {
      const formatted = handlers.formatSupabaseError
        ? handlers.formatSupabaseError(err)
        : { status: 500, body: { error: err.message || 'Internal server error' } };
      return toNetlify(formatted);
    }
  };
}

function parseJsonBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function pathToken(event) {
  const fromParams = event.pathParameters?.token || event.pathParameters?.splat;
  if (fromParams) return fromParams.split('/')[0];

  const match = String(event.path || '').match(/\/([^/]+)$/);
  return match ? match[1] : null;
}

module.exports = {
  handlers,
  jsonHandler,
  binaryHandler,
  parseJsonBody,
  pathToken,
  toNetlify,
};
