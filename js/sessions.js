// Session Notes section — providers add/delete dated notes; parents view
// only (enforced server-side too, in Code.gs addSession_/deleteSession_).
// Date/time is always set by the server to "now" at save time, never typed.

let sessSessions = [];
let sessNoteTemplates = [];
let sessGoals = [];
let sessProgramNotes = []; // from client program (data_session_notes)
let sessView = "calendar"; // "list" | "calendar"
let sessCalDate = new Date(); // current month being viewed in calendar mode
let sessSelectedDay = null; // "YYYY-MM-DD" of the day expanded in calendar mode
let sessProgByDay = {}; // "YYYY-MM-DD" -> [{stepNum, title, programName}]
let _sessQuill = null;
let _sessPipChart = null;
let _sessPipGoals = [];
let _sessPipProgress = [];

// ── Built-in format templates ─────────────────────────────────────────────────
const SESS_FORMAT_TEMPLATES = [
  {
    id: "soap", label: "SOAP",
    html: `<h3>Subjective</h3><p>Client/parent report…</p>
           <h3>Objective</h3><p>Observed behavior and measurable data…</p>
           <h3>Assessment</h3><p>Clinical interpretation…</p>
           <h3>Plan</h3><p>Next steps and homework…</p>`
  },
  {
    id: "dap", label: "DAP",
    html: `<h3>Data</h3><p>Behavioral observations and measurable data…</p>
           <h3>Assessment</h3><p>Clinical interpretation of data…</p>
           <h3>Plan</h3><p>Next steps and homework…</p>`
  },
  {
    id: "abc", label: "ABC",
    html: `<h3>Antecedent</h3><p>What happened before the behavior…</p>
           <h3>Behavior</h3><p>Description of the behavior observed…</p>
           <h3>Consequence</h3><p>What happened after the behavior…</p>
           <h3>Intervention</h3><p>Strategies used and response…</p>`
  },
  {
    id: "progress", label: "Progress",
    html: `<h3>Goals Reviewed</h3><p>Goals addressed this session…</p>
           <h3>Progress</h3><p>Observable progress since last session…</p>
           <h3>Session Activity</h3><p>Skills practiced or content covered…</p>
           <h3>Homework</h3><p>Assignments for next session…</p>`
  }
];

