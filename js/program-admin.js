// Program Admin section — provider-only view. Assign programs to clients,
// review step completion and client reflections.

function initProgramAdminSection(root) {
  root.innerHTML = `
    <div id="padmin-status"></div>
    <div id="padmin-content"></div>
  `;
  loadProgramAdmin();
}

async function loadProgramAdmin() {
  setStatus("padmin-status", "Loading…", "loading");
  try {
    const [libData, progressData, clientsData, planData] = await Promise.all([
      apiCall("getProgramLibrary", {}),
      apiCall("getClientProgramProgress", {}),
      apiCall("getProviderClients", {}).catch(() => ({ clients: [] })),
      apiCall("getPlan", {}).catch(() => ({ goals: [] }))
    ]);
    // Find this client's role from the clients list
    const sess = JSON.parse(sessionStorage.getItem("portalSession") || "{}");
    const selectedClientId = sess.selectedClientId || sess.clientId || "";
    const thisClient = (clientsData.clients || []).find(c => c.clientId === selectedClientId) || {};
    const clientMeta = { role: thisClient.role || "parent", goals: planData.goals || [] };
    renderProgramAdmin(libData, progressData, clientMeta);
    setStatus("padmin-status", "", "");
  } catch (e) {
    setStatus("padmin-status", "Error: " + e.message, "error");
  }
}

function _roleToAudience(role) {
  if (role === "adult") return "adult";
  if (role === "teen")  return "teen";
  if (role === "child") return "child";
  return "parent"; // default: "parent" role = parent managing child's account
}

