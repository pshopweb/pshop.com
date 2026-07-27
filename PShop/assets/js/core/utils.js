/* ==========================================================================
   PShop — shared utility helpers (DOM, format, validate, misc)
   ========================================================================== */
import { CONFIG, url } from './config.js';

/* ------------------------------- DOM ------------------------------------ */
export const $  = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** Create an element with props & children in one call. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  children.flat().forEach(c => { if (c != null) node.append(c.nodeType ? c : document.createTextNode(c)); });
  return node;
}

/** Escape untrusted text before injecting into innerHTML. */
export const esc = (s = '') => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const on = (target, evt, sel, fn) => {
  target.addEventListener(evt, e => {
    const m = e.target.closest(sel);
    if (m && target.contains(m)) fn(e, m);
  });
};

export const ready = fn =>
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

/* ----------------------------- Formatting ------------------------------- */
export const money = n =>
  CONFIG.CURRENCY + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const moneyDec = n =>
  CONFIG.CURRENCY + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const compact = n => {
  n = Number(n) || 0;
  if (n >= 1e7) return (n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1) + ' Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1) + ' L';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'k';
  return String(n);
};

/** Kisi bhi value ko Date me badalta hai. Galat value par null. */
const parseDate = d => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

/** "25 Jul 2026" — list aur cards ke liye. */
export const fmtDate = (d, opts = {}) => {
  const date = parseDate(d);
  if (!date) return '\u2014';
  return date.toLocaleDateString('en-IN',
    { day: '2-digit', month: 'short', year: 'numeric', ...opts });
};

/** "25 Jul 2026, 04:30 pm" — detail pages ke liye. */
export const fmtDateTime = d => {
  const date = parseDate(d);
  if (!date) return '\u2014';
  return date.toLocaleString('en-IN',
    { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Sabse friendly format — order timeline aur notifications ke liye.
 *   Aaj      → "Today, 04:30 pm"
 *   Kal      → "Yesterday, 04:30 pm"
 *   Is saal  → "25 Jul, 04:30 pm"
 *   Purana   → "25 Jul 2025"
 */
export const fmtSmart = d => {
  const date = parseDate(d);
  if (!date) return '\u2014';

  const now = new Date();
  const time = date.toLocaleTimeString('en-IN',
    { hour: '2-digit', minute: '2-digit' });

  const sameDay = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (sameDay(date, now)) return `Today, ${time}`;

  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (sameDay(date, yest)) return `Yesterday, ${time}`;

  const tom = new Date(now);
  tom.setDate(tom.getDate() + 1);
  if (sameDay(date, tom)) return `Tomorrow, ${time}`;

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
      `, ${time}`;
  }
  return date.toLocaleDateString('en-IN',
    { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Delivery date — "Arriving Monday, 28 Jul" jaisa.
 * Aaj/kal ho to wahi bolta hai.
 */
export const fmtDelivery = d => {
  const date = parseDate(d);
  if (!date) return '\u2014';

  const now = new Date();
  const days = Math.ceil((date - now) / 864e5);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 6) {
    return date.toLocaleDateString('en-IN', { weekday: 'long' }) + ', ' +
      date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }
  return date.toLocaleDateString('en-IN',
    { weekday: 'short', day: '2-digit', month: 'short' });
};

export const timeAgo = d => {
  const date = parseDate(d);
  if (!date) return '';
  const t = date.getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const units = [['m', 60], ['h', 60], ['d', 24], ['w', 7], ['mo', 4.35], ['y', 12]];
  let v = s / 60, i = 0;
  while (i < units.length - 1 && v >= units[i + 1][1]) { v /= units[i + 1][1]; i++; }
  return Math.floor(v) + units[i][0] + ' ago';
};

/**
 * Kisi bhi date value ko YYYY-MM-DD me badalta hai.
 * Backend se date kabhi ISO string, kabhi Date object aa sakti hai —
 * `String(date).slice(0,10)` karne par "Sat Jul 25" jaisa kachra milta hai.
 * Isliye hamesha yahi helper use karein.
 */
export const dateKey = d => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  // UTC parts — taaki local timezone se din na khisak jaye.
  return date.getUTCFullYear() + '-' +
    String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(date.getUTCDate()).padStart(2, '0');
};

export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const pad = (n, len = 2) => String(n).padStart(len, '0');
export const titleCase = s => String(s).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
export const slugify = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ----------------------------- Validation -------------------------------- */
export const V = {
  email:  v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v).trim()),
  phone:  v => /^[6-9]\d{9}$/.test(String(v).replace(/\D/g, '').slice(-10)),
  pin:    v => /^[1-9]\d{5}$/.test(String(v).trim()),
  name:   v => String(v).trim().length >= 2 && /^[a-zA-Z\u0900-\u097F .'-]+$/.test(String(v).trim()),
  pw:     v => String(v).length >= 6,
  upi:    v => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(String(v).trim()),
  card:   v => /^\d{13,19}$/.test(String(v).replace(/\s/g, '')),
  cvv:    v => /^\d{3,4}$/.test(String(v).trim()),
  expiry: v => {
    const m = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(String(v).trim());
    if (!m) return false;
    const exp = new Date(2000 + +m[2], +m[1], 0, 23, 59, 59);
    return exp > new Date();
  },
  required: v => String(v ?? '').trim().length > 0
};

/** Score a password 0-4 and return a label + colour. */
export function pwStrength(v = '') {
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
  const map = [
    { label: 'Too short', color: '#ef4444', pct: 15 },
    { label: 'Weak',      color: '#f97316', pct: 35 },
    { label: 'Fair',      color: '#f59e0b', pct: 60 },
    { label: 'Good',      color: '#10b981', pct: 82 },
    { label: 'Strong',    color: '#059669', pct: 100 }
  ];
  return map[s];
}

/* ------------------------------- Async ----------------------------------- */
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function debounce(fn, wait = CONFIG.DEBOUNCE_MS) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
}

export function throttle(fn, wait = 200) {
  let last = 0, timer;
  return (...a) => {
    const now = Date.now();
    if (now - last >= wait) { last = now; fn(...a); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...a); }, wait - (now - last)); }
  };
}

