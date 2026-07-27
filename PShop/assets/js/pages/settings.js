/* ==========================================================================
   PShop — Settings page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, $$, el } from '../core/utils.js';
import { Store } from '../core/storage.js';
import { Auth } from '../core/auth.js';
import { Settings, Addresses, Cart, Wishlist, Recent } from '../core/state.js';
import { Theme } from '../components/theme.js';
import { renderAccountNav } from './_account-nav.js';
import { toast, confirmDialog } from '../components/toast.js';

page(async () => {
  await initApp({ page: 'settings', nav: '', newsletter: false });
  renderAccountNav('settings.html');

  /* ------------------------------ theme ------------------------------- */
  const paintTheme = () => {
    const mode = Theme.get();
    $$('[data-theme-set]').forEach(b => b.classList.toggle('active', b.dataset.themeSet === mode));
  };
  $$('[data-theme-set]').forEach(b => b.onclick = () => {
    Theme.set(b.dataset.themeSet);
    paintTheme();
    toast.success(`Theme set to ${b.dataset.themeSet}.`);
  });
  paintTheme();

  /* --------------------------- toggles/selects ------------------------- */
  const settings = Settings.all();
  $$('[data-setting]').forEach(node => {
    const key = node.dataset.setting;
    if (node.type === 'checkbox') node.checked = Boolean(settings[key]);
    else node.value = settings[key];

    node.addEventListener('change', () => {
      const value = node.type === 'checkbox' ? node.checked : node.value;
      Settings.set(key, value);
      if (key === 'saveHistory' && !value) Recent.clear();
      toast.success('Preference saved.');
    });
  });

  /* ------------------------------ storage ------------------------------ */
  const kb = (Store.usage() / 1024).toFixed(1);
  $('#storage-used').textContent = `${kb} KB of cart, wishlist and browsing data`;

  $('#clear-cache').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Clear cached data?',
      message: 'This clears your cart, wishlist, compare list and browsing history on this device. Your account and orders are not affected.',
      confirmText: 'Clear data', danger: true
    });
    if (!ok) return;
    [CONFIG.KEYS.CART, CONFIG.KEYS.WISHLIST, CONFIG.KEYS.COMPARE,
     CONFIG.KEYS.RECENT, CONFIG.KEYS.SEARCHES, CONFIG.KEYS.COUPON].forEach(k => Store.remove(k));
    toast.success('Cached data cleared.');
    setTimeout(() => location.reload(), 800);
  };

  $('#export-data').onclick = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      profile: Auth.user(),
      settings: Settings.all(),
      addresses: Addresses.all(),
      cart: Cart.all(),
      wishlist: Wishlist.all(),
      orders: Store.get(CONFIG.KEYS.ORDERS, [])
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `pshop-data-${Date.now()}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast.success('Your data has been downloaded.');
  };

  /* ---------------------------- danger zone ---------------------------- */
  $('#btn-signout').onclick = async () => {
    if (!Auth.isLoggedIn()) return toast.info('You are not signed in.');
    const ok = await confirmDialog({ title: 'Sign out?', message: 'You can sign back in any time.',
      confirmText: 'Sign out' });
    if (!ok) return;
    Auth.logout();
    toast.success('Signed out.');
    setTimeout(() => location.href = url('index.html'), 700);
  };

  $('#btn-delete').onclick = async () => {
    if (!Auth.isLoggedIn()) return toast.info('You need to be signed in to delete an account.');
    const typed = await confirmDialog({
      title: 'Delete your account?',
      message: 'This permanently removes your profile, addresses, cart and wishlist from this device. Type DELETE to confirm.',
      confirmText: 'Delete permanently', danger: true,
      input: { label: 'Type DELETE to confirm', placeholder: 'DELETE' }
    });
    if (typed !== 'DELETE') {
      if (typed) toast.warn('Account not deleted — the confirmation text did not match.');
      return;
    }
    // Remove this user from the local user store, then wipe the session.
    const users = Store.get(CONFIG.KEYS.USERS_DB, []).filter(u => u.id !== Auth.id());
    Store.set(CONFIG.KEYS.USERS_DB, users);
    Store.clearAll([CONFIG.KEYS.USERS_DB]);
    toast.success('Your account has been deleted.');
    setTimeout(() => location.href = url('index.html'), 1000);
  };
});
