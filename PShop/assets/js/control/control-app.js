/* ==========================================================================
   Control Web Payment — Main Application
   Order & Payment management panel for PShop
   ========================================================================== */
import { CONFIG, url, ROOT } from '../core/config.js';
import { $, $$, esc, money, fmtDate, fmtDateTime, debounce } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { API, api, isLiveBackend } from '../core/api.js';
import { Theme } from '../components/theme.js';
import { icon } from '../components/icons.js';
import { Store } from '../core/storage.js';

const CURRENCY = CONFIG.CURRENCY;
const STAGES = CONFIG.ORDER_STAGES.concat(['Cancelled']);
let orders = [], payments = [], currentOrder = null;
let searchTerm = '', statusFilter = 'all', paymentFilter = 'all';

/* ====================== BOOT ====================== */
Theme.init();

if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
  $('#cwp-gate').hidden = false;
  if (Auth.isLoggedIn()) {
    $('#gate-msg').textContent = 'You need admin access to manage orders.';
  }
  $('#gate-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#g-submit');
    btn.classList.add('is-loading'); btn.disabled = true;
    try {
      const res = await API.login({
        identifier: $('#g-email').value.trim(),
        password: $('#g-pass').value
      });
      if (!res.success) { toast(res.message, 'error'); btn.classList.remove('is-loading'); btn.disabled = false; return; }
      if (res.data.user?.role !== 'admin') {
        Auth.logout();
        toast('Admin access required.', 'error');
        btn.classList.remove('is-loading'); btn.disabled = false; return;
      }
      loadPanel();
    } catch (err) {
      toast('Login failed. Try again.', 'error');
      btn.classList.remove('is-loading'); btn.disabled = false;
    }
  });
} else {
  loadPanel();
}

function loadPanel() {
  $('#cwp-gate').hidden = true;
  $('#cwp-shell').hidden = false;
  $('#cwp-user-name').textContent = Auth.user().name;
  const live = isLiveBackend();
  const badge = $('#cwp-backend-badge');
  badge.textContent = live ? 'Live' : 'Demo';
  badge.className = 'cwp-badge ' + (live ? 'cwp-badge-green' : '');

  wireNavigation();
  wireChrome();
  loadOrders();
}

/* ====================== NAVIGATION ====================== */
function wireNavigation() {
  $$('.cwp-nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      $$('.cwp-nav-btn[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
      $$('.cwp-tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
      const titles = { dashboard: 'Dashboard', orders: 'All Orders', payments: 'Payments', cancelled: 'Cancelled Orders' };
      $('#cwp-title').textContent = titles[tab] || 'Dashboard';
      if (tab === 'payments') renderPayments();
      if (tab === 'cancelled') renderCancelled();
    });
  });
}

function wireChrome() {
  const side = $('#cwp-side'), overlay = $('#cwp-overlay'), burger = $('#cwp-burger');
  const toggle = open => {
    side.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
  };
  burger.addEventListener('click', () => toggle(true));
  overlay.addEventListener('click', () => toggle(false));
  $$('#cwp-nav a, .cwp-side-foot a').forEach(a => a.addEventListener('click', () => toggle(false)));

  $('#cwp-theme-btn').addEventListener('click', () => {
    Theme.set(Theme.resolved() === 'dark' ? 'light' : 'dark');
  });

  $('#cwp-logout').addEventListener('click', () => {
    Auth.logout();
    toast('Signed out.', 'info');
    setTimeout(() => location.href = url('index.html'), 600);
  });
}

/* ====================== LOAD DATA ====================== */
async function loadOrders() {
  try {
    const res = await api('adminOrders', {});
    orders = res.success ? res.data.items : [];
  } catch { orders = []; }
  renderDashboard();
  renderOrders();
}

