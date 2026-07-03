// Client Program section — provider-only.
// Tracks the activated session plan: shows each session, allows logging notes
// using generic templates per session type.

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

function initClientProgramSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading program…</p></div>`;
  loadClientProgram(root);
}

async function loadClientProgram(root) {
  try {
    const [{ program }, { notes }] = await Promise.all([
      apiCall("getClientProgram", {}),
      apiCall("getSessionNotes", {})
    ]);
    renderClientProgram(root, program, notes || []);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load program: ${escapeHtml(e.message)}</span></div></div>`;
  }
}

function renderClientProgram(root, program, notes) {
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

  const totalSessions = (sp.weeks || []).reduce((sum, w) => sum + (w.sessions || []).length, 0);
  const completedCount = notes.length;

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-calendar2-week-fill"></i>Client Program</h1>
      <div class="stat-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        ${statCard("calendar-check-fill", "Model", escapeHtml(sp.model || "—"))}
        ${statCard("list-ol", "Sessions", completedCount + " / " + totalSessions + " logged")}
        ${statCard("calendar-event", "Started", escapeHtml(program.startDate || "Not set"))}
      </div>
      ${sp.model_rationale ? `<p style="font-size:13px;color:var(--muted);margin:0 0 16px;font-style:italic;">${escapeHtml(sp.model_rationale)}</p>` : ""}
    </div>
    <div id="program-weeks"></div>
    <div id="note-modal-area"></div>`;

  const weeksEl = root.querySelector("#program-weeks");
  (sp.weeks || []).forEach(wk => {
    const wkCard = document.createElement("div");
    wkCard.className = "card";
    wkCard.style.marginBottom = "12px";

    const allDone = (wk.sessions || []).every(s => noteMap[s.session_num]);
    wkCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <span style="font-weight:700;font-size:15px;">Week ${wk.week} — ${escapeHtml(wk.phase || "")}</span>
          ${allDone ? `<span style="margin-left:8px;font-size:11px;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-weight:700;">Complete</span>` : ""}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${(wk.sessions || []).map(sess => {
          const done = !!noteMap[sess.session_num];
          const TYPE_COLOR = { "parent-only":"#3b82f6", "child-only":"#8b5cf6", "parent+child":"#059669", "graduation":"#f59e0b" };
          const TYPE_MAP   = { "parent-only":"Parent-Only", "child-only":"Child-Only", "parent+child":"Parent + Child", "graduation":"Graduation" };
          const color = TYPE_COLOR[sess.type] || "#6b7280";
          return `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;
                        padding:12px 14px;background:var(--surface);border-radius:8px;
                        border:1.5px solid ${done ? "#bbf7d0" : "var(--border)"};
                        background:${done ? "#f0fdf4" : "var(--surface)"};">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span style="font-size:11px;font-weight:700;background:${color}22;color:${color};
                               padding:2px 8px;border-radius:10px;">${escapeHtml(TYPE_MAP[sess.type] || sess.type)}</span>
                  <span style="font-size:13px;font-weight:600;">Session ${sess.session_num}: ${escapeHtml(sess.title || "")}</span>
                  ${done ? `<i class="bi bi-check-circle-fill" style="color:#059669;font-size:14px;"></i>` : ""}
                </div>
                ${sess.focus ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${escapeHtml(sess.focus)}</div>` : ""}
                ${done && noteMap[sess.session_num] ? `
                  <div style="font-size:11px;color:var(--muted);margin-top:4px;">
                    <i class="bi bi-pencil-fill"></i> Note logged ${escapeHtml(noteMap[sess.session_num].recordedAt.slice(0,10))}
                    <button class="secondary" onclick="viewSessionNote(${sess.session_num})"
                      style="margin-left:8px;padding:2px 8px;font-size:11px;">View</button>
                  </div>` : ""}
              </div>
              <button onclick="openNoteModal(${sess.session_num}, '${sess.type}', ${JSON.stringify(escapeHtml(sess.title || ""))})"
                style="margin-left:12px;flex-shrink:0;padding:6px 12px;font-size:12px;
                       ${done ? "opacity:.7;" : ""}">
                <i class="bi bi-${done ? "pencil" : "plus-lg"}"></i> ${done ? "Edit" : "Log Note"}
              </button>
            </div>`;
        }).join("")}
      </div>`;
    weeksEl.appendChild(wkCard);
  });

  // Store notes on window for modal access
  window._programNotes   = noteMap;
  window._programId      = program.programId;
  window._programRoot    = root;
  window._programSp      = sp;
}

function openNoteModal(sessionNum, sessionType, sessionTitle) {
  const template = noteTemplateFor(sessionType);
  const existing = (window._programNotes || {})[sessionNum] || null;
  const existFields = existing ? existing.fields : {};

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
            <button onclick="saveNoteModal(${sessionNum}, '${sessionType}', ${JSON.stringify(escapeHtml(sessionTitle))})">
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
  const template = noteTemplateFor(note.sessionType);
  openNoteModal(sessionNum, note.sessionType, note.title);
}
