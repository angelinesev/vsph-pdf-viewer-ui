const crypto = require('crypto');
const { getSupabase, getStorageBucket } = require('./supabase');
const { parseViewType, safeFilename, getBaseUrl } = require('./constants');
const {
  slugify,
  uniqueSlug,
  ensureUncategorizedProject,
  RESERVED_ORG_SLUGS,
} = require('./projects-analytics');
const { requireUuid, publicError, safeServerError } = require('./security');

const PBKDF2_ITERATIONS = 100000;
const VSPH_PLAN_ID = '00000000-0000-4000-8000-000000000002';

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
  if (adminError) return { error: safeServerError(adminError) };
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
  if (error) return { error: safeServerError(error) };
  if (!session) return { error: { status: 401, body: { error: 'Invalid developer session' } } };
  if (new Date(session.expires_at) < new Date()) {
    return { error: { status: 401, body: { error: 'Developer session expired' } } };
  }
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, status, plan_id')
    .eq('id', session.org_id)
    .maybeSingle();
  if (orgError) return { error: safeServerError(orgError) };
  if (!org || org.status !== 'active') {
    return { error: { status: 403, body: { error: 'Organization inactive' } } };
  }
  try {
    await ensureUncategorizedProject(supabase, org.id);
  } catch {
    /* non-fatal if migration not applied yet */
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
  if (error) return safeServerError(error);
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
  if (orgError) return safeServerError(orgError);
  if (!org || org.status !== 'active') return { status: 403, body: { error: 'Organization inactive' } };

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { error: sessionError } = await supabase.from('developer_sessions').insert({
    token,
    org_id: row.org_id,
    developer_code_id: row.id,
    expires_at: expiresAt,
  });
  if (sessionError) return safeServerError(sessionError);

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
    if (!found) return safeServerError(createError);
    userId = found.id;
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) return safeServerError(updateError);
  }

  const { error: adminError } = await supabase.from('platform_admins').upsert({
    user_id: userId,
    email,
  });
  if (adminError) return safeServerError(adminError);
  return { status: 201, body: { ok: true, user_id: userId, email } };
}

async function adminMe(reqLike) {
  const admin = await requireAdmin(reqLike);
  if (admin.error) return admin.error;
  return { status: 200, body: { ok: true, user: { id: admin.user.id, email: admin.user.email } } };
}

async function adminPlans(reqLike) {
  const admin = await requireAdmin(reqLike);
  if (admin.error) return admin.error;
  const supabase = getSupabase();
  const method = reqLike.method || 'GET';

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('id', VSPH_PLAN_ID)
      .maybeSingle();
    if (error) return safeServerError(error);
    const plans = data ? [data] : [];
    return { status: 200, body: { plans, vsph_plan_id: VSPH_PLAN_ID } };
  }

  // Single-plan product: creating custom tiers is disabled.
  return publicError(405, 'Custom plans are disabled; only VSPH Plan is available');
}

