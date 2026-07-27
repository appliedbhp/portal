// Grades section — academic grade tracking with GPA, schedule memory, and AI transcript extraction.

const GRADE_SCALE = [
  { label: "A+", points: 4.0, bg: "#059669", fg: "#fff" },
  { label: "A",  points: 4.0, bg: "#10b981", fg: "#fff" },
  { label: "A-", points: 3.7, bg: "#34d399", fg: "#fff" },
  { label: "B+", points: 3.3, bg: "#84cc16", fg: "#fff" },
  { label: "B",  points: 3.0, bg: "#a3e635", fg: "#374151" },
  { label: "B-", points: 2.7, bg: "#bef264", fg: "#374151" },
  { label: "C+", points: 2.3, bg: "#fbbf24", fg: "#fff" },
  { label: "C",  points: 2.0, bg: "#f59e0b", fg: "#fff" },
  { label: "C-", points: 1.7, bg: "#f97316", fg: "#fff" },
  { label: "D+", points: 1.3, bg: "#ef4444", fg: "#fff" },
  { label: "D",  points: 1.0, bg: "#dc2626", fg: "#fff" },
  { label: "D-", points: 0.7, bg: "#b91c1c", fg: "#fff" },
  { label: "F",  points: 0.0, bg: "#7f1d1d", fg: "#fff" }
];

const GRADES_MAX_CLASSES = 10;

let gradeRows    = [];  // [{className, grade, credits, citizenship}]
let gradeTerm    = "";
let gradeHistory = [];
let gradeSchedule = [];
let _gradesPasteOpen = false;

function _gradePoints(label) {
  const g = GRADE_SCALE.find(g => g.label === label);
  return g ? g.points : null;
}

function _gradeStyle(label) {
  return GRADE_SCALE.find(g => g.label === label) || { bg: "#e5e7eb", fg: "#374151" };
}

function _calcGpa(rows) {
  const valid = rows.filter(r => r.grade && r.className && r.className.trim());
  if (!valid.length) return null;
  const totalCredits = valid.reduce((s, r) => s + (parseFloat(r.credits) || 1), 0);
  const totalPoints  = valid.reduce((s, r) => s + (_gradePoints(r.grade) || 0) * (parseFloat(r.credits) || 1), 0);
  return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : null;
}

function _gpaColor(g) {
  g = parseFloat(g);
  if (g >= 3.7) return "#059669";
  if (g >= 3.0) return "#84cc16";
  if (g >= 2.0) return "#f59e0b";
  if (g >= 1.0) return "#f97316";
  return "#dc2626";
}

function initGradesSection(root) {
  root.innerHTML = `<div id="grades-status"></div><div id="grades-content"></div>`;
  setStatus("grades-status", "Loading grades…", "loading");
  _loadGrades();
}

async function _loadGrades() {
  try {
    const res = await apiCall("getGrades", {});
    gradeHistory  = res.entries  || [];
    gradeSchedule = res.schedule || [];
    gradeRows = Array.from({ length: GRADES_MAX_CLASSES }, (_, i) => {
      const s = gradeSchedule[i] || {};
      return { className: s.className || "", grade: "", credits: String(s.credits || "1"), citizenship: "" };
    });
    setStatus("grades-status", "", "");
    _renderGrades();
  } catch (e) {
    setStatus("grades-status", "Error loading grades: " + e.message, "error");
  }
}

