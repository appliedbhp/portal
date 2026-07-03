// Programs section — parent/adult view. Shows the custom client program
// (from provider) and any assigned digital programs, with a tab for each.

let programData = null;
let activeStepNum = null;
let _progActiveTab = "client"; // "client" | "assigned"

function initProgramsSection(root) {
  root.innerHTML = `
    <div id="prog-status"></div>
    <div id="prog-content"></div>
  `;
  loadProgram();
}

async function loadProgram() {
  setStatus("prog-status", "Loading your program…", "loading");
  try {
    const [myProgram, clientProgRes, notesRes, goalsRes] = await Promise.all([
      apiCall("getMyProgram", {}).catch(() => ({ assignment: null, steps: [] })),
      apiCall("getClientProgram", {}).catch(() => ({ program: null })),
      apiCall("getSessionNotes", {}).catch(() => ({ notes: [] })),
      apiCall("getPlan", {}).catch(() => ({ goals: [] }))
    ]);
    programData = myProgram;
    setStatus("prog-status", "", "");
    renderProgramTabs(myProgram, clientProgRes.program, notesRes.notes || [], goalsRes.goals || []);
  } catch (e) {
    setStatus("prog-status", "Could not load program: " + e.message, "error");
  }
}

function renderProgramTabs(myProgram, clientProgram, notes, goals) {
  const hasClient   = !!(clientProgram && clientProgram.sessionPlan);
  const hasAssigned = !!(myProgram && myProgram.assignment);

  if (!hasClient && !hasAssigned) {
    document.getElementById("prog-content").innerHTML = `
      <div class="card">
        <h1><i class="bi bi-play-circle-fill"></i> My Program</h1>
        <p style="color:var(--muted);">No program has been set up yet. Your provider will set this up for you.</p>
      </div>`;
    return;
  }

  // Default to whichever tab exists
  if (!hasClient) _progActiveTab = "assigned";
  if (!hasAssigned) _progActiveTab = "client";

  const tabBar = (hasClient && hasAssigned) ? `
    <div class="btn-row no-print" style="margin-bottom:0;">
      <button id="prog-tab-client"   onclick="progSwitchTab('client')"   class="${_progActiveTab==='client'   ? '' : 'secondary'}"><i class="bi bi-calendar2-week-fill"></i> My Session Plan</button>
      <button id="prog-tab-assigned" onclick="progSwitchTab('assigned')" class="${_progActiveTab==='assigned' ? '' : 'secondary'}"><i class="bi bi-collection-play-fill"></i> Activities</button>
    </div>` : "";

  document.getElementById("prog-content").innerHTML = `
    <div class="card" style="margin-bottom:0;">
      <h1 style="margin-bottom:${hasClient && hasAssigned ? '16px' : '0'};"><i class="bi bi-play-circle-fill"></i> My Program</h1>
      ${tabBar}
    </div>
    <div id="prog-tab-client-panel"   style="display:${_progActiveTab==='client'   ? 'block' : 'none'};"></div>
    <div id="prog-tab-assigned-panel" style="display:${_progActiveTab==='assigned' ? 'block' : 'none'};"></div>`;

  if (hasClient)   renderClientProgramPanel(clientProgram, notes, goals);
  if (hasAssigned) renderProgram(myProgram);
}

function progSwitchTab(tab) {
  _progActiveTab = tab;
  document.getElementById("prog-tab-client-panel").style.display   = tab === "client"   ? "block" : "none";
  document.getElementById("prog-tab-assigned-panel").style.display = tab === "assigned" ? "block" : "none";
  const cBtn = document.getElementById("prog-tab-client");
  const aBtn = document.getElementById("prog-tab-assigned");
  if (cBtn) { cBtn.className   = tab === "client"   ? "" : "secondary"; }
  if (aBtn) { aBtn.className   = tab === "assigned" ? "" : "secondary"; }
}

