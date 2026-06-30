// Session Notes section — providers add/delete dated notes; parents view
// only (enforced server-side too, in Code.gs addSession_/deleteSession_).
// Date/time is always set by the server to "now" at save time, never typed.

let sessSessions = [];
let sessNoteTemplates = [];
let sessView = "list"; // "list" | "calendar"
let sessCalDate = new Date(); // current month being viewed in calendar mode
let sessSelectedDay = null; // "YYYY-MM-DD" of the day expanded in calendar mode

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
        <label>Note</label>
        <textarea id="sess-noteText" style="min-height:160px;" placeholder="Session note..."></textarea>
      </div>
      <div class="field-hint"><i class="bi bi-clock-fill"></i> Date/time will be recorded automatically as the current date and time when you save.</div>
      <button onclick="addSession()"><i class="bi bi-save-fill"></i> Save Session Note</button>
      <div id="sess-status"></div>
    </div>
    ` : ""}
  `;
  loadSessions();
  if (isProvider) loadNoteTemplates();
}

function sessSwitchView(view) {
  sessView = view;
  document.getElementById("sess-tab-list").className = view === "list" ? "" : "secondary";
  document.getElementById("sess-tab-cal").className = view === "calendar" ? "" : "secondary";
  sessRenderView();
}

async function loadSessions() {
  try {
    const { sessions } = await apiCall("getSessions", {});
    sessSessions = sessions;
    sessRenderView();
  } catch (e) {
    document.getElementById("sess-viewBody").innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Error: ${escapeHtml(e.message)}</span></div>`;
  }
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
  if (!noteText) {
    setStatus("sess-status", "Please enter note text.", "error");
    return;
  }
  setStatus("sess-status", "Saving...", "loading");
  try {
    await apiCall("addSession", { noteText });
    setStatus("sess-status", "Session note saved.", "success");
    document.getElementById("sess-noteText").value = "";
    document.getElementById("sess-templateSelect").value = "";
    loadSessions();
  } catch (e) {
    setStatus("sess-status", "Error: " + e.message, "error");
  }
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
  if (sessSessions.length === 0) {
    body.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No session notes on file yet.</span></div>';
    return;
  }
  body.innerHTML = `
    <table class="summary-table">
      <thead><tr><th>Date/Time</th><th>Assessor</th><th>Note</th>${isProvider ? "<th></th>" : ""}</tr></thead>
      <tbody>
        ${sessSessions.map(s => `<tr>
          <td>${escapeHtml(s.dateTime)}</td>
          <td>${escapeHtml(s.assessor)}</td>
          <td class="note-text">${escapeHtml(s.noteText)}</td>
          ${isProvider ? `<td><button class="secondary" onclick="deleteSession('${escapeAttr(s.sessionId)}')"><i class="bi bi-trash3-fill"></i></button></td>` : ""}
        </tr>`).join("")}
      </tbody>
    </table>
  `;
}

function sessRenderCalendar() {
  const body = document.getElementById("sess-viewBody");
  const isProvider = getRole() === "provider";
  const year = sessCalDate.getFullYear();
  const month = sessCalDate.getMonth();
  const monthLabel = sessCalDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const byDay = {};
  sessSessions.forEach(s => {
    const day = (s.dateTime || "").slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(s);
  });

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = todayLocalKey_();

  let cells = "";
  for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const count = (byDay[key] || []).length;
    const classes = ["cal-cell"];
    if (count > 0) classes.push("has-sessions");
    if (key === todayKey) classes.push("today");
    if (key === sessSelectedDay) classes.push("selected");
    cells += `<div class="${classes.join(" ")}" ${count > 0 ? `onclick="sessSelectDay('${key}')"` : ""}>
      <div class="cal-day-num">${d}</div>
      ${count > 0 ? `<span class="cal-badge">${count}</span>` : ""}
    </div>`;
  }

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  body.innerHTML = `
    <div class="cal-header no-print">
      <button class="secondary icon-btn" onclick="sessCalStep(-1)"><i class="bi bi-chevron-left"></i></button>
      <h3>${monthLabel}</h3>
      <button class="secondary icon-btn" onclick="sessCalStep(1)"><i class="bi bi-chevron-right"></i></button>
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
  el.innerHTML = `
    <div class="section-title"><h3><i class="bi bi-calendar-event"></i> ${escapeHtml(key)}</h3></div>
    <table class="summary-table">
      <thead><tr><th>Time</th><th>Assessor</th><th>Note</th>${isProvider ? "<th></th>" : ""}</tr></thead>
      <tbody>
        ${sessions.map(s => `<tr>
          <td>${escapeHtml((s.dateTime || "").slice(11))}</td>
          <td>${escapeHtml(s.assessor)}</td>
          <td class="note-text">${escapeHtml(s.noteText)}</td>
          ${isProvider ? `<td><button class="secondary" onclick="deleteSession('${escapeAttr(s.sessionId)}')"><i class="bi bi-trash3-fill"></i></button></td>` : ""}
        </tr>`).join("")}
      </tbody>
    </table>
  `;
}

function sessCalStep(dir) {
  sessCalDate = new Date(sessCalDate.getFullYear(), sessCalDate.getMonth() + dir, 1);
  sessSelectedDay = null;
  sessRenderCalendar();
}
