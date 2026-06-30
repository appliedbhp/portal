// Appointments section — Calendly booking widget + upcoming appointments
// via the Calendly API (server-side). Client email is read from tbl_license
// server-side; no name is stored or transmitted to the frontend.

const CALENDLY_BOOKING_URL = "https://calendly.com/appliedbhp/30min";

function initAppointmentsSection(root) {
  loadCalendlyWidget();
  root.innerHTML = `
    <div class="card no-print">
      <h1><i class="bi bi-calendar-check-fill"></i>Appointments</h1>
      <p style="color:var(--muted);font-size:14px;margin:0 0 20px;">
        Book a 30-minute session. Your email is pre-filled automatically.
      </p>
      <button onclick="openBooking()"><i class="bi bi-calendar-plus"></i> Book Appointment</button>
    </div>
    <div class="card">
      <h2><i class="bi bi-calendar2-week"></i>Upcoming Appointments</h2>
      <div id="appt-status"></div>
      <div id="appt-list"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>
    </div>
  `;
  loadAppointments();
}

function loadCalendlyWidget() {
  if (document.getElementById("calendly-widget-css")) return;
  const link = document.createElement("link");
  link.id = "calendly-widget-css";
  link.rel = "stylesheet";
  link.href = "https://assets.calendly.com/assets/external/widget.css";
  document.head.appendChild(link);

  const script = document.createElement("script");
  script.id = "calendly-widget-js";
  script.src = "https://assets.calendly.com/assets/external/widget.js";
  document.head.appendChild(script);
}

async function openBooking() {
  // Fetch the client's email server-side so it never has to be stored on the client
  let prefill = {};
  try {
    const data = await apiCall("getClientEmail", {});
    if (data.email) prefill.email = data.email;
  } catch (_) {}

  if (typeof Calendly !== "undefined") {
    Calendly.initPopupWidget({ url: CALENDLY_BOOKING_URL, prefill });
  } else {
    // Calendly script still loading — open in new tab as fallback
    const qs = prefill.email ? "?email=" + encodeURIComponent(prefill.email) : "";
    window.open(CALENDLY_BOOKING_URL + qs, "_blank");
  }
}

async function loadAppointments() {
  setStatus("appt-status", "Loading appointments…", "loading");
  try {
    const data = await apiCall("getAppointments", {});
    renderAppointments(data.events || []);
    setStatus("appt-status", "", "");
  } catch (e) {
    setStatus("appt-status", "Could not load appointments: " + e.message, "error");
    document.getElementById("appt-list").innerHTML = "";
  }
}

function renderAppointments(events) {
  const el = document.getElementById("appt-list");
  if (!events.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:14px;">No upcoming appointments scheduled.</p>`;
    return;
  }
  el.innerHTML = events.map(ev => {
    const start  = new Date(ev.start_time);
    const end    = new Date(ev.end_time);
    const date   = start.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const time   = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                 + " – " + end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `
      <div class="appt-card">
        <div class="appt-info">
          <div class="appt-name">${escapeHtml(ev.name || "Appointment")}</div>
          <div class="appt-meta"><i class="bi bi-calendar3"></i>${escapeHtml(date)}</div>
          <div class="appt-meta"><i class="bi bi-clock"></i>${escapeHtml(time)}</div>
        </div>
        <div class="appt-actions">
          ${ev.reschedule_url ? `
            <a href="${escapeHtml(ev.reschedule_url)}" target="_blank"
               class="secondary" style="font-size:12px;padding:6px 14px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--border);border-radius:8px;color:var(--text);">
              <i class="bi bi-arrow-clockwise"></i> Reschedule
            </a>` : ""}
          ${ev.cancel_url ? `
            <a href="${escapeHtml(ev.cancel_url)}" target="_blank"
               class="secondary" style="font-size:12px;padding:6px 14px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border:1.5px solid #dc2626;border-radius:8px;color:#dc2626;">
              <i class="bi bi-x-circle"></i> Cancel
            </a>` : ""}
        </div>
      </div>
    `;
  }).join("");
}
