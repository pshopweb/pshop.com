/* ==========================================================================
   PShop — Cart page: line items, qty, coupons, totals, recommendations
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, $$, esc, money, clamp, sum } from '../core/utils.js';
import { Cart, Wishlist } from '../core/state.js';
import { Store } from '../core/storage.js';
import { API } from '../core/api.js';
import { icon } from '../components/icons.js';
import { toast, confirmDialog } from '../components/toast.js';
import { emptyState, lazyImages } from '../components/lazy-load.js';
import { renderProducts } from '../components/product-card.js';

let coupon = null;
let giftWrap = false;
const cache = new Map();

page(async () => {
  await initApp({ page: 'cart', nav: 'cart', getProduct: id => cache.get(id) });

  coupon = Store.get(CONFIG.KEYS.COUPON, null);
  $('#secure-ico').innerHTML = icon('shield', 22);

  render();
  loadCoupons();
  loadRecommendations();

  window.addEventListener('pshop:cart', render);
});

/* -------------------------------- render ---------------------------------- */
function render() {
  const items = Cart.all();
  const shell = $('#cart-shell'), empty = $('#cart-empty');

  if (!items.length) {
    shell.hidden = true; empty.hidden = false;
    $('#cart-count-text').textContent = 'Your cart is currently empty';
    emptyState(empty, {
      title: 'Your cart is empty',
      text: 'Looks like you have not added anything yet. Explore our best deals and start shopping.',
      actionLabel: 'Start shopping', actionHref: url('pages/shop.html')
    });
    return;
  }

  shell.hidden = false; empty.hidden = true;
  $('#cart-count-text').textContent =
    `${items.length} product${items.length > 1 ? 's' : ''} · ${Cart.count()} item${Cart.count() > 1 ? 's' : ''} in your cart`;

  $('#cart-list').innerHTML = items.map(i => {
    const max = Math.min(CONFIG.MAX_QTY_PER_ITEM, i.stock || CONFIG.MAX_QTY_PER_ITEM);
    const low = i.stock > 0 && i.stock <= 5;
    return `
    <article class="cart-item" data-key="${esc(i.key)}">
      <a class="ci-img" href="${url('pages/product-details.html?id=' + i.id)}">
        <img class="lazy" data-src="${url(i.image)}" src="${url('assets/img/misc/placeholder.svg')}"
             alt="${esc(i.name)}" width="120" height="120" loading="lazy">
      </a>
      <div class="ci-body">
        <span class="ci-brand">${esc(i.brand || '')}</span>
        <a class="ci-name clamp-2" href="${url('pages/product-details.html?id=' + i.id)}">${esc(i.name)}</a>
        ${i.variant ? `<div class="xs muted">Colour: ${esc(i.variant)}</div>` : ''}
        <div class="ci-price">
          <span class="price">${money(i.price)}</span>
          ${i.mrp > i.price ? `<span class="price-mrp small">${money(i.mrp)}</span>
            <span class="price-off small">${Math.round((1 - i.price / i.mrp) * 100)}% off</span>` : ''}
        </div>
        <div class="ci-meta">
          ${low ? `<span style="color:var(--danger);font-weight:700">Only ${i.stock} left</span>`
                : '<span style="color:var(--success);font-weight:700">In stock</span>'}
          ${i.codAvailable ? '<span>· COD available</span>' : '<span>· Prepaid only</span>'}
        </div>
        <div class="ci-actions">
          <button data-save="${esc(i.key)}">${icon('heart', 14)} Save for later</button>
          <button class="danger" data-remove="${esc(i.key)}">${icon('trash', 14)} Remove</button>
        </div>
      </div>
      <div class="ci-right">
        <div class="qty">
          <button type="button" data-qty="${esc(i.key)}" data-step="-1"
            ${i.qty <= 1 ? 'disabled' : ''} aria-label="Decrease quantity of ${esc(i.name)}">&minus;</button>
          <input type="number" value="${i.qty}" min="1" max="${max}"
            data-qty-input="${esc(i.key)}" aria-label="Quantity of ${esc(i.name)}">
          <button type="button" data-qty="${esc(i.key)}" data-step="1"
            ${i.qty >= max ? 'disabled' : ''} aria-label="Increase quantity of ${esc(i.name)}">+</button>
        </div>
        <span class="ci-total">${money(i.price * i.qty)}</span>
      </div>
    </article>`;
  }).join('');

  lazyImages($('#cart-list'));
  wireItems();
  renderSummary();
}

