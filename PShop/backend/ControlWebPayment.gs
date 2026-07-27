/**
 * ============================================================================
 *  CONTROL WEB PAYMENT — Google Apps Script Backend
 *  ---------------------------------------------------------------------------
 *  Ye file Control Web Payment panel ke liye dedicated backend hai.
 *  Isme order management, payment tracking, status updates, aur reporting
 *  ke saare endpoints hain.
 *
 *  ============================ SETUP ============================
 *
 *  1. Google Sheet banayein → sheets.new
 *  2. Extensions → Apps Script
 *  3. Ye PURI FILE paste karein Code.gs me
 *  4. (Optional) CONFIG.SHEET_ID me apni Sheet ID daalein
 *  5. Deploy → New deployment → Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  6. Jo /exec URL mile, use config.js me API_BASE_URL me daalein
 *
 *  ========================== FEATURES ===========================
 *
 *  • adminOrders      — Saare orders dekhein (sabhi customers ke)
 *  • adminUpdateOrder — Order status change karein (cancel, ship, deliver)
 *  • adminPayments    — Payment records dekhein
 *  • adminRefund      — Refund process karein
 *  • adminStats       — Dashboard stats (revenue, counts, charts)
 *  • adminBulkUpdate  — Ek saath multiple orders ka status change
 *  • adminOrderDetail — Ek order ki poori detail
 *  • adminSearchOrders — Order search by ID, customer, AWB, phone
 *
 *  =========================================================================
 *  Version 1.0.0 · PShop Control Web Payment
 * ============================================================================
 */


/* ======================= CONFIGURATION ======================= */
var CWP_CONFIG = {
  SHEET_ID: '',  // Apni Sheet ID yahan daalein (ya khaali chhodein)
  SALT: 'PShop$2026$SecureSalt',
  CURRENCY: 'INR',
  ADMIN_EMAIL: 'admin@pshop.in',
  TOKEN_TTL_HOURS: 720,
  ORDER_STAGES: ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'],
  SHEETS: {
    USERS: 'Users',
    ORDERS: 'Orders',
    PAYMENTS: 'Payments',
    PRODUCTS: 'Products',
    SETTINGS: 'Settings'
  }
};

/* ======================= SPREADSHEET ACCESS ======================= */
var _ssCache = null;

function getSS() {
  if (_ssCache) return _ssCache;
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || ''; } catch(e) {}
  id = String(id || CWP_CONFIG.SHEET_ID || '').trim();
  if (id) { _ssCache = SpreadsheetApp.openById(id); return _ssCache; }
  _ssCache = SpreadsheetApp.getActiveSpreadsheet();
  return _ssCache;
}

function getSheet(name) {
  var ss = getSS();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(['_placeholder']);
  }
  return sheet;
}

function sheetToObjects(name) {
  var sheet = getSheet(name);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== '' && cell !== null; });
  }).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function objectsToSheet(name, objects) {
  var sheet = getSheet(name);
  sheet.clear();
  if (!objects.length) return;
  var headers = Object.keys(objects[0]);
  sheet.appendRow(headers);
  objects.forEach(function(obj) {
    sheet.appendRow(headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; }));
  });
}

function saveSheet(name, objects) {
  objectsToSheet(name, objects);
}

/* ======================= UTILITIES ======================= */
function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(data, message) {
  return { success: true, data: data, message: message || '' };
}

function fail(message, code) {
  return { success: false, data: null, message: message || 'Error', code: code || 400 };
}

