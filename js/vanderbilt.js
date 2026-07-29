// Vanderbilt ADHD Rating Scales — progress monitoring tool.
// Provider view: assign forms to clients, extract from PDF, view history.
// Client view: none (clients access via assessments Due Now tab).

// ── Section entry point (provider-only sidebar nav) ───────────────────────────

async function initVanderbiltSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-clipboard2-check-fill"></i> Vanderbilt Rating Scales</h1>
      <p style="color:var(--muted);font-size:13px;margin:0 0 18px;">
        Assign rating forms to parents for progress monitoring, or upload completed paper forms.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;">
        <button onclick="vdShowTab('assign')" id="vd-tab-assign">
          <i class="bi bi-person-plus-fill"></i> Assign to Parent
        </button>
        <button onclick="vdShowTab('extract')" id="vd-tab-extract" class="secondary">
          <i class="bi bi-upload"></i> Extract from PDF
        </button>
        <button onclick="vdShowTab('history')" id="vd-tab-history" class="secondary">
          <i class="bi bi-graph-up"></i> Rating History
        </button>
      </div>
      <div id="vd-panel"></div>
    </div>`;

  vdShowTab("assign");
}

let _vdActiveTab = "assign";

function vdShowTab(tab) {
  _vdActiveTab = tab;
  ["assign","extract","history"].forEach(t => {
    const btn = document.getElementById("vd-tab-" + t);
    if (!btn) return;
    btn.className = t === tab ? "" : "secondary";
  });
  const panel = document.getElementById("vd-panel");
  if (!panel) return;
  if (tab === "assign")  vdRenderAssign(panel);
  if (tab === "extract") vdRenderExtract(panel);
  if (tab === "history") vdRenderHistory(panel);
}

// ── Assign tab ────────────────────────────────────────────────────────────────

function vdRenderAssign(panel) {
  const clientId = typeof getProviderClient === "function" ? getProviderClient() : "";
  panel.innerHTML = `
    <div style="max-width:480px;">
      <h3 style="margin:0 0 14px;font-size:15px;">Assign a Rating Form</h3>
      ${clientId ? `<p style="font-size:13px;color:var(--muted);margin:0 0 14px;">
        Client: <strong>${escapeHtml(clientId)}</strong>
      </p>` : `<div class="alert alert-warning" style="margin-bottom:14px;">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span>Select a client first from the client list.</span>
      </div>`}
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Form Type</label>
        <select id="vd-assign-formtype" style="width:100%;">
          <option value="parent_initial">Parent Rating Scale</option>
          <option value="teacher_initial">Teacher Rating Scale</option>
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Due Date (optional)</label>
        <input type="date" id="vd-assign-due" style="width:100%;" />
      </div>
      <div id="vd-assign-status" style="margin-bottom:10px;"></div>
      <button onclick="vdDoAssign()" ${!clientId ? "disabled" : ""}>
        <i class="bi bi-send-fill"></i> Assign Form
      </button>
    </div>`;
}

async function vdDoAssign() {
  const clientId  = typeof getProviderClient === "function" ? getProviderClient() : "";
  const formType  = document.getElementById("vd-assign-formtype")?.value || "parent_initial";
  const dueDate   = document.getElementById("vd-assign-due")?.value || "";
  if (!clientId) return;
  setStatus("vd-assign-status", "Assigning…", "loading");
  try {
    await apiCall("assignVanderbilt", { clientId, formType, dueDate });
    setStatus("vd-assign-status", "Form assigned — it will appear in the parent's Due Now tab.", "success");
  } catch(e) {
    setStatus("vd-assign-status", "Error: " + e.message, "error");
  }
}

// ── Extract from PDF tab ──────────────────────────────────────────────────────

function vdRenderExtract(panel) {
  panel.innerHTML = `
    <div style="max-width:520px;">
      <h3 style="margin:0 0 14px;font-size:15px;">Upload Completed Paper Form</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 16px;">
        AI will read the scanned form and extract all item scores automatically.
      </p>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Form Type</label>
        <select id="vd-pdf-formtype" style="width:100%;">
          <option value="parent_initial">Parent Rating Scale</option>
          <option value="teacher_initial">Teacher Rating Scale</option>
        </select>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Rater Name</label>
        <input type="text" id="vd-pdf-rater" placeholder="e.g. Jane Smith" style="width:100%;" />
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">PDF File</label>
        <input type="file" id="vd-pdf-file" accept="application/pdf" />
      </div>
      <div id="vd-pdf-status" style="margin-bottom:10px;"></div>
      <button onclick="vdDoExtract()">
        <i class="bi bi-cpu-fill"></i> Extract Scores
      </button>
    </div>
    <div id="vd-extract-result"></div>`;
}

async function vdDoExtract() {
  const file     = document.getElementById("vd-pdf-file")?.files?.[0];
  const formType = document.getElementById("vd-pdf-formtype")?.value || "parent_initial";
  const rater    = document.getElementById("vd-pdf-rater")?.value?.trim() || "";
  if (!file) { setStatus("vd-pdf-status", "Please select a PDF file.", "error"); return; }
  setStatus("vd-pdf-status", "Reading file…", "loading");

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(",")[1];
    setStatus("vd-pdf-status", "Extracting scores with AI (this may take 15–30 seconds)…", "loading");
    try {
      const res = await apiCall("extractVanderbiltPDF", {
        formType, pdfBase64: base64, raterName: rater, raterType: "parent"
      });
      setStatus("vd-pdf-status", "Scores extracted successfully.", "success");
      document.getElementById("vd-extract-result").innerHTML =
        vdRatingCard(res.subscaleScores, rater, formType, "just now");
    } catch(err) {
      setStatus("vd-pdf-status", "Error: " + err.message, "error");
    }
  };
  reader.readAsDataURL(file);
}

// ── Rating History tab ────────────────────────────────────────────────────────

async function vdRenderHistory(panel) {
  panel.innerHTML = `<p style="color:var(--muted);font-size:13px;">Loading…</p>`;
  try {
    const res = await apiCall("getVanderbiltRecords", {});
    const records = res.records || [];
    if (!records.length) {
      panel.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--muted);font-size:13px;">
        No completed ratings yet.</div>`;
      return;
    }
    panel.innerHTML = records.slice().reverse().map(r =>
      vdRatingCard(r.subscaleScores, r.raterName, r.formType, r.dateCompleted)
    ).join("");
  } catch(e) {
    panel.innerHTML = `<div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i><span>${escapeHtml(e.message)}</span></div>`;
  }
}

