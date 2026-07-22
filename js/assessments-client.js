// Client-facing: unified Progress & Assessments section
// Tabs: Due Now | Score History | My Progress (replaces client-viz)

let _acPending    = [];
let _acActiveTab  = "due";

async function initAssessmentsClientSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const [pendingRes, scoresRes] = await Promise.all([
      apiCall("getPendingAssessments", {}),
      apiCall("getAssessmentScores",   {}).catch(() => ({ scores: [] }))
    ]);
    _acPending   = pendingRes.pending || [];
    _acActiveTab = "due";
    renderAssessmentsShell(root, _acPending.length, scoresRes.scores || []);
    acShowTab("due");
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderAssessmentsShell(root, dueCount, scores) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-clipboard2-pulse-fill"></i> Progress &amp; Assessments</h1>
      <p style="color:var(--muted);font-size:14px;margin:0 0 16px;">
        Complete check-ins from your care team and track how you're doing over time.
      </p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button id="ac-tab-due" class="secondary" onclick="acShowTab('due')"
                style="font-size:13px;padding:6px 14px;">
          <i class="bi bi-clipboard2-check-fill"></i> Due Now
          ${dueCount > 0 ? `<span style="background:#ef4444;color:#fff;font-size:10px;font-weight:700;
            padding:1px 6px;border-radius:8px;margin-left:4px;">${dueCount}</span>` : ""}
        </button>
        <button id="ac-tab-history" class="secondary" onclick="acShowTab('history')"
                style="font-size:13px;padding:6px 14px;">
          <i class="bi bi-graph-up"></i> Score History
        </button>
        <button id="ac-tab-progress" class="secondary" onclick="acShowTab('progress')"
                style="font-size:13px;padding:6px 14px;">
          <i class="bi bi-bar-chart-fill"></i> My Progress
        </button>
      </div>
    </div>
    <div id="ac-tab-content"></div>`;

  // Store scores for history tab
  root._acScores = scores;
}

function acShowTab(tab) {
  _acActiveTab = tab;
  ["due","history","progress"].forEach(t => {
    const btn = document.getElementById("ac-tab-" + t);
    if (!btn) return;
    btn.style.background  = t === tab ? "var(--primary)" : "";
    btn.style.color       = t === tab ? "#fff" : "";
    btn.style.borderColor = t === tab ? "var(--primary)" : "";
  });

  const content = document.getElementById("ac-tab-content");
  if (!content) return;

  const root   = content.closest("[id^='section-']") || document.body;
  const scores = root._acScores || [];

  if (tab === "due") {
    renderDueNow(content, _acPending);
  } else if (tab === "history") {
    renderScoreHistory(content, scores);
  } else if (tab === "progress") {
    renderMyProgress(content);
  }
}

// ── Tab 1: Due Now ────────────────────────────────────────────────────────────

function renderDueNow(container, pending) {
  if (!pending.length) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:32px 0;">
        <i class="bi bi-check-circle-fill" style="font-size:40px;color:#059669;"></i>
        <p style="margin:12px 0 4px;font-size:15px;font-weight:600;">All caught up!</p>
        <p style="color:var(--muted);font-size:13px;margin:0;">No assessments are due right now.</p>
      </div>`;
    return;
  }

  container.innerHTML = pending.map((a, i) => {
    const def    = a.definition || {};
    const parts  = def.parts || [];
    const qCount = parts.reduce((n, p) => n + (p.questions || []).length, 0);
    const last   = a.lastCompleted
      ? `Last done ${new Date(a.lastCompleted).toLocaleDateString([], { month:"short", day:"numeric" })}`
      : "First time";
    return `
      <div class="card" id="ac-queue-${i}">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:15px;">${escapeHtml(a.name || a.shortName)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px;">
              ${qCount} questions · ~${Math.max(2, Math.ceil(qCount / 4))} min · ${escapeHtml(last)}
            </div>
          </div>
          <button onclick="acStartForm(${i})">
            <i class="bi bi-play-fill"></i> Start
          </button>
        </div>
      </div>`;
  }).join("") + `<div id="ac-form-area"></div>`;
}

// ── Tab 2: Score History ──────────────────────────────────────────────────────

