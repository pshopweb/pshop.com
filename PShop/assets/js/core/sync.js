/* ==========================================================================
   PShop — Server sync layer
   Cart, Wishlist aur Addresses ko Google Sheet ke saath sync karta hai.

   Kaise kaam karta hai:
   • localStorage hamesha "fast local cache" ki tarah use hota hai — UI turant
     update hota hai (optimistic update), user ko wait nahi karna padta.
   • Agar user logged in hai AUR backend configured hai, to har change
     background me Sheet par push ho jata hai.
   • Login karte hi server ka data pull hota hai aur guest cart usme merge
     ho jata hai (taaki logout state ka saamaan kho na jaye).
   • Backend band ho to sab kuch localStorage par chalta rehta hai.
   ========================================================================== */
import { CONFIG } from './config.js';
import { Store } from './storage.js';
import { API, isLiveBackend } from './api.js';
import { Auth } from './auth.js';

/** Sync tabhi hoga jab user logged in ho aur live backend ho. */
export const canSync = () => Auth.isLoggedIn() && isLiveBackend();

/* -------------------- background queue (retry ke saath) ------------------- */
const queue = [];
let flushing = false;

/**
 * Ek server operation ko queue me daalta hai. UI block nahi hota.
 * @param {string} label debugging ke liye
 * @param {Function} fn  async function jo API call kare
 */
export function enqueue(label, fn) {
  if (!canSync()) return;
  queue.push({ label, fn, tries: 0 });
  flush();
}

async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;

  while (queue.length) {
    const job = queue[0];
    try {
      const res = await job.fn();
      // Server ne fail bola to retry ka fayda nahi — aage badho.
      if (res && res.success === false) {
        console.warn(`[PShop sync] ${job.label}: ${res.message}`);
      }
      queue.shift();
    } catch (err) {
      job.tries++;
      if (job.tries >= 3) {
        console.warn(`[PShop sync] ${job.label} failed after 3 tries:`, err.message);
        queue.shift();
      } else {
        // Network wapas aane ka intezaar — exponential backoff.
        await new Promise(r => setTimeout(r, 400 * job.tries));
      }
    }
  }

  flushing = false;
  setSyncState('idle');
}

/* ------------------------------ sync badge -------------------------------- */
let syncState = 'idle';
export function setSyncState(state) {
  syncState = state;
  window.dispatchEvent(new CustomEvent('pshop:sync', { detail: { state } }));
}
export const getSyncState = () => syncState;

/* ============================== CART SYNC ================================= */

/** Server ka cart local format me badalta hai. */
function serverCartToLocal(rows) {
  return (rows || []).map(r => ({
    key: r.variant ? `${r.productId}::${r.variant}` : r.productId,
    lineId: r.id,                       // server row id — update/remove ke liye
    id: r.productId,
    name: r.name, brand: r.brand,
    price: Number(r.price) || 0,
    mrp: Number(r.mrp) || 0,
    image: r.image, slug: r.slug,
    variant: r.variant || null,
    qty: Number(r.qty) || 1,
    stock: Number(r.stock) || 0,
    codAvailable: r.codAvailable !== false && r.codAvailable !== 'FALSE',
    addedAt: r.addedAt
  }));
}

/** Server se cart laakar local cache me daal deta hai. */
export async function pullCart() {
  if (!canSync()) return null;
  setSyncState('syncing');
  const res = await API.getCart({});
  if (!res.success) { setSyncState('idle'); return null; }
  const items = serverCartToLocal(res.data.items);
  Store.set(CONFIG.KEYS.CART, items);
  window.dispatchEvent(new CustomEvent('pshop:cart', { detail: { items } }));
  setSyncState('idle');
  return items;
}

/**
 * Server ke cart rows se local cache me lineId bhar deta hai.
 * addCart ke turant baad chalta hai taaki qty-update/remove ko pata ho
 * ki Sheet me kaunsi row badalni hai.
 */
export function syncCartIds(serverRows) {
  const local = Store.get(CONFIG.KEYS.CART, []);
  if (!local.length) return;
  const byKey = new Map();
  (serverRows || []).forEach(r => {
    const key = r.variant ? `${r.productId}::${r.variant}` : r.productId;
    byKey.set(key, r);
  });
  let changed = false;
  local.forEach(item => {
    const row = byKey.get(item.key);
    if (row && item.lineId !== row.id) { item.lineId = row.id; changed = true; }
  });
  if (changed) Store.set(CONFIG.KEYS.CART, local);
}

