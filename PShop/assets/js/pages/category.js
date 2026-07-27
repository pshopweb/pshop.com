/* ==========================================================================
   PShop — Category page: index view (no ?cat) or filtered category view
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, $$, esc, qs, setQuery } from '../core/utils.js';
import { API } from '../core/api.js';
import { createCatalog } from './_catalog.js';
import { icon } from '../components/icons.js';

page(async () => {
  const slug = qs('cat', '');
  let catalog = null;

  await initApp({ page: 'category', nav: 'categories', getProduct: id => catalog?.getProduct(id) });

  const res = await API.getCategories();
  const cats = res.success ? res.data.items : [];

  if (!slug) { renderIndex(cats); return; }

  const cat = cats.find(c => c.slug === slug);
  if (!cat) { renderIndex(cats); return; }

  /* ------------------------- category detail view ------------------------ */
  $('#cat-detail-view').hidden = false;
  document.title = `${cat.name} — Shop ${cat.name} Online | PShop`;
  document.querySelector('meta[name="description"]')
    ?.setAttribute('content', `${cat.description}. Shop ${cat.productCount}+ ${cat.name.toLowerCase()} products on PShop with fast delivery and easy returns.`);

  $('#crumb').innerHTML = `
    <a href="${url('index.html')}">Home</a><span class="sep">/</span>
    <a href="${url('pages/category.html')}">Categories</a><span class="sep">/</span>
    <span aria-current="page">${esc(cat.name)}</span>`;

  $('#cat-banner').innerHTML =
    `<img src="${url(cat.banner)}" alt="${esc(cat.name)} — ${esc(cat.description)}"
      width="1600" height="400" fetchpriority="high">`;

  $('#cat-title').textContent = cat.name;

  const activeSub = (qs('sub', '') || '').split(',').filter(Boolean);
  $('#sub-chips').innerHTML = cat.subCategories.map(s =>
    `<button class="chip ${activeSub.includes(s) ? 'active' : ''}" data-sub="${esc(s)}" role="listitem">${esc(s)}</button>`).join('');

  $('#btn-sort').insertAdjacentHTML('afterbegin', icon('sort', 16));
  $('#btn-filter').insertAdjacentHTML('afterbegin', icon('filter', 16));

  catalog = createCatalog({
    fixedCategory: slug,
    mount: '#product-grid', countMount: '#result-count', sidebar: '#filter-sidebar',
    sortMount: '#sort-mount', pagerMount: '#pager', chipsMount: '#active-chips'
  });
  await catalog.init();

  // Sub-category quick chips stay in sync with the sidebar checkboxes.
  $$('#sub-chips [data-sub]').forEach(chip => chip.addEventListener('click', () => {
    const val = chip.dataset.sub;
    const set = new Set(catalog.state.sub);
    set.has(val) ? set.delete(val) : set.add(val);
    catalog.state.sub = [...set];
    catalog.state.page = 1;
    chip.classList.toggle('active');
    $$('#filter-sidebar #f-sub input').forEach(i => { i.checked = set.has(i.value); });
    catalog.load();
  }));
});

/* ---------------------------- category index ----------------------------- */
function renderIndex(cats) {
  $('#cat-index-view').hidden = false;
  $('#cat-index').innerHTML = cats.map(c => `
    <article class="cat-card reveal">
      <a class="top" href="${url('pages/category.html?cat=' + c.slug)}">
        <img src="${url(c.icon)}" alt="" width="56" height="56" loading="lazy">
        <div><h3>${esc(c.name)}</h3><p>${c.productCount} products</p></div>
      </a>
      <div class="subs">
        ${c.subCategories.slice(0, 4).map(s =>
          `<a href="${url(`pages/category.html?cat=${c.slug}&sub=${encodeURIComponent(s)}`)}">${esc(s)}</a>`).join('')}
      </div>
    </article>`).join('');
  requestAnimationFrame(() => $$('#cat-index .reveal').forEach((n, i) =>
    setTimeout(() => n.classList.add('visible'), i * 50)));
}
