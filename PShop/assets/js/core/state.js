/* ==========================================================================
   PShop — client state: cart, wishlist, compare, recently-viewed, addresses
   Every mutation persists to localStorage and emits an event so the header
   badges and any open page re-render instantly.
   ========================================================================== */
import { CONFIG } from './config.js';
import { Store } from './storage.js';
import { clamp, uid, sum } from './utils.js';

const emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(name, { detail }));

/* --------------------------------------------------------------------------
   Server sync bridge
   sync.js ko lazily import karte hain (circular dependency se bachne ke liye).
   Logged-in + live backend hone par har mutation background me Sheet par
   chala jata hai. Guest ke liye sirf localStorage — kuch nahi badalta.
   -------------------------------------------------------------------------- */
let _sync = null;
const sync = async () => (_sync ||= await import('./sync.js'));

/** Server call ko background me bhejta hai — UI kabhi block nahi hota. */
function push(label, fn) {
  sync().then(m => { if (m.canSync()) m.enqueue(label, fn); }).catch(() => {});
}


/* --------------------------------- Cart ---------------------------------- */
export const Cart = {
  all() { return Store.get(CONFIG.KEYS.CART, []); },
  save(items) { Store.set(CONFIG.KEYS.CART, items); emit('pshop:cart', { items }); return items; },
  count() { return sum(this.all(), i => i.qty); },
  lines() { return this.all().length; },
  has(id) { return this.all().some(i => i.id === id); },
  /** Look up a line by its variant key first, falling back to product id. */
  get(keyOrId) {
    const items = this.all();
    return items.find(i => i.key === keyOrId) || items.find(i => i.id === keyOrId) || null;
  },

  /** Add a product (or bump qty when already present). */
  add(product, qty = 1, variant = null) {
    const items = this.all();
    const key = variant ? `${product.id}::${variant}` : product.id;
    const existing = items.find(i => i.key === key);
    const max = Math.min(CONFIG.MAX_QTY_PER_ITEM, product.stock || CONFIG.MAX_QTY_PER_ITEM);
    if (existing) {
      existing.qty = clamp(existing.qty + qty, 1, max);
    } else {
      items.push({
        key, id: product.id, name: product.name, brand: product.brand,
        price: product.flashPrice || product.price, mrp: product.mrp,
        image: product.thumb || product.images?.[0] || '',
        slug: product.slug, variant, qty: clamp(qty, 1, max),
        stock: product.stock, category: product.category,
        codAvailable: product.codAvailable !== false,
        addedAt: new Date().toISOString()
      });
    }
    // Server par bhi add karo, phir server ka lineId local cache me daal do
    // taaki baad me qty update / remove sahi row par lage.
    push('cart.add', async () => {
      const { api } = await import('./api.js');
      const res = await api('addCart', { productId: product.id, qty, variant: variant || '' });
      if (res.success && Array.isArray(res.data?.items)) {
        const { syncCartIds } = await import('./sync.js');
        syncCartIds(res.data.items);
      }
      return res;
    });
    return this.save(items);
  },

  setQty(key, qty) {
    const items = this.all();
    const line = items.find(i => i.key === key);
    if (!line) return items;
    const max = Math.min(CONFIG.MAX_QTY_PER_ITEM, line.stock || CONFIG.MAX_QTY_PER_ITEM);
    line.qty = clamp(qty, 1, max);
    if (line.lineId) {
      push('cart.updateQty', async () =>
        (await import('./api.js')).api('updateCart', { lineId: line.lineId, qty: line.qty }));
    }
    return this.save(items);
  },

  remove(key) {
    const line = this.get(key);
    if (line?.lineId) {
      push('cart.remove', async () =>
        (await import('./api.js')).api('removeCart', { lineId: line.lineId }));
    }
    return this.save(this.all().filter(i => i.key !== key));
  },

  clear() {
    push('cart.clear', async () => (await import('./api.js')).api('clearCart', {}));
    return this.save([]);
  },

  /** Money maths shared by cart, checkout and payment pages. */
  totals(coupon = null, shippingMode = 'standard') {
    const items = this.all();
    const subtotal = sum(items, i => i.price * i.qty);
    const mrpTotal = sum(items, i => (i.mrp || i.price) * i.qty);
    const savings  = Math.max(0, mrpTotal - subtotal);
    let discount = 0, freeShip = false;
    if (coupon) {
      if (coupon.type === 'percent')  discount = Math.min(Math.round(subtotal * coupon.value / 100), coupon.maxDiscount || Infinity);
      else if (coupon.type === 'flat') discount = Math.min(coupon.value, subtotal);
      else if (coupon.type === 'shipping') freeShip = true;
    }
    const taxable = Math.max(0, subtotal - discount);
    let shipping = 0;
    if (taxable > 0) {
      shipping = shippingMode === 'express' ? CONFIG.EXPRESS_FEE
               : (taxable >= CONFIG.FREE_SHIP_ABOVE ? 0 : CONFIG.SHIPPING_FEE);
      if (freeShip && shippingMode !== 'express') shipping = 0;
    }
    // Listed prices are GST-inclusive; the tax line is informational.
    const tax = Math.round(taxable - taxable / (1 + CONFIG.TAX_RATE));
    const total = taxable + shipping;
    return {
      count: sum(items, i => i.qty), lines: items.length,
      subtotal, mrpTotal, savings, discount, shipping, tax, total,
      freeShipEligible: taxable >= CONFIG.FREE_SHIP_ABOVE,
      amountToFreeShip: Math.max(0, CONFIG.FREE_SHIP_ABOVE - taxable),
      couponCode: coupon?.code || null
    };
  },

  /** Cart is COD-eligible only when every line supports it. */
  codEligible() { return this.all().every(i => i.codAvailable !== false); },

  /** COD block karne wale items ke naam — user ko batane ke liye. */
  codBlockedItems() {
    return this.all().filter(i => i.codAvailable === false).map(i => i.name);
  }
};

