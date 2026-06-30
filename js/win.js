// "What I Need" (WIN) Assessment section — ported from win_assessment_form.html.
// 7 flat domains, 4 items each, reversed 1-5 scale (1=handled, 5=major challenge),
// per-domain free-text comments.

let winItems = [];
let winDomainOrder = [];
let winLastSummary = [];
let winDomainNumberMap = null;

function initWinSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-heart-pulse-fill"></i>What I Need (WIN) Assessment</h1>
      <button onclick="winStart()"><i class="bi bi-play-fill"></i> Start / Restart Assessment</button>
      <div id="win-status"></div>
    </div>

    <div id="win-history" class="card">
      <h2><i class="bi bi-clock-history"></i>Past Assessments</h2>
      <div id="win-historyBody">Loading...</div>
    </div>

    <div id="win-assessment" class="card" style="display:none;">
      <div class="scale-legend no-print">
        <strong><i class="bi bi-info-circle-fill"></i> Rating Scale</strong>
        <div class="scale-legend-row">
          <span class="scale-chip"><b>1</b> I've got this handled</span>
          <span class="scale-chip"><b>2</b> Could use a little help</span>
          <span class="scale-chip"><b>3</b> Somewhat struggling here</span>
          <span class="scale-chip"><b>4</b> Really need support</span>
          <span class="scale-chip"><b>5</b> This is a major challenge for me</span>
        </div>
      </div>
      <div id="win-formBody"></div>
      <div class="btn-row"><button onclick="winReview()"><i class="bi bi-clipboard2-check-fill"></i> Review &amp; Submit</button></div>
    </div>

    <div id="win-review" class="card" style="display:none;">
      <h2><i class="bi bi-clipboard2-data-fill"></i>Review Scores</h2>
      <table class="summary-table">
        <thead><tr><th>Domain</th><th>Total (4-20)</th><th>Mean (1-5)</th><th>Comments</th></tr></thead>
        <tbody id="win-reviewBody"></tbody>
      </table>
      <div class="btn-row no-print">
        <button class="secondary" onclick="winBackToForm()"><i class="bi bi-arrow-left"></i> Back</button>
        <button onclick="winSubmit()"><i class="bi bi-cloud-upload-fill"></i> Submit</button>
      </div>
      <div id="win-submitStatus"></div>
    </div>

    <div id="win-results" class="card" style="display:none;">
      <div class="results-header">
        <h1><i class="bi bi-clipboard2-pulse-fill"></i>Results</h1>
        <div id="win-resultsMeta" class="stat-grid"></div>
      </div>
      <div class="section-title"><h3><i class="bi bi-pie-chart-fill"></i> Domain Wheel</h3></div>
      <div id="win-currentNav" class="carousel-nav no-print"></div>
      <div class="chart-wrap"><canvas id="win-currentWheel"></canvas></div>
      <div id="win-currentWheelLegend" class="domain-legend"></div>
      <div class="section-title"><h3><i class="bi bi-bar-chart-fill"></i> Domain Totals (4-20)</h3></div>
      <div class="chart-wrap wide"><canvas id="win-currentBar"></canvas></div>
      <div class="section-title"><h3><i class="bi bi-table"></i> This Assessment</h3></div>
      <table class="summary-table">
        <thead><tr><th>Domain</th><th>Total (4-20)</th><th>Mean (1-5)</th><th>Comments</th></tr></thead>
        <tbody id="win-resultsBody"></tbody>
      </table>
      <div id="win-comparisonSection"></div>
      <div class="btn-row no-print" style="margin-top:20px;"><button onclick="window.print()"><i class="bi bi-printer-fill"></i> Print to PDF</button></div>
    </div>
  `;
  winLoadHistory();
}

async function winBuildSnapshotsFromHistory() {
  await getWinDomainNumberMap();
  const { history } = await apiCall("getHistory", { type: "win" });
  const byKey = {};
  history.forEach(h => {
    if (!byKey[h.assessmentKey]) byKey[h.assessmentKey] = { date: h.date, summary: [] };
    byKey[h.assessmentKey].summary.push({ domainNumber: h.domainNumber, domain: h.domain, total: h.total, mean: h.mean, comments: h.comments });
  });
  const order = Object.keys(byKey).sort((a, b) => (byKey[a].date || "").localeCompare(byKey[b].date || ""));
  return order.map(k => ({ key: k, date: byKey[k].date, summary: byKey[k].summary }));
}

async function winLoadHistory() {
  const body = document.getElementById("win-historyBody");
  try {
    const snapshots = await winBuildSnapshotsFromHistory();
    if (snapshots.length === 0) {
      body.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No assessments on file yet for this client.</span></div>';
      return;
    }
    body.innerHTML = `
      <div class="section-title"><h3><i class="bi bi-pie-chart-fill"></i> Domain Wheel</h3></div>
      <div id="win-histNav" class="carousel-nav no-print"></div>
      <div class="chart-wrap"><canvas id="win-histWheel"></canvas></div>
      <div id="win-histWheelLegend" class="domain-legend"></div>
      <div class="section-title"><h3><i class="bi bi-bar-chart-fill"></i> Domain Totals (4-20)</h3></div>
      <div class="chart-wrap wide"><canvas id="win-histBar"></canvas></div>
      <div id="win-histTrendSection"></div>
    `;
    setupCarousel("win-hist", snapshots, snapshots.length - 1, { wheel: winRenderWheelChart, bar: winRenderBarChart });
    if (snapshots.length > 1) {
      winRenderDomainTrend(snapshots, "win-histTrendSection", "win-histTrend");
    }
  } catch (e) {
    body.innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load history: ${escapeHtml(e.message)}</span></div>`;
  }
}

