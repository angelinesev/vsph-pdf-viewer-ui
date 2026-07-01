const { handlers, jsonHandler } = require('./_shared');

exports.handler = jsonHandler(async () => handlers.getHealthAsync());