function uid(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function hashPw(pw) {
  var raw = CWP_CONFIG.SALT + pw;
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return 'h' + hash.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('').slice(0, 40);
}

function validateToken(token) {
  if (!token) return null;
  var tokens = sheetToObjects(CWP_CONFIG.SHEETS.USERS);
  // Token column check — simple approach
  // In production, use a separate Tokens sheet
  return null; // Simplified for demo
}

function requireAdmin(payload) {
  // Check if user is admin — simplified for demo
  // In production, validate JWT token
  return true;
}

function nowISO() {
  return new Date().toISOString();
}

/* ======================= WEB APP ENTRY POINTS ======================= */

/**
 * GET handler — health check aur basic info
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return jsonOutput(ok({
        app: 'Control Web Payment',
        version: '1.0.0',
        status: 'running',
        time: nowISO()
      }, 'Backend is running.'));
    }

    return jsonOutput(ok({ action: action }, 'OK'));
  } catch (err) {
    return jsonOutput(fail('Server error: ' + err.message, 500));
  }
}

/**
 * POST handler — main API router
 * Request body: { action: string, payload: object, token: string }
 */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); }
      catch (parseErr) { return jsonOutput(fail('Invalid JSON body.', 400)); }
    }

    var action = body.action || '';
    var payload = body.payload || {};
    var token = body.token || '';

    // Admin actions require authentication
    var adminActions = {
      adminOrders: 1, adminUpdateOrder: 1, adminPayments: 1,
      adminRefund: 1, adminStats: 1, adminBulkUpdate: 1,
      adminOrderDetail: 1, adminSearchOrders: 1
    };

    if (adminActions[action]) {
      // Token validation — simplified for demo
      // In production, validate the token here
    }

    // Route to handler
    switch (action) {
      case 'adminOrders':         return jsonOutput(apiAdminOrders(payload));
      case 'adminUpdateOrder':    return jsonOutput(apiAdminUpdateOrder(payload));
      case 'adminPayments':       return jsonOutput(apiAdminPayments(payload));
      case 'adminRefund':         return jsonOutput(apiAdminRefund(payload));
      case 'adminStats':          return jsonOutput(apiAdminStats(payload));
      case 'adminBulkUpdate':     return jsonOutput(apiAdminBulkUpdate(payload));
      case 'adminOrderDetail':    return jsonOutput(apiAdminOrderDetail(payload));
      case 'adminSearchOrders':   return jsonOutput(apiAdminSearchOrders(payload));

      // Auth endpoints (reuse standard auth)
      case 'login':               return jsonOutput(apiLogin(payload));
      case 'signup':              return jsonOutput(apiSignup(payload));

      default:
        return jsonOutput(fail('Unknown action: ' + action, 404));
    }
  } catch (err) {
    return jsonOutput(fail('Server error: ' + err.message, 500));
  }
}


/* ========================================================================
   AUTH ENDPOINTS
   ======================================================================== */

function apiLogin(payload) {
  var identifier = String(payload.identifier || '').trim().toLowerCase();
  var password = String(payload.password || '');
  if (!identifier || !password) return fail('Please enter email and password.');

  var users = sheetToObjects(CWP_CONFIG.SHEETS.USERS);
  var user = null;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if ((String(u.email || '').toLowerCase() === identifier || u.phone === identifier) &&
        u.password === hashPw(password)) {
      user = u;
      break;
    }
  }
  if (!user) return fail('Invalid credentials.', 401);

  return ok({
    user: {
      id: user.id, name: user.name, email: user.email,
      phone: user.phone, role: user.role || 'customer',
      avatar: user.avatar || '', verified: !!user.verified
    },
    token: 'cwp.' + user.id
  }, 'Welcome back, ' + (user.name || 'Admin') + '!');
}

function apiSignup(payload) {
  return fail('Signup not available from control panel.');
}


/* ========================================================================
   ORDER MANAGEMENT ENDPOINTS
   ======================================================================== */

/**
 * Get all orders — with optional filters
 * payload: { status?, paymentStatus?, userId?, limit? }
 */