// ── Shared card renderer ──────────────────────────────────────────────────────

function vdRatingCard(subscaleScores, raterName, formType, dateLabel) {
  if (!subscaleScores) return "";
  const formLabel = formType === "teacher_initial" ? "Teacher Rating Scale" : "Parent Rating Scale";
  const entries   = Object.entries(subscaleScores);

  const bars = entries.map(([key, s]) => {
    if (!s || s.max == null) return "";
    const pct   = s.max > 0 ? Math.round((s.sum / s.max) * 100) : 0;
    const color = pct >= 67 ? "#ef4444" : pct >= 40 ? "#f59e0b" : "#059669";
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
          <span style="font-size:12px;font-weight:600;">${escapeHtml(s.label || key)}</span>
          <span style="font-size:12px;color:var(--muted);">${s.sum} / ${s.max}</span>
        </div>
        <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;
                      transition:width .4s;"></div>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
        <div>
          <div style="font-weight:700;font-size:14px;">${escapeHtml(formLabel)}</div>
          <div style="font-size:12px;color:var(--muted);">
            Rated by ${escapeHtml(raterName || "Unknown")} · ${escapeHtml(dateLabel || "")}
          </div>
        </div>
      </div>
      <div>${bars}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:8px;">
        Bars show symptom frequency as a percentage of the maximum possible score.
        Higher = more frequent symptoms. Use trend across ratings, not single scores.
      </div>
    </div>`;
}

// ── Client-side: inline form renderer (called from assessments-client.js) ─────

async function vdRenderInlineForm(container, assignment) {
  container.innerHTML = `<p style="color:var(--muted);font-size:13px;">Loading form…</p>`;
  try {
    const res  = await apiCall("getVanderbiltForm", { formType: assignment.formType });
    const form = res.form;
    vdBuildInlineForm(container, form, assignment);
  } catch(e) {
    container.innerHTML = `<div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i><span>${escapeHtml(e.message)}</span></div>`;
  }
}

function vdBuildInlineForm(container, form, assignment) {
  const symScale  = ["Never (0)","Occasionally (1)","Often (2)","Very Often (3)"];
  const perfScale = ["Excellent (1)","Above Average (2)","Average (3)","Below Average (4)","Problematic (5)"];

  const sections = form.sections.map(section => {
    const scale = section.scaleType === "performance" ? perfScale : symScale;
    const rows  = section.items.map(item => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);" id="vdrow-${item.n}">
        <div style="font-size:13px;margin-bottom:8px;">
          <span style="color:var(--muted);font-weight:600;margin-right:6px;">${item.n}.</span>
          ${escapeHtml(item.q)}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${scale.map((s, i) => `
            <label style="cursor:pointer;display:flex;align-items:center;gap:5px;
                          font-size:12px;padding:4px 8px;border-radius:6px;
                          border:1px solid var(--border);background:var(--bg-alt,#f8f9fa);">
              <input type="radio" name="vdq${item.n}" value="${i}"
                     style="cursor:pointer;"
                     onchange="document.getElementById('vdrow-${item.n}').style.background=''">
              ${escapeHtml(s)}
            </label>`).join("")}
        </div>
      </div>`).join("");

    return `
      <div style="margin-bottom:20px;">
        <div style="font-weight:700;color:var(--primary);font-size:13px;
                    padding-bottom:6px;border-bottom:2px solid var(--primary);margin-bottom:4px;">
          ${escapeHtml(section.label)}
        </div>
        ${rows}
      </div>`;
  }).join("");

  const formLabel = form.label || "Vanderbilt Rating Scale";
  container.innerHTML = `
    <div class="card" id="vd-inline-card">
      <h2 style="margin:0 0 6px;">${escapeHtml(formLabel)}</h2>
      <p style="font-size:13px;color:var(--muted);margin:0 0 16px;">
        Rate how often each behavior has occurred over the past 6 months.
      </p>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Your name</label>
        <input type="text" id="vd-inline-rater" placeholder="First and last name"
               style="max-width:320px;width:100%;" />
      </div>
      <form id="vd-inline-form" onsubmit="vdSubmitInline(event, '${escapeAttr(assignment.assignId)}',
            '${escapeAttr(assignment.formType)}')">
        ${sections}
        <div id="vd-inline-status" style="margin:10px 0;"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
          <button type="submit"><i class="bi bi-check-circle-fill"></i> Submit Rating</button>
        </div>
      </form>
    </div>`;
}

