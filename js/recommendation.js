// Package Recommendation section — pulls all available assessment data,
// runs the rule-based tier algorithm server-side, then calls Claude API
// for a narrative summary. Package names, prices, and thresholds are all
// editable in tbl_packages and tbl_thresholds without touching code.

let recResult = null;

function initRecommendationSection(root) {
  root.innerHTML = `
    <div class="card no-print">
      <h1><i class="bi bi-stars"></i>Package Recommendation</h1>
      <p style="color:var(--muted);font-size:14px;margin:0 0 20px;">
        Analyzes all available assessment data using the practice's clinical scoring algorithm
        and generates a narrative summary to support package conversations with families.
        Package tiers and thresholds are configured in the
        <strong>tbl_packages</strong> and <strong>tbl_thresholds</strong> sheets.
      </p>
      <button onclick="generateRecommendation()"><i class="bi bi-magic"></i> Generate Recommendation</button>
      <div id="rec-status" style="margin-top:12px;"></div>
    </div>
    <div id="rec-result"></div>
  `;
}

async function generateRecommendation() {
  const btn = document.querySelector("#section-recommendation .card button");
  if (btn) btn.disabled = true;
  setStatus("rec-status", "Analyzing assessment data and generating recommendation…", "loading");
  try {
    const data = await apiCall("getPackageRecommendation", {});
    recResult = data;
    renderRecommendation(data);
    setStatus("rec-status", "", "");
  } catch (e) {
    setStatus("rec-status", "Error: " + e.message, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderRecommendation(data) {
  const el = document.getElementById("rec-result");

  const palette = {
    Sprint:  { bg: "#ecfdf5", border: "#10b981", labelColor: "#065f46", accent: "#10b981" },
    Journey: { bg: "#fffbeb", border: "#f59e0b", labelColor: "#92400e", accent: "#d97706" },
    Voyage:  { bg: "#eff6ff", border: "#3185fc", labelColor: "#1e3a8a", accent: "#3185fc" }
  };
  const colors = palette[data.tier] || palette.Voyage;

  // Use package info from API (sourced from tbl_packages sheet) with fallbacks
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
    : `<li style="color:var(--muted);">No specific triggers recorded — based on aggregate profile.</li>`;

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
        <i class="bi bi-robot" style="color:var(--muted);"></i>
        AI-generated — review before sharing with families.
      </div>
    </div>
    ` : ""}

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

function recPrint() {
  window.print();
}

function recCopyNarrative() {
  if (!recResult || !recResult.narrative) return;
  navigator.clipboard.writeText(recResult.narrative).then(() => {
    const btn = document.querySelector("#rec-result .btn-row button");
    // brief visual confirmation — swap icon
    const el = document.querySelector("#rec-result .btn-row button:first-child i");
    if (el) { el.className = "bi bi-check-lg"; setTimeout(() => { el.className = "bi bi-clipboard"; }, 1800); }
  }).catch(() => {
    alert(recResult.narrative);
  });
}