/* ====================== DASHBOARD ====================== */
function renderDashboard() {
  const active = orders.filter(o => o.status !== 'Cancelled');
  const revenue = active.reduce((a, o) => a + (Number(o.totals?.total) || 0), 0);
  const pending = orders.filter(o => ['Placed', 'Confirmed', 'Packed'].includes(o.status)).length;
  const delivered = orders.filter(o => o.status === 'Delivered').length;
  const cancelled = orders.filter(o => o.status === 'Cancelled').length;
  const paid = orders.filter(o => o.paymentStatus === 'Paid').length;

  $('#cwp-kpis').innerHTML = [
    ['package', orders.length, 'Total Orders', 'var(--cwp-info-bg)', 'var(--cwp-info)'],
    ['clock', pending, 'Pending', 'var(--cwp-warning-bg)', 'var(--cwp-warning)'],
    ['checkCircle', delivered, 'Delivered', 'var(--cwp-success-bg)', 'var(--cwp-success)'],
    ['dollar', money(revenue), 'Revenue', 'var(--cwp-brand-light)', 'var(--cwp-brand)'],
    ['xCircle', cancelled, 'Cancelled', 'var(--cwp-danger-bg)', 'var(--cwp-danger)'],
    ['creditCard', paid, 'Paid Orders', 'var(--cwp-success-bg)', 'var(--cwp-success)']
  ].map(([ic, val, lbl, bg, clr]) => `
    <div class="cwp-kpi">
      <div class="cwp-kpi-ico" style="background:${bg};color:${clr}">${getIcon(ic)}</div>
      <div><div class="cwp-kpi-val">${val}</div><div class="cwp-kpi-lbl">${lbl}</div></div>
    </div>`).join('');

  // Revenue chart (last 14 days)
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayRev = active.filter(o => o.placedAt?.slice(0, 10) === key)
      .reduce((a, o) => a + (Number(o.totals?.total) || 0), 0);
    days.push({ label: d.toLocaleDateString('en', { day: '2-digit', month: 'short' }), value: dayRev });
  }
  const maxRev = Math.max(...days.map(d => d.value), 1);
  $('#cwp-rev-chart').innerHTML = days.map(d =>
    `<div class="bar" style="height:${Math.max(3, (d.value / maxRev) * 100)}%" data-label="${esc(d.label)}">
      <span>${d.value > 0 ? money(d.value) : ''}</span></div>`).join('');
  $('#cwp-rev-total').textContent = money(revenue);

  // Status donut
  const statusCounts = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const colors = { Placed: '#3b82f6', Confirmed: '#2563eb', Packed: '#f59e0b', Shipped: '#6366f1',
    'Out for Delivery': '#8b5cf6', Delivered: '#10b981', Cancelled: '#ef4444' };
  const slices = Object.entries(statusCounts).map(([label, value]) => ({ label, value, color: colors[label] || '#94a3b8' }));
  renderDonut($('#cwp-status-chart'), slices);

  // Recent orders table
  const recent = orders.slice(0, 8);
  $('#cwp-recent').innerHTML = recent.map(o => `
    <tr>
      <td class="semi">${esc(o.id)}</td>
      <td>${esc(o.address?.name || '—')}</td>
      <td class="semi">${money(o.totals?.total || 0)}</td>
      <td><span class="cwp-status cwp-status-${statusClass(o.paymentStatus)}">${esc(o.paymentStatus || '—')}</span></td>
      <td><span class="cwp-status cwp-status-${statusClass(o.status)}">${esc(o.status)}</span></td>
      <td class="xs">${fmtDate(o.placedAt)}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="cwp-empty">No orders yet</td></tr>';
}

function renderDonut(host, slices) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) { host.innerHTML = '<p class="cwp-muted">No orders yet.</p>'; return; }
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices.filter(s => s.value > 0).map(s => {
    const len = (s.value / total) * C;
    const arc = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${s.color}" stroke-width="22"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"><title>${s.label}: ${s.value}</title></circle>`;
    offset += len; return arc;
  }).join('');
  host.innerHTML = `
    <svg viewBox="0 0 140 140" width="140" height="140">
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--cwp-border)" stroke-width="22"/>${arcs}</svg>
    <div class="cwp-donut-legend">${slices.map(s =>
      `<div><i style="background:${s.color}"></i><span>${esc(s.label)}</span><span class="n">${s.value}</span></div>`
    ).join('')}</div>`;
}