async function vdSubmitInline(e, assignId, formType) {
  e.preventDefault();
  const form = document.getElementById("vd-inline-form");
  if (!form) return;
  const raterName = document.getElementById("vd-inline-rater")?.value?.trim() || "";
  if (!raterName) {
    setStatus("vd-inline-status", "Please enter your name.", "error");
    return;
  }

  // Collect answers
  const formDef = VANDERBILT_FORMS_CACHE_[formType];
  if (!formDef) { setStatus("vd-inline-status", "Form definition missing.", "error"); return; }

  const rawScores = {};
  let missing = [];
  formDef.sections.forEach(section => {
    section.items.forEach(item => {
      const checked = form.querySelector(`input[name="vdq${item.n}"]:checked`);
      if (checked) {
        rawScores[String(item.n)] = Number(checked.value);
      } else {
        missing.push(item.n);
        const row = document.getElementById("vdrow-" + item.n);
        if (row) row.style.background = "color-mix(in srgb,#ef4444 8%,transparent)";
      }
    });
  });

  if (missing.length) {
    setStatus("vd-inline-status", `Please answer all items (${missing.length} remaining).`, "error");
    document.getElementById("vdrow-" + missing[0])?.scrollIntoView({ behavior:"smooth", block:"center" });
    return;
  }

  setStatus("vd-inline-status", "Submitting…", "loading");
  try {
    const res = await apiCall("submitVanderbiltOnline", {
      formType, raterName, raterType: "parent", rawScores, assignmentId: assignId
    });
    // Show thank-you + subscale summary
    const card = document.getElementById("vd-inline-card");
    if (card) {
      card.innerHTML = `
        <div style="text-align:center;padding:16px 0 8px;">
          <i class="bi bi-check-circle-fill" style="font-size:36px;color:#059669;"></i>
          <h2 style="margin:12px 0 4px;">Thank you!</h2>
          <p style="color:var(--muted);font-size:13px;margin:0 0 20px;">
            Your rating has been submitted to your care team.
          </p>
        </div>
        ${vdRatingCard(res.subscaleScores, raterName, formType, "just now")}`;
    }
    // Re-init assessments section to clear the pending badge
    setTimeout(() => {
      const sec = document.getElementById("section-assessments");
      if (sec && typeof initAssessmentsClientSection === "function") {
        delete (window._acInitialized || {})["assessments"];
        initAssessmentsClientSection(sec);
      }
    }, 1500);
  } catch(err) {
    setStatus("vd-inline-status", "Error: " + err.message, "error");
  }
}

// Cache for form definitions fetched during inline rendering
const VANDERBILT_FORMS_CACHE_ = {};

const _origVdRenderInlineForm = vdRenderInlineForm;
window.vdRenderInlineForm = async function(container, assignment) {
  container.innerHTML = `<p style="color:var(--muted);font-size:13px;">Loading form…</p>`;
  try {
    const res  = await apiCall("getVanderbiltForm", { formType: assignment.formType });
    VANDERBILT_FORMS_CACHE_[assignment.formType] = res.form;
    vdBuildInlineForm(container, res.form, assignment);
  } catch(e) {
    container.innerHTML = `<div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i><span>${escapeHtml(e.message)}</span></div>`;
  }
};
