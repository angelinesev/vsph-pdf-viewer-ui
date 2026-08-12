import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, yearMonth } from "../_shared/supabase.ts";
import { hashPassword, requireAdmin } from "../_shared/auth.ts";

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
    const ym = yearMonth();
    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id, name, slug, status, plan_id, created_at, plans(name, monthly_brochure_limit)")
      .order("created_at", { ascending: false });
    if (error) return jsonResponse(500, { error: error.message });

    const { data: usage } = await supabase
      .from("usage_monthly")
      .select("org_id, brochure_count")
      .eq("year_month", ym);

    const usageMap = new Map((usage || []).map((u) => [u.org_id, u.brochure_count]));
    const enriched = (orgs || []).map((o) => ({
      ...o,
      usage_this_month: usageMap.get(o.id) || 0,
    }));
    return jsonResponse(200, { organizations: enriched, year_month: ym });
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
    const planId = String(body.plan_id || "");
    if (!name || !planId) return jsonResponse(400, { error: "name and plan_id are required" });
    let slug = String(body.slug || slugify(name));
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, slug, plan_id: planId, status: "active" })
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
    if (body.plan_id != null) patch.plan_id = String(body.plan_id);
    if (body.status != null) patch.status = String(body.status);
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

  if (req.method === "POST" && action === "revoke-code") {
    let body: { id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    if (!body.id) return jsonResponse(400, { error: "id is required" });
    const { data, error } = await supabase
      .from("developer_codes")
      .update({ active: false })
      .eq("id", body.id)
      .select("id, code, active")
      .single();
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { code: data });
  }

  if (req.method === "POST" && action === "bootstrap-admin") {
    // One-time helper: add current authenticated user as platform admin
    const { error } = await supabase.from("platform_admins").upsert({
      user_id: admin.user!.id,
      email: admin.user!.email || null,
    });
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { ok: true, user_id: admin.user!.id });
  }

  return jsonResponse(405, { error: "Method not allowed" });
});
