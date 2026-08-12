import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

/**
 * First-time admin bootstrap.
 * POST { email, password, bootstrap_secret }
 * Creates Auth user (if needed) and inserts platform_admins.
 * Set Edge secret BOOTSTRAP_SECRET.
 */
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const expected = Deno.env.get("BOOTSTRAP_SECRET") || "";
  if (!expected) return jsonResponse(503, { error: "BOOTSTRAP_SECRET not configured" });

  let body: { email?: string; password?: string; bootstrap_secret?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  if (body.bootstrap_secret !== expected) {
    return jsonResponse(403, { error: "Invalid bootstrap secret" });
  }

  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (!email || !password) return jsonResponse(400, { error: "email and password required" });

  const supabase = getServiceClient();
  const { data: listed } = await supabase.from("platform_admins").select("user_id").limit(1);
  if (listed && listed.length > 0) {
    return jsonResponse(409, { error: "Admin already bootstrapped; use SQL to add more admins" });
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId = created?.user?.id;
  if (createError) {
    // User may already exist
    const { data: listUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = (listUsers?.users || []).find((u) => u.email === email);
    if (!found) return jsonResponse(500, { error: createError.message });
    userId = found.id;
  }

  const { error: adminError } = await supabase.from("platform_admins").upsert({
    user_id: userId,
    email,
  });
  if (adminError) return jsonResponse(500, { error: adminError.message });

  return jsonResponse(201, { ok: true, user_id: userId, email });
});
