import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireAdmin } from "../_shared/auth.ts";

/** Verify JWT user is a platform admin (for portal bootstrapping). */
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const admin = await requireAdmin(req);
  if (admin.error) return jsonResponse(admin.error.status, admin.error.body);

  return jsonResponse(200, {
    ok: true,
    user: { id: admin.user!.id, email: admin.user!.email },
  });
});
