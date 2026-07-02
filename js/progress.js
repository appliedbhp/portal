// Progress section — reads/writes data_prog. Chart and table show one goal
// at a time so Y-axis scale is always meaningful.

let progGoals      = [];
let progAllEntries = [];
let progSelected   = ""; // objText of the currently viewed goal

function initProgressSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-graph-up"></i>Progress</h1>
      <div id="prog-goal-picker" style="margin-bottom:20px;"></div>
      <div id="prog-chartSection"></div>
      <table class="summary-table">
        <thead><tr><th>Date</th><th>Measure</th><th>Score</th></tr></thead>
        <tbody id="prog-body"><tr><td colspan="3">Loading…</td></tr></tbody>
      </table>
    </div>

    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i>Add a Progress Entry</h2>
      <div class="row">
        <label>Objective</label>
        <select id="prog-objText" style="max-width:520px;" onchange="progSyncMeasure()">
          <option value="">Loading goals…</option>
        </select>
      </div>
      <div class="row"><label>Date</label><input id="prog-date" type="date"></div>
      <div class="row">
        <label>Measure</label>
        <input id="prog-measure" type="text" readonly style="background:#f0f1f5;">
      </div>
      <div class="field-hint"><i class="bi bi-info-circle-fill"></i> Measure is defined on the goal — pick an objective above to fill it in.</div>
      <div class="row"><label>Score</label><input id="prog-score" type="text" placeholder="e.g. 80"></div>
      <button onclick="addProgress()"><i class="bi bi-save-fill"></i> Save Entry</button>
      <div id="prog-status"></div>
    </div>
  `;
  loadProgress();
  loadProgressObjectiveOptions();
}

async function loadProgressObjectiveOptions() {
  const select = document.getElementById("prog-objText");
  try {
    const { goals } = await apiCall("getPlan", {});
    progGoals = goals;
    select.innerHTML = goals.length
      ? goals.map(g => `<option value="${escapeHtml(g.objText)}">${escapeHtml(g.objective)}</option>`).join("")
      : `<option value="">No goals on file — add one in Goals &amp; Plan first</option>`;
    progSyncMeasure();
    renderGoalPicker();
  } catch (e) {
    select.innerHTML = `<option value="">Error loading goals</option>`;
  }
}

function progSyncMeasure() {
  const objText = document.getElementById("prog-objText").value;
  const goal = progGoals.find(g => g.objText === objText);
  document.getElementById("prog-measure").value = goal ? (goal.measure || "") : "";
}

async function loadProgress() {
  try {
    const { progress } = await apiCall("getProgress", {});
    progAllEntries = progress;
    // Auto-select first goal that has data, or first goal overall
    if (!progSelected) {
      const withData = progGoals.find(g => progress.some(p => p.objText === g.objText));
      progSelected = (withData || progGoals[0] || {}).objText || "";
    }
    renderGoalView();
  } catch (e) {
    document.getElementById("prog-body").innerHTML =
      `<tr><td colspan="3">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderGoalPicker() {
  const el = document.getElementById("prog-goal-picker");
  if (!el || progGoals.length === 0) return;

  const buttons = progGoals.map(g => {
    const active = g.objText === progSelected;
    const hasData = progAllEntries.some(p => p.objText === g.objText);
    return `<button
      class="${active ? "" : "secondary"}"
      onclick="progSelectGoal(${JSON.stringify(escapeHtml(g.objText))})"
      style="font-size:12px;padding:6px 12px;${!hasData ? "opacity:0.55;" : ""}">
      ${escapeHtml(g.objective || g.objText)}
    </button>`;
  }).join("");

  el.innerHTML = `<div class="btn-row" style="flex-wrap:wrap;gap:6px;">${buttons}</div>`;
}

function progSelectGoal(objText) {
  progSelected = objText;
  renderGoalPicker();
  renderGoalView();
}

function renderGoalView() {
  renderGoalPicker();

  const goal    = progGoals.find(g => g.objText === progSelected);
  const measure = goal ? (goal.measure || "Score") : "Score";
  const entries = progAllEntries.filter(p => p.objText === progSelected);

  // Table
  document.getElementById("prog-body").innerHTML = entries.length
    ? entries.map(p =>
        `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.measure)}</td><td>${escapeHtml(p.score)}</td></tr>`
      ).join("")
    : `<tr><td colspan="3" style="color:var(--muted);">No entries for this goal yet.</td></tr>`;

  // Chart
  const section = document.getElementById("prog-chartSection");
  const numeric = entries.filter(p => p.date && p.score !== "" && !isNaN(Number(p.score)));

  if (numeric.length === 0) {
    section.innerHTML = entries.length
      ? `<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>Scores for this goal are non-numeric — no chart to display.</span></div>`
      : `<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No entries yet for this goal.</span></div>`;
    return;
  }

  numeric.sort((a, b) => a.date.localeCompare(b.date));
  const labels = numeric.map(p => p.date);
  const scores = numeric.map(p => Number(p.score));
  const color  = colorForDomain(progSelected);

  section.innerHTML = `<div class="chart-wrap wide"><canvas id="prog-chart"></canvas></div>`;
  destroyChart("prog-chart");

  chartInstances["prog-chart"] = new Chart(
    document.getElementById("prog-chart").getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: measure,
          data: scores,
          borderColor: color,
          backgroundColor: hexToRgba(color, 0.12),
          pointBackgroundColor: color,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { title: { display: true, text: measure } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: items => items[0]?.label || "" } }
        }
      }
    }
  );
}

async function addProgress() {
  const objText = document.getElementById("prog-objText").value;
  const date    = document.getElementById("prog-date").value;
  const measure = document.getElementById("prog-measure").value.trim();
  const score   = document.getElementById("prog-score").value.trim();

  if (!objText || !measure || !score) {
    setStatus("prog-status", "Please select an objective and fill in Measure and Score.", "error");
    return;
  }
  setStatus("prog-status", "Saving…", "loading");
  try {
    await apiCall("addProgress", { objText, date, measure, score });
    setStatus("prog-status", "Entry saved.", "");
    document.getElementById("prog-score").value = "";
    // Switch view to the goal just updated
    progSelected = objText;
    await loadProgress();
  } catch (e) {
    setStatus("prog-status", "Error: " + e.message, "error");
  }
}