function renderScoreHistory(container, scores) {
  if (!scores.length) {
    container.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom:8px;"><i class="bi bi-graph-up"></i> Score History</h2>
        <p style="color:var(--muted);font-size:13px;margin:0;">
          No completed assessments yet. Scores will appear here after you complete your first check-in.
        </p>
      </div>`;
    return;
  }

  // Group by assessment name
  const grouped = {};
  for (const s of scores) {
    const key = s.name || s.assessmentId;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  container.innerHTML = Object.entries(grouped).map(([name, items]) => {
    const rows = items.map(s => {
      const date   = new Date(s.completedAt).toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" });
      const parts  = Object.entries(s.scores).filter(([k]) => !k.startsWith("_"));
      const badges = parts.map(([partId, sc]) => {
        if (sc.method === "threshold_count") {
          const color = sc.flag ? "#dc2626" : "#059669";
          return `<span style="font-size:12px;font-weight:700;color:${color};">
            ${sc.flagLabel} (${sc.count}/${sc.cutoff}+)</span>`;
        }
        return `<span style="font-size:12px;color:var(--primary);font-weight:700;">
          ${sc.method === "mean" ? sc.mean : sc.total}</span>`;
      }).join(" · ");
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;
                    padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:13px;color:var(--muted);">${escapeHtml(date)}</span>
          <div>${badges}</div>
        </div>`;
    }).join("");

    return `
      <div class="card">
        <h2 style="margin-bottom:14px;">${escapeHtml(name)}</h2>
        ${rows}
      </div>`;
  }).join("");
}

// ── Tab 3: My Progress (loads existing client-viz content) ───────────────────

function renderMyProgress(container) {
  container.innerHTML = `<div class="card" id="ac-progress-inner"></div>`;
  const inner = document.getElementById("ac-progress-inner");
  if (typeof initClientVizSection === "function") {
    initClientVizSection(inner);
  } else {
    inner.innerHTML = `<p style="color:var(--muted);font-size:13px;">Progress charts not available.</p>`;
  }
}

// ── Form renderer ─────────────────────────────────────────────────────────────

let _acCurrentAssessment = null;