function apiAdminOrders(payload) {
  var orders = sheetToObjects(CWP_CONFIG.SHEETS.ORDERS);

  // Parse JSON fields
  orders = orders.map(function(o) {
    try {
      if (typeof o.items === 'string') o.items = JSON.parse(o.items);
      if (typeof o.totals === 'string') o.totals = JSON.parse(o.totals);
      if (typeof o.address === 'string') o.address = JSON.parse(o.address);
      if (typeof o.payment === 'string') o.payment = JSON.parse(o.payment);
      if (typeof o.timeline === 'string') o.timeline = JSON.parse(o.timeline);
    } catch(e) {}
    return o;
  });

  // Sort by date (newest first)
  orders.sort(function(a, b) {
    return new Date(b.placedAt || 0) - new Date(a.placedAt || 0);
  });

  // Apply filters
  if (payload.status && payload.status !== 'all') {
    orders = orders.filter(function(o) { return o.status === payload.status; });
  }
  if (payload.paymentStatus && payload.paymentStatus !== 'all') {
    orders = orders.filter(function(o) { return o.paymentStatus === payload.paymentStatus; });
  }
  if (payload.userId) {
    orders = orders.filter(function(o) { return o.userId === payload.userId; });
  }

  var limit = parseInt(payload.limit) || 500;
  orders = orders.slice(0, limit);

  return ok({ items: orders, total: orders.length }, 'Orders loaded.');
}

/**
 * Get single order detail
 * payload: { id }
 */
function apiAdminOrderDetail(payload) {
  var orders = sheetToObjects(CWP_CONFIG.SHEETS.ORDERS);
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === payload.id) { order = orders[i]; break; }
  }
  if (!order) return fail('Order not found.', 404);

  // Parse JSON fields
  try {
    if (typeof order.items === 'string') order.items = JSON.parse(order.items);
    if (typeof order.totals === 'string') order.totals = JSON.parse(order.totals);
    if (typeof order.address === 'string') order.address = JSON.parse(order.address);
    if (typeof order.payment === 'string') order.payment = JSON.parse(order.payment);
    if (typeof order.timeline === 'string') order.timeline = JSON.parse(order.timeline);
  } catch(e) {}

  return ok({ order: order }, 'Order details.');
}

/**
 * Update order status
 * payload: { id, status, reason? }
 */
function apiAdminUpdateOrder(payload) {
  if (!payload.id) return fail('Order ID required.');
  if (!payload.status) return fail('New status required.');

  var orders = sheetToObjects(CWP_CONFIG.SHEETS.ORDERS);
  var orderIdx = -1;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === payload.id) { orderIdx = i; break; }
  }
  if (orderIdx < 0) return fail('Order not found.', 404);

  var order = orders[orderIdx];
  var oldStatus = order.status;
  var newStatus = payload.status;

  // Parse existing JSON fields
  try {
    if (typeof order.timeline === 'string') order.timeline = JSON.parse(order.timeline);
    if (!Array.isArray(order.timeline)) order.timeline = [];
  } catch(e) { order.timeline = []; }

  // Update status
  order.status = newStatus;

  // Build timeline
  var stages = CWP_CONFIG.ORDER_STAGES;
  var stageIdx = stages.indexOf(newStatus);

  if (newStatus === 'Cancelled') {
    order.cancellable = false;
    order.cancelReason = payload.reason || 'Admin cancellation';
    order.cancelledAt = nowISO();
    order.paymentStatus = (order.payment && order.payment.method === 'cod') ? 'Cancelled' : 'Refund initiated';
    order.timeline.push({
      stage: 'Cancelled', done: true, at: nowISO(),
      note: 'Cancelled by admin — ' + (payload.reason || 'No reason given')
    });
  } else {
    // Update timeline for stage progression
    if (stageIdx >= 0) {
      // Mark all stages up to this one as done
      for (var s = 0; s <= stageIdx; s++) {
        var found = false;
        for (var t = 0; t < order.timeline.length; t++) {
          if (order.timeline[t].stage === stages[s]) { found = true; break; }
        }
        if (!found) {
          order.timeline.push({
            stage: stages[s], done: true,
            at: s === stageIdx ? nowISO() : (order.placedAt || nowISO()),
            note: getStageNote(stages[s])
          });
        }
      }
    }

    if (newStatus === 'Delivered') {
      order.returnable = true;
      order.cancellable = false;
      order.paymentStatus = 'Paid';
    }
  }

  // Save back to sheet
  // Serialize JSON fields for storage
  var saveOrder = Object.assign({}, order);
  if (Array.isArray(saveOrder.items)) saveOrder.items = JSON.stringify(saveOrder.items);
  if (typeof saveOrder.totals === 'object') saveOrder.totals = JSON.stringify(saveOrder.totals);
  if (typeof saveOrder.address === 'object') saveOrder.address = JSON.stringify(saveOrder.address);
  if (typeof saveOrder.payment === 'object') saveOrder.payment = JSON.stringify(saveOrder.payment);
  if (Array.isArray(saveOrder.timeline)) saveOrder.timeline = JSON.stringify(saveOrder.timeline);

  orders[orderIdx] = saveOrder;
  saveSheet(CWP_CONFIG.SHEETS.ORDERS, orders);

  // Parse back for response
  try {
    if (typeof order.items === 'string') order.items = JSON.parse(order.items);
    if (typeof order.totals === 'string') order.totals = JSON.parse(order.totals);
    if (typeof order.address === 'string') order.address = JSON.parse(order.address);
    if (typeof order.payment === 'string') order.payment = JSON.parse(order.payment);
  } catch(e) {}

  return ok({ order: order, oldStatus: oldStatus },
    'Order ' + payload.id + ' updated: ' + oldStatus + ' → ' + newStatus);
}

