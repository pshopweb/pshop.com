/* ==========================================================================
   PShop Admin — Manage Products (list, search, filter, add, edit, delete)
   ========================================================================== */
import { adminPage, $, $$, esc, money, icon, toast, tableLoading, tableEmpty,
         openModal, closeModal, wireModal } from './_admin-core.js';
import { api, API } from '../core/api.js';
import { debounce, qs, clamp, compact } from '../core/utils.js';
import { url } from '../core/config.js';
import { confirmDialog } from '../components/toast.js';
import { createUploader } from './_uploader.js';

let products = [], categories = [], editingId = null, uploader = null;
let term = '', catFilter = '', stockFilter = qs('stock', '') || '', page = 1;
const PER_PAGE = 15;

adminPage('products.html', async () => {
  $('#ico-search').innerHTML = icon('search', 18);
  tableLoading($('#p-rows'), 7);

  const [pRes, cRes] = await Promise.all([
    API.getProducts({ all: true }),
    API.getCategories()
  ]);
  products = pRes.success ? pRes.data.items : [];
  categories = cRes.success ? cRes.data.items : [];

  $('#p-cat').innerHTML = '<option value="">All categories</option>' +
    categories.map(c => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
  $('#f-cat').innerHTML = '<option value="">Select category</option>' +
    categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');

  if (stockFilter) $('#p-stock').value = stockFilter;

  render();
  wireToolbar();
  wireForm();

  // Drag-drop image uploader — Drive par upload karke URL wapas deta hai.
  uploader = createUploader({
    zone: '#upload-zone', input: '#f-file', preview: '#img-preview',
    folder: 'Products',
    onChange: urls => {
      // Manual textarea ko sync me rakho taaki dono jagah same list rahe.
      const box = $('#f-images');
      if (box) box.value = urls.join('\n');
    }
  });
});

/* -------------------------------- render ---------------------------------- */
function filtered() {
  let list = products;
  if (term) {
    const t = term.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(t) ||
      String(p.brand).toLowerCase().includes(t) ||
      String(p.sku || '').toLowerCase().includes(t));
  }
  if (catFilter) list = list.filter(p => p.categorySlug === catFilter);
  if (stockFilter === 'in') list = list.filter(p => p.stock > 0);
  if (stockFilter === 'low') list = list.filter(p => p.stock > 0 && p.stock < 10);
  if (stockFilter === 'out') list = list.filter(p => !p.stock);
  return list;
}

function render() {
  const list = filtered();
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  page = clamp(page, 1, pages);
  const slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  $('#p-count').textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
  const tbody = $('#p-rows');

  if (!slice.length) {
    tableEmpty(tbody, 7, term || catFilter || stockFilter
      ? 'No products match these filters.' : 'No products yet. Add your first one.');
    $('#p-pager').innerHTML = '';
    return;
  }

  tbody.innerHTML = slice.map(p => `
    <tr data-id="${esc(p.id)}">
      <td>
        <div class="cell-main">
          <img class="thumb" src="${url(p.thumb || 'assets/img/misc/placeholder.svg')}"
               alt="" width="42" height="42" loading="lazy">
          <div style="min-width:0">
            <div class="nm clamp-1">${esc(p.name)}</div>
            <div class="xs muted">${esc(p.brand)} · ${esc(p.sku || p.id)}</div>
          </div>
        </div>
      </td>
      <td><div class="small">${esc(p.category)}</div>
        <div class="xs muted">${esc(p.subCategory || '')}</div></td>
      <td><div class="semi">${money(p.price)}</div>
        ${p.mrp > p.price ? `<div class="xs muted"><s>${money(p.mrp)}</s> ${p.discount}% off</div>` : ''}</td>
      <td><span class="badge ${!p.stock ? 'badge-danger' : p.stock < 10 ? 'badge-warning' : 'badge-success'}">
        ${p.stock} left</span></td>
      <td class="small">${p.rating ? `${p.rating} ★ (${compact(p.ratingCount)})` : '—'}</td>
      <td><span class="badge ${p.status === 'deleted' ? 'badge-muted' : 'badge-success'}">
        ${p.status === 'deleted' ? 'Hidden' : 'Active'}</span></td>
      <td><div class="actions">
        <button data-view="${esc(p.id)}" title="View in store" aria-label="View">${icon('eye', 16)}</button>
        <button data-edit="${esc(p.id)}" title="Edit" aria-label="Edit">${icon('edit', 16)}</button>
        <button class="danger" data-del="${esc(p.id)}" title="Delete" aria-label="Delete">${icon('trash', 16)}</button>
      </div></td>
    </tr>`).join('');

  renderPager(pages);
  wireRowActions();
}

