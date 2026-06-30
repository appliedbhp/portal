// Progress section — reads/writes data_prog, linked to tbl_plan goals by OBJ_TEXT.

function initProgressSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-graph-up"></i>Progress</h1>
      <div id="prog-chartSection"></div>
      <table class="summary-table">
        <thead><tr><th>Date</th><th>Objective</th><th>Measure</th><th>Score</th></tr></thead>
        <tbody id="prog-body"><tr><td colspan="4">Loading...</td></tr></tbody>
      </table>
    </div>

    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i>Add a Progress Entry</h2>
      <div class="row">
        <label>Objective</label>
        <select id="prog-objText" style="max-width:520px;"><option value="">Loading goals...</option></select>
      </div>
      <div class="row"><label>Date</label><input id="prog-date" type="date"></div>
      <div class="row"><label>Measure</label><input id="prog-measure" type="text" placeholder="e.g. % independent completion"></div>
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
    select.innerHTML = goals.length
      ? goals.map(g => `<option value="${escapeHtml(g.objText)}">${escapeHtml(g.objective)}</option>`).join("")
      : `<option value="">No goals on file — add one in Goals & Plan first</option>`;
  } catch (e) {
    select.innerHTML = `<option value="">Error loading goals</option>`;
  }
}

async function loadProgress() {
  try {
    const { progress } = await apiCall("getProgress", {});
    document.getElementById("prog-body").innerHTML = progress.length
      ? progress.map(p => `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.objText)}</td><td>${escapeHtml(p.measure)}</td><td>${escapeHtml(p.score)}</td></tr>`).join("")
      : `<tr><td colspan="4">No progress entries on file yet.</td></tr>`;
    renderProgressChart(progress);
  } catch (e) {
    document.getElementById("prog-body").innerHTML = `<tr><td colspan="4">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// One line per objective (matched by OBJ_TEXT), score over time. Non-numeric
// scores are skipped — the Score field is free text, so not every entry
// is guaranteed to be a plottable number.
function renderProgressChart(progress) {
  const section = document.getElementById("prog-chartSection");
  const numeric = progress.filter(p => p.date && p.score !== "" && !isNaN(Number(p.score)));
  if (numeric.length === 0) {
    section.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No numeric progress entries to chart yet.</span></div>';
    return;
  }

  const byObjective = {};
  const order = [];
  numeric.forEach(p => {
    const key = p.objText || "Unlabeled";
    if (!byObjective[key]) { byObjective[key] = []; order.push(key); }
    byObjective[key].push({ date: p.date, score: Number(p.score) });
  });
  order.forEach(key => byObjective[key].sort((a, b) => a.date.localeCompare(b.date)));

  const allDates = [...new Set(numeric.map(p => p.date))].sort();

  section.innerHTML = `<div class="chart-wrap wide"><canvas id="prog-chart"></canvas></div>`;
  destroyChart("prog-chart");
  const datasets = order.map(key => {
    const color = colorForDomain(key);
    const byDate = {};
    byObjective[key].forEach(p => { byDate[p.date] = p.score; });
    return {
      label: key.length > 40 ? key.slice(0, 38) + "…" : key,
      data: allDates.map(d => (d in byDate ? byDate[d] : null)),
      borderColor: color, backgroundColor: hexToRgba(color, 0.12),
      pointBackgroundColor: color, pointBorderColor: "#fff", pointBorderWidth: 2,
      pointRadius: 5, pointHoverRadius: 7, borderWidth: 3, spanGaps: true, tension: 0.3, fill: false
    };
  });
  chartInstances["prog-chart"] = new Chart(document.getElementById("prog-chart").getContext("2d"), {
    type: "line",
    data: { labels: allDates, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      scales: { y: { title: { display: true, text: "Score" } }, x: { grid: { display: false } } },
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { title: items => items[0]?.label || "" } } }
    }
  });
}

async function addProgress() {
  const objText = document.getElementById("prog-objText").value;
  const date = document.getElementById("prog-date").value;
  const measure = document.getElementById("prog-measure").value.trim();
  const score = document.getElementById("prog-score").value.trim();

  if (!objText || !measure || !score) {
    setStatus("prog-status", "Please select an objective and fill in Measure and Score.", "error");
    return;
  }
  setStatus("prog-status", "Saving...", "loading");
  try {
    await apiCall("addProgress", { objText, date, measure, score });
    setStatus("prog-status", "Entry saved.", "success");
    document.getElementById("prog-measure").value = "";
    document.getElementById("prog-score").value = "";
    loadProgress();
  } catch (e) {
    setStatus("prog-status", "Error: " + e.message, "error");
  }
}
