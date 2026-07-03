// Home dashboard — lightweight overview. For clients also shows recent
// session homework and upcoming program sessions.

function initHomeSection(root) {
  const isClient = getRole() !== "provider";
  const isAdult  = getRole() === "adult";

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-house-fill"></i> Welcome</h1>
      <div id="home-stats" class="stat-grid">
        <div class="stat-card"><div class="stat-label">Loading...</div></div>
      </div>
    </div>

    ${isClient ? `
    <div id="home-program-panels" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;flex-wrap:wrap;">
      <div class="card" id="home-last-week"><p style="color:var(--muted);font-size:13px;">Loading recent sessions…</p></div>
      <div class="card" id="home-next-week"><p style="color:var(--muted);font-size:13px;">Loading upcoming sessions…</p></div>
    </div>` : ""}

    <div class="card">
      <h2><i class="bi bi-grid-fill"></i> Jump To</h2>
      <div class="home-tile-grid">
        ${!isAdult ? `
        <button class="home-tile" onclick="showSection('roadmap')"><i class="bi bi-signpost-split-fill"></i><div><div class="home-tile-label">Roadmap Assessment</div><div class="home-tile-sub">Score &amp; review history</div></div></button>
        <button class="home-tile" onclick="showSection('win')"><i class="bi bi-heart-pulse-fill"></i><div><div class="home-tile-label">What I Need</div><div class="home-tile-sub">Score &amp; review history</div></div></button>
        ` : ""}
        <button class="home-tile" onclick="showSection('plan')"><i class="bi bi-flag-fill"></i><div><div class="home-tile-label">Goals &amp; Plan</div><div class="home-tile-sub">View objectives</div></div></button>
        <button class="home-tile" onclick="showSection('progress')"><i class="bi bi-graph-up"></i><div><div class="home-tile-label">Progress</div><div class="home-tile-sub">Track scores over time</div></div></button>
        <button class="home-tile" onclick="showSection('scores')"><i class="bi bi-clipboard2-data-fill"></i><div><div class="home-tile-label">Standardized Scores</div><div class="home-tile-sub">BRIEF-2 &amp; ESQR</div></div></button>
        <button class="home-tile" onclick="showSection('sessions')"><i class="bi bi-journal-text"></i><div><div class="home-tile-label">Session Notes</div><div class="home-tile-sub">List &amp; calendar view</div></div></button>
        ${isClient ? `<button class="home-tile" onclick="showSection('programs')"><i class="bi bi-play-circle-fill"></i><div><div class="home-tile-label">My Program</div><div class="home-tile-sub">Sessions &amp; activities</div></div></button>` : ""}
      </div>
    </div>
  `;

  loadHomeStats();
  if (isClient) loadHomeProgramPanels();
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

    const isAdult = getRole() === "adult";
    el.innerHTML = [
      statCard("person-badge-fill", "Client ID", getClientId()),
      statCard("person-fill", "Logged in as", `${getAssessorName()} (${getRole()})`),
      !isAdult ? statCard("signpost-split-fill", "Last Roadmap Assessment", lastRoadmap ? `${lastRoadmap.date} — ${lastRoadmap.level || ""}` : "None yet") : "",
      !isAdult ? statCard("heart-pulse-fill", "Last WIN Assessment", lastWin ? lastWin.date : "None yet") : "",
      statCard("flag-fill", "Goals on File", plan.goals.length),
      statCard("journal-text", "Sessions This Month", thisMonthSessions.length),
      statCard("hourglass-split", "Session Time This Month", monthMinutes > 0 ? sessFormatDuration(monthMinutes) : "—")
    ].filter(Boolean).join("");
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Error loading overview: ${escapeHtml(e.message)}</span></div>`;
  }
}

async function loadHomeProgramPanels() {
  try {
    const [clientProgRes, notesRes] = await Promise.all([
      apiCall("getClientProgram", {}).catch(() => ({ program: null })),
      apiCall("getSessionNotes", {}).catch(() => ({ notes: [] }))
    ]);

    const program = clientProgRes.program;
    const notes   = notesRes.notes || [];
    const noteMap = {};
    notes.forEach(n => { noteMap[n.sessionNum] = n; });

    renderHomeLastWeek(program, notes, noteMap);
    renderHomeNextWeek(program, noteMap);
  } catch (_) {
    const lw = document.getElementById("home-last-week");
    const nw = document.getElementById("home-next-week");
    if (lw) lw.innerHTML = `<h2 style="margin-top:0;"><i class="bi bi-clock-history"></i> Last Session</h2><p style="color:var(--muted);font-size:13px;">Could not load program data.</p>`;
    if (nw) nw.innerHTML = `<h2 style="margin-top:0;"><i class="bi bi-calendar-week"></i> Coming Up</h2><p style="color:var(--muted);font-size:13px;">Could not load program data.</p>`;
  }
}

