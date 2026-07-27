/* ==========================================================================
   PShop — Order details: timeline, items, cancel / return / replace, invoice
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, $$, esc, money, qs, fmtDate, fmtDateTime, fmtSmart, copyText } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { API } from '../core/api.js';
import { statusBadge } from './_order-ui.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { emptyState, lazyImages } from '../components/lazy-load.js';

let order = null, mode = 'cancel';

page(async () => {
  await initApp({ page: 'order-details', nav: 'orders', newsletter: false });

  const id = qs('id');
  if (!id) return notFound();

  const res = await API.getOrder({ id });
  if (!res.success) return notFound(res.message);

  order = res.data.order;
  render();

  // ?action=cancel / return se aane par modal turant khul jaye
  const action = qs('action');
  if (action === 'cancel' && isCancellable()) openReason('cancel');
  if (action === 'return' && order.status === 'Delivered') openReason('return');
});

function render() {
  $('#od-loading').hidden = true;
  $('#od-content').hidden = false;

  document.title = `Order ${order.id} — PShop`;
  $('#crumb-id').textContent = order.id;
  $('#od-title').textContent = `Order ${order.id}`;
  $('#od-sub').innerHTML = `Placed on ${fmtDate(order.placedAt)} ·
    <span class="semi">${order.items.length} item(s)</span> ·
    ${money(order.totals.total)}
    <button id="copy-id" class="xs" style="color:var(--brand-600);font-weight:700;margin-left:.4rem">
      ${icon('copy', 12)} Copy ID</button>`;
  $('#copy-id').onclick = async () =>
    (await copyText(order.id)) ? toast.success('Order ID copied.') : toast.error('Could not copy.');

  $('#od-status-badge').innerHTML = `<span class="badge ${statusBadge(order.status)}">${esc(order.status)}</span>`;
  $('#btn-track-link').href = url('pages/track-order.html?id=' + order.id);

  renderTimeline();
  renderItems();
  renderAddress();
  renderSummary();
  renderActions();

  $('#od-help').innerHTML = `
    <div class="flex gap-3 items-center">
      <span style="color:var(--brand-600)">${icon('headphones', 22)}</span>
      <div><div class="semi small">Need help with this order?</div>
        <div class="xs muted">Call ${CONFIG.SUPPORT_PHONE}</div>
        <a class="small semi" href="messages.html" style="color:var(--brand-600)">Message support →</a></div>
    </div>`;

  $('#btn-invoice').onclick = async () => {
    const { downloadInvoice } = await import('./_invoice.js');
    downloadInvoice(order);
    toast.success('Invoice opened — use Print to save as PDF.');
  };

  wireReasonModal();
}

function renderTimeline() {
  const stages = order.timeline || [];
  // Aakhri completed stage = current
  let currentIdx = -1;
  stages.forEach((s, i) => { if (s.done) currentIdx = i; });

  $('#od-timeline').innerHTML = stages.map((s, i) => `
    <div class="tl-step ${s.done ? 'done' : ''} ${i === currentIdx ? 'current' : ''}">
      <h4>${esc(s.stage)}</h4>
      <p>${esc(s.note || '')}</p>
      ${s.at ? `<time datetime="${s.at}">${fmtSmart(s.at)}</time>` : ''}
    </div>`).join('');
}

function renderItems() {
  $('#od-items').innerHTML = order.items.map(i => `
    <div class="order-line">
      <img class="lazy" data-src="${url(i.image)}" src="${url('assets/img/misc/placeholder.svg')}"
           alt="${esc(i.name)}" width="60" height="60" loading="lazy">
      <div style="flex:1;min-width:0">
        <a class="semi small clamp-2" href="product-details.html?id=${esc(i.id || i.productId)}">${esc(i.name)}</a>
        <div class="xs muted">${i.variant ? esc(i.variant) + ' · ' : ''}Qty ${i.qty} · ${money(i.price)} each</div>
      </div>
      <div class="text-right">
        <div class="semi">${money(i.price * i.qty)}</div>
        <a class="xs semi" href="product-details.html?id=${esc(i.id || i.productId)}"
           style="color:var(--brand-600)">Buy again</a>
      </div>
    </div>`).join('');
  lazyImages($('#od-items'));
}

function renderAddress() {
  const a = order.address;
  $('#od-address').innerHTML = `
    <div class="semi mb-2">${esc(a.name)} <span class="badge badge-muted">${esc(a.type || 'Home')}</span></div>
    <address style="font-style:normal;color:var(--text-2);font-size:var(--fs-sm);line-height:1.6">
      ${esc(a.line1)}${a.landmark ? `<br>Near ${esc(a.landmark)}` : ''}<br>
      ${esc(a.city)}, ${esc(a.state)} — ${esc(a.pin)}<br>
      ${icon('phone', 12)} ${esc(a.phone)}</address>`;
}

function renderSummary() {
  const t = order.totals;
  $('#od-summary').innerHTML = `
    <div class="sum-row"><span class="lbl">Item total</span><span>${money(t.mrpTotal || t.subtotal)}</span></div>
    ${t.savings ? `<div class="sum-row"><span class="lbl">Discount</span>
      <span class="save">− ${money(t.savings)}</span></div>` : ''}
    ${t.discount ? `<div class="sum-row"><span class="lbl">Coupon${order.coupon ? ' (' + esc(order.coupon.code) + ')' : ''}</span>
      <span class="save">− ${money(t.discount)}</span></div>` : ''}
    <div class="sum-row"><span class="lbl">Delivery</span>
      ${t.shipping ? `<span>${money(t.shipping)}</span>` : '<span class="free">FREE</span>'}</div>
    ${t.codFee ? `<div class="sum-row"><span class="lbl">COD fee</span><span>${money(t.codFee)}</span></div>` : ''}
    <div class="sum-row total"><span>Total</span><span>${money(t.total)}</span></div>
    <div class="sum-row"><span class="lbl xs">Payment method</span>
      <span class="xs semi">${esc(order.payment.label || order.payment.method)}</span></div>
    <div class="sum-row"><span class="lbl xs">Payment status</span>
      <span class="badge ${order.paymentStatus === 'Paid' ? 'badge-success'
        : /Refund/.test(order.paymentStatus) ? 'badge-info' : 'badge-warning'}">${esc(order.paymentStatus)}</span></div>
    ${order.payment.reference ? `<div class="sum-row"><span class="lbl xs">Reference</span>
      <span class="xs muted">${esc(order.payment.reference)}</span></div>` : ''}`;
}

function renderActions() {
  const host = $('#od-actions');
  const rows = [];

  if (isCancellable()) {
    rows.push(`<button class="btn btn-outline btn-block mb-2" id="act-cancel">
      ${icon('xCircle', 16)} Cancel this order</button>`);
  }
  if (order.status === 'Delivered') {
    rows.push(`<button class="btn btn-outline btn-block mb-2" id="act-return">
      ${icon('rotate', 16)} Return this order</button>`);
    rows.push(`<button class="btn btn-outline btn-block mb-2" id="act-replace">
      ${icon('refresh', 16)} Replace this order</button>`);
  }
  rows.push(`<a class="btn btn-ghost btn-block" href="track-order.html?id=${order.id}">
    ${icon('truck', 16)} Track shipment</a>`);

  if (order.cancelReason) {
    rows.unshift(`<div class="badge badge-danger mb-3" style="display:block;padding:.6rem">
      Cancelled: ${esc(order.cancelReason)}</div>`);
  }
  if (order.returnReason) {
    rows.unshift(`<div class="badge badge-warning mb-3" style="display:block;padding:.6rem">
      ${esc(order.status)}: ${esc(order.returnReason)}</div>`);
  }

  host.innerHTML = rows.join('');

  $('#act-cancel')?.addEventListener('click', () => openReason('cancel'));
  $('#act-return')?.addEventListener('click', () => openReason('return'));
  $('#act-replace')?.addEventListener('click', () => openReason('replace'));
}

const isCancellable = () =>
  !['Delivered', 'Cancelled', 'Returned'].includes(order.status) &&
  !/Return|Replacement/.test(order.status);

/* --------------------------- reason modal --------------------------------- */
function openReason(which) {
  mode = which;
  const modal = $('#reason-modal');
  const isCancel = which === 'cancel';

  $('#reason-title').textContent = isCancel ? 'Cancel this order'
    : which === 'replace' ? 'Request a replacement' : 'Return this order';
  $('#reason-help').textContent = isCancel
    ? 'Cancelling is free before the order ships. Any amount paid is refunded within 3–5 business days.'
    : which === 'replace'
      ? 'We will pick up the original item and ship a fresh replacement.'
      : 'We will schedule a free pickup and refund you once the item is collected.';
  $('#reason-submit').textContent = isCancel ? 'Cancel order'
    : which === 'replace' ? 'Request replacement' : 'Request return';
  $('#reason-submit').className = 'btn ' + (isCancel ? 'btn-danger' : 'btn-primary');

  const reasons = isCancel ? CONFIG.CANCEL_REASONS : CONFIG.RETURN_REASONS;
  $('#reason-select').innerHTML = reasons.map(r => `<option>${esc(r)}</option>`).join('');

  modal.classList.add('open');
  document.body.classList.add('no-scroll');
  setTimeout(() => $('#reason-select').focus(), 150);
}