/**
 * Bulk update multiple orders
 * payload: { ids: [...], status, reason? }
 */
function apiAdminBulkUpdate(payload) {
  if (!Array.isArray(payload.ids) || !payload.ids.length) return fail('No order IDs provided.');
  if (!payload.status) return fail('New status required.');

  var results = [];
  var errors = [];

  payload.ids.forEach(function(id) {
    var res = apiAdminUpdateOrder({ id: id, status: payload.status, reason: payload.reason });
    if (res.success) {
      results.push(id);
    } else {
      errors.push({ id: id, message: res.message });
    }
  });

  return ok({
    updated: results,
    failed: errors,
    totalUpdated: results.length,
    totalFailed: errors.length
  }, results.length + ' order(s) updated, ' + errors.length + ' failed.');
}

/**
 * Search orders by text
 * payload: { q, status?, paymentStatus? }
 */
function apiAdminSearchOrders(payload) {
  var q = String(payload.q || '').trim().toLowerCase();
  if (!q) return apiAdminOrders(payload);

  var res = apiAdminOrders(payload);
  if (!res.success) return res;

  var filtered = res.data.items.filter(function(o) {
    return (
      String(o.id || '').toLowerCase().includes(q) ||
      String(o.address && o.address.name || '').toLowerCase().includes(q) ||
      String(o.address && o.address.phone || '').includes(q) ||
      String(o.address && o.address.city || '').toLowerCase().includes(q) ||
      String(o.awb || '').toLowerCase().includes(q) ||
      String(o.payment && o.payment.reference || '').toLowerCase().includes(q)
    );
  });

  return ok({ items: filtered, total: filtered.length }, filtered.length + ' results found.');
}


/* ========================================================================
   PAYMENT ENDPOINTS
   ======================================================================== */

/**
 * Get all payment records
 * payload: { status?, method? }
 */
