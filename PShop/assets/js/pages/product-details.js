/* ==========================================================================
   PShop — Product details page
   Gallery + zoom, variants, pincode check, tabs, reviews, related products.
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, $$, el, esc, money, compact, qs, starsHTML, offPct, clamp,
         fmtDate, addDays, V, shareLink } from '../core/utils.js';
import { API } from '../core/api.js';
import { Cart, Wishlist, Compare, Recent } from '../core/state.js';
import { Auth } from '../core/auth.js';
import { renderProducts } from '../components/product-card.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { emptyState, lazyImages } from '../components/lazy-load.js';

let product = null, reviews = [], activeImg = 0, chosenColor = null;
const cache = new Map();

page(async () => {
  await initApp({ page: 'product-details', nav: 'shop', getProduct: id => cache.get(id) });

  const id = qs('id'), slug = qs('slug');
  if (!id && !slug) return notFound();

  const res = await API.getProduct({ id, slug });
  if (!res.success) return notFound();

  product = res.data.product;
  reviews = res.data.reviews || [];
  cache.set(product.id, product);
  res.data.related.forEach(p => cache.set(p.id, p));

  render();
  Recent.push(product);
  renderRelated(res.data.related);
  renderRecent();
});

/* -------------------------------- render ---------------------------------- */
function render() {
  const p = product;
  const price = p.flashPrice || p.price;
  const off = offPct(p.mrp, price);

  document.title = `${p.name} — Buy Online at ${CONFIG.CURRENCY}${price} | PShop`;
  document.querySelector('meta[name="description"]')
    ?.setAttribute('content', `${p.name} by ${p.brand}. ${p.description.slice(0, 110)}… Rated ${p.rating}/5. ${off}% off, free delivery available.`);
  injectSchema(p, price);

  $('#pd-skeleton').hidden = true;
  $('#pd-content').hidden = false;
  $('#mobile-buy').hidden = false;

  $('#crumb').innerHTML = `
    <a href="${url('index.html')}">Home</a><span class="sep">/</span>
    <a href="${url('pages/category.html?cat=' + p.categorySlug)}">${esc(p.category)}</a><span class="sep">/</span>
    <a href="${url(`pages/category.html?cat=${p.categorySlug}&sub=${encodeURIComponent(p.subCategory)}`)}">${esc(p.subCategory)}</a>
    <span class="sep">/</span><span aria-current="page">${esc(p.name)}</span>`;

  /* gallery */
  $('#pd-thumbs').innerHTML = p.images.map((src, i) => `
    <button class="${i === 0 ? 'active' : ''}" role="tab" aria-selected="${i === 0}"
            data-idx="${i}" aria-label="View image ${i + 1}">
      <img src="${url(src)}" alt="" width="84" height="84" loading="lazy"></button>`).join('');
  setImage(0);

  $('#pd-gal-actions').innerHTML = `
    <button class="icon-action ${Wishlist.has(p.id) ? 'active' : ''}" data-wish="${p.id}"
      aria-label="Add to wishlist" aria-pressed="${Wishlist.has(p.id)}">${icon('heart', 18)}</button>
    <button class="icon-action ${Compare.has(p.id) ? 'active' : ''} compare-btn" data-compare="${p.id}"
      aria-label="Compare product" aria-pressed="${Compare.has(p.id)}">${icon('compare', 18)}</button>
    <button class="icon-action" id="btn-share" aria-label="Share product">${icon('share', 18)}</button>`;

  /* info */
  $('#pd-brand').textContent = p.brand;
  $('#pd-title').textContent = p.name;
  $('#pd-rating').innerHTML = `${p.rating.toFixed(1)} ${icon('star', 11)}`;
  $('#pd-rating-count').textContent = `${compact(p.ratingCount)} ratings & ${compact(p.reviewCount)} reviews`;
  $('#pd-stock-badge').innerHTML = p.inStock
    ? (p.stock <= 5 ? `<span class="badge badge-danger">Only ${p.stock} left</span>`
                    : `<span class="badge badge-success">In stock</span>`)
    : `<span class="badge badge-muted">Out of stock</span>`;

  $('#pd-price').textContent = money(price);
  $('#pd-price').setAttribute('content', price);
  $('#pd-mrp').textContent = p.mrp > price ? money(p.mrp) : '';
  $('#pd-off').textContent = off >= 1 ? `${off}% off` : '';
  $('#pd-avail').href = `https://schema.org/${p.inStock ? 'InStock' : 'OutOfStock'}`;
  if (p.mrp > price) {
    $('#pd-save').innerHTML = `<span class="pd-save">${icon('tag', 14)}
      You save ${money(p.mrp - price)}${p.flashPrice ? ' with the flash sale' : ''}</span>`;
  }

  /* colours */
  if (p.colors?.length) {
    chosenColor = p.colors[0];
    $('#pd-colors').innerHTML = p.colors.map((c, i) =>
      `<button class="${i === 0 ? 'active' : ''}" data-color="${esc(c)}">${esc(c)}</button>`).join('');
    $$('#pd-colors button').forEach(b => b.addEventListener('click', () => {
      $$('#pd-colors button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      chosenColor = b.dataset.color;
    }));
  } else $('#pd-color-block').hidden = true;

  /* offers */
  $('#pd-offers').innerHTML = [
    [`Bank offer`, `10% instant discount with code <b>PSHOP10</b> on orders above ${money(999)}`],
    [`Delivery`, p.deliveryDays <= 1 ? 'Get it by <b>tomorrow</b> with free delivery' :
      `Free delivery on orders above ${money(CONFIG.FREE_SHIP_ABOVE)}`],
    [`Returns`, `<b>${p.returnDays}-day</b> easy return & replacement policy`],
    [`Warranty`, `${esc(p.specs.Warranty)} manufacturer warranty`],
    ...(p.codAvailable ? [['Payment', 'Cash on Delivery available at your doorstep']] : [])
  ].map(([t, d]) => `<div class="pd-offer">${icon('checkCircle', 16)}
      <span><b>${t}:</b> ${d}</span></div>`).join('');

  /* highlights */
  $('#pd-highlights').innerHTML = p.highlights.map(h =>
    `<li>${icon('check', 15)}<span>${esc(h)}</span></li>`).join('');

  /* trust row */
  $('#pd-trust').innerHTML = [
    ['rotate', `${p.returnDays} day returns`], ['shield', 'Genuine product'],
    ['truck', p.deliveryDays <= 2 ? 'Fast delivery' : 'Standard delivery'],
    ['award', 'Top rated seller']
  ].map(([ic, t]) => `<div>${icon(ic, 20)}<span>${t}</span></div>`).join('');

  /* description & specs */
  $('#pd-desc').innerHTML = `${esc(p.description)}<br><br>
    <strong>Why buy from PShop?</strong> Every ${esc(p.category.toLowerCase())} listing is sourced from
    brand-authorised sellers, quality-checked before dispatch and covered by our
    ${p.returnDays}-day return promise. Track your delivery in real time and reach our
    support team any time on ${CONFIG.SUPPORT_PHONE}.`;

  $('#pd-specs').innerHTML = Object.entries({
    ...p.specs, 'SKU': p.sku, 'In Stock': p.inStock ? `Yes (${p.stock} units)` : 'No',
    'Return Window': `${p.returnDays} days`,
    'Cash on Delivery': p.codAvailable ? 'Available' : 'Not available',
    'Available Colours': p.colors.join(', ')
  }).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('');

  $('#pd-shipping').innerHTML = `
    <div class="pd-offers">
      <div class="pd-offer">${icon('truck', 16)}<span><b>Standard delivery:</b>
        arrives in ${p.deliveryDays} business day(s) — free above ${money(CONFIG.FREE_SHIP_ABOVE)},
        otherwise ${money(CONFIG.SHIPPING_FEE)}.</span></div>
      <div class="pd-offer">${icon('zap', 16)}<span><b>Express delivery:</b>
        next-day dispatch for ${money(CONFIG.EXPRESS_FEE)} in serviceable pincodes.</span></div>
      <div class="pd-offer">${icon('rotate', 16)}<span><b>Returns:</b> raise a return within
        ${p.returnDays} days of delivery. Pickup is free and the refund starts once the item is collected.</span></div>
      <div class="pd-offer">${icon('wallet', 16)}<span><b>Refunds:</b> prepaid orders are refunded to the
        source account in 3–5 business days; COD refunds reach your bank in 5–7 business days.</span></div>
      <div class="pd-offer">${icon('shield', 16)}<span><b>Warranty:</b> ${esc(p.specs.Warranty)} covered
        directly by ${esc(p.brand)} through its authorised service network.</span></div>
    </div>`;

  renderReviews();
  wireGallery();
  wireQty();
  wireTabs();
  wirePincode();
  wireCta();
}

/* ------------------------------- gallery ---------------------------------- */
function setImage(i) {
  activeImg = i;
  const img = $('#pd-img');
  img.src = url(product.images[i]);
  img.alt = `${product.name} — image ${i + 1} of ${product.images.length}`;
  $$('#pd-thumbs button').forEach((b, n) => {
    b.classList.toggle('active', n === i);
    b.setAttribute('aria-selected', String(n === i));
  });
}

function wireGallery() {
  $$('#pd-thumbs button').forEach(b =>
    b.addEventListener('click', () => setImage(+b.dataset.idx)));

  const main = $('#pd-main');
  main.addEventListener('click', () => main.classList.toggle('zoomed'));
  main.addEventListener('mousemove', e => {
    if (!main.classList.contains('zoomed')) return;
    const r = main.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    $('#pd-img').style.transformOrigin = `${x}% ${y}%`;
  });
  main.addEventListener('mouseleave', () => main.classList.remove('zoomed'));

  // Swipe between images on touch devices.
  let x0 = null;
  main.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive: true });
  main.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 45) {
      setImage((activeImg + (dx < 0 ? 1 : -1) + product.images.length) % product.images.length);
    }
    x0 = null;
  }, { passive: true });

  $('#btn-share').addEventListener('click', async () => {
    const r = await shareLink({ title: product.name, text: `Check out ${product.name} on PShop`, url: location.href });
    if (r === 'copied') toast.success('Product link copied to clipboard.');
    else if (r === 'failed') toast.error('Unable to share right now.');
  });
}

