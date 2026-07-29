// Vanderbilt ADHD Diagnostic Rating Scales
// Supports: online administration and AI extraction from uploaded PDFs.
// Provider: can extract from PDF, view all records, assign forms to clients.
// Parent/Client: fills out online form, views own results.

// ── Section entry point ───────────────────────────────────────────────────────

async function initVanderbiltSection(root) {
  const isProvider = getRole() === "provider";
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-clipboard2-pulse-fill"></i> Vanderbilt Assessment Scales</h1>
      <p style="color:var(--muted);font-size:13px;margin:0 0 18px;">
        NICHQ Vanderbilt ADHD Diagnostic Rating Scales — standardized parent and teacher ratings.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;">
        ${isProvider ? `
          <button onclick="vdShowTab('extract')" id="vd-tab-extract" class="secondary">
            <i class="bi bi-upload"></i> Extract from PDF
          </button>` : ""}
        <button onclick="vdShowTab('online')" id="vd-tab-online" class="secondary">
          <i class="bi bi-pencil-square"></i> Complete Online
        </button>
        <button onclick="vdShowTab('history')" id="vd-tab-history">
          <i class="bi bi-clock-history"></i> Rating History
        </button>
      </div>
      <div id="vd-panel"></div>
    </div>`;

  vdShowTab("history");
}

function vdShowTab(tab) {
  ["extract","online","history"].forEach(t => {
    const btn = document.getElementById("vd-tab-" + t);
    if (btn) {
      btn.className = t === tab ? "" : "secondary";
    }
  });
  if (tab === "history") vdRenderHistory();
  else if (tab === "online") vdRenderOnlineSelector();
  else if (tab === "extract") vdRenderExtractUI();
}

// ── History ───────────────────────────────────────────────────────────────────

async function vdRenderHistory() {
  const panel = document.getElementById("vd-panel");
  panel.innerHTML = `<p style="color:var(--muted);font-size:13px;">Loading records…</p>`;
  try {
    const res = await apiCall("getVanderbiltRecords", {});
    const records = res.records || [];
    if (!records.length) {
      panel.innerHTML = `<p style="color:var(--muted);font-size:14px;">No Vanderbilt ratings on file yet.</p>`;
      return;
    }
    panel.innerHTML = records.map(r => vdRecordCard(r)).join("");
  } catch(e) {
    panel.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${escapeHtml(e.message)}</p>`;
  }
}

