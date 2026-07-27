/**
 * PShop — Backend test suite
 * Chalane ke liye:  node tests/backend.test.js
 */
const { loadBackend } = require('./gas-emulator.js');

let pass = 0, fail = 0;
const failures = [];
const ck = (n, c, x = '') => {
  if (c) { pass++; console.log('  \x1b[32mPASS\x1b[0m  ' + n); }
  else { fail++; failures.push(n + (x ? `  [${x}]` : '')); console.log('  \x1b[31mFAIL\x1b[0m  ' + n + (x ? `  [${x}]` : '')); }
};
const section = t => console.log('\n\x1b[1m=== ' + t + ' ===\x1b[0m');

const env = loadBackend();
const G = env.api;
const call = (a, p = {}, t = null) => G.routeRequest(a, p, t);

/* ------------------------------- SETUP ----------------------------------- */
section('setupDemoStore()');
const t0 = Date.now();
const setup = G.setupDemoStore();
const took = Date.now() - t0;
console.log(`  (${took}ms)`);
ck('setupDemoStore chalta hai', setup.success);
ck('speed theek hai (<5s emulated)', took < 5000, took + 'ms');

section('Har sheet me data hai (koi khaali nahi)');
const EXPECT = {
  Users: 7, Products: 48, Categories: 8, Orders: 12, Cart: 3, Wishlist: 6,
  Payments: 12, Messages: 2, Reviews: 48, Coupons: 5, Notifications: 24,
  Delivery: 12, Settings: 10, OTP: 2, Banners: 4, FAQs: 15, Newsletter: 6
};
for (const [sheet, n] of Object.entries(EXPECT)) {
  const got = G.readAll(sheet).length;
  ck(`${sheet} = ${n} rows`, got === n, `got ${got}`);
}
ck('README sheet bani', G.readAll('README').length > 200, String(G.readAll('README').length));
const emptySheets = Object.keys(EXPECT).filter(s => G.readAll(s).length === 0);
ck('koi sheet khaali nahi', emptySheets.length === 0, emptySheets.join(','));

section('Column notes (hover documentation)');
const noted = Object.keys(env.notes).length;
ck('17 sheets par notes lage', noted >= 17, String(noted));
let totalNotes = 0;
Object.values(env.notes).forEach(arr => totalNotes += arr.filter(x => x && x.length > 3).length);
ck('200+ columns documented', totalNotes >= 200, String(totalNotes));
const userNotes = env.notes.Users || [];
ck('password column warn karta hai',
  userNotes.some(n => n && n.indexOf('PLAIN PASSWORD') > -1));

section('Idempotency — dobara run karne par duplicate nahi');
G.setupDemoStore();
for (const [sheet, n] of Object.entries(EXPECT)) {
  const got = G.readAll(sheet).length;
  if (got !== n) ck(`${sheet} duplicate ho gaya`, false, `${n} -> ${got}`);
}
ck('dobara run ke baad bhi counts same', Object.entries(EXPECT)
  .every(([s, n]) => G.readAll(s).length === n));

/* -------------------------------- AUTH ----------------------------------- */
section('Demo logins');
const LOGINS = [
  ['admin@pshop.in', 'admin123', 'admin'],
  ['demo@pshop.in', 'demo123', 'customer'],
  ['priya@pshop.in', 'priya123', 'customer'],
  ['rahul@pshop.in', 'rahul123', 'customer'],
  ['sneha@pshop.in', 'sneha123', 'customer'],
  ['imran@pshop.in', 'imran123', 'customer']
];
const tokens = {};
LOGINS.forEach(([em, pw, role]) => {
  const r = call('login', { identifier: em, password: pw });
  ck(`${em} / ${pw}`, r.success && r.data.user.role === role, r.message);
  if (r.success) tokens[em] = r.data.token;
});
ck('galat password reject', !call('login', { identifier: 'demo@pshop.in', password: 'x' }).success);
ck('password response me nahi aata',
  call('login', { identifier: 'demo@pshop.in', password: 'demo123' }).data.user.password === undefined);
ck('phone se bhi login', call('login', { identifier: '9876543210', password: 'demo123' }).success);
const blk = call('login', { identifier: 'blocked@pshop.in', password: 'blocked123' });
ck('blocked user login nahi kar sakta', !blk.success && blk.code === 403, blk.message);

const tokC = tokens['demo@pshop.in'], tokA = tokens['admin@pshop.in'];

section('OTP flow');
let r = call('sendOtp', { identifier: 'demo@pshop.in', purpose: 'login' });
ck('sendOtp', r.success, r.message);
ck('OTP masked', r.success && r.data.masked.indexOf('*') > -1);
ck('raw code leak nahi hota', r.success && !r.data.code);
const otpRow = G.readAll('OTP').filter(o => String(o.identifier) === 'demo@pshop.in')[0];
ck('galat OTP reject', !call('verifyOtp', { identifier: 'demo@pshop.in', code: '000000' }).success);
r = call('verifyOtp', { identifier: 'demo@pshop.in', code: String(otpRow.code) });
ck('sahi OTP verify + token', r.success && !!r.data.token, r.message);
ck('demo OTP rows se flow nahi tootta', G.readAll('OTP').length >= 1);

