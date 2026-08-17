const { handlers, jsonHandler, pathToken } = require('./_shared');

exports.handler = jsonHandler(async (event) => {
  if (event.httpMethod !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  const token = pathToken(event);
  if (!token) {
    return { status: 400, body: { error: 'Missing token' } };
  }

  const queryView = event.queryStringParameters?.view;
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) {
    headers[String(k).toLowerCase()] = v;
  }
  return handlers.getViewRedirect(token, queryView, headers);
});
