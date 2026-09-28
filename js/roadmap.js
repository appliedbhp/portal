// Roadmap Assessment section — ported from roadmap_assessment_form_v2.html.
// Login/PIN gating now happens once at the portal level (login.html); this
// section only handles picking a Level, scoring, reviewing, submitting, and
// showing results/history for the already-authenticated client.

const ROADMAP_VERSION = "3.0";
const ROADMAP_SCHOOL_SCALE = ["Not Yet Observed", "Emerging", "Developing With Support", "Established / Independent"];
const ROADMAP_RELIABILITY_SCALE = ["Not Yet Reliable", "Reliable With Support", "Reliable Independently"];
const ROADMAP_DOMAINS = [
  { name:"Executive Function", sections:["A","B","C","D"], subdomains:["Planning and Prioritizing","Initiating and Persisting","Follow Through and Wrapping Up","Organization"] },
  { name:"Emotional Regulation", sections:["E","F","G","H"], subdomains:["Problem Solving","Self-Encouragement","Self-Management","Repair and Recovery"] },
  { name:"Life and Classroom Skills", sections:["I","J","K","L"], subdomains:["Money Management","Relationship Management","Time and Project Management","Routines and Goal-Directed Persistence"] },
  { name:"Social Skills", sections:["M","N","O","P"], subdomains:["Rejection Sensitivity","Peer Pressure","Speaker","Listener"] }
];

let roadmapItems = [];
let roadmapDomainOrder = [];
let roadmapLastSummary = [];
let roadmapSubdomainDomainMap = null;
let roadmapSelectedForm = "Elementary";

function rmIsReliabilityForm(level=roadmapSelectedForm){ return ["Preschool","Adult"].includes(String(level).split(" · ")[0]); }
function rmScale(level=roadmapSelectedForm){ return rmIsReliabilityForm(level) ? ROADMAP_RELIABILITY_SCALE : ROADMAP_SCHOOL_SCALE; }
function rmStoredLevel(level=roadmapSelectedForm){ return `${String(level).split(" · ")[0]} · v${ROADMAP_VERSION}`; }
function rmMaxScore(level=roadmapSelectedForm){ return /v3\.0/.test(level)||!["Elementary","Middle School","High School"].includes(level) ? (rmIsReliabilityForm(level)?2:3) : 5; }
function rmAreaItemCount(level=roadmapSelectedForm){ return rmIsReliabilityForm(level) ? 10 : 5; }

function initRoadmapSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-signpost-split-fill"></i>Roadmap Assessment</h1>
      <div class="row">
        <label>Level</label>
        <select id="rm-level">
          <option value="Preschool">Preschool (approximately ages 3–5)</option>
          <option value="Elementary">Elementary</option>
          <option value="Middle School">Middle School</option>
          <option value="High School">High School</option>
          <option value="Adult">Adult life applications</option>
        </select>
      </div>
      <button onclick="rmStart()"><i class="bi bi-play-fill"></i> Start / Restart Assessment</button>
      <div id="rm-status"></div>
    </div>

    <div id="rm-history" class="card">
      <h2><i class="bi bi-clock-history"></i>Past Assessments</h2>
      <div id="rm-historyBody">Loading...</div>
    </div>

    <div id="rm-assessment" class="card" style="display:none;">
      <div class="scale-legend no-print">
        <strong><i class="bi bi-info-circle-fill"></i> Rating Scale</strong>
        <table>
          <tbody id="rm-scale-body"></tbody>
        </table>
      </div>
      <div id="rm-formBody"></div>
      <div class="btn-row"><button onclick="rmReview()"><i class="bi bi-clipboard2-check-fill"></i> Review &amp; Submit</button></div>
    </div>

    <div id="rm-review" class="card" style="display:none;">
      <h2><i class="bi bi-clipboard2-data-fill"></i>Review Scores</h2>
      <table class="summary-table">
        <thead><tr><th>Domain</th><th>Area</th><th>Total</th><th>Mean</th></tr></thead>
        <tbody id="rm-reviewBody"></tbody>
      </table>
      <div class="btn-row no-print">
        <button class="secondary" onclick="rmBackToForm()"><i class="bi bi-arrow-left"></i> Back</button>
        <button onclick="rmSubmit()"><i class="bi bi-cloud-upload-fill"></i> Submit</button>
      </div>
      <div id="rm-submitStatus"></div>
    </div>

    <div id="rm-results" class="card" style="display:none;">
      <div class="results-header">
        <h1><i class="bi bi-clipboard2-pulse-fill"></i>Results</h1>
        <div id="rm-resultsMeta" class="stat-grid"></div>
      </div>
      <div class="section-title"><h3><i class="bi bi-pie-chart-fill"></i> Domain / Subdomain Wheel</h3></div>
      <div id="rm-currentNav" class="carousel-nav no-print"></div>
      <div class="chart-wrap"><canvas id="rm-currentWheel"></canvas></div>
      <div id="rm-currentWheelLegend" class="domain-legend"></div>
      <div class="section-title"><h3><i class="bi bi-bar-chart-fill"></i> Area totals</h3></div>
      <div class="chart-wrap wide"><canvas id="rm-currentBar"></canvas></div>
      <div class="section-title"><h3><i class="bi bi-table"></i> This Assessment</h3></div>
      <table class="summary-table">
        <thead><tr><th>Domain</th><th>Area</th><th>Total</th><th>Mean</th></tr></thead>
        <tbody id="rm-resultsBody"></tbody>
      </table>
      <div id="rm-comparisonSection"></div>
      <div class="btn-row no-print" style="margin-top:20px;"><button onclick="window.print()"><i class="bi bi-printer-fill"></i> Print to PDF</button></div>
    </div>
  `;
  rmLoadHistory();
}

async function rmBuildSnapshotsFromHistory() {
  const domainMap = await getSubdomainDomainMap();
  const { history } = await apiCall("getHistory", { type: "roadmap" });
  const byKey = {};
  history.forEach(h => {
    if (!byKey[h.assessmentKey]) byKey[h.assessmentKey] = { date: h.date, level: h.level, summary: [] };
    byKey[h.assessmentKey].summary.push({ domain: h.domain || domainMap[h.subdomain] || "Uncategorized", subdomain: h.subdomain, total: h.total, mean: h.mean });
  });
  const order = Object.keys(byKey).sort((a, b) => (byKey[a].date || "").localeCompare(byKey[b].date || ""));
  return order.map(k => ({ key: k, date: byKey[k].date, level: byKey[k].level, summary: byKey[k].summary }));
}

async function rmLoadHistory() {
  const body = document.getElementById("rm-historyBody");
  try {
    const snapshots = await rmBuildSnapshotsFromHistory();
    if (snapshots.length === 0) {
      body.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No assessments on file yet for this client.</span></div>';
      return;
    }
    body.innerHTML = `
      <div class="section-title"><h3><i class="bi bi-pie-chart-fill"></i> Domain / Subdomain Wheel</h3></div>
      <div id="rm-histNav" class="carousel-nav no-print"></div>
      <div class="chart-wrap"><canvas id="rm-histWheel"></canvas></div>
      <div id="rm-histWheelLegend" class="domain-legend"></div>
      <div class="section-title"><h3><i class="bi bi-bar-chart-fill"></i> Subdomain Totals (0-25)</h3></div>
      <div class="chart-wrap wide"><canvas id="rm-histBar"></canvas></div>
      <div id="rm-histCompare"></div>
      <div id="rm-histTrendSection"></div>
    `;
    setupCarousel("rm-hist", snapshots, snapshots.length - 1, { wheel: rmRenderWheelChart, bar: rmRenderBarChart });
    const latest=snapshots.at(-1), compatible=snapshots.filter(snapshot=>snapshot.level===latest.level);
    if (compatible.length > 1) {
      rmRenderAnimatedComparison(compatible.at(-2), compatible.at(-1), "rm-histCompare");
      rmRenderDomainTrend(compatible, "rm-histTrendSection", "rm-histTrend");
    }
  } catch (e) {
    body.innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load history: ${escapeHtml(e.message)}</span></div>`;
  }
}

