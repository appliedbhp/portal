// Consent Forms — provider-only section for managing consent documents
// linked to a client. Status drives client notifications.

const CONSENT_STATUSES = {
  pending_signature: { label: "Pending Signature", color: "#dc2626", bg: "#fee2e2" },
  sent:              { label: "Sent",               color: "#92400e", bg: "#fef3c7" },
  signed:            { label: "Signed",             color: "#065f46", bg: "#d1fae5" },
  draft:             { label: "Draft",              color: "#6b7280", bg: "#f3f4f6" }
};

const CONSENT_SIGNATURE_FONTS = ["EDU QLD Hand","Dancing Script","Caveat","Zeyada","Ingrid Darling","Lacquer"];
let _consentSigningDoc = null;
let _consentChallengeId = "";
let _consentSchemaDraft = [];

async function initConsentFormsSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading consent forms…</p></div>`;
  if (!isProvider()) {
    try {
      const res = await apiCall("getConsentDocs", {});
      renderClientConsentForms(root, res.docs || []);
    } catch (e) {
      root.innerHTML = `<div class="card"><div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>Could not load documents: ${escapeHtml(e.message)}</span></div></div>`;
    }
    return;
  }
  try {
    const [docsRes, templatesRes, folderRes] = await Promise.all([
      apiCall("getConsentDocs", {}),
      apiCall("getConsentTemplates", {}).catch(e => ({ templates: [], _error: e.message })),
      apiCall("getConsentFolderFiles", {}).catch(() => ({ files: [] }))
    ]);
    renderConsentForms(
      root,
      docsRes.docs       || [],
      templatesRes.templates || [],
      templatesRes._error || null,
      folderRes.files    || [],
      folderRes.folderUrl || ""
    );
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load consent forms: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderClientConsentForms(root, docs) {
  const pending = docs.filter(d => d.status !== "signed");
  const signed = docs.filter(d => d.status === "signed");
  const card = d => `<article class="cs-doc ${d.status === "signed" ? "is-signed" : ""}">
    <div class="cs-doc-icon"><i class="bi ${d.status === "signed" ? "bi-patch-check-fill" : "bi-file-earmark-lock2-fill"}"></i></div>
    <div class="cs-doc-main"><span class="cs-eyebrow">${d.status === "signed" ? "Completed" : "Signature required"}</span>
      <h2>${escapeHtml(d.title)}</h2><p>${escapeHtml(d.notes || (d.status === "signed" ? "Your signed copy was emailed to you." : "Review the document carefully before signing."))}</p>
      <div class="cs-meta"><span><i class="bi bi-calendar3"></i> ${escapeHtml(d.createdAt || "")}</span>${d.signerName ? `<span><i class="bi bi-person-check-fill"></i> ${escapeHtml(d.signerName)}</span>` : ""}${d.verificationId ? `<span><i class="bi bi-shield-check"></i> ${escapeHtml(d.verificationId)}</span>` : ""}</div>
    </div>
    <div class="cs-doc-actions">${d.docUrl ? `<a class="secondary cs-button" href="${escapeAttr(d.docUrl)}" target="_blank" rel="noopener"><i class="bi bi-eye-fill"></i> Review</a>` : ""}
      ${d.status !== "signed" ? `<button onclick='openConsentSigning(${JSON.stringify(d).replace(/'/g,"&#39;")})'><i class="bi bi-pen-fill"></i> Review &amp; Sign</button>` : `<button class="secondary" onclick="showConsentAudit('${escapeAttr(d.docId)}')"><i class="bi bi-clock-history"></i> Audit trail</button>`}
    </div></article>`;
  root.innerHTML = `<div class="card cs-hero"><div><span class="cs-kicker"><i class="bi bi-shield-lock-fill"></i> Secure documents</span><h1>Review &amp; Sign</h1><p>Your signature uses your typed legal name, a fresh email verification code, and a tamper-evident audit record. The portal never stores a drawn signature.</p></div><div class="cs-count"><b>${pending.length}</b><span>awaiting you</span></div></div>
    ${pending.length ? `<section><div class="cs-section-title"><h2>Needs your attention</h2><span>${pending.length} document${pending.length===1?"":"s"}</span></div>${pending.map(card).join("")}</section>` : `<div class="card cs-empty"><i class="bi bi-check2-circle"></i><h2>You're all caught up</h2><p>No documents are waiting for your signature.</p></div>`}
    ${signed.length ? `<section><div class="cs-section-title"><h2>Completed</h2><span>${signed.length} signed</span></div>${signed.map(card).join("")}</section>` : ""}<div id="cs-modal"></div>${consentSigningStyles()}`;
}

function consentSigningStyles(){return `<style>
  .cs-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;background:linear-gradient(135deg,#fff,#eef5ff);border-color:#cfe1ff}.cs-kicker,.cs-eyebrow{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#3185fc}.cs-hero h1{margin:8px 0}.cs-hero p{max-width:720px;color:var(--muted);line-height:1.6}.cs-count{min-width:110px;aspect-ratio:1;border-radius:50%;display:grid;place-content:center;text-align:center;background:linear-gradient(135deg,#3185fc,#6957e8);color:#fff;box-shadow:0 14px 30px rgba(49,133,252,.25)}.cs-count b{font-size:30px}.cs-count span{font-size:10px}.cs-section-title{display:flex;justify-content:space-between;align-items:center;margin:22px 2px 10px}.cs-section-title h2{margin:0}.cs-section-title span{font-size:11px;color:var(--muted)}.cs-doc{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;padding:18px;margin-bottom:10px;border:1.5px solid #cfe1ff;border-radius:15px;background:#fff;box-shadow:0 8px 24px rgba(49,133,252,.07)}.cs-doc.is-signed{border-color:#bbf7d0}.cs-doc-icon{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#3185fc,#6957e8);font-size:21px}.is-signed .cs-doc-icon{background:linear-gradient(135deg,#10b981,#059669)}.cs-doc h2{font-size:16px;margin:4px 0}.cs-doc p{font-size:12px;color:var(--muted);margin:0 0 8px}.cs-meta{display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:10px}.cs-doc-actions{display:flex;gap:7px;flex-wrap:wrap}.cs-button{display:inline-flex;align-items:center;gap:6px;text-decoration:none;padding:8px 12px;border-radius:8px}.cs-empty{text-align:center;padding:38px}.cs-empty>i{font-size:42px;color:#10b981}.cs-modal-backdrop{position:fixed;inset:0;z-index:1300;background:rgba(3,15,35,.68);backdrop-filter:blur(8px);display:grid;place-items:center;padding:16px}.cs-modal-card{width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 100px rgba(0,0,0,.35)}.cs-modal-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.94);backdrop-filter:blur(10px)}.cs-modal-body{padding:22px}.cs-disclosure{padding:15px;border-radius:13px;background:#f0f6ff;border:1px solid #cfe1ff;font-size:12px;line-height:1.55}.cs-response-form{margin:16px 0;padding:16px;border:1px solid #cfe1ff;border-radius:14px;background:#fbfdff}.cs-response-form h3{margin:0}.cs-response-field{display:grid;gap:6px;margin:12px 0;font-size:12px;font-weight:700}.cs-response-field small{font-weight:400;color:var(--muted)}.cs-response-field input:not([type=checkbox]),.cs-response-field select,.cs-response-field textarea{width:100%;max-width:none}.cs-response-field.cs-choice,.cs-choice{display:grid!important;grid-template-columns:18px minmax(0,1fr)!important;align-items:start!important;gap:9px!important}.cs-choice input{width:18px!important;height:18px!important;margin:1px 0 0!important}.cs-response-field legend{font-size:12px;font-weight:700;margin-bottom:7px}.cs-checks{display:grid;gap:9px;margin:17px 0;min-width:0}.cs-checks label{display:grid!important;grid-template-columns:18px minmax(0,1fr)!important;align-items:start!important;gap:10px!important;width:100%;min-width:0;padding:11px 12px;border:1px solid var(--border);border-radius:10px;font-size:12px;line-height:1.48;font-weight:500;white-space:normal;overflow:visible}.cs-checks input[type=checkbox]{appearance:auto!important;display:block!important;position:static!important;flex:none!important;width:18px!important;min-width:18px!important;max-width:18px!important;height:18px!important;min-height:18px!important;margin:1px 0 0!important;padding:0!important}.cs-check-text{display:block;min-width:0;white-space:normal;overflow-wrap:anywhere;word-break:normal}.cs-sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cs-sign-grid label{display:grid;gap:6px;font-size:11px;font-weight:800}.cs-sign-grid .wide{grid-column:1/-1}.cs-fonts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.cs-font-option{position:relative;display:grid!important;place-items:center;min-height:62px;border:1.5px solid var(--border)!important;border-radius:11px;cursor:pointer;font-size:24px!important;font-weight:400!important}.cs-font-option:has(input:checked){border-color:#3185fc!important;background:#eef5ff;box-shadow:0 0 0 3px rgba(49,133,252,.1)}.cs-font-option input{position:absolute;opacity:0}.cs-preview{position:relative;min-height:105px;display:grid;place-items:center;overflow:hidden;border-radius:14px;background:linear-gradient(135deg,#f8fbff,#eef5ff);border:1px dashed #9fc3ff;color:#173f76}.cs-preview-name{font-size:42px;line-height:1;padding:12px;text-align:center}.cs-success{text-align:center;padding:28px}.cs-success i{font-size:48px;color:#10b981}@media(max-width:700px){.cs-hero,.cs-doc{grid-template-columns:1fr;display:grid}.cs-count{display:none}.cs-sign-grid{grid-template-columns:1fr}.cs-sign-grid .wide{grid-column:auto}.cs-fonts{grid-template-columns:1fr 1fr}.cs-doc-actions{justify-content:flex-start}}
  </style>`;}

function consentResponseFieldsHtml(doc){const fields=doc.formSchema?.fields||[];if(!fields.length)return "";return `<section class="cs-response-form"><h3><i class="bi bi-ui-checks-grid"></i> Your responses</h3><p style="font-size:12px;color:var(--muted)">Complete these fields before signing. Your responses will be included in the completed document.</p>${fields.map(f=>{const id=`cs-response-${f.id}`;const req=f.required?` <span style="color:#dc2626">*</span>`:"";const label=`<span>${escapeHtml(f.label)}${req}</span>${f.helpText?`<small>${escapeHtml(f.helpText)}</small>`:""}`;if(f.type==="textarea")return `<label class="cs-response-field">${label}<textarea id="${escapeAttr(id)}" rows="4"></textarea></label>`;if(f.type==="select")return `<label class="cs-response-field">${label}<select id="${escapeAttr(id)}"><option value="">Choose…</option>${(f.options||[]).map(o=>`<option>${escapeHtml(o)}</option>`).join("")}</select></label>`;if(f.type==="radio")return `<fieldset class="cs-response-field"><legend>${label}</legend>${(f.options||[]).map(o=>`<label class="cs-choice"><input type="radio" name="${escapeAttr(id)}" value="${escapeAttr(o)}"> <span>${escapeHtml(o)}</span></label>`).join("")}</fieldset>`;if(f.type==="checkbox")return `<label class="cs-response-field cs-choice"><input id="${escapeAttr(id)}" type="checkbox"><span>${escapeHtml(f.label)}${req}</span></label>`;const type=["date","email","number"].includes(f.type)?f.type:(f.type==="phone"?"tel":"text");return `<label class="cs-response-field">${label}<input id="${escapeAttr(id)}" type="${type}"></label>`;}).join("")}</section>`;}
function collectConsentResponses(){const responses={};(_consentSigningDoc?.formSchema?.fields||[]).forEach(f=>{const id=`cs-response-${f.id}`;if(f.type==="radio")responses[f.id]=document.querySelector(`input[name="${CSS.escape(id)}"]:checked`)?.value||"";else{const el=document.getElementById(id);responses[f.id]=f.type==="checkbox"?!!el?.checked:(el?.value||"").trim();}});return responses;}

function openConsentSigning(doc){_consentSigningDoc=doc;_consentChallengeId="";const modal=document.getElementById("cs-modal");modal.innerHTML=`<div class="cs-modal-backdrop"><div class="cs-modal-card"><div class="cs-modal-head"><div><span class="cs-eyebrow">Electronic signature</span><h2 style="margin:3px 0">${escapeHtml(doc.title)}</h2></div><button class="secondary icon-btn" onclick="closeConsentSigning()"><i class="bi bi-x-lg"></i></button></div><div class="cs-modal-body"><div class="cs-disclosure"><strong>Electronic records disclosure</strong><br>By continuing, you agree to receive and sign this record electronically. You may request a paper copy or withdraw consent by contacting your provider. You need a current browser and access to email to complete this process. You will receive a PDF copy that you can download and retain.</div>${doc.docUrl?`<p><a href="${escapeAttr(doc.docUrl)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Open and review the complete document</a></p>`:""}${consentResponseFieldsHtml(doc)}<div class="cs-checks">
  <label><input id="cs-consentElectronic" type="checkbox"><span class="cs-check-text">I consent to electronic records and electronic signatures and understand a paper option is available.</span></label><label><input id="cs-reviewed" type="checkbox"><span class="cs-check-text">I have reviewed the complete document.</span></label><label><input id="cs-intent" type="checkbox"><span class="cs-check-text">I intend to sign this document; typing my name and clicking <strong>Sign and submit</strong> constitutes my electronic signature.</span></label><label><input id="cs-authority" type="checkbox"><span class="cs-check-text">I certify that I am authorized to sign in the capacity selected below.</span></label><label><input id="cs-retainCopy" type="checkbox"><span class="cs-check-text">I can access, download and retain electronic records and understand how to request a paper copy.</span></label></div><div class="cs-sign-grid"><label>Signing capacity<select id="cs-role"><option>Parent/legal guardian</option><option>Adult client/self</option><option>Authorized representative</option></select></label><label>Full legal name<input id="cs-name" autocomplete="name" oninput="updateConsentSignaturePreview()"></label><div class="wide"><span style="display:block;font-size:11px;font-weight:800;margin-bottom:7px">Choose a signature style</span><div class="cs-fonts">${CONSENT_SIGNATURE_FONTS.map((f,i)=>`<label class="cs-font-option" style="font-family:'${f}',cursive"><input type="radio" name="cs-font" value="${f}" ${i===2?"checked":""} onchange="updateConsentSignaturePreview()"><span>${escapeHtml(f)}</span></label>`).join("")}</div></div><div class="wide cs-preview"><div id="cs-preview-name" class="cs-preview-name" style="font-family:'Caveat',cursive">Your name</div></div><div class="wide"><button id="cs-code-btn" class="secondary" onclick="requestConsentCode()"><i class="bi bi-envelope-lock-fill"></i> Email my verification code</button><span id="cs-code-help" style="font-size:11px;color:var(--muted);margin-left:8px"></span></div><label class="wide">6-digit verification code<input id="cs-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label></div><div id="cs-sign-status" style="margin:12px 0"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="secondary" onclick="closeConsentSigning()">Cancel</button><button onclick="submitConsentSignature()"><i class="bi bi-pen-fill"></i> Sign and submit</button></div></div></div></div>`;}

function closeConsentSigning(){const modal=document.getElementById("cs-modal");if(modal)modal.innerHTML="";_consentSigningDoc=null;_consentChallengeId="";}
function selectedConsentFont(){return document.querySelector('input[name="cs-font"]:checked')?.value||"Caveat";}
function updateConsentSignaturePreview(){const el=document.getElementById("cs-preview-name");if(!el)return;el.textContent=document.getElementById("cs-name")?.value.trim()||"Your name";el.style.fontFamily=`'${selectedConsentFont()}',cursive`;}
async function requestConsentCode(){if(!_consentSigningDoc)return;setStatus("cs-sign-status","Sending a fresh verification code…","loading");try{const res=await apiCall("requestConsentSignatureCode",{docId:_consentSigningDoc.docId});_consentChallengeId=res.challengeId;document.getElementById("cs-code-help").textContent=`Sent to ${res.maskedEmail}; expires in ${res.expiresMinutes} minutes.`;setStatus("cs-sign-status","Verification code sent.","success");}catch(e){setStatus("cs-sign-status",e.message,"error");}}

async function submitConsentSignature(){if(!_consentSigningDoc)return;const checks=["consentElectronic","reviewed","intent","authority","retainCopy"];if(!checks.every(k=>document.getElementById("cs-"+k)?.checked)){setStatus("cs-sign-status","Please accept every required statement.","error");return;}if(!_consentChallengeId){setStatus("cs-sign-status","Email and enter a fresh verification code first.","error");return;}const signerName=document.getElementById("cs-name").value.trim();const code=document.getElementById("cs-code").value.trim();if(signerName.length<2||!/^[0-9]{6}$/.test(code)){setStatus("cs-sign-status","Enter your full legal name and the 6-digit code.","error");return;}const responses=collectConsentResponses();for(const field of (_consentSigningDoc.formSchema?.fields||[])){const value=responses[field.id];const blank=value===undefined||value===null||value===""||value===false||(Array.isArray(value)&&!value.length);if(field.required&&blank){setStatus("cs-sign-status",`Please complete: ${field.label}`,"error");return;}}setStatus("cs-sign-status","Verifying and sealing the document…","loading");try{const font=selectedConsentFont();const res=await apiCall("signConsentDocument",{docId:_consentSigningDoc.docId,challengeId:_consentChallengeId,code,signerName,signerRole:document.getElementById("cs-role").value,font,responses,consentElectronic:true,reviewed:true,intent:true,authority:true,retainCopy:true,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,userAgent:navigator.userAgent});document.querySelector(".cs-modal-body").innerHTML=`<div class="cs-success"><i class="bi bi-patch-check-fill"></i><h2>Signed securely</h2><p>Your verification ID is <strong>${escapeHtml(res.verificationId)}</strong>.</p><p>A completed PDF has been emailed to you for your records.</p><button onclick="closeConsentSigning();initConsentFormsSection(document.getElementById('section-consent-forms'))">Done</button></div>`;}catch(e){setStatus("cs-sign-status",e.message,"error");}}

async function showConsentAudit(docId){const modal=document.getElementById("cs-modal");modal.innerHTML=`<div class="cs-modal-backdrop"><div class="cs-modal-card"><div class="cs-modal-head"><h2 style="margin:0">Signature audit trail</h2><button class="secondary icon-btn" onclick="closeConsentSigning()"><i class="bi bi-x-lg"></i></button></div><div class="cs-modal-body" id="cs-audit-body">Loading…</div></div></div>`;try{const res=await apiCall("getConsentSignatureAudit",{docId});document.getElementById("cs-audit-body").innerHTML=(res.events||[]).map(e=>`<div style="padding:12px;border-left:3px solid #3185fc;margin-bottom:8px;background:#f8fbff"><strong>${escapeHtml(e.event.replace(/_/g," "))}</strong><div style="font-size:11px;color:var(--muted)">${escapeHtml(e.at)}</div>${e.verificationId?`<div style="font-size:12px">Verification: ${escapeHtml(e.verificationId)}</div>`:""}</div>`).join("")||"No audit events found.";}catch(e){document.getElementById("cs-audit-body").textContent=e.message;}}

function renderConsentForms(root, docs, templates, templateError, folderFiles, folderUrl) {
  const docsHtml = docs.length ? docs.map(d => {
    const s = CONSENT_STATUSES[d.status] || CONSENT_STATUSES.draft;
    return `
      <div style="padding:14px;border:1.5px solid var(--border);border-radius:10px;margin-bottom:10px;background:#fff;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(d.title)}</div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:11px;font-weight:700;background:${s.bg};color:${s.color};
                           padding:2px 8px;border-radius:8px;">${escapeHtml(s.label)}</span>
              <span style="font-size:12px;color:var(--muted);">Added ${escapeHtml(d.createdAt)}</span>
              ${d.docUrl ? `<a href="${escapeHtml(d.docUrl)}" target="_blank" rel="noopener"
                style="font-size:12px;color:var(--primary);font-weight:600;text-decoration:none;">
                <i class="bi bi-box-arrow-up-right"></i> Open Doc</a>` : ""}
              ${d.signerName ? `<span style="font-size:12px;color:#065f46;"><i class="bi bi-person-check-fill"></i> Signed by ${escapeHtml(d.signerName)}</span>` : ""}
              ${d.verificationId ? `<span style="font-size:11px;color:var(--muted);"><i class="bi bi-shield-check"></i> ${escapeHtml(d.verificationId)}</span>` : ""}
              ${d.formSchema?.fields?.length ? `<span style="font-size:11px;color:#6d28d9;"><i class="bi bi-ui-checks-grid"></i> ${d.formSchema.fields.length} response fields</span>` : ""}
            </div>
            ${d.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;font-style:italic;">${escapeHtml(d.notes)}</div>` : ""}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            ${d.status !== "signed" && d.docUrl ? `<button class="secondary" style="font-size:11px;padding:4px 10px" onclick="aiBuildConsentResponseForm('${escapeAttr(d.docId)}')"><i class="bi bi-stars"></i> AI Build Form</button>` : ""}
            ${d.signedPdfUrl ? `<a class="secondary cs-button" href="${escapeAttr(d.signedPdfUrl)}" target="_blank" rel="noopener"><i class="bi bi-file-earmark-pdf-fill"></i> Signed copy</a>` : ""}
            ${d.status === "signed" ? `<button class="secondary" style="font-size:11px;padding:4px 10px" onclick="showConsentAudit('${escapeAttr(d.docId)}')"><i class="bi bi-clock-history"></i> Audit</button>` : ""}
            ${d.status !== "signed" ? `<button class="secondary" style="font-size:11px;padding:4px 10px;"
              onclick="openEditConsentDoc('${escapeAttr(d.docId)}','${escapeAttr(d.title)}','${escapeAttr(d.docUrl)}','${escapeAttr(d.status)}','${escapeAttr(d.notes)}')">
              <i class="bi bi-pencil-fill"></i> Edit
            </button>
            <button class="secondary" style="font-size:11px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;"
              onclick="deleteConsentDoc('${escapeAttr(d.docId)}')">
              <i class="bi bi-trash3-fill"></i>
            </button>` : ""}
          </div>
        </div>
      </div>`;
  }).join("") : `<p style="color:var(--muted);font-size:13px;margin:0;">No consent documents added yet.</p>`;

  const templatePickerHtml = templateError
    ? `<div class="alert alert-error" style="margin:0;"><i class="bi bi-exclamation-triangle-fill"></i> <span>Could not load template library: ${escapeHtml(templateError)}</span></div>`
    : buildTemplatePickerHtml(templates);

  const folderFilesHtml = buildFolderFilesHtml(folderFiles, folderUrl);

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-pen-fill"></i> Consent Forms</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">
        Select templates from the practice library to copy to this client's folder, or link individual Google Docs manually.
      </p>
    </div>

    <!-- Client's Drive folder — live view -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <h2 style="margin:0;"><i class="bi bi-folder2-open"></i> Documents in Client Folder</h2>
        <div style="display:flex;gap:8px;align-items:center;">
          ${folderUrl ? `<a href="${escapeHtml(folderUrl)}" target="_blank" rel="noopener"
            class="secondary" style="font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;
            border:1.5px solid var(--border);color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
            <i class="bi bi-folder-symlink"></i> Open in Drive</a>` : ""}
          <button class="secondary" style="font-size:12px;" onclick="refreshConsentFolder()">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px;">
        All files in <strong>Clients/${getClientId()}/Consent Forms/</strong> — includes Google Docs sent for signature and any signed PDFs.
      </p>
      <div id="cf-folder-files">${folderFilesHtml}</div>
    </div>

    <!-- Template picker -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
        <h2 style="margin:0;"><i class="bi bi-files"></i> Send Forms from Template Library</h2>
      </div>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px;">
        Check the forms needed for this client. Copies will be saved to their Drive folder and they'll receive an email notification.
      </p>
      <div id="cf-template-list">${templatePickerHtml}</div>
      <div id="cf-copy-status" style="margin:10px 0;"></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px;">
        <button onclick="copySelectedConsentForms()">
          <i class="bi bi-files"></i> Copy Selected &amp; Email Client
        </button>
        <button class="secondary" onclick="toggleAllConsentTemplates(true)" style="font-size:12px;">Select All</button>
        <button class="secondary" onclick="toggleAllConsentTemplates(false)" style="font-size:12px;">Deselect All</button>
      </div>
    </div>

    <!-- Create a signature-ready form -->
    <div class="card">
      <h2><i class="bi bi-file-earmark-plus-fill"></i> Create a New Signature Form</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px;">Write a form for this client. The portal will create a Google Doc, place it in the client's Consent Forms folder, register it for secure signing, and notify all linked family email addresses.</p>
      <div class="cf-builder-grid">
        <label>Form title<input id="cfb-title" placeholder="e.g. Telehealth Consent"></label>
        <label>Form category<select id="cfb-category"><option>Consent</option><option>Authorization</option><option>Release of Information</option><option>Service Agreement</option><option>Policy Acknowledgment</option><option>Other</option></select></label>
        <label class="wide">Introductory statement<textarea id="cfb-intro" rows="3" placeholder="Explain what the form covers and why the signature is requested."></textarea></label>
        <label class="wide">Form content<textarea id="cfb-content" rows="12" placeholder="Enter the complete form language. Use blank lines to separate paragraphs and start a heading with #."></textarea></label>
        <label class="wide">Additional acknowledgments — one per line<textarea id="cfb-ack" rows="5" placeholder="I understand…&#10;I authorize…&#10;I received…"></textarea></label>
        <label>Response due date<input id="cfb-due" type="date"></label>
        <label>Intended signer<select id="cfb-signer"><option>Parent/legal guardian</option><option>Adult client/self</option><option>Authorized representative</option></select></label>
      </div>
      <div class="alert" style="margin-top:14px"><i class="bi bi-info-circle-fill"></i><span>The standard electronic-record disclosure, identity verification, intent statements, document hashing, and audit certificate will be added automatically.</span></div>
      <div id="cfb-status" style="margin:10px 0"></div>
      <button onclick="createConsentSignatureForm()"><i class="bi bi-send-check-fill"></i> Create Form &amp; Request Signature</button>
    </div>

    <!-- Add new manually -->
    <div class="card">
      <h2><i class="bi bi-plus-circle-fill"></i> Link a Document Manually</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;" class="cf-grid">
        <div class="row">
          <label>Document Title</label>
          <input id="cf-title" placeholder="e.g. HIPAA Authorization Form" style="max-width:100%;">
        </div>
        <div class="row">
          <label>Google Doc URL</label>
          <input id="cf-url" placeholder="https://docs.google.com/…" style="max-width:100%;">
        </div>
        <div class="row" style="grid-column:1/-1;">
          <label>Notes (optional)</label>
          <input id="cf-notes" placeholder="e.g. Please sign and return before next session" style="max-width:100%;">
        </div>
      </div>
      <div id="cf-add-status" style="margin:8px 0;"></div>
      <button onclick="addConsentDoc()"><i class="bi bi-plus-lg"></i> Add &amp; Notify Client</button>
    </div>

    <!-- Tracked docs (status-based) -->
    <div class="card">
      <h2><i class="bi bi-card-checklist"></i> Tracked Documents</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px;">Status-tracked documents — edit status as client reviews and signs each one.</p>
      <div id="cf-docs-list">${docsHtml}</div>
    </div>

    <div id="cf-modal-area"></div><div id="cs-modal"></div>${consentSigningStyles()}

    <style>
      @media (max-width: 640px) { .cf-grid { grid-template-columns: 1fr !important; } }
      .cf-template-group { margin-bottom: 16px; }
      .cf-template-group-label { font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .06em; color: var(--muted); margin-bottom: 6px; }
      .cf-template-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px;
        border: 1.5px solid var(--border); border-radius: 8px; margin-bottom: 6px;
        cursor: pointer; transition: border-color .15s, background .15s; }
      .cf-template-item:hover { border-color: var(--primary); background: #f0f4ff; }
      .cf-template-item input[type=checkbox] { width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; }
      .cf-template-item-name { font-size: 13px; flex: 1; }
      .cf-template-item a { font-size: 11px; color: var(--primary); text-decoration: none; flex-shrink: 0; }
      .cf-folder-file { display:flex;align-items:center;gap:10px;padding:10px 12px;
        border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px; }
      .cf-folder-file-icon { font-size:20px;flex-shrink:0; }
      .cf-folder-file-name { font-size:13px;font-weight:600;flex:1;min-width:0;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .cf-folder-file-meta { font-size:11px;color:var(--muted);flex-shrink:0; }
      .cf-builder-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
      .cf-builder-grid label { display:grid;gap:6px;font-size:12px;font-weight:700; }
      .cf-builder-grid .wide { grid-column:1/-1; }
      .cf-builder-grid input,.cf-builder-grid select,.cf-builder-grid textarea { width:100%;max-width:none; }
      @media (max-width:640px){.cf-builder-grid{grid-template-columns:1fr}.cf-builder-grid .wide{grid-column:auto}}
    </style>`;
}

async function createConsentSignatureForm() {
  const title=(document.getElementById("cfb-title")?.value||"").trim();
  const content=(document.getElementById("cfb-content")?.value||"").trim();
  if(!title||!content){setStatus("cfb-status","Form title and content are required.","error");return;}
  const acknowledgments=(document.getElementById("cfb-ack")?.value||"").split(/\n+/).map(v=>v.trim()).filter(Boolean);
  setStatus("cfb-status","Creating the form and notifying family recipients…","loading");
  try{
    const res=await apiCall("createConsentSignatureForm",{title,content,
      category:document.getElementById("cfb-category")?.value||"Consent",
      intro:(document.getElementById("cfb-intro")?.value||"").trim(),
      acknowledgments,dueDate:document.getElementById("cfb-due")?.value||"",
      intendedSigner:document.getElementById("cfb-signer")?.value||"Parent/legal guardian"});
    setStatus("cfb-status",`Form created. Signature request emailed to ${res.recipientCount||0} recipient${res.recipientCount===1?"":"s"}.`,"success");
    ["cfb-title","cfb-intro","cfb-content","cfb-ack","cfb-due"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
    setTimeout(()=>initConsentFormsSection(document.getElementById("section-consent-forms")),900);
  }catch(e){setStatus("cfb-status","Error: "+e.message,"error");}
}

async function aiBuildConsentResponseForm(docId){
  const modal=document.getElementById("cs-modal");
  modal.innerHTML=`<div class="cs-modal-backdrop"><div class="cs-modal-card"><div class="cs-modal-head"><h2 style="margin:0"><i class="bi bi-stars"></i> AI Form Builder</h2><button class="secondary icon-btn" onclick="closeConsentSigning()"><i class="bi bi-x-lg"></i></button></div><div class="cs-modal-body" id="cs-schema-body"><div class="alert"><i class="bi bi-stars"></i><span>Scanning the Google Doc for questions, selections, dates, acknowledgments, and other client responses…</span></div></div></div></div>`;
  try{const res=await apiCall("analyzeConsentFormFields",{docId});_consentSchemaDraft=res.fields||[];renderConsentSchemaEditor(docId,res.title||"");}
  catch(e){document.getElementById("cs-schema-body").innerHTML=`<div class="alert alert-error"><i class="bi bi-exclamation-triangle-fill"></i><span>${escapeHtml(e.message)}</span></div>`;}
}

function renderConsentSchemaEditor(docId,title){
  const root=document.getElementById("cs-schema-body");
  root.innerHTML=`<p style="color:var(--muted);font-size:13px">Review every detected field before publishing it to the client. AI can miss or misclassify fields.</p><div id="cs-schema-list">${_consentSchemaDraft.map((f,i)=>consentSchemaRow(f,i)).join("")}</div><div id="cs-schema-status" style="margin:10px 0"></div><div style="display:flex;justify-content:space-between;gap:8px"><button class="secondary" onclick="consentAddSchemaField()"><i class="bi bi-plus-lg"></i> Add field</button><button onclick="saveConsentSchema('${escapeAttr(docId)}')"><i class="bi bi-check2-circle"></i> Publish Response Form</button></div>`;
}

function consentSchemaRow(f,i){const types=["text","textarea","date","email","phone","number","select","radio","checkbox"];return `<article class="cf-schema-row" data-index="${i}" style="padding:12px;border:1px solid var(--border);border-radius:11px;margin-bottom:8px"><div style="display:grid;grid-template-columns:1fr 150px auto;gap:8px"><input data-key="label" value="${escapeAttr(f.label||"")}" placeholder="Field label"><select data-key="type">${types.map(t=>`<option ${t===f.type?"selected":""}>${t}</option>`).join("")}</select><button class="secondary icon-btn" onclick="consentRemoveSchemaField(${i})"><i class="bi bi-trash3"></i></button></div><div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px"><input data-key="options" value="${escapeAttr((f.options||[]).join(" | "))}" placeholder="Options separated by | (select/radio only)"><label style="display:flex;align-items:center;gap:6px;font-size:11px"><input data-key="required" type="checkbox" style="width:auto" ${f.required?"checked":""}> Required</label></div></article>`;}
function consentSyncSchemaDraft(){document.querySelectorAll(".cf-schema-row").forEach(row=>{const i=+row.dataset.index;if(!_consentSchemaDraft[i])return;_consentSchemaDraft[i].label=row.querySelector('[data-key="label"]').value.trim();_consentSchemaDraft[i].type=row.querySelector('[data-key="type"]').value;_consentSchemaDraft[i].options=row.querySelector('[data-key="options"]').value.split("|").map(v=>v.trim()).filter(Boolean);_consentSchemaDraft[i].required=row.querySelector('[data-key="required"]').checked;});}
function consentRemoveSchemaField(i){consentSyncSchemaDraft();_consentSchemaDraft.splice(i,1);document.getElementById("cs-schema-list").innerHTML=_consentSchemaDraft.map((f,j)=>consentSchemaRow(f,j)).join("");}
function consentAddSchemaField(){consentSyncSchemaDraft();_consentSchemaDraft.push({id:"field_"+Date.now(),label:"",type:"text",required:false,options:[]});document.getElementById("cs-schema-list").innerHTML=_consentSchemaDraft.map((f,j)=>consentSchemaRow(f,j)).join("");}
async function saveConsentSchema(docId){consentSyncSchemaDraft();if(!_consentSchemaDraft.length||_consentSchemaDraft.some(f=>!f.label)){setStatus("cs-schema-status","Every field needs a label.","error");return;}setStatus("cs-schema-status","Publishing response form…","loading");try{await apiCall("saveConsentFormSchema",{docId,fields:_consentSchemaDraft});closeConsentSigning();showToast("Client response form published.","success");initConsentFormsSection(document.getElementById("section-consent-forms"));}catch(e){setStatus("cs-schema-status",e.message,"error");}}

function buildFolderFilesHtml(files, folderUrl) {
  if (!files.length) {
    return `<p style="color:var(--muted);font-size:13px;margin:0;">
      No files found in client's Consent Forms folder yet.
      ${folderUrl ? "" : "The folder will be created when you first copy forms to this client."}
    </p>`;
  }
  return files.map(f => {
    const icon  = f.isPdf ? "bi-file-earmark-pdf-fill" : f.isDoc ? "bi-file-earmark-text-fill" : "bi-file-earmark-fill";
    const color = f.isPdf ? "#dc2626" : f.isDoc ? "#1d4ed8" : "#6b7280";
    const tag   = f.isPdf
      ? `<span style="font-size:10px;font-weight:700;background:#fee2e2;color:#dc2626;padding:2px 7px;border-radius:6px;">PDF</span>`
      : f.isDoc
        ? `<span style="font-size:10px;font-weight:700;background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:6px;">Google Doc</span>`
        : `<span style="font-size:10px;font-weight:700;background:#f3f4f6;color:#6b7280;padding:2px 7px;border-radius:6px;">File</span>`;
    return `
      <div class="cf-folder-file">
        <i class="bi ${icon} cf-folder-file-icon" style="color:${color};"></i>
        <span class="cf-folder-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        ${tag}
        ${f.modifiedAt ? `<span class="cf-folder-file-meta">${escapeHtml(f.modifiedAt)}</span>` : ""}
        <a href="${escapeHtml(f.url)}" target="_blank" rel="noopener"
           style="font-size:12px;font-weight:600;color:var(--primary);text-decoration:none;flex-shrink:0;">
          <i class="bi bi-box-arrow-up-right"></i> Open
        </a>
      </div>`;
  }).join("");
}

async function refreshConsentFolder() {
  const el = document.getElementById("cf-folder-files");
  if (el) el.innerHTML = `<p style="color:var(--muted);font-size:13px;">Refreshing…</p>`;
  try {
    const res = await apiCall("getConsentFolderFiles", {});
    if (el) el.innerHTML = buildFolderFilesHtml(res.files || [], res.folderUrl || "");
  } catch (e) {
    if (el) el.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${escapeHtml(e.message)}</p>`;
  }
}

function buildTemplatePickerHtml(templates) {
  if (!templates.length) {
    return `<p style="color:var(--muted);font-size:13px;">Could not load template library — check Drive permissions.</p>`;
  }
  const groups = {};
  templates.forEach(t => {
    const key = t.subfolder || "__root__";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return Object.entries(groups).map(([groupKey, files]) => {
    const label = groupKey === "__root__" ? "General" : groupKey;
    const items = files.map(t => `
      <label class="cf-template-item">
        <input type="checkbox" class="cf-template-chk" value="${escapeAttr(t.fileId)}">
        <span class="cf-template-item-name">${escapeHtml(t.name)}</span>
        <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
          <i class="bi bi-box-arrow-up-right"></i> Preview
        </a>
      </label>`).join("");
    return `<div class="cf-template-group">
      <div class="cf-template-group-label"><i class="bi bi-folder-fill"></i> ${escapeHtml(label)}</div>
      ${items}
    </div>`;
  }).join("");
}

function toggleAllConsentTemplates(checked) {
  document.querySelectorAll(".cf-template-chk").forEach(cb => { cb.checked = checked; });
}

async function copySelectedConsentForms() {
  const checked = [...document.querySelectorAll(".cf-template-chk:checked")];
  if (!checked.length) { setStatus("cf-copy-status", "Please select at least one form.", "error"); return; }
  const fileIds = checked.map(cb => cb.value);
  setStatus("cf-copy-status", `Copying ${fileIds.length} form${fileIds.length !== 1 ? "s" : ""} and sending email…`, "loading");
  try {
    const res = await apiCall("copyConsentForms", { fileIds });
    const emailNote = res.emailed
      ? `Email sent to ${escapeHtml(res.clientEmail)}.`
      : res.clientEmail ? "Email could not be sent — check GmailApp permissions." : "No client email on file.";
    document.getElementById("cf-copy-status").innerHTML = `
      <div class="alert" style="border-color:#059669;color:#065f46;background:#d1fae5;">
        <i class="bi bi-check-circle-fill"></i>
        <span>${res.copied} form${res.copied !== 1 ? "s" : ""} copied. ${emailNote}
          ${res.folderUrl ? `&nbsp;<a href="${escapeHtml(res.folderUrl)}" target="_blank"
            style="color:var(--primary);font-weight:700;text-decoration:none;">
            Open Folder <i class="bi bi-box-arrow-up-right"></i></a>` : ""}
        </span>
      </div>`;
    toggleAllConsentTemplates(false);
    refreshConsentFolder();
  } catch (e) {
    setStatus("cf-copy-status", "Error: " + e.message, "error");
  }
}

async function addConsentDoc() {
  const title  = (document.getElementById("cf-title")  || {}).value || "";
  const docUrl = (document.getElementById("cf-url")    || {}).value || "";
  const notes  = (document.getElementById("cf-notes")  || {}).value || "";
  if (!title.trim()) { setStatus("cf-add-status", "Title is required.", "error"); return; }
  setStatus("cf-add-status", "Saving…", "loading");
  try {
    await apiCall("addConsentDoc", { title: title.trim(), docUrl: docUrl.trim(), notes: notes.trim() });
    setStatus("cf-add-status", "Document added — client notified.", "success");
    document.getElementById("cf-title").value = "";
    document.getElementById("cf-url").value   = "";
    document.getElementById("cf-notes").value = "";
    initConsentFormsSection(document.getElementById("section-consent-forms"));
  } catch (e) {
    setStatus("cf-add-status", "Error: " + e.message, "error");
  }
}

function openEditConsentDoc(docId, title, docUrl, status, notes) {
  const statusOptions = Object.entries(CONSENT_STATUSES)
    .map(([v, s]) => `<option value="${v}" ${v === status ? "selected" : ""}>${escapeHtml(s.label)}</option>`)
    .join("");
  document.getElementById("cf-modal-area").innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;
                display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#fff;border-radius:14px;width:100%;max-width:480px;
                  box-shadow:0 20px 60px rgba(0,0,0,.25);">
        <div style="padding:18px 22px;border-bottom:1px solid var(--border);
                    display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:15px;">Edit Consent Document</div>
          <button class="secondary icon-btn" onclick="closeConsentModal()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div style="padding:20px 22px;display:flex;flex-direction:column;gap:14px;">
          <div class="row" style="margin:0;"><label>Title</label>
            <input id="cfe-title" value="${escapeHtml(title)}" style="max-width:100%;"></div>
          <div class="row" style="margin:0;"><label>Google Doc URL</label>
            <input id="cfe-url" value="${escapeHtml(docUrl)}" style="max-width:100%;"></div>
          <div class="row" style="margin:0;"><label>Status</label>
            <select id="cfe-status" style="max-width:100%;">${statusOptions}</select></div>
          <div class="row" style="margin:0;"><label>Notes</label>
            <input id="cfe-notes" value="${escapeHtml(notes)}" style="max-width:100%;"></div>
          <div id="cfe-status-msg"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="secondary" onclick="closeConsentModal()">Cancel</button>
            <button data-id="${escapeAttr(docId)}" onclick="saveConsentDoc(this.dataset.id)">
              <i class="bi bi-floppy-fill"></i> Save
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function closeConsentModal() {
  const el = document.getElementById("cf-modal-area");
  if (el) el.innerHTML = "";
}

async function saveConsentDoc(docId) {
  const title  = (document.getElementById("cfe-title")  || {}).value || "";
  const docUrl = (document.getElementById("cfe-url")    || {}).value || "";
  const status = (document.getElementById("cfe-status") || {}).value || "";
  const notes  = (document.getElementById("cfe-notes")  || {}).value || "";
  setStatus("cfe-status-msg", "Saving…", "loading");
  try {
    await apiCall("updateConsentDoc", { docId, title, docUrl, status, notes });
    closeConsentModal();
    initConsentFormsSection(document.getElementById("section-consent-forms"));
  } catch (e) {
    setStatus("cfe-status-msg", "Error: " + e.message, "error");
  }
}

async function deleteConsentDoc(docId) {
  if (!confirm("Remove this consent document?")) return;
  try {
    await apiCall("deleteConsentDoc", { docId });
    initConsentFormsSection(document.getElementById("section-consent-forms"));
  } catch (e) {
    alert("Error: " + e.message);
  }
}
