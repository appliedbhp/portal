// Superbill generation — provider-only.
// Lets providers configure billing settings, maintain a per-client billing
// profile, and generate a formatted Google Doc superbill for any date range.

const CPT_DEFAULTS = [
  { code: "97153", label: "97153 – ABA treatment by protocol (per 15 min)" },
  { code: "97155", label: "97155 – ABA with protocol modification" },
  { code: "97156", label: "97156 – Family adaptive behavior guidance" },
  { code: "97158", label: "97158 – Group adaptive behavior treatment" },
  { code: "90837", label: "90837 – Individual psychotherapy, 60 min" },
  { code: "90834", label: "90834 – Individual psychotherapy, 45 min" },
  { code: "90847", label: "90847 – Family psychotherapy (patient present)" },
  { code: "90846", label: "90846 – Family psychotherapy (no patient)" },
  { code: "96136", label: "96136 – Psychological/neuropsychological test admin" },
  { code: "H0031", label: "H0031 – Mental health assessment" },
];

async function initSuperbillSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading billing…</p></div>`;
  try {
    const [settingsRes, profileRes] = await Promise.all([
      apiCall("getBillingSettings", {}),
      apiCall("getClientBillingProfile", {})
    ]);
    renderSuperbill(root, settingsRes.settings || {}, profileRes.profile || {});
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load billing: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderSuperbill(root, settings, profile) {
  const today    = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const cptOptions = CPT_DEFAULTS.map(c =>
    `<option value="${c.code}">${escapeHtml(c.label)}</option>`).join("");

  const settingField = (key, label, placeholder) => `
    <div class="row">
      <label>${escapeHtml(label)}</label>
      <input id="bs-${key}" value="${escapeHtml(settings[key] || "")}" placeholder="${escapeHtml(placeholder)}">
    </div>`;

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-receipt-cutoff"></i> Superbill &amp; Billing</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Generate a printable superbill clients can submit to their insurance for reimbursement.
      </p>
    </div>

    <!-- Provider Billing Settings -->
    <div class="card">
      <h2><i class="bi bi-building-fill"></i> Practice &amp; Provider Settings</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 16px;">These appear on every superbill. Set once; update any time.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;" class="billing-settings-grid">
        ${settingField("PRACTICE_NAME",       "Practice Name",         "Applied Behavioral Health Practice")}
        ${settingField("PROVIDER_NAME",        "Provider Name",         "Your full name")}
        ${settingField("PROVIDER_CREDENTIALS", "Credentials",           "BCBA, LPC, etc.")}
        ${settingField("PROVIDER_NPI",         "NPI Number",            "10-digit NPI")}
        ${settingField("PROVIDER_TAX_ID",      "Tax ID / EIN",          "XX-XXXXXXX")}
        ${settingField("PROVIDER_PHONE",       "Phone",                 "(555) 555-5555")}
        ${settingField("PROVIDER_EMAIL",       "Email",                 "provider@practice.com")}
        ${settingField("PROVIDER_ADDRESS",     "Full Address",          "123 Main St, City, ST 12345")}
      </div>
      <div id="bs-status" style="margin:10px 0;"></div>
      <button onclick="saveBillingSettings()"><i class="bi bi-floppy-fill"></i> Save Practice Settings</button>
    </div>

    <!-- Client Billing Profile -->
    <div class="card">
      <h2><i class="bi bi-person-vcard-fill"></i> Client Billing Profile</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 16px;">Legal name and DOB are required for superbills. Insurance info is optional.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;" class="billing-settings-grid">
        <div class="row">
          <label>Legal Name</label>
          <input id="bp-LEGAL_NAME" value="${escapeHtml(profile.LEGAL_NAME || "")}" placeholder="Full legal name">
        </div>
        <div class="row">
          <label>Date of Birth</label>
          <input id="bp-DATE_OF_BIRTH" type="date" value="${escapeHtml(profile.DATE_OF_BIRTH || "")}">
        </div>
        <div class="row">
          <label>Street Address</label>
          <input id="bp-ADDRESS" value="${escapeHtml(profile.ADDRESS || "")}" placeholder="123 Main St">
        </div>
        <div class="row">
          <label>City, State, ZIP</label>
          <input id="bp-CITY_STATE_ZIP" value="${escapeHtml(profile.CITY_STATE_ZIP || "")}" placeholder="City, ST 12345">
        </div>
        <div class="row">
          <label>Insurance Member ID</label>
          <input id="bp-INSURANCE_ID" value="${escapeHtml(profile.INSURANCE_ID || "")}" placeholder="Optional">
        </div>
        <div class="row">
          <label>Subscriber Name</label>
          <input id="bp-SUBSCRIBER_NAME" value="${escapeHtml(profile.SUBSCRIBER_NAME || "")}" placeholder="If different from patient">
        </div>
      </div>
      <div id="bp-status" style="margin:10px 0;"></div>
      <button onclick="saveClientBillingProfile()"><i class="bi bi-floppy-fill"></i> Save Client Profile</button>
    </div>

    <!-- Generate Superbill -->
    <div class="card">
      <h2><i class="bi bi-file-earmark-text-fill"></i> Generate Superbill</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;" class="billing-settings-grid">
        <div class="row">
          <label>Date From</label>
          <input id="sb-dateFrom" type="date" value="${monthAgo}">
        </div>
        <div class="row">
          <label>Date To</label>
          <input id="sb-dateTo" type="date" value="${today}">
        </div>
        <div class="row">
          <label>CPT Procedure Code</label>
          <select id="sb-cptCode">${cptOptions}</select>
        </div>
        <div class="row">
          <label>Place of Service</label>
          <select id="sb-pos">
            <option value="11">11 – Office</option>
            <option value="02">02 – Telehealth</option>
            <option value="12">12 – Home</option>
          </select>
        </div>
        <div class="row">
          <label>ICD-10 Diagnosis Code(s)</label>
          <input id="sb-icd10" placeholder="e.g. F90.0, F84.0" value="">
        </div>
        <div class="row">
          <label>Fee Per Session ($)</label>
          <input id="sb-feeEach" type="number" min="0" step="0.01" placeholder="0.00">
        </div>
        <div class="row">
          <label>Total Amount Paid by Client ($)</label>
          <input id="sb-amtPaid" type="number" min="0" step="0.01" value="0.00">
        </div>
      </div>
      <div id="sb-status" style="margin:10px 0;"></div>
      <button onclick="generateSuperbill()">
        <i class="bi bi-file-earmark-plus-fill"></i> Generate Superbill (Google Doc)
      </button>
      <p style="font-size:12px;color:var(--muted);margin:10px 0 0;">
        Includes all quick session notes AND program session notes in the selected date range.
        The generated Doc will open in a new tab — share the link with the client or download as PDF.
      </p>
    </div>

    <style>
      @media (max-width: 700px) { .billing-settings-grid { grid-template-columns: 1fr !important; } }
    </style>`;
}

