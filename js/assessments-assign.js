// Provider: Assign assessments to clients, set frequency, manage active assignments

let _aaClients     = [];
let _aaAssessments = [];
let _aaSelected    = null; // selected clientId

async function initAssessmentsAssignSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const [libRes, clientsRes] = await Promise.all([
      apiCall("getAssessmentLibrary", {}),
      apiCall("getProviderClients", {})
    ]);
    _aaAssessments = libRes.assessments    || [];
    _aaClients     = (clientsRes.clients   || []).filter(c => c.active);
    _aaSelected    = null;
    renderAssessmentsAssign(root);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderAssessmentsAssign(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-person-check-fill"></i> Assign Assessments</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Select a client, choose assessments, and set how often to repeat.
      </p>
    </div>

    <!-- Step 1: pick client -->
    <div class="card">
      <h2 style="margin-bottom:14px;"><span style="color:var(--primary);">1</span> — Select Client</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px;" id="aa-client-picker">
        ${_aaClients.length
          ? _aaClients.map(c => clientPickerBtn(c)).join("")
          : `<p style="color:var(--muted);font-size:13px;margin:0;">No active clients found.</p>`}
      </div>
    </div>

    <!-- Step 2: assign (hidden until client selected) -->
    <div class="card" id="aa-assign-card" style="display:none;">
      <h2 style="margin-bottom:4px;"><span style="color:var(--primary);">2</span> — Choose Assessments</h2>
      <p id="aa-client-label" style="color:var(--muted);font-size:13px;margin:0 0 14px;"></p>

      ${_aaAssessments.length === 0
        ? `<p style="color:var(--muted);font-size:13px;">No assessments in library yet — add some in Assessment Library first.</p>`
        : `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;" id="aa-assessment-picker">
            ${_aaAssessments.map(a => assessmentPickerBtn(a)).join("")}
          </div>

          <div class="row" style="max-width:320px;">
            <label>Frequency</label>
            <select id="aa-frequency" onchange="aaToggleCustomFreq()">
              <option value="once">One time only</option>
              <option value="per_session">Every session</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Every N days…</option>
            </select>
          </div>
          <div id="aa-custom-freq" style="display:none;" class="row">
            <label>Every how many days?</label>
            <input id="aa-freq-days" type="number" min="1" max="365" value="14" style="max-width:120px;">
          </div>
          <div id="aa-assign-status" style="margin:8px 0;"></div>
          <button onclick="assignSelectedAssessments()">
            <i class="bi bi-send-fill"></i> Assign to Client
          </button>`}
    </div>

    <!-- Step 3: current assignments for selected client -->
    <div class="card" id="aa-current-card" style="display:none;">
      <h2 style="margin-bottom:14px;"><i class="bi bi-list-check"></i> Current Assignments</h2>
      <div id="aa-current-list"></div>
    </div>`;
}

function clientPickerBtn(c) {
  const initials = (c.name || c.clientId || "?").split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 2);
  return `
    <button class="secondary" id="aa-client-btn-${escapeAttr(c.clientId)}"
            onclick="aaSelectClient('${escapeAttr(c.clientId)}', '${escapeAttr(c.name || c.clientId)}')"
            style="display:flex;flex-direction:column;align-items:center;gap:6px;
                   padding:12px 16px;min-width:80px;border-radius:10px;">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;
                  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">
        ${escapeHtml(initials)}
      </div>
      <span style="font-size:12px;font-weight:600;">${escapeHtml(c.name || c.clientId)}</span>
    </button>`;
}

function assessmentPickerBtn(a) {
  return `
    <button class="secondary" id="aa-asmnt-btn-${escapeAttr(a.assessmentId)}"
            onclick="aaToggleAssessment('${escapeAttr(a.assessmentId)}')"
            style="border-radius:8px;padding:8px 14px;font-size:13px;text-align:left;">
      <div style="font-weight:700;">${escapeHtml(a.shortName || a.name)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px;">${escapeHtml(a.target || "")}</div>
    </button>`;
}

function aaSelectClient(clientId, name) {
  _aaSelected = clientId;

  // Highlight selected client button
  document.querySelectorAll("#aa-client-picker button").forEach(btn => {
    btn.style.background   = "";
    btn.style.color        = "";
    btn.style.borderColor  = "";
  });
  const btn = document.getElementById("aa-client-btn-" + clientId);
  if (btn) {
    btn.style.background  = "var(--primary)";
    btn.style.color       = "#fff";
    btn.style.borderColor = "var(--primary)";
  }

  // Show assign card
  const card  = document.getElementById("aa-assign-card");
  const label = document.getElementById("aa-client-label");
  if (card)  card.style.display  = "";
  if (label) label.textContent   = `Assigning to: ${name}`;

  // Reset assessment selections
  document.querySelectorAll("[id^='aa-asmnt-btn-']").forEach(b => {
    b.style.background  = "";
    b.style.color       = "";
    b.style.borderColor = "";
    b.dataset.selected  = "false";
  });
  if (document.getElementById("aa-assign-status"))
    document.getElementById("aa-assign-status").innerHTML = "";

  // Load current assignments
  loadClientAssignments(clientId);
}

function aaToggleAssessment(assessmentId) {
  const btn = document.getElementById("aa-asmnt-btn-" + assessmentId);
  if (!btn) return;
  const selected = btn.dataset.selected === "true";
  btn.dataset.selected = selected ? "false" : "true";
  btn.style.background  = selected ? "" : "var(--primary)";
  btn.style.color       = selected ? "" : "#fff";
  btn.style.borderColor = selected ? "" : "var(--primary)";
}

function aaToggleCustomFreq() {
  const freq = ((document.getElementById("aa-frequency") || {}).value || "");
  const div  = document.getElementById("aa-custom-freq");
  if (div) div.style.display = freq === "custom" ? "" : "none";
}

async function assignSelectedAssessments() {
  if (!_aaSelected) { setStatus("aa-assign-status", "Select a client first.", "error"); return; }

  const selected = Array.from(document.querySelectorAll("[id^='aa-asmnt-btn-'][data-selected='true']"))
    .map(b => b.id.replace("aa-asmnt-btn-", ""));

  if (!selected.length) { setStatus("aa-assign-status", "Select at least one assessment.", "error"); return; }

  const frequency = ((document.getElementById("aa-frequency") || {}).value || "once");
  const freqDays  = parseInt(((document.getElementById("aa-freq-days") || {}).value || 0), 10);

  setStatus("aa-assign-status", `Assigning ${selected.length} assessment${selected.length !== 1 ? "s" : ""}…`, "loading");
  try {
    await Promise.all(selected.map(assessmentId =>
      apiCall("assignAssessment", { clientId: _aaSelected, assessmentId, frequency, frequencyDays: freqDays })
    ));
    setStatus("aa-assign-status", `${selected.length} assessment${selected.length !== 1 ? "s" : ""} assigned.`, "success");

    // Reset selection
    document.querySelectorAll("[id^='aa-asmnt-btn-']").forEach(b => {
      b.dataset.selected = "false";
      b.style.background = b.style.color = b.style.borderColor = "";
    });

    loadClientAssignments(_aaSelected);
  } catch (e) {
    setStatus("aa-assign-status", "Error: " + e.message, "error");
  }
}

async function loadClientAssignments(clientId) {
  const card = document.getElementById("aa-current-card");
  const list = document.getElementById("aa-current-list");
  if (!card || !list) return;
  card.style.display = "";
  list.innerHTML = `<p style="color:var(--muted);font-size:13px;">Loading…</p>`;
  try {
    const res         = await apiCall("getClientAssignments", { clientId });
    const assignments = res.assignments || [];
    if (!assignments.length) {
      list.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:0;">No assessments assigned yet.</p>`;
      return;
    }
    list.innerHTML = assignments.map(a => assignmentRowHtml(a)).join("");
  } catch (e) {
    list.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${escapeHtml(e.message)}</p>`;
  }
}

function assignmentRowHtml(a) {
  const freqLabel = { once: "One time", per_session: "Every session", weekly: "Weekly", monthly: "Monthly" };
  const freq = freqLabel[a.frequency] || (a.frequencyDays ? `Every ${a.frequencyDays} days` : a.frequency);
  const due  = a.nextDue
    ? new Date(a.nextDue).toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" })
    : "—";
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;
                padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px;">
      <div>
        <div style="font-weight:600;font-size:13px;">${escapeHtml(a.name || a.shortName || a.assessmentId)}</div>
        <div style="font-size:11px;color:var(--muted);">${escapeHtml(freq)} · Next due: ${escapeHtml(due)}</div>
      </div>
      <button class="secondary" style="font-size:11px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;"
              onclick="removeClientAssignment('${escapeAttr(a.assignmentId)}', this)">
        <i class="bi bi-x-circle-fill"></i> Remove
      </button>
    </div>`;
}

async function removeClientAssignment(assignmentId, btn) {
  if (!confirm("Remove this assessment assignment?")) return;
  if (btn) btn.disabled = true;
  try {
    await apiCall("removeAssignment", { assignmentId });
    loadClientAssignments(_aaSelected);
  } catch (e) {
    alert("Error: " + e.message);
    if (btn) btn.disabled = false;
  }
}
