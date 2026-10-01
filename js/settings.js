// Client/parent Settings section — SMS consent, contact preferences, avatar

async function initSettingsSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const [phoneRes, avatarRes, timeZoneRes, youthRes] = await Promise.all([
      apiCall("getClientPhone", {}).catch(() => ({ phone: "", smsConsent: false })),
      apiCall("getAvatar", {}).catch(() => ({ avatarJson: null })),
      apiCall("getClientTimeZone", {}).catch(() => ({ timeZone: "America/Los_Angeles" })),
      apiCall("getYouthPreferences", {}).catch(() => ({ preferences: typeof getYouthPreferences === "function" ? getYouthPreferences() : {} }))
    ]);
    const avatarJson = avatarRes.avatarJson || null;
    renderSettingsSection(root, {
      phone:      phoneRes.phone      || "",
      smsConsent: phoneRes.smsConsent || false,
      avatarJson,
      timeZone: timeZoneRes.timeZone || "America/Los_Angeles",
      youth: youthRes.preferences || {}
    });
    if (avatarJson) restoreAvatarCreator(avatarJson);
    else updateMicahPreview();
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load settings: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderSettingsSection(root, { phone, smsConsent, avatarJson, timeZone, youth }) {
  let savedAvatar={};try{savedAvatar=avatarJson?JSON.parse(avatarJson):{};}catch(_){}
  const avatarStyle=savedAvatar.style==="micah"?"micah":"openPeeps";
  const micahSeed=savedAvatar.style==="micah"&&savedAvatar.seed?savedAvatar.seed:"avatar-"+Math.random().toString(36).slice(2,10);
  youth = Object.assign({ mode:"teen", accent:"#6366f1", goalLabel:"Goals", reducedMotion:false, celebrations:true }, youth || {});
  const timeZones = [
    ["America/Los_Angeles", "Pacific Time"], ["America/Denver", "Mountain Time"],
    ["America/Phoenix", "Arizona Time"], ["America/Chicago", "Central Time"],
    ["America/New_York", "Eastern Time"], ["America/Anchorage", "Alaska Time"],
    ["Pacific/Honolulu", "Hawaii Time"], ["America/Puerto_Rico", "Atlantic Time"],
    ["UTC", "UTC"]
  ];
  const timeZoneOptions = timeZones.map(([value, label]) =>
    `<option value="${value}" ${value === timeZone ? "selected" : ""}>${label} — ${value}</option>`
  ).join("");
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-gear-fill"></i> Settings</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Manage your avatar, contact preferences, and communication settings.
      </p>
    </div>

    <div class="card youth-settings-card">
      <div class="youth-settings-heading"><div><h2><i class="bi bi-palette2"></i> My Experience</h2><p>Choose how the portal looks and talks to you. This never changes your care plan or scores.</p></div><span class="youth-safe-badge"><i class="bi bi-shield-check"></i> Just appearance</span></div>
      <div class="youth-mode-grid">
        ${[["explorer","bi-rocket-takeoff-fill","Explorer","Playful, larger, and guided"],["teen","bi-lightning-charge-fill","Teen","Clean, energetic, and independent"],["classic","bi-grid-fill","Classic","Simple and familiar"]].map(([value,icon,title,copy])=>`<label class="youth-mode-option"><input type="radio" name="st-youth-mode" value="${value}" ${youth.mode===value?"checked":""}><span><i class="bi ${icon}"></i><b>${title}</b><small>${copy}</small></span></label>`).join("")}
      </div>
      <div class="youth-pref-grid">
        <label>What should we call them?<select id="st-goal-label">${["Goals","Plans","Quests"].map(x=>`<option ${youth.goalLabel===x?"selected":""}>${x}</option>`).join("")}</select></label>
        <label>Accent color<div class="youth-color-row">${["#6366f1","#2563eb","#0891b2","#059669","#db2777","#7c3aed"].map(c=>`<button type="button" class="youth-color ${youth.accent===c?"selected":""}" style="--swatch:${c}" data-color="${c}" onclick="document.querySelectorAll('.youth-color').forEach(x=>x.classList.remove('selected'));this.classList.add('selected')" aria-label="Choose ${c}"></button>`).join("")}</div></label>
      </div>
      <div class="youth-toggle-row"><label><input id="st-celebrations" type="checkbox" ${youth.celebrations?"checked":""}> Show gentle celebrations</label><label><input id="st-reduced-motion" type="checkbox" ${youth.reducedMotion?"checked":""}> Reduce motion</label></div>
      <div class="youth-settings-actions"><button onclick="saveYouthExperienceSettings()"><i class="bi bi-check-circle-fill"></i> Save My Experience</button><div id="st-youth-status"></div></div>
    </div>

    <!-- Avatar -->
    <div class="card">
      <h2><i class="bi bi-person-bounding-box"></i> My Avatar</h2>
      <p style="color:var(--muted);font-size:14px;margin:0 0 16px;">
        Design your character — it appears next to your name in the portal.
      </p>
      <div class="avatar-style-picker">
        <button type="button" class="avatar-style-choice ${avatarStyle==="openPeeps"?"selected":""}" data-avatar-style="openPeeps" onclick="selectAvatarStyle('openPeeps')"><i class="bi bi-person-arms-up"></i><span><strong>Open Peeps</strong><small>Hand-drawn, playful character</small></span></button>
        <button type="button" class="avatar-style-choice ${avatarStyle==="micah"?"selected":""}" data-avatar-style="micah" onclick="selectAvatarStyle('micah')"><i class="bi bi-person-circle"></i><span><strong>Micah</strong><small>Clean, colorful portrait</small></span></button>
      </div>
      <div id="avatar-open-peeps-panel" style="display:${avatarStyle==="openPeeps"?"block":"none"}"><open-peeps-creator id="settings-avatar-creator" seed="${escapeHtml(getClientId() || 'peep')}"></open-peeps-creator></div>
      <div id="avatar-micah-panel" class="avatar-micah-panel" style="display:${avatarStyle==="micah"?"grid":"none"}">
        <div class="avatar-micah-preview"><img id="avatar-micah-image" alt="Micah avatar preview"></div>
        <div><h3>Micah portrait</h3><p>Generate a few variations until one feels like you. The avatar is rendered locally without sending your client ID.</p><label>Avatar seed<input id="avatar-micah-seed" value="${escapeAttr(micahSeed)}" oninput="updateMicahPreview()"></label><button type="button" class="secondary" onclick="randomizeMicahAvatar()"><i class="bi bi-shuffle"></i> Try another look</button><small style="display:block;margin-top:10px;color:var(--muted)">Micah avatar style by Micah Lanier, available through <a href="https://www.dicebear.com/styles/micah/" target="_blank" rel="noopener">DiceBear</a> under CC BY 4.0.</small></div>
      </div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <button onclick="saveAvatarSettings()"><i class="bi bi-check-circle-fill"></i> Save Avatar</button>
        <div id="st-avatar-status"></div>
      </div>
      <style>.avatar-style-picker{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.avatar-style-choice{display:flex;align-items:center;gap:11px;text-align:left;padding:13px;border:1.5px solid var(--border);border-radius:13px;background:var(--card,#fff);color:var(--text)}.avatar-style-choice>i{font-size:25px;color:var(--primary)}.avatar-style-choice strong,.avatar-style-choice small{display:block}.avatar-style-choice small{margin-top:2px;color:var(--muted);font-weight:400}.avatar-style-choice.selected{border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 12%,transparent);background:color-mix(in srgb,var(--primary) 5%,var(--card,#fff))}.avatar-micah-panel{grid-template-columns:220px 1fr;align-items:center;gap:24px;padding:20px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(135deg,#f8faff,#eff6ff)}.avatar-micah-preview{width:200px;height:200px;border-radius:28px;overflow:hidden;background:#dbeafe;box-shadow:0 16px 36px rgba(49,133,252,.15)}.avatar-micah-preview img{width:100%;height:100%;display:block}.avatar-micah-panel label{display:grid;gap:6px;font-size:12px;font-weight:700;margin:12px 0}.avatar-micah-panel input{width:100%}@media(max-width:640px){.avatar-style-picker,.avatar-micah-panel{grid-template-columns:1fr}.avatar-micah-preview{width:160px;height:160px;margin:auto}}</style>
    </div>

    <!-- Time Zone -->
    <div class="card">
      <h2><i class="bi bi-globe-americas"></i> Appointment Time Zone</h2>
      <p style="color:var(--muted);font-size:14px;margin:0 0 14px;">
        Appointment dates and times will be displayed in this time zone throughout your portal.
      </p>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:620px;">
        <select id="st-time-zone" style="flex:1;min-width:240px;">${timeZoneOptions}</select>
        <button onclick="saveSettingsTimeZone()"><i class="bi bi-floppy-fill"></i> Save Time Zone</button>
      </div>
      <div id="st-time-zone-status" style="margin-top:10px;"></div>
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

async function saveYouthExperienceSettings() {
  const payload={
    mode:document.querySelector('input[name="st-youth-mode"]:checked')?.value||"teen",
    accent:document.querySelector('.youth-color.selected')?.dataset.color||"#6366f1",
    goalLabel:document.getElementById('st-goal-label')?.value||"Goals",
    celebrations:!!document.getElementById('st-celebrations')?.checked,
    reducedMotion:!!document.getElementById('st-reduced-motion')?.checked
  };
  setStatus("st-youth-status","Saving…","loading");
  try{
    const result=await apiCall("saveYouthPreferences",payload);
    if(typeof applyYouthPreferences==="function")applyYouthPreferences(result.preferences||payload);
    setStatus("st-youth-status","Saved—your portal has been updated.","success");
    if(typeof showToast==="function")showToast("Your experience is ready.","success");
  }catch(e){setStatus("st-youth-status","Error: "+e.message,"error");}
}

async function saveSettingsTimeZone() {
  const timeZone = document.getElementById("st-time-zone")?.value;
  if (!timeZone) return;
  setStatus("st-time-zone-status", "Saving…", "loading");
  try {
    await apiCall("saveClientTimeZone", { timeZone });
    setStatus("st-time-zone-status", "Time zone saved. Appointment times will update automatically.", "success");
    if (typeof appointmentTimeZone !== "undefined") appointmentTimeZone = timeZone;
    if (typeof showToast === "function") showToast("Time zone saved.", "success");
  } catch (e) {
    setStatus("st-time-zone-status", "Error: " + e.message, "error");
  }
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

async function saveAvatarSettings() {
  const style=document.querySelector(".avatar-style-choice.selected")?.dataset.avatarStyle||"openPeeps";
  const creator = document.getElementById("settings-avatar-creator");
  let state;
  if(style==="micah") state={style:"micah",seed:(document.getElementById("avatar-micah-seed")?.value||("avatar-"+Math.random().toString(36).slice(2,10))).trim()};
  else {if (!creator) { setStatus("st-avatar-status", "Avatar creator not found.", "error"); return; }state=creator._state;if(state)state=Object.assign({},state,{style:"openPeeps"});}
  if (!state) { setStatus("st-avatar-status", "No avatar data yet — design your character first.", "error"); return; }
  setStatus("st-avatar-status", "Saving…", "loading");
  try {
    await apiCall("saveAvatar", { avatarJson: JSON.stringify(state) });
    setStatus("st-avatar-status", "Avatar saved!", "success");
    if (typeof showToast === "function") showToast("Avatar saved!", "success");
    loadHeaderAvatar();
  } catch (e) {
    setStatus("st-avatar-status", "Error: " + e.message, "error");
  }
}

// Restore saved avatar into the creator after it connects
function restoreAvatarCreator(savedJson) {
  if (!savedJson) return;
  let state;
  try { state = JSON.parse(savedJson); } catch (_) { return; }
  if(state.style==="micah"){selectAvatarStyle("micah");const seed=document.getElementById("avatar-micah-seed");if(seed)seed.value=state.seed||("avatar-"+Math.random().toString(36).slice(2,10));updateMicahPreview();return;}
  const tryRestore = (attempts = 0) => {
    const el = document.getElementById("settings-avatar-creator");
    if (el && el._state) {
      el.options = state;
    } else if (attempts < 20) {
      setTimeout(() => tryRestore(attempts + 1), 150);
    }
  };
  tryRestore();
}

function selectAvatarStyle(style){document.querySelectorAll(".avatar-style-choice").forEach(btn=>btn.classList.toggle("selected",btn.dataset.avatarStyle===style));const peeps=document.getElementById("avatar-open-peeps-panel"),micah=document.getElementById("avatar-micah-panel");if(peeps)peeps.style.display=style==="openPeeps"?"block":"none";if(micah)micah.style.display=style==="micah"?"grid":"none";if(style==="micah")updateMicahPreview();}
async function updateMicahPreview(){const img=document.getElementById("avatar-micah-image"),seed=document.getElementById("avatar-micah-seed")?.value.trim()||("avatar-"+Math.random().toString(36).slice(2,10));if(!img)return;try{const svg=await renderAvatarSvg({style:"micah",seed});if(svg)img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);}catch(_){}}
function randomizeMicahAvatar(){const input=document.getElementById("avatar-micah-seed");if(!input)return;input.value="avatar-"+Math.random().toString(36).slice(2,10);updateMicahPreview();}

// Load and display avatar in the portal header
async function loadHeaderAvatar() {
  try {
    const res = await apiCall("getAvatar", {});
    if (!res.avatarJson) return;
    let state;
    try { state = JSON.parse(res.avatarJson); } catch (_) { return; }
    const svg = await renderAvatarSvg(state); if(!svg)return;
    const whoami = document.getElementById("whoami");
    if (!whoami) return;
    let avatarEl = document.getElementById("header-avatar");
    if (!avatarEl) {
      avatarEl = document.createElement("div");
      avatarEl.id = "header-avatar";
      avatarEl.style.cssText = "width:36px;height:36px;flex-shrink:0;border-radius:50%;overflow:hidden;" +
        "background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.4);cursor:pointer;";
      avatarEl.title = "My Avatar — click Settings to change";
      avatarEl.onclick = () => showSection("settings");
      whoami.insertAdjacentElement("beforebegin", avatarEl);
    }
    avatarEl.innerHTML = svg;
    avatarEl.querySelector("svg").style.cssText = "width:100%;height:100%;display:block;";
  } catch (_) {}
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
