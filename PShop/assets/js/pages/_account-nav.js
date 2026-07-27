/* ==========================================================================
   PShop — account sidebar navigation (shared by every /account page)
   ========================================================================== */
import { url } from '../core/config.js';
import { $, esc } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { Cart, Wishlist, Notifications } from '../core/state.js';
import { icon } from '../components/icons.js';

const LINKS = [
  ['profile.html',       'user',     'My Profile'],
  ['orders.html',        'package',  'My Orders'],
  ['track-order.html',   'truck',    'Track Order'],
  ['wishlist.html',      'heart',    'Wishlist'],
  ['cart.html',          'cart',     'Cart'],
  ['address.html',       'mapPin',   'Addresses'],
  ['notifications.html', 'bell',     'Notifications'],
  ['messages.html',      'chat',     'Messages'],
  ['settings.html',      'settings', 'Settings']
];

/** Render the account sidebar and mark the active page. */
export function renderAccountNav(activeFile) {
  const host = $('#account-nav');
  if (!host) return;
  const user = Auth.user();
  const counts = {
    'wishlist.html': Wishlist.count(),
    'cart.html': Cart.count(),
    'notifications.html': Notifications.unread()
  };

  host.innerHTML = `
    ${user ? `
      <div class="account-head">
        <img src="${user.avatar || url('assets/img/misc/avatar.svg')}" alt="" width="48" height="48">
        <div style="min-width:0">
          <div class="bold truncate">${esc(user.name)}</div>
          <div class="xs muted truncate">${esc(user.email)}</div>
        </div>
      </div>` : ''}
    ${LINKS.map(([href, ic, label]) => {
      const n = counts[href] || 0;
      return `<a href="${href}" class="${href === activeFile ? 'active' : ''}"
        ${href === activeFile ? 'aria-current="page"' : ''}>
        ${icon(ic, 18)}<span>${label}</span>
        ${n ? `<span class="badge badge-brand" style="margin-left:auto">${n > 99 ? '99+' : n}</span>` : ''}
      </a>`;
    }).join('')}
    ${user?.role === 'admin'
      ? `<a href="${url('admin/dashboard.html')}">${icon('barChart', 18)}<span>Admin Panel</span></a>` : ''}
    <a href="#" id="nav-logout">${icon('logout', 18)}<span>Logout</span></a>`;

  $('#nav-logout')?.addEventListener('click', async e => {
    e.preventDefault();
    const { toast } = await import('../components/toast.js');
    Auth.logout();
    toast.success('Signed out successfully.');
    setTimeout(() => location.href = url('index.html'), 700);
  });
}