function winShow(id) {
  ["win-assessment", "win-review", "win-results"].forEach(s => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
}

async function getWinDomainNumberMap() {
  if (winDomainNumberMap) return winDomainNumberMap;
  const { items } = await apiCall("getWinItems", {});
  const map = {};
  items.forEach(it => { if (it.domainNumber !== undefined && it.domain && !(it.domainNumber in map)) map[it.domainNumber] = it.domain; });
  winDomainNumberMap = map;
  return map;
}

async function winStart() {
  setStatus("win-status", "Loading items...", "loading");
  try {
    const { items } = await apiCall("getWinItems", {});
    winItems = items.slice().sort((a, b) => parseFloat(a.item) - parseFloat(b.item));
    setStatus("win-status", "", null);
    winRenderForm();
    winShow("win-assessment");
  } catch (e) {
    setStatus("win-status", "Error: " + e.message, "error");
  }
}

function winRenderForm() {
  const grouped = {};
  winDomainOrder = [];
  for (const item of winItems) {
    const key = item.domainNumber;
    if (!grouped[key]) { grouped[key] = { domain: item.domain, items: [] }; winDomainOrder.push(key); }
    grouped[key].items.push(item);
  }
  let html = "";
  for (const domainNumber of winDomainOrder) {
    const g = grouped[domainNumber];
    html += `<div class="domain" data-domain-number="${domainNumber}"><h2>${escapeHtml(domainNumber)}. ${escapeHtml(g.domain)}</h2>`;
    for (const item of g.items) {
      html += `<div class="item">
        <span>${escapeHtml(item.description)}</span>
        <div class="pills" data-domain-number="${domainNumber}" data-domain="${escapeHtml(g.domain)}" data-value="">
          ${[1,2,3,4,5].map(n => `<button type="button" class="pill" data-val="${n}" title="${n}">${n}</button>`).join("")}
        </div>
      </div>`;
    }
    html += `<div class="comments-row">
      <label>Comments</label>
      <textarea class="win-domain-comments" data-domain-number="${domainNumber}" placeholder="Anything you want to add about this area..."></textarea>
    </div></div>`;
  }
  document.getElementById("win-formBody").innerHTML = html;
}

document.addEventListener("click", (e) => {
  const pill = e.target.closest("#win-formBody .pill");
  if (!pill) return;
  const group = pill.closest(".pills");
  group.dataset.value = pill.dataset.val;
  group.querySelectorAll(".pill").forEach(p => p.classList.toggle("active", p === pill));
});

function winCollectScores() {
  const groups = document.querySelectorAll("#win-formBody .pills");
  const byDomain = {};
  let missing = 0;
  groups.forEach(g => {
    const domainNumber = g.dataset.domainNumber, domain = g.dataset.domain;
    if (!byDomain[domainNumber]) byDomain[domainNumber] = { domainNumber, domain, scores: [] };
    if (g.dataset.value === "") { missing++; return; }
    byDomain[domainNumber].scores.push(Number(g.dataset.value));
  });
  document.querySelectorAll("#win-formBody .win-domain-comments").forEach(t => {
    const domainNumber = t.dataset.domainNumber;
    if (byDomain[domainNumber]) byDomain[domainNumber].comments = t.value.trim();
  });
  return { byDomain, missing };
}

function winReview() {
  const { byDomain, missing } = winCollectScores();
  if (missing > 0 && !confirm(`${missing} item(s) are unscored and will be excluded from totals. Continue?`)) return;
  winLastSummary = Object.values(byDomain).sort((a, b) => Number(a.domainNumber) - Number(b.domainNumber)).map(s => {
    const total = s.scores.reduce((a, b) => a + b, 0);
    const mean = s.scores.length ? total / s.scores.length : 0;
    return { domainNumber: s.domainNumber, domain: s.domain, total, mean: Math.round(mean * 100) / 100, comments: s.comments || "" };
  });
  document.getElementById("win-reviewBody").innerHTML = winLastSummary.map(s =>
    `<tr><td>${escapeHtml(s.domainNumber)}. ${escapeHtml(s.domain)}</td><td>${s.total}</td><td>${s.mean}</td><td class="comment-cell">${escapeHtml(s.comments)}</td></tr>`
  ).join("");
  winShow("win-review");
}

function winBackToForm() { winShow("win-assessment"); }

async function winSubmit() {
  setStatus("win-submitStatus", "Submitting...", "loading");
  try {
    const { assessmentKey, date } = await apiCall("submitWin", { summary: winLastSummary });
    setStatus("win-submitStatus", `Saved! Assessment key: ${assessmentKey}`, "success");
    await winShowResults(assessmentKey, date);
    winLoadHistory();
  } catch (e) {
    setStatus("win-submitStatus", "Error: " + e.message, "error");
  }
}

async function winShowResults(assessmentKey, date) {
  document.getElementById("win-resultsMeta").innerHTML =
    statCard("person-badge-fill", "Client ID", getClientId()) +
    statCard("clipboard-check-fill", "Assessor", getAssessorName()) +
    statCard("calendar3", "Date", date) +
    statCard("hash", "Assessment Key", assessmentKey);

  document.getElementById("win-resultsBody").innerHTML = winLastSummary.map(s =>
    `<tr><td>${escapeHtml(s.domainNumber)}. ${escapeHtml(s.domain)}</td><td>${s.total}</td><td>${s.mean}</td><td class="comment-cell">${escapeHtml(s.comments)}</td></tr>`
  ).join("");
  document.getElementById("win-comparisonSection").innerHTML = "";

  try {
    await getWinDomainNumberMap();
    const { history } = await apiCall("getHistory", { type: "win" });
    const past = history.filter(h => h.assessmentKey !== assessmentKey);
    const byKey = {};
    past.forEach(h => {
      if (!byKey[h.assessmentKey]) byKey[h.assessmentKey] = { date: h.date, summary: [] };
      byKey[h.assessmentKey].summary.push({ domainNumber: h.domainNumber, domain: h.domain, total: h.total, mean: h.mean, comments: h.comments });
    });
    const order = Object.keys(byKey).sort((a, b) => (byKey[a].date || "").localeCompare(byKey[b].date || ""));
    const snapshots = order.map(k => ({ key: k, date: byKey[k].date, summary: byKey[k].summary }));
    snapshots.push({ key: assessmentKey, date, summary: winLastSummary });

    setupCarousel("win-current", snapshots, snapshots.length - 1, { wheel: winRenderWheelChart, bar: winRenderBarChart });

    if (snapshots.length > 1) {
      winRenderDomainTrend(snapshots, "win-comparisonSection", "win-currentTrend");
    } else {
      document.getElementById("win-comparisonSection").innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No previous assessments on file yet.</span></div>';
    }
  } catch (e) {
    document.getElementById("win-comparisonSection").innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load history: ${escapeHtml(e.message)}</span></div>`;
  }

  winShow("win-results");
}

function winRenderDomainTrend(snapshots, containerId, canvasId) {
  snapshots.forEach(s => { s.domainTotals = {}; s.summary.forEach(x => { s.domainTotals[x.domain] = x.total || 0; }); });
  const domains = [...new Set(snapshots.flatMap(s => Object.keys(s.domainTotals)))];
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="section-title"><h3><i class="bi bi-graph-up-arrow"></i> Domain Score Trend Over Time (Total 4-20)</h3></div>
    <div class="chart-wrap wide"><canvas id="${canvasId}"></canvas></div>
  `;
  const labels = snapshots.map(s => s.date);
  const datasets = domains.map(domain => {
    const color = colorForDomain(domain);
    return {
      label: domain, data: snapshots.map(s => s.domainTotals[domain] ?? null),
      borderColor: color, backgroundColor: hexToRgba(color, 0.12),
      pointBackgroundColor: color, pointBorderColor: "#fff", pointBorderWidth: 2,
      pointRadius: 5, pointHoverRadius: 7, borderWidth: 3, spanGaps: true, tension: 0.35, fill: true
    };
  });
  destroyChart(canvasId);
  chartInstances[canvasId] = new Chart(document.getElementById(canvasId).getContext("2d"), {
    type: "line", data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      scales: { y: { min: 0, max: 20, title: { display: true, text: "Domain Total (4-20)" } }, x: { grid: { display: false } } },
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function winRenderWheelChart(canvasId, legendId, summary) {
  const ordered = [...summary].sort((a, b) => Number(a.domainNumber) - Number(b.domainNumber));
  const labels = ordered.map(s => s.domain);
  const data = ordered.map(s => s.mean);
  const pointColors = ordered.map(s => colorForDomain(s.domain));
  destroyChart(canvasId);
  chartInstances[canvasId] = new Chart(document.getElementById(canvasId).getContext("2d"), {
    type: "radar",
    data: { labels, datasets: [{ label: "Mean Score", data, borderColor: "#3b6df0", backgroundColor: hexToRgba("#3b6df0", 0.22), pointBackgroundColor: pointColors, pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 1, max: 5, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
  });
  const legendEl = document.getElementById(legendId);
  if (legendEl) legendEl.innerHTML = ordered.map(s => `<span><span class="swatch" style="background:${colorForDomain(s.domain)}"></span>${escapeHtml(s.domain)}</span>`).join("");
}

function winRenderBarChart(canvasId, summary) {
  const ordered = [...summary].sort((a, b) => Number(a.domainNumber) - Number(b.domainNumber));
  const labels = ordered.map(s => s.domain);
  const data = ordered.map(s => s.total);
  const colors = ordered.map(s => colorForDomain(s.domain));
  destroyChart(canvasId);
  chartInstances[canvasId] = new Chart(document.getElementById(canvasId).getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Score Total", data, backgroundColor: colors, borderRadius: 6, maxBarThickness: 46 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 20, title: { display: true, text: "Total (4-20)" } }, x: { ticks: { autoSkip: false, maxRotation: 45 } } }, plugins: { legend: { display: false } } }
  });
}
