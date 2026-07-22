// Provider: Assessment Library — upload PDFs, review extracted definitions, manage library

async function initAssessmentsLibrarySection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const res = await apiCall("getAssessmentLibrary", {});
    renderAssessmentsLibrary(root, res.assessments || []);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load library: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderAssessmentsLibrary(root, assessments) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-journal-medical"></i> Assessment Library</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Upload freely available assessment PDFs. Claude extracts the questions, scale, and scoring rules automatically.
        Review and save to your library, then assign to clients.
      </p>
    </div>

    <!-- Upload card -->
    <div class="card">
      <h2><i class="bi bi-upload"></i> Add Assessment</h2>
      <p style="font-size:13px;color:var(--muted);margin:0 0 14px;">
        Paste the full text of a freely available assessment instrument below, or upload a PDF.
      </p>
      <div class="row">
        <label>Assessment Name <span style="color:var(--muted);font-weight:400;">(optional — extracted automatically)</span></label>
        <input id="al-name" placeholder="e.g. Adult ADHD Self-Report Scale" style="max-width:480px;">
      </div>
      <div class="row">
        <label>Assessment Text</label>
        <textarea id="al-text" rows="10" placeholder="Paste the full text of the assessment here (questions, scale, scoring instructions)…"
                  style="max-width:100%;resize:vertical;font-size:13px;"></textarea>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <button onclick="uploadAssessmentFromText()">
          <i class="bi bi-magic"></i> Extract &amp; Preview
        </button>
        <label class="secondary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;
               padding:8px 16px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;">
          <i class="bi bi-file-pdf"></i> Upload PDF
          <input type="file" accept=".pdf,.txt" style="display:none;" onchange="handleAssessmentFile(this)">
        </label>
      </div>
      <div id="al-upload-status" style="margin-top:10px;"></div>
      <div id="al-preview" style="margin-top:14px;"></div>
    </div>

    <!-- Library list -->
    <div class="card">
      <h2><i class="bi bi-collection-fill"></i> Saved Assessments (${assessments.length})</h2>
      ${assessments.length === 0
        ? `<p style="color:var(--muted);font-size:13px;margin:0;">No assessments in library yet. Upload one above.</p>`
        : assessments.map(a => assessmentLibraryRowHtml(a)).join("")}
    </div>`;
}

function assessmentLibraryRowHtml(a) {
  const targetBadge = { adult: "#6366f1", child: "#059669", parent: "#d97706", adolescent: "#0891b2" };
  const color = targetBadge[a.target] || "#6b7280";
  const qCount = (a.definition.parts || []).reduce((n, p) => n + (p.questions || []).length, 0);
  return `
    <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:8px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <span style="font-weight:700;font-size:14px;">${escapeHtml(a.name)}</span>
            ${a.shortName ? `<span style="font-size:11px;font-weight:700;background:var(--bg-alt,#f3f4f6);
              color:var(--muted);padding:1px 8px;border-radius:6px;">${escapeHtml(a.shortName)}</span>` : ""}
            <span style="font-size:11px;font-weight:700;color:${color};background:${color}18;
              padding:1px 8px;border-radius:6px;">${escapeHtml(a.target || "")}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);">
            ${a.source ? escapeHtml(a.source) + " · " : ""}${qCount} questions
            ${a.version ? " · v" + escapeHtml(a.version) : ""}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="secondary" style="font-size:11px;padding:4px 10px;"
                  onclick="viewAssessmentDefinition('${escapeAttr(a.assessmentId)}')">
            <i class="bi bi-eye-fill"></i> View
          </button>
          <button class="secondary" style="font-size:11px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;"
                  onclick="removeAssessmentFromLibrary('${escapeAttr(a.assessmentId)}', this)">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </div>
    </div>`;
}

async function handleAssessmentFile(input) {
  const file = input.files[0];
  if (!file) return;
  setStatus("al-upload-status", "Reading file…", "loading");
  const text = await file.text();
  document.getElementById("al-text").value = text;
  setStatus("al-upload-status", "File loaded — click Extract & Preview.", "success");
  input.value = "";
}

async function uploadAssessmentFromText() {
  const pdfText = ((document.getElementById("al-text") || {}).value || "").trim();
  const name    = ((document.getElementById("al-name") || {}).value || "").trim();
  if (!pdfText) { setStatus("al-upload-status", "Paste assessment text first.", "error"); return; }
  setStatus("al-upload-status", "Extracting with Claude… this may take 10–20 seconds.", "loading");
  document.getElementById("al-preview").innerHTML = "";
  try {
    const res = await apiCall("uploadAssessment", { pdfText, name });
    setStatus("al-upload-status", "Extracted! Review the definition below, then save.", "success");
    renderAssessmentPreview(res.assessmentId, res.definition);
  } catch (e) {
    setStatus("al-upload-status", "Error: " + e.message, "error");
  }
}

function renderAssessmentPreview(assessmentId, def) {
  const scale    = (def.scale || []).join(" · ");
  const parts    = def.parts || [];
  const totalQs  = parts.reduce((n, p) => n + (p.questions || []).length, 0);
  const preview  = document.getElementById("al-preview");
  if (!preview) return;
  preview.innerHTML = `
    <div style="border:2px solid var(--primary);border-radius:10px;padding:18px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <h3 style="margin:0;">${escapeHtml(def.name || "Assessment")}
          ${def.shortName ? `<span style="font-size:13px;font-weight:400;color:var(--muted);">(${escapeHtml(def.shortName)})</span>` : ""}
        </h3>
        <button onclick="saveExtractedAssessment('${escapeAttr(assessmentId)}')">
          <i class="bi bi-check-circle-fill"></i> Save to Library
        </button>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-bottom:14px;">
        <span><strong>Target:</strong> ${escapeHtml(def.target || "—")}</span>
        <span><strong>Scale:</strong> ${escapeHtml(scale || "—")}</span>
        <span><strong>Questions:</strong> ${totalQs}</span>
        <span><strong>Source:</strong> ${escapeHtml(def.source || "—")}</span>
      </div>
      ${def.instructions ? `<p style="font-size:13px;font-style:italic;margin:0 0 14px;color:var(--text);">${escapeHtml(def.instructions)}</p>` : ""}
      ${parts.map(part => `
        <div style="margin-bottom:14px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--primary);">${escapeHtml(part.name || part.id)}</div>
          ${(part.questions || []).map(q => `
            <div style="display:flex;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);">
              <span style="color:var(--muted);flex-shrink:0;width:24px;">${q.id}.</span>
              <span style="flex:1;">${escapeHtml(q.text || "")}</span>
              ${q.threshold ? `<span style="color:var(--primary);flex-shrink:0;font-size:11px;">⬥ ${escapeHtml(q.threshold)}</span>` : ""}
            </div>`).join("")}
        </div>`).join("")}
      ${def.notes ? `<p style="font-size:12px;color:var(--muted);margin:10px 0 0;font-style:italic;">${escapeHtml(def.notes)}</p>` : ""}
      <div id="al-save-status" style="margin-top:10px;"></div>
    </div>`;
}

async function saveExtractedAssessment(assessmentId) {
  // Already saved by uploadAssessment — just reload library
  setStatus("al-save-status", "Saved!", "success");
  document.getElementById("al-text").value = "";
  document.getElementById("al-name").value = "";
  document.getElementById("al-preview").innerHTML = "";
  setTimeout(() => initAssessmentsLibrarySection(document.getElementById("section-assessments-library")), 1000);
}

function viewAssessmentDefinition(assessmentId) {
  // Navigate to a detail view — for now open an alert with key info
  // In a future iteration this can be an inline expand
  alert("Assessment detail view — use the Assignments tab to assign this to a client.");
}

async function removeAssessmentFromLibrary(assessmentId, btn) {
  if (!confirm("Remove this assessment from the library? Existing response data will be preserved.")) return;
  if (btn) btn.disabled = true;
  try {
    await apiCall("deleteAssessment", { assessmentId });
    initAssessmentsLibrarySection(document.getElementById("section-assessments-library"));
  } catch (e) {
    alert("Error: " + e.message);
    if (btn) btn.disabled = false;
  }
}
