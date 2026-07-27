/* ==========================================================================
   PShop — Address book: add / edit / delete / set default
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, $$, esc, V, uid } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { Addresses } from '../core/state.js';
import { renderAccountNav } from './_account-nav.js';
import { validate, setError } from './_auth-ui.js';
import { icon } from '../components/icons.js';
import { toast, confirmDialog } from '../components/toast.js';
import { emptyState } from '../components/lazy-load.js';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat',
'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
'Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
'Dadra and Nagar Haveli and Daman and Diu','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];

let editingId = null;

page(async () => {
  await initApp({ page: 'address', nav: '', newsletter: false });
  if (!Auth.require()) return;

  renderAccountNav('address.html');
  $('#a-state').innerHTML = '<option value="">Select state</option>' +
    STATES.map(s => `<option>${s}</option>`).join('');

  // Chip-style radio group for address type.
  $$('input[name="atype"]').forEach(r => r.addEventListener('change', () => {
    $$('input[name="atype"]').forEach(x => x.closest('.chip').classList.toggle('active', x.checked));
  }));
  $('input[name="atype"]:checked')?.closest('.chip').classList.add('active');

  render();
  wireModal();
});

function render() {
  const list = Addresses.all();
  const grid = $('#addr-grid'), empty = $('#addr-empty');

  $('#addr-count').textContent = list.length
    ? `${list.length} saved address${list.length > 1 ? 'es' : ''}`
    : 'No addresses saved yet';

  if (!list.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    emptyState(empty, {
      title: 'No saved addresses',
      text: 'Add a delivery address so we know where to send your orders.',
      actionLabel: 'Add your first address', onAction: () => openModal()
    });
    return;
  }

  empty.hidden = true;
  grid.innerHTML = list.map(a => `
    <article class="addr-card ${a.isDefault ? 'selected' : ''}">
      <span class="tag badge ${a.isDefault ? 'badge-brand' : 'badge-muted'}">
        ${a.isDefault ? 'Default' : esc(a.type || 'Home')}</span>
      <h4>${icon(a.type === 'Work' ? 'box' : 'home', 16)} ${esc(a.name)}</h4>
      <address>${esc(a.line1)}${a.landmark ? `<br>Near ${esc(a.landmark)}` : ''}<br>
        ${esc(a.city)}, ${esc(a.state)} — ${esc(a.pin)}</address>
      <div class="phone">${icon('phone', 13)} ${esc(a.phone)}</div>
      <div class="acts">
        <button data-edit="${a.id}">${icon('edit', 13)} Edit</button>
        ${!a.isDefault ? `<button data-default="${a.id}">${icon('check', 13)} Set as default</button>` : ''}
        <button class="danger" data-del="${a.id}">${icon('trash', 13)} Delete</button>
      </div>
    </article>`).join('') +
    `<button class="addr-add" id="add-tile">${icon('plus', 26)}<span>Add a new address</span></button>`;

  $$('[data-edit]').forEach(b => b.onclick = () => openModal(b.dataset.edit));
  $$('[data-default]').forEach(b => b.onclick = () => {
    Addresses.setDefault(b.dataset.default);
    toast.success('Default address updated.');
    render();
  });
  $$('[data-del]').forEach(b => b.onclick = async () => {
    const ok = await confirmDialog({
      title: 'Delete this address?', message: 'This cannot be undone.',
      confirmText: 'Delete', danger: true
    });
    if (!ok) return;
    Addresses.remove(b.dataset.del);
    toast.info('Address deleted.');
    render();
  });
  $('#add-tile').onclick = () => openModal();
}

/* -------------------------------- modal ----------------------------------- */
function wireModal() {
  $('#btn-new-addr').onclick = () => openModal();
  ['#addr-close', '#addr-cancel'].forEach(s => $(s).onclick = closeModal);
  $('#addr-modal .overlay').onclick = closeModal;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#addr-modal').classList.contains('open')) closeModal();
  });

  $('#a-phone').addEventListener('input', e =>
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10));
  $('#a-pin').addEventListener('input', e =>
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6));

  $('#addr-form').addEventListener('submit', e => {
    e.preventDefault();
    const ok = validate([
      { id: 'a-name', test: V.name, message: 'Please enter the recipient name.' },
      { id: 'a-phone', test: V.phone, message: 'Enter a valid 10-digit mobile number.' },
      { id: 'a-pin', test: V.pin, message: 'Enter a valid 6-digit pincode.' },
      { id: 'a-city', test: V.required, message: 'Please enter your city.' },
      { id: 'a-state', test: V.required, message: 'Please select your state.' },
      { id: 'a-line1', test: v => String(v).trim().length >= 8, message: 'Please enter your full street address.' }
    ]);
    if (!ok) return;

    const data = {
      name: $('#a-name').value.trim(), phone: $('#a-phone').value.trim(),
      pin: $('#a-pin').value.trim(), city: $('#a-city').value.trim(),
      state: $('#a-state').value, line1: $('#a-line1').value.trim(),
      landmark: $('#a-landmark').value.trim(),
      type: $('input[name="atype"]:checked')?.value || 'Home',
      isDefault: $('#a-default').checked
    };

    if (editingId) { Addresses.update(editingId, data); toast.success('Address updated.'); }
    else { Addresses.add(data); toast.success('Address saved.'); }

    closeModal();
    render();
  });

  ['a-name', 'a-phone', 'a-pin', 'a-city', 'a-state', 'a-line1'].forEach(id =>
    $('#' + id).addEventListener('input', () => setError(id, false)));
}

function openModal(id = null) {
  editingId = id;
  const form = $('#addr-form');
  form.reset();
  form.querySelectorAll('.field').forEach(f => f.classList.remove('error'));

  $('#addr-modal-title').textContent = id ? 'Edit address' : 'Add a new address';
  $('#addr-save').textContent = id ? 'Update address' : 'Save address';

  if (id) {
    const a = Addresses.get(id);
    if (a) {
      $('#a-name').value = a.name; $('#a-phone').value = a.phone;
      $('#a-pin').value = a.pin; $('#a-city').value = a.city;
      $('#a-state').value = a.state; $('#a-line1').value = a.line1;
      $('#a-landmark').value = a.landmark || '';
      $('#a-default').checked = !!a.isDefault;
      const radio = $(`input[name="atype"][value="${a.type || 'Home'}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
    }
  } else {
    $$('input[name="atype"]').forEach((x, i) => {
      x.checked = i === 0;
      x.closest('.chip').classList.toggle('active', i === 0);
    });
  }

  $('#addr-modal').classList.add('open');
  document.body.classList.add('no-scroll');
  setTimeout(() => $('#a-name').focus(), 150);
}

function closeModal() {
  $('#addr-modal').classList.remove('open');
  document.body.classList.remove('no-scroll');
  editingId = null;
}