function rmRenderAnimatedComparison(previous, current, containerId) {
  const el = document.getElementById(containerId);
  if (!el || !previous || !current) return;
  const prev = rmNormalizedDomainTotals(previous.summary, previous.level), curr = rmNormalizedDomainTotals(current.summary, current.level);
  const domains = [...new Set([...Object.keys(prev), ...Object.keys(curr)])];
  el.innerHTML = `<div class="assessment-compare">
    <div class="viz-section-title"><i class="bi bi-arrow-left-right gradient-icon"></i><strong>Animated comparison</strong><span style="margin-left:auto;font-size:10px;color:var(--muted);">${escapeHtml(previous.date)} → ${escapeHtml(current.date)}</span></div>
    <div class="compare-grid">${domains.map(domain => {
      const before=prev[domain]||0, now=curr[domain]||0, delta=now-before;
      const tone=delta>0?"better":delta<0?"worse":"steady";
      return `<div class="compare-item"><div class="compare-item-head"><span>${escapeHtml(domain)}</span><span class="compare-delta ${tone}">${delta>0?"+":""}${delta.toFixed(1)}</span></div><div class="compare-track"><div class="compare-fill" style="--width:${Math.max(0,Math.min(100,now))}%"></div></div><small style="font-size:9px;color:var(--muted);">${before.toFixed(1)} → ${now.toFixed(1)} / 100</small></div>`;
    }).join("")}</div></div>`;
}

