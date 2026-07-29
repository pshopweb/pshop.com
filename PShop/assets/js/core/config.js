/* ==========================================================================
   PShop — global configuration
   Set API_BASE_URL to your deployed Google Apps Script Web App URL.
   While it is empty (or unreachable) the app transparently falls back to the
   local mock backend so the site is fully functional offline.
   ========================================================================== */
export const CONFIG = Object.freeze({
  APP_NAME: 'PShop',
  TAGLINE: 'India\u2019s friendliest marketplace',
  VERSION: '1.0.0',

  /* ======================================================================
     ⬇⬇⬇  YAHAN APNA GOOGLE APPS SCRIPT URL PASTE KAREIN  ⬇⬇⬇
     ----------------------------------------------------------------------
     Apps Script me:  Deploy → New deployment → Web app → Deploy
     Jo URL milega wo aisa hoga (hamesha /exec par khatam):

       https://script.google.com/macros/s/AKfycbx........................./exec

     Bas neeche quotes ke andar paste kar dein. Bas itna hi kaam hai.
     ====================================================================== */
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycbxoXbHd5wLLpSF0GppqGpqLVyU2yv547Lu4knDFNJbxgnwXuvTsOck8lsxIk7aWLONV/exec',
  /* ⬆⬆⬆  Khaali chhoda to website demo data par chalegi (kuch tootega nahi) ⬆⬆⬆ */

  API_TIMEOUT: 15000,
  // true = backend band/slow ho to site demo data par chalti rahegi
  USE_MOCK_FALLBACK: true,

  /* ---- Commerce -------------------------------------------------------- */
  CURRENCY: '\u20B9',
  CURRENCY_CODE: 'INR',
  FREE_SHIP_ABOVE: 499,
  SHIPPING_FEE: 79,
  EXPRESS_FEE: 129,
  TAX_RATE: 0.18,           // GST shown as inclusive breakdown
  COD_FEE: 29,
  MAX_QTY_PER_ITEM: 10,
  MAX_COMPARE: 4,

  /* ---- UX -------------------------------------------------------------- */
  PAGE_SIZE: 12,
  TOAST_DURATION: 3200,
  OTP_LENGTH: 6,
  OTP_TTL_SECONDS: 300,
  RECENT_LIMIT: 12,
  SEARCH_HISTORY_LIMIT: 8,
  DEBOUNCE_MS: 260,

  /* ---- Storage keys ---------------------------------------------------- */
  KEYS: {
    TOKEN:    'pshop_token',
    USER:     'pshop_user',
    CART:     'pshop_cart',
    WISHLIST: 'pshop_wishlist',
    COMPARE:  'pshop_compare',
    RECENT:   'pshop_recent',
    ORDERS:   'pshop_orders',
    ADDRESS:  'pshop_addresses',
    THEME:    'pshop_theme',
    SETTINGS: 'pshop_settings',
    SEARCHES: 'pshop_searches',
    NOTIFS:   'pshop_notifications',
    MSGS:     'pshop_messages',
    COUPON:   'pshop_coupon',
    OTP:      'pshop_otp_session',
    USERS_DB: 'pshop_users_db',
    CHECKOUT: 'pshop_checkout'
  },

  /* ---- Order lifecycle ------------------------------------------------- */
  ORDER_STAGES: ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'],

  PAYMENT_METHODS: [
    { id: 'cod',      label: 'Cash on Delivery', icon: 'assets/img/icons/pay-cod.svg',      desc: 'Pay when the order arrives' },
    { id: 'upi',      label: 'UPI',              icon: 'assets/img/icons/pay-upi.svg',      desc: 'GPay, PhonePe, Paytm & more' },
    { id: 'razorpay', label: 'Card / Netbanking', icon: 'assets/img/icons/pay-razorpay.svg', desc: 'Secured by Razorpay' }
  ],

  CANCEL_REASONS: ['Ordered by mistake', 'Found a better price', 'Delivery takes too long',
                   'Changed my mind', 'Duplicate order', 'Other'],
  RETURN_REASONS: ['Damaged product', 'Wrong item delivered', 'Missing parts or accessories',
                   'Not as described', 'Quality not satisfactory', 'Size or fit issue', 'Other'],

  ADMIN_EMAIL: 'admin@pshop.in',
  SUPPORT_EMAIL: 'care@pshop.in',
  SUPPORT_PHONE: '1800 209 7746'
});

/** Resolve a path relative to site root regardless of current folder depth. */
export const ROOT = (() => {
  const p = window.location.pathname;
  const inSub = /\/(pages|admin)\//.test(p);
  return inSub ? '../' : './';
})();

/** Build a root-relative URL. */
export const url = (path = '') => ROOT + String(path).replace(/^\.?\//, '');