function initSessionsSection(root) {
  const isProvider = getRole() === "provider";
  sessView = "calendar";
  sessCalDate = new Date();
  sessSelectedDay = null;
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <h1 style="margin-bottom:6px;"><i class="bi bi-journal-text"></i>Session Notes</h1>
          <p style="font-size:13px;color:var(--muted);margin:0;">Review sessions and record goal progress without leaving the calendar.</p>
        </div>
        <button class="sess-progress-launch no-print" onclick="sessOpenProgressPip()"><i class="bi bi-graph-up-arrow"></i> Progress PIP</button>
      </div>
      <div class="btn-row no-print" style="margin-top:16px;">
        <button id="sess-tab-list" class="secondary" onclick="sessSwitchView('list')">List</button>
        <button id="sess-tab-cal" onclick="sessSwitchView('calendar')">Calendar</button>
      </div>
      <div id="sess-viewBody" style="margin-top:16px;">Loading...</div>
    </div>

    ${isProvider ? `
    <div class="card session-entry-card">
      <h2><i class="bi bi-plus-circle-fill"></i>Add a Session Note</h2>
      <style>
        .sess-editor-wrap .ql-container { font-size:13px; font-family:inherit; border-radius:0 0 8px 8px; border:1.5px solid var(--border); border-top:none; min-height:180px; }
        .sess-editor-wrap .ql-toolbar { border-radius:8px 8px 0 0; border:1.5px solid var(--border); background:var(--surface); flex-wrap:wrap; }
        .sess-editor-wrap .ql-editor { min-height:180px; padding:12px 14px; line-height:1.7; }
        .sess-editor-wrap .ql-editor.ql-blank::before { color:var(--muted); font-style:italic; font-size:13px; }
        .sess-editor-wrap .ql-editor h3 { font-size:14px; font-weight:700; margin:14px 0 4px; color:var(--text); }
        .format-tpl-btn { font-size:12px; padding:4px 12px; border:1.5px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); cursor:pointer; }
        .format-tpl-btn:hover { background:var(--primary); color:#fff; border-color:var(--primary); }
      </style>

      <div class="row">
        <label>Format Template</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          ${SESS_FORMAT_TEMPLATES.map(t =>
            `<button class="format-tpl-btn" onclick="sessInsertFormatTemplate('${t.id}')">${t.label}</button>`
          ).join("")}
          <span style="font-size:12px;color:var(--muted);margin-left:4px;">Quick-insert a structured format</span>
        </div>
      </div>

      <div class="row">
        <label>Saved Templates</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="sess-templateSelect" style="max-width:340px;" onchange="sessApplyTemplate()">
            <option value="">— None —</option>
          </select>
          <button class="secondary" style="font-size:12px;padding:5px 12px;" onclick="sessCopyPrevious()">
            <i class="bi bi-clipboard-fill"></i> Copy Previous
          </button>
        </div>
      </div>

      <div class="row">
        <label>Goals Addressed This Session</label>
        <div id="sess-goalsChecklist">Loading goals...</div>
      </div>

      <div class="row">
        <label>Note</label>
        <div class="sess-editor-wrap">
          <div id="sess-noteEditor"></div>
        </div>
      </div>

      <div class="row">
        <label>Start Time</label>
        <input id="sess-dateTime" type="datetime-local">
      </div>
      <div class="row">
        <label>End Time</label>
        <input id="sess-endTime" type="datetime-local">
      </div>
      <div class="field-hint"><i class="bi bi-clock-fill"></i> Start is pre-filled with right now; end time is pre-filled to +30 min. Both are editable.</div>
      <button onclick="addSession()"><i class="bi bi-save-fill"></i> Save Session Note</button>
      <div id="sess-status"></div>
    </div>

    ${isProvider ? `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;"
           onclick="sessToggleAuditLog()">
        <h2 style="margin:0;"><i class="bi bi-shield-lock-fill" style="color:var(--primary);"></i> PHI Redaction Audit Log</h2>
        <i class="bi bi-chevron-down" id="sess-audit-chevron"></i>
      </div>
      <div id="sess-audit-body" style="display:none;margin-top:14px;">
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">
          Records every session note where PHI was detected and redacted. The original text is never stored here — only what types of PHI were found.
        </p>
        <div id="sess-audit-content"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>
      </div>
    </div>` : ""}
    ` : ""}
  `;
  loadSessions();
  if (isProvider) {
    loadNoteTemplates();
    loadSessionGoals();
    document.getElementById("sess-dateTime").value = sessNowForInput_();
    document.getElementById("sess-endTime").value = sessNowPlusMinutes_(30);
    _sessQuill = new Quill("#sess-noteEditor", {
      theme: "snow",
      placeholder: "Session note…",
      modules: { toolbar: [
        [{ header: [2, 3, false] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "clean"]
      ]}
    });
  }
}

// ── Floating progress panel ──────────────────────────────────────────────────
// Keeps goal data entry visible while the provider reviews session notes.
async function sessOpenProgressPip() {
  let pip = document.getElementById("sess-progress-pip");
  if (pip) {
    pip.classList.remove("minimized");
    pip.style.display = "flex";
    return;
  }

  pip = document.createElement("aside");
  pip.id = "sess-progress-pip";
  pip.className = "sess-progress-pip";
  pip.setAttribute("role", "dialog");
  pip.setAttribute("aria-label", "Progress picture-in-picture panel");
  pip.innerHTML = `
    <div class="sess-pip-header" id="sess-pip-drag-handle">
      <div><i class="bi bi-graph-up-arrow"></i><strong>Goal Progress</strong><span> PIP</span></div>
      <div class="sess-pip-actions">
        <button class="secondary" title="Minimize" aria-label="Minimize progress panel" onclick="sessToggleProgressPip()"><i class="bi bi-dash-lg"></i></button>
        <button class="secondary" title="Close" aria-label="Close progress panel" onclick="sessCloseProgressPip()"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="sess-pip-body">
      <div id="sess-pip-content"><div class="portal-preloader"><span></span><span></span><span></span></div></div>
    </div>`;
  document.body.appendChild(pip);
  sessEnablePipDrag(pip, pip.querySelector("#sess-pip-drag-handle"));

  try {
    const [planRes, progressRes] = await Promise.all([
      apiCall("getPlan", {}),
      apiCall("getProgress", {})
    ]);
    _sessPipGoals = (planRes.goals || []).map(g => Object.assign({}, g, { _key: typeof progGoalKey === "function" ? progGoalKey(g) : (g.objText || g.objective || "") }));
    _sessPipProgress = progressRes.progress || [];
    sessRenderProgressPip();
  } catch (e) {
    document.getElementById("sess-pip-content").innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>${escapeHtml(e.message)}</span></div>`;
  }
}

function sessToggleProgressPip() {
  document.getElementById("sess-progress-pip")?.classList.toggle("minimized");
}

function sessCloseProgressPip() {
  if (_sessPipChart) { _sessPipChart.destroy(); _sessPipChart = null; }
  document.getElementById("sess-progress-pip")?.remove();
}

function sessEnablePipDrag(panel, handle) {
  if (!panel || !handle) return;
  handle.addEventListener("pointerdown", event => {
    if (event.target.closest("button") || window.matchMedia("(max-width:700px)").matches) return;
    const rect = panel.getBoundingClientRect();
    const dx = event.clientX - rect.left, dy = event.clientY - rect.top;
    handle.setPointerCapture(event.pointerId);
    const move = e => {
      panel.style.left = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, e.clientX - dx)) + "px";
      panel.style.top = Math.max(72, Math.min(window.innerHeight - 80, e.clientY - dy)) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });
}

function sessRenderProgressPip(selectedKey) {
  const content = document.getElementById("sess-pip-content");
  if (!content) return;
  if (!_sessPipGoals.length) {
    content.innerHTML = `<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No goals are on file for this client.</span></div>`;
    return;
  }
  const goal = _sessPipGoals.find(g => g._key === selectedKey) || _sessPipGoals[0];
  const key = goal._key;
  const today = new Date();
  const pad = n => String(n).padStart(2,"0");
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  content.innerHTML = `
    <label>Goal</label>
    <select id="sess-pip-goal" onchange="sessRenderProgressPip(this.value)">
      ${_sessPipGoals.map(g => `<option value="${escapeAttr(g._key)}" ${g._key === key ? "selected" : ""}>${escapeHtml(g._key)}</option>`).join("")}
    </select>
    <div class="sess-pip-measure"><i class="bi bi-rulers"></i>${escapeHtml(goal.measure || "Score")}</div>
    <div class="sess-pip-chart"><canvas id="sess-pip-chart"></canvas></div>
    <div class="sess-pip-entry-head">
      <strong><i class="bi bi-plus-circle-fill"></i>Add progress data</strong>
      <input type="date" id="sess-pip-start" value="${todayIso}" onchange="sessRenderPipDays()">
    </div>
    <div id="sess-pip-days" class="sess-pip-days"></div>
    <div class="sess-pip-footer">
      <div id="sess-pip-status"></div>
      <button onclick="sessSavePipProgress()"><i class="bi bi-save-fill"></i>Save entries</button>
    </div>`;
  sessRenderPipChart(goal);
  sessRenderPipDays();
}

