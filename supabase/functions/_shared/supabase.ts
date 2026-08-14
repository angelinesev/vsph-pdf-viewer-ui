import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function getAnonClient(authHeader?: string | null): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

export function yearMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function planBrochureLimit(plan: { monthly_brochure_limit?: number | null; features?: Record<string, unknown> } | null) {
  if (plan?.features?.unlimited_brochures) return null;
  return plan?.monthly_brochure_limit == null ? null : Number(plan.monthly_brochure_limit);
}

export function planStorageLimit(plan: { max_storage_bytes?: number | null; features?: Record<string, unknown> } | null) {
  if (plan?.max_storage_bytes != null) return Number(plan.max_storage_bytes);
  if (plan?.features?.unlimited_storage) return null;
  if (plan?.features?.max_storage_bytes != null) return Number(plan.features.max_storage_bytes);
  return null;
}

export function parseViewType(value: unknown): "brochure" | "flyer" {
  return value === "flyer" ? "flyer" : "brochure";
}

export function safeFilename(name: unknown) {
  return String(name || "document.pdf").replace(/[^\w.\-() ]+/g, "_") || "document.pdf";
}

export function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
