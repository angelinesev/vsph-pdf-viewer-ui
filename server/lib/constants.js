const MAX_UPLOAD_BYTES = 75 * 1024 * 1024;
const VIEWER_PATH = '/external/pdfjs-2.1.266-dist/web/viewer.html';
const SIGNED_URL_TTL_SEC = 3600;

function getBaseUrl() {
  const port = Number(process.env.PORT) || 3000;
  const raw =
    process.env.PUBLIC_BASE_URL
    || process.env.BASE_URL
    || process.env.URL
    || `http://localhost:${port}`;
  return String(raw).replace(/\/$/, '');
}

function parseViewType(value) {
  return value === 'flyer' ? 'flyer' : 'brochure';
}

function safeFilename(name) {
  return String(name || 'document.pdf').replace(/[^\w.\-() ]+/g, '_') || 'document.pdf';
}

module.exports = {
  MAX_UPLOAD_BYTES,
  VIEWER_PATH,
  SIGNED_URL_TTL_SEC,
  getBaseUrl,
  parseViewType,
  safeFilename,
};