function renderClientProgramPanel(program, notes, goals) {
  const panel = document.getElementById("prog-tab-client-panel");
  if (!panel) return;

  const sp = program.sessionPlan;
  const noteMap = {};
  notes.forEach(n => { noteMap[n.sessionNum] = n; });

  const TYPE_COLOR = { "parent-only":"#3b82f6", "child-only":"#8b5cf6", "parent+child":"#059669", "graduation":"#f59e0b" };
  const TYPE_MAP   = { "parent-only":"Parent Session", "child-only":"Child Session", "parent+child":"Parent + Child", "graduation":"Graduation" };

  const totalSessions  = (sp.weeks || []).reduce((s, w) => s + (w.sessions || []).length, 0);
  const completedCount = notes.length;
  const pct = totalSessions ? Math.round((completedCount / totalSessions) * 100) : 0;

  const goalList = goals.length ? `
    <div style="margin-top:16px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;"><i class="bi bi-flag-fill" style="color:var(--primary);margin-right:6px;"></i>Your Goals</div>
      ${goals.map(g => `
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;">
          <i class="bi bi-arrow-right-circle-fill" style="color:var(--primary);margin-top:2px;flex-shrink:0;"></i>
          <span style="font-size:13px;">${escapeHtml(g.objective)}</span>
        </div>`).join("")}
    </div>` : "";

  const projections = cpProjectWeeks(program.startDate, (sp.weeks || []).length, noteMap);
  const PSTYLE = { completed:"background:#d1fae5;color:#065f46;", current:"background:#dbeafe;color:#1e40af;", overdue:"background:#fee2e2;color:#991b1b;", "holiday-delay":"background:#fef3c7;color:#92400e;", upcoming:"background:#f3f4f6;color:#374151;" };
  const PLABEL = { completed:"Complete", current:"In Progress", overdue:"Overdue", "holiday-delay":"Holiday Week", upcoming:"Upcoming" };

  const weeksHtml = (sp.weeks || []).map((wk, wi) => {
    const proj = projections[wi] || {};
    const holHtml = (proj.holidays || []).map(h =>
      `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:8px;margin-left:6px;"><i class="bi bi-calendar-x-fill"></i> ${escapeHtml(h.name)}</span>`
    ).join("");
    const sessHtml = (wk.sessions || []).map(sess => {
      const done  = !!noteMap[sess.session_num];
      const color = TYPE_COLOR[sess.type] || "#6b7280";
      const label = TYPE_MAP[sess.type] || sess.type;
      const n     = noteMap[sess.session_num];
      const goalBadges = done && n && n.fields && n.fields._goals_addressed
        ? n.fields._goals_addressed.map(g => `<span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:600;padding:1px 7px;border-radius:8px;margin:2px 3px 2px 0;"><i class="bi bi-check2"></i> ${escapeHtml(g)}</span>`).join("")
        : "";
      return `
        <div style="padding:12px 14px;background:${done ? "#f0fdf4" : "var(--surface)"};
                    border-radius:8px;border:1.5px solid ${done ? "#bbf7d0" : "var(--border)"};margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;background:${color}22;color:${color};padding:2px 8px;border-radius:10px;">${escapeHtml(label)}</span>
            <span style="font-size:13px;font-weight:600;">Session ${sess.session_num}: ${escapeHtml(sess.title || "")}</span>
            ${done ? `<i class="bi bi-check-circle-fill" style="color:#059669;font-size:14px;"></i>` : ""}
          </div>
          ${sess.description ? `<div style="font-size:12px;color:var(--text);margin:4px 0 2px;line-height:1.5;">${escapeHtml(sess.description)}</div>` : ""}
          ${sess.focus ? `<div style="font-size:12px;color:var(--muted);font-style:italic;">${escapeHtml(sess.focus)}</div>` : ""}
          ${goalBadges ? `<div style="margin-top:6px;">${goalBadges}</div>` : ""}
          ${done && n ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;"><i class="bi bi-check-lg"></i> Completed ${escapeHtml((n.recordedAt || "").slice(0,10))}</div>` : ""}
        </div>`;
    }).join("");

    return `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          <div>
            <span style="font-weight:700;font-size:15px;">Week ${wk.week} — ${escapeHtml(wk.phase || "")}</span>
            <span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;${PSTYLE[proj.status]||PSTYLE.upcoming}">${PLABEL[proj.status]||""}</span>
            ${holHtml}
          </div>
          <div style="font-size:12px;color:var(--muted);"><i class="bi bi-calendar3"></i> ${escapeHtml(proj.projectedLabel || "—")}</div>
        </div>
        ${sessHtml}
      </div>`;
  }).join("");

  panel.innerHTML = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        ${statCard("calendar-check-fill", "Model", escapeHtml(sp.model || "—"))}
        ${statCard("list-ol", "Sessions", completedCount + " / " + totalSessions + " completed")}
        ${statCard("calendar-event", "Started", escapeHtml(program.startDate || "Not set"))}
      </div>
      <div class="prog-progress-bar"><div class="prog-progress-fill" style="width:${pct}%"></div></div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;">${pct}% complete</div>
      ${goalList}
    </div>
    ${weeksHtml}`;
}

function renderProgram(data) {
  const { assignment, steps } = data;
  const completed = steps.filter(s => s.status === "completed").length;
  const pct = Math.round((completed / steps.length) * 100);

  const stepsHtml = steps.map(step => {
    const iconMap = { completed: "check-circle-fill", available: "play-circle-fill", locked: "lock-fill" };
    const icon = iconMap[step.status] || "circle";
    const clickable = step.status !== "locked";
    let sublabel = "";
    if (step.status === "locked" && step.unlockType === "days" && step.daysUntilUnlock > 0) {
      sublabel = `<span class="step-sublabel">Unlocks in ${step.daysUntilUnlock} day${step.daysUntilUnlock !== 1 ? "s" : ""}</span>`;
    } else if (step.status === "completed" && step.completedAt) {
      sublabel = `<span class="step-sublabel">Completed ${new Date(step.completedAt).toLocaleDateString()}</span>`;
    }
    return `
      <div class="step-item ${step.status}" data-step="${step.stepNum}"
        ${clickable ? `onclick="showStep(${step.stepNum})"` : ""}>
        <i class="bi bi-${icon}"></i>
        <div>
          <div class="step-title">${escapeHtml(step.title)}</div>
          ${sublabel}
        </div>
      </div>`;
  }).join("");

  const target = document.getElementById("prog-tab-assigned-panel") || document.getElementById("prog-content");
  target.innerHTML = `
    <div class="card" style="margin-top:12px;">
      <h2 style="padding-top:0;"><i class="bi bi-collection-play-fill"></i>${escapeHtml(assignment.programName)}</h2>
      ${assignment.programDescription ? `<p style="color:var(--muted);font-size:14px;margin:-8px 0 20px;">${escapeHtml(assignment.programDescription)}</p>` : ""}
      <div class="prog-progress-bar"><div class="prog-progress-fill" style="width:${pct}%"></div></div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;">${completed} of ${steps.length} completed</div>
    </div>
    <div class="prog-layout">
      <div class="card prog-steps">${stepsHtml}</div>
      <div id="prog-activity-panel"></div>
    </div>
  `;

  const firstAvailable = steps.find(s => s.status === "available");
  const firstCompleted = steps.slice().reverse().find(s => s.status === "completed");
  const toShow = firstAvailable || firstCompleted;
  if (toShow) showStep(toShow.stepNum);
}

function showStep(stepNum) {
  if (!programData) return;
  activeStepNum = stepNum;
  const step = programData.steps.find(s => s.stepNum === stepNum);
  if (!step || step.status === "locked") return;

  document.querySelectorAll(".step-item").forEach(el => {
    el.classList.toggle("active", parseInt(el.dataset.step) === stepNum);
  });

  const panel = document.getElementById("prog-activity-panel");
  if (!panel) return;

  const isCompleted = step.status === "completed";
  let previousResponse = "";
  if (isCompleted && step.response) {
    try { previousResponse = JSON.parse(step.response).reflection || ""; } catch (_) {}
  }

  let completedExtra = "";
  if (isCompleted && step.response) {
    try {
      const saved = JSON.parse(step.response);
      if (saved.bfa_scores_json) {
        completedExtra = `<div style="margin-top:20px;">${renderBfaScores(saved.bfa_scores_json)}</div>`;
      } else if (saved.reflection) {
        completedExtra = `<div class="activity-previous-response">
          <div class="activity-response-label">Your reflection</div>
          <p>${escapeHtml(saved.reflection)}</p>
        </div>`;
      }
    } catch (_) {}
  }

  panel.innerHTML = `
    <div class="card activity-card">
      <h2 style="padding-top:0;">
        <i class="bi bi-${isCompleted ? "check-circle-fill" : "play-circle-fill"}"></i>${escapeHtml(step.title)}
      </h2>
      ${isCompleted ? `<div class="field-hint" style="margin-bottom:16px;">
        <i class="bi bi-check-lg"></i> Completed${step.completedAt ? " · " + new Date(step.completedAt).toLocaleDateString() : ""}
      </div>
      ${completedExtra}` : `
      <div class="activity-body">${step.content || ""}</div>
      <div class="activity-submit">
        <button onclick="submitActivity(${stepNum})" id="submit-activity-btn">
          <i class="bi bi-check-lg"></i> Mark Complete
        </button>
        <div id="activity-submit-status"></div>
      </div>`}
    </div>
  `;

  // Re-execute any <script> tags injected via innerHTML (they don't run automatically)
  if (!isCompleted) {
    panel.querySelectorAll(".activity-body script").forEach(old => {
      const s = document.createElement("script");
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  }
}

async function submitActivity(stepNum) {
  const btn = document.getElementById("submit-activity-btn");
  if (btn) btn.disabled = true;
  setStatus("activity-submit-status", "Saving…", "loading");

  const responseData = {};
  document.querySelectorAll(".activity-body [name]").forEach(el => {
    if (el.type === "radio" || el.type === "checkbox") {
      if (el.checked) responseData[el.name] = el.value;
    } else {
      responseData[el.name] = el.value;
    }
  });

  try {
    await apiCall("submitActivityResponse", {
      stepNum,
      assignmentId: programData.assignment.assignmentId,
      responseJson: JSON.stringify(responseData)
    });
    await loadProgram();
    showStep(stepNum);
  } catch (e) {
    setStatus("activity-submit-status", "Error: " + e.message, "error");
    if (btn) btn.disabled = false;
  }
}
