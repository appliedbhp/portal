// Reports section — provider-only.
// Generates a comprehensive EF + FBA report as a Google Doc via the backend.

const REPORT_STEPS = [
  "Pulling assessment data…",
  "Analyzing behavioral functions…",
  "Integrating BRIEF-2 and WIN findings…",
  "Drafting clinical narrative…",
  "Building individualized session plan…",
  "Checking holiday schedule…",
  "Creating Google Doc…"
];

function initReportsSection(root) {
  root.innerHTML = `
    <style>
      @keyframes hg-flip {
        0%,35%  { transform: rotate(0deg); }
        50%,85% { transform: rotate(180deg); }
        100%    { transform: rotate(180deg); }
      }
      .report-timer { display:inline-block; font-size:28px; animation: hg-flip 2.4s ease-in-out infinite; }
      .report-step  { font-size:13px; color:var(--muted); margin-top:6px; min-height:20px; transition:opacity .3s; }
    </style>
    <div class="card">
      <h1><i class="bi bi-file-earmark-medical-fill"></i>Assessment Report</h1>
      <p style="color:var(--muted);font-size:14px;margin:0 0 20px;line-height:1.6;">
        Generates a comprehensive <strong>Executive Function and Functional Behavior Assessment</strong>
        report integrating all assessment data on file — BFA, WIN, Roadmap, BRIEF-2, and ESQ-R.
        The report is created as a formatted Google Doc saved to the client's folder in Drive.
      </p>
      <button onclick="doGenerateReport()">
        <i class="bi bi-file-earmark-plus-fill"></i> Generate Report
      </button>
      <div id="report-gen-status" style="margin-top:14px;"></div>
    </div>
    <div id="reports-history-area"></div>
  `;
  loadReports();
}

let _stepTimer = null;

function startReportAnimation() {
  let stepIdx = 0;
  const statusEl = document.getElementById("report-gen-status");
  statusEl.innerHTML = `
    <div class="alert" style="border-color:var(--primary);color:var(--primary);background:#ede9fe;display:flex;align-items:flex-start;gap:14px;">
      <span class="report-timer">⌛</span>
      <div>
        <div style="font-weight:700;font-size:14px;margin-bottom:2px;">Generating report — this takes 30–60 seconds</div>
        <div class="report-step" id="report-step-text">${REPORT_STEPS[0]}</div>
      </div>
    </div>`;
  _stepTimer = setInterval(() => {
    stepIdx = (stepIdx + 1) % REPORT_STEPS.length;
    const el = document.getElementById("report-step-text");
    if (el) el.textContent = REPORT_STEPS[stepIdx];
  }, 4000);
}

function stopReportAnimation() {
  if (_stepTimer) { clearInterval(_stepTimer); _stepTimer = null; }
}

async function doGenerateReport() {
  startReportAnimation();
  try {
    const { docUrl, sessionPlan } = await apiCall("generateReport", {});
    stopReportAnimation();
    const statusEl = document.getElementById("report-gen-status");
    statusEl.innerHTML = `
      <div class="alert" style="border-color:#059669;color:#065f46;background:#d1fae5;">
        <i class="bi bi-check-circle-fill"></i>
        <span>Report generated. &nbsp;
          <a href="${escapeHtml(docUrl)}" target="_blank"
             style="color:var(--primary);font-weight:700;text-decoration:none;">
            Open in Google Docs <i class="bi bi-box-arrow-up-right"></i>
          </a>
        </span>
      </div>
      ${sessionPlan ? `
      <div style="margin-top:10px;padding:14px 16px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:var(--primary);">
          <i class="bi bi-calendar2-check-fill"></i> Activate Client Program
        </div>
        <p style="font-size:13px;color:var(--muted);margin:0 0 10px;line-height:1.5;">
          The report includes an individualized <strong>${escapeHtml(sessionPlan.model || "8-week")}</strong> session plan.
          Activate it to track sessions and use note templates for each appointment.
        </p>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <label style="font-size:13px;font-weight:600;">Planned start date:</label>
          <input type="date" id="program-start-date" style="padding:5px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;">
          <button onclick="doActivateProgram()" style="padding:7px 16px;">
            <i class="bi bi-play-fill"></i> Activate Program
          </button>
        </div>
        <div id="activate-program-status" style="margin-top:8px;"></div>
      </div>` : ""}`;
    window._latestSessionPlan = sessionPlan || null;
    await loadReports();
  } catch (e) {
    stopReportAnimation();
    setStatus("report-gen-status", "Error: " + e.message, "error");
  }
}

async function doActivateProgram() {
  const startDate = document.getElementById("program-start-date")?.value || "";
  const sessionPlan = window._latestSessionPlan;
  if (!sessionPlan) return;
  setStatus("activate-program-status", "Activating…", "loading");
  try {
    await apiCall("activateClientProgram", { sessionPlan, startDate });
    setStatus("activate-program-status", "Program activated! Go to the Program tab to track sessions.", "success");
  } catch (e) {
    setStatus("activate-program-status", "Error: " + e.message, "error");
  }
}

async function loadReports() {
  const el = document.getElementById("reports-history-area");
  if (!el) return;
  try {
    const { reports } = await apiCall("getReports", {});
    renderReports(reports || []);
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load report history.</span></div>`;
  }
}

function renderReports(reports) {
  const el = document.getElementById("reports-history-area");
  if (!el) return;
  if (!reports.length) {
    el.innerHTML = `
      <div class="card">
        <p style="color:var(--muted);font-size:14px;">
          No reports generated yet. Click <strong>Generate Report</strong> above to create the first one.
        </p>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="card">
      <h2><i class="bi bi-clock-history"></i>Past Reports</h2>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${reports.map((r, i) => {
          const d = new Date(r.generatedAt);
          const dateStr = isNaN(d) ? r.generatedAt : d.toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:12px 14px;background:var(--surface);border-radius:8px;border:1px solid var(--border);">
              <div>
                <div style="font-weight:600;font-size:14px;">Report ${reports.length - i}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:2px;">
                  <i class="bi bi-calendar3"></i> ${escapeHtml(dateStr)}
                </div>
              </div>
              <a href="${escapeHtml(r.docUrl)}" target="_blank"
                 style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
                        border:1.5px solid var(--border);border-radius:6px;font-size:13px;
                        font-weight:600;color:var(--primary);text-decoration:none;background:#fff;">
                <i class="bi bi-box-arrow-up-right"></i> Open
              </a>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}
