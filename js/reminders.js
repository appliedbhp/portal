// #10 Reminders & Messages — AI-detected reminders from session notes,
// scheduled email/SMS delivery via Twilio, and Twilio message thread view.

async function initRemindersSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const [remindersRes, progNotesRes, sessionsRes, phoneRes, msgsRes] = await Promise.all([
      apiCall("getReminders", {}),
      apiCall("getSessionNotes", {}).catch(() => ({ notes: [] })),
      apiCall("getSessions",    {}).catch(() => ({ sessions: [] })),
      apiCall("getClientPhone", {}).catch(() => ({ phone: "" })),
      apiCall("getTwilioMessages", {}).catch(() => ({ messages: [] }))
    ]);

    // Normalize program notes
    const progNotes = (progNotesRes.notes || []).map(n => ({
      noteId:      n.noteId      || n.NOTE_ID      || "",
      dateTime:    n.dateTime    || n.DATE_TIME     || "",
      sessionType: (n.sessionType || n.SESSION_TYPE || "Program Session") + " (Program)"
    }));

    // Normalize quick session notes
    const quickNotes = (sessionsRes.sessions || []).map(s => ({
      noteId:      s.sessionId   || s.SESSION_ID   || s.noteId || s.NOTE_ID || "",
      dateTime:    s.dateTime    || s.DATE_TIME     || "",
      sessionType: (s.sessionType || s.SESSION_TYPE || "Session Note") + " (Quick)"
    }));

    // Merge and sort newest first
    const allNotes = [...progNotes, ...quickNotes]
      .filter(n => n.noteId)
      .sort((a, b) => String(b.dateTime).localeCompare(String(a.dateTime)));

    renderRemindersSection(root, {
      reminders:  remindersRes.reminders || [],
      notes:      allNotes,
      phone:      phoneRes.phone       || "",
      smsConsent: phoneRes.smsConsent  || false,
      messages:   msgsRes.messages     || []
    });
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load reminders: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderRemindersSection(root, { reminders, notes, phone, smsConsent, messages }) {
  const role = (typeof getCreds === "function" ? getCreds().role : null) || "provider";
  const isProvider = role === "provider";
  const pendingReminders  = reminders.filter(r => r.status === "pending");
  const sentReminders     = reminders.filter(r => r.status === "sent");

  const noteOptions = notes.length
    ? notes.slice(0, 20).map(n => {
        const date  = String(n.dateTime || n.DATE_TIME || "").slice(0, 10);
        const label = (n.sessionType || n.SESSION_TYPE || "Note") + (date ? ` — ${date}` : "");
        return `<option value="${escapeAttr(n.noteId || n.NOTE_ID || "")}">${escapeHtml(label)}</option>`;
      }).join("")
    : `<option value="">No session notes found</option>`;

  const pendingHtml = pendingReminders.length
    ? pendingReminders.map(r => reminderRowHtml(r)).join("")
    : `<p style="color:var(--muted);font-size:13px;margin:0;">No pending reminders.</p>`;

  const sentHtml = sentReminders.length
    ? `<details style="margin-top:8px;">
        <summary style="font-size:13px;color:var(--muted);cursor:pointer;">Show ${sentReminders.length} sent reminder${sentReminders.length !== 1 ? "s" : ""}</summary>
        <div style="margin-top:8px;">${sentReminders.map(r => reminderRowHtml(r, true)).join("")}</div>
      </details>` : "";

  const threadHtml = buildThreadHtml(messages, phone);

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-bell-fill"></i> Reminders &amp; Messages</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        AI-detected reminders from session notes, scheduled email/SMS delivery, and client message history.
      </p>
    </div>

    <!-- SMS Consent & Client Phone -->
    ${isProvider ? `
    <div class="card">
      <h2><i class="bi bi-phone-fill"></i> Client Contact &amp; SMS Consent</h2>
      ${!smsConsent ? `<div class="alert alert-error" style="margin-bottom:14px;">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span><strong>SMS not enabled.</strong> The client has not yet accepted the SMS Terms of Service. SMS messaging is disabled until they consent.</span>
      </div>` : `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:8px 12px;background:#d1fae5;border-radius:8px;font-size:13px;">
        <i class="bi bi-check-circle-fill" style="color:#059669;"></i>
        <span style="color:#065f46;font-weight:600;">SMS consent on file</span>
      </div>`}
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div class="row" style="margin:0;flex:1;min-width:200px;">
          <label>Client Mobile Number (for SMS)</label>
          <input id="rm-phone" value="${escapeHtml(phone)}" placeholder="+1 555 555 5555" style="max-width:280px;">
        </div>
        <button class="secondary" onclick="saveClientPhone()" style="margin-top:20px;">
          <i class="bi bi-floppy-fill"></i> Save
        </button>
        <div id="rm-phone-status"></div>
      </div>
    </div>
    ` : `
    <div class="card" id="rm-consent-card">
      <h2><i class="bi bi-phone-fill"></i> SMS Consent &amp; Contact</h2>
      ${smsConsent ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;background:#d1fae5;border-radius:8px;font-size:13px;">
        <i class="bi bi-check-circle-fill" style="color:#059669;font-size:16px;"></i>
        <div>
          <div style="color:#065f46;font-weight:700;">You have consented to SMS messages.</div>
          <div style="color:#065f46;opacity:.8;">Reply STOP to any message to opt out at any time.</div>
        </div>
      </div>` : ""}
      <div style="background:var(--bg-alt,#f8f9fa);border:1.5px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:16px;font-size:13px;line-height:1.7;">
        <div style="font-weight:700;font-size:14px;margin-bottom:10px;color:var(--primary);">SMS Terms of Service</div>
        <p style="margin:0 0 8px;">By providing your mobile phone number, you agree to receive SMS text messages from <strong>Applied Behavioral Health Practice</strong> regarding your appointments, program updates, and task reminders.</p>
        <ul style="margin:0 0 8px;padding-left:20px;">
          <li><strong>Frequency:</strong> Message frequency varies based on your scheduled appointments and active tasks.</li>
          <li><strong>Opt-Out:</strong> You may opt out at any time by replying <strong>STOP</strong> to any message. After texting STOP, you will receive one final confirmation message.</li>
          <li><strong>Help:</strong> Reply <strong>HELP</strong> for assistance or contact us directly at <a href="tel:6193676445" style="color:var(--primary);">619-367-6445</a>.</li>
          <li><strong>Cost:</strong> Message and data rates may apply depending on your wireless carrier plan.</li>
          <li><strong>Privacy:</strong> Your information will remain confidential and will not be shared with third parties for marketing purposes.</li>
        </ul>
        <p style="margin:0;font-style:italic;font-size:12px;color:var(--muted);">By accepting these terms, you acknowledge that you have read and understood these terms and consent to receiving text messages at the number provided.</p>
      </div>
      <div class="row" style="max-width:320px;">
        <label>Your Mobile Number</label>
        <input id="rm-phone" value="${escapeHtml(phone)}" placeholder="+1 555 555 5555">
      </div>
      <label style="display:flex;align-items:flex-start;gap:10px;margin:12px 0 16px;cursor:pointer;font-size:13px;">
        <input type="checkbox" id="rm-consent-cb" ${smsConsent ? "checked" : ""} style="margin-top:2px;flex-shrink:0;">
        <span>I agree to the SMS Terms of Service above and consent to receiving text messages at the number provided.</span>
      </label>
      <div id="rm-consent-status" style="margin-bottom:8px;"></div>
      <button onclick="saveSmsConsent()" ${smsConsent ? 'class="secondary"' : ""}>
        <i class="bi bi-check-circle-fill"></i> ${smsConsent ? "Update Consent" : "Accept &amp; Save"}
      </button>
    </div>
    `}

    <!-- Detect reminders from note -->
    <div class="card">
      <h2><i class="bi bi-stars"></i> Detect Reminders from Session Note</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px;">
        Select a recent session note and AI will extract action items and suggest reminders to send the client.
      </p>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div class="row" style="margin:0;flex:1;min-width:200px;">
          <label>Session Note</label>
          <select id="rm-note-select" style="max-width:100%;">
            <option value="">— Select a note —</option>
            ${noteOptions}
          </select>
        </div>
        <button id="rm-detect-btn" onclick="detectRemindersFromNote()" style="flex-shrink:0;">
          <i class="bi bi-stars"></i> Detect Reminders
        </button>
      </div>
      <div id="rm-detect-status" style="margin:10px 0;"></div>
      <div id="rm-suggestions"></div>
    </div>

    <!-- Manual compose -->
    <div class="card">
      <h2><i class="bi bi-send-fill"></i> Send a Message</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;" class="rm-grid">
        <div class="row">
          <label>Channel</label>
          <select id="rm-channel" onchange="updateRmRecipient()">
            <option value="sms" ${!smsConsent ? "disabled" : ""}>SMS (Twilio)${!smsConsent ? " — consent required" : ""}</option>
            <option value="email" ${!smsConsent ? "selected" : ""}>Email</option>
          </select>
          ${!smsConsent ? `<p style="color:#b45309;font-size:11px;margin:4px 0 0;">SMS disabled — client must accept SMS terms first.</p>` : ""}
        </div>
        <div class="row">
          <label>Recipient</label>
          <input id="rm-recipient" value="${escapeHtml(phone)}" placeholder="+1 555 555 5555">
        </div>
        <div class="row">
          <label>Schedule For</label>
          <input id="rm-scheduledAt" type="datetime-local">
        </div>
        <div class="row">
          <label>Send Now?</label>
          <label style="display:flex;align-items:center;gap:8px;margin-top:8px;cursor:pointer;">
            <input type="checkbox" id="rm-send-now" onchange="toggleSchedule(this)"> Send immediately
          </label>
        </div>
        <div class="row" style="grid-column:1/-1;">
          <label>Message</label>
          <textarea id="rm-message" rows="3" placeholder="Enter message to client…" style="max-width:100%;resize:vertical;"></textarea>
        </div>
      </div>
      <div id="rm-compose-status" style="margin:8px 0;"></div>
      <button onclick="scheduleOrSendReminder()">
        <i class="bi bi-send-fill"></i> <span id="rm-send-btn-label">Schedule Message</span>
      </button>
    </div>

    <!-- Pending reminders -->
    <div class="card">
      <h2><i class="bi bi-clock-fill"></i> Pending Reminders</h2>
      <div id="rm-pending-list">${pendingHtml}</div>
      ${sentHtml}
    </div>

    <!-- Twilio message thread -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <h2 style="margin:0;"><i class="bi bi-chat-dots-fill"></i> Message Thread</h2>
        <button class="secondary" style="font-size:12px;" onclick="refreshMessageThread()">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>
      <div id="rm-thread">${threadHtml}</div>
    </div>

    <style>
      @media (max-width: 640px) { .rm-grid { grid-template-columns: 1fr !important; } }
      .rm-suggestion-item { border:1.5px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px; }
      .rm-bubble { max-width:75%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;margin-bottom:8px; }
      .rm-bubble.outbound { background:#1e3a8a;color:#fff;margin-left:auto;border-bottom-right-radius:4px; }
      .rm-bubble.inbound  { background:var(--border);color:var(--text);margin-right:auto;border-bottom-left-radius:4px; }
      .rm-bubble-meta { font-size:10px;opacity:.65;margin-top:4px; }
    </style>`;

  // Set default scheduled time to 9am tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const pad = n => String(n).padStart(2, "0");
  document.getElementById("rm-scheduledAt").value =
    `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T09:00`;
}