function apiAdminPayments(payload) {
  var payments = sheetToObjects(CWP_CONFIG.SHEETS.PAYMENTS);
  var orders = sheetToObjects(CWP_CONFIG.SHEETS.ORDERS);

  // Build combined view from orders
  var paymentRecords = orders.map(function(o) {
    try {
      if (typeof o.totals === 'string') o.totals = JSON.parse(o.totals);
      if (typeof o.payment === 'string') o.payment = JSON.parse(o.payment);
    } catch(e) {}
    return {
      id: o.payment && o.payment.reference || 'N/A',
      orderId: o.id,
      method: o.payment && (o.payment.label || o.payment.method) || '—',
      amount: (o.totals && o.totals.total) || 0,
      status: o.paymentStatus || '—',
      date: o.placedAt || ''
    };
  });

  // Sort newest first
  paymentRecords.sort(function(a, b) {
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  // Filters
  if (payload.status && payload.status !== 'all') {
    paymentRecords = paymentRecords.filter(function(p) { return p.status === payload.status; });
  }
  if (payload.method && payload.method !== 'all') {
    paymentRecords = paymentRecords.filter(function(p) {
      return p.method.toLowerCase().includes(payload.method.toLowerCase());
    });
  }

  return ok({ items: paymentRecords, total: paymentRecords.length }, 'Payments loaded.');
}

/**
 * Process refund
 * payload: { orderId, amount?, reason? }
 */
function apiAdminRefund(payload) {
  if (!payload.orderId) return fail('Order ID required.');

  var orders = sheetToObjects(CWP_CONFIG.SHEETS.ORDERS);
  var orderIdx = -1;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === payload.orderId) { orderIdx = i; break; }
  }
  if (orderIdx < 0) return fail('Order not found.', 404);

  var order = orders[orderIdx];
  order.paymentStatus = 'Refund initiated';
  order.refundReason = payload.reason || 'Admin initiated refund';
  order.refundAt = nowISO();
  if (payload.amount) order.refundAmount = payload.amount;

  // Parse JSON for save
  try {
    if (typeof order.totals === 'object') order.totals = JSON.stringify(order.totals);
    if (typeof order.payment === 'object') order.payment = JSON.stringify(order.payment);
    if (typeof order.address === 'object') order.address = JSON.stringify(order.address);
    if (Array.isArray(order.items)) order.items = JSON.stringify(order.items);
    if (Array.isArray(order.timeline)) order.timeline = JSON.stringify(order.timeline);
  } catch(e) {}

  orders[orderIdx] = order;
  saveSheet(CWP_CONFIG.SHEETS.ORDERS, orders);

  return ok({ orderId: payload.orderId, refundStatus: 'initiated' },
    'Refund initiated for order ' + payload.orderId);
}


/* ========================================================================
   DASHBOARD STATS
   ======================================================================== */

/**
 * Get dashboard statistics
 */
function apiAdminStats(payload) {
  var orders = sheetToObjects(CWP_CONFIG.SHEETS.ORDERS);

  // Parse JSON fields
  orders.forEach(function(o) {
    try {
      if (typeof o.totals === 'string') o.totals = JSON.parse(o.totals);
    } catch(e) {}
  });

  var total = orders.length;
  var active = orders.filter(function(o) { return o.status !== 'Cancelled'; });
  var revenue = active.reduce(function(sum, o) { return sum + (Number(o.totals && o.totals.total) || 0); }, 0);
  var pending = orders.filter(function(o) {
    return ['Placed', 'Confirmed', 'Packed'].indexOf(o.status) >= 0;
  }).length;
  var delivered = orders.filter(function(o) { return o.status === 'Delivered'; }).length;
  var cancelled = orders.filter(function(o) { return o.status === 'Cancelled'; }).length;
  var paid = orders.filter(function(o) { return o.paymentStatus === 'Paid'; }).length;
  var pendingPayment = orders.filter(function(o) { return o.paymentStatus === 'Pending'; }).length;

  // Status breakdown
  var statusBreakdown = {};
  orders.forEach(function(o) {
    statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
  });

  // Payment method breakdown
  var methodBreakdown = {};
  orders.forEach(function(o) {
    try {
      var p = typeof o.payment === 'string' ? JSON.parse(o.payment) : o.payment;
      var method = (p && (p.label || p.method)) || 'Unknown';
      methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
    } catch(e) {}
  });

  // Daily revenue (last 14 days)
  var dailyRevenue = [];
  for (var d = 13; d >= 0; d--) {
    var date = new Date();
    date.setDate(date.getDate() - d);
    var key = date.toISOString().slice(0, 10);
    var dayRev = active.filter(function(o) {
      return o.placedAt && o.placedAt.slice(0, 10) === key;
    }).reduce(function(sum, o) { return sum + (Number(o.totals && o.totals.total) || 0); }, 0);
    dailyRevenue.push({ date: key, revenue: dayRev });
  }

  return ok({
    totalOrders: total,
    revenue: revenue,
    pending: pending,
    delivered: delivered,
    cancelled: cancelled,
    paid: paid,
    pendingPayment: pendingPayment,
    statusBreakdown: statusBreakdown,
    methodBreakdown: methodBreakdown,
    dailyRevenue: dailyRevenue
  }, 'Dashboard stats loaded.');
}


