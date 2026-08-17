import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireAdmin } from "../_shared/auth.ts";

const VSPH_PLAN_ID = "00000000-0000-4000-8000-000000000002";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const admin = await requireAdmin(req);
  if (admin.error) return jsonResponse(admin.error.status, admin.error.body);

  const supabase = getServiceClient();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("id", VSPH_PLAN_ID)
      .maybeSingle();
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { plans: data ? [data] : [], vsph_plan_id: VSPH_PLAN_ID });
  }

  return jsonResponse(405, { error: "Custom plans are disabled; only VSPH Plan is available" });
});
