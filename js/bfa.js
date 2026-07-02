// Behavioral Function Assessment section — standalone (not tied to Programs).
// Both parent and provider can submit; both can view past results.
// Backend stores submissions in data_assessments on the Programs sheet.
//
// bfaToggle() and bfaCalculate() are defined here as globals so they work
// whether the form is loaded via fetch (Assessments section) or injected as
// a Programs activity — no inline <script> re-execution required.

const BFA_QUESTIONS = [
  { fn: "att", label: "Attention", cls: "att", items: [
    "Does the behavior occur when you stop giving your child attention?",
    "Does it occur when you are talking to someone else or busy with another task?",
    "Does it stop or decrease when you give your child attention?",
    "Does your child seem to enjoy or look for others' reactions when the behavior occurs?",
    "Does it occur more often when you are distracted and less focused on your child?"
  ]},
  { fn: "esc", label: "Escape", cls: "esc", items: [
    "Does the behavior occur when your child is asked to do something difficult or non-preferred?",
    "Does it occur during tasks or activities your child dislikes?",
    "Does it stop or decrease when you remove the demand or end the task?",
    "Does the behavior allow your child to avoid or delay completing tasks?",
    "Does it occur most at the start of non-preferred activities?"
  ]},
  { fn: "tan", label: "Tangible", cls: "tan", items: [
    "Does the behavior occur when a preferred item or activity is taken away?",
    "Does it occur when your child is told they cannot have or do something they want?",
    "Does it stop or decrease when you give your child what they were seeking?",
    "Does it occur when your child can see but cannot access a preferred item or activity?",
    "Does your child calm down once they get the item or activity they were seeking?"
  ]},
  { fn: "aut", label: "Automatic / Sensory", cls: "aut", items: [
    "Does the behavior occur even when your child is alone?",
    "Does it occur even when no one is watching or paying attention?",
    "Does it seem to happen regardless of what is going on in the environment?",
    "Does it occur during calm, quiet, low-demand situations with no obvious trigger?",
    "Does your child seem unaware of or unaffected by others' reactions when it occurs?"
  ]}
];

const BFA_SCALE = [["0","Never"],["1","Monthly"],["2","Weekly"],["3","Daily"],["4","Frequently"]];

function bfaBuildPart2(key, label) {
  let qNum = 0;
  let html = `<div class="bfa-p2-behavior" id="bfa-p2-${key}">`;
  html += `<div class="bfa-p2-behavior-head"><i class="bi bi-question-circle-fill"></i> ${escapeHtml(label)} — Function Assessment</div>`;
  html += `<p style="font-size:13px;color:var(--muted);margin:4px 0 16px;">Answer thinking about <strong>${escapeHtml(label)}</strong> specifically. &nbsp; 0 = Never · 1 = Monthly · 2 = Weekly · 3 = Daily · 4 = Frequently</p>`;
  BFA_QUESTIONS.forEach(group => {
    html += `<div class="bfa-fn-head ${group.cls}">${group.label}</div>`;
    group.items.forEach((q, i) => {
      qNum++;
      const name = `${key}_${group.fn}_${i + 1}`;
      html += `<div class="bfa-item"><div class="bfa-item-q">${qNum}. ${escapeHtml(q)}</div><div class="bfa-likert">`;
      BFA_SCALE.forEach(([val, lbl]) => {
        html += `<label><input type="radio" name="${name}" value="${val}"><span class="bfa-btn">${val}<br>${lbl}</span></label>`;
      });
      html += `</div></div>`;
    });
  });
  html += `</div>`;
  return html;
}

function bfaToggle(cb) {
  const key   = cb.dataset.key;
  const label = cb.dataset.label;
  const row   = document.getElementById("brow_" + key);
  if (row) row.classList.toggle("inactive", !cb.checked);

  const container = document.getElementById("bfa-p2-container");
  const existing  = document.getElementById("bfa-p2-" + key);
  if (cb.checked) {
    if (!existing) {
      const div = document.createElement("div");
      div.innerHTML = bfaBuildPart2(key, label);
      container.appendChild(div.firstElementChild);
    } else {
      existing.style.display = "";
    }
  } else {
    if (existing) existing.style.display = "none";
  }
}

