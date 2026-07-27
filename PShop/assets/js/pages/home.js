/* ==========================================================================
   PShop — Home page controller
   Hero slider, categories, flash sale + countdown, featured / trending /
   best-seller / recommended rails, recently viewed, brand row.
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, $$, esc, compact, unique } from '../core/utils.js';
import { API } from '../core/api.js';
import { Recent } from '../core/state.js';
import { renderProducts, renderRail } from '../components/product-card.js';
import { skeletonCards } from '../components/lazy-load.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';

/** Local cache so card actions resolve instantly without another fetch. */
const cache = new Map();
const remember = list => { list.forEach(p => cache.set(p.id, p)); return list; };

page(async () => {
  await initApp({ page: 'index', nav: 'home', getProduct: id => cache.get(id) });

  // Show skeletons immediately so the layout never jumps.
  skeletonCards(6, $('#featured-grid'));
  skeletonCards(6, $('#best-grid'));
  skeletonCards(6, $('#rec-grid'));
  $('#flash-rail').innerHTML = skeletonCards(6);
  $('#trending-rail').innerHTML = skeletonCards(6);

  renderUSP();
  startCountdown();

  // Everything loads in parallel.
  await Promise.all([
    loadHero(),
    loadCategories(),
    loadSection('flash', '#flash-rail', true),
    loadSection('featured', '#featured-grid'),
    loadSection('trending', '#trending-rail', true),
    loadSection('bestseller', '#best-grid'),
    loadRecommended(),
    loadBrands()
  ]);

  loadRecent();
  wireRails();
});

/* ------------------------------ hero slider ------------------------------- */
async function loadHero() {
  const res = await API.getBanners();
  if (!res.success) return;
  const banners = res.data.items;
  const track = $('#hero-slides');
  const dots = $('#hero-dots');

  track.innerHTML = banners.map((b, i) => `
    <div class="hero-slide" role="group" aria-roledescription="slide"
         aria-label="${i + 1} of ${banners.length}">
      <img src="${url(b.image)}" alt="${esc(b.title)}" width="1600" height="620"
           ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      <div class="hero-copy">
        <span class="badge badge-flash">${icon('zap', 12)} Limited period</span>
        <h2>${esc(b.title)}</h2>
        <p>${esc(b.subtitle)}</p>
        <a class="btn btn-accent" href="${url(b.link)}">${esc(b.cta)} ${icon('arrowRight', 16)}</a>
      </div>
    </div>`).join('');

  dots.innerHTML = banners.map((b, i) =>
    `<button role="tab" aria-label="Show ${esc(b.title)}" aria-selected="${i === 0}"
       class="${i === 0 ? 'active' : ''}" data-slide="${i}"></button>`).join('');

  let index = 0, timer;
  const total = banners.length;

  const go = i => {
    index = (i + total) % total;
    track.style.transform = `translateX(-${index * 100}%)`;
    $$('#hero-dots button').forEach((d, n) => {
      d.classList.toggle('active', n === index);
      d.setAttribute('aria-selected', String(n === index));
    });
  };
  const play = () => { stop(); timer = setInterval(() => go(index + 1), 5200); };
  const stop = () => clearInterval(timer);

  $('#hero-next').addEventListener('click', () => { go(index + 1); play(); });
  $('#hero-prev').addEventListener('click', () => { go(index - 1); play(); });
  dots.addEventListener('click', e => {
    const b = e.target.closest('[data-slide]');
    if (b) { go(+b.dataset.slide); play(); }
  });

  const slider = $('#hero-slider');
  slider.addEventListener('mouseenter', stop);
  slider.addEventListener('mouseleave', play);
  slider.addEventListener('focusin', stop);
  slider.addEventListener('focusout', play);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : play());

  // Touch swipe
  let x0 = null;
  slider.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; stop(); }, { passive: true });
  slider.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
    x0 = null; play();
  }, { passive: true });

  // Keyboard
  slider.setAttribute('tabindex', '0');
  slider.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { go(index + 1); play(); }
    if (e.key === 'ArrowLeft') { go(index - 1); play(); }
  });

  play();
}

/* ------------------------------ categories -------------------------------- */
async function loadCategories() {
  const res = await API.getCategories();
  if (!res.success) return;
  const cats = res.data.items;

  $('#hero-cats').innerHTML = cats.map(c => `
    <li><a class="cat-link" href="${url('pages/category.html?cat=' + c.slug)}">
      <img src="${url(c.icon)}" alt="" width="26" height="26" loading="lazy">
      <span>${esc(c.name)}</span><span class="n">${c.productCount}</span>
    </a></li>`).join('');

  $('#cat-grid').innerHTML = cats.map(c => `
    <a class="cat-tile reveal" href="${url('pages/category.html?cat=' + c.slug)}">
      <img src="${url(c.icon)}" alt="" width="64" height="64" loading="lazy" decoding="async">
      <span>${esc(c.name)}</span>
      <small>${c.productCount} items</small>
    </a>`).join('');

  requestAnimationFrame(() => $$('#cat-grid .reveal').forEach((n, i) =>
    setTimeout(() => n.classList.add('visible'), i * 40)));
}