function reminderRowHtml(r, sent) {
  const chIcon = r.channel === "sms" ? "bi-phone-fill" : "bi-envelope-fill";
  const chColor= r.channel === "sms" ? "#7c3aed" : "#1d4ed8";
  const fmtDt  = s => String(s || "").replace("T", " ").slice(0, 16);
  return `
    <div style="padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;margin-bottom:8px;
                opacity:${sent ? ".65" : "1"};">
      <div style="display:flex;align-items:flex-start;gap:10px;justify-content:space-between;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <i class="bi ${chIcon}" style="color:${chColor};font-size:13px;"></i>
            <span style="font-size:11px;font-weight:700;color:${chColor};">${escapeHtml(r.channel.toUpperCase())}</span>
            <span style="font-size:11px;color:var(--muted);">→ ${escapeHtml(r.recipient)}</span>
            <span style="font-size:11px;color:var(--muted);">📅 ${escapeHtml(fmtDt(r.scheduledAt))}</span>
            ${r.status === "sent" ? `<span style="font-size:10px;font-weight:700;background:#d1fae5;color:#065f46;padding:1px 7px;border-radius:6px;">SENT</span>` : ""}
            ${r.status === "failed" ? `<span style="font-size:10px;font-weight:700;background:#fee2e2;color:#dc2626;padding:1px 7px;border-radius:6px;">FAILED</span>` : ""}
          </div>
          <div style="font-size:13px;color:var(--text);">${escapeHtml(r.message)}</div>
        </div>
        ${!sent ? `<button class="secondary" style="font-size:11px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;flex-shrink:0;"
          onclick="cancelReminder('${escapeAttr(r.reminderId)}')">
          <i class="bi bi-x-lg"></i> Cancel
        </button>` : ""}
      </div>
    </div>`;
}

