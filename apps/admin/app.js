(function () {
  const SESSION_KEY = "brochure_admin_jwt";
  let jwt = localStorage.getItem(SESSION_KEY) || "";
  let plans = [];
  let orgs = [];
  let archivedOrgs = [];
  let orgTab = "active";
  let analyticsDetailOrgId = null;

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

  function formatBytes(n) {
    if (n == null) return "Custom";
    const mb = n / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1) + " GB";
    return (mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)) + " MB";
  }

  function brochureLimitLabel(p) {
    if (p && typeof p === "object") {
      if (p.features?.unlimited_brochures || p.monthly_brochure_limit == null) return "Unlimited";
      return String(p.monthly_brochure_limit);
    }
    return p == null ? "Unlimited" : String(p);
  }

  function storageLimitOf(p) {
    if (!p) return null;
    if (p.max_storage_bytes != null) return p.max_storage_bytes;
    if (p.features?.unlimited_storage) return null;
    if (p.features?.max_storage_bytes != null) return Number(p.features.max_storage_bytes);
    return null;
  }

  function renderPlanCard(p) {
    const fileMb = (Number(p.max_file_bytes || 0) / (1024 * 1024)).toFixed(0);
    return `
      <div class="plan-card featured">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="plan-metrics">
          <div><span class="muted">Brochures</span><strong>${brochureLimitLabel(p)}</strong></div>
          <div><span class="muted">Max file</span><strong>${fileMb} MB</strong></div>
          <div><span class="muted">Storage</span><strong>${formatBytes(storageLimitOf(p))}</strong></div>
        </div>
        <p class="muted" style="margin:0.75rem 0 0">Single plan for all organizations.</p>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function statusLabel(status) {
    if (status === "active") return { text: "Active", cls: "success" };
    return { text: "Plan stop", cls: "warn" };
  }

  function renderOrgRows(list, { archived }) {
    const tbody = document.getElementById("orgRows");
    tbody.innerHTML = "";
    if (!list.length) {
      const empty = archived
        ? "No archived organizations."
        : "No active organizations yet.";
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:1.5rem">${empty}</td></tr>`;
      return;
    }
    list.forEach((o) => {
      const planName = o.plans?.name || o.plan_id;
      const limit = brochureLimitLabel(o.plans || {});
      const active = o.active_brochures ?? o.usage_this_month ?? 0;
      const storage = formatBytes(o.storage_used_bytes || 0);
      const storageCap = formatBytes(storageLimitOf(o.plans));
      const badge = statusLabel(o.status);
      const action = archived
        ? '<span class="muted">PDFs locked</span>'
        : `<button class="secondary inline" data-load="${o.id}" type="button">Manage code</button>`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(o.name)}</strong><div class="muted">${escapeHtml(o.slug)}</div></td>
        <td>${escapeHtml(planName)}</td>
        <td>${active} / ${limit}</td>
        <td>${storage} / ${storageCap}</td>
        <td><span class="badge ${badge.cls}">${badge.text}</span></td>
        <td>${action}</td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button[data-load]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("codeOrg").value = btn.getAttribute("data-load");
        loadCodes();
        document.getElementById("codeOrg").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  function setOrgTab(tab) {
    orgTab = tab === "archived" ? "archived" : "active";
    document.getElementById("orgTabActive").classList.toggle("active", orgTab === "active");
    document.getElementById("orgTabArchived").classList.toggle("active", orgTab === "archived");
    document.getElementById("orgCreateForm").classList.toggle("hidden", orgTab === "archived");
    document.getElementById("orgArchivedHint").classList.toggle("hidden", orgTab !== "archived");
    renderOrgRows(orgTab === "archived" ? archivedOrgs : orgs, { archived: orgTab === "archived" });
  }

  function renderOverview() {
    document.getElementById("statOrgs").textContent = String(orgs.length);
    const totalBrochures = orgs.reduce((sum, o) => sum + (o.active_brochures ?? o.usage_this_month ?? 0), 0);
    document.getElementById("statBrochures").textContent = String(totalBrochures);
    const plan = plans[0];
    document.getElementById("statPlans").textContent = plan ? plan.name : "VSPH";
    document.getElementById("statPlanMix").textContent = plan
      ? `${brochureLimitLabel(plan)} brochures · ${formatBytes(storageLimitOf(plan))}`
      : "—";
    document.getElementById("orgTabArchived").textContent =
      archivedOrgs.length ? `Archived (${archivedOrgs.length})` : "Archived";
  }

  async function refresh() {
    adminError.textContent = "";
    const planRes = await api("admin-plans");
    plans = planRes.plans || [];
    document.getElementById("plansGrid").innerHTML = plans.length
      ? plans.map(renderPlanCard).join("")
      : '<div class="empty-state">VSPH Plan not configured. Run migration 007 / npm run apply:vsph-plan.</div>';

    const [orgRes, allRes] = await Promise.all([
      api("admin-orgs?action=list"),
      api("admin-orgs?action=list&include_archived=1"),
    ]);
    orgs = orgRes.organizations || [];
    archivedOrgs = (allRes.organizations || []).filter((o) => o.status !== "active");
    document.getElementById("codeOrg").innerHTML = orgs.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("");

    renderOverview();
    setOrgTab(orgTab);
    if (orgs[0] && orgTab === "active") loadCodes();
    await refreshAnalytics();
  }

  async function refreshAnalytics() {
    const hint = document.getElementById("analyticsHint");
    try {
      const data = await api("admin-analytics");
      document.getElementById("analyticsTotal").textContent = String(data.total || 0);
      document.getElementById("analyticsUnique").textContent = String(data.unique_visitors || 0);
      const tbody = document.getElementById("analyticsOrgRows");
      const rows = data.organizations || [];
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:1rem">No opens recorded yet.</td></tr>';
      } else {
        tbody.innerHTML = "";
        rows.forEach((row) => {
          const name = row.organization?.name || row.org_id;
          const slug = row.organization?.slug || "";
          const top = (row.countries && row.countries[0]) ? `${row.countries[0].country} (${row.countries[0].count})` : "—";
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${escapeHtml(name)}</strong><div class="muted">${escapeHtml(slug)}</div></td>
            <td>${row.brochure_count || 0}</td>
            <td>${row.total || 0}</td>
            <td>${row.unique_visitors || 0}</td>
            <td>${escapeHtml(top)}</td>
            <td>
              <div style="display:flex;gap:0.35rem;justify-content:flex-end;flex-wrap:wrap">
                <button class="secondary inline" data-org-analytics="${row.org_id}" type="button">Details</button>
                <button class="secondary inline" data-org-export="${row.org_id}" type="button">Export PDF</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll("[data-org-analytics]").forEach((btn) => {
          btn.addEventListener("click", () => loadOrgAnalytics(btn.getAttribute("data-org-analytics")));
        });
        tbody.querySelectorAll("[data-org-export]").forEach((btn) => {
          btn.addEventListener("click", () => exportOrgAnalytics(btn.getAttribute("data-org-export")));
        });
      }
      hint.textContent = "Active organizations only.";
    } catch (err) {
      hint.textContent = err.message || "Analytics unavailable until migration 005 is applied.";
    }
  }

  async function loadOrgAnalytics(orgId) {
    const data = await api(`admin-analytics?org_id=${encodeURIComponent(orgId)}`);
    const detail = data.detail;
    if (!detail) return;
    analyticsDetailOrgId = orgId;
    const panel = document.getElementById("analyticsDetail");
    panel.classList.remove("hidden");
    document.getElementById("analyticsDetailTitle").textContent =
      `Detail — ${detail.organization?.name || orgId} (${detail.total || 0} opens)`;
    const tbody = document.getElementById("analyticsDetailRows");
    const rows = detail.by_brochure || [];
    tbody.innerHTML = rows.length
      ? rows.map((r) => {
        const title = r.title || r.filename || r.brochure_id || "Untitled";
        const extras = [];
        if (r.project_name) extras.push(r.project_name);
        if (r.filename && r.filename !== title) extras.push(r.filename);
        const sub = extras.length ? `<div class="muted">${escapeHtml(extras.join(" · "))}</div>` : "";
        const top = (r.countries && r.countries[0]) ? `${r.countries[0].country} (${r.countries[0].count})` : "—";
        return `<tr><td><strong>${escapeHtml(title)}</strong>${sub}</td><td>${r.total || 0}</td><td>${r.unique_visitors || 0}</td><td>${escapeHtml(top)}</td></tr>`;
      }).join("")
      : '<tr><td colspan="4" class="muted">No brochures in this organization</td></tr>';
  }

  function topCountryLabel(row) {
    if (row.countries && row.countries[0]) {
      return `${row.countries[0].country} (${row.countries[0].count})`;
    }
    return "—";
  }

  async function exportOrgAnalytics(orgId) {
    adminError.textContent = "";
    try {
      const data = await api(`admin-analytics?org_id=${encodeURIComponent(orgId)}`);
      const detail = data.detail;
      if (!detail) throw new Error("No analytics for this organization");
      openAnalyticsPrint(detail, data.window_days || 30);
    } catch (err) {
      adminError.textContent = err.message || "Could not export analytics";
    }
  }

  function openAnalyticsPrint(detail, windowDays) {
    const org = detail.organization || {};
    const slug = org.slug || "org";
    const name = org.name || "Organization";
    const rows = detail.by_brochure || [];
    const topCountries = (detail.countries || []).slice(0, 5)
      .map((c) => `${c.country} (${c.count})`)
      .join(", ") || "—";
    const generated = new Date().toLocaleString();
    const fileTitle = `vsph-analytics-${slug}-30d`;
    const tableRows = rows.length
      ? rows.map((r) => {
        const title = r.title || r.filename || "Untitled";
        return `<tr>
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(r.project_name || "—")}</td>
          <td>${r.total || 0}</td>
          <td>${r.unique_visitors || 0}</td>
          <td>${escapeHtml(topCountryLabel(r))}</td>
        </tr>`;
      }).join("")
      : '<tr><td colspan="5">No brochures</td></tr>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(fileTitle)}</title>
  <style>
    body { font-family: Segoe UI, system-ui, sans-serif; color: #111827; margin: 32px; }
    h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
    .sub { color: #6b7280; font-size: 0.9rem; margin: 0 0 1.25rem; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem 1rem; min-width: 120px; }
    .stat span { display: block; color: #6b7280; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .stat strong { font-size: 1.2rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
    th { color: #6b7280; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <p class="sub">VSPH PDF Viewer</p>
  <h1>${escapeHtml(name)} — analytics</h1>
  <p class="sub">/${escapeHtml(slug)} · Last ${windowDays} days · Generated ${escapeHtml(generated)}</p>
  <div class="stats">
    <div class="stat"><span>Brochures</span><strong>${detail.brochure_count != null ? detail.brochure_count : rows.length}</strong></div>
    <div class="stat"><span>Opens</span><strong>${detail.total || 0}</strong></div>
    <div class="stat"><span>Unique</span><strong>${detail.unique_visitors || 0}</strong></div>
  </div>
  <p class="sub">Top countries: ${escapeHtml(topCountries)}</p>
  <table>
    <thead><tr><th>PDF</th><th>Project</th><th>Opens</th><th>Unique</th><th>Top country</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>window.addEventListener("load", function () { window.print(); });<\/script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) {
      adminError.textContent = "Allow pop-ups to export the PDF report, then use Save as PDF in the print dialog.";
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  async function loadCodes() {
    const orgId = document.getElementById("codeOrg").value;
    if (!orgId) return;
    const res = await api(`admin-orgs?action=codes&org_id=${encodeURIComponent(orgId)}`);
    const tbody = document.getElementById("codeRows");
    tbody.innerHTML = "";
    const codes = res.codes || [];
    if (!codes.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center;padding:1rem">No access code for this org.</td></tr>';
      return;
    }
    codes.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(c.code)}</strong></td>
        <td><span class="badge ${c.active ? "success" : "muted"}">${c.active ? "Active" : "Revoked"}</span></td>
        <td>${new Date(c.created_at).toLocaleString()}</td>
        <td>${c.active ? `<button class="danger inline" data-revoke="${c.id}" type="button">Revoke &amp; archive</button>` : ""}</td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button[data-revoke]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = window.confirm(
          "Revoke this code and set the organization to Plan stop?\n\nIt will move to Archived. All PDFs and share links for this org will stop working.",
        );
        if (!ok) return;
        try {
          await api("admin-orgs?action=revoke-code", { method: "POST", body: { id: btn.getAttribute("data-revoke") } });
          document.getElementById("codesMsg").textContent = "Organization moved to Archived (Plan stop). PDFs locked.";
          orgTab = "archived";
          await refresh();
        } catch (err) {
          adminError.textContent = err.message;
        }
      });
    });
  }

  document.getElementById("loginBtn").addEventListener("click", async () => {
    loginError.textContent = "";
    loginError.className = "err";
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
      loginError.textContent = err.message + " — use Bootstrap or add user to platform_admins.";
      jwt = "";
      localStorage.removeItem(SESSION_KEY);
    }
  });

  document.getElementById("bootstrapBtn").addEventListener("click", async () => {
    loginError.textContent = "";
    loginError.className = "err";
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

  document.getElementById("createOrgBtn").addEventListener("click", async () => {
    try {
      await api("admin-orgs?action=create", {
        method: "POST",
        body: {
          name: document.getElementById("orgName").value,
          slug: document.getElementById("orgSlug").value || undefined,
        },
      });
      document.getElementById("orgName").value = "";
      document.getElementById("orgSlug").value = "";
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
      document.getElementById("devCode").value = "";
      loadCodes();
    } catch (err) {
      adminError.textContent = err.message;
    }
  });

  document.getElementById("rotateCodeBtn").addEventListener("click", async () => {
    document.getElementById("codesMsg").textContent = "";
    adminError.textContent = "";
    try {
      const res = await api("admin-orgs?action=rotate-code", {
        method: "POST",
        body: {
          org_id: document.getElementById("codeOrg").value,
          code: document.getElementById("devCode").value,
          password: document.getElementById("devPassword").value,
        },
      });
      document.getElementById("codesMsg").textContent = `Rotated to code ${res.code.code}`;
      document.getElementById("devPassword").value = "";
      document.getElementById("devCode").value = "";
      loadCodes();
    } catch (err) {
      adminError.textContent = err.message;
    }
  });

  document.getElementById("codeOrg").addEventListener("change", loadCodes);

  document.getElementById("analyticsExportBtn").addEventListener("click", () => {
    if (analyticsDetailOrgId) exportOrgAnalytics(analyticsDetailOrgId);
  });

  document.getElementById("orgTabActive").addEventListener("click", () => setOrgTab("active"));
  document.getElementById("orgTabArchived").addEventListener("click", () => setOrgTab("archived"));

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
