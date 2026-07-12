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
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
                    border-bottom:1px solid var(--border);">
          <i class="bi bi-calendar-check-fill" style="color:var(--primary);font-size:16px;flex-shrink:0;"></i>
          <div>
            <div style="font-size:13px;font-weight:600;">${escapeHtml(a.title)}</div>
            <div style="font-size:12px;color:var(--muted);">${escapeHtml(a.start)} – ${escapeHtml(a.end)}</div>
          </div>
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
      <tr>
        <td style="font-weight:700;">
          ${escapeHtml(c.clientId)}
          ${c.noRecentActivity ? `<i class="bi bi-exclamation-circle-fill" style="color:#6d28d9;font-size:11px;margin-left:4px;" title="No activity in 30+ days"></i>` : ""}
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
        <td>
          <button class="secondary" style="font-size:11px;padding:4px 10px;"
            onclick="dashJumpToClient('${escapeAttr(c.clientId)}')">
            <i class="bi bi-person-fill"></i> Open
          </button>
        </td>
      </tr>`;
  }).join("");

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <h1 style="margin:0;"><i class="bi bi-speedometer2"></i> Provider Dashboard</h1>
        <button class="secondary" onclick="initDashboardSection(document.getElementById('section-dashboard'))"
          style="font-size:12px;">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
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
      <h2 style="margin:0 0 16px;"><i class="bi bi-table"></i> Caseload Overview</h2>
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
              <th></th>
            </tr>
          </thead>
          <tbody>${caseloadRows || `<tr><td colspan="8" style="text-align:center;color:var(--muted);">No clients found.</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <style>
      @media (max-width: 700px) { .dash-grid { grid-template-columns: 1fr !important; } }
    </style>`;
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