function renderPager(pages) {
  const host = $('#p-pager');
  if (pages <= 1) { host.innerHTML = ''; return; }
  host.innerHTML = `
    <button ${page === 1 ? 'disabled' : ''} data-p="${page - 1}">${icon('chevronLeft', 15)}</button>
    ${Array.from({ length: pages }, (_, i) => i + 1)
      .filter(n => n === 1 || n === pages || Math.abs(n - page) <= 1)
      .map((n, i, arr) =>
        (i > 0 && n - arr[i - 1] > 1 ? '<button disabled>…</button>' : '') +
        `<button class="${n === page ? 'active' : ''}" data-p="${n}">${n}</button>`).join('')}
    <button ${page === pages ? 'disabled' : ''} data-p="${page + 1}">${icon('chevronRight', 15)}</button>`;
  $$('#p-pager [data-p]').forEach(b => b.onclick = () => { page = +b.dataset.p; render(); });
}

function wireRowActions() {
  $$('[data-view]').forEach(b => b.onclick = () =>
    window.open(url('pages/product-details.html?id=' + b.dataset.view), '_blank', 'noopener'));

  $$('[data-edit]').forEach(b => b.onclick = () => openForm(b.dataset.edit));

  $$('[data-del]').forEach(b => b.onclick = async () => {
    const p = products.find(x => x.id === b.dataset.del);
    const ok = await confirmDialog({
      title: 'Delete this product?',
      message: `"${p?.name}" will be hidden from the store. Existing orders are not affected.`,
      confirmText: 'Delete', danger: true
    });
    if (!ok) return;
    const res = await api('adminDeleteProduct', { id: b.dataset.del });
    if (!res.success) return toast.error(res.message);
    products = products.filter(x => x.id !== b.dataset.del);
    toast.success('Product deleted.');
    render();
  });
}

/* ------------------------------- toolbar ---------------------------------- */
function wireToolbar() {
  $('#p-search').addEventListener('input', debounce(e => {
    term = e.target.value.trim(); page = 1; render();
  }, 220));
  $('#p-cat').addEventListener('change', e => { catFilter = e.target.value; page = 1; render(); });
  $('#p-stock').addEventListener('change', e => { stockFilter = e.target.value; page = 1; render(); });
  $('#btn-add-product').addEventListener('click', () => openForm(null));
}

/* --------------------------------- form ----------------------------------- */
function openForm(id) {
  editingId = id;
  const form = $('#p-form');
  form.reset();
  form.querySelectorAll('.field').forEach(f => f.classList.remove('error'));

  $('#p-modal-title').textContent = id ? 'Edit product' : 'Add product';
  $('#p-save').textContent = id ? 'Update product' : 'Save product';

  if (id) {
    const p = products.find(x => x.id === id);
    if (p) {
      $('#f-name').value = p.name; $('#f-brand').value = p.brand;
      $('#f-cat').value = p.categoryId || '';
      populateSubs(p.categoryId);
      $('#f-sub').value = p.subCategory || '';
      $('#f-price').value = p.price; $('#f-mrp').value = p.mrp;
      $('#f-stock').value = p.stock; $('#f-delivery').value = p.deliveryDays;
      $('#f-return').value = p.returnDays;
      $('#f-warranty').value = p.specs?.Warranty || '1 Year';
      $('#f-desc').value = p.description || '';
      $('#f-images').value = (p.images || []).join('\n');
      uploader?.setUrls(p.images || []);
      $('#f-colors').value = (p.colors || []).join(', ');
      $('#f-tags').value = (p.tags || []).join(', ');
      $('#f-cod').checked = p.codAvailable !== false;
      $('#f-active').checked = p.status !== 'deleted';
    }
  } else {
    populateSubs('');
    uploader?.clear();
  }

  openModal('#p-modal');
  setTimeout(() => $('#f-name').focus(), 150);
}

