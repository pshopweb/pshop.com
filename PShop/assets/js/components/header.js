/* ==========================================================================
   PShop — site header: logo, search + live suggestions, action icons,
   mega menu, mobile drawer, cart/wishlist badges.
   Injected into <div id="site-header"></div> on every page.
   ========================================================================== */
import { CONFIG, url } from '../core/config.js';
import { $, $$, el, esc, debounce, money, on } from '../core/utils.js';
import { Cart, Wishlist, Notifications, SearchHistory } from '../core/state.js';
import { API } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { icon } from './icons.js';
import { Theme } from './theme.js';
import { toast } from './toast.js';

const P = p => url('pages/' + p);

const NAV = [
  { label: 'Home',      href: url('index.html'),   icon: 'home' },
  { label: 'Shop',      href: P('shop.html'),      icon: 'grid', mega: true },
  { label: 'Categories',href: P('category.html'),  icon: 'layers' },
  { label: 'Flash Sale',href: P('shop.html?tag=flash'), icon: 'zap' },
  { label: 'Trending',  href: P('shop.html?tag=trending'), icon: 'trending' },
  { label: 'Orders',    href: P('orders.html'),    icon: 'package' },
  { label: 'Support',   href: P('contact.html'),   icon: 'headphones' }
];

export async function renderHeader(active = '') {
  const mount = $('#site-header');
  if (!mount) return;
  const user = Auth.user();

  mount.innerHTML = `
  <header class="site-header" id="header">
    <div class="announce">
      ${icon('zap', 13)}
      <span>Free delivery above ${CONFIG.CURRENCY}${CONFIG.FREE_SHIP_ABOVE}
        &middot; <strong>PSHOP10</strong>: 10% off above ${CONFIG.CURRENCY}999
        (max ${CONFIG.CURRENCY}300)</span>
      <a href="${P('shop.html?tag=flash')}">Shop deals</a>
    </div>

    <div class="container header-main">
      <button class="hamburger" id="btn-menu" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav">
        ${icon('menu', 24)}
      </button>

      <a class="logo" href="${url('index.html')}" aria-label="PShop home">
        <img src="${url('assets/img/icons/logo.svg')}" alt="PShop" width="220" height="56">
      </a>

      <form class="search-box" id="search-form" role="search" autocomplete="off">
        <span class="s-ico">${icon('search', 19)}</span>
        <label class="sr-only" for="q">Search products</label>
        <input type="search" id="q" name="q" placeholder="Search for products, brands and more"
               aria-label="Search products" aria-expanded="false" aria-controls="suggest" role="combobox">
        <button class="s-btn" type="submit" aria-label="Search">${icon('search', 17)}</button>
        <div class="suggest" id="suggest" role="listbox" aria-label="Search suggestions"></div>
      </form>

      <nav class="header-actions" aria-label="Account and cart">
        <button class="h-action" data-theme-toggle aria-label="Toggle theme"></button>

        <a class="h-action" href="${P('notifications.html')}" aria-label="Notifications">
          <span class="ico-wrap">${icon('bell', 21)}
            <span class="count-bubble" data-notif-count aria-hidden="true"></span></span>
          <span class="lbl">Alerts</span>
        </a>

        <a class="h-action" href="${P('wishlist.html')}" aria-label="Wishlist">
          <span class="ico-wrap">${icon('heart', 21)}
            <span class="count-bubble" data-wish-count aria-hidden="true"></span></span>
          <span class="lbl">Wishlist</span>
        </a>

        <div class="dropdown" id="acct-dd">
          <button class="h-action" id="acct-btn" aria-haspopup="true" aria-expanded="false">
            ${icon('user', 21)}<span class="lbl">${user ? esc(user.name.split(' ')[0]) : 'Account'}</span>
          </button>
          <div class="dropdown-menu" role="menu">${accountMenu(user)}</div>
        </div>

        <a class="h-action" href="${P('cart.html')}" aria-label="Shopping cart">
          <span class="ico-wrap">${icon('cart', 21)}
            <span class="count-bubble" data-cart-count aria-hidden="true"></span></span>
          <span class="lbl">Cart</span>
        </a>
      </nav>
    </div>

    <nav class="header-nav desktop-only" aria-label="Main navigation">
      <div class="container">
        <ul class="nav-list" role="list">
          ${NAV.map(n => `
            <li>
              <a class="nav-link ${active === n.label.toLowerCase() ? 'active' : ''}" href="${n.href}">
                ${icon(n.icon, 16)}<span>${n.label}</span>
                ${n.mega ? icon('chevronDown', 14) : ''}
              </a>
              ${n.mega ? '<div class="mega" id="mega-shop"></div>' : ''}
            </li>`).join('')}
        </ul>
      </div>
    </nav>
  </header>

  <div class="overlay" id="nav-overlay"></div>
  <aside class="drawer left mobile-nav" id="mobile-nav" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1">
    <div class="drawer-head">
      <strong>Menu</strong>
      <button class="btn-icon btn-ghost" id="btn-close-menu" aria-label="Close menu">${icon('close', 20)}</button>
    </div>
    <div class="drawer-body" id="mnav-body"></div>
  </aside>`;

  buildMobileNav(user);
  wireSearch();
  wireDropdown();
  wireDrawer();
  updateBadges();
  Theme.syncButtons();
  loadMega();

  // Global listeners sirf EK BAAR bind hote hain. renderHeader() dobara chal
  // sakta hai (login/logout par), isliye purane listeners ko re-bind karna
  // memory leak banata hai aur stale DOM node par point karta rehta hai.
  bindGlobalListeners(active);
}

