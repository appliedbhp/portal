// Talks to the Google Apps Script Web App backend (see apps-script/Code.gs).
// IMPORTANT: set this to your deployed Web App URL after running
// Deploy > New deployment > Web app in the Apps Script editor.
const API_URL = "https://script.google.com/macros/s/AKfycbwtKb9UqSeBy4FKiI-VZK2EOpwm2ZCe8eWMgnAF0WkZB5FgBOEpjicvFDG59Dlft61i/exec";

// Posting with text/plain avoids a CORS preflight request, which Apps
// Script Web Apps cannot answer (no OPTIONS handler available).
async function apiCall(action, params) {
  const body = Object.assign({ action }, getCreds(), params || {});
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---- Session credentials (License Key + Client ID + PIN + Assessor Name).
// Held in sessionStorage so they clear when the tab closes, but survive
// navigation between login.html and portal.html. ----
const SESSION_KEY = "portalSession";

function setCreds(creds) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(creds));
}

// Two kinds of session: a client session (clientId+password, scoped to one
// client) or a provider session (providerId+providerPassword, plus whichever
// clientId they've currently selected to view/edit — switchable without
// re-login via setProviderClient()).
function getCreds() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return {};
  const c = JSON.parse(raw);
  if (c.asProvider) {
    return { asProvider: true, providerId: c.providerId, providerPassword: c.providerPassword, clientId: c.clientId };
  }
  return { clientId: c.clientId, password: c.password, assessorName: c.assessorName };
}

function isProvider() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return !!(raw && JSON.parse(raw).asProvider);
}

function getClientId() {
  return getCreds().clientId || "";
}

function setProviderClient(clientId) {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return;
  const c = JSON.parse(raw);
  c.clientId = clientId;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(c));
}

function getAssessorName() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return "";
  const c = JSON.parse(raw);
  return c.asProvider ? (c.providerId || "") : (c.assessorName || "");
}

function getRole() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return "parent";
  const c = JSON.parse(raw);
  return c.asProvider ? "provider" : (c.role || "parent");
}

function clearCreds() {
  sessionStorage.removeItem(SESSION_KEY);
}

function requireLogin() {
  if (!sessionStorage.getItem(SESSION_KEY)) {
    window.location.href = "login.html";
  }
}

function logout() {
  clearCreds();
  _stopTimeoutWatcher();
  window.location.href = "login.html";
}

// ── Session timeout (provider only) ──────────────────────────────────────────
// 15 min inactivity → auto-logout. Warning banner at 13 min.

const TIMEOUT_MS      = 15 * 60 * 1000;
const WARN_MS         = 13 * 60 * 1000;
let   _lastActivity   = Date.now();
let   _timeoutTicker  = null;
let   _warnShown      = false;

function _resetActivity() {
  _lastActivity = Date.now();
  if (_warnShown) _dismissTimeoutWarning();
}

function _stopTimeoutWatcher() {
  if (_timeoutTicker) { clearInterval(_timeoutTicker); _timeoutTicker = null; }
  _dismissTimeoutWarning();
}

function _dismissTimeoutWarning() {
  _warnShown = false;
  const el = document.getElementById("_timeout-banner");
  if (el) el.remove();
}

function _showTimeoutWarning(secsLeft) {
  let el = document.getElementById("_timeout-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "_timeout-banner";
    el.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;background:#1e40af;color:#fff;" +
      "padding:14px 20px;border-radius:12px;font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,.3);" +
      "display:flex;align-items:center;gap:12px;max-width:340px;";
    el.innerHTML = `<i class="bi bi-clock-fill" style="font-size:20px;flex-shrink:0;"></i>
      <span id="_timeout-msg"></span>
      <button onclick="_resetActivity()" style="background:#fff;color:#1e40af;border:none;padding:5px 12px;
        border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;flex-shrink:0;">Stay logged in</button>`;
    document.body.appendChild(el);
  }
  document.getElementById("_timeout-msg").textContent =
    `You'll be logged out in ${secsLeft} second${secsLeft !== 1 ? "s" : ""} due to inactivity.`;
  _warnShown = true;
}

function startTimeoutWatcher() {
  if (!isProvider()) return; // only enforce for providers
  _stopTimeoutWatcher();
  _lastActivity = Date.now();

  ["click","keydown","mousemove","touchstart","scroll"].forEach(evt =>
    document.addEventListener(evt, _resetActivity, { passive: true })
  );

  _timeoutTicker = setInterval(() => {
    const idle = Date.now() - _lastActivity;
    if (idle >= TIMEOUT_MS) {
      _stopTimeoutWatcher();
      clearCreds();
      window.location.href = "login.html?reason=timeout";
      return;
    }
    if (idle >= WARN_MS) {
      const secsLeft = Math.ceil((TIMEOUT_MS - idle) / 1000);
      _showTimeoutWarning(secsLeft);
    } else {
      _dismissTimeoutWarning();
    }
  }, 5000);
}
