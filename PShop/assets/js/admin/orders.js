/* ==========================================================================
   PShop Admin — Manage Orders
   ========================================================================== */
import { adminPage, $, $$, esc, money, icon, toast, orderBadge, tableLoading,
         tableEmpty, openModal, closeModal, wireModal, exportCSV } from './_admin-core.js';
import { api, API } from '../core/api.js';
import { debounce, fmtDate, fmtDateTime, qs } from '../core/utils.js';
import { CONFIG, url } from '../core/config.js';

const STAGES = CONFIG.ORDER_STAGES.concat(['Cancelled']);
let orders = [], term = '', statusFilter = 'all', current = null;

adminPage('orders.html', async () => {
  $('#ico-search').innerHTML = icon('search', 18);
  tableLoading($('#o-rows'), 8);

  const res = await api('adminOrders', {});   // saare customers ke orders
  orders = res.success ? res.data.items : [];

  renderKPIs();
  render();
  wireToolbar();
  wireModal('#o-modal', ['#o-close', '#o-modal-close']);

  // ?id=PS123 se aane par turant detail khol do
  const preset = qs('id');
  if (preset) {
    const o = orders.find(x => x.id === preset);
    if (o) showDetail(o);
  }
});

function renderKPIs() {
  const revenue = orders.filter(o => o.status !== 'Cancelled')
    .reduce((a, o) => a + (Number(o.totals?.total) || 0), 0);
  const pending = orders.filter(o => ['Placed', 'Confirmed', 'Packed'].includes(o.status)).length;
  const delivered = orders.filter(o => o.status === 'Delivered').length;

  $('#order-kpis').innerHTML = [
    ['package', orders.length, 'Total orders'],
    ['clock', pending, 'Awaiting dispatch'],
    ['checkCircle', delivered, 'Delivered'],
    ['dollar', money(revenue), 'Revenue']
  ].map(([ic, val, lbl]) => `
    <article class="kpi"><span class="ico">${icon(ic, 22)}</span>
      <div class="val">${val}</div><div class="lbl">${lbl}</div></article>`).join('');
}

function filtered() {
  let list = orders;
  if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
  if (term) {
    const t = term.toLowerCase();
    list = list.filter(o =>
      o.id.toLowerCase().includes(t) ||
      String(o.address?.name || '').toLowerCase().includes(t) ||
      String(o.awb || '').toLowerCase().includes(t));
  }
  return list;
}

function render() {
  const list = filtered();
  $('#o-count').textContent = `${list.length} order${list.length === 1 ? '' : 's'}`;
  const tbody = $('#o-rows');

  if (!list.length) {
    return tableEmpty(tbody, 8, orders.length
      ? 'No orders match these filters.' : 'No orders have been placed yet.');
  }

  tbody.innerHTML = list.map(o => `
    <tr>
      <td><button class="semi" data-open="${esc(o.id)}"
            style="color:var(--brand-600)">${esc(o.id)}</button>
        <div class="xs muted">${esc(o.awb || '')}</div></td>
      <td><div class="small semi">${esc(o.address?.name || '—')}</div>
        <div class="xs muted">${esc(o.address?.city || '')}</div></td>
      <td class="small">${(o.items || []).length}</td>
      <td class="semi">${money(o.totals?.total || 0)}</td>
      <td><div class="xs">${esc(o.payment?.label || o.payment?.method || '—')}</div>
        <span class="badge ${o.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}"
          style="font-size:9px">${esc(o.paymentStatus || '')}</span></td>
      <td>
        <label class="sr-only" for="st-${esc(o.id)}">Status for ${esc(o.id)}</label>
        <select class="status-select" id="st-${esc(o.id)}" data-status="${esc(o.id)}"
          ${['Cancelled'].includes(o.status) ? 'disabled' : ''}>
          ${STAGES.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          ${!STAGES.includes(o.status) ? `<option selected>${esc(o.status)}</option>` : ''}
        </select>
      </td>
      <td class="muted xs">${fmtDate(o.placedAt)}</td>
      <td><div class="actions">
        <button data-open="${esc(o.id)}" title="View details" aria-label="View">${icon('eye', 16)}</button>
        <button data-inv="${esc(o.id)}" title="Invoice" aria-label="Invoice">${icon('download', 16)}</button>
      </div></td>
    </tr>`).join('');

  wireRows();
}

function wireRows() {
  $$('[data-open]').forEach(b => b.onclick = () => {
    const o = orders.find(x => x.id === b.dataset.open);
    if (o) showDetail(o);
  });

  $$('[data-inv]').forEach(b => b.onclick = async () => {
    const o = orders.find(x => x.id === b.dataset.inv);
    if (!o) return;
    const { downloadInvoice } = await import('../pages/_invoice.js');
    downloadInvoice(o);
  });

  $$('[data-status]').forEach(sel => sel.onchange = async () => {
    const id = sel.dataset.status;
    const status = sel.value;
    sel.disabled = true;
    const res = await api('adminUpdateOrder', { id, status });
    sel.disabled = false;

    if (!res.success) { toast.error(res.message); render(); return; }

    const i = orders.findIndex(x => x.id === id);
    if (i > -1) orders[i] = res.data.order;
    toast.success(res.message);
    renderKPIs();
    render();
  });
}

