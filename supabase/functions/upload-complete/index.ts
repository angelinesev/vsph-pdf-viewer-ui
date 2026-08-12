import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, parseViewType, yearMonth } from "../_shared/supabase.ts";
import { requireDeveloper } from "../_shared/auth.ts";

const BUCKET = Deno.env.get("SUPABASE_STORAGE_BUCKET") || "pdfs";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const auth = await requireDeveloper(req);
  if (auth.error) return jsonResponse(auth.error.status, auth.error.body);

  let body: {
    brochure_id?: string;
    storage_path?: string;
    filename?: string;
    view_type?: string;
    size_bytes?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const brochureId = String(body.brochure_id || "");
  const storagePath = String(body.storage_path || "");
  const filename = String(body.filename || "document.pdf");
  const viewType = parseViewType(body.view_type);
  const sizeBytes = Number(body.size_bytes || 0);

  if (!brochureId || !storagePath) {
    return jsonResponse(400, { error: "brochure_id and storage_path are required" });
  }
  if (!storagePath.startsWith(`${auth.org!.id}/`)) {
    return jsonResponse(403, { error: "Invalid storage path for organization" });
  }

  const supabase = getServiceClient();
  const { data: listed, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(storagePath.split("/").slice(0, -1).join("/"), {
      search: storagePath.split("/").pop(),
    });
  if (listError) return jsonResponse(500, { error: listError.message });
  const found = (listed || []).some((f) => storagePath.endsWith(`/${f.name}`) || f.name === storagePath.split("/").pop());
  if (!found) {
    // Fallback: try download head via createSignedUrl existence
    const { error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
    if (signError) return jsonResponse(400, { error: "Upload not found in storage" });
  }

  const { data: brochure, error: insertError } = await supabase
    .from("brochures")
    .insert({
      id: brochureId,
      org_id: auth.org!.id,
      storage_path: storagePath,
      filename,
      view_type: viewType,
      size_bytes: sizeBytes,
      created_by: auth.session!.developer_code_id || "developer",
    })
    .select("*")
    .single();

  if (insertError) return jsonResponse(500, { error: insertError.message });

  const ym = yearMonth();
  const { data: usage } = await supabase
    .from("usage_monthly")
    .select("brochure_count")
    .eq("org_id", auth.org!.id)
    .eq("year_month", ym)
    .maybeSingle();

  const nextCount = (usage?.brochure_count || 0) + 1;
  const { error: usageError } = await supabase.from("usage_monthly").upsert({
    org_id: auth.org!.id,
    year_month: ym,
    brochure_count: nextCount,
  });
  if (usageError) return jsonResponse(500, { error: usageError.message });

  return jsonResponse(201, { brochure, usage: { year_month: ym, brochure_count: nextCount } });
});