section('Auth guards');
ck('protected route bina login block', !call('placeOrder', {}).success);
ck('customer admin route nahi chhu sakta', call('adminStats', {}, tokC).code === 403);
ck('admin route admin ke liye khula', call('adminStats', {}, tokA).success);
ck('invalid token reject', !call('validateToken', {}, 'garbage').success);

/* ------------------------------ CATALOGUE -------------------------------- */
section('Products');
r = call('getProducts', {});
ck('getProducts', r.success && r.data.total === 48, String(r.data?.total));
ck('pagination (12/page, 4 pages)', r.data.items.length === 12 && r.data.pages === 4);
const p0 = r.data.items[0];
ck('images JSON parse hui', Array.isArray(p0.images) && p0.images.length === 3);
ck('specs object parse hua', typeof p0.specs === 'object' && !!p0.specs.Brand);
ck('tags array parse hui', Array.isArray(p0.tags));
ck('colors array parse hui', Array.isArray(p0.colors));
ck('highlights array parse hui', Array.isArray(p0.highlights));
ck('discount number hai', typeof p0.discount === 'number');
ck('inStock boolean hai', typeof p0.inStock === 'boolean');

r = call('getProducts', { sort: 'price-asc' });
let pr = r.data.items.map(x => x.price);
ck('sort price-asc', JSON.stringify(pr) === JSON.stringify([...pr].sort((a, b) => a - b)));
r = call('getProducts', { sort: 'price-desc' });
pr = r.data.items.map(x => x.price);
ck('sort price-desc', JSON.stringify(pr) === JSON.stringify([...pr].sort((a, b) => b - a)));
ck('brand filter', call('getProducts', { brand: p0.brand }).data.total > 0);
ck('category filter', call('getProducts', { category: 'electronics' }).data.total === 6);
ck('tag filter', call('getProducts', { tag: 'featured' }).data.total > 0);
ck('price range filter', call('getProducts', { minPrice: 1000, maxPrice: 5000 }).success);
ck('inStock filter', call('getProducts', { inStock: true }).success);
ck('search kaam kar raha', call('searchProducts', { q: 'phone' }).data.total > 0);
ck('bakwaas search par 0', call('searchProducts', { q: 'zzqqxx' }).data.total === 0);

const pid = G.readAll('Products')[0].id;
r = call('getProduct', { id: pid });
ck('product detail', r.success);
ck('related products', Array.isArray(r.data.related) && r.data.related.length > 0);
ck('reviews attached', Array.isArray(r.data.reviews));
ck('404 galat id par', call('getProduct', { id: 'NOPE' }).code === 404);

section('Categories & filters');
r = call('getCategories', {});
ck('8 categories', r.data.items.length === 8);
ck('har category me 6 products', r.data.items.every(c => c.productCount === 6));
ck('subCategories array', r.data.items.every(c => Array.isArray(c.subCategories)));
ck('getFilters', call('getFilters', {}).data.brands.length > 0);

/* -------------------------------- ORDERS --------------------------------- */
section('Demo orders');
r = call('getOrders', {}, tokC);
ck('demo customer ke 3 orders', r.data.total === 3, String(r.data.total));
const allOrders = call('adminOrders', {}, null) ;
const sts = r.data.items.map(o => o.status);
ck('alag-alag status', new Set(sts).size >= 3, sts.join(','));
const delivered = r.data.items.find(o => o.status === 'Delivered');
ck('delivered order mila', !!delivered);
ck('timeline 6 steps', delivered && delivered.timeline.length === 6);
ck('timeline sab done', delivered && delivered.timeline.every(t => t.done));
ck('returnable flag', delivered && delivered.returnable === true);
ck('items parse hue', delivered && delivered.items.length > 0);
ck('address parse hua', delivered && !!delivered.address.city);
ck('totals parse hue', delivered && typeof delivered.totals.total === 'number');
ck('invoice number hai', delivered && !!delivered.invoiceNo);
ck('AWB hai', delivered && !!delivered.awb);

ck('trackOrder bina login', call('trackOrder', { id: delivered.id }).success);
ck('trackOrder 404', !call('trackOrder', { id: 'BADID' }).success);
ck('dusre user ka order nahi dikhta',
  call('getOrder', { id: delivered.id }, tokens['rahul@pshop.in']).code === 403);
ck('admin har order dekh sakta', call('getOrder', { id: delivered.id }, tokA).success);

section('Return / Replace orders (demo)');
const adminOrders = call('adminOrders', {}, tokA).data.items;
ck('return requested order hai',
   adminOrders.some(o => o.status === 'Return requested'),
   adminOrders.map(o => o.status).join(','));
