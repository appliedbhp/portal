// ── Assessment Library (provider-only) ───────────────────────────────────────

function assessmentProviderVerify_(params, verify) {
  if (verify && verify.role === "provider") return verify;
  params = params || {};
  const checked = verifyProviderLogin_(params.providerId, params.providerPassword);
  if (!checked || !checked.ok) throw new Error((checked && checked.error) || "Provider authentication failed.");
  return Object.assign({}, checked, { providerId:String(params.providerId || ""), clientId:String(params.providerId || "") });
}

function uploadAssessment_(params, verify) {
  verify = assessmentProviderVerify_(params, verify);
  if (verify.role !== "provider") throw new Error("Access denied");
  const pdfText = String(params.pdfText || "").trim();
  const name    = String(params.name    || "").trim();
  if (!pdfText) throw new Error("Assessment: pdfText is required");

  const prompt = `You are a clinical assessment specialist. Extract the complete structure of this assessment instrument from the text below and return ONLY valid JSON — no markdown, no commentary.

ASSESSMENT TEXT:
${pdfText.substring(0, 6000)}

Return a JSON object with this exact structure:
{
  "name": "Full instrument name",
  "shortName": "Abbreviation (e.g. ASRS-v1.1)",
  "target": "adult | child | parent | adolescent",
  "version": "version string if present",
  "source": "author/organization",
  "instructions": "Brief instructions for the respondent",
  "scale": ["option1", "option2", ...],
  "parts": [
    {
      "id": "partA",
      "name": "Part A",
      "questions": [
        {
          "id": 1,
          "text": "Question text exactly as written",
          "threshold": "the response value that counts as clinically significant (if applicable, else omit)"
        }
      ]
    }
  ],
  "scoring": {
    "partA": {
      "method": "threshold_count | sum | mean",
      "cutoff": 4,
      "cutoffLabel": "Positive screen",
      "threshold": "Sometimes",
      "subscales": []
    }
  },
  "notes": "Any clinician notes about scoring or interpretation"
}

If there are no separate parts, put all questions in one part with id "full" and name "Full Scale".
threshold_count: count questions where response index >= threshold index. sum/mean: use 0=first option, 1=second, etc.`;

  const apiKey = PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
  if (!apiKey) throw new Error("Assessment: CLAUDE_API_KEY not set in Script Properties");

  const resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    payload: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 4096,
      messages: [{ role: "user", content: prompt }]
    }),
    muteHttpExceptions: true
  });

  const responseText = resp.getContentText();
  let raw;
  try { raw = JSON.parse(responseText); }
  catch (_) { throw new Error("Assessment: the extraction service returned an unreadable response"); }
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300 || raw.error) {
    throw new Error("Claude API error: " + String(raw && raw.error && raw.error.message || "request failed"));
  }
  const text = (Array.isArray(raw.content) ? raw.content : []).filter(Boolean).map(function(block) { return String(block.text || ""); }).join("").trim();
  if (!text) throw new Error("Assessment: Claude returned an empty definition");
  let definition;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    definition = JSON.parse(m ? m[0] : text);
  } catch (e) {
    throw new Error("Assessment: Claude returned invalid JSON — check pdfText and retry");
  }
  if (!definition || !Array.isArray(definition.parts)) throw new Error("Assessment: the extracted definition did not contain assessment sections");
  const questionCount = definition.parts.reduce(function(total, part) { return total + (Array.isArray(part.questions) ? part.questions.length : 0); }, 0);
  if (!questionCount) throw new Error("Assessment: no questions were found. Include the full item text, scale, and scoring instructions.");

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(ss, "data_assessments_library", [
    "ASSESSMENT_ID","NAME","SHORT_NAME","TARGET","VERSION","SOURCE","DEFINITION_JSON","CREATED_AT","ACTIVE"
  ]);
  const id    = Utilities.getUuid();
  sheet.appendRow([id, name || definition.name || "Untitled", definition.shortName || "",
                   definition.target || "adult", definition.version || "", definition.source || "",
                   JSON.stringify(definition), nowStr_(), true]);
  return { assessmentId: id, definition };
}

function getAssessmentLibrary_(verify) {
  try {
    const rows = readRows_("data_assessments_library")
      .filter(r => String(r.ACTIVE || "").toLowerCase() !== "false")
      .sort((a, b) => String(a.NAME || "").localeCompare(String(b.NAME || "")));
    return {
      assessments: rows.map(r => {
        let def = {};
        try { def = JSON.parse(r.DEFINITION_JSON || "{}"); } catch (_) {}
        return {
          assessmentId: String(r.ASSESSMENT_ID || ""),
          name:         String(r.NAME          || ""),
          shortName:    String(r.SHORT_NAME     || ""),
          target:       String(r.TARGET         || ""),
          version:      String(r.VERSION        || ""),
          source:       String(r.SOURCE         || ""),
          createdAt:    String(r.CREATED_AT     || ""),
          definition:   def
        };
      })
    };
  } catch (e) { return { assessments: [] }; }
}