/* ------------------------------- Wishlist -------------------------------- */
export const Wishlist = {
  all() { return Store.get(CONFIG.KEYS.WISHLIST, []); },
  save(items) { Store.set(CONFIG.KEYS.WISHLIST, items); emit('pshop:wishlist', { items }); return items; },
  count() { return this.all().length; },
  has(id) { return this.all().some(i => i.id === id); },
  add(product) {
    if (this.has(product.id)) return this.all();
    const items = this.all();
    items.unshift({
      id: product.id, name: product.name, brand: product.brand, price: product.price,
      mrp: product.mrp, image: product.thumb || product.images?.[0] || '', slug: product.slug,
      rating: product.rating, stock: product.stock, discount: product.discount,
      addedAt: new Date().toISOString()
    });
    push('wishlist.add', async () =>
      (await import('./api.js')).api('addWishlist', { productId: product.id }));
    return this.save(items);
  },
  remove(id) {
    push('wishlist.remove', async () =>
      (await import('./api.js')).api('removeWishlist', { productId: id }));
    return this.save(this.all().filter(i => i.id !== id));
  },
  /** @returns {boolean} true when the product is now in the wishlist. */
  toggle(product) {
    if (this.has(product.id)) { this.remove(product.id); return false; }
    this.add(product); return true;
  },
  clear() { return this.save([]); }
};

/* -------------------------------- Compare -------------------------------- */
export const Compare = {
  all() { return Store.get(CONFIG.KEYS.COMPARE, []); },
  save(ids) { Store.set(CONFIG.KEYS.COMPARE, ids); emit('pshop:compare', { ids }); return ids; },
  count() { return this.all().length; },
  has(id) { return this.all().includes(id); },
  /** @returns {{added:boolean,full:boolean}} */
  toggle(id) {
    const ids = this.all();
    if (ids.includes(id)) { this.save(ids.filter(x => x !== id)); return { added: false, full: false }; }
    if (ids.length >= CONFIG.MAX_COMPARE) return { added: false, full: true };
    this.save([...ids, id]);
    return { added: true, full: false };
  },
  remove(id) { return this.save(this.all().filter(x => x !== id)); },
  clear() { return this.save([]); }
};

/* --------------------------- Recently viewed ----------------------------- */
export const Recent = {
  all() { return Store.get(CONFIG.KEYS.RECENT, []); },
  push(product) {
    if (!product?.id) return;
    const items = this.all().filter(i => i.id !== product.id);
    items.unshift({
      id: product.id, name: product.name, price: product.price, mrp: product.mrp,
      image: product.thumb || product.images?.[0] || '', slug: product.slug,
      rating: product.rating, brand: product.brand, at: Date.now()
    });
    Store.set(CONFIG.KEYS.RECENT, items.slice(0, CONFIG.RECENT_LIMIT));
  },
  clear() { Store.remove(CONFIG.KEYS.RECENT); }
};