function _renderGrades() {
  const el = document.getElementById("grades-content");
  if (!el) return;
  const gpa = _calcGpa(gradeRows);
  el.innerHTML = `
    <style>
      .grade-btn {
        width: 32px; height: 32px; border-radius: 50%;
        border: 2px solid var(--border);
        background: transparent; color: #374151;
        font-size: 9px; font-weight: 700;
        padding: 0; cursor: pointer; flex-shrink: 0;
        transition: transform .1s, box-shadow .1s;
        line-height: 1;
      }
      .grade-btn:hover { transform: scale(1.15); box-shadow: 0 2px 8px rgba(0,0,0,.15); }
      .grade-btn.sel { box-shadow: 0 0 0 3px rgba(0,0,0,.15); }
      .grades-table td, .grades-table th { padding: 6px 6px; }
      @media(max-width:600px) {
        .grade-btn { width: 26px; height: 26px; font-size: 8px; }
      }
    </style>

    <div class="card">
      <h1><i class="bi bi-mortarboard-fill"></i> Grades</h1>
      <p style="font-size:13px;color:var(--muted);margin:0 0 18px;line-height:1.6;">
        Enter up to ${GRADES_MAX_CLASSES} classes. Class names are remembered for next time. GPA is weighted by credits.
      </p>

      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:13px;font-weight:600;margin:0;color:var(--text);text-transform:none;letter-spacing:normal;white-space:nowrap;">Term / Semester</label>
          <input id="grades-term" type="text" value="${escapeHtml(gradeTerm)}" placeholder="e.g. Fall 2024"
            style="width:160px;font-size:13px;" oninput="gradeTerm=this.value">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;">
          <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:6px;
                        border:1.5px solid var(--border);cursor:pointer;font-size:12px;font-weight:600;
                        background:var(--bg);color:var(--text);text-transform:none;letter-spacing:normal;margin:0;">
            <i class="bi bi-upload"></i> Upload Transcript
            <input type="file" id="grades-upload" accept="image/*" style="display:none;" onchange="gradesHandleUpload(this)">
          </label>
          <button class="secondary" style="font-size:12px;" onclick="gradesTogglePaste()">
            <i class="bi bi-clipboard-fill"></i> Paste Text
          </button>
        </div>
      </div>

      <div id="grades-paste-area" style="display:${_gradesPasteOpen ? 'block' : 'none'};margin-bottom:12px;">
        <textarea id="grades-paste-text" rows="5" placeholder="Paste transcript text here…" style="width:100%;font-size:13px;"></textarea>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button style="font-size:12px;" onclick="gradesExtractFromText()"><i class="bi bi-stars"></i> Extract Grades</button>
          <button class="secondary" style="font-size:12px;" onclick="gradesTogglePaste()">Cancel</button>
        </div>
      </div>
      <div id="grades-extract-status" style="margin-bottom:10px;"></div>

      <div id="grades-rows-area">${_renderRowsTable()}</div>

      <div style="display:flex;align-items:center;gap:16px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);flex-wrap:wrap;">
        <div id="grades-gpa-live" style="font-size:26px;font-weight:800;min-width:100px;">
          ${_renderGpaLive(gpa)}
        </div>
        <button onclick="gradesSave()"><i class="bi bi-save-fill"></i> Save Grades</button>
        <div id="grades-save-status" style="font-size:13px;"></div>
      </div>
    </div>

    <div id="grades-comparison-area">
      ${_renderComparison()}
    </div>

    <div id="grades-history-area">
      ${_renderHistory()}
    </div>
  `;
}

function _renderGpaLive(gpa) {
  if (!gpa) return `<span style="font-size:14px;color:var(--muted);">GPA: —</span>`;
  return `<span style="color:${_gpaColor(gpa)};">GPA: ${gpa}</span>`;
}

function _renderRowsTable() {
  const rows = gradeRows.map((row, i) => _renderOneRow(row, i)).join("");
  return `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <table class="grades-table" style="width:100%;border-collapse:collapse;min-width:620px;">
        <thead>
          <tr style="border-bottom:2px solid var(--border);">
            <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:4px 6px;">#</th>
            <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:4px 6px;">Class</th>
            <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:4px 6px;">Grade</th>
            <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:center;padding:4px 6px;width:64px;">Credits</th>
            <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:center;padding:4px 6px;width:90px;">Citizenship</th>
          </tr>
        </thead>
        <tbody id="grades-tbody">${rows}</tbody>
      </table>
    </div>`;
}

function _renderOneRow(row, i) {
  const btns = GRADE_SCALE.map(g => {
    const sel = row.grade === g.label;
    return `<button class="grade-btn${sel ? ' sel' : ''}"
      onclick="gradesSetGrade(${i},'${g.label}')"
      title="${g.label}"
      style="border-color:${sel ? g.bg : 'var(--border)'};background:${sel ? g.bg : 'transparent'};color:${sel ? g.fg : '#374151'};"
    >${g.label}</button>`;
  }).join("");

  return `<tr data-row="${i}" style="border-bottom:1px solid var(--border);">
    <td style="font-size:12px;color:var(--muted);padding:6px;text-align:center;width:24px;">${i + 1}</td>
    <td style="padding:6px;">
      <input type="text" value="${escapeHtml(row.className)}" placeholder="Class name…"
        style="width:100%;font-size:13px;min-width:130px;"
        oninput="gradeRows[${i}].className=this.value;gradesUpdateGpa()">
    </td>
    <td style="padding:6px;">
      <div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;">${btns}</div>
    </td>
    <td style="padding:6px;text-align:center;">
      <input type="number" value="${escapeHtml(String(row.credits))}" min="0.5" max="8" step="0.5"
        style="width:54px;font-size:13px;text-align:center;"
        oninput="gradeRows[${i}].credits=this.value;gradesUpdateGpa()">
    </td>
    <td style="padding:6px;text-align:center;">
      <input type="text" value="${escapeHtml(row.citizenship)}" placeholder="—" maxlength="2"
        title="Citizenship / conduct letter grade"
        style="width:44px;font-size:13px;text-align:center;text-transform:uppercase;"
        oninput="gradeRows[${i}].citizenship=this.value.toUpperCase()">
    </td>
  </tr>`;
}

