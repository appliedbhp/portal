// Goals & Plan section — reads/writes tbl_plan for the logged-in client.
// Adding/removing goals is provider-only (enforced server-side too, in
// Code.gs addGoal_/deleteGoal_ — the role check here is just UI convenience).

function initPlanSection(root) {
  const isProvider = getRole() === "provider";
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-flag-fill"></i>Goals &amp; Plan</h1>
      <table class="summary-table">
        <thead><tr><th>Date</th><th>Goal #</th><th>Obj #</th><th>Domain</th><th>Objective</th><th>Target Date</th>${isProvider ? "<th></th>" : ""}</tr></thead>
        <tbody id="plan-body"><tr><td colspan="${isProvider ? 7 : 6}">Loading...</td></tr></tbody>
      </table>
    </div>

    ${isProvider ? `
    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i>Add a Goal</h2>
      <div class="row"><label>Goal #</label><input id="plan-goalNum" type="text" placeholder="1"></div>
      <div class="row"><label>Objective #</label><input id="plan-objNum" type="text" placeholder="1"></div>
      <div class="row"><label>Domain</label><input id="plan-goalDomain" type="text" placeholder="e.g. Executive Function"></div>
      <div class="row"><label>Objective (short)</label><input id="plan-objective" type="text" style="max-width:520px;" placeholder="Short objective label"></div>
      <div class="row"><label>Target Date</label><input id="plan-dateTarget" type="date"></div>
      <button onclick="addGoal()"><i class="bi bi-save-fill"></i> Save Goal</button>
      <div id="plan-status"></div>
    </div>
    ` : ""}
  `;
  loadPlan(isProvider);
}

async function loadPlan(isProvider) {
  const colspan = isProvider ? 7 : 6;
  try {
    const { goals } = await apiCall("getPlan", {});
    document.getElementById("plan-body").innerHTML = goals.length
      ? goals.map(g => `<tr>
          <td>${escapeHtml(g.datePlan)}</td><td>${escapeHtml(g.goalNum)}</td><td>${escapeHtml(g.objNum)}</td>
          <td>${escapeHtml(g.goalDomain)}</td><td>${escapeHtml(g.objective)}</td><td>${escapeHtml(g.dateTarget)}</td>
          ${isProvider ? `<td><button class="secondary" onclick="deleteGoal('${escapeAttr(g.goalId)}')"><i class="bi bi-trash3-fill"></i></button></td>` : ""}
        </tr>`).join("")
      : `<tr><td colspan="${colspan}">No goals on file yet.</td></tr>`;
  } catch (e) {
    document.getElementById("plan-body").innerHTML = `<tr><td colspan="${colspan}">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

function escapeAttr(s) {
  return String(s == null ? "" : s).replace(/'/g, "\\'");
}

async function addGoal() {
  const goalNum = document.getElementById("plan-goalNum").value.trim();
  const objNum = document.getElementById("plan-objNum").value.trim();
  const goalDomain = document.getElementById("plan-goalDomain").value.trim();
  const objective = document.getElementById("plan-objective").value.trim();
  const dateTarget = document.getElementById("plan-dateTarget").value;

  if (!goalNum || !objNum || !goalDomain || !objective) {
    setStatus("plan-status", "Please fill in all fields except Target Date.", "error");
    return;
  }
  setStatus("plan-status", "Saving...", "loading");
  try {
    await apiCall("addGoal", { goalNum, objNum, goalDomain, objective, dateTarget });
    setStatus("plan-status", "Goal saved.", "success");
    ["plan-goalNum", "plan-objNum", "plan-goalDomain", "plan-objective", "plan-dateTarget"].forEach(id => document.getElementById(id).value = "");
    loadPlan(true);
  } catch (e) {
    setStatus("plan-status", "Error: " + e.message, "error");
  }
}

async function deleteGoal(goalId) {
  if (!confirm("Remove this goal? This cannot be undone.")) return;
  setStatus("plan-status", "Removing...", "loading");
  try {
    await apiCall("deleteGoal", { goalId });
    setStatus("plan-status", "Goal removed.", "success");
    loadPlan(true);
  } catch (e) {
    setStatus("plan-status", "Error: " + e.message, "error");
  }
}