function updateAssessmentDefinition_(params, verify) {
  if (verify.role !== "provider") throw new Error("Access denied");
  const assessmentId = String(params.assessmentId || "").trim();
  const definition   = params.definition;
  if (!assessmentId) throw new Error("Assessment: assessmentId required");
  if (!definition)   throw new Error("Assessment: definition required");
  updateRowByKey_("data_assessments_library", "ASSESSMENT_ID", assessmentId, {
    DEFINITION_JSON: JSON.stringify(definition),
    NAME: definition.name || "", SHORT_NAME: definition.shortName || "",
    TARGET: definition.target || "", VERSION: definition.version || "", SOURCE: definition.source || ""
  });
  return { ok: true };
}

function deleteAssessment_(params, verify) {
  verify = assessmentProviderVerify_(params, verify);
  if (verify.role !== "provider") throw new Error("Access denied");
  const assessmentId = String(params.assessmentId || "").trim();
  if (!assessmentId) throw new Error("Assessment: assessmentId required");
  updateRowByKey_("data_assessments_library", "ASSESSMENT_ID", assessmentId, { ACTIVE: false });
  return { ok: true };
}

// ── Assignments (provider-only) ───────────────────────────────────────────────

function assignAssessment_(params, verify) {
  verify = assessmentProviderVerify_(params, verify);
  if (verify.role !== "provider") throw new Error("Access denied");
  const clientId     = String(params.clientId     || "").trim();
  const assessmentId = String(params.assessmentId || "").trim();
  const frequency    = String(params.frequency    || "once").trim();
  const freqDays     = parseInt(params.frequencyDays || 0, 10);
  if (!clientId)     throw new Error("Assignment: clientId required");
  if (!assessmentId) throw new Error("Assignment: assessmentId required");

  const nextDue = computeNextDue_(frequency, freqDays);
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = getOrCreateSheet_(ss, "data_assessment_assignments", [
    "ASSIGNMENT_ID","CLIENT_ID","ASSESSMENT_ID","FREQUENCY","FREQUENCY_DAYS","NEXT_DUE","ASSIGNED_BY","ASSIGNED_AT","ACTIVE"
  ]);
  const id      = Utilities.getUuid();
  sheet.appendRow([id, clientId, assessmentId, frequency, freqDays, nextDue, verify.clientId, nowStr_(), true]);
  return { assignmentId: id, nextDue };
}

function computeNextDue_(frequency, freqDays) {
  const now = new Date();
  const tz  = Session.getScriptTimeZone();
  const fmt = d => Utilities.formatDate(d, tz, "yyyy-MM-dd");
  const add = days => new Date(now.getTime() + days * 86400000);
  switch (frequency) {
    case "weekly":      return fmt(add(7));
    case "monthly":     return fmt(add(30));
    case "custom":      return fmt(add(freqDays || 7));
    default:            return fmt(now); // once / per_session / unknown → due today
  }
}

function getClientAssignments_(params, verify) {
  verify = assessmentProviderVerify_(params, verify);
  const clientId = verify.role === "provider"
    ? String(params.clientId || "").trim() : verify.clientId;
  if (!clientId) throw new Error("Assignment: clientId required");

  try {
    const rows = readRows_("data_assessment_assignments")
      .filter(r => String(r.CLIENT_ID || "").trim() === clientId &&
                   String(r.ACTIVE || "").toLowerCase() !== "false");

    let lib = {};
    try {
      readRows_("data_assessments_library").forEach(r => {
        lib[String(r.ASSESSMENT_ID || "")] = {
          name: String(r.NAME || ""), shortName: String(r.SHORT_NAME || ""), target: String(r.TARGET || "")
        };
      });
    } catch (_) {}

    const tz2 = Session.getScriptTimeZone();
    return {
      assignments: rows.map(r => ({
        assignmentId:  String(r.ASSIGNMENT_ID  || ""),
        assessmentId:  String(r.ASSESSMENT_ID  || ""),
        frequency:     String(r.FREQUENCY      || "once"),
        frequencyDays: String(r.FREQUENCY_DAYS || ""),
        nextDue:       r.NEXT_DUE instanceof Date
                         ? Utilities.formatDate(r.NEXT_DUE, tz2, "yyyy-MM-dd")
                         : String(r.NEXT_DUE || "").trim(),
        assignedAt:    String(r.ASSIGNED_AT    || ""),
        ...(lib[String(r.ASSESSMENT_ID || "")] || {})
      }))
    };
  } catch (e) { return { assignments: [] }; }
}

