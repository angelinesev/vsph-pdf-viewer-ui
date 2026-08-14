const crypto = require('crypto');
const {
  getSupabase,
  isSupabaseConfigured,
  getStorageBucket,
  getSupabaseConfigError,
} = require('./supabase');
const { generateToken, parseExpiryHours, expiryDate, isLinkExpired } = require('./tokens');
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

function collectErrorText(error) {
  const parts = [];
  let current = error;
  for (let i = 0; i < 4 && current; i += 1) {
    if (current.code) parts.push(String(current.code));
    if (current.message) parts.push(String(current.message));
    current = current.cause || current.originalError || current.errors?.[0];
  }
  return parts.join(' ');
}

function formatSupabaseError(error) {
  const message = error?.message || String(error || 'Unknown error');
  const detail = collectErrorText(error);
  const { url } = readSupabaseEnv();
  const host = url ? url.replace(/^https?:\/\//, '').split('/')[0] : 'your SUPABASE_URL host';

  if (isAuthKeyError(message) || isAuthKeyError(detail)) {
    return {
      status: 503,
      body: { error: getInvalidApiKeyHint() },
    };
  }

  // Supabase-js uses fetch. DNS failure (ENOTFOUND) usually means the project was paused or deleted.
  if (/fetch failed|enotfound|eai_again|econnrefused|etimedout|cert|ssl/i.test(detail)) {
    const dns = /enotfound/i.test(detail);
    return {
      status: 503,
      body: {
        error: dns
          ? `Cannot reach Supabase: DNS lookup failed for ${host}. Restore or recreate the project in the Supabase dashboard, then set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`
          : `Cannot reach Supabase at ${host} (network/DNS/TLS). Check SUPABASE_URL and that the project is not paused.`,
      },
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
  try {
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
  } catch (err) {
    const formatted = formatSupabaseError(err);
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
  // Prefer multi-tenant brochure_links
  const { data: brochureLink, error: brochureLinkError } = await supabase
    .from('brochure_links')
    .select('token, view_type, expires_at, brochure_id, brochures(storage_path, filename, view_type)')
    .eq('token', token)
    .maybeSingle();

  if (!brochureLinkError && brochureLink) {
    const brochure = Array.isArray(brochureLink.brochures)
      ? brochureLink.brochures[0]
      : brochureLink.brochures;
    return {
      link: {
        document_id: brochureLink.brochure_id,
        expires_at: brochureLink.expires_at,
        view_type: brochureLink.view_type,
        storage_path: brochure?.storage_path,
        filename: brochure?.filename,
        source: 'brochure_links',
      },
      linkError: null,
    };
  }

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

  // Ignore "relation does not exist" style errors when brochure_links missing
  if (brochureLinkError && !String(brochureLinkError.message || '').includes('does not exist')) {
    // fall through to legacy
  }

  return { link: link ? { ...link, source: 'pdf_access_links' } : null, linkError };
}

async function getDocumentStoragePath(supabase, documentId, preloaded) {
  if (preloaded?.storage_path) {
    return {
      doc: {
        storage_path: preloaded.storage_path,
        filename: preloaded.filename || 'document.pdf',
      },
      docError: null,
    };
  }

  const { data: brochure } = await supabase
    .from('brochures')
    .select('storage_path, filename')
    .eq('id', documentId)
    .maybeSingle();
  if (brochure) return { doc: brochure, docError: null };

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
    return { status: 413, body: { error: 'File too large (max 75 MB)' } };
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

  try {
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
  } catch (err) {
    return formatSupabaseError(err);
  }
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

  const hours = parseExpiryHours(expiresInHours);

  try {
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
  } catch (err) {
    return formatSupabaseError(err);
  }
}

async function resolvePdfAccess(token) {
  if (!isSupabaseConfigured()) {
    return { error: notConfigured() };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { error: notConfigured() };
  }

  const { link, linkError } = await lookupAccessLink(supabase, token);

  if (linkError) {
    return { error: formatSupabaseError(linkError) };
  }

  if (!link) {
    return { error: { status: 404, body: { error: 'Link not found' } } };
  }

  if (isLinkExpired(link.expires_at)) {
    return { error: { status: 410, body: { error: 'Link expired' } } };
  }

  const { doc, docError } = await getDocumentStoragePath(supabase, link.document_id, link);

  if (docError) {
    return { error: formatSupabaseError(docError) };
  }

  if (!doc) {
    return { error: { status: 404, body: { error: 'Document not found' } } };
  }

  return { supabase, doc, link };
}

async function getPdfSignedUrlForToken(token) {
  const resolved = await resolvePdfAccess(token);
  if (resolved.error) {
    return resolved.error;
  }

  const { supabase, doc } = resolved;
  const { signedUrl, error } = await createSignedPdfUrl(supabase, doc.storage_path);

  if (error) {
    return formatSupabaseError(error);
  }

  return {
    status: 200,
    body: { url: signedUrl },
  };
}

async function getPdfResponseForToken(token) {
  const resolved = await resolvePdfAccess(token);
  if (resolved.error) {
    return resolved.error;
  }

  const { supabase, doc } = resolved;
  const bucket = getStorageBucket();
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(doc.storage_path);

  if (downloadError) {
    return formatSupabaseError(downloadError);
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const safeFilename = doc.filename.replace(/"/g, '');

  return {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeFilename}"`,
      'Cache-Control': 'private, no-store',
    },
    body: buffer,
    binary: true,
  };
}

async function getPdfRedirectForToken(token) {
  return getPdfResponseForToken(token);
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

  if (isLinkExpired(link.expires_at)) {
    return { status: 410, body: 'Link expired', contentType: 'text/plain' };
  }

  const { doc, docError } = await getDocumentStoragePath(supabase, link.document_id, link);

  if (docError) {
    const formatted = formatSupabaseError(docError);
    return { status: formatted.status, body: formatted.body.error, contentType: 'text/plain' };
  }

  if (!doc) {
    return { status: 404, body: 'Document not found', contentType: 'text/plain' };
  }

  // Keep the redirect URL short. Embedding a full Supabase signed URL in
  // ?file= can exceed CDN/proxy limits and produce a Netlify 404 page.
  // resolve-pdf-file.js turns /api/pdf/:token into a signed URL in the browser.
  const viewType = parseViewType(queryView || link.view_type);
  const fileParam = encodeURIComponent(`/api/pdf/${token}`);
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
  getPdfSignedUrlForToken,
  getPdfResponseForToken,
  getPdfRedirectForToken,
  getViewRedirect,
};