function rmShow(id) {
  ["rm-assessment", "rm-review", "rm-results"].forEach(s => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
}

async function getSubdomainDomainMap() {
  if (roadmapSubdomainDomainMap) return roadmapSubdomainDomainMap;
  const map = {};
  ROADMAP_DOMAINS.forEach(group=>group.subdomains.forEach(name=>map[name]=group.name));
  try {
    const { items } = await apiCall("getRoadmapItems", { level: null });
    items.forEach(it => { if (it.subdomain && it.domain && !map[it.subdomain]) map[it.subdomain] = it.domain; });
  } catch (_) {}
  roadmapSubdomainDomainMap = map;
  return map;
}

async function rmLoadV3Items(level) {
  const reliability = rmIsReliabilityForm(level);
  const response = await fetch(reliability ? "assets/roadmap-v3-reliability.json" : "assets/roadmap-v3-school.json");
  if (!response.ok) throw new Error("Could not load the Version 3 assessment definitions.");
  const definitions = await response.json();
  if (reliability) {
    return (definitions[level] || []).flatMap((area, areaIndex) => area.items.map((description, itemIndex) => ({
      id:`${level[0]}-${areaIndex}-${itemIndex}`, domain:area.name, subdomain:area.name,
      item:areaIndex*10+itemIndex+1, description
    })));
  }
  const form = definitions[level] || {};
  return ROADMAP_DOMAINS.flatMap(group => group.sections.flatMap((section, index) =>
    (form[section] || []).map((description, itemIndex) => ({
      id:`${section}-${itemIndex}`, domain:group.name, subdomain:group.subdomains[index],
      item:(section.charCodeAt(0)-65)*5+itemIndex+1, description
    }))
  ));
}

function rmRenderScaleGuide() {
  const scale=rmScale(), body=document.getElementById("rm-scale-body"); if(!body)return;
  const descriptions=rmIsReliabilityForm()
    ? ["The skill is not dependable yet, even with ordinary support.","The skill is dependable with a cue, prompt, model, help, or unusual urgency.","The skill is dependable using self-managed routines, tools, or accommodations without repeated prompting."]
    : ["Relevant opportunities occurred, but the skill was not yet demonstrated.","The skill is inconsistent, limited to some situations, or needs substantial prompting or modeling.","The skill appears in familiar situations but still benefits from reminders or support.","The skill is independent and consistent in most relevant situations and with most relevant people."];
  body.innerHTML=scale.map((label,n)=>`<tr><td class="num">${n}</td><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(descriptions[n])}</td></tr>`).join("")+
    `<tr><td class="num">N/O</td><td class="label">Not observed</td><td>There has not been enough opportunity or information to assign a rating. N/O is excluded from scoring.</td></tr>`;
}

async function rmStart() {
  const level = document.getElementById("rm-level").value;
  roadmapSelectedForm = level;
  setStatus("rm-status", "Loading items...", "loading");
  try {
    roadmapItems = (await rmLoadV3Items(level)).sort((a, b) => a.item - b.item);
    if (!roadmapItems.length) throw new Error("No Version 3 items were found for this form.");
    rmRenderScaleGuide();
    setStatus("rm-status", "", null);
    rmRenderForm();
    rmShow("rm-assessment");
  } catch (e) {
    setStatus("rm-status", "Error: " + e.message, "error");
  }
}

function rmRenderForm() {
  const grouped = {};
  roadmapDomainOrder = [];
  for (const item of roadmapItems) {
    if (!grouped[item.domain]) { grouped[item.domain] = {}; roadmapDomainOrder.push(item.domain); }
    if (!grouped[item.domain][item.subdomain]) grouped[item.domain][item.subdomain] = [];
    grouped[item.domain][item.subdomain].push(item);
  }
  let html = "";
  for (const domain of roadmapDomainOrder) {
    html += `<div class="domain"><h2>${escapeHtml(domain)}</h2>`;
    for (const subdomain of Object.keys(grouped[domain])) {
      html += `<div class="subdomain"><h3>${escapeHtml(subdomain)}</h3>`;
      for (const item of grouped[domain][subdomain]) {
        html += `<div class="item">
          <span>${escapeHtml(item.description)}</span>
          <div class="pills" data-domain="${escapeHtml(domain)}" data-subdomain="${escapeHtml(subdomain)}" data-value="">
            ${rmScale().map((label,n) => `<button type="button" class="pill" data-val="${n}" title="${n} - ${escapeAttr(label)}">${n}</button>`).join("")}
            <button type="button" class="pill rm-no-observation" data-val="unknown" title="Not observed or insufficient opportunity">N/O</button>
          </div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  document.getElementById("rm-formBody").innerHTML = html;
}

document.addEventListener("click", (e) => {
  const pill = e.target.closest("#rm-formBody .pill");
  if (!pill) return;
  const group = pill.closest(".pills");
  group.dataset.value = pill.dataset.val;
  group.querySelectorAll(".pill").forEach(p => p.classList.toggle("active", p === pill));
});

function rmCollectScores() {
  const groups = document.querySelectorAll("#rm-formBody .pills");
  const bySubdomain = {};
  let missing = 0;
  groups.forEach(g => {
    const domain = g.dataset.domain, subdomain = g.dataset.subdomain;
    const key = domain + "||" + subdomain;
    if (!bySubdomain[key]) bySubdomain[key] = { domain, subdomain, scores: [] };
    if (g.dataset.value === "") { missing++; return; }
    if (g.dataset.value === "unknown") return;
    bySubdomain[key].scores.push(Number(g.dataset.value));
  });
  return { bySubdomain, missing };
}

function rmReview() {
  const { bySubdomain, missing } = rmCollectScores();
  if (missing > 0 && !confirm(`${missing} item(s) are unscored and will be excluded from totals. Continue?`)) return;
  roadmapLastSummary = Object.values(bySubdomain).map(s => {
    const total = s.scores.reduce((a, b) => a + b, 0);
    const mean = s.scores.length ? total / s.scores.length : 0;
    return { domain: s.domain, subdomain: s.subdomain, total, mean: Math.round(mean * 100) / 100 };
  });
  document.getElementById("rm-reviewBody").innerHTML = roadmapLastSummary.map(s =>
    `<tr><td>${escapeHtml(s.domain)}</td><td>${escapeHtml(s.subdomain)}</td><td>${s.total} / ${rmAreaItemCount()*rmMaxScore()}</td><td>${s.mean} / ${rmMaxScore()}</td></tr>`
  ).join("");
  rmShow("rm-review");
}

function rmBackToForm() { rmShow("rm-assessment"); }

async function rmSubmit() {
  const level = rmStoredLevel(document.getElementById("rm-level").value);
  setStatus("rm-submitStatus", "Submitting...", "loading");
  try {
    const { assessmentKey, date } = await apiCall("submitRoadmap", { level, summary: roadmapLastSummary });
    setStatus("rm-submitStatus", `Saved! Assessment key: ${assessmentKey}`, "success");
    await rmShowResults(level, assessmentKey, date);
    rmLoadHistory();
  } catch (e) {
    setStatus("rm-submitStatus", "Error: " + e.message, "error");
  }
}

async function rmShowResults(level, assessmentKey, date) {
  document.getElementById("rm-resultsMeta").innerHTML =
    statCard("person-badge-fill", "Client ID", getClientId()) +
    statCard("mortarboard-fill", "Level", level) +
    statCard("clipboard-check-fill", "Assessor", getAssessorName()) +
    statCard("calendar3", "Date", date) +
    statCard("hash", "Assessment Key", assessmentKey);

  document.getElementById("rm-resultsBody").innerHTML = roadmapLastSummary.map(s =>
    `<tr><td>${escapeHtml(s.domain)}</td><td>${escapeHtml(s.subdomain)}</td><td>${s.total} / ${rmAreaItemCount(level)*rmMaxScore(level)}</td><td>${s.mean} / ${rmMaxScore(level)}</td></tr>`
  ).join("");
  document.getElementById("rm-comparisonSection").innerHTML = "";

  try {
    const domainMap = await getSubdomainDomainMap();
    const { history } = await apiCall("getHistory", { type: "roadmap" });
    const past = history.filter(h => h.assessmentKey !== assessmentKey);
    const byKey = {};
    past.forEach(h => {
      if (!byKey[h.assessmentKey]) byKey[h.assessmentKey] = { date: h.date, level: h.level, summary: [] };
      byKey[h.assessmentKey].summary.push({ domain: h.domain, subdomain: h.subdomain, total: h.total, mean: h.mean });
    });
    const order = Object.keys(byKey).sort((a, b) => (byKey[a].date || "").localeCompare(byKey[b].date || ""));
    const snapshots = order.map(k => ({ key: k, date: byKey[k].date, level: byKey[k].level, summary: byKey[k].summary }))
      .filter(snapshot => snapshot.level === level);
    snapshots.push({ key: assessmentKey, date, level, summary: roadmapLastSummary });

    setupCarousel("rm-current", snapshots, snapshots.length - 1, { wheel: rmRenderWheelChart, bar: rmRenderBarChart });

    if (snapshots.length > 1) {
      document.getElementById("rm-comparisonSection").innerHTML = `<div id="rm-currentCompare"></div><div id="rm-currentTrendWrap"></div>`;
      rmRenderAnimatedComparison(snapshots.at(-2), snapshots.at(-1), "rm-currentCompare");
      rmRenderDomainTrend(snapshots, "rm-currentTrendWrap", "rm-currentTrend");
    } else {
      document.getElementById("rm-comparisonSection").innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle-fill"></i><span>No previous assessments on file yet.</span></div>';
    }
  } catch (e) {
    document.getElementById("rm-comparisonSection").innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load history: ${escapeHtml(e.message)}</span></div>`;
  }

  rmShow("rm-results");
}

function rmDomainTotalsFor(summary) {
  const out = {};
  summary.forEach(s => { out[s.domain] = (out[s.domain] || 0) + (s.total || 0); });
  return out;
}

function rmNormalizedDomainTotals(summary, level) {
  const totals=rmDomainTotalsFor(summary), counts={};
  summary.forEach(s=>counts[s.domain]=(counts[s.domain]||0)+1);
  Object.keys(totals).forEach(domain=>{const maximum=counts[domain]*rmAreaItemCount(level)*rmMaxScore(level);totals[domain]=maximum?Math.round(totals[domain]/maximum*1000)/10:0;});
  return totals;
}

function rmRenderDomainTrend(snapshots, containerId, canvasId) {
  snapshots.forEach(s => { s.domainTotals = rmNormalizedDomainTotals(s.summary, s.level); });
  const domains = [...new Set(snapshots.flatMap(s => Object.keys(s.domainTotals)))];
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="section-title"><h3><i class="bi bi-graph-up-arrow"></i> Domain Progress Over Time (0-100% of available points)</h3></div>
    <div class="chart-wrap wide"><canvas id="${canvasId}"></canvas></div>
  `;
  const labels = snapshots.map(s => `${s.date} (${s.level})`);
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
      animation: { duration: 1100, easing: "easeOutQuart" },
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      scales: { y: { min: 0, max: 100, title: { display: true, text: "Available points (%)" } }, x: { grid: { display: false } } },
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function rmShortSubdomainLabel(subdomain) {
  const m = /^([A-Za-z])\.\s*/.exec(subdomain || "");
  if (m) return m[1] + ".";
  return subdomain && subdomain.length > 14 ? subdomain.slice(0, 12) + "…" : subdomain;
}

function rmBuildOrderedSummary(summary) {
  const byDomain = {}; const order = [];
  summary.forEach(s => { if (!byDomain[s.domain]) { byDomain[s.domain] = []; order.push(s.domain); } byDomain[s.domain].push(s); });
  const ordered = []; const groups = [];
  order.forEach(domain => {
    const items = byDomain[domain].sort((a, b) => a.subdomain.localeCompare(b.subdomain));
    groups.push({ domain, startIndex: ordered.length, count: items.length, color: colorForDomain(domain) });
    ordered.push(...items);
  });
  return { ordered, groups };
}

function rmRenderWheelChart(canvasId, legendId, summary, snapshot={}) {
  const { ordered, groups } = rmBuildOrderedSummary(summary);
  const labels = ordered.map(s => s.subdomain);
  const data = ordered.map(s => s.mean);
  const pointColors = ordered.map(s => colorForDomain(s.domain));
  destroyChart(canvasId);
  chartInstances[canvasId] = new Chart(document.getElementById(canvasId).getContext("2d"), {
    type: "radar",
    data: { labels, datasets: [{ label: "Mean Score", data, borderColor: "#3185fc", backgroundColor: hexToRgba("#3185fc", 0.22), pointBackgroundColor: pointColors, pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3 }] },
    options: {
      animation: { duration: 1200, easing: "easeOutQuart" },
      responsive: true, maintainAspectRatio: false,
      scales: { r: { min: 0, max: rmMaxScore(snapshot.level), ticks: { stepSize: 1 }, pointLabels: { font: { size: 11, weight: 600 }, callback: l => rmShortSubdomainLabel(l) } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => items[0]?.label || "" } } }
    }
  });
  const legendEl = document.getElementById(legendId);
  if (legendEl) legendEl.innerHTML = groups.map(g => `<span><span class="swatch" style="background:${g.color}"></span>${escapeHtml(g.domain)}</span>`).join("");
}

function rmRenderBarChart(canvasId, summary, snapshot={}) {
  const ordered = [...summary].sort((a, b) => a.subdomain.localeCompare(b.subdomain));
  const labels = ordered.map(s => s.subdomain);
  const data = ordered.map(s => s.total);
  const colors = ordered.map(s => colorForDomain(s.domain));
  destroyChart(canvasId);
  chartInstances[canvasId] = new Chart(document.getElementById(canvasId).getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Score Total", data, backgroundColor: colors, borderRadius: 6, maxBarThickness: 46 }] },
    options: {
      animation: { duration: 1000, easing: "easeOutBounce" },
      responsive: true, maintainAspectRatio: false,
      scales: { y: { min: 0, max: rmAreaItemCount(snapshot.level)*rmMaxScore(snapshot.level), title: { display: true, text: `Area total (0-${rmAreaItemCount(snapshot.level)*rmMaxScore(snapshot.level)})` } }, x: { ticks: { autoSkip: false, maxRotation: 0, callback: function (v) { return rmShortSubdomainLabel(this.getLabelForValue(v)); } } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => items[0]?.label || "" } } }
    }
  });
}
