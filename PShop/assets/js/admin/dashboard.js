/* ==========================================================================
   PShop Admin — Dashboard
   ========================================================================== */
import { adminPage, $, esc, money, icon, orderBadge, barChart, donutChart,
         tableLoading, tableEmpty } from './_admin-core.js';
import { api, API } from '../core/api.js';
import { compact, fmtDate, dateKey } from '../core/utils.js';
import { url } from '../core/config.js';

adminPage('dashboard.html', async () => {
  tableLoading($('#recent-orders'), 5);
  tableLoading($('#top-products'), 4);

  // adminOrders() SAARE customers ke orders deta hai; getOrders() sirf apne.
  const [statsRes, ordersRes, reportRes] = await Promise.all([
    API.adminStats(),
    api('adminOrders', {}),
    api('adminReports', {})
  ]);

  const s = statsRes.success ? statsRes.data : {};
  const orders = ordersRes.success ? ordersRes.data.items : [];
  const report = reportRes?.success ? reportRes.data : null;

  renderKPIs(s);
  renderRevenueChart(orders);
  renderStatusDonut(s, orders);
  renderRecentOrders(orders);
  renderTopProducts(report, orders);
  renderAlerts(s);
});

function renderKPIs(s) {
  const items = [
    ['dollar', money(s.revenue || 0), 'Total revenue',
     s.todayRevenue ? `+${money(s.todayRevenue)} today` : null],
    ['package', s.orders || 0, 'Total orders',
     s.todayOrders ? `+${s.todayOrders} today` : null],
    ['users', s.users || 0, 'Customers', null],
    ['box', s.products || 0, 'Products',
     s.outOfStock ? `${s.outOfStock} out of stock` : null]
  ];
  $('#kpi-grid').innerHTML = items.map(([ic, val, lbl, delta]) => `
    <article class="kpi">
      <span class="ico">${icon(ic, 22)}</span>
      <div class="val">${val}</div>
      <div class="lbl">${lbl}</div>
      ${delta ? `<div class="delta up">${esc(delta)}</div>` : ''}
    </article>`).join('');
}

/** Pichhle 14 din ka revenue — orders se nikala gaya. */
function renderRevenueChart(orders) {
  const days = 14;
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const revenue = orders
      .filter(o => o.status !== 'Cancelled' && dateKey(o.placedAt) === key)
      .reduce((a, o) => a + (Number(o.totals?.total) || 0), 0);
    buckets.push({ label: d.getDate() + '/' + (d.getMonth() + 1), value: revenue });
  }
  barChart($('#rev-chart'), buckets);
  const total = buckets.reduce((a, b) => a + b.value, 0);
  $('#rev-total').textContent = money(total) + ' in 14 days';
}

function renderStatusDonut(s, orders) {
  const count = st => orders.filter(o => o.status === st).length;
  donutChart($('#status-donut'), [
    { label: 'Delivered', value: s.delivered ?? count('Delivered'), color: '#10b981' },
    { label: 'In transit', value: count('Shipped') + count('Out for Delivery'), color: '#0ea5e9' },
    { label: 'Processing', value: count('Placed') + count('Confirmed') + count('Packed'), color: '#f59e0b' },
    { label: 'Cancelled', value: s.cancelled ?? count('Cancelled'), color: '#ef4444' }
  ]);
}

function renderRecentOrders(orders) {
  const tbody = $('#recent-orders');
  if (!orders.length) return tableEmpty(tbody, 5, 'No orders yet.');

  tbody.innerHTML = orders.slice(0, 6).map(o => `
    <tr>
      <td><a href="orders.html?id=${esc(o.id)}" class="semi"
             style="color:var(--brand-600)">${esc(o.id)}</a></td>
      <td>${esc(o.address?.name || '—')}</td>
      <td class="semi">${money(o.totals?.total || 0)}</td>
      <td><span class="badge ${orderBadge(o.status)}">${esc(o.status)}</span></td>
      <td class="muted xs">${fmtDate(o.placedAt)}</td>
    </tr>`).join('');
}

function renderTopProducts(report, orders) {
  const tbody = $('#top-products');
  let top = report?.topProducts;

  // Backend report na mile to orders se khud nikal lo.
  if (!top?.length) {
    const map = {};
    orders.forEach(o => (o.items || []).forEach(i => {
      const id = i.id || i.productId;
      map[id] ||= { id, name: i.name, qty: 0, revenue: 0 };
      map[id].qty += Number(i.qty) || 0;
      map[id].revenue += (Number(i.price) || 0) * (Number(i.qty) || 0);
    }));
    top = Object.values(map).sort((a, b) => b.qty - a.qty);
  }

  if (!top.length) return tableEmpty(tbody, 4, 'No sales data yet.');

  tbody.innerHTML = top.slice(0, 8).map((p, i) => `
    <tr>
      <td class="semi">${i + 1}</td>
      <td><a href="${url('pages/product-details.html?id=' + p.id)}" target="_blank"
             rel="noopener">${esc(p.name)}</a></td>
      <td class="semi">${compact(p.qty)}</td>
      <td class="semi">${money(p.revenue)}</td>
    </tr>`).join('');
}

function renderAlerts(s) {
  const alerts = [];
  if (s.outOfStock) alerts.push(['danger', 'alert', `${s.outOfStock} product(s) out of stock`,
    'Restock them so customers can order.', 'products.html?stock=out']);
  if (s.lowStock) alerts.push(['warning', 'box', `${s.lowStock} product(s) running low`,
    'Fewer than 10 units left.', 'products.html?stock=low']);
  if (s.pending) alerts.push(['info', 'clock', `${s.pending} order(s) awaiting dispatch`,
    'Move them to Packed or Shipped.', 'orders.html']);
  if (s.openTickets) alerts.push(['info', 'chat', `${s.openTickets} open support ticket(s)`,
    'Customers are waiting for a reply.', 'messages.html']);
  if (s.refunds) alerts.push(['warning', 'wallet', `${s.refunds} refund(s) in progress`,
    'Confirm once the money is sent.', 'reports.html']);

  const host = $('#alerts');
  if (!alerts.length) {
    host.innerHTML = `<div class="flex gap-3 items-center" style="color:var(--success)">
      ${icon('checkCircle', 22)}
      <div><div class="semi">All clear</div>
        <div class="xs muted">No pending issues need your attention.</div></div></div>`;
    return;
  }

  host.innerHTML = alerts.map(([type, ic, title, sub, href]) => `
    <a href="${href}" class="flex gap-3 items-center"
       style="padding:.7rem 0;border-bottom:1px solid var(--border)">
      <span class="badge badge-${type}" style="width:34px;height:34px;display:grid;
        place-items:center;border-radius:10px;flex:none">${icon(ic, 16)}</span>
      <div style="flex:1;min-width:0">
        <div class="semi small">${esc(title)}</div>
        <div class="xs muted">${esc(sub)}</div>
      </div>
      ${icon('chevronRight', 15)}
    </a>`).join('');
}