function buildThreadHtml(messages, phone) {
  if (!phone) return `<p style="color:var(--muted);font-size:13px;margin:0;">Enter a client mobile number above to view their message thread.</p>`;
  if (!messages.length) return `<p style="color:var(--muted);font-size:13px;margin:0;">No messages found for this number.</p>`;

  return `<div style="display:flex;flex-direction:column;gap:4px;padding:4px 0;">` +
    messages.map(m => {
      const out = m.direction === "outbound-api" || m.direction === "outbound";
      const fmtD = s => s ? new Date(s).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "";
      return `
        <div style="display:flex;flex-direction:column;align-items:${out ? "flex-end" : "flex-start"};">
          <div class="rm-bubble ${out ? "outbound" : "inbound"}">
            ${escapeHtml(m.body || "")}
            <div class="rm-bubble-meta">${escapeHtml(fmtD(m.dateSent || m.dateCreated))}</div>
          </div>
        </div>`;
    }).join("") + `</div>`;
}

function updateRmRecipient() {
  const channel   = (document.getElementById("rm-channel") || {}).value;
  const phoneEl   = document.getElementById("rm-phone");
  const recipEl   = document.getElementById("rm-recipient");
  if (!recipEl) return;
  if (channel === "sms") {
    recipEl.placeholder = "+1 555 555 5555";
    recipEl.value = phoneEl ? phoneEl.value : recipEl.value;
  } else {
    recipEl.placeholder = "client@email.com";
    recipEl.value = "";
  }
}

