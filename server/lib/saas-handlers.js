const crypto = require('crypto');
const { getSupabase, getStorageBucket } = require('./supabase');
const { parseViewType, safeFilename, getBaseUrl } = require('./constants');

const PBKDF2_ITERATIONS = 100000;

function yearMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = parts[3];
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return derived.toString('hex') === expected;
}

function parseOptionalLimit(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function parseOptionalBytes(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

async function getOrgUsage(supabase, orgId) {
  const { data, error, count } = await supabase
    .from('brochures')
    .select('size_bytes', { count: 'exact' })
    .eq('org_id', orgId);
  if (error) throw error;
  const storageUsed = (data || []).reduce((sum, row) => sum + Number(row.size_bytes || 0), 0);
  return { active: count || 0, storageUsed };
}

function planBrochureLimit(plan) {
  if (plan?.features?.unlimited_brochures) return null;
  return plan?.monthly_brochure_limit == null ? null : plan.monthly_brochure_limit;
}

function remainingOf(used, limit) {
  if (limit == null) return null;
  return Math.max(limit - used, 0);
}

function planStorageLimit(plan) {
  if (plan?.max_storage_bytes != null) return plan.max_storage_bytes;
  if (plan?.features?.unlimited_storage) return null;
  if (plan?.features?.max_storage_bytes != null) return Number(plan.features.max_storage_bytes);
  return null;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `org-${Date.now()}`;
}

function bearer(reqLike) {
  const auth = reqLike.headers?.authorization || reqLike.headers?.Authorization || '';
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function developerToken(reqLike) {
  return (
    reqLike.headers?.['x-developer-token']
    || reqLike.headers?.['X-Developer-Token']
    || bearer(reqLike)
  );
}

async function requireAdmin(reqLike) {
  const jwt = bearer(reqLike);
  if (!jwt) return { error: { status: 401, body: { error: 'Missing admin authorization' } } };
  const supabase = getSupabase();
  const { data: userData, error } = await supabase.auth.getUser(jwt);
  if (error || !userData?.user) {
    return { error: { status: 401, body: { error: 'Invalid admin session' } } };
  }
  const { data: admin, error: adminError } = await supabase
    .from('platform_admins')
    .select('user_id, email')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (adminError) return { error: { status: 500, body: { error: adminError.message } } };
  if (!admin) return { error: { status: 403, body: { error: 'Not a platform admin' } } };
  return { user: userData.user, admin };
}

async function requireDeveloper(reqLike) {
  const token = developerToken(reqLike);
  if (!token) return { error: { status: 401, body: { error: 'Missing developer session' } } };
  const supabase = getSupabase();
  const { data: session, error } = await supabase
    .from('developer_sessions')
    .select('token, org_id, developer_code_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (error) return { error: { status: 500, body: { error: error.message } } };
  if (!session) return { error: { status: 401, body: { error: 'Invalid developer session' } } };
  if (new Date(session.expires_at) < new Date()) {
    return { error: { status: 401, body: { error: 'Developer session expired' } } };
  }
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, status, plan_id')
    .eq('id', session.org_id)
    .maybeSingle();
  if (orgError) return { error: { status: 500, body: { error: orgError.message } } };
  if (!org || org.status !== 'active') {
    return { error: { status: 403, body: { error: 'Organization inactive' } } };
  }
  return { session, org, token };
}

async function developerLogin(body) {
  const code = String(body.code || '').trim();
  const password = String(body.password || '');
  if (!code || !password) return { status: 400, body: { error: 'code and password are required' } };

  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from('developer_codes')
    .select('id, org_id, password_hash, active, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (error) return { status: 500, body: { error: error.message } };
  if (!row || !row.active) return { status: 401, body: { error: 'Invalid developer credentials' } };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { status: 401, body: { error: 'Developer code expired' } };
  }
  if (!verifyPassword(password, row.password_hash)) {
    return { status: 401, body: { error: 'Invalid developer credentials' } };
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, status, plan_id')
    .eq('id', row.org_id)
    .maybeSingle();
  if (orgError) return { status: 500, body: { error: orgError.message } };
  if (!org || org.status !== 'active') return { status: 403, body: { error: 'Organization inactive' } };

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { error: sessionError } = await supabase.from('developer_sessions').insert({
    token,
    org_id: row.org_id,
    developer_code_id: row.id,
    expires_at: expiresAt,
  });
  if (sessionError) return { status: 500, body: { error: sessionError.message } };

  return {
    status: 200,
    body: {
      token,
      expires_at: expiresAt,
      organization: { id: org.id, name: org.name, slug: org.slug, plan_id: org.plan_id },
    },
  };
}

async function adminBootstrap(body) {
  const expected = process.env.BOOTSTRAP_SECRET || '';
  if (!expected) return { status: 503, body: { error: 'BOOTSTRAP_SECRET not configured' } };
  if (body.bootstrap_secret !== expected) {
    return { status: 403, body: { error: 'Invalid bootstrap secret' } };
  }
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  if (!email || !password) return { status: 400, body: { error: 'email and password required' } };

  const supabase = getSupabase();
  const { data: listed } = await supabase.from('platform_admins').select('user_id').limit(1);
  if (listed && listed.length > 0) {
    return { status: 409, body: { error: 'Admin already bootstrapped; use SQL to add more admins' } };
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId = created?.user?.id;
  if (createError) {
    const target = email.toLowerCase();
    let found = null;
    for (let page = 1; page <= 10 && !found; page += 1) {
      const { data: listUsers } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      found = (listUsers?.users || []).find((u) => String(u.email || '').toLowerCase() === target) || null;
      if (!listUsers?.users || listUsers.users.length < 200) break;
    }
    if (!found) return { status: 500, body: { error: createError.message } };
    userId = found.id;
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) return { status: 500, body: { error: updateError.message } };
  }

  const { error: adminError } = await supabase.from('platform_admins').upsert({
    user_id: userId,
    email,
  });
  if (adminError) return { status: 500, body: { error: adminError.message } };
  return { status: 201, body: { ok: true, user_id: userId, email } };
}

async function adminMe(reqLike) {
  const admin = await requireAdmin(reqLike);
  if (admin.error) return admin.error;
  return { status: 200, body: { ok: true, user: { id: admin.user.id, email: admin.user.email } } };
}

async function adminPlans(reqLike, body) {
  const admin = await requireAdmin(reqLike);
  if (admin.error) return admin.error;
  const supabase = getSupabase();
  const method = reqLike.method || 'GET';

  if (method === 'GET') {
    const { data, error } = await supabase.from('plans').select('*').order('name');
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 200, body: { plans: data } };
  }

  if (method === 'POST') {
    const name = String(body.name || '').trim();
    if (!name) return { status: 400, body: { error: 'name is required' } };
    const { data, error } = await supabase
      .from('plans')
      .insert({
        name,
        monthly_brochure_limit: parseOptionalLimit(body.monthly_brochure_limit),
        max_file_bytes: Number(body.max_file_bytes ?? 52428800),
        max_storage_bytes: parseOptionalBytes(body.max_storage_bytes),
        features: body.features || { flyer: true, brochure: true },
      })
      .select('*')
      .single();
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 201, body: { plan: data } };
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

async function adminOrgs(reqLike, body, query) {
  const admin = await requireAdmin(reqLike);
  if (admin.error) return admin.error;
  const supabase = getSupabase();
  const method = reqLike.method || 'GET';
  const action = query.action || 'list';

  if (method === 'GET' && action === 'list') {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, slug, status, plan_id, created_at, plans(name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features)')
      .order('created_at', { ascending: false });
    if (error) return { status: 500, body: { error: error.message } };
    const { data: brochures, error: brochureError } = await supabase
      .from('brochures')
      .select('org_id, size_bytes');
    if (brochureError) return { status: 500, body: { error: brochureError.message } };
    const usageMap = new Map();
    (brochures || []).forEach((row) => {
      const current = usageMap.get(row.org_id) || { active: 0, storageUsed: 0 };
      current.active += 1;
      current.storageUsed += Number(row.size_bytes || 0);
      usageMap.set(row.org_id, current);
    });
    return {
      status: 200,
      body: {
        organizations: (orgs || []).map((o) => {
          const usage = usageMap.get(o.id) || { active: 0, storageUsed: 0 };
          return {
            ...o,
            active_brochures: usage.active,
            storage_used_bytes: usage.storageUsed,
            usage_this_month: usage.active,
          };
        }),
      },
    };
  }

  if (method === 'GET' && action === 'codes') {
    if (!query.org_id) return { status: 400, body: { error: 'org_id is required' } };
    const { data, error } = await supabase
      .from('developer_codes')
      .select('id, code, active, expires_at, created_at')
      .eq('org_id', query.org_id)
      .order('created_at', { ascending: false });
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 200, body: { codes: data } };
  }

  if (method === 'POST' && action === 'create') {
    const name = String(body.name || '').trim();
    const planId = String(body.plan_id || '');
    if (!name || !planId) return { status: 400, body: { error: 'name and plan_id are required' } };
    const slug = String(body.slug || slugify(name));
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name, slug, plan_id: planId, status: 'active' })
      .select('*')
      .single();
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 201, body: { organization: data } };
  }

  if (method === 'POST' && action === 'create-code') {
    const orgId = String(body.org_id || '');
    const code = String(body.code || '').trim().toUpperCase();
    const password = String(body.password || '');
    if (!orgId || !code || !password) {
      return { status: 400, body: { error: 'org_id, code, and password are required' } };
    }
    const { count: activeCodes, error: countError } = await supabase
      .from('developer_codes')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('active', true);
    if (countError) return { status: 500, body: { error: countError.message } };
    if ((activeCodes || 0) > 0) {
      return {
        status: 409,
        body: { error: 'This organization already has an access code. Revoke it first.' },
      };
    }
    const { data, error } = await supabase
      .from('developer_codes')
      .insert({
        org_id: orgId,
        code,
        password_hash: hashPassword(password),
        active: true,
        expires_at: body.expires_at || null,
      })
      .select('id, code, active, expires_at, created_at')
      .single();
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 201, body: { code: data } };
  }

  if (method === 'POST' && action === 'revoke-code') {
    if (!body.id) return { status: 400, body: { error: 'id is required' } };
    const { data, error } = await supabase
      .from('developer_codes')
      .update({ active: false })
      .eq('id', body.id)
      .select('id, code, active')
      .single();
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 200, body: { code: data } };
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

async function uploadPrepare(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;

  const filename = safeFilename(body.filename);
  const viewType = parseViewType(body.view_type);
  const sizeBytes = Number(body.size_bytes || 0);
  const supabase = getSupabase();
  const bucket = getStorageBucket();

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features')
    .eq('id', auth.org.plan_id)
    .single();
  if (planError) return { status: 500, body: { error: planError.message } };

  if (sizeBytes > 0 && sizeBytes > plan.max_file_bytes) {
    return {
      status: 413,
      body: { error: `File exceeds plan limit of ${plan.max_file_bytes} bytes`, max_file_bytes: plan.max_file_bytes },
    };
  }

  let usage;
  try {
    usage = await getOrgUsage(supabase, auth.org.id);
  } catch (err) {
    return { status: 500, body: { error: err.message } };
  }

  if (planBrochureLimit(plan) != null && usage.active >= planBrochureLimit(plan)) {
    return {
      status: 402,
      body: {
        error: 'Active brochure quota exceeded',
        used: usage.active,
        limit: planBrochureLimit(plan),
      },
    };
  }

  const storageLimit = planStorageLimit(plan);
  if (storageLimit != null && usage.storageUsed + sizeBytes > storageLimit) {
    return {
      status: 402,
      body: {
        error: 'Storage quota exceeded',
        used: usage.storageUsed,
        limit: storageLimit,
      },
    };
  }

  const brochureId = crypto.randomUUID();
  const storagePath = `${auth.org.id}/${brochureId}/${filename}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);
  if (uploadError) return { status: 500, body: { error: uploadError.message } };

  return {
    status: 201,
    body: {
      brochure_id: brochureId,
      view_type: viewType,
      storage_path: storagePath,
      upload: {
        signedUrl: uploadData.signedUrl,
        path: uploadData.path,
        token: uploadData.token,
      },
      quota: {
        used: usage.active,
        limit: planBrochureLimit(plan),
        storage_used: usage.storageUsed,
        max_storage_bytes: planStorageLimit(plan),
      },
    },
  };
}

async function uploadComplete(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;

  const brochureId = String(body.brochure_id || '');
  const storagePath = String(body.storage_path || '');
  const filename = String(body.filename || 'document.pdf');
  const viewType = parseViewType(body.view_type);
  const sizeBytes = Number(body.size_bytes || 0);
  if (!brochureId || !storagePath) {
    return { status: 400, body: { error: 'brochure_id and storage_path are required' } };
  }
  if (!storagePath.startsWith(`${auth.org.id}/`)) {
    return { status: 403, body: { error: 'Invalid storage path for organization' } };
  }

  const supabase = getSupabase();
  const bucket = getStorageBucket();
  const { error: signError } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60);
  if (signError) return { status: 400, body: { error: 'Upload not found in storage' } };

  const { data: brochure, error: insertError } = await supabase
    .from('brochures')
    .insert({
      id: brochureId,
      org_id: auth.org.id,
      storage_path: storagePath,
      filename,
      view_type: viewType,
      size_bytes: sizeBytes,
      created_by: auth.session.developer_code_id || 'developer',
    })
    .select('*')
    .single();
  if (insertError) return { status: 500, body: { error: insertError.message } };

  const ym = yearMonth();
  const { data: usage } = await supabase
    .from('usage_monthly')
    .select('brochure_count')
    .eq('org_id', auth.org.id)
    .eq('year_month', ym)
    .maybeSingle();
  const nextCount = (usage?.brochure_count || 0) + 1;
  const { error: usageError } = await supabase.from('usage_monthly').upsert({
    org_id: auth.org.id,
    year_month: ym,
    brochure_count: nextCount,
  });
  if (usageError) return { status: 500, body: { error: usageError.message } };

  return { status: 201, body: { brochure, usage: { year_month: ym, brochure_count: nextCount } } };
}

async function linksCreate(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const brochureId = String(body.brochure_id || '');
  if (!brochureId) return { status: 400, body: { error: 'brochure_id is required' } };

  const supabase = getSupabase();
  const { data: brochure, error } = await supabase
    .from('brochures')
    .select('id, view_type, org_id')
    .eq('id', brochureId)
    .eq('org_id', auth.org.id)
    .maybeSingle();
  if (error) return { status: 500, body: { error: error.message } };
  if (!brochure) return { status: 404, body: { error: 'Brochure not found' } };

  const viewType = parseViewType(body.view_type || brochure.view_type);
  const token = randomToken(24);
  const { data: link, error: linkError } = await supabase
    .from('brochure_links')
    .insert({ token, brochure_id: brochureId, view_type: viewType, expires_at: null })
    .select('*')
    .single();
  if (linkError) return { status: 500, body: { error: linkError.message } };

  const base = getBaseUrl();
  return {
    status: 201,
    body: {
      token,
      url: `${base}/view/${token}?view=${viewType}`,
      view_type: viewType,
      link,
    },
  };
}

async function quotaStatus(reqLike) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const supabase = getSupabase();
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features')
    .eq('id', auth.org.plan_id)
    .single();
  if (planError) return { status: 500, body: { error: planError.message } };
  let usage;
  try {
    usage = await getOrgUsage(supabase, auth.org.id);
  } catch (err) {
    return { status: 500, body: { error: err.message } };
  }
  const brochureLimit = planBrochureLimit(plan);
  const storageLimit = planStorageLimit(plan);
  return {
    status: 200,
    body: {
      organization: { id: auth.org.id, name: auth.org.name, slug: auth.org.slug },
      plan,
      used: usage.active,
      limit: brochureLimit,
      remaining: remainingOf(usage.active, brochureLimit),
      storage_used: usage.storageUsed,
      max_storage_bytes: storageLimit,
      storage_remaining: remainingOf(usage.storageUsed, storageLimit),
      max_file_bytes: plan.max_file_bytes,
    },
  };
}

async function brochuresList(reqLike) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('brochures')
    .select('id, filename, view_type, size_bytes, created_at')
    .eq('org_id', auth.org.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { brochures: data } };
}

async function routeSaas(name, reqLike, body = {}, query = {}) {
  switch (name) {
    case 'developer-login':
      return developerLogin(body);
    case 'admin-bootstrap':
      return adminBootstrap(body);
    case 'admin-me':
      return adminMe(reqLike);
    case 'admin-plans':
      return adminPlans(reqLike, body);
    case 'admin-orgs':
      return adminOrgs(reqLike, body, query);
    case 'upload-prepare':
      return uploadPrepare(reqLike, body);
    case 'upload-complete':
      return uploadComplete(reqLike, body);
    case 'links-create':
      return linksCreate(reqLike, body);
    case 'quota-status':
      return quotaStatus(reqLike);
    case 'brochures-list':
      return brochuresList(reqLike);
    default:
      return { status: 404, body: { error: `Unknown SaaS route: ${name}` } };
  }
}

module.exports = {
  routeSaas,
  hashPassword,
  verifyPassword,
};