ck('replacement requested order hai',
   adminOrders.some(o => o.status === 'Replacement requested'));
ck('coupon wale orders hain', adminOrders.some(o => o.totals.discount > 0));
const withCoupon = adminOrders.find(o => o.totals.discount > 0);
ck('coupon object parse hua', withCoupon && withCoupon.coupon && !!withCoupon.coupon.code,
   JSON.stringify(withCoupon && withCoupon.coupon));
const statusSet = new Set(adminOrders.map(o => o.status));
ck('6+ alag status hain', statusSet.size >= 6, [...statusSet].join(','));

section('Cart / Wishlist / Checkout');
const cartBefore = call('getCart', {}, tokC).data.items.length;
ck('seed cart me items hain', cartBefore === 2, String(cartBefore));
r = call('addCart', { productId: pid, qty: 2 }, tokC);
ck('addCart', r.success && r.data.items.length === cartBefore + 1);
ck('cart totals calculate', r.data.totals.subtotal > 0);
const line = call('getCart', {}, tokC).data.items[0];
r = call('updateCart', { lineId: line.id, qty: 3 }, tokC);
ck('updateCart qty', r.data.items.find(i => i.id === line.id).qty === 3);
r = call('removeCart', { lineId: line.id }, tokC);
ck('removeCart', r.data.items.length === cartBefore);

const wishBefore = call('getWishlist', {}, tokC).data.count;
ck('seed wishlist me items', wishBefore === 3, String(wishBefore));
r = call('addWishlist', { productId: pid }, tokC);
ck('addWishlist', r.data.count === wishBefore + 1);
r = call('addWishlist', { productId: pid }, tokC);
ck('wishlist duplicate nahi', r.data.count === wishBefore + 1);
r = call('removeWishlist', { productId: pid }, tokC);
ck('removeWishlist', r.data.count === wishBefore);

section('Coupons');
r = call('verifyCoupon', { code: 'PSHOP10', subtotal: 50000 });
ck('PSHOP10 maxDiscount cap', r.success && r.data.coupon.discount === 300, String(r.data?.coupon?.discount));
ck('minOrder se kam par block', !call('verifyCoupon', { code: 'PSHOP10', subtotal: 100 }).success);
ck('FLAT200 flat discount', call('verifyCoupon', { code: 'FLAT200', subtotal: 2000 }).data.coupon.discount === 200);
ck('FREESHIP shipping type', call('verifyCoupon', { code: 'FREESHIP', subtotal: 100 }).data.coupon.freeShip === true);
ck('galat coupon reject', !call('verifyCoupon', { code: 'FAKE', subtotal: 5000 }).success);

section('Order placement');
const cart = call('getCart', {}, tokC).data;
const stockBefore = G.readAll('Products').find(p => p.id === cart.items[0].productId).stock;
r = call('placeOrder', {
  items: cart.items.map(i => ({ productId: i.productId, id: i.productId, name: i.name,
    price: i.price, qty: i.qty, image: i.image })),
  address: { name: 'Demo', phone: '9876543210', line1: '12 MG Road',
    city: 'Patna', state: 'Bihar', pin: '800001' },
  // UPI use kar rahe hain kyunki seed cart me COD-blocked item ho sakta hai.
  // COD ka apna dedicated test neeche "CASH ON DELIVERY" section me hai.
  payment: { method: 'upi', label: 'UPI' },
  totals: cart.totals
}, tokC);
ck('placeOrder', r.success, r.message);
const newOrderId = r.success ? r.data.order.id : null;
ck('naya order add hua (13)', G.readAll('Orders').length === 13);
ck('cart clear hua', call('getCart', {}, tokC).data.items.length === 0);
const stockAfter = G.readAll('Products').find(p => p.id === cart.items[0].productId).stock;
ck('stock kam hua', stockAfter < stockBefore, `${stockBefore} -> ${stockAfter}`);
ck('delivery record bana', G.readAll('Delivery').length === 13);
ck('notification bana', G.readAll('Notifications').length > 24);

r = call('cancelOrder', { id: newOrderId, reason: 'Test' }, tokC);
ck('cancelOrder', r.success, r.message);
ck('stock wapas aaya',
  G.readAll('Products').find(p => p.id === cart.items[0].productId).stock === stockBefore);
ck('double cancel block', !call('cancelOrder', { id: newOrderId, reason: 'x' }, tokC).success);

section('Reviews');
r = call('addReview', { productId: pid, rating: 5, title: 'Nice', comment: 'Very good product indeed' }, tokC);
ck('addReview', r.success, r.message);
ck('chhota review reject', !call('addReview', { productId: pid, rating: 5, comment: 'bad' }, tokC).success);
ck('bina rating reject', !call('addReview', { productId: pid, comment: 'no rating here at all' }, tokC).success);
ck('getReviews breakdown', call('getReviews', { productId: pid }).data.average > 0);