function vdRecordCard(r) {
  const dsm = r.dsmCriteria || {};
  const sub = r.subscaleScores || {};
  const formLabel = r.formType === "parent_initial" ? "Parent Initial" : "Teacher Initial";
  const sourceIcon = r.source === "pdf_upload" ? "bi-file-earmark-arrow-up-fill" : "bi-pencil-square";

  const adhdColor = dsm.meetsADHD ? "#dc2626" : "#16a34a";
  const adhdText  = dsm.adhdSubtype || "—";

  const bars = Object.entries(sub).map(([key, s]) => {
    if (!s || s.max === 0) return "";
    const pct = Math.round((s.sum / s.max) * 100);
    const color = key === "inattention" || key === "hyperactivity"
      ? (pct >= 55 ? "#dc2626" : pct >= 35 ? "#f59e0b" : "#10b981")
      : "#6366f1";
    return `
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span style="font-weight:600;">${escapeHtml(s.label)}</span>
          <span style="color:var(--muted);">${s.sum}/${s.max}</span>
        </div>
        <div style="background:#f0f1f5;border-radius:4px;height:14px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;min-width:${pct>0?'4px':'0'};"></div>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="card" style="margin-bottom:12px;border-left:4px solid ${adhdColor};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
        <div>
          <div style="font-weight:700;font-size:15px;margin-bottom:4px;">
            <i class="bi ${sourceIcon}" style="color:var(--primary);margin-right:6px;"></i>
            ${escapeHtml(formLabel)} — ${escapeHtml(r.raterName)}
          </div>
          <div style="font-size:12px;color:var(--muted);">
            ${escapeHtml(r.dateCompleted)}
            · ${r.source === "pdf_upload" ? "Extracted from PDF" : "Completed online"}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px;font-weight:700;color:${adhdColor};">${escapeHtml(adhdText)}</div>
          ${dsm.meetsODD ? `<div style="font-size:11px;color:#f59e0b;margin-top:2px;">⚠ ODD criteria met (${dsm.oddSymptomCount} symptoms)</div>` : ""}
          ${dsm.meetsCD  ? `<div style="font-size:11px;color:#dc2626;margin-top:2px;">⚠ CD criteria met (${dsm.cdSymptomCount} symptoms)</div>` : ""}
          ${dsm.meetsAnxiety ? `<div style="font-size:11px;color:#8b5cf6;margin-top:2px;">⚠ Anxiety/Dep criteria met</div>` : ""}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 24px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Symptom Subscales</div>
          ${bars}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">DSM-5 Criteria Counts</div>
          <div style="font-size:13px;margin-bottom:5px;">Inattention: <strong>${dsm.inattentionCount || 0}/9</strong> rated Often/Very Often</div>
          <div style="font-size:13px;margin-bottom:5px;">Hyperactivity: <strong>${dsm.hyperactivityCount || 0}/9</strong> rated Often/Very Often</div>
          <div style="font-size:13px;margin-bottom:5px;">ODD symptoms: <strong>${dsm.oddSymptomCount || 0}/8</strong></div>
          ${dsm.cdSymptomCount !== undefined ? `<div style="font-size:13px;margin-bottom:5px;">CD symptoms: <strong>${dsm.cdSymptomCount}</strong></div>` : ""}
          ${dsm.anxietySymptomCount !== null && dsm.anxietySymptomCount !== undefined
            ? `<div style="font-size:13px;">Anxiety/Dep: <strong>${dsm.anxietySymptomCount}/7</strong></div>` : ""}
        </div>
      </div>
      ${r.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:12px;border-top:1px solid var(--border);padding-top:8px;font-style:italic;">${escapeHtml(r.notes)}</div>` : ""}
    </div>`;
}

// ── Online form selector ──────────────────────────────────────────────────────

function vdRenderOnlineSelector() {
  const panel = document.getElementById("vd-panel");
  panel.innerHTML = `
    <div style="max-width:480px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;color:var(--muted);">SELECT FORM TYPE</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
        ${[
          { key:"parent_initial", label:"Parent Initial", desc:"55 items · completed by parent or caregiver", icon:"bi-house-heart-fill" },
          { key:"teacher_initial", label:"Teacher Initial", desc:"43 items · completed by classroom teacher", icon:"bi-mortarboard-fill" }
        ].map(f => `
          <button class="secondary" onclick="vdStartOnlineForm('${f.key}')"
                  style="text-align:left;padding:14px 16px;border-radius:12px;line-height:1.5;">
            <div style="font-size:18px;margin-bottom:6px;color:var(--primary);"><i class="bi ${f.icon}"></i></div>
            <div style="font-weight:700;font-size:14px;">${f.label}</div>
            <div style="font-size:11px;color:var(--muted);">${f.desc}</div>
          </button>`).join("")}
      </div>
      <div class="row"><label>Your Name (Rater)</label>
        <input id="vd-rater-name" type="text" placeholder="e.g. Jane Smith" style="max-width:320px;">
      </div>
      <div id="vd-selector-status"></div>
    </div>`;
}

let _vdFormType = null;
let _vdForm     = null;
let _vdAnswers  = {};

async function vdStartOnlineForm(formType) {
  const raterName = (document.getElementById("vd-rater-name") || {}).value?.trim();
  if (!raterName) {
    setStatus("vd-selector-status", "Please enter your name before starting.", "error");
    return;
  }
  _vdFormType = formType;
  _vdAnswers  = {};

  const panel = document.getElementById("vd-panel");
  panel.innerHTML = `<p style="color:var(--muted);font-size:13px;">Loading form…</p>`;
  try {
    const res = await apiCall("getVanderbiltForm", { formType });
    _vdForm = res.form;
    vdRenderForm(raterName);
  } catch(e) {
    panel.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${escapeHtml(e.message)}</p>`;
  }
}