/* -------------------------------- Misc ----------------------------------- */
export const uid = (prefix = 'ID') =>
  prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

export const qs = (key, def = null) => new URLSearchParams(location.search).get(key) ?? def;
export const qsAll = () => Object.fromEntries(new URLSearchParams(location.search).entries());

export function setQuery(params, replace = true) {
  const sp = new URLSearchParams(location.search);
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) sp.delete(k);
    else sp.set(k, Array.isArray(v) ? v.join(',') : v);
  });
  const next = location.pathname + (sp.toString() ? '?' + sp : '');
  history[replace ? 'replaceState' : 'pushState'](null, '', next);
}

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
export const range = n => Array.from({ length: n }, (_, i) => i);
export const unique = arr => [...new Set(arr)];
export const groupBy = (arr, key) => arr.reduce((a, x) => {
  const k = typeof key === 'function' ? key(x) : x[key];
  (a[k] = a[k] || []).push(x); return a;
}, {});
export const sum = (arr, fn = x => x) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
export const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

/** Deterministic pseudo-random from a string — keeps demo data stable. */
export function hashCode(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0;
  return Math.abs(h);
}

export const copyText = async text => {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { 
    const ta = el('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
};

export const imgFallback = e => {
  const img = e.target || e;
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = '1';
  img.src = url('assets/img/misc/placeholder.svg');
};

/** Star markup for a numeric rating. */
export function starsHTML(rating = 0, size = 15) {
  const r = Math.round(Number(rating) * 2) / 2;
  let out = `<span class="stars" style="--s:${size}px" aria-label="${r} out of 5 stars">`;
  for (let i = 1; i <= 5; i++) {
    const cls = i <= r ? '' : (i - .5 === r ? 'half' : 'off');
    out += `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }
  return out + '</span>';
}

/** Percentage discount between mrp and price. */
export const offPct = (mrp, price) => (!mrp || mrp <= price) ? 0 : Math.round((1 - price / mrp) * 100);

/** Intersection-observer driven scroll reveal. */
export function observeReveal(root = document) {
  const items = $$('.reveal:not(.visible)', root);
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('visible')); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: .05 });
  items.forEach(i => io.observe(i));
}

/** Native-ish share with clipboard fallback. */
export async function shareLink({ title, text, url: link }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url: link }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  return (await copyText(link)) ? 'copied' : 'failed';
}

export const isMobile = () => window.matchMedia('(max-width:767px)').matches;
export const isTablet = () => window.matchMedia('(min-width:768px) and (max-width:1199px)').matches;
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
