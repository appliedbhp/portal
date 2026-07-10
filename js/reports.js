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

const REPORT_RESOURCES = [
  { id: "yearly-planner",      label: "Free printable yearly planning sheets",                        url: "https://www.getadhd.care/yearly-planner" },
  { id: "monthly-planner",     label: "Free printable monthly/weekly planning sheets",                url: "https://www.getadhd.care/monthly-weekly-planner" },
  { id: "habit-tracker",       label: "Free life balance assessment and habit tracker",               url: "https://www.getadhd.care/values-habit-tracker" },
  { id: "homework-planner",    label: "Free printable homework tracker",                              url: "https://www.getadhd.care/homework-planner" },
  { id: "note-paper",          label: "Free printable custom notebook and graph paper (dysgraphia)",  url: "https://www.getadhd.care/note-paper" },
  { id: "routine-creator",     label: "Free morning/evening routine creator",                         url: "https://www.getadhd.care/visual-supports-kids" },
  { id: "pomodoro",            label: "Free Pomodoro timer",                                          url: "https://www.getadhd.care/adhd-pomodoro-timer" },
  { id: "mindful-planning",    label: "Free mindful planning and practice",                           url: "https://www.getadhd.care/just-act-on-it" },
  { id: "values-assessment",   label: "Free values assessment",                                       url: "https://www.getadhd.care/know-your-values" },
  { id: "goblin-tools",        label: "Goblin Tools",                                                 url: "https://goblin.tools" },
  { id: "self-compassion",     label: "Self-compassion guided practices",                             url: "https://self-compassion.org/self-compassion-practices/#guided-practices" },
  { id: "understood-adhd",     label: "ADHD resources from Understood.org",                          url: "https://www.understood.org/en/topics/adhd#free_tools_from_understood" },
  { id: "understood-abcs",     label: "ABCs of behavior from Understood.org",                        url: "https://www.understood.org/en/lessons/abcs-of-behavior-tracking" },
  { id: "understood-valid",    label: "Validation strategies from Understood.org",                   url: "https://www.understood.org/en/lessons/validation-strategies" },
  { id: "understood-tracker",  label: "Free behavior tracker from Understood.org",                   url: "https://www.understood.org/en/app" },
  { id: "yt-andy-kahn",        label: "YouTube: Parenting Behavior with Dr. Andy Kahn",              url: "https://www.youtube.com/watch?v=i3-vmaPTJ2o&list=PL0Kjy0JtEbaRfyetTZccPjnup_fGmBiyC" },
  { id: "pod-andy-kahn",       label: "Podcast: Parenting Behavior with Dr. Andy Kahn",              url: "https://www.understood.org/en/podcasts/parenting-behavior" },
  { id: "through-my-eyes",     label: "Through My Eyes by Understood.org",                           url: "https://www.understood.org/en/through-my-eyes" },
  { id: "book-msc",            label: "Book: Mindful Self-Compassion Workbook",                      url: "https://www.amazon.com/gp/product/1462526780" },
  { id: "book-organized-child",label: "Book: The Organized Child (Gallagher, Spira, Rosenblatt)",    url: "https://www.guilford.com/books/The-Organized-Child/Gallagher-Spira-Rosenblatt/9781462525911" },
  { id: "book-adhd-guide",     label: "Book: Step-by-Step Help for Children with ADHD (2nd ed.)",   url: "https://www.amazon.com/dp/1805011073" },
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
      .res-item { display:flex; align-items:flex-start; gap:8px; padding:6px 0; border-bottom:1px solid var(--border); }
      .res-item:last-child { border-bottom:none; }
      .res-item input[type=checkbox] { margin-top:3px; flex-shrink:0; width:16px; height:16px; accent-color:var(--primary); cursor:pointer; }
      .res-item label { font-size:13px; line-height:1.4; cursor:pointer; color:var(--text); }
      .res-item label a { color:var(--primary); font-size:11px; margin-left:4px; }
    </style>
    <div class="card">
      <h1><i class="bi bi-file-earmark-medical-fill"></i>Assessment Report</h1>
      <p style="color:var(--muted);font-size:14px;margin:0 0 20px;line-height:1.6;">
        Generates a comprehensive <strong>Executive Function and Functional Behavior Assessment</strong>
        report integrating all assessment data on file — BFA, WIN, Roadmap, BRIEF-2, and ESQ-R.
        The report is created as a formatted Google Doc saved to the client's folder in Drive.
      </p>

      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div style="font-weight:600;font-size:14px;"><i class="bi bi-link-45deg"></i> Family Resources to Include in Report</div>
          <div style="display:flex;gap:6px;">
            <button class="secondary" style="font-size:11px;padding:3px 8px;" onclick="reportSelectAllResources(true)">Select All</button>
            <button class="secondary" style="font-size:11px;padding:3px 8px;" onclick="reportSelectAllResources(false)">Clear All</button>
          </div>
        </div>
        <div style="background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:8px 14px;max-height:320px;overflow-y:auto;">
          ${REPORT_RESOURCES.map(r => `
            <div class="res-item">
              <input type="checkbox" id="res-${r.id}" value="${r.id}">
              <label for="res-${r.id}">${escapeHtml(r.label)}
                <a href="${r.url}" target="_blank" rel="noopener" title="${r.url}"><i class="bi bi-box-arrow-up-right"></i></a>
              </label>
            </div>`).join("")}
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;">Checked resources will appear in Appendix C of the generated report.</div>
      </div>

      <button onclick="doGenerateReport()">
        <i class="bi bi-file-earmark-plus-fill"></i> Generate Report
      </button>
      <div id="report-gen-status" style="margin-top:14px;"></div>
    </div>
    <div id="reports-history-area"></div>
  `;
  loadReports();
}

function reportSelectAllResources(checked) {
  REPORT_RESOURCES.forEach(r => {
    const cb = document.getElementById("res-" + r.id);
    if (cb) cb.checked = checked;
  });
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
  const selectedResources = REPORT_RESOURCES
    .filter(r => { const cb = document.getElementById("res-" + r.id); return cb && cb.checked; })
    .map(r => ({ label: r.label, url: r.url }));
  startReportAnimation();
  try {
    const { docUrl } = await apiCall("generateReport", { selectedResources });
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
      <div style="margin-top:10px;">
        <button onclick="showSection('recommendation')" style="font-size:13px;">
          <i class="bi bi-calendar2-check-fill"></i> Build Client Program
        </button>
        <span style="font-size:12px;color:var(--muted);margin-left:10px;">
          Go to Package Rec to select a package, choose goals, and generate the session plan.
        </span>
      </div>`;

    await loadReports();
  } catch (e) {
    stopReportAnimation();
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