function bfaCalculate() {
  const FN_COLORS = { att: "#6366f1", esc: "#d97706", tan: "#059669", aut: "#db2777" };
  const checked = Array.from(document.querySelectorAll(".bfa-cb:checked"));

  if (checked.length === 0) {
    alert("Please check at least one behavior in Part 1 before calculating scores.");
    return;
  }

  const scores  = {};
  let missing   = 0;

  checked.forEach(cb => {
    const key     = cb.dataset.key;
    const label   = cb.dataset.label;
    const section = document.getElementById("bfa-p2-" + key);
    if (!section || section.style.display === "none") return;

    const fnScores = {};
    BFA_QUESTIONS.forEach(group => {
      let sum = 0;
      for (let i = 1; i <= 5; i++) {
        const el = section.querySelector(`input[name="${key}_${group.fn}_${i}"]:checked`);
        if (!el) { missing++; return; }
        sum += parseInt(el.value);
      }
      fnScores[group.fn] = sum;
    });
    scores[key] = { _label: label, scores: fnScores };
  });

  if (missing > 0) {
    alert(`Please answer all questions for every checked behavior before calculating scores. (${missing} unanswered)`);
    return;
  }

  let html = `<h3 style="margin:0 0 20px;">Function Score Summary</h3>`;
  Object.values(scores).forEach(entry => {
    const label    = entry._label;
    const fnScores = entry.scores;
    const sorted   = BFA_QUESTIONS
      .map(g => ({ fn: g.fn, label: g.label, score: fnScores[g.fn] || 0 }))
      .sort((a, b) => b.score - a.score);
    const topFn = sorted[0];

    html += `<div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border);">`;
    html += `<div style="font-weight:700;font-size:15px;margin-bottom:12px;">${escapeHtml(label)}</div>`;
    sorted.forEach(item => {
      const pct   = Math.round((item.score / 20) * 100);
      const isTop = item.fn === topFn.fn && item.score >= 8;
      const isSig = item.score >= 8 && item.fn !== topFn.fn;
      const badge = isTop ? ` <span style="font-size:11px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;font-weight:700;">Primary</span>`
                  : isSig ? ` <span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;font-weight:700;">Significant</span>` : "";
      html += `<div style="margin-bottom:10px;">
        <div style="font-size:13px;font-weight:600;display:flex;justify-content:space-between;margin-bottom:3px;">
          <span>${escapeHtml(item.label)}${badge}</span><span>${item.score}/20</span>
        </div>
        <div style="background:#f0f1f5;border-radius:4px;height:22px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${FN_COLORS[item.fn]};border-radius:4px;min-width:${pct > 0 ? "22px" : "0"};display:flex;align-items:center;padding-left:6px;color:white;font-size:12px;font-weight:700;">${pct > 15 ? item.score : ""}</div>
        </div>
      </div>`;
    });
    if (topFn.score < 8) {
      html += `<p style="font-size:12px;color:var(--muted);margin:6px 0 0;">No subscale reached the significant threshold (≥8) for this behavior.</p>`;
    }
    html += `</div>`;
  });

  html += `<p style="font-size:13px;color:var(--muted);margin-top:8px;">Score ≥ 8 on any subscale suggests a clinically significant maintaining function. Submit the form below to save your responses and scores.</p>`;

  const resultsEl = document.getElementById("bfa-results");
  resultsEl.style.display = "block";
  resultsEl.innerHTML = html;
  resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const toSave = {};
  Object.entries(scores).forEach(([k, v]) => { toSave[k] = { label: v._label, scores: v.scores }; });
  const hidden = document.getElementById("bfa-scores-hidden");
  if (hidden) hidden.value = JSON.stringify(toSave);
}

let bfaSubmissions = [];
let bfaFormOpen = false;

