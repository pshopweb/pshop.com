/* ==========================================================================
   PShop — My Orders list
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, $$, esc, money, fmtDate, debounce } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { API } from '../core/api.js';
import { renderAccountNav } from './_account-nav.js';
import { statusBadge } from './_order-ui.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { emptyState, skeletonRows, lazyImages } from '../components/lazy-load.js';

let allOrders = [], filter = 'all', term = '';

page(async () => {
  await initApp({ page: 'orders', nav: 'orders', newsletter: false });
  if (!Auth.require()) return;

  renderAccountNav('orders.html');
  $('#ico-search').innerHTML = icon('search', 18);
  skeletonRows(4, $('#orders-list'));

  const res = await API.getOrders({ userId: Auth.id() });
  allOrders = res.success ? res.data.items : [];

  // ?status= se aane par filter pre-select ho jaye
  const preset = new URLSearchParams(location.search).get('status');
  if (preset) {
    filter = preset;
    $$('[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === preset));
  }

  render();

  $$('[data-status]').forEach(b => b.onclick = () => {
    $$('[data-status]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    filter = b.dataset.status;
    render();
  });

  $('#order-search').addEventListener('input', debounce(e => {
    term = e.target.value.trim().toLowerCase();
    render();
  }, 220));
});

function render() {
  let list = allOrders;
  if (filter !== 'all') list = list.filter(o => o.status === filter);
  if (term) {
    list = list.filter(o =>
      o.id.toLowerCase().includes(term) ||
      o.items.some(i => i.name.toLowerCase().includes(term)));
  }

  $('#order-count').textContent = allOrders.length
    ? `${allOrders.length} order${allOrders.length > 1 ? 's' : ''} placed so far`
    : 'You have not placed any orders yet';

  const host = $('#orders-list'), empty = $('#orders-empty');

  if (!list.length) {
    host.innerHTML = '';
    empty.hidden = false;
    emptyState(empty, {
      title: allOrders.length ? 'No matching orders' : 'No orders yet',
      text: allOrders.length
        ? 'Try a different filter or search term.'
        : 'When you place your first order it will show up here with live tracking.',
      actionLabel: allOrders.length ? null : 'Start shopping',
      actionHref: allOrders.length ? null : url('pages/shop.html')
    });
    return;
  }

  empty.hidden = true;
  host.innerHTML = list.map(o => {
    const canCancel = !['Delivered', 'Cancelled', 'Returned'].includes(o.status)
      && !/Return|Replacement/.test(o.status);
    const canReturn = o.status === 'Delivered';
    return `
    <article class="order-card">
      <div class="order-head">
        <div><div class="k">Order ID</div><div class="v">${esc(o.id)}</div></div>
        <div><div class="k">Placed on</div><div class="v">${fmtDate(o.placedAt)}</div></div>
        <div><div class="k">Total</div><div class="v">${money(o.totals.total)}</div></div>
        <div class="right">
          <span class="badge ${statusBadge(o.status)}">${esc(o.status)}</span>
          <a class="btn btn-sm btn-ghost" href="order-details.html?id=${o.id}">Details ${icon('chevronRight', 14)}</a>
        </div>
      </div>

      <div class="order-body">
        ${o.items.slice(0, 3).map(i => `
          <div class="order-line">
            <img class="lazy" data-src="${url(i.image)}" src="${url('assets/img/misc/placeholder.svg')}"
                 alt="${esc(i.name)}" width="60" height="60" loading="lazy">
            <div style="flex:1;min-width:0">
              <a class="semi small clamp-2" href="product-details.html?id=${esc(i.id || i.productId)}">${esc(i.name)}</a>
              <div class="xs muted">${i.variant ? esc(i.variant) + ' · ' : ''}Qty ${i.qty}</div>
            </div>
            <div class="semi">${money(i.price * i.qty)}</div>
          </div>`).join('')}
        ${o.items.length > 3 ? `<p class="xs muted mt-2">+ ${o.items.length - 3} more item(s)</p>` : ''}
      </div>

      <div class="order-foot">
        <a class="btn btn-sm btn-secondary" href="track-order.html?id=${o.id}">${icon('truck', 14)} Track</a>
        ${canCancel ? `<button class="btn btn-sm btn-ghost" data-cancel="${o.id}">Cancel order</button>` : ''}
        ${canReturn ? `<button class="btn btn-sm btn-ghost" data-return="${o.id}">Return / Replace</button>` : ''}
        <button class="btn btn-sm btn-ghost" data-invoice="${o.id}">${icon('download', 14)} Invoice</button>
        <a class="btn btn-sm btn-ghost" href="product-details.html?id=${esc(o.items[0].id || o.items[0].productId)}">Buy again</a>
      </div>
    </article>`;
  }).join('');

  lazyImages(host);
  wireActions();
}

function wireActions() {
  $$('[data-cancel]').forEach(b => b.onclick = () =>
    location.href = `order-details.html?id=${b.dataset.cancel}&action=cancel`);
  $$('[data-return]').forEach(b => b.onclick = () =>
    location.href = `order-details.html?id=${b.dataset.return}&action=return`);
  $$('[data-invoice]').forEach(b => b.onclick = async () => {
    const order = allOrders.find(o => o.id === b.dataset.invoice);
    if (!order) return toast.error('Order not found.');
    const { downloadInvoice } = await import('./_invoice.js');
    downloadInvoice(order);
  });
}
