/* ==========================================================================
   PShop — API client
   Google Apps Script Web App se baat karta hai.

   Apps Script cross-origin POST par custom headers allow nahi karta (preflight
   trigger ho jata hai), isliye body text/plain me bhejte hain — yahi standard
   GAS pattern hai.

   Features:
   • Auto retry — network glitch par 3 baar koshish (exponential backoff)
   • Request dedupe — ek hi call baar-baar na jaye
   • Smart cache — products/categories jaise data 60s cache hota hai
   • Offline detect — internet jaane par turant pata chal jata hai
   • Graceful fallback — backend down ho to demo data, page kabhi blank nahi
   ========================================================================== */
import { CONFIG } from './config.js';
import { Store } from './storage.js';
import { mockRequest } from './mock-backend.js';

/* ------------------------- connection state ------------------------------ */
const STATE = {
  ONLINE:  'online',    // backend chal raha hai
  OFFLINE: 'offline',   // internet nahi hai
  DOWN:    'down',      // backend jawab nahi de raha
  DEMO:    'demo'       // koi backend configured nahi
};

let connection = CONFIG.API_BASE_URL ? STATE.ONLINE : STATE.DEMO;
let consecutiveFailures = 0;
let recheckTimer = null;

/** Connection state badalne par event bhejta hai (header badge sunta hai). */
function setConnection(next, detail = {}) {
  if (connection === next) return;
  connection = next;
  window.dispatchEvent(new CustomEvent('pshop:connection', {
    detail: { state: next, ...detail }
  }));
}

export const getConnection = () => connection;
export const isLiveBackend = () =>
  Boolean(CONFIG.API_BASE_URL) && connection === STATE.ONLINE;
export const CONNECTION_STATE = STATE;

/* Browser ka online/offline event bhi sunte hain. */
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => setConnection(STATE.OFFLINE));
  window.addEventListener('online', () => {
    consecutiveFailures = 0;
    if (CONFIG.API_BASE_URL) setConnection(STATE.ONLINE);
  });
}

/* ------------------------------- cache ----------------------------------- */
/**
 * Sirf read-only actions cache hote hain. Cart/order jaise actions kabhi nahi.
 * Isse product listing browse karte waqt bar-bar call nahi jati.
 */
const CACHEABLE = {
  getProducts: 60000,
  getProduct: 60000,
  getCategories: 300000,
  getFilters: 120000,
  getBanners: 300000,
  getFaqs: 300000,
  getCoupons: 120000,
  searchProducts: 30000
};

const cache = new Map();
const cacheKey = (action, payload) => action + ':' + JSON.stringify(payload || {});

function readCache(action, payload) {
  const ttl = CACHEABLE[action];
  if (!ttl) return null;
  const hit = cache.get(cacheKey(action, payload));
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    cache.delete(cacheKey(action, payload));
    return null;
  }
  return hit.value;
}

function writeCache(action, payload, value) {
  if (!CACHEABLE[action] || !value?.success) return;
  cache.set(cacheKey(action, payload), { value, at: Date.now() });
  // Cache ko bada na hone do.
  if (cache.size > 60) cache.delete(cache.keys().next().value);
}

/** Data badalne par cache saaf karo (order place, product add wagairah). */
export function clearApiCache() {
  cache.clear();
}

/* --------------------------- in-flight dedupe ---------------------------- */
/** Same request ek saath do jagah se aaye to ek hi network call jaye. */
const inFlight = new Map();

/* ------------------------------ low level -------------------------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Apps Script ko POST karta hai. */
async function post(action, payload, signal) {
  const body = JSON.stringify({
    action,
    payload,
    token: Store.get(CONFIG.KEYS.TOKEN, null)
  });

  const res = await fetch(CONFIG.API_BASE_URL, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    signal
  });

  if (!res.ok) {
    throw new Error(`Server ne HTTP ${res.status} bheja`);
  }

  const text = await res.text();

  // Apps Script galat deploy ho to HTML login page bhej deta hai.
  if (text.trim().startsWith('<')) {
    throw new Error(
      'Backend ne HTML bheja, JSON nahi. Deployment me "Who has access" ' +
      '= Anyone set karein aur naya version deploy karein.'
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Backend ka jawab samajh nahi aaya (invalid JSON)');
  }
}

