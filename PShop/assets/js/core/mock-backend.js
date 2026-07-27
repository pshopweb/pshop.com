/* ==========================================================================
   PShop — Mock backend
   Mirrors every Apps Script endpoint using seed JSON + localStorage so the
   frontend is fully functional without a deployed backend. The API layer
   automatically routes here when CONFIG.API_BASE_URL is empty or fails.
   ========================================================================== */
import { CONFIG, url } from './config.js';
import { Store } from './storage.js';
import { uid, sleep, addDays, hashCode, V } from './utils.js';

/* ---------------------------- seed data ----------------------------------
   Data ab JS modules se aata hai (pehle JSON fetch hoti thi).
   Fayda: website file:// se bhi chalti hai — fetch() ko browser CORS
   block kar deta tha. Ab ek bhi network request nahi lagti.
   -------------------------------------------------------------------------- */
import { PRODUCTS }   from '../../data/products.js';
import { CATEGORIES } from '../../data/categories.js';
import { COUPONS }    from '../../data/coupons.js';
import { BANNERS }    from '../../data/banners.js';
import { REVIEWS }    from '../../data/reviews.js';
import { FAQS }       from '../../data/faqs.js';

const SEED_DATA = {
  products: PRODUCTS,
  categories: CATEGORIES,
  coupons: COUPONS,
  banners: BANNERS,
  reviews: REVIEWS,
  faqs: FAQS
};

/** Seed data deta hai. async isliye rakha hai taaki callers na badlein. */
async function seed(name) {
  const data = SEED_DATA[name];
  if (!data) throw new Error(`Seed "${name}" unavailable`);
  return data;
}

const ok   = (data, message = '') => ({ success: true,  data, message });
const fail = (message, code = 400) => ({ success: false, data: null, message, code });

/* ------------------------------ user store -------------------------------- */
const usersDB = () => Store.get(CONFIG.KEYS.USERS_DB, []);
const saveUsers = list => Store.set(CONFIG.KEYS.USERS_DB, list);
const publicUser = u => u && ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, gender: u.gender || '',
  dob: u.dob || '', avatar: u.avatar || '', role: u.role || 'customer',
  createdAt: u.createdAt, verified: !!u.verified
});
// Lightweight non-cryptographic hash — the real hashing happens in Apps Script.
const hashPw = pw => 'h' + hashCode('pshop$' + pw).toString(36);

function ensureDemoAccounts() {
  const list = usersDB();
  if (list.length) return list;
  const demo = [
    { id: 'U0001', name: 'Demo Customer', email: 'demo@pshop.in', phone: '9876543210',
      password: hashPw('demo123'), role: 'customer', verified: true,
      createdAt: '2026-01-12T09:00:00Z', avatar: '', gender: 'Male', dob: '1996-04-18' },
    { id: 'U0002', name: 'PShop Admin', email: CONFIG.ADMIN_EMAIL, phone: '9000000001',
      password: hashPw('admin123'), role: 'admin', verified: true,
      createdAt: '2026-01-01T09:00:00Z', avatar: '', gender: '', dob: '' }
  ];
  saveUsers(demo);
  return demo;
}

/* ------------------------------ order store ------------------------------- */
const ordersDB  = () => Store.get(CONFIG.KEYS.ORDERS, []);
const saveOrders = list => Store.set(CONFIG.KEYS.ORDERS, list);

function buildTimeline(status, placedAt) {
  const stages = CONFIG.ORDER_STAGES;
  const idx = stages.indexOf(status);
  const base = new Date(placedAt);
  return stages.map((s, i) => ({
    stage: s,
    done: idx >= 0 && i <= idx,
    at: i <= idx ? addDays(base, i).toISOString() : null,
    note: [
      'Your order has been placed successfully.',
      'Seller confirmed the order.',
      'Item packed at the fulfilment centre.',
      'Shipped via PShop Express.',
      'Arriving today — keep your phone handy.',
      'Delivered. Thank you for shopping with PShop!'
    ][i]
  }));
}