function vdRenderForm(raterName) {
  const panel = document.getElementById("vd-panel");
  const form  = _vdForm;
  const SYMPTOM_OPTS = [
    { val:0, label:"Never" },
    { val:1, label:"Occasionally" },
    { val:2, label:"Often" },
    { val:3, label:"Very Often" }
  ];
  const PERF_OPTS = [
    { val:1, label:"Excellent" },
    { val:2, label:"Above Average" },
    { val:3, label:"Average" },
    { val:4, label:"Below Average" },
    { val:5, label:"Problematic" }
  ];

  let html = `
    <div style="max-width:720px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-weight:700;font-size:16px;">${escapeHtml(form.label)}</div>
          <div style="font-size:12px;color:var(--muted);">Rater: ${escapeHtml(raterName)}</div>
        </div>
        <button class="secondary" onclick="vdRenderOnlineSelector()" style="font-size:12px;">
          <i class="bi bi-arrow-left"></i> Back
        </button>
      </div>`;

  form.sections.forEach(section => {
    const opts = section.scaleType === "performance" ? PERF_OPTS : SYMPTOM_OPTS;
    html += `
      <div style="margin-bottom:28px;">
        <div style="font-weight:700;font-size:14px;color:var(--primary);margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--primary);">
          ${escapeHtml(section.label)}
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px 4px;font-weight:600;color:var(--muted);font-size:11px;border-bottom:1px solid var(--border);min-width:300px;">BEHAVIOR</th>
                ${opts.map(o => `<th style="text-align:center;padding:8px 6px;font-weight:600;color:var(--muted);font-size:11px;border-bottom:1px solid var(--border);white-space:nowrap;">${o.label}<br><span style="font-size:10px;opacity:.7;">${o.val}</span></th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${section.items.map((item, idx) => `
                <tr style="background:${idx%2===0?'transparent':'var(--bg-alt,#f8fafc)'};">
                  <td style="padding:10px 4px;vertical-align:top;line-height:1.5;">${item.n}. ${escapeHtml(item.q)}</td>
                  ${opts.map(o => `
                    <td style="text-align:center;padding:10px 6px;vertical-align:middle;">
                      <label style="cursor:pointer;display:block;">
                        <input type="radio" name="vd-item-${item.n}" value="${o.val}"
                               onchange="vdSetAnswer(${item.n}, ${o.val})"
                               style="width:18px;height:18px;cursor:pointer;accent-color:var(--primary);">
                      </label>
                    </td>`).join("")}
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  });

  html += `
      <div class="row"><label>Notes (optional)</label>
        <textarea id="vd-notes" rows="3" style="max-width:520px;"
                  placeholder="Clinical observations, context, or caveats…"></textarea>
      </div>
      <div id="vd-submit-status" style="margin-bottom:8px;"></div>
      <button onclick="vdSubmitOnline('${escapeHtml(raterName)}')">
        <i class="bi bi-check2-circle"></i> Submit Rating
      </button>
    </div>`;

  panel.innerHTML = html;
}

function vdSetAnswer(itemNum, val) {
  _vdAnswers[String(itemNum)] = val;
}

async function vdSubmitOnline(raterName) {
  const form = _vdForm;
  // Validate all items answered
  const allItems = [];
  form.sections.forEach(s => s.items.forEach(i => allItems.push(i.n)));
  const missing = allItems.filter(n => _vdAnswers[String(n)] === undefined);
  if (missing.length > 0) {
    setStatus("vd-submit-status", `Please answer all items. ${missing.length} remaining (items: ${missing.slice(0,5).join(", ")}${missing.length>5?"…":""}).`, "error");
    return;
  }
  setStatus("vd-submit-status", "Saving…", "loading");
  try {
    const notes = (document.getElementById("vd-notes") || {}).value || "";
    const res = await apiCall("submitVanderbiltOnline", {
      formType:   _vdFormType,
      raterName,
      raterType:  _vdForm.raterType,
      rawScores:  _vdAnswers,
      notes
    });
    setStatus("vd-submit-status", "", "");
    vdShowResults(res, raterName);
  } catch(e) {
    setStatus("vd-submit-status", "Error: " + e.message, "error");
  }
}

function vdShowResults(res, raterName) {
  const panel = document.getElementById("vd-panel");
  const dsm = res.dsmCriteria || {};
  const adhdColor = dsm.meetsADHD ? "#dc2626" : "#16a34a";

  panel.innerHTML = `
    <div style="max-width:600px;">
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:18px 20px;margin-bottom:20px;">
        <div style="font-weight:700;color:#15803d;margin-bottom:4px;font-size:15px;">
          <i class="bi bi-check-circle-fill"></i> Rating submitted successfully
        </div>
        <div style="font-size:13px;color:#166534;">Rater: ${escapeHtml(raterName)}</div>
      </div>
      <div style="background:var(--bg);border:1.5px solid ${adhdColor};border-radius:12px;padding:18px 20px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">DSM-5 ADHD INDICATION</div>
        <div style="font-size:18px;font-weight:700;color:${adhdColor};margin-bottom:10px;">${escapeHtml(dsm.adhdSubtype || "Does not meet criteria")}</div>
        <div style="font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div>Inattention: <strong>${dsm.inattentionCount || 0}/9</strong></div>
          <div>Hyperactivity: <strong>${dsm.hyperactivityCount || 0}/9</strong></div>
          <div>ODD symptoms: <strong>${dsm.oddSymptomCount || 0}/8${dsm.meetsODD?" ⚠":""}</strong></div>
          <div>CD symptoms: <strong>${dsm.cdSymptomCount || 0}${dsm.meetsCD?" ⚠":""}</strong></div>
          ${dsm.anxietySymptomCount !== null && dsm.anxietySymptomCount !== undefined
            ? `<div>Anxiety/Dep: <strong>${dsm.anxietySymptomCount}/7${dsm.meetsAnxiety?" ⚠":""}</strong></div>` : ""}
        </div>
      </div>
      <button onclick="vdShowTab('history')">
        <i class="bi bi-clock-history"></i> View All Records
      </button>
    </div>`;
}

// ── PDF Extraction (provider only) ────────────────────────────────────────────

function vdRenderExtractUI() {
  const panel = document.getElementById("vd-panel");
  panel.innerHTML = `
    <div style="max-width:520px;">
      <div style="font-weight:700;font-size:13px;color:var(--muted);margin-bottom:12px;">
        EXTRACT SCORES FROM COMPLETED PAPER FORM
      </div>
      <p style="font-size:13px;color:var(--muted);margin:0 0 18px;line-height:1.6;">
        Upload a scanned or photographed completed Vanderbilt form.
        Claude AI will read each item and extract the scores automatically.
      </p>
      <div class="row"><label>Form Type</label>
        <select id="vd-extract-type" style="max-width:280px;">
          <option value="parent_initial">Parent Initial (55 items)</option>
          <option value="teacher_initial">Teacher Initial (43 items)</option>
        </select>
      </div>
      <div class="row"><label>Rater Name</label>
        <input id="vd-extract-rater" type="text" placeholder="e.g. Jane Smith" style="max-width:280px;">
      </div>
      <div class="row"><label>Upload PDF or Image</label>
        <input id="vd-extract-file" type="file" accept=".pdf,image/*" style="max-width:360px;">
      </div>
      <div class="row"><label>Notes (optional)</label>
        <input id="vd-extract-notes" type="text" placeholder="Any context or caveats" style="max-width:360px;">
      </div>
      <div id="vd-extract-status" style="margin-bottom:8px;"></div>
      <button onclick="vdDoExtract()">
        <i class="bi bi-cpu-fill"></i> Extract with AI
      </button>
      <p style="font-size:11px;color:var(--muted);margin-top:12px;line-height:1.5;">
        Extraction typically takes 10–20 seconds. Always verify AI-extracted scores against the original form before clinical use.
      </p>
    </div>`;
}

async function vdDoExtract() {
  const formType  = document.getElementById("vd-extract-type").value;
  const raterName = document.getElementById("vd-extract-rater").value.trim();
  const fileInput = document.getElementById("vd-extract-file");
  const notes     = document.getElementById("vd-extract-notes").value.trim();
  const file      = fileInput.files[0];

  if (!raterName) { setStatus("vd-extract-status", "Enter the rater name.", "error"); return; }
  if (!file)      { setStatus("vd-extract-status", "Select a PDF or image file.", "error"); return; }

  setStatus("vd-extract-status", "Reading file…", "loading");

  const pdfBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(",")[1]); // strip data:...;base64,
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  setStatus("vd-extract-status", "Sending to AI for extraction — this takes ~15 seconds…", "loading");
  try {
    const raterType = formType.startsWith("teacher") ? "teacher" : "parent";
    const res = await apiCall("extractVanderbiltPDF", {
      formType, raterName, raterType, pdfBase64, notes
    });
    setStatus("vd-extract-status", "", "");
    vdShowExtractResults(res, raterName);
  } catch(e) {
    setStatus("vd-extract-status", "Error: " + e.message, "error");
  }
}

function vdShowExtractResults(res, raterName) {
  const panel = document.getElementById("vd-panel");
  const dsm = res.dsmCriteria || {};
  const raw = res.rawScores || {};
  const adhdColor = dsm.meetsADHD ? "#dc2626" : "#16a34a";

  // Count blank items
  const totalItems = Object.keys(raw).length;
  const blankItems = Object.values(raw).filter(v => v === null || v === undefined).length;

  panel.innerHTML = `
    <div style="max-width:640px;">
      <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:12px;padding:16px 18px;margin-bottom:18px;">
        <div style="font-weight:700;color:#1e40af;margin-bottom:4px;">
          <i class="bi bi-cpu-fill"></i> AI Extraction Complete — ${escapeHtml(raterName)}
        </div>
        <div style="font-size:12px;color:#1e3a8a;">
          ${totalItems - blankItems} of ${totalItems} items extracted.
          ${blankItems > 0 ? `<strong style="color:#dc2626;"> ${blankItems} item(s) were blank or illegible.</strong>` : ""}
        </div>
        <div style="font-size:12px;color:#1e3a8a;margin-top:4px;">
          <i class="bi bi-exclamation-triangle-fill"></i>
          Always verify extracted scores against the original paper form before clinical use.
        </div>
      </div>

      <div style="background:var(--bg);border:1.5px solid ${adhdColor};border-radius:12px;padding:16px 18px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">DSM-5 INDICATION</div>
        <div style="font-size:17px;font-weight:700;color:${adhdColor};margin-bottom:8px;">${escapeHtml(dsm.adhdSubtype || "Does not meet criteria")}</div>
        <div style="font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:5px;">
          <div>Inattention: <strong>${dsm.inattentionCount || 0}/9</strong></div>
          <div>Hyperactivity: <strong>${dsm.hyperactivityCount || 0}/9</strong></div>
          <div>ODD: <strong>${dsm.oddSymptomCount || 0}/8${dsm.meetsODD?" ⚠":""}</strong></div>
          <div>CD: <strong>${dsm.cdSymptomCount || 0}${dsm.meetsCD?" ⚠":""}</strong></div>
          ${dsm.anxietySymptomCount !== null && dsm.anxietySymptomCount !== undefined
            ? `<div>Anxiety/Dep: <strong>${dsm.anxietySymptomCount}/7${dsm.meetsAnxiety?" ⚠":""}</strong></div>` : ""}
        </div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="vdShowTab('history')">
          <i class="bi bi-clock-history"></i> View All Records
        </button>
        <button class="secondary" onclick="vdRenderExtractUI()">
          <i class="bi bi-upload"></i> Extract Another
        </button>
      </div>
    </div>`;
}
