/* ==========================================================================
   PShop Admin — Manage Coupons
   ========================================================================== */
import { adminPage, $, $$, esc, money, icon, toast, tableLoading, tableEmpty,
         openModal, closeModal, wireModal } from './_admin-core.js';
import { api, API } from '../core/api.js';
import { fmtDate, copyText } from '../core/utils.js';
import { confirmDialog } from '../components/toast.js';

let coupons = [], editing = null;

adminPage('coupons.html', async () => {
  tableLoading($('#cp-rows'), 8);
  await load();
  wireModal('#cp-modal', ['#cp-close', '#cp-cancel']);
  $('#btn-add-coupon').addEventListener('click', () => openForm(null));
  $('#cp-form').addEventListener('submit', onSave);

  // "Free shipping" chunne par value field ka matlab nahi rehta
  $('#cpf-type').addEventListener('change', e => {
    const isShip = e.target.value === 'shipping';
    $('#cpf-value').disabled = isShip;
    $('#cpf-max').disabled = isShip;
    if (isShip) { $('#cpf-value').value = 0; }
  });
});

async function load() {
  const res = await api('adminCoupons', {});
  coupons = res.success ? res.data.items : (await API.getCoupons()).data?.items || [];
  render();
}

function render() {
  $('#cp-count').textContent = `${coupons.length} coupon${coupons.length === 1 ? '' : 's'}`;
  const tbody = $('#cp-rows');
  if (!coupons.length) return tableEmpty(tbody, 8, 'No coupons yet. Create your first one.');

  const now = Date.now();
  tbody.innerHTML = coupons.map(c => {
    const expired = c.expiry && new Date(c.expiry).getTime() < now;
    const active = (c.active === true || c.active === 'TRUE') && !expired;
    const used = Number(c.usedCount) || 0;
    const limit = Number(c.usageLimit) || 0;
    return `
    <tr>
      <td><button class="semi" data-copy="${esc(c.code)}" title="Copy code"
            style="color:var(--brand-600);font-family:ui-monospace,monospace">
            ${esc(c.code)} ${icon('copy', 12)}</button>
        <div class="xs muted clamp-1" style="max-width:220px">${esc(c.description || '')}</div></td>
      <td class="xs">${c.type === 'percent' ? 'Percentage' : c.type === 'flat' ? 'Flat amount' : 'Free shipping'}</td>
      <td class="semi">${c.type === 'percent' ? c.value + '%'
        : c.type === 'flat' ? money(c.value) : '—'}</td>
      <td class="small">${Number(c.minOrder) ? money(c.minOrder) : 'None'}</td>
      <td class="small">${used}${limit ? ` / ${limit}` : ''}</td>
      <td class="xs muted">${c.expiry ? fmtDate(c.expiry) : 'Never'}</td>
      <td><span class="badge ${active ? 'badge-success' : 'badge-muted'}">
        ${expired ? 'Expired' : active ? 'Active' : 'Inactive'}</span></td>
      <td><div class="actions">
        <button data-edit="${esc(c.code)}" title="Edit" aria-label="Edit">${icon('edit', 16)}</button>
        <button class="danger" data-del="${esc(c.code)}" title="Delete" aria-label="Delete">${icon('trash', 16)}</button>
      </div></td>
    </tr>`;
  }).join('');

  $$('[data-copy]').forEach(b => b.onclick = async () =>
    (await copyText(b.dataset.copy)) ? toast.success('Code copied.') : toast.error('Could not copy.'));

  $$('[data-edit]').forEach(b => b.onclick = () => openForm(b.dataset.edit));

  $$('[data-del]').forEach(b => b.onclick = async () => {
    const ok = await confirmDialog({
      title: 'Delete this coupon?',
      message: `Code "${b.dataset.del}" will stop working immediately.`,
      confirmText: 'Delete', danger: true
    });
    if (!ok) return;
    const res = await api('adminDeleteCoupon', { code: b.dataset.del });
    if (!res.success) return toast.error(res.message);
    toast.success('Coupon deleted.');
    await load();
  });
}

function openForm(code) {
  editing = code;
  const form = $('#cp-form');
  form.reset();
  form.querySelectorAll('.field').forEach(f => f.classList.remove('error'));

  $('#cp-modal-title').textContent = code ? 'Edit coupon' : 'Create coupon';
  $('#cpf-code').readOnly = Boolean(code);

  if (code) {
    const c = coupons.find(x => String(x.code).toUpperCase() === code.toUpperCase());
    if (c) {
      $('#cpf-code').value = c.code;
      $('#cpf-type').value = c.type;
      $('#cpf-value').value = c.value;
      $('#cpf-min').value = c.minOrder || 0;
      $('#cpf-max').value = c.maxDiscount || 0;
      $('#cpf-limit').value = c.usageLimit || 1000;
      $('#cpf-expiry').value = c.expiry ? String(c.expiry).slice(0, 10) : '';
      $('#cpf-desc').value = c.description || '';
      $('#cpf-active').checked = c.active === true || c.active === 'TRUE';
    }
  } else {
    // Default expiry: aaj se 90 din baad
    const d = new Date(); d.setDate(d.getDate() + 90);
    $('#cpf-expiry').value = d.toISOString().slice(0, 10);
  }
  $('#cpf-type').dispatchEvent(new Event('change'));

  openModal('#cp-modal');
  setTimeout(() => $('#cpf-code').focus(), 150);
}

async function onSave(e) {
  e.preventDefault();
  const code = $('#cpf-code').value.trim().toUpperCase();
  const field = $('#cpf-code').closest('.field');
  field.classList.toggle('error', code.length < 3);
  if (code.length < 3) return toast.error('Coupon code must be at least 3 characters.');

  const coupon = {
    code,
    type: $('#cpf-type').value,
    value: Number($('#cpf-value').value) || 0,
    minOrder: Number($('#cpf-min').value) || 0,
    maxDiscount: Number($('#cpf-max').value) || 0,
    usageLimit: Number($('#cpf-limit').value) || 1000,
    expiry: $('#cpf-expiry').value,
    description: $('#cpf-desc').value.trim() || autoDescription(),
    active: $('#cpf-active').checked
  };

  const btn = e.target.querySelector('button[type=submit]');
  btn.classList.add('is-loading');
  const res = await api(editing ? 'adminUpdateCoupon' : 'adminAddCoupon', { coupon });
  btn.classList.remove('is-loading');

  if (!res.success) return toast.error(res.message);
  closeModal('#cp-modal');
  toast.success(res.message);
  await load();
}

/** Description khaali ho to khud bana deta hai. */
function autoDescription() {
  const type = $('#cpf-type').value;
  const val = Number($('#cpf-value').value) || 0;
  const min = Number($('#cpf-min').value) || 0;
  if (type === 'shipping') return 'Free delivery on any order';
  const off = type === 'percent' ? `${val}% off` : `Flat ${money(val)} off`;
  return min ? `${off} on orders above ${money(min)}` : off;
}
