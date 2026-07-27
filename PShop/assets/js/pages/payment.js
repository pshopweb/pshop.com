/* ==========================================================================
   PShop — Payment page: COD, UPI and Razorpay-style card flow
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, $$, esc, money, V, uid, sleep } from '../core/utils.js';
import { Store } from '../core/storage.js';
import { Auth } from '../core/auth.js';
import { Cart } from '../core/state.js';
import { API } from '../core/api.js';
import { setError } from './_auth-ui.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { emptyState } from '../components/lazy-load.js';

const UPI_APPS = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM'];
let method = 'cod', upiApp = UPI_APPS[0], draft = null;

page(async () => {
  await initApp({ page: 'payment', nav: '', newsletter: false });

  draft = Store.get(CONFIG.KEYS.CHECKOUT, null);
  if (!draft || !draft.items?.length) {
    $('#pay-empty').hidden = false;
    emptyState($('#pay-empty'), {
      title: 'No checkout in progress',
      text: 'Please review your cart and confirm a delivery address first.',
      actionLabel: 'Go to cart', actionHref: url('pages/cart.html')
    });
    return;
  }

  $('#pay-shell').hidden = false;
  $('#secure-badge').innerHTML = `${icon('lock', 12)} Secure`;
  $('#cod-fee').textContent = money(CONFIG.COD_FEE);

  renderMethods();
  renderAddress();
  renderSummary();

  $('#btn-pay').addEventListener('click', onPay);
});

/* ------------------------------- methods ---------------------------------- */
function renderMethods() {
  const codOk = Cart.codEligible();
  const methods = CONFIG.PAYMENT_METHODS.filter(m => m.id !== 'cod' || codOk);
  if (!codOk && method === 'cod') method = 'upi';

  $('#pay-methods').innerHTML = methods.map(m => `
    <label class="pay-option ${method === m.id ? 'selected' : ''}">
      <input type="radio" name="pay" value="${m.id}" ${method === m.id ? 'checked' : ''}>
      <img src="${url(m.icon)}" alt="" width="120" height="48">
      <span class="txt"><b>${esc(m.label)}</b><span>${esc(m.desc)}</span></span>
      ${m.id === 'cod' ? `<span class="badge badge-warning">+${money(CONFIG.COD_FEE)}</span>` : ''}
    </label>`).join('') +
    (!codOk ? `<div class="pay-detail" style="margin-top:.7rem">
      <p class="xs" style="color:var(--warning)">${icon('info', 12)}
        <strong>Cash on Delivery available nahi hai</strong> in items par:</p>
      <ul class="xs muted" style="margin:.4rem 0 0 1.1rem">
        ${Cart.codBlockedItems().map(n => `<li>${esc(n)}</li>`).join('')}
      </ul>
      <p class="xs muted mt-2">In items ko cart se hatakar COD use kar sakte hain,
        ya UPI / Card se payment karein.</p>
    </div>` : '');

  $('#upi-apps').innerHTML = UPI_APPS.map(a =>
    `<button type="button" class="upi-app ${a === upiApp ? 'active' : ''}" data-upi="${esc(a)}">${esc(a)}</button>`).join('');

  $$('input[name="pay"]').forEach(r => r.addEventListener('change', () => {
    method = r.value;
    renderMethods();
    renderSummary();
  }));

  $$('[data-upi]').forEach(b => b.onclick = () => {
    upiApp = b.dataset.upi;
    $$('[data-upi]').forEach(x => x.classList.toggle('active', x === b));
  });

  ['upi', 'razorpay', 'cod'].forEach(id => {
    const node = $('#detail-' + id);
    if (node) node.hidden = method !== id;
  });

  // Card input formatting.
  const num = $('#card-num');
  if (num && !num.dataset.wired) {
    num.dataset.wired = '1';
    num.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    });
    $('#card-exp').addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
      e.target.value = v;
    });
    $('#card-cvv').addEventListener('input', e =>
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4));
  }

  const btn = $('#btn-pay');
  const total = totalWithFee();
  btn.textContent = method === 'cod' ? `Place order · ${money(total)}` : `Pay ${money(total)} securely`;
  $('#pay-note').innerHTML = method === 'cod'
    ? `${icon('truck', 12)} Pay in cash when your order arrives.`
    : `${icon('lock', 12)} Your payment is encrypted and processed securely.`;
}

function totalWithFee() {
  return draft.totals.total + (method === 'cod' ? CONFIG.COD_FEE : 0);
}

/* ------------------------------- address ---------------------------------- */
function renderAddress() {
  const a = draft.address;
  $('#pay-address').innerHTML = `
    <div class="addr-card selected">
      <span class="tag badge badge-brand">${esc(a.type || 'Home')}</span>
      <h4>${esc(a.name)}</h4>
      <address>${esc(a.line1)}${a.landmark ? `<br>Near ${esc(a.landmark)}` : ''}<br>
        ${esc(a.city)}, ${esc(a.state)} — ${esc(a.pin)}</address>
      <div class="phone">${icon('phone', 13)} ${esc(a.phone)}</div>
    </div>`;
}

