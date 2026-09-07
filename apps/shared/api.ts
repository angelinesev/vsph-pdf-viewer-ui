export class ApiError extends Error {
  status?: number;
  data?: { error?: string; limit?: number; used?: number } | null;
}

// Byte-scale quota limits (storage) are formatted as MB; small integer
// limits (brochure count) are shown as-is.
export function quotaSuffix(data?: { limit?: number; used?: number } | null): string {
  if (data?.limit == null) return '';
  if (data.limit >= 1024 * 1024) {
    const fmt = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return ` (${fmt(data.used || 0)}/${fmt(data.limit)})`;
  }
  return ` (${data.used}/${data.limit})`;
}

interface CallOptions {
  method?: string;
  body?: unknown;
  token?: string;
  adminJwt?: string;
}

declare global {
  interface Window {
    BROCHURE_SAAS: {
      supabaseUrl: string;
      supabaseAnonKey: string;
      functionsBase: string;
      publicBaseUrl: string;
    };
  }
}

// Same contract as the old apps/shared/api.js `saasApi.call` — same base URL,
// same headers, same endpoint paths. Used by both the client portal and the
// admin portal. The backend does not change.
export async function callApi<T = any>(
  path: string,
  { method = 'GET', body, token, adminJwt }: CallOptions = {},
): Promise<T> {
  const base = window.BROCHURE_SAAS.functionsBase.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['x-developer-token'] = token;
  if (adminJwt) headers.Authorization = `Bearer ${adminJwt}`;
  if (window.BROCHURE_SAAS.supabaseAnonKey) {
    headers.apikey = window.BROCHURE_SAAS.supabaseAnonKey;
  }

  const res = await fetch(`${base}/${path.replace(/^\//, '')}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const err = new ApiError(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}