function acStartForm(queueIndex) {
  const a = _acPending[queueIndex];
  if (!a) return;
  _acCurrentAssessment = a;

  const formArea = document.getElementById("ac-form-area");
  if (!formArea) return;

  const def   = a.definition || {};
  const parts = def.parts    || [];
  const scale = def.scale    || ["Never","Rarely","Sometimes","Often","Very Often"];

  formArea.innerHTML = `
    <div class="card" id="ac-form-card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        <div>
          <h2 style="margin:0;">${escapeHtml(def.name || a.name)}</h2>
          ${def.shortName ? `<div style="font-size:12px;color:var(--muted);">${escapeHtml(def.shortName)}</div>` : ""}
        </div>
        <button class="secondary" onclick="acCancelForm()" style="font-size:12px;">
          <i class="bi bi-x-lg"></i> Cancel
        </button>
      </div>

      ${def.instructions ? `
        <div style="background:var(--bg-alt,#f8f9fa);border-radius:8px;padding:12px 14px;
                    font-size:13px;line-height:1.6;margin-bottom:18px;">
          <i class="bi bi-info-circle-fill" style="color:var(--primary);margin-right:6px;"></i>
          ${escapeHtml(def.instructions)}
        </div>` : ""}

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">
        ${scale.map((s, i) => `
          <span style="font-size:11px;padding:3px 10px;border-radius:20px;
                       background:hsl(${220 + i * 20},70%,${94 - i * 6}%);
                       color:hsl(${220 + i * 20},60%,${35 - i * 3}%);">${escapeHtml(s)}</span>`).join("")}
      </div>

      <form id="ac-assessment-form" onsubmit="acSubmitForm(event)">
        ${parts.map(part => `
          ${parts.length > 1 ? `<div style="font-weight:700;color:var(--primary);font-size:13px;
            margin:18px 0 10px;padding-bottom:4px;border-bottom:2px solid var(--primary);">
            ${escapeHtml(part.name || part.id)}</div>` : ""}
          ${(part.questions || []).map(q => acQuestionRow(q, scale)).join("")}
        `).join("")}
        <div id="ac-form-status" style="margin:12px 0;"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
          <button type="button" class="secondary" onclick="acCancelForm()">Cancel</button>
          <button type="submit"><i class="bi bi-check-circle-fill"></i> Submit</button>
        </div>
      </form>
    </div>`;

  formArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

function acQuestionRow(q, scale) {
  return `
    <div style="padding:12px 0;border-bottom:1px solid var(--border);" id="acqrow-${q.id}">
      <div style="font-size:13px;line-height:1.55;margin-bottom:10px;">
        <span style="color:var(--muted);font-weight:600;margin-right:6px;">${q.id}.</span>
        ${escapeHtml(q.text || "")}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${scale.map(s => `
          <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;
                        font-size:11px;color:var(--muted);text-align:center;min-width:56px;">
            <input type="radio" name="q${q.id}" value="${escapeAttr(s)}"
                   style="width:18px;height:18px;cursor:pointer;"
                   onchange="document.getElementById('acqrow-${q.id}').style.background=''">
            ${escapeHtml(s)}
          </label>`).join("")}
      </div>
    </div>`;
}

function acCancelForm() {
  const area = document.getElementById("ac-form-area");
  if (area) area.innerHTML = "";
  _acCurrentAssessment = null;
}

async function acSubmitForm(e) {
  e.preventDefault();
  const a = _acCurrentAssessment;
  if (!a) return;

  const form      = document.getElementById("ac-assessment-form");
  const def       = a.definition || {};
  const responses = {};
  let   missing   = [];

  for (const part of (def.parts || [])) {
    for (const q of (part.questions || [])) {
      const checked = form.querySelector(`input[name="q${q.id}"]:checked`);
      if (checked) {
        responses["q" + q.id] = checked.value;
      } else {
        missing.push(q.id);
        const row = document.getElementById("acqrow-" + q.id);
        if (row) row.style.background = "color-mix(in srgb, #ef4444 8%, transparent)";
      }
    }
  }

  if (missing.length) {
    setStatus("ac-form-status", `Please answer all questions (${missing.length} remaining).`, "error");
    document.getElementById("acqrow-" + missing[0])?.scrollIntoView({ behavior:"smooth", block:"center" });
    return;
  }

  setStatus("ac-form-status", "Submitting…", "loading");
  try {
    const res = await apiCall("submitAssessment", {
      assignmentId: a.assignmentId,
      assessmentId: a.assessmentId,
      responses
    });
    acShowResults(a, res.scores, def);
  } catch (err) {
    setStatus("ac-form-status", "Error: " + err.message, "error");
  }
}

function acShowResults(a, scores, def) {
  const area = document.getElementById("ac-form-area");
  if (!area) return;

  const resultHtml = Object.entries(scores).filter(([k]) => !k.startsWith("_")).map(([partId, s]) => {
    const partDef  = (def.parts || []).find(p => p.id === partId) || {};
    const partName = partDef.name || partId;
    if (s.method === "threshold_count") {
      const color = s.flag ? "#dc2626" : "#059669";
      return `
        <div style="padding:14px;border:2px solid ${color};border-radius:10px;margin-bottom:10px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--muted);">${escapeHtml(partName)}</div>
          <div style="font-size:30px;font-weight:800;color:${color};">${s.count} / ${(partDef.questions || []).length}</div>
          <div style="font-size:13px;margin-top:4px;">
            <span style="font-weight:700;color:${color};">${escapeHtml(s.flagLabel)}</span>
            <span style="color:var(--muted);"> · cutoff ${s.cutoff}+</span>
          </div>
        </div>`;
    }
    return `
      <div style="padding:14px;border:1.5px solid var(--border);border-radius:10px;margin-bottom:10px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--muted);">${escapeHtml(partName)}</div>
        <div style="font-size:30px;font-weight:800;color:var(--primary);">${s.method === "mean" ? s.mean : s.total}</div>
        <div style="font-size:12px;color:var(--muted);">${s.method === "mean" ? "Mean" : "Total"} · ${s.n} items</div>
      </div>`;
  }).join("");

  area.innerHTML = `
    <div class="card">
      <div style="text-align:center;margin-bottom:20px;">
        <i class="bi bi-check-circle-fill" style="font-size:36px;color:#059669;"></i>
        <h2 style="margin:10px 0 4px;">Submitted — thank you!</h2>
        <p style="color:var(--muted);font-size:13px;margin:0;">Your responses have been shared with your care team.</p>
      </div>
      ${resultHtml}
      <button onclick="initAssessmentsClientSection(document.getElementById('section-assessments'))"
              style="margin-top:8px;">
        <i class="bi bi-arrow-left"></i> Back
      </button>
    </div>`;
  area.scrollIntoView({ behavior: "smooth", block: "start" });
  _acCurrentAssessment = null;
}
