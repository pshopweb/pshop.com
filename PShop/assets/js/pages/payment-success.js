/* ==========================================================================
   PShop — Order confirmation page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, esc, money, qs, fmtDate, fmtDelivery, copyText } from '../core/utils.js';
import { API } from '../core/api.js';
import { renderProducts } from '../components/product-card.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { emptyState, lazyImages } from '../components/lazy-load.js';

page(async () => {
  await initApp({ page: 'payment-success', nav: '', newsletter: false });

  const id = qs('id');
  const res = id ? await API.getOrder({ id }) : { success: false };

  if (!res.success) {
    $('#ok-shell').hidden = true;
    emptyState($('.result-hero'), {
      title: 'Order not found',
      text: 'We could not locate that order. Check your orders page for the latest status.',
      actionLabel: 'View my orders', actionHref: url('pages/orders.html')
    });
    return;
  }

  const o = res.data.order;

  $('#ok-icon').innerHTML = icon('check', 48);
  $('#order-ref').innerHTML = `${icon('package', 15)} Order ID: ${esc(o.id)}
    <button id="copy-id" aria-label="Copy order ID" style="color:var(--brand-600)">${icon('copy', 14)}</button>`;
  $('#copy-id').addEventListener('click', async () => {
    (await copyText(o.id)) ? toast.success('Order ID copied.') : toast.error('Could not copy.');
  });

  $('#btn-track').href = url('pages/track-order.html?id=' + o.id);
  $('#btn-details').href = url('pages/order-details.html?id=' + o.id);

  /* items */
  $('#ok-items').innerHTML = o.items.map(i => `
    <div class="order-line">
      <img class="lazy" data-src="${url(i.image)}" src="${url('assets/img/misc/placeholder.svg')}"
           alt="${esc(i.name)}" width="60" height="60" loading="lazy">
      <div style="flex:1;min-width:0">
        <div class="semi small clamp-2">${esc(i.name)}</div>
        <div class="xs muted">${i.variant ? esc(i.variant) + ' · ' : ''}Qty ${i.qty}</div>
      </div>
      <div class="semi">${money(i.price * i.qty)}</div>
    </div>`).join('');
  lazyImages($('#ok-items'));

  /* address */
  const a = o.address;
  $('#ok-address').innerHTML = `
    <div class="semi mb-2">${esc(a.name)}</div>
    <address style="font-style:normal;color:var(--text-2);font-size:var(--fs-sm);line-height:1.6">
      ${esc(a.line1)}${a.landmark ? `<br>Near ${esc(a.landmark)}` : ''}<br>
      ${esc(a.city)}, ${esc(a.state)} — ${esc(a.pin)}<br>
      ${icon('phone', 12)} ${esc(a.phone)}</address>`;

  /* payment summary */
  const t = o.totals;
  $('#ok-summary').innerHTML = `
    <div class="sum-row"><span class="lbl">Item total</span><span>${money(t.mrpTotal || t.subtotal)}</span></div>
    ${t.savings ? `<div class="sum-row"><span class="lbl">Discount</span><span class="save">− ${money(t.savings)}</span></div>` : ''}
    ${t.discount ? `<div class="sum-row"><span class="lbl">Coupon</span><span class="save">− ${money(t.discount)}</span></div>` : ''}
    <div class="sum-row"><span class="lbl">Delivery</span>
      ${t.shipping ? `<span>${money(t.shipping)}</span>` : '<span class="free">FREE</span>'}</div>
    ${t.codFee ? `<div class="sum-row"><span class="lbl">COD fee</span><span>${money(t.codFee)}</span></div>` : ''}
    <div class="sum-row total"><span>Paid via ${esc(o.payment.label || o.payment.method)}</span>
      <span>${money(t.total)}</span></div>
    <div class="sum-row"><span class="lbl xs">Payment status</span>
      <span class="badge ${o.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}">${esc(o.paymentStatus)}</span></div>`;

  $('#ok-eta').innerHTML = `
    <div class="flex gap-3 items-center">
      <span style="color:var(--brand-600)">${icon('truck', 24)}</span>
      <div><div class="semi">Expected delivery</div>
        <div class="small muted">${fmtDelivery(o.expectedAt)}</div>
        <div class="xs muted mt-1">Tracking ID: ${esc(o.awb)}</div></div>
    </div>`;

  $('#btn-invoice').addEventListener('click', async () => {
    const { downloadInvoice } = await import('./_invoice.js');
    downloadInvoice(o);
  });

  celebrate();

  /* recommendations */
  const rec = await API.getProducts({ tag: 'recommended', pageSize: 10, sort: 'rating' });
  if (rec.success) renderProducts($('#ok-rail'), rec.data.items);
});

/** Lightweight confetti burst — pure CSS animation, no library. */
function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#2563eb', '#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
    c.style.animationDelay = (Math.random() * 0.6) + 's';
    document.body.append(c);
    setTimeout(() => c.remove(), 5200);
  }
}