/* --------------------------- product sections ----------------------------- */
async function loadSection(tag, selector, isRail = false) {
  const res = await API.getProducts({ tag, pageSize: 12, sort: tag === 'flash' ? 'discount' : 'popular' });
  const node = $(selector);
  if (!res.success || !node) return;
  const items = remember(res.data.items);
  if (!items.length) { node.closest('section')?.setAttribute('hidden', ''); return; }
  isRail ? renderRail(node.closest('.rail-wrap') || node, items) : renderProducts(node, items);
}

async function loadRecommended() {
  // Recommendation blend: same categories as recently viewed, else top rated.
  const recent = Recent.all();
  let items = [];
  if (recent.length) {
    const res = await API.getProducts({ all: true });
    if (res.success) {
      const seen = new Set(recent.map(r => r.id));
      const brands = unique(recent.map(r => r.brand));
      items = res.data.items
        .filter(p => !seen.has(p.id))
        .map(p => ({ p, s: (brands.includes(p.brand) ? 3 : 0) + p.rating / 2 + (p.discount / 40) }))
        .sort((a, b) => b.s - a.s).slice(0, 12).map(x => x.p);
    }
  }
  if (!items.length) {
    const res = await API.getProducts({ tag: 'recommended', pageSize: 12, sort: 'rating' });
    if (res.success) items = res.data.items;
  }
  renderProducts($('#rec-grid'), remember(items));
}

function loadRecent() {
  const items = Recent.all();
  const section = $('#recent-section');
  if (!items.length) return;
  section.hidden = false;
  renderProducts($('#recent-rail'), items.map(r => ({
    ...r, inStock: true, ratingCount: 0, discount: 0, tags: [], deliveryDays: 3,
    thumb: r.image, sku: r.id, codAvailable: true
  })), { showCompare: false });
  $('#clear-recent').addEventListener('click', () => {
    Recent.clear(); section.hidden = true; toast.info('Browsing history cleared.');
  });
}

async function loadBrands() {
  const res = await API.getProducts({ all: true });
  if (!res.success) return;
  const brands = unique(res.data.items.map(p => p.brand)).slice(0, 12);
  $('#brand-row').innerHTML = brands.slice(0, 6).map(b =>
    `<a class="brand-chip" href="${url('pages/search.html?q=' + encodeURIComponent(b))}">${esc(b)}</a>`).join('');
}

/* -------------------------------- extras ---------------------------------- */
function renderUSP() {
  const items = [
    ['truck', 'Free delivery', `Above ${CONFIG.CURRENCY}${CONFIG.FREE_SHIP_ABOVE}`],
    ['rotate', 'Easy returns', 'Up to 30 days'],
    ['shield', '100% genuine', 'Brand authorised'],
    ['wallet', 'Secure payment', 'UPI, cards & COD']
  ];
  $('#usp-strip').innerHTML = items.map(([ic, t, s]) => `
    <div class="usp"><span class="ico">${icon(ic, 19)}</span>
      <div><b>${t}</b><span>${s}</span></div></div>`).join('');
}

/** Flash sale countdown — always ends at the next 6-hour boundary. */
function startCountdown() {
  const h = $('#cd-h'), m = $('#cd-m'), s = $('#cd-s');
  if (!h) return;
  const tick = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(Math.ceil((now.getHours() + 0.001) / 6) * 6, 0, 0, 0);
    let diff = Math.max(0, Math.floor((end - now) / 1000));
    h.textContent = String(Math.floor(diff / 3600)).padStart(2, '0');
    m.textContent = String(Math.floor(diff % 3600 / 60)).padStart(2, '0');
    s.textContent = String(diff % 60).padStart(2, '0');
  };
  tick();
  setInterval(tick, 1000);
}

/** Wire the prev/next buttons that sit outside .rail-wrap children. */
function wireRails() {
  $$('.rail-nav[data-rail]').forEach(btn => {
    const rail = document.getElementById(btn.dataset.rail);
    if (!rail) return;
    btn.innerHTML = icon(btn.classList.contains('prev') ? 'chevronLeft' : 'chevronRight', 18);
    btn.addEventListener('click', () => {
      rail.scrollBy({ left: (btn.classList.contains('prev') ? -1 : 1) * rail.clientWidth * 0.8, behavior: 'smooth' });
    });
  });
}
