/* ==========================================================================
   PShop — Notifications centre
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, $$, esc, timeAgo } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { Notifications } from '../core/state.js';
import { API } from '../core/api.js';
import { renderAccountNav } from './_account-nav.js';
import { icon } from '../components/icons.js';
import { toast, confirmDialog } from '../components/toast.js';
import { emptyState } from '../components/lazy-load.js';

let filter = 'all';

page(async () => {
  await initApp({ page: 'notifications', nav: '', newsletter: false });
  renderAccountNav('notifications.html');

  await API.getNotifications();   // seeds the default set on first visit
  render();

  $$('[data-filter]').forEach(b => b.onclick = () => {
    $$('[data-filter]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    filter = b.dataset.filter;
    render();
  });

  $('#mark-all').onclick = () => {
    if (!Notifications.unread()) return toast.info('Everything is already read.');
    Notifications.markAllRead();
    toast.success('All notifications marked as read.');
    render();
  };

  $('#clear-all').onclick = async () => {
    if (!Notifications.all().length) return toast.info('Nothing to clear.');
    const ok = await confirmDialog({
      title: 'Clear all notifications?', message: 'This removes every notification permanently.',
      confirmText: 'Clear all', danger: true
    });
    if (!ok) return;
    Notifications.clear();
    toast.info('Notifications cleared.');
    render();
  };

  window.addEventListener('pshop:notif', render);
});

function render() {
  const all = Notifications.all();
  const items = all.filter(n =>
    filter === 'all' ? true : filter === 'unread' ? !n.read : n.type === filter);

  const host = $('#notif-list'), empty = $('#notif-empty');

  if (!items.length) {
    host.innerHTML = '';
    empty.hidden = false;
    emptyState(empty, {
      title: filter === 'all' ? 'No notifications yet' : 'Nothing here',
      text: filter === 'all'
        ? 'Order updates, offers and account alerts will show up here.'
        : 'Try a different filter to see more notifications.',
      actionLabel: filter === 'all' ? 'Start shopping' : null,
      actionHref: filter === 'all' ? url('pages/shop.html') : null
    });
    return;
  }

  empty.hidden = true;
  const ICONS = { order: 'package', offer: 'tag', system: 'info', payment: 'wallet' };

  host.innerHTML = items.map(n => `
    <article class="notif-item ${n.type} ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <span class="ico">${icon(ICONS[n.type] || 'bell', 19)}</span>
      <div style="flex:1;min-width:0;padding-right:1.2rem">
        <h4>${esc(n.title)}</h4>
        <p>${esc(n.body)}</p>
        <time datetime="${n.at}">${timeAgo(n.at)}</time>
        ${n.link ? `<a class="small semi" style="color:var(--brand-600);display:inline-block;margin-top:.4rem"
          href="${url(n.link)}">View details →</a>` : ''}
      </div>
      <button class="close" data-del="${n.id}" aria-label="Delete notification">${icon('close', 15)}</button>
    </article>`).join('');

  // Reading a notification marks it read.
  $$('.notif-item').forEach(node => node.addEventListener('click', e => {
    if (e.target.closest('[data-del]')) return;
    const id = node.dataset.id;
    if (node.classList.contains('unread')) {
      Notifications.markRead(id);
      node.classList.remove('unread');
    }
  }));

  $$('[data-del]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    Notifications.remove(b.dataset.del);
    toast.info('Notification removed.');
    render();
  });
}
