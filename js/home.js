// Home dashboard — a lightweight overview pulled by reusing the same
// getHistory/getPlan/getProgress/getSessions actions the other sections call,
// so no backend changes are needed here.

function initHomeSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-house-fill"></i>Welcome</h1>
      <div id="home-stats" class="stat-grid">
        <div class="stat-card"><div class="stat-label">Loading...</div></div>
      </div>
    </div>

    <div class="card">
      <h2><i class="bi bi-grid-fill"></i>Jump To</h2>
      <div class="home-tile-grid">
        <button class="home-tile" onclick="showSection('roadmap')"><i class="bi bi-signpost-split-fill"></i><div><div class="home-tile-label">Roadmap Assessment</div><div class="home-tile-sub">Score &amp; review history</div></div></button>
        <button class="home-tile" onclick="showSection('win')"><i class="bi bi-heart-pulse-fill"></i><div><div class="home-tile-label">What I Need</div><div class="home-tile-sub">Score &amp; review history</div></div></button>
        <button class="home-tile" onclick="showSection('plan')"><i class="bi bi-flag-fill"></i><div><div class="home-tile-label">Goals &amp; Plan</div><div class="home-tile-sub">View objectives</div></div></button>
        <button class="home-tile" onclick="showSection('progress')"><i class="bi bi-graph-up"></i><div><div class="home-tile-label">Progress</div><div class="home-tile-sub">Track scores over time</div></div></button>
        <button class="home-tile" onclick="showSection('scores')"><i class="bi bi-clipboard2-data-fill"></i><div><div class="home-tile-label">Standardized Scores</div><div class="home-tile-sub">BRIEF-2 &amp; ESQR</div></div></button>
        <button class="home-tile" onclick="showSection('sessions')"><i class="bi bi-journal-text"></i><div><div class="home-tile-label">Session Notes</div><div class="home-tile-sub">List &amp; calendar view</div></div></button>
      </div>
    </div>
  `;
  loadHomeStats();
}

async function loadHomeStats() {
  const el = document.getElementById("home-stats");
  try {
    const [roadmapHist, winHist, plan, progress, sessions] = await Promise.all([
      apiCall("getHistory", { type: "roadmap" }).catch(() => ({ history: [] })),
      apiCall("getHistory", { type: "win" }).catch(() => ({ history: [] })),
      apiCall("getPlan", {}).catch(() => ({ goals: [] })),
      apiCall("getProgress", {}).catch(() => ({ progress: [] })),
      apiCall("getSessions", {}).catch(() => ({ sessions: [] }))
    ]);

    const lastRoadmap = latestByDate_(roadmapHist.history, "date");
    const lastWin = latestByDate_(winHist.history, "date");

    const now = new Date();
    const thisMonthSessions = sessions.sessions.filter(s => {
      const d = (s.dateTime || "").slice(0, 7);
      return d === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const monthMinutes = thisMonthSessions.reduce((sum, s) => sum + (s.durationMin || 0), 0);

    el.innerHTML = [
      statCard("person-badge-fill", "Client ID", getClientId()),
      statCard("person-fill", "Logged in as", `${getAssessorName()} (${getRole()})`),
      statCard("signpost-split-fill", "Last Roadmap Assessment", lastRoadmap ? `${lastRoadmap.date} — ${lastRoadmap.level || ""}` : "None yet"),
      statCard("heart-pulse-fill", "Last WIN Assessment", lastWin ? lastWin.date : "None yet"),
      statCard("flag-fill", "Goals on File", plan.goals.length),
      statCard("journal-text", "Sessions This Month", thisMonthSessions.length),
      statCard("hourglass-split", "Session Time This Month", monthMinutes > 0 ? sessFormatDuration(monthMinutes) : "—")
    ].join("");
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Error loading overview: ${escapeHtml(e.message)}</span></div>`;
  }
}

// History rows aren't grouped by assessment here (unlike roadmap.js/win.js),
// so just take the row with the latest date string.
function latestByDate_(rows, dateField) {
  if (!rows || rows.length === 0) return null;
  return rows.reduce((latest, r) => (!latest || r[dateField] > latest[dateField] ? r : latest), null);
}