/* ------------------------------- routing ---------------------------------- */
const handlers = {
  /* ------------------------------- AUTH --------------------------------- */
  async signup({ name, email, phone, password }) {
    if (!V.name(name))   return fail('Please enter a valid full name.');
    if (!V.email(email)) return fail('Please enter a valid email address.');
    if (!V.phone(phone)) return fail('Please enter a valid 10-digit mobile number.');
    if (!V.pw(password)) return fail('Password must be at least 6 characters.');
    const list = ensureDemoAccounts();
    if (list.some(u => u.email.toLowerCase() === email.toLowerCase()))
      return fail('An account with this email already exists.');
    if (list.some(u => u.phone === phone))
      return fail('This mobile number is already registered.');
    const user = {
      id: uid('U'), name: name.trim(), email: email.trim().toLowerCase(), phone,
      password: hashPw(password), role: 'customer', verified: false,
      createdAt: new Date().toISOString(), avatar: '', gender: '', dob: ''
    };
    list.push(user); saveUsers(list);
    return ok({ user: publicUser(user), token: 'mock.' + user.id }, 'Account created successfully.');
  },

  async login({ identifier, password }) {
    const list = ensureDemoAccounts();
    const id = String(identifier || '').trim().toLowerCase();
    const user = list.find(u => u.email.toLowerCase() === id || u.phone === id);
    if (!user) return fail('No account found with those details.', 404);
    if (user.password !== hashPw(password)) return fail('Incorrect password. Please try again.', 401);
    return ok({ user: publicUser(user), token: 'mock.' + user.id }, `Welcome back, ${user.name.split(' ')[0]}!`);
  },

  async sendOtp({ identifier, purpose = 'login' }) {
    const list = ensureDemoAccounts();
    const id = String(identifier || '').trim().toLowerCase();
    const isEmail = V.email(id), isPhone = V.phone(id);
    if (!isEmail && !isPhone) return fail('Enter a valid email or 10-digit mobile number.');
    const user = list.find(u => u.email.toLowerCase() === id || u.phone === id);
    if (purpose !== 'signup' && !user) return fail('No account is linked to those details.', 404);
    // Deterministic demo OTP so the flow is testable without SMS/e-mail.
    const code = String(100000 + (hashCode(id + purpose) % 900000));
    Store.set(CONFIG.KEYS.OTP, {
      identifier: id, code, purpose,
      expires: Date.now() + CONFIG.OTP_TTL_SECONDS * 1000, attempts: 0
    });
    const sentVia = isPhone ? 'SMS' : 'email';
    const maskedTarget = maskId(id);
    return ok({ 
      sentTo: isEmail ? 'email' : 'mobile', 
      masked: maskedTarget, 
      demoCode: code,
      message: isPhone 
        ? `OTP sent via SMS to ${maskedTarget}. Check your messages.` 
        : `OTP sent to your email ${maskedTarget}.`
    }, `OTP sent via ${sentVia} to ${maskedTarget}.`);
  },

  async verifyOtp({ code }) {
    const s = Store.get(CONFIG.KEYS.OTP);
    if (!s) return fail('No OTP request found. Please request a new code.');
    if (Date.now() > s.expires) { Store.remove(CONFIG.KEYS.OTP); return fail('This OTP has expired. Request a new one.'); }
    if (s.attempts >= 5) { Store.remove(CONFIG.KEYS.OTP); return fail('Too many incorrect attempts. Request a new OTP.'); }
    if (String(code).trim() !== s.code) {
      s.attempts++; Store.set(CONFIG.KEYS.OTP, s);
      return fail(`Incorrect OTP. ${5 - s.attempts} attempt(s) left.`);
    }
    Store.remove(CONFIG.KEYS.OTP);
    const list = ensureDemoAccounts();
    const user = list.find(u => u.email.toLowerCase() === s.identifier || u.phone === s.identifier);
    if (user) { user.verified = true; saveUsers(list); }
    return ok({
      verified: true, purpose: s.purpose, identifier: s.identifier,
      user: user ? publicUser(user) : null,
      token: user ? 'mock.' + user.id : null
    }, 'Verification successful.');
  },

  async resetPassword({ identifier, password }) {
    if (!V.pw(password)) return fail('Password must be at least 6 characters.');
    const list = ensureDemoAccounts();
    const id = String(identifier || '').trim().toLowerCase();
    const user = list.find(u => u.email.toLowerCase() === id || u.phone === id);
    if (!user) return fail('Account not found.', 404);
    user.password = hashPw(password); saveUsers(list);
    return ok({ reset: true }, 'Password updated. Please sign in.');
  },

  async updateProfile({ userId, patch }) {
    const list = ensureDemoAccounts();
    const user = list.find(u => u.id === userId);
    if (!user) return fail('Account not found.', 404);
    ['name', 'email', 'phone', 'gender', 'dob', 'avatar'].forEach(k => {
      if (patch[k] !== undefined) user[k] = patch[k];
    });
    saveUsers(list);
    return ok({ user: publicUser(user) }, 'Profile updated.');
  },

  async changePassword({ userId, current, next }) {
    const list = ensureDemoAccounts();
    const user = list.find(u => u.id === userId);
    if (!user) return fail('Account not found.', 404);
    if (user.password !== hashPw(current)) return fail('Your current password is incorrect.');
    if (!V.pw(next)) return fail('New password must be at least 6 characters.');
    user.password = hashPw(next); saveUsers(list);
    return ok({ changed: true }, 'Password changed successfully.');
  },

  /* ----------------------------- CATALOGUE ------------------------------ */
  async getProducts(params = {}) {
    let items = await seed('products');
    items = filterProducts(items, params);
    items = sortProducts(items, params.sort);
    const page = Math.max(1, +params.page || 1);
    const size = +params.pageSize || CONFIG.PAGE_SIZE;
    const total = items.length;
    return ok({
      items: params.all ? items : items.slice((page - 1) * size, page * size),
      total, page, pageSize: size, pages: Math.max(1, Math.ceil(total / size))
    });
  },

  async getProduct({ id, slug }) {
    const items = await seed('products');
    const p = items.find(x => x.id === id || x.slug === slug);
    if (!p) return fail('Product not found.', 404);
    const related = items
      .filter(x => x.categoryId === p.categoryId && x.id !== p.id)
      .sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price))
      .slice(0, 10);
    const reviews = (await seed('reviews')).filter(r => r.productId === p.id);
    return ok({ product: p, related, reviews: [...reviews, ...localReviews(p.id)] });
  },

  async searchProducts({ q = '', limit = 8 }) {
    const items = await seed('products');
    const term = q.trim().toLowerCase();
    if (!term) return ok({ items: [], suggestions: [] });
    const scored = items.map(p => ({ p, s: score(p, term) })).filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s);
    const cats = await seed('categories');
    const suggestions = [
      ...cats.filter(c => c.name.toLowerCase().includes(term))
        .map(c => ({ type: 'category', label: c.name, slug: c.slug })),
      ...[...new Set(scored.slice(0, 30).map(x => x.p.brand))]
        .filter(b => b.toLowerCase().includes(term)).slice(0, 3)
        .map(b => ({ type: 'brand', label: b })),
      ...[...new Set(scored.slice(0, 30).map(x => x.p.subCategory))].slice(0, 3)
        .map(s => ({ type: 'term', label: s }))
    ].slice(0, 6);
    return ok({ items: scored.slice(0, limit).map(x => x.p), total: scored.length, suggestions });
  },

  async getCategories() { return ok({ items: await seed('categories') }); },
  async getBanners()    { return ok({ items: await seed('banners') }); },
  async getFaqs()       { return ok({ items: await seed('faqs') }); },
  async getCoupons()    { return ok({ items: await seed('coupons') }); },

  async getFilters({ category } = {}) {
    const items = await seed('products');
    const scoped = category ? items.filter(p => p.categorySlug === category) : items;
    const brands = countBy(scoped, 'brand');
    const subs   = countBy(scoped, 'subCategory');
    const cats   = countBy(scoped, 'category');
    const prices = scoped.map(p => p.price);
    return ok({
      brands, subCategories: subs, categories: cats,
      min: Math.min(...prices, 0), max: Math.max(...prices, 0),
      ratings: [4, 3, 2, 1].map(r => ({ value: r, count: scoped.filter(p => p.rating >= r).length }))
    });
  },

  /* ------------------------------ REVIEWS ------------------------------- */
  async addReview({ productId, user, rating, title, comment }) {
    if (!rating) return fail('Please select a star rating.');
    if (!comment || comment.trim().length < 10) return fail('Please write at least 10 characters.');
    const key = 'pshop_reviews_local';
    const list = Store.get(key, []);
    const review = {
      id: uid('R'), productId, user: user || 'PShop Customer', rating: +rating,
      title: title || 'My review', comment: comment.trim(),
      date: new Date().toISOString().slice(0, 10), verified: true, helpful: 0, status: 'approved'
    };
    list.unshift(review); Store.set(key, list);
    return ok({ review }, 'Thanks! Your review is published.');
  },

  /* ------------------------------- ORDERS ------------------------------- */
  async placeOrder(payload) {
    const { items = [], address, payment, totals, coupon, userId } = payload;
    if (!items.length) return fail('Your cart is empty.');
    if (!address)      return fail('Please select a delivery address.');
    if (!payment)      return fail('Please choose a payment method.');
    const now = new Date();
    const order = {
      id: 'PS' + now.getFullYear() + String(Date.now()).slice(-8),
      userId: userId || 'guest',
      items, address, payment, totals, coupon: coupon || null,
      status: payment.method === 'cod' ? 'Placed' : 'Confirmed',
      paymentStatus: payment.method === 'cod' ? 'Pending' : 'Paid',
      placedAt: now.toISOString(),
      expectedAt: addDays(now, 4).toISOString(),
      invoiceNo: 'INV-' + now.getFullYear() + '-' + String(Date.now()).slice(-6),
      awb: 'PSX' + Math.floor(1e9 + Math.random() * 9e9),
      courier: 'PShop Express',
      cancellable: true, returnable: false,
      timeline: buildTimeline(payment.method === 'cod' ? 'Placed' : 'Confirmed', now)
    };
    const list = ordersDB(); list.unshift(order); saveOrders(list);
    pushNotification({
      title: 'Order placed successfully',
      body: `Order ${order.id} for ${items.length} item(s) is confirmed.`,
      type: 'order', link: `pages/order-details.html?id=${order.id}`
    });
    return ok({ order }, 'Order placed successfully.');
  },

  async getOrders({ userId, status } = {}) {
    let list = ordersDB();
    if (userId) list = list.filter(o => o.userId === userId || o.userId === 'guest');
    if (status && status !== 'all') list = list.filter(o => o.status === status);
    return ok({ items: list, total: list.length });
  },

  async getOrder({ id }) {
    const o = ordersDB().find(x => x.id === id);
    return o ? ok({ order: o }) : fail('Order not found.', 404);
  },

  async trackOrder({ id }) {
    const o = ordersDB().find(x => x.id === id);
    if (!o) return fail('We could not find that order ID.', 404);
    return ok({
      order: { id: o.id, status: o.status, awb: o.awb, courier: o.courier,
               expectedAt: o.expectedAt, placedAt: o.placedAt, address: o.address,
               items: o.items, timeline: o.timeline }
    });
  },

  async cancelOrder({ id, reason }) {
    const list = ordersDB(); const o = list.find(x => x.id === id);
    if (!o) return fail('Order not found.', 404);
    if (['Delivered', 'Cancelled', 'Returned'].includes(o.status))
      return fail(`This order is already ${o.status.toLowerCase()} and cannot be cancelled.`);
    o.status = 'Cancelled'; o.cancellable = false; o.cancelReason = reason || 'Not specified';
    o.cancelledAt = new Date().toISOString();
    o.paymentStatus = o.payment.method === 'cod' ? 'Cancelled' : 'Refund initiated';
    o.timeline.push({ stage: 'Cancelled', done: true, at: o.cancelledAt,
      note: `Cancelled by customer — ${o.cancelReason}` });
    saveOrders(list);
    pushNotification({ title: 'Order cancelled', body: `Order ${o.id} has been cancelled.`,
      type: 'order', link: `pages/order-details.html?id=${o.id}` });
    return ok({ order: o }, 'Order cancelled. Refund (if any) starts within 24 hours.');
  },

  async returnOrder({ id, reason, mode = 'return' }) {
    const list = ordersDB(); const o = list.find(x => x.id === id);
    if (!o) return fail('Order not found.', 404);
    if (o.status !== 'Delivered') return fail('Only delivered orders can be returned or replaced.');
    o.status = mode === 'replace' ? 'Replacement requested' : 'Return requested';
    o.returnReason = reason || 'Not specified';
    o.returnedAt = new Date().toISOString();
    if (mode !== 'replace') o.paymentStatus = 'Refund initiated';
    o.timeline.push({ stage: o.status, done: true, at: o.returnedAt,
      note: `${mode === 'replace' ? 'Replacement' : 'Return'} requested — ${o.returnReason}` });
    saveOrders(list);
    pushNotification({ title: `${mode === 'replace' ? 'Replacement' : 'Return'} requested`,
      body: `We received your request for order ${o.id}. Pickup will be scheduled in 24–48 hrs.`,
      type: 'order', link: `pages/order-details.html?id=${o.id}` });
    return ok({ order: o }, `${mode === 'replace' ? 'Replacement' : 'Return'} request submitted.`);
  },

  /* ------------------------------ PAYMENT ------------------------------- */
  async savePayment({ orderId, method, amount, reference, status = 'Paid' }) {
    const key = 'pshop_payments';
    const list = Store.get(key, []);
    const rec = { id: uid('PAY'), orderId, method, amount, status,
      reference: reference || uid('TXN'), at: new Date().toISOString() };
    list.unshift(rec); Store.set(key, list);
    const orders = ordersDB(); const o = orders.find(x => x.id === orderId);
    if (o) { o.paymentStatus = status; saveOrders(orders); }
    return ok({ payment: rec }, 'Payment recorded.');
  },

  async verifyCoupon({ code, subtotal }) {
    const list = await seed('coupons');
    const c = list.find(x => x.code.toUpperCase() === String(code).trim().toUpperCase() && x.active);
    if (!c) return fail('That coupon code is not valid.');
    if (new Date(c.expiry) < new Date()) return fail('This coupon has expired.');
    if (subtotal < c.minOrder) return fail(`Add ${CONFIG.CURRENCY}${c.minOrder - subtotal} more to use ${c.code}.`);
    let discount = 0, freeShip = false;
    if (c.type === 'percent') discount = Math.min(Math.round(subtotal * c.value / 100), c.maxDiscount);
    else if (c.type === 'flat') discount = Math.min(c.value, subtotal);
    else if (c.type === 'shipping') freeShip = true;
    return ok({ coupon: { ...c, discount, freeShip } }, `Coupon ${c.code} applied.`);
  },

  /* ------------------------- MESSAGES / SUPPORT ------------------------- */
  async getMessages() {
    let list = Store.get(CONFIG.KEYS.MSGS, null);
    if (!list) {
      list = [{
        id: uid('MSG'), from: 'PShop Support', avatar: '', subject: 'Welcome to PShop \u{1F389}',
        thread: [{ by: 'support', text: 'Hi! Thanks for joining PShop. Reply here any time — our team responds within a few hours.', at: new Date(Date.now() - 864e5).toISOString() }],
        unread: true, at: new Date(Date.now() - 864e5).toISOString(), status: 'open'
      }];
      Store.set(CONFIG.KEYS.MSGS, list);
    }
    return ok({ items: list, unread: list.filter(m => m.unread).length });
  },

  async sendMessage({ threadId, text, subject, name, email }) {
    const list = Store.get(CONFIG.KEYS.MSGS, []);
    const now = new Date().toISOString();
    let thread = list.find(m => m.id === threadId);
    if (!thread) {
      thread = { id: uid('MSG'), from: name || 'You', subject: subject || 'New enquiry',
        thread: [], unread: false, at: now, status: 'open', email: email || '' };
      list.unshift(thread);
    }
    thread.thread.push({ by: 'user', text, at: now });
    thread.at = now;
    // Auto-acknowledgement keeps the demo conversational.
    thread.thread.push({ by: 'support',
      text: 'Thanks for reaching out! Ticket logged — our support team will reply shortly.',
      at: new Date(Date.now() + 1000).toISOString() });
    thread.unread = true;
    Store.set(CONFIG.KEYS.MSGS, list);
    return ok({ thread }, 'Message sent.');
  },

  async getNotifications() {
    let list = Store.get(CONFIG.KEYS.NOTIFS, null);
    if (!list) {
      const now = Date.now();
      list = [
        { id: uid('N'), title: 'Welcome to PShop', body: 'Use code NEWUSER for 15% off your first order.',
          type: 'offer', at: new Date(now - 36e5).toISOString(), read: false, link: 'pages/shop.html' },
        { id: uid('N'), title: 'Flash Sale is live', body: 'Extra 18% off on selected products for a limited time.',
          type: 'offer', at: new Date(now - 72e5).toISOString(), read: false, link: 'pages/shop.html?tag=flash' },
        { id: uid('N'), title: 'Complete your profile', body: 'Add an address to check out faster next time.',
          type: 'system', at: new Date(now - 1728e5).toISOString(), read: true, link: 'pages/address.html' }
      ];
      Store.set(CONFIG.KEYS.NOTIFS, list);
    }
    return ok({ items: list, unread: list.filter(n => !n.read).length });
  },

  async subscribeNewsletter({ email }) {
    if (!V.email(email)) return fail('Please enter a valid email address.');
    const list = Store.get('pshop_newsletter', []);
    if (list.includes(email)) return ok({ already: true }, 'You are already subscribed.');
    list.push(email); Store.set('pshop_newsletter', list);
    return ok({ subscribed: true }, 'Subscribed! Watch your inbox for deals.');
  },

  async contact({ name, email, subject, message }) {
    if (!V.name(name))   return fail('Please enter your name.');
    if (!V.email(email)) return fail('Please enter a valid email.');
    if (!message || message.trim().length < 10) return fail('Message must be at least 10 characters.');
    await handlers.sendMessage({ text: message, subject: subject || 'Contact form', name, email });
    return ok({ received: true }, 'Thanks! We have received your message.');
  },

  /* ------------------------------- ADMIN -------------------------------- */
  async adminStats() {
    const products = await seed('products');
    const orders = ordersDB();
    const users = ensureDemoAccounts();
    const revenue = orders.filter(o => o.status !== 'Cancelled')
      .reduce((a, o) => a + (o.totals?.total || 0), 0);
    return ok({
      products: products.length,
      orders: orders.length,
      users: users.length,
      revenue,
      pending: orders.filter(o => ['Placed', 'Confirmed', 'Packed'].includes(o.status)).length,
      delivered: orders.filter(o => o.status === 'Delivered').length,
      cancelled: orders.filter(o => o.status === 'Cancelled').length,
      lowStock: products.filter(p => p.stock > 0 && p.stock < 10).length,
      outOfStock: products.filter(p => !p.stock).length
    });
  },

  async adminUpdateOrder({ id, status }) {
    const list = ordersDB(); const o = list.find(x => x.id === id);
    if (!o) return fail('Order not found.', 404);
    o.status = status;
    o.timeline = buildTimeline(status, o.placedAt);
    if (status === 'Delivered') { o.returnable = true; o.cancellable = false; o.paymentStatus = 'Paid'; }
    saveOrders(list);
    return ok({ order: o }, `Order marked ${status}.`);
  }
};

