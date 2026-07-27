/* ==========================================================================
   PShop — invoice generator (opens a print-ready window; no PDF dependency)
   ========================================================================== */
import { CONFIG } from '../core/config.js';
import { esc, money, fmtDate } from '../core/utils.js';

/** Build the invoice HTML for an order. */
export function invoiceHTML(o) {
  const t = o.totals;
  const a = o.address;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Invoice ${esc(o.invoiceNo || o.id)} — PShop</title>
<style>
  *{box-sizing:border-box;margin:0}
  body{font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#0f172a;padding:40px;background:#fff;line-height:1.55}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;
       border-bottom:3px solid #2563eb;padding-bottom:18px;margin-bottom:24px}
  .brand{font-size:30px;font-weight:800;color:#2563eb;letter-spacing:-.02em}
  .brand small{display:block;font-size:12px;color:#64748b;font-weight:500;letter-spacing:0}
  h1{font-size:20px;text-align:right}
  .muted{color:#64748b;font-size:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
  .box{background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0}
  .box h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:8px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#475569;
     padding:10px 8px;text-align:left;border-bottom:2px solid #e2e8f0}
  td{padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:13px;vertical-align:top}
  th:last-child,td:last-child,th:nth-child(3),td:nth-child(3){text-align:right}
  .totals{margin-left:auto;width:300px;margin-top:16px}
  .totals tr td{border:0;padding:5px 8px}
  .totals tr:last-child td{border-top:2px solid #0f172a;font-weight:800;font-size:16px;padding-top:10px}
  .foot{margin-top:36px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center}
  .pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;
        background:#d1fae5;color:#047857}
  @media print{body{padding:0}.noprint{display:none}}
</style></head>
<body>
  <div class="top">
    <div><div class="brand">PShop<small>PShop Retail India Pvt. Ltd.</small></div>
      <div class="muted" style="margin-top:8px">
        4th Floor, Tech Park, Bengaluru 560103<br>
        GSTIN: 29AABCP1234M1Z5 · ${esc(CONFIG.SUPPORT_EMAIL)}</div></div>
    <div><h1>TAX INVOICE</h1>
      <div class="muted" style="text-align:right;margin-top:6px">
        Invoice: <b>${esc(o.invoiceNo || 'INV-' + o.id)}</b><br>
        Order: <b>${esc(o.id)}</b><br>
        Date: ${fmtDate(o.placedAt)}<br>
        <span class="pill">${esc(o.paymentStatus)}</span></div></div>
  </div>

  <div class="grid">
    <div class="box"><h3>Billed &amp; shipped to</h3>
      <b>${esc(a.name)}</b><br>
      <span class="muted">${esc(a.line1)}${a.landmark ? '<br>Near ' + esc(a.landmark) : ''}<br>
      ${esc(a.city)}, ${esc(a.state)} — ${esc(a.pin)}<br>Phone: ${esc(a.phone)}</span></div>
    <div class="box"><h3>Order information</h3>
      <span class="muted">
        Payment method: <b>${esc(o.payment.label || o.payment.method)}</b><br>
        Transaction ref: ${esc(o.payment.reference || '—')}<br>
        Courier: ${esc(o.courier)} · AWB ${esc(o.awb)}<br>
        Expected delivery: ${fmtDate(o.expectedAt)}</span></div>
  </div>

  <table>
    <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
    <tbody>
      ${o.items.map((i, n) => `<tr>
        <td>${n + 1}</td>
        <td><b>${esc(i.name)}</b>${i.variant ? `<br><span class="muted">${esc(i.variant)}</span>` : ''}
          ${i.brand ? `<br><span class="muted">${esc(i.brand)}</span>` : ''}</td>
        <td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.price * i.qty)}</td></tr>`).join('')}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td>${money(t.subtotal)}</td></tr>
    ${t.savings ? `<tr><td>Product discount</td><td>− ${money(t.savings)}</td></tr>` : ''}
    ${t.discount ? `<tr><td>Coupon${o.coupon ? ' (' + esc(o.coupon.code) + ')' : ''}</td>
      <td>− ${money(t.discount)}</td></tr>` : ''}
    <tr><td>Delivery</td><td>${t.shipping ? money(t.shipping) : 'FREE'}</td></tr>
    ${t.codFee ? `<tr><td>COD fee</td><td>${money(t.codFee)}</td></tr>` : ''}
    <tr><td>GST (inclusive)</td><td>${money(t.tax)}</td></tr>
    <tr><td>Total paid</td><td>${money(t.total)}</td></tr>
  </table>

  <div class="foot">
    This is a computer-generated invoice and does not require a signature.<br>
    Questions? Write to ${esc(CONFIG.SUPPORT_EMAIL)} or call ${esc(CONFIG.SUPPORT_PHONE)}.<br>
    Thank you for shopping with PShop.
  </div>

  <div class="noprint" style="text-align:center;margin-top:28px">
    <button onclick="window.print()" style="padding:11px 26px;border-radius:99px;border:0;
      background:#2563eb;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Print or save as PDF</button>
  </div>
</body></html>`;
}

/** Open the invoice in a new window ready for printing / saving as PDF. */
export function downloadInvoice(order) {
  const win = window.open('', '_blank');
  if (!win) {
    // Popup blocked — fall back to an HTML file download.
    const blob = new Blob([invoiceHTML(order)], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PShop-Invoice-${order.id}.html`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return false;
  }
  win.document.write(invoiceHTML(order));
  win.document.close();
  return true;
}
