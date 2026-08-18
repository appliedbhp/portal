// Provider Dashboard — caseload overview + "needs attention today" view.
// Provider-only section; uses getProviderDashboard action (no clientId needed).

async function initDashboardSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-speedometer2"></i> Provider Dashboard</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">Loading caseload…</p>
    </div>`;
  try {
    const raw  = sessionStorage.getItem("portalSession") || "{}";
    const sess = JSON.parse(raw);
    const data = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "getProviderDashboard",
        providerId:       sess.providerId,
        providerPassword: sess.providerPassword
      })
    }).then(r => r.json());
    if (!data.ok) throw new Error(data.error || "Failed to load dashboard");
    renderDashboard(root, data);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load dashboard: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderDashboard(root, data) {
  const { clients, attentionItems, todayAppointments } = data;

  const total       = clients.length;
  const active      = clients.filter(c => c.active).length;
  const withProgram = clients.filter(c => c.hasProgram).length;
  const onTrackN    = clients.filter(c => c.onTrack === true).length;
  const onTrackPct  = withProgram ? Math.round(onTrackN / withProgram * 100) : 0;

  // ── Week session count ────────────────────────────────────────────────────
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const recentActivity = clients.filter(c => c.lastActivity >= weekAgoStr).length;

  // ── Attention item icons / colors ─────────────────────────────────────────
  const ATTN = {
    behind:   { icon: "bi-hourglass-split",          bg: "#fee2e2", color: "#991b1b", label: "Behind schedule" },
    expiring: { icon: "bi-calendar-x-fill",           bg: "#fef3c7", color: "#92400e", label: "Program ending soon" },
    inactive: { icon: "bi-person-dash-fill",          bg: "#ede9fe", color: "#6d28d9", label: "No recent activity" }
  };

  const attentionHtml = attentionItems.length
    ? attentionItems.map(item => {
        const a = ATTN[item.type] || ATTN.inactive;
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;
                      background:${a.bg};border:1.5px solid ${a.color}33;margin-bottom:8px;">
            <i class="bi ${a.icon}" style="color:${a.color};font-size:18px;flex-shrink:0;"></i>
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:700;color:${a.color};text-transform:uppercase;
                          letter-spacing:.05em;margin-bottom:2px;">${a.label}</div>
              <div style="font-size:13px;color:var(--text);">${escapeHtml(item.message)}</div>
            </div>
            <button class="secondary" style="font-size:11px;padding:4px 10px;flex-shrink:0;"
              onclick="dashJumpToClient('${escapeAttr(item.clientId)}')">
              <i class="bi bi-arrow-right-circle"></i> View
            </button>
          </div>`;
      }).join("")
    : `<div class="alert" style="border-color:#059669;color:#065f46;background:#d1fae5;">
         <i class="bi bi-check-circle-fill"></i>
         <span>All clients are on track — nothing needs immediate attention.</span>
       </div>`;

  const apptHtml = todayAppointments.length
    ? todayAppointments.map(a => `
        <div class="dash-appt-card${a.joinUrl ? " has-video" : ""}">
          <div class="dash-appt-icon"><i class="bi ${a.joinUrl ? "bi-camera-video-fill" : "bi-calendar-check-fill"}"></i></div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:13px;font-weight:600;">${escapeHtml(a.title)}</div>
            <div style="font-size:12px;color:var(--muted);">${escapeHtml(a.start)} – ${escapeHtml(a.end)}${a.clientId ? " · " + escapeHtml(a.clientId) : ""}</div>
            ${a.location ? `<div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><i class="bi bi-geo-alt"></i> ${escapeHtml(a.location)}</div>` : ""}
          </div>
          ${a.joinUrl ? `<a class="dash-join-btn" href="${escapeAttr(a.joinUrl)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-camera-video-fill"></i> Join</a>` : ""}
        </div>`).join("")
    : `<p style="color:var(--muted);font-size:13px;margin:0;">No appointments scheduled for today.</p>`;

  // ── Caseload table ────────────────────────────────────────────────────────
  const caseloadRows = clients.map(c => {
    const statusBadge = !c.active
      ? `<span style="font-size:11px;font-weight:700;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:8px;">Inactive</span>`
      : !c.hasProgram
      ? `<span style="font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:8px;">No program</span>`
      : c.onTrack === true
      ? `<span style="font-size:11px;font-weight:700;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:8px;"><i class="bi bi-check-circle-fill"></i> On track</span>`
      : c.onTrack === false
      ? `<span style="font-size:11px;font-weight:700;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:8px;"><i class="bi bi-exclamation-triangle-fill"></i> Behind</span>`
      : `<span style="font-size:11px;font-weight:700;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:8px;">—</span>`;

    const programBadge = c.programModel
      ? `<span style="font-size:11px;background:var(--primary)22;color:var(--primary);
                      padding:2px 8px;border-radius:8px;font-weight:600;">${escapeHtml(c.programModel)}</span>`
      : `<span style="color:var(--muted);font-size:12px;">—</span>`;

    const expBadge = c.programExpiresSoon
      ? `<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:6px;font-weight:700;margin-left:4px;">Ending soon</span>`
      : "";

    return `
      <tr class="dash-client-row" data-search="${escapeAttr((c.clientId + " " + c.email + " " + (c.programModel || "")).toLowerCase())}" data-state="${!c.active ? "inactive" : c.onTrack === false ? "attention" : "active"}">
        <td style="font-weight:700;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="client-avatar-cell" data-avatar='${escapeAttr(c.avatarJson || "")}' data-label="${escapeAttr(c.clientId)}"
                 style="width:30px;height:30px;border-radius:50%;overflow:hidden;flex-shrink:0;
                        display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;
                        background:var(--primary,#6366f1);color:#fff;">
              ${escapeHtml((c.clientId || "?").substring(0, 2).toUpperCase())}
            </div>
            <span>${escapeHtml(c.clientId)}</span>
            ${c.noRecentActivity ? `<i class="bi bi-exclamation-circle-fill" style="color:#6d28d9;font-size:11px;" title="No activity in 30+ days"></i>` : ""}
          </div>
        </td>
        <td style="font-size:12px;color:var(--muted);">${escapeHtml(c.email)}</td>
        <td>${programBadge}${expBadge}</td>
        <td>${statusBadge}</td>
        <td style="font-size:13px;text-align:center;">
          ${c.hasProgram ? `<strong>${c.sessionsLogged}</strong> / ${c.totalSessions}` : "—"}
        </td>
        <td style="font-size:12px;color:var(--muted);">
          ${c.projectedEndDate ? escapeHtml(c.projectedEndDate) : "—"}
        </td>
        <td style="font-size:12px;color:var(--muted);">
          ${c.lastActivity ? escapeHtml(c.lastActivity) : `<span style="color:#dc2626;">Never</span>`}
        </td>
        <td><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">
          ${c.nextAppointment?.joinUrl ? `<a class="dash-row-video" href="${escapeAttr(c.nextAppointment.joinUrl)}" target="_blank" rel="noopener noreferrer" title="Join ${escapeAttr(c.nextAppointment.title || "video visit")} · ${escapeAttr(c.nextAppointment.start || "")}"><i class="bi bi-camera-video-fill"></i><span>Join</span></a>` : ""}
          <button class="secondary" style="font-size:11px;padding:4px 10px;"
            onclick="dashJumpToClient('${escapeAttr(c.clientId)}')">
            <i class="bi bi-person-fill"></i> Open
          </button>
        </div></td>
      </tr>`;
  }).join("");

  root.innerHTML = `
    <div class="card dash-hero">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div><div class="dash-eyebrow"><span></span> LIVE PRACTICE OVERVIEW</div><h1 style="margin:4px 0 0;"><i class="bi bi-speedometer2"></i> Provider Dashboard</h1><p style="margin:6px 0 0;color:var(--muted);font-size:13px;">Your caseload, clinical momentum, and visits at a glance.</p></div>
        <button class="secondary" onclick="initDashboardSection(document.getElementById('section-dashboard'))"
          style="font-size:12px;">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>
      <div class="dash-stat-strip" style="display:flex;gap:12px;flex-wrap:wrap;">
        ${statCard("people-fill",        "Total Clients",     total)}
        ${statCard("person-check-fill",  "Active",            active)}
        ${statCard("calendar2-week-fill","On a Program",      withProgram)}
        ${statCard("graph-up-arrow",     "On Track",          onTrackPct + "%")}
        ${statCard("activity",           "Active This Week",  recentActivity)}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;" class="dash-grid">
      <div class="card" style="margin:0;">
        <h2 style="margin:0 0 14px;"><i class="bi bi-exclamation-triangle-fill" style="color:#f59e0b;"></i> Needs Attention</h2>
        ${attentionHtml}
      </div>
      <div class="card" style="margin:0;">
        <h2 style="margin:0 0 14px;"><i class="bi bi-calendar-check-fill" style="color:var(--primary);"></i> Today's Appointments</h2>
        ${apptHtml}
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <h2 style="margin:0;"><i class="bi bi-grid-3x3-gap-fill"></i> Caseload Explorer</h2>
        <div style="display:flex;gap:7px;flex-wrap:wrap;">
          <div style="position:relative;"><i class="bi bi-search" style="position:absolute;left:10px;top:9px;color:var(--muted);"></i><input id="dash-search" placeholder="Search clients…" oninput="dashFilterClients()" style="width:210px;padding-left:31px;"></div>
          <select id="dash-filter" onchange="dashFilterClients()" style="width:145px;"><option value="all">All clients</option><option value="active">Active</option><option value="attention">Needs attention</option><option value="inactive">Inactive</option></select>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Email</th>
              <th>Program</th>
              <th>Status</th>
              <th style="text-align:center;">Sessions</th>
              <th>End Date</th>
              <th>Last Active</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>${caseloadRows || `<tr><td colspan="8" style="text-align:center;color:var(--muted);">No clients found.</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <style>
      .dash-hero { position:relative;overflow:hidden;background:linear-gradient(135deg,var(--card,#fff) 34%,color-mix(in srgb,var(--primary) 12%,var(--card,#fff)) 72%,color-mix(in srgb,#06b6d4 12%,var(--card,#fff)));box-shadow:0 18px 45px rgba(49,133,252,.09); }
      .dash-hero::before,.dash-hero::after { content:"";position:absolute;border-radius:50%;pointer-events:none;filter:blur(1px);animation:dash-float 7s ease-in-out infinite; }
      .dash-hero::before { width:190px;height:190px;left:42%;bottom:-150px;background:radial-gradient(circle,rgba(139,92,246,.2),transparent 68%); }
      .dash-hero::after { width:280px;height:280px;right:-90px;top:-140px;background:radial-gradient(circle,rgba(6,182,212,.22),transparent 68%);animation-delay:-3s; }
      .dash-eyebrow { display:flex;align-items:center;gap:7px;font-size:10px;font-weight:800;letter-spacing:.14em;color:var(--primary); }
      .dash-eyebrow span { width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.12);animation:ac-badge-pulse 1.8s ease-in-out infinite; }
      .dash-stat-strip .stat-card { transition:transform .2s ease,box-shadow .2s ease;cursor:default; }
      .dash-stat-strip .stat-card:hover { transform:translateY(-3px);box-shadow:0 12px 28px rgba(49,133,252,.14); }
      .dash-client-row { transition:background .18s ease,transform .18s ease; }
      .dash-client-row:hover { background:color-mix(in srgb,var(--primary) 5%,transparent); }
      .dash-appt-card { display:flex;align-items:center;gap:11px;padding:11px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:color-mix(in srgb,var(--card,#fff) 94%,var(--primary));transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease; }
      .dash-appt-card:hover { transform:translateY(-2px);box-shadow:0 10px 24px rgba(15,23,42,.08); }
      .dash-appt-card.has-video { border-color:rgba(16,185,129,.3);background:linear-gradient(100deg,rgba(16,185,129,.07),color-mix(in srgb,var(--card,#fff) 96%,#fff)); }
      .dash-appt-icon { width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:0 0 34px;color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,transparent); }
      .has-video .dash-appt-icon { color:#047857;background:rgba(16,185,129,.14); }
      .dash-join-btn,.dash-row-video { display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:#fff;background:linear-gradient(135deg,#059669,#10b981);font-size:11px;font-weight:800;border-radius:9px;padding:7px 11px;box-shadow:0 7px 16px rgba(5,150,105,.2);transition:transform .16s ease,box-shadow .16s ease;white-space:nowrap; }
      .dash-join-btn:hover,.dash-row-video:hover { transform:translateY(-1px) scale(1.02);box-shadow:0 10px 22px rgba(5,150,105,.3); }
      .dash-row-video { padding:5px 9px; }
      @keyframes dash-float { 0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(10px) scale(1.04)} }
      @media (max-width: 700px) { .dash-grid { grid-template-columns: 1fr !important; } }
    </style>`;

  // Hydrate avatar cells asynchronously so the table appears instantly
  if (typeof buildAvatarEl === "function") {
    root.querySelectorAll(".client-avatar-cell").forEach(async (cell) => {
      const avatarJson = cell.dataset.avatar || null;
      const label      = cell.dataset.label  || "?";
      if (!avatarJson) return;
      const el = await buildAvatarEl(avatarJson, label, 30);
      cell.replaceWith(el);
    });
  }
}

function dashFilterClients() {
  const query = (document.getElementById("dash-search")?.value || "").trim().toLowerCase();
  const state = document.getElementById("dash-filter")?.value || "all";
  document.querySelectorAll(".dash-client-row").forEach(row => {
    const matchesText = !query || (row.dataset.search || "").includes(query);
    const matchesState = state === "all" || row.dataset.state === state;
    row.style.display = matchesText && matchesState ? "" : "none";
  });
}

async function dashJumpToClient(clientId) {
  setProviderClient(clientId);
  // Switch to home section and reload
  showSection("home");
  const homeEl = document.getElementById("section-home");
  if (homeEl) {
    const { initHomeSection } = window;
    if (typeof initHomeSection === "function") initHomeSection(homeEl);
  }
}