function closeReason() {
  $('#reason-modal').classList.remove('open');
  document.body.classList.remove('no-scroll');
}

function wireReasonModal() {
  $('#reason-close').onclick = closeReason;
  $('#reason-cancel').onclick = closeReason;
  $('#reason-modal .overlay').onclick = closeReason;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#reason-modal').classList.contains('open')) closeReason();
  });

  $('#reason-form').addEventListener('submit', async e => {
    e.preventDefault();
    const note = $('#reason-note').value.trim();
    const reason = $('#reason-select').value + (note ? ` — ${note}` : '');
    const btn = $('#reason-submit');
    btn.classList.add('is-loading');

    try {
      const res = mode === 'cancel'
        ? await API.cancelOrder({ id: order.id, reason })
        : await API.returnOrder({ id: order.id, reason, mode });

      btn.classList.remove('is-loading');
      closeReason();

      if (!res.success) return toast.error(res.message);

      order = res.data.order;
      toast.success(res.message);
      render();
    } catch (err) {
      btn.classList.remove('is-loading');
      closeReason();
      toast.error('Request failed. Please try again.');
      console.error('[PShop] order action error:', err);
    }
  });
}

function notFound(msg) {
  $('#od-loading').hidden = true;
  const host = $('#od-notfound');
  host.hidden = false;
  emptyState(host, {
    icon: '404', title: 'Order not found',
    text: msg || 'We could not find that order. It may have been removed or the link is incorrect.',
    actionLabel: 'View all orders', actionHref: url('pages/orders.html')
  });
}
