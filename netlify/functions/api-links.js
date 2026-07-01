const { handlers, jsonHandler, parseJsonBody } = require('./_shared');

exports.handler = jsonHandler(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  const body = parseJsonBody(event);
  if (body === null) {
    return { status: 400, body: { error: 'Invalid JSON body' } };
  }

  return handlers.createAccessLink(body);
});