function toggleSchedule(cb) {
  const schedEl = document.getElementById("rm-scheduledAt");
  const btnLabel = document.getElementById("rm-send-btn-label");
  if (schedEl) schedEl.disabled = cb.checked;
  if (btnLabel) btnLabel.textContent = cb.checked ? "Send Now" : "Schedule Message";
}

async function saveSmsConsent() {
  const phone   = ((document.getElementById("rm-phone") || {}).value || "").trim();
  const consent = (document.getElementById("rm-consent-cb") || {}).checked || false;
  if (!phone) { setStatus("rm-consent-status", "Please enter a mobile number.", "error"); return; }
  if (!consent) { setStatus("rm-consent-status", "Please check the box to agree to the SMS Terms.", "error"); return; }
  setStatus("rm-consent-status", "Saving…", "loading");
  try {
    await apiCall("saveSmsConsent", { phone, consent: true });
    setStatus("rm-consent-status", "Saved! SMS messaging is now enabled.", "success");
    // Update recipient field
    const r = document.getElementById("rm-recipient");
    if (r) r.value = phone;
    // Re-enable SMS option in channel selects
    document.querySelectorAll("option[value='sms'][disabled]").forEach(o => {
      o.disabled = false;
      o.textContent = "SMS";
    });
  } catch (e) {
    setStatus("rm-consent-status", "Error: " + e.message, "error");
  }
}

async function saveClientPhone() {
  const phone = (document.getElementById("rm-phone") || {}).value || "";
  setStatus("rm-phone-status", "Saving…", "loading");
  try {
    await apiCall("saveClientPhone", { phone: phone.trim() });
    setStatus("rm-phone-status", "Saved.", "success");
    const ch = (document.getElementById("rm-channel") || {}).value;
    if (ch === "sms") {
      const r = document.getElementById("rm-recipient");
      if (r) r.value = phone.trim();
    }
  } catch (e) {
    setStatus("rm-phone-status", "Error: " + e.message, "error");
  }
}

