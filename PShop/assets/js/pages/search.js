/* ==========================================================================
   PShop — Search results page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, $$, esc, qs } from '../core/utils.js';
import { API } from '../core/api.js';
import { SearchHistory } from '../core/state.js';
import { createCatalog } from './_catalog.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/lazy-load.js';

page(async () => {
  const term = (qs('q', '') || '').trim();
  let catalog = null;

  await initApp({ page: 'search', nav: 'shop', getProduct: id => catalog?.getProduct(id) });

  $('#term').textContent = term ? `“${term}”` : 'all products';
  document.title = term ? `Search: ${term} — PShop` : 'Search — PShop';
  if (term) SearchHistory.push(term);

  $('#btn-sort').insertAdjacentHTML('afterbegin', icon('sort', 16));
  $('#btn-filter').insertAdjacentHTML('afterbegin', icon('filter', 16));

  // Related-term suggestions come from the same scoring engine as the header.
  if (term) {
    const sug = await API.searchProducts({ q: term, limit: 1 });
    if (sug.success) {
      const { suggestions, total } = sug.data;
      if (suggestions?.length) {
        $('#related').innerHTML = `<span class="xs muted" style="align-self:center">Related:</span>` +
          suggestions.map(s => `<a class="chip" href="${url('pages/search.html?q=' + encodeURIComponent(s.label))}">${esc(s.label)}</a>`).join('');
      }
      if (!total) {
        $('#dym').hidden = false;
        $('#dym').innerHTML = `No exact matches. Try a broader term, check the spelling,
          or <button id="browse-all">browse all products</button>.`;
        $('#browse-all')?.addEventListener('click', () => location.href = url('pages/shop.html'));
      }
    }
  }

  catalog = createCatalog({
    query: term,
    mount: '#product-grid', countMount: '#result-count', sidebar: '#filter-sidebar',
    sortMount: '#sort-mount', pagerMount: '#pager', chipsMount: '#active-chips'
  });
  await catalog.init();
});
