// Provider Billing — Stripe-based invoicing and payment tracking.
// Providers can see all client balances, send invoices with a message,
// and view payment history. Clients pay via Stripe's hosted pages.

let _pbClients = [];

async function initProviderBillingSection(root) {
  root.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;">Loading billing overview…</p></div>`;
  try {
    const res = await apiCall("getProviderBillingOverview", {});
    _pbClients = res.clients || [];
    renderProviderBilling(root, _pbClients);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="alert alert-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>Could not load billing: ${escapeHtml(e.message)}</span>
    </div></div>`;
  }
}

function renderProviderBilling(root, clients) {
  const totalOutstanding = clients.reduce((s, c) => s + (c.amountDue || 0), 0);
  const withBalance      = clients.filter(c => c.amountDue > 0).length;
  const paid30           = clients.filter(c => c.lastPaidDaysAgo !== null && c.lastPaidDaysAgo <= 30).length;

  root.innerHTML = `
    <div class="card">
      <h1><i class="bi bi-credit-card-2-front-fill"></i> Client Billing</h1>
      <p style="color:var(--muted);font-size:14px;margin:0;">Send invoices, track payments, and manage client billing via Stripe.</p>
    </div>

    <!-- Summary stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
      ${statCard("currency-dollar",      "Outstanding",       "$" + totalOutstanding.toFixed(2))}
      ${statCard("exclamation-triangle-fill","Balances Due",  withBalance)}
      ${statCard("check-circle-fill",    "Paid (30 days)",    paid30)}
      ${statCard("people-fill",          "Total Clients",     clients.length)}
    </div>

    <!-- Send invoice -->
    <div class="card">
      <h2><i class="bi bi-send-fill"></i> Send Invoice</h2>
      <div class="row">
        <label>Client</label>
        <select id="pb-client-select" onchange="pbLoadClientHistory()">
          <option value="">— select client —</option>
          ${clients.map(c => `<option value="${escapeAttr(c.clientId)}">${escapeHtml(c.clientId)}${c.email ? " — " + c.email : ""}</option>`).join("")}
        </select>
      </div>

      <div id="pb-line-items" style="margin:12px 0;">
        ${pbLineItemRow(0)}
      </div>
      <button class="secondary" style="font-size:12px;margin-bottom:14px;" onclick="pbAddLineItem()">
        <i class="bi bi-plus-circle"></i> Add line item
      </button>

      <div class="row">
        <label>Due date</label>
        <input type="date" id="pb-due-date" value="${new Date(Date.now() + 7*86400000).toISOString().slice(0,10)}" style="max-width:180px;">
      </div>

      <div class="row">
        <label>Message to client</label>
        <textarea id="pb-message" rows="3" placeholder="Thank you for your session. Please find your invoice attached…"
                  style="resize:vertical;"></textarea>
      </div>

      <div id="pb-send-status" style="margin:10px 0;"></div>
      <button onclick="pbSendInvoice()">
        <i class="bi bi-envelope-fill"></i> Send Invoice via Stripe
      </button>
    </div>

    <!-- Client billing overview table -->
    <div class="card">
      <h2><i class="bi bi-table"></i> All Clients — Billing Status</h2>
      <div style="overflow-x:auto;">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Email</th>
              <th>Balance Due</th>
              <th>Last Payment</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${clients.length ? clients.map(c => pbClientRow(c)).join("") :
              `<tr><td colspan="6" style="text-align:center;color:var(--muted);">No clients found.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Selected client payment history -->
    <div class="card" id="pb-history-card" style="display:none;">
      <h2><i class="bi bi-clock-history"></i> Payment History — <span id="pb-history-label"></span></h2>
      <div id="pb-history-list"></div>
    </div>`;
}

function pbClientRow(c) {
  const balanceColor = c.amountDue > 0 ? "#dc2626" : "#059669";
  const statusBadge  = c.stripeStatus === "active"
    ? `<span style="font-size:11px;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:8px;font-weight:700;">Active</span>`
    : c.amountDue > 0
    ? `<span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:8px;font-weight:700;">Balance Due</span>`
    : `<span style="font-size:11px;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:8px;font-weight:700;">No balance</span>`;
  const lastPaid = c.lastPaidAt
    ? new Date(c.lastPaidAt * 1000).toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"})
    : "—";
  return `
    <tr>
      <td style="font-weight:700;">${escapeHtml(c.clientId)}</td>
      <td style="font-size:12px;color:var(--muted);">${escapeHtml(c.email || "—")}</td>
      <td style="font-weight:700;color:${balanceColor};">$${(c.amountDue || 0).toFixed(2)}</td>
      <td style="font-size:12px;color:var(--muted);">${escapeHtml(lastPaid)}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="secondary" style="font-size:11px;padding:4px 10px;"
                onclick="pbSelectClient('${escapeAttr(c.clientId)}')">
          <i class="bi bi-eye-fill"></i> History
        </button>
      </td>
    </tr>`;
}

let _pbLineCount = 1;
function pbLineItemRow(idx) {
  const packages = ["Sprint (8 wk)", "Journey (16 wk)", "Odyssey (32 wk)", "Assessment", "Session", "Other"];
  return `
    <div id="pb-line-${idx}" style="display:grid;grid-template-columns:1fr 100px 28px;gap:8px;align-items:center;margin-bottom:6px;">
      <select id="pb-desc-${idx}" style="font-size:13px;">
        ${packages.map(p => `<option>${p}</option>`).join("")}
        <option value="_custom">Custom…</option>
      </select>
      <div style="position:relative;">
        <span style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;">$</span>
        <input id="pb-amt-${idx}" type="number" min="0" step="0.01" placeholder="0.00"
               style="padding-left:22px;font-size:13px;width:100%;">
      </div>
      ${idx > 0 ? `<button class="secondary" style="padding:4px 6px;font-size:13px;color:#dc2626;border-color:#fca5a5;"
               onclick="document.getElementById('pb-line-${idx}').remove()">
        <i class="bi bi-x"></i></button>` : `<div></div>`}
    </div>`;
}

function pbAddLineItem() {
  const container = document.getElementById("pb-line-items");
  if (!container) return;
  const div = document.createElement("div");
  div.innerHTML = pbLineItemRow(_pbLineCount++);
  container.appendChild(div.firstElementChild);
}

async function pbSendInvoice() {
  const clientId = document.getElementById("pb-client-select")?.value;
  if (!clientId) { setStatus("pb-send-status", "Select a client first.", "error"); return; }

  // Collect line items
  const lineItems = [];
  let i = 0;
  while (true) {
    const descEl = document.getElementById("pb-desc-" + i);
    const amtEl  = document.getElementById("pb-amt-"  + i);
    if (!descEl) break;
    const desc   = descEl.value.trim();
    const amount = parseFloat(amtEl?.value || 0);
    if (desc && amount > 0) lineItems.push({ description: desc === "_custom" ? "Service" : desc, amount });
    i++;
    if (i > 20) break;
  }

  if (!lineItems.length) { setStatus("pb-send-status", "Add at least one line item with an amount.", "error"); return; }

  const dueDate = document.getElementById("pb-due-date")?.value;
  const message = document.getElementById("pb-message")?.value?.trim() || "";

  setStatus("pb-send-status", "Creating and sending invoice via Stripe…", "loading");
  try {
    const res = await apiCall("sendInvoice", { clientId, lineItems, dueDate, message });
    setStatus("pb-send-status",
      `Invoice sent! Total: $${res.total.toFixed(2)}. Stripe will email ${res.clientEmail} with a payment link.`,
      "success");
    if (typeof showToast === "function") showToast("Invoice sent to " + res.clientEmail, "success");
    // Reload overview after a moment
    setTimeout(() => initProviderBillingSection(document.getElementById("section-provider-billing")), 2000);
  } catch (e) {
    setStatus("pb-send-status", "Error: " + e.message, "error");
  }
}

function pbSelectClient(clientId) {
  const select = document.getElementById("pb-client-select");
  if (select) select.value = clientId;
  pbLoadClientHistory();
}

async function pbLoadClientHistory() {
  const clientId = document.getElementById("pb-client-select")?.value;
  const card     = document.getElementById("pb-history-card");
  const list     = document.getElementById("pb-history-list");
  const label    = document.getElementById("pb-history-label");
  if (!card || !list) return;
  if (!clientId) { card.style.display = "none"; return; }
  card.style.display = "";
  if (label) label.textContent = clientId;
  list.innerHTML = `<p style="color:var(--muted);font-size:13px;">Loading…</p>`;
  try {
    const res = await apiCall("getClientBilling", { clientId });
    list.innerHTML = pbInvoiceListHtml(res.invoices || []);
  } catch (e) {
    list.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${escapeHtml(e.message)}</p>`;
  }
}

function pbInvoiceListHtml(invoices) {
  if (!invoices.length) return `<p style="color:var(--muted);font-size:13px;margin:0;">No invoices found.</p>`;
  const fmtDate = ts => ts ? new Date(ts * 1000).toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"}) : "—";
  const STATUS_STYLE = {
    paid:       "background:#d1fae5;color:#065f46",
    open:       "background:#fef3c7;color:#92400e",
    draft:      "background:#f3f4f6;color:#6b7280",
    void:       "background:#f3f4f6;color:#6b7280",
    uncollectible: "background:#fee2e2;color:#991b1b"
  };
  return `
    <div style="overflow-x:auto;">
      <table class="summary-table">
        <thead>
          <tr><th>Date</th><th>Description</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          ${invoices.map(inv => {
            const style = STATUS_STYLE[inv.status] || STATUS_STYLE.draft;
            const desc  = (inv.lines || []).map(l => l.description).join(", ") || "Invoice";
            return `
              <tr>
                <td style="font-size:12px;">${fmtDate(inv.created)}</td>
                <td style="font-size:12px;">${escapeHtml(desc.slice(0, 60))}</td>
                <td style="font-weight:700;">$${((inv.amount_due || 0) / 100).toFixed(2)}</td>
                <td style="font-size:12px;color:var(--muted);">${fmtDate(inv.due_date)}</td>
                <td><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;${style};">${inv.status}</span></td>
                <td>
                  ${inv.hosted_invoice_url ? `<a href="${escapeHtml(inv.hosted_invoice_url)}" target="_blank" rel="noopener"
                     style="font-size:12px;font-weight:600;color:var(--primary);text-decoration:none;">
                    <i class="bi bi-box-arrow-up-right"></i> View
                  </a>` : ""}
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}