/* ------------------------------- summary ---------------------------------- */
function renderSummary() {
  const t = draft.totals;
  const fee = method === 'cod' ? CONFIG.COD_FEE : 0;
  $('#summary-body').innerHTML = `
    <div class="sum-row"><span class="lbl">Item total</span><span>${money(t.mrpTotal)}</span></div>
    ${t.savings ? `<div class="sum-row"><span class="lbl">Discount</span>
      <span class="save">− ${money(t.savings)}</span></div>` : ''}
    ${t.discount ? `<div class="sum-row"><span class="lbl">Coupon</span>
      <span class="save">− ${money(t.discount)}</span></div>` : ''}
    <div class="sum-row"><span class="lbl">Delivery</span>
      ${t.shipping ? `<span>${money(t.shipping)}</span>` : '<span class="free">FREE</span>'}</div>
    ${fee ? `<div class="sum-row"><span class="lbl">COD fee</span><span>${money(fee)}</span></div>` : ''}
    <div class="sum-row total"><span>Amount payable</span><span>${money(t.total + fee)}</span></div>`;
}

/* --------------------------------- pay ------------------------------------ */
async function onPay() {
  if (!validateMethod()) return;

  const btn = $('#btn-pay');
  btn.classList.add('is-loading');
  btn.disabled = true;

  $('#pay-shell').hidden = true;
  $('#processing').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Simulate gateway round-trip. COD always succeeds; online payments use a
  // deterministic check so the demo can exercise the failure path too.
  await sleep(1800);

  const reference = uid('TXN');
  const failed = method !== 'cod' && shouldFail();

  if (failed) {
    Store.set('pshop_last_attempt', { reference, method, amount: totalWithFee(), at: new Date().toISOString() });
    location.href = url('pages/payment-failed.html?ref=' + reference);
    return;
  }

  const payment = {
    method,
    label: CONFIG.PAYMENT_METHODS.find(m => m.id === method)?.label || method,
    reference,
    app: method === 'upi' ? upiApp : null,
    last4: method === 'razorpay' ? $('#card-num').value.replace(/\D/g, '').slice(-4) : null
  };

  const totals = { ...draft.totals, total: totalWithFee(),
                   codFee: method === 'cod' ? CONFIG.COD_FEE : 0 };

  const res = await API.placeOrder({
    userId: Auth.id(), items: draft.items, address: draft.address,
    payment, totals, coupon: draft.coupon, contact: draft.contact, shipMode: draft.shipMode
  });

  if (!res.success) {
    $('#processing').hidden = true;
    $('#pay-shell').hidden = false;
    btn.classList.remove('is-loading');
    btn.disabled = false;
    return toast.error(res.message);
  }

  await API.savePayment({
    orderId: res.data.order.id, method, amount: totals.total,
    reference, status: method === 'cod' ? 'Pending' : 'Paid'
  });

  // Order placed — clear the working state.
  Cart.clear();
  Store.remove(CONFIG.KEYS.COUPON);
  Store.remove(CONFIG.KEYS.CHECKOUT);

  location.href = url('pages/payment-success.html?id=' + res.data.order.id);
}

function validateMethod() {
  if (method === 'upi') {
    const id = $('#upi-id').value.trim();
    // An app selection is enough; a typed UPI ID must still be well-formed.
    if (id && !V.upi(id)) {
      setError('upi-id', true, 'Enter a valid UPI ID (e.g. name@okbank).');
      toast.error('Please check your UPI ID.');
      return false;
    }
    setError('upi-id', false);
    return true;
  }

  if (method === 'razorpay') {
    const checks = [
      ['card-num', V.card($('#card-num').value), 'Enter a valid card number.'],
      ['card-name', V.name($('#card-name').value), 'Enter the cardholder name.'],
      ['card-exp', V.expiry($('#card-exp').value), 'Enter a valid future expiry date.'],
      ['card-cvv', V.cvv($('#card-cvv').value), 'Enter the 3 or 4 digit CVV.']
    ];
    let ok = true;
    checks.forEach(([id, pass, msg]) => {
      setError(id, !pass, msg);
      if (!pass && ok) { $('#' + id).focus(); ok = false; }
      else if (!pass) ok = false;
    });
    if (!ok) toast.error('Please check your card details.');
    return ok;
  }

  return true;   // COD needs no extra input
}

/**
 * Deterministic failure simulation: cards ending in 0002 always fail,
 * mirroring how real gateways expose test cards. Everything else succeeds.
 */
function shouldFail() {
  if (method !== 'razorpay') return false;
  return $('#card-num').value.replace(/\D/g, '').endsWith('0002');
}
