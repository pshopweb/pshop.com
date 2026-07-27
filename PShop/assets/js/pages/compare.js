/* ==========================================================================
   PShop — Compare products page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, $$, esc, money, compact, starsHTML, unique } from '../core/utils.js';
import { Compare, Cart } from '../core/state.js';
import { API } from '../core/api.js';
import { emptyState } from '../components/lazy-load.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';

let products = [], diffOnly = false;
const cache = new Map();

page(async () => {
  await initApp({ page: 'compare', nav: 'shop', getProduct: id => cache.get(id) });
  await load();
  window.addEventListener('pshop:compare', load);
});

async function load() {
  const ids = Compare.all();
  const wrap = $('#cmp-wrap'), empty = $('#cmp-empty'), tools = $('#cmp-tools');

  if (!ids.length) {
    wrap.hidden = true; tools.hidden = true; empty.hidden = false;
    $('#cmp-count').textContent = 'Nothing to compare yet';
    emptyState(empty, {
      title: 'No products to compare',
      text: `Tap the compare icon on any product card to add it here. You can compare up to ${CONFIG.MAX_COMPARE} products.`,
      actionLabel: 'Browse products', actionHref: url('pages/shop.html')
    });
    return;
  }

  const res = await API.getProducts({ ids: ids.join(','), all: true });
  products = res.success ? res.data.items : [];
  products.forEach(p => cache.set(p.id, p));

  if (!products.length) { Compare.clear(); return load(); }

  wrap.hidden = false; empty.hidden = true; tools.hidden = false;
  $('#cmp-count').textContent =
    `Comparing ${products.length} of ${CONFIG.MAX_COMPARE} products`;

  renderTable();

  $('#clear-cmp').onclick = () => { Compare.clear(); toast.info('Comparison cleared.'); };
  $('#diff-only').onchange = e => { diffOnly = e.target.checked; renderTable(); };
}

function renderTable() {
  $('#cmp-head').innerHTML = `<th scope="col">Product</th>` + products.map(p => `
    <th scope="col"><div class="cmp-head">
      <a href="${url('pages/product-details.html?id=' + p.id)}">
        <img src="${url(p.thumb)}" alt="${esc(p.name)}" width="110" height="110" loading="lazy"></a>
      <div class="name">${esc(p.name)}</div>
      <button class="remove" data-drop="${p.id}">Remove</button>
    </div></th>`).join('');

  // Best-value helpers highlight the winning cell per numeric row.
  const minPrice = Math.min(...products.map(p => p.flashPrice || p.price));
  const maxRating = Math.max(...products.map(p => p.rating));
  const maxDisc = Math.max(...products.map(p => p.discount));

  const rows = [
    ['Price', products.map(p => {
      const price = p.flashPrice || p.price;
      return { html: `<span class="price">${money(price)}</span>
        ${p.mrp > price ? `<div class="price-mrp xs">${money(p.mrp)}</div>` : ''}`,
        best: price === minPrice, raw: price };
    })],
    ['Discount', products.map(p => ({ html: `${p.discount}% off`, best: p.discount === maxDisc, raw: p.discount }))],
    ['Rating', products.map(p => ({
      html: `${starsHTML(p.rating, 14)}<div class="xs muted">${p.rating} (${compact(p.ratingCount)})</div>`,
      best: p.rating === maxRating, raw: p.rating }))],
    ['Brand', products.map(p => ({ html: esc(p.brand), raw: p.brand }))],
    ['Category', products.map(p => ({ html: esc(p.category), raw: p.category }))],
    ['Sub category', products.map(p => ({ html: esc(p.subCategory), raw: p.subCategory }))],
    ['Availability', products.map(p => ({
      html: p.inStock ? `<span class="badge badge-success">In stock (${p.stock})</span>`
                      : '<span class="badge badge-muted">Out of stock</span>', raw: p.inStock }))],
    ['Delivery', products.map(p => ({ html: `${p.deliveryDays} day(s)`, raw: p.deliveryDays }))],
    ['Return window', products.map(p => ({ html: `${p.returnDays} days`, raw: p.returnDays }))],
    ['Cash on delivery', products.map(p => ({ html: p.codAvailable ? 'Available' : 'Not available', raw: p.codAvailable }))],
    ['Warranty', products.map(p => ({ html: esc(p.specs.Warranty), raw: p.specs.Warranty }))],
    ['Colours', products.map(p => ({ html: esc(p.colors.join(', ')), raw: p.colors.join(',') }))],
    ['Units sold', products.map(p => ({ html: compact(p.sold), raw: p.sold }))]
  ];

  const body = rows
    .filter(([, cells]) => !diffOnly || unique(cells.map(c => String(c.raw))).length > 1)
    .map(([label, cells]) => `
      <tr><th scope="row">${label}</th>
        ${cells.map(c => `<td class="${c.best && products.length > 1 ? 'cmp-best' : ''}">${c.html}</td>`).join('')}
      </tr>`).join('');

  const actions = `<tr><th scope="row">Actions</th>${products.map(p => `
    <td><button class="btn btn-sm btn-primary" data-cart="${p.id}" ${!p.inStock ? 'disabled' : ''}>
      Add to Cart</button>
      <a class="btn btn-sm btn-ghost mt-2" href="${url('pages/product-details.html?id=' + p.id)}">View</a></td>`).join('')}</tr>`;

  $('#cmp-body').innerHTML = body + actions;

  $$('[data-drop]').forEach(b => b.onclick = () => {
    Compare.remove(b.dataset.drop);
    toast.info('Removed from comparison.');
  });
  $$('[data-cart]').forEach(b => b.onclick = () => {
    const p = products.find(x => x.id === b.dataset.cart);
    if (!p) return;
    Cart.add(p, 1);
    toast.success(`${p.name.slice(0, 30)}… added to cart.`);
  });
}
