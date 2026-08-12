import { corsHeaders, handleOptions, jsonResponse, textResponse } from "../_shared/cors.ts";
import { getServiceClient, parseViewType } from "../_shared/supabase.ts";

const BUCKET = Deno.env.get("SUPABASE_STORAGE_BUCKET") || "pdfs";
const SIGNED_TTL = Number(Deno.env.get("SIGNED_URL_TTL_SEC") || 3600);
const VIEWER_PATH = "/external/pdfjs-2.1.266-dist/web/viewer.html";

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  const when = new Date(expiresAt);
  if (!Number.isFinite(when.getTime()) || when.getUTCFullYear() >= 9999) return false;
  return when < new Date();
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || url.pathname.split("/").pop();
  const mode = url.searchParams.get("mode") || "redirect"; // redirect | url
  const queryView = url.searchParams.get("view");

  if (!token || token === "view-resolve") {
    return jsonResponse(400, { error: "token is required" });
  }

  const supabase = getServiceClient();

  // Prefer new brochure_links; fall back to legacy pdf_access_links
  let storagePath: string | null = null;
  let viewType: "brochure" | "flyer" = parseViewType(queryView);

  const { data: link } = await supabase
    .from("brochure_links")
    .select("token, view_type, expires_at, brochures(storage_path, view_type)")
    .eq("token", token)
    .maybeSingle();

  if (link) {
    if (isExpired(link.expires_at)) return textResponse(410, "Link expired");
    const brochure = Array.isArray(link.brochures) ? link.brochures[0] : link.brochures;
    storagePath = brochure?.storage_path || null;
    viewType = parseViewType(queryView || link.view_type || brochure?.view_type);
  } else {
    const { data: legacy } = await supabase
      .from("pdf_access_links")
      .select("token, view_type, expires_at, document_id, pdf_documents(storage_path, view_type)")
      .eq("token", token)
      .maybeSingle();
    if (!legacy) return jsonResponse(404, { error: "Link not found" });
    if (isExpired(legacy.expires_at)) return textResponse(410, "Link expired");
    const doc = Array.isArray(legacy.pdf_documents) ? legacy.pdf_documents[0] : legacy.pdf_documents;
    storagePath = doc?.storage_path || null;
    viewType = parseViewType(queryView || legacy.view_type || doc?.view_type);
  }

  if (!storagePath) return jsonResponse(404, { error: "Document not found" });

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_TTL);

  if (signError || !signed?.signedUrl) {
    return jsonResponse(500, { error: signError?.message || "Failed to sign URL" });
  }

  if (mode === "url") {
    return jsonResponse(200, { url: signed.signedUrl, view_type: viewType });
  }

  // Short viewer path: file=/functions/v1/view-resolve?token=...&mode=url resolved client-side
  // Prefer short proxy path for Netlify: /api/pdf/{token}
  const fileParam = encodeURIComponent(`/api/pdf/${token}`);
  const location = `${VIEWER_PATH}?file=${fileParam}&client=1&view=${viewType}`;

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: location },
  });
});
