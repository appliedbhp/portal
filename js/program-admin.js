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
    const [libData, progressData] = await Promise.all([
      apiCall("getProgramLibrary", {}),
      apiCall("getClientProgramProgress", {})
    ]);
    renderProgramAdmin(libData, progressData);
    setStatus("padmin-status", "", "");
  } catch (e) {
    setStatus("padmin-status", "Error: " + e.message, "error");
  }
}

function renderProgramAdmin(libData, progressData) {
  const hasAssignment = !!progressData.assignment;
  const programs = libData.programs || [];

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
