/* ==========================================================================
   PShop — shared catalogue engine
   Powers shop.html, category.html and search.html: filters, sorting,
   pagination / infinite scroll, URL sync, desktop sidebar + mobile sheets.
   ========================================================================== */
import { CONFIG, url } from '../core/config.js';
import { $, $$, el, esc, money, qs, qsAll, setQuery, debounce, clamp, compact } from '../core/utils.js';
import { API } from '../core/api.js';
import { renderProducts } from '../components/product-card.js';
import { skeletonCards, emptyState } from '../components/lazy-load.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';

export const SORTS = [
  ['relevance', 'Relevance'], ['popular', 'Popularity'], ['price-asc', 'Price: Low to High'],
  ['price-desc', 'Price: High to Low'], ['rating', 'Customer Rating'],
  ['discount', 'Discount'], ['newest', 'Newest First']
];

/**
 * Create a catalogue controller.
 * @param {{fixedCategory?:string, query?:string, mount:string, countMount:string,
 *          sidebar:string, sortMount:string, pagerMount:string, chipsMount:string}} cfg
 */
export function createCatalog(cfg) {
  const state = {
    q: cfg.query ?? qs('q', '') ?? '',
    category: cfg.fixedCategory ?? qs('cat', '') ?? '',
    sub: (qs('sub', '') || '').split(',').filter(Boolean),
    brand: (qs('brand', '') || '').split(',').filter(Boolean),
    minPrice: qs('min', '') || '',
    maxPrice: qs('max', '') || '',
    rating: qs('rating', '') || '',
    discount: qs('discount', '') || '',
    inStock: qs('stock', '') === '1',
    tag: qs('tag', '') || '',
    sort: qs('sort', 'relevance'),
    page: +(qs('page', 1)) || 1,
    view: qs('view', 'grid'),
    total: 0, pages: 1, bounds: { min: 0, max: 100000 }
  };

  const cacheMap = new Map();
  const grid = $(cfg.mount);

  /* ------------------------------ data flow ----------------------------- */
  async function load({ scroll = false } = {}) {
    if (!scroll) skeletonCards(CONFIG.PAGE_SIZE, grid);
    const params = {
      q: state.q || undefined,
      category: state.category || undefined,
      sub: state.sub.length ? state.sub.join(',') : undefined,
      brand: state.brand.length ? state.brand.join(',') : undefined,
      minPrice: state.minPrice || undefined,
      maxPrice: state.maxPrice || undefined,
      rating: state.rating || undefined,
      discount: state.discount || undefined,
      inStock: state.inStock || undefined,
      tag: state.tag || undefined,
      sort: state.sort,
      page: state.page,
      pageSize: CONFIG.PAGE_SIZE
    };
    const res = await API.getProducts(params);
    if (!res.success) { toast.error(res.message); return; }
    const { items, total, pages } = res.data;
    items.forEach(p => cacheMap.set(p.id, p));
    state.total = total; state.pages = pages;

    if (!items.length) {
      emptyState(grid, {
        title: 'No products matched your filters',
        text: 'Try removing a filter or searching for something else.',
        actionLabel: 'Clear all filters', onAction: () => resetFilters()
      });
    } else {
      renderProducts(grid, items);
    }
    renderCount();
    renderChips();
    renderPager();
    syncUrl();
  }

  const reload = debounce(() => { state.page = 1; load(); }, 180);

  /* ------------------------------- filters ------------------------------ */
  async function buildSidebar() {
    const host = $(cfg.sidebar);
    if (!host) return;
    const res = await API.getFilters({ category: state.category });
    if (!res.success) return;
    const f = res.data;
    state.bounds = { min: Math.floor(f.min / 100) * 100, max: Math.ceil(f.max / 100) * 100 };

    host.innerHTML = `
      <div class="side-panel">
        <h4>Filters <button class="clear" data-clear-all>Clear all</button></h4>
        <div id="active-count" class="xs muted"></div>
      </div>

      ${!cfg.fixedCategory ? `
      <div class="side-panel">
        <h4>Category</h4>
        <div class="filter-list" id="f-cat">
          ${f.categories.map(c => `
            <label class="check"><input type="radio" name="fcat" value="${esc(c.value)}"
              ${state.categoryName === c.value ? 'checked' : ''}>
              <span>${esc(c.value)}</span><span class="count">${c.count}</span></label>`).join('')}
        </div>
      </div>` : ''}

      <div class="side-panel">
        <h4>Sub category</h4>
        <div class="filter-list" id="f-sub">
          ${f.subCategories.map(s => `
            <label class="check"><input type="checkbox" value="${esc(s.value)}"
              ${state.sub.includes(s.value) ? 'checked' : ''}>
              <span>${esc(s.value)}</span><span class="count">${s.count}</span></label>`).join('')}
        </div>
      </div>

      <div class="side-panel">
        <h4>Brand</h4>
        <input class="input" id="brand-search" type="search" placeholder="Search brand"
               aria-label="Filter brands" style="margin-bottom:.5rem;min-height:38px">
        <div class="filter-list" id="f-brand">
          ${f.brands.map(b => `
            <label class="check" data-brand="${esc(b.value.toLowerCase())}">
              <input type="checkbox" value="${esc(b.value)}" ${state.brand.includes(b.value) ? 'checked' : ''}>
              <span>${esc(b.value)}</span><span class="count">${b.count}</span></label>`).join('')}
        </div>
      </div>

      <div class="side-panel">
        <h4>Price</h4>
        <div class="price-inputs">
          <input class="input" type="number" id="f-min" placeholder="Min" min="0"
                 value="${esc(state.minPrice)}" aria-label="Minimum price">
          <span class="muted">to</span>
          <input class="input" type="number" id="f-max" placeholder="Max" min="0"
                 value="${esc(state.maxPrice)}" aria-label="Maximum price">
        </div>
        <input type="range" class="price-range" id="f-range" min="${state.bounds.min}"
               max="${state.bounds.max}" step="100" value="${state.maxPrice || state.bounds.max}"
               aria-label="Maximum price slider">
        <div class="flex justify-between xs muted"><span>${money(state.bounds.min)}</span>
          <span id="range-val">${money(state.maxPrice || state.bounds.max)}</span></div>
        <div class="chip-row mt-3">
          ${[[0,1000],[1000,5000],[5000,20000],[20000,'']].map(([a,b]) =>
            `<button class="chip" data-price="${a}-${b}">${b ? `${money(a)}–${money(b)}` : `${money(a)}+`}</button>`).join('')}
        </div>
      </div>

      <div class="side-panel">
        <h4>Customer rating</h4>
        <div class="filter-list">
          ${f.ratings.map(r => `
            <label class="check"><input type="radio" name="frating" value="${r.value}"
              ${+state.rating === r.value ? 'checked' : ''}>
              <span>${r.value}${icon('star', 12)} &amp; above</span>
              <span class="count">${r.count}</span></label>`).join('')}
        </div>
      </div>

      <div class="side-panel">
        <h4>Discount</h4>
        <div class="filter-list">
          ${[50, 40, 30, 20, 10].map(d => `
            <label class="check"><input type="radio" name="fdisc" value="${d}"
              ${+state.discount === d ? 'checked' : ''}><span>${d}% off or more</span></label>`).join('')}
        </div>
      </div>

      <div class="side-panel">
        <h4>Availability</h4>
        <label class="check"><input type="checkbox" id="f-stock" ${state.inStock ? 'checked' : ''}>
          <span>Exclude out of stock</span></label>
      </div>`;

    wireSidebar(host);
    renderActiveCount();
  }

  function wireSidebar(host) {
    host.querySelector('[data-clear-all]')?.addEventListener('click', resetFilters);

    host.querySelector('#f-sub')?.addEventListener('change', e => {
      state.sub = $$('#f-sub input:checked', host).map(i => i.value);
      reload();
    });
    host.querySelector('#f-brand')?.addEventListener('change', e => {
      state.brand = $$('#f-brand input:checked', host).map(i => i.value);
      reload();
    });
    host.querySelector('#f-cat')?.addEventListener('change', async e => {
      const catName = e.target.value;
      const cats = (await API.getCategories()).data.items;
      state.category = cats.find(c => c.name === catName)?.slug || '';
      state.sub = []; state.brand = [];
      state.page = 1;
      await buildSidebar();
      load();
    });

    const min = host.querySelector('#f-min'), max = host.querySelector('#f-max');
    const range = host.querySelector('#f-range'), rangeVal = host.querySelector('#range-val');
    const applyPrice = debounce(() => {
      state.minPrice = min.value; state.maxPrice = max.value; reload();
    }, 450);
    min?.addEventListener('input', applyPrice);
    max?.addEventListener('input', applyPrice);
    range?.addEventListener('input', () => {
      rangeVal.textContent = money(range.value);
      max.value = range.value;
    });
    range?.addEventListener('change', () => { state.maxPrice = range.value; reload(); });

    host.querySelectorAll('[data-price]').forEach(btn => btn.addEventListener('click', () => {
      const [a, b] = btn.dataset.price.split('-');
      state.minPrice = a; state.maxPrice = b || '';
      min.value = a; max.value = b || '';
      host.querySelectorAll('[data-price]').forEach(x => x.classList.toggle('active', x === btn));
      reload();
    }));

    host.querySelectorAll('[name="frating"]').forEach(r =>
      r.addEventListener('change', () => { state.rating = r.value; reload(); }));
    host.querySelectorAll('[name="fdisc"]').forEach(r =>
      r.addEventListener('change', () => { state.discount = r.value; reload(); }));
    host.querySelector('#f-stock')?.addEventListener('change', e => {
      state.inStock = e.target.checked; reload();
    });

    host.querySelector('#brand-search')?.addEventListener('input', e => {
      const t = e.target.value.toLowerCase();
      $$('[data-brand]', host).forEach(l =>
        l.style.display = l.dataset.brand.includes(t) ? '' : 'none');
    });
  }

  function resetFilters() {
    Object.assign(state, {
      sub: [], brand: [], minPrice: '', maxPrice: '', rating: '',
      discount: '', inStock: false, tag: '', page: 1
    });
    if (!cfg.fixedCategory) state.category = '';
    buildSidebar();
    load();
    toast.info('Filters cleared.');
  }

  /* ------------------------------- chrome ------------------------------- */
  function renderCount() {
    const node = $(cfg.countMount);
    if (!node) return;
    const from = (state.page - 1) * CONFIG.PAGE_SIZE + 1;
    const to = Math.min(state.page * CONFIG.PAGE_SIZE, state.total);
    node.innerHTML = state.total
      ? `Showing <strong>${from}\u2013${to}</strong> of <strong>${state.total}</strong> products`
      : 'No products found';
  }

  function renderActiveCount() {
    const n = state.sub.length + state.brand.length +
      (state.minPrice || state.maxPrice ? 1 : 0) + (state.rating ? 1 : 0) +
      (state.discount ? 1 : 0) + (state.inStock ? 1 : 0);
    const node = $('#active-count');
    if (node) node.textContent = n ? `${n} filter${n > 1 ? 's' : ''} applied` : 'No filters applied';
    $$('[data-filter-count]').forEach(x => { x.textContent = n || ''; x.dataset.count = n; });
  }

  function renderChips() {
    const host = $(cfg.chipsMount);
    if (!host) return;
    const chips = [];
    state.sub.forEach(v => chips.push(['sub', v, v]));
    state.brand.forEach(v => chips.push(['brand', v, v]));
    if (state.minPrice || state.maxPrice)
      chips.push(['price', '', `${money(state.minPrice || 0)} – ${state.maxPrice ? money(state.maxPrice) : 'any'}`]);
    if (state.rating) chips.push(['rating', '', `${state.rating}★ & above`]);
    if (state.discount) chips.push(['discount', '', `${state.discount}% off+`]);
    if (state.inStock) chips.push(['stock', '', 'In stock only']);
    if (state.tag) chips.push(['tag', '', state.tag]);

    host.innerHTML = chips.length
      ? chips.map(([type, val, label]) =>
          `<button class="chip active" data-chip="${type}" data-val="${esc(val)}">
             ${esc(label)} <span class="x">${icon('close', 11)}</span></button>`).join('') +
        `<button class="chip" data-chip="all">Clear all</button>`
      : '';

    host.querySelectorAll('[data-chip]').forEach(c => c.addEventListener('click', () => {
      const { chip, val } = c.dataset;
      if (chip === 'all') return resetFilters();
      if (chip === 'sub') state.sub = state.sub.filter(x => x !== val);
      if (chip === 'brand') state.brand = state.brand.filter(x => x !== val);
      if (chip === 'price') { state.minPrice = ''; state.maxPrice = ''; }
      if (chip === 'rating') state.rating = '';
      if (chip === 'discount') state.discount = '';
      if (chip === 'stock') state.inStock = false;
      if (chip === 'tag') state.tag = '';
      buildSidebar(); state.page = 1; load();
    }));
    renderActiveCount();
  }

  function renderPager() {
    const host = $(cfg.pagerMount);
    if (!host) return;
    if (state.pages <= 1) { host.innerHTML = ''; return; }
    const cur = state.page, last = state.pages;
    const nums = new Set([1, last, cur, cur - 1, cur + 1]);
    if (cur <= 3) [2, 3, 4].forEach(n => nums.add(n));
    if (cur >= last - 2) [last - 1, last - 2, last - 3].forEach(n => nums.add(n));
    const list = [...nums].filter(n => n >= 1 && n <= last).sort((a, b) => a - b);

    let html = `<button ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}" aria-label="Previous page">${icon('chevronLeft', 16)}</button>`;
    let prev = 0;
    list.forEach(n => {
      if (n - prev > 1) html += `<button disabled aria-hidden="true">…</button>`;
      html += `<button class="${n === cur ? 'active' : ''}" data-page="${n}"
        ${n === cur ? 'aria-current="page"' : ''}>${n}</button>`;
      prev = n;
    });
    html += `<button ${cur === last ? 'disabled' : ''} data-page="${cur + 1}" aria-label="Next page">${icon('chevronRight', 16)}</button>`;
    host.innerHTML = html;
    host.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
      state.page = clamp(+b.dataset.page, 1, last);
      load();
      window.scrollTo({ top: grid.offsetTop - 140, behavior: 'smooth' });
    }));
  }

  function buildSort() {
    const host = $(cfg.sortMount);
    if (!host) return;
    host.innerHTML = `
      <label class="sr-only" for="sort-sel">Sort products</label>
      <select class="select" id="sort-sel">
        ${SORTS.map(([v, l]) => `<option value="${v}" ${state.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>`;
    host.querySelector('#sort-sel').addEventListener('change', e => {
      state.sort = e.target.value; state.page = 1; load();
    });
  }

  function syncUrl() {
    setQuery({
      q: state.q || null,
      cat: cfg.fixedCategory ? null : (state.category || null),
      sub: state.sub, brand: state.brand,
      min: state.minPrice || null, max: state.maxPrice || null,
      rating: state.rating || null, discount: state.discount || null,
      stock: state.inStock ? '1' : null, tag: state.tag || null,
      sort: state.sort === 'relevance' ? null : state.sort,
      page: state.page > 1 ? state.page : null
    });
  }

  /* --------------------------- mobile controls -------------------------- */
  function wireMobileControls() {
    const openFilter = $('#btn-filter'), openSort = $('#btn-sort');
    const sheet = $('#filter-sheet'), sortSheet = $('#sort-sheet'), ov = $('#sheet-overlay');
    if (!sheet) return;

    const setSheet = (node, open) => {
      node.classList.toggle('open', open);
      ov.classList.toggle('open', open);
      document.body.classList.toggle('no-scroll', open);
    };

    openFilter?.addEventListener('click', () => {
      // Reuse the same sidebar markup inside the sheet on mobile.
      $('#filter-sheet-body').append(...$$(`${cfg.sidebar} > *`));
      setSheet(sheet, true);
    });
    $('#close-filter')?.addEventListener('click', () => {
      $(cfg.sidebar).append(...$$('#filter-sheet-body > *'));
      setSheet(sheet, false);
    });
    $('#apply-filter')?.addEventListener('click', () => {
      $(cfg.sidebar).append(...$$('#filter-sheet-body > *'));
      setSheet(sheet, false);
    });

    openSort?.addEventListener('click', () => {
      $('#sort-sheet-body').innerHTML = SORTS.map(([v, l]) =>
        `<label class="check" style="padding:.7rem .2rem">
           <input type="radio" name="msort" value="${v}" ${state.sort === v ? 'checked' : ''}>
           <span>${l}</span></label>`).join('');
      $$('#sort-sheet-body input').forEach(r => r.addEventListener('change', () => {
        state.sort = r.value; state.page = 1;
        const sel = $('#sort-sel'); if (sel) sel.value = r.value;
        load(); setSheet(sortSheet, false);
      }));
      setSheet(sortSheet, true);
    });
    $('#close-sort')?.addEventListener('click', () => setSheet(sortSheet, false));
    ov?.addEventListener('click', () => {
      if (sheet.classList.contains('open')) { $(cfg.sidebar).append(...$$('#filter-sheet-body > *')); }
      setSheet(sheet, false); setSheet(sortSheet, false);
    });
  }

  /* -------------------------------- init -------------------------------- */
  async function init() {
    buildSort();
    await buildSidebar();
    wireMobileControls();
    await load();
    window.addEventListener('popstate', () => location.reload());
  }

  return {
    init, load, state,
    getProduct: id => cacheMap.get(id),
    setQuery(term) { state.q = term; state.page = 1; load(); },
    setTag(tag) { state.tag = tag; state.page = 1; load(); }
  };
}

/** Shared mobile filter/sort sheet markup. */
export const mobileSheets = `
<div class="overlay" id="sheet-overlay"></div>
<div class="sheet" id="filter-sheet" role="dialog" aria-modal="true" aria-label="Filters">
  <div class="sheet-grip"></div>
  <div class="sheet-head"><strong>Filters</strong>
    <button class="btn-icon btn-ghost" id="close-filter" aria-label="Close filters">&times;</button></div>
  <div class="sheet-body" id="filter-sheet-body"></div>
  <div class="drawer-foot"><button class="btn btn-primary btn-block" id="apply-filter">Show results</button></div>
</div>
<div class="sheet" id="sort-sheet" role="dialog" aria-modal="true" aria-label="Sort">
  <div class="sheet-grip"></div>
  <div class="sheet-head"><strong>Sort by</strong>
    <button class="btn-icon btn-ghost" id="close-sort" aria-label="Close sort">&times;</button></div>
  <div class="sheet-body" id="sort-sheet-body"></div>
</div>`;

/** Sticky mobile filter/sort toolbar. */
export const mobileToolbar = `
<div class="mobile-tools show-mobile">
  <button class="btn btn-secondary btn-sm" id="btn-sort">${icon('sort', 16)} Sort</button>
  <button class="btn btn-secondary btn-sm" id="btn-filter">${icon('filter', 16)} Filter
    <span class="count-bubble" data-filter-count style="position:static;border:0"></span></button>
</div>`;
