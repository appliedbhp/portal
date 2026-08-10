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
  // Default start = next hour, end = +1h
  const now   = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const end   = new Date(now.getTime() + 60 * 60 * 1000);
  const toLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const clientId = typeof getClientId === "function" ? getClientId() : "";
  return `
    <p style="font-size:12px;color:var(--muted);margin:0 0 10px;">No upcoming appointments. Schedule one now:</p>
    <div style="display:grid;gap:8px;">
      <input type="text" id="qsched-title" value="Session — ${escapeHtml(clientId)}"
             placeholder="Title" style="font-size:13px;" />
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <input type="datetime-local" id="qsched-start" value="${toLocal(now)}" style="font-size:12px;" />
        <input type="datetime-local" id="qsched-end"   value="${toLocal(end)}"  style="font-size:12px;" />
      </div>
      <div id="qsched-status" style="font-size:12px;"></div>
      <button onclick="sessQuickSchedule()" style="font-size:13px;">
        <i class="bi bi-calendar-plus-fill"></i> Schedule
      </button>
    </div>`;
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
