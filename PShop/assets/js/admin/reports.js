/* ==========================================================================
   PShop Admin — Reports & Analytics
   ========================================================================== */
import { adminPage, $, esc, money, icon, toast, barChart, tableLoading,
         tableEmpty, exportCSV } from './_admin-core.js';
import { api, API } from '../core/api.js';
import { compact, fmtDate, dateKey } from '../core/utils.js';
import { url } from '../core/config.js';

let series = [], orders = [];

adminPage('reports.html', async () => {
  tableLoading($('#rep-top'), 4);
  tableLoading($('#rep-payments'), 7);

  const [repRes, ordRes, payRes, prodRes] = await Promise.all([
    api('adminReports', {}),
    api('adminOrders', {}),
    api('adminPayments', {}),
    API.getProducts({ all: true })
  ]);

  const report = repRes.success ? repRes.data : null;
  orders = ordRes.success ? ordRes.data.items : [];
  const payments = payRes.success ? payRes.data.items : [];
  const products = prodRes.success ? prodRes.data.items : [];

  renderKPIs(report, orders, products);
  renderChart(report, orders);
  renderTop(report, orders);
  renderCategories(products);
  renderPayments(payments, orders);

  $('#btn-export-rep').addEventListener('click', () =>
    exportCSV(`pshop-revenue-${Date.now()}.csv`,
      series.map(s => ({ Date: s.label, Revenue: s.value }))));
});

function renderKPIs(report, orders, products) {
  const live = orders.filter(o => o.status !== 'Cancelled');
  const revenue = report?.totalRevenue ??
    live.reduce((a, o) => a + (Number(o.totals?.total) || 0), 0);
  const aov = report?.avgOrderValue ?? (live.length ? Math.round(revenue / live.length) : 0);
  const units = orders.reduce((a, o) =>
    a + (o.items || []).reduce((x, i) => x + (Number(i.qty) || 0), 0), 0);

  $('#rep-kpis').innerHTML = [
    ['dollar', money(revenue), 'Total revenue'],
    ['barChart', money(aov), 'Average order value'],
    ['package', compact(units), 'Units sold'],
    ['box', products.length, 'Active products']
  ].map(([ic, val, lbl]) => `
    <article class="kpi"><span class="ico">${icon(ic, 22)}</span>
      <div class="val">${val}</div><div class="lbl">${lbl}</div></article>`).join('');
}

function renderChart(report, orders) {
  if (report?.salesSeries?.length) {
    series = report.salesSeries.map(s => ({
      label: s.date.slice(5), value: Number(s.revenue) || 0
    }));
  } else {
    // Backend series na ho to orders se 30 din ka data bana lo.
    series = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      series.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        value: orders
          .filter(o => o.status !== 'Cancelled' && dateKey(o.placedAt) === key)
          .reduce((a, o) => a + (Number(o.totals?.total) || 0), 0)
      });
    }
  }
  barChart($('#rep-chart'), series);
}

function renderTop(report, orders) {
  let top = report?.topProducts;
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

  const tbody = $('#rep-top');
  if (!top.length) return tableEmpty(tbody, 4, 'No sales recorded yet.');

  tbody.innerHTML = top.slice(0, 10).map((p, i) => `
    <tr><td class="semi">${i + 1}</td>
      <td><a href="${url('pages/product-details.html?id=' + p.id)}" target="_blank"
        rel="noopener" class="clamp-1">${esc(p.name)}</a></td>
      <td class="semi">${compact(p.qty)}</td>
      <td class="semi">${money(p.revenue)}</td></tr>`).join('');
}

function renderCategories(products) {
  const map = {};
  products.forEach(p => {
    const c = p.category || 'Other';
    map[c] ||= { category: c, products: 0, stock: 0, value: 0 };
    map[c].products++;
    map[c].stock += Number(p.stock) || 0;
    map[c].value += (Number(p.price) || 0) * (Number(p.stock) || 0);
  });
  const rows = Object.values(map).sort((a, b) => b.products - a.products);
  const max = Math.max(...rows.map(r => r.products), 1);

  $('#rep-cats').innerHTML = rows.map(r => `
    <div style="margin-bottom:.9rem">
      <div class="flex justify-between small mb-1">
        <span class="semi">${esc(r.category)}</span>
        <span class="muted">${r.products} products · ${compact(r.stock)} units</span>
      </div>
      <div style="height:7px;border-radius:99px;background:var(--surface-3);overflow:hidden">
        <div style="height:100%;width:${(r.products / max) * 100}%;border-radius:99px;
          background:linear-gradient(90deg,var(--brand-500),var(--accent-500))"></div>
      </div>
    </div>`).join('') || '<p class="muted small">No products yet.</p>';
}

function renderPayments(payments, orders) {
  const tbody = $('#rep-payments');

  // Backend payments na de to orders se bana lo.
  let rows = payments;
  if (!rows.length) {
    rows = orders.map(o => ({
      id: o.payment?.reference || '—', orderId: o.id,
      method: o.payment?.label || o.payment?.method || '—',
      amount: o.totals?.total || 0, status: o.paymentStatus,
      refundStatus: /Refund/.test(o.paymentStatus || '') ? o.paymentStatus : '',
      createdAt: o.placedAt
    }));
  }

  if (!rows.length) return tableEmpty(tbody, 7, 'No payments recorded yet.');

  tbody.innerHTML = rows.slice(0, 50).map(p => `
    <tr>
      <td class="xs" style="font-family:ui-monospace,monospace">${esc(p.id)}</td>
      <td class="xs">${esc(p.orderId)}</td>
      <td class="small">${esc(p.method)}</td>
      <td class="semi">${money(p.amount)}</td>
      <td><span class="badge ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}">
        ${esc(p.status || '')}</span></td>
      <td class="xs muted">${esc(p.refundStatus || '—')}</td>
      <td class="xs muted">${fmtDate(p.createdAt)}</td>
    </tr>`).join('');
}
