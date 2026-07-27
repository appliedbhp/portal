// Progress Report section — provider-only AI Insights.
// Checks if a 4-week progress summary is due and generates one on demand.

async function checkProgressReportDue() {
  try {
    const { due, lastReportDate, daysSince } = await apiCall("checkProgressReportDue", {});
    const btn = document.getElementById("progressReportNavBtn");
    if (!btn) return;
    if (due) {
      btn.classList.add("nav-due");
      const tip = lastReportDate
        ? "Progress report due — last one was " + daysSince + " days ago"
        : "Progress report due — none on file";
      btn.title = tip;
    } else {
      btn.classList.remove("nav-due");
    }
  } catch (_) {}
}

function initProgressReportSection(root) {
  root.innerHTML = `
    <style>
      @keyframes pr-pulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(49,133,252,.55); }
        50%      { box-shadow: 0 0 0 7px rgba(49,133,252,0); }
      }
      .pr-generate-btn { animation: pr-pulse 2s ease-in-out infinite; }

      @keyframes hg-flip2 {
        0%,35%  { transform: rotate(0deg); }
        50%,85% { transform: rotate(180deg); }
        100%    { transform: rotate(180deg); }
      }
      .pr-timer { display:inline-block; font-size:26px; animation: hg-flip2 2.4s ease-in-out infinite; }
    </style>
    <div class="card">
      <h1><i class="bi bi-graph-up-arrow"></i> AI Progress Insights</h1>
      <p style="color:var(--muted);font-size:14px;margin:0 0 20px;line-height:1.6;">
        Generates a <strong>4-week progress summary</strong> comparing recent goal data against the prior period,
        session completion rates, and parent/child program adherence. Saved as a Google Doc in the client's folder.
      </p>
      <button class="pr-generate-btn" onclick="doGenerateProgressReport()">
        <i class="bi bi-stars"></i> Generate Progress Report
      </button>
      <div id="pr-gen-status" style="margin-top:14px;"></div>
    </div>
    <div id="pr-history-area"></div>`;
  loadProgressReports();
}

let _prStepTimer = null;
const PR_STEPS = [
  "Pulling goal data…",
  "Comparing recent vs prior period…",
  "Reading session notes…",
  "Checking program completion…",
  "Generating AI insights…",
  "Creating Google Doc…"
];

function startPrAnimation() {
  let idx = 0;
  const el = document.getElementById("pr-gen-status");
  el.innerHTML = `
    <div class="alert" style="border-color:var(--primary);color:var(--primary);background:#ede9fe;display:flex;align-items:flex-start;gap:14px;">
      <span class="pr-timer">⌛</span>
      <div>
        <div style="font-weight:700;font-size:14px;margin-bottom:2px;">Generating progress report — 20–30 seconds…</div>
        <div id="pr-step-text" style="font-size:13px;color:var(--muted);margin-top:4px;">${PR_STEPS[0]}</div>
      </div>
    </div>`;
  _prStepTimer = setInterval(() => {
    idx = (idx + 1) % PR_STEPS.length;
    const t = document.getElementById("pr-step-text");
    if (t) t.textContent = PR_STEPS[idx];
  }, 3500);
}

function stopPrAnimation() {
  if (_prStepTimer) { clearInterval(_prStepTimer); _prStepTimer = null; }
}

async function doGenerateProgressReport() {
  startPrAnimation();
  try {
    const { docUrl, period } = await apiCall("generateProgressReport", {});
    stopPrAnimation();
    document.getElementById("pr-gen-status").innerHTML = `
      <div class="alert" style="border-color:#059669;color:#065f46;background:#d1fae5;">
        <i class="bi bi-check-circle-fill"></i>
        <span>Progress report generated for <strong>${escapeHtml(period || "recent period")}</strong>. &nbsp;
          <a href="${escapeHtml(docUrl)}" target="_blank"
             style="color:var(--primary);font-weight:700;text-decoration:none;">
            Open in Google Docs <i class="bi bi-box-arrow-up-right"></i>
          </a>
        </span>
      </div>`;
    // Remove the pulsing indicator now that report is done
    const btn = document.getElementById("progressReportNavBtn");
    if (btn) btn.classList.remove("nav-due");
    await loadProgressReports();
  } catch (e) {
    stopPrAnimation();
    setStatus("pr-gen-status", "Error: " + e.message, "error");
  }
}

async function loadProgressReports() {
  const el = document.getElementById("pr-history-area");
  if (!el) return;
  try {
    const { reports } = await apiCall("getProgressReports", {});
    renderProgressReports(reports || []);
  } catch (_) {
    el.innerHTML = `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load report history.</span></div>`;
  }
}

function renderProgressReports(reports) {
  const el = document.getElementById("pr-history-area");
  if (!el) return;
  if (!reports.length) {
    el.innerHTML = `
      <div class="card">
        <p style="color:var(--muted);font-size:14px;">
          No progress reports generated yet. Click <strong>Generate Progress Report</strong> above to create the first one.
        </p>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="card">
      <h2><i class="bi bi-clock-history"></i> Past Progress Reports</h2>
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
                  ${r.period ? `<span style="margin-left:8px;opacity:.7;">${escapeHtml(r.period)}</span>` : ""}
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