async function detectRemindersFromNote() {
  const noteId = (document.getElementById("rm-note-select") || {}).value || "";
  if (!noteId) { setStatus("rm-detect-status", "Please select a session note.", "error"); return; }
  const btn = document.getElementById("rm-detect-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Detecting…`; }
  setStatus("rm-detect-status", "Analyzing note with AI — this may take 15–20 seconds…", "loading");
  document.getElementById("rm-suggestions").innerHTML = "";
  try {
    const res = await Promise.race([
      apiCall("detectReminders", { noteId }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Timed out — try again")), 60000))
    ]);
    const suggestions = res.suggestions || [];
    if (!suggestions.length) {
      setStatus("rm-detect-status", "No specific reminders detected in this note.", "success");
    } else {
      setStatus("rm-detect-status", `${suggestions.length} reminder${suggestions.length !== 1 ? "s" : ""} detected — review and schedule below.`, "success");
      renderSuggestions(suggestions);
    }
  } catch (e) {
    setStatus("rm-detect-status", "Error: " + e.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-stars"></i> Detect Reminders`; }
  }
}

function renderSuggestions(suggestions) {
  const phone = (document.getElementById("rm-phone") || {}).value || "";
  // Read current smsConsent from the DOM (consent badge present = consented)
  const smsOk = !!document.querySelector("#rm-consent-card .bi-check-circle-fill, [style*='#d1fae5'] .bi-check-circle-fill") ||
                !document.querySelector("[disabled][value='sms']");
  document.getElementById("rm-suggestions").innerHTML = suggestions.map((s, i) => {
    const suggestedDt = suggestDatetime(s.timing);
    return `
      <div class="rm-suggestion-item">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--primary);">
          <i class="bi bi-lightbulb-fill"></i> ${escapeHtml(s.label || "Reminder")}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px;" class="rm-grid">
          <div class="row" style="margin:0;">
            <label>Channel</label>
            <select id="sg-channel-${i}" style="max-width:100%;">
              <option value="sms" ${!smsOk ? "disabled" : ""}>SMS${!smsOk ? " — consent required" : ""}</option>
              <option value="email" ${!smsOk ? "selected" : ""}>Email</option>
            </select>
          </div>
          <div class="row" style="margin:0;">
            <label>Schedule For</label>
            <input id="sg-dt-${i}" type="datetime-local" value="${escapeHtml(suggestedDt)}" style="max-width:100%;">
          </div>
          <div class="row" style="grid-column:1/-1;margin:0;">
            <label>Message</label>
            <textarea id="sg-msg-${i}" rows="2" style="max-width:100%;resize:vertical;">${escapeHtml(s.message)}</textarea>
          </div>
        </div>
        <div id="sg-status-${i}" style="margin:6px 0;"></div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button onclick="scheduleSuggestion(${i}, '${escapeAttr(phone)}')">
            <i class="bi bi-calendar-check-fill"></i> Schedule
          </button>
          <button class="secondary" onclick="this.closest('.rm-suggestion-item').remove()">
            <i class="bi bi-x-lg"></i> Dismiss
          </button>
        </div>
      </div>`;
  }).join("");
}

function suggestDatetime(timing) {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T09:00`;
  if (!timing) { const d = new Date(now); d.setDate(d.getDate()+1); return fmt(d); }
  const t = timing.toLowerCase();
  if (t.includes("today"))    return fmt(now);
  if (t.includes("tomorrow")) { const d = new Date(now); d.setDate(d.getDate()+1); return fmt(d); }
  if (t.includes("week"))     { const d = new Date(now); d.setDate(d.getDate()+7); return fmt(d); }
  if (t.includes("2 day") || t.includes("two day")) { const d = new Date(now); d.setDate(d.getDate()+2); return fmt(d); }
  if (t.includes("3 day") || t.includes("three day")) { const d = new Date(now); d.setDate(d.getDate()+3); return fmt(d); }
  if (t.includes("month"))    { const d = new Date(now); d.setDate(d.getDate()+30); return fmt(d); }
  const d = new Date(now); d.setDate(d.getDate()+1); return fmt(d);
}

async function scheduleSuggestion(i, phone) {
  const channel     = (document.getElementById(`sg-channel-${i}`) || {}).value || "sms";
  const scheduledAt = (document.getElementById(`sg-dt-${i}`)      || {}).value || "";
  const message     = (document.getElementById(`sg-msg-${i}`)     || {}).value || "";
  const recipient   = channel === "sms" ? phone : "";
  if (!message.trim()) { setStatus(`sg-status-${i}`, "Message is required.", "error"); return; }
  if (!scheduledAt)    { setStatus(`sg-status-${i}`, "Schedule time is required.", "error"); return; }
  setStatus(`sg-status-${i}`, "Scheduling…", "loading");
  try {
    await apiCall("scheduleReminder", { channel, recipient, scheduledAt, message: message.trim() });
    setStatus(`sg-status-${i}`, "Scheduled!", "success");
    setTimeout(() => {
      const item = document.querySelector(`#sg-status-${i}`)?.closest(".rm-suggestion-item");
      if (item) item.remove();
      refreshPendingReminders();
    }, 1500);
  } catch (e) {
    setStatus(`sg-status-${i}`, "Error: " + e.message, "error");
  }
}