/* --------------------------------- qty ------------------------------------ */
function wireQty() {
  const input = $('#qty-input');
  const max = Math.min(CONFIG.MAX_QTY_PER_ITEM, product.stock || 1);
  input.max = max;
  $('#stock-note').textContent = product.inStock
    ? `Maximum ${max} per order` : 'Currently unavailable';
  $$('#pd-qty [data-step]').forEach(b => b.addEventListener('click', () => {
    input.value = clamp(+input.value + +b.dataset.step, 1, max);
  }));
  input.addEventListener('change', () => input.value = clamp(+input.value || 1, 1, max));
}

/* -------------------------------- tabs ------------------------------------ */
function wireTabs() {
  const tabs = $$('.tab-list button');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    t.classList.add('active'); t.setAttribute('aria-selected', 'true');
    $('#' + t.getAttribute('aria-controls')).classList.add('active');
  }));
  $('#jump-reviews').addEventListener('click', e => {
    e.preventDefault();
    $('#t-reviews').click();
    $('.pd-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ------------------------------- pincode ---------------------------------- */
function wirePincode() {
  const input = $('#pincode'), out = $('#pin-result');
  const check = () => {
    const pin = input.value.trim();
    if (!V.pin(pin)) {
      out.innerHTML = `<span style="color:var(--danger)">${icon('alert', 14)} Enter a valid 6-digit pincode.</span>`;
      return;
    }
    // Deterministic serviceability so the same pincode always gives the same answer.
    const serviceable = (parseInt(pin, 10) % 17) !== 0;
    if (!serviceable) {
      out.innerHTML = `<span style="color:var(--danger)">${icon('xCircle', 14)}
        Sorry, we do not deliver to ${pin} yet.</span>`;
      return;
    }
    const days = product.deliveryDays + (parseInt(pin[0], 10) > 6 ? 1 : 0);
    const eta = addDays(new Date(), days);
    out.innerHTML = `<span style="color:var(--success)">${icon('checkCircle', 14)}
      Delivery to <b>${pin}</b> by <b>${fmtDate(eta, { weekday: 'short' })}</b>
      ${product.codAvailable ? '· COD available' : ''}</span>`;
  };
  $('#check-pin').addEventListener('click', check);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  input.addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6));
}

/* --------------------------------- CTA ------------------------------------ */
function wireCta() {
  const add = (redirect = false) => {
    if (!product.inStock) return toast.warn('This product is currently out of stock.');
    const qty = +$('#qty-input').value || 1;
    Cart.add(product, qty, chosenColor);
    if (redirect) { location.href = url('pages/checkout.html'); return; }
    toast.success(`Added ${qty} × ${product.name.slice(0, 30)}… to cart.`, {
      action: { label: 'Go to cart', onClick: () => location.href = url('pages/cart.html') }
    });
  };
  ['#btn-add', '#btn-add-m'].forEach(s => $(s)?.addEventListener('click', () => add(false)));
  ['#btn-buy', '#btn-buy-m'].forEach(s => $(s)?.addEventListener('click', () => add(true)));

  if (!product.inStock) {
    ['#btn-add', '#btn-buy', '#btn-add-m', '#btn-buy-m'].forEach(s => {
      const b = $(s);
      if (b) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); b.textContent = 'Out of stock'; }
    });
  }
}

