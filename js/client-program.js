// Client Program section — provider-only.
// Tracks the activated session plan: shows each session, allows logging notes
// using generic templates per session type.

// ── US Federal Holiday projection ──────────────────────────────────────────

function _cpNthWeekday(year, month, weekday, n) {
  let d = new Date(year, month, 1), count = 0;
  while (d.getMonth() === month) {
    if (d.getDay() === weekday && ++count === n) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return null;
}
function _cpLastWeekday(year, month, weekday) {
  let d = new Date(year, month + 1, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return new Date(d);
}
function _cpObserved(d) {
  const day = d.getDay();
  if (day === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  if (day === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return new Date(d);
}
function cpFederalHolidays(year) {
  return [
    { date: _cpObserved(new Date(year, 0,  1)),  name: "New Year's Day" },
    { date: _cpNthWeekday(year, 0, 1, 3),        name: "MLK Jr. Day" },
    { date: _cpNthWeekday(year, 1, 1, 3),        name: "Presidents' Day" },
    { date: _cpLastWeekday(year, 4, 1),           name: "Memorial Day" },
    { date: _cpObserved(new Date(year, 5, 19)),  name: "Juneteenth" },
    { date: _cpObserved(new Date(year, 6,  4)),  name: "Independence Day" },
    { date: _cpNthWeekday(year, 8, 1, 1),        name: "Labor Day" },
    { date: _cpNthWeekday(year, 9, 1, 2),        name: "Columbus Day" },
    { date: _cpObserved(new Date(year, 10, 11)), name: "Veterans Day" },
    { date: _cpNthWeekday(year, 10, 4, 4),       name: "Thanksgiving Day" },
    { date: _cpObserved(new Date(year, 11, 25)), name: "Christmas Day" },
  ].filter(h => h.date !== null);
}

// Returns [{weekStart, weekEnd, holidays[], projectedLabel, status}] per week.
// status: "completed" | "current" | "upcoming" | "overdue" | "holiday-delay"
function cpProjectWeeks(startDateStr, numWeeks, noteMap) {
  if (!startDateStr) return Array.from({ length: numWeeks }, () => ({ projectedLabel: "—", holidays: [], status: "upcoming" }));
  const start = cpParseDate_(startDateStr);
  if (!start) return Array.from({ length: numWeeks }, () => ({ projectedLabel: "—", holidays: [], status: "upcoming" }));

  const endYear = new Date(start.getTime() + numWeeks * 7 * 86400000).getFullYear();
  const allHolidays = [];
  for (let y = start.getFullYear(); y <= endYear; y++) allHolidays.push(...cpFederalHolidays(y));

  const today = new Date(); today.setHours(0,0,0,0);
  const fmt = d => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Accumulate offset days from holidays in prior weeks
  let extraDays = 0;
  return Array.from({ length: numWeeks }, (_, i) => {
    const ws = new Date(start.getTime() + (i * 7 + extraDays) * 86400000);
    const we = new Date(ws.getTime() + 6 * 86400000);
    const weekHols = allHolidays.filter(h => h.date >= ws && h.date <= we);
    if (weekHols.length) extraDays += 7; // push subsequent weeks by a week per holiday week

    const projectedLabel = fmt(ws) + " – " + fmt(we);

    // Determine status
    const sessNumsThisWeek = Object.keys(noteMap)
      .filter(sn => noteMap[sn])
      .map(Number);
    // We check if any session assigned to this week index is logged
    const weekIndex = i + 1;
    const noteLogged = noteMap[weekIndex] !== undefined;

    let status;
    if (noteLogged) {
      status = "completed";
    } else if (weekHols.length) {
      status = "holiday-delay";
    } else if (today > we) {
      status = "overdue";
    } else if (today >= ws && today <= we) {
      status = "current";
    } else {
      status = "upcoming";
    }

    return { weekStart: ws, weekEnd: we, holidays: weekHols, projectedLabel, status };
  });
}

const NOTE_TEMPLATES = {
  "parent-only": [
    { key: "check_in",     label: "Parent Check-In",          placeholder: "How has the week gone? What's working, what isn't?" },
    { key: "concerns",     label: "Current Concerns",         placeholder: "Any new behaviors or situations to flag?" },
    { key: "skills_reviewed", label: "Skills / Topics Covered", placeholder: "What was discussed or practiced today?" },
    { key: "parent_insight", label: "Parent Insights",        placeholder: "What resonated? Any questions raised?" },
    { key: "homework",     label: "Parent Homework",          placeholder: "What will the parent try at home before next session?" }
  ],
  "child-only": [
    { key: "rapport",      label: "Rapport / Check-In",       placeholder: "How is the child doing today? Mood, energy, openness?" },
    { key: "skill",        label: "Skill Introduced / Practiced", placeholder: "What skill or strategy was taught today?" },
    { key: "response",     label: "Child Response",           placeholder: "How did the child engage? What clicked? What was hard?" },
    { key: "activity",     label: "Practice Activity",        placeholder: "What activity or game was used to practice the skill?" },
    { key: "next_session", label: "Plan for Next Session",    placeholder: "What will be built on or introduced next time?" }
  ],
  "parent+child": [
    { key: "family_checkin", label: "Family Check-In",        placeholder: "How is the family doing? Any wins or friction points?" },
    { key: "goal_review",  label: "Shared Goal Review",       placeholder: "What goal(s) did the family discuss together?" },
    { key: "skill_demo",   label: "Skill Demo / Practice",    placeholder: "What skill was modeled or practiced with both present?" },
    { key: "coaching",     label: "Parent Coaching Moment",   placeholder: "What coaching did the parent receive during the session?" },
    { key: "family_hw",    label: "Family Homework",          placeholder: "What will the family practice together before next session?" }
  ],
  "graduation": [
    { key: "progress_summary", label: "Progress Summary",     placeholder: "What growth was made across the program?" },
    { key: "goals_met",    label: "Goals Met",                placeholder: "Which goals were achieved? What evidence exists?" },
    { key: "celebration",  label: "Celebration Notes",        placeholder: "How did the family celebrate? What stood out?" },
    { key: "transition",   label: "Transition Plan",          placeholder: "What support, referrals, or next steps are recommended?" }
  ]
};

function noteTemplateFor(type) {
  return NOTE_TEMPLATES[type] || NOTE_TEMPLATES["child-only"];
}

// Parse a date string safely — handles YYYY-MM-DD, sheet-serialized Date strings, and slashes
function cpParseDate_(str) {
  if (!str) return null;
  // Extract YYYY-MM-DD if present anywhere in the string
  const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(iso[0] + "T00:00:00");
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function initClientProgramSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading program…</p></div>`;
  loadClientProgram(root);
}

async function loadClientProgram(root) {
  try {
    const [{ program }, { notes }, goalsRes, schedRes] = await Promise.all([
      apiCall("getClientProgram", {}),
      apiCall("getSessionNotes", {}),
      apiCall("getPlan", {}).catch(() => ({ goals: [] })),
      apiCall("getScheduledSessions", {}).catch(() => ({ schedule: [] }))
    ]);
    renderClientProgram(root, program, notes || [], goalsRes.goals || [], schedRes.schedule || []);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load program: ${escapeHtml(e.message)}</span></div></div>`;
  }
}

function renderClientProgram(root, program, notes, goals, schedule) {
  if (!program || !program.sessionPlan) {
    root.innerHTML = `
      <div class="card">
        <h1><i class="bi bi-calendar2-week-fill"></i>Client Program</h1>
        <p style="color:var(--muted);font-size:14px;line-height:1.6;">
          No active program found. Generate an Assessment Report and activate the session plan from the Reports section.
        </p>
      </div>`;
    return;
  }

  const sp      = program.sessionPlan;
  const noteMap = {};
  notes.forEach(n => { noteMap[n.sessionNum] = n; });
  const schedMap = {};
  (schedule || []).forEach(s => { schedMap[s.sessionNum] = s; });

  const totalSessions  = (sp.weeks || []).reduce((sum, w) => sum + (w.sessions || []).length, 0);
  const completedCount = notes.length;
  const scheduledCount = Object.keys(schedMap).length;

  // Projected completion date
  let projectedEnd = "—";
  const startDateObj = cpParseDate_(program.startDate);
  if (startDateObj && sp.weeks) {
    const numWeeks = sp.weeks.length;
    const endDate  = new Date(startDateObj.getTime() + numWeeks * 7 * 86400000);
    projectedEnd = endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // On-track: compare sessions logged vs sessions expected at this point
  let onTrackHtml = "";
  if (startDateObj && totalSessions > 0) {
    const startMs     = startDateObj.getTime();
    const elapsedDays = Math.max(0, (Date.now() - startMs) / 86400000);
    const totalDays   = (sp.weeks || []).length * 7;
    const expectedPct = Math.min(elapsedDays / totalDays, 1);
    const expectedSess = Math.round(expectedPct * totalSessions);
    if (completedCount >= expectedSess) {
      onTrackHtml = `<span style="font-size:12px;font-weight:700;background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:10px;">
        <i class="bi bi-check-circle-fill"></i> On Track</span>`;
    } else {
      const behind = expectedSess - completedCount;
      onTrackHtml = `<span style="font-size:12px;font-weight:700;background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:10px;">
        <i class="bi bi-exclamation-triangle-fill"></i> ${behind} session${behind > 1 ? "s" : ""} behind</span>`;
    }
  }

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <h1 style="margin:0;"><i class="bi bi-calendar2-week-fill"></i> Client Program</h1>
        <button class="secondary no-print" onclick="printClientProgram()" style="flex-shrink:0;">
          <i class="bi bi-printer-fill"></i> Print / Save PDF
        </button>
      </div>
      <div class="stat-row" style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0;">
        ${statCard("calendar-check-fill", "Model", escapeHtml(sp.model || "—"))}
        ${statCard("list-ol", "Sessions", completedCount + " / " + totalSessions + " logged")}
        ${statCard("calendar2-date", "Scheduled", scheduledCount + " / " + totalSessions + " scheduled")}
        ${statCard("calendar-event", "Started", escapeHtml(program.startDate || "Not set"))}
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:${sp.model_rationale ? "10px" : "0"};">
        <span style="font-size:13px;color:var(--muted);"><i class="bi bi-flag-fill" style="color:var(--primary);"></i> Projected completion: <strong>${escapeHtml(projectedEnd)}</strong></span>
        ${onTrackHtml}
      </div>
      ${sp.model_rationale ? `<p style="font-size:13px;color:var(--muted);margin:0;font-style:italic;">${escapeHtml(sp.model_rationale)}</p>` : ""}
    </div>
    <div id="program-weeks"></div>
    <div id="note-modal-area"></div>
    <div id="schedule-modal-area"></div>`;

  const weeksEl = root.querySelector("#program-weeks");
  const projections = cpProjectWeeks(program.startDate, (sp.weeks || []).length, noteMap);
  const STATUS_STYLE = {
    completed:     "background:#d1fae5;color:#065f46;",
    current:       "background:#dbeafe;color:#1e40af;",
    overdue:       "background:#fee2e2;color:#991b1b;",
    "holiday-delay": "background:#fef3c7;color:#92400e;",
    upcoming:      "background:#f3f4f6;color:#374151;"
  };
  const STATUS_LABEL = {
    completed: "Complete", current: "In Progress", overdue: "Overdue",
    "holiday-delay": "Holiday Week", upcoming: "Upcoming"
  };

  (sp.weeks || []).forEach((wk, wi) => {
    const proj = projections[wi] || {};
    const wkCard = document.createElement("div");
    wkCard.className = "card";
    wkCard.style.marginBottom = "12px";

    const statusStyle = STATUS_STYLE[proj.status] || STATUS_STYLE.upcoming;
    const statusLabel = STATUS_LABEL[proj.status] || "";
    const holHtml = (proj.holidays || []).map(h =>
      `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:8px;margin-left:6px;">
        <i class="bi bi-calendar-x-fill"></i> ${escapeHtml(h.name)}
      </span>`
    ).join("");

    wkCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:6px;">
        <div>
          <span style="font-weight:700;font-size:15px;">Week ${wk.week} — ${escapeHtml(wk.phase || "")}</span>
          <span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;${statusStyle}">${statusLabel}</span>
          ${holHtml}
        </div>
        <div style="font-size:12px;color:var(--muted);text-align:right;">
          <i class="bi bi-calendar3"></i> ${escapeHtml(proj.projectedLabel || "—")}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${(wk.sessions || []).map(sess => {
          const done      = !!noteMap[sess.session_num];
          const scheduled = schedMap[sess.session_num];
          const TYPE_COLOR = { "parent-only":"#3b82f6", "child-only":"#8b5cf6", "parent+child":"#059669", "graduation":"#f59e0b" };
          const TYPE_MAP   = { "parent-only":"Parent-Only", "child-only":"Child-Only", "parent+child":"Parent + Child", "graduation":"Graduation" };
          const color = TYPE_COLOR[sess.type] || "#6b7280";

          // Format scheduled date nicely
          const schedDateObj = scheduled ? cpParseDate_(scheduled.scheduledDate) : null;
          const schedBadge = schedDateObj
            ? `<span style="font-size:11px;background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:10px;font-weight:600;">
                <i class="bi bi-calendar-check"></i> ${escapeHtml(schedDateObj.toLocaleDateString(undefined, { month:"short", day:"numeric" }))}
               </span>`
            : "";

          return `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;
                        padding:12px 14px;border-radius:8px;
                        border:1.5px solid ${done ? "#bbf7d0" : "var(--border)"};
                        background:${done ? "#f0fdf4" : "var(--surface)"};">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                  <span style="font-size:11px;font-weight:700;background:${color}22;color:${color};
                               padding:2px 8px;border-radius:10px;">${escapeHtml(TYPE_MAP[sess.type] || sess.type)}</span>
                  <span style="font-size:13px;font-weight:600;">Session ${sess.session_num}: ${escapeHtml(sess.title || "")}</span>
                  ${done ? `<i class="bi bi-check-circle-fill" style="color:#059669;font-size:14px;"></i>` : ""}
                  ${schedBadge}
                </div>
                ${sess.description ? `<div style="font-size:12px;color:var(--text);margin:4px 0 2px;line-height:1.5;">${escapeHtml(sess.description)}</div>` : ""}
                ${sess.focus ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;font-style:italic;">${escapeHtml(sess.focus)}</div>` : ""}
                ${done && noteMap[sess.session_num] ? (() => {
                  const n = noteMap[sess.session_num];
                  const goalList = (n.fields && n.fields._goals_addressed) || [];
                  return `<div style="margin-top:8px;">
                    ${goalList.length ? `<div style="font-size:11px;margin-bottom:4px;">
                      ${goalList.map(g => `<span style="display:inline-block;background:#dbeafe;color:#1e40af;
                        font-size:11px;font-weight:600;padding:1px 7px;border-radius:8px;margin:2px 3px 2px 0;">
                        <i class="bi bi-check2"></i> ${escapeHtml(g)}</span>`).join("")}
                    </div>` : ""}
                    <div style="font-size:11px;color:var(--muted);">
                      <i class="bi bi-pencil-fill"></i> Note logged ${escapeHtml(n.recordedAt.slice(0,10))}
                      <button class="secondary" onclick="viewSessionNote(${sess.session_num})"
                        style="margin-left:8px;padding:2px 8px;font-size:11px;">View / Edit</button>
                    </div>
                  </div>`;
                })() : ""}
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;margin-left:12px;flex-shrink:0;">
                <button data-snum="${sess.session_num}" data-stype="${escapeHtml(sess.type)}" data-stitle="${escapeHtml(sess.title || "")}"
                  onclick="openNoteModal(+this.dataset.snum, this.dataset.stype, this.dataset.stitle)"
                  style="padding:6px 12px;font-size:12px;${done ? "opacity:.7;" : ""}">
                  <i class="bi bi-${done ? "pencil" : "plus-lg"}"></i> ${done ? "Edit Note" : "Log Note"}
                </button>
                <button class="secondary"
                  data-snum="${sess.session_num}"
                  data-stitle="${escapeHtml(sess.title || "")}"
                  data-stype="${escapeHtml(sess.type || "")}"
                  data-sched="${escapeHtml(scheduled ? scheduled.scheduledDate : "")}"
                  onclick="openScheduleModal(+this.dataset.snum, this.dataset.stitle, this.dataset.stype, this.dataset.sched)"
                  style="padding:6px 12px;font-size:12px;">
                  <i class="bi bi-calendar-plus"></i> ${scheduled ? "Reschedule" : "Schedule"}
                </button>
              </div>
            </div>`;
        }).join("")}
      </div>`;
    weeksEl.appendChild(wkCard);
  });

  // Store state on window for modal access
  window._programNotes   = noteMap;
  window._programSched   = schedMap;
  window._programId      = program.programId;
  window._programRoot    = root;
  window._programSp      = sp;
  window._programGoals   = goals;
}

function openNoteModal(sessionNum, sessionType, sessionTitle) {
  const template = noteTemplateFor(sessionType);
  const existing = (window._programNotes || {})[sessionNum] || null;
  const existFields = existing ? (existing.fields || {}) : {};
  const checkedGoals = existing ? (existFields._goals_addressed || []) : [];
  const goals = window._programGoals || [];

  const goalsHtml = goals.length ? `
    <div style="margin-bottom:20px;padding:14px;background:var(--surface);border-radius:10px;border:1.5px solid var(--border);">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;"><i class="bi bi-flag-fill" style="color:var(--primary);margin-right:6px;"></i>Goals Addressed This Session</div>
      ${goals.map((g, i) => `
        <div class="checkbox-row" style="margin-bottom:7px;align-items:flex-start;">
          <input type="checkbox" id="nm-goal-${i}" value="${escapeAttr(g.objective)}"
            ${checkedGoals.includes(g.objective) ? "checked" : ""}>
          <label for="nm-goal-${i}" style="font-size:13px;line-height:1.4;">${escapeHtml(g.objective)}</label>
        </div>`).join("")}
    </div>` : "";

  const modalArea = document.getElementById("note-modal-area");
  modalArea.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#fff;border-radius:14px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);">
        <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;font-size:16px;">Session ${sessionNum} Note</div>
            <div style="font-size:13px;color:var(--muted);margin-top:2px;">${escapeHtml(sessionTitle)}</div>
          </div>
          <button class="secondary icon-btn" onclick="closeNoteModal()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div style="padding:20px 24px;">
          ${goalsHtml}
          ${template.map(f => `
            <div style="margin-bottom:16px;">
              <label style="font-size:13px;font-weight:700;display:block;margin-bottom:5px;">${escapeHtml(f.label)}</label>
              <textarea id="note-field-${f.key}" rows="3"
                style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;
                       font-size:13px;resize:vertical;font-family:inherit;"
                placeholder="${escapeHtml(f.placeholder)}">${escapeHtml(existFields[f.key] || "")}</textarea>
            </div>`).join("")}
          <div id="note-save-status" style="margin-bottom:12px;"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="secondary" onclick="closeNoteModal()">Cancel</button>
            <button data-snum="${sessionNum}" data-stype="${escapeHtml(String(sessionType))}" data-stitle="${escapeHtml(String(sessionTitle))}"
              onclick="saveNoteModal(+this.dataset.snum, this.dataset.stype, this.dataset.stitle)">
              <i class="bi bi-check-lg"></i> Save Note
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function closeNoteModal() {
  const el = document.getElementById("note-modal-area");
  if (el) el.innerHTML = "";
}

async function saveNoteModal(sessionNum, sessionType, sessionTitle) {
  const template = noteTemplateFor(sessionType);
  const fields = {};
  template.forEach(f => {
    const el = document.getElementById("note-field-" + f.key);
    if (el) fields[f.key] = el.value.trim();
  });
  // Collect checked goals
  const checkedGoals = Array.from(document.querySelectorAll('[id^="nm-goal-"]:checked')).map(cb => cb.value);
  if (checkedGoals.length) fields._goals_addressed = checkedGoals;

  setStatus("note-save-status", "Saving…", "loading");
  try {
    await apiCall("addSessionNote", {
      programId:   window._programId || "",
      sessionNum,
      sessionType,
      title:       sessionTitle,
      noteFields:  fields
    });
    closeNoteModal();
    loadClientProgram(window._programRoot);
  } catch (e) {
    setStatus("note-save-status", "Error: " + e.message, "error");
  }
}

function viewSessionNote(sessionNum) {
  const note = (window._programNotes || {})[sessionNum];
  if (!note) return;
  openNoteModal(sessionNum, note.sessionType, note.title);
}

function printClientProgram() {
  window.print();
}

// ── Session scheduling ────────────────────────────────────────────────────────

function openScheduleModal(sessionNum, sessionTitle, sessionType, existingDate) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const modalArea = document.getElementById("schedule-modal-area");
  modalArea.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#fff;border-radius:14px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.25);">
        <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;font-size:16px;"><i class="bi bi-calendar-plus" style="color:var(--primary);margin-right:6px;"></i>Schedule Session ${sessionNum}</div>
            <div style="font-size:13px;color:var(--muted);margin-top:2px;">${escapeHtml(sessionTitle)}</div>
          </div>
          <button class="secondary icon-btn" onclick="closeScheduleModal()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div style="padding:20px 24px;">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">Session Date</label>
          <input type="date" id="sched-date-input" value="${escapeHtml(existingDate || todayStr)}"
            style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;">
          <p style="font-size:12px;color:var(--muted);margin:10px 0 0;line-height:1.5;">
            Saving the date will also open Google Calendar so you can create the event with session details pre-filled.
          </p>
          <div id="sched-status" style="margin-top:10px;"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
            <button class="secondary" onclick="closeScheduleModal()">Cancel</button>
            <button data-snum="${sessionNum}" data-stitle="${escapeHtml(sessionTitle)}" data-stype="${escapeHtml(sessionType)}"
              onclick="saveScheduleDate(+this.dataset.snum, this.dataset.stitle, this.dataset.stype)">
              <i class="bi bi-calendar-check-fill"></i> Save & Open Calendar
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function closeScheduleModal() {
  const el = document.getElementById("schedule-modal-area");
  if (el) el.innerHTML = "";
}

async function saveScheduleDate(sessionNum, sessionTitle, sessionType) {
  const dateInput = document.getElementById("sched-date-input");
  const date = dateInput ? dateInput.value : "";
  if (!date) { setStatus("sched-status", "Please select a date.", "error"); return; }

  setStatus("sched-status", "Saving…", "loading");
  try {
    await apiCall("scheduleSession", {
      sessionNum,
      scheduledDate: date,
      sessionTitle,
      sessionType
    });

    // Build Google Calendar event creation URL with pre-filled details
    const dateObj   = new Date(date + "T09:00:00");
    const endObj    = new Date(date + "T09:30:00");
    const fmtGcal   = d => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const TYPE_MAP  = { "parent-only":"Parent-Only Session", "child-only":"Child Session", "parent+child":"Family Session", "graduation":"Graduation Session" };
    const title     = encodeURIComponent(`Session ${sessionNum}: ${sessionTitle}`);
    const details   = encodeURIComponent(`${TYPE_MAP[sessionType] || sessionType}\n\n${sessionTitle}`);
    const gcalUrl   = `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${fmtGcal(dateObj)}/${fmtGcal(endObj)}&details=${details}`;

    closeScheduleModal();
    window.open(gcalUrl, "_blank", "noopener");
    loadClientProgram(window._programRoot);
  } catch (e) {
    setStatus("sched-status", "Error: " + e.message, "error");
  }
}
