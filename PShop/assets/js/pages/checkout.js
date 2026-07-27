/* ==========================================================================
   PShop — Checkout: contact, address, delivery speed, review, totals
   Persists a checkout draft so the payment page can pick it up.
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, $$, esc, money, V, fmtDate, addDays } from '../core/utils.js';
import { Store } from '../core/storage.js';
import { Auth } from '../core/auth.js';
import { Cart, Addresses } from '../core/state.js';
import { API } from '../core/api.js';
import { validate, setError } from './_auth-ui.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { emptyState, lazyImages } from '../components/lazy-load.js';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat',
'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
'Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
'Dadra and Nagar Haveli and Daman and Diu','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];

let selectedAddr = null, shipMode = 'standard', coupon = null;

page(async () => {
  await initApp({ page: 'checkout', nav: '', newsletter: false });

  if (!Cart.all().length) {
    $('#co-empty').hidden = false;
    emptyState($('#co-empty'), {
      title: 'Your cart is empty',
      text: 'Add a few products before heading to checkout.',
      actionLabel: 'Browse products', actionHref: url('pages/shop.html')
    });
    return;
  }

  $('#co-shell').hidden = false;
  coupon = Store.get(CONFIG.KEYS.COUPON, null);

  prefillContact();
  renderShipOptions();
  renderAddresses();
  renderReview();
  renderSummary();
  wireAddressModal();

  $('#btn-continue').addEventListener('click', onContinue);
});

/* ------------------------------- contact ---------------------------------- */
function prefillContact() {
  const u = Auth.user();
  const draft = Store.get(CONFIG.KEYS.CHECKOUT, {});
  $('#c-name').value = draft.contact?.name || u?.name || '';
  $('#c-email').value = draft.contact?.email || u?.email || '';
  $('#c-phone').value = draft.contact?.phone || u?.phone || '';
  $('#c-phone').addEventListener('input', e =>
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10));
  ['c-name', 'c-email', 'c-phone'].forEach(id =>
    $('#' + id).addEventListener('input', () => setError(id, false)));
}

/* ------------------------------ addresses --------------------------------- */
function renderAddresses() {
  const list = Addresses.all();
  const host = $('#addr-list'), none = $('#addr-none');

  if (!list.length) {
    host.innerHTML = '';
    none.hidden = false;
    none.innerHTML = `<p class="muted small">No saved addresses yet.
      Add one to continue with your order.</p>`;
    selectedAddr = null;
    return;
  }

  none.hidden = true;
  selectedAddr = selectedAddr && list.some(a => a.id === selectedAddr)
    ? selectedAddr : (Addresses.default()?.id || list[0].id);

  host.innerHTML = list.map(a => `
    <label class="addr-card ${a.id === selectedAddr ? 'selected' : ''}" style="cursor:pointer">
      <input type="radio" name="addr" value="${a.id}" class="sr-only"
             ${a.id === selectedAddr ? 'checked' : ''}>
      <span class="tag badge ${a.isDefault ? 'badge-brand' : 'badge-muted'}">
        ${a.isDefault ? 'Default' : esc(a.type || 'Home')}</span>
      <h4>${icon(a.type === 'Work' ? 'box' : 'home', 15)} ${esc(a.name)}</h4>
      <address>${esc(a.line1)}${a.landmark ? `<br>Near ${esc(a.landmark)}` : ''}<br>
        ${esc(a.city)}, ${esc(a.state)} — ${esc(a.pin)}</address>
      <div class="phone">${icon('phone', 13)} ${esc(a.phone)}</div>
    </label>`).join('');

  $$('input[name="addr"]').forEach(r => r.addEventListener('change', () => {
    selectedAddr = r.value;
    renderAddresses();
    renderSummary();
  }));
}

/* ---------------------------- delivery speed ------------------------------ */
function renderShipOptions() {
  const t = Cart.totals(coupon);
  const opts = [
    { id: 'standard', label: 'Standard delivery', days: 4,
      fee: t.subtotal >= CONFIG.FREE_SHIP_ABOVE ? 0 : CONFIG.SHIPPING_FEE,
      desc: `Free on orders above ${money(CONFIG.FREE_SHIP_ABOVE)}` },
    { id: 'express', label: 'Express delivery', days: 2, fee: CONFIG.EXPRESS_FEE,
      desc: 'Priority dispatch and faster transit' }
  ];

  $('#ship-options').innerHTML = opts.map(o => `
    <label class="pay-option ${shipMode === o.id ? 'selected' : ''}">
      <input type="radio" name="ship" value="${o.id}" ${shipMode === o.id ? 'checked' : ''}>
      <span class="ico" style="color:var(--brand-600)">${icon(o.id === 'express' ? 'zap' : 'truck', 22)}</span>
      <span class="txt"><b>${o.label} — ${o.fee ? money(o.fee) : 'FREE'}</b>
        <span>${o.desc} · Arrives by ${fmtDate(addDays(new Date(), o.days), { weekday: 'short' })}</span></span>
    </label>`).join('');

  $$('input[name="ship"]').forEach(r => r.addEventListener('change', () => {
    shipMode = r.value;
    renderShipOptions();
    renderSummary();
  }));
}

/* ------------------------------- review ----------------------------------- */
function renderReview() {
  const items = Cart.all();
  $('#review-items').innerHTML = items.map(i => `
    <div class="order-line">
      <img class="lazy" data-src="${url(i.image)}" src="${url('assets/img/misc/placeholder.svg')}"
           alt="${esc(i.name)}" width="60" height="60" loading="lazy">
      <div style="flex:1;min-width:0">
        <div class="semi small clamp-2">${esc(i.name)}</div>
        <div class="xs muted">${i.variant ? esc(i.variant) + ' · ' : ''}Qty ${i.qty}</div>
      </div>
      <div class="semi">${money(i.price * i.qty)}</div>
    </div>`).join('');
  lazyImages($('#review-items'));
}

