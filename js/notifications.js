// Client notification center — AI-scheduled reminders with read/unread tracking

let _ntfNotifications = [];  // module-level cache updated on render + toggle
let _ntfActiveFilter  = "all";
let _ntfMessaging = { portalMessages:[], smsMessages:[], phone:"", smsNumber:"", smsConsent:false };

async function initNotificationsSection(root, options = {}) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const [notifRes, bcastRes, portalRes, smsRes, phoneRes] = await Promise.all([
      apiCall("getNotifications", {}),
      apiCall("getBroadcasts",    {}).catch(() => ({ broadcasts: [] })),
      apiCall("getPortalMessages", {}).catch(() => ({ messages: [] })),
      apiCall("getTwilioMessages", {}).catch(() => ({ messages: [], clientPhone:"", smsNumber:"" })),
      apiCall("getClientPhone", {}).catch(() => ({ phone:"", smsConsent:false }))
    ]);
    renderNotificationsSection(root, {
      notifications: notifRes.notifications || [],
      broadcasts:    bcastRes.broadcasts    || [],
      portalMessages: portalRes.messages || [],
      smsMessages: smsRes.messages || [],
      phone: phoneRes.phone || smsRes.clientPhone || "",
      smsNumber: smsRes.smsNumber || "",
      smsConsent: !!phoneRes.smsConsent
    }, options);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load notifications: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderNotificationsSection(root, { notifications, broadcasts, portalMessages = [], smsMessages = [], phone = "", smsNumber = "", smsConsent = false }, options = {}) {
  const compact = !!options.compact;
  const unreadCount = notifications.filter(n => !n.isRead && n.status !== "cancelled").length
                    + broadcasts.filter(b => !b.isRead).length
                    + portalMessages.filter(m => !m.mine && !m.isRead).length;
  _ntfMessaging = { portalMessages, smsMessages, phone, smsNumber, smsConsent };

  root.innerHTML = `
    <div class="card" style="${compact ? "margin-bottom:10px;" : ""}">
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
        <button class="secondary" onclick="initNotificationsSection(document.getElementById('${escapeAttr(root.id)}'), { compact: ${compact} })"
                style="font-size:12px;">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>
    </div>

    <div class="card ntf-conversation-card">
      <div class="ntf-conversation-head">
        <div><h2><i class="bi bi-chat-dots-fill"></i> Conversation</h2><p>Portal replies and SMS messages in one thread.</p></div>
        <button class="secondary icon-btn" onclick="ntfRefreshConversation()" aria-label="Refresh conversation"><i class="bi bi-arrow-clockwise"></i></button>
      </div>
      <div id="ntf-conversation-thread" class="ntf-conversation-thread">${ntfConversationHtml()}</div>
      <div class="ntf-composer">
        <textarea id="ntf-message" rows="3" maxlength="1600" placeholder="Write a message…"></textarea>
        <div class="ntf-compose-actions">
          <button onclick="ntfSendPortalReply()"><i class="bi bi-shield-lock-fill"></i> Send Portal Reply</button>
          ${getRole() === "provider"
            ? `<button class="secondary" onclick="ntfSendProviderSms()" ${!phone || !smsConsent ? "disabled" : ""}><i class="bi bi-phone-fill"></i> Send SMS</button>`
            : `<button class="secondary" onclick="ntfOpenSmsApp()" ${!smsNumber ? "disabled" : ""}><i class="bi bi-phone-fill"></i> Open SMS App</button>`}
        </div>
        <div id="ntf-message-status"></div>
        ${getRole() === "provider" && !smsConsent ? `<div class="field-hint"><i class="bi bi-info-circle-fill"></i>SMS requires the client’s consent; portal replies remain available.</div>` : ""}
        ${getRole() !== "provider" ? `<div class="field-hint"><i class="bi bi-phone"></i>Open SMS App sends from your own phone number. Send Portal Reply keeps the message inside the portal.</div>` : ""}
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
      .ntf-conversation-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.ntf-conversation-head h2{margin:0}.ntf-conversation-head p{margin:3px 0 0;color:var(--muted);font-size:12px}
      .ntf-conversation-thread{display:flex;flex-direction:column;gap:7px;max-height:300px;overflow:auto;padding:10px;border:1px solid var(--border);border-radius:12px;background:linear-gradient(145deg,#f8faff,#f6fbff)}
      .ntf-msg{display:flex;flex-direction:column;max-width:82%}.ntf-msg.mine{align-self:flex-end;align-items:flex-end}.ntf-msg.theirs{align-self:flex-start;align-items:flex-start}.ntf-msg-body{padding:9px 12px;border-radius:14px;background:#e2e8f0;color:var(--text);font-size:13px;line-height:1.45}.ntf-msg.mine .ntf-msg-body{background:linear-gradient(135deg,#4338ca,#3185fc);color:#fff}.ntf-msg-meta{margin:3px 4px 0;color:var(--muted);font-size:9px}.ntf-channel{font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      .ntf-composer{margin-top:10px}.ntf-composer textarea{width:100%;resize:vertical;min-height:72px}.ntf-compose-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:7px}.ntf-compose-actions button{font-size:12px;padding:7px 11px}
    </style>`;

  // Store notifications in module cache for filter re-renders
  _ntfNotifications = notifications;
  _ntfActiveFilter  = "all";

  // Set active tab style
  ntfSetActiveTab("all");

  if (portalMessages.some(m => !m.mine && !m.isRead)) {
    apiCall("markPortalMessagesRead", {}).then(() => updateBellBadge()).catch(() => {});
  }

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

function ntfConversationHtml() {
  const role = getRole() === "provider" ? "provider" : "client";
  const portal = (_ntfMessaging.portalMessages || []).map(m => ({
    body:m.body || "", at:m.createdAt || "", mine:!!m.mine, channel:"Portal"
  }));
  const sms = (_ntfMessaging.smsMessages || []).map(m => {
    const outbound = m.direction === "outbound-api" || m.direction === "outbound";
    return { body:m.body || "", at:m.dateSent || m.dateCreated || "", mine:role === "provider" ? outbound : !outbound, channel:"SMS" };
  });
  const messages = portal.concat(sms).sort((a,b) => new Date(a.at || 0) - new Date(b.at || 0));
  if (!messages.length) return `<p style="color:var(--muted);font-size:12px;margin:4px;">No messages yet. Start the conversation below.</p>`;
  return messages.map(m => {
    const date = m.at ? new Date(m.at) : null;
    const when = date && !isNaN(date) ? date.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "";
    return `<div class="ntf-msg ${m.mine ? "mine" : "theirs"}"><div class="ntf-msg-body">${escapeHtml(m.body)}</div><div class="ntf-msg-meta"><span class="ntf-channel">${m.channel}</span>${when ? " · " + escapeHtml(when) : ""}</div></div>`;
  }).join("");
}

function ntfCurrentRoot() {
  const popout = document.getElementById("notifications-popout");
  return popout?.classList.contains("open") ? document.getElementById("notifications-popout-body") : document.getElementById("section-notifications");
}

async function ntfRefreshConversation() {
  const root = ntfCurrentRoot();
  if (root) await initNotificationsSection(root, { compact:root.id === "notifications-popout-body" });
}

async function ntfSendPortalReply() {
  const input = document.getElementById("ntf-message");
  const message = input?.value.trim() || "";
  if (!message) { setStatus("ntf-message-status", "Write a message first.", "error"); return; }
  setStatus("ntf-message-status", "Sending portal reply…", "loading");
  try {
    await apiCall("sendPortalMessage", { message });
    if (input) input.value = "";
    await ntfRefreshConversation();
  } catch (e) { setStatus("ntf-message-status", "Error: " + e.message, "error"); }
}

async function ntfSendProviderSms() {
  const input = document.getElementById("ntf-message");
  const message = input?.value.trim() || "";
  if (!message) { setStatus("ntf-message-status", "Write a message first.", "error"); return; }
  if (!_ntfMessaging.phone) { setStatus("ntf-message-status", "No client mobile number is on file.", "error"); return; }
  setStatus("ntf-message-status", "Sending SMS…", "loading");
  try {
    await apiCall("scheduleReminder", { channel:"sms", recipient:_ntfMessaging.phone, message, scheduledAt:new Date().toISOString(), sendNow:true });
    if (input) input.value = "";
    await ntfRefreshConversation();
  } catch (e) { setStatus("ntf-message-status", "Error: " + e.message, "error"); }
}

function ntfOpenSmsApp() {
  const number = _ntfMessaging.smsNumber || "";
  if (!number) { setStatus("ntf-message-status", "The practice SMS number is not configured.", "error"); return; }
  const message = document.getElementById("ntf-message")?.value.trim() || "";
  const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "&" : "?";
  window.location.href = `sms:${number}${message ? separator + "body=" + encodeURIComponent(message) : ""}`;
}

if (!window._ntfConversationRefreshTimer) {
  window._ntfConversationRefreshTimer = setInterval(() => {
    if (document.getElementById("notifications-popout")?.classList.contains("open")) ntfRefreshConversation();
  }, 30000);
}

// Filter tabs
function ntfFilter(filter) {
  _ntfActiveFilter = filter;
  ntfSetActiveTab(filter);
  const el = document.getElementById("ntf-list");
  if (el) el.innerHTML = renderNotifList(_ntfNotifications, filter);
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

    // Update the cached array in place
    const cached = _ntfNotifications.find(n => n.reminderId === reminderId);
    if (cached) {
      cached.isRead  = markRead;
      cached.readAt  = markRead ? new Date().toISOString() : "";
    }

    // Re-render the current filter so tabs stay consistent
    const el = document.getElementById("ntf-list");
    if (el) el.innerHTML = renderNotifList(_ntfNotifications, _ntfActiveFilter);

    // Update unread count in section header
    const unreadCount = _ntfNotifications.filter(n => !n.isRead && n.status !== "cancelled").length;
    const badge = document.querySelector("#section-notifications h1 span");
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = "inline";
      } else {
        badge.style.display = "none";
      }
    }

    updateBellBadge();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// ── Bell badge (called on portal load and after read state changes) ───────────
async function updateBellBadge() {
  try {
    const provider = getRole() === "provider";
    const [notifRes, bcastRes, portalRes] = await Promise.all([
      provider ? Promise.resolve({ notifications:[] }) : apiCall("getNotifications", {}).catch(() => ({ notifications: [] })),
      provider ? Promise.resolve({ broadcasts:[] }) : apiCall("getBroadcasts", {}).catch(() => ({ broadcasts: [] })),
      apiCall("getPortalMessages", {}).catch(() => ({ messages: [] }))
    ]);
    const count = (notifRes.notifications || []).filter(n => !n.isRead && n.status !== "cancelled").length
                + (bcastRes.broadcasts    || []).filter(b => !b.isRead).length
                + (portalRes.messages     || []).filter(m => !m.mine && !m.isRead).length;
    const badge = document.getElementById("bell-badge");
    if (badge) {
      badge.textContent = count > 0 ? (count > 99 ? "99+" : count) : "";
      badge.style.display = count > 0 ? "flex" : "none";
    }
  } catch (_) {}
}
