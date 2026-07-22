// Provider: Assign assessments to clients, set frequency, manage active assignments

async function initAssessmentsAssignSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  try {
    const [libRes, clientsRes] = await Promise.all([
      apiCall("getAssessmentLibrary", {}),
      apiCall("getClients", {}).catch(() => ({ clients: [] }))
    ]);
    renderAssessmentsAssign(root, libRes.assessments || [], clientsRes.clients || []);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderAssessmentsAssign(root, assessments, clients) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-person-check-fill"></i> Assign Assessments</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Select a client, choose assessments from your library, and set how often to repeat.
      </p>
    </div>

    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i> New Assignment</h2>
      <div class="row" style="max-width:400px;">
        <label>Client</label>
        <select id="aa-client" onchange="loadClientAssignments()">
          <option value="">— select client —</option>
          ${clients.map(c => `<option value="${escapeAttr(c.clientId)}">${escapeHtml(c.name || c.clientId)}</option>`).join("")}
        </select>
      </div>
      <div class="row" style="max-width:480px;">
        <label>Assessment</label>
        <select id="aa-assessment">
          <option value="">— select assessment —</option>
          ${assessments.map(a => `<option value="${escapeAttr(a.assessmentId)}">${escapeHtml(a.name)}${a.shortName ? " (" + a.shortName + ")" : ""}</option>`).join("")}
        </select>
      </div>
      <div class="row" style="max-width:320px;">
        <label>Frequency</label>
        <select id="aa-frequency" onchange="toggleCustomFreq()">
          <option value="once">One time only</option>
          <option value="per_session">Every session</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Every N days…</option>
        </select>
      </div>
      <div id="aa-custom-freq" style="display:none;" class="row" style="max-width:220px;">
        <label>Every how many days?</label>
        <input id="aa-freq-days" type="number" min="1" max="365" value="14" style="max-width:120px;">
      </div>
      <div id="aa-assign-status" style="margin:8px 0;"></div>
      <button onclick="assignAssessmentToClient()">
        <i class="bi bi-send-fill"></i> Assign to Client
      </button>
    </div>

    <div class="card" id="aa-current-card" style="display:none;">
      <h2><i class="bi bi-list-check"></i> Current Assignments</h2>
      <div id="aa-current-list"></div>
    </div>`;
}

function toggleCustomFreq() {
  const freq = ((document.getElementById("aa-frequency") || {}).value || "");
  const div  = document.getElementById("aa-custom-freq");
  if (div) div.style.display = freq === "custom" ? "" : "none";
}

async function loadClientAssignments() {
  const clientId = ((document.getElementById("aa-client") || {}).value || "").trim();
  const card     = document.getElementById("aa-current-card");
  const list     = document.getElementById("aa-current-list");
  if (!clientId || !card || !list) return;
  card.style.display = "";
  list.innerHTML = `<p style="color:var(--muted);font-size:13px;">Loading…</p>`;
  try {
    const res = await apiCall("getClientAssignments", { clientId });
    const assignments = res.assignments || [];
    if (!assignments.length) {
      list.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:0;">No assessments assigned to this client yet.</p>`;
      return;
    }
    list.innerHTML = assignments.map(a => assignmentRowHtml(a)).join("");
  } catch (e) {
    list.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${escapeHtml(e.message)}</p>`;
  }
}

function assignmentRowHtml(a) {
  const freqLabel = { once: "One time", per_session: "Every session", weekly: "Weekly", monthly: "Monthly" };
  const freq      = freqLabel[a.frequency] || (a.frequencyDays ? `Every ${a.frequencyDays} days` : a.frequency);
  const due       = a.nextDue ? new Date(a.nextDue).toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" }) : "—";
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;
                padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px;">
      <div>
        <div style="font-weight:600;font-size:13px;">${escapeHtml(a.name || a.assessmentId)}</div>
        <div style="font-size:11px;color:var(--muted);">${escapeHtml(freq)} · Next due: ${escapeHtml(due)}</div>
      </div>
      <button class="secondary" style="font-size:11px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;"
              onclick="removeClientAssignment('${escapeAttr(a.assignmentId)}', this)">
        <i class="bi bi-x-circle-fill"></i> Remove
      </button>
    </div>`;
}

async function assignAssessmentToClient() {
  const clientId     = ((document.getElementById("aa-client")     || {}).value || "").trim();
  const assessmentId = ((document.getElementById("aa-assessment")  || {}).value || "").trim();
  const frequency    = ((document.getElementById("aa-frequency")   || {}).value || "once");
  const freqDays     = parseInt(((document.getElementById("aa-freq-days") || {}).value || 0), 10);
  if (!clientId)     { setStatus("aa-assign-status", "Select a client.", "error"); return; }
  if (!assessmentId) { setStatus("aa-assign-status", "Select an assessment.", "error"); return; }
  setStatus("aa-assign-status", "Assigning…", "loading");
  try {
    await apiCall("assignAssessment", { clientId, assessmentId, frequency, frequencyDays: freqDays });
    setStatus("aa-assign-status", "Assigned! The client will see it next time they log in.", "success");
    loadClientAssignments();
  } catch (e) {
    setStatus("aa-assign-status", "Error: " + e.message, "error");
  }
}

async function removeClientAssignment(assignmentId, btn) {
  if (!confirm("Remove this assessment assignment?")) return;
  if (btn) btn.disabled = true;
  try {
    await apiCall("removeAssignment", { assignmentId });
    loadClientAssignments();
  } catch (e) {
    alert("Error: " + e.message);
    if (btn) btn.disabled = false;
  }
}