let globalsBound = false;

/** Scroll shadow, badge updates aur auth re-render — sab ek hi baar bind. */
function bindGlobalListeners(active) {
  if (globalsBound) {
    applyHeaderShadow();
    return;
  }
  globalsBound = true;

  window.addEventListener('scroll', applyHeaderShadow, { passive: true });
  applyHeaderShadow();

  ['pshop:cart', 'pshop:wishlist', 'pshop:notif', 'pshop:store'].forEach(evt =>
    window.addEventListener(evt, updateBadges));

  // Login/logout par header dobara render hota hai.
  window.addEventListener('pshop:auth', () => renderHeader(active));
}

/** Header ko har baar dobara dhoondhte hain — purana node hat chuka ho sakta hai. */
function applyHeaderShadow() {
  const header = document.getElementById('header');
  if (!header) return;                       // header abhi render nahi hua
  header.classList.toggle('scrolled', window.scrollY > 6);
}

function accountMenu(user) {
  if (!user) {
    return `
      <div style="padding:.75rem;text-align:center">
        <p class="small muted mb-2">Sign in for orders, wishlist &amp; faster checkout</p>
        <a class="btn btn-primary btn-sm btn-block" href="${P('login.html')}">Login</a>
        <p class="xs muted mt-2">New here? <a href="${P('signup.html')}" style="color:var(--brand-600);font-weight:700">Create account</a></p>
      </div>
      <hr>
      <a href="${P('orders.html')}" role="menuitem">${icon('package', 17)} My Orders</a>
      <a href="${P('wishlist.html')}" role="menuitem">${icon('heart', 17)} Wishlist</a>
      <a href="${P('track-order.html')}" role="menuitem">${icon('truck', 17)} Track Order</a>
      <a href="${P('contact.html')}" role="menuitem">${icon('headphones', 17)} Help Centre</a>`;
  }
  return `
    <div style="padding:.6rem .75rem;border-bottom:1px solid var(--border);margin-bottom:.35rem">
      <div class="bold">${esc(user.name)}</div>
      <div class="xs muted">${esc(user.email)}</div>
    </div>
    <a href="${P('profile.html')}" role="menuitem">${icon('user', 17)} My Profile</a>
    <a href="${P('orders.html')}" role="menuitem">${icon('package', 17)} My Orders</a>
    <a href="${P('wishlist.html')}" role="menuitem">${icon('heart', 17)} Wishlist</a>
    <a href="${P('address.html')}" role="menuitem">${icon('mapPin', 17)} Addresses</a>
    <a href="${P('messages.html')}" role="menuitem">${icon('chat', 17)} Messages</a>
    <a href="${P('settings.html')}" role="menuitem">${icon('settings', 17)} Settings</a>
    ${user.role === 'admin' ? `<hr><a href="${url('admin/dashboard.html')}" role="menuitem">${icon('barChart', 17)} Admin Dashboard</a>` : ''}
    <hr>
    <button id="btn-logout" role="menuitem">${icon('logout', 17)} Logout</button>`;
}