function renderProgramAdmin(libData, progressData, clientMeta) {
  const hasAssignment = !!progressData.assignment;
  const programs      = libData.programs || [];
  const clientRole    = (clientMeta && clientMeta.role) || "parent"; // "parent"|"adult"|"teen"|"child"
  const defaultAud    = _roleToAudience(clientRole);
  const clientGoals   = (clientMeta && clientMeta.goals) || [];

  let progressHtml = "";
  if (hasAssignment) {
    const { assignment, steps } = progressData;
    const completed = steps.filter(s => s.status === "completed").length;
    const pct = Math.round((completed / steps.length) * 100);

    const stepsHtml = steps.map(step => {
      const iconMap = { completed: "check-circle-fill", available: "circle", locked: "lock" };
      const icon = iconMap[step.status] || "circle";
      let responseHtml = "";
      if (step.status === "completed" && step.response) {
        try {
          const saved = JSON.parse(step.response);
          if (saved.bfa_scores_json) {
            responseHtml = `
              <div class="step-review-body" style="display:none;">
                ${renderBfaScores(saved.bfa_scores_json)}
              </div>`;
          } else if (saved.reflection) {
            responseHtml = `
              <div class="step-review-body" style="display:none;">
                <div class="activity-response-label">Client reflection</div>
                <p style="font-size:14px;margin:0;">${escapeHtml(saved.reflection)}</p>
              </div>`;
          }
        } catch (_) {}
      }
      return `
        <div class="step-review-item ${step.status}">
          <div class="step-review-header" ${responseHtml ? 'onclick="toggleStepReview(this)"' : ""}>
            <i class="bi bi-${icon}"></i>
            <span class="step-review-title">${escapeHtml(step.title)}</span>
            <span class="step-status-badge ${step.status}">${step.status}</span>
            ${responseHtml ? '<i class="bi bi-chevron-down step-chevron"></i>' : ""}
          </div>
          ${responseHtml}
        </div>`;
    }).join("");

    progressHtml = `
      <div class="card">
        <h2><i class="bi bi-collection-play-fill"></i>Current Program</h2>
        <div style="font-weight:600;font-size:15px;">${escapeHtml(assignment.programName)}</div>
        <div style="font-size:13px;color:var(--muted);margin:4px 0 14px;">
          Started ${assignment.startDate} · Day ${assignment.daysSinceStart + 1}
        </div>
        <div class="prog-progress-bar"><div class="prog-progress-fill" style="width:${pct}%"></div></div>
        <div style="font-size:12px;color:var(--muted);margin:6px 0 18px;">${completed} of ${steps.length} completed</div>
        <div class="step-review-list">${stepsHtml}</div>
      </div>`;
  } else {
    progressHtml = `<div class="card"><p style="color:var(--muted);">No program assigned to this client yet.</p></div>`;
  }

  const programOptions = programs.map(p =>
    `<option value="${escapeHtml(String(p.programId))}">${escapeHtml(p.name)}</option>`
  ).join("");

  document.getElementById("padmin-content").innerHTML = `
    ${progressHtml}

    <!-- AI Session Planner -->
    <div class="card">
      <h2><i class="bi bi-stars"></i> AI Session Planner</h2>
      <p style="color:var(--muted);font-size:14px;margin:0 0 16px;">
        Generate personalized session topic suggestions based on this client's session notes, progress reports, and assessments.
      </p>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px;">
        <div class="row" style="margin:0;gap:10px;align-items:center;">
          <label style="margin:0;min-width:0;">Sessions to plan</label>
          <select id="ai-num-sessions" style="width:80px;">
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6" selected>6</option>
            <option value="7">7</option>
            <option value="8">8</option>
          </select>
        </div>
        <div class="row" style="margin:0;gap:10px;align-items:center;">
          <label style="margin:0;min-width:0;">Audience</label>
          <select id="ai-audience" style="width:130px;">
            <option value="child"  ${defaultAud === "child"  ? "selected" : ""}>Child</option>
            <option value="teen"   ${defaultAud === "teen"   ? "selected" : ""}>Teen</option>
            <option value="parent" ${defaultAud === "parent" ? "selected" : ""}>Parent</option>
            <option value="adult"  ${defaultAud === "adult"  ? "selected" : ""}>Adult</option>
          </select>
        </div>
      </div>
      ${clientGoals.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text);">
          <i class="bi bi-bullseye"></i> Include goals in planning
          <span style="font-size:11px;font-weight:400;color:var(--muted);margin-left:6px;">(select any to focus the AI)</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;" id="ai-goal-picker">
          ${clientGoals.map((g, i) => {
            const text = g.objText || g.objective || "Goal " + (i + 1);
            return `<label style="display:grid;grid-template-columns:18px 1fr;gap:10px;align-items:start;
                                  padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;
                                  cursor:pointer;font-size:13px;line-height:1.45;
                                  background:var(--surface,#f9fafb);transition:border-color .15s;">
              <input type="checkbox" value="${i}" class="ai-goal-check" style="margin-top:3px;">
              <span>${escapeHtml(text)}</span>
            </label>`;
          }).join("")}
        </div>
      </div>` : ""}
      <button onclick="runAiSessionPlanner()">
        <i class="bi bi-magic"></i> Generate Suggestions
      </button>
      <div id="ai-planner-status" style="margin-top:10px;"></div>
      <div id="ai-planner-results"></div>
    </div>

    <!-- Assign from library -->
    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i>${hasAssignment ? "Reassign Program" : "Assign Program"}</h2>
      <div class="row">
        <label>Program</label>
        <select id="prog-select">${programOptions || '<option value="">No programs found</option>'}</select>
      </div>
      <div class="row">
        <label>Start Date</label>
        <input type="date" id="prog-start-date" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <button onclick="doAssignProgram()"><i class="bi bi-send-fill"></i> ${hasAssignment ? "Reassign" : "Assign"} Program</button>
      <div id="assign-status" style="margin-top:10px;"></div>
    </div>
  `;
}

function toggleStepReview(headerEl) {
  const body = headerEl.parentElement.querySelector(".step-review-body");
  if (!body) return;
  const isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "block";
  const chevron = headerEl.querySelector(".step-chevron");
  if (chevron) chevron.style.transform = isOpen ? "" : "rotate(180deg)";
}

// ── AI Session Planner ────────────────────────────────────────────────────────

async function runAiSessionPlanner() {
  const numSessions  = parseInt(document.getElementById("ai-num-sessions")?.value || 6, 10);
  const audience     = document.getElementById("ai-audience")?.value || "parent";
  const selectedGoals = Array.from(document.querySelectorAll(".ai-goal-check:checked"))
    .map(cb => {
      const label = cb.closest("label");
      return label ? label.querySelector("span")?.textContent?.trim() : null;
    }).filter(Boolean);

  setStatus("ai-planner-status", `Analyzing session history and generating ${numSessions} suggestions… this may take 10–20 seconds.`, "loading");
  document.getElementById("ai-planner-results").innerHTML = "";
  try {
    const res = await apiCall("suggestSessionTopics", { numSessions, audience, selectedGoals });
    setStatus("ai-planner-status", "", "");
    renderAiSuggestions(res.suggestions || []);
  } catch (e) {
    setStatus("ai-planner-status", "Error: " + e.message, "error");
  }
}

function renderAiSuggestions(suggestions) {
  const container = document.getElementById("ai-planner-results");
  if (!suggestions.length) {
    container.innerHTML = `<p style="color:var(--muted);font-size:13px;">No suggestions returned.</p>`;
    return;
  }

  const cards = suggestions.map((s, i) => `
    <div style="border:1.5px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;background:var(--surface,#f9fafb);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:28px;height:28px;border-radius:50%;background:#6366f1;color:#fff;
                    display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;">
          ${s.session}
        </div>
        <input id="ai-title-${i}" value="${escapeHtml(s.title)}"
               style="flex:1;font-weight:700;font-size:14px;border:1px solid var(--border);
                      border-radius:6px;padding:5px 10px;">
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">
        <strong>Focus:</strong> ${escapeHtml(s.focus)}
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;padding:8px 10px;
                  background:rgba(99,102,241,.06);border-radius:6px;border-left:3px solid #6366f1;">
        <strong>Why now:</strong> ${escapeHtml(s.rationale)}
      </div>
      <div style="font-size:12px;margin-bottom:8px;">
        <strong>Activities:</strong>
        <ul style="margin:4px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:2px;">
          ${(s.suggestedActivities || []).map(a => `<li>${escapeHtml(a)}</li>`).join("")}
        </ul>
      </div>
      <div style="font-size:12px;color:var(--muted);">
        <strong>Between-session:</strong> ${escapeHtml(s.homework || "—")}
      </div>
      <div style="margin-top:8px;">
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Notes (optional)</label>
        <textarea id="ai-notes-${i}" rows="2" placeholder="Add any custom notes for this session…"
                  style="width:100%;font-size:12px;border:1px solid var(--border);border-radius:6px;
                         padding:6px 8px;resize:vertical;"></textarea>
      </div>
    </div>`).join("");

  container.innerHTML = `
    ${cards}
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px;">
      <div class="row" style="margin:0;gap:10px;align-items:center;">
        <label style="margin:0;font-size:13px;">Start date</label>
        <input type="date" id="ai-start-date" value="${new Date().toISOString().slice(0, 10)}"
               style="border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;">
      </div>
      <div class="row" style="margin:0;gap:10px;align-items:center;">
        <label style="margin:0;font-size:13px;">Sessions/week</label>
        <select id="ai-sessions-per-week" style="border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;">
          <option value="1">1</option>
          <option value="2" selected>2</option>
          <option value="3">3</option>
        </select>
      </div>
      <button onclick="createProgramFromAi(${suggestions.length})">
        <i class="bi bi-calendar2-check-fill"></i> Create &amp; Assign Program
      </button>
    </div>
    <div id="ai-create-status" style="margin-top:10px;"></div>`;

  // Store suggestions for reference by createProgramFromAi
  window._aiSuggestions = suggestions;
}

async function createProgramFromAi(count) {
  const startDate      = document.getElementById("ai-start-date")?.value;
  const sessPerWeek    = parseInt(document.getElementById("ai-sessions-per-week")?.value || 2, 10);
  const suggestions    = window._aiSuggestions || [];
  if (!startDate) { setStatus("ai-create-status", "Please set a start date.", "error"); return; }
  if (!suggestions.length) { setStatus("ai-create-status", "No suggestions to save.", "error"); return; }

  // Build weeks from suggestions, grouping by sessPerWeek
  const weeks = [];
  for (let i = 0; i < count; i += sessPerWeek) {
    const weekSessions = [];
    for (let j = 0; j < sessPerWeek && (i + j) < count; j++) {
      const idx = i + j;
      const s   = suggestions[idx];
      const title = (document.getElementById(`ai-title-${idx}`)?.value || s.title).trim();
      const notes = (document.getElementById(`ai-notes-${idx}`)?.value || "").trim();
      weekSessions.push({
        title,
        goal:  s.focus,
        notes: [s.rationale, notes].filter(Boolean).join(" | "),
        homework:    s.homework || "",
        activities:  s.suggestedActivities || []
      });
    }
    weeks.push({ week: weeks.length + 1, sessions: weekSessions });
  }

  const sessionPlan = { model: "AI Custom", source: "ai-planner", weeks };
  setStatus("ai-create-status", "Creating program…", "loading");
  try {
    await apiCall("activateClientProgram", { sessionPlan, startDate });
    setStatus("ai-create-status", "Program created and assigned!", "success");
    if (typeof showToast === "function") showToast("Program created from AI suggestions!", "success");
    document.getElementById("ai-planner-results").innerHTML = "";
    window._aiSuggestions = null;
    setTimeout(loadProgramAdmin, 1200);
  } catch (e) {
    setStatus("ai-create-status", "Error: " + e.message, "error");
  }
}

async function doAssignProgram() {
  const programId = document.getElementById("prog-select")?.value;
  const startDate = document.getElementById("prog-start-date")?.value;
  if (!programId || !startDate) return;
  setStatus("assign-status", "Assigning…", "loading");
  try {
    await apiCall("assignProgram", { programId, startDate });
    setStatus("assign-status", "Program assigned.", "");
    await loadProgramAdmin();
  } catch (e) {
    setStatus("assign-status", "Error: " + e.message, "error");
  }
}