function gradesSetGrade(idx, grade) {
  gradeRows[idx].grade = gradeRows[idx].grade === grade ? "" : grade;
  // Patch just the grade cell to avoid resetting text inputs
  const tbody = document.getElementById("grades-tbody");
  if (!tbody) return;
  const tr = tbody.querySelector(`tr[data-row="${idx}"]`);
  if (tr) {
    const gradeCell = tr.cells[2];
    const btns = GRADE_SCALE.map(g => {
      const sel = gradeRows[idx].grade === g.label;
      return `<button class="grade-btn${sel ? ' sel' : ''}"
        onclick="gradesSetGrade(${idx},'${g.label}')"
        title="${g.label}"
        style="border-color:${sel ? g.bg : 'var(--border)'};background:${sel ? g.bg : 'transparent'};color:${sel ? g.fg : '#374151'};"
      >${g.label}</button>`;
    }).join("");
    gradeCell.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;">${btns}</div>`;
  }
  gradesUpdateGpa();
}

function gradesUpdateGpa() {
  const el = document.getElementById("grades-gpa-live");
  if (el) el.innerHTML = _renderGpaLive(_calcGpa(gradeRows));
}

function gradesTogglePaste() {
  _gradesPasteOpen = !_gradesPasteOpen;
  const area = document.getElementById("grades-paste-area");
  if (area) area.style.display = _gradesPasteOpen ? "block" : "none";
  if (_gradesPasteOpen) {
    const ta = document.getElementById("grades-paste-text");
    if (ta) ta.focus();
  }
}

async function gradesHandleUpload(input) {
  const file = input.files[0];
  if (!file) return;
  setStatus("grades-extract-status", "Reading image…", "loading");
  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64   = e.target.result.split(",")[1];
    const mimeType = file.type || "image/jpeg";
    setStatus("grades-extract-status", "Extracting grades with AI — this may take a moment…", "loading");
    try {
      const res = await apiCall("extractGradesFromTranscript", { imageBase64: base64, mimeType });
      _applyExtracted(res.grades || []);
      setStatus("grades-extract-status",
        `Extracted ${res.grades?.length || 0} class${(res.grades?.length || 0) !== 1 ? "es" : ""} — review and adjust below.`,
        "success");
    } catch (err) {
      setStatus("grades-extract-status", "Extraction error: " + err.message, "error");
    }
    input.value = "";
  };
  reader.readAsDataURL(file);
}

async function gradesExtractFromText() {
  const text = document.getElementById("grades-paste-text")?.value?.trim();
  if (!text) return;
  setStatus("grades-extract-status", "Extracting grades with AI…", "loading");
  try {
    const res = await apiCall("extractGradesFromTranscript", { transcriptText: text });
    _applyExtracted(res.grades || []);
    setStatus("grades-extract-status",
      `Extracted ${res.grades?.length || 0} class${(res.grades?.length || 0) !== 1 ? "es" : ""} — review and adjust below.`,
      "success");
    gradesTogglePaste();
  } catch (err) {
    setStatus("grades-extract-status", "Extraction error: " + err.message, "error");
  }
}

function _applyExtracted(extracted) {
  extracted.slice(0, GRADES_MAX_CLASSES).forEach((item, i) => {
    if (!gradeRows[i]) gradeRows[i] = { className: "", grade: "", credits: "1", citizenship: "" };
    if (item.className)   gradeRows[i].className   = item.className;
    if (item.grade)       gradeRows[i].grade       = item.grade;
    if (item.credits)     gradeRows[i].credits     = String(item.credits);
    if (item.citizenship) gradeRows[i].citizenship = item.citizenship;
  });
  const area = document.getElementById("grades-rows-area");
  if (area) area.innerHTML = _renderRowsTable();
  gradesUpdateGpa();
}