/* ------------------------------- reviews ---------------------------------- */
function renderReviews() {
  const list = reviews.filter(r => r.status !== 'hidden');
  const avg = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : product.rating;
  const buckets = [5, 4, 3, 2, 1].map(n => ({ n, c: list.filter(r => r.rating === n).length }));
  const maxC = Math.max(1, ...buckets.map(b => b.c));

  $('#review-summary').innerHTML = `
    <div class="rs-score">
      <div class="big">${avg.toFixed(1)}</div>
      ${starsHTML(avg, 18)}
      <div class="out">${compact(list.length || product.reviewCount)} reviews</div>
    </div>
    <div class="rs-bars">
      ${buckets.map(b => `
        <div class="rs-bar"><span>${b.n} ★</span>
          <span class="track"><span class="fill" style="width:${(b.c / maxC) * 100}%"></span></span>
          <span class="n">${b.c}</span></div>`).join('')}
    </div>`;

  const user = Auth.user();
  $('#write-review').innerHTML = `
    <h4 class="mb-2">Write a review</h4>
    ${user ? '' : `<p class="small muted mb-4">You are posting as a guest.
      <a href="${url('pages/login.html')}" style="color:var(--brand-600);font-weight:700">Sign in</a> to link it to your account.</p>`}
    <form id="review-form" novalidate>
      <div class="field">
        <span class="label">Your rating <span class="req">*</span></span>
        <div class="stars-input">
          ${[5, 4, 3, 2, 1].map(n => `
            <input type="radio" name="rating" id="star${n}" value="${n}">
            <label for="star${n}" title="${n} star${n > 1 ? 's' : ''}">
              <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-1L12 2.5z"/></svg>
              <span class="sr-only">${n} stars</span></label>`).join('')}
        </div>
        <p class="err-msg" data-err="rating">Please choose a rating.</p>
      </div>
      <div class="field">
        <label for="rv-title">Review title</label>
        <input class="input" id="rv-title" maxlength="70" placeholder="Sum it up in a few words">
      </div>
      <div class="field">
        <label for="rv-text">Your review <span class="req">*</span></label>
        <textarea class="textarea" id="rv-text" rows="3" maxlength="600"
          placeholder="What did you like or dislike? How was the quality and delivery?"></textarea>
        <p class="err-msg" data-err="text">Please write at least 10 characters.</p>
      </div>
      <button class="btn btn-primary" type="submit">Submit review</button>
    </form>`;

  $('#review-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const rating = form.querySelector('[name="rating"]:checked')?.value;
    const text = $('#rv-text').value.trim();
    let bad = false;
    form.querySelectorAll('.field').forEach(f => f.classList.remove('error'));
    if (!rating) { form.querySelector('[data-err="rating"]').closest('.field').classList.add('error'); bad = true; }
    if (text.length < 10) { form.querySelector('[data-err="text"]').closest('.field').classList.add('error'); bad = true; }
    if (bad) return;

    const btn = form.querySelector('button');
    btn.classList.add('is-loading');
    const res = await API.addReview({
      productId: product.id, user: Auth.user()?.name || 'PShop Customer',
      rating, title: $('#rv-title').value.trim(), comment: text
    });
    btn.classList.remove('is-loading');
    if (!res.success) return toast.error(res.message);
    reviews.unshift(res.data.review);
    toast.success(res.message);
    renderReviews();
  });

  const host = $('#review-list');
  if (!list.length) {
    emptyState(host, { title: 'No reviews yet', text: 'Be the first to review this product.' });
    return;
  }
  host.innerHTML = `<h4 class="mb-4">${list.length} customer review${list.length > 1 ? 's' : ''}</h4>` +
    list.slice(0, 12).map(r => `
      <article class="review-item">
        <div class="review-head">
          ${starsHTML(r.rating, 14)}
          <span class="who">${esc(r.user)}</span>
          ${r.verified ? `<span class="badge badge-success">${icon('check', 10)} Verified purchase</span>` : ''}
          <span class="muted xs" style="margin-left:auto">${fmtDate(r.date)}</span>
        </div>
        <h5>${esc(r.title)}</h5>
        <p>${esc(r.comment)}</p>
        <div class="review-foot">
          <button data-helpful="${r.id}">${icon('check', 13)} Helpful (<span>${r.helpful}</span>)</button>
        </div>
      </article>`).join('') +
    (list.length > 12 ? `<button class="btn btn-secondary mt-4" id="more-reviews">Show all ${list.length} reviews</button>` : '');

  $$('[data-helpful]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.voted) return toast.info('You already marked this review helpful.');
    b.dataset.voted = '1';
    const span = b.querySelector('span');
    span.textContent = +span.textContent + 1;
    toast.success('Thanks for the feedback.');
  }));

  $('#more-reviews')?.addEventListener('click', e => {
    e.target.remove();
    host.insertAdjacentHTML('beforeend', list.slice(12).map(r => `
      <article class="review-item">
        <div class="review-head">${starsHTML(r.rating, 14)}<span class="who">${esc(r.user)}</span>
          <span class="muted xs" style="margin-left:auto">${fmtDate(r.date)}</span></div>
        <h5>${esc(r.title)}</h5><p>${esc(r.comment)}</p></article>`).join(''));
  });
}

