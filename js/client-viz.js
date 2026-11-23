// Client Progress Visualization — client-facing view of session activity,
// program completion, and goal engagement.

let _vizCharts = [];

function _vizDestroyCharts() {
  _vizCharts.forEach(c => { try { c.destroy(); } catch (_) {} });
  _vizCharts = [];
}

async function initClientVizSection(root) {
  _vizDestroyCharts();
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-bar-chart-fill"></i> My Progress</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">Loading your progress data…</p>
    </div>`;

  try {
    const [progRes, notesRes, sessRes, planRes] = await Promise.all([
      apiCall("getClientProgram", {}).catch(() => ({ program: null })),
      apiCall("getSessionNotes", {}).catch(() => ({ notes: [] })),
      apiCall("getSessions", {}).catch(() => ({ sessions: [] })),
      apiCall("getPlan", {}).catch(() => ({ goals: [] }))
    ]);

    renderClientViz(root, {
      program:  progRes.program  || null,
      notes:    notesRes.notes   || [],
      sessions: sessRes.sessions || [],
      goals:    planRes.goals    || []
    });
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load progress data: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderClientViz(root, { program, notes, sessions, goals }) {
  _vizDestroyCharts();

  // ── Compute program completion ───────────────────────────────────────────
  const sp = program && program.sessionPlan;
  const allPlanSessions = sp ? (sp.weeks || []).flatMap(w => w.sessions || []) : [];
  const totalSessions   = allPlanSessions.length || 0;

  const noteMap = {};
  notes.forEach(n => { noteMap[n.sessionNum] = n; });
  const loggedCount = Object.keys(noteMap).length;

  const pct = totalSessions > 0 ? Math.round(loggedCount / totalSessions * 100) : 0;

  // On-track calculation (reuse logic from client-program.js)
  let onTrackLabel = "—";
  let onTrackColor = "#6b7280";
  if (program && program.startDate && totalSessions > 0) {
    const start    = cpParseDate_(program.startDate);
    const now      = new Date();
    const daysPast = Math.max(0, Math.floor((now - start) / 86400000));
    const weeksPast = daysPast / 7;
    const expected = Math.round(weeksPast * (sp.sessionsPerWeek || 1));
    const diff     = loggedCount - expected;
    if (diff >= 0) {
      onTrackLabel = diff === 0 ? "On track" : `${diff} session${diff !== 1 ? "s" : ""} ahead`;
      onTrackColor = "#059669";
    } else {
      onTrackLabel = `${Math.abs(diff)} session${Math.abs(diff) !== 1 ? "s" : ""} behind`;
      onTrackColor = "#dc2626";
    }
  }

  // ── Weekly activity (last 14 weeks) from program notes + quick sessions ──
  const WEEKS = 14;
  const weekLabels = [];
  const weekCounts = new Array(WEEKS).fill(0);
  const now = new Date();

  // Build week buckets
  for (let i = WEEKS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekLabels.push(_vizWeekLabel(d));
  }

  function _addToWeekBucket(dateStr) {
    if (!dateStr) return;
    const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
    if (isNaN(d)) return;
    const daysAgo = Math.floor((now - d) / 86400000);
    const weekIdx = WEEKS - 1 - Math.floor(daysAgo / 7);
    if (weekIdx >= 0 && weekIdx < WEEKS) weekCounts[weekIdx]++;
  }

  notes.forEach(n   => _addToWeekBucket(n.recordedAt));
  sessions.forEach(s => _addToWeekBucket(s.dateTime));

  // ── Goals addressed frequency ────────────────────────────────────────────
  const goalFreq = {};
  notes.forEach(n => {
    const addressed = (n.fields && n.fields._goals_addressed) || [];
    addressed.forEach(g => { goalFreq[g] = (goalFreq[g] || 0) + 1; });
  });
  const topGoals = Object.entries(goalFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // ── Goal measurements over time ──────────────────────────────────────────
  // Build: { goalName: [ { sessionNum, recordedAt, frequency, duration, intensity } ] }
  const goalMeasureMap = {};
  const sortedNotes = [...notes].sort((a, b) => Number(a.sessionNum) - Number(b.sessionNum));
  sortedNotes.forEach(n => {
    const m = n.fields && n.fields._goal_measurements;
    if (!m) return;
    Object.entries(m).forEach(([goal, vals]) => {
      if (!goalMeasureMap[goal]) goalMeasureMap[goal] = [];
      goalMeasureMap[goal].push({ sessionNum: n.sessionNum, recordedAt: n.recordedAt, ...vals });
    });
  });
  // Only keep goals with ≥2 data points for a meaningful trend
  const trendGoals = Object.entries(goalMeasureMap).filter(([, pts]) => pts.length >= 2);

  // ── Total session time ───────────────────────────────────────────────────
  const totalMin = sessions.reduce((s, n) => s + (n.durationMin || 0), 0);

  // ── Render HTML ──────────────────────────────────────────────────────────
  const programBlock = program ? `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center;flex-wrap:wrap;">
      <div style="position:relative;width:120px;height:120px;flex-shrink:0;">
        <canvas id="viz-donut" width="120" height="120"></canvas>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">
          <div style="font-size:22px;font-weight:800;color:var(--text);">${pct}%</div>
          <div style="font-size:10px;color:var(--muted);font-weight:600;">done</div>
        </div>
      </div>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">
          ${escapeHtml(program.programModel || "Your Program")}
        </div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:10px;">
          ${loggedCount} of ${totalSessions} sessions logged
        </div>
        <div style="display:inline-flex;align-items:center;gap:6px;background:${onTrackColor}18;
                    color:${onTrackColor};border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;">
          <i class="bi bi-${onTrackColor === '#059669' ? 'check-circle-fill' : 'hourglass-split'}"></i>
          ${escapeHtml(onTrackLabel)}
        </div>
      </div>
    </div>` : `
    <p style="color:var(--muted);font-size:13px;margin:0;">No active program on file yet.</p>`;

  const goalsBlock = topGoals.length ? `
    <canvas id="viz-goals" height="60"></canvas>` : `
    <p style="color:var(--muted);font-size:13px;margin:0;">No goal data from session notes yet.</p>`;

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-bar-chart-fill"></i> My Progress</h1>
    </div>

    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
      ${statCard("journal-text",      "Sessions Logged",    loggedCount || "0")}
      ${statCard("clock-fill",        "Total Session Time", totalMin > 0 ? sessFormatDuration(totalMin) : "—")}
      ${statCard("flag-fill",         "Goals on File",      goals.length || "0")}
      ${statCard("graph-up-arrow",    "Program Complete",   totalSessions > 0 ? pct + "%" : "—")}
    </div>

    <!-- Program completion -->
    <div class="card">
      <h2 style="margin:0 0 16px;"><i class="bi bi-circle-fill" style="color:var(--primary);font-size:14px;"></i> Program Completion</h2>
      ${programBlock}
    </div>

    <!-- Weekly activity chart -->
    <div class="card">
      <h2 style="margin:0 0 16px;"><i class="bi bi-bar-chart-fill"></i> Session Activity — Last ${WEEKS} Weeks</h2>
      <canvas id="viz-weekly" height="80"></canvas>
      <p style="font-size:12px;color:var(--muted);margin:10px 0 0;">
        Combines program session notes and quick session notes.
      </p>
    </div>

    <!-- Goal frequency -->
    ${topGoals.length ? `
    <div class="card">
      <h2 style="margin:0 0 16px;"><i class="bi bi-bullseye"></i> Goals Addressed in Sessions</h2>
      ${goalsBlock}
    </div>` : ""}

    <!-- Measurement trends -->
    ${trendGoals.length ? `
    <div class="card">
      <h2 style="margin:0 0 4px;"><i class="bi bi-activity"></i> Goal Measurement Trends</h2>
      <p style="font-size:13px;color:var(--muted);margin:0 0 20px;">Frequency, duration, and intensity tracked across sessions for goals with recorded data.</p>
      ${trendGoals.map(([goal], gi) => `
        <div style="margin-bottom:28px;">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">${escapeHtml(goal)}</div>
          <canvas id="viz-trend-${gi}" height="70"></canvas>
          <div id="viz-trend-controls-${gi}" style="display:flex;gap:18px;margin-top:8px;flex-wrap:wrap;"></div>
        </div>`).join("")}
    </div>` : ""}
  `;

  // ── Render charts ────────────────────────────────────────────────────────
  requestAnimationFrame(() => {
    // Donut
    if (program && totalSessions > 0) {
      const donutEl = document.getElementById("viz-donut");
      if (donutEl) {
        const donut = new Chart(donutEl, {
          type: "doughnut",
          data: {
            datasets: [{
              data: [loggedCount, totalSessions - loggedCount],
              backgroundColor: ["#6366f1", "#e5e7eb"],
              borderWidth: 0,
              hoverOffset: 4
            }]
          },
          options: {
            cutout: "72%",
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { duration: 600 }
          }
        });
        _vizCharts.push(donut);
      }
    }

    // Weekly bar chart
    const weeklyEl = document.getElementById("viz-weekly");
    if (weeklyEl) {
      const weekly = new Chart(weeklyEl, {
        type: "bar",
        data: {
          labels: weekLabels,
          datasets: [{
            label: "Sessions",
            data: weekCounts,
            backgroundColor: "#6366f155",
            borderColor: "#6366f1",
            borderWidth: 1.5,
            borderRadius: 4
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0, font: { size: 11 } } }
          },
          animation: { duration: 500 }
        }
      });
      _vizCharts.push(weekly);
    }

    // Measurement trend lines (one chart per goal)
    trendGoals.forEach(([goal, pts], gi) => {
      const el = document.getElementById("viz-trend-" + gi);
      if (!el) return;
      const cfg      = inferChartConfig(goal, pts);
      const labels   = cfg.xAxis === "weeks"
        ? pts.map(p => _vizWeekLabel(new Date((p.recordedAt || "").slice(0, 10) + "T00:00:00")))
        : pts.map(p => "Sess " + p.sessionNum);
      const datasets = [];
      const COLORS = { frequency: "#6366f1", duration: "#0ea5e9", intensity: "#f59e0b" };
      cfg.metrics.forEach(metric => {
        if (pts.some(p => p[metric] !== undefined && p[metric] !== null)) {
          datasets.push({
            label:           cfg.metricLabels[metric] || metric,
            data:            pts.map(p => p[metric] ?? null),
            borderColor:     COLORS[metric] || "#6366f1",
            backgroundColor: (COLORS[metric] || "#6366f1") + "20",
            borderWidth:     2,
            pointRadius:     4,
            tension:         0.3,
            spanGaps:        true
          });
        }
      });
      if (!datasets.length) return;
      const yScale = {
        beginAtZero: true,
        ticks: { font: { size: 11 }, stepSize: cfg.yStepSize || undefined, precision: 0 }
      };
      if (cfg.yMax !== null) yScale.max = cfg.yMax;
      if (cfg.yMin !== null) yScale.min = cfg.yMin;
      if (cfg.yLabel) yScale.title = { display: true, text: cfg.yLabel, font: { size: 11 } };
      const chart = new Chart(el, {
        type: cfg.chartType || "line",
        data: { labels, datasets },
        options: {
          plugins: { legend: { position: "top", labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: yScale
          },
          animation: { duration: 400 }
        }
      });
      _vizCharts.push(chart);
      _attachAxisControls(el, chart, gi, cfg);
    });

    // Goals horizontal bar
    if (topGoals.length) {
      const goalsEl = document.getElementById("viz-goals");
      if (goalsEl) {
        const maxLen = 40;
        const truncate = s => s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
        const goalChart = new Chart(goalsEl, {
          type: "bar",
          data: {
            labels: topGoals.map(([g]) => truncate(g)),
            datasets: [{
              label: "Sessions addressed",
              data: topGoals.map(([, c]) => c),
              backgroundColor: "#8b5cf655",
              borderColor: "#8b5cf6",
              borderWidth: 1.5,
              borderRadius: 4
            }]
          },
          options: {
            indexAxis: "y",
            plugins: { legend: { display: false } },
            scales: {
              x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0, font: { size: 11 } } },
              y: { grid: { display: false }, ticks: { font: { size: 11 } } }
            },
            animation: { duration: 500 }
          }
        });
        _vizCharts.push(goalChart);
      }
    }
  });
}