function renderHomeLastWeek(program, notes, noteMap) {
  const el = document.getElementById("home-last-week");
  if (!el) return;

  // Most recently logged program note
  const sorted = [...notes].sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)));
  const last   = sorted[0] || null;

  if (!last) {
    el.innerHTML = `
      <h2 style="margin-top:0;"><i class="bi bi-clock-history"></i> Last Session</h2>
      <p style="color:var(--muted);font-size:13px;">No sessions logged yet.</p>`;
    return;
  }

  const fields  = last.fields || {};
  const homeworkKey = Object.keys(fields).find(k => k.includes("homework") || k.includes("hw") || k.includes("next_session") || k.includes("transition"));
  const homework = homeworkKey ? fields[homeworkKey] : null;
  const goalBadges = (fields._goals_addressed || []).map(g =>
    `<span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:600;padding:1px 7px;border-radius:8px;margin:2px 3px 2px 0;"><i class="bi bi-check2"></i> ${escapeHtml(g)}</span>`
  ).join("");

  const TYPE_COLOR = { "parent-only":"#3b82f6", "child-only":"#8b5cf6", "parent+child":"#059669", "graduation":"#f59e0b" };
  const TYPE_MAP   = { "parent-only":"Parent Session", "child-only":"Child Session", "parent+child":"Parent + Child", "graduation":"Graduation" };
  const color = TYPE_COLOR[last.sessionType] || "#6b7280";

  el.innerHTML = `
    <h2 style="margin-top:0;"><i class="bi bi-clock-history"></i> Last Session</h2>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
      <span style="font-size:11px;font-weight:700;background:${color}22;color:${color};padding:2px 8px;border-radius:10px;">${escapeHtml(TYPE_MAP[last.sessionType] || last.sessionType)}</span>
      <span style="font-size:13px;font-weight:600;">Session ${last.sessionNum}: ${escapeHtml(last.title || "")}</span>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px;"><i class="bi bi-calendar3"></i> ${escapeHtml((last.recordedAt || "").slice(0, 10))}</div>
    ${goalBadges ? `<div style="margin-bottom:10px;">${goalBadges}</div>` : ""}
    ${homework ? `
      <div style="background:var(--surface);border-radius:8px;border:1.5px solid var(--border);padding:10px 12px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">
          <i class="bi bi-house-heart-fill"></i> Take-Home / Homework
        </div>
        <div style="font-size:13px;line-height:1.5;">${escapeHtml(homework)}</div>
      </div>` : `<p style="color:var(--muted);font-size:13px;margin:0;">No homework notes recorded for this session.</p>`}
  `;
}

function renderHomeNextWeek(program, noteMap) {
  const el = document.getElementById("home-next-week");
  if (!el) return;

  if (!program || !program.sessionPlan) {
    el.innerHTML = `
      <h2 style="margin-top:0;"><i class="bi bi-calendar-week"></i> Coming Up</h2>
      <p style="color:var(--muted);font-size:13px;">No active session plan on file yet.</p>`;
    return;
  }

  const sp   = program.sessionPlan;
  const weeks = sp.weeks || [];
  const projections = cpProjectWeeks(program.startDate, weeks.length, noteMap);

  const TYPE_COLOR = { "parent-only":"#3b82f6", "child-only":"#8b5cf6", "parent+child":"#059669", "graduation":"#f59e0b" };
  const TYPE_MAP   = { "parent-only":"Parent Session", "child-only":"Child Session", "parent+child":"Parent + Child", "graduation":"Graduation" };

  // Find the first week that is current or upcoming and not all done
  const nextWkIdx = weeks.findIndex((wk, i) => {
    const p = projections[i] || {};
    const allDone = (wk.sessions || []).every(s => noteMap[s.session_num]);
    return !allDone && (p.status === "current" || p.status === "upcoming" || p.status === "holiday-delay" || p.status === "overdue");
  });

  if (nextWkIdx === -1) {
    el.innerHTML = `
      <h2 style="margin-top:0;"><i class="bi bi-calendar-week"></i> Coming Up</h2>
      <div style="display:flex;align-items:center;gap:10px;color:#059669;">
        <i class="bi bi-trophy-fill" style="font-size:22px;"></i>
        <span style="font-size:14px;font-weight:600;">All sessions complete — great work!</span>
      </div>`;
    return;
  }

  const wk   = weeks[nextWkIdx];
  const proj = projections[nextWkIdx] || {};
  const holHtml = (proj.holidays || []).map(h =>
    `<div style="font-size:12px;color:#92400e;background:#fef3c7;border-radius:6px;padding:4px 8px;margin-top:6px;">
      <i class="bi bi-calendar-x-fill"></i> ${escapeHtml(h.name)} falls this week
    </div>`
  ).join("");

  const sessHtml = (wk.sessions || []).filter(s => !noteMap[s.session_num]).map(sess => {
    const color = TYPE_COLOR[sess.type] || "#6b7280";
    return `
      <div style="padding:10px 12px;background:var(--surface);border-radius:8px;border:1.5px solid var(--border);margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:700;background:${color}22;color:${color};padding:2px 8px;border-radius:10px;">${escapeHtml(TYPE_MAP[sess.type] || sess.type)}</span>
          <span style="font-size:13px;font-weight:600;">Session ${sess.session_num}: ${escapeHtml(sess.title || "")}</span>
        </div>
        ${sess.description ? `<div style="font-size:12px;color:var(--text);line-height:1.5;margin-top:2px;">${escapeHtml(sess.description)}</div>` : ""}
        ${sess.focus ? `<div style="font-size:12px;color:var(--muted);font-style:italic;margin-top:2px;">${escapeHtml(sess.focus)}</div>` : ""}
      </div>`;
  }).join("");

  el.innerHTML = `
    <h2 style="margin-top:0;"><i class="bi bi-calendar-week"></i> Coming Up</h2>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:4px;">
      <span style="font-weight:700;font-size:14px;">Week ${wk.week} — ${escapeHtml(wk.phase || "")}</span>
      <span style="font-size:12px;color:var(--muted);"><i class="bi bi-calendar3"></i> ${escapeHtml(proj.projectedLabel || "—")}</span>
    </div>
    ${holHtml}
    ${sessHtml || `<p style="color:var(--muted);font-size:13px;margin:0;">All sessions this week are complete.</p>`}
  `;
}

function latestByDate_(rows, dateField) {
  if (!rows || rows.length === 0) return null;
  return rows.reduce((latest, r) => (!latest || r[dateField] > latest[dateField] ? r : latest), null);
}
