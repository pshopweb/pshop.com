/* ==========================================================================
   PShop — Shop page controller
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { $, qs, titleCase } from '../core/utils.js';
import { createCatalog } from './_catalog.js';
import { icon } from '../components/icons.js';

page(async () => {
  const catalog = createCatalog({
    mount: '#product-grid', countMount: '#result-count', sidebar: '#filter-sidebar',
    sortMount: '#sort-mount', pagerMount: '#pager', chipsMount: '#active-chips'
  });

  await initApp({ page: 'shop', nav: 'shop', getProduct: id => catalog.getProduct(id) });

  // Title reflects any tag/query the user arrived with.
  const tag = qs('tag'), q = qs('q');
  const titles = {
    flash: 'Flash Sale', trending: 'Trending Now', bestseller: 'Best Sellers',
    featured: 'Featured Products', new: 'New Arrivals', recommended: 'Recommended For You'
  };
  if (tag) $('#shop-title').textContent = titles[tag] || titleCase(tag);
  else if (q) $('#shop-title').textContent = `Results for “${q}”`;

  // Restore icons in the mobile toolbar buttons.
  $('#btn-sort').insertAdjacentHTML('afterbegin', icon('sort', 16));
  $('#btn-filter').insertAdjacentHTML('afterbegin', icon('filter', 16));

  await catalog.init();
});
