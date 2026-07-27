/* ==========================================================================
   PShop — Track order (public — no login needed)
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, esc, money, qs, fmtDate, fmtDateTime, fmtSmart, fmtDelivery, setQuery } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { API } from '../core/api.js';
import { statusBadge } from './_order-ui.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { emptyState, lazyImages } from '../components/lazy-load.js';

page(async () => {
  await initApp({ page: 'track-order', nav: 'orders' });

  $('#help-ico').innerHTML = icon('headphones', 22);

  // Logged-in user ko uska latest order ID hint me dikha do
  if (Auth.isLoggedIn()) {
    const res = await API.getOrders({ userId: Auth.id() });
    if (res.success && res.data.items.length) {
      const latest = res.data.items[0];
      $('#track-hint').innerHTML = `Your most recent order:
        <button id="use-latest" style="color:var(--brand-600);font-weight:700">${esc(latest.id)}</button>`;
      $('#use-latest').onclick = () => { $('#track-id').value = latest.id; $('#track-form').requestSubmit(); };
    }
  }

  $('#track-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#track-id').value.trim();
    if (!id) {
      $('#track-id').closest('.field').classList.add('error');
      return toast.warn('Please enter your order ID.');
    }
    $('#track-id').closest('.field').classList.remove('error');
    await track(id);
  });

  // URL me ?id= ho to seedha track kar do
  const preset = qs('id');
  if (preset) { $('#track-id').value = preset; await track(preset); }
});

async function track(id) {
  const btn = $('#track-btn');
  btn.classList.add('is-loading');

  try {
    const res = await API.trackOrder({ id });
    btn.classList.remove('is-loading');
    setQuery({ id });

    if (!res.success) {
      $('#track-result').hidden = true;
      emptyState($('#track-empty'), {
        title: 'Order not found',
        text: `We could not find an order with ID "${id}". Please check the ID and try again.`,
        actionLabel: Auth.isLoggedIn() ? 'View my orders' : 'Contact support',
        actionHref: url(Auth.isLoggedIn() ? 'pages/orders.html' : 'pages/contact.html')
      });
      return;
    }

    $('#track-empty').innerHTML = '';
    $('#track-result').hidden = false;
    render(res.data.order);
    $('#track-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    btn.classList.remove('is-loading');
    toast.error('Tracking failed. Please try again.');
    console.error('[PShop] track error:', err);
  }
}

function render(o) {
  const isDelivered = o.status === 'Delivered';
  const isCancelled = o.status === 'Cancelled';

  $('#courier-badge').innerHTML = `${icon(isCancelled ? 'xCircle' : 'truck', 20)}
    <span>${esc(o.courier || 'PShop Express')} · ${esc(o.awb || '—')}</span>`;

  $('#track-status').innerHTML = `<span class="badge ${statusBadge(o.status)}">${esc(o.status)}</span>`;

  let currentIdx = -1;
  (o.timeline || []).forEach((s, i) => { if (s.done) currentIdx = i; });

  $('#track-timeline').innerHTML = (o.timeline || []).map((s, i) => `
    <div class="tl-step ${s.done ? 'done' : ''} ${i === currentIdx ? 'current' : ''}">
      <h4>${esc(s.stage)}</h4>
      <p>${esc(s.note || '')}</p>
      ${s.at ? `<time datetime="${s.at}">${fmtSmart(s.at)}</time>` : ''}
    </div>`).join('');

  $('#track-items').innerHTML = (o.items || []).map(i => `
    <div class="order-line">
      <img class="lazy" data-src="${url(i.image)}" src="${url('assets/img/misc/placeholder.svg')}"
           alt="${esc(i.name)}" width="60" height="60" loading="lazy">
      <div style="flex:1;min-width:0">
        <div class="semi small clamp-2">${esc(i.name)}</div>
        <div class="xs muted">Qty ${i.qty}</div>
      </div>
      <div class="semi">${money(i.price * i.qty)}</div>
    </div>`).join('');
  lazyImages($('#track-items'));

  const a = o.address || {};
  $('#track-meta').innerHTML = `
    <div class="sum-row"><span class="lbl">Order ID</span><span class="semi">${esc(o.id)}</span></div>
    <div class="sum-row"><span class="lbl">Placed on</span><span>${fmtDate(o.placedAt)}</span></div>
    <div class="sum-row"><span class="lbl">${isDelivered ? 'Delivered on' : 'Expected by'}</span>
      <span class="semi">${fmtDelivery(o.expectedAt)}</span></div>
    <div class="sum-row"><span class="lbl">Tracking ID</span><span class="xs">${esc(o.awb || '—')}</span></div>
    <div class="divider"></div>
    <div class="small semi mb-1">Shipping to</div>
    <address style="font-style:normal;color:var(--text-2);font-size:var(--fs-sm);line-height:1.6">
      ${esc(a.name || '')}<br>${esc(a.city || '')}, ${esc(a.state || '')} — ${esc(a.pin || '')}</address>
    <a class="btn btn-sm btn-ghost btn-block mt-3" href="order-details.html?id=${esc(o.id)}">
      View full order details</a>`;
}
