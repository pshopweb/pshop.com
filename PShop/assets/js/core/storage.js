/* ==========================================================================
   PShop — safe localStorage wrapper with JSON + namespace + change events
   ========================================================================== */
const memory = new Map();               // fallback when storage is blocked
let available = true;
try {
  const k = '__pshop_test__';
  localStorage.setItem(k, '1');
  localStorage.removeItem(k);
} catch { available = false; }

const raw = {
  get(key) { return available ? localStorage.getItem(key) : (memory.get(key) ?? null); },
  set(key, val) { available ? localStorage.setItem(key, val) : memory.set(key, val); },
  del(key) { available ? localStorage.removeItem(key) : memory.delete(key); }
};

export const Store = {
  /** Read and JSON-parse a key. */
  get(key, fallback = null) {
    try {
      const v = raw.get(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },

  /** Serialise and persist a key, then broadcast a change event. */
  set(key, value) {
    try { raw.set(key, JSON.stringify(value)); }
    catch (e) { console.warn('[PShop] storage write failed', key, e); return false; }
    window.dispatchEvent(new CustomEvent('pshop:store', { detail: { key, value } }));
    return true;
  },

  remove(key) {
    raw.del(key);
    window.dispatchEvent(new CustomEvent('pshop:store', { detail: { key, value: null } }));
  },

  /** Update an object/array value with a producer function. */
  update(key, fn, fallback = null) {
    const next = fn(this.get(key, fallback));
    this.set(key, next);
    return next;
  },

  has(key) { return raw.get(key) !== null; },

  /** Remove every pshop_* key (used by logout / reset). */
  clearAll(except = []) {
    const keys = available ? Object.keys(localStorage) : [...memory.keys()];
    keys.filter(k => k.startsWith('pshop_') && !except.includes(k)).forEach(k => raw.del(k));
    window.dispatchEvent(new CustomEvent('pshop:store', { detail: { key: '*', value: null } }));
  },

  /** Subscribe to changes for one key (also fires for other tabs). */
  onChange(key, handler) {
    const local = e => { if (e.detail.key === key || e.detail.key === '*') handler(this.get(key)); };
    const cross = e => { if (e.key === key) handler(this.get(key)); };
    window.addEventListener('pshop:store', local);
    window.addEventListener('storage', cross);
    return () => {
      window.removeEventListener('pshop:store', local);
      window.removeEventListener('storage', cross);
    };
  },

  /** Approximate bytes used by the app. */
  usage() {
    if (!available) return 0;
    return Object.keys(localStorage)
      .filter(k => k.startsWith('pshop_'))
      .reduce((a, k) => a + k.length + (localStorage.getItem(k) || '').length, 0);
  }
};

/** Session-scoped store (cleared when the tab closes). */
export const Session = {
  get(key, fallback = null) {
    try { const v = sessionStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ } },
  remove(key) { try { sessionStorage.removeItem(key); } catch { /* noop */ } }
};
