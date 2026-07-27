/* ==========================================================================
   PShop Admin — Moderate Reviews
   ========================================================================== */
import { adminPage, $, $$, esc, icon, toast, tableLoading, tableEmpty } from './_admin-core.js';
import { api, API } from '../core/api.js';
import { fmtDate, starsHTML } from '../core/utils.js';
import { url } from '../core/config.js';
import { confirmDialog } from '../components/toast.js';

let reviews = [], products = {}, filter = 'all';

adminPage('reviews.html', async () => {
  tableLoading($('#r-rows'), 7);

  const pRes = await API.getProducts({ all: true });
  if (pRes.success) pRes.data.items.forEach(p => { products[p.id] = p; });

  await load();

  $$('[data-rstatus]').forEach(b => b.onclick = () => {
    $$('[data-rstatus]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    filter = b.dataset.rstatus;
    render();
  });
});

async function load() {
  const res = await api('adminReviews', {});
  reviews = res.success ? res.data.items : [];

  // Backend na ho to har product ke reviews jodkar list bana lo.
  if (!reviews.length) {
    const ids = Object.keys(products).slice(0, 40);
    const all = await Promise.all(ids.map(id => API.getProduct({ id })));
    reviews = all.flatMap(r => r.success ? (r.data.reviews || []) : []);
  }
  render();
}

function render() {
  let list = reviews;
  if (filter !== 'all') list = list.filter(r => String(r.status || 'approved') === filter);

  $('#r-count').textContent = `${list.length} review${list.length === 1 ? '' : 's'}`;
  const tbody = $('#r-rows');
  const empty = $('#r-empty');

  if (!list.length) {
    empty.hidden = true;
    return tableEmpty(tbody, 7, reviews.length
      ? 'No reviews with this status.' : 'No customer reviews yet.');
  }
  empty.hidden = true;

  tbody.innerHTML = list.slice(0, 100).map(r => {
    const p = products[r.productId];
    const hidden = String(r.status) === 'hidden';
    return `
    <tr>
      <td><div class="cell-main">
        <img class="thumb" src="${url(p?.thumb || 'assets/img/misc/placeholder.svg')}"
             alt="" width="42" height="42" loading="lazy">
        <div style="min-width:0"><div class="nm clamp-1">${esc(p?.name || r.productId)}</div>
          <div class="xs muted">${esc(r.productId)}</div></div>
      </div></td>
      <td><div class="small semi">${esc(r.user)}</div>
        ${r.verified ? '<span class="badge badge-success" style="font-size:9px">Verified</span>' : ''}</td>
      <td>${starsHTML(r.rating, 13)}</td>
      <td><div class="small semi">${esc(r.title || '')}</div>
        <div class="xs muted clamp-2" style="max-width:280px">${esc(r.comment)}</div></td>
      <td class="xs muted">${fmtDate(r.date || r.createdAt)}</td>
      <td><span class="badge ${hidden ? 'badge-muted' : 'badge-success'}">
        ${hidden ? 'Hidden' : 'Approved'}</span></td>
      <td><div class="actions">
        <button data-toggle="${esc(r.id)}" data-hidden="${hidden}"
          title="${hidden ? 'Approve' : 'Hide'}" aria-label="${hidden ? 'Approve' : 'Hide'}">
          ${icon(hidden ? 'eye' : 'eyeOff', 16)}</button>
        <button class="danger" data-del="${esc(r.id)}" title="Delete" aria-label="Delete">
          ${icon('trash', 16)}</button>
      </div></td>
    </tr>`;
  }).join('');

  $$('[data-toggle]').forEach(b => b.onclick = async () => {
    const hidden = b.dataset.hidden === 'true';
    const res = await api('adminModerateReview',
      { id: b.dataset.toggle, action: hidden ? 'approve' : 'hide' });
    if (!res.success) return toast.error(res.message);
    const r = reviews.find(x => x.id === b.dataset.toggle);
    if (r) r.status = hidden ? 'approved' : 'hidden';
    toast.success(hidden ? 'Review approved.' : 'Review hidden.');
    render();
  });

  $$('[data-del]').forEach(b => b.onclick = async () => {
    const ok = await confirmDialog({
      title: 'Delete this review?',
      message: 'It will be removed permanently and the product rating recalculated.',
      confirmText: 'Delete', danger: true
    });
    if (!ok) return;
    const res = await api('adminModerateReview', { id: b.dataset.del, action: 'delete' });
    if (!res.success) return toast.error(res.message);
    reviews = reviews.filter(x => x.id !== b.dataset.del);
    toast.success('Review deleted.');
    render();
  });
}
