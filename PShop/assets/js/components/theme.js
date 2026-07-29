/* ==========================================================================
   PShop — dark / light theme manager
   Applies the saved theme before paint (see the inline snippet in each page)
   and keeps the toggle button in sync.
   ========================================================================== */
import { CONFIG } from '../core/config.js';
import { Store } from '../core/storage.js';
import { icon } from './icons.js';

const mq = window.matchMedia('(prefers-color-scheme: dark)');

export const Theme = {
  get() { return Store.get(CONFIG.KEYS.THEME, 'auto'); },

  /** Resolve 'auto' into an actual theme. */
  resolved() {
    const t = this.get();
    return t === 'auto' ? (mq.matches ? 'dark' : 'light') : t;
  },

  apply(theme = this.get()) {
    const actual = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme;
    document.documentElement.dataset.theme = actual;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', actual === 'dark' ? '#0b1120' : '#2563eb');
    this.syncButtons(actual);
    window.dispatchEvent(new CustomEvent('pshop:theme', { detail: { theme: actual, mode: theme } }));
  },

  set(theme) { Store.set(CONFIG.KEYS.THEME, theme); this.apply(theme); },

  toggle() { this.set(this.resolved() === 'dark' ? 'light' : 'dark'); },

  syncButtons(actual = this.resolved()) {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.innerHTML = icon(actual === 'dark' ? 'sun' : 'moon', 20);
      btn.setAttribute('aria-label', actual === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', actual === 'dark' ? 'Light mode' : 'Dark mode');
    });
  },

  init() {
    this.apply();
    mq.addEventListener('change', () => { if (this.get() === 'auto') this.apply('auto'); });
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-theme-toggle]');
      if (btn) { e.preventDefault(); this.toggle(); }
    });
  }
};

export default Theme;
