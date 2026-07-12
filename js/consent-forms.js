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
    const res = await apiCall("getConsentDocs", {});
    renderConsentForms(root, res.docs || []);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load consent forms: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderConsentForms(root, docs) {
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

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-pen-fill"></i> Consent Forms</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Link Google Doc consent forms for this client. Setting status to
        <strong>Pending Signature</strong> sends a notification badge to the client portal.
      </p>
    </div>

    <!-- Add new -->
    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i> Add Consent Document</h2>
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
    </style>`;
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
