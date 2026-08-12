import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, parseViewType, randomToken } from "../_shared/supabase.ts";
import { requireDeveloper } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const auth = await requireDeveloper(req);
  if (auth.error) return jsonResponse(auth.error.status, auth.error.body);

  let body: { brochure_id?: string; view_type?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const brochureId = String(body.brochure_id || "");
  if (!brochureId) return jsonResponse(400, { error: "brochure_id is required" });

  const supabase = getServiceClient();
  const { data: brochure, error } = await supabase
    .from("brochures")
    .select("id, view_type, org_id")
    .eq("id", brochureId)
    .eq("org_id", auth.org!.id)
    .maybeSingle();

  if (error) return jsonResponse(500, { error: error.message });
  if (!brochure) return jsonResponse(404, { error: "Brochure not found" });

  const viewType = parseViewType(body.view_type || brochure.view_type);
  const token = randomToken(24);
  const baseUrl = (Deno.env.get("PUBLIC_BASE_URL") || Deno.env.get("BASE_URL") || "").replace(/\/$/, "");

  const { data: link, error: linkError } = await supabase
    .from("brochure_links")
    .insert({
      token,
      brochure_id: brochureId,
      view_type: viewType,
      expires_at: null,
    })
    .select("*")
    .single();

  if (linkError) return jsonResponse(500, { error: linkError.message });

  const url = baseUrl
    ? `${baseUrl}/view/${token}?view=${viewType}`
    : `/view/${token}?view=${viewType}`;

  return jsonResponse(201, { token, url, view_type: viewType, link });
});
