// Talks to the Google Apps Script Web App backend (see apps-script/Code.gs).
// IMPORTANT: set this to your deployed Web App URL after running
// Deploy > New deployment > Web app in the Apps Script editor.
const API_URL = "https://script.google.com/macros/s/AKfycbwihJ1f2x5S6zyRQaoMRBCmjksZC_jFgs83k4CweU3vO8XFfqTG-EHr9aqOBpCdswWm/exec";

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
  window.location.href = "login.html";
}
