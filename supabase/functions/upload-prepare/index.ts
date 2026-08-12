import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, parseViewType, safeFilename, yearMonth } from "../_shared/supabase.ts";
import { requireDeveloper } from "../_shared/auth.ts";

const BUCKET = Deno.env.get("SUPABASE_STORAGE_BUCKET") || "pdfs";
const SIGNED_TTL = 3600;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const auth = await requireDeveloper(req);
  if (auth.error) return jsonResponse(auth.error.status, auth.error.body);

  let body: { filename?: string; view_type?: string; size_bytes?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const filename = safeFilename(body.filename);
  const viewType = parseViewType(body.view_type);
  const sizeBytes = Number(body.size_bytes || 0);
  const supabase = getServiceClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, monthly_brochure_limit, max_file_bytes")
    .eq("id", auth.org!.plan_id)
    .single();
  if (planError) return jsonResponse(500, { error: planError.message });

  if (sizeBytes > 0 && sizeBytes > plan.max_file_bytes) {
    return jsonResponse(413, {
      error: `File exceeds plan limit of ${plan.max_file_bytes} bytes`,
      max_file_bytes: plan.max_file_bytes,
    });
  }

  const ym = yearMonth();
  const { data: usage } = await supabase
    .from("usage_monthly")
    .select("brochure_count")
    .eq("org_id", auth.org!.id)
    .eq("year_month", ym)
    .maybeSingle();

  const used = usage?.brochure_count || 0;
  if (used >= plan.monthly_brochure_limit) {
    return jsonResponse(402, {
      error: "Monthly brochure quota exceeded",
      used,
      limit: plan.monthly_brochure_limit,
      year_month: ym,
    });
  }

  const brochureId = crypto.randomUUID();
  const storagePath = `${auth.org!.id}/${brochureId}/${filename}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (uploadError) return jsonResponse(500, { error: uploadError.message });

  return jsonResponse(201, {
    brochure_id: brochureId,
    view_type: viewType,
    storage_path: storagePath,
    upload: {
      signedUrl: uploadData.signedUrl,
      path: uploadData.path,
      token: uploadData.token,
    },
    quota: { used, limit: plan.monthly_brochure_limit, year_month: ym },
  });
});