function populateSubs(categoryId) {
  const cat = categories.find(c => c.id === categoryId);
  $('#f-sub').innerHTML = '<option value="">Select sub category</option>' +
    (cat?.subCategories || []).map(s => `<option>${esc(s)}</option>`).join('');
}

function wireForm() {
  wireModal('#p-modal', ['#p-close', '#p-cancel']);
  $('#f-cat').addEventListener('change', e => populateSubs(e.target.value));

  $('#p-form').addEventListener('submit', async e => {
    e.preventDefault();

    const checks = [
      ['f-name', $('#f-name').value.trim().length >= 2, 'Name is required.'],
      ['f-brand', $('#f-brand').value.trim().length >= 1, 'Brand is required.'],
      ['f-cat', !!$('#f-cat').value, 'Choose a category.'],
      ['f-price', Number($('#f-price').value) > 0, 'Enter a valid price.']
    ];
    let valid = true;
    checks.forEach(([id, pass, msg]) => {
      const field = $('#' + id).closest('.field');
      field.classList.toggle('error', !pass);
      const err = field.querySelector('.err-msg');
      if (err && !pass) err.textContent = msg;
      if (!pass && valid) { $('#' + id).focus(); valid = false; }
      else if (!pass) valid = false;
    });
    if (!valid) return toast.error('Please fix the highlighted fields.');

    const cat = categories.find(c => c.id === $('#f-cat').value);
    const price = Number($('#f-price').value);
    const mrp = Number($('#f-mrp').value) || price;
    // Uploader ki list aur manual textarea — dono merge karo, duplicates hatao.
    const manual = $('#f-images').value.split('\n').map(s => s.trim()).filter(Boolean);
    const uploaded = uploader?.getUrls() || [];
    const images = [...new Set([...uploaded, ...manual])];

    const product = {
      id: editingId || undefined,
      name: $('#f-name').value.trim(),
      brand: $('#f-brand').value.trim(),
      categoryId: cat?.id || '', category: cat?.name || '', categorySlug: cat?.slug || '',
      subCategory: $('#f-sub').value,
      price, mrp,
      stock: Number($('#f-stock').value) || 0,
      deliveryDays: Number($('#f-delivery').value) || 3,
      returnDays: Number($('#f-return').value) || 7,
      description: $('#f-desc').value.trim(),
      images, thumb: images[0] || '',
      colors: $('#f-colors').value.split(',').map(s => s.trim()).filter(Boolean),
      tags: $('#f-tags').value.split(',').map(s => s.trim()).filter(Boolean),
      specs: { Brand: $('#f-brand').value.trim(), Warranty: $('#f-warranty').value.trim(),
               Category: cat?.name || '', 'Country of Origin': 'India' },
      codAvailable: $('#f-cod').checked,
      status: $('#f-active').checked ? 'active' : 'deleted'
    };

    const btn = $('#p-save');
    btn.classList.add('is-loading');
    const res = await api(editingId ? 'adminUpdateProduct' : 'adminAddProduct', { product });
    btn.classList.remove('is-loading');

    if (!res.success) return toast.error(res.message);

    // Local list update karo taaki page refresh na karna pade.
    const saved = res.data.product;
    if (editingId) {
      const i = products.findIndex(x => x.id === editingId);
      if (i > -1) products[i] = { ...products[i], ...saved };
    } else {
      products.unshift(saved);
    }

    closeModal('#p-modal');
    toast.success(res.message);
    render();
  });
}
