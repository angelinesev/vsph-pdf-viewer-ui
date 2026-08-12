import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, randomToken } from "../_shared/supabase.ts";
import { verifyPassword } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  let body: { code?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const code = String(body.code || "").trim();
  const password = String(body.password || "");
  if (!code || !password) {
    return jsonResponse(400, { error: "code and password are required" });
  }

  const supabase = getServiceClient();
  const { data: row, error } = await supabase
    .from("developer_codes")
    .select("id, org_id, password_hash, active, expires_at, organizations(id, name, slug, status, plan_id)")
    .eq("code", code)
    .maybeSingle();

  if (error) return jsonResponse(500, { error: error.message });
  if (!row || !row.active) return jsonResponse(401, { error: "Invalid developer credentials" });
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return jsonResponse(401, { error: "Developer code expired" });
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return jsonResponse(401, { error: "Invalid developer credentials" });

  const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  if (!org || org.status !== "active") {
    return jsonResponse(403, { error: "Organization inactive" });
  }

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { error: sessionError } = await supabase.from("developer_sessions").insert({
    token,
    org_id: row.org_id,
    developer_code_id: row.id,
    expires_at: expiresAt,
  });
  if (sessionError) return jsonResponse(500, { error: sessionError.message });

  return jsonResponse(200, {
    token,
    expires_at: expiresAt,
    organization: { id: org.id, name: org.name, slug: org.slug, plan_id: org.plan_id },
  });
});
