const { handlers, jsonHandler, pathToken } = require('./_shared');

exports.handler = jsonHandler(async (event) => {
  if (event.httpMethod !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  const token = pathToken(event);
  if (!token) {
    return { status: 400, body: { error: 'Missing token' } };
  }

  return handlers.getPdfSignedUrlForToken(token);
});
