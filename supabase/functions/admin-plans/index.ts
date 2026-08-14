import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const admin = await requireAdmin(req);
  if (admin.error) return jsonResponse(admin.error.status, admin.error.body);

  const supabase = getServiceClient();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("name");
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { plans: data });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    const name = String(body.name || "").trim();
    const monthly = body.monthly_brochure_limit === "" || body.monthly_brochure_limit == null
      ? null
      : Number(body.monthly_brochure_limit);
    const maxBytes = Number(body.max_file_bytes ?? 52428800);
    const maxStorage = body.max_storage_bytes === "" || body.max_storage_bytes == null
      ? null
      : Number(body.max_storage_bytes);
    if (!name) return jsonResponse(400, { error: "name is required" });
    const { data, error } = await supabase
      .from("plans")
      .insert({
        name,
        monthly_brochure_limit: monthly != null && Number.isFinite(monthly) && monthly >= 0 ? monthly : null,
        max_file_bytes: maxBytes,
        max_storage_bytes: maxStorage != null && Number.isFinite(maxStorage) && maxStorage > 0 ? maxStorage : null,
        features: body.features || { flyer: true, brochure: true },
      })
      .select("*")
      .single();
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(201, { plan: data });
  }

  if (req.method === "PATCH") {
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
    if (body.monthly_brochure_limit != null) {
      patch.monthly_brochure_limit = body.monthly_brochure_limit === ""
        ? null
        : Number(body.monthly_brochure_limit);
    }
    if (body.max_file_bytes != null) patch.max_file_bytes = Number(body.max_file_bytes);
    if (body.max_storage_bytes !== undefined) {
      patch.max_storage_bytes = body.max_storage_bytes === "" || body.max_storage_bytes == null
        ? null
        : Number(body.max_storage_bytes);
    }
    if (body.features != null) patch.features = body.features;
    const { data, error } = await supabase.from("plans").update(patch).eq("id", id).select("*").single();
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { plan: data });
  }

  return jsonResponse(405, { error: "Method not allowed" });
});
