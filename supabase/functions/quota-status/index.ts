import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, planBrochureLimit, planStorageLimit } from "../_shared/supabase.ts";
import { requireDeveloper } from "../_shared/auth.ts";

function remainingOf(used: number, limit: number | null) {
  if (limit == null) return null;
  return Math.max(limit - used, 0);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const auth = await requireDeveloper(req);
  if (auth.error) return jsonResponse(auth.error.status, auth.error.body);

  const supabase = getServiceClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("name, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features")
    .eq("id", auth.org!.plan_id)
    .single();
  if (planError) return jsonResponse(500, { error: planError.message });

  const { data, error, count } = await supabase
    .from("brochures")
    .select("size_bytes", { count: "exact" })
    .eq("org_id", auth.org!.id);
  if (error) return jsonResponse(500, { error: error.message });

  const used = count || 0;
  const storageUsed = (data || []).reduce((sum, row) => sum + Number(row.size_bytes || 0), 0);
  const brochureLimit = planBrochureLimit(plan);
  const storageLimit = planStorageLimit(plan);

  return jsonResponse(200, {
    organization: { id: auth.org!.id, name: auth.org!.name, slug: auth.org!.slug },
    plan,
    used,
    limit: brochureLimit,
    remaining: remainingOf(used, brochureLimit),
    storage_used: storageUsed,
    max_storage_bytes: storageLimit,
    storage_remaining: remainingOf(storageUsed, storageLimit),
    max_file_bytes: plan.max_file_bytes,
  });
});