/* -------------------------------- ADMIN ---------------------------------- */
section('Admin panel');
r = call('adminStats', {}, tokA);
ck('adminStats products', r.data.products === 48);
ck('adminStats revenue', r.data.revenue > 0);
ck('adminOrders saare orders', call('adminOrders', {}, tokA).data.total === 13,
   String(call('adminOrders', {}, tokA).data.total));
ck('adminUsers', call('adminUsers', {}, tokA).data.total === 7,
   String(call('adminUsers', {}, tokA).data.total));
ck('user me orderCount', call('adminUsers', {}, tokA).data.items.every(u => 'orderCount' in u));
ck('adminReports', Array.isArray(call('adminReports', {}, tokA).data.topProducts));
ck('adminPayments', call('adminPayments', {}, tokA).data.total >= 12);
ck('adminReviews', call('adminReviews', {}, tokA).data.total > 40);
ck('adminMessages', call('adminMessages', {}, tokA).data.total === 2);
ck('adminDelivery', call('adminDelivery', {}, tokA).data.total >= 12);
ck('adminCoupons', call('adminCoupons', {}, tokA).data.total === 5);
ck('adminSettings', !!call('adminSettings', {}, tokA).data.settings.siteName);

r = call('adminAddProduct', { product: { name: 'Test Item', brand: 'TB', price: 500, mrp: 1000,
  stock: 10, categoryId: 'c1', category: 'Electronics', categorySlug: 'electronics' } }, tokA);
ck('admin product add', r.success, r.message);
ck('products 49', G.readAll('Products').length === 49);
ck('discount auto 50%', r.data.product.discount === 50, String(r.data.product?.discount));
r = call('adminUpdateOrder', { id: delivered.id, status: 'Delivered' }, tokA);
ck('admin order status update', r.success);
ck('category with products delete block',
  !call('adminDeleteCategory', { id: 'c1' }, tokA).success);

/* ------------------------------- CONTENT --------------------------------- */
section('Content & misc');
ck('banners 4', call('getBanners', {}).data.items.length === 4);
ck('faqs 15', call('getFaqs', {}).data.items.length === 15);
ck('pincode serviceable', call('checkPincode', { pincode: '800001' }).data.serviceable);
ck('galat pincode reject', !call('checkPincode', { pincode: '12' }).success);
ck('newsletter subscribe', call('subscribeNewsletter', { email: 'new@test.com' }).success);
ck('duplicate subscribe handle', call('subscribeNewsletter', { email: 'new@test.com' }).data.already);
ck('contact form', call('contact', { name: 'Ram', email: 'r@t.com',
  message: 'I need help with my order please' }).success);

section('KHAALI SHEET par crash nahi hona chahiye');
// Bug: "The number of columns in the range must be at least 1"
// Ye tab aata tha jab sheet exist karti thi par headers nahi the —
// getLastColumn() = 0, aur getRange(1,1,1,0) crash kar deta tha.
(function () {
  // Ek schema-wali sheet ko poori tarah khaali kar do (jaise user ne
  // tab delete karke naya blank tab bana diya ho).
  delete env.SS._s['Newsletter'];
  delete env.sheets['Newsletter'];
  env.SS.insertSheet('Newsletter');        // blank tab, koi header nahi
  G.clearSheetCache();
})();

let blankErr = null;
try {
  G.appendRow('Newsletter', { email: 'blank@test.com',
    subscribedAt: '2026-01-01T00:00:00Z', status: 'active' });
} catch (e) { blankErr = e.message; }
ck('khaali sheet par appendRow crash nahi karta', blankErr === null,
   String(blankErr));
ck('headers apne aap ban gaye', G.readAll('Newsletter').length === 1,
   String(G.readAll('Newsletter').length));

let bulkErr = null;
try {
  delete env.SS._s['Wishlist']; delete env.sheets['Wishlist'];
  env.SS.insertSheet('Wishlist');
  G.clearSheetCache();
  G.appendRows('Wishlist', [{ id: 'W1', userId: 'U1', productId: 'P1', name: 'X',
    brand: 'B', price: 1, mrp: 2, image: '', slug: 's', rating: 4,
    discount: 10, addedAt: '2026-01-01T00:00:00Z' }]);
} catch (e) { bulkErr = e.message; }
ck('khaali sheet par appendRows crash nahi karta', bulkErr === null, String(bulkErr));

// readAll / updateRow / deleteRow bhi safe hone chahiye
let readErr = null, updErr = null, delErr = null;
try {
  delete env.SS._s['OTP']; delete env.sheets['OTP'];
  env.SS.insertSheet('OTP'); G.clearSheetCache();
  G.readAll('OTP');
} catch (e) { readErr = e.message; }
ck('khaali sheet par readAll safe', readErr === null, String(readErr));

