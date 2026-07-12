// Consent Forms — provider-only section for managing consent documents
// linked to a client. Status drives client notifications.

const CONSENT_STATUSES = {
  pending_signature: { label: "Pending Signature", color: "#dc2626", bg: "#fee2e2" },
  sent:              { label: "Sent",               color: "#92400e", bg: "#fef3c7" },
  signed:            { label: "Signed",             color: "#065f46", bg: "#d1fae5" },
  draft:             { label: "Draft",              color: "#6b7280", bg: "#f3f4f6" }
};

async function initConsentFormsSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading consent forms…</p></div>`;
  try {
    const [docsRes, templatesRes] = await Promise.all([
      apiCall("getConsentDocs", {}),
      apiCall("getConsentTemplates", {}).catch(e => ({ templates: [], _error: e.message }))
    ]);
    renderConsentForms(root, docsRes.docs || [], templatesRes.templates || [], templatesRes._error || null);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load consent forms: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderConsentForms(root, docs, templates, templateError) {
  const statusOptions = Object.entries(CONSENT_STATUSES)
    .map(([v, s]) => `<option value="${v}">${escapeHtml(s.label)}</option>`).join("");

  const docsHtml = docs.length ? docs.map(d => {
    const s = CONSENT_STATUSES[d.status] || CONSENT_STATUSES.draft;
    return `
      <div style="padding:14px;border:1.5px solid var(--border);border-radius:10px;margin-bottom:10px;background:#fff;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(d.title)}</div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:11px;font-weight:700;background:${s.bg};color:${s.color};
                           padding:2px 8px;border-radius:8px;">${escapeHtml(s.label)}</span>
              <span style="font-size:12px;color:var(--muted);">Added ${escapeHtml(d.createdAt)}</span>
              ${d.docUrl ? `<a href="${escapeHtml(d.docUrl)}" target="_blank" rel="noopener"
                style="font-size:12px;color:var(--primary);font-weight:600;text-decoration:none;">
                <i class="bi bi-box-arrow-up-right"></i> Open Doc</a>` : ""}
            </div>
            ${d.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;font-style:italic;">${escapeHtml(d.notes)}</div>` : ""}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="secondary" style="font-size:11px;padding:4px 10px;"
              onclick="openEditConsentDoc('${escapeAttr(d.docId)}','${escapeAttr(d.title)}','${escapeAttr(d.docUrl)}','${escapeAttr(d.status)}','${escapeAttr(d.notes)}')">
              <i class="bi bi-pencil-fill"></i> Edit
            </button>
            <button class="secondary" style="font-size:11px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;"
              onclick="deleteConsentDoc('${escapeAttr(d.docId)}')">
              <i class="bi bi-trash3-fill"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join("") : `<p style="color:var(--muted);font-size:13px;margin:0;">No consent documents added yet.</p>`;

  // Build template picker grouped by subfolder
  const templatePickerHtml = templateError
    ? `<div class="alert alert-error" style="margin:0;"><i class="bi bi-exclamation-triangle-fill"></i> <span>Could not load template library: ${escapeHtml(templateError)}</span></div>`
    : buildTemplatePickerHtml(templates);

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-pen-fill"></i> Consent Forms</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Select templates from the practice library to copy to this client's folder, or link individual Google Docs manually.
      </p>
    </div>

    <!-- Template picker -->
    <div class="card">
      <h2><i class="bi bi-folder2-open"></i> Send Forms from Template Library</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px;">
        Check the forms needed for this client. Copies will be saved to their Drive folder and they'll receive an email notification.
      </p>
      <div id="cf-template-list">${templatePickerHtml}</div>
      <div id="cf-copy-status" style="margin:10px 0;"></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px;">
        <button onclick="copySelectedConsentForms()">
          <i class="bi bi-files"></i> Copy Selected &amp; Email Client
        </button>
        <button class="secondary" onclick="toggleAllConsentTemplates(true)" style="font-size:12px;">Select All</button>
        <button class="secondary" onclick="toggleAllConsentTemplates(false)" style="font-size:12px;">Deselect All</button>
      </div>
      <p style="font-size:12px;color:var(--muted);margin:10px 0 0;">
        Copies are saved to <strong>Clients/${getClientId()}/Consent Forms/</strong> in Google Drive.
        You can open each copy to add a signature page before the client signs.
      </p>
    </div>

    <!-- Add new manually -->
    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i> Link a Document Manually</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;" class="cf-grid">
        <div class="row">
          <label>Document Title</label>
          <input id="cf-title" placeholder="e.g. HIPAA Authorization Form" style="max-width:100%;">
        </div>
        <div class="row">
          <label>Google Doc URL</label>
          <input id="cf-url" placeholder="https://docs.google.com/…" style="max-width:100%;">
        </div>
        <div class="row" style="grid-column:1/-1;">
          <label>Notes (optional)</label>
          <input id="cf-notes" placeholder="e.g. Please sign and return before next session" style="max-width:100%;">
        </div>
      </div>
      <div id="cf-add-status" style="margin:8px 0;"></div>
      <button onclick="addConsentDoc()"><i class="bi bi-plus-lg"></i> Add &amp; Notify Client</button>
      <p style="font-size:12px;color:var(--muted);margin:8px 0 0;">
        New documents default to <strong>Pending Signature</strong> — the client will see a notification immediately.
      </p>
    </div>

    <!-- Existing docs -->
    <div class="card">
      <h2><i class="bi bi-files"></i> Documents on File</h2>
      <div id="cf-docs-list">${docsHtml}</div>
    </div>

    <!-- Edit modal placeholder -->
    <div id="cf-modal-area"></div>

    <style>
      @media (max-width: 640px) { .cf-grid { grid-template-columns: 1fr !important; } }
      .cf-template-group { margin-bottom: 16px; }
      .cf-template-group-label { font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .06em; color: var(--muted); margin-bottom: 6px; }
      .cf-template-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px;
        border: 1.5px solid var(--border); border-radius: 8px; margin-bottom: 6px;
        cursor: pointer; transition: border-color .15s, background .15s; }
      .cf-template-item:hover { border-color: var(--primary); background: #f0f4ff; }
      .cf-template-item input[type=checkbox] { width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; }
      .cf-template-item-name { font-size: 13px; flex: 1; }
      .cf-template-item a { font-size: 11px; color: var(--primary); text-decoration: none; flex-shrink: 0; }
    </style>`;
}

function buildTemplatePickerHtml(templates) {
  if (!templates.length) {
    return `<p style="color:var(--muted);font-size:13px;">Could not load template library — check Drive permissions.</p>`;
  }

  // Group by subfolder
  const groups = {};
  templates.forEach(t => {
    const key = t.subfolder || "__root__";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  return Object.entries(groups).map(([groupKey, files]) => {
    const label = groupKey === "__root__" ? "General" : groupKey;
    const items = files.map(t => `
      <label class="cf-template-item">
        <input type="checkbox" class="cf-template-chk" value="${escapeAttr(t.fileId)}">
        <span class="cf-template-item-name">${escapeHtml(t.name)}</span>
        <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
          <i class="bi bi-box-arrow-up-right"></i> Preview
        </a>
      </label>`).join("");
    return `<div class="cf-template-group">
      <div class="cf-template-group-label"><i class="bi bi-folder-fill"></i> ${escapeHtml(label)}</div>
      ${items}
    </div>`;
  }).join("");
}

function toggleAllConsentTemplates(checked) {
  document.querySelectorAll(".cf-template-chk").forEach(cb => { cb.checked = checked; });
}

async function copySelectedConsentForms() {
  const checked = [...document.querySelectorAll(".cf-template-chk:checked")];
  if (!checked.length) {
    setStatus("cf-copy-status", "Please select at least one form.", "error");
    return;
  }
  const fileIds = checked.map(cb => cb.value);
  setStatus("cf-copy-status", `Copying ${fileIds.length} form${fileIds.length !== 1 ? "s" : ""} and sending email — please wait…`, "loading");
  try {
    const res = await apiCall("copyConsentForms", { fileIds });
    const emailNote = res.emailed
      ? `Email sent to ${escapeHtml(res.clientEmail)}.`
      : res.clientEmail
        ? "Email could not be sent — check GmailApp permissions."
        : "No client email on file — notification not sent.";
    document.getElementById("cf-copy-status").innerHTML = `
      <div class="alert" style="border-color:#059669;color:#065f46;background:#d1fae5;">
        <i class="bi bi-check-circle-fill"></i>
        <span>
          ${res.copied} form${res.copied !== 1 ? "s" : ""} copied to client folder. ${emailNote}
          ${res.folderUrl ? `&nbsp;<a href="${escapeHtml(res.folderUrl)}" target="_blank"
            style="color:var(--primary);font-weight:700;text-decoration:none;">
            Open Folder <i class="bi bi-box-arrow-up-right"></i></a>` : ""}
        </span>
      </div>`;
    // Uncheck all and refresh docs list
    toggleAllConsentTemplates(false);
    try {
      const docsRes = await apiCall("getConsentDocs", {});
      document.getElementById("cf-docs-list").innerHTML =
        (docsRes.docs || []).length
          ? docsRes.docs.map(d => {
              const s = CONSENT_STATUSES[d.status] || CONSENT_STATUSES.draft;
              return `<div style="padding:14px;border:1.5px solid var(--border);border-radius:10px;margin-bottom:10px;background:#fff;">
                <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(d.title)}</div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span style="font-size:11px;font-weight:700;background:${s.bg};color:${s.color};padding:2px 8px;border-radius:8px;">${escapeHtml(s.label)}</span>
                  ${d.docUrl ? `<a href="${escapeHtml(d.docUrl)}" target="_blank" rel="noopener"
                    style="font-size:12px;color:var(--primary);font-weight:600;text-decoration:none;">
                    <i class="bi bi-box-arrow-up-right"></i> Open Doc</a>` : ""}
                </div>
              </div>`;
            }).join("")
          : `<p style="color:var(--muted);font-size:13px;margin:0;">No consent documents added yet.</p>`;
    } catch (_) {}
  } catch (e) {
    setStatus("cf-copy-status", "Error: " + e.message, "error");
  }
}

async function addConsentDoc() {
  const title  = (document.getElementById("cf-title")  || {}).value || "";
  const docUrl = (document.getElementById("cf-url")    || {}).value || "";
  const notes  = (document.getElementById("cf-notes")  || {}).value || "";
  if (!title.trim()) { setStatus("cf-add-status", "Title is required.", "error"); return; }
  setStatus("cf-add-status", "Saving…", "loading");
  try {
    await apiCall("addConsentDoc", { title: title.trim(), docUrl: docUrl.trim(), notes: notes.trim() });
    setStatus("cf-add-status", "Document added — client notified.", "success");
    document.getElementById("cf-title").value = "";
    document.getElementById("cf-url").value   = "";
    document.getElementById("cf-notes").value = "";
    initConsentFormsSection(document.getElementById("section-consent-forms"));
  } catch (e) {
    setStatus("cf-add-status", "Error: " + e.message, "error");
  }
}

function openEditConsentDoc(docId, title, docUrl, status, notes) {
  const statusOptions = Object.entries(CONSENT_STATUSES)
    .map(([v, s]) => `<option value="${v}" ${v === status ? "selected" : ""}>${escapeHtml(s.label)}</option>`)
    .join("");

  document.getElementById("cf-modal-area").innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;
                display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#fff;border-radius:14px;width:100%;max-width:480px;
                  box-shadow:0 20px 60px rgba(0,0,0,.25);">
        <div style="padding:18px 22px;border-bottom:1px solid var(--border);
                    display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:15px;">Edit Consent Document</div>
          <button class="secondary icon-btn" onclick="closeConsentModal()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div style="padding:20px 22px;display:flex;flex-direction:column;gap:14px;">
          <div class="row" style="margin:0;">
            <label>Title</label>
            <input id="cfe-title" value="${escapeHtml(title)}" style="max-width:100%;">
          </div>
          <div class="row" style="margin:0;">
            <label>Google Doc URL</label>
            <input id="cfe-url" value="${escapeHtml(docUrl)}" style="max-width:100%;">
          </div>
          <div class="row" style="margin:0;">
            <label>Status</label>
            <select id="cfe-status" style="max-width:100%;">${statusOptions}</select>
          </div>
          <div class="row" style="margin:0;">
            <label>Notes</label>
            <input id="cfe-notes" value="${escapeHtml(notes)}" style="max-width:100%;">
          </div>
          <div id="cfe-status-msg"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="secondary" onclick="closeConsentModal()">Cancel</button>
            <button data-id="${escapeAttr(docId)}" onclick="saveConsentDoc(this.dataset.id)">
              <i class="bi bi-floppy-fill"></i> Save
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function closeConsentModal() {
  const el = document.getElementById("cf-modal-area");
  if (el) el.innerHTML = "";
}

async function saveConsentDoc(docId) {
  const title  = (document.getElementById("cfe-title")  || {}).value || "";
  const docUrl = (document.getElementById("cfe-url")    || {}).value || "";
  const status = (document.getElementById("cfe-status") || {}).value || "";
  const notes  = (document.getElementById("cfe-notes")  || {}).value || "";
  setStatus("cfe-status-msg", "Saving…", "loading");
  try {
    await apiCall("updateConsentDoc", { docId, title, docUrl, status, notes });
    closeConsentModal();
    initConsentFormsSection(document.getElementById("section-consent-forms"));
  } catch (e) {
    setStatus("cfe-status-msg", "Error: " + e.message, "error");
  }
}

async function deleteConsentDoc(docId) {
  if (!confirm("Remove this consent document?")) return;
  try {
    await apiCall("deleteConsentDoc", { docId });
    initConsentFormsSection(document.getElementById("section-consent-forms"));
  } catch (e) {
    alert("Error: " + e.message);
  }
}
