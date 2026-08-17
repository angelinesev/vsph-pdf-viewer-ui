import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { hashPassword, requireAdmin } from "../_shared/auth.ts";

const VSPH_PLAN_ID = "00000000-0000-4000-8000-000000000002";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `org-${Date.now()}`;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const admin = await requireAdmin(req);
  if (admin.error) return jsonResponse(admin.error.status, admin.error.body);

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";

  if (req.method === "GET" && action === "list") {
    let q = supabase
      .from("organizations")
      .select("id, name, slug, status, plan_id, created_at, plans(name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features)")
      .order("created_at", { ascending: false });
    if (url.searchParams.get("include_archived") !== "1") {
      q = q.eq("status", "active");
    }
    const { data: orgs, error } = await q;
    if (error) return jsonResponse(500, { error: error.message });

    const { data: brochures, error: brochureError } = await supabase
      .from("brochures")
      .select("org_id, size_bytes");
    if (brochureError) return jsonResponse(500, { error: brochureError.message });

    const usageMap = new Map<string, { active: number; storageUsed: number }>();
    (brochures || []).forEach((row) => {
      const current = usageMap.get(row.org_id) || { active: 0, storageUsed: 0 };
      current.active += 1;
      current.storageUsed += Number(row.size_bytes || 0);
      usageMap.set(row.org_id, current);
    });
    const enriched = (orgs || []).map((o) => {
      const usage = usageMap.get(o.id) || { active: 0, storageUsed: 0 };
      return {
        ...o,
        active_brochures: usage.active,
        storage_used_bytes: usage.storageUsed,
        usage_this_month: usage.active,
      };
    });
    return jsonResponse(200, { organizations: enriched });
  }

  if (req.method === "GET" && action === "codes") {
    const orgId = url.searchParams.get("org_id");
    if (!orgId) return jsonResponse(400, { error: "org_id is required" });
    const { data, error } = await supabase
      .from("developer_codes")
      .select("id, code, active, expires_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { codes: data });
  }

  if (req.method === "POST" && action === "create") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    const name = String(body.name || "").trim();
    if (!name) return jsonResponse(400, { error: "name is required" });
    let slug = String(body.slug || slugify(name));
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, slug, plan_id: VSPH_PLAN_ID, status: "active" })
      .select("*")
      .single();
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(201, { organization: data });
  }

  if (req.method === "PATCH" && action === "update") {
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse(400, { error: "id is required" });
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    const patch: Record<string, unknown> = {};
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.status != null) patch.status = String(body.status);
    // plan_id locked to VSPH Plan
    patch.plan_id = VSPH_PLAN_ID;
    const { data, error } = await supabase.from("organizations").update(patch).eq("id", id).select("*").single();
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { organization: data });
  }

  if (req.method === "POST" && action === "create-code") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    const orgId = String(body.org_id || "");
    const code = String(body.code || "").trim().toUpperCase();
    const password = String(body.password || "");
    if (!orgId || !code || !password) {
      return jsonResponse(400, { error: "org_id, code, and password are required" });
    }
    const { count: activeCodes, error: countError } = await supabase
      .from("developer_codes")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("active", true);
    if (countError) return jsonResponse(500, { error: countError.message });
    if ((activeCodes || 0) > 0) {
      return jsonResponse(409, { error: "This organization already has an access code. Use Rotate code instead." });
    }
    const password_hash = await hashPassword(password);
    const { data, error } = await supabase
      .from("developer_codes")
      .insert({
        org_id: orgId,
        code,
        password_hash,
        active: true,
        expires_at: body.expires_at || null,
      })
      .select("id, code, active, expires_at, created_at")
      .single();
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(201, { code: data });
  }

  if (req.method === "POST" && action === "rotate-code") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    const orgId = String(body.org_id || "");
    const code = String(body.code || "").trim().toUpperCase();
    const password = String(body.password || "");
    if (!orgId || !code || !password) {
      return jsonResponse(400, { error: "org_id, code, and password are required" });
    }
    await supabase.from("developer_codes").update({ active: false }).eq("org_id", orgId).eq("active", true);
    await supabase.from("developer_sessions").delete().eq("org_id", orgId);
    const password_hash = await hashPassword(password);
    const { data, error } = await supabase
      .from("developer_codes")
      .insert({
        org_id: orgId,
        code,
        password_hash,
        active: true,
        expires_at: body.expires_at || null,
      })
      .select("id, code, active, expires_at, created_at")
      .single();
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(201, { code: data, rotated: true });
  }

  if (req.method === "POST" && action === "revoke-code") {
    let body: { id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    if (!body.id) return jsonResponse(400, { error: "id is required" });
    const { data: existing, error: lookupError } = await supabase
      .from("developer_codes")
      .select("id, code, active, org_id")
      .eq("id", body.id)
      .maybeSingle();
    if (lookupError) return jsonResponse(500, { error: lookupError.message });
    if (!existing) return jsonResponse(404, { error: "Code not found" });

    const { data, error } = await supabase
      .from("developer_codes")
      .update({ active: false })
      .eq("id", body.id)
      .select("id, code, active, org_id")
      .single();
    if (error) return jsonResponse(500, { error: error.message });

    await supabase.from("organizations").update({ status: "archived" }).eq("id", existing.org_id);
    await supabase.from("developer_sessions").delete().eq("org_id", existing.org_id);
    await supabase.from("developer_codes").update({ active: false }).eq("org_id", existing.org_id).eq("active", true);

    return jsonResponse(200, { code: data, archived: true });
  }

  if (req.method === "POST" && action === "bootstrap-admin") {
    const { error } = await supabase.from("platform_admins").upsert({
      user_id: admin.user!.id,
      email: admin.user!.email || null,
    });
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { ok: true, user_id: admin.user!.id });
  }

  return jsonResponse(405, { error: "Method not allowed" });
});