/* ------------------------------- summary ---------------------------------- */
function renderSummary() {
  const t = Cart.totals(coupon, shipMode);
  $('#summary-body').innerHTML = `
    <div class="sum-row"><span class="lbl">Price (${t.count} item${t.count > 1 ? 's' : ''})</span>
      <span>${money(t.mrpTotal)}</span></div>
    ${t.savings ? `<div class="sum-row"><span class="lbl">Product discount</span>
      <span class="save">− ${money(t.savings)}</span></div>` : ''}
    ${t.discount ? `<div class="sum-row"><span class="lbl">Coupon (${esc(t.couponCode)})</span>
      <span class="save">− ${money(t.discount)}</span></div>` : ''}
    <div class="sum-row"><span class="lbl">Delivery (${shipMode})</span>
      ${t.shipping ? `<span>${money(t.shipping)}</span>` : '<span class="free">FREE</span>'}</div>
    <div class="sum-row"><span class="lbl xs">Includes GST</span>
      <span class="xs muted">${money(t.tax)}</span></div>
    <div class="sum-row total"><span>Total</span><span>${money(t.total)}</span></div>`;

  const saved = t.savings + t.discount;
  $('#savings-banner').innerHTML = saved
    ? `<div class="savings-banner">${icon('tag', 14)} You save ${money(saved)} on this order</div>` : '';

  $('#coupon-area').innerHTML = coupon
    ? `<div class="coupon-applied"><span>${icon('tag', 14)} <b>${esc(coupon.code)}</b> applied</span>
        <button id="drop-coupon" aria-label="Remove coupon">${icon('close', 15)}</button></div>`
    : `<a class="small semi" href="cart.html" style="color:var(--brand-600)">
        ${icon('tag', 13)} Have a coupon? Apply it in your cart</a>`;

  $('#drop-coupon')?.addEventListener('click', () => {
    coupon = null;
    Store.remove(CONFIG.KEYS.COUPON);
    toast.info('Coupon removed.');
    renderSummary();
  });
}

/* ------------------------------- continue --------------------------------- */
function onContinue() {
  const ok = validate([
    { id: 'c-name', test: V.name, message: 'Please enter your name.' },
    { id: 'c-email', test: V.email, message: 'Please enter a valid email.' },
    { id: 'c-phone', test: V.phone, message: 'Enter a valid 10-digit mobile number.' }
  ]);
  if (!ok) { toast.error('Please complete your contact details.'); return; }

  if (!selectedAddr) {
    toast.error('Please add and select a delivery address.');
    $('#btn-add-addr').focus();
    return;
  }

  const address = Addresses.get(selectedAddr);
  const totals = Cart.totals(coupon, shipMode);

  Store.set(CONFIG.KEYS.CHECKOUT, {
    contact: {
      name: $('#c-name').value.trim(),
      email: $('#c-email').value.trim(),
      phone: $('#c-phone').value.trim()
    },
    address, shipMode, coupon, totals,
    items: Cart.all(),
    createdAt: new Date().toISOString()
  });

  location.href = url('pages/payment.html');
}

/* ---------------------------- address modal ------------------------------- */
function wireAddressModal() {
  const modal = $('#addr-modal');
  $('#a-state').innerHTML = '<option value="">Select state</option>' +
    STATES.map(s => `<option>${s}</option>`).join('');

  const open = () => { modal.classList.add('open'); document.body.classList.add('no-scroll');
    setTimeout(() => $('#a-name').focus(), 150); };
  const close = () => { modal.classList.remove('open'); document.body.classList.remove('no-scroll'); };

  $('#btn-add-addr').onclick = () => {
    const u = Auth.user();
    $('#a-name').value = $('#c-name').value || u?.name || '';
    $('#a-phone').value = $('#c-phone').value || u?.phone || '';
    open();
  };
  $('#addr-close').onclick = close;
  $('#addr-cancel').onclick = close;
  modal.querySelector('.overlay').onclick = close;

  $$('input[name="atype"]').forEach(r => r.addEventListener('change', () => {
    $$('input[name="atype"]').forEach(x => x.closest('.chip').classList.toggle('active', x.checked));
  }));

  $('#a-phone').addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10));
  $('#a-pin').addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6));

  $('#addr-form').addEventListener('submit', e => {
    e.preventDefault();
    const valid = validate([
      { id: 'a-name', test: V.name, message: 'Enter the recipient name.' },
      { id: 'a-phone', test: V.phone, message: 'Enter a valid 10-digit mobile number.' },
      { id: 'a-pin', test: V.pin, message: 'Enter a valid 6-digit pincode.' },
      { id: 'a-city', test: V.required, message: 'Please enter your city.' },
      { id: 'a-state', test: V.required, message: 'Please select your state.' },
      { id: 'a-line1', test: v => String(v).trim().length >= 8, message: 'Please enter your full street address.' }
    ]);
    if (!valid) return;

    const list = Addresses.add({
      name: $('#a-name').value.trim(), phone: $('#a-phone').value.trim(),
      pin: $('#a-pin').value.trim(), city: $('#a-city').value.trim(),
      state: $('#a-state').value, line1: $('#a-line1').value.trim(),
      landmark: $('#a-landmark').value.trim(),
      type: $('input[name="atype"]:checked')?.value || 'Home',
      isDefault: $('#a-default').checked
    });

    selectedAddr = list[list.length - 1].id;
    close();
    e.target.reset();
    renderAddresses();
    toast.success('Address added and selected.');
  });
}