function renderSummary() {
  const t = Cart.totals(coupon);
  const extra = giftWrap ? 49 : 0;
  const grand = t.total + extra;

  $('#summary-body').innerHTML = `
    <div class="sum-row"><span class="lbl">Price (${t.count} item${t.count > 1 ? 's' : ''})</span>
      <span>${money(t.mrpTotal)}</span></div>
    ${t.savings ? `<div class="sum-row"><span class="lbl">Product discount</span>
      <span class="save">− ${money(t.savings)}</span></div>` : ''}
    ${t.discount ? `<div class="sum-row"><span class="lbl">Coupon (${esc(t.couponCode)})</span>
      <span class="save">− ${money(t.discount)}</span></div>` : ''}
    <div class="sum-row"><span class="lbl">Delivery</span>
      ${t.shipping ? `<span>${money(t.shipping)}</span>` : '<span class="free">FREE</span>'}</div>
    ${extra ? `<div class="sum-row"><span class="lbl">Gift wrap</span><span>${money(extra)}</span></div>` : ''}
    <div class="sum-row"><span class="lbl xs">Includes GST</span>
      <span class="xs muted">${money(t.tax)}</span></div>
    <div class="sum-row total"><span>Total payable</span><span>${money(grand)}</span></div>`;

  const totalSaved = t.savings + t.discount + (t.shipping === 0 && t.subtotal < CONFIG.FREE_SHIP_ABOVE ? 0 : 0);
  $('#savings-banner').innerHTML = totalSaved > 0
    ? `<div class="savings-banner">${icon('tag', 14)} You save ${money(totalSaved)} on this order</div>` : '';

  const pct = Math.min(100, (t.subtotal / CONFIG.FREE_SHIP_ABOVE) * 100);
  $('#ship-progress').innerHTML = t.amountToFreeShip > 0
    ? `<div class="track"><div class="fill" style="width:${pct}%"></div></div>
       <p>Add <strong>${money(t.amountToFreeShip)}</strong> more for FREE delivery</p>`
    : `<div class="track"><div class="fill" style="width:100%"></div></div>
       <p style="color:var(--success);font-weight:700">${icon('checkCircle', 12)} Your order qualifies for FREE delivery</p>`;

  renderCouponArea();
}

/* ------------------------------- coupons ---------------------------------- */
function renderCouponArea() {
  const host = $('#coupon-area');
  if (coupon) {
    host.innerHTML = `
      <div class="coupon-applied">
        <span>${icon('tag', 14)} <b>${esc(coupon.code)}</b> applied</span>
        <button id="remove-coupon" aria-label="Remove coupon">${icon('close', 15)}</button>
      </div>`;
    $('#remove-coupon').addEventListener('click', () => {
      coupon = null;
      Store.remove(CONFIG.KEYS.COUPON);
      toast.info('Coupon removed.');
      renderSummary();
    });
  } else {
    host.innerHTML = `
      <form class="coupon-row" id="coupon-form">
        <label class="sr-only" for="coupon-code">Coupon code</label>
        <input class="input" id="coupon-code" placeholder="Enter coupon code" autocomplete="off">
        <button class="btn btn-outline btn-sm" type="submit">Apply</button>
      </form>`;
    $('#coupon-form').addEventListener('submit', async e => {
      e.preventDefault();
      const code = $('#coupon-code').value.trim();
      if (!code) return toast.warn('Please enter a coupon code.');
      const btn = e.target.querySelector('button');
      btn.classList.add('is-loading');
      const res = await API.verifyCoupon({ code, subtotal: Cart.totals().subtotal });
      btn.classList.remove('is-loading');
      if (!res.success) return toast.error(res.message);
      coupon = res.data.coupon;
      Store.set(CONFIG.KEYS.COUPON, coupon);
      toast.success(res.message);
      renderSummary();
    });
  }
}

