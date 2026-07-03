// Reports section — provider-only.
// Generates a comprehensive EF + FBA report as a Google Doc via the backend.

function initReportsSection(root) {
  root.innerHTML = `
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

async function doGenerateReport() {
  const statusEl = document.getElementById("report-gen-status");
  statusEl.innerHTML = `
    <div class="alert" style="border-color:var(--primary);color:var(--primary);background:#ede9fe;">
      <i class="bi bi-hourglass-split"></i>
      <span>Generating report — pulling all assessment data and drafting with AI. This takes 20–40 seconds…</span>
    </div>`;
  try {
    const { docUrl } = await apiCall("generateReport", {});
    statusEl.innerHTML = `
      <div class="alert" style="border-color:#059669;color:#065f46;background:#d1fae5;">
        <i class="bi bi-check-circle-fill"></i>
        <span>Report generated. &nbsp;
          <a href="${escapeHtml(docUrl)}" target="_blank"
             style="color:var(--primary);font-weight:700;text-decoration:none;">
            Open in Google Docs <i class="bi bi-box-arrow-up-right"></i>
          </a>
        </span>
      </div>`;
    await loadReports();
  } catch (e) {
    setStatus("report-gen-status", "Error: " + e.message, "error");
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
