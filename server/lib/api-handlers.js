const crypto = require('crypto');
const {
  getSupabase,
  isSupabaseConfigured,
  getStorageBucket,
  getSupabaseConfigError,
} = require('./supabase');
const { generateToken, parseExpiryHours, expiryDate } = require('./tokens');
const { probeViewTypeColumn } = require('./view-type-column');
const {
  readSupabaseEnv,
  isElevatedKeyType,
  getSupabaseKeyHint,
  getInvalidApiKeyHint,
} = require('./supabase-config');
const {
  MAX_UPLOAD_BYTES,
  VIEWER_PATH,
  SIGNED_URL_TTL_SEC,
  getBaseUrl,
  getDefaultLinkExpiryHours,
  parseViewType,
  safeFilename,
} = require('./constants');

function isAuthKeyError(message) {
  const msg = String(message || '').toLowerCase();
  return (
    msg.includes('invalid api key')
    || msg.includes('invalid jwt')
    || msg.includes('legacy api keys are disabled')
    || msg.includes('jwt expired')
  );
}

function formatSupabaseError(error) {
  const message = error?.message || String(error || 'Unknown error');

  if (isAuthKeyError(message)) {
    return {
      status: 503,
      body: { error: getInvalidApiKeyHint() },
    };
  }

  return {
    status: 500,
    body: { error: message },
  };
}

function notConfigured() {
  const configError = getSupabaseConfigError();
  return {
    status: 503,
    body: {
      error: configError?.error || 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    },
  };
}

function getHealth() {
  const configured = isSupabaseConfigured();
  const { url, keyType } = readSupabaseEnv();

  return {
    status: 200,
    body: {
      ok: true,
      supabase: configured,
      supabaseOk: configured,
      keyType: key ? keyType : null,
      supabaseUrl: url || null,
      baseUrl: getBaseUrl(),
      ...(configured
        ? {}
        : {
            hint:
              getSupabaseKeyHint(keyType)
              || 'Add SUPABASE_SERVICE_ROLE_KEY to .env.local, then run npm run setup:supabase',
          }),
    },
  };
}

async function getHealthAsync() {
  const { url, key, keyType } = readSupabaseEnv();
  const base = {
    ok: true,
    supabaseUrl: url || null,
    baseUrl: getBaseUrl(),
    keyType: key ? keyType : null,
  };

  if (!url || !key) {
    return {
      status: 200,
      body: {
        ...base,
        supabase: false,
        supabaseOk: false,
        hint: getSupabaseKeyHint('empty'),
      },
    };
  }

  if (!isElevatedKeyType(keyType)) {
    return {
      status: 200,
      body: {
        ...base,
        supabase: false,
        supabaseOk: false,
        hint: getSupabaseKeyHint(keyType),
      },
    };
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('pdf_documents').select('id').limit(1);

  if (error) {
    const formatted = formatSupabaseError(error);
    return {
      status: 200,
      body: {
        ...base,
        supabase: true,
        supabaseOk: false,
        hint: formatted.body.error,
      },
    };
  }

  return {
    status: 200,
    body: {
      ...base,
      supabase: true,
      supabaseOk: true,
    },
  };
}

async function lookupAccessLink(supabase, token) {
  let link;
  let linkError;
  ({ data: link, error: linkError } = await supabase
    .from('pdf_access_links')
    .select('document_id, expires_at, view_type')
    .eq('token', token)
    .maybeSingle());

  if (linkError && String(linkError.message).includes('view_type')) {
    ({ data: link, error: linkError } = await supabase
      .from('pdf_access_links')
      .select('document_id, expires_at')
      .eq('token', token)
      .maybeSingle());
  }

  return { link, linkError };
}

async function getDocumentStoragePath(supabase, documentId) {
  const { data: doc, error: docError } = await supabase
    .from('pdf_documents')
    .select('storage_path, filename')
    .eq('id', documentId)
    .maybeSingle();

  return { doc, docError };
}

async function createSignedPdfUrl(supabase, storagePath) {
  const bucket = getStorageBucket();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  if (error) {
    return { error };
  }

  return { signedUrl: data.signedUrl };
}

async function prepareDocumentUpload({ filename, view_type: viewTypeInput, size_bytes: sizeBytes }) {
  if (!isSupabaseConfigured()) {
    return notConfigured();
  }

  if (!filename) {
    return { status: 400, body: { error: 'filename is required' } };
  }

  const size = Number(sizeBytes);
  if (Number.isFinite(size) && size > MAX_UPLOAD_BYTES) {
    return { status: 413, body: { error: 'File too large (max 50 MB)' } };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return notConfigured();
  }

  const bucket = getStorageBucket();
  const documentId = crypto.randomUUID();
  const safeName = safeFilename(filename);
  const storagePath = `${documentId}/${safeName}`;
  const viewType = parseViewType(viewTypeInput);
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
    return formatSupabaseError(insertError);
  }

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (uploadError) {
    await supabase.from('pdf_documents').delete().eq('id', documentId);
    return formatSupabaseError(uploadError);
  }

  row.view_type = viewType;

  return {
    status: 201,
    body: {
      document: row,
      upload: {
        signedUrl: uploadData.signedUrl,
        path: uploadData.path,
        token: uploadData.token,
      },
    },
  };
}

