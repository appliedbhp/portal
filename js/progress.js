// Progress section — reads/writes data_prog. Chart and table show one goal
// at a time so Y-axis scale is always meaningful.

let progGoals      = [];
let progAllEntries = [];
let progSelected   = ""; // objText of the currently viewed goal

const PROG_NUM_COLS = 5;

function initProgressSection(root) {
  root.innerHTML = `
    <style>
      .prog-date-grid { display:grid; grid-template-columns:repeat(${PROG_NUM_COLS},1fr); gap:8px; margin-top:10px; }
      .prog-date-col  { display:flex; flex-direction:column; gap:4px; }
      .prog-date-col .prog-col-label { font-size:11px; font-weight:600; color:var(--muted); text-align:center; }
      .prog-date-col .prog-col-date  { font-size:12px; text-align:center; color:var(--text); margin-bottom:2px; }
      .prog-date-col input           { text-align:center; font-size:14px; }
      @media(max-width:520px){ .prog-date-grid{ grid-template-columns:repeat(2,1fr); } }
    </style>

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
      <h2><i class="bi bi-plus-circle-fill"></i>Add Progress Entries</h2>
      <div class="row">
        <label>Objective</label>
        <select id="prog-objText" style="max-width:520px;" onchange="progSyncMeasure()">
          <option value="">Loading goals…</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;">
        <div class="row" style="margin:0;flex-direction:row;align-items:center;gap:8px;">
          <label style="margin:0;white-space:nowrap;">Start date</label>
          <input id="prog-start-date" type="date" style="width:160px;" onchange="progRenderDateCols()">
        </div>
        <div style="font-size:12px;color:var(--muted);">Enter scores for up to ${PROG_NUM_COLS} consecutive days</div>
      </div>
      <div id="prog-date-grid" class="prog-date-grid" style="margin-top:12px;"></div>
      <div class="field-hint" style="margin-top:8px;">
        <i class="bi bi-info-circle-fill"></i>
        Measure: <strong id="prog-measure-label">—</strong> &nbsp;·&nbsp; Leave a column blank to skip that day.
      </div>
      <button style="margin-top:12px;" onclick="addProgressBatch()"><i class="bi bi-save-fill"></i> Save Entries</button>
      <div id="prog-status" style="margin-top:8px;"></div>
    </div>
  `;

  // Default start date = today
  const today = new Date();
  const pad = n => String(n).padStart(2, "0");
  document.getElementById("prog-start-date").value =
    `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

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
    progRenderDateCols();
    renderGoalPicker();
  } catch (e) {
    select.innerHTML = `<option value="">Error loading goals</option>`;
  }
}

function progSyncMeasure() {
  const objText = document.getElementById("prog-objText").value;
  const goal = progGoals.find(g => g.objText === objText);
  const measure = goal ? (goal.measure || "") : "";
  const lbl = document.getElementById("prog-measure-label");
  if (lbl) lbl.textContent = measure || "(none)";
}

function progRenderDateCols() {
  const grid = document.getElementById("prog-date-grid");
  if (!grid) return;
  const startVal = document.getElementById("prog-start-date").value;
  if (!startVal) { grid.innerHTML = ""; return; }

  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const cols = [];
  for (let i = 0; i < PROG_NUM_COLS; i++) {
    const d = new Date(startVal + "T00:00:00");
    d.setDate(d.getDate() + i);
    const pad = n => String(n).padStart(2,"0");
    const iso  = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const disp = `${DAY_NAMES[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`;
    cols.push({ iso, disp });
  }

  grid.innerHTML = cols.map((c, i) => `
    <div class="prog-date-col">
      <div class="prog-col-label">${c.disp}</div>
      <input id="prog-score-${i}" type="text" placeholder="—" inputmode="decimal"
             data-date="${c.iso}" style="width:100%;">
    </div>`).join("");
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

async function addProgressBatch() {
  const objText = document.getElementById("prog-objText").value;
  if (!objText) {
    setStatus("prog-status", "Please select an objective.", "error");
    return;
  }
  const goal    = progGoals.find(g => g.objText === objText);
  const measure = goal ? (goal.measure || "") : "";

  const entries = [];
  for (let i = 0; i < PROG_NUM_COLS; i++) {
    const inp = document.getElementById("prog-score-" + i);
    if (!inp) continue;
    const score = inp.value.trim();
    if (score === "") continue;
    entries.push({ objText, date: inp.dataset.date, measure, score });
  }

  if (entries.length === 0) {
    setStatus("prog-status", "Enter at least one score.", "error");
    return;
  }

  setStatus("prog-status", "Saving…", "loading");
  try {
    const { saved } = await apiCall("addProgressBatch", { entries });
    setStatus("prog-status", `${saved} entr${saved === 1 ? "y" : "ies"} saved.`, "success");
    // Clear score inputs
    for (let i = 0; i < PROG_NUM_COLS; i++) {
      const inp = document.getElementById("prog-score-" + i);
      if (inp) inp.value = "";
    }
    progSelected = objText;
    await loadProgress();
  } catch (e) {
    setStatus("prog-status", "Error: " + e.message, "error");
  }
}