function buildMobileNav(user) {
  const body = $('#mnav-body');
  if (!body) return;
  body.innerHTML = `
    ${user ? `
      <a class="mnav-user" href="${P('profile.html')}">
        <img src="${user.avatar || url('assets/img/misc/avatar.svg')}" alt="">
        <div><div class="bold">${esc(user.name)}</div>
          <div class="xs" style="opacity:.85">${esc(user.email)}</div></div>
      </a>` : `
      <div class="mnav-user" style="display:block">
        <div class="bold mb-2">Welcome to PShop</div>
        <div class="flex gap-2">
          <a class="btn btn-sm" style="background:#fff;color:var(--brand-700);flex:1" href="${P('login.html')}">Login</a>
          <a class="btn btn-sm btn-outline" style="border-color:#fff;color:#fff;flex:1" href="${P('signup.html')}">Sign up</a>
        </div>
      </div>`}

    <div class="mnav-group">
      <h5>Shop</h5>
      ${NAV.map(n => `<a class="mnav-link" href="${n.href}">${icon(n.icon, 19)} ${n.label}</a>`).join('')}
      <a class="mnav-link" href="${P('compare.html')}">${icon('compare', 19)} Compare Products</a>
    </div>

    <div class="mnav-group">
      <h5>Account</h5>
      <a class="mnav-link" href="${P('profile.html')}">${icon('user', 19)} My Profile</a>
      <a class="mnav-link" href="${P('orders.html')}">${icon('package', 19)} My Orders</a>
      <a class="mnav-link" href="${P('wishlist.html')}">${icon('heart', 19)} Wishlist
        <span class="right" data-wish-count-text></span></a>
      <a class="mnav-link" href="${P('cart.html')}">${icon('cart', 19)} Cart
        <span class="right" data-cart-count-text></span></a>
      <a class="mnav-link" href="${P('address.html')}">${icon('mapPin', 19)} Addresses</a>
      <a class="mnav-link" href="${P('notifications.html')}">${icon('bell', 19)} Notifications</a>
      <a class="mnav-link" href="${P('messages.html')}">${icon('chat', 19)} Messages</a>
      <a class="mnav-link" href="${P('settings.html')}">${icon('settings', 19)} Settings</a>
    </div>

    <div class="mnav-group">
      <h5>Help &amp; info</h5>
      <a class="mnav-link" href="${P('track-order.html')}">${icon('truck', 19)} Track Order</a>
      <a class="mnav-link" href="${P('faq.html')}">${icon('helpCircle', 19)} FAQ</a>
      <a class="mnav-link" href="${P('about.html')}">${icon('info', 19)} About Us</a>
      <a class="mnav-link" href="${P('contact.html')}">${icon('mail', 19)} Contact</a>
      <a class="mnav-link" href="${P('privacy.html')}">${icon('shield', 19)} Privacy Policy</a>
      <a class="mnav-link" href="${P('terms.html')}">${icon('file', 19)} Terms of Use</a>
    </div>

    <div class="mnav-group">
      <button class="mnav-link w-full" data-theme-toggle-row>
        ${icon('moon', 19)} <span>Dark mode</span>
        <span class="right"><label class="switch"><input type="checkbox" id="mnav-theme"></label></span>
      </button>
      ${user ? `<button class="mnav-link w-full" id="btn-logout-m">${icon('logout', 19)} Logout</button>` : ''}
    </div>
    <p class="xs muted text-center mt-4">PShop v${CONFIG.VERSION}</p>`;

  const themeInput = $('#mnav-theme');
  if (themeInput) {
    themeInput.checked = Theme.resolved() === 'dark';
    themeInput.addEventListener('change', () => Theme.set(themeInput.checked ? 'dark' : 'light'));
  }
  $('#btn-logout-m')?.addEventListener('click', doLogout);
  Theme.syncButtons();
}