async function adminOrgs(reqLike, body, query) {
  const admin = await requireAdmin(reqLike);
  if (admin.error) return admin.error;
  const supabase = getSupabase();
  const method = reqLike.method || 'GET';
  const action = query.action || 'list';

  if (method === 'GET' && action === 'list') {
    let q = supabase
      .from('organizations')
      .select('id, name, slug, status, plan_id, created_at, plans(name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features)')
      .order('created_at', { ascending: false });
    if (query.include_archived !== '1') {
      q = q.eq('status', 'active');
    }
    const { data: orgs, error } = await q;
    if (error) return safeServerError(error);
    const { data: brochures, error: brochureError } = await supabase
      .from('brochures')
      .select('org_id, size_bytes');
    if (brochureError) return safeServerError(brochureError);
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
    if (error) return safeServerError(error);
    return { status: 200, body: { codes: data } };
  }

  if (method === 'POST' && action === 'create') {
    const name = String(body.name || '').trim();
    if (!name) return { status: 400, body: { error: 'name is required' } };
    const planId = VSPH_PLAN_ID;
    const slugRaw = String(body.slug || slugify(name));
    let slug = slugify(slugRaw, `org-${Date.now()}`);
    if (RESERVED_ORG_SLUGS.has(slug)) {
      return { status: 400, body: { error: `Slug "${slug}" is reserved` } };
    }
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name, slug, plan_id: planId, status: 'active' })
      .select('*')
      .single();
    if (error) return safeServerError(error);
    try {
      await ensureUncategorizedProject(supabase, data.id);
    } catch (err) {
      return safeServerError(err);
    }
    return { status: 201, body: { organization: data } };
  }

  if (method === 'POST' && action === 'create-code') {
    const orgId = String(body.org_id || '');
    const code = String(body.code || '').trim().toUpperCase();
    const password = String(body.password || '');
    if (!orgId || !code || !password) {
      return { status: 400, body: { error: 'org_id, code, and password are required' } };
    }
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('id, status')
      .eq('id', orgId)
      .maybeSingle();
    if (!orgRow || orgRow.status !== 'active') {
      return publicError(400, 'Organization is not active');
    }
    const { count: activeCodes, error: countError } = await supabase
      .from('developer_codes')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('active', true);
    if (countError) return safeServerError(countError);
    if ((activeCodes || 0) > 0) {
      return {
        status: 409,
        body: { error: 'This organization already has an access code. Use Rotate code instead.' },
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
    if (error) return safeServerError(error);
    return { status: 201, body: { code: data } };
  }

  if (method === 'POST' && action === 'rotate-code') {
    const orgId = String(body.org_id || '');
    const code = String(body.code || '').trim().toUpperCase();
    const password = String(body.password || '');
    if (!orgId || !code || !password) {
      return { status: 400, body: { error: 'org_id, code, and password are required' } };
    }
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('id, status')
      .eq('id', orgId)
      .maybeSingle();
    if (!orgRow || orgRow.status !== 'active') {
      return publicError(400, 'Organization is not active');
    }
    const { error: revokeError } = await supabase
      .from('developer_codes')
      .update({ active: false })
      .eq('org_id', orgId)
      .eq('active', true);
    if (revokeError) return safeServerError(revokeError);

    await supabase.from('developer_sessions').delete().eq('org_id', orgId);

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
    if (error) return safeServerError(error);
    return { status: 201, body: { code: data, rotated: true } };
  }

  if (method === 'POST' && action === 'revoke-code') {
    if (!body.id) return { status: 400, body: { error: 'id is required' } };
    const { data: existing, error: lookupError } = await supabase
      .from('developer_codes')
      .select('id, code, active, org_id')
      .eq('id', body.id)
      .maybeSingle();
    if (lookupError) return safeServerError(lookupError);
    if (!existing) return publicError(404, 'Code not found');

    const { data, error } = await supabase
      .from('developer_codes')
      .update({ active: false })
      .eq('id', body.id)
      .select('id, code, active, org_id')
      .single();
    if (error) return safeServerError(error);

    // Archive the organization and end open developer sessions.
    const { error: archiveError } = await supabase
      .from('organizations')
      .update({ status: 'archived' })
      .eq('id', existing.org_id);
    if (archiveError) return safeServerError(archiveError);

    await supabase.from('developer_sessions').delete().eq('org_id', existing.org_id);

    // Also revoke any other active codes on the same org.
    await supabase
      .from('developer_codes')
      .update({ active: false })
      .eq('org_id', existing.org_id)
      .eq('active', true);

    return { status: 200, body: { code: data, archived: true } };
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

async function projectsList(reqLike) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const supabase = getSupabase();
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, slug, created_at, archived_at')
    .eq('org_id', auth.org.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) return safeServerError(error);

  const { data: brochures } = await supabase
    .from('brochures')
    .select('id, project_id, created_at')
    .eq('org_id', auth.org.id);

  const counts = new Map();
  const latest = new Map();
  (brochures || []).forEach((b) => {
    if (!b.project_id) return;
    counts.set(b.project_id, (counts.get(b.project_id) || 0) + 1);
    const prev = latest.get(b.project_id);
    if (!prev || new Date(b.created_at) > new Date(prev)) latest.set(b.project_id, b.created_at);
  });

  return {
    status: 200,
    body: {
      projects: (projects || []).map((p) => ({
        ...p,
        brochure_count: counts.get(p.id) || 0,
        last_upload_at: latest.get(p.id) || null,
      })),
    },
  };
}

async function projectsCreate(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const name = String(body.name || '').trim();
  if (!name) return { status: 400, body: { error: 'name is required' } };
  const supabase = getSupabase();
  const desired = slugify(body.slug || name);
  if (RESERVED_ORG_SLUGS.has(desired)) {
    return { status: 400, body: { error: 'That slug is reserved' } };
  }
  const slug = await uniqueSlug(supabase, 'projects', 'org_id', auth.org.id, desired);
  const { data, error } = await supabase
    .from('projects')
    .insert({ org_id: auth.org.id, name, slug })
    .select('id, name, slug, created_at, archived_at')
    .single();
  if (error) return safeServerError(error);
  return { status: 201, body: { project: data } };
}

async function projectsUpdate(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const idCheck = requireUuid(body.id, 'id');
  if (idCheck.error) return idCheck.error;
  const supabase = getSupabase();
  const owned = await assertProjectOwned(supabase, auth.org.id, idCheck.value);
  if (owned.status) return owned;
  const patch = {};
  if (body.name != null) patch.name = String(body.name).trim().slice(0, 200);
  if (body.archive === true) patch.archived_at = new Date().toISOString();
  if (body.archive === false) patch.archived_at = null;
  if (body.slug != null) {
    const desired = slugify(body.slug);
    if (!desired) return publicError(400, 'Invalid slug');
    patch.slug = await uniqueSlug(supabase, 'projects', 'org_id', auth.org.id, desired);
  }
  if (!Object.keys(patch).length) return publicError(400, 'No changes provided');
  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', owned.projectId)
    .eq('org_id', auth.org.id)
    .select('id, name, slug, created_at, archived_at')
    .maybeSingle();
  if (error) return safeServerError(error);
  if (!data) return publicError(404, 'Project not found');
  return { status: 200, body: { project: data } };
}

async function projectsDelete(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const idCheck = requireUuid(body.project_id, 'project_id');
  if (idCheck.error) return idCheck.error;

  const supabase = getSupabase();
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, slug')
    .eq('id', idCheck.value)
    .eq('org_id', auth.org.id)
    .is('archived_at', null)
    .maybeSingle();
  if (projectError) return safeServerError(projectError);
  if (!project) return publicError(404, 'Project not found');
  if (project.slug === 'uncategorized') {
    return publicError(400, 'The Uncategorized folder cannot be deleted');
  }

  const { data: brochures, error: listError } = await supabase
    .from('brochures')
    .select('id, org_id, storage_path')
    .eq('org_id', auth.org.id)
    .eq('project_id', project.id);
  if (listError) return safeServerError(listError);

  try {
    for (const brochure of brochures || []) {
      await deleteBrochureForOrg(supabase, auth.org.id, brochure);
    }
  } catch (deleteError) {
    return safeServerError(deleteError);
  }

  const deletedCount = (brochures || []).length;
  if (deletedCount) {
    await adjustUsageMonthly(supabase, auth.org.id, -deletedCount);
  }

  const { error: projectDeleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', project.id)
    .eq('org_id', auth.org.id);
  if (projectDeleteError) return safeServerError(projectDeleteError);

  let usage;
  try {
    usage = await getOrgUsage(supabase, auth.org.id);
  } catch (err) {
    return safeServerError(err);
  }

  return {
    status: 200,
    body: {
      ok: true,
      deleted_project_id: project.id,
      brochures_deleted: deletedCount,
      usage: {
        active: usage.active,
        storage_used: usage.storageUsed,
      },
    },
  };
}

async function vanityUrlsForBrochure(supabase, brochure, org) {
  const base = getBaseUrl();
  let projectSlug = null;
  if (brochure.project_id && org?.id) {
    const { data: project } = await supabase
      .from('projects')
      .select('slug')
      .eq('id', brochure.project_id)
      .eq('org_id', org.id)
      .maybeSingle();
    projectSlug = project?.slug || null;
  }
  const vanity = org?.slug && projectSlug && brochure.slug
    ? `${base}/${org.slug}/${projectSlug}/${brochure.slug}`
    : null;
  return { vanity, projectSlug, orgSlug: org?.slug || null };
}

async function uploadPrepare(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;

  const filename = safeFilename(body.filename);
  const viewType = parseViewType(body.view_type);
  const sizeBytes = Number(body.size_bytes || 0);
  const title = String(body.title || filename).trim().slice(0, 200) || filename;
  const supabase = getSupabase();
  const bucket = getStorageBucket();

  let projectId;
  if (!body.project_id) {
    const fallback = await ensureUncategorizedProject(supabase, auth.org.id);
    projectId = fallback.id;
  } else {
    const owned = await assertProjectOwned(supabase, auth.org.id, body.project_id);
    if (owned.status) return owned;
    projectId = owned.projectId;
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features')
    .eq('id', auth.org.plan_id)
    .single();
  if (planError) return safeServerError(planError);

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
    return safeServerError(err);
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
  const brochureSlug = await uniqueSlug(supabase, 'brochures', 'project_id', projectId, title || filename);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);
  if (uploadError) return safeServerError(uploadError);

  return {
    status: 201,
    body: {
      brochure_id: brochureId,
      project_id: projectId,
      title,
      slug: brochureSlug,
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
        max_storage_bytes: storageLimit,
      },
    },
  };
}

async function uploadComplete(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;

  const brochureCheck = requireUuid(body.brochure_id, 'brochure_id');
  if (brochureCheck.error) return brochureCheck.error;
  const brochureId = brochureCheck.value;
  const storagePath = String(body.storage_path || '');
  const filename = safeFilename(body.filename || 'document.pdf');
  const viewType = parseViewType(body.view_type);
  const sizeBytes = Number(body.size_bytes || 0);
  const title = String(body.title || filename).trim().slice(0, 200) || filename;
  let brochureSlug = body.slug ? slugify(body.slug) : null;

  if (!storagePath) {
    return publicError(400, 'brochure_id and storage_path are required');
  }
  // Path must be org-scoped and match the prepared brochure id (prevents path injection).
  const expectedPrefix = `${auth.org.id}/${brochureId}/`;
  if (!storagePath.startsWith(expectedPrefix) || storagePath.includes('..')) {
    return publicError(403, 'Invalid storage path for organization');
  }

  const supabase = getSupabase();
  const bucket = getStorageBucket();
  let projectId;
  if (!body.project_id) {
    const fallback = await ensureUncategorizedProject(supabase, auth.org.id);
    projectId = fallback.id;
  } else {
    const owned = await assertProjectOwned(supabase, auth.org.id, body.project_id);
    if (owned.status) return owned;
    projectId = owned.projectId;
  }
  if (!brochureSlug) {
    brochureSlug = await uniqueSlug(supabase, 'brochures', 'project_id', projectId, title);
  }

  const { error: signError } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60);
  if (signError) return { status: 400, body: { error: 'Upload not found in storage' } };

  const { data: brochure, error: insertError } = await supabase
    .from('brochures')
    .insert({
      id: brochureId,
      org_id: auth.org.id,
      project_id: projectId,
      storage_path: storagePath,
      filename,
      title,
      slug: brochureSlug,
      view_type: viewType,
      size_bytes: sizeBytes,
      created_by: auth.session.developer_code_id || 'developer',
    })
    .select('*')
    .single();
  if (insertError) return safeServerError(insertError);

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
  if (usageError) return safeServerError(usageError);

  const urls = await vanityUrlsForBrochure(supabase, brochure, auth.org);
  return {
    status: 201,
    body: {
      brochure,
      vanity_url: urls.vanity,
      usage: { year_month: ym, brochure_count: nextCount },
    },
  };
}

async function linksCreate(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const idCheck = requireUuid(body.brochure_id, 'brochure_id');
  if (idCheck.error) return idCheck.error;
  const brochureId = idCheck.value;

  const supabase = getSupabase();
  const { data: brochure, error } = await supabase
    .from('brochures')
    .select('id, view_type, org_id, project_id, slug, title, filename')
    .eq('id', brochureId)
    .eq('org_id', auth.org.id)
    .maybeSingle();
  if (error) return safeServerError(error);
  if (!brochure) return publicError(404, 'Brochure not found');

  const viewType = parseViewType(body.view_type || brochure.view_type);
  const urls = await vanityUrlsForBrochure(supabase, brochure, auth.org);
  const token = randomToken(24);
  const { data: link, error: linkError } = await supabase
    .from('brochure_links')
    .insert({
      token,
      brochure_id: brochureId,
      view_type: viewType,
      expires_at: null,
      org_slug: urls.orgSlug,
      project_slug: urls.projectSlug,
      brochure_slug: brochure.slug || null,
    })
    .select('*')
    .single();
  if (linkError) return safeServerError(linkError);

  const base = getBaseUrl();
  const tokenUrl = `${base}/view/${token}?view=${viewType}`;
  return {
    status: 201,
    body: {
      token,
      url: urls.vanity || tokenUrl,
      vanity_url: urls.vanity,
      token_url: tokenUrl,
      view_type: viewType,
      link,
    },
  };
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseWindowDays(query = {}) {
  const raw = Number(query.days);
  if ([7, 30, 90].includes(raw)) return raw;
  return 30;
}

function splitEventsByWindow(events, windowDays) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const currentStart = new Date(now - windowDays * msPerDay).toISOString();
  const previousStart = new Date(now - 2 * windowDays * msPerDay).toISOString();
  const current = [];
  const previous = [];
  (events || []).forEach((e) => {
    const at = e.occurred_at;
    if (!at) return;
    if (at >= currentStart) current.push(e);
    else if (at >= previousStart) previous.push(e);
  });
  return { current, previous };
}

function pctDelta(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function sharePct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function dailySeries(events, windowDays = 30) {
  const now = new Date();
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const map = new Map();
  const days = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const key = new Date(utcToday - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.push(key);
    map.set(key, { date: key, opens: 0, hashes: new Set() });
  }
  (events || []).forEach((e) => {
    const key = String(e.occurred_at || '').slice(0, 10);
    const row = map.get(key);
    if (!row) return;
    row.opens += 1;
    if (e.visitor_day_hash) row.hashes.add(e.visitor_day_hash);
  });
  return days.map((key) => {
    const row = map.get(key);
    return { date: key, opens: row.opens, unique: row.hashes.size };
  });
}

function weekdayBuckets(events) {
  const buckets = WEEKDAY_LABELS.map((label, dow) => ({ dow, label, opens: 0 }));
  (events || []).forEach((e) => {
    if (!e.occurred_at) return;
    const dow = new Date(e.occurred_at).getUTCDay();
    buckets[dow].opens += 1;
  });
  return buckets;
}

function lastOpenedAt(events) {
  let max = null;
  (events || []).forEach((e) => {
    if (!e.occurred_at) return;
    if (!max || e.occurred_at > max) max = e.occurred_at;
  });
  return max;
}

function summarizeEventsCore(events) {
  const { countryDisplayName, DEFAULT_COUNTRY, isUnknownCountryCode } = require('./geoip');
  const list = events || [];
  const total = list.length;
  const uniques = new Set(list.map((e) => e.visitor_day_hash).filter(Boolean)).size;
  const byCountry = {};
  list.forEach((e) => {
    const c = isUnknownCountryCode(e.country) ? DEFAULT_COUNTRY : e.country;
    byCountry[c] = (byCountry[c] || 0) + 1;
  });
  const countries = Object.entries(byCountry)
    .map(([country, count]) => ({
      country,
      country_name: countryDisplayName(country),
      count,
      share: sharePct(count, total),
    }))
    .sort((a, b) => b.count - a.count);
  const dayMap = {};
  list.forEach((e) => {
    const key = String(e.occurred_at || '').slice(0, 10);
    if (!key) return;
    dayMap[key] = (dayMap[key] || 0) + 1;
  });
  let peak = null;
  Object.entries(dayMap).forEach(([date, opens]) => {
    if (!peak || opens > peak.opens) peak = { date, opens };
  });
  return {
    total,
    unique_visitors: uniques,
    countries,
    peak,
    opens_per_unique: uniques ? Math.round((total / uniques) * 10) / 10 : 0,
    weekday: weekdayBuckets(list),
  };
}

function summarizeEvents(events, windowDays = 30) {
  const core = summarizeEventsCore(events);
  return {
    ...core,
    series: dailySeries(events, windowDays),
  };
}

function summarizeWithDelta(currentEvents, previousEvents, windowDays = 30) {
  const current = summarizeEvents(currentEvents, windowDays);
  const prevCore = summarizeEventsCore(previousEvents);
  return {
    ...current,
    delta: {
      opens_pct: pctDelta(current.total, prevCore.total),
      unique_pct: pctDelta(current.unique_visitors, prevCore.unique_visitors),
    },
  };
}

function buildByProject(events, orgTotal, projectMap) {
  const byProject = new Map();
  (events || []).forEach((e) => {
    const pid = e.project_id || '_none';
    if (!byProject.has(pid)) byProject.set(pid, []);
    byProject.get(pid).push(e);
  });
  return [...byProject.entries()]
    .map(([pid, list]) => {
      const project_id = pid === '_none' ? null : pid;
      const summary = summarizeEventsCore(list);
      return {
        project_id,
        project_name: project_id ? (projectMap.get(project_id) || '(unknown)') : '(no project)',
        total: summary.total,
        unique_visitors: summary.unique_visitors,
        share: sharePct(summary.total, orgTotal),
      };
    })
    .sort((a, b) => b.total - a.total || String(a.project_name).localeCompare(String(b.project_name)));
}

async function loadProjectMap(supabase, projectIds) {
  const projectMap = new Map();
  if (!projectIds.length) return projectMap;
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds);
  if (error) throw error;
  (projects || []).forEach((p) => projectMap.set(p.id, p.name));
  return projectMap;
}

async function buildBrochureAnalyticsRows(supabase, orgId, byBrochure, orgTotal = 0) {
  const { data: orgBrochures, error: brochureError } = await supabase
    .from('brochures')
    .select('id, title, filename, slug, project_id')
    .eq('org_id', orgId);
  if (brochureError) return { error: safeServerError(brochureError) };

  const projectIds = [...new Set((orgBrochures || []).map((b) => b.project_id).filter(Boolean))];
  let projectMap;
  try {
    projectMap = await loadProjectMap(supabase, projectIds);
  } catch (projectError) {
    return { error: safeServerError(projectError) };
  }

  const seen = new Set();
  const rows = [];
  (orgBrochures || []).forEach((b) => {
    seen.add(b.id);
    const eventList = byBrochure.get(b.id) || [];
    const summary = summarizeEventsCore(eventList);
    if (!summary.total) return;
    rows.push({
      brochure_id: b.id,
      title: b.title || b.filename || 'Untitled',
      filename: b.filename || '',
      project_id: b.project_id || null,
      project_name: projectMap.get(b.project_id) || '',
      total: summary.total,
      unique_visitors: summary.unique_visitors,
      share: sharePct(summary.total, orgTotal),
      last_opened_at: lastOpenedAt(eventList),
      countries: summary.countries,
    });
  });
  byBrochure.forEach((list, brochureId) => {
    if (seen.has(brochureId)) return;
    const summary = summarizeEventsCore(list);
    rows.push({
      brochure_id: brochureId,
      title: '(deleted)',
      filename: '',
      project_id: null,
      project_name: '',
      total: summary.total,
      unique_visitors: summary.unique_visitors,
      share: sharePct(summary.total, orgTotal),
      last_opened_at: lastOpenedAt(list),
      countries: summary.countries,
    });
  });
  rows.sort((a, b) => b.total - a.total || String(a.title).localeCompare(String(b.title)));
  return { rows, brochure_count: (orgBrochures || []).length };
}

async function assertProjectOwned(supabase, orgId, projectId) {
  const idCheck = requireUuid(projectId, 'project_id');
  if (idCheck.error) return idCheck.error;
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', idCheck.value)
    .eq('org_id', orgId)
    .is('archived_at', null)
    .maybeSingle();
  if (error) return safeServerError(error);
  if (!data) return publicError(404, 'Project not found');
  return { projectId: idCheck.value };
}

async function analyticsBrochure(reqLike, query) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const idCheck = requireUuid(query.brochure_id, 'brochure_id');
  if (idCheck.error) return idCheck.error;
  const brochureId = idCheck.value;
  const supabase = getSupabase();
  const { data: brochure, error } = await supabase
    .from('brochures')
    .select('id, title, filename, slug, project_id, created_at, view_type')
    .eq('id', brochureId)
    .eq('org_id', auth.org.id)
    .maybeSingle();
  if (error) return safeServerError(error);
  if (!brochure) return publicError(404, 'Brochure not found');

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error: evError } = await supabase
    .from('view_events')
    .select('country, visitor_day_hash, occurred_at')
    .eq('brochure_id', brochureId)
    .eq('org_id', auth.org.id)
    .gte('occurred_at', since);
  if (evError) return safeServerError(evError);
  return {
    status: 200,
    body: {
      brochure: {
        id: brochure.id,
        title: brochure.title || brochure.filename,
        slug: brochure.slug,
        view_type: brochure.view_type,
        created_at: brochure.created_at,
        project_id: brochure.project_id,
      },
      window_days: 30,
      ...summarizeEvents(events || []),
    },
  };
}