async function gradesSave() {
  const term = (document.getElementById("grades-term")?.value || gradeTerm).trim();
  const filled = gradeRows.filter(r => r.className.trim() || r.grade);
  if (!filled.length) {
    setStatus("grades-save-status", "Enter at least one class.", "error");
    return;
  }
  const gpa = _calcGpa(gradeRows);
  setStatus("grades-save-status", "Saving…", "loading");
  try {
    await apiCall("saveGrades", { term, grades: gradeRows, gpa: gpa || "" });
    setStatus("grades-save-status", "Saved.", "success");
    const res = await apiCall("getGrades", {});
    gradeHistory  = res.entries  || [];
    gradeSchedule = res.schedule || [];
    const histEl = document.getElementById("grades-history-area");
    if (histEl) histEl.innerHTML = _renderHistory();
  } catch (e) {
    setStatus("grades-save-status", "Error: " + e.message, "error");
  }
}

function _renderHistory() {
  if (!gradeHistory.length) return "";
  return gradeHistory.map(entry => {
    let grades = [];
    try { grades = JSON.parse(entry.gradesJson); } catch (_) {}
    const filled = grades.filter(g => g.grade && g.className);
    if (!filled.length) return "";
    const gpa = entry.gpa;
    return `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
          <div>
            <h2 style="padding:0;margin:0;">${escapeHtml(entry.term || "Untitled Term")}</h2>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">${escapeHtml(entry.dateAdded || "")}</div>
          </div>
          ${gpa ? `<div style="font-size:26px;font-weight:800;color:${_gpaColor(gpa)};">GPA: ${escapeHtml(gpa)}</div>` : ""}
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;min-width:400px;">
            <thead>
              <tr style="border-bottom:1.5px solid var(--border);">
                <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:4px 8px;">Class</th>
                <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:center;padding:4px 8px;width:56px;">Grade</th>
                <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:center;padding:4px 8px;width:64px;">Credits</th>
                <th style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:center;padding:4px 8px;width:90px;">Citizenship</th>
              </tr>
            </thead>
            <tbody>
              ${filled.map(g => {
                const sty = _gradeStyle(g.grade);
                return `<tr style="border-bottom:1px solid var(--border);">
                  <td style="font-size:13px;padding:7px 8px;">${escapeHtml(g.className)}</td>
                  <td style="padding:7px 8px;text-align:center;">
                    <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${sty.bg};color:${sty.fg};font-size:10px;font-weight:700;">${escapeHtml(g.grade)}</span>
                  </td>
                  <td style="font-size:13px;padding:7px 8px;text-align:center;color:var(--muted);">${escapeHtml(String(g.credits || "—"))}</td>
                  <td style="font-size:13px;padding:7px 8px;text-align:center;color:var(--muted);">${escapeHtml(g.citizenship || "—")}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }).join("");
}

