import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, yearMonth } from "../_shared/supabase.ts";
import { requireDeveloper } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const auth = await requireDeveloper(req);
  if (auth.error) return jsonResponse(auth.error.status, auth.error.body);

  const supabase = getServiceClient();
  const ym = yearMonth();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("name, monthly_brochure_limit, max_file_bytes")
    .eq("id", auth.org!.plan_id)
    .single();
  if (planError) return jsonResponse(500, { error: planError.message });

  const { data: usage } = await supabase
    .from("usage_monthly")
    .select("brochure_count")
    .eq("org_id", auth.org!.id)
    .eq("year_month", ym)
    .maybeSingle();

  const used = usage?.brochure_count || 0;
  return jsonResponse(200, {
    organization: { id: auth.org!.id, name: auth.org!.name, slug: auth.org!.slug },
    plan,
    year_month: ym,
    used,
    limit: plan.monthly_brochure_limit,
    remaining: Math.max(plan.monthly_brochure_limit - used, 0),
    max_file_bytes: plan.max_file_bytes,
  });
});
