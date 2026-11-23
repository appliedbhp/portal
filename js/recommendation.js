// Package Recommendation + Client Program Builder
// Flow: Generate Rec → select package (override allowed) → pick goals →
//       Generate Draft Plan → edit sessions inline → Activate

let recResult      = null;
let recDraftPlan   = null;   // generated but not yet saved
let recGoals       = [];     // merged report + plan goals
let recSelGoals    = [];     // provider-checked goal objectives

const REC_PACKAGES = [
  { key: "sprint",  label: "Sprint",  detail: "8 wks · ~14 sessions · $2,050 · $150/session" },
  { key: "journey", label: "Journey", detail: "16 wks · ~28 sessions · $3,850 · $140/session" },
  { key: "odyssey", label: "Odyssey", detail: "32 wks · ~57 sessions · $7,450 · $130/session" }
];

function initRecommendationSection(root) {
  root.innerHTML = `
    <div class="card no-print">
      <h1><i class="bi bi-stars"></i>Package Recommendation</h1>
      <p style="color:var(--muted);font-size:14px;margin:0 0 20px;">
        Analyzes all available assessment data and generates a clinical narrative to support
        package conversations with families. After reviewing, build and activate a client program below.
      </p>
      <button onclick="generateRecommendation()"><i class="bi bi-magic"></i> Generate Recommendation</button>
      <div id="rec-status" style="margin-top:12px;"></div>
    </div>
    <div id="rec-result"></div>
    <div id="rec-program-builder" style="display:none;"></div>
  `;
}

// ── Step 1: Generate recommendation ──────────────────────────────────────────

