// Appointments section — Google Calendar Appointment Scheduling iframe + upcoming appointments
// + a month-view calendar showing both appointments and program activity dates.

const GCAL_BOOKING_IFRAME = `https://calendar.google.com/calendar/appointments/schedules/AcZssZ02i845ZrVqhR2CyB_5PqHv6WbWssmJ3p8ghbxUZCvZl5dngh3tQuAdOgy2FnVXm4v_yZl0LPe1?gv=true`;

let calViewDate  = new Date();
let calAppts     = [];
let calProgSteps = [];
let appointmentTimeZone = "America/Los_Angeles";

const APPOINTMENT_TIME_ZONES = [
  ["America/Los_Angeles", "Pacific Time"], ["America/Denver", "Mountain Time"],
  ["America/Phoenix", "Arizona Time"], ["America/Chicago", "Central Time"],
  ["America/New_York", "Eastern Time"], ["America/Anchorage", "Alaska Time"],
  ["Pacific/Honolulu", "Hawaii Time"], ["America/Puerto_Rico", "Atlantic Time"],
  ["UTC", "UTC"]
];

function appointmentTimeZoneControls() {
  const options = APPOINTMENT_TIME_ZONES.map(([value, label]) =>
    `<option value="${value}" ${value === appointmentTimeZone ? "selected" : ""}>${label}</option>`
  ).join("");
  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <span style="font-size:12px;color:var(--muted);">Shown in ${escapeHtml(appointmentTimeZone)}</span>
    <button class="secondary" style="font-size:12px;padding:6px 10px;" onclick="toggleAppointmentTimeZone()">
      <i class="bi bi-globe-americas"></i> Change time zone
    </button>
    <div id="appt-timezone-editor" style="display:none;align-items:center;gap:6px;">
      <select id="appt-timezone-select" style="font-size:12px;padding:6px 8px;">${options}</select>
      <button style="font-size:12px;padding:6px 10px;" onclick="saveAppointmentTimeZone()">Save</button>
    </div>
  </div>`;
}

async function initAppointmentsSection(root) {
  const isProvider = getRole() === "provider";
  try {
    const tzRes = await apiCall("getClientTimeZone", {});
    appointmentTimeZone = tzRes.timeZone || "America/Los_Angeles";
  } catch (_) {
    appointmentTimeZone = "America/Los_Angeles";
  }

  if (isProvider) {
    // Provider view: scheduling form + appointment list
    let clientEmail = "";
    let smsConsent  = false;
    try {
      const res = await apiCall("getClientEmail", {});
      clientEmail = res.email || "";
      smsConsent  = res.smsConsent || false;
    } catch(_) {}

    root.innerHTML = `
      <div class="card no-print">
        <h1><i class="bi bi-calendar-plus-fill"></i> Schedule Appointment</h1>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:560px;">
          <div style="grid-column:1/-1;">
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Title</label>
            <input type="text" id="appt-title" placeholder="e.g. Session — ${escapeHtml(getClientId())}"
                   value="Session — ${escapeHtml(getClientId())}" style="width:100%;" />
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Date &amp; Start Time (Pacific)</label>
            <input type="datetime-local" id="appt-start" style="width:100%;" onchange="apptSyncEndTime()" />
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Date &amp; End Time (Pacific)</label>
            <input type="datetime-local" id="appt-end" style="width:100%;" />
          </div>
          <div style="grid-column:1/-1;">
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Notes (optional)</label>
            <textarea id="appt-notes" rows="2" placeholder="Visible in calendar invite"
                      style="width:100%;resize:vertical;"></textarea>
          </div>
          <div style="grid-column:1/-1;">
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Client Email</label>
            <input type="email" id="appt-email" value="${escapeHtml(clientEmail)}"
                   placeholder="auto-filled from client record" style="width:100%;" readonly />
            <div style="font-size:11px;color:var(--muted);margin-top:3px;">
              Invite sent automatically when appointment is created.
            </div>
          </div>
          ${smsConsent ? `
          <div style="grid-column:1/-1;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
              <input type="checkbox" id="appt-sms" checked />
              Send SMS reminder to client now (opted in)
            </label>
          </div>` : `
          <div style="grid-column:1/-1;">
            <div style="font-size:12px;color:var(--muted);">
              <i class="bi bi-chat-dots"></i> SMS reminder not available — client has not opted in.
            </div>
          </div>`}
        </div>
        <div id="appt-create-status" style="margin:12px 0;"></div>
        <button onclick="apptCreate()" style="margin-top:4px;">
          <i class="bi bi-calendar-plus-fill"></i> Create Appointment
        </button>
      </div>
      <div id="appt-status"></div>
      <div class="card" id="cal-card">
        <div id="cal-widget"><p style="color:var(--muted);font-size:14px;">Loading calendar…</p></div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <h2 style="margin:0;"><i class="bi bi-calendar2-week"></i>Upcoming Appointments</h2>
          ${appointmentTimeZoneControls()}
        </div>
        <div id="appt-list"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>
      </div>`;
  } else {
    // Client view: booking iframe with email pre-filled
    let iframeSrc = GCAL_BOOKING_IFRAME;
    try {
      const res = await apiCall("getClientEmail", {});
      if (res.email) iframeSrc += "&email=" + encodeURIComponent(res.email);
    } catch(_) {}

    root.innerHTML = `
      <div class="card no-print">
        <h1><i class="bi bi-calendar-check-fill"></i>Book an Appointment</h1>
        <p style="color:var(--muted);font-size:14px;margin:0 0 16px;">
          Select a 30-minute session below. A confirmation will be sent to your email automatically.
        </p>
        <iframe src="${iframeSrc}"
          style="border:0;border-radius:12px;display:block;max-width:100%;"
          width="100%" height="600" frameborder="0" loading="lazy"></iframe>
      </div>
      <div id="appt-status"></div>
      <div class="card" id="cal-card">
        <div id="cal-widget"><p style="color:var(--muted);font-size:14px;">Loading calendar…</p></div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <h2 style="margin:0;"><i class="bi bi-calendar2-week"></i>Upcoming Appointments</h2>
          ${appointmentTimeZoneControls()}
        </div>
        <div id="appt-list"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>
      </div>`;
  }

  if (isProvider) apptSetDefaultTimes();
  loadAppointmentsData();
}

function toggleAppointmentTimeZone() {
  const editor = document.getElementById("appt-timezone-editor");
  if (editor) editor.style.display = editor.style.display === "flex" ? "none" : "flex";
}

async function saveAppointmentTimeZone() {
  const select = document.getElementById("appt-timezone-select");
  if (!select?.value) return;
  try {
    const res = await apiCall("saveClientTimeZone", { timeZone: select.value });
    appointmentTimeZone = res.timeZone || select.value;
    if (typeof showToast === "function") showToast("Appointment time zone saved.", "success");
    const root = document.getElementById("section-appointments");
    if (root) initAppointmentsSection(root);
  } catch (e) {
    if (typeof showToast === "function") showToast("Could not save time zone: " + e.message, "error");
  }
}

function apptToLocalInput(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function apptPacificNowAsWallDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date()).reduce((out, part) => {
    if (part.type !== "literal") out[part.type] = part.value;
    return out;
  }, {});
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), 0, 0);
}

function apptSetDefaultTimes() {
  const startEl = document.getElementById("appt-start");
  const endEl = document.getElementById("appt-end");
  if (!startEl || !endEl) return;
  const start = apptPacificNowAsWallDate();
  start.setDate(start.getDate() + 7);
  start.setSeconds(0, 0);
  startEl.value = apptToLocalInput(start);
  endEl.value = apptToLocalInput(new Date(start.getTime() + 30 * 60000));
}

function apptSyncEndTime() {
  const startEl = document.getElementById("appt-start");
  const endEl = document.getElementById("appt-end");
  if (!startEl?.value || !endEl) return;
  const start = new Date(startEl.value);
  if (!isNaN(start)) endEl.value = apptToLocalInput(new Date(start.getTime() + 30 * 60000));
}

async function apptCreate() {
  const title = document.getElementById("appt-title")?.value?.trim();
  const start = document.getElementById("appt-start")?.value;
  const end   = document.getElementById("appt-end")?.value;
  const notes = document.getElementById("appt-notes")?.value?.trim() || "";
  const smsEl = document.getElementById("appt-sms");
  const sendSms = smsEl ? smsEl.checked : false;

  if (!title) { setStatus("appt-create-status", "Title is required.", "error"); return; }
  if (!start) { setStatus("appt-create-status", "Start time is required.", "error"); return; }
  if (!end)   { setStatus("appt-create-status", "End time is required.", "error"); return; }
  if (new Date(end) <= new Date(start)) {
    setStatus("appt-create-status", "End time must be after start time.", "error"); return;
  }

  setStatus("appt-create-status", "Creating appointment…", "loading");
  try {
    const res = await apiCall("createAppointment", {
      title,
      startLocal: start,
      endLocal: end,
      timeZone: "America/Los_Angeles",
      startTime: new Date(start).toISOString(),
      endTime:   new Date(end).toISOString(),
      notes, sendSms
    });

    let msg = "Appointment added to Google Calendar in Pacific Time.";
    if (res.clientEmail) msg += ` Invite sent to ${res.clientEmail}.`;
    if (res.meetUrl) msg += ` Meet: ${res.meetUrl}`;
    if (res.smsSent)     msg += " SMS reminder sent.";
    if (res.smsSkipped)  msg += " (SMS skipped — client not opted in.)";
    if (res.smsError)    msg += ` SMS failed: ${res.smsError}`;

    setStatus("appt-create-status", msg, "success");
    loadAppointmentsData(); // refresh the list
  } catch(e) {
    setStatus("appt-create-status", "Error: " + e.message, "error");
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
  const toKey  = d => new Intl.DateTimeFormat("en-CA", {
    timeZone: appointmentTimeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);

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
    const date  = start.toLocaleDateString(undefined, {
      timeZone: appointmentTimeZone, weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    const time  = start.toLocaleTimeString(undefined, {
      timeZone: appointmentTimeZone, hour: "numeric", minute: "2-digit"
    }) + " – " + end.toLocaleTimeString(undefined, {
      timeZone: appointmentTimeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short"
    });
    return `
      <div class="appt-card">
        <div class="appt-info">
          <div class="appt-name">${escapeHtml(ev.name || "Appointment")}</div>
          <div class="appt-meta"><i class="bi bi-calendar3"></i>${escapeHtml(date)}</div>
          <div class="appt-meta"><i class="bi bi-clock"></i>${escapeHtml(time)}</div>
        </div>
        <div class="appt-actions">
          ${ev.meetUrl ? `<a href="${escapeHtml(ev.meetUrl)}" target="_blank" rel="noopener noreferrer"
            style="font-size:12px;padding:6px 14px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border-radius:8px;background:#0f9d58;color:white;font-weight:700;">
            <i class="bi bi-camera-video-fill"></i> Join Google Meet</a>` : ""}
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
