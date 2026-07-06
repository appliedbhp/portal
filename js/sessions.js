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

const GOALS_BLOCK_HEADING = "Goals Addressed This Session:";

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
      <div class="row">
        <label>Start from Template</label>
        <select id="sess-templateSelect" style="max-width:520px;" onchange="sessApplyTemplate()">
          <option value="">— None —</option>
        </select>
      </div>
      <div class="btn-row" style="margin-bottom:10px;">
        <button class="secondary" onclick="sessCopyPrevious()"><i class="bi bi-clipboard-fill"></i> Copy from Previous Session</button>
      </div>
      <div class="row">
        <label>Goals Addressed This Session</label>
        <div id="sess-goalsChecklist">Loading goals...</div>
      </div>
      <div class="row">
        <label>Note</label>
        <textarea id="sess-noteText" style="min-height:160px;" placeholder="Session note..."></textarea>
      </div>
      <div class="row">
        <label>Start Time</label>
        <input id="sess-dateTime" type="datetime-local">
      </div>
      <div class="row">
        <label>End Time</label>
        <input id="sess-endTime" type="datetime-local">
      </div>
      <div class="field-hint"><i class="bi bi-clock-fill"></i> Start is pre-filled with right now; set an end time to record session duration. Both are editable.</div>
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

// Keeps a "Goals Addressed This Session:" block in sync with whichever
// checkboxes are checked, without disturbing the rest of the note text.
// The block always lives at the very top of the textarea.
function sessSyncGoalsBlock() {
  const box = document.getElementById("sess-noteText");
  const checked = Array.from(document.querySelectorAll("#sess-goalsChecklist input:checked")).map(cb => cb.dataset.objective);

  const blockRe = new RegExp(`^${GOALS_BLOCK_HEADING}\\n(?:- .*\\n)*\\n?`);
  const rest = box.value.replace(blockRe, "");

  if (checked.length === 0) {
    box.value = rest;
    return;
  }
  const block = `${GOALS_BLOCK_HEADING}\n${checked.map(o => `- ${o}`).join("\n")}\n\n`;
  box.value = block + rest;
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

function sessApplyTemplate() {
  const id = document.getElementById("sess-templateSelect").value;
  if (!id) return;
  const tpl = sessNoteTemplates.find(t => t.templateId === id);
  if (!tpl) return;
  const box = document.getElementById("sess-noteText");
  if (box.value.trim() && !confirm("Replace the current note text with this template?")) return;
  box.value = tpl.text || "";
}

function sessCopyPrevious() {
  if (sessSessions.length === 0) {
    setStatus("sess-status", "No previous session notes to copy from.", "error");
    return;
  }
  const box = document.getElementById("sess-noteText");
  if (box.value.trim() && !confirm("Replace the current note text with the previous session's note?")) return;
  box.value = sessSessions[0].noteText || ""; // sessSessions is sorted newest-first
}

async function addSession() {
  const noteText = document.getElementById("sess-noteText").value.trim();
  const localDateTime = document.getElementById("sess-dateTime").value; // "YYYY-MM-DDTHH:mm"
  const localEndTime = document.getElementById("sess-endTime").value;
  if (!noteText) {
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
  const endTime = localEndTime ? localEndTime.replace("T", " ") : "";
  setStatus("sess-status", "Saving…", "loading");
  try {
    const result = await apiCall("addSession", { noteText, dateTime, endTime });
    const msg = result.redacted
      ? "Session note saved. <strong>PHI was detected and redacted</strong> before storing. <i class='bi bi-shield-fill-check' style='color:#059669;'></i>"
      : "Session note saved.";
    setStatus("sess-status", msg, "success");
    document.getElementById("sess-noteText").value = "";
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
          <td class="note-text">${escapeHtml(s.noteText)}</td>
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
          <td class="note-text">${escapeHtml(s.noteText)}</td>
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
          ${Object.entries(fields).filter(([,v]) => v).map(([k, v]) => `
            <div style="margin-bottom:6px;">
              <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(k.replace(/_/g," "))}</div>
              <div style="font-size:13px;margin-top:2px;">${escapeHtml(v)}</div>
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
