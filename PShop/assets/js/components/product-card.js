/* ==========================================================================
   PShop — reusable product card + grid/rail renderers and global card actions
   ========================================================================== */
import { CONFIG, url } from '../core/config.js';
import { el, esc, money, compact, starsHTML, offPct, on, $$ } from '../core/utils.js';
import { Cart, Wishlist, Compare } from '../core/state.js';
import { API } from '../core/api.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { lazyImages } from './lazy-load.js';

const P = p => url('pages/' + p);

/**
 * Product card markup.
 * @param {object} p product
 * @param {{compact?:boolean, showCompare?:boolean}} opts
 */
export function productCard(p, opts = {}) {
  const { showCompare = true } = opts;
  const price = p.flashPrice || p.price;
  const off = p.flashPrice ? offPct(p.mrp, p.flashPrice) : (p.discount || offPct(p.mrp, p.price));
  const wished = Wishlist.has(p.id);
  const compared = Compare.has(p.id);
  const href = P('product-details.html?id=' + p.id);
  const lowStock = p.stock > 0 && p.stock <= 5;

  return `
  <article class="product-card reveal" data-product-id="${p.id}" itemscope itemtype="https://schema.org/Product">
    <meta itemprop="name" content="${esc(p.name)}">
    <meta itemprop="sku" content="${esc(p.sku || p.id)}">
    <a class="pc-img" href="${href}" aria-label="${esc(p.name)}">
      <img class="lazy" data-src="${url(p.thumb || p.images?.[0] || 'assets/img/misc/placeholder.svg')}"
           src="${url('assets/img/misc/placeholder.svg')}"
           alt="${esc(p.name)}" width="500" height="500" loading="lazy" decoding="async" itemprop="image">
      <div class="pc-badges">
        ${off >= 5 ? `<span class="badge badge-discount">${off}% OFF</span>` : ''}
        ${p.flashPrice ? `<span class="badge badge-flash">${icon('zap', 11)} FLASH</span>` : ''}
        ${p.tags?.includes('new') ? '<span class="badge badge-new">NEW</span>' : ''}
        ${p.tags?.includes('bestseller') ? '<span class="badge badge-warning">BESTSELLER</span>' : ''}
      </div>
      ${!p.inStock ? '<div class="pc-oos">Out of stock</div>' : ''}
    </a>

    <div class="pc-actions">
      <button class="icon-action wish-btn ${wished ? 'active' : ''}" data-wish="${p.id}"
              aria-label="${wished ? 'Remove from' : 'Add to'} wishlist" aria-pressed="${wished}"
              data-tip="Wishlist">${icon('heart', 18)}</button>
      ${showCompare ? `<button class="icon-action compare-btn ${compared ? 'active' : ''}" data-compare="${p.id}"
              aria-label="Compare product" aria-pressed="${compared}" data-tip="Compare">${icon('compare', 18)}</button>` : ''}
      <button class="icon-action" data-share="${p.id}" aria-label="Share product" data-tip="Share">${icon('share', 18)}</button>
    </div>

    <div class="pc-body">
      <span class="pc-brand" itemprop="brand">${esc(p.brand)}</span>
      <a href="${href}"><h3 class="pc-name" itemprop="name">${esc(p.name)}</h3></a>
      <div class="pc-rating">
        <span class="rating-pill ${p.rating < 3.5 ? 'low' : ''}">${p.rating.toFixed(1)}
          <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-1L12 2.5z"/></svg>
        </span>
        <span class="muted">(${compact(p.ratingCount)})</span>
      </div>
      <div class="pc-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <meta itemprop="priceCurrency" content="INR">
        <meta itemprop="price" content="${price}">
        <link itemprop="availability" href="https://schema.org/${p.inStock ? 'InStock' : 'OutOfStock'}">
        <span class="price">${money(price)}</span>
        ${p.mrp > price ? `<span class="price-mrp">${money(p.mrp)}</span>` : ''}
        ${off >= 5 ? `<span class="price-off">${off}% off</span>` : ''}
      </div>
      <div class="pc-meta">
        ${lowStock ? `<span class="badge badge-danger">Only ${p.stock} left</span>`
          : p.inStock ? `<span>${icon('truck', 13)} ${p.deliveryDays <= 1 ? 'Tomorrow' : p.deliveryDays + ' days'}</span>` : ''}
        ${p.codAvailable ? '<span>&middot; COD</span>' : ''}
      </div>
      <div class="pc-cta">
        <button class="btn btn-sm btn-primary" data-add-cart="${p.id}" ${!p.inStock ? 'disabled aria-disabled="true"' : ''}>
          ${icon('cart', 15)} <span>${p.inStock ? 'Add to Cart' : 'Sold out'}</span>
        </button>
        <button class="btn btn-sm btn-secondary" data-buy-now="${p.id}" ${!p.inStock ? 'disabled aria-disabled="true"' : ''}
          aria-label="Buy ${esc(p.name)} now">${icon('zap', 15)}</button>
      </div>
    </div>
  </article>`;
}

/** Render an array of products into a container. */
export function renderProducts(container, products, opts = {}) {
  if (!container) return;
  if (!products?.length) { container.innerHTML = ''; return; }
  container.innerHTML = products.map(p => productCard(p, opts)).join('');
  lazyImages(container);
  requestAnimationFrame(() => $$('.reveal', container).forEach((n, i) => {
    setTimeout(() => n.classList.add('visible'), Math.min(i * 35, 400));
  }));
}

