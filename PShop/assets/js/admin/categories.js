/* ==========================================================================
   PShop Admin — Manage Categories
   ========================================================================== */
import { adminPage, $, $$, esc, icon, toast, tableLoading, tableEmpty,
         openModal, closeModal, wireModal } from './_admin-core.js';
import { api, API } from '../core/api.js';
import { url } from '../core/config.js';
import { confirmDialog } from '../components/toast.js';

let categories = [], editingId = null;

adminPage('categories.html', async () => {
  tableLoading($('#c-rows'), 6);
  await load();
  wireModal('#c-modal', ['#c-close', '#c-cancel']);
  $('#btn-add-cat').addEventListener('click', () => openForm(null));
  $('#c-form').addEventListener('submit', onSave);
});

async function load() {
  const res = await API.getCategories();
  categories = res.success ? res.data.items : [];
  render();
}

function render() {
  $('#c-count').textContent = `${categories.length} categories`;
  const tbody = $('#c-rows');
  if (!categories.length) return tableEmpty(tbody, 6, 'No categories yet.');

  tbody.innerHTML = categories.map(c => `
    <tr>
      <td><div class="cell-main">
        <img class="thumb" src="${url(c.icon || 'assets/img/misc/placeholder.svg')}"
             alt="" width="42" height="42" loading="lazy">
        <div><div class="nm">${esc(c.name)}</div>
          <div class="xs muted clamp-1">${esc(c.description || '')}</div></div>
      </div></td>
      <td><code class="xs">${esc(c.slug)}</code></td>
      <td><div class="xs muted clamp-2" style="max-width:260px">
        ${esc((c.subCategories || []).join(', ') || '—')}</div></td>
      <td class="semi">${c.productCount || 0}</td>
      <td><span class="badge badge-success">Active</span></td>
      <td><div class="actions">
        <button data-view="${esc(c.slug)}" title="View in store" aria-label="View">${icon('eye', 16)}</button>
        <button data-edit="${esc(c.id)}" title="Edit" aria-label="Edit">${icon('edit', 16)}</button>
        <button class="danger" data-del="${esc(c.id)}" title="Delete" aria-label="Delete">${icon('trash', 16)}</button>
      </div></td>
    </tr>`).join('');

  $$('[data-view]').forEach(b => b.onclick = () =>
    window.open(url('pages/category.html?cat=' + b.dataset.view), '_blank', 'noopener'));
  $$('[data-edit]').forEach(b => b.onclick = () => openForm(b.dataset.edit));
  $$('[data-del]').forEach(b => b.onclick = async () => {
    const c = categories.find(x => x.id === b.dataset.del);
    if (c?.productCount) {
      return toast.warn(`"${c.name}" has ${c.productCount} product(s). Move or delete them first.`);
    }
    const ok = await confirmDialog({
      title: 'Delete this category?', message: `"${c?.name}" will be removed permanently.`,
      confirmText: 'Delete', danger: true
    });
    if (!ok) return;
    const res = await api('adminDeleteCategory', { id: b.dataset.del });
    if (!res.success) return toast.error(res.message);
    toast.success('Category deleted.');
    await load();
  });
}

function openForm(id) {
  editingId = id;
  const form = $('#c-form');
  form.reset();
  form.querySelectorAll('.field').forEach(f => f.classList.remove('error'));

  $('#c-modal-title').textContent = id ? 'Edit category' : 'Add category';

  if (id) {
    const c = categories.find(x => x.id === id);
    if (c) {
      $('#cf-name').value = c.name;
      $('#cf-desc').value = c.description || '';
      $('#cf-subs').value = (c.subCategories || []).join(', ');
      $('#cf-color').value = c.color || '#2563eb';
      $('#cf-order').value = c.sortOrder || 1;
    }
  } else {
    $('#cf-order').value = categories.length + 1;
  }

  openModal('#c-modal');
  setTimeout(() => $('#cf-name').focus(), 150);
}

async function onSave(e) {
  e.preventDefault();
  const name = $('#cf-name').value.trim();
  const field = $('#cf-name').closest('.field');
  field.classList.toggle('error', name.length < 2);
  if (name.length < 2) return toast.error('Please enter a category name.');

  const category = {
    id: editingId || undefined,
    name,
    description: $('#cf-desc').value.trim(),
    subCategories: $('#cf-subs').value.split(',').map(s => s.trim()).filter(Boolean),
    color: $('#cf-color').value,
    sortOrder: Number($('#cf-order').value) || 999,
    status: 'active'
  };

  const btn = e.target.querySelector('button[type=submit]');
  btn.classList.add('is-loading');
  const res = await api(editingId ? 'adminUpdateCategory' : 'adminAddCategory', { category });
  btn.classList.remove('is-loading');

  if (!res.success) return toast.error(res.message);
  closeModal('#c-modal');
  toast.success(res.message);
  await load();
}