/* ------------------------------- search ---------------------------------- */
function wireSearch() {
  const form = $('#search-form');
  const input = $('#q');
  const box = $('#suggest');
  if (!form) return;

  const preset = new URLSearchParams(location.search).get('q');
  if (preset && location.pathname.includes('search')) input.value = preset;

  let activeIdx = -1;

  const close = () => { box.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); activeIdx = -1; };

  const renderHistory = () => {
    const hist = SearchHistory.all();
    const trending = ['smartphone', 'running shoes', 'air fryer', 'serum', 'yoga mat', 'headphones'];
    box.innerHTML = `
      ${hist.length ? `<div class="suggest-head">Recent searches</div>
        ${hist.map(h => `<div class="suggest-item" data-term="${esc(h)}" role="option">
          ${icon('clock', 16)}<div class="si-name">${esc(h)}</div></div>`).join('')}` : ''}
      <div class="suggest-head">Trending now</div>
      ${trending.map(t => `<div class="suggest-item" data-term="${esc(t)}" role="option">
        ${icon('trending', 16)}<div class="si-name">${esc(t)}</div></div>`).join('')}`;
    box.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  };

  const runSuggest = debounce(async term => {
    if (term.length < 2) return renderHistory();
    box.innerHTML = `<div class="suggest-item"><div class="skeleton sk-circle" style="width:40px;height:40px"></div>
      <div style="flex:1"><div class="skeleton sk-text w-60"></div><div class="skeleton sk-text w-40"></div></div></div>`.repeat(3);
    box.classList.add('open');
    const res = await API.searchProducts({ q: term, limit: 6 });
    if (!res.success) return close();
    const { items, suggestions, total } = res.data;
    if (!items.length) {
      box.innerHTML = `<div class="suggest-item"><div class="si-name">No matches for “${esc(term)}”</div></div>`;
      return;
    }
    box.innerHTML = `
      ${suggestions.length ? `<div class="suggest-head">Suggestions</div>
        ${suggestions.map(s => `<div class="suggest-item" data-term="${esc(s.label)}" role="option">
          ${icon('search', 16)}<div><div class="si-name">${esc(s.label)}</div>
          <div class="si-meta">in ${esc(s.type)}</div></div></div>`).join('')}` : ''}
      <div class="suggest-head">Products</div>
      ${items.map(p => `<a class="suggest-item" href="${P('product-details.html?id=' + p.id)}" role="option">
        <img src="${url(p.thumb)}" alt="" loading="lazy" width="40" height="40">
        <div style="flex:1;min-width:0"><div class="si-name truncate">${esc(p.name)}</div>
          <div class="si-meta">${esc(p.brand)} &middot; ${money(p.price)}</div></div>
        ${icon('arrowRight', 15)}</a>`).join('')}
      <a class="suggest-item" href="${P('search.html?q=' + encodeURIComponent(term))}" style="justify-content:center;font-weight:700;color:var(--brand-600)">
        View all ${total} results</a>`;
  }, CONFIG.DEBOUNCE_MS);

  input.addEventListener('input', e => {
    const v = e.target.value.trim();
    v ? runSuggest(v) : renderHistory();
  });
  input.addEventListener('focus', () => { input.value.trim() ? runSuggest(input.value.trim()) : renderHistory(); });

  input.addEventListener('keydown', e => {
    const opts = $$('.suggest-item', box);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!opts.length) return;
      opts[activeIdx]?.classList.remove('active');
      activeIdx = e.key === 'ArrowDown'
        ? (activeIdx + 1) % opts.length
        : (activeIdx - 1 + opts.length) % opts.length;
      opts[activeIdx].classList.add('active');
      opts[activeIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault(); opts[activeIdx].click();
    } else if (e.key === 'Escape') close();
  });

  on(box, 'click', '[data-term]', (e, node) => {
    input.value = node.dataset.term;
    form.requestSubmit();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const term = input.value.trim();
    if (!term) { input.focus(); return; }
    SearchHistory.push(term);
    close();
    location.href = P('search.html?q=' + encodeURIComponent(term));
  });

  document.addEventListener('click', e => {
    if (form.isConnected && !form.contains(e.target)) close();
  });
}