try { G.routeRequest('getFaqs', {}); } catch (e) { updErr = e.message; }
ck('getFaqs khaali sheet par safe', updErr === null, String(updErr));

// DB_SCHEMA shared hai — dono jagah same headers
const schema = G.DB_SCHEMA ? G.DB_SCHEMA() : null;
ck('DB_SCHEMA() available hai', !!schema);
if (schema) {
  ck('schema me 17 sheets', Object.keys(schema).length === 17,
     String(Object.keys(schema).length));
  ck('har sheet ke headers hain',
     Object.keys(schema).every(k => Array.isArray(schema[k]) && schema[k].length > 0));
}

// Setup dobara chalao — sab wapas normal
G.setupDemoStore();
ck('setupDemoStore ke baad sab normal', G.readAll('Products').length === 48,
   String(G.readAll('Products').length));
ck('Newsletter wapas bhara', G.readAll('Newsletter').length === 6,
   String(G.readAll('Newsletter').length));

section('DATE HANDLING (Sheets Date object bug)');
// Google Sheets ISO strings ko Date object bana deta hai. Simulate karo.
(function () {
  const sh = env.sheets['Orders'], hdr = sh[0];
  ['placedAt', 'expectedAt', 'createdAt', 'updatedAt'].forEach(col => {
    const c = hdr.indexOf(col);
    if (c < 0) return;
    for (let r = 1; r < sh.length; r++) {
      if (sh[r][c] && typeof sh[r][c] === 'string') sh[r][c] = new Date(sh[r][c]);
    }
  });
})();

const dOrders = call('adminOrders', {}, tokA).data.items;
const d0 = dOrders[0];
ck('Date object ISO string ban gaya', typeof d0.placedAt === 'string',
   typeof d0.placedAt);
ck('ISO format sahi hai', /^\d{4}-\d{2}-\d{2}T/.test(String(d0.placedAt)),
   String(d0.placedAt).slice(0, 30));
ck('String(date).slice(0,10) ab kaam karta hai',
   /^\d{4}-\d{2}-\d{2}$/.test(String(d0.placedAt).slice(0, 10)),
   String(d0.placedAt).slice(0, 10));
ck('JSON me clean date jaati hai',
   JSON.stringify({ d: d0.placedAt }).indexOf('T') > -1);
ck('toISO() helper Date handle karta hai',
   /^\d{4}-\d{2}-\d{2}T/.test(G.toISO(new Date())));
ck('toISO() khaali par crash nahi', G.toISO(null) === '' && G.toISO('') === '');
ck('toDateKey() YYYY-MM-DD deta hai',
   /^\d{4}-\d{2}-\d{2}$/.test(G.toDateKey(new Date())), G.toDateKey(new Date()));
ck('toDateKey() Date object par bhi', G.toDateKey(d0.placedAt).length === 10);
const rep = call('adminReports', {}, tokA);
ck('adminReports Date ke saath chalta hai', rep.success);
ck('revenue series bani', Array.isArray(rep.data.salesSeries));
ck('series me sahi date keys', rep.data.salesSeries.length === 0 ||
   /^\d{4}-\d{2}-\d{2}$/.test(rep.data.salesSeries[0].date),
   JSON.stringify(rep.data.salesSeries[0]));
// Cancelled/return orders me extra step hota hai, isliye >= 6 check karte hain.
ck('order timeline Date ke baad bhi theek', Array.isArray(d0.timeline) &&
   d0.timeline.length >= 6, `len=${d0.timeline && d0.timeline.length}`);
ck('timeline ke andar dates bhi ISO hain',
   d0.timeline.filter(t => t.at).every(t => /^\d{4}-\d{2}-\d{2}T/.test(String(t.at))),
   JSON.stringify(d0.timeline.find(t => t.at)));
const trackD = call('trackOrder', { id: d0.id });
ck('trackOrder Date ke saath', trackD.success);

section('CASH ON DELIVERY');
const allP = G.readAll('Products');
const codOk = allP.filter(x => x.codAvailable !== false && x.codAvailable !== 'FALSE')[0];
const codNo = allP.filter(x => x.codAvailable === false || x.codAvailable === 'FALSE')[0];
ck('COD-allowed products hain', !!codOk);
ck('COD-blocked products bhi hain (testing ke liye)', !!codNo,
   'sab products COD allow karte hain');

// checkCod endpoint
let cc = call('checkCod', { items: [{ productId: codOk.id, qty: 1 }] });
ck('checkCod: allowed item par eligible', cc.success && cc.data.eligible === true,
   JSON.stringify(cc.data));
ck('checkCod me codFee aata hai', cc.data.codFee === G.CONFIG.COD_FEE);
if (codNo) {
  cc = call('checkCod', { items: [{ productId: codNo.id, qty: 1 }] });
  ck('checkCod: blocked item par ineligible', cc.data.eligible === false);
  ck('checkCod blocked item ka naam batata hai', cc.data.blockedItems.length > 0,
     JSON.stringify(cc.data.blockedItems));
}