function initBfaSection(root) {
  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-clipboard2-check-fill"></i>Behavioral Function Assessment</h1>
      <p style="color:var(--muted);font-size:14px;margin:0 0 20px;line-height:1.6;">
        This assessment identifies behaviors of concern and helps determine the function
        maintaining each behavior. Complete one assessment per concern period —
        re-administer every 6 months or when a new behavior emerges.
      </p>
      <button onclick="bfaOpenForm()"><i class="bi bi-plus-circle-fill"></i> New Assessment</button>
    </div>
    <div id="bfa-form-area"></div>
    <div id="bfa-status"></div>
    <div id="bfa-history-area">
      <div class="card"><p style="color:var(--muted);font-size:14px;">Loading past assessments…</p></div>
    </div>
  `;
  loadBfaHistory();
}

async function loadBfaHistory() {
  try {
    const { assessments } = await apiCall("getAssessments", { type: "BFA" });
    bfaSubmissions = assessments || [];
    renderBfaHistory();
  } catch (e) {
    document.getElementById("bfa-history-area").innerHTML =
      `<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load history: ${escapeHtml(e.message)}</span></div>`;
  }
}

function renderBfaHistory() {
  const el = document.getElementById("bfa-history-area");
  if (!bfaSubmissions.length) {
    el.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">No assessments on file yet. Click <strong>New Assessment</strong> above to get started.</p></div>`;
    return;
  }

  el.innerHTML = bfaSubmissions.map((a, i) => {
    const date = new Date(a.completedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    let scoreHtml = "";
    try {
      const scores = JSON.parse(a.responseJson).bfa_scores_json;
      if (scores) scoreHtml = renderBfaScores(scores);
    } catch (_) {}

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:${scoreHtml ? "16px" : "0"};">
          <div>
            <div style="font-weight:700;font-size:15px;">Assessment ${bfaSubmissions.length - i}</div>
            <div style="font-size:13px;color:var(--muted);margin-top:2px;">
              <i class="bi bi-calendar3"></i> ${escapeHtml(date)}
              &nbsp;·&nbsp; <i class="bi bi-person-fill"></i> ${escapeHtml(a.administeredBy || "—")}
            </div>
          </div>
          <button class="secondary" style="font-size:12px;padding:6px 12px;" onclick="window.print()">
            <i class="bi bi-printer-fill"></i> Print
          </button>
        </div>
        ${scoreHtml}
      </div>`;
  }).join("");
}

function bfaOpenForm() {
  if (bfaFormOpen) return;
  bfaFormOpen = true;

  // Load the BFA HTML from the assets file and inject it
  fetch("assets/activities/behavioral-function-assessment.html")
    .then(r => r.text())
    .then(html => {
      const area = document.getElementById("bfa-form-area");
      area.innerHTML = `
        <div class="card" id="bfa-form-card">
          <h2><i class="bi bi-pencil-fill"></i>New Assessment</h2>
          <div class="activity-body">${html}</div>
          <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap;">
            <button onclick="bfaSubmit()"><i class="bi bi-save-fill"></i> Save Assessment</button>
            <button class="secondary" onclick="bfaCloseForm()"><i class="bi bi-x-lg"></i> Cancel</button>
          </div>
          <div id="bfa-submit-status" style="margin-top:10px;"></div>
        </div>
      `;
      area.scrollIntoView({ behavior: "smooth", block: "start" });
    })
    .catch(e => {
      setStatus("bfa-status", "Could not load assessment form: " + e.message, "error");
      bfaFormOpen = false;
    });
}

async function bfaSubmit() {
  const responseData = {};
  document.querySelectorAll("#bfa-form-card .activity-body [name]").forEach(el => {
    if (el.type === "radio" || el.type === "checkbox") {
      if (el.checked) responseData[el.name] = el.value;
    } else {
      responseData[el.name] = el.value;
    }
  });

  if (!responseData.bfa_scores_json) {
    setStatus("bfa-submit-status", "Please complete Part 2 and click Calculate Scores before saving.", "error");
    return;
  }

  setStatus("bfa-submit-status", "Saving…", "loading");
  try {
    await apiCall("submitAssessment", {
      type: "BFA",
      responseJson: JSON.stringify(responseData)
    });
    bfaCloseForm();
    setStatus("bfa-status", "Assessment saved.", "");
    await loadBfaHistory();
  } catch (e) {
    setStatus("bfa-submit-status", "Error: " + e.message, "error");
  }
}

function bfaCloseForm() {
  bfaFormOpen = false;
  const area = document.getElementById("bfa-form-area");
  if (area) area.innerHTML = "";
}