/* ------------------------------- helpers ---------------------------------- */
function maskId(id) {
  if (id.includes('@')) {
    const [u, d] = id.split('@');
    return u.slice(0, 2) + '*'.repeat(Math.max(2, u.length - 2)) + '@' + d;
  }
  return id.slice(0, 2) + '******' + id.slice(-2);
}

function localReviews(productId) {
  return Store.get('pshop_reviews_local', []).filter(r => r.productId === productId);
}

function pushNotification({ title, body, type = 'system', link = '' }) {
  const list = Store.get(CONFIG.KEYS.NOTIFS, []);
  list.unshift({ id: uid('N'), title, body, type, link, at: new Date().toISOString(), read: false });
  Store.set(CONFIG.KEYS.NOTIFS, list.slice(0, 50));
}

function score(p, term) {
  const name = p.name.toLowerCase();
  let s = 0;
  if (name.startsWith(term)) s += 100;
  if (name.includes(term)) s += 60;
  if (p.brand.toLowerCase().includes(term)) s += 40;
  if (p.subCategory.toLowerCase().includes(term)) s += 30;
  if (p.category.toLowerCase().includes(term)) s += 20;
  if (p.tags.some(t => t.includes(term))) s += 10;
  // fuzzy token match
  const tokens = term.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every(t => (name + p.brand + p.category).toLowerCase().includes(t))) s += 45;
  return s + Math.min(p.rating, 5);
}