function _vizWeekLabel(date) {
  if (!date || isNaN(date)) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Axis adjustment controls ───────────────────────────────────────────────────
// Renders +/- buttons beneath a chart so the provider/client can nudge axes live.

function _attachAxisControls(canvasEl, chart, gi, cfg) {
  const container = document.getElementById("viz-trend-controls-" + gi);
  if (!container) return;

  // Determine initial y range from chart options
  const yOpts   = chart.options.scales.y;
  const dataMax = Math.max(...(chart.data.datasets.flatMap(ds => ds.data.filter(v => v != null))), 0);
  const step    = cfg.yStepSize || Math.max(1, Math.round(dataMax / 5));

  function btnStyle(color) {
    return `style="width:26px;height:26px;border-radius:6px;border:1.5px solid var(--border);
                   background:var(--surface,#f9fafb);cursor:pointer;font-size:14px;font-weight:700;
                   color:${color};display:flex;align-items:center;justify-content:center;
                   padding:0;line-height:1;transition:background .12s;"`;
  }

  function axisGroup(label, getVal, setVal, stepAmt, minAllowed) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:6px;font-size:12px;";
    wrap.innerHTML = `
      <span style="color:var(--muted);min-width:52px;">${label}</span>
      <button ${btnStyle("#dc2626")} title="Decrease">−</button>
      <span style="min-width:28px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;"
            id="viz-ctrl-val-${gi}-${label.replace(/\s/g,"")}">
        ${getVal() ?? "auto"}
      </span>
      <button ${btnStyle("#059669")} title="Increase">+</button>`;
    const [minusBtn, display, plusBtn] = [wrap.children[1], wrap.children[2], wrap.children[3]];
    function refresh() {
      display.textContent = getVal() ?? "auto";
      chart.update("none");
    }
    minusBtn.addEventListener("click", () => {
      const cur = getVal();
      const next = (cur !== undefined && cur !== null) ? cur - stepAmt : dataMax - stepAmt;
      if (minAllowed !== undefined && next < minAllowed) return;
      setVal(next);
      refresh();
    });
    plusBtn.addEventListener("click", () => {
      const cur = getVal();
      const next = (cur !== undefined && cur !== null) ? cur + stepAmt : dataMax + stepAmt;
      setVal(next);
      refresh();
    });
    return wrap;
  }

  // Y-max control
  container.appendChild(axisGroup(
    "Y max",
    () => yOpts.max,
    v  => { yOpts.max = v; },
    step, (yOpts.min || 0) + step
  ));

  // Y-min control (only show if current min > 0 or cfg has one)
  container.appendChild(axisGroup(
    "Y min",
    () => yOpts.min || 0,
    v  => { yOpts.min = Math.max(0, v); yOpts.beginAtZero = yOpts.min === 0; },
    step, 0
  ));
}

