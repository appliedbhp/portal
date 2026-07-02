// Shared helpers used across Roadmap / WIN / Plan / Progress / Scores sections:
// status banners, domain colors, Chart.js setup, and the assessment-history carousel.

const STATUS_ICONS = { error: "exclamation-triangle-fill", success: "check-circle-fill", info: "info-circle-fill", loading: "arrow-repeat" };
function setStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!msg) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="alert alert-${type === "loading" ? "info" : type}"><i class="bi bi-${STATUS_ICONS[type] || "info-circle-fill"}"></i><span>${msg}</span></div>`;
}

const DOMAIN_PALETTE = ["#3185fc", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899"];
const domainColorMap = {};
function colorForDomain(domain) {
  if (!domainColorMap[domain]) {
    domainColorMap[domain] = DOMAIN_PALETTE[Object.keys(domainColorMap).length % DOMAIN_PALETTE.length];
  }
  return domainColorMap[domain];
}
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

if (typeof Chart !== "undefined") {
  Chart.defaults.font.family = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = "#4b5168";
  Chart.defaults.borderColor = "#e7e9f0";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
}

const chartInstances = {};
function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}
window.addEventListener("beforeprint", () => {
  Object.values(chartInstances).forEach(c => { c.resize(); c.update(); });
});

function statCard(icon, label, value) {
  return `<div class="stat-card"><i class="bi bi-${icon}"></i><div><div class="stat-label">${label}</div><div class="stat-value">${escapeHtml(value)}</div></div></div>`;
}

// ---- Carousel: click through prior assessment snapshots, re-rendering
// whichever wheel/bar chart functions the caller supplies. ----
const carouselState = {};
function setupCarousel(prefix, snapshots, startIndex, renderFns) {
  carouselState[prefix] = { snapshots, index: startIndex, renderFns };
  renderCarouselNav(prefix);
  updateCarouselCharts(prefix);
}
function renderCarouselNav(prefix) {
  const state = carouselState[prefix];
  const nav = document.getElementById(prefix + "Nav");
  if (!nav) return;
  const snap = state.snapshots[state.index];
  nav.innerHTML = `
    <button class="secondary icon-btn" onclick="carouselStep('${prefix}', -1)" ${state.index <= 0 ? "disabled" : ""} title="Previous"><i class="bi bi-chevron-left"></i></button>
    <span style="font-weight:600;"><i class="bi bi-calendar-event"></i> ${snap.date || "—"} ${snap.level ? "— " + escapeHtml(snap.level) : ""} (${state.index + 1} of ${state.snapshots.length})</span>
    <button class="secondary icon-btn" onclick="carouselStep('${prefix}', 1)" ${state.index >= state.snapshots.length - 1 ? "disabled" : ""} title="Next"><i class="bi bi-chevron-right"></i></button>
  `;
}
function carouselStep(prefix, dir) {
  const state = carouselState[prefix];
  const next = state.index + dir;
  if (next < 0 || next >= state.snapshots.length) return;
  state.index = next;
  renderCarouselNav(prefix);
  updateCarouselCharts(prefix);
}
function updateCarouselCharts(prefix) {
  const state = carouselState[prefix];
  const snap = state.snapshots[state.index];
  state.renderFns.wheel(prefix + "Wheel", prefix + "WheelLegend", snap.summary);
  state.renderFns.bar(prefix + "Bar", snap.summary);
}

// ── Shared tooltip ────────────────────────────────────────────────────────────
// Use data-tooltip="text" on any element. The tooltip follows the cursor
// and works inside grid/flex containers where CSS ::after fails.
(function() {
  let tip = null;
  function getTip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "portal-tooltip";
      document.body.appendChild(tip);
    }
    return tip;
  }
  document.addEventListener("mouseover", function(e) {
    const el = e.target.closest("[data-tooltip]");
    if (!el) return;
    const t = getTip();
    t.textContent = el.dataset.tooltip;
    t.style.display = "block";
  });
  document.addEventListener("mousemove", function(e) {
    if (!tip || tip.style.display === "none") return;
    tip.style.left = (e.clientX + 12) + "px";
    tip.style.top  = (e.clientY - 28) + "px";
  });
  document.addEventListener("mouseout", function(e) {
    const el = e.target.closest("[data-tooltip]");
    if (el && !el.contains(e.relatedTarget)) {
      if (tip) tip.style.display = "none";
    }
  });
})();

// Renders saved BFA scores (bfa_scores_json) into HTML — used by both
// programs.js (parent completed view) and program-admin.js (provider review).
function renderBfaScores(scoresJson) {
  const FN_COLORS = { att: "#6366f1", esc: "#d97706", tan: "#059669", aut: "#db2777" };
  const FN_ORDER  = ["att", "esc", "tan", "aut"];
  const FN_LABELS = { att: "Attention", esc: "Escape", tan: "Tangible", aut: "Automatic / Sensory" };

  let data;
  try { data = typeof scoresJson === "string" ? JSON.parse(scoresJson) : scoresJson; }
  catch (_) { return `<p style="color:var(--muted);font-size:13px;">Score data unavailable.</p>`; }

  let html = `<div style="font-weight:700;font-size:14px;margin-bottom:14px;"><i class="bi bi-bar-chart-fill"></i> Function Score Summary</div>`;

  Object.values(data).forEach(entry => {
    const label  = entry.label || "Behavior";
    const scores = entry.scores || {};
    const sorted = FN_ORDER.map(fn => ({ fn, label: FN_LABELS[fn], score: scores[fn] || 0 }))
                            .sort((a, b) => b.score - a.score);
    const top = sorted[0];

    const antecedents = entry.antecedents || [];
    const antNotes    = entry.antNotes || "";

    html += `<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);">`;
    html += `<div style="font-weight:700;font-size:14px;margin-bottom:10px;">${escapeHtml(label)}</div>`;

    if (antecedents.length || antNotes) {
      html += `<div style="margin-bottom:12px;padding:10px 12px;background:#f0f4ff;border-radius:8px;border-left:3px solid #6366f1;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#3730a3;margin-bottom:6px;">
          <i class="bi bi-arrow-right-circle-fill"></i> Identified Antecedents
        </div>`;
      if (antecedents.length) {
        const byCat = {};
        antecedents.forEach(a => { (byCat[a.cat] = byCat[a.cat] || []).push(a.label); });
        Object.entries(byCat).forEach(([cat, items]) => {
          html += `<div style="font-size:12px;font-weight:600;color:#1e3a8a;margin:6px 0 3px;">${escapeHtml(cat)}</div>`;
          html += `<ul style="margin:0 0 4px;padding-left:18px;">${items.map(i => `<li style="font-size:13px;margin-bottom:2px;">${escapeHtml(i)}</li>`).join("")}</ul>`;
        });
      }
      if (antNotes) html += `<p style="font-size:13px;margin:6px 0 0;font-style:italic;">${escapeHtml(antNotes)}</p>`;
      html += `</div>`;
    }

    sorted.forEach(item => {
      const pct    = Math.round((item.score / 20) * 100);
      const isTop  = item.fn === top.fn && item.score >= 8;
      const isSig  = item.score >= 8 && item.fn !== top.fn;
      const badge  = isTop ? ` <span style="font-size:11px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;font-weight:700;">Primary</span>`
                   : isSig ? ` <span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;font-weight:700;">Significant</span>` : "";
      html += `<div style="margin-bottom:8px;">
        <div style="font-size:13px;font-weight:600;display:flex;justify-content:space-between;margin-bottom:3px;">
          <span>${escapeHtml(item.label)}${badge}</span><span>${item.score}/20</span>
        </div>
        <div style="background:#f0f1f5;border-radius:4px;height:20px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${FN_COLORS[item.fn]};border-radius:4px;min-width:${pct > 0 ? "22px" : "0"};display:flex;align-items:center;padding-left:6px;color:white;font-size:12px;font-weight:700;">${pct > 15 ? item.score : ""}</div>
        </div>
      </div>`;
    });

    if (top.score < 8) {
      html += `<p style="font-size:12px;color:var(--muted);margin:4px 0 0;">No subscale reached the significant threshold (≥8).</p>`;
    }
    html += `</div>`;
  });

  return html;
}
