// Provider: Data Sheet generator — adds "Data Sheet" button to each goal row
// and lets providers generate or open structured Google Sheets data collection
// tabs for any measurement type.

const MEASURE_TYPE_LABELS = {
  frequency:       { label: "Frequency",       icon: "bi-hash",               desc: "Count occurrences per session" },
  rate:            { label: "Rate",             icon: "bi-speedometer2",       desc: "Count ÷ observation time → rate/min" },
  duration:        { label: "Duration",         icon: "bi-stopwatch-fill",     desc: "Total time in behavior per session" },
  latency:         { label: "Latency",          icon: "bi-hourglass-split",    desc: "Time from cue to response onset" },
  percent_correct: { label: "% Correct",        icon: "bi-check2-square",      desc: "Discrete trials with +/P/- scoring" },
  task_analysis:   { label: "Task Analysis",    icon: "bi-list-ol",            desc: "Step-by-step chaining checklist" },
  interval:        { label: "Interval",         icon: "bi-grid-3x3-gap-fill",  desc: "Time-sampled observation (MTS/PI/WI)" },
  rating:          { label: "Rating Scale",     icon: "bi-star-half",          desc: "1–5 Likert / caregiver report" }
};

// Called from plan.js goal row renderer — returns HTML for the button
function dataSheetButtonHtml(goalId) {
  return `<button class="secondary" style="font-size:11px;padding:4px 10px;"
    onclick="openDataSheetModal('${escapeAttr(goalId)}')">
    <i class="bi bi-table"></i> Data Sheet
  </button>`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

let _dsGoalId    = null;
let _dsGoalLabel = "";

function openDataSheetModal(goalId) {
  _dsGoalId = goalId;

  // Gather goal label from the DOM (plan.js sets data-goal-label on the card)
  const card = document.querySelector(`[data-goal-id="${goalId}"]`);
  _dsGoalLabel = card ? (card.dataset.goalLabel || "") : "";

  // Check existing sheets for this goal
  _dsOpenModal(goalId);
}

async function _dsOpenModal(goalId) {
  let modalEl = document.getElementById("ds-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "ds-modal";
    modalEl.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.45);`;
    document.body.appendChild(modalEl);
  }

  modalEl.innerHTML = `
    <div style="background:var(--bg);border-radius:14px;padding:28px 28px 24px;
                max-width:520px;width:calc(100% - 32px);box-shadow:0 20px 60px rgba(0,0,0,0.3);
                max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <h2 style="margin:0;font-size:17px;"><i class="bi bi-table" style="color:var(--primary);margin-right:8px;"></i>Data Sheet</h2>
        <button class="secondary" onclick="document.getElementById('ds-modal').remove()"
                style="font-size:12px;padding:4px 10px;"><i class="bi bi-x-lg"></i></button>
      </div>
      ${_dsGoalLabel ? `<p style="font-size:13px;color:var(--muted);margin:0 0 18px;line-height:1.5;">${escapeHtml(_dsGoalLabel)}</p>` : ""}
      <div id="ds-modal-body"><p style="color:var(--muted);font-size:13px;">Loading…</p></div>
    </div>`;
  modalEl.style.display = "flex";

  // Load existing sheets for this goal
  try {
    const res    = await apiCall("getDataSheets", { goalId });
    const sheets = res.sheets || [];
    renderDsModalBody(sheets);
  } catch (e) {
    document.getElementById("ds-modal-body").innerHTML =
      `<p style="color:#dc2626;font-size:13px;">Error: ${escapeHtml(e.message)}</p>`;
  }
}

function renderDsModalBody(existing) {
  const body = document.getElementById("ds-modal-body");
  if (!body) return;

  const existingHtml = existing.length
    ? `<div style="margin-bottom:20px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--muted);">EXISTING SHEETS</div>
        ${existing.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;
                      padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px;">
            <div>
              <div style="font-weight:600;font-size:13px;">${escapeHtml(MEASURE_TYPE_LABELS[s.measureType]?.label || s.measureType)}</div>
              <div style="font-size:11px;color:var(--muted);">${escapeHtml(s.tabName)} · created ${escapeHtml(s.createdAt)}</div>
            </div>
            <a href="${escapeAttr(s.url)}" target="_blank"
               style="font-size:12px;padding:5px 12px;border:1.5px solid var(--primary);
                      color:var(--primary);border-radius:8px;text-decoration:none;white-space:nowrap;">
              <i class="bi bi-box-arrow-up-right"></i> Open
            </a>
          </div>`).join("")}
      </div>`
    : "";

  body.innerHTML = existingHtml + `
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--muted);">
      ${existing.length ? "CREATE ANOTHER" : "SELECT MEASUREMENT TYPE"}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;">
      ${Object.entries(MEASURE_TYPE_LABELS).map(([type, meta]) => `
        <button id="ds-type-${type}" class="secondary"
                onclick="dsSelectType('${type}')"
                style="text-align:left;padding:10px 12px;border-radius:10px;line-height:1.4;">
          <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;">
            <i class="bi ${meta.icon}" style="color:var(--primary);font-size:15px;"></i>
            ${escapeHtml(meta.label)}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">${escapeHtml(meta.desc)}</div>
        </button>`).join("")}
    </div>
    <div id="ds-generate-area"></div>`;
}

let _dsSelectedType = null;

function dsSelectType(type) {
  _dsSelectedType = type;
  // Highlight selection
  Object.keys(MEASURE_TYPE_LABELS).forEach(t => {
    const btn = document.getElementById("ds-type-" + t);
    if (!btn) return;
    btn.style.background  = t === type ? "var(--primary)" : "";
    btn.style.color       = t === type ? "#fff" : "";
    btn.style.borderColor = t === type ? "var(--primary)" : "";
  });

  const area = document.getElementById("ds-generate-area");
  if (!area) return;
  const meta = MEASURE_TYPE_LABELS[type] || {};
  area.innerHTML = `
    <div style="padding:14px;background:var(--bg-alt,#f8fafc);border-radius:10px;margin-top:4px;">
      <div style="font-size:13px;margin-bottom:12px;">
        <strong>${escapeHtml(meta.label)}</strong> — ${escapeHtml(meta.desc)}
      </div>
      <div id="ds-gen-status" style="margin-bottom:8px;"></div>
      <button onclick="dsGenerate()">
        <i class="bi bi-file-earmark-text-fill"></i> Generate Data Sheet (Google Doc)
      </button>
    </div>`;
}

async function dsGenerate() {
  if (!_dsGoalId || !_dsSelectedType) return;
  setStatus("ds-gen-status", "Generating sheet… this takes a few seconds.", "loading");
  try {
    const res = await apiCall("generateDataSheet", {
      goalId: _dsGoalId,
      measureTypeOverride: _dsSelectedType
    });
    setStatus("ds-gen-status", "", "");
    const area = document.getElementById("ds-generate-area");
    if (area) {
      area.innerHTML = `
        <div style="padding:14px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;">
          <div style="font-weight:700;color:#15803d;margin-bottom:8px;">
            <i class="bi bi-check-circle-fill"></i> Sheet created!
          </div>
          <div style="font-size:13px;color:#166534;margin-bottom:12px;">
            <strong>${escapeHtml(MEASURE_TYPE_LABELS[res.measureType]?.label || res.measureType)}</strong>
            data sheet created — open it in Google Docs to print or share with staff.
          </div>
          <a href="${escapeAttr(res.url)}" target="_blank"
             style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;
                    background:#15803d;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
            <i class="bi bi-box-arrow-up-right"></i> Open in Google Docs
          </a>
        </div>`;
    }
  } catch (e) {
    setStatus("ds-gen-status", "Error: " + e.message, "error");
  }
}