async function generateRecommendation() {
  const btn = document.querySelector("#section-recommendation .card button");
  if (btn) btn.disabled = true;
  setStatus("rec-status", "Analyzing assessment data…", "loading");
  try {
    const [recData, goalsData] = await Promise.all([
      apiCall("getPackageRecommendation", {}),
      apiCall("getLatestReportGoals",     {}).catch(() => ({ reportGoals: [], planGoals: [] }))
    ]);
    recResult = recData;
    recGoals  = mergeGoals_(goalsData.reportGoals || [], goalsData.planGoals || []);
    renderRecommendation(recData);
    renderProgramBuilder(recData.tier);
    setStatus("rec-status", "", "");
  } catch (e) {
    setStatus("rec-status", "Error: " + e.message, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function mergeGoals_(reportGoals, planGoals) {
  // Report goals first (richer metadata), then plan goals not already covered
  const seen = new Set(reportGoals.map(g => g.objective.slice(0, 60).toLowerCase()));
  const extras = planGoals.filter(g => !seen.has(g.objective.slice(0, 60).toLowerCase()));
  return [...reportGoals, ...extras];
}

// ── Step 2: Render recommendation card ───────────────────────────────────────

function renderRecommendation(data) {
  const el = document.getElementById("rec-result");

  const palette = {
    Sprint:  { bg: "#ecfdf5", border: "#10b981", labelColor: "#065f46", accent: "#10b981" },
    Journey: { bg: "#fffbeb", border: "#f59e0b", labelColor: "#92400e", accent: "#d97706" },
    Odyssey: { bg: "#eff6ff", border: "#3185fc", labelColor: "#1e3a8a", accent: "#3185fc" }
  };
  const colors = palette[data.tier] || palette.Journey;
  const pkg = data.packageInfo || {};
  const tierSubtitle = [pkg.duration, pkg.price].filter(Boolean).join(" · ");
  const confMap = {
    "high":          { cls: "conf-high",     label: "High confidence" },
    "moderate-high": { cls: "conf-mod-high", label: "Moderate–high" },
    "moderate":      { cls: "conf-mod",      label: "Moderate confidence" },
    "low":           { cls: "conf-low",      label: "Insufficient data" }
  };
  const conf = confMap[data.confidence] || { cls: "conf-mod", label: data.confidence };
  const dataLabels = { roadmap: "EF Roadmap", win: "WIN Assessment", brief: "BRIEF-2", esqr: "ESQ-R" };
  const dataUsedHtml = Object.entries(data.dataUsed || {}).map(([k, used]) => `
    <span class="rec-data-chip ${used ? "used" : "missing"}">
      <i class="bi bi-${used ? "check-circle-fill" : "dash-circle"}"></i>${dataLabels[k] || k}
    </span>`).join("");
  const triggersHtml = (data.triggers || []).length
    ? data.triggers.map(t => `<li>${escapeHtml(t)}</li>`).join("")
    : `<li style="color:var(--muted);">No specific triggers — based on aggregate profile.</li>`;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  el.innerHTML = `
    <div class="rec-print-header print-only">
      <img src="https://d1yei2z3i6k35z.cloudfront.net/15694166/695009dabcbb1_LogoWhite.png" alt="" style="height:40px;filter:invert(1) brightness(0);">
      <div>
        <div style="font-family:'Lora',Georgia,serif;font-weight:700;font-size:16px;">Applied Behavioral Health Practice</div>
        <div style="font-size:12px;color:#555;">Package Recommendation · ${escapeHtml(today)} · Client: ${escapeHtml(getClientId())}</div>
      </div>
    </div>
    <div class="card rec-tier-card" style="border-color:${colors.border};background:${colors.bg};">
      <div class="rec-tier-header">
        <div>
          <div class="rec-tier-eyebrow" style="color:${colors.accent};">Recommended Package</div>
          <div class="rec-tier-name" style="color:${colors.labelColor};">${escapeHtml(data.tier)}</div>
          ${tierSubtitle ? `<div class="rec-tier-desc" style="color:${colors.labelColor};">${escapeHtml(tierSubtitle)}</div>` : ""}
          ${pkg.description ? `<div class="rec-tier-tagline" style="color:${colors.labelColor};">${escapeHtml(pkg.description)}</div>` : ""}
        </div>
        <div class="rec-tier-meta">
          <span class="conf-badge ${conf.cls}">${conf.label}</span>
          <div class="rec-data-chips no-print">${dataUsedHtml}</div>
        </div>
      </div>
    </div>
    <div class="card">
      <h2><i class="bi bi-list-check"></i>Scoring Triggers</h2>
      <ul class="rec-triggers">${triggersHtml}</ul>
    </div>
    ${data.narrative ? `
    <div class="card">
      <h2><i class="bi bi-chat-quote-fill"></i>Clinical Summary</h2>
      <p class="rec-narrative">${escapeHtml(data.narrative)}</p>
      <div class="field-hint no-print" style="margin-top:10px;">
        <i class="bi bi-robot" style="color:var(--muted);"></i> AI-generated — review before sharing with families.
      </div>
    </div>` : ""}
    <div class="btn-row no-print" style="justify-content:flex-end;margin-top:-8px;">
      <button class="secondary" onclick="recCopyNarrative()" style="font-size:12px;padding:6px 14px;">
        <i class="bi bi-clipboard"></i> Copy Narrative
      </button>
      <button class="secondary" onclick="recPrint()" style="font-size:12px;padding:6px 14px;">
        <i class="bi bi-printer-fill"></i> Save as PDF
      </button>
      <button class="secondary" onclick="generateRecommendation()" style="font-size:12px;padding:6px 14px;">
        <i class="bi bi-arrow-clockwise"></i> Regenerate
      </button>
    </div>
  `;
}

// ── Step 3: Program builder panel ─────────────────────────────────────────────

function renderProgramBuilder(recommendedTier) {
  const el = document.getElementById("rec-program-builder");
  el.style.display = "";

  const selectedPkg = (recommendedTier || "sprint").toLowerCase();

  const goalsHtml = recGoals.length ? recGoals.map((g, i) => `
    <div class="checkbox-row" style="margin-bottom:10px;align-items:flex-start;">
      <input type="checkbox" id="rec-goal-${i}" class="rec-goal-check" data-idx="${i}"
             data-objective="${escapeAttr(g.objective)}">
      <label for="rec-goal-${i}" style="line-height:1.4;">
        ${g.domain ? `<span style="font-size:10px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.04em;margin-right:4px;">${escapeHtml(g.domain)}</span>` : ""}
        ${escapeHtml(g.objective)}
        ${g.source === "report" && g.rationale ? `<br><span style="font-size:11px;color:var(--muted);font-weight:400;">${escapeHtml(g.rationale)}</span>` : ""}
      </label>
    </div>`).join("")
    : `<p style="color:var(--muted);font-size:13px;">No goals found. Generate an assessment report first, or add goals in Goals &amp; Plan.</p>`;

  el.innerHTML = `
    <div class="card no-print">
      <h2><i class="bi bi-calendar2-check-fill"></i>Build Client Program</h2>

      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">
          Package <span style="font-weight:400;font-size:11px;">(algorithm recommended: <strong>${escapeHtml(recommendedTier || "—")}</strong> — override below if needed)</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;" id="rec-pkg-row">
          ${REC_PACKAGES.map(p => `
            <div class="rec-pkg-card ${p.key === selectedPkg ? "active" : ""}" data-pkg="${p.key}"
                 onclick="recPickPkg('${p.key}')"
                 style="flex:1;min-width:130px;border:2px solid ${p.key === selectedPkg ? "var(--primary)" : "var(--border)"};
                        background:${p.key === selectedPkg ? "#ede9fe" : "var(--surface)"};
                        border-radius:10px;padding:10px 12px;text-align:center;cursor:pointer;transition:.15s;">
              <div style="font-weight:700;font-size:13px;">${p.label}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.4;">${p.detail}</div>
            </div>`).join("")}
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">
          Goals &amp; Objectives to Address
        </div>
        <div id="rec-goals-list">${goalsHtml}</div>
      </div>

      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <label style="font-size:13px;font-weight:600;">Program start date:</label>
        <input type="date" id="rec-start-date"
               style="padding:5px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;">
      </div>

      <button onclick="recGenerateDraft()" id="rec-draft-btn">
        <i class="bi bi-stars"></i> Generate Draft Plan
      </button>
      <div id="rec-draft-status" style="margin-top:10px;"></div>
    </div>

    <div id="rec-draft-editor" style="display:none;"></div>
  `;
}

function recPickPkg(key) {
  document.querySelectorAll(".rec-pkg-card").forEach(el => {
    const active = el.dataset.pkg === key;
    el.style.borderColor = active ? "var(--primary)" : "var(--border)";
    el.style.background  = active ? "#ede9fe" : "var(--surface)";
  });
}

function recGetSelectedPkg() {
  const active = document.querySelector(".rec-pkg-card[style*='#ede9fe']");
  return active ? active.dataset.pkg : "sprint";
}

function recGetSelectedGoals() {
  return Array.from(document.querySelectorAll(".rec-goal-check:checked"))
              .map(cb => cb.dataset.objective);
}

// ── Step 4: Generate draft ────────────────────────────────────────────────────

async function recGenerateDraft() {
  const packageKey    = recGetSelectedPkg();
  const selectedGoals = recGetSelectedGoals();
  const startDate     = document.getElementById("rec-start-date")?.value || "";

  const btn = document.getElementById("rec-draft-btn");
  if (btn) btn.disabled = true;
  setStatus("rec-draft-status", "Generating session plan — this takes 30–60 seconds…", "loading");

  try {
    const { sessionPlan } = await apiCall("generateSessionPlan", { packageKey, selectedGoals, startDate });
    recDraftPlan   = sessionPlan;
    recSelGoals    = selectedGoals;
    setStatus("rec-draft-status", "", "");
    renderDraftEditor(sessionPlan, selectedGoals);
  } catch (e) {
    setStatus("rec-draft-status", "Error: " + e.message, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Step 5: Draft editor ──────────────────────────────────────────────────────

function renderDraftEditor(plan, goals) {
  const el = document.getElementById("rec-draft-editor");
  el.style.display = "";

  const totalSessions = (plan.weeks || []).reduce((s, w) => s + (w.sessions || []).length, 0);

  el.innerHTML = `
    <div class="card no-print">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
        <h2 style="margin:0;"><i class="bi bi-pencil-square"></i>Draft Plan — ${escapeHtml(plan.model || "")} · ${(plan.weeks||[]).length} weeks · ${totalSessions} sessions</h2>
        <div style="display:flex;gap:8px;">
          <button class="secondary" onclick="recExpandAll()" style="font-size:12px;padding:5px 12px;">Expand All</button>
          <button class="secondary" onclick="recCollapseAll()" style="font-size:12px;padding:5px 12px;">Collapse All</button>
        </div>
      </div>
      ${plan.model_rationale ? `<p style="color:var(--muted);font-size:13px;margin:0 0 16px;">${escapeHtml(plan.model_rationale)}</p>` : ""}

      <div id="rec-draft-weeks">
        ${(plan.weeks || []).map((wk, wi) => renderDraftWeek(wk, wi, goals)).join("")}
      </div>

      <div style="margin-top:20px;padding-top:16px;border-top:1.5px solid var(--border);">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Program Start Date</div>
        <input type="date" id="rec-activate-start"
               value="${escapeAttr(document.getElementById("rec-start-date")?.value || "")}"
               style="padding:5px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;margin-bottom:14px;">
        <br>
        <button onclick="recActivatePlan()" id="rec-activate-btn" style="background:var(--primary);">
          <i class="bi bi-play-fill"></i> Activate This Plan
        </button>
        <div id="rec-activate-status" style="margin-top:10px;"></div>
      </div>
    </div>
  `;

  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDraftWeek(wk, wi, goals) {
  const sessions = wk.sessions || [];
  const TYPE_COLORS = {
    "parent-only":    "#3b82f6",
    "parent+child":   "#059669",
    "child-only":     "#8b5cf6",
    "child-skill":    "#0891b2",
    "parent-coaching":"#d97706"
  };

  const sessionsHtml = sessions.map((sess, si) => {
    const color = TYPE_COLORS[sess.type] || "#6b7280";
    const goalsHtml = goals.length ? `
      <div style="margin-top:8px;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Goals addressed</div>
        ${goals.map((g, gi) => `
          <label style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;font-size:12px;cursor:pointer;">
            <input type="checkbox" class="sess-goal-check" data-week="${wi}" data-sess="${si}" data-goal="${gi}"
                   style="margin-top:2px;flex-shrink:0;">
            <span style="color:var(--muted);">${escapeHtml(g.length > 80 ? g.slice(0, 80) + "…" : g)}</span>
          </label>`).join("")}
      </div>` : "";

    return `
      <div style="padding:10px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--border);margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${color}22;color:${color};">
            Session ${sess.session_num} · ${escapeHtml(sess.type || "")}
          </span>
        </div>
        <div style="margin-bottom:6px;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Title</div>
          <input type="text" class="draft-title" data-week="${wi}" data-sess="${si}"
                 value="${escapeAttr(sess.title || "")}"
                 style="width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;"
                 oninput="recPatchDraft(${wi},${si},'title',this.value)">
        </div>
        <div style="margin-bottom:6px;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Focus</div>
          <textarea class="draft-focus" data-week="${wi}" data-sess="${si}" rows="2"
                    style="width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;resize:vertical;box-sizing:border-box;"
                    oninput="recPatchDraft(${wi},${si},'focus',this.value)">${escapeHtml(sess.focus || "")}</textarea>
        </div>
        ${sess.parent_takeaway ? `
        <div style="margin-bottom:6px;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Parent Takeaway</div>
          <input type="text" class="draft-takeaway" data-week="${wi}" data-sess="${si}"
                 value="${escapeAttr(sess.parent_takeaway || "")}"
                 style="width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;"
                 oninput="recPatchDraft(${wi},${si},'parent_takeaway',this.value)">
        </div>` : ""}
        ${goalsHtml}
      </div>`;
  }).join("");

  return `
    <div class="draft-week" style="margin-bottom:8px;border:1.5px solid var(--border);border-radius:10px;overflow:hidden;">
      <div onclick="recToggleWeek(${wi})" style="display:flex;align-items:center;justify-content:space-between;
           padding:10px 14px;background:var(--surface);cursor:pointer;user-select:none;">
        <div>
          <span style="font-weight:700;font-size:13px;">Week ${wk.week}</span>
          ${wk.phase ? `<span style="font-size:12px;color:var(--muted);margin-left:8px;">${escapeHtml(wk.phase)}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;color:var(--muted);">${sessions.length} session${sessions.length !== 1 ? "s" : ""}</span>
          <i class="bi bi-chevron-down draft-week-chevron" id="chevron-${wi}" style="transition:.2s;"></i>
        </div>
      </div>
      <div id="draft-week-body-${wi}" style="display:none;padding:12px;">
        ${sessionsHtml}
      </div>
    </div>`;
}

function recToggleWeek(wi) {
  const body    = document.getElementById("draft-week-body-" + wi);
  const chevron = document.getElementById("chevron-" + wi);
  if (!body) return;
  const open = body.style.display !== "none";
  body.style.display    = open ? "none" : "block";
  if (chevron) chevron.style.transform = open ? "" : "rotate(180deg)";
}

function recExpandAll() {
  (recDraftPlan?.weeks || []).forEach((_, wi) => {
    const body    = document.getElementById("draft-week-body-" + wi);
    const chevron = document.getElementById("chevron-" + wi);
    if (body)    body.style.display    = "block";
    if (chevron) chevron.style.transform = "rotate(180deg)";
  });
}

function recCollapseAll() {
  (recDraftPlan?.weeks || []).forEach((_, wi) => {
    const body    = document.getElementById("draft-week-body-" + wi);
    const chevron = document.getElementById("chevron-" + wi);
    if (body)    body.style.display    = "none";
    if (chevron) chevron.style.transform = "";
  });
}

// Live-patch the in-memory draft as the provider edits fields
function recPatchDraft(wi, si, field, value) {
  if (!recDraftPlan?.weeks?.[wi]?.sessions?.[si]) return;
  recDraftPlan.weeks[wi].sessions[si][field] = value;
}

// ── Step 6: Activate ──────────────────────────────────────────────────────────

async function recActivatePlan() {
  if (!recDraftPlan) return;
  const startDate = document.getElementById("rec-activate-start")?.value || "";
  const btn = document.getElementById("rec-activate-btn");
  if (btn) btn.disabled = true;
  setStatus("rec-activate-status", "Activating…", "loading");

  // Embed per-session goal selections into the plan before saving
  const plan = JSON.parse(JSON.stringify(recDraftPlan)); // deep copy
  document.querySelectorAll(".sess-goal-check:checked").forEach(cb => {
    const wi   = parseInt(cb.dataset.week);
    const si   = parseInt(cb.dataset.sess);
    const gi   = parseInt(cb.dataset.goal);
    const sess = plan.weeks?.[wi]?.sessions?.[si];
    if (!sess) return;
    if (!sess.goals_addressed) sess.goals_addressed = [];
    const goal = recSelGoals[gi];
    if (goal && !sess.goals_addressed.includes(goal)) sess.goals_addressed.push(goal);
  });

  try {
    await apiCall("activateClientProgram", { sessionPlan: plan, startDate });
    setStatus("rec-activate-status", "Program activated! Go to the Client Program tab to track sessions.", "success");
    if (btn) btn.disabled = false;
  } catch (e) {
    setStatus("rec-activate-status", "Error: " + e.message, "error");
    if (btn) btn.disabled = false;
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function recPrint() { window.print(); }

function recCopyNarrative() {
  if (!recResult?.narrative) return;
  navigator.clipboard.writeText(recResult.narrative).catch(() => alert(recResult.narrative));
  const el = document.querySelector("#rec-result .btn-row button:first-child i");
  if (el) { el.className = "bi bi-check-lg"; setTimeout(() => { el.className = "bi bi-clipboard"; }, 1800); }
}