async function scheduleOrSendReminder() {
  const channel     = (document.getElementById("rm-channel")     || {}).value || "sms";
  const recipient   = (document.getElementById("rm-recipient")   || {}).value || "";
  const message     = (document.getElementById("rm-message")     || {}).value || "";
  const sendNow     = (document.getElementById("rm-send-now")    || {}).checked;
  const scheduledAt = (document.getElementById("rm-scheduledAt") || {}).value || "";

  if (!message.trim())  { setStatus("rm-compose-status", "Message is required.", "error"); return; }
  if (!recipient.trim()){ setStatus("rm-compose-status", "Recipient is required.", "error"); return; }
  if (!sendNow && !scheduledAt) { setStatus("rm-compose-status", "Set a schedule time or check Send Now.", "error"); return; }

  setStatus("rm-compose-status", sendNow ? "Sending…" : "Scheduling…", "loading");
  try {
    const payload = { channel, recipient: recipient.trim(), message: message.trim(),
                      scheduledAt: sendNow ? new Date().toISOString() : scheduledAt,
                      sendNow };
    const res = await apiCall("scheduleReminder", payload);
    if (sendNow && res.sent) {
      setStatus("rm-compose-status", "Message sent!", "success");
      refreshMessageThread();
    } else {
      setStatus("rm-compose-status", "Scheduled.", "success");
    }
    document.getElementById("rm-message").value = "";
    refreshPendingReminders();
  } catch (e) {
    setStatus("rm-compose-status", "Error: " + e.message, "error");
  }
}

async function cancelReminder(reminderId) {
  if (!confirm("Cancel this reminder?")) return;
  try {
    await apiCall("deleteReminder", { reminderId });
    refreshPendingReminders();
  } catch (e) { alert("Error: " + e.message); }
}

async function refreshPendingReminders() {
  try {
    const res = await apiCall("getReminders", {});
    const reminders = res.reminders || [];
    const pending   = reminders.filter(r => r.status === "pending");
    const sent      = reminders.filter(r => r.status === "sent");
    const el = document.getElementById("rm-pending-list");
    if (el) el.innerHTML = pending.length
      ? pending.map(r => reminderRowHtml(r)).join("")
      : `<p style="color:var(--muted);font-size:13px;margin:0;">No pending reminders.</p>`;
  } catch (_) {}
}

async function refreshMessageThread() {
  const el = document.getElementById("rm-thread");
  if (el) el.innerHTML = `<p style="color:var(--muted);font-size:13px;">Refreshing…</p>`;
  const phone = (document.getElementById("rm-phone") || {}).value || "";
  try {
    const res = await apiCall("getTwilioMessages", {});
    if (el) el.innerHTML = buildThreadHtml(res.messages || [], phone);
  } catch (e) {
    if (el) el.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${escapeHtml(e.message)}</p>`;
  }
}