function removeAssignment_(params, verify) {
  verify = assessmentProviderVerify_(params, verify);
  if (verify.role !== "provider") throw new Error("Access denied");
  const assignmentId = String(params.assignmentId || "").trim();
  if (!assignmentId) throw new Error("Assignment: assignmentId required");
  updateRowByKey_("data_assessment_assignments", "ASSIGNMENT_ID", assignmentId, { ACTIVE: false });
  return { ok: true };
}

// ── Client-facing: pending + submit ──────────────────────────────────────────

function getPendingAssessments_(verify) {
  const clientId = verify.clientId;
  const today    = new Date(); today.setHours(0, 0, 0, 0);

  try {
    const assignments = readRows_("data_assessment_assignments")
      .filter(r => String(r.CLIENT_ID || "").trim() === clientId &&
                   String(r.ACTIVE || "").toLowerCase() !== "false");

    let lastDone = {};
    try {
      readRows_("data_assessment_responses")
        .filter(r => String(r.CLIENT_ID || "").trim() === clientId && r.STATUS === "completed")
        .forEach(r => {
          const aid = String(r.ASSIGNMENT_ID || "");
          if (!lastDone[aid] || r.COMPLETED_AT > lastDone[aid]) lastDone[aid] = String(r.COMPLETED_AT || "");
        });
    } catch (_) {}

    let lib = {};
    try {
      readRows_("data_assessments_library").forEach(r => {
        let def = {};
        try { def = JSON.parse(r.DEFINITION_JSON || "{}"); } catch (_) {}
        lib[String(r.ASSESSMENT_ID || "")] = {
          name: String(r.NAME || ""), shortName: String(r.SHORT_NAME || ""), definition: def
        };
      });
    } catch (_) {}

    const tz       = Session.getScriptTimeZone();
    const todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    const pending = [];
    for (const r of assignments) {
      const aid      = String(r.ASSESSMENT_ID || "");
      const assignId = String(r.ASSIGNMENT_ID || "");
      // Handle both string and Date object (Sheets auto-converts date-like strings)
      const dueStr   = r.NEXT_DUE instanceof Date
        ? Utilities.formatDate(r.NEXT_DUE, tz, "yyyy-MM-dd")
        : String(r.NEXT_DUE || "").trim();
      if (dueStr && dueStr > todayStr) continue; // not due yet
      pending.push({
        assignmentId:  assignId,
        assessmentId:  aid,
        name:          (lib[aid] || {}).name       || "",
        shortName:     (lib[aid] || {}).shortName  || "",
        definition:    (lib[aid] || {}).definition || {},
        nextDue:       dueStr,
        lastCompleted: lastDone[assignId] || null
      });
    }
    return { pending };
  } catch (e) { return { pending: [], _debug: e.message }; }
}

function submitAssessment_(params, verify) {
  const assignmentId = String(params.assignmentId || "").trim();
  const assessmentId = String(params.assessmentId || "").trim();
  const responses    = params.responses;
  if (!assignmentId) throw new Error("Assessment: assignmentId required");
  if (!assessmentId) throw new Error("Assessment: assessmentId required");
  if (!responses)    throw new Error("Assessment: responses required");

  const libRows = readRows_("data_assessments_library")
    .filter(r => String(r.ASSESSMENT_ID || "").trim() === assessmentId);
  if (!libRows.length) throw new Error("Assessment: definition not found");
  let def = {};
  try { def = JSON.parse(libRows[0].DEFINITION_JSON || "{}"); } catch (_) {}

  const scores = scoreAssessment_(def, responses);
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = getOrCreateSheet_(ss, "data_assessment_responses", [
    "RESPONSE_ID","ASSIGNMENT_ID","CLIENT_ID","ASSESSMENT_ID","STARTED_AT","COMPLETED_AT","RESPONSES_JSON","SCORES_JSON","STATUS"
  ]);
  const id     = Utilities.getUuid();
  const now    = nowStr_();
  sheet.appendRow([id, assignmentId, verify.clientId, assessmentId, now, now,
                   JSON.stringify(responses), JSON.stringify(scores), "completed"]);

  // Advance or deactivate the assignment
  const aRows = readRows_("data_assessment_assignments")
    .filter(r => String(r.ASSIGNMENT_ID || "").trim() === assignmentId);
  if (aRows.length) {
    const freq     = String(aRows[0].FREQUENCY      || "once");
    const freqDays = parseInt(aRows[0].FREQUENCY_DAYS || 0, 10);
    if (freq === "once") {
      updateRowByKey_("data_assessment_assignments", "ASSIGNMENT_ID", assignmentId, { ACTIVE: false });
    } else {
      updateRowByKey_("data_assessment_assignments", "ASSIGNMENT_ID", assignmentId,
                      { NEXT_DUE: computeNextDue_(freq, freqDays) });
    }
  }
  return { responseId: id, scores };
}

