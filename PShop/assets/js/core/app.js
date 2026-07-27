/* ==========================================================================
   PShop — application bootstrap
   Every page imports initApp() and awaits it before rendering page content.
   Handles: theme, header, footer, bottom nav, card actions, PWA, a11y,
   global keyboard shortcuts and the page loader.
   ========================================================================== */
import { CONFIG, url } from './config.js';
import { $, ready, observeReveal } from './utils.js';
import { Theme } from '../components/theme.js';
import { renderHeader, updateBadges } from '../components/header.js';
import { renderFooter, renderBottomNav } from '../components/footer.js';
import { wireCardActions } from '../components/product-card.js';
import { lazyImages } from '../components/lazy-load.js';
import { initConnectionWatch } from '../components/connection.js';
import { syncOnLoad, getSyncState } from './sync.js';
import { Auth } from './auth.js';

/**
 * Boot a page.
 * @param {{page?:string, nav?:string, header?:boolean, footer?:boolean,
 *          bottomNav?:boolean, newsletter?:boolean, cardActions?:boolean,
 *          getProduct?:Function}} opts
 */
export async function initApp(opts = {}) {
  const {
    page = '', nav = '', header = true, footer = true,
    bottomNav = true, newsletter = true, cardActions = true, getProduct = null
  } = opts;

  Theme.init();

  // Har step ko try/catch me wrap karo — ek failure se poora page nahi rukna chahiye.
  if (header) {
    try { await renderHeader(nav); } catch (e) { console.warn('[PShop] header error:', e.message); }
  }
  try { renderFooter({ newsletter }); } catch (e) { console.warn('[PShop] footer error:', e.message); }
  try { renderBottomNav(page); } catch (e) { console.warn('[PShop] bottom-nav error:', e.message); }
  try { wireCardActions(getProduct); } catch (e) { console.warn('[PShop] card-actions error:', e.message); }

  try { lazyImages(); } catch (e) { /* ignore */ }
  try { observeReveal(); } catch (e) { /* ignore */ }
  try { registerServiceWorker(); } catch (e) { /* ignore */ }
  try { wireShortcuts(); } catch (e) { /* ignore */ }
  try { wireGlobalA11y(); } catch (e) { /* ignore */ }
  try { wireSyncIndicator(); } catch (e) { /* ignore */ }
  try { initConnectionWatch(); } catch (e) { /* ignore */ }

  hideLoader();
  updateBadges();

  // Logged-in user ka cart/wishlist/address Google Sheet se refresh karo.
  // Background me chalta hai — page render block nahi hota.
  if (Auth.isLoggedIn()) {
    syncOnLoad().then(() => updateBadges()).catch(() => {});
  }

  document.body.dataset.page = page;
  return { page };
}

/** Fade out the pre-render loader. */
export function hideLoader() {
  const l = $('.page-loader');
  if (!l) return;
  l.classList.add('done');
  setTimeout(() => l.remove(), 500);
}

/** Failsafe — agar JS me koi error aaye to bhi 4 second baad loader auto-hide. */
setTimeout(() => {
  const l = $('.page-loader');
  if (l && !l.classList.contains('done')) {
    console.warn('[PShop] Loader failsafe triggered — hiding after timeout');
    hideLoader();
  }
}, 4000);

/** Register the service worker for offline/PWA support (https or localhost only). */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url('sw.js'), { scope: url('') })
      .catch(err => console.info('[PShop] Service worker not registered:', err.message));
  });
}

/** Keyboard shortcuts: "/" focuses search, "Esc" closes overlays. */
function wireShortcuts() {
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
      || document.activeElement?.isContentEditable;
    if (e.key === '/' && !typing) { e.preventDefault(); $('#q')?.focus(); }
    if (e.key === 'Escape') {
      document.querySelectorAll('.drawer.open, .modal.open, .sheet.open, .overlay.open')
        .forEach(n => n.classList.remove('open'));
      document.body.classList.remove('no-scroll');
    }
  });
}

/** "Syncing…" pill dikhata hai jab data Sheet ke saath sync ho raha ho. */
function wireSyncIndicator() {
  let pill = null;
  window.addEventListener('pshop:sync', e => {
    const syncing = e.detail.state === 'syncing';

    if (syncing && !pill) {
      const node = document.createElement('div');
      node.className = 'sync-pill';
      node.setAttribute('role', 'status');
      node.innerHTML = '<span class="sync-dot"></span> Syncing…';
      document.body.append(node);
      pill = node;
      // `node` ko capture karte hain, `pill` ko nahi — sync bahut jaldi
      // khatam ho jaye to `pill` null ho chuka hota hai aur ye frame crash karta.
      requestAnimationFrame(() => {
        if (node.isConnected) node.classList.add('show');
      });
      return;
    }

    if (!syncing && pill) {
      const node = pill;
      pill = null;
      node.classList.remove('show');
      setTimeout(() => node.remove(), 300);
    }
  });
}

/** Focus-visible only for keyboard users + external-link safety. */
function wireGlobalA11y() {
  document.addEventListener('mousedown', () => document.body.classList.add('using-mouse'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') document.body.classList.remove('using-mouse');
  });
  document.querySelectorAll('a[target="_blank"]').forEach(a => {
    a.rel = (a.rel ? a.rel + ' ' : '') + 'noopener noreferrer';
  });
}

/** Convenience wrapper — run a page's main() once the DOM is ready. */
export function page(main) {
  ready(() => {
    main().catch(err => {
      console.error('[PShop] page error', err);
      hideLoader();
      const t = document.getElementById('page-error');
      if (t) t.hidden = false;
    });
  });
}

export { CONFIG, url };
