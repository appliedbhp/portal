// Goals & Plan section — reads/writes tbl_plan for the logged-in client.

function initPlanSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-flag-fill"></i>Goals &amp; Plan</h1>
      <table class="summary-table">
        <thead><tr><th>Date</th><th>Goal #</th><th>Obj #</th><th>Domain</th><th>Objective</th><th>Target Date</th></tr></thead>
        <tbody id="plan-body"><tr><td colspan="6">Loading...</td></tr></tbody>
      </table>
    </div>

    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i>Add a Goal</h2>
      <div class="row"><label>Goal #</label><input id="plan-goalNum" type="text" placeholder="1"></div>
      <div class="row"><label>Objective #</label><input id="plan-objNum" type="text" placeholder="1"></div>
      <div class="row"><label>Domain</label><input id="plan-goalDomain" type="text" placeholder="e.g. Executive Function"></div>
      <div class="row"><label>Objective (short)</label><input id="plan-objective" type="text" style="max-width:520px;" placeholder="Short objective label"></div>
      <div class="row"><label>Full Objective Text</label><textarea id="plan-objText" placeholder="Full objective description"></textarea></div>
      <div class="row"><label>Target Date</label><input id="plan-dateTarget" type="date"></div>
      <button onclick="addGoal()"><i class="bi bi-save-fill"></i> Save Goal</button>
      <div id="plan-status"></div>
    </div>
  `;
  loadPlan();
}

async function loadPlan() {
  try {
    const { goals } = await apiCall("getPlan", {});
    document.getElementById("plan-body").innerHTML = goals.length
      ? goals.map(g => `<tr><td>${escapeHtml(g.datePlan)}</td><td>${escapeHtml(g.goalNum)}</td><td>${escapeHtml(g.objNum)}</td><td>${escapeHtml(g.goalDomain)}</td><td>${escapeHtml(g.objective)}</td><td>${escapeHtml(g.dateTarget)}</td></tr>`).join("")
      : `<tr><td colspan="6">No goals on file yet.</td></tr>`;
  } catch (e) {
    document.getElementById("plan-body").innerHTML = `<tr><td colspan="6">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function addGoal() {
  const goalNum = document.getElementById("plan-goalNum").value.trim();
  const objNum = document.getElementById("plan-objNum").value.trim();
  const goalDomain = document.getElementById("plan-goalDomain").value.trim();
  const objective = document.getElementById("plan-objective").value.trim();
  const objText = document.getElementById("plan-objText").value.trim();
  const dateTarget = document.getElementById("plan-dateTarget").value;

  if (!goalNum || !objNum || !goalDomain || !objective || !objText) {
    setStatus("plan-status", "Please fill in all fields except Target Date.", "error");
    return;
  }
  setStatus("plan-status", "Saving...", "loading");
  try {
    await apiCall("addGoal", { goalNum, objNum, goalDomain, objective, objText, dateTarget });
    setStatus("plan-status", "Goal saved.", "success");
    ["plan-goalNum", "plan-objNum", "plan-goalDomain", "plan-objective", "plan-objText", "plan-dateTarget"].forEach(id => document.getElementById(id).value = "");
    loadPlan();
  } catch (e) {
    setStatus("plan-status", "Error: " + e.message, "error");
  }
}
