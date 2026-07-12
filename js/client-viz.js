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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