/* -------------------------------- related --------------------------------- */
function renderRelated(items) {
  if (!items?.length) return;
  renderProducts($('#related-rail'), items);
}

function renderRecent() {
  const items = Recent.all().filter(r => r.id !== product.id);
  const section = $('#recent-rail')?.closest('section');
  if (!items.length) { if (section) section.hidden = true; return; }
  renderProducts($('#recent-rail'), items.map(r => ({
    ...r, inStock: true, ratingCount: 0, discount: 0, tags: [],
    deliveryDays: 3, thumb: r.image, sku: r.id, codAvailable: true
  })), { showCompare: false });
}

/* -------------------------------- helpers --------------------------------- */
function injectSchema(p, price) {
  const data = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, image: [url(p.images[0])], description: p.description,
    sku: p.sku, brand: { '@type': 'Brand', name: p.brand },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviewCount },
    offers: {
      '@type': 'Offer', url: location.href, priceCurrency: 'INR', price,
      availability: `https://schema.org/${p.inStock ? 'InStock' : 'OutOfStock'}`,
      itemCondition: 'https://schema.org/NewCondition'
    }
  };
  const s = el('script', { type: 'application/ld+json' });
  s.textContent = JSON.stringify(data);
  document.head.append(s);
}

function notFound() {
  $('#pd-skeleton').hidden = true;
  const host = $('#pd-notfound');
  host.hidden = false;
  emptyState(host, {
    icon: '404', title: 'Product not found',
    text: 'This product may have been removed or the link is incorrect.',
    actionLabel: 'Browse all products', actionHref: url('pages/shop.html')
  });
}