function showDetail(o) {
  current = o;
  const t = o.totals || {};
  const a = o.address || {};

  $('#o-modal-title').textContent = `Order ${o.id}`;
  $('#o-detail').innerHTML = `
    <div class="flex justify-between items-center mb-4" style="flex-wrap:wrap;gap:.6rem">
      <span class="badge ${orderBadge(o.status)}">${esc(o.status)}</span>
      <span class="xs muted">Placed ${fmtDateTime(o.placedAt)}</span>
    </div>

    <h4 class="mb-2">Items</h4>
    ${(o.items || []).map(i => `
      <div class="order-line">
        <img src="${url(i.image || 'assets/img/misc/placeholder.svg')}" alt=""
             width="48" height="48" style="border-radius:8px;object-fit:cover">
        <div style="flex:1;min-width:0">
          <div class="small semi clamp-1">${esc(i.name)}</div>
          <div class="xs muted">Qty ${i.qty} × ${money(i.price)}</div>
        </div>
        <div class="semi">${money(i.price * i.qty)}</div>
      </div>`).join('')}

    <div class="divider"></div>
    <div class="info-grid">
      <div>
        <h4 class="mb-2">Delivery address</h4>
        <address style="font-style:normal;font-size:var(--fs-sm);color:var(--text-2);line-height:1.6">
          <b style="color:var(--text)">${esc(a.name || '')}</b><br>
          ${esc(a.line1 || '')}<br>${esc(a.city || '')}, ${esc(a.state || '')} — ${esc(a.pin || '')}<br>
          ${icon('phone', 12)} ${esc(a.phone || '')}</address>
      </div>
      <div>
        <h4 class="mb-2">Payment</h4>
        <div class="sum-row"><span class="lbl">Method</span>
          <span class="semi">${esc(o.payment?.label || o.payment?.method || '—')}</span></div>
        <div class="sum-row"><span class="lbl">Status</span>
          <span class="badge ${o.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}">
            ${esc(o.paymentStatus || '')}</span></div>
        <div class="sum-row"><span class="lbl">Reference</span>
          <span class="xs">${esc(o.payment?.reference || '—')}</span></div>
        <div class="sum-row"><span class="lbl">Courier</span>
          <span class="xs">${esc(o.courier || '')} · ${esc(o.awb || '')}</span></div>
      </div>
    </div>

    <div class="divider"></div>
    <h4 class="mb-2">Amount</h4>
    <div class="sum-row"><span class="lbl">Subtotal</span><span>${money(t.subtotal || 0)}</span></div>
    ${t.discount ? `<div class="sum-row"><span class="lbl">Coupon discount</span>
      <span class="save">− ${money(t.discount)}</span></div>` : ''}
    <div class="sum-row"><span class="lbl">Delivery</span>
      <span>${t.shipping ? money(t.shipping) : 'FREE'}</span></div>
    ${t.codFee ? `<div class="sum-row"><span class="lbl">COD fee</span><span>${money(t.codFee)}</span></div>` : ''}
    <div class="sum-row total"><span>Total</span><span>${money(t.total || 0)}</span></div>

    ${o.cancelReason ? `<div class="badge badge-danger mt-4" style="display:block;padding:.6rem">
      Cancelled: ${esc(o.cancelReason)}</div>` : ''}
    ${o.returnReason ? `<div class="badge badge-warning mt-4" style="display:block;padding:.6rem">
      ${esc(o.status)}: ${esc(o.returnReason)}</div>` : ''}`;

  openModal('#o-modal');
}

function wireToolbar() {
  $('#o-search').addEventListener('input', debounce(e => {
    term = e.target.value.trim(); render();
  }, 220));
  $('#o-status').addEventListener('change', e => { statusFilter = e.target.value; render(); });

  $('#o-invoice').addEventListener('click', async () => {
    if (!current) return;
    const { downloadInvoice } = await import('../pages/_invoice.js');
    downloadInvoice(current);
  });

  $('#btn-export').addEventListener('click', () => {
    exportCSV(`pshop-orders-${Date.now()}.csv`, filtered().map(o => ({
      'Order ID': o.id,
      Customer: o.address?.name || '',
      Phone: o.address?.phone || '',
      City: o.address?.city || '',
      Items: (o.items || []).length,
      Total: o.totals?.total || 0,
      Payment: o.payment?.label || o.payment?.method || '',
      'Payment status': o.paymentStatus || '',
      Status: o.status,
      AWB: o.awb || '',
      'Placed at': o.placedAt
    })));
  });
}
