/* ==========================================================================
   PShop — 404 page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $ } from '../core/utils.js';
import { SearchHistory } from '../core/state.js';
import { icon } from '../components/icons.js';

page(async () => {
  await initApp({ page: '404', nav: '', newsletter: false });

  $('#err-ico').innerHTML = icon('search', 19);
  $('#err-btn').innerHTML = icon('search', 17);

  $('#err-search').addEventListener('submit', e => {
    e.preventDefault();
    const term = $('#err-q').value.trim();
    if (!term) return $('#err-q').focus();
    SearchHistory.push(term);
    location.href = url('pages/search.html?q=' + encodeURIComponent(term));
  });

  // Jo URL nahi mila use console me log kar dete hain (debugging ke liye)
  console.info('[PShop] 404 — no page at:', location.pathname + location.search);
});