// ── Chart config inference ─────────────────────────────────────────────────────
// Reads a goal's text and its data points to decide how the chart should look.
// Returns a config object consumed by the trend chart renderer above.
//
// To add a new pattern: add a rule to RULES with a `test` regex and the
// overrides you want applied. Rules are checked in order; first match wins.
// Unmatched goals fall back to AUTO defaults.

const _CHART_METRIC_DEFAULTS = {
  metrics:      ["frequency", "duration", "intensity"],
  metricLabels: {
    frequency: "Frequency (#)",
    duration:  "Duration (min)",
    intensity: "Intensity (1–10)"
  },
  chartType: "line",
  xAxis:     "sessions",  // "sessions" | "weeks"
  yMin:      null,
  yMax:      null,
  yStepSize: null,
  yLabel:    null
};

const _CHART_RULES = [
  // ── Days per week ──────────────────────────────────────────────────────────
  {
    test: /\b(\d+\s*)?days?\s*(per|a|each|\/)\s*week\b|days?\s*per\s*week/i,
    patch: { yMax: 7, yMin: 0, yStepSize: 1, yLabel: "Days / Week", xAxis: "weeks",
             metrics: ["frequency"], metricLabels: { frequency: "Days per week" } }
  },
  // ── Times / occurrences per week ──────────────────────────────────────────
  {
    test: /\b(times?|occurrences?|episodes?)\s*(per|a|each|\/)\s*week\b/i,
    patch: { yMin: 0, yStepSize: 1, yLabel: "Times / Week", xAxis: "weeks",
             metrics: ["frequency"], metricLabels: { frequency: "Times per week" } }
  },
  // ── Times / occurrences per day ───────────────────────────────────────────
  {
    test: /\b(times?|occurrences?|episodes?)\s*(per|a|each|\/)\s*day\b/i,
    patch: { yMin: 0, yStepSize: 1, yLabel: "Times / Day",
             metrics: ["frequency"], metricLabels: { frequency: "Times per day" } }
  },
  // ── Duration / minutes ────────────────────────────────────────────────────
  {
    test: /\b(minutes?|mins?|hours?|hrs?|duration)\b/i,
    patch: { yMin: 0, yLabel: "Minutes",
             metrics: ["duration"], metricLabels: { duration: "Duration (min)" } }
  },
  // ── Percentage / rate ─────────────────────────────────────────────────────
  {
    test: /\b(percent|%|rate|ratio)\b/i,
    patch: { yMax: 100, yMin: 0, yStepSize: 10, yLabel: "Percent (%)",
             metrics: ["frequency"], metricLabels: { frequency: "%" } }
  },
  // ── 1–10 scale / intensity / rating ──────────────────────────────────────
  {
    test: /\b(intensity|severity|rating|scale|1[\s–-]+10|out\s+of\s+10)\b/i,
    patch: { yMax: 10, yMin: 0, yStepSize: 2, yLabel: "Rating (1–10)",
             metrics: ["intensity"], metricLabels: { intensity: "Intensity (1–10)" } }
  },
  // ── Count / number of behaviors ───────────────────────────────────────────
  {
    test: /\b(number\s+of|count|#\s+of|reduce|increase)\b.*\b(behavior|incident|outburst|tantrum|refusal|interruption|episode)\b/i,
    patch: { yMin: 0, yStepSize: 1, yLabel: "Count",
             metrics: ["frequency"], metricLabels: { frequency: "Count" } }
  },
  // ── Steps / tasks completed ───────────────────────────────────────────────
  {
    test: /\b(steps?|tasks?|items?|chores?)\s+(completed|done|finished)\b/i,
    patch: { yMin: 0, yStepSize: 1, yLabel: "Steps completed",
             metrics: ["frequency"], metricLabels: { frequency: "Steps" } }
  }
];

function inferChartConfig(goalText, dataPoints) {
  const cfg = Object.assign({}, _CHART_METRIC_DEFAULTS, {
    metricLabels: Object.assign({}, _CHART_METRIC_DEFAULTS.metricLabels)
  });
  const text = String(goalText || "");

  // Find first matching rule
  const rule = _CHART_RULES.find(r => r.test.test(text));
  if (rule) Object.assign(cfg, rule.patch);

  // If xAxis is "weeks" but points lack recordedAt dates, fall back to sessions
  if (cfg.xAxis === "weeks" && dataPoints.every(p => !p.recordedAt)) {
    cfg.xAxis = "sessions";
  }

  // Auto-cap yMax from data when not set by rule (adds 20% headroom)
  if (cfg.yMax === null && dataPoints.length) {
    const allVals = cfg.metrics.flatMap(m => dataPoints.map(p => p[m])).filter(v => v != null && !isNaN(v));
    if (allVals.length) cfg.yMax = Math.ceil(Math.max(...allVals) * 1.2) || null;
  }

  return cfg;
}