async function loadCoupons() {
  const res = await API.getCoupons();
  if (!res.success) return;
  const subtotal = Cart.totals().subtotal;
  $('#coupon-list').innerHTML = res.data.items.filter(c => c.active).slice(0, 4).map(c => `
    <div class="coupon-chip" data-code="${esc(c.code)}"
         title="${subtotal < c.minOrder ? `Add ${money(c.minOrder - subtotal)} more to use this` : 'Tap to apply'}">
      <span><code>${esc(c.code)}</code> — ${esc(c.description)}</span>
      <span style="font-weight:700;color:var(--brand-600)">
        ${subtotal >= c.minOrder ? 'Apply' : 'Locked'}</span>
    </div>`).join('');

  $$('#coupon-list [data-code]').forEach(chip => chip.addEventListener('click', async () => {
    const res2 = await API.verifyCoupon({ code: chip.dataset.code, subtotal: Cart.totals().subtotal });
    if (!res2.success) return toast.warn(res2.message);
    coupon = res2.data.coupon;
    Store.set(CONFIG.KEYS.COUPON, coupon);
    toast.success(res2.message);
    renderSummary();
  }));
}

/* ----------------------------- item actions ------------------------------- */
function wireItems() {
  $$('[data-qty]').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.qty;
    const line = Cart.get(key);
    if (!line) return;
    Cart.setQty(key, line.qty + (+b.dataset.step));
  }));

  $$('[data-qty-input]').forEach(inp => inp.addEventListener('change', () => {
    const key = inp.dataset.qtyInput;
    Cart.setQty(key, clamp(+inp.value || 1, 1, +inp.max));
  }));

  $$('[data-remove]').forEach(b => b.addEventListener('click', async () => {
    const key = b.dataset.remove;
    const item = Cart.get(key);
    const node = b.closest('.cart-item');
    node.classList.add('removing');
    setTimeout(() => {
      Cart.remove(key);
      toast.info(`Removed ${item?.name.slice(0, 28) || 'item'}…`, {
        action: {
          label: 'Undo',
          onClick: () => { if (item) { Cart.save([...Cart.all(), item]); toast.success('Item restored.'); } }
        }
      });
    }, 260);
  }));

  $$('[data-save]').forEach(b => b.addEventListener('click', async () => {
    const key = b.dataset.save;
    const item = Cart.get(key);
    if (!item) return;
    const res = await API.getProduct({ id: item.id });
    if (res.success) Wishlist.add(res.data.product);
    Cart.remove(key);
    toast.success('Moved to your wishlist.');
  }));

  $('#clear-cart').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Clear your cart?',
      message: 'This removes every item from your cart. You cannot undo this.',
      confirmText: 'Clear cart', danger: true
    });
    if (ok) { Cart.clear(); toast.info('Cart cleared.'); }
  };

  $('#gift-wrap').onchange = e => { giftWrap = e.target.checked; renderSummary(); };
  $('#select-all').onchange = e => {
    toast.info(e.target.checked ? 'All items selected for checkout.' : 'Deselect items you do not want to order.');
  };
}

/* ----------------------------- recommendations ---------------------------- */
async function loadRecommendations() {
  const items = Cart.all();
  if (!items.length) return;
  const res = await API.getProducts({ category: undefined, all: true });
  if (!res.success) return;
  const inCart = new Set(items.map(i => i.id));
  const cats = new Set(items.map(i => i.category));
  const recs = res.data.items
    .filter(p => !inCart.has(p.id) && cats.has(p.category) && p.inStock)
    .sort((a, b) => b.rating - a.rating).slice(0, 10);
  if (!recs.length) return;
  recs.forEach(p => cache.set(p.id, p));
  $('#cart-recs').hidden = false;
  renderProducts($('#rec-rail'), recs);
}
