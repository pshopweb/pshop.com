/* ==========================================================================
   PShop — Wishlist page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, $$, esc, money } from '../core/utils.js';
import { Wishlist, Cart } from '../core/state.js';
import { API } from '../core/api.js';
import { renderProducts } from '../components/product-card.js';
import { emptyState } from '../components/lazy-load.js';
import { toast, confirmDialog } from '../components/toast.js';

let sortMode = 'recent';
const cache = new Map();

page(async () => {
  await initApp({ page: 'wishlist', nav: '', getProduct: id => cache.get(id) });
  await render();
  window.addEventListener('pshop:wishlist', render);
});

async function render() {
  const saved = Wishlist.all();
  const grid = $('#wish-grid'), empty = $('#wish-empty'), tools = $('#wish-toolbar');

  if (!saved.length) {
    grid.innerHTML = ''; tools.hidden = true; empty.hidden = false;
    $('#wish-count').textContent = 'You have not saved anything yet';
    emptyState(empty, {
      title: 'Your wishlist is empty',
      text: 'Tap the heart icon on any product to save it here for later.',
      actionLabel: 'Discover products', actionHref: url('pages/shop.html')
    });
    loadRecs();
    return;
  }

  empty.hidden = true; tools.hidden = false;
  $('#wish-count').textContent = `${saved.length} product${saved.length > 1 ? 's' : ''} saved`;

  // Hydrate full product records so cards show live stock and ratings.
  const res = await API.getProducts({ ids: saved.map(s => s.id).join(','), all: true });
  let items = res.success && res.data.items.length
    ? res.data.items
    : saved.map(s => ({ ...s, inStock: true, ratingCount: 0, tags: [], thumb: s.image,
                        deliveryDays: 3, sku: s.id, codAvailable: true, category: '', subCategory: '' }));

  const order = new Map(saved.map((s, i) => [s.id, i]));
  items.sort((a, b) => {
    if (sortMode === 'price-asc') return a.price - b.price;
    if (sortMode === 'price-desc') return b.price - a.price;
    if (sortMode === 'discount') return (b.discount || 0) - (a.discount || 0);
    return order.get(a.id) - order.get(b.id);
  });

  items.forEach(p => cache.set(p.id, p));
  renderProducts(grid, items);
  wireTools(items);
  loadRecs();
}

function wireTools(items) {
  $$('[data-sort]').forEach(b => b.onclick = () => {
    $$('[data-sort]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    sortMode = b.dataset.sort;
    render();
  });

  $('#add-all').onclick = () => {
    const inStock = items.filter(p => p.inStock !== false);
    if (!inStock.length) return toast.warn('None of your saved items are in stock right now.');
    inStock.forEach(p => Cart.add(p, 1));
    toast.success(`${inStock.length} item(s) added to your cart.`, {
      action: { label: 'View cart', onClick: () => location.href = url('pages/cart.html') }
    });
  };

  $('#clear-wish').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Clear wishlist?', message: 'All saved products will be removed.',
      confirmText: 'Clear all', danger: true
    });
    if (ok) { Wishlist.clear(); toast.info('Wishlist cleared.'); }
  };
}

async function loadRecs() {
  const res = await API.getProducts({ tag: 'recommended', pageSize: 10, sort: 'rating' });
  if (!res.success || !res.data.items.length) return;
  res.data.items.forEach(p => cache.set(p.id, p));
  $('#wish-recs').hidden = false;
  renderProducts($('#wish-rec-rail'), res.data.items);
}