function sessRenderPipDays() {
  const grid = document.getElementById("sess-pip-days");
  const start = document.getElementById("sess-pip-start")?.value;
  if (!grid || !start) return;
  const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const pad = n => String(n).padStart(2,"0");
  grid.innerHTML = Array.from({length:7}, (_, i) => {
    const d = new Date(start + "T00:00:00"); d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return `<label><span>${names[d.getDay()]}<small>${d.getMonth()+1}/${d.getDate()}</small></span><input class="sess-pip-score" data-date="${iso}" inputmode="decimal" placeholder="—"></label>`;
  }).join("");
}

function sessRenderPipChart(goal) {
  if (_sessPipChart) { _sessPipChart.destroy(); _sessPipChart = null; }
  const canvas = document.getElementById("sess-pip-chart");
  if (!canvas) return;
  const rows = _sessPipProgress.filter(p => p.objText === goal._key && p.date && p.score !== "" && !isNaN(Number(p.score)))
                               .sort((a,b) => a.date.localeCompare(b.date)).slice(-12);
  const text = `${goal._key} ${goal.measure || ""}`;
  const isPct = /\b(percent(?:age)?|%|accuracy|success rate)\b/i.test(text);
  const isWeekly = /\bweekly\b|\bper\s+week\b|\beach\s+week\b|\ba\s+week\b|\/\s*week\b/i.test(text);
  let chartRows = rows.map(r => ({ label:r.date, value:Number(r.score) }));
  if (isWeekly) {
    const buckets = {};
    rows.forEach(r => {
      const week = typeof progWeekStart === "function" ? progWeekStart(r.date) : r.date;
      (buckets[week] ||= []).push(Number(r.score));
    });
    chartRows = Object.keys(buckets).sort().map(week => {
      const vals = buckets[week];
      const d = new Date(week + "T00:00:00");
      return { label:`Week of ${d.toLocaleDateString(undefined,{month:"short",day:"numeric"})}`, value:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*100)/100 };
    });
  }
  _sessPipChart = new Chart(canvas.getContext("2d"), {
    type:"line",
    data:{ labels:chartRows.map(r => r.label), datasets:[{ data:chartRows.map(r => r.value), borderColor:"#3185fc", backgroundColor:"rgba(49,133,252,.14)", fill:true, tension:.35, pointRadius:3, borderWidth:2 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},title:{display:true,text:isWeekly?"Week":"Date"}}, y:{min:isPct?0:undefined,max:isPct?100:undefined,title:{display:true,text:isPct?"Percent (%)":(goal.measure||"Score")}} } }
  });
}

async function sessSavePipProgress() {
  const goal = _sessPipGoals.find(g => g._key === document.getElementById("sess-pip-goal")?.value);
  if (!goal) return;
  const entries = Array.from(document.querySelectorAll(".sess-pip-score"))
    .map(input => ({ objText:goal._key, date:input.dataset.date, measure:goal.measure || "", score:input.value.trim() }))
    .filter(entry => entry.score !== "");
  if (!entries.length) { setStatus("sess-pip-status", "Enter at least one score.", "error"); return; }
  setStatus("sess-pip-status", "Saving…", "loading");
  try {
    const result = await apiCall("addProgressBatch", { entries });
    const refreshed = await apiCall("getProgress", {});
    _sessPipProgress = refreshed.progress || [];
    if (typeof progAllEntries !== "undefined") progAllEntries = _sessPipProgress;
    if (typeof initialized !== "undefined" && initialized.progress && typeof renderGoalView === "function") renderGoalView();
    setStatus("sess-pip-status", `${result.saved} entr${result.saved === 1 ? "y" : "ies"} saved.`, "success");
    document.querySelectorAll(".sess-pip-score").forEach(input => input.value = "");
    sessRenderPipChart(goal);
  } catch (e) {
    setStatus("sess-pip-status", "Error: " + e.message, "error");
  }
}

async function loadSessionGoals() {
  const el = document.getElementById("sess-goalsChecklist");
  try {
    const { goals } = await apiCall("getPlan", {});
    sessGoals = goals;
    el.innerHTML = goals.length
      ? goals.map((g, i) => `
          <div class="checkbox-row" style="margin-bottom:8px;">
            <input type="checkbox" id="sess-goal-${i}" data-objective="${escapeAttr(g.objective)}" onchange="sessSyncGoalsBlock()">
            <label for="sess-goal-${i}">${escapeHtml(g.objective)}</label>
          </div>
        `).join("")
      : '<div class="field-hint"><i class="bi bi-info-circle-fill"></i> No goals on file for this client yet.</div>';
  } catch (e) {
    el.innerHTML = `<div class="field-hint"><i class="bi bi-exclamation-triangle-fill"></i> Could not load goals: ${escapeHtml(e.message)}</div>`;
  }
}