function scoreAssessment_(definition, responses) {
  const scores = {};
  const scale  = definition.scale || ["Never","Rarely","Sometimes","Often","Very Often"];
  const numVal  = r => { const i = scale.indexOf(r); return i >= 0 ? i : 0; };

  try {
    for (const part of (definition.parts || [])) {
      const partId    = part.id || "full";
      const ps        = (definition.scoring || {})[partId] || {};
      const method    = ps.method    || "sum";
      const questions = part.questions || [];

      if (method === "threshold_count") {
        const globalTi = scale.indexOf(ps.threshold || "Often");
        let count = 0;
        for (const q of questions) {
          const resp = responses["q" + q.id] || responses[String(q.id)] || "";
          const ti   = q.threshold ? scale.indexOf(q.threshold) : globalTi;
          if (numVal(resp) >= ti) count++;
        }
        const cutoff = ps.cutoff || 0;
        scores[partId] = { method: "threshold_count", count, cutoff,
                           flag: count >= cutoff,
                           flagLabel: count >= cutoff ? (ps.cutoffLabel || "Positive") : "Negative" };
      } else {
        let total = 0, n = 0;
        for (const q of questions) {
          total += numVal(responses["q" + q.id] || responses[String(q.id)] || "");
          n++;
        }
        scores[partId] = { method, total, mean: n ? Math.round(total / n * 100) / 100 : 0, n };
      }

      for (const sub of (ps.subscales || [])) {
        if (!scores[partId].subscales) scores[partId].subscales = {};
        let t = 0;
        for (const qId of (sub.questions || [])) t += numVal(responses["q" + qId] || responses[String(qId)] || "");
        scores[partId].subscales[sub.name] = {
          total: t, mean: sub.questions.length ? Math.round(t / sub.questions.length * 100) / 100 : 0
        };
      }
    }
  } catch (e) { scores._error = "Scoring error: " + e.message; }
  return scores;
}

// ── Score retrieval ───────────────────────────────────────────────────────────

function getAssessmentScores_(params, verify) {
  const clientId = verify.role === "provider"
    ? String(params.clientId || "").trim() : verify.clientId;
  if (!clientId) throw new Error("Assessment: clientId required");

  try {
    const rows = readRows_("data_assessment_responses")
      .filter(r => String(r.CLIENT_ID || "").trim() === clientId && r.STATUS === "completed")
      .sort((a, b) => String(b.COMPLETED_AT || "").localeCompare(String(a.COMPLETED_AT || "")));

    let nameMap = {};
    try {
      readRows_("data_assessments_library")
        .forEach(r => { nameMap[String(r.ASSESSMENT_ID || "")] = String(r.SHORT_NAME || r.NAME || ""); });
    } catch (_) {}

    return {
      scores: rows.map(r => {
        let sc = {}, rs = {};
        try { sc = JSON.parse(r.SCORES_JSON    || "{}"); } catch (_) {}
        try { rs = JSON.parse(r.RESPONSES_JSON || "{}"); } catch (_) {}
        return {
          responseId:   String(r.RESPONSE_ID   || ""),
          assessmentId: String(r.ASSESSMENT_ID || ""),
          name:         nameMap[String(r.ASSESSMENT_ID || "")] || "",
          completedAt:  String(r.COMPLETED_AT  || ""),
          scores: sc, responses: rs
        };
      })
    };
  } catch (e) { return { scores: [] }; }
}

function getAssessmentHistory_(params, verify) {
  const clientId     = verify.role === "provider"
    ? String(params.clientId || "").trim() : verify.clientId;
  const assessmentId = String(params.assessmentId || "").trim();
  if (!clientId)     throw new Error("Assessment: clientId required");
  if (!assessmentId) throw new Error("Assessment: assessmentId required");

  try {
    const rows = readRows_("data_assessment_responses")
      .filter(r => String(r.CLIENT_ID    || "").trim() === clientId &&
                   String(r.ASSESSMENT_ID|| "").trim() === assessmentId &&
                   r.STATUS === "completed")
      .sort((a, b) => String(a.COMPLETED_AT || "").localeCompare(String(b.COMPLETED_AT || "")));

    return {
      history: rows.map(r => {
        let sc = {};
        try { sc = JSON.parse(r.SCORES_JSON || "{}"); } catch (_) {}
        return { responseId: String(r.RESPONSE_ID || ""), completedAt: String(r.COMPLETED_AT || ""), scores: sc };
      })
    };
  } catch (e) { return { history: [] }; }
}
