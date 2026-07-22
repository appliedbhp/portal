// Client-facing: pending assessment queue, dynamic form renderer, score display

async function initAssessmentsClientSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const res = await apiCall("getPendingAssessments", {});
    renderAssessmentsClient(root, res.pending || []);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load assessments: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderAssessmentsClient(root, pending) {
  if (!pending.length) {
    root.innerHTML = `
      <div class="card">
        <h1><i class="bi bi-clipboard2-check-fill"></i> Assessments</h1>
        <div style="text-align:center;padding:32px 0;">
          <i class="bi bi-check-circle-fill" style="font-size:40px;color:#059669;"></i>
          <p style="margin:12px 0 0;font-size:15px;font-weight:600;">You're all caught up!</p>
          <p style="color:var(--muted);font-size:13px;margin:6px 0 0;">No assessments are due right now.</p>
        </div>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-clipboard2-check-fill"></i> Assessments</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        You have <strong>${pending.length}</strong> assessment${pending.length !== 1 ? "s" : ""} to complete.
        These help your care team track your progress over time.
      </p>
    </div>
    ${pending.map((a, i) => assessmentQueueCardHtml(a, i)).join("")}
    <div id="ac-form-area"></div>`;
}

function assessmentQueueCardHtml(a, i) {
  const def    = a.definition || {};
  const parts  = def.parts || [];
  const qCount = parts.reduce((n, p) => n + (p.questions || []).length, 0);
  const last   = a.lastCompleted
    ? `Last completed ${new Date(a.lastCompleted).toLocaleDateString([], { month:"short", day:"numeric" })}`
    : "Not yet completed";
  return `
    <div class="card" id="ac-queue-${i}">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-weight:700;font-size:15px;">${escapeHtml(a.name || a.shortName)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px;">
            ${qCount} questions · ~${Math.max(2, Math.ceil(qCount / 4))} min · ${escapeHtml(last)}
          </div>
        </div>
        <button onclick="startAssessmentForm(${i})"
                data-assignment-id="${escapeAttr(a.assignmentId)}"
                data-assessment-id="${escapeAttr(a.assessmentId)}">
          <i class="bi bi-play-fill"></i> Start
        </button>
      </div>
    </div>`;
}

// ── Dynamic form renderer ─────────────────────────────────────────────────────

let _acCurrentAssessment = null;

function startAssessmentForm(queueIndex) {
  const root    = document.getElementById("ac-form-area");
  const pending = _acPending || [];
  const a       = pending[queueIndex];
  if (!a || !root) return;
  _acCurrentAssessment = a;

  const def    = a.definition || {};
  const parts  = def.parts || [];
  const scale  = def.scale || ["Never","Rarely","Sometimes","Often","Very Often"];
  const totalQ = parts.reduce((n, p) => n + (p.questions || []).length, 0);

  root.innerHTML = `
    <div class="card" id="ac-form-card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        <div>
          <h2 style="margin:0;">${escapeHtml(def.name || a.name)}</h2>
          ${def.shortName ? `<div style="font-size:12px;color:var(--muted);">${escapeHtml(def.shortName)}</div>` : ""}
        </div>
        <button class="secondary" onclick="cancelAssessmentForm()" style="font-size:12px;">
          <i class="bi bi-x-lg"></i> Cancel
        </button>
      </div>

      ${def.instructions ? `
        <div style="background:var(--bg-alt,#f8f9fa);border-radius:8px;padding:12px 14px;
                    font-size:13px;line-height:1.6;margin-bottom:18px;color:var(--text);">
          <i class="bi bi-info-circle-fill" style="color:var(--primary);margin-right:6px;"></i>
          ${escapeHtml(def.instructions)}
        </div>` : ""}

      <!-- Scale legend -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">
        ${scale.map((s, i) => `
          <span style="font-size:11px;padding:3px 10px;border-radius:20px;
                       background:hsl(${220 + i * 20},70%,${94 - i * 6}%);
                       color:hsl(${220 + i * 20},60%,${35 - i * 3}%);">${escapeHtml(s)}</span>`).join("")}
      </div>

      <form id="ac-assessment-form" onsubmit="submitAssessmentForm(event)">
        ${parts.map(part => `
          ${parts.length > 1 ? `<div style="font-weight:700;color:var(--primary);font-size:13px;
            margin:18px 0 10px;padding-bottom:4px;border-bottom:2px solid var(--primary);">
            ${escapeHtml(part.name || part.id)}</div>` : ""}
          ${(part.questions || []).map(q => questionRowHtml(q, scale)).join("")}
        `).join("")}

        <div id="ac-form-status" style="margin:12px 0;"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
          <button type="button" class="secondary" onclick="cancelAssessmentForm()">Cancel</button>
          <button type="submit"><i class="bi bi-check-circle-fill"></i> Submit</button>
        </div>
      </form>
    </div>`;

  root.scrollIntoView({ behavior: "smooth", block: "start" });
}

function questionRowHtml(q, scale) {
  const name = "q" + q.id;
  return `
    <div style="padding:12px 0;border-bottom:1px solid var(--border);" id="qrow-${q.id}">
      <div style="font-size:13px;line-height:1.55;margin-bottom:10px;">
        <span style="color:var(--muted);font-weight:600;margin-right:6px;">${q.id}.</span>
        ${escapeHtml(q.text || "")}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${scale.map((s, i) => `
          <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;
                        font-size:11px;color:var(--muted);text-align:center;min-width:56px;">
            <input type="radio" name="${escapeAttr(name)}" value="${escapeAttr(s)}"
                   style="width:18px;height:18px;cursor:pointer;"
                   onchange="document.getElementById('qrow-${q.id}').style.background=''">
            ${escapeHtml(s)}
          </label>`).join("")}
      </div>
    </div>`;
}

function cancelAssessmentForm() {
  const area = document.getElementById("ac-form-area");
  if (area) area.innerHTML = "";
  _acCurrentAssessment = null;
}

async function submitAssessmentForm(e) {
  e.preventDefault();
  const a = _acCurrentAssessment;
  if (!a) return;

  const form     = document.getElementById("ac-assessment-form");
  const def      = a.definition || {};
  const parts    = def.parts || [];
  const responses = {};
  let   missing  = [];

  for (const part of parts) {
    for (const q of (part.questions || [])) {
      const name    = "q" + q.id;
      const checked = form.querySelector(`input[name="${name}"]:checked`);
      if (checked) {
        responses[name] = checked.value;
      } else {
        missing.push(q.id);
        const row = document.getElementById("qrow-" + q.id);
        if (row) row.style.background = "color-mix(in srgb, #ef4444 8%, transparent)";
      }
    }
  }

  if (missing.length) {
    setStatus("ac-form-status", `Please answer all questions (${missing.length} remaining).`, "error");
    document.getElementById("qrow-" + missing[0])?.scrollIntoView({ behavior:"smooth", block:"center" });
    return;
  }

  setStatus("ac-form-status", "Submitting…", "loading");
  try {
    const res = await apiCall("submitAssessment", {
      assignmentId: a.assignmentId,
      assessmentId: a.assessmentId,
      responses
    });
    renderAssessmentResults(a, res.scores, def);
  } catch (err) {
    setStatus("ac-form-status", "Error: " + err.message, "error");
  }
}

function renderAssessmentResults(a, scores, def) {
  const area = document.getElementById("ac-form-area");
  if (!area) return;

  const resultHtml = Object.entries(scores).filter(([k]) => !k.startsWith("_")).map(([partId, s]) => {
    const partDef  = (def.parts || []).find(p => p.id === partId || p.name === partId) || {};
    const partName = partDef.name || partId;
    if (s.method === "threshold_count") {
      const color = s.flag ? "#dc2626" : "#059669";
      return `
        <div style="padding:14px;border:2px solid ${color};border-radius:10px;margin-bottom:10px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;">${escapeHtml(partName)}</div>
          <div style="font-size:28px;font-weight:800;color:${color};">${s.count} / ${(def.parts || []).find(p=>p.id===partId)?.questions?.length || "?"}</div>
          <div style="font-size:13px;margin-top:4px;">
            <span style="font-weight:700;color:${color};">${escapeHtml(s.flagLabel)}</span>
            <span style="color:var(--muted);"> (cutoff: ${s.cutoff}+)</span>
          </div>
        </div>`;
    } else {
      return `
        <div style="padding:14px;border:1.5px solid var(--border);border-radius:10px;margin-bottom:10px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;">${escapeHtml(partName)}</div>
          <div style="font-size:28px;font-weight:800;color:var(--primary);">${s.method === "mean" ? s.mean : s.total}</div>
          <div style="font-size:12px;color:var(--muted);">${s.method === "mean" ? "Mean score" : "Total score"} · ${s.n} items</div>
          ${s.subscales ? Object.entries(s.subscales).map(([name, sub]) => `
            <div style="display:flex;justify-content:space-between;font-size:12px;
                        border-top:1px solid var(--border);padding-top:6px;margin-top:8px;">
              <span>${escapeHtml(name)}</span>
              <span style="font-weight:600;">${sub.mean} (${sub.total})</span>
            </div>`).join("") : ""}
        </div>`;
    }
  }).join("");

  area.innerHTML = `
    <div class="card">
      <div style="text-align:center;margin-bottom:20px;">
        <i class="bi bi-check-circle-fill" style="font-size:36px;color:#059669;"></i>
        <h2 style="margin:10px 0 4px;">Assessment Complete</h2>
        <p style="color:var(--muted);font-size:13px;margin:0;">Your responses have been saved and shared with your care team.</p>
      </div>
      <h3 style="margin-bottom:14px;">Your Results</h3>
      ${resultHtml}
      <button onclick="initAssessmentsClientSection(document.getElementById('section-assessments'))" style="margin-top:8px;">
        <i class="bi bi-arrow-left"></i> Back to Assessments
      </button>
    </div>`;
  area.scrollIntoView({ behavior: "smooth", block: "start" });
  _acCurrentAssessment = null;
}

// Module-level cache so startAssessmentForm can access the pending list
let _acPending = [];
const _origRenderAssessmentsClient = typeof renderAssessmentsClient === "function" ? renderAssessmentsClient : null;

// Patch renderAssessmentsClient to capture pending list
(function() {
  const orig = window.renderAssessmentsClient;
  window.renderAssessmentsClient = function(root, pending) {
    _acPending = pending;
    orig(root, pending);
  };
})();
