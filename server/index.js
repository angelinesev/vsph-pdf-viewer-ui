require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { getSupabase, isSupabaseConfigured, getStorageBucket } = require('./lib/supabase');
const { probeViewTypeColumn } = require('./lib/view-type-column');
const {
  getHealthAsync,
  prepareDocumentUpload,
  createAccessLink,
  getPdfSignedUrlForToken,
  getPdfResponseForToken,
  getViewRedirect,
} = require('./lib/api-handlers');
const { MAX_UPLOAD_BYTES, getBaseUrl } = require('./lib/constants');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = getBaseUrl();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF files are allowed'));
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads from this IP. Try again later.' },
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

function requireSupabase(_req, res, next) {
  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error: 'Supabase is not configured. Copy .env.example to .env and set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
    return;
  }
  next();
}

function sendHandlerResult(res, result) {
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
  }
  if (result.contentType) {
    res.type(result.contentType);
  }
  res.status(result.status).send(result.body);
}

app.get('/api/health', async (_req, res) => {
  const result = await getHealthAsync();
  res.status(result.status).json(result.body);
});

app.get('/api/pdf-url/:token', requireSupabase, async (req, res) => {
  const result = await getPdfSignedUrlForToken(req.params.token);
  res.status(result.status).json(result.body);
});

app.get('/api/pdf/:token', requireSupabase, async (req, res) => {
  const result = await getPdfResponseForToken(req.params.token);
  if (result.binary) {
    for (const [key, value] of Object.entries(result.headers || {})) {
      res.setHeader(key, value);
    }
    res.status(result.status).send(result.body);
    return;
  }
  res.status(result.status).json(result.body);
});

app.get('/view/:token', requireSupabase, async (req, res) => {
  const result = await getViewRedirect(req.params.token, req.query.view);
  if (result.status === 302) {
    res.redirect(result.status, result.headers.Location);
    return;
  }
  sendHandlerResult(res, result);
});

app.get('/admin', (_req, res) => res.redirect('/apps/admin/'));
app.get('/admin/', (_req, res) => res.redirect('/apps/admin/'));
app.get('/developer', (_req, res) => res.redirect('/apps/developer/'));
app.get('/developer/', (_req, res) => res.redirect('/apps/developer/'));
app.get('/create', (_req, res) => res.redirect('/apps/developer/'));
app.get('/create/', (_req, res) => res.redirect('/apps/developer/'));

app.all('/api/saas/:name', requireSupabase, async (req, res) => {
  const { routeSaas } = require('./lib/saas-handlers');
  const result = await routeSaas(
    req.params.name,
    { method: req.method, headers: req.headers },
    req.body || {},
    req.query || {},
  );
  res.status(result.status).json(result.body);
});

app.post('/api/documents/prepare', uploadLimiter, requireSupabase, async (req, res) => {
  const result = await prepareDocumentUpload(req.body || {});
  res.status(result.status).json(result.body);
});

app.post(
  '/api/documents/upload',
  uploadLimiter,
  requireSupabase,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Missing PDF file (field name: file)' });
      return;
    }

    const supabase = getSupabase();
    const bucket = getStorageBucket();
    const documentId = crypto.randomUUID();
    const safeName = req.file.originalname.replace(/[^\w.\-() ]+/g, '_') || 'document.pdf';
    const storagePath = `${documentId}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      res.status(500).json({ error: uploadError.message });
      return;
    }

    const viewType = req.body.view_type === 'flyer' ? 'flyer' : 'brochure';
    const hasViewType = await probeViewTypeColumn(supabase);

    const insertPayload = {
      id: documentId,
      storage_path: storagePath,
      filename: safeName,
    };
    if (hasViewType) insertPayload.view_type = viewType;

    const { data: row, error: insertError } = await supabase
      .from('pdf_documents')
      .insert(insertPayload)
      .select('id, filename, created_at')
      .single();

    if (insertError) {
      await supabase.storage.from(bucket).remove([storagePath]);
      res.status(500).json({ error: insertError.message });
      return;
    }

    row.view_type = viewType;

    res.status(201).json({ document: row });
  },
);

app.post('/api/links', uploadLimiter, requireSupabase, async (req, res) => {
  const result = await createAccessLink(req.body || {});
  res.status(result.status).json(result.body);
});

app.use('/create', express.static(path.join(ROOT, 'create')));
app.use(express.static(ROOT));

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large (max 50 MB)' });
    return;
  }

  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`PDF Viewer running at ${BASE_URL}`);
  console.log(`Create: ${BASE_URL}/create/`);
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured ? upload/link APIs disabled until .env is set.');
  }
});