// COD order — fee server par judni chahiye
const codAddr = { name: 'COD Test', phone: '9876543210', line1: '12 MG Road',
                  city: 'Patna', state: 'Bihar', pin: '800001' };
let codOrder = call('placeOrder', {
  items: [{ productId: codOk.id, id: codOk.id, name: codOk.name,
            price: Number(codOk.price), qty: 1, image: '' }],
  address: codAddr,
  payment: { method: 'cod', label: 'Cash on Delivery' },
  totals: { subtotal: Number(codOk.price), total: Number(codOk.price), shipping: 0 }
}, tokC);
ck('COD order place hota hai', codOrder.success, codOrder.message);
ck('COD fee server par judi',
   codOrder.success && codOrder.data.order.totals.codFee === G.CONFIG.COD_FEE,
   JSON.stringify(codOrder.data && codOrder.data.order.totals));
ck('COD total me fee shamil',
   codOrder.success &&
   codOrder.data.order.totals.total === Number(codOk.price) + G.CONFIG.COD_FEE,
   String(codOrder.data && codOrder.data.order.totals.total));
ck('COD order paymentStatus Pending',
   codOrder.success && codOrder.data.order.paymentStatus === 'Pending');

// COD-blocked item par COD order block hona chahiye
if (codNo) {
  const blockedOrder = call('placeOrder', {
    items: [{ productId: codNo.id, id: codNo.id, name: codNo.name,
              price: Number(codNo.price), qty: 1, image: '' }],
    address: codAddr,
    payment: { method: 'cod', label: 'Cash on Delivery' },
    totals: { subtotal: Number(codNo.price), total: Number(codNo.price) }
  }, tokC);
  ck('COD-blocked item par COD order reject', !blockedOrder.success,
     blockedOrder.message);
  ck('error message me product ka naam', !blockedOrder.success &&
     blockedOrder.message.indexOf(codNo.name.slice(0, 10)) > -1,
     blockedOrder.message);

  // Wahi item UPI se chalna chahiye
  const upiOrder = call('placeOrder', {
    items: [{ productId: codNo.id, id: codNo.id, name: codNo.name,
              price: Number(codNo.price), qty: 1, image: '' }],
    address: codAddr,
    payment: { method: 'upi', label: 'UPI' },
    totals: { subtotal: Number(codNo.price), total: Number(codNo.price) }
  }, tokC);
  ck('wahi item UPI se chalta hai', upiOrder.success, upiOrder.message);
  ck('UPI order me codFee = 0',
     upiOrder.success && upiOrder.data.order.totals.codFee === 0);
  ck('UPI order paymentStatus Paid',
     upiOrder.success && upiOrder.data.order.paymentStatus === 'Paid');
}

section('COUPON RULES (announcement bar se match)');
// PSHOP10: 10% off, min ₹999, max ₹300 — banner par yahi likha hona chahiye
const c999 = call('verifyCoupon', { code: 'PSHOP10', subtotal: 998 });
ck('PSHOP10 ₹998 par block (min ₹999)', !c999.success, c999.message);
const c1000 = call('verifyCoupon', { code: 'PSHOP10', subtotal: 1000 });
ck('PSHOP10 ₹1000 par chalta hai', c1000.success);
ck('₹1000 par 10% = ₹100', c1000.data.coupon.discount === 100,
   String(c1000.data.coupon.discount));
const cBig = call('verifyCoupon', { code: 'PSHOP10', subtotal: 100000 });
ck('bade order par max ₹300 cap', cBig.data.coupon.discount === 300,
   String(cBig.data.coupon.discount));

section('IMAGE UPLOAD');
// Ek chhoti valid PNG (1x1 pixel) base64 me
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let up = call('uploadImage', { base64: PNG_1PX, filename: 'test.png' }, tokA);
ck('uploadImage kaam karta hai', up.success, up.message);
ck('upload URL milta hai', up.success && String(up.data.url).indexOf('http') === 0,
   up.success ? up.data.url : '');
ck('fileId milta hai', up.success && !!up.data.fileId);
ck('mime detect hua', up.success && up.data.mime === 'image/png', up.data && up.data.mime);

ck('bina login upload block', !call('uploadImage', { base64: PNG_1PX }).success);
ck('khaali payload par saaf error',
   !call('uploadImage', {}, tokA).success);

// Galat file type
const PDF = 'data:application/pdf;base64,JVBERi0xLjQK';
let badType = call('uploadImage', { base64: PDF, filename: 'doc.pdf' }, tokA);
ck('PDF reject hota hai', !badType.success, badType.message);
ck('error message me format likha hai',
   !badType.success && badType.message.toLowerCase().indexOf('jpg') > -1, badType.message);