// Replaces a goals block at the top of the Quill editor when checkboxes change.
// The block is identified by a data-goals-block attribute on the first element.
function sessSyncGoalsBlock() {
  if (!_sessQuill) return;
  const checked = Array.from(document.querySelectorAll("#sess-goalsChecklist input:checked"))
    .map(cb => cb.dataset.objective);

  // Remove the complete generated block (heading, list, and spacer). Previously
  // only the heading was removed, leaving stale goals behind.
  const editor = _sessQuill.root;
  const existing = editor.querySelector("[data-goals-block]");
  if (existing) {
    const generatedNodes = [existing];
    let next = existing.nextElementSibling;
    if (next && next.tagName === "UL") {
      generatedNodes.push(next);
      next = next.nextElementSibling;
    }
    if (next && next.tagName === "P" && !next.textContent.trim()) generatedNodes.push(next);
    generatedNodes.forEach(node => node.remove());
  }

  if (!checked.length) return;

  const items = checked.map(o => `<li>${escapeHtml(o)}</li>`).join("");
  const block = `<p data-goals-block="1"><strong>Goals Addressed This Session:</strong></p><ul>${items}</ul><p><br></p>`;

  const currentHtml = editor.innerHTML;
  _sessQuill.clipboard.dangerouslyPasteHTML(0, block);
}

