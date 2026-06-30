// Programs section — parent view. Shows assigned program, step progress,
// renders the current activity HTML, and handles response submission.

let programData = null;
let activeStepNum = null;

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
    const data = await apiCall("getMyProgram", {});
    programData = data;
    if (!data.assignment) {
      document.getElementById("prog-content").innerHTML = `
        <div class="card">
          <h1><i class="bi bi-collection-play-fill"></i>My Program</h1>
          <p style="color:var(--muted);">No program has been assigned yet. Your provider will set this up for you.</p>
        </div>
      `;
    } else {
      renderProgram(data);
    }
    setStatus("prog-status", "", "");
  } catch (e) {
    setStatus("prog-status", "Could not load program: " + e.message, "error");
  }
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

  document.getElementById("prog-content").innerHTML = `
    <div class="card">
      <h1><i class="bi bi-collection-play-fill"></i>${escapeHtml(assignment.programName)}</h1>
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

  panel.innerHTML = `
    <div class="card activity-card">
      <h2 style="padding-top:0;">
        <i class="bi bi-${isCompleted ? "check-circle-fill" : "play-circle-fill"}"></i>${escapeHtml(step.title)}
      </h2>
      ${isCompleted ? `<div class="field-hint" style="margin-bottom:16px;">
        <i class="bi bi-check-lg"></i> Completed${step.completedAt ? " · " + new Date(step.completedAt).toLocaleDateString() : ""}
      </div>` : ""}
      <div class="activity-body">${step.content || ""}</div>
      ${!isCompleted ? `
        <div class="activity-submit">
          <button onclick="submitActivity(${stepNum})" id="submit-activity-btn">
            <i class="bi bi-check-lg"></i> Mark Complete
          </button>
          <div id="activity-submit-status"></div>
        </div>
      ` : previousResponse ? `
        <div class="activity-previous-response">
          <div class="activity-response-label">Your reflection</div>
          <p>${escapeHtml(previousResponse)}</p>
        </div>
      ` : ""}
    </div>
  `;
}

async function submitActivity(stepNum) {
  const btn = document.getElementById("submit-activity-btn");
  if (btn) btn.disabled = true;
  setStatus("activity-submit-status", "Saving…", "loading");

  const responseData = {};
  document.querySelectorAll(".activity-body [name]").forEach(el => {
    responseData[el.name] = el.value;
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
