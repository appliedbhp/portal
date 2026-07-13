// Client notification center — AI-scheduled reminders with read/unread tracking

async function initNotificationsSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const [notifRes, bcastRes] = await Promise.all([
      apiCall("getNotifications", {}),
      apiCall("getBroadcasts",    {}).catch(() => ({ broadcasts: [] }))
    ]);
    renderNotificationsSection(root, {
      notifications: notifRes.notifications || [],
      broadcasts:    bcastRes.broadcasts    || []
    });
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load notifications: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderNotificationsSection(root, { notifications, broadcasts }) {
  const unreadCount = notifications.filter(n => !n.isRead && n.status !== "cancelled").length
                    + broadcasts.filter(b => !b.isRead).length;

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div>
          <h1 style="margin:0;"><i class="bi bi-bell-fill"></i> Notifications
            ${unreadCount ? `<span style="background:#ef4444;color:#fff;font-size:12px;font-weight:700;
              padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle;">${unreadCount}</span>` : ""}
          </h1>
          <p style="color:var(--muted);font-size:14px;margin:4px 0 0;">
            Messages and reminders from your care team.
          </p>
        </div>
        <button class="secondary" onclick="initNotificationsSection(document.getElementById('section-notifications'))"
                style="font-size:12px;">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>
    </div>

    ${broadcasts.length ? `
    <div class="card">
      <h2 style="margin-bottom:14px;"><i class="bi bi-megaphone-fill"></i> Announcements</h2>
      <div id="ntf-broadcasts">${broadcasts.map(b => broadcastNotifHtml(b)).join("")}</div>
    </div>` : ""}

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        <h2 style="margin:0;"><i class="bi bi-envelope-fill"></i> Reminders</h2>
        <div style="display:flex;gap:6px;">
          <button id="ntf-tab-all"    class="secondary" onclick="ntfFilter('all')"    style="font-size:12px;padding:5px 12px;">All</button>
          <button id="ntf-tab-unread" class="secondary" onclick="ntfFilter('unread')" style="font-size:12px;padding:5px 12px;">Unread</button>
          <button id="ntf-tab-read"   class="secondary" onclick="ntfFilter('read')"   style="font-size:12px;padding:5px 12px;">Read</button>
        </div>
      </div>
      <div id="ntf-list">
        ${renderNotifList(notifications, "all")}
      </div>
    </div>

    <style>
      .ntf-item { border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;
                  margin-bottom:8px;transition:opacity .2s; }
      .ntf-item.unread { border-color:var(--primary);background:color-mix(in srgb,var(--primary) 5%,transparent); }
      .ntf-unread-dot { width:8px;height:8px;background:#ef4444;border-radius:50%;flex-shrink:0;margin-top:5px; }
      .ntf-read-dot   { width:8px;height:8px;background:var(--border);border-radius:50%;flex-shrink:0;margin-top:5px; }
    </style>`;

  // Set active tab style
  ntfSetActiveTab("all");

  // Auto-mark broadcasts as read after 3s
  broadcasts.filter(b => !b.isRead).forEach(b => {
    setTimeout(() => apiCall("markBroadcastRead", { broadcastId: b.broadcastId }).catch(() => {}), 3000);
  });
}

function renderNotifList(notifications, filter) {
  const active = notifications.filter(n => n.status !== "cancelled");
  const filtered = filter === "unread" ? active.filter(n => !n.isRead)
                 : filter === "read"   ? active.filter(n =>  n.isRead)
                 : active;
  if (!filtered.length) {
    const msg = filter === "unread" ? "No unread notifications."
              : filter === "read"   ? "No read notifications yet."
              : "No reminders yet.";
    return `<p style="color:var(--muted);font-size:13px;margin:0;">${msg}</p>`;
  }
  return filtered.map(n => notifItemHtml(n)).join("");
}

function notifItemHtml(n) {
  const fmtDt = s => {
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  };
  const chIcon  = n.channel === "sms" ? "bi-phone-fill" : "bi-envelope-fill";
  const chColor = n.channel === "sms" ? "#7c3aed" : "#1d4ed8";
  const when    = n.status === "sent" ? `Sent ${fmtDt(n.sentAt)}`
                : n.status === "pending" ? `Scheduled ${fmtDt(n.scheduledAt)}`
                : n.status;
  return `
    <div class="ntf-item ${n.isRead ? "" : "unread"}" id="ntf-${escapeAttr(n.reminderId)}">
      <div style="display:flex;gap:10px;">
        <div class="${n.isRead ? "ntf-read-dot" : "ntf-unread-dot"}"></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            <i class="bi ${chIcon}" style="color:${chColor};font-size:13px;"></i>
            <span style="font-size:11px;font-weight:700;color:${chColor};">${escapeHtml(n.channel.toUpperCase())}</span>
            <span style="font-size:11px;color:var(--muted);">${escapeHtml(when)}</span>
            ${!n.isRead ? `<span style="font-size:10px;font-weight:700;background:#fef2f2;color:#ef4444;
              padding:1px 7px;border-radius:6px;border:1px solid #fecaca;">NEW</span>` : ""}
          </div>
          <div style="font-size:14px;color:var(--text);line-height:1.55;margin-bottom:8px;">
            ${escapeHtml(n.message)}
          </div>
          <div style="display:flex;gap:8px;">
            ${n.isRead
              ? `<button class="secondary" style="font-size:11px;padding:3px 10px;"
                   onclick="toggleNotifRead('${escapeAttr(n.reminderId)}', false)">
                   <i class="bi bi-envelope-fill"></i> Mark Unread
                 </button>`
              : `<button class="secondary" style="font-size:11px;padding:3px 10px;"
                   onclick="toggleNotifRead('${escapeAttr(n.reminderId)}', true)">
                   <i class="bi bi-envelope-open-fill"></i> Mark Read
                 </button>`
            }
          </div>
        </div>
      </div>
    </div>`;
}

function broadcastNotifHtml(b) {
  const fmtDt = s => s ? new Date(s).toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" }) : "";
  return `
    <div class="ntf-item ${b.isRead ? "" : "unread"}" id="bcast-${escapeAttr(b.broadcastId)}"
         style="margin-bottom:10px;">
      <div style="display:flex;gap:10px;">
        <div class="${b.isRead ? "ntf-read-dot" : "ntf-unread-dot"}" style="margin-top:6px;"></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;">
            <i class="bi bi-megaphone-fill" style="color:#d97706;font-size:13px;"></i>
            <span style="font-size:13px;font-weight:700;color:var(--text);">${escapeHtml(b.title)}</span>
            <span style="font-size:11px;color:var(--muted);">${escapeHtml(fmtDt(b.createdAt))}</span>
            ${!b.isRead ? `<span style="font-size:10px;font-weight:700;background:#fef2f2;color:#ef4444;
              padding:1px 7px;border-radius:6px;border:1px solid #fecaca;">NEW</span>` : ""}
          </div>
          <div style="font-size:14px;color:var(--text);line-height:1.55;">${escapeHtml(b.message)}</div>
        </div>
      </div>
    </div>`;
}

// Filter tabs
let _ntfAllNotifs = [];
function ntfFilter(filter) {
  ntfSetActiveTab(filter);
  // Re-read from DOM (we stash them on the root dataset)
  const root = document.getElementById("section-notifications");
  const data = root && root._ntfData;
  if (data) {
    const el = document.getElementById("ntf-list");
    if (el) el.innerHTML = renderNotifList(data, filter);
  }
}

function ntfSetActiveTab(active) {
  ["all","unread","read"].forEach(t => {
    const el = document.getElementById(`ntf-tab-${t}`);
    if (!el) return;
    el.style.background    = t === active ? "var(--primary)" : "";
    el.style.color         = t === active ? "#fff" : "";
    el.style.borderColor   = t === active ? "var(--primary)" : "";
  });
}

async function toggleNotifRead(reminderId, markRead) {
  const action = markRead ? "markNotificationRead" : "markNotificationUnread";
  try {
    await apiCall(action, { reminderId });
    // Update item in place
    const item = document.getElementById(`ntf-${reminderId}`);
    if (item) {
      const dot = item.querySelector(".ntf-unread-dot, .ntf-read-dot");
      if (markRead) {
        item.classList.remove("unread");
        if (dot) { dot.className = "ntf-read-dot"; }
        const btn = item.querySelector("button");
        if (btn) btn.outerHTML = `<button class="secondary" style="font-size:11px;padding:3px 10px;"
          onclick="toggleNotifRead('${escapeAttr(reminderId)}', false)">
          <i class="bi bi-envelope-fill"></i> Mark Unread</button>`;
        const badge = item.querySelector('[style*="fef2f2"]');
        if (badge) badge.remove();
      } else {
        item.classList.add("unread");
        if (dot) { dot.className = "ntf-unread-dot"; }
        const btn = item.querySelector("button");
        if (btn) btn.outerHTML = `<button class="secondary" style="font-size:11px;padding:3px 10px;"
          onclick="toggleNotifRead('${escapeAttr(reminderId)}', true)">
          <i class="bi bi-envelope-open-fill"></i> Mark Read</button>`;
      }
    }
    // Update bell badge
    updateBellBadge();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// ── Bell badge (called on portal load and after read state changes) ───────────
async function updateBellBadge() {
  try {
    const [notifRes, bcastRes] = await Promise.all([
      apiCall("getNotifications", {}).catch(() => ({ notifications: [] })),
      apiCall("getBroadcasts",    {}).catch(() => ({ broadcasts:    [] }))
    ]);
    const count = (notifRes.notifications || []).filter(n => !n.isRead && n.status !== "cancelled").length
                + (bcastRes.broadcasts    || []).filter(b => !b.isRead).length;
    const badge = document.getElementById("bell-badge");
    if (badge) {
      badge.textContent = count > 0 ? (count > 99 ? "99+" : count) : "";
      badge.style.display = count > 0 ? "flex" : "none";
    }
  } catch (_) {}
}