/** Ek attempt — timeout ke saath. */
async function attempt(action, payload, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await post(action, payload, ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Kya ye error retry karne layak hai? */
function isRetryable(err) {
  const m = String(err?.message || '').toLowerCase();
  // Network glitch, timeout, ya server ka 5xx — ye dobara try karne layak hain.
  if (err?.name === 'AbortError') return true;
  if (m.includes('failed to fetch') || m.includes('network')) return true;
  if (m.includes('http 5')) return true;
  if (m.includes('load failed')) return true;
  return false;
}

/* -------------------------------- main ----------------------------------- */
/**
 * API action call karta hai.
 * @param {string} action
 * @param {object} payload
 * @param {{timeout?:number, retries?:number, fresh?:boolean}} opts
 *        fresh: true = cache ignore karo
 * @returns {Promise<{success:boolean, data:any, message:string}>}
 */
export async function api(action, payload = {}, opts = {}) {
  const {
    timeout = CONFIG.API_TIMEOUT,
    retries = 2,          // pehli koshish ke alawa 2 aur
    fresh = false
  } = opts;

  // Backend configured hi nahi — seedha demo data.
  if (!CONFIG.API_BASE_URL) {
    return mockRequest(action, payload);
  }

  // Cache
  if (!fresh) {
    const cached = readCache(action, payload);
    if (cached) return cached;
  }

  // Wahi request pehle se ja rahi hai to usi ka result share karo.
  const key = cacheKey(action, payload);
  if (inFlight.has(key)) return inFlight.get(key);

  const task = (async () => {
    let lastError = null;

    for (let tryNo = 0; tryNo <= retries; tryNo++) {
      try {
        const out = await attempt(action, payload, timeout);

        // Kaam ho gaya — connection healthy mark karo.
        consecutiveFailures = 0;
        if (connection !== STATE.ONLINE) setConnection(STATE.ONLINE);

        const result = (out && typeof out.success === 'boolean')
          ? out
          : { success: true, data: out, message: '' };

        writeCache(action, payload, result);
        return result;

      } catch (err) {
        lastError = err;

        // Retry karne layak nahi (jaise galat deployment) — turant ruk jao.
        if (!isRetryable(err)) break;

        // Aakhri koshish thi to aur wait mat karo.
        if (tryNo === retries) break;

        // Exponential backoff: 400ms, 800ms
        await sleep(400 * Math.pow(2, tryNo));
      }
    }

    /* ---- saari koshishein fail ---- */
    consecutiveFailures++;

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setConnection(offline ? STATE.OFFLINE : STATE.DOWN, {
      message: lastError?.message,
      action
    });

    console.warn(
      `[PShop] "${action}" fail hua: ${lastError?.message}`,
      CONFIG.USE_MOCK_FALLBACK ? '→ demo data use kar rahe hain' : ''
    );

    // Thodi der baad dobara live backend try karenge.
    scheduleRecheck();

    if (!CONFIG.USE_MOCK_FALLBACK) {
      return {
        success: false,
        data: null,
        message: offline
          ? 'Internet connection nahi hai. Connect karke dobara try karein.'
          : 'Server se connect nahi ho paya. Thodi der baad try karein.',
        offline
      };
    }

    return mockRequest(action, payload);
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Backend down hone ke baad chup-chaap check karta rehta hai ki wapas aaya ya nahi.
 * Failures badhne par gap bhi badhta hai (15s → 30s → 60s, max 2 min).
 */
function scheduleRecheck() {
  if (recheckTimer || !CONFIG.API_BASE_URL) return;
  const delay = Math.min(15000 * Math.pow(2, consecutiveFailures - 1), 120000);

  recheckTimer = setTimeout(async () => {
    recheckTimer = null;
    try {
      const res = await fetch(CONFIG.API_BASE_URL, { redirect: 'follow' });
      const text = await res.text();
      if (res.ok && !text.trim().startsWith('<')) {
        consecutiveFailures = 0;
        cache.clear();
        setConnection(STATE.ONLINE, { recovered: true });
        return;
      }
    } catch { /* abhi bhi down hai */ }
    scheduleRecheck();
  }, delay);
}

/**
 * Backend abhi zinda hai ya nahi — manually check karta hai.
 * connect-test.html aur settings page isse use karte hain.
 */
export async function pingBackend() {
  if (!CONFIG.API_BASE_URL) {
    return { ok: false, state: STATE.DEMO, message: 'Koi backend URL set nahi hai.' };
  }
  try {
    const res = await fetch(CONFIG.API_BASE_URL, { redirect: 'follow' });
    const text = await res.text();

    if (text.trim().startsWith('<')) {
      return {
        ok: false, state: STATE.DOWN,
        message: 'Backend ne HTML bheja. Deployment access "Anyone" karein.'
      };
    }

    const json = JSON.parse(text);
    consecutiveFailures = 0;
    setConnection(STATE.ONLINE);

    return {
      ok: true, state: STATE.ONLINE, data: json.data,
      sheet: json.data?.spreadsheet,
      rows: Object.values(json.data?.sheets || {})
        .reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0),
      message: 'Backend chal raha hai.'
    };
  } catch (err) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setConnection(offline ? STATE.OFFLINE : STATE.DOWN);
    return {
      ok: false,
      state: offline ? STATE.OFFLINE : STATE.DOWN,
      message: offline ? 'Internet nahi hai.' : err.message
    };
  }
}

/* ---------------------- Typed helpers used by pages ---------------------- */
export const API = {
  /* auth */
  signup:         d => api('signup', d),
  login:          d => api('login', d),
  sendOtp:        d => api('sendOtp', d),
  verifyOtp:      d => api('verifyOtp', d),
  resetPassword:  d => api('resetPassword', d),
  changePassword: d => api('changePassword', d),
  updateProfile:  d => api('updateProfile', d),

  /* catalogue */
  getProducts:    d => api('getProducts', d),
  getProduct:     d => api('getProduct', d),
  searchProducts: d => api('searchProducts', d),
  getCategories:  () => api('getCategories'),
  getBanners:     () => api('getBanners'),
  getFilters:     d => api('getFilters', d),
  getFaqs:        () => api('getFaqs'),
  getCoupons:     () => api('getCoupons'),
  addReview:      d => api('addReview', d),

  /* orders — kabhi cache nahi, hamesha fresh */
  placeOrder:     d => { clearApiCache(); return api('placeOrder', d, { fresh: true }); },
  getOrders:      d => api('getOrders', d, { fresh: true }),
  getOrder:       d => api('getOrder', d, { fresh: true }),
  trackOrder:     d => api('trackOrder', d, { fresh: true }),
  cancelOrder:    d => { clearApiCache(); return api('cancelOrder', d, { fresh: true }); },
  returnOrder:    d => { clearApiCache(); return api('returnOrder', d, { fresh: true }); },

  /* payment */
  savePayment:    d => api('savePayment', d, { fresh: true }),
  verifyCoupon:   d => api('verifyCoupon', d, { fresh: true }),
  checkCod:       d => api('checkCod', d),

  /* engagement */
  getMessages:    () => api('getMessages', {}, { fresh: true }),
  sendMessage:    d => api('sendMessage', d, { fresh: true }),
  getNotifications: () => api('getNotifications', {}, { fresh: true }),
  subscribeNewsletter: d => api('subscribeNewsletter', d, { fresh: true }),
  contact:        d => api('contact', d, { fresh: true }),

  /* upload */
  uploadImage:    d => api('uploadImage', d, { timeout: 60000, retries: 1 }),
  uploadImages:   d => api('uploadImages', d, { timeout: 90000, retries: 0 }),

  /* admin — hamesha taaza data */
  adminStats:       () => api('adminStats', {}, { fresh: true }),
  adminUpdateOrder: d => { clearApiCache(); return api('adminUpdateOrder', d, { fresh: true }); }
};