// Size limit — 6 MB ka fake payload
const huge = 'data:image/jpeg;base64,' + 'A'.repeat(8 * 1024 * 1024);
let tooBig = call('uploadImage', { base64: huge, filename: 'big.jpg' }, tokA);
ck('badi image reject hoti hai', !tooBig.success, tooBig.message);
ck('size error me MB likha hai', !tooBig.success && tooBig.message.indexOf('MB') > -1);

// Bulk upload
let multi = call('uploadImages', {
  images: [{ base64: PNG_1PX, filename: 'a.png' }, { base64: PNG_1PX, filename: 'b.png' }],
  folder: 'Products'
}, tokA);
ck('uploadImages bulk kaam karta hai', multi.success, multi.message);
ck('bulk me 2 URLs mile', multi.success && multi.data.urls.length === 2,
   String(multi.data && multi.data.urls.length));
ck('7 images reject', !call('uploadImages', {
  images: new Array(7).fill({ base64: PNG_1PX, filename: 'x.png' })
}, tokA).success);
ck('khaali list reject', !call('uploadImages', { images: [] }, tokA).success);

// Mixed: ek valid, ek invalid
let mixed = call('uploadImages', {
  images: [{ base64: PNG_1PX, filename: 'ok.png' }, { base64: PDF, filename: 'bad.pdf' }]
}, tokA);
ck('mixed batch: valid wali chalti hain', mixed.success && mixed.data.urls.length === 1,
   String(mixed.data && mixed.data.urls.length));
ck('mixed batch: failed list bhi aati hai',
   mixed.success && mixed.data.failed.length === 1);

// Uploaded URL product me save ho sakti hai
if (up.success) {
  const withImg = call('adminAddProduct', {
    product: { name: 'Upload Test Item', brand: 'UB', price: 100, mrp: 200, stock: 5,
      categoryId: 'c1', category: 'Electronics', categorySlug: 'electronics',
      images: [up.data.url] }
  }, tokA);
  ck('uploaded image product me save hoti hai', withImg.success, withImg.message);
  ck('image array me URL hai',
     withImg.success && withImg.data.product.images[0] === up.data.url);
  // thumb ab CDN-optimised hota hai (=w400) — full URL nahi.
  ck('thumb set ho gaya (optimised)',
     withImg.success && String(withImg.data.product.thumb).indexOf(up.data.fileId) > -1,
     withImg.success ? withImg.data.product.thumb : '');
}

section('IMAGE CDN OPTIMISATION (5 TB Drive)');
if (up.success) {
  ck('upload me thumbUrl aata hai', !!up.data.thumbUrl, JSON.stringify(up.data.thumbUrl));
  ck('thumbUrl me =w400 hai',
     String(up.data.thumbUrl).indexOf('=w400') > -1, up.data.thumbUrl);
  ck('cardUrl me =w800 hai',
     String(up.data.cardUrl).indexOf('=w800') > -1, up.data.cardUrl);
  ck('full url me size param nahi',
     String(up.data.url).indexOf('=w') === -1, up.data.url);
}

// makeThumbUrl helper
ck('Drive URL par =w400 lagta hai',
   G.makeThumbUrl('https://lh3.googleusercontent.com/d/ABC') ===
   'https://lh3.googleusercontent.com/d/ABC=w400');
ck('custom width kaam karta hai',
   G.makeThumbUrl('https://lh3.googleusercontent.com/d/ABC', 800).indexOf('=w800') > -1);
ck('local SVG path nahi badalta',
   G.makeThumbUrl('assets/img/products/p001-1.svg') === 'assets/img/products/p001-1.svg');
ck('dusri site ka URL nahi badalta',
   G.makeThumbUrl('https://example.com/a.jpg') === 'https://example.com/a.jpg');
ck('double sizing nahi hoti',
   G.makeThumbUrl('https://lh3.googleusercontent.com/d/ABC=w400') ===
   'https://lh3.googleusercontent.com/d/ABC=w400');
ck('khaali value safe hai', G.makeThumbUrl('') === '' && G.makeThumbUrl(null) === '');

// Product save karne par thumb optimise ho
if (up.success) {
  const cdnProd = call('adminAddProduct', {
    product: { name: 'CDN Test Product', brand: 'CB', price: 500, mrp: 1000, stock: 5,
      categoryId: 'c1', category: 'Electronics', categorySlug: 'electronics',
      images: [up.data.url] }
  }, tokA);
  ck('product save par thumb chhota banta hai',
     cdnProd.success && String(cdnProd.data.product.thumb).indexOf('=w400') > -1,
     cdnProd.success ? cdnProd.data.product.thumb : cdnProd.message);
  ck('full image array untouched rehti hai',
     cdnProd.success && cdnProd.data.product.images[0] === up.data.url);
}

section('MESSAGE REPLY FLOW');
// Customer message bhejta hai
let msg = call('sendMessage', { text: 'Mera order abhi tak nahi aaya, kya karun?' }, tokC);
ck('customer message bhej sakta hai', msg.success, msg.message);
const threadId = msg.success ? msg.data.thread.id : null;