/* ====================== ORDERS TAB ====================== */
function renderOrders() {
  const list = filteredOrders();
  $('#o-count').textContent = `${list.length} Order${list.length !== 1 ? 's' : ''}`;
  const tbody = $('#o-rows');
  if (!list.length) {
    tbody.innerHTML = '';
    $('#o-empty').hidden = false;
    $('#o-empty').innerHTML = `<p class="cwp-empty">${orders.length ? 'No orders match these filters.' : 'No orders yet.'}</p>`;
    return;
  }
  $('#o-empty').hidden = true;
  tbody.innerHTML = list.map(o => `
    <tr>
      <td><button class="semi" style="color:var(--cwp-brand);background:none;border:none;cursor:pointer;font-weight:600"
            data-view="${esc(o.id)}">${esc(o.id)}</button>
        <div class="xs">${esc(o.awb || '')}</div></td>
      <td><div class="semi">${esc(o.address?.name || '—')}</div>
        <div class="xs">${esc(o.address?.phone || '')}</div></td>
      <td>${(o.items || []).length}</td>
      <td class="semi">${money(o.totals?.total || 0)}</td>
      <td><div class="semi">${esc(o.payment?.label || '—')}</div>
        <span class="cwp-status cwp-status-${statusClass(o.paymentStatus)}">${esc(o.paymentStatus || '')}</span></td>
      <td><select class="status-sel" data-status="${esc(o.id)}"
            ${o.status === 'Cancelled' ? 'disabled' : ''}>
            ${STAGES.map(s => `<option${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}
          </select></td>
      <td class="xs">${fmtDate(o.placedAt)}</td>
      <td><div class="actions">
        <button data-view="${esc(o.id)}" title="View">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div></td>
    </tr>`).join('');

  $$('[data-view]').forEach(b => b.addEventListener('click', () => {
    const o = orders.find(x => x.id === b.dataset.view);
    if (o) showOrderDetail(o);
  }));

  $$('[data-status]').forEach(sel => sel.addEventListener('change', async () => {
    const id = sel.dataset.status;
    const status = sel.value;
    sel.disabled = true;
    try {
      const res = await api('adminUpdateOrder', { id, status });
      if (!res.success) { toast(res.message, 'error'); renderOrders(); return; }
      const i = orders.findIndex(x => x.id === id);
      if (i > -1) orders[i] = res.data.order;
      toast('Status updated: ' + status, 'success');
      renderDashboard(); renderOrders();
    } catch { toast('Update failed', 'error'); }
    sel.disabled = false;
  }));
}

function filteredOrders() {
  let list = orders;
  if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
  if (paymentFilter !== 'all') list = list.filter(o => o.paymentStatus === paymentFilter);
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    list = list.filter(o =>
      o.id.toLowerCase().includes(t) ||
      String(o.address?.name || '').toLowerCase().includes(t) ||
      String(o.awb || '').toLowerCase().includes(t) ||
      String(o.address?.phone || '').includes(t));
  }
  return list;
}

/* ====================== PAYMENTS TAB ====================== */
function renderPayments() {
  const paid = orders.filter(o => o.paymentStatus === 'Paid');
  const pending = orders.filter(o => o.paymentStatus === 'Pending');
  const refund = orders.filter(o => o.paymentStatus === 'Refund initiated');
  const totalPaid = paid.reduce((a, o) => a + (Number(o.totals?.total) || 0), 0);
  const totalPending = pending.reduce((a, o) => a + (Number(o.totals?.total) || 0), 0);

  $('#cwp-pay-kpis').innerHTML = [
    ['checkCircle', paid.length, 'Paid', 'var(--cwp-success-bg)', 'var(--cwp-success)'],
    ['clock', pending.length, 'Pending', 'var(--cwp-warning-bg)', 'var(--cwp-warning)'],
    ['rotate', refund.length, 'Refunds', 'var(--cwp-danger-bg)', 'var(--cwp-danger)'],
    ['dollar', money(totalPaid), 'Collected', 'var(--cwp-brand-light)', 'var(--cwp-brand)']
  ].map(([ic, val, lbl, bg, clr]) => `
    <div class="cwp-kpi">
      <div class="cwp-kpi-ico" style="background:${bg};color:${clr}">${getIcon(ic)}</div>
      <div><div class="cwp-kpi-val">${val}</div><div class="cwp-kpi-lbl">${lbl}</div></div>
    </div>`).join('');

  $('#pay-rows').innerHTML = orders.map(o => `
    <tr>
      <td class="semi">${esc(o.payment?.reference || '—')}</td>
      <td><button class="semi" style="color:var(--cwp-brand);background:none;border:none;cursor:pointer"
            data-view-pay="${esc(o.id)}">${esc(o.id)}</button></td>
      <td>${esc(o.payment?.label || o.payment?.method || '—')}</td>
      <td class="semi">${money(o.totals?.total || 0)}</td>
      <td><span class="cwp-status cwp-status-${statusClass(o.paymentStatus)}">${esc(o.paymentStatus || '—')}</span></td>
      <td class="xs">${fmtDate(o.placedAt)}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="cwp-empty">No payment records</td></tr>';

  $$('[data-view-pay]').forEach(b => b.addEventListener('click', () => {
    const o = orders.find(x => x.id === b.dataset.viewPay);
    if (o) showOrderDetail(o);
  }));

  $('#btn-export-payments')?.addEventListener('click', () => {
    exportCSV('payments-' + Date.now() + '.csv', orders.map(o => ({
      'Order ID': o.id, 'Reference': o.payment?.reference || '',
      'Method': o.payment?.label || o.payment?.method || '',
      'Amount': o.totals?.total || 0, 'Status': o.paymentStatus || '',
      'Date': o.placedAt || ''
    })));
  });
}

/* ====================== CANCELLED TAB ====================== */
function renderCancelled() {
  const list = orders.filter(o => o.status === 'Cancelled');
  $('#cancel-count').textContent = `${list.length} Cancelled Order${list.length !== 1 ? 's' : ''}`;
  if (!list.length) {
    $('#cancel-rows').innerHTML = '';
    $('#cancel-empty').hidden = false;
    $('#cancel-empty').innerHTML = '<p class="cwp-empty">No cancelled orders.</p>';
    return;
  }
  $('#cancel-empty').hidden = true;
  $('#cancel-rows').innerHTML = list.map(o => `
    <tr>
      <td class="semi">${esc(o.id)}</td>
      <td>${esc(o.address?.name || '—')}</td>
      <td class="semi">${money(o.totals?.total || 0)}</td>
      <td class="xs">${esc(o.cancelReason || 'Not specified')}</td>
      <td><span class="cwp-status cwp-status-${statusClass(o.paymentStatus)}">${esc(o.paymentStatus || '—')}</span></td>
      <td class="xs">${fmtDate(o.cancelledAt || o.placedAt)}</td>
      <td><button class="cwp-btn cwp-btn-sm" data-reinstate="${esc(o.id)}">Reinstate</button></td>
    </tr>`).join('');

  $$('[data-reinstate]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.reinstate;
    const res = await api('adminUpdateOrder', { id, status: 'Confirmed' });
    if (res.success) {
      toast('Order reinstated.', 'success');
      const i = orders.findIndex(x => x.id === id);
      if (i > -1) orders[i] = res.data.order;
      renderDashboard(); renderOrders(); renderCancelled();
    } else toast(res.message, 'error');
  }));
}

