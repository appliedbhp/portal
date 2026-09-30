// Provider pipeline — inquiry through intake and enrollment.
let pipelineData = { stages: [], leads: [], history: [] };

async function initPipelineSection(root) {
  root.innerHTML = `<div class="card"><h1><i class="bi bi-funnel-fill"></i> Client Journey</h1><p class="pipeline-muted">Refreshing journey tags and checking for stalled follow-up…</p></div>`;
  try {
    pipelineData = await apiCall("getPipeline", {});
    renderPipeline(root);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>${escapeHtml(e.message)}</span></div></div>`;
  }
}

function renderPipeline(root) {
  const stages = pipelineData.stages || [], leads = pipelineData.leads || [];
  const open = leads.filter(l => !["won", "lost"].includes(l.stage));
  const leaks = open.filter(l => l.leaking);
  const won = leads.filter(l => l.stage === "won").length;
  const conversion = leads.length ? Math.round(won / leads.length * 100) : 0;
  root.innerHTML = `
    <section class="pipeline-hero card">
      <div><div class="pipeline-kicker"><i class="bi bi-stars"></i> LEAK-PROOF CLIENT JOURNEY</div><h1>Inquiry → intake → care</h1><p>Portal activity moves people forward automatically. You can override any stage and see why it changed.</p></div>
      <div class="pipeline-actions"><button class="secondary" onclick="pipelineOpenEditor()"><i class="bi bi-person-plus-fill"></i> Add inquiry</button><button onclick="pipelineRefresh()"><i class="bi bi-arrow-repeat"></i> Run automation</button></div>
    </section>
    <div class="pipeline-metrics">
      ${pipelineMetric("people-fill", leads.length, "All journeys", "#6366f1")}
      ${pipelineMetric("funnel-fill", open.length, "Active opportunities", "#0ea5e9")}
      ${pipelineMetric("droplet-half", leaks.length, "Possible leaks", leaks.length ? "#ef4444" : "#10b981")}
      ${pipelineMetric("graph-up-arrow", conversion + "%", "Conversion", "#10b981")}
    </div>
    ${leaks.length ? `<div class="pipeline-leak-banner"><i class="bi bi-exclamation-diamond-fill"></i><div><strong>${leaks.length} journey${leaks.length===1?"":"s"} need follow-up</strong><span>These have exceeded the recommended response window for their current stage.</span></div><button class="secondary" onclick="pipelineShowLeaks()">Review leaks</button></div>` : ""}
    <div class="pipeline-toolbar card"><div class="pipeline-search"><i class="bi bi-search"></i><input id="pipeline-search" oninput="pipelineFilter()" placeholder="Search name, email, Client ID, source, or tag"></div><select id="pipeline-filter" onchange="pipelineFilter()"><option value="all">All stages</option>${stages.map(s=>`<option value="${s.id}">${escapeHtml(s.label)}</option>`).join("")}<option value="leaks">Needs follow-up</option></select><button class="secondary" onclick="pipelineToggleHistory()"><i class="bi bi-clock-history"></i> Activity</button></div>
    <div id="pipeline-board" class="pipeline-board">${stages.map(stage => pipelineColumn(stage, leads.filter(l => l.stage === stage.id))).join("")}</div>
    <aside id="pipeline-history" class="pipeline-history card" hidden><div class="pipeline-history-head"><h2><i class="bi bi-clock-history"></i> Journey activity</h2><button class="secondary icon-btn" onclick="pipelineToggleHistory()"><i class="bi bi-x-lg"></i></button></div>${pipelineHistoryHtml()}</aside>
    <div id="pipeline-modal" class="pipeline-modal" hidden></div>`;
}

function pipelineMetric(icon, value, label, color) { return `<div class="pipeline-metric card" style="--metric:${color}"><i class="bi bi-${icon}"></i><div><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div></div>`; }

function pipelineColumn(stage, leads) {
  return `<section class="pipeline-column" data-stage="${stage.id}"><header style="--stage:${stage.color}"><div><span class="pipeline-stage-dot"></span><strong>${escapeHtml(stage.label)}</strong></div><span>${leads.length}</span></header><div class="pipeline-column-body">${leads.map(pipelineCard).join("") || `<div class="pipeline-empty">No one here</div>`}</div></section>`;
}

function pipelineCard(lead) {
  const searchable = [lead.name,lead.email,lead.clientId,lead.source,(lead.tags||[]).join(" ")].join(" ").toLowerCase();
  return `<article class="pipeline-card${lead.leaking?" leaking":""}" data-search="${escapeAttr(searchable)}" data-stage="${escapeAttr(lead.stage)}" data-leak="${lead.leaking?"1":"0"}">
    <div class="pipeline-card-top"><div class="pipeline-avatar">${escapeHtml((lead.name||"?").slice(0,2).toUpperCase())}</div><div><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.clientId || lead.email || "Inquiry")}</small></div><button class="pipeline-more" onclick="pipelineOpenEditor('${escapeAttr(lead.leadId)}')" title="Edit journey"><i class="bi bi-three-dots"></i></button></div>
    ${lead.source?`<div class="pipeline-source"><i class="bi bi-signpost-split-fill"></i>${escapeHtml(lead.source)}</div>`:""}
    <div class="pipeline-tags">${(lead.tags||[]).slice(0,4).map(t=>`<span>${escapeHtml(t)}</span>`).join("")}</div>
    ${lead.leaking?`<div class="pipeline-leak"><i class="bi bi-droplet-fill"></i> No movement for ${lead.ageHours} hours</div>`:""}
    <div class="pipeline-card-foot"><select aria-label="Move journey stage" onchange="pipelineMove('${escapeAttr(lead.leadId)}',this.value)">${(pipelineData.stages||[]).map(s=>`<option value="${s.id}" ${s.id===lead.stage?"selected":""}>${escapeHtml(s.label)}</option>`).join("")}</select><button class="secondary" onclick="pipelineContacted('${escapeAttr(lead.leadId)}')" title="Mark contacted now"><i class="bi bi-chat-dots-fill"></i></button>${lead.clientId?`<button class="secondary" onclick="dashJumpToClient('${escapeAttr(lead.clientId)}')" title="Open client"><i class="bi bi-box-arrow-up-right"></i></button>`:""}</div>
  </article>`;
}

function pipelineHistoryHtml() {
  const label = id => (pipelineData.stages||[]).find(s=>s.id===id)?.label || id || "Created";
  return (pipelineData.history||[]).slice(0,40).map(h=>`<div class="pipeline-history-row"><i class="bi bi-arrow-right-circle-fill"></i><div><strong>${escapeHtml(h.CLIENT_ID||h.LEAD_ID||"Journey")}</strong><span>${escapeHtml(label(String(h.FROM_STAGE||"")))} → ${escapeHtml(label(String(h.TO_STAGE||"")))}</span><small>${escapeHtml(String(h.REASON||"Stage updated"))} · ${escapeHtml(String(h.CHANGED_AT||""))}</small></div></div>`).join("") || `<p class="pipeline-muted">No stage changes yet.</p>`;
}

async function pipelineRefresh(){try{pipelineData=await apiCall("refreshPipeline",{});renderPipeline(document.getElementById("section-pipeline"));showToast("Journey tags refreshed.","success");}catch(e){showToast(e.message,"error");}}
async function pipelineMove(leadId,stage,contacted=false){try{await apiCall("movePipelineLead",{leadId,stage,lastContactNow:contacted});await initPipelineSection(document.getElementById("section-pipeline"));}catch(e){showToast(e.message,"error");}}
function pipelineContacted(leadId){const l=(pipelineData.leads||[]).find(x=>x.leadId===leadId);pipelineMove(leadId,l?.stage||"contacted",true);}
function pipelineFilter(){const q=(document.getElementById("pipeline-search")?.value||"").toLowerCase(),f=document.getElementById("pipeline-filter")?.value||"all";document.querySelectorAll(".pipeline-card").forEach(c=>c.hidden=!!q&&!c.dataset.search.includes(q)||(f==="leaks"?c.dataset.leak!=="1":f!=="all"&&c.dataset.stage!==f));document.querySelectorAll(".pipeline-column").forEach(c=>c.hidden=f!=="all"&&f!=="leaks"&&c.dataset.stage!==f);}
function pipelineShowLeaks(){document.getElementById("pipeline-filter").value="leaks";pipelineFilter();document.getElementById("pipeline-board")?.scrollIntoView({behavior:"smooth",block:"start"});}
function pipelineToggleHistory(){const p=document.getElementById("pipeline-history");if(p)p.hidden=!p.hidden;}

function pipelineOpenEditor(leadId="") {
  const lead=(pipelineData.leads||[]).find(l=>l.leadId===leadId)||{};
  const modal=document.getElementById("pipeline-modal"); modal.hidden=false;
  modal.innerHTML=`<div class="pipeline-dialog card"><div class="pipeline-dialog-head"><div><div class="pipeline-kicker">${leadId?"UPDATE JOURNEY":"CAPTURE THE INQUIRY"}</div><h2>${leadId?escapeHtml(lead.name):"New inquiry"}</h2></div><button class="secondary icon-btn" onclick="document.getElementById('pipeline-modal').hidden=true"><i class="bi bi-x-lg"></i></button></div><div class="pipeline-form"><label>Name<input id="pl-name" value="${escapeAttr(lead.name||"")}"></label><label>Email<input id="pl-email" type="email" value="${escapeAttr(lead.email||"")}"></label><label>Phone<input id="pl-phone" value="${escapeAttr(lead.phone||"")}"></label><label>Client ID<input id="pl-client" value="${escapeAttr(lead.clientId||"")}" placeholder="Optional until account is created"></label><label>Source<select id="pl-source"><option></option>${["Website","Google","Psychology Today","Provider referral","School referral","Existing client referral","Social media","Event / workshop","Other"].map(s=>`<option ${lead.source===s?"selected":""}>${s}</option>`).join("")}</select></label><label>Stage<select id="pl-stage">${(pipelineData.stages||[]).map(s=>`<option value="${s.id}" ${lead.stage===s.id?"selected":""}>${escapeHtml(s.label)}</option>`).join("")}</select></label><label>Next follow-up<input id="pl-follow" type="datetime-local" value="${escapeAttr((lead.nextFollowUp||"").replace(" ","T"))}"></label><label class="wide">Notes<textarea id="pl-notes" rows="4">${escapeHtml(lead.notes||"")}</textarea></label></div><div class="pipeline-dialog-actions"><button class="secondary" onclick="document.getElementById('pipeline-modal').hidden=true">Cancel</button><button onclick="pipelineSave('${escapeAttr(leadId)}')"><i class="bi bi-floppy-fill"></i> Save journey</button></div></div>`;
}

async function pipelineSave(leadId){const lead={leadId,name:document.getElementById("pl-name").value,email:document.getElementById("pl-email").value,phone:document.getElementById("pl-phone").value,clientId:document.getElementById("pl-client").value,source:document.getElementById("pl-source").value,stage:document.getElementById("pl-stage").value,manualStage:leadId?document.getElementById("pl-stage").value:"",nextFollowUp:document.getElementById("pl-follow").value.replace("T"," "),notes:document.getElementById("pl-notes").value};try{await apiCall("savePipelineLead",{lead});document.getElementById("pipeline-modal").hidden=true;await initPipelineSection(document.getElementById("section-pipeline"));showToast("Journey saved.","success");}catch(e){showToast(e.message,"error");}}
