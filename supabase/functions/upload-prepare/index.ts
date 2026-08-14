import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, parseViewType, safeFilename, planBrochureLimit, planStorageLimit } from "../_shared/supabase.ts";
import { requireDeveloper } from "../_shared/auth.ts";

const BUCKET = Deno.env.get("SUPABASE_STORAGE_BUCKET") || "pdfs";

async function getOrgUsage(supabase: ReturnType<typeof getServiceClient>, orgId: string) {
  const { data, error, count } = await supabase
    .from("brochures")
    .select("size_bytes", { count: "exact" })
    .eq("org_id", orgId);
  if (error) throw error;
  const storageUsed = (data || []).reduce((sum, row) => sum + Number(row.size_bytes || 0), 0);
  return { active: count || 0, storageUsed };
}

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
    .select("id, monthly_brochure_limit, max_file_bytes, max_storage_bytes, features")
    .eq("id", auth.org!.plan_id)
    .single();
  if (planError) return jsonResponse(500, { error: planError.message });

  if (sizeBytes > 0 && sizeBytes > plan.max_file_bytes) {
    return jsonResponse(413, {
      error: `File exceeds plan limit of ${plan.max_file_bytes} bytes`,
      max_file_bytes: plan.max_file_bytes,
    });
  }

  let usage: { active: number; storageUsed: number };
  try {
    usage = await getOrgUsage(supabase, auth.org!.id);
  } catch (err) {
    return jsonResponse(500, { error: (err as Error).message });
  }

  if (planBrochureLimit(plan) != null && usage.active >= planBrochureLimit(plan)!) {
    return jsonResponse(402, {
      error: "Active brochure quota exceeded",
      used: usage.active,
      limit: planBrochureLimit(plan),
    });
  }

  const storageLimit = planStorageLimit(plan);
  if (storageLimit != null && usage.storageUsed + sizeBytes > storageLimit) {
    return jsonResponse(402, {
      error: "Storage quota exceeded",
      used: usage.storageUsed,
      limit: plan.max_storage_bytes,
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
    quota: {
      used: usage.active,
      limit: planBrochureLimit(plan),
      storage_used: usage.storageUsed,
      max_storage_bytes: planStorageLimit(plan),
    },
  });
});