function _renderComparison() {
  // Need at least 2 snapshots to compare
  const snapshots = gradeHistory
    .map(entry => {
      let grades = [];
      try { grades = JSON.parse(entry.gradesJson); } catch (_) {}
      return { term: entry.term || entry.dateAdded, date: entry.dateAdded, gpa: entry.gpa, grades };
    })
    .filter(s => s.grades.some(g => g.grade && g.className))
    .reverse(); // oldest → newest left → right

  if (snapshots.length < 2) return "";

  // Build union of class names (preserve order of first appearance)
  const classOrder = [];
  const seenClasses = new Set();
  snapshots.forEach(s => {
    s.grades.forEach(g => {
      if (g.className && !seenClasses.has(g.className)) {
        seenClasses.add(g.className);
        classOrder.push(g.className);
      }
    });
  });

  // Build lookup: snapshot index → className → grade entry
  const lookup = snapshots.map(s => {
    const m = {};
    s.grades.forEach(g => { if (g.className) m[g.className] = g; });
    return m;
  });

  const thStyle = "font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;padding:6px 10px;border-bottom:2px solid var(--border);white-space:nowrap;";
  const tdStyle = "padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);";

  const headerCols = snapshots.map((s, i) => {
    const isNewest = i === snapshots.length - 1;
    return `<th style="${thStyle}text-align:center;${isNewest ? 'background:#f0fdf4;' : ''}">
      <div style="font-weight:700;font-size:12px;color:var(--text);">${escapeHtml(s.term)}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px;">${escapeHtml(s.date)}</div>
    </th>`;
  }).join("");

  const dataRows = classOrder.map(className => {
    const cells = snapshots.map((s, si) => {
      const entry = lookup[si][className];
      const isNewest = si === snapshots.length - 1;
      if (!entry || !entry.grade) {
        return `<td style="${tdStyle}${isNewest ? 'background:#f0fdf4;' : ''}color:var(--muted);">—</td>`;
      }
      const sty = _gradeStyle(entry.grade);
      // Grade change indicator vs previous snapshot
      let changeHtml = "";
      if (si > 0) {
        const prev = lookup[si - 1][className];
        if (prev && prev.grade) {
          const prevPts = _gradePoints(prev.grade);
          const currPts = _gradePoints(entry.grade);
          if (currPts > prevPts)       changeHtml = `<span style="color:#059669;font-size:9px;display:block;margin-top:2px;">▲</span>`;
          else if (currPts < prevPts)  changeHtml = `<span style="color:#dc2626;font-size:9px;display:block;margin-top:2px;">▼</span>`;
          else                         changeHtml = `<span style="color:var(--muted);font-size:9px;display:block;margin-top:2px;">—</span>`;
        }
      }
      return `<td style="${tdStyle}${isNewest ? 'background:#f0fdf4;' : ''}">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${sty.bg};color:${sty.fg};font-size:10px;font-weight:700;">${escapeHtml(entry.grade)}</span>
        ${changeHtml}
      </td>`;
    }).join("");
    return `<tr>
      <td style="font-size:13px;padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;font-weight:500;">${escapeHtml(className)}</td>
      ${cells}
    </tr>`;
  }).join("");

  const gpaRow = (() => {
    const cells = snapshots.map((s, si) => {
      const isNewest = si === snapshots.length - 1;
      if (!s.gpa) return `<td style="${tdStyle}${isNewest ? 'background:#f0fdf4;' : ''}color:var(--muted);">—</td>`;
      let changeHtml = "";
      if (si > 0 && snapshots[si - 1].gpa) {
        const diff = parseFloat(s.gpa) - parseFloat(snapshots[si - 1].gpa);
        if (diff > 0.01)       changeHtml = `<span style="color:#059669;font-size:10px;margin-left:4px;">▲ ${diff.toFixed(2)}</span>`;
        else if (diff < -0.01) changeHtml = `<span style="color:#dc2626;font-size:10px;margin-left:4px;">▼ ${Math.abs(diff).toFixed(2)}</span>`;
      }
      return `<td style="${tdStyle}${isNewest ? 'background:#f0fdf4;' : ''}">
        <span style="font-size:15px;font-weight:800;color:${_gpaColor(s.gpa)};">${escapeHtml(s.gpa)}</span>${changeHtml}
      </td>`;
    }).join("");
    return `<tr style="border-top:2px solid var(--border);">
      <td style="font-size:12px;font-weight:700;color:var(--muted);padding:8px 10px;text-transform:uppercase;letter-spacing:.04em;">GPA</td>
      ${cells}
    </tr>`;
  })();

  return `
    <div class="card" style="margin-top:12px;">
      <h2 style="padding-top:0;margin-bottom:4px;"><i class="bi bi-table"></i> Grade Comparison</h2>
      <p style="font-size:12px;color:var(--muted);margin:0 0 14px;">
        Each column is one snapshot. Newest on the right (shaded). ▲▼ show change from the previous snapshot.
      </p>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
        <table style="border-collapse:collapse;min-width:400px;">
          <thead>
            <tr>
              <th style="${thStyle}text-align:left;">Class</th>
              ${headerCols}
            </tr>
          </thead>
          <tbody>
            ${dataRows}
            ${gpaRow}
          </tbody>
        </table>
      </div>
    </div>`;
}

// Called from portal.html on page load — flashes the nav button if no grade
// has been saved in the last 14 days.
async function checkGradesAlert() {
  try {
    const res = await apiCall("getGrades", {});
    const entries = res.entries || [];
    const btn = document.querySelector('[data-section="grades"]');
    if (!btn) return;
    if (!entries.length) {
      btn.classList.add("nav-alert");
      return;
    }
    const latest = entries.reduce((a, b) => (a.dateAdded > b.dateAdded ? a : b));
    const daysSince = (Date.now() - new Date(latest.dateAdded).getTime()) / 86400000;
    btn.classList.toggle("nav-alert", daysSince > 14);
  } catch (_) { /* silently skip if grades not yet accessible */ }
}