/* ------------------------------ Addresses -------------------------------- */
export const Addresses = {
  all() { return Store.get(CONFIG.KEYS.ADDRESS, []); },
  save(list) { Store.set(CONFIG.KEYS.ADDRESS, list); emit('pshop:address', { list }); return list; },
  get(id) { return this.all().find(a => a.id === id) || null; },
  default() { return this.all().find(a => a.isDefault) || this.all()[0] || null; },
  add(addr) {
    const list = this.all();
    const rec = { ...addr, id: addr.id || uid('ADR'), createdAt: new Date().toISOString() };
    if (rec.isDefault || !list.length) { list.forEach(a => a.isDefault = false); rec.isDefault = true; }
    list.push(rec);
    push('address.add', async () => (await import('./api.js')).api('saveAddress', { address: rec }));
    return this.save(list);
  },
  update(id, patch) {
    const list = this.all();
    const a = list.find(x => x.id === id);
    if (!a) return list;
    Object.assign(a, patch);
    if (patch.isDefault) list.forEach(x => { if (x.id !== id) x.isDefault = false; });
    push('address.update', async () => (await import('./api.js')).api('saveAddress', { address: a }));
    return this.save(list);
  },
  remove(id) {
    let list = this.all().filter(a => a.id !== id);
    if (list.length && !list.some(a => a.isDefault)) list[0].isDefault = true;
    push('address.remove', async () => (await import('./api.js')).api('deleteAddress', { addressId: id }));
    return this.save(list);
  },
  setDefault(id) {
    const list = this.all();
    list.forEach(a => a.isDefault = a.id === id);
    const target = list.find(a => a.id === id);
    if (target) push('address.default', async () =>
      (await import('./api.js')).api('saveAddress', { address: target }));
    return this.save(list);
  }
};

/* -------------------------- Search history ------------------------------- */
export const SearchHistory = {
  all() { return Store.get(CONFIG.KEYS.SEARCHES, []); },
  push(term) {
    const t = String(term || '').trim();
    if (t.length < 2) return;
    const list = [t, ...this.all().filter(x => x.toLowerCase() !== t.toLowerCase())];
    Store.set(CONFIG.KEYS.SEARCHES, list.slice(0, CONFIG.SEARCH_HISTORY_LIMIT));
  },
  remove(term) {
    Store.set(CONFIG.KEYS.SEARCHES, this.all().filter(x => x !== term));
  },
  clear() { Store.remove(CONFIG.KEYS.SEARCHES); }
};

/* ---------------------------- Notifications ------------------------------ */
export const Notifications = {
  all() { return Store.get(CONFIG.KEYS.NOTIFS, []); },
  unread() { return this.all().filter(n => !n.read).length; },
  markRead(id) {
    const list = this.all();
    const n = list.find(x => x.id === id);
    if (n) { n.read = true; Store.set(CONFIG.KEYS.NOTIFS, list); emit('pshop:notif', {}); }
  },
  markAllRead() {
    const list = this.all().map(n => ({ ...n, read: true }));
    Store.set(CONFIG.KEYS.NOTIFS, list); emit('pshop:notif', {});
  },
  remove(id) {
    Store.set(CONFIG.KEYS.NOTIFS, this.all().filter(n => n.id !== id));
    emit('pshop:notif', {});
  },
  clear() { Store.set(CONFIG.KEYS.NOTIFS, []); emit('pshop:notif', {}); }
};

/* ------------------------------ Settings --------------------------------- */
const DEFAULT_SETTINGS = {
  emailOffers: true, smsAlerts: true, pushOrders: true, newsletter: true,
  language: 'en-IN', currency: 'INR', compactCards: false, saveHistory: true
};
export const Settings = {
  all() { return { ...DEFAULT_SETTINGS, ...Store.get(CONFIG.KEYS.SETTINGS, {}) }; },
  get(key) { return this.all()[key]; },
  set(key, value) {
    const s = this.all(); s[key] = value;
    Store.set(CONFIG.KEYS.SETTINGS, s);
    emit('pshop:settings', { settings: s });
    return s;
  },
  reset() { Store.remove(CONFIG.KEYS.SETTINGS); emit('pshop:settings', { settings: DEFAULT_SETTINGS }); }
};
