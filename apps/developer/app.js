(function () {
  const TOKEN_KEY = "brochure_dev_token";
  let token = localStorage.getItem(TOKEN_KEY) || "";
  let selectedFile = null;

  const loginPanel = document.getElementById("loginPanel");
  const appPanel = document.getElementById("appPanel");
  const loginError = document.getElementById("loginError");
  const uploadError = document.getElementById("uploadError");
  const logoutBtn = document.getElementById("logoutBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const dropzone = document.getElementById("dropzone");
  const result = document.getElementById("result");

  function viewType() {
    const el = document.querySelector('input[name="viewType"]:checked');
    return el ? el.value : "brochure";
  }

  function showApp(show) {
    loginPanel.classList.toggle("hidden", show);
    appPanel.classList.toggle("hidden", !show);
    logoutBtn.classList.toggle("hidden", !show);
  }

  async function refreshQuotaAndList() {
    const quota = await window.saasApi.call("quota-status", { token });
    document.getElementById("orgName").textContent = quota.organization.name;
    document.getElementById("planLine").textContent = `Plan: ${quota.plan.name} · max ${(quota.max_file_bytes / (1024 * 1024)).toFixed(0)} MB`;
    document.getElementById("quotaUsed").textContent = String(quota.used);
    document.getElementById("quotaLimit").textContent = String(quota.limit);
    const pct = quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
    document.getElementById("quotaBar").style.width = pct + "%";

    const list = await window.saasApi.call("brochures-list", { token });
    const tbody = document.getElementById("brochureRows");
    tbody.innerHTML = "";
    (list.brochures || []).forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(b.filename)}</td><td><span class="badge">${b.view_type}</span></td><td>${new Date(b.created_at).toLocaleString()}</td><td><button data-id="${b.id}" class="secondary linkBtn" type="button">Share</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll(".linkBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        uploadError.textContent = "";
        try {
          const link = await window.saasApi.call("links-create", {
            method: "POST",
            token,
            body: { brochure_id: btn.getAttribute("data-id") },
          });
          showShare(link.url);
        } catch (err) {
          uploadError.textContent = err.message;
        }
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function showShare(url) {
    result.classList.remove("hidden");
    document.getElementById("shareUrl").value = url;
    document.getElementById("openLink").href = url;
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
      await refreshQuotaAndList();
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  logoutBtn.addEventListener("click", () => {
    token = "";
    localStorage.removeItem(TOKEN_KEY);
    showApp(false);
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

  uploadBtn.addEventListener("click", async () => {
    uploadError.textContent = "";
    result.classList.add("hidden");
    if (!selectedFile) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";
    try {
      const prepared = await window.saasApi.call("upload-prepare", {
        method: "POST",
        token,
        body: {
          filename: selectedFile.name,
          view_type: viewType(),
          size_bytes: selectedFile.size,
        },
      });
      const put = await fetch(prepared.upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: selectedFile,
      });
      if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);

      await window.saasApi.call("upload-complete", {
        method: "POST",
        token,
        body: {
          brochure_id: prepared.brochure_id,
          storage_path: prepared.storage_path,
          filename: selectedFile.name,
          view_type: prepared.view_type,
          size_bytes: selectedFile.size,
        },
      });

      const link = await window.saasApi.call("links-create", {
        method: "POST",
        token,
        body: { brochure_id: prepared.brochure_id, view_type: prepared.view_type },
      });
      showShare(link.url);
      await refreshQuotaAndList();
      setFile(null);
    } catch (err) {
      uploadError.textContent = err.message + (err.data?.limit != null ? ` (${err.data.used}/${err.data.limit})` : "");
    } finally {
      uploadBtn.disabled = !selectedFile;
      uploadBtn.textContent = "Upload & create share link";
    }
  });

  if (token) {
    showApp(true);
    refreshQuotaAndList().catch((err) => {
      loginError.textContent = err.message;
      logoutBtn.click();
    });
  }
})();
