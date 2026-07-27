/* ==========================================================================
   PShop — Payment failed page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, esc, money, qs } from '../core/utils.js';
import { Store } from '../core/storage.js';
import { Cart } from '../core/state.js';
import { icon } from '../components/icons.js';
import { lazyImages } from '../components/lazy-load.js';

page(async () => {
  await initApp({ page: 'payment-failed', nav: '', newsletter: false });

  $('#bad-icon').innerHTML = icon('close', 44);

  const ref = qs('ref');
  const attempt = Store.get('pshop_last_attempt', null);
  if (ref || attempt) {
    $('#attempt-ref').innerHTML = `${icon('alert', 15)} Reference: ${esc(ref || attempt.reference)}`;
  } else {
    $('#attempt-ref').hidden = true;
  }

  if (attempt?.amount) {
    $('#fail-reason').innerHTML = `We could not process your payment of
      <b>${money(attempt.amount)}</b>. You have not been charged — any amount debited will be
      refunded automatically within 3–5 business days.`;
  }

  $('#fail-reasons').innerHTML = [
    ['creditCard', 'Insufficient balance or a credit limit that was exceeded.'],
    ['lock', 'The bank declined the transaction or the OTP was not entered in time.'],
    ['alert', 'Incorrect card number, expiry date or CVV.'],
    ['refresh', 'A temporary network issue between the bank and the gateway.'],
    ['shield', 'Online transactions may be disabled on your card — check with your bank.']
  ].map(([ic, t]) => `<div class="pd-offer">${icon(ic, 16)}<span>${t}</span></div>`).join('');

  /* the cart is intentionally preserved so a retry is one click away */
  const draft = Store.get(CONFIG.KEYS.CHECKOUT, null);
  const items = draft?.items?.length ? draft.items : Cart.all();

  $('#fail-items').innerHTML = items.length
    ? items.map(i => `
        <div class="order-line">
          <img class="lazy" data-src="${url(i.image)}" src="${url('assets/img/misc/placeholder.svg')}"
               alt="${esc(i.name)}" width="60" height="60" loading="lazy">
          <div style="flex:1;min-width:0">
            <div class="semi small clamp-2">${esc(i.name)}</div>
            <div class="xs muted">Qty ${i.qty}</div>
          </div>
          <div class="semi">${money(i.price * i.qty)}</div>
        </div>`).join('')
    : '<p class="muted small">Your cart is empty.</p>';
  lazyImages($('#fail-items'));

  $('#btn-retry').addEventListener('click', () => {
    location.href = url(draft ? 'pages/payment.html' : 'pages/cart.html');
  });
});
