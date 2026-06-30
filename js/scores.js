// Standardized Scores section — BRIEF-2 T-scores and ESQR scores, both keyed
// to scores_brief / scores_esqr sheets.

const BRIEF_FIELDS = [
  ["T_SCORE_INHIBIT", "Inhibit"], ["T_SCORE_SELF_MON", "Self-Monitor"], ["T_SCORE_BRI", "BRI"],
  ["T_SCORE_SHIFT", "Shift"], ["T_SCORE_EMO_CONT", "Emotional Control"], ["T_SCORE_INITIATE", "Initiate"],
  ["T_SCORE_WORKING_MEM", "Working Memory"], ["T_SCORE_PLAN_ORG", "Plan/Organize"], ["T_SCORE_TASK_MON", "Task Monitor"],
  ["T_SCORE_ORG_MAT", "Organization of Materials"], ["T_SCORE_CRI", "CRI"], ["T_SCORE_GEC", "GEC"]
];
const ESQR_FIELDS = [
  ["SCORE_AVE_TOT", "Average Total"], ["SCORE_PLAN_MAN", "Planning/Management"], ["SCORE_TIME_MAN", "Time Management"],
  ["SCORE_ORG", "Organization"], ["SCORE_EMO_REG", "Emotional Regulation"], ["SCORE_BEH_REG", "Behavioral Regulation"]
];

function initScoresSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-clipboard2-data-fill"></i>Standardized Scores</h1>
      <div class="btn-row no-print">
        <button id="scores-tab-brief" onclick="scoresSwitchTab('brief')">BRIEF-2</button>
        <button id="scores-tab-esqr" class="secondary" onclick="scoresSwitchTab('esqr')">ESQR</button>
      </div>
      <table class="summary-table" style="margin-top:16px;">
        <thead id="scores-head"></thead>
        <tbody id="scores-body"><tr><td>Loading...</td></tr></tbody>
      </table>
    </div>

    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i>Add Scores</h2>
      <div id="scores-form"></div>
      <button onclick="addScores()"><i class="bi bi-save-fill"></i> Save Scores</button>
      <div id="scores-status"></div>
    </div>
  `;
  scoresSwitchTab("brief");
}

let scoresCurrentType = "brief";

function scoresFieldsFor(type) {
  return type === "esqr" ? ESQR_FIELDS : BRIEF_FIELDS;
}

function scoresSwitchTab(type) {
  scoresCurrentType = type;
  document.getElementById("scores-tab-brief").className = type === "brief" ? "" : "secondary";
  document.getElementById("scores-tab-esqr").className = type === "esqr" ? "" : "secondary";

  const fields = scoresFieldsFor(type);
  document.getElementById("scores-head").innerHTML = `<tr><th>Date</th><th>Assessor</th>${fields.map(f => `<th>${f[1]}</th>`).join("")}</tr>`;
  document.getElementById("scores-form").innerHTML = fields.map(f =>
    `<div class="row"><label>${f[1]}</label><input id="scores-field-${f[0]}" type="text" placeholder="0-100" style="max-width:160px;"></div>`
  ).join("");

  loadScores();
}

async function loadScores() {
  const tbody = document.getElementById("scores-body");
  tbody.innerHTML = `<tr><td>Loading...</td></tr>`;
  try {
    const { scores } = await apiCall("getScores", { type: scoresCurrentType });
    const fields = scoresFieldsFor(scoresCurrentType);
    tbody.innerHTML = scores.length
      ? scores.map(s => `<tr><td>${escapeHtml(s.DATE_ASSESSMENT)}</td><td>${escapeHtml(s.ASSESSOR)}</td>${fields.map(f => `<td>${escapeHtml(s[f[0]])}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${fields.length + 2}">No scores on file yet.</td></tr>`;
  } catch (e) {
    tbody.innerHTML = `<tr><td>Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function addScores() {
  const fields = scoresFieldsFor(scoresCurrentType);
  const values = {};
  fields.forEach(f => { values[f[0]] = document.getElementById("scores-field-" + f[0]).value.trim(); });

  setStatus("scores-status", "Saving...", "loading");
  try {
    await apiCall("addScores", { type: scoresCurrentType, fields: values });
    setStatus("scores-status", "Scores saved.", "success");
    fields.forEach(f => { document.getElementById("scores-field-" + f[0]).value = ""; });
    loadScores();
  } catch (e) {
    setStatus("scores-status", "Error: " + e.message, "error");
  }
}