/** Small horizontal card used in cart/wishlist/order summaries. */
export function miniItem(item, { qty = true, remove = null } = {}) {
  return `
  <div class="mini-item" data-key="${esc(item.key || item.id)}">
    <a href="${P('product-details.html?id=' + item.id)}" class="mi-img">
      <img class="lazy" data-src="${url(item.image)}" src="${url('assets/img/misc/placeholder.svg')}"
           alt="${esc(item.name)}" width="80" height="80" loading="lazy">
    </a>
    <div class="mi-body">
      <a href="${P('product-details.html?id=' + item.id)}" class="mi-name clamp-2">${esc(item.name)}</a>
      ${item.variant ? `<div class="xs muted">${esc(item.variant)}</div>` : ''}
      <div class="mi-price">
        <span class="price">${money(item.price)}</span>
        ${item.mrp > item.price ? `<span class="price-mrp small">${money(item.mrp)}</span>` : ''}
        ${qty ? `<span class="muted small">&times; ${item.qty}</span>` : ''}
      </div>
    </div>
    ${remove ? `<button class="btn-icon btn-ghost" data-remove="${esc(item.key || item.id)}"
        aria-label="Remove ${esc(item.name)}">${icon('trash', 17)}</button>` : ''}
  </div>`;
}

/* --------------------- global delegated card actions ---------------------- */
let wired = false;

/** Attach one delegated listener for every card action on the page. */
export function wireCardActions(getProduct) {
  if (wired) return;
  wired = true;

  /** Resolve a product object by id — from a page-supplied cache or the API. */
  const resolve = async id => {
    const local = getProduct?.(id);
    if (local) return local;
    const res = await API.getProduct({ id });
    return res.success ? res.data.product : null;
  };

  document.addEventListener('click', async e => {
    const wishBtn = e.target.closest('[data-wish]');
    const cmpBtn  = e.target.closest('[data-compare]');
    const addBtn  = e.target.closest('[data-add-cart]');
    const buyBtn  = e.target.closest('[data-buy-now]');
    const shareBtn = e.target.closest('[data-share]');
    if (!wishBtn && !cmpBtn && !addBtn && !buyBtn && !shareBtn) return;
    e.preventDefault();

    /* ---- wishlist ---- */
    if (wishBtn) {
      const p = await resolve(wishBtn.dataset.wish);
      if (!p) return toast.error('Product unavailable.');
      const added = Wishlist.toggle(p);
      syncWish(p.id, added);
      added
        ? toast.success('Saved to wishlist.', { action: { label: 'View wishlist', onClick: () => location.href = P('wishlist.html') } })
        : toast.info('Removed from wishlist.');
      return;
    }

    /* ---- compare ---- */
    if (cmpBtn) {
      const id = cmpBtn.dataset.compare;
      const { added, full } = Compare.toggle(id);
      if (full) return toast.warn(`You can compare up to ${CONFIG.MAX_COMPARE} products.`);
      $$(`[data-compare="${id}"]`).forEach(b => {
        b.classList.toggle('active', added);
        b.setAttribute('aria-pressed', String(added));
      });
      added
        ? toast.success(`Added to compare (${Compare.count()}).`,
            { action: { label: 'Compare now', onClick: () => location.href = P('compare.html') } })
        : toast.info('Removed from compare.');
      return;
    }

    /* ---- add to cart ---- */
    if (addBtn) {
      const p = await resolve(addBtn.dataset.addCart);
      if (!p) return toast.error('Product unavailable.');
      if (!p.inStock) return toast.warn('This product is out of stock.');
      addBtn.classList.add('is-loading');
      Cart.add(p, 1);
      setTimeout(() => {
        addBtn.classList.remove('is-loading');
        const label = addBtn.querySelector('span');
        if (label) { label.textContent = 'Added \u2713'; setTimeout(() => label.textContent = 'Add to Cart', 1600); }
      }, 260);
      toast.success(`${p.name.slice(0, 34)}… added to cart.`,
        { action: { label: 'Go to cart', onClick: () => location.href = P('cart.html') } });
      return;
    }

    /* ---- buy now ---- */
    if (buyBtn) {
      const p = await resolve(buyBtn.dataset.buyNow);
      if (!p) return toast.error('Product unavailable.');
      if (!p.inStock) return toast.warn('This product is out of stock.');
      Cart.add(p, 1);
      location.href = P('checkout.html');
      return;
    }

    /* ---- share ---- */
    if (shareBtn) {
      const id = shareBtn.dataset.share;
      const link = location.origin + P('product-details.html?id=' + id);
      const { shareLink } = await import('../core/utils.js');
      const r = await shareLink({ title: 'Check this out on PShop', text: 'Found a great deal on PShop', url: link });
      if (r === 'copied') toast.success('Product link copied to clipboard.');
      else if (r === 'failed') toast.error('Could not share this product.');
    }
  });
}

function syncWish(id, added) {
  $$(`[data-wish="${id}"]`).forEach(b => {
    b.classList.toggle('active', added);
    b.setAttribute('aria-pressed', String(added));
    b.setAttribute('aria-label', `${added ? 'Remove from' : 'Add to'} wishlist`);
  });
}

/** Horizontal rail with prev/next controls. */
export function renderRail(container, products, opts = {}) {
  if (!container) return;
  const rail = container.querySelector('.rail') || container;
  renderProducts(rail, products, opts);
  const wrap = container.closest('.rail-wrap') || container;
  const prev = wrap.querySelector('.rail-nav.prev');
  const next = wrap.querySelector('.rail-nav.next');
  if (prev && next) {
    const step = () => rail.clientWidth * 0.8;
    prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
    const sync = () => {
      prev.style.opacity = rail.scrollLeft < 8 ? '.35' : '1';
      next.style.opacity = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8 ? '.35' : '1';
    };
    rail.addEventListener('scroll', sync, { passive: true });
    sync();
  }
}