async function analyticsOrg(reqLike, query) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const windowDays = parseWindowDays(query);
  const supabase = getSupabase();
  const since = new Date(Date.now() - 2 * windowDays * 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from('view_events')
    .select('brochure_id, project_id, country, visitor_day_hash, occurred_at')
    .eq('org_id', auth.org.id)
    .gte('occurred_at', since);
  if (query.project_id) {
    const owned = await assertProjectOwned(supabase, auth.org.id, query.project_id);
    if (owned.status) return owned;
    q = q.eq('project_id', owned.projectId);
  }
  const { data: events, error } = await q;
  if (error) return safeServerError(error);

  const { current, previous } = splitEventsByWindow(events || [], windowDays);
  const summary = summarizeWithDelta(current, previous, windowDays);

  const byBrochure = new Map();
  current.forEach((e) => {
    if (!e.brochure_id) return;
    if (!byBrochure.has(e.brochure_id)) byBrochure.set(e.brochure_id, []);
    byBrochure.get(e.brochure_id).push(e);
  });

  const brochureRows = await buildBrochureAnalyticsRows(supabase, auth.org.id, byBrochure, summary.total);
  if (brochureRows.error) return brochureRows.error;

  const projectIds = [...new Set(current.map((e) => e.project_id).filter(Boolean))];
  let by_project = [];
  try {
    const projectMap = await loadProjectMap(supabase, projectIds);
    by_project = buildByProject(current, summary.total, projectMap);
  } catch (projectError) {
    return safeServerError(projectError);
  }

  return {
    status: 200,
    body: {
      window_days: windowDays,
      organization: { id: auth.org.id, name: auth.org.name, slug: auth.org.slug },
      ...summary,
      by_project,
      brochure_count: brochureRows.brochure_count,
      by_brochure: brochureRows.rows,
    },
  };
}