function countBy(list, key) {
  const map = {};
  list.forEach(x => { map[x[key]] = (map[x[key]] || 0) + 1; });
  return Object.entries(map).map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

function filterProducts(items, f = {}) {
  let out = items;
  if (f.category)  out = out.filter(p => p.categorySlug === f.category || p.categoryId === f.category);
  if (f.sub)       { const s = split(f.sub);   out = out.filter(p => s.includes(p.subCategory)); }
  if (f.brand)     { const b = split(f.brand); out = out.filter(p => b.includes(p.brand)); }
  if (f.tag)       out = out.filter(p => p.tags.includes(f.tag));
  if (f.minPrice)  out = out.filter(p => p.price >= +f.minPrice);
  if (f.maxPrice)  out = out.filter(p => p.price <= +f.maxPrice);
  if (f.rating)    out = out.filter(p => p.rating >= +f.rating);
  if (f.inStock === true || f.inStock === 'true') out = out.filter(p => p.inStock);
  if (f.discount)  out = out.filter(p => p.discount >= +f.discount);
  if (f.ids)       { const ids = split(f.ids); out = out.filter(p => ids.includes(p.id)); }
  if (f.q) {
    const t = String(f.q).toLowerCase();
    out = out.filter(p => score(p, t) > 5);
  }
  return out;
}

const split = v => Array.isArray(v) ? v : String(v).split(',').filter(Boolean);

function sortProducts(items, sort) {
  const out = [...items];
  switch (sort) {
    case 'price-asc':  return out.sort((a, b) => a.price - b.price);
    case 'price-desc': return out.sort((a, b) => b.price - a.price);
    case 'rating':     return out.sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount);
    case 'discount':   return out.sort((a, b) => b.discount - a.discount);
    case 'newest':     return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'popular':    return out.sort((a, b) => b.sold - a.sold);
    case 'name':       return out.sort((a, b) => a.name.localeCompare(b.name));
    default:           return out.sort((a, b) => (b.rating * Math.log10(b.ratingCount + 10)) -
                                                 (a.rating * Math.log10(a.ratingCount + 10)));
  }
}

/* ------------------------------ public API -------------------------------- */
export async function mockRequest(action, payload = {}) {
  const fn = handlers[action];
  if (!fn) return fail(`Unknown action: ${action}`, 404);
  // Minimal latency — fast feel while still async-realistic.
  await sleep(40 + Math.random() * 60);
  try { return await fn(payload); }
  catch (e) {
    console.error('[PShop mock]', action, e);
    return fail(e.message || 'Something went wrong.', 500);
  }
}

export { ensureDemoAccounts };