async function saveBillingSettings() {
  const fields = {};
  ["PRACTICE_NAME","PROVIDER_NAME","PROVIDER_CREDENTIALS","PROVIDER_NPI",
   "PROVIDER_TAX_ID","PROVIDER_PHONE","PROVIDER_EMAIL","PROVIDER_ADDRESS"].forEach(k => {
    const el = document.getElementById("bs-" + k);
    if (el) fields[k] = el.value.trim();
  });
  setStatus("bs-status", "Saving…", "loading");
  try {
    await apiCall("saveBillingSettings", fields);
    setStatus("bs-status", "Practice settings saved.", "success");
  } catch (e) {
    setStatus("bs-status", "Error: " + e.message, "error");
  }
}

async function saveClientBillingProfile() {
  const fields = {};
  ["LEGAL_NAME","DATE_OF_BIRTH","ADDRESS","CITY_STATE_ZIP","INSURANCE_ID","SUBSCRIBER_NAME"].forEach(k => {
    const el = document.getElementById("bp-" + k);
    if (el) fields[k] = el.value.trim();
  });
  if (!fields.LEGAL_NAME) {
    setStatus("bp-status", "Legal name is required.", "error");
    return;
  }
  setStatus("bp-status", "Saving…", "loading");
  try {
    await apiCall("saveClientBillingProfile", fields);
    setStatus("bp-status", "Client profile saved.", "success");
  } catch (e) {
    setStatus("bp-status", "Error: " + e.message, "error");
  }
}

async function generateSuperbill() {
  const get = id => (document.getElementById(id) || {}).value || "";
  const dateFrom = get("sb-dateFrom");
  const dateTo   = get("sb-dateTo");
  const feeEach  = parseFloat(get("sb-feeEach") || 0);

  if (!dateFrom || !dateTo) { setStatus("sb-status", "Please set a date range.", "error"); return; }
  if (dateTo < dateFrom)    { setStatus("sb-status", "Date To must be after Date From.", "error"); return; }
  if (!feeEach)             { setStatus("sb-status", "Please enter a fee per session.", "error"); return; }

  setStatus("sb-status", "Generating superbill — this may take 10–20 seconds…", "loading");
  try {
    const result = await apiCall("generateSuperbill", {
      dateFrom,
      dateTo,
      cptCode:        get("sb-cptCode"),
      placeOfService: get("sb-pos"),
      icd10:          get("sb-icd10"),
      feeEach,
      amtPaid:        parseFloat(get("sb-amtPaid") || 0)
    });
    const { docUrl, sessionCount, totalFee, balanceDue } = result;
    document.getElementById("sb-status").innerHTML = `
      <div class="alert" style="border-color:#059669;color:#065f46;background:#d1fae5;">
        <i class="bi bi-check-circle-fill"></i>
        <span>
          Superbill generated — ${sessionCount} session${sessionCount !== 1 ? "s" : ""},
          $${totalFee.toFixed(2)} total, $${balanceDue.toFixed(2)} balance due. &nbsp;
          <a href="${escapeHtml(docUrl)}" target="_blank" style="color:var(--primary);font-weight:700;text-decoration:none;">
            Open in Google Docs <i class="bi bi-box-arrow-up-right"></i>
          </a>
        </span>
      </div>`;
  } catch (e) {
    setStatus("sb-status", "Error: " + e.message, "error");
  }
}