// Admin ko dikhta hai
let inbox = call('adminMessages', {}, tokA);
ck('admin inbox me message dikhta hai', inbox.data.total >= 3, String(inbox.data.total));
const adminThread = inbox.data.items.find(t => t.id === threadId);
ck('thread admin ko mila', !!adminThread);
ck('thread me customer ka email hai', adminThread && !!adminThread.email,
   adminThread && adminThread.email);
ck('thread me customer ka naam hai', adminThread && !!adminThread.from);

// Admin reply karta hai
const before = adminThread ? adminThread.thread.length : 0;
let reply = call('adminReplyMessage', {
  threadId: threadId,
  text: 'Sorry for the delay! Aapka order kal shaam tak pahunch jayega.'
}, tokA);
ck('admin reply kar sakta hai', reply.success, reply.message);

// Customer ko reply dikhta hai
let custView = call('getMessages', {}, tokC).data.items.find(t => t.id === threadId);
ck('customer ko reply dikhta hai', custView && custView.thread.length > before,
   `${before} -> ${custView && custView.thread.length}`);
const lastMsg = custView && custView.thread[custView.thread.length - 1];
ck('last message support ka hai', lastMsg && lastMsg.by === 'support', lastMsg && lastMsg.by);
ck('reply ka text sahi hai',
   lastMsg && lastMsg.text.indexOf('kal shaam') > -1, lastMsg && lastMsg.text);
ck('reply par unread flag lagta hai', custView && custView.unread === true);
ck('reply par notification banta hai',
   G.readAll('Notifications').some(n => String(n.title).indexOf('Support replied') > -1));

// Customer wapas reply kar sakta hai
let back = call('sendMessage', { threadId: threadId, text: 'Theek hai, dhanyavaad!' }, tokC);
ck('customer wapas reply kar sakta hai', back.success);
ck('conversation badhti rahi',
   call('getMessages', {}, tokC).data.items.find(t => t.id === threadId).thread.length >
   custView.thread.length);

// Ticket close karna
let closed = call('adminReplyMessage', {
  threadId: threadId, text: 'Order deliver ho gaya. Ticket band kar rahe hain.', close: true
}, tokA);
ck('ticket close ho sakta hai', closed.success);
const closedThread = call('adminMessages', {}, tokA).data.items.find(t => t.id === threadId);
ck('status closed ho gaya', closedThread && closedThread.status === 'closed',
   closedThread && closedThread.status);

// Guest contact form
let contact = call('contact', {
  name: 'Ramesh Kumar', email: 'ramesh@test.com',
  subject: 'Product enquiry', message: 'Kya ye product Patna me deliver hoga?'
});
ck('guest contact form kaam karta hai', contact.success, contact.message);
const guestThread = call('adminMessages', {}, tokA).data.items
  .find(t => String(t.email) === 'ramesh@test.com');
ck('guest ka thread admin ko dikhta hai', !!guestThread);
ck('guest thread me email hai', guestThread && guestThread.email === 'ramesh@test.com');
ck('admin guest ko reply kar sakta hai',
   guestThread && call('adminReplyMessage', {
     threadId: guestThread.id, text: 'Ji haan, Patna me free delivery hai.'
   }, tokA).success);

section('doGet / doPost / JSON contract');
const ping = JSON.parse(G.doGet({ parameter: {} }).getContent());
ck('doGet ping success', ping.success);
ck('ping me sheet name', ping.data.spreadsheet.name === 'pshopdb');
ck('ping me products count sahi', ping.data.sheets.Products === G.readAll('Products').length,
   `ping=${ping.data.sheets.Products} actual=${G.readAll('Products').length}`);
const post = JSON.parse(G.doPost({ postData: { contents:
  JSON.stringify({ action: 'getProducts', payload: {} }) } }).getContent());
ck('doPost JSON', post.success === true);
ck('response shape', 'success' in post && 'data' in post && 'message' in post);
const bad = JSON.parse(G.doPost({ postData: { contents: '{broken' } }).getContent());
ck('malformed JSON handle', !bad.success && bad.code === 400);
const unk = JSON.parse(G.doPost({ postData: { contents:
  JSON.stringify({ action: 'nope' }) } }).getContent());
ck('unknown action 404', !unk.success && unk.code === 404);

/* -------------------------------- SUMMARY -------------------------------- */
console.log('\n' + '='.repeat(60));
if (fail === 0) {
  console.log(`  \x1b[32m✅ ${pass}/${pass} PASSED — backend me koi error nahi\x1b[0m`);
} else {
  console.log(`  \x1b[31m${pass} passed, ${fail} failed\x1b[0m`);
  failures.forEach(f => console.log('   - ' + f));
}
console.log('='.repeat(60));
process.exit(fail ? 1 : 0);
