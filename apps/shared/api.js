window.BROCHURE_SAAS = window.BROCHURE_SAAS || {
  supabaseUrl: "",
  supabaseAnonKey: "",
  functionsBase: "",
  publicBaseUrl: location.origin,
};

window.saasApi = {
  async call(path, { method = "GET", body, token, adminJwt } = {}) {
    const base = window.BROCHURE_SAAS.functionsBase.replace(/\/$/, "");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-developer-token"] = token;
    if (adminJwt) headers.Authorization = `Bearer ${adminJwt}`;
    if (window.BROCHURE_SAAS.supabaseAnonKey) {
      headers.apikey = window.BROCHURE_SAAS.supabaseAnonKey;
    }
    const res = await fetch(`${base}/${path.replace(/^\//, "")}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
    if (!res.ok) {
      const err = new Error(data?.error || res.statusText || "Request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
};