// "YYYY-MM-DDTHH:mm" in local time, the format <input type="datetime-local"> expects.
function sessNowForInput_() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sessNowPlusMinutes_(mins) {
  const d = new Date(Date.now() + mins * 60 * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sessSwitchView(view) {
  sessView = view;
  document.getElementById("sess-tab-list").className = view === "list" ? "" : "secondary";
  document.getElementById("sess-tab-cal").className = view === "calendar" ? "" : "secondary";
  sessRenderView();
}

async function loadSessions() {
  try {
    const [{ sessions }, progData, notesRes] = await Promise.all([
      apiCall("getSessions", {}),
      apiCall("getMyProgram", {}).catch(() => ({ assignment: null, steps: [] })),
      apiCall("getSessionNotes", {}).catch(() => ({ notes: [] }))
    ]);
    sessSessions = sessions;
    sessProgramNotes = notesRes.notes || [];
    sessProgByDay = buildSessProgByDay(progData);
    sessRenderView();
  } catch (e) {
    document.getElementById("sess-viewBody").innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Error: ${escapeHtml(e.message)}</span></div>`;
  }
}

function buildSessProgByDay(progData) {
  const byDay = {};
  if (!progData.assignment || !progData.steps) return byDay;
  const programName = progData.assignment.programName || "Program";
  progData.steps.forEach(step => {
    if (step.status === "completed" && step.completedAt) {
      const key = step.completedAt.slice(0, 10);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push({ stepNum: step.stepNum, title: step.title, programName });
    }
  });
  return byDay;
}

async function loadNoteTemplates() {
  const select = document.getElementById("sess-templateSelect");
  try {
    const { templates } = await apiCall("getNoteTemplates", {});
    sessNoteTemplates = templates;
    select.innerHTML = '<option value="">— None —</option>' +
      templates.map(t => `<option value="${escapeAttr(t.templateId)}">${escapeHtml(t.name)}</option>`).join("");
  } catch (e) {
    select.innerHTML = '<option value="">Error loading templates</option>';
  }
}

function sessInsertFormatTemplate(id) {
  if (!_sessQuill) return;
  const tpl = SESS_FORMAT_TEMPLATES.find(t => t.id === id);
  if (!tpl) return;
  if (_sessQuill.getText().trim() && !confirm("Replace the current note with the " + tpl.label + " template?")) return;
  _sessQuill.setText("");
  _sessQuill.clipboard.dangerouslyPasteHTML(0, tpl.html);
  document.getElementById("sess-templateSelect").value = "";
}

function sessApplyTemplate() {
  if (!_sessQuill) return;
  const id = document.getElementById("sess-templateSelect").value;
  if (!id) return;
  const tpl = sessNoteTemplates.find(t => t.templateId === id);
  if (!tpl) return;
  if (_sessQuill.getText().trim() && !confirm("Replace the current note text with this template?")) return;
  _sessQuill.setText("");
  _sessQuill.clipboard.dangerouslyPasteHTML(0, tpl.text || "");
}

function sessCopyPrevious() {
  if (!_sessQuill || sessSessions.length === 0) {
    setStatus("sess-status", "No previous session notes to copy from.", "error");
    return;
  }
  if (_sessQuill.getText().trim() && !confirm("Replace the current note with the previous session's note?")) return;
  const prev = sessSessions[0].noteText || "";
  _sessQuill.setText("");
  _sessQuill.clipboard.dangerouslyPasteHTML(0, prev);
}

async function addSession() {
  const noteText = _sessQuill ? _sessQuill.root.innerHTML : "";
  const isBlank  = !_sessQuill || !_sessQuill.getText().trim();
  const localDateTime = document.getElementById("sess-dateTime").value;
  const localEndTime  = document.getElementById("sess-endTime").value;
  if (isBlank) {
    setStatus("sess-status", "Please enter note text.", "error");
    return;
  }
  if (!localDateTime) {
    setStatus("sess-status", "Please set a start time.", "error");
    return;
  }
  if (localEndTime && localEndTime < localDateTime) {
    setStatus("sess-status", "End time must be after start time.", "error");
    return;
  }
  const dateTime = localDateTime.replace("T", " ");
  const endTime  = localEndTime ? localEndTime.replace("T", " ") : "";
  setStatus("sess-status", "Saving…", "loading");
  try {
    const result = await apiCall("addSession", { noteText, dateTime, endTime });
    const msg = result.redacted
      ? "Session note saved. <strong>PHI was detected and redacted</strong> before storing. <i class='bi bi-shield-fill-check' style='color:#059669;'></i>"
      : "Session note saved.";
    setStatus("sess-status", msg, "success");
    if (_sessQuill) _sessQuill.setText("");
    document.getElementById("sess-templateSelect").value = "";
    document.querySelectorAll("#sess-goalsChecklist input:checked").forEach(cb => { cb.checked = false; });
    document.getElementById("sess-dateTime").value = sessNowForInput_();
    document.getElementById("sess-endTime").value = sessNowPlusMinutes_(30);
    loadSessions();
    sessShowPostSaveModal();
  } catch (e) {
    setStatus("sess-status", "Error: " + e.message, "error");
  }
}

async function sessShowPostSaveModal() {
  // Build modal skeleton immediately
  const modal = document.createElement("div");
  modal.id = "sess-post-save-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:16px;`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;max-width:480px;width:100%;
                box-shadow:0 20px 60px rgba(0,0,0,.35);position:relative;color:#111;">
    <style>
      @media (prefers-color-scheme:dark) { #sess-post-save-modal > div { background:#1e1e2e !important; color:#e5e7eb !important; } }
      :root[data-theme="dark"] #sess-post-save-modal > div { background:#1e1e2e !important; color:#e5e7eb !important; }
      :root[data-theme="light"] #sess-post-save-modal > div { background:#fff !important; color:#111 !important; }
    </style>
      <button onclick="document.getElementById('sess-post-save-modal').remove()"
              style="position:absolute;top:12px;right:12px;background:none;border:none;
                     font-size:20px;cursor:pointer;color:var(--muted);line-height:1;">×</button>
      <h2 style="margin:0 0 18px;font-size:17px;">
        <i class="bi bi-check-circle-fill" style="color:#059669;margin-right:8px;"></i>Note Saved
      </h2>

      <!-- Notify section -->
      <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:6px;">
          <i class="bi bi-envelope-fill" style="color:var(--primary);margin-right:6px;"></i>Notify Client
        </div>
        <p style="font-size:12px;color:var(--muted);margin:0 0 10px;">
          Send an email with a link to their portal (client ID pre-filled).
        </p>
        <div id="sess-notify-status" style="margin-bottom:8px;font-size:12px;"></div>
        <button id="sess-notify-btn" onclick="sessNotifyClient()" style="font-size:13px;">
          <i class="bi bi-send-fill"></i> Send Note Notification
        </button>
      </div>

      <!-- Next appointment section -->
      <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:10px;">
          <i class="bi bi-calendar-check-fill" style="color:var(--primary);margin-right:6px;"></i>Next Appointment
        </div>
        <div id="sess-next-appt">
          <p style="font-size:12px;color:var(--muted);margin:0;">Loading…</p>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });

  // Load next appointment
  try {
    const res    = await apiCall("getAppointments", {});
    const events = (res.events || []).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    const next   = events[0];
    const el     = document.getElementById("sess-next-appt");
    if (!el) return;
    if (next) {
      const start = new Date(next.start_time);
      const dateStr = start.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
      const timeStr = start.toLocaleTimeString(undefined, { hour:"numeric", minute:"2-digit" });
      el.innerHTML = `
        <div style="font-size:14px;font-weight:600;margin-bottom:2px;">${escapeHtml(next.name || "Appointment")}</div>
        <div style="font-size:12px;color:var(--muted);">${escapeHtml(dateStr)} at ${escapeHtml(timeStr)}</div>`;
    } else {
      el.innerHTML = sessQuickScheduleForm();
    }
  } catch(_) {
    const el = document.getElementById("sess-next-appt");
    if (el) el.innerHTML = sessQuickScheduleForm();
  }
}

function sessQuickScheduleForm() {
  // Default start = same time next week, end = +30 minutes
  const now   = new Date();
  now.setDate(now.getDate() + 7);
  now.setSeconds(0, 0);
  const end   = new Date(now.getTime() + 30 * 60 * 1000);
  const toLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const clientId = typeof getClientId === "function" ? getClientId() : "";
  return `
    <p style="font-size:12px;color:var(--muted);margin:0 0 10px;">No upcoming appointments. Schedule one now:</p>
    <div style="display:grid;gap:8px;">
      <input type="text" id="qsched-title" value="Session — ${escapeHtml(clientId)}"
             placeholder="Title" style="font-size:13px;" />
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <input type="datetime-local" id="qsched-start" value="${toLocal(now)}" onchange="sessSyncQuickEnd()" style="font-size:12px;" />
        <input type="datetime-local" id="qsched-end"   value="${toLocal(end)}"  style="font-size:12px;" />
      </div>
      <div id="qsched-status" style="font-size:12px;"></div>
      <button onclick="sessQuickSchedule()" style="font-size:13px;">
        <i class="bi bi-calendar-plus-fill"></i> Schedule
      </button>
    </div>`;
}

function sessSyncQuickEnd() {
  const startEl = document.getElementById("qsched-start");
  const endEl = document.getElementById("qsched-end");
  if (!startEl?.value || !endEl) return;
  const start = new Date(startEl.value);
  if (isNaN(start)) return;
  const end = new Date(start.getTime() + 30 * 60000);
  endEl.value = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

async function sessNotifyClient() {
  const btn = document.getElementById("sess-notify-btn");
  if (btn) btn.disabled = true;
  const statusEl = document.getElementById("sess-notify-status");
  if (statusEl) { statusEl.style.color = "var(--muted)"; statusEl.textContent = "Sending…"; }
  try {
    const res = await apiCall("notifyClientNewNote", {});
    if (statusEl) { statusEl.style.color = "#059669"; statusEl.textContent = `✓ Sent to ${res.sentTo}`; }
  } catch(e) {
    if (statusEl) { statusEl.style.color = "#dc2626"; statusEl.textContent = "Error: " + e.message; }
    if (btn) btn.disabled = false;
  }
}

async function sessQuickSchedule() {
  const title = document.getElementById("qsched-title")?.value?.trim();
  const start = document.getElementById("qsched-start")?.value;
  const end   = document.getElementById("qsched-end")?.value;
  const statusEl = document.getElementById("qsched-status");
  if (!title || !start || !end) {
    if (statusEl) { statusEl.style.color = "#dc2626"; statusEl.textContent = "All fields required."; }
    return;
  }
  if (statusEl) { statusEl.style.color = "var(--muted)"; statusEl.textContent = "Scheduling…"; }
  try {
    const res = await apiCall("createAppointment", {
      title,
      startTime: new Date(start).toISOString(),
      endTime:   new Date(end).toISOString(),
      sendSms: false
    });
    const apptEl = document.getElementById("sess-next-appt");
    if (apptEl) {
      const s = new Date(start);
      apptEl.innerHTML = `
        <div style="font-size:14px;font-weight:600;margin-bottom:2px;">${escapeHtml(title)}</div>
        <div style="font-size:12px;color:#059669;">
          <i class="bi bi-check-circle-fill"></i>
          Scheduled for ${s.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}
          at ${s.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}.
          ${res.clientEmail ? "Invite sent to " + escapeHtml(res.clientEmail) + "." : ""}
        </div>`;
    }
  } catch(e) {
    if (statusEl) { statusEl.style.color = "#dc2626"; statusEl.textContent = "Error: " + e.message; }
  }
}

// "1h 25m" / "45m" style display.
function sessFormatDuration(mins) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function deleteSession(sessionId) {
  if (!confirm("Delete this session note? This cannot be undone.")) return;
  try {
    await apiCall("deleteSession", { sessionId });
    loadSessions();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

function sessNoteCard(s, isProvider, timeOnly = false) {
  const start = timeOnly ? (s.dateTime || "").slice(11) : s.dateTime;
  const end = timeOnly ? (s.endTime || "").slice(11) : s.endTime;
  return `<article class="session-note-card">
    <div class="session-note-meta">
      <span><i class="bi bi-calendar3"></i> ${escapeHtml(start || "—")}</span>
      <span><i class="bi bi-clock"></i> ${escapeHtml(end || "—")}</span>
      <span><i class="bi bi-hourglass-split"></i> ${escapeHtml(sessFormatDuration(s.durationMin))}</span>
      <span><i class="bi bi-person-fill"></i> ${escapeHtml(s.assessor || "—")}</span>
      ${isProvider ? `<span class="session-note-actions">
        <button class="secondary" onclick="sessEditSession('${escapeAttr(s.sessionId)}')"><i class="bi bi-pencil-fill"></i> Edit</button>
        <button class="secondary" onclick="deleteSession('${escapeAttr(s.sessionId)}')"><i class="bi bi-trash3-fill"></i> Delete</button>
      </span>` : ""}
    </div>
    <div class="session-note-content note-text">${s.noteText || ""}</div>
  </article>`;
}

function sessEditSession(sessionId) {
  const session = sessSessions.find(s => String(s.sessionId) === String(sessionId));
  if (!session) return;
  document.getElementById("sess-edit-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "sess-edit-modal";
  modal.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.52);display:grid;place-items:center;padding:16px;";
  const toInput = value => String(value || "").replace(" ", "T").slice(0, 16);
  modal.innerHTML = `<div class="card" style="width:min(720px,100%);max-height:90vh;overflow:auto;margin:0;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;"><h2 style="margin:0;"><i class="bi bi-pencil-square"></i>Edit Session Note</h2><button class="secondary icon-btn" onclick="document.getElementById('sess-edit-modal').remove()"><i class="bi bi-x-lg"></i></button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;">
      <label style="text-transform:none;">Start<input id="sess-edit-start" type="datetime-local" value="${escapeAttr(toInput(session.dateTime))}"></label>
      <label style="text-transform:none;">End<input id="sess-edit-end" type="datetime-local" value="${escapeAttr(toInput(session.endTime))}"></label>
    </div>
    <label style="text-transform:none;">Note</label>
    <div id="sess-edit-note" contenteditable="true" style="min-height:220px;padding:14px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);line-height:1.65;">${session.noteText || ""}</div>
    <div id="sess-edit-status" style="margin-top:10px;"></div>
    <div class="btn-row" style="margin-top:12px;"><button onclick="sessSaveEdit('${escapeAttr(sessionId)}')"><i class="bi bi-save-fill"></i> Save Changes</button><button class="secondary" onclick="document.getElementById('sess-edit-modal').remove()">Cancel</button></div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
}

async function sessSaveEdit(sessionId) {
  const noteText = document.getElementById("sess-edit-note")?.innerHTML || "";
  const start = document.getElementById("sess-edit-start")?.value || "";
  const end = document.getElementById("sess-edit-end")?.value || "";
  if (!document.getElementById("sess-edit-note")?.innerText.trim()) { setStatus("sess-edit-status", "Note cannot be blank.", "error"); return; }
  if (!start || (end && end <= start)) { setStatus("sess-edit-status", "Enter a valid start and end time.", "error"); return; }
  setStatus("sess-edit-status", "Saving…", "loading");
  try {
    await apiCall("updateSession", { sessionId, noteText, dateTime:start.replace("T"," "), endTime:end ? end.replace("T"," ") : "" });
    document.getElementById("sess-edit-modal")?.remove();
    await loadSessions();
  } catch (e) { setStatus("sess-edit-status", "Error: " + e.message, "error"); }
}

function sessRenderView() {
  if (sessView === "list") sessRenderList();
  else sessRenderCalendar();
}

function sessRenderList() {
  const isProvider = getRole() === "provider";
  const body = document.getElementById("sess-viewBody");

  const NOTE_TYPE_LABEL = { "parent-only": "Parent-Only", "child-only": "Child-Only", "parent+child": "Parent + Child", "graduation": "Graduation" };
  const NOTE_TYPE_COLOR = { "parent-only": "#3b82f6", "child-only": "#8b5cf6", "parent+child": "#059669", "graduation": "#f59e0b" };

  const progNotesHtml = sessProgramNotes.length ? `
    <div style="margin-top:20px;">
      <h3 style="margin:0 0 10px;font-size:15px;"><i class="bi bi-calendar2-week-fill"></i> Program Session Notes</h3>
      <table class="summary-table">
        <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Title</th><th>Notes</th></tr></thead>
        <tbody>
          ${sessProgramNotes.map(n => {
            const color = NOTE_TYPE_COLOR[n.sessionType] || "#6b7280";
            const label = NOTE_TYPE_LABEL[n.sessionType] || n.sessionType;
            const fields = n.fields || {};
            const fieldSummary = Object.values(fields).filter(Boolean).join(" · ").slice(0, 120);
            return `<tr>
              <td style="font-weight:700;">${n.sessionNum}</td>
              <td>${escapeHtml((n.recordedAt || "").slice(0, 10))}</td>
              <td><span style="font-size:11px;font-weight:700;background:${color}22;color:${color};padding:2px 7px;border-radius:8px;">${escapeHtml(label)}</span></td>
              <td>${escapeHtml(n.title || "")}</td>
              <td class="note-text" style="font-size:12px;color:var(--muted);">${escapeHtml(fieldSummary)}${fieldSummary.length >= 120 ? "…" : ""}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : "";

  if (sessSessions.length === 0 && sessProgramNotes.length === 0) {
    body.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No session notes on file yet.</span></div>';
    return;
  }

  body.innerHTML = `
    ${sessSessions.length ? `<div class="session-note-grid">${sessSessions.map(s => sessNoteCard(s, isProvider)).join("")}</div>` : ""}
    ${progNotesHtml}
  `;
}

function sessRenderCalendar() {
  const body = document.getElementById("sess-viewBody");
  const isProvider = getRole() === "provider";
  const year = sessCalDate.getFullYear();
  const month = sessCalDate.getMonth();
  const monthLabel = sessCalDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const byDay = {};
  let monthMinutes = 0;
  let monthSessionCount = 0;
  sessSessions.forEach(s => {
    const day = (s.dateTime || "").slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(s);
    const [y, m] = day.split("-").map(Number);
    if (y === year && (m - 1) === month) {
      monthSessionCount++;
      if (s.durationMin != null) monthMinutes += s.durationMin;
    }
  });

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = todayLocalKey_();

  // Index client program notes by date
  const clientNotesByDay = {};
  sessProgramNotes.forEach(n => {
    const key = (n.recordedAt || "").slice(0, 10);
    if (!key) return;
    if (!clientNotesByDay[key]) clientNotesByDay[key] = [];
    clientNotesByDay[key].push(n);
  });

  let cells = "";
  for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const count = (byDay[key] || []).length;
    const progItems = sessProgByDay[key] || [];
    const clientNotes = clientNotesByDay[key] || [];
    const classes = ["cal-cell"];
    if (count > 0) classes.push("has-sessions");
    if (progItems.length > 0 || clientNotes.length > 0) classes.push("has-prog");
    if (key === todayKey) classes.push("today");
    if (key === sessSelectedDay) classes.push("selected");
    const progBadges = progItems.map(p =>
      `<span class="cal-badge prog-badge" data-tooltip="${escapeHtml(p.programName + " · " + p.title)}">
        <i class="bi bi-play-circle-fill"></i>
      </span>`
    ).join("");
    const clientBadges = clientNotes.map(n =>
      `<span class="cal-badge" style="background:#dbeafe;color:#1e40af;" data-tooltip="${escapeHtml("Session " + n.sessionNum + ": " + (n.title || ""))}">
        <i class="bi bi-calendar2-week-fill"></i>
      </span>`
    ).join("");
    cells += `<div class="${classes.join(" ")}" ${count > 0 || progItems.length > 0 || clientNotes.length > 0 ? `onclick="sessSelectDay('${key}')"` : ""}>
      <div class="cal-day-num">${d}</div>
      <div class="cal-badges">
        ${count > 0 ? `<span class="cal-badge sess-badge">${count}</span>` : ""}
        ${progBadges}
        ${clientBadges}
      </div>
    </div>`;
  }

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  body.innerHTML = `
    <div class="cal-header no-print">
      <button class="secondary icon-btn" onclick="sessCalStep(-1)"><i class="bi bi-chevron-left"></i></button>
      <h3>${monthLabel}</h3>
      <button class="secondary icon-btn" onclick="sessCalStep(1)"><i class="bi bi-chevron-right"></i></button>
    </div>
    <div class="stat-grid">
      ${statCard("calendar2-week", "Sessions This Month", monthSessionCount)}
      ${statCard("hourglass-split", "Total Time This Month", sessFormatDuration(monthMinutes))}
    </div>
    <div class="cal-grid">
      ${dow.map(d => `<div class="cal-dow">${d}</div>`).join("")}
      ${cells}
    </div>
    <div id="sess-dayDetail" style="margin-top:18px;"></div>
  `;

  if (sessSelectedDay && byDay[sessSelectedDay]) {
    sessRenderDayDetail(sessSelectedDay, byDay[sessSelectedDay], isProvider);
  }
}

function todayLocalKey_() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sessSelectDay(key) {
  sessSelectedDay = sessSelectedDay === key ? null : key;
  sessRenderCalendar();
}

function sessRenderDayDetail(key, sessions, isProvider) {
  const el = document.getElementById("sess-dayDetail");
  if (!el) return;
  const dayNotes = sessProgramNotes.filter(n => (n.recordedAt || "").slice(0, 10) === key);
  const NOTE_TYPE_LABEL = { "parent-only": "Parent-Only", "child-only": "Child-Only", "parent+child": "Parent + Child", "graduation": "Graduation" };
  const NOTE_TYPE_COLOR = { "parent-only": "#3b82f6", "child-only": "#8b5cf6", "parent+child": "#059669", "graduation": "#f59e0b" };
  el.innerHTML = `
    <div class="section-title"><h3><i class="bi bi-calendar-event"></i> ${escapeHtml(key)}</h3></div>
    ${sessions.length ? `<div class="session-note-grid">${sessions.map(s => sessNoteCard(s, isProvider, true)).join("")}</div>` : ""}
    ${dayNotes.length ? `
      <h4 style="margin:14px 0 8px;font-size:13px;"><i class="bi bi-calendar2-week-fill"></i> Program Notes</h4>
      ${dayNotes.map(n => {
        const color = NOTE_TYPE_COLOR[n.sessionType] || "#6b7280";
        const label = NOTE_TYPE_LABEL[n.sessionType] || n.sessionType;
        const fields = n.fields || {};
        return `<div style="padding:12px 14px;background:var(--surface);border-radius:8px;border:1.5px solid var(--border);margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:700;background:${color}22;color:${color};padding:2px 8px;border-radius:8px;">${escapeHtml(label)}</span>
            <span style="font-size:13px;font-weight:600;">Session ${n.sessionNum}: ${escapeHtml(n.title || "")}</span>
          </div>
          ${Object.entries(fields).filter(([k, v]) => v && !k.startsWith("_")).map(([k, v]) => `
            <div style="margin-bottom:6px;">
              <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(k.replace(/_/g," "))}</div>
              <div style="font-size:13px;margin-top:2px;line-height:1.6;">${v}</div>
            </div>`).join("")}
        </div>`;
      }).join("")}` : ""}
  `;
}

function sessCalStep(dir) {
  sessCalDate = new Date(sessCalDate.getFullYear(), sessCalDate.getMonth() + dir, 1);
  sessSelectedDay = null;
  sessRenderCalendar();
}

// ── PHI Audit Log ─────────────────────────────────────────────────────────────

let _auditLoaded = false;

function sessToggleAuditLog() {
  const body    = document.getElementById("sess-audit-body");
  const chevron = document.getElementById("sess-audit-chevron");
  const open    = body.style.display === "none";
  body.style.display    = open ? "block" : "none";
  chevron.className     = open ? "bi bi-chevron-up" : "bi bi-chevron-down";
  if (open && !_auditLoaded) { _auditLoaded = true; sessLoadAuditLog(); }
}

async function sessLoadAuditLog() {
  const el = document.getElementById("sess-audit-content");
  try {
    const { entries } = await apiCall("getPhiAuditLog", {});
    if (!entries.length) {
      el.innerHTML = `<p style="color:var(--muted);font-size:14px;">No PHI redactions recorded for this client yet.</p>`;
      return;
    }
    const ACTION_LABEL = { addSession: "Quick session note", addSessionNote: "Program session note" };
    el.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Field</th>
              <th>PHI Types Found</th>
              <th>Chars (before → after)</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td style="white-space:nowrap;">${escapeHtml(e.timestamp)}</td>
                <td>${escapeHtml(ACTION_LABEL[e.action] || e.action)}</td>
                <td style="font-size:12px;color:var(--muted);">${escapeHtml(e.fieldKey.replace(/_/g," "))}</td>
                <td>
                  ${e.phiTypesFound.split(", ").map(t =>
                    `<span style="display:inline-block;background:#fee2e2;color:#991b1b;font-size:11px;
                      font-weight:700;padding:1px 7px;border-radius:8px;margin:1px 3px 1px 0;">
                      <i class="bi bi-shield-fill-exclamation"></i> ${escapeHtml(t)}
                    </span>`
                  ).join("")}
                </td>
                <td style="font-size:12px;color:var(--muted);">${e.originalChars} → ${e.redactedChars}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load audit log: ${escapeHtml(err.message)}</span></div>`;
  }
}
