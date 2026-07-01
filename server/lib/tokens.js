const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function parseExpiryHours(value, fallback) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) {
    return fallback;
  }
  return Math.min(hours, 24 * 30);
}

function expiryDate(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

module.exports = { generateToken, parseExpiryHours, expiryDate };
