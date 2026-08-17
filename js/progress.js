// Progress section — reads/writes data_prog. Chart and table show one goal
// at a time so Y-axis scale is always meaningful.

let progGoals      = [];
let progAllEntries = [];
let progSelected   = ""; // goalKey of the currently viewed goal
const progAxisState = {}; // per-goal manual axis overrides

// Build the canonical display/key string from goal parts.
// Format: "GOAL_NUM.OBJ_NUM GOAL_DOMAIN | OBJECTIVE"
// Falls back gracefully if any part is missing.
function progGoalKey(g) {
  const num    = (g.goalNum != null && g.goalNum !== "") ? String(g.goalNum) : "";
  const obj    = (g.objNum  != null && g.objNum  !== "") ? String(g.objNum)  : "";
  const domain = (g.goalDomain || "").trim();
  const text   = (g.objective  || "").trim();
  const prefix = (num && obj) ? num + "." + obj + " " : "";
  const domPart = domain ? domain + " | " : "";
  return (prefix + domPart + text).trim();
}

const PROG_NUM_COLS = 7;

function initProgressSection(root) {
  root.innerHTML = `
    <style>
      .prog-date-grid { display:grid; grid-template-columns:repeat(${PROG_NUM_COLS},1fr); gap:8px; margin-top:10px; }
      .prog-date-col  { display:flex; flex-direction:column; gap:4px; }
      .prog-date-col .prog-col-label { font-size:11px; font-weight:600; color:var(--muted); text-align:center; }
      .prog-date-col .prog-col-date  { font-size:12px; text-align:center; color:var(--text); margin-bottom:2px; }
      .prog-date-col input           { text-align:center; font-size:14px; }
      @media(max-width:760px){ .prog-date-grid{ grid-template-columns:repeat(4,1fr); } }
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
      <p style="font-size:13px;color:var(--muted);margin:0 0 10px;">
        Select a goal above, then enter scores below.
      </p>
      <div id="prog-selected-label" style="font-size:13px;font-weight:600;color:var(--primary);margin-bottom:10px;min-height:18px;"></div>
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
  try {
    const { goals } = await apiCall("getPlan", {});
    progGoals = goals.map(g => Object.assign({}, g, { _key: progGoalKey(g) }));
    progSyncMeasure();
    progRenderDateCols();
    renderGoalPicker();
  } catch (e) {
    const el = document.getElementById("prog-goal-picker");
    if (el) el.innerHTML = `<div style="color:#dc2626;font-size:13px;">Error loading goals: ${escapeHtml(e.message)}</div>`;
  }
}

function progSyncMeasure() {
  const goal = progGoals.find(g => g._key === progSelected);
  const measure = goal ? (goal.measure || "") : "";
  const lbl = document.getElementById("prog-measure-label");
  if (lbl) lbl.textContent = measure || "(none)";
  const selLbl = document.getElementById("prog-selected-label");
  if (selLbl) selLbl.textContent = progSelected || "No goal selected";
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
      const withData = progGoals.find(g => progress.some(p => p.objText === g._key));
      progSelected = (withData || progGoals[0] || {})._key || "";
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

  const buttons = progGoals.map((g, idx) => {
    const active   = g._key === progSelected;
    const hasData  = progAllEntries.some(p => p.objText === g._key);
    return `<button
      class="${active ? "" : "secondary"}"
      data-goal-idx="${idx}"
      onclick="progSelectGoal(this.dataset.goalIdx)"
      style="font-size:12px;padding:6px 12px;${!hasData ? "opacity:0.55;" : ""}">
      ${escapeHtml(g._key)}
    </button>`;
  }).join("");

  el.innerHTML = `<div class="btn-row" style="flex-wrap:wrap;gap:6px;">${buttons}</div>`;
}

function progSelectGoal(idxStr) {
  const g = progGoals[parseInt(idxStr)];
  if (!g) return;
  progSelected = g._key;
  renderGoalPicker();
  renderGoalView();
  progSyncMeasure();
}

function renderGoalView() {
  renderGoalPicker();

  const goal    = progGoals.find(g => g._key === progSelected);
  const measure = goal ? (goal.measure || "Score") : "Score";
  const entries = progAllEntries.filter(p => p.objText === progSelected);

  // Table
  document.getElementById("prog-body").innerHTML = entries.length
    ? entries.map(p =>
        `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.measure)}</td><td>${escapeHtml(p.score)}</td></tr>`
      ).join("")
    : `<tr><td colspan="3" style="color:var(--muted);">No entries for this goal yet.</td></tr>`;

  renderProgressChart(goal, entries);
}

function progInferChart(goal, numeric) {
  const text = `${progSelected} ${goal?.measure || ""}`.toLowerCase();
  const values = numeric.map(p => Number(p.score));
  const dataMax = values.length ? Math.max(...values) : 10;
  const dataMin = values.length ? Math.min(...values) : 0;
  const cfg = {
    weekly: /\bweekly\b|\bper\s+week\b|\beach\s+week\b|\ba\s+week\b|\/\s*week\b/i.test(text),
    yMin: Math.min(0, Math.floor(dataMin)),
    yMax: Math.max(10, Math.ceil(dataMax * 1.2)),
    yStep: null,
    yLabel: goal?.measure || "Score",
    detected: []
  };

  if (/\b(percent(?:age)?|%|success\s+rate|accuracy|rate\s+of)\b/i.test(text)) {
    Object.assign(cfg, { yMin: 0, yMax: 100, yStep: 10, yLabel: "Percent (%)" });
    cfg.detected.push("Percent scale");
  } else if (/\b(days?\s*(per|a|each|\/)\s*week|days?\s+weekly)\b/i.test(text)) {
    Object.assign(cfg, { weekly: true, yMin: 0, yMax: 7, yStep: 1, yLabel: "Days per week" });
    cfg.detected.push("Days per week");
  } else if (/\b(1\s*(?:to|–|-)\s*10|out\s+of\s+10|intensity|severity|rating)\b/i.test(text)) {
    Object.assign(cfg, { yMin: 0, yMax: 10, yStep: 1, yLabel: "Rating (0–10)" });
    cfg.detected.push("Rating scale");
  } else if (/\b(minutes?|mins?|hours?|hrs?|duration)\b/i.test(text)) {
    cfg.yMin = 0;
    cfg.yLabel = /hours?|hrs?/.test(text) ? "Hours" : "Minutes";
    cfg.detected.push("Duration");
  } else if (/\b(count|number\s+of|times?|occurrences?|episodes?|incidents?)\b/i.test(text)) {
    cfg.yMin = 0;
    cfg.yStep = 1;
    cfg.yLabel = cfg.weekly ? "Count per week" : "Count";
    cfg.detected.push("Count");
  }
  if (cfg.weekly) cfg.detected.push("Weekly timeline");
  if (!cfg.detected.length) cfg.detected.push("Automatic scale");
  return cfg;
}

function progWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const offset = (d.getDay() + 6) % 7; // Monday-based week
  d.setDate(d.getDate() - offset);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function progChartPoints(numeric, grouping) {
  if (grouping === "daily") return numeric.map(p => ({ label: p.date, value: Number(p.score), count: 1 }));
  const groups = {};
  numeric.forEach(p => {
    const key = grouping === "monthly" ? p.date.slice(0, 7) : progWeekStart(p.date);
    (groups[key] ||= []).push(Number(p.score));
  });
  return Object.keys(groups).sort().map(key => {
    const vals = groups[key];
    const d = new Date((grouping === "monthly" ? key + "-01" : key) + "T00:00:00");
    return {
      label: grouping === "monthly"
        ? d.toLocaleDateString(undefined, { month:"short", year:"numeric" })
        : `Week of ${d.toLocaleDateString(undefined, { month:"short", day:"numeric" })}`,
      value: Math.round((vals.reduce((a,b) => a+b, 0) / vals.length) * 100) / 100,
      count: vals.length
    };
  });
}

function renderProgressChart(goal, entries) {
  const section = document.getElementById("prog-chartSection");
  const numeric = entries.filter(p => p.date && p.score !== "" && !isNaN(Number(p.score)))
                         .sort((a, b) => a.date.localeCompare(b.date));

  if (numeric.length === 0) {
    section.innerHTML = entries.length
      ? `<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>Scores for this goal are non-numeric — no chart to display.</span></div>`
      : `<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No entries yet for this goal.</span></div>`;
    return;
  }

  const state = progAxisState[progSelected] ||= {};
  const cfg = progInferChart(goal, numeric);
  const grouping = state.xGrouping || (cfg.weekly ? "weekly" : "daily");
  const points = progChartPoints(numeric, grouping);
  const lastIdx = Math.max(0, points.length - 1);
  const xMin = Math.min(state.xMin ?? 0, lastIdx);
  const xMax = Math.max(xMin, Math.min(state.xMax ?? lastIdx, lastIdx));
  const yMin = Number.isFinite(state.yMin) ? state.yMin : cfg.yMin;
  const yMax = Number.isFinite(state.yMax) ? state.yMax : cfg.yMax;
  const visible = points.slice(xMin, xMax + 1);
  const labels = visible.map(p => p.label);
  const scores = visible.map(p => p.value);
  const color  = colorForDomain(progSelected);
  const sliderCeiling = Math.max(cfg.yMax, Math.ceil(Math.max(...points.map(p => p.value)) * 2), 10);
  const ySliderStep = cfg.yMax <= 10 ? 1 : cfg.yMax <= 100 ? 5 : Math.max(1, Math.round(sliderCeiling / 20));

  section.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 10px;">
      <span style="font-size:12px;font-weight:700;margin-right:2px;">X-axis:</span>
      ${["daily","weekly","monthly"].map(mode => `<button class="${grouping === mode ? "" : "secondary"}" style="font-size:12px;padding:6px 11px;" onclick="progSetGrouping('${mode}')">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join("")}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px;">
      ${cfg.detected.map(label => `<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:#eaf2ff;color:var(--primary-dark);">${escapeHtml(label)}</span>`).join("")}
      ${grouping !== "daily" ? `<span style="font-size:11px;color:var(--muted);align-self:center;">Multiple entries in each ${grouping === "weekly" ? "week" : "month"} are averaged.</span>` : ""}
    </div>
    <div class="chart-wrap wide"><canvas id="prog-chart"></canvas></div>
    <div class="prog-axis-controls" style="display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));gap:14px;margin:12px 0 22px;">
      <div style="padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface,#f8fafc);">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Y-axis range: <span id="prog-y-range">${yMin}–${yMax}</span></div>
        <label style="text-transform:none;">Minimum<input type="range" min="0" max="${sliderCeiling}" step="${ySliderStep}" value="${yMin}" onchange="progSetAxis('yMin',this.value)"></label>
        <label style="text-transform:none;margin-top:6px;">Maximum<input type="range" min="${ySliderStep}" max="${sliderCeiling}" step="${ySliderStep}" value="${yMax}" onchange="progSetAxis('yMax',this.value)"></label>
      </div>
      <div style="padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface,#f8fafc);">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;">X-axis window: <span id="prog-x-range">${escapeHtml(points[xMin].label)}–${escapeHtml(points[xMax].label)}</span></div>
        <label style="text-transform:none;">Start<input type="range" min="0" max="${lastIdx}" step="1" value="${xMin}" ${lastIdx === 0 ? "disabled" : ""} onchange="progSetAxis('xMin',this.value)"></label>
        <label style="text-transform:none;margin-top:6px;">End<input type="range" min="0" max="${lastIdx}" step="1" value="${xMax}" ${lastIdx === 0 ? "disabled" : ""} onchange="progSetAxis('xMax',this.value)"></label>
      </div>
    </div>
    <button class="secondary" style="font-size:12px;padding:6px 10px;margin:-10px 0 18px;" onclick="progResetAxes()"><i class="bi bi-arrow-counterclockwise"></i> Reset axes to automatic</button>
    <style>@media(max-width:620px){.prog-axis-controls{grid-template-columns:1fr!important;}}</style>`;
  destroyChart("prog-chart");

  chartInstances["prog-chart"] = new Chart(
    document.getElementById("prog-chart").getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: goal?.measure || "Score",
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
          y: {
            min: yMin, max: yMax,
            ticks: { stepSize: cfg.yStep || undefined },
            title: { display: true, text: cfg.yLabel }
          },
          x: { grid: { display: false }, title: { display: true, text: grouping === "weekly" ? "Week" : grouping === "monthly" ? "Month" : "Date" } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: items => items[0]?.label || "" } }
        }
      }
    }
  );
}

function progSetGrouping(grouping) {
  if (!progSelected || !["daily", "weekly", "monthly"].includes(grouping)) return;
  const state = progAxisState[progSelected] ||= {};
  state.xGrouping = grouping;
  delete state.xMin;
  delete state.xMax;
  const goal = progGoals.find(g => g._key === progSelected);
  renderProgressChart(goal, progAllEntries.filter(p => p.objText === progSelected));
}

function progSetAxis(axis, rawValue) {
  if (!progSelected) return;
  const state = progAxisState[progSelected] ||= {};
  const value = Number(rawValue);
  state[axis] = value;
  if (axis === "yMin" && Number.isFinite(state.yMax) && value >= state.yMax) state.yMax = value + 1;
  if (axis === "yMax" && Number.isFinite(state.yMin) && value <= state.yMin) state.yMin = Math.max(0, value - 1);
  if (axis === "xMin" && Number.isFinite(state.xMax) && value > state.xMax) state.xMax = value;
  if (axis === "xMax" && Number.isFinite(state.xMin) && value < state.xMin) state.xMin = value;
  const goal = progGoals.find(g => g._key === progSelected);
  renderProgressChart(goal, progAllEntries.filter(p => p.objText === progSelected));
}

function progResetAxes() {
  if (!progSelected) return;
  delete progAxisState[progSelected];
  const goal = progGoals.find(g => g._key === progSelected);
  renderProgressChart(goal, progAllEntries.filter(p => p.objText === progSelected));
}

async function addProgressBatch() {
  const key = progSelected;
  if (!key) {
    setStatus("prog-status", "Select a goal using the buttons above.", "error");
    return;
  }
  const goal    = progGoals.find(g => g._key === key);
  const measure = goal ? (goal.measure || "") : "";
  const objText = key;

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
    progSelected = key;
    await loadProgress();
  } catch (e) {
    setStatus("prog-status", "Error: " + e.message, "error");
  }
}
