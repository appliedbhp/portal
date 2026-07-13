// Client/parent Settings section — SMS consent & contact preferences

async function initSettingsSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const res = await apiCall("getClientPhone", {}).catch(() => ({ phone: "", smsConsent: false }));
    renderSettingsSection(root, {
      phone:      res.phone      || "",
      smsConsent: res.smsConsent || false
    });
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load settings: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderSettingsSection(root, { phone, smsConsent }) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-gear-fill"></i> Settings</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Manage your contact preferences and communication settings.
      </p>
    </div>

    <!-- SMS Consent -->
    <div class="card">
      <h2><i class="bi bi-phone-fill"></i> SMS Messaging</h2>

      ${smsConsent
        ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:12px 16px;
                       background:#d1fae5;border-radius:10px;">
            <i class="bi bi-check-circle-fill" style="color:#059669;font-size:20px;flex-shrink:0;"></i>
            <div>
              <div style="font-weight:700;color:#065f46;font-size:14px;">SMS messaging is enabled</div>
              <div style="color:#065f46;font-size:13px;opacity:.85;">
                You are subscribed to SMS reminders and updates. Reply <strong>STOP</strong> to any message to opt out at any time.
              </div>
            </div>
          </div>`
        : `<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:12px 16px;
                       background:#fef3c7;border-radius:10px;border:1.5px solid #fcd34d;">
            <i class="bi bi-bell-slash-fill" style="color:#b45309;font-size:20px;flex-shrink:0;"></i>
            <div>
              <div style="font-weight:700;color:#92400e;font-size:14px;">SMS messaging is not yet enabled</div>
              <div style="color:#92400e;font-size:13px;opacity:.85;">
                Review the terms below and accept to receive appointment reminders and task updates by text.
              </div>
            </div>
          </div>`
      }

      <div style="background:var(--bg-alt,#f8f9fa);border:1.5px solid var(--border);border-radius:10px;
                  padding:18px 20px;margin-bottom:18px;font-size:13px;line-height:1.75;">
        <div style="font-weight:700;font-size:14px;margin-bottom:12px;color:var(--primary);">
          <i class="bi bi-file-text-fill"></i> SMS Terms of Service
        </div>
        <p style="margin:0 0 10px;">
          By providing your mobile phone number, you agree to receive SMS text messages from
          <strong>Applied Behavioral Health Practice</strong> regarding your appointments,
          program updates, and task reminders.
        </p>
        <ul style="margin:0 0 10px;padding-left:22px;display:flex;flex-direction:column;gap:6px;">
          <li>
            <strong>Frequency:</strong> Message frequency varies based on your scheduled
            appointments and active tasks.
          </li>
          <li>
            <strong>Opt-Out:</strong> You may opt out at any time by replying <strong>STOP</strong>
            to any message. After texting STOP, you will receive one final confirmation message.
          </li>
          <li>
            <strong>Help:</strong> Reply <strong>HELP</strong> for assistance or contact us directly
            at <a href="tel:6193676445" style="color:var(--primary);">619-367-6445</a>.
          </li>
          <li>
            <strong>Cost:</strong> Message and data rates may apply depending on your wireless
            carrier plan.
          </li>
          <li>
            <strong>Privacy:</strong> Your information will remain confidential and will not be
            shared with third parties for marketing purposes.
          </li>
        </ul>
        <p style="margin:0;font-size:12px;color:var(--muted);font-style:italic;">
          By accepting these terms, you acknowledge that you have read and understood these terms
          and consent to receiving text messages at the number provided.
        </p>
      </div>

      <div class="row" style="max-width:340px;">
        <label>Your Mobile Number</label>
        <input id="st-phone" type="tel" value="${escapeHtml(phone)}"
               placeholder="+1 555 555 5555">
      </div>

      <label style="display:flex;align-items:flex-start;gap:10px;margin:14px 0 18px;cursor:pointer;
                    font-size:13px;line-height:1.5;">
        <input type="checkbox" id="st-consent-cb" ${smsConsent ? "checked" : ""}
               style="margin-top:2px;flex-shrink:0;width:16px;height:16px;">
        <span>I agree to the SMS Terms of Service above and consent to receiving text messages
          from Applied Behavioral Health Practice at the number provided.</span>
      </label>

      <div id="st-consent-status" style="margin-bottom:10px;"></div>

      <button onclick="saveSettingsSmsConsent()" ${smsConsent ? 'class="secondary"' : ""}>
        <i class="bi bi-check-circle-fill"></i>
        ${smsConsent ? "Update Preferences" : "Accept &amp; Enable SMS"}
      </button>

      ${smsConsent ? `
      <button class="secondary" onclick="revokeSettingsSmsConsent()"
              style="margin-left:10px;color:#dc2626;border-color:#fca5a5;">
        <i class="bi bi-x-circle-fill"></i> Revoke Consent
      </button>` : ""}
    </div>`;
}

async function saveSettingsSmsConsent() {
  const phone   = ((document.getElementById("st-phone") || {}).value || "").trim();
  const consent = (document.getElementById("st-consent-cb") || {}).checked || false;
  if (!phone)   { setStatus("st-consent-status", "Please enter your mobile number.", "error"); return; }
  if (!consent) { setStatus("st-consent-status", "Please check the box to agree to the terms.", "error"); return; }
  setStatus("st-consent-status", "Saving…", "loading");
  try {
    await apiCall("saveSmsConsent", { phone, consent: true });
    setStatus("st-consent-status", "Saved! SMS messaging is now enabled.", "success");
    setTimeout(() => initSettingsSection(document.getElementById("section-settings")), 1500);
  } catch (e) {
    setStatus("st-consent-status", "Error: " + e.message, "error");
  }
}

async function revokeSettingsSmsConsent() {
  if (!confirm("Are you sure you want to turn off SMS messaging? You will no longer receive text reminders.")) return;
  setStatus("st-consent-status", "Revoking…", "loading");
  try {
    await apiCall("saveSmsConsent", { consent: false });
    setStatus("st-consent-status", "SMS messaging has been disabled.", "success");
    setTimeout(() => initSettingsSection(document.getElementById("section-settings")), 1200);
  } catch (e) {
    setStatus("st-consent-status", "Error: " + e.message, "error");
  }
}
