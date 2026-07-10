// Session Notes section — providers add/delete dated notes; parents view
// only (enforced server-side too, in Code.gs addSession_/deleteSession_).
// Date/time is always set by the server to "now" at save time, never typed.

let sessSessions = [];
let sessNoteTemplates = [];
let sessGoals = [];
let sessProgramNotes = []; // from client program (data_session_notes)
let sessView = "list"; // "list" | "calendar"
let sessCalDate = new Date(); // current month being viewed in calendar mode
let sessSelectedDay = null; // "YYYY-MM-DD" of the day expanded in calendar mode
let sessProgByDay = {}; // "YYYY-MM-DD" -> [{stepNum, title, programName}]
let _sessQuill = null;

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
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-journal-text"></i>Session Notes</h1>
      <div class="btn-row no-print">
        <button id="sess-tab-list" onclick="sessSwitchView('list')">List</button>
        <button id="sess-tab-cal" class="secondary" onclick="sessSwitchView('calendar')">Calendar</button>
      </div>
      <div id="sess-viewBody" style="margin-top:16px;">Loading...</div>
    </div>

    ${isProvider ? `
    <div class="card">
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

  // Remove existing goals block (first element with data attr, if present)
  const editor = _sessQuill.root;
  const existing = editor.querySelector("[data-goals-block]");
  if (existing) existing.remove();

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
  } catch (e) {
    setStatus("sess-status", "Error: " + e.message, "error");
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
    ${sessSessions.length ? `<table class="summary-table">
      <thead><tr><th>Start</th><th>End</th><th>Duration</th><th>Assessor</th><th>Note</th>${isProvider ? "<th></th>" : ""}</tr></thead>
      <tbody>
        ${sessSessions.map(s => `<tr>
          <td>${escapeHtml(s.dateTime)}</td>
          <td>${escapeHtml(s.endTime || "—")}</td>
          <td>${sessFormatDuration(s.durationMin)}</td>
          <td>${escapeHtml(s.assessor)}</td>
          <td class="note-text" style="max-width:340px;">${s.noteText || ""}</td>
          ${isProvider ? `<td><button class="secondary" onclick="deleteSession('${escapeAttr(s.sessionId)}')"><i class="bi bi-trash3-fill"></i></button></td>` : ""}
        </tr>`).join("")}
      </tbody>
    </table>` : ""}
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
    ${sessions.length ? `<table class="summary-table">
      <thead><tr><th>Start</th><th>End</th><th>Duration</th><th>Assessor</th><th>Note</th>${isProvider ? "<th></th>" : ""}</tr></thead>
      <tbody>
        ${sessions.map(s => `<tr>
          <td>${escapeHtml((s.dateTime || "").slice(11))}</td>
          <td>${escapeHtml((s.endTime || "").slice(11) || "—")}</td>
          <td>${sessFormatDuration(s.durationMin)}</td>
          <td>${escapeHtml(s.assessor)}</td>
          <td class="note-text" style="max-width:340px;">${s.noteText || ""}</td>
          ${isProvider ? `<td><button class="secondary" onclick="deleteSession('${escapeAttr(s.sessionId)}')"><i class="bi bi-trash3-fill"></i></button></td>` : ""}
        </tr>`).join("")}
      </tbody>
    </table>` : ""}
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