async function createAccessLink({
  document_id: documentId,
  expires_in_hours: expiresInHours,
  view_type: viewTypeInput,
}) {
  if (!isSupabaseConfigured()) {
    return notConfigured();
  }

  if (!documentId) {
    return { status: 400, body: { error: 'document_id is required' } };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return notConfigured();
  }

  const hours = parseExpiryHours(expiresInHours, getDefaultLinkExpiryHours());

  const { data: doc, error: docError } = await supabase
    .from('pdf_documents')
    .select('id')
    .eq('id', documentId)
    .maybeSingle();

  if (docError) {
    return formatSupabaseError(docError);
  }

  if (!doc) {
    return { status: 404, body: { error: 'Document not found' } };
  }

  const viewType = parseViewType(viewTypeInput);
  const token = generateToken();
  const expiresAt = expiryDate(hours);
  const hasViewType = await probeViewTypeColumn(supabase);

  const linkPayload = {
    token,
    document_id: documentId,
    expires_at: expiresAt.toISOString(),
  };
  if (hasViewType) linkPayload.view_type = viewType;

  const { error: linkError } = await supabase.from('pdf_access_links').insert(linkPayload);

  if (linkError) {
    return formatSupabaseError(linkError);
  }

  return {
    status: 201,
    body: {
      token,
      url: `${getBaseUrl()}/view/${token}?view=${viewType}`,
      view_type: viewType,
      expires_at: expiresAt.toISOString(),
    },
  };
}

async function getPdfRedirectForToken(token) {
  if (!isSupabaseConfigured()) {
    return notConfigured();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return notConfigured();
  }

  const { link, linkError } = await lookupAccessLink(supabase, token);

  if (linkError) {
    return formatSupabaseError(linkError);
  }

  if (!link) {
    return { status: 404, body: { error: 'Link not found' } };
  }

  if (new Date(link.expires_at) < new Date()) {
    return { status: 410, body: { error: 'Link expired' } };
  }

  const { doc, docError } = await getDocumentStoragePath(supabase, link.document_id);

  if (docError) {
    return formatSupabaseError(docError);
  }

  if (!doc) {
    return { status: 404, body: { error: 'Document not found' } };
  }

  const { signedUrl, error } = await createSignedPdfUrl(supabase, doc.storage_path);

  if (error) {
    return formatSupabaseError(error);
  }

  return {
    status: 302,
    headers: { Location: signedUrl },
    body: '',
  };
}

async function getViewRedirect(token, queryView) {
  if (!isSupabaseConfigured()) {
    return { status: 503, body: 'Supabase not configured', contentType: 'text/plain' };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { status: 503, body: 'Supabase not configured', contentType: 'text/plain' };
  }

  const { link, linkError } = await lookupAccessLink(supabase, token);

  if (linkError) {
    const formatted = formatSupabaseError(linkError);
    return { status: formatted.status, body: formatted.body.error, contentType: 'text/plain' };
  }

  if (!link) {
    return { status: 404, body: 'Link not found', contentType: 'text/plain' };
  }

  if (new Date(link.expires_at) < new Date()) {
    return { status: 410, body: 'Link expired', contentType: 'text/plain' };
  }

  const { doc, docError } = await getDocumentStoragePath(supabase, link.document_id);

  if (docError) {
    const formatted = formatSupabaseError(docError);
    return { status: formatted.status, body: formatted.body.error, contentType: 'text/plain' };
  }

  if (!doc) {
    return { status: 404, body: 'Document not found', contentType: 'text/plain' };
  }

  const { signedUrl, error } = await createSignedPdfUrl(supabase, doc.storage_path);

  if (error) {
    const formatted = formatSupabaseError(error);
    return { status: formatted.status, body: formatted.body.error, contentType: 'text/plain' };
  }

  const viewType = parseViewType(queryView || link.view_type);
  const fileParam = encodeURIComponent(signedUrl);
  const location = `${VIEWER_PATH}?file=${fileParam}&client=1&view=${viewType}`;

  return {
    status: 302,
    headers: { Location: location },
    body: '',
  };
}

module.exports = {
  getHealth,
  getHealthAsync,
  formatSupabaseError,
  prepareDocumentUpload,
  createAccessLink,
  getPdfRedirectForToken,
  getViewRedirect,
};