/**
 * Login ke baad guest cart ko server cart me merge karta hai.
 * Guest ne jo add kiya tha wo kabhi kho na jaye.
 */
export async function mergeGuestCart() {
  if (!canSync()) return;
  const local = Store.get(CONFIG.KEYS.CART, []);
  const guestItems = local.filter(i => !i.lineId);   // jo abhi server par nahi gaye

  setSyncState('syncing');
  for (const item of guestItems) {
    await API.addCart({ productId: item.id, qty: item.qty, variant: item.variant || '' });
  }
  await pullCart();
}

/* ============================ WISHLIST SYNC =============================== */

function serverWishToLocal(rows) {
  return (rows || []).map(r => ({
    id: r.productId, wishId: r.id,
    name: r.name, brand: r.brand,
    price: Number(r.price) || 0, mrp: Number(r.mrp) || 0,
    image: r.image, slug: r.slug,
    rating: Number(r.rating) || 0, discount: Number(r.discount) || 0,
    addedAt: r.addedAt
  }));
}

export async function pullWishlist() {
  if (!canSync()) return null;
  const res = await API.getWishlist({});
  if (!res.success) return null;
  const items = serverWishToLocal(res.data.items);
  Store.set(CONFIG.KEYS.WISHLIST, items);
  window.dispatchEvent(new CustomEvent('pshop:wishlist', { detail: { items } }));
  return items;
}

export async function mergeGuestWishlist() {
  if (!canSync()) return;
  const local = Store.get(CONFIG.KEYS.WISHLIST, []);
  const guestItems = local.filter(i => !i.wishId);
  for (const item of guestItems) {
    await API.addWishlist({ productId: item.id });
  }
  await pullWishlist();
}

/* ============================ ADDRESS SYNC ================================ */

export async function pullAddresses() {
  if (!canSync()) return null;
  const res = await API.getAddresses({});
  if (!res.success) return null;
  Store.set(CONFIG.KEYS.ADDRESS, res.data.items || []);
  window.dispatchEvent(new CustomEvent('pshop:address', { detail: { list: res.data.items } }));
  return res.data.items;
}

export async function pushAddress(address) {
  if (!canSync()) return null;
  const res = await API.saveAddress({ address });
  if (res.success) {
    Store.set(CONFIG.KEYS.ADDRESS, res.data.items);
    window.dispatchEvent(new CustomEvent('pshop:address', { detail: { list: res.data.items } }));
  }
  return res;
}

export async function removeAddressRemote(addressId) {
  if (!canSync()) return null;
  const res = await API.deleteAddress({ addressId });
  if (res.success) {
    Store.set(CONFIG.KEYS.ADDRESS, res.data.items);
    window.dispatchEvent(new CustomEvent('pshop:address', { detail: { list: res.data.items } }));
  }
  return res;
}

/* ============================ FULL SYNC =================================== */

/**
 * Login ke turant baad chalta hai: guest data merge + server data pull.
 * app.js isse boot par call karta hai.
 */
export async function syncOnLogin() {
  if (!canSync()) return;
  setSyncState('syncing');
  try {
    await mergeGuestCart();
    await mergeGuestWishlist();
    await pullAddresses();
  } catch (err) {
    console.warn('[PShop sync] login sync failed:', err.message);
  }
  setSyncState('idle');
}

/**
 * Page load par server se fresh data laata hai (merge ke bina).
 * Isse dusre device par kiye gaye changes bhi dikh jate hain.
 */
export async function syncOnLoad() {
  if (!canSync()) return;
  try {
    await Promise.all([pullCart(), pullWishlist(), pullAddresses()]);
  } catch (err) {
    console.warn('[PShop sync] load sync failed:', err.message);
  }
}

/** Logout par server ka cached data hata do (guest ka apna cart shuru ho). */
export function clearSyncedData() {
  [CONFIG.KEYS.CART, CONFIG.KEYS.WISHLIST, CONFIG.KEYS.ADDRESS].forEach(k => Store.remove(k));
}