/* ====================== ORDER DETAIL MODAL ====================== */
function showOrderDetail(o) {
  currentOrder = o;
  const t = o.totals || {}, a = o.address || {};
  $('#om-title').textContent = 'Order ' + o.id;
  $('#om-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:1.2rem;flex-wrap:wrap">
      <span class="cwp-status cwp-status-${statusClass(o.status)}">${esc(o.status)}</span>
      <span class="cwp-status cwp-status-${statusClass(o.paymentStatus)}">${esc(o.paymentStatus || '')}</span>
      <span class="cwp-xs cwp-muted">Placed ${fmtDateTime(o.placedAt)}</span>
    </div>

    <div class="cwp-detail-section">
      <h4>Items (${(o.items || []).length})</h4>
      ${(o.items || []).map(i => `
        <div class="cwp-detail-item">
          <img src="${url(i.image || 'assets/img/misc/placeholder.svg')}" alt="" width="48" height="48">
          <div style="flex:1;min-width:0">
            <div class="name">${esc(i.name)}</div>
            <div class="meta">Qty ${i.qty} × ${money(i.price)}${i.variant ? ' · ' + esc(i.variant) : ''}</div>
          </div>
          <div class="price">${money(i.price * i.qty)}</div>
        </div>`).join('')}
    </div>

    <div class="cwp-detail-grid">
      <div class="cwp-detail-section">
        <h4>Delivery Address</h4>
        <div style="font-size:.85rem;color:var(--cwp-text-2);line-height:1.7">
          <b style="color:var(--cwp-text)">${esc(a.name || '')}</b><br>
          ${esc(a.line1 || '')}<br>${esc(a.city || '')}, ${esc(a.state || '')} — ${esc(a.pin || '')}<br>
          Phone: ${esc(a.phone || '')}
        </div>
      </div>
      <div class="cwp-detail-section">
        <h4>Payment Details</h4>
        <div class="cwp-detail-row"><span class="lbl">Method</span><span class="val">${esc(o.payment?.label || '—')}</span></div>
        <div class="cwp-detail-row"><span class="lbl">Reference</span><span class="val">${esc(o.payment?.reference || '—')}</span></div>
        <div class="cwp-detail-row"><span class="lbl">Courier</span><span class="val">${esc(o.courier || '')}</span></div>
        <div class="cwp-detail-row"><span class="lbl">AWB</span><span class="val">${esc(o.awb || '—')}</span></div>
      </div>
    </div>

    <div class="cwp-detail-section">
      <h4>Amount Summary</h4>
      <div class="cwp-detail-row"><span class="lbl">Subtotal</span><span class="val">${money(t.subtotal || 0)}</span></div>
      ${t.savings ? `<div class="cwp-detail-row"><span class="lbl">Discount</span><span class="val" style="color:var(--cwp-success)">− ${money(t.savings)}</span></div>` : ''}
      ${t.discount ? `<div class="cwp-detail-row"><span class="lbl">Coupon</span><span class="val" style="color:var(--cwp-success)">− ${money(t.discount)}</span></div>` : ''}
      <div class="cwp-detail-row"><span class="lbl">Delivery</span><span class="val">${t.shipping ? money(t.shipping) : 'FREE'}</span></div>
      ${t.codFee ? `<div class="cwp-detail-row"><span class="lbl">COD Fee</span><span class="val">${money(t.codFee)}</span></div>` : ''}
      <div class="cwp-detail-row" style="font-weight:800;font-size:1rem;border-top:2px solid var(--cwp-border);padding-top:.6rem">
        <span>Total</span><span>${money(t.total || 0)}</span></div>
    </div>

    ${o.cancelReason ? `<div style="background:var(--cwp-danger-bg);padding:.8rem;border-radius:var(--cwp-radius-sm);color:var(--cwp-danger);font-size:.85rem">
      <b>Cancelled:</b> ${esc(o.cancelReason)}</div>` : ''}`;

  // Show/hide cancel button
  $('#om-cancel').style.display = o.status === 'Cancelled' ? 'none' : '';
  $('#om-cancel').textContent = 'Cancel Order';

  openModal('order-modal');
}

/* ====================== STATUS UPDATE MODAL ====================== */
function showStatusModal(o) {
  currentOrder = o;
  $('#sm-status').value = o.status;
  toggleReasonField();
  openModal('status-modal');
}

$('#sm-status').addEventListener('change', toggleReasonField);
function toggleReasonField() {
  const isCancel = $('#sm-status').value === 'Cancelled';
  $('#sm-reason-wrap').hidden = !isCancel;
}

$('#sm-save').addEventListener('click', async () => {
  if (!currentOrder) return;
  const status = $('#sm-status').value;
  const reason = status === 'Cancelled' ? $('#sm-reason').value : undefined;
  const btn = $('#sm-save');
  btn.classList.add('is-loading'); btn.disabled = true;

  try {
    const res = await api('adminUpdateOrder', { id: currentOrder.id, status, reason });
    btn.classList.remove('is-loading'); btn.disabled = false;
    if (!res.success) { toast(res.message, 'error'); return; }
    const i = orders.findIndex(x => x.id === currentOrder.id);
    if (i > -1) orders[i] = res.data.order;
    toast('Order updated to ' + status, 'success');
    closeModal('status-modal');
    closeModal('order-modal');
    renderDashboard(); renderOrders(); renderCancelled();
  } catch {
    btn.classList.remove('is-loading'); btn.disabled = false;
    toast('Update failed', 'error');
  }
});

$('#sm-cancel-btn').addEventListener('click', () => closeModal('status-modal'));
$('#sm-close').addEventListener('click', () => closeModal('status-modal'));

$('#om-update').addEventListener('click', () => {
  if (currentOrder) { closeModal('order-modal'); showStatusModal(currentOrder); }
});

$('#om-cancel').addEventListener('click', async () => {
  if (!currentOrder) return;
  if (!confirm('Cancel order ' + currentOrder.id + '?')) return;
  const res = await api('adminUpdateOrder', { id: currentOrder.id, status: 'Cancelled', reason: 'Admin cancellation' });
  if (res.success) {
    toast('Order cancelled.', 'success');
    const i = orders.findIndex(x => x.id === currentOrder.id);
    if (i > -1) orders[i] = res.data.order;
    closeModal('order-modal');
    renderDashboard(); renderOrders(); renderCancelled();
  } else toast(res.message, 'error');
});

$('#om-close').addEventListener('click', () => closeModal('order-modal'));

/* ====================== TOOLBAR WIRING ====================== */
$('#o-search')?.addEventListener('input', debounce(e => {
  searchTerm = e.target.value.trim(); renderOrders();
}, 250));

$('#o-status-filter')?.addEventListener('change', e => {
  statusFilter = e.target.value; renderOrders();
});

$('#o-payment-filter')?.addEventListener('change', e => {
  paymentFilter = e.target.value; renderOrders();
});

$('#btn-export-orders')?.addEventListener('click', () => {
  exportCSV('orders-' + Date.now() + '.csv', filteredOrders().map(o => ({
    'Order ID': o.id, Customer: o.address?.name || '', Phone: o.address?.phone || '',
    City: o.address?.city || '', Items: (o.items || []).length,
    Total: o.totals?.total || 0, Payment: o.payment?.label || '',
    'Payment Status': o.paymentStatus || '', Status: o.status,
    AWB: o.awb || '', Date: o.placedAt || ''
  })));
});

/* ====================== MODAL HELPERS ====================== */
function openModal(id) {
  $(id).classList.add('open');
  document.body.classList.add('no-scroll');
}
function closeModal(id) {
  $(id).classList.remove('open');
  document.body.classList.remove('no-scroll');
}
// Close modals on overlay click
$$('.cwp-modal-overlay').forEach(ov => {
  ov.addEventListener('click', () => {
    ov.closest('.cwp-modal').classList.remove('open');
    document.body.classList.remove('no-scroll');
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $$('.cwp-modal.open').forEach(m => { m.classList.remove('open'); document.body.classList.remove('no-scroll'); });
  }
});

/* ====================== UTILITIES ====================== */
function statusClass(status) {
  if (!status) return 'placed';
  const s = status.toLowerCase();
  if (s === 'delivered') return 'delivered';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'paid') return 'paid';
  if (s === 'pending') return 'pending';
  if (s.includes('refund')) return 'refund';
  if (s === 'shipped' || s.includes('out for')) return 'out';
  if (s === 'packed') return 'packed';
  if (s === 'confirmed') return 'confirmed';
  return 'placed';
}

function getIcon(name) {
  const icons = {
    package: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
    dollar: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    xCircle: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    creditCard: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>'
  };
  return icons[name] || '';
}

function toast(msg, type = 'info') {
  const container = $('#cwp-toasts');
  const el = document.createElement('div');
  el.className = `cwp-toast cwp-toast-${type}`;
  el.textContent = msg;
  container.append(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}

function exportCSV(filename, rows) {
  if (!rows.length) { toast('Nothing to export.', 'info'); return; }
  const headers = Object.keys(rows[0]);
  const escape = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(rows.length + ' rows exported.', 'success');
}
