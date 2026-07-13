// Broadcasts — provider create/manage; client banner on portal load

// ── Client broadcast banner (called once on portal load for non-providers) ───

async function loadBroadcastBanner() {
  const role = typeof getRole === "function" ? getRole() : "provider";
  if (role === "provider") return;

  try {
    const res = await apiCall("getBroadcasts", {}).catch(() => ({ broadcasts: [] }));
    const unread = (res.broadcasts || []).filter(b => !b.isRead);
    if (!unread.length) return;

    const banner = document.getElementById("broadcast-banner");
    if (!banner) return;

    banner.innerHTML = unread.map(b => `
      <div class="bcast-banner-item" id="bcast-banner-${escapeAttr(b.broadcastId)}">
        <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0;">
          <i class="bi bi-megaphone-fill" style="color:#d97706;font-size:18px;flex-shrink:0;margin-top:2px;"></i>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;margin-bottom:3px;">${escapeHtml(b.title)}</div>
            <div style="font-size:13px;line-height:1.5;white-space:pre-line;">${escapeHtml(b.message)}</div>
          </div>
          <button onclick="dismissBroadcastBanner('${escapeAttr(b.broadcastId)}')"
                  style="background:none;border:none;cursor:pointer;color:inherit;opacity:.6;
                         font-size:18px;padding:0;flex-shrink:0;line-height:1;" title="Dismiss">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>`).join("");

    banner.style.display = "block";
  } catch (_) {}
}

async function dismissBroadcastBanner(broadcastId) {
  const item = document.getElementById(`bcast-banner-${broadcastId}`);
  if (item) item.style.opacity = "0.4";
  try {
    await apiCall("markBroadcastRead", { broadcastId });
    if (item) item.remove();
    // Hide banner div if empty
    const banner = document.getElementById("broadcast-banner");
    if (banner && !banner.children.length) banner.style.display = "none";
    updateBellBadge();
  } catch (e) {
    if (item) item.style.opacity = "1";
  }
}

// ── Provider: create & manage broadcasts ─────────────────────────────────────

async function initBroadcastsSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const res = await apiCall("getBroadcastList", {});
    renderBroadcastsSection(root, res.broadcasts || []);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load broadcasts: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderBroadcastsSection(root, broadcasts) {
  const active   = broadcasts.filter(b => b.active);
  const inactive = broadcasts.filter(b => !b.active);

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-megaphone-fill"></i> Broadcasts</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Push announcements to all clients. Broadcasts appear as a banner when clients log in
        and in their Notifications feed.
      </p>
    </div>

    <!-- Create broadcast -->
    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i> New Broadcast</h2>
      <div class="row">
        <label>Title</label>
        <input id="bc-title" placeholder="e.g. Office Closure — Dec 25" style="max-width:480px;">
      </div>
      <div class="row">
        <label>Message</label>
        <textarea id="bc-message" rows="4" placeholder="Write your announcement here…"
                  style="max-width:100%;resize:vertical;"></textarea>
      </div>
      <div class="row" style="max-width:280px;">
        <label>Expires On <span style="color:var(--muted);font-weight:400;">(optional)</span></label>
        <input id="bc-expires" type="date">
      </div>
      <div id="bc-create-status" style="margin:8px 0;"></div>
      <button onclick="createBroadcast()">
        <i class="bi bi-megaphone-fill"></i> Publish Broadcast
      </button>
    </div>

    <!-- Active broadcasts -->
    <div class="card">
      <h2><i class="bi bi-broadcast"></i> Active Broadcasts</h2>
      <div id="bc-active-list">
        ${active.length
          ? active.map(b => broadcastRowHtml(b, true)).join("")
          : `<p style="color:var(--muted);font-size:13px;margin:0;">No active broadcasts.</p>`}
      </div>
    </div>

    ${inactive.length ? `
    <div class="card">
      <details>
        <summary style="font-size:13px;color:var(--muted);cursor:pointer;font-weight:600;">
          Show ${inactive.length} archived broadcast${inactive.length !== 1 ? "s" : ""}
        </summary>
        <div style="margin-top:12px;">
          ${inactive.map(b => broadcastRowHtml(b, false)).join("")}
        </div>
      </details>
    </div>` : ""}`;
}

function broadcastRowHtml(b, active) {
  const fmtDt = s => s ? new Date(s).toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" }) : "—";
  return `
    <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:8px;
                opacity:${active ? "1" : ".55"};">
      <div style="display:flex;align-items:flex-start;gap:10px;justify-content:space-between;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;">
            ${escapeHtml(b.title)}
            ${active ? `<span style="font-size:10px;font-weight:700;background:#d1fae5;color:#065f46;
              padding:1px 8px;border-radius:6px;margin-left:6px;">ACTIVE</span>` :
              `<span style="font-size:10px;font-weight:700;background:#f3f4f6;color:#6b7280;
              padding:1px 8px;border-radius:6px;margin-left:6px;">ARCHIVED</span>`}
          </div>
          <div style="font-size:13px;color:var(--text);white-space:pre-line;margin-bottom:6px;">
            ${escapeHtml(b.message)}
          </div>
          <div style="font-size:11px;color:var(--muted);">
            Created ${escapeHtml(fmtDt(b.createdAt))}
            ${b.expiresAt ? ` · Expires ${escapeHtml(fmtDt(b.expiresAt))}` : ""}
          </div>
        </div>
        ${active ? `
        <button class="secondary" style="font-size:11px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;flex-shrink:0;"
                onclick="archiveBroadcast('${escapeAttr(b.broadcastId)}', this)">
          <i class="bi bi-archive-fill"></i> Archive
        </button>` : ""}
      </div>
    </div>`;
}

async function createBroadcast() {
  const title     = ((document.getElementById("bc-title")   || {}).value || "").trim();
  const message   = ((document.getElementById("bc-message") || {}).value || "").trim();
  const expiresAt = ((document.getElementById("bc-expires") || {}).value || "").trim();
  if (!title)   { setStatus("bc-create-status", "Title is required.", "error"); return; }
  if (!message) { setStatus("bc-create-status", "Message is required.", "error"); return; }
  setStatus("bc-create-status", "Publishing…", "loading");
  try {
    await apiCall("createBroadcast", { title, message, expiresAt });
    setStatus("bc-create-status", "Broadcast published to all clients.", "success");
    document.getElementById("bc-title").value   = "";
    document.getElementById("bc-message").value = "";
    document.getElementById("bc-expires").value = "";
    setTimeout(() => initBroadcastsSection(document.getElementById("section-broadcasts")), 1200);
  } catch (e) {
    setStatus("bc-create-status", "Error: " + e.message, "error");
  }
}

async function archiveBroadcast(broadcastId, btn) {
  if (!confirm("Archive this broadcast? Clients will no longer see it.")) return;
  if (btn) btn.disabled = true;
  try {
    await apiCall("deleteBroadcast", { broadcastId });
    initBroadcastsSection(document.getElementById("section-broadcasts"));
  } catch (e) {
    alert("Error: " + e.message);
    if (btn) btn.disabled = false;
  }
}
