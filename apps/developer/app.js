(function () {
  const TOKEN_KEY = "brochure_dev_token";
  let token = localStorage.getItem(TOKEN_KEY) || "";
  let selectedFile = null;
  let projects = [];
  let currentProject = null;

  const loginPanel = document.getElementById("loginPanel");
  const appPanel = document.getElementById("appPanel");
  const loginError = document.getElementById("loginError");
  const uploadError = document.getElementById("uploadError");
  const projectError = document.getElementById("projectError");
  const logoutBtn = document.getElementById("logoutBtn");
  const planBadge = document.getElementById("planBadge");
  const headerSub = document.getElementById("headerSub");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const dropzone = document.getElementById("dropzone");
  const result = document.getElementById("result");
  const projectsView = document.getElementById("projectsView");
  const projectDetailView = document.getElementById("projectDetailView");
  const analyticsPanel = document.getElementById("analyticsPanel");

  function viewType() {
    const el = document.querySelector('input[name="viewType"]:checked');
    return el ? el.value : "brochure";
  }

  function showApp(show) {
    loginPanel.classList.toggle("hidden", show);
    appPanel.classList.toggle("hidden", !show);
    logoutBtn.classList.toggle("hidden", !show);
    planBadge.classList.toggle("hidden", !show);
  }

  function formatBytes(n) {
    if (n == null) return "Custom";
    const mb = n / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1) + " GB";
    return (mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)) + " MB";
  }

  function pct(used, limit) {
    if (limit == null || limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function countryLabel(entry) {
    if (!entry) return "Unknown";
    if (typeof entry === "object" && entry.country_name && entry.country_name !== "Unknown") {
      return entry.country_name;
    }
    const code = typeof entry === "object" ? entry.country : entry;
    if (!code || code === "XX") return "Unknown";
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
    } catch {
      return code;
    }
  }

  async function api(path, opts = {}) {
    return window.saasApi.call(path, { ...opts, token });
  }

  function showProjects() {
    currentProject = null;
    projectsView.classList.remove("hidden");
    projectDetailView.classList.add("hidden");
    analyticsPanel.classList.add("hidden");
  }

  function openProject(project) {
    currentProject = project;
    projectsView.classList.add("hidden");
    projectDetailView.classList.remove("hidden");
    document.getElementById("projectTitle").textContent = project.name;
    document.getElementById("projectSlugLine").textContent = `Folder /${project.slug}`;
    result.classList.add("hidden");
    analyticsPanel.classList.add("hidden");
    refreshBrochures();
  }

  async function refreshQuota() {
    const quota = await api("quota-status");
    headerSub.textContent = quota.organization.name;
    planBadge.textContent = quota.plan.name;
    document.getElementById("quotaUsed").textContent = String(quota.used);
    document.getElementById("quotaLimit").textContent = quota.limit == null ? "Unlimited" : String(quota.limit);
    document.getElementById("quotaBar").style.width = pct(quota.used, quota.limit) + "%";
    document.getElementById("storageValue").textContent = formatBytes(quota.storage_used);
    if (quota.max_storage_bytes == null) {
      document.getElementById("storageLine").textContent = "Custom storage limit";
      document.getElementById("storageBar").style.width = "0%";
    } else {
      document.getElementById("storageLine").textContent = `of ${formatBytes(quota.max_storage_bytes)}`;
      document.getElementById("storageBar").style.width = pct(quota.storage_used, quota.max_storage_bytes) + "%";
    }
    try {
      const orgAnalytics = await api("analytics-org");
      document.getElementById("orgViews").textContent = String(orgAnalytics.total || 0);
      document.getElementById("orgUniques").textContent = `${orgAnalytics.unique_visitors || 0} unique (approx)`;
    } catch {
      document.getElementById("orgViews").textContent = "—";
      document.getElementById("orgUniques").textContent = "Run analytics migration to enable";
    }
  }

  async function refreshProjects() {
    projectError.textContent = "";
    const res = await api("projects-list");
    projects = res.projects || [];
    const grid = document.getElementById("projectsGrid");
    if (!projects.length) {
      grid.innerHTML = '<div class="empty-state">No projects yet. Create one for your estate.</div>';
      return;
    }
    grid.innerHTML = projects.map((p) => `
      <button type="button" class="plan-card" data-project="${p.id}" style="text-align:left;cursor:pointer;width:100%">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="plan-price-line">/${escapeHtml(p.slug)}</div>
        <div class="plan-metrics">
          <div><span class="muted">Brochures</span><strong>${p.brochure_count || 0}</strong></div>
          <div><span class="muted">Last upload</span><strong>${p.last_upload_at ? new Date(p.last_upload_at).toLocaleString() : "—"}</strong></div>
        </div>
      </button>
    `).join("");
    grid.querySelectorAll("[data-project]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const project = projects.find((p) => p.id === btn.getAttribute("data-project"));
        if (project) openProject(project);
      });
    });
  }

  async function refreshBrochures() {
    if (!currentProject) return;
    const list = await api(`brochures-list?project_id=${encodeURIComponent(currentProject.id)}`);
    const container = document.getElementById("brochureList");
    const brochures = list.brochures || [];
    if (!brochures.length) {
      container.innerHTML = '<div class="empty-state">No brochures yet. Upload your first PDF.</div>';
      return;
    }
    container.innerHTML = "";
    brochures.forEach((b) => {
      const item = document.createElement("div");
      item.className = "brochure-item";
      item.innerHTML = `
        <div class="brochure-item-info">
          <div class="brochure-item-name">${escapeHtml(b.title || b.filename)}</div>
          <div class="brochure-item-meta">
            <span class="badge">${escapeHtml(b.view_type)}</span>
            &nbsp;${new Date(b.created_at).toLocaleString()}
          </div>
        </div>
        <div style="display:flex;gap:0.35rem;flex-shrink:0">
          <button data-share="${b.id}" class="secondary inline" type="button">Share</button>
          <button data-stats="${b.id}" data-title="${escapeHtml(b.title || b.filename)}" class="secondary inline" type="button">Stats</button>
          <button data-delete="${b.id}" data-title="${escapeHtml(b.title || b.filename)}" class="danger inline" type="button">Delete</button>
        </div>
      `;
      container.appendChild(item);
    });
    container.querySelectorAll("[data-share]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        uploadError.textContent = "";
        try {
          const link = await api("links-create", {
            method: "POST",
            body: { brochure_id: btn.getAttribute("data-share") },
          });
          showShare(link.vanity_url || link.url, link.token_url || link.url);
        } catch (err) {
          uploadError.textContent = err.message;
        }
      });
    });
    container.querySelectorAll("[data-stats]").forEach((btn) => {
      btn.addEventListener("click", () => openAnalytics(btn.getAttribute("data-stats"), btn.getAttribute("data-title")));
    });
    container.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const title = btn.getAttribute("data-title") || "this brochure";
        const ok = window.confirm(
          `Delete "${title}"?\n\nShare links will stop working and the file will be removed from storage.`,
        );
        if (!ok) return;
        uploadError.textContent = "";
        try {
          await api("brochures-delete", {
            method: "POST",
            body: { brochure_id: btn.getAttribute("data-delete") },
          });
          result.classList.add("hidden");
          analyticsPanel.classList.add("hidden");
          await refreshBrochures();
          await refreshQuota();
          await refreshProjects();
        } catch (err) {
          uploadError.textContent = err.message;
        }
      });
    });
  }

  async function openAnalytics(brochureId, title) {
    analyticsPanel.classList.remove("hidden");
    document.getElementById("analyticsTitle").textContent = `Analytics — ${title}`;
    try {
      const data = await api(`analytics-brochure?brochure_id=${encodeURIComponent(brochureId)}`);
      document.getElementById("aTotal").textContent = String(data.total || 0);
      document.getElementById("aUnique").textContent = String(data.unique_visitors || 0);
      const tbody = document.getElementById("countryRows");
      const countries = data.countries || [];
      tbody.innerHTML = countries.length
        ? countries.map((c) => `<tr><td>${escapeHtml(countryLabel(c))}</td><td>${c.count}</td></tr>`).join("")
        : '<tr><td colspan="2" class="muted">No opens yet</td></tr>';
    } catch (err) {
      uploadError.textContent = err.message;
    }
  }

  function embedSnippet(url) {
    const src = String(url || "").replace(/"/g, "&quot;");
    return `<iframe src="${src}" width="100%" height="720" style="border:0;" allowfullscreen loading="lazy" title="Brochure"></iframe>`;
  }

  function showShare(vanity, tokenUrl) {
    result.classList.remove("hidden");
    const pretty = vanity || tokenUrl;
    document.getElementById("shareUrl").value = pretty;
    document.getElementById("tokenUrl").value = tokenUrl || vanity;
    document.getElementById("embedCode").value = embedSnippet(pretty);
    document.getElementById("openLink").href = pretty;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function setFile(file) {
    selectedFile = file && file.type === "application/pdf" ? file : null;
    document.getElementById("fileName").textContent = selectedFile ? selectedFile.name : "";
    uploadBtn.disabled = !selectedFile;
  }

  document.getElementById("loginBtn").addEventListener("click", async () => {
    loginError.textContent = "";
    try {
      const data = await window.saasApi.call("developer-login", {
        method: "POST",
        body: {
          code: document.getElementById("code").value,
          password: document.getElementById("password").value,
        },
      });
      token = data.token;
      localStorage.setItem(TOKEN_KEY, token);
      showApp(true);
      showProjects();
      await refreshQuota();
      await refreshProjects();
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  logoutBtn.addEventListener("click", () => {
    token = "";
    localStorage.removeItem(TOKEN_KEY);
    showApp(false);
    headerSub.textContent = "Projects & brochures";
  });

  document.getElementById("createProjectBtn").addEventListener("click", async () => {
    projectError.textContent = "";
    try {
      await api("projects-create", {
        method: "POST",
        body: { name: document.getElementById("projectName").value },
      });
      document.getElementById("projectName").value = "";
      await refreshProjects();
    } catch (err) {
      projectError.textContent = err.message;
    }
  });

  document.getElementById("backToProjects").addEventListener("click", async () => {
    showProjects();
    await refreshProjects();
  });

  document.getElementById("closeAnalytics").addEventListener("click", () => {
    analyticsPanel.classList.add("hidden");
  });

  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    setFile(e.dataTransfer.files[0]);
  });

  document.getElementById("copyBtn").addEventListener("click", () => {
    const input = document.getElementById("shareUrl");
    input.select();
    navigator.clipboard.writeText(input.value).catch(() => {});
  });

  document.getElementById("copyEmbedBtn").addEventListener("click", () => {
    const input = document.getElementById("embedCode");
    input.select();
    navigator.clipboard.writeText(input.value).catch(() => {});
  });

  uploadBtn.addEventListener("click", async () => {
    uploadError.textContent = "";
    result.classList.add("hidden");
    if (!selectedFile || !currentProject) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";
    try {
      const title = document.getElementById("brochureTitle").value.trim() || selectedFile.name;
      const prepared = await api("upload-prepare", {
        method: "POST",
        body: {
          filename: selectedFile.name,
          title,
          view_type: viewType(),
          size_bytes: selectedFile.size,
          project_id: currentProject.id,
        },
      });
      const put = await fetch(prepared.upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: selectedFile,
      });
      if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);

      await api("upload-complete", {
        method: "POST",
        body: {
          brochure_id: prepared.brochure_id,
          project_id: prepared.project_id,
          storage_path: prepared.storage_path,
          filename: selectedFile.name,
          title,
          slug: prepared.slug,
          view_type: prepared.view_type,
          size_bytes: selectedFile.size,
        },
      });

      const link = await api("links-create", {
        method: "POST",
        token,
        body: { brochure_id: prepared.brochure_id, view_type: prepared.view_type },
      });
      showShare(link.vanity_url || link.url, link.token_url || link.url);
      await refreshQuota();
      await refreshBrochures();
      setFile(null);
      fileInput.value = "";
      document.getElementById("brochureTitle").value = "";
    } catch (err) {
      uploadError.textContent = err.message + (err.data?.limit != null ? ` (${err.data.used}/${err.data.limit})` : "");
    } finally {
      uploadBtn.disabled = !selectedFile;
      uploadBtn.textContent = "Upload & create share link";
    }
  });

  if (token) {
    showApp(true);
    showProjects();
    Promise.all([refreshQuota(), refreshProjects()]).catch((err) => {
      loginError.textContent = err.message;
      logoutBtn.click();
    });
  }
})();