/* ------------------------------ mega menu -------------------------------- */
async function loadMega() {
  const mega = $('#mega-shop');
  if (!mega) return;
  const res = await API.getCategories();
  if (!res.success) return;
  mega.innerHTML = res.data.items.slice(0, 6).map(c => `
    <div>
      <h4>${esc(c.name)}</h4>
      ${c.subCategories.slice(0, 5).map(s =>
        `<a href="${P(`category.html?cat=${c.slug}&sub=${encodeURIComponent(s)}`)}">${esc(s)}</a>`).join('')}
      <a href="${P('category.html?cat=' + c.slug)}" style="color:var(--brand-600);font-weight:700;margin-top:.3rem">
        All ${esc(c.name)} &rsaquo;</a>
    </div>`).join('');
}

/* ------------------------------ dropdown --------------------------------- */
function wireDropdown() {
  const dd = $('#acct-dd'), btn = $('#acct-btn');
  if (!dd || !btn) return;
  const toggle = open => {
    dd.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', e => { e.stopPropagation(); toggle(!dd.classList.contains('open')); });
  dd.addEventListener('mouseenter', () => { if (window.matchMedia('(hover:hover)').matches) toggle(true); });
  dd.addEventListener('mouseleave', () => toggle(false));
  document.addEventListener('click', e => {
    if (dd.isConnected && !dd.contains(e.target)) toggle(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dd.isConnected) toggle(false);
  });
  $('#btn-logout')?.addEventListener('click', doLogout);
}

/* ------------------------------- drawer ---------------------------------- */
function wireDrawer() {
  const drawer = $('#mobile-nav'), overlay = $('#nav-overlay'), btn = $('#btn-menu');
  if (!drawer || !overlay || !btn) return;
  const open = state => {
    drawer.classList.toggle('open', state);
    overlay.classList.toggle('open', state);
    document.body.classList.toggle('no-scroll', state);
    btn.setAttribute('aria-expanded', String(state));
    if (state) drawer.focus();
  };
  btn.addEventListener('click', () => open(true));
  $('#btn-close-menu').addEventListener('click', () => open(false));
  overlay.addEventListener('click', () => open(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.isConnected) open(false);
  });
  on(drawer, 'click', 'a', () => open(false));
}

/* -------------------------------- misc ----------------------------------- */
export function updateBadges() {
  const cart = Cart.count(), wish = Wishlist.count(), notif = Notifications.unread();
  const setBadge = (sel, n) => $$(sel).forEach(node => {
    const prev = node.textContent;
    node.textContent = n > 99 ? '99+' : (n || '');
    node.dataset.count = n;
    if (prev && String(prev) !== String(n) && n) {
      node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump');
    }
  });
  setBadge('[data-cart-count]', cart);
  setBadge('[data-wish-count]', wish);
  setBadge('[data-notif-count]', notif);
  $$('[data-cart-count-text]').forEach(n => n.textContent = cart ? `${cart} item${cart > 1 ? 's' : ''}` : '');
  $$('[data-wish-count-text]').forEach(n => n.textContent = wish ? `${wish} saved` : '');
}

function doLogout() {
  Auth.logout();
  toast.success('You have been signed out.');
  setTimeout(() => { location.href = url('index.html'); }, 700);
}
