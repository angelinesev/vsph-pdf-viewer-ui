import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireDeveloper } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const auth = await requireDeveloper(req);
  if (auth.error) return jsonResponse(auth.error.status, auth.error.body);

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("brochures")
    .select("id, filename, view_type, size_bytes, created_at")
    .eq("org_id", auth.org!.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return jsonResponse(500, { error: error.message });
  return jsonResponse(200, { brochures: data });
});