async function adminAnalytics(reqLike, query) {
  const admin = await requireAdmin(reqLike);
  if (admin.error) return admin.error;
  const windowDays = parseWindowDays(query);
  const supabase = getSupabase();
  const since = new Date(Date.now() - 2 * windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: activeOrgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('status', 'active');
  if (orgError) return safeServerError(orgError);
  const orgMap = new Map((activeOrgs || []).map((o) => [o.id, o]));
  const activeOrgIds = new Set(orgMap.keys());

  const { data: events, error } = await supabase
    .from('view_events')
    .select('org_id, project_id, brochure_id, country, visitor_day_hash, occurred_at')
    .gte('occurred_at', since);
  if (error) return safeServerError(error);

  const activeEvents = (events || []).filter((e) => e.org_id && activeOrgIds.has(e.org_id));
  const { current: platformCurrent, previous: platformPrevious } = splitEventsByWindow(activeEvents, windowDays);
  const platformSummary = summarizeWithDelta(platformCurrent, platformPrevious, windowDays);

  const { data: brochures } = await supabase.from('brochures').select('id, org_id');
  const brochureCountByOrg = new Map();
  (brochures || []).forEach((b) => {
    if (!activeOrgIds.has(b.org_id)) return;
    brochureCountByOrg.set(b.org_id, (brochureCountByOrg.get(b.org_id) || 0) + 1);
  });

  const byOrg = new Map();
  platformCurrent.forEach((e) => {
    if (!byOrg.has(e.org_id)) byOrg.set(e.org_id, []);
    byOrg.get(e.org_id).push(e);
  });

  let detail = null;
  if (query.org_id) {
    const idCheck = requireUuid(query.org_id, 'org_id');
    if (idCheck.error) return idCheck.error;
    if (!activeOrgIds.has(idCheck.value)) {
      return publicError(404, 'Organization not found');
    }
    const orgAllEvents = (activeEvents || []).filter((e) => e.org_id === idCheck.value);
    const { current: orgCurrent, previous: orgPrevious } = splitEventsByWindow(orgAllEvents, windowDays);
    const orgSummary = summarizeWithDelta(orgCurrent, orgPrevious, windowDays);

    const byBrochure = new Map();
    orgCurrent.forEach((e) => {
      if (!e.brochure_id) return;
      if (!byBrochure.has(e.brochure_id)) byBrochure.set(e.brochure_id, []);
      byBrochure.get(e.brochure_id).push(e);
    });

    const brochureRows = await buildBrochureAnalyticsRows(supabase, idCheck.value, byBrochure, orgSummary.total);
    if (brochureRows.error) return brochureRows.error;

    const projectIds = [...new Set(orgCurrent.map((e) => e.project_id).filter(Boolean))];
    let by_project = [];
    try {
      const projectMap = await loadProjectMap(supabase, projectIds);
      by_project = buildByProject(orgCurrent, orgSummary.total, projectMap);
    } catch (projectError) {
      return safeServerError(projectError);
    }

    detail = {
      org_id: idCheck.value,
      organization: orgMap.get(idCheck.value) || null,
      brochure_count: brochureRows.brochure_count,
      ...orgSummary,
      by_project,
      by_brochure: brochureRows.rows,
    };
  }

  return {
    status: 200,
    body: {
      window_days: windowDays,
      ...platformSummary,
      organizations: [...byOrg.entries()].map(([org_id, list]) => ({
        org_id,
        organization: orgMap.get(org_id) || null,
        brochure_count: brochureCountByOrg.get(org_id) || 0,
        ...summarizeEvents(list, windowDays),
      })).sort((a, b) => b.total - a.total),
      detail,
    },
  };
}


async function brochuresList(reqLike, query = {}) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const supabase = getSupabase();
  let q = supabase
    .from('brochures')
    .select('id, filename, title, slug, view_type, size_bytes, created_at, project_id, storage_path')
    .eq('org_id', auth.org.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (query.project_id) {
    const owned = await assertProjectOwned(supabase, auth.org.id, query.project_id);
    if (owned.status) return owned;
    q = q.eq('project_id', owned.projectId);
  }
  const { data, error } = await q;
  if (error) return safeServerError(error);

  const enriched = [];
  for (const b of data || []) {
    const urls = await vanityUrlsForBrochure(supabase, b, auth.org);
    const { data: signedPdf } = await supabase.storage
      .from(getStorageBucket())
      .createSignedUrl(b.storage_path, 300);
    enriched.push({
      id: b.id,
      filename: b.filename,
      title: b.title || b.filename,
      slug: b.slug,
      view_type: b.view_type,
      size_bytes: b.size_bytes,
      created_at: b.created_at,
      project_id: b.project_id,
      pdf_url: signedPdf?.signedUrl || null,
      vanity_url: urls.vanity,
    });
  }
  return { status: 200, body: { brochures: enriched } };
}

async function removeBrochureStorage(supabase, orgId, brochureId, storagePath) {
  const bucket = getStorageBucket();
  const paths = [];
  if (storagePath) paths.push(storagePath);
  const prefix = `${orgId}/${brochureId}`;
  const { data: listed } = await supabase.storage.from(bucket).list(prefix);
  (listed || []).forEach((entry) => {
    if (!entry?.name) return;
    paths.push(`${prefix}/${entry.name}`);
  });
  const unique = [...new Set(paths)];
  if (!unique.length) return true;
  const { error } = await supabase.storage.from(bucket).remove(unique);
  if (error && !/not found|does not exist/i.test(error.message || '')) {
    console.warn('[storage remove]', error.message);
  }
  return true;
}

async function deleteBrochureForOrg(supabase, orgId, brochure) {
  await removeBrochureStorage(supabase, orgId, brochure.id, brochure.storage_path);
  const { error } = await supabase
    .from('brochures')
    .delete()
    .eq('id', brochure.id)
    .eq('org_id', orgId);
  if (error) throw error;
}

async function adjustUsageMonthly(supabase, orgId, delta) {
  if (!delta) return;
  const ym = yearMonth();
  const { data: usageRow } = await supabase
    .from('usage_monthly')
    .select('brochure_count')
    .eq('org_id', orgId)
    .eq('year_month', ym)
    .maybeSingle();
  if (!usageRow) return;
  await supabase.from('usage_monthly').upsert({
    org_id: orgId,
    year_month: ym,
    brochure_count: Math.max((usageRow.brochure_count || 0) + delta, 0),
  });
}

async function brochuresDelete(reqLike, body) {
  const auth = await requireDeveloper(reqLike);
  if (auth.error) return auth.error;
  const idCheck = requireUuid(body.brochure_id, 'brochure_id');
  if (idCheck.error) return idCheck.error;

  const supabase = getSupabase();
  const { data: brochure, error: lookupError } = await supabase
    .from('brochures')
    .select('id, org_id, storage_path, size_bytes')
    .eq('id', idCheck.value)
    .eq('org_id', auth.org.id)
    .maybeSingle();
  if (lookupError) return safeServerError(lookupError);
  if (!brochure) return publicError(404, 'Brochure not found');

  try {
    await deleteBrochureForOrg(supabase, auth.org.id, brochure);
  } catch (deleteError) {
    return safeServerError(deleteError);
  }

  await adjustUsageMonthly(supabase, auth.org.id, -1);

  let usage;
  try {
    usage = await getOrgUsage(supabase, auth.org.id);
  } catch (err) {
    return safeServerError(err);
  }

  return {
    status: 200,
    body: {
      ok: true,
      deleted_id: brochure.id,
      storage_removed: true,
      usage: {
        active: usage.active,
        storage_used: usage.storageUsed,
      },
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
  if (planError) return safeServerError(planError);
  let usage;
  try {
    usage = await getOrgUsage(supabase, auth.org.id);
  } catch (err) {
    return safeServerError(err);
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

async function routeSaas(name, reqLike, body = {}, query = {}) {
  const route = String(name || '').split('?')[0].trim().toLowerCase();
  const allowed = new Set([
    'developer-login',
    'admin-bootstrap',
    'admin-me',
    'admin-plans',
    'admin-orgs',
    'admin-analytics',
    'projects-list',
    'projects-create',
    'projects-update',
    'projects-delete',
    'upload-prepare',
    'upload-complete',
    'links-create',
    'quota-status',
    'brochures-list',
    'brochures-delete',
    'analytics-brochure',
    'analytics-org',
  ]);
  if (!allowed.has(route)) {
    return publicError(404, 'Unknown SaaS route');
  }

  switch (route) {
    case 'developer-login':
      return developerLogin(body);
    case 'admin-bootstrap':
      return adminBootstrap(body);
    case 'admin-me':
      return adminMe(reqLike);
    case 'admin-plans':
      return adminPlans(reqLike);
    case 'admin-orgs':
      return adminOrgs(reqLike, body, query);
    case 'admin-analytics':
      return adminAnalytics(reqLike, query);
    case 'projects-list':
      return projectsList(reqLike);
    case 'projects-create':
      return projectsCreate(reqLike, body);
    case 'projects-update':
      return projectsUpdate(reqLike, body);
    case 'projects-delete':
      return projectsDelete(reqLike, body);
    case 'upload-prepare':
      return uploadPrepare(reqLike, body);
    case 'upload-complete':
      return uploadComplete(reqLike, body);
    case 'links-create':
      return linksCreate(reqLike, body);
    case 'quota-status':
      return quotaStatus(reqLike);
    case 'brochures-list':
      return brochuresList(reqLike, query);
    case 'brochures-delete':
      return brochuresDelete(reqLike, body);
    case 'analytics-brochure':
      return analyticsBrochure(reqLike, query);
    case 'analytics-org':
      return analyticsOrg(reqLike, query);
    default:
      return publicError(404, 'Unknown SaaS route');
  }
}

module.exports = {
  routeSaas,
  hashPassword,
  verifyPassword,
};
