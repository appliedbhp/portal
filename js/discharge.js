// #8 Discharge Summary — provider-only section for generating and viewing
// formal case closure / discharge summary Google Docs.

const DISCHARGE_OUTCOMES = {
  completed:      { label: "Treatment Completed — Goals Met",       color: "#059669", bg: "#d1fae5" },
  partial:        { label: "Partial — Goals Partially Met",         color: "#92400e", bg: "#fef3c7" },
  transferred:    { label: "Transferred to Another Provider",       color: "#1d4ed8", bg: "#dbeafe" },
  client_request: { label: "Client / Family Request",               color: "#7c3aed", bg: "#ede9fe" },
  administrative: { label: "Administrative Discharge",              color: "#6b7280", bg: "#f3f4f6" }
};

async function initDischargeSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading discharge records…</p></div>`;
  try {
    const res = await apiCall("getDischargeHistory", {});
    renderDischargeSection(root, res.discharges || []);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load discharge history: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderDischargeSection(root, discharges) {
  const today     = new Date().toISOString().slice(0, 10);
  const fmtD = d => {
    const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[2]}/${m[3]}/${m[1]}` : (d || "—");
  };

  const outcomeOptions = Object.entries(DISCHARGE_OUTCOMES)
    .map(([v, s]) => `<option value="${v}">${escapeHtml(s.label)}</option>`).join("");

  const historyHtml = discharges.length
    ? `<div style="overflow-x:auto;"><table class="summary-table">
        <thead><tr>
          <th>Generated</th><th>Discharge Date</th><th>Outcome</th><th></th>
        </tr></thead>
        <tbody>
          ${discharges.map(d => {
            const s = DISCHARGE_OUTCOMES[d.outcome] || DISCHARGE_OUTCOMES.administrative;
            return `<tr>
              <td style="font-size:12px;">${escapeHtml(fmtD(d.generatedAt))}</td>
              <td style="font-size:12px;">${escapeHtml(fmtD(d.dischargeDate))}</td>
              <td>
                <span style="font-size:11px;font-weight:700;background:${s.bg};color:${s.color};
                             padding:2px 8px;border-radius:8px;">${escapeHtml(s.label)}</span>
              </td>
              <td>
                <a href="${escapeHtml(d.docUrl)}" target="_blank" rel="noopener"
                   style="font-size:12px;font-weight:600;color:var(--primary);text-decoration:none;">
                  <i class="bi bi-box-arrow-up-right"></i> Open
                </a>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>`
    : `<p style="color:var(--muted);font-size:13px;margin:0;">No discharge summaries generated yet.</p>`;

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-clipboard2-x-fill"></i> Discharge Summary</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Generate a formal discharge summary Google Doc for case closure. The document will be
        saved to the client's folder in Google Drive.
      </p>
    </div>

    <!-- Generate form -->
    <div class="card">
      <h2><i class="bi bi-file-earmark-plus-fill"></i> Generate Discharge Summary</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;" class="ds-grid">
        <div class="row">
          <label>Discharge Date</label>
          <input id="ds-dischargeDate" type="date" value="${today}">
        </div>
        <div class="row">
          <label>Treatment Start Date <span style="color:var(--muted);font-weight:400;">(optional)</span></label>
          <input id="ds-treatmentStart" type="date">
        </div>
        <div class="row">
          <label>Discharge Outcome</label>
          <select id="ds-outcome">${outcomeOptions}</select>
        </div>
        <div class="row"><!-- spacer --></div>
        <div class="row" style="grid-column:1/-1;">
          <label>Presenting Problems / Reason for Referral</label>
          <textarea id="ds-presentingProbs" rows="3"
            placeholder="Describe the client's presenting concerns and reason for referral…"
            style="max-width:100%;resize:vertical;"></textarea>
        </div>
        <div class="row" style="grid-column:1/-1;">
          <label>Goal Outcome Notes <span style="color:var(--muted);font-weight:400;">(optional)</span></label>
          <textarea id="ds-goalsOutcome" rows="3"
            placeholder="Summarize progress toward treatment goals…"
            style="max-width:100%;resize:vertical;"></textarea>
        </div>
        <div class="row" style="grid-column:1/-1;">
          <label>Services Provided <span style="color:var(--muted);font-weight:400;">(optional)</span></label>
          <textarea id="ds-servicesProvided" rows="2"
            placeholder="e.g. Weekly individual therapy sessions, parent coaching, behavioral assessment…"
            style="max-width:100%;resize:vertical;"></textarea>
        </div>
        <div class="row" style="grid-column:1/-1;">
          <label>Recommendations &amp; Aftercare Plan</label>
          <textarea id="ds-recommendations" rows="3"
            placeholder="e.g. Continue with school supports, follow up with pediatrician, reassess in 6 months…"
            style="max-width:100%;resize:vertical;"></textarea>
        </div>
        <div class="row" style="grid-column:1/-1;">
          <label>Additional Notes <span style="color:var(--muted);font-weight:400;">(optional)</span></label>
          <textarea id="ds-additionalNotes" rows="2"
            style="max-width:100%;resize:vertical;"></textarea>
        </div>
      </div>
      <div id="ds-status" style="margin:10px 0;"></div>
      <button onclick="generateDischargeSummary()">
        <i class="bi bi-file-earmark-text-fill"></i> Generate Discharge Summary (Google Doc)
      </button>
      <p style="font-size:12px;color:var(--muted);margin:10px 0 0;">
        Goals on file for this client are automatically included. The document will open in a new tab
        and is saved to <strong>Clients/${getClientId()}/Discharge Summaries/</strong> in Google Drive.
      </p>
    </div>

    <!-- History -->
    <div class="card">
      <h2><i class="bi bi-clock-history"></i> Discharge History</h2>
      <div id="ds-history">${historyHtml}</div>
    </div>

    <style>
      @media (max-width: 700px) { .ds-grid { grid-template-columns: 1fr !important; } }
    </style>`;
}

async function generateDischargeSummary() {
  const get = id => (document.getElementById(id) || {}).value || "";
  const presentingProbs = get("ds-presentingProbs").trim();
  if (!presentingProbs) {
    setStatus("ds-status", "Presenting Problems are required.", "error");
    return;
  }
  setStatus("ds-status", "Generating discharge summary — this may take 10–20 seconds…", "loading");
  try {
    const result = await apiCall("generateDischargeSummary", {
      dischargeDate:    get("ds-dischargeDate"),
      treatmentStart:   get("ds-treatmentStart"),
      outcome:          get("ds-outcome"),
      presentingProbs,
      goalsOutcome:     get("ds-goalsOutcome"),
      servicesProvided: get("ds-servicesProvided"),
      recommendations:  get("ds-recommendations"),
      additionalNotes:  get("ds-additionalNotes")
    });
    document.getElementById("ds-status").innerHTML = `
      <div class="alert" style="border-color:#059669;color:#065f46;background:#d1fae5;">
        <i class="bi bi-check-circle-fill"></i>
        <span>
          Discharge summary generated. &nbsp;
          <a href="${escapeHtml(result.docUrl)}" target="_blank"
             style="color:var(--primary);font-weight:700;text-decoration:none;">
            Open in Google Docs <i class="bi bi-box-arrow-up-right"></i>
          </a>
        </span>
      </div>`;
    // Refresh history
    try {
      const res = await apiCall("getDischargeHistory", {});
      const root = document.getElementById("section-discharge");
      if (root) renderDischargeSection(root, res.discharges || []);
    } catch (_) {}
  } catch (e) {
    setStatus("ds-status", "Error: " + e.message, "error");
  }
}
