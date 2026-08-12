(function () {
  const SESSION_KEY = "brochure_admin_jwt";
  let jwt = localStorage.getItem(SESSION_KEY) || "";
  let plans = [];
  let orgs = [];

  const cfg = window.BROCHURE_SAAS;
  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const loginPanel = document.getElementById("loginPanel");
  const appPanel = document.getElementById("appPanel");
  const logoutBtn = document.getElementById("logoutBtn");
  const loginError = document.getElementById("loginError");
  const adminError = document.getElementById("adminError");

  function showApp(show) {
    loginPanel.classList.toggle("hidden", show);
    appPanel.classList.toggle("hidden", !show);
    logoutBtn.classList.toggle("hidden", !show);
  }

  async function api(path, opts = {}) {
    return window.saasApi.call(path, { ...opts, adminJwt: jwt });
  }

  async function refresh() {
    adminError.textContent = "";
    const planRes = await api("admin-plans");
    plans = planRes.plans || [];
    document.getElementById("plansList").innerHTML = plans
      .map((p) => `<div><strong>${p.name}</strong> — ${p.monthly_brochure_limit}/mo · ${(p.max_file_bytes / (1024 * 1024)).toFixed(0)} MB</div>`)
      .join("") || "No plans";

    const orgSelects = [document.getElementById("orgPlan"), document.getElementById("codeOrg")];
    orgSelects[0].innerHTML = plans.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");

    const orgRes = await api("admin-orgs?action=list");
    orgs = orgRes.organizations || [];
    document.getElementById("codeOrg").innerHTML = orgs.map((o) => `<option value="${o.id}">${o.name}</option>`).join("");

    const tbody = document.getElementById("orgRows");
    tbody.innerHTML = "";
    orgs.forEach((o) => {
      const planName = o.plans?.name || o.plan_id;
      const limit = o.plans?.monthly_brochure_limit ?? "?";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${o.name}<div class="muted">${o.slug}</div></td><td>${planName}</td><td>${o.usage_this_month} / ${limit}</td><td>${o.status}</td><td><button class="secondary" data-load="${o.id}" type="button">Codes</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button[data-load]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("codeOrg").value = btn.getAttribute("data-load");
        loadCodes();
      });
    });
    if (orgs[0]) loadCodes();
  }

  async function loadCodes() {
    const orgId = document.getElementById("codeOrg").value;
    if (!orgId) return;
    const res = await api(`admin-orgs?action=codes&org_id=${encodeURIComponent(orgId)}`);
    const tbody = document.getElementById("codeRows");
    tbody.innerHTML = "";
    (res.codes || []).forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${c.code}</td><td>${c.active ? "yes" : "no"}</td><td>${new Date(c.created_at).toLocaleString()}</td><td>${c.active ? `<button class="danger" data-revoke="${c.id}" type="button">Revoke</button>` : ""}</td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button[data-revoke]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api("admin-orgs?action=revoke-code", { method: "POST", body: { id: btn.getAttribute("data-revoke") } });
        loadCodes();
      });
    });
  }

  document.getElementById("loginBtn").addEventListener("click", async () => {
    loginError.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      loginError.textContent = error.message;
      return;
    }
    jwt = data.session.access_token;
    localStorage.setItem(SESSION_KEY, jwt);
    try {
      await api("admin-me");
      showApp(true);
      await refresh();
    } catch (err) {
      loginError.textContent = err.message + " — add this user to platform_admins, or use Bootstrap after inserting the first row in SQL.";
      jwt = "";
      localStorage.removeItem(SESSION_KEY);
    }
  });

  document.getElementById("bootstrapBtn").addEventListener("click", async () => {
    loginError.textContent = "";
    try {
      await window.saasApi.call("admin-bootstrap", {
        method: "POST",
        body: {
          email: document.getElementById("email").value.trim(),
          password: document.getElementById("password").value,
          bootstrap_secret: document.getElementById("bootstrapSecret").value,
        },
      });
      loginError.textContent = "Admin created. Click Sign in.";
      loginError.className = "ok";
    } catch (err) {
      loginError.className = "err";
      loginError.textContent = err.message;
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    jwt = "";
    localStorage.removeItem(SESSION_KEY);
    showApp(false);
  });

  document.getElementById("createPlanBtn").addEventListener("click", async () => {
    try {
      await api("admin-plans", {
        method: "POST",
        body: {
          name: document.getElementById("planName").value,
          monthly_brochure_limit: Number(document.getElementById("planLimit").value),
          max_file_bytes: Number(document.getElementById("planMb").value) * 1024 * 1024,
        },
      });
      await refresh();
    } catch (err) {
      adminError.textContent = err.message;
    }
  });

  document.getElementById("createOrgBtn").addEventListener("click", async () => {
    try {
      await api("admin-orgs?action=create", {
        method: "POST",
        body: {
          name: document.getElementById("orgName").value,
          plan_id: document.getElementById("orgPlan").value,
        },
      });
      await refresh();
    } catch (err) {
      adminError.textContent = err.message;
    }
  });

  document.getElementById("createCodeBtn").addEventListener("click", async () => {
    document.getElementById("codesMsg").textContent = "";
    try {
      const res = await api("admin-orgs?action=create-code", {
        method: "POST",
        body: {
          org_id: document.getElementById("codeOrg").value,
          code: document.getElementById("devCode").value,
          password: document.getElementById("devPassword").value,
        },
      });
      document.getElementById("codesMsg").textContent = `Created code ${res.code.code}`;
      document.getElementById("devPassword").value = "";
      loadCodes();
    } catch (err) {
      adminError.textContent = err.message;
    }
  });

  document.getElementById("codeOrg").addEventListener("change", loadCodes);

  if (jwt) {
    api("admin-me")
      .then(() => {
        showApp(true);
        return refresh();
      })
      .catch(() => {
        jwt = "";
        localStorage.removeItem(SESSION_KEY);
      });
  }
})();
