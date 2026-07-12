// Client notification bell — polls getClientNotifications and renders a
// pulsing badge + slide-down panel. Provider-only: not loaded for providers.

let _notifData   = [];
let _notifOpen   = false;
let _notifPollId = null;

async function initNotifications() {
  if (isProvider()) return;

  // Inject bell button into header
  const btnRow = document.querySelector(".portal-header .btn-row");
  if (btnRow && !document.getElementById("notifBellBtn")) {
    const btn = document.createElement("button");
    btn.id        = "notifBellBtn";
    btn.className = "secondary";
    btn.title     = "Notifications";
    btn.innerHTML = `<i class="bi bi-bell-fill"></i><span id="notifBadge" style="display:none;"></span>`;
    btn.onclick   = toggleNotifPanel;
    btn.style.cssText = "position:relative;padding:9px 13px;";
    btnRow.insertBefore(btn, btnRow.firstChild);
  }

  // Inject panel container into body
  if (!document.getElementById("notif-panel-wrap")) {
    const wrap = document.createElement("div");
    wrap.id = "notif-panel-wrap";
    document.body.appendChild(wrap);
  }

  await refreshNotifications();
  // Re-poll every 5 minutes
  _notifPollId = setInterval(refreshNotifications, 5 * 60 * 1000);
}

async function refreshNotifications() {
  try {
    const res = await apiCall("getClientNotifications", {});
    _notifData = res.notifications || [];
    renderNotifBadge();
    if (_notifOpen) renderNotifPanel();
  } catch (_) {}
}

function renderNotifBadge() {
  const badge = document.getElementById("notifBadge");
  const btn   = document.getElementById("notifBellBtn");
  if (!badge || !btn) return;

  const count = _notifData.length;
  if (count === 0) {
    badge.style.display = "none";
    btn.classList.remove("notif-pulse");
    return;
  }

  badge.textContent   = count > 9 ? "9+" : count;
  badge.style.display = "inline-flex";
  btn.classList.add("notif-pulse");
}

function toggleNotifPanel() {
  _notifOpen = !_notifOpen;
  if (_notifOpen) {
    renderNotifPanel();
  } else {
    const wrap = document.getElementById("notif-panel-wrap");
    if (wrap) wrap.innerHTML = "";
  }
}

function renderNotifPanel() {
  const wrap = document.getElementById("notif-panel-wrap");
  if (!wrap) return;

  const items = _notifData.length
    ? _notifData.map(n => {
        const actionHtml = n.docUrl
          ? `<a href="${escapeHtml(n.docUrl)}" target="_blank" rel="noopener"
               style="font-size:11px;font-weight:700;color:var(--primary);text-decoration:none;margin-left:auto;flex-shrink:0;">
               Open Doc <i class="bi bi-box-arrow-up-right"></i>
             </a>`
          : "";
        return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;
                      border-bottom:1px solid var(--border);">
            <i class="bi bi-${escapeHtml(n.icon)}"
               style="color:${escapeHtml(n.color)};font-size:18px;flex-shrink:0;margin-top:1px;margin-right:0;"></i>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:700;color:var(--text);">${escapeHtml(n.title)}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;line-height:1.4;">${escapeHtml(n.message)}</div>
            </div>
            ${actionHtml}
          </div>`;
      }).join("")
    : `<div style="padding:20px 16px;text-align:center;color:var(--muted);font-size:13px;">
         <i class="bi bi-check-circle-fill" style="font-size:20px;color:#059669;display:block;margin-bottom:6px;"></i>
         You're all caught up!
       </div>`;

  wrap.innerHTML = `
    <div id="notif-overlay" onclick="toggleNotifPanel()"
         style="position:fixed;inset:0;z-index:899;"></div>
    <div id="notif-panel"
         style="position:fixed;top:65px;right:16px;width:340px;max-width:calc(100vw - 32px);
                max-height:calc(100vh - 90px);overflow-y:auto;
                background:var(--card);border:1px solid var(--border);border-radius:12px;
                box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:900;animation:notif-slide-in .18s ease;">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);
                  display:flex;align-items:center;justify-content:space-between;
                  position:sticky;top:0;background:var(--card);border-radius:12px 12px 0 0;">
        <span style="font-weight:700;font-size:14px;"><i class="bi bi-bell-fill"></i> Notifications</span>
        <button class="secondary icon-btn" onclick="toggleNotifPanel()" style="width:28px;height:28px;">
          <i class="bi bi-x-lg" style="font-size:12px;margin:0;"></i>
        </button>
      </div>
      ${items}
    </div>`;
}
