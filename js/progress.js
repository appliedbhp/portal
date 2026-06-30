// Progress section — reads/writes data_prog, linked to tbl_plan goals by OBJ_TEXT.

function initProgressSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-graph-up"></i>Progress</h1>
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
  } catch (e) {
    document.getElementById("prog-body").innerHTML = `<tr><td colspan="4">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
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
