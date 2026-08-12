const crypto = require('crypto');

const NEVER_EXPIRES = new Date('9999-12-31T23:59:59.000Z');

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function parseExpiryHours(value) {
  if (value == null || value === '') {
    return null;
  }
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  return hours;
}

function expiryDate(hoursFromNow) {
  if (hoursFromNow == null) {
    return new Date(NEVER_EXPIRES);
  }
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

function isLinkExpired(expiresAt) {
  if (!expiresAt) return false;
  const when = new Date(expiresAt);
  if (!Number.isFinite(when.getTime()) || when.getUTCFullYear() >= 9999) {
    return false;
  }
  return when < new Date();
}

module.exports = { generateToken, parseExpiryHours, expiryDate, isLinkExpired, NEVER_EXPIRES };
