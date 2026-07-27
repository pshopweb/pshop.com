/* ==========================================================================
   PShop — Profile overview page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, esc, money, fmtDate } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { Cart, Wishlist, Addresses } from '../core/state.js';
import { API } from '../core/api.js';
import { renderAccountNav } from './_account-nav.js';
import { statusBadge } from './_order-ui.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/lazy-load.js';

page(async () => {
  await initApp({ page: 'profile', nav: '', newsletter: false });
  if (!Auth.require()) return;

  renderAccountNav('profile.html');

  const user = Auth.user();

  $('#profile-hero').innerHTML = `
    <img src="${user.avatar || url('assets/img/misc/avatar.svg')}" alt="Your profile photo" width="84" height="84">
    <div>
      <h1>${esc(user.name)}</h1>
      <p>${esc(user.email)}</p>
      <div class="meta">
        <span>${icon('phone', 13)} ${esc(user.phone || 'No number added')}</span>
        <span>${icon('calendar', 13)} Member since ${fmtDate(user.createdAt, { day: undefined })}</span>
        ${user.verified ? `<span>${icon('checkCircle', 13)} Verified</span>` : ''}
      </div>
    </div>
    <div class="actions"><a class="btn btn-sm" style="background:#fff;color:var(--brand-700)"
      href="edit-profile.html">Edit profile</a></div>`;

  /* quick stats */
  const orderRes = await API.getOrders({ userId: Auth.id() });
  const orders = orderRes.success ? orderRes.data.items : [];
  const delivered = orders.filter(o => o.status === 'Delivered').length;
  const spent = orders.filter(o => o.status !== 'Cancelled')
    .reduce((a, o) => a + (o.totals?.total || 0), 0);

  $('#quick-stats').innerHTML = [
    ['package', orders.length, 'Total orders', 'orders.html'],
    ['checkCircle', delivered, 'Delivered', 'orders.html?status=Delivered'],
    ['heart', Wishlist.count(), 'Wishlist items', 'wishlist.html'],
    ['wallet', money(spent), 'Total spent', 'orders.html']
  ].map(([ic, val, lbl, href]) => `
    <a class="stat-card" href="${href}">
      <span class="ico">${icon(ic, 24)}</span>
      <div><div class="val">${val}</div><div class="lbl">${lbl}</div></div>
    </a>`).join('');

  /* personal info */
  $('#info-grid').innerHTML = [
    ['Full name', user.name], ['Email address', user.email],
    ['Mobile number', user.phone || '—'], ['Gender', user.gender || 'Not specified'],
    ['Date of birth', user.dob ? fmtDate(user.dob) : 'Not specified'],
    ['Account type', user.role === 'admin' ? 'Administrator' : 'Customer']
  ].map(([k, v]) => `<div class="info-row"><div class="k">${k}</div>
      <div class="v">${esc(String(v))}</div></div>`).join('');

  /* default address */
  const addr = Addresses.default();
  $('#default-addr').innerHTML = addr ? `
    <div class="addr-card selected">
      <span class="tag badge badge-brand">${esc(addr.type || 'Home')}</span>
      <h4>${esc(addr.name)}</h4>
      <address>${esc(addr.line1)}${addr.landmark ? `<br>Near ${esc(addr.landmark)}` : ''}<br>
        ${esc(addr.city)}, ${esc(addr.state)} — ${esc(addr.pin)}</address>
      <div class="phone">${icon('phone', 13)} ${esc(addr.phone)}</div>
    </div>`
    : `<p class="muted small">No address saved yet.
       <a href="address.html" style="color:var(--brand-600);font-weight:700">Add one now</a>
       for a faster checkout.</p>`;

  /* recent orders */
  const host = $('#recent-orders');
  if (!orders.length) {
    emptyState(host, {
      title: 'No orders yet', text: 'When you place an order it will appear here.',
      actionLabel: 'Start shopping', actionHref: url('pages/shop.html')
    });
  } else {
    host.innerHTML = orders.slice(0, 3).map(o => `
      <a class="flex items-center gap-3" href="order-details.html?id=${o.id}"
         style="padding:.85rem 0;border-bottom:1px solid var(--border)">
        <img src="${url(o.items[0].image)}" alt="" width="48" height="48"
             style="border-radius:10px;object-fit:cover;background:var(--surface-3)">
        <div style="flex:1;min-width:0">
          <div class="semi small truncate">${esc(o.items[0].name)}
            ${o.items.length > 1 ? `<span class="muted">+${o.items.length - 1} more</span>` : ''}</div>
          <div class="xs muted">${o.id} · ${fmtDate(o.placedAt)}</div>
        </div>
        <div class="text-right">
          <div class="semi small">${money(o.totals.total)}</div>
          <span class="badge ${statusBadge(o.status)}">${esc(o.status)}</span>
        </div>
      </a>`).join('');
  }
});

