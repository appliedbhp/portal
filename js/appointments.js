// Appointments section — Calendly booking widget + upcoming appointments
// + a month-view calendar showing both appointments and program activity dates.

const CALENDLY_BOOKING_URL = "https://calendly.com/appliedbhp/30min";

let calViewDate  = new Date();
let calAppts     = [];
let calProgSteps = [];

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
    <div id="appt-status"></div>
    <div class="card" id="cal-card">
      <div id="cal-widget"><p style="color:var(--muted);font-size:14px;">Loading calendar…</p></div>
    </div>
    <div class="card">
      <h2><i class="bi bi-calendar2-week"></i>Upcoming Appointments</h2>
      <div id="appt-list"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>
    </div>
  `;
  loadAppointmentsData();
}

function loadCalendlyWidget() {
  if (document.getElementById("calendly-widget-css")) return;
  const link = document.createElement("link");
  link.id   = "calendly-widget-css";
  link.rel  = "stylesheet";
  link.href = "https://assets.calendly.com/assets/external/widget.css";
  document.head.appendChild(link);
  const script  = document.createElement("script");
  script.id     = "calendly-widget-js";
  script.src    = "https://assets.calendly.com/assets/external/widget.js";
  document.head.appendChild(script);
}

async function openBooking() {
  let prefill = {};
  try {
    const data = await apiCall("getClientEmail", {});
    if (data.email) prefill.email = data.email;
  } catch (_) {}
  if (typeof Calendly !== "undefined") {
    Calendly.initPopupWidget({ url: CALENDLY_BOOKING_URL, prefill });
  } else {
    const qs = prefill.email ? "?email=" + encodeURIComponent(prefill.email) : "";
    window.open(CALENDLY_BOOKING_URL + qs, "_blank");
  }
}

async function loadAppointmentsData() {
  setStatus("appt-status", "Loading…", "loading");
  try {
    const [apptData, progData] = await Promise.all([
      apiCall("getAppointments", {}),
      apiCall("getMyProgram", {}).catch(() => ({ assignment: null, steps: [] }))
    ]);
    calAppts     = apptData.events || [];
    calProgSteps = buildProgStepsForCalendar(progData);
    renderCalendar();
    renderAppointments(calAppts);
    setStatus("appt-status", "", "");
  } catch (e) {
    setStatus("appt-status", "Could not load: " + e.message, "error");
    document.getElementById("appt-list").innerHTML = "";
  }
}

// Convert program steps into calendar-plottable items (day-based only)
function buildProgStepsForCalendar(progData) {
  if (!progData.assignment || !progData.steps) return [];
  const start = new Date(progData.assignment.startDate + "T00:00:00");
  const out   = [];
  progData.steps.forEach(step => {
    let date = null;
    if (step.unlockType === "immediate") {
      date = new Date(start);
    } else if (step.unlockType === "days") {
      date = new Date(start);
      date.setDate(date.getDate() + (parseInt(step.unlockValue) || 0));
    }
    // completion-based steps have no fixed date — skip for calendar
    if (date) out.push({ stepNum: step.stepNum, title: step.title, status: step.status, date });
  });
  return out;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function renderCalendar() {
  const container = document.getElementById("cal-widget");
  if (!container) return;

  const year  = calViewDate.getFullYear();
  const month = calViewDate.getMonth();
  const label = calViewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // Build date → events map (key = "YYYY-MM-DD")
  const dayMap = {};
  const toKey  = d => d.toLocaleDateString("en-CA"); // locale-independent YYYY-MM-DD

  calAppts.forEach(ev => {
    const k = toKey(new Date(ev.start_time));
    (dayMap[k] = dayMap[k] || []).push({ type: "appt", label: ev.name || "Appointment" });
  });
  calProgSteps.forEach(step => {
    const k = toKey(step.date);
    (dayMap[k] = dayMap[k] || []).push({ type: "step", stepNum: step.stepNum, title: step.title, status: step.status });
  });

  const startDow    = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey    = toKey(new Date());

  let cells = "";
  for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const key    = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const evts   = dayMap[key] || [];
    const isToday = key === todayKey;

    const badges = evts.map(ev => {
      if (ev.type === "appt") {
        return `<span class="cal-badge appt" data-tooltip="${escapeHtml(ev.label)}"><i class="bi bi-calendar-check"></i></span>`;
      }
      const iconMap = { completed: "check-lg", locked: "lock-fill" };
      const inner   = ev.status === "available"
        ? String(ev.stepNum)
        : `<i class="bi bi-${iconMap[ev.status] || "circle"}"></i>`;
      return `<span class="cal-badge step ${ev.status}" data-tooltip="${escapeHtml(ev.title)}">${inner}</span>`;
    }).join("");

    cells += `
      <div class="cal-cell${isToday ? " today" : ""}${evts.length ? " has-events" : ""}">
        <span class="cal-day-num">${d}</span>
        <div class="cal-badges">${badges}</div>
      </div>`;
  }

  container.innerHTML = `
    <div class="cal-nav">
      <button class="secondary icon-btn" onclick="calPrev()"><i class="bi bi-chevron-left"></i></button>
      <span class="cal-month-label">${escapeHtml(label)}</span>
      <button class="secondary icon-btn" onclick="calNext()"><i class="bi bi-chevron-right"></i></button>
    </div>
    <div class="cal-legend">
      <span class="cal-legend-item"><span class="cal-badge appt"><i class="bi bi-calendar-check"></i></span>Appointment</span>
      <span class="cal-legend-item"><span class="cal-badge step available">1</span>Activity available</span>
      <span class="cal-legend-item"><span class="cal-badge step completed"><i class="bi bi-check-lg"></i></span>Completed</span>
      <span class="cal-legend-item"><span class="cal-badge step locked"><i class="bi bi-lock-fill"></i></span>Locked</span>
    </div>
    <div class="cal-grid">
      <div class="cal-dow">Sun</div><div class="cal-dow">Mon</div><div class="cal-dow">Tue</div>
      <div class="cal-dow">Wed</div><div class="cal-dow">Thu</div><div class="cal-dow">Fri</div>
      <div class="cal-dow">Sat</div>
      ${cells}
    </div>
  `;
}

function calPrev() {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() - 1, 1);
  renderCalendar();
}
function calNext() {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() + 1, 1);
  renderCalendar();
}

// ── Appointments list ─────────────────────────────────────────────────────────

function renderAppointments(events) {
  const el = document.getElementById("appt-list");
  if (!events.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:14px;">No upcoming appointments scheduled.</p>`;
    return;
  }
  el.innerHTML = events.map(ev => {
    const start = new Date(ev.start_time);
    const end   = new Date(ev.end_time);
    const date  = start.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const time  = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                + " – " + end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `
      <div class="appt-card">
        <div class="appt-info">
          <div class="appt-name">${escapeHtml(ev.name || "Appointment")}</div>
          <div class="appt-meta"><i class="bi bi-calendar3"></i>${escapeHtml(date)}</div>
          <div class="appt-meta"><i class="bi bi-clock"></i>${escapeHtml(time)}</div>
        </div>
        <div class="appt-actions">
          ${ev.reschedule_url ? `<a href="${escapeHtml(ev.reschedule_url)}" target="_blank"
            class="secondary" style="font-size:12px;padding:6px 14px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--border);border-radius:8px;color:var(--text);">
            <i class="bi bi-arrow-clockwise"></i> Reschedule</a>` : ""}
          ${ev.cancel_url ? `<a href="${escapeHtml(ev.cancel_url)}" target="_blank"
            class="secondary" style="font-size:12px;padding:6px 14px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border:1.5px solid #dc2626;border-radius:8px;color:#dc2626;">
            <i class="bi bi-x-circle"></i> Cancel</a>` : ""}
        </div>
      </div>`;
  }).join("");
}