/* ========================================================================
   HELPER FUNCTIONS
   ======================================================================== */

function getStageNote(stage) {
  var notes = {
    'Placed': 'Order has been placed successfully.',
    'Confirmed': 'Order confirmed by admin.',
    'Packed': 'Item packed at fulfilment centre.',
    'Shipped': 'Shipped via courier.',
    'Out for Delivery': 'Out for delivery — arriving today.',
    'Delivered': 'Delivered successfully.'
  };
  return notes[stage] || 'Status updated to ' + stage;
}


/* ========================================================================
   SETUP — Run this once to create demo data
   ======================================================================== */

/**
 * Run this function once to set up demo data in your Google Sheet.
 * Select setupDemoData from the function dropdown and click Run.
 */
function setupDemoData() {
  var ss = getSS();

  // Create Users sheet with admin account
  var users = [{
    id: 'U0001', name: 'Demo Admin', email: 'admin@pshop.in',
    phone: '9000000001', password: hashPw('admin123'),
    role: 'admin', verified: 'true', avatar: '',
    gender: '', dob: '', createdAt: nowISO()
  }, {
    id: 'U0002', name: 'Demo Customer', email: 'demo@pshop.in',
    phone: '9876543210', password: hashPw('demo123'),
    role: 'customer', verified: 'true', avatar: '',
    gender: 'Male', dob: '1996-04-18', createdAt: nowISO()
  }];
  objectsToSheet(CWP_CONFIG.SHEETS.USERS, users);

  // Create empty Orders sheet
  objectsToSheet(CWP_CONFIG.SHEETS.ORDERS, []);

  // Create empty Payments sheet
  objectsToSheet(CWP_CONFIG.SHEETS.PAYMENTS, []);

  // Add some demo orders
  var demoOrders = [];
  var names = ['Rahul Sharma', 'Priya Singh', 'Amit Kumar', 'Sneha Patel', 'Vikram Reddy'];
  var cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad'];
  var statuses = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];
  var payMethods = [
    { method: 'cod', label: 'Cash on Delivery' },
    { method: 'upi', label: 'UPI' },
    { method: 'razorpay', label: 'Card / Netbanking' }
  ];

  for (var i = 0; i < 10; i++) {
    var placed = new Date();
    placed.setDate(placed.getDate() - Math.floor(Math.random() * 14));
    var status = statuses[Math.floor(Math.random() * statuses.length)];
    var pay = payMethods[Math.floor(Math.random() * payMethods.length)];
    var total = Math.floor(500 + Math.random() * 5000);

    demoOrders.push({
      id: 'PS2026' + String(10000000 + i),
      userId: 'U0002',
      items: JSON.stringify([{
        id: 'P001', name: 'Demo Product ' + (i + 1),
        price: total, qty: 1, image: ''
      }]),
      totals: JSON.stringify({ subtotal: total, total: total, shipping: 0, tax: 0 }),
      address: JSON.stringify({
        name: names[i % names.length], phone: '987654321' + i,
        line1: 'Street ' + (i + 1), city: cities[i % cities.length],
        state: 'Maharashtra', pin: '40000' + i
      }),
      payment: JSON.stringify(pay),
      paymentStatus: pay.method === 'cod' ? 'Pending' : 'Paid',
      status: status,
      awb: 'PSX' + Math.floor(1e9 + Math.random() * 9e9),
      courier: 'PShop Express',
      placedAt: placed.toISOString(),
      expectedAt: new Date(placed.getTime() + 4 * 86400000).toISOString(),
      cancellable: status !== 'Delivered' && status !== 'Cancelled',
      returnable: status === 'Delivered',
      timeline: JSON.stringify([{
        stage: 'Placed', done: true, at: placed.toISOString(),
        note: 'Order placed successfully.'
      }])
    });
  }

  objectsToSheet(CWP_CONFIG.SHEETS.ORDERS, demoOrders);

  Logger.log('✅ Demo data created successfully!');
  Logger.log('Admin login: admin@pshop.in / admin123');
  Logger.log('Customer login: demo@pshop.in / demo123');
}
