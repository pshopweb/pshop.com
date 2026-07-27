/* ==========================================================================
   PShop — authentication & session
   Handles login/signup/OTP/auto-login/logout and route guarding.
   ========================================================================== */
import { CONFIG, url } from './config.js';
import { Store } from './storage.js';
import { API } from './api.js';

export const Auth = {
  /** Currently signed-in user object, or null. */
  user() { return Store.get(CONFIG.KEYS.USER, null); },
  token() { return Store.get(CONFIG.KEYS.TOKEN, null); },
  isLoggedIn() { return Boolean(this.user() && this.token()); },
  isAdmin() { return this.user()?.role === 'admin'; },
  id() { return this.user()?.id || 'guest'; },

  /** Persist a session (auto-login on next visit is implicit via localStorage). */
  setSession(user, token) {
    Store.set(CONFIG.KEYS.USER, user);
    Store.set(CONFIG.KEYS.TOKEN, token);
    window.dispatchEvent(new CustomEvent('pshop:auth', { detail: { user } }));
  },

  async login(identifier, password) {
    const res = await API.login({ identifier, password });
    if (res.success) {
      this.setSession(res.data.user, res.data.token);
      await this.afterLogin();
    }
    return res;
  },

  async signup(payload) {
    const res = await API.signup(payload);
    if (res.success) {
      this.setSession(res.data.user, res.data.token);
      await this.afterLogin();
    }
    return res;
  },

  async verifyOtp(code) {
    const res = await API.verifyOtp({ code });
    if (res.success && res.data.user && res.data.token) {
      this.setSession(res.data.user, res.data.token);
      await this.afterLogin();
    }
    return res;
  },

  /**
   * Login ke baad guest ka cart/wishlist server par merge karta hai,
   * phir server ka data wapas laata hai. Backend na ho to kuch nahi hota.
   */
  async afterLogin() {
    try {
      const { syncOnLogin } = await import('./sync.js');
      await syncOnLogin();
    } catch (err) {
      console.info('[PShop] login sync skipped:', err.message);
    }
  },

  /** Update the cached user object after a profile edit. */
  patchUser(patch) {
    const u = this.user();
    if (!u) return null;
    const next = { ...u, ...patch };
    Store.set(CONFIG.KEYS.USER, next);
    window.dispatchEvent(new CustomEvent('pshop:auth', { detail: { user: next } }));
    return next;
  },

  /** Sign out. Cart & wishlist are intentionally preserved for convenience. */
  logout({ keepCart = false } = {}) {
    Store.remove(CONFIG.KEYS.USER);
    Store.remove(CONFIG.KEYS.TOKEN);
    Store.remove(CONFIG.KEYS.CHECKOUT);
    Store.remove(CONFIG.KEYS.ADDRESS);
    // Server-synced cart local me na rahe, warna agla guest use dekh lega.
    if (!keepCart) { Store.remove(CONFIG.KEYS.CART); Store.remove(CONFIG.KEYS.WISHLIST); }
    window.dispatchEvent(new CustomEvent('pshop:auth', { detail: { user: null } }));
  },

  /**
   * Guard a page. Redirects to login with a return path when signed out.
   * @returns {boolean} true when access is allowed.
   */
  require({ admin = false, redirect = true } = {}) {
    const loggedIn = this.isLoggedIn();
    if (!loggedIn || (admin && !this.isAdmin())) {
      if (redirect) {
        const back = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        location.replace(url(`pages/login.html?next=${back}${admin ? '&admin=1' : ''}`));
      }
      return false;
    }
    return true;
  },

  /** Where to go after a successful sign-in. */
  nextUrl() {
    const next = new URLSearchParams(location.search).get('next');
    if (next && /^[\w.-]+\.html(\?.*)?$/.test(next)) return next;
    return 'profile.html';
  },

  onChange(handler) {
    const fn = e => handler(e.detail.user);
    window.addEventListener('pshop:auth', fn);
    return () => window.removeEventListener('pshop:auth', fn);
  }
};

export default Auth;
