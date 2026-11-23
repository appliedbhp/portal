// Intake section — Pre-Coaching Questionnaire and Assessment & Intervention
// Validity Scale. Visible to all roles (client fills out questionnaire,
// validity scale filled after goals are reviewed).

function initIntakeSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading…</p></div>`;
  loadIntakeSection(root);
}

async function loadIntakeSection(root) {
  let existing = {};
  try {
    const { intake } = await apiCall("getIntakeData", {});
    existing = intake || {};
  } catch (_) {}
  renderIntakeSection(root, existing);
}

function renderIntakeSection(root, existing) {
  const pc = existing.precoach || {};
  const vl = existing.validity || {};
  const isProvider = getRole() === "provider";

  root.innerHTML = `
    <style>
      .intake-rating-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
      .intake-rating-row label { font-size:13px; flex:1; min-width:200px; line-height:1.4; }
      .intake-stars { display:flex; gap:6px; }
      .intake-star { width:36px; height:36px; border-radius:8px; border:1.5px solid var(--border);
                     background:#fff; font-size:17px; cursor:pointer; display:flex; align-items:center;
                     justify-content:center; transition:all .15s; }
      .intake-star:hover, .intake-star.selected { background:var(--primary); border-color:var(--primary);
                                                   color:#fff; transform:scale(1.08); }
    </style>

    <!-- Pre-Coaching Questionnaire -->
    <div class="card">
      <h1><i class="bi bi-clipboard2-pulse-fill"></i> Pre-Coaching Questionnaire</h1>
      <p style="color:var(--muted);font-size:13px;margin:0 0 20px;line-height:1.6;">
        These questions help your provider understand your starting point, what you're hoping for, and what's been most challenging.
        ${isProvider ? "" : "Your answers are saved privately and shared with your provider."}
      </p>

      <div class="row">
        <label>What do you expect when working with an executive function coach?</label>
        <textarea id="pc-expectations" rows="3" placeholder="What are you hoping to get out of this process?">${escapeHtml(pc.expectations || "")}</textarea>
      </div>
      <div class="row">
        <label>What would successful results look like to you?</label>
        <textarea id="pc-success" rows="3" placeholder="How would you know things were better?">${escapeHtml(pc.success_looks_like || "")}</textarea>
      </div>
      <div class="row">
        <label>What accomplishment(s) are you most proud of?</label>
        <textarea id="pc-proud" rows="3" placeholder="What's going well? What are you or your child good at?">${escapeHtml(pc.proud_of || "")}</textarea>
      </div>
      <div class="row">
        <label>When it comes to executive function, what are your biggest stressors?</label>
        <textarea id="pc-stressors" rows="3" placeholder="Daily routines, school, emotions, social situations…">${escapeHtml(pc.biggest_stressors || "")}</textarea>
      </div>
      <div class="row">
        <label>What three changes would you most like to make or three skills to learn?</label>
        <textarea id="pc-changes" rows="4" placeholder="List up to three things that would make the biggest difference.">${escapeHtml(pc.top_changes || "")}</textarea>
      </div>

      <div id="pc-status" style="margin-bottom:10px;"></div>
      <button onclick="savePrecoach()"><i class="bi bi-save-fill"></i> Save Questionnaire</button>
    </div>

    <!-- Validity Scale -->
    <div class="card">
      <h1><i class="bi bi-check2-square"></i> Assessment & Intervention Validity</h1>
      <p style="color:var(--muted);font-size:13px;margin:0 0 20px;line-height:1.6;">
        After reviewing the goals with your provider, please rate how much you agree with each statement below (1 = not at all, 5 = definitely).
        This helps ensure the plan is meaningful and worth your time.
      </p>

      ${ratingRow("vl-goals-matter",     "The goals we're working on matter in my real life.", vl.goals_matter)}
      ${ratingRow("vl-goals-now",        "These goals feel important right now in my life.",   vl.goals_important_now)}
      ${ratingRow("vl-meaningful",       "If I improve in these areas, it will make a meaningful difference.", vl.meaningful_difference)}

      <div class="row" style="margin-top:16px;">
        <label>What's the most important thing you'd like your provider to know about these goals?</label>
        <textarea id="vl-most-important" rows="3" placeholder="Any context, concerns, or priorities…">${escapeHtml(vl.most_important || "")}</textarea>
      </div>
      <div class="row">
        <label>What feels annoying, stressful, or not worth it?</label>
        <textarea id="vl-concerns" rows="3" placeholder="Be honest — this is a safe space to share what feels hard.">${escapeHtml(vl.concerns || "")}</textarea>
      </div>

      <div id="vl-status" style="margin-bottom:10px;"></div>
      <button onclick="saveValidity()"><i class="bi bi-save-fill"></i> Save Validity Ratings</button>
    </div>
  `;

  // Re-apply selected state from saved values
  [
    ["vl-goals-matter",  vl.goals_matter],
    ["vl-goals-now",     vl.goals_important_now],
    ["vl-meaningful",    vl.meaningful_difference]
  ].forEach(([id, val]) => {
    if (!val) return;
    const stars = document.querySelectorAll(`[data-group="${id}"]`);
    stars.forEach(s => s.classList.toggle("selected", s.dataset.val === String(val)));
  });
}

function ratingRow(id, label, savedVal) {
  const stars = [1,2,3,4,5].map(n =>
    `<div class="intake-star${savedVal == n ? " selected" : ""}"
         data-group="${id}" data-val="${n}"
         onclick="intakeSelectRating('${id}', ${n})">${n}</div>`
  ).join("");
  return `
    <div class="intake-rating-row">
      <label>${escapeHtml(label)}</label>
      <div class="intake-stars" id="${id}-stars">${stars}</div>
    </div>`;
}

function intakeSelectRating(groupId, val) {
  document.querySelectorAll(`[data-group="${groupId}"]`).forEach(s => {
    s.classList.toggle("selected", parseInt(s.dataset.val) === val);
  });
}

function getSelectedRating(groupId) {
  const sel = document.querySelector(`[data-group="${groupId}"].selected`);
  return sel ? parseInt(sel.dataset.val) : null;
}

async function savePrecoach() {
  const fields = {
    expectations:      document.getElementById("pc-expectations").value.trim(),
    success_looks_like: document.getElementById("pc-success").value.trim(),
    proud_of:          document.getElementById("pc-proud").value.trim(),
    biggest_stressors: document.getElementById("pc-stressors").value.trim(),
    top_changes:       document.getElementById("pc-changes").value.trim()
  };
  setStatus("pc-status", "Saving…", "loading");
  try {
    await apiCall("saveIntakeData", { intakeType: "precoach", fields });
    setStatus("pc-status", "Questionnaire saved.", "success");
  } catch (e) {
    setStatus("pc-status", "Error: " + e.message, "error");
  }
}

async function saveValidity() {
  const fields = {
    goals_matter:          getSelectedRating("vl-goals-matter"),
    goals_important_now:   getSelectedRating("vl-goals-now"),
    meaningful_difference: getSelectedRating("vl-meaningful"),
    most_important:        document.getElementById("vl-most-important").value.trim(),
    concerns:              document.getElementById("vl-concerns").value.trim()
  };
  if (!fields.goals_matter && !fields.goals_important_now && !fields.meaningful_difference) {
    setStatus("vl-status", "Please rate at least one statement.", "error");
    return;
  }
  setStatus("vl-status", "Saving…", "loading");
  try {
    await apiCall("saveIntakeData", { intakeType: "validity", fields });
    setStatus("vl-status", "Ratings saved.", "success");
  } catch (e) {
    setStatus("vl-status", "Error: " + e.message, "error");
  }
}
