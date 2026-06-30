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
