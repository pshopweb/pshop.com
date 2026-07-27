/**
 * ============================================================================
 *  PShop — COMPLETE BACKEND (SINGLE FILE)
 *  ---------------------------------------------------------------------------
 *  Ye ek hi file me poora backend hai. Alag-alag .gs files banane ki
 *  zaroorat NAHI hai — bas ye pura code copy karke Apps Script ke Code.gs
 *  me paste kar dein.
 *
 *  ============================ SETUP (5 MINUTE) ============================
 *
 *  1. Google Sheet banayein  →  sheets.new
 *  2. Extensions → Apps Script
 *  3. Purana code delete karke YE PURI FILE paste karein
 *  4. (Optional) Neeche CONFIG.SHEET_ID me apni Sheet ID daalein.
 *     Agar script Sheet ke andar se banaya hai to khaali chhod dein.
 *  5. Function dropdown se  setupDemoStore  choose karke ▶ Run dabayein
 *     → Ye SAB kuch bana dega: tables + demo products + users + orders
 *  6. Deploy → New deployment → Web app
 *        Execute as        : Me
 *        Who has access    : Anyone
 *  7. Jo /exec URL mile use assets/js/core/config.js ki API_BASE_URL me daalein
 *
 *  ========================== DEMO LOGIN DETAILS ===========================
 *
 *    Admin     :  admin@pshop.in   /  admin123
 *    Customer  :  demo@pshop.in    /  demo123
 *    Customer 2:  priya@pshop.in   /  priya123
 *    Customer 3:  rahul@pshop.in   /  rahul123
 *
 *  =========================================================================
 *  Version 1.0.0  ·  PShop Retail India Pvt. Ltd.
 * ============================================================================
 */



/* ============================================================================
 * SECTION 1: UTILITY.gs
 * Helper functions — sheet access, JSON responses, IDs, hashing, validation
 * ========================================================================== */
/* ======================= CONFIGURATION ======================= */
var CONFIG = {
  /* ====================================================================
     SHEET_ID — yahan apni Google Sheet ki ID paste karein.
     --------------------------------------------------------------------
     Sheet ka URL aisa dikhta hai:
     https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit
                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                            ye lamba hissa hi SHEET_ID hai

     Kab zaroori hai?
     • Agar aapne script ko Sheet ke andar se banaya (Extensions → Apps Script)
       to ise khaali chhod sakte hain — script khud apni Sheet dhoond leta hai.
     • Agar script ALAG project hai (script.google.com se banaya), ya aap ek
       folder me multiple files/scripts rakhte hain, to SHEET_ID dena ZAROORI hai.
     ==================================================================== */
  SHEET_ID: '',

  // Sheet ka naam (spreadsheet ke andar tabs).
  SHEETS: {
    USERS: 'Users', PRODUCTS: 'Products', CATEGORIES: 'Categories', ORDERS: 'Orders',
    CART: 'Cart', WISHLIST: 'Wishlist', PAYMENTS: 'Payments', MESSAGES: 'Messages',
    REVIEWS: 'Reviews', COUPONS: 'Coupons', NOTIFICATIONS: 'Notifications',
    DELIVERY: 'Delivery', SETTINGS: 'Settings', OTP: 'OTP'
  },
  SALT: 'PShop$2026$SecureSalt',        // Setup ke baad ise apne value se badal dein
  TOKEN_TTL_HOURS: 720,                 // 30 din
  OTP_TTL_MINUTES: 5,
  OTP_MAX_ATTEMPTS: 5,
  FREE_SHIP_ABOVE: 499,
  SHIPPING_FEE: 79,
  EXPRESS_FEE: 129,
  COD_FEE: 29,
  TAX_RATE: 0.18,
  CURRENCY: 'INR',
  ADMIN_EMAIL: 'admin@pshop.in',
  SUPPORT_EMAIL: 'care@pshop.in',
  SEND_EMAILS: true                     // false karne par OTP email nahi jayegi (testing)
};

/* ======================= SPREADSHEET ACCESS ======================= */

/**
 * Spreadsheet kholta hai. Teen tarike se ID dhoondta hai (priority order):
 *   1. Script Properties ka 'SHEET_ID'  (sabse flexible — code badle bina badal sakte hain)
 *   2. CONFIG.SHEET_ID                  (upar wali line me paste kiya hua)
 *   3. Active spreadsheet               (jab script Sheet ke andar se bana ho)
 */
var _ssCache = null;   // ek hi execution me spreadsheet dobara-dobara na khule

function getSS() {
  if (_ssCache) return _ssCache;

  // 1. Script Properties (Project Settings → Script Properties)
  var propId = '';
  try {
    propId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';
  } catch (e) { /* properties available nahi — ignore */ }

  var id = String(propId || CONFIG.SHEET_ID || '').trim();

  // Galti se poora URL paste kar diya ho to usme se ID nikal lo.
  if (id.indexOf('http') === 0) {
    var m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m) id = m[1];
  }

  if (id) {
    try {
      _ssCache = SpreadsheetApp.openById(id);
      return _ssCache;
    } catch (err) {
      throw new Error('SHEET_ID galat hai ya us Sheet tak aapki pahunch nahi hai. ' +
        'ID check karein: "' + id + '". Original error: ' + err.message);
    }
  }

  // 3. Container-bound script — Sheet ke andar se bana hua
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error(
      'Koi spreadsheet nahi mila. File ke shuru me CONFIG.SHEET_ID set karein, ' +
      'ya Project Settings → Script Properties me SHEET_ID add karein. ' +
      'Sheet URL me /d/ ke baad wala lamba hissa hi ID hai.');
  }
  _ssCache = active;
  return active;
}

/**
 * Sheet ID ko Script Properties me save karta hai (code badle bina).
 * Editor me is function ko ek baar run karein — pehle apni ID neeche daalein.
 */
function setSheetId() {
  var MY_SHEET_ID = '';   // <<< yahan apni Sheet ID paste karke Run dabayein

  if (!MY_SHEET_ID) {
    Logger.log('Pehle MY_SHEET_ID variable me apni Sheet ID paste karein.');
    return fail('No Sheet ID provided.');
  }
  var id = MY_SHEET_ID.trim();
  var m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) id = m[1];

  PropertiesService.getScriptProperties().setProperty('SHEET_ID', id);

  // Turant verify karo ki Sheet khul rahi hai.
  try {
    var ss = SpreadsheetApp.openById(id);
    Logger.log('✅ Sheet connected: "' + ss.getName() + '"  (ID: ' + id + ')');
    Logger.log('Ab setupDatabase() run karein.');
    return ok({ id: id, name: ss.getName() }, 'Sheet ID saved.');
  } catch (err) {
    PropertiesService.getScriptProperties().deleteProperty('SHEET_ID');
    Logger.log('❌ Ye ID nahi khul rahi: ' + err.message);
    return fail('Invalid Sheet ID: ' + err.message);
  }
}

/** Abhi kaunsi Sheet connected hai — check karne ke liye. */
function whichSheet() {
  try {
    var ss = getSS();
    var tabs = ss.getSheets().map(function (s) { return s.getName(); });
    Logger.log('Connected Sheet: "' + ss.getName() + '"');
    Logger.log('URL: ' + ss.getUrl());
    Logger.log('Tabs (' + tabs.length + '): ' + tabs.join(', '));
    return ok({ name: ss.getName(), url: ss.getUrl(), tabs: tabs });
  } catch (err) {
    Logger.log('❌ ' + err.message);
    return fail(err.message);
  }
}

/** Naam se sheet leta hai; na mile to headers ke saath bana deta hai. */
/**
 * Database ka poora schema — har sheet ke columns.
 * Ye ek hi jagah define hai taaki setupDatabase() aur getSheet() dono
 * same headers use karein. Naya column add karna ho to sirf yahan karein.
 */
function DB_SCHEMA() {
  return {
    Users: ['id','name','email','phone','password','role','verified','avatar','gender','dob',
            'addresses','status','createdAt','updatedAt','lastLogin'],
    Products: ['id','sku','name','slug','brand','categoryId','category','categorySlug','subCategory',
               'price','mrp','discount','stock','inStock','rating','ratingCount','reviewCount',
               'images','thumb','colors','highlights','description','specs','tags','deliveryDays',
               'returnDays','codAvailable','sold','status','createdAt','updatedAt'],
    Categories: ['id','name','slug','description','icon','banner','color','subCategories','brands',
                 'productCount','status','sortOrder','createdAt'],
    Orders: ['id','userId','items','address','contact','payment','totals','coupon','status',
             'paymentStatus','placedAt','expectedAt','deliveredAt','invoiceNo','awb','courier',
             'timeline','cancelReason','returnReason','cancellable','returnable','updatedAt'],
    Cart: ['id','userId','productId','name','brand','price','mrp','image','slug','variant','qty',
           'stock','codAvailable','addedAt'],
    Wishlist: ['id','userId','productId','name','brand','price','mrp','image','slug','rating',
               'discount','addedAt'],
    Payments: ['id','orderId','userId','method','amount','status','reference','app','last4',
               'refundStatus','refundAmount','refundedAt','createdAt'],
    Messages: ['id','userId','name','email','subject','thread','status','unread','createdAt','updatedAt'],
    Reviews: ['id','productId','userId','user','rating','title','comment','images','verified',
              'helpful','status','createdAt'],
    Coupons: ['code','type','value','minOrder','maxDiscount','description','usageLimit','usedCount',
              'expiry','active','createdAt'],
    Notifications: ['id','userId','title','body','type','link','read','createdAt'],
    Delivery: ['id','orderId','awb','courier','status','pincode','city','agent','agentPhone',
               'eta','updates','createdAt','updatedAt'],
    Settings: ['key','value','description','updatedAt'],
    OTP: ['identifier','code','purpose','attempts','expiresAt','createdAt'],
    Banners: ['id','title','subtitle','cta','link','image','theme','active','sortOrder'],
    FAQs: ['id','category','question','answer','sortOrder','active'],
    Newsletter: ['email','subscribedAt','status']
  };
}

var _sheetCache = {};   // sheet objects cache — repeated lookups fast karta hai

function getSheet(name, headers) {
  if (_sheetCache[name]) return _sheetCache[name];

  var ss = getSS();
  var sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  // Sheet mil gayi par headers nahi hain (blank tab, ya setup adhoora raha).
  // Aise me getLastColumn() = 0 aata hai aur getRange(1,1,1,0) crash karta hai:
  //   "The number of columns in the range must be at least 1"
  // Isliye headers khud likh dete hain — SCHEMA se ya caller se.
  if (sh.getLastColumn() === 0) {
    var hdrs = (headers && headers.length) ? headers : getSchemaHeaders(name);
    if (hdrs && hdrs.length) {
      sh.getRange(1, 1, 1, hdrs.length).setValues([hdrs])
        .setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      forceTextOnDateColumns(sh, hdrs);
    }
  }

  _sheetCache[name] = sh;
  return sh;
}

/**
 * Sheet ke standard headers deta hai.
 * SCHEMA ek hi jagah define hai (setupDatabase me tha) — ab yahan se
 * dono jagah use hota hai, taaki headers kabhi mismatch na hon.
 */
function getSchemaHeaders(name) {
  var SCHEMA = DB_SCHEMA();
  return SCHEMA[name] || null;
}

/** Cache saaf karta hai — setup ke baad ya sheets delete karne par zaroori. */
function clearSheetCache() {
  _ssCache = null;
  _sheetCache = {};
}

/** Sheet ke saare rows objects ki array me deta hai. */
function readAll(sheetName) {
  var sh = getSheet(sheetName);
  if (sh.getLastRow() < 2 || sh.getLastColumn() < 1) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('') === '') continue;            // blank row skip
    out.push(rowToObject(headers, row));
  }
  return out;
}

/** Header array + row array ko object me badalta hai (JSON fields parse karke). */
function rowToObject(headers, row) {
  var obj = {};
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c]).trim();
    if (!key) continue;
    obj[key] = parseCell(row[c]);
  }
  return obj;
}

/** JSON-looking strings ko object me parse karta hai. */
function parseCell(v) {
  // Google Sheets date-jaise text ko apne aap Date object bana deta hai.
  // Frontend ko hamesha ISO string chahiye, warna JSON me format badal jata
  // hai aur charts/filters tootte hain. Isliye yahin normalise kar dete hain.
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? '' : v.toISOString();
  }
  if (typeof v !== 'string') return v;
  var s = v.trim();
  if ((s.charAt(0) === '{' && s.charAt(s.length - 1) === '}') ||
      (s.charAt(0) === '[' && s.charAt(s.length - 1) === ']')) {
    try { return JSON.parse(s); } catch (e) { return v; }
  }
  if (s === 'TRUE' || s === 'true') return true;
  if (s === 'FALSE' || s === 'false') return false;
  return v;
}

/** Object ko sheet ke header order me row array banata hai. */
function objectToRow(headers, obj) {
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var v = obj[headers[i]];
    if (v === undefined || v === null) {
      v = '';
    } else if (v instanceof Date) {
      // Date ko ISO string banao — Sheets warna apne locale format me save
      // kar leta hai aur wapas padhne par galat parse hota hai.
      v = isNaN(v.getTime()) ? '' : v.toISOString();
    } else if (typeof v === 'object') {
      v = JSON.stringify(v);
    }
    row.push(v);
  }
  return row;
}

/**
 * Kai rows ek saath likhta hai — loop me appendRow() se 10-50x tez.
 * Apps Script me har appendRow ek alag API call hoti hai, isliye bade
 * seed operations me timeout aa sakta hai. Ye function ek hi call me likhta hai.
 */
function appendRows(sheetName, objects) {
  if (!objects || !objects.length) return 0;
  var sh = getSheet(sheetName);
  var headers = readHeaders(sh, sheetName);
  if (!headers.length) {
    throw new Error('Sheet "' + sheetName + '" me headers nahi hain. ' +
      'setupDatabase() ya setupDemoStore() ek baar run karein.');
  }
  var rows = [];
  for (var i = 0; i < objects.length; i++) {
    rows.push(objectToRow(headers, objects[i]));
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  return rows.length;
}

/** Sheet me ek naya row append karta hai. */
function appendRow(sheetName, obj) {
  var sh = getSheet(sheetName);
  var headers = readHeaders(sh, sheetName);
  if (!headers.length) {
    throw new Error('Sheet "' + sheetName + '" me headers nahi hain. ' +
      'setupDatabase() ya setupDemoStore() ek baar run karein.');
  }
  sh.appendRow(objectToRow(headers, obj));
  return obj;
}

/**
 * Sheet ke headers safely padhta hai.
 * getLastColumn() 0 de sakta hai (khaali sheet) — aise me getRange crash
 * karta hai, isliye pehle check karte hain aur SCHEMA se fallback lete hain.
 */
function readHeaders(sheet, sheetName) {
  var lastCol = sheet.getLastColumn();
  if (lastCol > 0) {
    return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  }
  // Khaali sheet — SCHEMA se headers likh do.
  var hdrs = getSchemaHeaders(sheetName);
  if (hdrs && hdrs.length) {
    sheet.getRange(1, 1, 1, hdrs.length).setValues([hdrs])
      .setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    return hdrs;
  }
  return [];
}

/** id ke basis par row update karta hai. Milne par true. */
function updateRow(sheetName, idField, idValue, patch) {
  var sh = getSheet(sheetName);
  if (sh.getLastRow() < 1 || sh.getLastColumn() < 1) return false;
  var values = sh.getDataRange().getValues();
  var headers = values[0] || [];
  var idCol = headers.indexOf(idField);
  if (idCol < 0) return false;

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(idValue)) {
      var current = rowToObject(headers, values[r]);
      for (var k in patch) { if (patch.hasOwnProperty(k)) current[k] = patch[k]; }
      sh.getRange(r + 1, 1, 1, headers.length).setValues([objectToRow(headers, current)]);
      return true;
    }
  }
  return false;
}

/** id ke basis par row delete karta hai. */
function deleteRow(sheetName, idField, idValue) {
  var sh = getSheet(sheetName);
  if (sh.getLastRow() < 1 || sh.getLastColumn() < 1) return false;
  var values = sh.getDataRange().getValues();
  var idCol = (values[0] || []).indexOf(idField);
  if (idCol < 0) return false;
  for (var r = values.length - 1; r >= 1; r--) {
    if (String(values[r][idCol]) === String(idValue)) { sh.deleteRow(r + 1); return true; }
  }
  return false;
}

/** Ek matching record dhoondhta hai. */
function findOne(sheetName, predicate) {
  var rows = readAll(sheetName);
  for (var i = 0; i < rows.length; i++) if (predicate(rows[i])) return rows[i];
  return null;
}

/** Saare matching records. */
function findAll(sheetName, predicate) {
  return readAll(sheetName).filter(predicate);
}

/* ======================= RESPONSES ======================= */

/** Success JSON response. */
function ok(data, message) {
  return { success: true, data: data === undefined ? null : data, message: message || '' };
}

/** Error JSON response. */
function fail(message, code) {
  return { success: false, data: null, message: message || 'Request failed', code: code || 400 };
}

/** Object ko Apps Script JSON output me convert karta hai. */
function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ======================= IDS & TIME ======================= */

/** Prefix ke saath unique ID. */
function uid(prefix) {
  var t = new Date().getTime().toString(36).toUpperCase();
  var r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return (prefix || 'ID') + t + r;
}

/** Sheet me sequential ID banata hai, jaise U0001, P0042. */
function nextId(sheetName, prefix, width) {
  var rows = readAll(sheetName);
  var max = 0;
  for (var i = 0; i < rows.length; i++) {
    var v = String(rows[i].id || '');
    if (v.indexOf(prefix) === 0) {
      var n = parseInt(v.substring(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  var num = String(max + 1);
  while (num.length < (width || 4)) num = '0' + num;
  return prefix + num;
}

/**
 * Kisi bhi value ko safe ISO date string banata hai.
 * Sheets se Date object, string, ya khaali cell — teeno handle karta hai.
 */
function toISO(v) {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
  var d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/**
 * Date ko YYYY-MM-DD me badalta hai (charts aur grouping ke liye).
 * UTC parts use karte hain taaki timezone se din na badle.
 */
function toDateKey(v) {
  var iso = toISO(v);
  return iso ? iso.slice(0, 10) : '';
}

/**
 * Date wale columns ko "Plain text" format deta hai.
 *
 * Kyun zaroori: Google Sheets ISO string ("2026-07-25T10:00:00Z") ko apne aap
 * Date object bana leta hai aur locale format me dikhata hai (25/07/2026).
 * Wapas padhne par format bigad jata hai aur charts, filters aur order
 * timeline kaam karna band kar dete hain. Plain text me jo likha wahi milta hai.
 */
function forceTextOnDateColumns(sheet, headers) {
  var DATE_COLS = ['createdAt', 'updatedAt', 'placedAt', 'expectedAt', 'deliveredAt',
                   'addedAt', 'lastLogin', 'expiresAt', 'subscribedAt', 'refundedAt',
                   'cancelledAt', 'returnedAt', 'eta', 'expiry', 'date', 'at'];
  for (var i = 0; i < headers.length; i++) {
    if (DATE_COLS.indexOf(headers[i]) === -1) continue;
    try {
      sheet.getRange(2, i + 1, Math.max(sheet.getMaxRows() - 1, 1), 1)
        .setNumberFormat('@');
    } catch (e) { /* chhoti sheet — skip */ }
  }
}

function nowISO() { return new Date().toISOString(); }

function addDays(date, days) {
  var d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/* ======================= SECURITY ======================= */

/** Password ka SHA-256 hash (salt ke saath). */
function hashPassword(password) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, CONFIG.SALT + String(password), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(raw);
}

/** Token banata hai: base64(userId|expiry|signature). */
function createToken(userId) {
  var expiry = new Date().getTime() + CONFIG.TOKEN_TTL_HOURS * 3600 * 1000;
  var payload = userId + '|' + expiry;
  var sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(payload, CONFIG.SALT));
  return Utilities.base64Encode(payload + '|' + sig);
}

/** Token verify karke userId return karta hai, warna null. */
function verifyToken(token) {
  if (!token) return null;
  try {
    var decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    var parts = decoded.split('|');
    if (parts.length !== 3) return null;
    var userId = parts[0], expiry = parseInt(parts[1], 10), sig = parts[2];
    if (new Date().getTime() > expiry) return null;
    var expected = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(userId + '|' + expiry, CONFIG.SALT));
    return sig === expected ? userId : null;
  } catch (e) { return null; }
}

/** Token se user object nikaalta hai (password ke bina). */
function getUserFromToken(token) {
  var userId = verifyToken(token);
  if (!userId) return null;
  var user = findOne(CONFIG.SHEETS.USERS, function (u) { return String(u.id) === String(userId); });
  return user ? publicUser(user) : null;
}

/** User object se password hata deta hai. */
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role || 'customer',
    verified: u.verified === true || u.verified === 'TRUE', avatar: u.avatar || '',
    gender: u.gender || '', dob: u.dob || '', createdAt: u.createdAt
  };
}

/* ======================= VALIDATION ======================= */

var V = {
  email: function (v) { return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(v || '').trim()); },
  phone: function (v) { return /^[6-9]\d{9}$/.test(String(v || '').replace(/\D/g, '').slice(-10)); },
  pin:   function (v) { return /^[1-9]\d{5}$/.test(String(v || '').trim()); },
  name:  function (v) { return String(v || '').trim().length >= 2; },
  pw:    function (v) { return String(v || '').length >= 6; },
  required: function (v) { return String(v === undefined || v === null ? '' : v).trim().length > 0; }
};

/** Email ya phone ko mask karta hai (de***@mail.com). */
function maskIdentifier(id) {
  id = String(id || '');
  if (id.indexOf('@') > -1) {
    var parts = id.split('@');
    var u = parts[0];
    return u.substring(0, 2) + repeatChar('*', Math.max(2, u.length - 2)) + '@' + parts[1];
  }
  return id.substring(0, 2) + '******' + id.substring(id.length - 2);
}

function repeatChar(ch, n) {
  var s = '';
  for (var i = 0; i < n; i++) s += ch;
  return s;
}

/* ======================= EMAIL ======================= */

/** HTML email bhejta hai (quota exceed hone par silently skip). */
function sendEmail(to, subject, htmlBody) {
  if (!CONFIG.SEND_EMAILS || !V.email(to)) return false;
  try {
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody, name: 'PShop' });
    return true;
  } catch (e) {
    Logger.log('Email failed: ' + e.message);
    return false;
  }
}

/** Brand ke saath email template. */
function emailTemplate(title, bodyHtml) {
  return '<div style="font-family:Inter,Segoe UI,sans-serif;max-width:560px;margin:auto;' +
    'border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
    '<div style="background:linear-gradient(120deg,#2563eb,#7c3aed);padding:22px;color:#fff">' +
    '<h1 style="margin:0;font-size:22px">PShop</h1></div>' +
    '<div style="padding:26px;color:#0f172a;line-height:1.6">' +
    '<h2 style="margin:0 0 12px;font-size:18px">' + title + '</h2>' + bodyHtml + '</div>' +
    '<div style="padding:16px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center">' +
    'PShop Retail India Pvt. Ltd. · ' + CONFIG.SUPPORT_EMAIL + '</div></div>';
}


/* ============================================================================
 * SECTION 2: AUTH.gs
 * Signup, login, OTP bhejna/verify, password reset aur change
 * ========================================================================== */
/** Naya account banata hai. */
function apiSignup(p) {
  if (!V.name(p.name))   return fail('Please enter a valid full name.');
  if (!V.email(p.email)) return fail('Please enter a valid email address.');
  if (!V.phone(p.phone)) return fail('Please enter a valid 10-digit mobile number.');
  if (!V.pw(p.password)) return fail('Password must be at least 6 characters.');

  var email = String(p.email).trim().toLowerCase();
  var phone = String(p.phone).replace(/\D/g, '').slice(-10);

  var existsEmail = findOne(CONFIG.SHEETS.USERS, function (u) {
    return String(u.email).toLowerCase() === email;
  });
  if (existsEmail) return fail('An account with this email already exists.');

  var existsPhone = findOne(CONFIG.SHEETS.USERS, function (u) {
    return String(u.phone) === phone;
  });
  if (existsPhone) return fail('This mobile number is already registered.');

  var user = {
    id: nextId(CONFIG.SHEETS.USERS, 'U', 4),
    name: String(p.name).trim(),
    email: email,
    phone: phone,
    password: hashPassword(p.password),
    role: 'customer',
    verified: false,
    avatar: '', gender: '', dob: '',
    addresses: '[]',
    status: 'active',
    createdAt: nowISO(), updatedAt: nowISO(), lastLogin: nowISO()
  };
  appendRow(CONFIG.SHEETS.USERS, user);

  // Welcome email + welcome notification.
  sendEmail(email, 'Welcome to PShop 🎉', emailTemplate('Welcome aboard, ' + user.name + '!',
    '<p>Your PShop account is ready. Use code <b>NEWUSER</b> for 15% off your first order.</p>' +
    '<p>Happy shopping!</p>'));

  pushNotification(user.id, 'Welcome to PShop',
    'Use code NEWUSER for 15% off your first order.', 'offer', 'pages/shop.html');

  return ok({ user: publicUser(user), token: createToken(user.id) },
    'Account created successfully.');
}

/** Email ya phone + password se login. */
function apiLogin(p) {
  var id = String(p.identifier || '').trim().toLowerCase();
  if (!id) return fail('Please enter your email or mobile number.');

  var user = findOne(CONFIG.SHEETS.USERS, function (u) {
    return String(u.email).toLowerCase() === id || String(u.phone) === id;
  });
  if (!user) return fail('No account found with those details.', 404);
  if (String(user.status) === 'blocked') return fail('This account has been suspended. Contact support.', 403);
  if (user.password !== hashPassword(p.password)) return fail('Incorrect password. Please try again.', 401);

  updateRow(CONFIG.SHEETS.USERS, 'id', user.id, { lastLogin: nowISO() });

  return ok({ user: publicUser(user), token: createToken(user.id) },
    'Welcome back, ' + String(user.name).split(' ')[0] + '!');
}

/**
 * OTP bhejta hai (login / signup / reset ke liye).
 * Purpose 'signup' ho to account ka hona zaroori nahi.
 */
function apiSendOtp(p) {
  var id = String(p.identifier || '').trim().toLowerCase();
  var purpose = p.purpose || 'login';
  var isEmail = V.email(id), isPhone = V.phone(id);

  if (!isEmail && !isPhone) return fail('Enter a valid email or 10-digit mobile number.');

  var user = findOne(CONFIG.SHEETS.USERS, function (u) {
    return String(u.email).toLowerCase() === id || String(u.phone) === id;
  });
  if (purpose !== 'signup' && !user) return fail('No account is linked to those details.', 404);

  // 6-digit random code.
  var code = String(Math.floor(100000 + Math.random() * 900000));
  var expiresAt = new Date(new Date().getTime() + CONFIG.OTP_TTL_MINUTES * 60000).toISOString();

  // Purana OTP hatao, naya daalo.
  deleteRow(CONFIG.SHEETS.OTP, 'identifier', id);
  appendRow(CONFIG.SHEETS.OTP, {
    identifier: id, code: code, purpose: purpose,
    attempts: 0, expiresAt: expiresAt, createdAt: nowISO()
  });

  // Email par OTP bhejo. (SMS ke liye apna gateway Delivery.gs me add kar sakte hain.)
  var target = isEmail ? id : (user ? user.email : '');
  if (target) {
    sendEmail(target, 'Your PShop verification code: ' + code,
      emailTemplate('Your verification code',
        '<p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#2563eb;margin:18px 0">' +
        code + '</p>' +
        '<p>This code is valid for ' + CONFIG.OTP_TTL_MINUTES + ' minutes. ' +
        'Please do not share it with anyone.</p>' +
        '<p style="color:#64748b;font-size:13px">If you did not request this, you can ignore this email.</p>'));
  }

  return ok({
    sentTo: isEmail ? 'email' : 'mobile',
    masked: maskIdentifier(id),
    expiresIn: CONFIG.OTP_TTL_MINUTES * 60
  }, 'OTP sent to your ' + (isEmail ? 'email' : 'registered email') + '.');
}

/** OTP verify karta hai; login purpose ho to token bhi deta hai. */
function apiVerifyOtp(p) {
  var code = String(p.code || '').trim();
  var id = String(p.identifier || '').trim().toLowerCase();

  // identifier na aaye to sabse naya OTP record use karo.
  var record = id
    ? findOne(CONFIG.SHEETS.OTP, function (o) { return String(o.identifier).toLowerCase() === id; })
    : latestOtpRecord();

  if (!record) return fail('No OTP request found. Please request a new code.');

  if (new Date(record.expiresAt).getTime() < new Date().getTime()) {
    deleteRow(CONFIG.SHEETS.OTP, 'identifier', record.identifier);
    return fail('This OTP has expired. Please request a new one.');
  }

  var attempts = parseInt(record.attempts, 10) || 0;
  if (attempts >= CONFIG.OTP_MAX_ATTEMPTS) {
    deleteRow(CONFIG.SHEETS.OTP, 'identifier', record.identifier);
    return fail('Too many incorrect attempts. Please request a new OTP.');
  }

  if (String(record.code) !== code) {
    updateRow(CONFIG.SHEETS.OTP, 'identifier', record.identifier, { attempts: attempts + 1 });
    return fail('Incorrect OTP. ' + (CONFIG.OTP_MAX_ATTEMPTS - attempts - 1) + ' attempt(s) left.');
  }

  // Sahi OTP — record hata do.
  deleteRow(CONFIG.SHEETS.OTP, 'identifier', record.identifier);

  var ident = String(record.identifier).toLowerCase();
  var user = findOne(CONFIG.SHEETS.USERS, function (u) {
    return String(u.email).toLowerCase() === ident || String(u.phone) === ident;
  });

  if (user) {
    updateRow(CONFIG.SHEETS.USERS, 'id', user.id, { verified: true, lastLogin: nowISO() });
    user.verified = true;
  }

  return ok({
    verified: true,
    purpose: record.purpose,
    identifier: record.identifier,
    user: user ? publicUser(user) : null,
    token: user ? createToken(user.id) : null
  }, 'Verification successful.');
}

/** OTP verify hone ke baad naya password set karta hai. */
function apiResetPassword(p) {
  if (!V.pw(p.password)) return fail('Password must be at least 6 characters.');
  var id = String(p.identifier || '').trim().toLowerCase();

  var user = findOne(CONFIG.SHEETS.USERS, function (u) {
    return String(u.email).toLowerCase() === id || String(u.phone) === id;
  });
  if (!user) return fail('Account not found.', 404);

  updateRow(CONFIG.SHEETS.USERS, 'id', user.id, {
    password: hashPassword(p.password), updatedAt: nowISO()
  });

  sendEmail(user.email, 'Your PShop password was changed',
    emailTemplate('Password updated',
      '<p>Your PShop password was changed on ' + new Date().toLocaleString('en-IN') + '.</p>' +
      '<p>If this was not you, please contact us immediately at ' + CONFIG.SUPPORT_EMAIL + '.</p>'));

  return ok({ reset: true }, 'Password updated. Please sign in.');
}

/** Logged-in user ka password change. */
function apiChangePassword(p, user) {
  if (!user) return fail('Please sign in to continue.', 401);

  var record = findOne(CONFIG.SHEETS.USERS, function (u) { return String(u.id) === String(user.id); });
  if (!record) return fail('Account not found.', 404);

  if (record.password !== hashPassword(p.current)) return fail('Your current password is incorrect.');
  if (!V.pw(p.next)) return fail('New password must be at least 6 characters.');

  updateRow(CONFIG.SHEETS.USERS, 'id', user.id, {
    password: hashPassword(p.next), updatedAt: nowISO()
  });

  return ok({ changed: true }, 'Password changed successfully.');
}

/** Sabse recent OTP row (fallback). */
function latestOtpRecord() {
  var rows = readAll(CONFIG.SHEETS.OTP);
  if (!rows.length) return null;
  rows.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return rows[0];
}


/* ============================================================================
 * SECTION 3: USER.gs
 * Profile read/update, address book aur image upload
 * ========================================================================== */
/** Profile details. */
function apiGetProfile(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var record = findOne(CONFIG.SHEETS.USERS, function (u) { return String(u.id) === String(user.id); });
  if (!record) return fail('Account not found.', 404);
  return ok({ user: publicUser(record) });
}

/** Profile update (name, email, phone, dob, gender, avatar). */
function apiUpdateProfile(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var patch = p.patch || p;
  var updates = { updatedAt: nowISO() };

  if (patch.name !== undefined) {
    if (!V.name(patch.name)) return fail('Please enter a valid name.');
    updates.name = String(patch.name).trim();
  }
  if (patch.email !== undefined) {
    if (!V.email(patch.email)) return fail('Please enter a valid email.');
    var email = String(patch.email).trim().toLowerCase();
    var clash = findOne(CONFIG.SHEETS.USERS, function (u) {
      return String(u.email).toLowerCase() === email && String(u.id) !== String(user.id);
    });
    if (clash) return fail('That email is already used by another account.');
    updates.email = email;
  }
  if (patch.phone !== undefined) {
    if (!V.phone(patch.phone)) return fail('Please enter a valid 10-digit mobile number.');
    var phone = String(patch.phone).replace(/\D/g, '').slice(-10);
    var clash2 = findOne(CONFIG.SHEETS.USERS, function (u) {
      return String(u.phone) === phone && String(u.id) !== String(user.id);
    });
    if (clash2) return fail('That mobile number is already registered.');
    updates.phone = phone;
  }
  if (patch.gender !== undefined) updates.gender = patch.gender;
  if (patch.dob !== undefined) updates.dob = patch.dob;
  if (patch.avatar !== undefined) updates.avatar = patch.avatar;

  updateRow(CONFIG.SHEETS.USERS, 'id', user.id, updates);

  var fresh = findOne(CONFIG.SHEETS.USERS, function (u) { return String(u.id) === String(user.id); });
  return ok({ user: publicUser(fresh) }, 'Profile updated.');
}

/** User ki saari addresses. */
function apiGetAddresses(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var record = findOne(CONFIG.SHEETS.USERS, function (u) { return String(u.id) === String(user.id); });
  var list = [];
  try { list = typeof record.addresses === 'string' ? JSON.parse(record.addresses || '[]') : (record.addresses || []); }
  catch (e) { list = []; }
  return ok({ items: list });
}

/** Address add ya update karta hai. */
function apiSaveAddress(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var a = p.address || {};

  if (!V.name(a.name))  return fail('Please enter the recipient name.');
  if (!V.phone(a.phone)) return fail('Please enter a valid 10-digit mobile number.');
  if (!V.pin(a.pin))    return fail('Please enter a valid 6-digit pincode.');
  if (!V.required(a.city))  return fail('Please enter your city.');
  if (!V.required(a.state)) return fail('Please select your state.');
  if (String(a.line1 || '').trim().length < 8) return fail('Please enter your full street address.');

  var res = apiGetAddresses({}, user);
  var list = res.data.items;

  // Client apna id bhej sakta hai (offline banaya hua). Agar wo id list me
  // mile to update karo, warna naya address maankar append karo.
  var found = false;
  if (a.id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === a.id) {
        list[i] = Object.assign({}, list[i], a);
        found = true;
        break;
      }
    }
  }
  if (!found) {
    a.id = a.id || uid('ADR');
    a.createdAt = a.createdAt || nowISO();
    list.push(a);
  }

  // Default sirf ek hi ho sakta hai.
  if (a.isDefault || list.length === 1) {
    for (var j = 0; j < list.length; j++) list[j].isDefault = (list[j].id === a.id);
  }

  updateRow(CONFIG.SHEETS.USERS, 'id', user.id,
    { addresses: JSON.stringify(list), updatedAt: nowISO() });

  return ok({ items: list, address: a }, 'Address saved.');
}

/** Address delete. */
function apiDeleteAddress(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var res = apiGetAddresses({}, user);
  var list = res.data.items.filter(function (a) { return a.id !== p.addressId; });

  // Default hat gaya to pehle wale ko default bana do.
  var hasDefault = list.some(function (a) { return a.isDefault; });
  if (list.length && !hasDefault) list[0].isDefault = true;

  updateRow(CONFIG.SHEETS.USERS, 'id', user.id,
    { addresses: JSON.stringify(list), updatedAt: nowISO() });

  return ok({ items: list }, 'Address deleted.');
}

/**
 * Base64 image ko Google Drive me save karke public URL deta hai.
 * payload: { base64: "data:image/jpeg;base64,...", filename: "avatar.jpg" }
 */
function apiUploadImage(p, user) {
  if (!user) return fail('Please sign in.', 401);
  if (!p.base64) return fail('Koi image nahi mili.');

  var ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  var MAX_BYTES = 5 * 1024 * 1024;   // 5 MB

  try {
    var raw = String(p.base64);
    var parts = raw.split(',');
    var meta = parts.length > 1 ? parts[0] : '';
    var data = parts.length > 1 ? parts[1] : parts[0];

    var mimeMatch = meta.match(/data:([^;]+);/);
    var mime = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';

    if (ALLOWED.indexOf(mime) === -1) {
      return fail('Sirf JPG, PNG, WEBP ya GIF image upload kar sakte hain. Mila: ' + mime);
    }

    // base64 ka approx size: har 4 char = 3 bytes
    var approxBytes = Math.floor(data.length * 3 / 4);
    if (approxBytes > MAX_BYTES) {
      return fail('Image bahut badi hai (' + Math.round(approxBytes / 1024 / 1024 * 10) / 10 +
                  ' MB). 5 MB se chhoti image use karein.');
    }

    var ext = mime.split('/')[1].replace('jpeg', 'jpg');
    var safeName = String(p.filename || '').replace(/[^\w.\-]/g, '_').slice(0, 60);
    if (!safeName) safeName = uid('IMG') + '.' + ext;

    var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, safeName);

    var folder = getUploadFolder(p.folder);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    var base = 'https://lh3.googleusercontent.com/d/' + fileId;

    // Google ka lh3 CDN =wNNN laga kar apne aap chhoti copy bana deta hai.
    // Isse listing me 400px ki image jati hai, poori 1600px nahi —
    // website 4-5x tez load hoti hai aur bandwidth bachta hai.
    return ok({
      url: base,                    // full size (product page, zoom)
      thumbUrl: base + '=w400',     // listing cards
      cardUrl: base + '=w800',      // tablet / retina cards
      altUrl: 'https://drive.google.com/uc?export=view&id=' + fileId,
      fileId: fileId,
      name: safeName,
      size: approxBytes,
      mime: mime
    }, 'Image upload ho gayi.');
  } catch (e) {
    return fail('Upload fail hua: ' + e.message, 500);
  }
}

/**
 * Ek saath kai images upload karta hai (product gallery ke liye).
 * payload: { images: [{ base64, filename }, ...], folder: 'Products' }
 */
function apiUploadImages(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var list = p.images || [];
  if (!list.length) return fail('Koi image nahi mili.');
  if (list.length > 6) return fail('Ek baar me zyada se zyada 6 images.');

  var uploaded = [], errors = [];
  for (var i = 0; i < list.length; i++) {
    var res = apiUploadImage({
      base64: list[i].base64,
      filename: list[i].filename,
      folder: p.folder
    }, user);
    if (res.success) uploaded.push(res.data);
    else errors.push((list[i].filename || ('Image ' + (i + 1))) + ': ' + res.message);
  }

  if (!uploaded.length) return fail(errors.join(' | '), 400);

  return ok({
    images: uploaded,
    urls: uploaded.map(function (u) { return u.url; }),
    failed: errors
  }, uploaded.length + ' image(s) upload ho gayi' +
     (errors.length ? ', ' + errors.length + ' fail hui' : '') + '.');
}

/** Uploads folder banata/deta hai. */
function getUploadFolder(subFolder) {
  var rootName = 'PShop Uploads';
  var it = DriveApp.getFoldersByName(rootName);
  var root = it.hasNext() ? it.next() : DriveApp.createFolder(rootName);

  if (!subFolder) return root;

  // Products / Avatars / Reviews jaise sub-folders — Drive saaf rehta hai.
  var safe = String(subFolder).replace(/[^\w \-]/g, '');
  var sub = root.getFoldersByName(safe);
  return sub.hasNext() ? sub.next() : root.createFolder(safe);
}


/* ============================================================================
 * SECTION 4: PRODUCT.gs
 * Product listing, filter, sort, pagination aur search
 * ========================================================================== */
/** Filter + sort + paginate ke saath products deta hai. */
function apiGetProducts(p) {
  var items = readAll(CONFIG.SHEETS.PRODUCTS).filter(function (x) {
    return String(x.status || 'active') === 'active';
  });

  items = filterProducts(items, p);
  items = sortProducts(items, p.sort);

  var total = items.length;
  var page = Math.max(1, parseInt(p.page, 10) || 1);
  var size = parseInt(p.pageSize, 10) || 12;

  var out = (p.all === true || p.all === 'true')
    ? items
    : items.slice((page - 1) * size, page * size);

  return ok({
    items: out.map(normalizeProduct),
    total: total, page: page, pageSize: size,
    pages: Math.max(1, Math.ceil(total / size))
  });
}

/** Ek product + related + reviews. */
function apiGetProduct(p) {
  var items = readAll(CONFIG.SHEETS.PRODUCTS);
  var found = null;
  for (var i = 0; i < items.length; i++) {
    if (String(items[i].id) === String(p.id) || String(items[i].slug) === String(p.slug)) {
      found = items[i]; break;
    }
  }
  if (!found) return fail('Product not found.', 404);

  var product = normalizeProduct(found);

  // Same category ke products, price ke hisab se sabse kareeb wale.
  var related = items
    .filter(function (x) {
      return x.categoryId === found.categoryId && x.id !== found.id &&
             String(x.status || 'active') === 'active';
    })
    .sort(function (a, b) {
      return Math.abs(a.price - found.price) - Math.abs(b.price - found.price);
    })
    .slice(0, 10)
    .map(normalizeProduct);

  var reviews = findAll(CONFIG.SHEETS.REVIEWS, function (r) {
    return String(r.productId) === String(found.id) && String(r.status || 'approved') === 'approved';
  });

  return ok({ product: product, related: related, reviews: reviews });
}

/** Search + suggestions. */
function apiSearchProducts(p) {
  var term = String(p.q || '').trim().toLowerCase();
  if (!term) return ok({ items: [], total: 0, suggestions: [] });

  var items = readAll(CONFIG.SHEETS.PRODUCTS).filter(function (x) {
    return String(x.status || 'active') === 'active';
  });

  var scored = [];
  for (var i = 0; i < items.length; i++) {
    var s = scoreProduct(items[i], term);
    if (s > 0) scored.push({ p: items[i], s: s });
  }
  scored.sort(function (a, b) { return b.s - a.s; });

  var limit = parseInt(p.limit, 10) || 8;

  // Suggestions: categories + brands + sub-categories.
  var suggestions = [];
  var cats = readAll(CONFIG.SHEETS.CATEGORIES);
  for (var c = 0; c < cats.length && suggestions.length < 3; c++) {
    if (String(cats[c].name).toLowerCase().indexOf(term) > -1) {
      suggestions.push({ type: 'category', label: cats[c].name, slug: cats[c].slug });
    }
  }
  var seenBrand = {};
  for (var b = 0; b < scored.length && suggestions.length < 6; b++) {
    var brand = scored[b].p.brand;
    if (brand && !seenBrand[brand] && String(brand).toLowerCase().indexOf(term) > -1) {
      seenBrand[brand] = 1;
      suggestions.push({ type: 'brand', label: brand });
    }
  }

  return ok({
    items: scored.slice(0, limit).map(function (x) { return normalizeProduct(x.p); }),
    total: scored.length,
    suggestions: suggestions
  });
}

/** Sidebar ke filter options (brands, sub-categories, price range, ratings). */
function apiGetFilters(p) {
  var items = readAll(CONFIG.SHEETS.PRODUCTS).filter(function (x) {
    return String(x.status || 'active') === 'active';
  });
  if (p.category) {
    items = items.filter(function (x) {
      return x.categorySlug === p.category || x.categoryId === p.category;
    });
  }

  var prices = items.map(function (x) { return Number(x.price) || 0; });

  return ok({
    brands: countBy(items, 'brand'),
    subCategories: countBy(items, 'subCategory'),
    categories: countBy(items, 'category'),
    min: prices.length ? Math.min.apply(null, prices) : 0,
    max: prices.length ? Math.max.apply(null, prices) : 0,
    ratings: [4, 3, 2, 1].map(function (r) {
      return { value: r, count: items.filter(function (x) { return Number(x.rating) >= r; }).length };
    })
  });
}

/* ======================= HELPERS ======================= */

/** Sheet row ko frontend ke expected shape me laata hai. */
function normalizeProduct(row) {
  var p = {};
  for (var k in row) if (row.hasOwnProperty(k)) p[k] = row[k];

  p.price = Number(p.price) || 0;
  p.mrp = Number(p.mrp) || p.price;
  p.discount = Number(p.discount) || (p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0);
  p.rating = Number(p.rating) || 0;
  p.ratingCount = Number(p.ratingCount) || 0;
  p.reviewCount = Number(p.reviewCount) || 0;
  p.stock = Number(p.stock) || 0;
  p.inStock = p.stock > 0;
  p.deliveryDays = Number(p.deliveryDays) || 3;
  p.returnDays = Number(p.returnDays) || 7;
  p.sold = Number(p.sold) || 0;
  p.codAvailable = p.codAvailable !== false && p.codAvailable !== 'FALSE';

  p.images = toArray(p.images);
  p.colors = toArray(p.colors);
  p.highlights = toArray(p.highlights);
  p.tags = toArray(p.tags);
  p.specs = toObject(p.specs);
  // Listing me hamesha chhoti copy bhejo — page tez load hota hai.
  p.thumb = makeThumbUrl(p.thumb || p.images[0] || '');

  return p;
}

/** String/array ko hamesha array banata hai. */
function toArray(v) {
  if (!v) return [];
  if (Object.prototype.toString.call(v) === '[object Array]') return v;
  if (typeof v === 'string') {
    var s = v.trim();
    if (s.charAt(0) === '[') { try { return JSON.parse(s); } catch (e) {} }
    return s ? s.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [];
  }
  return [];
}

function toObject(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return {}; }
}

/** Saare filters apply karta hai. */
function filterProducts(items, f) {
  f = f || {};

  if (f.category) {
    items = items.filter(function (p) {
      return p.categorySlug === f.category || p.categoryId === f.category;
    });
  }
  if (f.sub) {
    var subs = splitList(f.sub);
    items = items.filter(function (p) { return subs.indexOf(p.subCategory) > -1; });
  }
  if (f.brand) {
    var brands = splitList(f.brand);
    items = items.filter(function (p) { return brands.indexOf(p.brand) > -1; });
  }
  if (f.tag) {
    items = items.filter(function (p) { return toArray(p.tags).indexOf(f.tag) > -1; });
  }
  if (f.ids) {
    var ids = splitList(f.ids);
    items = items.filter(function (p) { return ids.indexOf(String(p.id)) > -1; });
  }
  if (f.minPrice) items = items.filter(function (p) { return Number(p.price) >= Number(f.minPrice); });
  if (f.maxPrice) items = items.filter(function (p) { return Number(p.price) <= Number(f.maxPrice); });
  if (f.rating)   items = items.filter(function (p) { return Number(p.rating) >= Number(f.rating); });
  if (f.discount) items = items.filter(function (p) { return Number(p.discount) >= Number(f.discount); });
  if (f.inStock === true || f.inStock === 'true') {
    items = items.filter(function (p) { return Number(p.stock) > 0; });
  }
  if (f.q) {
    var term = String(f.q).toLowerCase();
    items = items.filter(function (p) { return scoreProduct(p, term) > 5; });
  }
  return items;
}

function splitList(v) {
  if (Object.prototype.toString.call(v) === '[object Array]') return v;
  return String(v).split(',').filter(Boolean);
}

/** Sorting. */
function sortProducts(items, sort) {
  var out = items.slice();
  switch (sort) {
    case 'price-asc':  return out.sort(function (a, b) { return a.price - b.price; });
    case 'price-desc': return out.sort(function (a, b) { return b.price - a.price; });
    case 'rating':     return out.sort(function (a, b) { return b.rating - a.rating; });
    case 'discount':   return out.sort(function (a, b) { return b.discount - a.discount; });
    case 'newest':     return out.sort(function (a, b) {
                          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); });
    case 'popular':    return out.sort(function (a, b) { return (b.sold || 0) - (a.sold || 0); });
    case 'name':       return out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    default:
      // Relevance: rating × log(popularity)
      return out.sort(function (a, b) {
        var sa = (Number(a.rating) || 0) * Math.log(10 + (Number(a.ratingCount) || 0));
        var sb = (Number(b.rating) || 0) * Math.log(10 + (Number(b.ratingCount) || 0));
        return sb - sa;
      });
  }
}

/** Search relevance score. */
function scoreProduct(p, term) {
  var name = String(p.name || '').toLowerCase();
  var s = 0;
  if (name.indexOf(term) === 0) s += 100;
  if (name.indexOf(term) > -1) s += 60;
  if (String(p.brand || '').toLowerCase().indexOf(term) > -1) s += 40;
  if (String(p.subCategory || '').toLowerCase().indexOf(term) > -1) s += 30;
  if (String(p.category || '').toLowerCase().indexOf(term) > -1) s += 20;

  // Multi-word queries.
  var tokens = term.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    var haystack = (name + ' ' + p.brand + ' ' + p.category).toLowerCase();
    var all = true;
    for (var i = 0; i < tokens.length; i++) {
      if (haystack.indexOf(tokens[i]) === -1) { all = false; break; }
    }
    if (all) s += 45;
  }
  return s > 0 ? s + Math.min(Number(p.rating) || 0, 5) : 0;
}

/** Kisi field ke unique values + counts. */
function countBy(items, key) {
  var map = {};
  for (var i = 0; i < items.length; i++) {
    var v = items[i][key];
    if (!v) continue;
    map[v] = (map[v] || 0) + 1;
  }
  var out = [];
  for (var k in map) if (map.hasOwnProperty(k)) out.push({ value: k, count: map[k] });
  out.sort(function (a, b) { return String(a.value).localeCompare(String(b.value)); });
  return out;
}


/* ============================================================================
 * SECTION 5: CATEGORY.gs
 * Categories list aur single category
 * ========================================================================== */
/** Saari active categories. */
function apiGetCategories(p) {
  var cats = readAll(CONFIG.SHEETS.CATEGORIES).filter(function (c) {
    return String(c.status || 'active') === 'active';
  });
  var products = readAll(CONFIG.SHEETS.PRODUCTS).filter(function (x) {
    return String(x.status || 'active') === 'active';
  });

  var out = cats.map(function (c) {
    var mine = products.filter(function (p) { return p.categoryId === c.id; });
    return {
      id: c.id, name: c.name, slug: c.slug,
      description: c.description || '',
      icon: c.icon || '', banner: c.banner || '', color: c.color || '#2563eb',
      subCategories: toArray(c.subCategories),
      brands: uniqueValues(mine, 'brand'),
      productCount: mine.length,
      sortOrder: Number(c.sortOrder) || 999
    };
  });

  out.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  return ok({ items: out });
}

/** Ek category + uske products. */
function apiGetCategory(p) {
  var res = apiGetCategories({});
  var slug = p.slug || p.cat || p.id;
  var found = null;
  for (var i = 0; i < res.data.items.length; i++) {
    var c = res.data.items[i];
    if (c.slug === slug || c.id === slug) { found = c; break; }
  }
  if (!found) return fail('Category not found.', 404);

  var products = apiGetProducts({
    category: found.slug, page: p.page, pageSize: p.pageSize, sort: p.sort
  });

  return ok({ category: found, products: products.data });
}

/** Kisi field ke unique values. */
function uniqueValues(items, key) {
  var seen = {}, out = [];
  for (var i = 0; i < items.length; i++) {
    var v = items[i][key];
    if (v && !seen[v]) { seen[v] = 1; out.push(v); }
  }
  return out.sort();
}


/* ============================================================================
 * SECTION 6: CART.gs
 * Server-side cart — add, update, remove aur totals
 * ========================================================================== */
/** User ka cart + totals. */
function apiGetCart(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var items = findAll(CONFIG.SHEETS.CART, function (c) {
    return String(c.userId) === String(user.id);
  });
  return ok({ items: items, totals: calculateTotals(items, p.coupon, p.shipMode) });
}

/** Cart me product add karta hai (already ho to qty badha deta hai). */
function apiAddCart(p, user) {
  if (!user) return fail('Please sign in.', 401);
  if (!p.productId) return fail('No product specified.');

  var product = findOne(CONFIG.SHEETS.PRODUCTS, function (x) {
    return String(x.id) === String(p.productId);
  });
  if (!product) return fail('Product not found.', 404);
  if (Number(product.stock) <= 0) return fail('This product is out of stock.');

  var qty = Math.max(1, parseInt(p.qty, 10) || 1);
  var maxQty = Math.min(10, Number(product.stock));
  var variant = p.variant || '';

  var existing = findOne(CONFIG.SHEETS.CART, function (c) {
    return String(c.userId) === String(user.id) &&
           String(c.productId) === String(p.productId) &&
           String(c.variant || '') === String(variant);
  });

  if (existing) {
    var newQty = Math.min(maxQty, Number(existing.qty) + qty);
    updateRow(CONFIG.SHEETS.CART, 'id', existing.id, { qty: newQty });
  } else {
    appendRow(CONFIG.SHEETS.CART, {
      id: uid('CRT'), userId: user.id, productId: product.id,
      name: product.name, brand: product.brand,
      price: Number(product.price), mrp: Number(product.mrp),
      image: product.thumb || toArray(product.images)[0] || '',
      slug: product.slug, variant: variant,
      qty: Math.min(qty, maxQty), stock: Number(product.stock),
      codAvailable: product.codAvailable !== false,
      addedAt: nowISO()
    });
  }

  return apiGetCart(p, user);
}

/** Quantity update. */
function apiUpdateCart(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var line = findOne(CONFIG.SHEETS.CART, function (c) {
    return String(c.id) === String(p.lineId) && String(c.userId) === String(user.id);
  });
  if (!line) return fail('Cart item not found.', 404);

  var qty = parseInt(p.qty, 10) || 1;
  var max = Math.min(10, Number(line.stock) || 10);
  qty = Math.max(1, Math.min(qty, max));

  updateRow(CONFIG.SHEETS.CART, 'id', line.id, { qty: qty });
  return apiGetCart(p, user);
}

/** Ek line remove. */
function apiRemoveCart(p, user) {
  if (!user) return fail('Please sign in.', 401);
  deleteRow(CONFIG.SHEETS.CART, 'id', p.lineId);
  return apiGetCart(p, user);
}

/** Pura cart khaali. */
function apiClearCart(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var sh = getSheet(CONFIG.SHEETS.CART);
  var values = sh.getDataRange().getValues();
  var col = values[0].indexOf('userId');
  for (var r = values.length - 1; r >= 1; r--) {
    if (String(values[r][col]) === String(user.id)) sh.deleteRow(r + 1);
  }
  return ok({ items: [], totals: calculateTotals([], null) }, 'Cart cleared.');
}

/**
 * Totals nikalta hai — frontend ke Cart.totals() se bilkul same logic.
 * @param {Array} items
 * @param {Object} coupon
 * @param {string} shipMode 'standard' | 'express'
 */
function calculateTotals(items, coupon, shipMode) {
  var subtotal = 0, mrpTotal = 0, count = 0;
  for (var i = 0; i < items.length; i++) {
    var qty = Number(items[i].qty) || 1;
    var price = Number(items[i].price) || 0;
    var mrp = Number(items[i].mrp) || price;
    subtotal += price * qty;
    mrpTotal += mrp * qty;
    count += qty;
  }

  var savings = Math.max(0, mrpTotal - subtotal);
  var discount = 0, freeShip = false;

  if (coupon) {
    if (coupon.type === 'percent') {
      discount = Math.min(Math.round(subtotal * Number(coupon.value) / 100),
                          Number(coupon.maxDiscount) || subtotal);
    } else if (coupon.type === 'flat') {
      discount = Math.min(Number(coupon.value), subtotal);
    } else if (coupon.type === 'shipping') {
      freeShip = true;
    }
  }

  var taxable = Math.max(0, subtotal - discount);
  var shipping = 0;
  if (taxable > 0) {
    shipping = (shipMode === 'express')
      ? CONFIG.EXPRESS_FEE
      : (taxable >= CONFIG.FREE_SHIP_ABOVE ? 0 : CONFIG.SHIPPING_FEE);
    if (freeShip && shipMode !== 'express') shipping = 0;
  }

  // Listed prices GST-inclusive hain; tax sirf dikhane ke liye.
  var tax = Math.round(taxable - taxable / (1 + CONFIG.TAX_RATE));

  return {
    count: count, lines: items.length,
    subtotal: subtotal, mrpTotal: mrpTotal, savings: savings,
    discount: discount, shipping: shipping, tax: tax,
    total: taxable + shipping,
    freeShipEligible: taxable >= CONFIG.FREE_SHIP_ABOVE,
    amountToFreeShip: Math.max(0, CONFIG.FREE_SHIP_ABOVE - taxable),
    couponCode: coupon ? coupon.code : null
  };
}


/* ============================================================================
 * SECTION 7: WISHLIST.gs
 * Saved products add / remove / list
 * ========================================================================== */
function apiGetWishlist(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var items = findAll(CONFIG.SHEETS.WISHLIST, function (w) {
    return String(w.userId) === String(user.id);
  });
  items.sort(function (a, b) {
    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
  });
  return ok({ items: items, count: items.length });
}

function apiAddWishlist(p, user) {
  if (!user) return fail('Please sign in.', 401);

  var already = findOne(CONFIG.SHEETS.WISHLIST, function (w) {
    return String(w.userId) === String(user.id) && String(w.productId) === String(p.productId);
  });
  if (already) return apiGetWishlist(p, user);

  var product = findOne(CONFIG.SHEETS.PRODUCTS, function (x) {
    return String(x.id) === String(p.productId);
  });
  if (!product) return fail('Product not found.', 404);

  appendRow(CONFIG.SHEETS.WISHLIST, {
    id: uid('WSH'), userId: user.id, productId: product.id,
    name: product.name, brand: product.brand,
    price: Number(product.price), mrp: Number(product.mrp),
    image: product.thumb || toArray(product.images)[0] || '',
    slug: product.slug, rating: Number(product.rating) || 0,
    discount: Number(product.discount) || 0, addedAt: nowISO()
  });

  return apiGetWishlist(p, user);
}

function apiRemoveWishlist(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var row = findOne(CONFIG.SHEETS.WISHLIST, function (w) {
    return String(w.userId) === String(user.id) &&
           (String(w.productId) === String(p.productId) || String(w.id) === String(p.id));
  });
  if (row) deleteRow(CONFIG.SHEETS.WISHLIST, 'id', row.id);
  return apiGetWishlist(p, user);
}


/* ============================================================================
 * SECTION 8: ORDER.gs
 * Order place, list, track, cancel, return/replace aur timeline
 * ========================================================================== */
var ORDER_STAGES = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

/** Naya order banata hai. */
function apiPlaceOrder(p, user) {
  if (!user) return fail('Please sign in to place an order.', 401);

  var items = p.items || [];
  if (!items.length) return fail('Your cart is empty.');
  if (!p.address)    return fail('Please select a delivery address.');
  if (!p.payment)    return fail('Please choose a payment method.');

  var isCod = p.payment.method === 'cod';

  // Stock + COD check — order lene se pehle dono verify karte hain.
  for (var i = 0; i < items.length; i++) {
    var pid = items[i].productId || items[i].id;
    var prod = findOne(CONFIG.SHEETS.PRODUCTS, function (x) {
      return String(x.id) === String(pid);
    });
    if (!prod) continue;

    if (Number(prod.stock) < Number(items[i].qty)) {
      return fail('"' + prod.name + '" has only ' + prod.stock + ' unit(s) left.');
    }

    // Kuch products par COD allowed nahi hota — server par bhi rokna zaroori
    // hai, warna koi seedha API call karke COD order bhej sakta hai.
    if (isCod && (prod.codAvailable === false || prod.codAvailable === 'FALSE')) {
      return fail('"' + prod.name + '" par Cash on Delivery available nahi hai. ' +
                  'Please choose UPI or Card payment.');
    }
  }

  // COD fee server par hi jodte hain — client ke bheje totals par bharosa nahi.
  var totals = p.totals || {};
  if (isCod) {
    var baseTotal = Number(totals.total) || 0;
    if (!Number(totals.codFee)) {
      totals.codFee = CONFIG.COD_FEE;
      totals.total = baseTotal + CONFIG.COD_FEE;
    }
  } else {
    totals.codFee = 0;
  }

  var now = new Date();
  var status = isCod ? 'Placed' : 'Confirmed';

  var order = {
    id: 'PS' + now.getFullYear() + String(now.getTime()).slice(-8),
    userId: user.id,
    items: JSON.stringify(items),
    address: JSON.stringify(p.address),
    contact: JSON.stringify(p.contact || {}),
    payment: JSON.stringify(p.payment),
    totals: JSON.stringify(totals),
    coupon: p.coupon ? JSON.stringify(p.coupon) : '',
    status: status,
    paymentStatus: isCod ? 'Pending' : 'Paid',
    placedAt: now.toISOString(),
    expectedAt: addDays(now, p.shipMode === 'express' ? 2 : 4).toISOString(),
    deliveredAt: '',
    invoiceNo: 'INV-' + now.getFullYear() + '-' + String(now.getTime()).slice(-6),
    awb: 'PSX' + Math.floor(1e9 + Math.random() * 9e9),
    courier: 'PShop Express',
    timeline: JSON.stringify(buildTimeline(status, now)),
    cancelReason: '', returnReason: '',
    cancellable: true, returnable: false,
    updatedAt: now.toISOString()
  };

  appendRow(CONFIG.SHEETS.ORDERS, order);

  // Stock ghatao aur sold badhao.
  for (var j = 0; j < items.length; j++) {
    var pid = items[j].productId || items[j].id;
    var prod2 = findOne(CONFIG.SHEETS.PRODUCTS, function (x) { return String(x.id) === String(pid); });
    if (prod2) {
      updateRow(CONFIG.SHEETS.PRODUCTS, 'id', pid, {
        stock: Math.max(0, Number(prod2.stock) - Number(items[j].qty)),
        sold: (Number(prod2.sold) || 0) + Number(items[j].qty),
        updatedAt: nowISO()
      });
    }
  }

  // Coupon usage + delivery record + cart clear.
  if (p.coupon && p.coupon.code) incrementCouponUsage(p.coupon.code);
  createDeliveryRecord(order);
  apiClearCart({}, user);

  // Notification + confirmation email.
  pushNotification(user.id, 'Order placed successfully',
    'Order ' + order.id + ' for ' + items.length + ' item(s) is confirmed.',
    'order', 'pages/order-details.html?id=' + order.id);

  sendOrderEmail(user, order, items, p.totals);

  return ok({ order: hydrateOrder(order) }, 'Order placed successfully.');
}

/** User ke saare orders. */
function apiGetOrders(p, user) {
  if (!user) return fail('Please sign in.', 401);
  var list = findAll(CONFIG.SHEETS.ORDERS, function (o) {
    return String(o.userId) === String(user.id);
  });
  if (p.status && p.status !== 'all') {
    list = list.filter(function (o) { return o.status === p.status; });
  }
  list.sort(function (a, b) {
    return new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime();
  });
  return ok({ items: list.map(hydrateOrder), total: list.length });
}

/** Ek order ki poori detail. */
function apiGetOrder(p, user) {
  var order = findOne(CONFIG.SHEETS.ORDERS, function (o) { return String(o.id) === String(p.id); });
  if (!order) return fail('Order not found.', 404);
  // Sirf apna order ya admin dekh sakta hai.
  if (user && user.role !== 'admin' && String(order.userId) !== String(user.id)) {
    return fail('You do not have access to this order.', 403);
  }
  return ok({ order: hydrateOrder(order) });
}

/**
 * Cart COD ke liye eligible hai ya nahi — checkout page isse call karta hai.
 * Kaunse items block kar rahe hain, wo bhi batata hai.
 */
function apiCheckCod(p) {
  var items = p.items || [];
  if (!items.length) return ok({ eligible: false, reason: 'Cart khaali hai.' });

  var blocked = [];
  for (var i = 0; i < items.length; i++) {
    var pid = items[i].productId || items[i].id;
    var prod = findOne(CONFIG.SHEETS.PRODUCTS, function (x) {
      return String(x.id) === String(pid);
    });
    if (prod && (prod.codAvailable === false || prod.codAvailable === 'FALSE')) {
      blocked.push(prod.name);
    }
  }

  return ok({
    eligible: blocked.length === 0,
    blockedItems: blocked,
    codFee: CONFIG.COD_FEE,
    reason: blocked.length
      ? blocked.length + ' item(s) par COD available nahi hai'
      : 'COD available hai'
  });
}

/** Order ID se tracking (login ki zaroorat nahi). */
function apiTrackOrder(p) {
  var order = findOne(CONFIG.SHEETS.ORDERS, function (o) {
    return String(o.id).toUpperCase() === String(p.id || '').trim().toUpperCase();
  });
  if (!order) return fail('We could not find that order ID.', 404);

  var h = hydrateOrder(order);
  return ok({
    order: {
      id: h.id, status: h.status, awb: h.awb, courier: h.courier,
      placedAt: h.placedAt, expectedAt: h.expectedAt,
      address: h.address, items: h.items, timeline: h.timeline
    }
  });
}

/** Order cancel. */
function apiCancelOrder(p, user) {
  var order = findOne(CONFIG.SHEETS.ORDERS, function (o) { return String(o.id) === String(p.id); });
  if (!order) return fail('Order not found.', 404);
  if (user && user.role !== 'admin' && String(order.userId) !== String(user.id)) {
    return fail('You do not have access to this order.', 403);
  }

  if (['Delivered', 'Cancelled', 'Returned'].indexOf(order.status) > -1) {
    return fail('This order is already ' + String(order.status).toLowerCase() + ' and cannot be cancelled.');
  }

  var timeline = toArray(order.timeline);
  timeline.push({
    stage: 'Cancelled', done: true, at: nowISO(),
    note: 'Cancelled by customer — ' + (p.reason || 'Not specified')
  });

  var payment = toObject(order.payment);
  updateRow(CONFIG.SHEETS.ORDERS, 'id', order.id, {
    status: 'Cancelled', cancellable: false,
    cancelReason: p.reason || 'Not specified',
    paymentStatus: payment.method === 'cod' ? 'Cancelled' : 'Refund initiated',
    timeline: JSON.stringify(timeline), updatedAt: nowISO()
  });

  // Stock wapas add karo.
  var items = toArray(order.items);
  for (var i = 0; i < items.length; i++) {
    var pid = items[i].productId || items[i].id;
    var prod = findOne(CONFIG.SHEETS.PRODUCTS, function (x) { return String(x.id) === String(pid); });
    if (prod) {
      updateRow(CONFIG.SHEETS.PRODUCTS, 'id', pid, {
        stock: Number(prod.stock) + Number(items[i].qty),
        sold: Math.max(0, (Number(prod.sold) || 0) - Number(items[i].qty))
      });
    }
  }

  // Prepaid order ka refund shuru karo.
  if (payment.method !== 'cod') initiateRefund(order.id, toObject(order.totals).total);

  pushNotification(order.userId, 'Order cancelled',
    'Order ' + order.id + ' has been cancelled.', 'order',
    'pages/order-details.html?id=' + order.id);

  var fresh = findOne(CONFIG.SHEETS.ORDERS, function (o) { return String(o.id) === String(order.id); });
  return ok({ order: hydrateOrder(fresh) },
    'Order cancelled. Refund (if any) starts within 24 hours.');
}

/** Return ya replacement request. */
function apiReturnOrder(p, user) {
  var order = findOne(CONFIG.SHEETS.ORDERS, function (o) { return String(o.id) === String(p.id); });
  if (!order) return fail('Order not found.', 404);
  if (user && user.role !== 'admin' && String(order.userId) !== String(user.id)) {
    return fail('You do not have access to this order.', 403);
  }
  if (order.status !== 'Delivered') {
    return fail('Only delivered orders can be returned or replaced.');
  }

  var mode = p.mode === 'replace' ? 'replace' : 'return';
  var status = mode === 'replace' ? 'Replacement requested' : 'Return requested';

  var timeline = toArray(order.timeline);
  timeline.push({
    stage: status, done: true, at: nowISO(),
    note: (mode === 'replace' ? 'Replacement' : 'Return') + ' requested — ' + (p.reason || 'Not specified')
  });

  updateRow(CONFIG.SHEETS.ORDERS, 'id', order.id, {
    status: status, returnReason: p.reason || 'Not specified',
    paymentStatus: mode === 'replace' ? order.paymentStatus : 'Refund initiated',
    timeline: JSON.stringify(timeline), updatedAt: nowISO()
  });

  if (mode !== 'replace') initiateRefund(order.id, toObject(order.totals).total);

  pushNotification(order.userId, status,
    'We received your request for order ' + order.id + '. Pickup will be scheduled in 24–48 hrs.',
    'order', 'pages/order-details.html?id=' + order.id);

  var fresh = findOne(CONFIG.SHEETS.ORDERS, function (o) { return String(o.id) === String(order.id); });
  return ok({ order: hydrateOrder(fresh) },
    (mode === 'replace' ? 'Replacement' : 'Return') + ' request submitted.');
}

/* ======================= HELPERS ======================= */

/** Sheet row ke JSON fields ko objects me badalta hai. */
function hydrateOrder(o) {
  return {
    id: o.id, userId: o.userId,
    items: toArray(o.items),
    address: toObject(o.address),
    contact: toObject(o.contact),
    payment: toObject(o.payment),
    totals: toObject(o.totals),
    coupon: o.coupon ? toObject(o.coupon) : null,
    status: o.status, paymentStatus: o.paymentStatus,
    placedAt: o.placedAt, expectedAt: o.expectedAt, deliveredAt: o.deliveredAt,
    invoiceNo: o.invoiceNo, awb: o.awb, courier: o.courier,
    timeline: toArray(o.timeline),
    cancelReason: o.cancelReason, returnReason: o.returnReason,
    cancellable: o.cancellable === true || o.cancellable === 'TRUE',
    returnable: o.returnable === true || o.returnable === 'TRUE'
  };
}

/** Status ke hisab se timeline banata hai. */
function buildTimeline(status, placedAt) {
  var idx = ORDER_STAGES.indexOf(status);
  var base = new Date(placedAt);
  var notes = [
    'Your order has been placed successfully.',
    'Seller confirmed the order.',
    'Item packed at the fulfilment centre.',
    'Shipped via PShop Express.',
    'Arriving today — keep your phone handy.',
    'Delivered. Thank you for shopping with PShop!'
  ];
  var out = [];
  for (var i = 0; i < ORDER_STAGES.length; i++) {
    out.push({
      stage: ORDER_STAGES[i],
      done: idx >= 0 && i <= idx,
      at: (idx >= 0 && i <= idx) ? addDays(base, i).toISOString() : null,
      note: notes[i]
    });
  }
  return out;
}

/** Order confirmation email. */
function sendOrderEmail(user, order, items, totals) {
  var rows = '';
  for (var i = 0; i < items.length; i++) {
    rows += '<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">' +
      items[i].name + '<br><span style="color:#64748b;font-size:12px">Qty ' + items[i].qty + '</span></td>' +
      '<td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">₹' +
      (Number(items[i].price) * Number(items[i].qty)) + '</td></tr>';
  }
  sendEmail(user.email, 'Order confirmed: ' + order.id,
    emailTemplate('Thank you for your order!',
      '<p>Hi ' + user.name + ', your order <b>' + order.id + '</b> is confirmed.</p>' +
      '<table style="width:100%;border-collapse:collapse;margin:14px 0">' + rows +
      '<tr><td style="padding:8px;font-weight:800">Total</td>' +
      '<td style="padding:8px;text-align:right;font-weight:800">₹' +
      ((totals && totals.total) || 0) + '</td></tr></table>' +
      '<p>Expected delivery: <b>' + new Date(order.expectedAt).toDateString() + '</b><br>' +
      'Tracking ID: ' + order.awb + '</p>'));
}


/* ============================================================================
 * SECTION 9: PAYMENT.gs
 * Payment record, status check aur refund handling
 * ========================================================================== */
/** Payment record save karta hai. */
function apiSavePayment(p, user) {
  if (!p.orderId) return fail('No order specified.');

  var record = {
    id: uid('PAY'),
    orderId: p.orderId,
    userId: user ? user.id : (p.userId || 'guest'),
    method: p.method || 'cod',
    amount: Number(p.amount) || 0,
    status: p.status || 'Paid',
    reference: p.reference || uid('TXN'),
    app: p.app || '',
    last4: p.last4 || '',
    refundStatus: '', refundAmount: '', refundedAt: '',
    createdAt: nowISO()
  };
  appendRow(CONFIG.SHEETS.PAYMENTS, record);

  // Order par payment status update.
  updateRow(CONFIG.SHEETS.ORDERS, 'id', p.orderId,
    { paymentStatus: record.status, updatedAt: nowISO() });

  return ok({ payment: record }, 'Payment recorded.');
}

/** Order ka payment status. */
function apiGetPaymentStatus(p) {
  var payment = findOne(CONFIG.SHEETS.PAYMENTS, function (x) {
    return String(x.orderId) === String(p.orderId);
  });
  if (!payment) return fail('No payment found for that order.', 404);
  return ok({ payment: payment });
}

/** Refund status. */
function apiGetRefundStatus(p) {
  var payment = findOne(CONFIG.SHEETS.PAYMENTS, function (x) {
    return String(x.orderId) === String(p.orderId);
  });
  if (!payment) return fail('No payment found for that order.', 404);

  return ok({
    refundStatus: payment.refundStatus || 'Not applicable',
    refundAmount: Number(payment.refundAmount) || 0,
    refundedAt: payment.refundedAt || null,
    // Prepaid refunds 3-5 working days, COD 5-7.
    expectedBy: payment.refundedAt
      ? addDays(new Date(payment.refundedAt), payment.method === 'cod' ? 7 : 5).toISOString()
      : null
  });
}

/** Refund shuru karta hai (Order.gs se call hota hai). */
function initiateRefund(orderId, amount) {
  var payment = findOne(CONFIG.SHEETS.PAYMENTS, function (x) {
    return String(x.orderId) === String(orderId);
  });
  if (!payment) return false;

  updateRow(CONFIG.SHEETS.PAYMENTS, 'id', payment.id, {
    refundStatus: 'Initiated',
    refundAmount: Number(amount) || Number(payment.amount),
    refundedAt: nowISO()
  });

  pushNotification(payment.userId, 'Refund initiated',
    'Your refund of ₹' + (amount || payment.amount) + ' for order ' + orderId +
    ' has been initiated and will reach you in 3–5 business days.',
    'payment', 'pages/order-details.html?id=' + orderId);

  return true;
}


/* ============================================================================
 * SECTION 10: COUPON.gs
 * Coupons list aur verification
 * ========================================================================== */
/** Saare active coupons. */
function apiGetCoupons(p) {
  var now = new Date().getTime();
  var items = readAll(CONFIG.SHEETS.COUPONS).filter(function (c) {
    var active = c.active === true || c.active === 'TRUE' || c.active === 'true';
    var notExpired = !c.expiry || new Date(c.expiry).getTime() >= now;
    return active && notExpired;
  });
  return ok({ items: items });
}

/** Coupon check karke discount amount deta hai. */
function apiVerifyCoupon(p) {
  var code = String(p.code || '').trim().toUpperCase();
  var subtotal = Number(p.subtotal) || 0;

  if (!code) return fail('Please enter a coupon code.');

  var coupon = findOne(CONFIG.SHEETS.COUPONS, function (c) {
    return String(c.code).toUpperCase() === code;
  });
  if (!coupon) return fail('That coupon code is not valid.');

  var active = coupon.active === true || coupon.active === 'TRUE' || coupon.active === 'true';
  if (!active) return fail('This coupon is no longer active.');

  if (coupon.expiry && new Date(coupon.expiry).getTime() < new Date().getTime()) {
    return fail('This coupon has expired.');
  }

  var limit = Number(coupon.usageLimit) || 0;
  var used = Number(coupon.usedCount) || 0;
  if (limit > 0 && used >= limit) return fail('This coupon has reached its usage limit.');

  var minOrder = Number(coupon.minOrder) || 0;
  if (subtotal < minOrder) {
    return fail('Add ₹' + (minOrder - subtotal) + ' more to use ' + coupon.code + '.');
  }

  var discount = 0, freeShip = false;
  if (coupon.type === 'percent') {
    discount = Math.min(Math.round(subtotal * Number(coupon.value) / 100),
                        Number(coupon.maxDiscount) || subtotal);
  } else if (coupon.type === 'flat') {
    discount = Math.min(Number(coupon.value), subtotal);
  } else if (coupon.type === 'shipping') {
    freeShip = true;
  }

  return ok({
    coupon: {
      code: coupon.code, type: coupon.type, value: Number(coupon.value),
      minOrder: minOrder, maxDiscount: Number(coupon.maxDiscount) || 0,
      description: coupon.description, discount: discount, freeShip: freeShip
    }
  }, 'Coupon ' + coupon.code + ' applied.');
}

/** Order place hone par usage count badhata hai. */
function incrementCouponUsage(code) {
  if (!code) return;
  var coupon = findOne(CONFIG.SHEETS.COUPONS, function (c) {
    return String(c.code).toUpperCase() === String(code).toUpperCase();
  });
  if (coupon) {
    updateRow(CONFIG.SHEETS.COUPONS, 'code', coupon.code,
      { usedCount: (Number(coupon.usedCount) || 0) + 1 });
  }
}


/* ============================================================================
 * SECTION 11: REVIEW.gs
 * Product reviews list karna aur naya review add karna
 * ========================================================================== */
/** Ek product ke reviews + rating breakdown. */
function apiGetReviews(p) {
  var list = findAll(CONFIG.SHEETS.REVIEWS, function (r) {
    return String(r.productId) === String(p.productId) &&
           String(r.status || 'approved') === 'approved';
  });

  list.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  var total = list.length, sum = 0;
  var buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (var i = 0; i < list.length; i++) {
    var r = Number(list[i].rating) || 0;
    sum += r;
    if (buckets[r] !== undefined) buckets[r]++;
  }

  return ok({
    items: list,
    total: total,
    average: total ? Math.round((sum / total) * 10) / 10 : 0,
    breakdown: buckets
  });
}

/** Naya review add karta hai aur product ki rating recalculate karta hai. */
function apiAddReview(p, user) {
  if (!p.productId) return fail('No product specified.');
  var rating = parseInt(p.rating, 10);
  if (!rating || rating < 1 || rating > 5) return fail('Please select a star rating.');
  if (!p.comment || String(p.comment).trim().length < 10) {
    return fail('Please write at least 10 characters.');
  }

  var product = findOne(CONFIG.SHEETS.PRODUCTS, function (x) {
    return String(x.id) === String(p.productId);
  });
  if (!product) return fail('Product not found.', 404);

  // Verified purchase check — user ne ye product kabhi kharida?
  var verified = false;
  if (user) {
    var orders = findAll(CONFIG.SHEETS.ORDERS, function (o) {
      return String(o.userId) === String(user.id) && o.status === 'Delivered';
    });
    for (var i = 0; i < orders.length && !verified; i++) {
      var items = toArray(orders[i].items);
      for (var j = 0; j < items.length; j++) {
        if (String(items[j].productId || items[j].id) === String(p.productId)) { verified = true; break; }
      }
    }
  }

  var review = {
    id: uid('R'),
    productId: p.productId,
    userId: user ? user.id : 'guest',
    user: (user && user.name) || p.user || 'PShop Customer',
    rating: rating,
    title: String(p.title || 'My review').slice(0, 100),
    comment: String(p.comment).trim().slice(0, 1000),
    images: p.images ? JSON.stringify(p.images) : '[]',
    verified: verified,
    helpful: 0,
    status: 'approved',
    createdAt: nowISO()
  };
  appendRow(CONFIG.SHEETS.REVIEWS, review);

  recalculateProductRating(p.productId);

  return ok({ review: review }, 'Thanks! Your review is published.');
}

/** Product ki average rating aur counts dobara nikalta hai. */
function recalculateProductRating(productId) {
  var reviews = findAll(CONFIG.SHEETS.REVIEWS, function (r) {
    return String(r.productId) === String(productId) &&
           String(r.status || 'approved') === 'approved';
  });
  if (!reviews.length) return;

  var sum = 0;
  for (var i = 0; i < reviews.length; i++) sum += Number(reviews[i].rating) || 0;

  updateRow(CONFIG.SHEETS.PRODUCTS, 'id', productId, {
    rating: Math.round((sum / reviews.length) * 10) / 10,
    reviewCount: reviews.length,
    updatedAt: nowISO()
  });
}


/* ============================================================================
 * SECTION 12: MESSAGE.gs
 * Support chat, contact form aur newsletter
 * ========================================================================== */
/** User ke saare message threads. */
function apiGetMessages(p, user) {
  if (!user) return fail('Please sign in.', 401);

  var list = findAll(CONFIG.SHEETS.MESSAGES, function (m) {
    return String(m.userId) === String(user.id);
  });

  // Pehli baar aane par welcome thread bana do.
  if (!list.length) {
    var welcome = {
      id: uid('MSG'), userId: user.id, name: 'PShop Support',
      email: CONFIG.SUPPORT_EMAIL, subject: 'Welcome to PShop 🎉',
      thread: JSON.stringify([{
        by: 'support',
        text: 'Hi! Thanks for joining PShop. Reply here any time — our team responds within a few hours.',
        at: nowISO()
      }]),
      status: 'open', unread: true, createdAt: nowISO(), updatedAt: nowISO()
    };
    appendRow(CONFIG.SHEETS.MESSAGES, welcome);
    list = [welcome];
  }

  list.sort(function (a, b) {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  var items = list.map(function (m) {
    return {
      id: m.id, from: m.name, subject: m.subject, email: m.email,
      thread: toArray(m.thread), status: m.status,
      unread: m.unread === true || m.unread === 'TRUE',
      at: m.updatedAt || m.createdAt
    };
  });

  var unread = items.filter(function (m) { return m.unread; }).length;
  return ok({ items: items, unread: unread });
}

/** Message bhejta hai (naya thread ya existing me reply). */
function apiSendMessage(p, user) {
  var text = String(p.text || '').trim();
  if (!text) return fail('Please type a message.');

  var now = nowISO();
  var thread = p.threadId
    ? findOne(CONFIG.SHEETS.MESSAGES, function (m) { return String(m.id) === String(p.threadId); })
    : null;

  if (thread) {
    var msgs = toArray(thread.thread);
    msgs.push({ by: 'user', text: text, at: now });
    // Auto-acknowledgement.
    msgs.push({
      by: 'support',
      text: 'Thanks for reaching out! Ticket logged — our support team will reply shortly.',
      at: now
    });
    updateRow(CONFIG.SHEETS.MESSAGES, 'id', thread.id, {
      thread: JSON.stringify(msgs), unread: true, updatedAt: now
    });
    thread.thread = msgs;
  } else {
    thread = {
      id: uid('MSG'),
      userId: user ? user.id : 'guest',
      name: p.name || (user && user.name) || 'Guest',
      email: p.email || (user && user.email) || '',
      subject: String(p.subject || 'New enquiry').slice(0, 120),
      thread: JSON.stringify([
        { by: 'user', text: text, at: now },
        { by: 'support',
          text: 'Thanks for reaching out! Ticket logged — our support team will reply shortly.',
          at: now }
      ]),
      status: 'open', unread: true, createdAt: now, updatedAt: now
    };
    appendRow(CONFIG.SHEETS.MESSAGES, thread);

    // Admin ko notify karo.
    sendEmail(CONFIG.ADMIN_EMAIL, 'New support ticket: ' + thread.subject,
      emailTemplate('New support ticket',
        '<p><b>From:</b> ' + thread.name + ' (' + thread.email + ')</p>' +
        '<p><b>Subject:</b> ' + thread.subject + '</p>' +
        '<p><b>Message:</b><br>' + text + '</p>'));
  }

  return ok({
    thread: {
      id: thread.id, from: thread.name, subject: thread.subject,
      thread: toArray(thread.thread), status: thread.status, at: now
    }
  }, 'Message sent.');
}

/** Contact form — ticket bhi banata hai aur email bhi bhejta hai. */
function apiContact(p) {
  if (!V.name(p.name))   return fail('Please enter your name.');
  if (!V.email(p.email)) return fail('Please enter a valid email.');
  if (!p.message || String(p.message).trim().length < 10) {
    return fail('Message must be at least 10 characters.');
  }

  apiSendMessage({
    text: p.message, subject: p.subject || 'Contact form enquiry',
    name: p.name, email: p.email
  }, null);

  // User ko acknowledgement.
  sendEmail(p.email, 'We received your message — PShop',
    emailTemplate('Thanks for writing to us',
      '<p>Hi ' + p.name + ', we have received your message and our team will get back ' +
      'to you within 24 hours.</p><p><i>"' + String(p.message).slice(0, 200) + '"</i></p>'));

  return ok({ received: true }, 'Thanks! We have received your message.');
}

/** Newsletter subscription. */
function apiSubscribeNewsletter(p) {
  if (!V.email(p.email)) return fail('Please enter a valid email address.');
  var email = String(p.email).trim().toLowerCase();

  var sh = getSheet('Newsletter', ['email', 'subscribedAt', 'status']);
  var rows = readAll('Newsletter');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].email).toLowerCase() === email) {
      return ok({ already: true }, 'You are already subscribed.');
    }
  }

  appendRow('Newsletter', { email: email, subscribedAt: nowISO(), status: 'active' });

  sendEmail(email, 'Welcome to the PShop newsletter',
    emailTemplate('You are on the list! 🎉',
      '<p>Thanks for subscribing. You will be the first to know about flash sales, ' +
      'price drops and exclusive coupons.</p>'));

  return ok({ subscribed: true }, 'Subscribed! Watch your inbox for deals.');
}


/* ============================================================================
 * SECTION 13: NOTIFICATION.gs
 * In-app notifications create, list aur read-mark
 * ========================================================================== */
/** User ki notifications. */
function apiGetNotifications(p, user) {
  if (!user) return fail('Please sign in.', 401);

  var list = findAll(CONFIG.SHEETS.NOTIFICATIONS, function (n) {
    return String(n.userId) === String(user.id) || String(n.userId) === 'all';
  });

  list.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  var items = list.slice(0, 50).map(function (n) {
    return {
      id: n.id, title: n.title, body: n.body, type: n.type || 'system',
      link: n.link || '', read: n.read === true || n.read === 'TRUE',
      at: n.createdAt
    };
  });

  return ok({
    items: items,
    unread: items.filter(function (n) { return !n.read; }).length
  });
}

/** Ek ya saari notifications read mark karta hai. */
function apiMarkNotificationRead(p, user) {
  if (!user) return fail('Please sign in.', 401);

  if (p.all) {
    var list = findAll(CONFIG.SHEETS.NOTIFICATIONS, function (n) {
      return String(n.userId) === String(user.id);
    });
    for (var i = 0; i < list.length; i++) {
      updateRow(CONFIG.SHEETS.NOTIFICATIONS, 'id', list[i].id, { read: true });
    }
  } else if (p.id) {
    updateRow(CONFIG.SHEETS.NOTIFICATIONS, 'id', p.id, { read: true });
  }

  return apiGetNotifications(p, user);
}

/**
 * Notification banata hai — baaki modules isi ko call karte hain.
 * @param {string} userId 'all' bhi ho sakta hai
 */
function pushNotification(userId, title, body, type, link) {
  appendRow(CONFIG.SHEETS.NOTIFICATIONS, {
    id: uid('N'), userId: userId || 'all',
    title: title, body: body,
    type: type || 'system', link: link || '',
    read: false, createdAt: nowISO()
  });
}

/** Admin: sabhi users ko broadcast. */
function broadcastNotification(title, body, type, link) {
  pushNotification('all', title, body, type || 'offer', link || '');
  return ok({ sent: true }, 'Notification broadcast to all users.');
}


/* ============================================================================
 * SECTION 14: DELIVERY.gs
 * Pincode serviceability aur shipment updates
 * ========================================================================== */
/** Pincode serviceable hai ya nahi + ETA. */
function apiCheckPincode(p) {
  var pin = String(p.pincode || '').trim();
  if (!V.pin(pin)) return fail('Please enter a valid 6-digit pincode.');

  // Blocked pincodes sheet me ho to unhe non-serviceable maano.
  var blocked = findOne(CONFIG.SHEETS.DELIVERY, function (d) {
    return String(d.pincode) === pin && String(d.status) === 'blocked';
  });
  if (blocked) {
    return ok({ serviceable: false, pincode: pin },
      'Sorry, we do not deliver to ' + pin + ' yet.');
  }

  // Metro pincodes (1st digit 1-5) thoda fast, baaki +1 din.
  var firstDigit = parseInt(pin.charAt(0), 10);
  var days = firstDigit <= 5 ? 3 : 4;
  if (p.express) days = Math.max(1, days - 2);

  return ok({
    serviceable: true,
    pincode: pin,
    days: days,
    eta: addDays(new Date(), days).toISOString(),
    codAvailable: true,
    expressAvailable: firstDigit <= 6
  }, 'Delivery available at ' + pin + '.');
}

/** Order ka delivery record. */
function apiGetDelivery(p) {
  var record = findOne(CONFIG.SHEETS.DELIVERY, function (d) {
    return String(d.orderId) === String(p.orderId);
  });
  if (!record) return fail('No delivery record found.', 404);
  record.updates = toArray(record.updates);
  return ok({ delivery: record });
}

/** Order place hone par delivery row banata hai. */
function createDeliveryRecord(order) {
  var address = toObject(order.address);
  appendRow(CONFIG.SHEETS.DELIVERY, {
    id: uid('DLV'),
    orderId: order.id,
    awb: order.awb,
    courier: order.courier || 'PShop Express',
    status: 'Pending pickup',
    pincode: address.pin || '',
    city: address.city || '',
    agent: '', agentPhone: '',
    eta: order.expectedAt,
    updates: JSON.stringify([{ at: nowISO(), note: 'Shipment created. Awaiting pickup.' }]),
    createdAt: nowISO(), updatedAt: nowISO()
  });
}

/** Delivery status update (admin / courier webhook). */
function updateDeliveryStatus(orderId, status, note, agent, agentPhone) {
  var record = findOne(CONFIG.SHEETS.DELIVERY, function (d) {
    return String(d.orderId) === String(orderId);
  });
  if (!record) return false;

  var updates = toArray(record.updates);
  updates.push({ at: nowISO(), note: note || status });

  var patch = { status: status, updates: JSON.stringify(updates), updatedAt: nowISO() };
  if (agent) patch.agent = agent;
  if (agentPhone) patch.agentPhone = agentPhone;

  updateRow(CONFIG.SHEETS.DELIVERY, 'id', record.id, patch);
  return true;
}


/* ============================================================================
 * SECTION 15: CONTENT.gs
 * Homepage banners aur FAQ content
 * ========================================================================== */
/** Hero slider ke banners. */
function apiGetBanners(p) {
  var sh = getSheet('Banners',
    ['id', 'title', 'subtitle', 'cta', 'link', 'image', 'theme', 'active', 'sortOrder']);

  var rows = readAll('Banners');

  // Pehli baar khaali ho to default banners daal do.
  if (!rows.length) {
    var defaults = [
      ['b1', 'Monsoon Mega Sale', 'Up to 60% off on Electronics', 'Shop Electronics',
       'pages/category.html?cat=electronics', 'assets/img/banners/banner-1.svg', '#1d4ed8'],
      ['b2', 'Fashion Fiesta', 'Trending styles from ₹299', 'Explore Fashion',
       'pages/category.html?cat=fashion', 'assets/img/banners/banner-2.svg', '#be185d'],
      ['b3', 'Home Upgrade Days', 'Appliances & cookware deals', 'Shop Home',
       'pages/category.html?cat=home-kitchen', 'assets/img/banners/banner-3.svg', '#b45309'],
      ['b4', 'Flash Sale Live', 'Extra 18% off — limited hours', 'Grab Now',
       'pages/shop.html?tag=flash', 'assets/img/banners/banner-4.svg', '#047857']
    ];
    var bRows = [];
    for (var i = 0; i < defaults.length; i++) {
      var b = defaults[i];
      bRows.push({
        id: b[0], title: b[1], subtitle: b[2], cta: b[3], link: b[4],
        image: b[5], theme: b[6], active: true, sortOrder: i + 1
      });
    }
    appendRows('Banners', bRows);
    rows = readAll('Banners');
  }

  var items = rows.filter(function (b) {
    return b.active === true || b.active === 'TRUE' || b.active === 'true';
  });
  items.sort(function (a, b) { return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0); });

  return ok({ items: items });
}

/** FAQ list (category ke hisab se grouped frontend me hoti hai). */
function apiGetFaqs(p) {
  var sh = getSheet('FAQs', ['id', 'category', 'question', 'answer', 'sortOrder', 'active']);
  var rows = readAll('FAQs');

  if (!rows.length) {
    var defaults = [
      ['Orders', 'How do I place an order on PShop?',
       'Add products to your cart, open the cart page, apply a coupon if you have one, then continue to checkout. Choose a delivery address, pick a payment method and confirm. You will receive an order ID instantly.'],
      ['Orders', 'Can I cancel my order after placing it?',
       'Yes. Orders can be cancelled free of charge any time before they are marked Shipped. Open Orders → Order Details → Cancel Order and select a reason.'],
      ['Orders', 'How do I track my shipment?',
       'Every order has a live timeline. Go to Orders → Track Order to see Placed, Packed, Shipped, Out for Delivery and Delivered stages with timestamps.'],
      ['Payments', 'Which payment methods are supported?',
       'We support Cash on Delivery, UPI (any UPI app), Razorpay cards/netbanking/wallets, and PShop wallet refunds.'],
      ['Payments', 'When will I get my refund?',
       'Refunds for prepaid orders are initiated within 24 hours of return pickup and reach your source account in 3–5 business days. COD refunds go to your bank account in 5–7 business days.'],
      ['Payments', 'Is it safe to pay online?',
       'Yes. Payments are processed by PCI-DSS compliant gateways. PShop never stores your full card number or UPI PIN.'],
      ['Delivery', 'What are the delivery charges?',
       'Delivery is free on orders above ₹499. Below that a flat ₹79 shipping fee applies. Express delivery costs ₹129.'],
      ['Delivery', 'Do you deliver to my pincode?',
       'We deliver to 19,000+ pincodes across India. Enter your pincode on any product page to check serviceability and the expected delivery date.'],
      ['Returns', 'What is the return policy?',
       'Most products carry a 7–30 day return window depending on category. The exact window is shown on the product page and in your order details.'],
      ['Returns', 'How does replacement work?',
       'Choose Replace Order from Order Details within the return window. A pickup is scheduled and the replacement ships once the original item is picked up.'],
      ['Account', 'How do I reset my password?',
       'Go to Login → Forgot Password, enter your registered email or mobile, verify the OTP and set a new password.'],
      ['Account', 'How does OTP login work?',
       'Enter your mobile number on the OTP Verification page. We send a 6-digit code valid for 5 minutes. Enter it to sign in without a password.'],
      ['Account', 'How do I delete my account?',
       'Open Settings → Danger Zone → Delete Account. This permanently removes your profile, addresses and cart. Order history is retained for legal compliance.'],
      ['Products', 'Are the products genuine?',
       'All products are sourced from brand-authorised sellers and pass a quality check before dispatch.'],
      ['Products', 'How do I compare products?',
       'Click the compare icon on any product card. You can compare up to 4 products side by side including price, rating, brand and specifications.']
    ];
    var fRows = [];
    for (var i = 0; i < defaults.length; i++) {
      fRows.push({
        id: 'F' + (i + 1), category: defaults[i][0], question: defaults[i][1],
        answer: defaults[i][2], sortOrder: i + 1, active: true
      });
    }
    appendRows('FAQs', fRows);
    rows = readAll('FAQs');
  }

  var items = rows.filter(function (f) {
    return f.active === true || f.active === 'TRUE' || f.active === 'true';
  });
  items.sort(function (a, b) { return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0); });

  return ok({ items: items });
}


/* ============================================================================
 * SECTION 16: ADMIN.gs
 * Admin panel ke saare endpoints
 * ========================================================================== */
/* ======================= DASHBOARD ======================= */

/** Dashboard ke KPI numbers. */
function apiAdminStats(p) {
  var products = readAll(CONFIG.SHEETS.PRODUCTS);
  var orders = readAll(CONFIG.SHEETS.ORDERS);
  var users = readAll(CONFIG.SHEETS.USERS);
  var payments = readAll(CONFIG.SHEETS.PAYMENTS);

  var revenue = 0, pending = 0, delivered = 0, cancelled = 0;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var totals = toObject(o.totals);
    if (o.status !== 'Cancelled') revenue += Number(totals.total) || 0;
    if (['Placed', 'Confirmed', 'Packed'].indexOf(o.status) > -1) pending++;
    if (o.status === 'Delivered') delivered++;
    if (o.status === 'Cancelled') cancelled++;
  }

  // Aaj ke orders.
  var today = new Date().toDateString();
  var todayOrders = orders.filter(function (o) {
    return new Date(o.placedAt).toDateString() === today;
  });

  return ok({
    products: products.length,
    orders: orders.length,
    users: users.filter(function (u) { return u.role !== 'admin'; }).length,
    revenue: revenue,
    pending: pending,
    delivered: delivered,
    cancelled: cancelled,
    todayOrders: todayOrders.length,
    todayRevenue: todayOrders.reduce(function (a, o) {
      return a + (Number(toObject(o.totals).total) || 0);
    }, 0),
    lowStock: products.filter(function (x) {
      return Number(x.stock) > 0 && Number(x.stock) < 10;
    }).length,
    outOfStock: products.filter(function (x) { return Number(x.stock) <= 0; }).length,
    pendingPayments: payments.filter(function (x) { return x.status === 'Pending'; }).length,
    refunds: payments.filter(function (x) { return x.refundStatus === 'Initiated'; }).length,
    openTickets: readAll(CONFIG.SHEETS.MESSAGES).filter(function (m) {
      return m.status === 'open';
    }).length
  });
}

/* ======================= USERS ======================= */

function apiAdminUsers(p) {
  var users = readAll(CONFIG.SHEETS.USERS);
  var orders = readAll(CONFIG.SHEETS.ORDERS);

  var out = users.map(function (u) {
    var mine = orders.filter(function (o) { return String(o.userId) === String(u.id); });
    var spent = mine.reduce(function (a, o) {
      return a + (o.status !== 'Cancelled' ? (Number(toObject(o.totals).total) || 0) : 0);
    }, 0);
    var pub = publicUser(u);
    pub.status = u.status || 'active';
    pub.orderCount = mine.length;
    pub.totalSpent = spent;
    pub.lastLogin = u.lastLogin || '';
    return pub;
  });

  if (p.q) {
    var term = String(p.q).toLowerCase();
    out = out.filter(function (u) {
      return String(u.name).toLowerCase().indexOf(term) > -1 ||
             String(u.email).toLowerCase().indexOf(term) > -1 ||
             String(u.phone).indexOf(term) > -1;
    });
  }
  if (p.role && p.role !== 'all') {
    out = out.filter(function (u) { return u.role === p.role; });
  }

  out.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return ok({ items: out, total: out.length });
}

/** User block / unblock / role change. */
function apiAdminUpdateUser(p) {
  if (!p.userId) return fail('No user specified.');
  var patch = { updatedAt: nowISO() };
  if (p.status) patch.status = p.status;
  if (p.role)   patch.role = p.role;
  if (p.name)   patch.name = p.name;

  var found = updateRow(CONFIG.SHEETS.USERS, 'id', p.userId, patch);
  if (!found) return fail('User not found.', 404);

  return ok({ updated: true }, 'User updated.');
}

function apiAdminDeleteUser(p) {
  if (!p.userId) return fail('No user specified.');
  var user = findOne(CONFIG.SHEETS.USERS, function (u) { return String(u.id) === String(p.userId); });
  if (!user) return fail('User not found.', 404);
  if (user.role === 'admin') return fail('Admin accounts cannot be deleted here.');

  deleteRow(CONFIG.SHEETS.USERS, 'id', p.userId);
  return ok({ deleted: true }, 'User deleted.');
}

/* ======================= PRODUCTS ======================= */

/** Product add (isNew=true) ya update (isNew=false). */
function apiAdminSaveProduct(p, isNew) {
  var d = p.product || p;

  if (!V.required(d.name))  return fail('Product name is required.');
  if (!V.required(d.brand)) return fail('Brand is required.');
  if (!Number(d.price))     return fail('A valid price is required.');

  var price = Number(d.price);
  var mrp = Number(d.mrp) || price;

  var record = {
    name: String(d.name).trim(),
    slug: d.slug || slugifyText(d.name),
    sku: d.sku || ('PS-' + String(d.categorySlug || 'GEN').substring(0, 3).toUpperCase() + '-' + uid('')),
    brand: d.brand,
    categoryId: d.categoryId || '',
    category: d.category || '',
    categorySlug: d.categorySlug || slugifyText(d.category || ''),
    subCategory: d.subCategory || '',
    price: price,
    mrp: mrp,
    discount: mrp > price ? Math.round((1 - price / mrp) * 100) : 0,
    stock: Number(d.stock) || 0,
    inStock: (Number(d.stock) || 0) > 0,
    rating: Number(d.rating) || 0,
    ratingCount: Number(d.ratingCount) || 0,
    reviewCount: Number(d.reviewCount) || 0,
    images: JSON.stringify(toArray(d.images)),
    thumb: d.thumb || makeThumbUrl(toArray(d.images)[0]) || '',
    colors: JSON.stringify(toArray(d.colors)),
    highlights: JSON.stringify(toArray(d.highlights)),
    description: d.description || '',
    specs: JSON.stringify(toObject(d.specs)),
    tags: JSON.stringify(toArray(d.tags)),
    deliveryDays: Number(d.deliveryDays) || 3,
    returnDays: Number(d.returnDays) || 7,
    codAvailable: d.codAvailable !== false,
    sold: Number(d.sold) || 0,
    status: d.status || 'active',
    updatedAt: nowISO()
  };

  if (isNew) {
    record.id = nextId(CONFIG.SHEETS.PRODUCTS, 'P', 4);
    record.createdAt = nowISO();
    appendRow(CONFIG.SHEETS.PRODUCTS, record);
    return ok({ product: normalizeProduct(record) }, 'Product added.');
  }

  if (!d.id) return fail('No product ID supplied.');
  var found = updateRow(CONFIG.SHEETS.PRODUCTS, 'id', d.id, record);
  if (!found) return fail('Product not found.', 404);

  return ok({ product: normalizeProduct(record) }, 'Product updated.');
}

function apiAdminDeleteProduct(p) {
  if (!p.id) return fail('No product specified.');
  // Soft delete — order history safe rahe.
  var found = updateRow(CONFIG.SHEETS.PRODUCTS, 'id', p.id,
    { status: 'deleted', updatedAt: nowISO() });
  if (!found) return fail('Product not found.', 404);
  return ok({ deleted: true }, 'Product removed from the catalogue.');
}

/* ======================= CATEGORIES ======================= */

function apiAdminSaveCategory(p, isNew) {
  var d = p.category || p;
  if (!V.required(d.name)) return fail('Category name is required.');

  var record = {
    name: String(d.name).trim(),
    slug: d.slug || slugifyText(d.name),
    description: d.description || '',
    icon: d.icon || '',
    banner: d.banner || '',
    color: d.color || '#2563eb',
    subCategories: JSON.stringify(toArray(d.subCategories)),
    brands: JSON.stringify(toArray(d.brands)),
    productCount: Number(d.productCount) || 0,
    status: d.status || 'active',
    sortOrder: Number(d.sortOrder) || 999
  };

  if (isNew) {
    record.id = nextId(CONFIG.SHEETS.CATEGORIES, 'c', 1);
    record.createdAt = nowISO();
    appendRow(CONFIG.SHEETS.CATEGORIES, record);
    return ok({ category: record }, 'Category added.');
  }

  if (!d.id) return fail('No category ID supplied.');
  var found = updateRow(CONFIG.SHEETS.CATEGORIES, 'id', d.id, record);
  if (!found) return fail('Category not found.', 404);
  return ok({ category: record }, 'Category updated.');
}

function apiAdminDeleteCategory(p) {
  if (!p.id) return fail('No category specified.');
  var count = findAll(CONFIG.SHEETS.PRODUCTS, function (x) {
    return String(x.categoryId) === String(p.id) && String(x.status) === 'active';
  }).length;
  if (count > 0) {
    return fail('This category has ' + count + ' active product(s). Move or delete them first.');
  }
  deleteRow(CONFIG.SHEETS.CATEGORIES, 'id', p.id);
  return ok({ deleted: true }, 'Category deleted.');
}

/* ======================= ORDERS ======================= */

function apiAdminOrders(p) {
  var list = readAll(CONFIG.SHEETS.ORDERS);

  if (p.status && p.status !== 'all') {
    list = list.filter(function (o) { return o.status === p.status; });
  }
  if (p.q) {
    var term = String(p.q).toLowerCase();
    list = list.filter(function (o) {
      var addr = toObject(o.address);
      return String(o.id).toLowerCase().indexOf(term) > -1 ||
             String(addr.name || '').toLowerCase().indexOf(term) > -1 ||
             String(o.awb || '').toLowerCase().indexOf(term) > -1;
    });
  }

  list.sort(function (a, b) {
    return new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime();
  });

  return ok({ items: list.map(hydrateOrder), total: list.length });
}

/** Order ka status badalta hai aur timeline rebuild karta hai. */
function apiAdminUpdateOrder(p) {
  if (!p.id) return fail('No order specified.');
  var order = findOne(CONFIG.SHEETS.ORDERS, function (o) { return String(o.id) === String(p.id); });
  if (!order) return fail('Order not found.', 404);

  var status = p.status;
  var patch = { status: status, updatedAt: nowISO() };

  if (ORDER_STAGES.indexOf(status) > -1) {
    patch.timeline = JSON.stringify(buildTimeline(status, order.placedAt));
  }
  if (status === 'Delivered') {
    patch.deliveredAt = nowISO();
    patch.returnable = true;
    patch.cancellable = false;
    patch.paymentStatus = 'Paid';
  }
  if (status === 'Shipped' || status === 'Out for Delivery') {
    patch.cancellable = false;
  }

  updateRow(CONFIG.SHEETS.ORDERS, 'id', p.id, patch);
  updateDeliveryStatus(p.id, status, 'Status updated to ' + status);

  pushNotification(order.userId, 'Order ' + status.toLowerCase(),
    'Your order ' + order.id + ' is now ' + status + '.',
    'order', 'pages/order-details.html?id=' + order.id);

  var fresh = findOne(CONFIG.SHEETS.ORDERS, function (o) { return String(o.id) === String(p.id); });
  return ok({ order: hydrateOrder(fresh) }, 'Order marked ' + status + '.');
}

/* ======================= PAYMENTS ======================= */

function apiAdminPayments(p) {
  var list = readAll(CONFIG.SHEETS.PAYMENTS);
  if (p.status && p.status !== 'all') {
    list = list.filter(function (x) { return x.status === p.status; });
  }
  list.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  var total = list.reduce(function (a, x) {
    return a + (x.status === 'Paid' ? (Number(x.amount) || 0) : 0);
  }, 0);
  var refunded = list.reduce(function (a, x) { return a + (Number(x.refundAmount) || 0); }, 0);

  return ok({ items: list, total: list.length, collected: total, refunded: refunded });
}

/** Admin manually refund process karta hai. */
function apiAdminRefund(p) {
  if (!p.orderId) return fail('No order specified.');
  var payment = findOne(CONFIG.SHEETS.PAYMENTS, function (x) {
    return String(x.orderId) === String(p.orderId);
  });
  if (!payment) return fail('No payment found for that order.', 404);

  updateRow(CONFIG.SHEETS.PAYMENTS, 'id', payment.id, {
    refundStatus: p.status || 'Completed',
    refundAmount: Number(p.amount) || Number(payment.amount),
    refundedAt: nowISO()
  });
  updateRow(CONFIG.SHEETS.ORDERS, 'id', p.orderId, {
    paymentStatus: 'Refunded', updatedAt: nowISO()
  });

  pushNotification(payment.userId, 'Refund processed',
    'Your refund for order ' + p.orderId + ' has been processed.',
    'payment', 'pages/order-details.html?id=' + p.orderId);

  return ok({ refunded: true }, 'Refund processed.');
}

/* ======================= COUPONS ======================= */

function apiAdminCoupons(p) {
  var list = readAll(CONFIG.SHEETS.COUPONS);
  list.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return ok({ items: list, total: list.length });
}

function apiAdminSaveCoupon(p, isNew) {
  var d = p.coupon || p;
  var code = String(d.code || '').trim().toUpperCase();
  if (!code) return fail('Coupon code is required.');
  if (!d.type) return fail('Coupon type is required.');

  var record = {
    code: code,
    type: d.type,
    value: Number(d.value) || 0,
    minOrder: Number(d.minOrder) || 0,
    maxDiscount: Number(d.maxDiscount) || 0,
    description: d.description || '',
    usageLimit: Number(d.usageLimit) || 10000,
    usedCount: Number(d.usedCount) || 0,
    expiry: d.expiry || '2026-12-31',
    active: d.active !== false
  };

  var existing = findOne(CONFIG.SHEETS.COUPONS, function (c) {
    return String(c.code).toUpperCase() === code;
  });

  if (isNew) {
    if (existing) return fail('A coupon with that code already exists.');
    record.createdAt = nowISO();
    appendRow(CONFIG.SHEETS.COUPONS, record);
    return ok({ coupon: record }, 'Coupon created.');
  }

  if (!existing) return fail('Coupon not found.', 404);
  updateRow(CONFIG.SHEETS.COUPONS, 'code', code, record);
  return ok({ coupon: record }, 'Coupon updated.');
}

function apiAdminDeleteCoupon(p) {
  if (!p.code) return fail('No coupon specified.');
  deleteRow(CONFIG.SHEETS.COUPONS, 'code', String(p.code).toUpperCase());
  return ok({ deleted: true }, 'Coupon deleted.');
}

/* ======================= REVIEWS ======================= */

function apiAdminReviews(p) {
  var list = readAll(CONFIG.SHEETS.REVIEWS);
  if (p.status && p.status !== 'all') {
    list = list.filter(function (r) { return String(r.status || 'approved') === p.status; });
  }
  list.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return ok({ items: list, total: list.length });
}

/** Review approve / hide / delete. */
function apiAdminModerateReview(p) {
  if (!p.id) return fail('No review specified.');

  if (p.action === 'delete') {
    var rev = findOne(CONFIG.SHEETS.REVIEWS, function (r) { return String(r.id) === String(p.id); });
    deleteRow(CONFIG.SHEETS.REVIEWS, 'id', p.id);
    if (rev) recalculateProductRating(rev.productId);
    return ok({ deleted: true }, 'Review deleted.');
  }

  var status = p.action === 'hide' ? 'hidden' : 'approved';
  var found = updateRow(CONFIG.SHEETS.REVIEWS, 'id', p.id, { status: status });
  if (!found) return fail('Review not found.', 404);

  var r2 = findOne(CONFIG.SHEETS.REVIEWS, function (r) { return String(r.id) === String(p.id); });
  if (r2) recalculateProductRating(r2.productId);

  return ok({ status: status }, 'Review ' + status + '.');
}

/* ======================= MESSAGES ======================= */

function apiAdminMessages(p) {
  var list = readAll(CONFIG.SHEETS.MESSAGES);
  if (p.status && p.status !== 'all') {
    list = list.filter(function (m) { return m.status === p.status; });
  }
  list.sort(function (a, b) {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return ok({
    items: list.map(function (m) {
      return {
        id: m.id, userId: m.userId, from: m.name, email: m.email,
        subject: m.subject, thread: toArray(m.thread),
        status: m.status, unread: m.unread === true || m.unread === 'TRUE',
        at: m.updatedAt || m.createdAt
      };
    }),
    total: list.length
  });
}

/** Admin support ticket ka reply. */
function apiAdminReplyMessage(p) {
  if (!p.threadId || !p.text) return fail('Thread and reply text are required.');

  var thread = findOne(CONFIG.SHEETS.MESSAGES, function (m) {
    return String(m.id) === String(p.threadId);
  });
  if (!thread) return fail('Conversation not found.', 404);

  var msgs = toArray(thread.thread);
  msgs.push({ by: 'support', text: String(p.text).trim(), at: nowISO() });

  updateRow(CONFIG.SHEETS.MESSAGES, 'id', thread.id, {
    thread: JSON.stringify(msgs),
    status: p.close ? 'closed' : 'open',
    unread: true, updatedAt: nowISO()
  });

  pushNotification(thread.userId, 'Support replied',
    'You have a new reply on "' + thread.subject + '".', 'system', 'pages/messages.html');

  if (thread.email) {
    sendEmail(thread.email, 'Re: ' + thread.subject,
      emailTemplate('Our team replied',
        '<p>' + String(p.text) + '</p><p style="color:#64748b;font-size:13px">' +
        'Reply to this conversation from your PShop Messages page.</p>'));
  }

  return ok({ replied: true }, 'Reply sent.');
}

/* ======================= DELIVERY ======================= */

function apiAdminDelivery(p) {
  var list = readAll(CONFIG.SHEETS.DELIVERY);
  if (p.status && p.status !== 'all') {
    list = list.filter(function (d) { return d.status === p.status; });
  }
  list.sort(function (a, b) {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return ok({
    items: list.map(function (d) { d.updates = toArray(d.updates); return d; }),
    total: list.length
  });
}

function apiAdminUpdateDelivery(p) {
  if (!p.orderId) return fail('No order specified.');
  var done = updateDeliveryStatus(p.orderId, p.status, p.note, p.agent, p.agentPhone);
  if (!done) return fail('Delivery record not found.', 404);
  return ok({ updated: true }, 'Delivery updated.');
}

/* ======================= REPORTS ======================= */

/** Sales, top products aur category-wise report. */
function apiAdminReports(p) {
  var orders = readAll(CONFIG.SHEETS.ORDERS).filter(function (o) {
    return o.status !== 'Cancelled';
  });
  var products = readAll(CONFIG.SHEETS.PRODUCTS);

  // Pichhle 30 din ka daily revenue.
  var daily = {};
  var since = new Date().getTime() - 30 * 864e5;
  for (var i = 0; i < orders.length; i++) {
    var t = new Date(toISO(orders[i].placedAt)).getTime();
    if (isNaN(t) || t < since) continue;
    var day = toDateKey(orders[i].placedAt);
    daily[day] = (daily[day] || 0) + (Number(toObject(orders[i].totals).total) || 0);
  }
  var salesSeries = [];
  for (var d in daily) if (daily.hasOwnProperty(d)) salesSeries.push({ date: d, revenue: daily[d] });
  salesSeries.sort(function (a, b) { return a.date.localeCompare(b.date); });

  // Top selling products.
  var sold = {};
  for (var j = 0; j < orders.length; j++) {
    var items = toArray(orders[j].items);
    for (var k = 0; k < items.length; k++) {
      var id = items[k].productId || items[k].id;
      if (!sold[id]) sold[id] = { id: id, name: items[k].name, qty: 0, revenue: 0 };
      sold[id].qty += Number(items[k].qty) || 0;
      sold[id].revenue += (Number(items[k].price) || 0) * (Number(items[k].qty) || 0);
    }
  }
  var topProducts = [];
  for (var s in sold) if (sold.hasOwnProperty(s)) topProducts.push(sold[s]);
  topProducts.sort(function (a, b) { return b.qty - a.qty; });

  // Category-wise revenue.
  var byCategory = {};
  for (var m = 0; m < products.length; m++) {
    var cat = products[m].category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = { category: cat, products: 0, stock: 0 };
    byCategory[cat].products++;
    byCategory[cat].stock += Number(products[m].stock) || 0;
  }
  var categoryStats = [];
  for (var c in byCategory) if (byCategory.hasOwnProperty(c)) categoryStats.push(byCategory[c]);

  return ok({
    salesSeries: salesSeries,
    topProducts: topProducts.slice(0, 10),
    categoryStats: categoryStats,
    totalRevenue: orders.reduce(function (a, o) {
      return a + (Number(toObject(o.totals).total) || 0);
    }, 0),
    avgOrderValue: orders.length
      ? Math.round(orders.reduce(function (a, o) {
          return a + (Number(toObject(o.totals).total) || 0);
        }, 0) / orders.length)
      : 0,
    orderCount: orders.length
  });
}

/* ======================= SETTINGS ======================= */

function apiAdminSettings(p) {
  var rows = readAll(CONFIG.SHEETS.SETTINGS);
  var map = {};
  for (var i = 0; i < rows.length; i++) map[rows[i].key] = rows[i].value;
  return ok({ settings: map, rows: rows });
}

function apiAdminUpdateSettings(p) {
  var updates = p.settings || {};
  var count = 0;
  for (var key in updates) {
    if (!updates.hasOwnProperty(key)) continue;
    var found = updateRow(CONFIG.SHEETS.SETTINGS, 'key', key,
      { value: updates[key], updatedAt: nowISO() });
    if (!found) {
      appendRow(CONFIG.SHEETS.SETTINGS,
        { key: key, value: updates[key], description: '', updatedAt: nowISO() });
    }
    count++;
  }
  return ok({ updated: count }, count + ' setting(s) saved.');
}

/* ======================= HELPERS ======================= */

/**
 * Drive image ka chhota version banata hai (listing cards ke liye).
 *
 * Google ka lh3 CDN URL ke aakhir me =w400 lagane par 400px chaudi copy
 * deta hai — bilkul free, koi extra storage nahi. Baaki URLs (local SVG,
 * dusri site ke links) jaise the waise chhod deta hai.
 */
function makeThumbUrl(url, width) {
  if (!url) return '';
  var u = String(url);
  if (u.indexOf('lh3.googleusercontent.com') === -1) return u;
  if (u.indexOf('=w') > -1) return u;          // pehle se sized hai
  return u + '=w' + (width || 400);
}

/** Text ko URL-friendly slug me badalta hai. */
function slugifyText(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


/* ============================================================================
 * SECTION 17: CODE.gs
 * MAIN ENTRY POINT — doGet/doPost aur router
 * ========================================================================== */
/** GET requests — testing aur simple reads ke liye. */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    // Browser me URL kholne par health check dikhe.
    if (action === 'ping') {
      var info = { app: 'PShop API', version: '1.0.0', status: 'running', time: nowISO() };
      try {
        var ss = getSS();
        info.spreadsheet = { name: ss.getName(), id: ss.getId() };
        info.sheets = listSheetStatus();
        info.setupComplete = !!getSS().getSheetByName('Users');
      } catch (err) {
        // Sheet nahi mili — user ko saaf batao kya karna hai.
        return jsonOutput(fail(
          err.message + ' | Fix: Utility.gs me CONFIG.SHEET_ID set karein ' +
          'ya setSheetId() function run karein.', 500));
      }
      return jsonOutput(ok(info, 'PShop backend is live.'));
    }

    return jsonOutput(routeRequest(action, params, params.token || null));
  } catch (err) {
    return jsonOutput(fail('Server error: ' + err.message, 500));
  }
}

/**
 * POST requests — frontend inhi ko use karta hai.
 * Body: { action: "login", payload: {...}, token: "..." }
 * Note: frontend text/plain bhejta hai taaki CORS preflight na ho.
 */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); }
      catch (parseErr) { return jsonOutput(fail('Invalid JSON body.', 400)); }
    }
    var action = body.action || (e && e.parameter ? e.parameter.action : '');
    var payload = body.payload || {};
    var token = body.token || null;

    if (!action) return jsonOutput(fail('No action specified.', 400));

    return jsonOutput(routeRequest(action, payload, token));
  } catch (err) {
    return jsonOutput(fail('Server error: ' + err.message, 500));
  }
}

/**
 * Central router — har action ko uske handler tak bhejta hai.
 * @param {string} action
 * @param {Object} payload
 * @param {string} token
 */
function routeRequest(action, payload, token) {
  payload = payload || {};

  // Kaunse actions ke liye login zaroori hai.
  var PROTECTED = {
    updateProfile: 1, changePassword: 1, getCart: 1, addCart: 1, updateCart: 1,
    removeCart: 1, clearCart: 1, getWishlist: 1, addWishlist: 1, removeWishlist: 1,
    placeOrder: 1, getOrders: 1, cancelOrder: 1, returnOrder: 1,
    getNotifications: 1, markNotificationRead: 1, getMessages: 1,
    uploadImage: 1, uploadImages: 1
  };

  // Sirf admin ke liye.
  var ADMIN = {
    adminStats: 1, adminUsers: 1, adminUpdateUser: 1, adminDeleteUser: 1,
    adminAddProduct: 1, adminUpdateProduct: 1, adminDeleteProduct: 1,
    adminAddCategory: 1, adminUpdateCategory: 1, adminDeleteCategory: 1,
    adminOrders: 1, adminUpdateOrder: 1, adminPayments: 1, adminRefund: 1,
    adminCoupons: 1, adminAddCoupon: 1, adminUpdateCoupon: 1, adminDeleteCoupon: 1,
    adminReviews: 1, adminModerateReview: 1, adminMessages: 1, adminReplyMessage: 1,
    adminDelivery: 1, adminUpdateDelivery: 1, adminReports: 1, adminSettings: 1,
    adminUpdateSettings: 1
  };

  var user = token ? getUserFromToken(token) : null;

  if (PROTECTED[action] && !user) {
    return fail('Please sign in to continue.', 401);
  }
  if (ADMIN[action]) {
    if (!user) return fail('Please sign in to continue.', 401);
    if (user.role !== 'admin') return fail('Admin access required.', 403);
  }

  // userId har protected call me inject kar dete hain.
  if (user) payload.userId = payload.userId || user.id;

  switch (action) {
    /* ---------------- AUTH (Auth.gs) ---------------- */
    case 'signup':          return apiSignup(payload);
    case 'login':           return apiLogin(payload);
    case 'sendOtp':         return apiSendOtp(payload);
    case 'verifyOtp':       return apiVerifyOtp(payload);
    case 'resetPassword':   return apiResetPassword(payload);
    case 'changePassword':  return apiChangePassword(payload, user);
    case 'validateToken':   return user ? ok({ user: user }, 'Token valid.') : fail('Invalid token.', 401);

    /* ---------------- USER (User.gs) ---------------- */
    case 'getProfile':      return apiGetProfile(payload, user);
    case 'updateProfile':   return apiUpdateProfile(payload, user);
    case 'getAddresses':    return apiGetAddresses(payload, user);
    case 'saveAddress':     return apiSaveAddress(payload, user);
    case 'deleteAddress':   return apiDeleteAddress(payload, user);
    case 'uploadImage':     return apiUploadImage(payload, user);
    case 'uploadImages':    return apiUploadImages(payload, user);

    /* ---------------- PRODUCTS (Product.gs) ---------------- */
    case 'getProducts':     return apiGetProducts(payload);
    case 'getProduct':      return apiGetProduct(payload);
    case 'searchProducts':  return apiSearchProducts(payload);
    case 'getFilters':      return apiGetFilters(payload);

    /* ---------------- CONTENT (Content.gs) ---------------- */
    case 'getBanners':      return apiGetBanners(payload);
    case 'getFaqs':         return apiGetFaqs(payload);

    /* ---------------- CATEGORIES (Category.gs) ---------------- */
    case 'getCategories':   return apiGetCategories(payload);
    case 'getCategory':     return apiGetCategory(payload);

    /* ---------------- CART (Cart.gs) ---------------- */
    case 'getCart':         return apiGetCart(payload, user);
    case 'addCart':         return apiAddCart(payload, user);
    case 'updateCart':      return apiUpdateCart(payload, user);
    case 'removeCart':      return apiRemoveCart(payload, user);
    case 'clearCart':       return apiClearCart(payload, user);

    /* ---------------- WISHLIST (Wishlist.gs) ---------------- */
    case 'getWishlist':     return apiGetWishlist(payload, user);
    case 'addWishlist':     return apiAddWishlist(payload, user);
    case 'removeWishlist':  return apiRemoveWishlist(payload, user);

    /* ---------------- ORDERS (Order.gs) ---------------- */
    case 'placeOrder':      return apiPlaceOrder(payload, user);
    case 'getOrders':       return apiGetOrders(payload, user);
    case 'getOrder':        return apiGetOrder(payload, user);
    case 'trackOrder':      return apiTrackOrder(payload);
    case 'checkCod':        return apiCheckCod(payload);
    case 'cancelOrder':     return apiCancelOrder(payload, user);
    case 'returnOrder':     return apiReturnOrder(payload, user);

    /* ---------------- PAYMENT (Payment.gs) ---------------- */
    case 'savePayment':     return apiSavePayment(payload, user);
    case 'getPaymentStatus':return apiGetPaymentStatus(payload);
    case 'getRefundStatus': return apiGetRefundStatus(payload);

    /* ---------------- COUPON (Coupon.gs) ---------------- */
    case 'getCoupons':      return apiGetCoupons(payload);
    case 'verifyCoupon':    return apiVerifyCoupon(payload);

    /* ---------------- REVIEWS (Review.gs) ---------------- */
    case 'getReviews':      return apiGetReviews(payload);
    case 'addReview':       return apiAddReview(payload, user);

    /* ---------------- MESSAGES (Message.gs) ---------------- */
    case 'getMessages':     return apiGetMessages(payload, user);
    case 'sendMessage':     return apiSendMessage(payload, user);
    case 'contact':         return apiContact(payload);
    case 'subscribeNewsletter': return apiSubscribeNewsletter(payload);

    /* ---------------- NOTIFICATIONS (Notification.gs) ---------------- */
    case 'getNotifications':      return apiGetNotifications(payload, user);
    case 'markNotificationRead':  return apiMarkNotificationRead(payload, user);

    /* ---------------- DELIVERY (Delivery.gs) ---------------- */
    case 'checkPincode':    return apiCheckPincode(payload);
    case 'getDelivery':     return apiGetDelivery(payload);

    /* ---------------- ADMIN ---------------- */
    case 'adminStats':          return apiAdminStats(payload);
    case 'adminUsers':          return apiAdminUsers(payload);
    case 'adminUpdateUser':     return apiAdminUpdateUser(payload);
    case 'adminDeleteUser':     return apiAdminDeleteUser(payload);
    case 'adminAddProduct':     return apiAdminSaveProduct(payload, true);
    case 'adminUpdateProduct':  return apiAdminSaveProduct(payload, false);
    case 'adminDeleteProduct':  return apiAdminDeleteProduct(payload);
    case 'adminAddCategory':    return apiAdminSaveCategory(payload, true);
    case 'adminUpdateCategory': return apiAdminSaveCategory(payload, false);
    case 'adminDeleteCategory': return apiAdminDeleteCategory(payload);
    case 'adminOrders':         return apiAdminOrders(payload);
    case 'adminUpdateOrder':    return apiAdminUpdateOrder(payload);
    case 'adminPayments':       return apiAdminPayments(payload);
    case 'adminRefund':         return apiAdminRefund(payload);
    case 'adminCoupons':        return apiAdminCoupons(payload);
    case 'adminAddCoupon':      return apiAdminSaveCoupon(payload, true);
    case 'adminUpdateCoupon':   return apiAdminSaveCoupon(payload, false);
    case 'adminDeleteCoupon':   return apiAdminDeleteCoupon(payload);
    case 'adminReviews':        return apiAdminReviews(payload);
    case 'adminModerateReview': return apiAdminModerateReview(payload);
    case 'adminMessages':       return apiAdminMessages(payload);
    case 'adminReplyMessage':   return apiAdminReplyMessage(payload);
    case 'adminDelivery':       return apiAdminDelivery(payload);
    case 'adminUpdateDelivery': return apiAdminUpdateDelivery(payload);
    case 'adminReports':        return apiAdminReports(payload);
    case 'adminSettings':       return apiAdminSettings(payload);
    case 'adminUpdateSettings': return apiAdminUpdateSettings(payload);

    default:
      return fail('Unknown action: ' + action, 404);
  }
}

/** Har sheet ka row count — health check ke liye. */
function listSheetStatus() {
  var out = {};
  for (var key in CONFIG.SHEETS) {
    if (!CONFIG.SHEETS.hasOwnProperty(key)) continue;
    var name = CONFIG.SHEETS[key];
    var sh = getSS().getSheetByName(name);
    out[name] = sh ? Math.max(0, sh.getLastRow() - 1) : 'missing';
  }
  return out;
}

/* ==========================================================================
   SETUP — ye function Apps Script editor me EK BAAR manually run karein.
   Ye saari sheets, headers aur demo data bana dega.
   ========================================================================== */
function setupDatabase() {
  var ss;
  try {
    ss = getSS();
  } catch (err) {
    Logger.log('❌ ' + err.message);
    throw err;   // execution log me poora message dikhega
  }
  Logger.log('Setting up: "' + ss.getName() + '" (ID: ' + ss.getId() + ')');

  var SCHEMA = DB_SCHEMA();


  // 1. Sheets + headers
  for (var name in SCHEMA) {
    if (!SCHEMA.hasOwnProperty(name)) continue;
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]])
      .setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, Math.min(SCHEMA[name].length, 12));
    forceTextOnDateColumns(sh, SCHEMA[name]);
  }

  // 2. Default admin + demo customer
  if (readAll('Users').length === 0) {
    appendRow('Users', {
      id: 'U0001', name: 'PShop Admin', email: CONFIG.ADMIN_EMAIL, phone: '9000000001',
      password: hashPassword('admin123'), role: 'admin', verified: true, avatar: '',
      gender: '', dob: '', addresses: '[]', status: 'active',
      createdAt: nowISO(), updatedAt: nowISO(), lastLogin: ''
    });
    appendRow('Users', {
      id: 'U0002', name: 'Demo Customer', email: 'demo@pshop.in', phone: '9876543210',
      password: hashPassword('demo123'), role: 'customer', verified: true, avatar: '',
      gender: 'Male', dob: '1996-04-18', addresses: '[]', status: 'active',
      createdAt: nowISO(), updatedAt: nowISO(), lastLogin: ''
    });
  }

  // 3. Default categories
  if (readAll('Categories').length === 0) {
    var cats = [
      ['c1','Electronics','electronics','Phones, laptops, audio & smart gear','#2563eb',
       ['Smartphones','Laptops','Headphones','Smart Watches','Cameras','Accessories']],
      ['c2','Fashion','fashion','Clothing, footwear & accessories','#db2777',
       ["Men's Wear","Women's Wear",'Footwear','Watches','Bags','Jewellery']],
      ['c3','Home & Kitchen','home-kitchen','Appliances, cookware & decor','#f59e0b',
       ['Cookware','Appliances','Furniture','Decor','Storage','Bedding']],
      ['c4','Beauty','beauty','Skincare, grooming & fragrance','#8b5cf6',
       ['Skincare','Haircare','Makeup','Fragrance','Grooming','Wellness']],
      ['c5','Sports','sports','Fitness, outdoor & sportswear','#10b981',
       ['Fitness','Cricket','Cycling','Footwear','Outdoor','Yoga']],
      ['c6','Grocery','grocery','Daily essentials & packaged food','#ef4444',
       ['Staples','Snacks','Beverages','Dairy','Personal Care','Household']],
      ['c7','Toys & Baby','toys-baby','Toys, games & baby care','#06b6d4',
       ['Action Figures','Board Games','Soft Toys','Baby Care','Learning','Outdoor Play']],
      ['c8','Books','books','Fiction, academics & stationery','#64748b',
       ['Fiction','Non-Fiction','Academics','Comics','Stationery','Exam Prep']]
    ];
    var catRows = [];
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      catRows.push({
        id: c[0], name: c[1], slug: c[2], description: c[3], color: c[4],
        icon: 'assets/img/categories/' + c[2] + '.svg',
        banner: 'assets/img/categories/' + c[2] + '-banner.svg',
        subCategories: JSON.stringify(c[5]), brands: '[]', productCount: 0,
        status: 'active', sortOrder: i + 1, createdAt: nowISO()
      });
    }
    appendRows('Categories', catRows);
  }

  // 4. Default coupons
  if (readAll('Coupons').length === 0) {
    var coupons = [
      ['PSHOP10','percent',10,999,300,'10% off on orders above ₹999'],
      ['FLAT200','flat',200,1499,200,'Flat ₹200 off above ₹1499'],
      ['NEWUSER','percent',15,499,500,'15% off for your first order'],
      ['FREESHIP','shipping',0,0,79,'Free delivery on any order'],
      ['BIGSAVE50','percent',50,4999,1500,'50% off above ₹4999 (max ₹1500)']
    ];
    var cpRows = [];
    for (var j = 0; j < coupons.length; j++) {
      var cp = coupons[j];
      cpRows.push({
        code: cp[0], type: cp[1], value: cp[2], minOrder: cp[3], maxDiscount: cp[4],
        description: cp[5], usageLimit: 10000, usedCount: 0,
        expiry: '2026-12-31', active: true, createdAt: nowISO()
      });
    }
    appendRows('Coupons', cpRows);
  }

  // 5. Default settings
  if (readAll('Settings').length === 0) {
    var settings = [
      ['siteName','PShop','Website ka naam'],
      ['currency','INR','Default currency'],
      ['freeShipAbove','499','Is amount ke upar free delivery'],
      ['shippingFee','79','Standard delivery charge'],
      ['expressFee','129','Express delivery charge'],
      ['codFee','29','Cash on delivery ka extra charge'],
      ['taxRate','0.18','GST rate (inclusive)'],
      ['supportEmail',CONFIG.SUPPORT_EMAIL,'Support email address'],
      ['supportPhone','1800 209 7746','Support phone number'],
      ['maintenanceMode','false','Site maintenance mode on/off']
    ];
    var setRows = [];
    for (var k = 0; k < settings.length; k++) {
      setRows.push({
        key: settings[k][0], value: settings[k][1],
        description: settings[k][2], updatedAt: nowISO()
      });
    }
    appendRows('Settings', setRows);
  }

  // 6. Default banners aur FAQs (Content.gs khud seed kar leta hai)
  apiGetBanners({});
  apiGetFaqs({});

  Logger.log('✅ PShop database setup complete.');
  Logger.log('   Sheet: "' + ss.getName() + '"');
  Logger.log('   URL: ' + ss.getUrl());
  Logger.log('   Tabs: ' + Object.keys(SCHEMA).join(', '));
  Logger.log('   Admin login: ' + CONFIG.ADMIN_EMAIL + ' / admin123');
  return ok(listSheetStatus(), 'Database setup complete.');
}

/**
 * OPTIONAL — demo products import karne ke liye.
 * assets/data/products.json ka content yahan paste karke run karein,
 * ya PUBLIC_JSON_URL me apni hosted JSON ka URL de dein.
 */
function importDemoProducts() {
  var PUBLIC_JSON_URL = '';   // e.g. 'https://yoursite.com/assets/data/products.json'
  if (!PUBLIC_JSON_URL) {
    Logger.log('PUBLIC_JSON_URL set karein ya products manually add karein.');
    return fail('No import URL configured.');
  }
  var res = UrlFetchApp.fetch(PUBLIC_JSON_URL);
  var items = JSON.parse(res.getContentText());
  var sh = getSheet(CONFIG.SHEETS.PRODUCTS);
  var headers = readHeaders(sh, CONFIG.SHEETS.PRODUCTS);
  var rows = [];
  for (var i = 0; i < items.length; i++) {
    var p = items[i];
    p.status = 'active';
    p.createdAt = p.createdAt || nowISO();
    p.updatedAt = nowISO();
    rows.push(objectToRow(headers, p));
  }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  Logger.log('Imported ' + rows.length + ' products.');
  return ok({ imported: rows.length }, 'Products imported.');
}

/** Purane OTP records saaf karta hai — time-driven trigger me lagayen (roz). */
function cleanupExpiredOtps() {
  var sh = getSheet(CONFIG.SHEETS.OTP);
  var values = sh.getDataRange().getValues();
  var now = new Date().getTime();
  var removed = 0;
  for (var r = values.length - 1; r >= 1; r--) {
    var exp = new Date(values[r][4]).getTime();
    if (!exp || exp < now) { sh.deleteRow(r + 1); removed++; }
  }
  Logger.log('Removed ' + removed + ' expired OTP rows.');
  return removed;
}


/* ============================================================================
 * SECTION 18: DEMO DATA
 * Ek hi function se poora demo store bana deta hai — products, users,
 * orders, reviews, messages aur notifications ke saath.
 * ========================================================================== */

/**
 * ⭐ YAHI FUNCTION RUN KAREIN ⭐
 *
 * Sab kuch ek saath banata hai:
 *   • 17 sheets headers ke saath
 *   • 4 demo users (1 admin + 3 customers)
 *   • 48 products (8 categories me)
 *   • 8 categories, 5 coupons, 4 banners, 15 FAQs
 *   • 6 demo orders (alag-alag status me)
 *   • 20+ reviews, notifications, support tickets
 *
 * Dobara run karne par purana demo data hatakar naya bana deta hai.
 */
function setupDemoStore() {
  var t0 = new Date().getTime();
  Logger.log('🚀 PShop demo store setup shuru...');

  clearSheetCache();          // fresh start — purane cached objects na use hon
  var ss = getSS();
  Logger.log('   Sheet: "' + ss.getName() + '"');

  // 1. Tables banao (setupDatabase pehle se ye karta hai)
  setupDatabase();
  clearSheetCache();          // nayi sheets bani hain, cache refresh karo

  // 2. Purana demo data hatao taaki duplicate na ho
  clearDemoData();

  // 3. Naya demo data bharo
  var users = seedDemoUsers();
  var products = seedDemoProducts();
  seedDemoOrders(users, products);
  seedDemoReviews(products, users);
  seedDemoEngagement(users);
  seedRemainingSheets(users, products);

  // 4. Har column par uska matlab (note) lagao + README sheet banao
  applyColumnNotes();
  buildReadmeSheet();

  var secs = Math.round((new Date().getTime() - t0) / 100) / 10;

  Logger.log('');
  Logger.log('✅ DEMO STORE READY! (' + secs + 's)');
  Logger.log('─────────────────────────────────────────────');
  Logger.log('  Products      : ' + readAll(CONFIG.SHEETS.PRODUCTS).length);
  Logger.log('  Categories    : ' + readAll(CONFIG.SHEETS.CATEGORIES).length);
  Logger.log('  Users         : ' + readAll(CONFIG.SHEETS.USERS).length);
  Logger.log('  Orders        : ' + readAll(CONFIG.SHEETS.ORDERS).length);
  Logger.log('  Reviews       : ' + readAll(CONFIG.SHEETS.REVIEWS).length);
  Logger.log('  Coupons       : ' + readAll(CONFIG.SHEETS.COUPONS).length);
  Logger.log('  Cart items    : ' + readAll(CONFIG.SHEETS.CART).length);
  Logger.log('  Wishlist      : ' + readAll(CONFIG.SHEETS.WISHLIST).length);
  Logger.log('  Newsletter    : ' + readAll('Newsletter').length);
  Logger.log('─────────────────────────────────────────────');
  Logger.log('  LOGIN DETAILS');
  Logger.log('  Admin     : admin@pshop.in  / admin123');
  Logger.log('  Customer  : demo@pshop.in   / demo123');
  Logger.log('  Customer 2: priya@pshop.in  / priya123');
  Logger.log('  Customer 3: rahul@pshop.in  / rahul123');
  Logger.log('─────────────────────────────────────────────');
  Logger.log('  Ab: Deploy → New deployment → Web app');
  Logger.log('      Execute as: Me | Access: Anyone');
  Logger.log('');

  return ok({
    products: readAll(CONFIG.SHEETS.PRODUCTS).length,
    users: readAll(CONFIG.SHEETS.USERS).length,
    orders: readAll(CONFIG.SHEETS.ORDERS).length,
    sheet: ss.getName()
  }, 'Demo store ready.');
}

/** Purana demo data hatata hai (headers rehne dete hain). */
function clearDemoData() {
  var tables = [
    CONFIG.SHEETS.USERS, CONFIG.SHEETS.PRODUCTS, CONFIG.SHEETS.ORDERS,
    CONFIG.SHEETS.CART, CONFIG.SHEETS.WISHLIST, CONFIG.SHEETS.PAYMENTS,
    CONFIG.SHEETS.MESSAGES, CONFIG.SHEETS.REVIEWS, CONFIG.SHEETS.NOTIFICATIONS,
    CONFIG.SHEETS.DELIVERY, CONFIG.SHEETS.OTP, 'Newsletter'
  ];
  for (var i = 0; i < tables.length; i++) {
    var sh = getSheet(tables[i]);
    var last = sh.getLastRow();
    if (last > 1) sh.deleteRows(2, last - 1);
  }
  Logger.log('   Purana demo data saaf kiya.');
}

/** 4 demo users banata hai — 1 admin, 3 customers (addresses ke saath). */
function seedDemoUsers() {
  var now = new Date();
  var list = [
    // ---------------- ADMIN ----------------
    { id: 'U0001', name: 'Amit Kumar (Admin)', email: CONFIG.ADMIN_EMAIL, phone: '9000000001',
      pw: 'admin123', role: 'admin', gender: 'Male', dob: '1988-03-14',
      addr: [{ id: 'ADR000', name: 'Amit Kumar', phone: '9000000001',
               line1: '4th Floor, Tech Park, Outer Ring Road', landmark: 'PShop HQ',
               city: 'Bengaluru', state: 'Karnataka', pin: '560103',
               type: 'Work', isDefault: true }] },

    // ---------------- CUSTOMERS ----------------
    { id: 'U0002', name: 'Demo Customer', email: 'demo@pshop.in', phone: '9876543210',
      pw: 'demo123', role: 'customer', gender: 'Male', dob: '1996-04-18',
      addr: [{ id: 'ADR001', name: 'Demo Customer', phone: '9876543210',
               line1: 'House 12, Rose Apartments, MG Road', landmark: 'Near Metro Station',
               city: 'Bengaluru', state: 'Karnataka', pin: '560001',
               type: 'Home', isDefault: true },
             { id: 'ADR002', name: 'Demo Customer', phone: '9876543210',
               line1: '4th Floor, Tech Park, Outer Ring Road', landmark: 'Opposite Forum Mall',
               city: 'Bengaluru', state: 'Karnataka', pin: '560103',
               type: 'Work', isDefault: false }] },

    { id: 'U0003', name: 'Priya Sharma', email: 'priya@pshop.in', phone: '9812345670',
      pw: 'priya123', role: 'customer', gender: 'Female', dob: '1998-11-02',
      addr: [{ id: 'ADR003', name: 'Priya Sharma', phone: '9812345670',
               line1: 'Flat 302, Green Valley Society, Kankarbagh',
               landmark: 'Near City Hospital', city: 'Patna', state: 'Bihar',
               pin: '800020', type: 'Home', isDefault: true },
             { id: 'ADR003B', name: 'Priya Sharma', phone: '9812345670',
               line1: 'Shop 7, Boring Road Market', landmark: 'Above SBI Bank',
               city: 'Patna', state: 'Bihar', pin: '800001',
               type: 'Work', isDefault: false }] },

    { id: 'U0004', name: 'Rahul Verma', email: 'rahul@pshop.in', phone: '9765432180',
      pw: 'rahul123', role: 'customer', gender: 'Male', dob: '1992-07-25',
      addr: [{ id: 'ADR004', name: 'Rahul Verma', phone: '9765432180',
               line1: 'B-45, Sector 22, Dwarka', landmark: 'Behind Community Centre',
               city: 'New Delhi', state: 'Delhi', pin: '110077',
               type: 'Home', isDefault: true }] },

    { id: 'U0005', name: 'Sneha Patel', email: 'sneha@pshop.in', phone: '9723456781',
      pw: 'sneha123', role: 'customer', gender: 'Female', dob: '2000-01-30',
      addr: [{ id: 'ADR005', name: 'Sneha Patel', phone: '9723456781',
               line1: '15, Satellite Road, Jodhpur Char Rasta',
               landmark: 'Near Shivranjani Cross', city: 'Ahmedabad', state: 'Gujarat',
               pin: '380015', type: 'Home', isDefault: true }] },

    { id: 'U0006', name: 'Imran Ansari', email: 'imran@pshop.in', phone: '9988776655',
      pw: 'imran123', role: 'customer', gender: 'Male', dob: '1994-09-08',
      addr: [{ id: 'ADR006', name: 'Imran Ansari', phone: '9988776655',
               line1: '22/A, Park Street, Near Elgin Road', landmark: 'Opposite Metro Gate 3',
               city: 'Kolkata', state: 'West Bengal', pin: '700016',
               type: 'Home', isDefault: true }] },

    // Blocked user — admin panel me block feature test karne ke liye
    { id: 'U0007', name: 'Blocked Tester', email: 'blocked@pshop.in', phone: '9111122223',
      pw: 'blocked123', role: 'customer', gender: '', dob: '', status: 'blocked',
      addr: [] }
  ];

  var out = [], rows = [];
  for (var i = 0; i < list.length; i++) {
    var u = list[i];
    var created = new Date(now.getTime() - (60 - i * 12) * 864e5);
    rows.push({
      id: u.id, name: u.name, email: u.email, phone: u.phone,
      password: hashPassword(u.pw), role: u.role, verified: true,
      avatar: '', gender: u.gender, dob: u.dob,
      addresses: JSON.stringify(u.addr), status: u.status || 'active',
      createdAt: created.toISOString(), updatedAt: nowISO(),
      lastLogin: new Date(now.getTime() - i * 36e5).toISOString()
    });
    out.push(u);
  }
  appendRows(CONFIG.SHEETS.USERS, rows);
  Logger.log('   ✓ ' + out.length + ' users banaye');
  return out;
}

/** 48 demo products banata hai (8 categories me balanced). */
function seedDemoProducts() {
  var DATA = DEMO_PRODUCTS();
  var sh = getSheet(CONFIG.SHEETS.PRODUCTS);
  var headers = readHeaders(sh, CONFIG.SHEETS.PRODUCTS);
  var rows = [];
  var now = new Date();

  for (var i = 0; i < DATA.length; i++) {
    var d = DATA[i];
    var disc = d.m > d.p ? Math.round((1 - d.p / d.m) * 100) : 0;
    var imgBase = 'assets/img/products/' + d.im.replace('-1.svg', '');

    rows.push(objectToRow(headers, {
      id: d.i,
      sku: 'PS-' + String(d.cs).substring(0, 3).toUpperCase() + '-' + d.i.replace('P', ''),
      name: d.n, slug: slugifyText(d.n), brand: d.b,
      categoryId: d.c, category: d.cn, categorySlug: d.cs, subCategory: d.s,
      price: d.p, mrp: d.m, discount: disc,
      stock: d.st, inStock: d.st > 0,
      rating: d.r, ratingCount: d.rc, reviewCount: Math.max(3, Math.round(d.rc / 9)),
      images: JSON.stringify([imgBase + '-1.svg', imgBase + '-2.svg', imgBase + '-3.svg']),
      thumb: imgBase + '-1.svg',
      colors: JSON.stringify(d.co),
      highlights: JSON.stringify(d.h),
      description: d.n + ' from ' + d.b + ' is engineered for everyday performance in the ' +
        String(d.s).toLowerCase() + ' range. Built with premium materials, tested for ' +
        'durability and backed by PShop easy returns, it delivers dependable quality ' +
        'at a fair price.',
      specs: JSON.stringify({
        Brand: d.b, Model: d.i, Category: d.cn, 'Sub Category': d.s,
        Warranty: d.w, 'Country of Origin': 'India', 'Package Contents': '1 x ' + d.s
      }),
      tags: JSON.stringify(d.t),
      deliveryDays: d.d, returnDays: d.rd, codAvailable: d.cod, sold: d.so,
      status: 'active',
      createdAt: new Date(now.getTime() - (i % 90) * 864e5).toISOString(),
      updatedAt: nowISO()
    }));
  }

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }
  Logger.log('   ✓ ' + rows.length + ' products banaye');
  return DATA;
}

/** 6 demo orders — har status ka ek example. */
function seedDemoOrders(users, products) {
  var customers = users.filter(function (u) { return u.role === 'customer'; });
  // Har status ka kam se kam ek order — taaki admin panel aur tracking
  // page par sab kuch test kiya ja sake.
  var scenarios = [
    { user: 0, status: 'Delivered',        days: 22, pay: 'razorpay', items: 2 },
    { user: 0, status: 'Out for Delivery', days: 3,  pay: 'upi',      items: 1 },
    { user: 0, status: 'Placed',           days: 0,  pay: 'cod',      items: 3 },
    { user: 1, status: 'Shipped',          days: 5,  pay: 'upi',      items: 2 },
    { user: 1, status: 'Delivered',        days: 40, pay: 'cod',      items: 1 },
    { user: 2, status: 'Cancelled',        days: 12, pay: 'razorpay', items: 2 },
    { user: 2, status: 'Confirmed',        days: 1,  pay: 'upi',      items: 1 },
    { user: 3, status: 'Packed',           days: 2,  pay: 'razorpay', items: 2 },
    { user: 3, status: 'Delivered',        days: 55, pay: 'upi',      items: 3,
      after: 'Return requested' },
    { user: 4, status: 'Delivered',        days: 18, pay: 'cod',      items: 1,
      after: 'Replacement requested' },
    { user: 4, status: 'Shipped',          days: 4,  pay: 'razorpay', items: 2 },
    { user: 1, status: 'Placed',           days: 0,  pay: 'upi',      items: 1 }
  ];

  var labels = { cod: 'Cash on Delivery', upi: 'UPI', razorpay: 'Card / Netbanking' };
  var count = 0;
  // Rows jama karke ek saath likhte hain (Apps Script me bahut tez).
  var orderRows = [], paymentRows = [], deliveryRows = [];

  for (var s = 0; s < scenarios.length; s++) {
    var sc = scenarios[s];
    var cust = customers[sc.user];
    if (!cust) continue;

    var placed = new Date(new Date().getTime() - sc.days * 864e5);

    // Products pick karo
    var items = [], subtotal = 0, mrpTotal = 0;
    for (var k = 0; k < sc.items; k++) {
      var p = products[(s * 4 + k * 7) % products.length];
      var qty = (k === 0) ? 1 : ((s + k) % 2) + 1;
      items.push({
        id: p.i, productId: p.i, name: p.n, brand: p.b,
        price: p.p, mrp: p.m, qty: qty,
        image: 'assets/img/products/' + p.im,
        variant: p.co[0] || '', slug: slugifyText(p.n)
      });
      subtotal += p.p * qty;
      mrpTotal += p.m * qty;
    }

    // Har teesre order par coupon laga dete hain — realistic data ke liye.
    var couponObj = null, discount = 0;
    if (s % 3 === 0 && subtotal >= 999) {
      couponObj = { code: 'PSHOP10', type: 'percent', value: 10, maxDiscount: 300 };
      discount = Math.min(Math.round(subtotal * 0.10), 300);
    }

    var taxable = subtotal - discount;
    var shipping = taxable >= CONFIG.FREE_SHIP_ABOVE ? 0 : CONFIG.SHIPPING_FEE;
    var codFee = sc.pay === 'cod' ? CONFIG.COD_FEE : 0;
    var tax = Math.round(taxable - taxable / (1 + CONFIG.TAX_RATE));

    var totals = {
      count: items.length, subtotal: subtotal, mrpTotal: mrpTotal,
      savings: mrpTotal - subtotal, discount: discount,
      shipping: shipping, codFee: codFee, tax: tax,
      total: taxable + shipping + codFee,
      couponCode: couponObj ? couponObj.code : null
    };

    var isCancelled = sc.status === 'Cancelled';
    var isDelivered = sc.status === 'Delivered';
    var finalStatus = sc.after || sc.status;      // return/replace ke liye
    var timeline = buildTimeline(isCancelled ? 'Placed' : sc.status, placed);

    if (isCancelled) {
      timeline.push({
        stage: 'Cancelled', done: true,
        at: new Date(placed.getTime() + 864e5).toISOString(),
        note: 'Cancelled by customer — Changed my mind'
      });
    }
    if (sc.after) {
      timeline.push({
        stage: sc.after, done: true,
        at: new Date(placed.getTime() + 6 * 864e5).toISOString(),
        note: (sc.after.indexOf('Replacement') > -1 ? 'Replacement' : 'Return') +
              ' requested — ' + (sc.after.indexOf('Replacement') > -1
                ? 'Wrong size delivered' : 'Not as described')
      });
    }

    var orderId = 'PS' + placed.getFullYear() + String(placed.getTime()).slice(-8);
    var addr = cust.addr[0] || {};

    orderRows.push({
      id: orderId, userId: cust.id,
      items: JSON.stringify(items),
      address: JSON.stringify(addr),
      contact: JSON.stringify({ name: cust.name, email: cust.email, phone: cust.phone }),
      payment: JSON.stringify({
        method: sc.pay, label: labels[sc.pay],
        reference: 'TXN' + String(placed.getTime()).slice(-9)
      }),
      totals: JSON.stringify(totals),
      coupon: couponObj ? JSON.stringify(couponObj) : '',
      status: finalStatus,
      paymentStatus: isCancelled ? (sc.pay === 'cod' ? 'Cancelled' : 'Refund initiated')
                   : (sc.after && sc.after.indexOf('Return') > -1 ? 'Refund initiated'
                   : (sc.pay === 'cod' ? (isDelivered ? 'Paid' : 'Pending') : 'Paid')),
      placedAt: placed.toISOString(),
      expectedAt: addDays(placed, 4).toISOString(),
      deliveredAt: isDelivered ? addDays(placed, 5).toISOString() : '',
      invoiceNo: 'INV-' + placed.getFullYear() + '-' + String(placed.getTime()).slice(-6),
      awb: 'PSX' + String(1000000000 + (placed.getTime() % 8999999999)).slice(0, 10),
      courier: 'PShop Express',
      timeline: JSON.stringify(timeline),
      cancelReason: isCancelled ? 'Changed my mind' : '',
      returnReason: sc.after
        ? (sc.after.indexOf('Replacement') > -1 ? 'Wrong size delivered' : 'Not as described')
        : '',
      cancellable: !isCancelled && !isDelivered && !sc.after && sc.status !== 'Shipped',
      returnable: isDelivered && !sc.after,
      updatedAt: nowISO()
    });

    // Payment record
    paymentRows.push({
      id: uid('PAY'), orderId: orderId, userId: cust.id,
      method: sc.pay, amount: totals.total,
      status: isCancelled ? 'Refunded' : (sc.pay === 'cod' && !isDelivered ? 'Pending' : 'Paid'),
      reference: 'TXN' + String(placed.getTime()).slice(-9),
      app: sc.pay === 'upi' ? 'Google Pay' : '', last4: sc.pay === 'razorpay' ? '4242' : '',
      refundStatus: isCancelled ? 'Completed' : '',
      refundAmount: isCancelled ? totals.total : '',
      refundedAt: isCancelled ? addDays(placed, 2).toISOString() : '',
      createdAt: placed.toISOString()
    });

    // Delivery record
    deliveryRows.push({
      id: uid('DLV'), orderId: orderId, awb: 'PSX' + String(placed.getTime()).slice(-10),
      courier: 'PShop Express',
      status: isCancelled ? 'Cancelled' : sc.status,
      pincode: addr.pin || '', city: addr.city || '',
      agent: isDelivered ? 'Suresh Kumar' : '', agentPhone: isDelivered ? '9900112233' : '',
      eta: addDays(placed, 4).toISOString(),
      updates: JSON.stringify([{ at: placed.toISOString(), note: 'Shipment created.' }]),
      createdAt: placed.toISOString(), updatedAt: nowISO()
    });

    count++;
  }

  appendRows(CONFIG.SHEETS.ORDERS, orderRows);
  appendRows(CONFIG.SHEETS.PAYMENTS, paymentRows);
  appendRows(CONFIG.SHEETS.DELIVERY, deliveryRows);
  Logger.log('   ✓ ' + count + ' orders banaye (payments + delivery ke saath)');
}

/** Demo reviews — verified purchase flags ke saath. */
function seedDemoReviews(products, users) {
  var names = ['Aarav S.', 'Priya K.', 'Rohit M.', 'Sneha R.', 'Imran A.', 'Neha G.',
               'Vikram J.', 'Divya P.', 'Karan T.', 'Meera N.'];
  var titles = ['Great value for money', 'Exactly as described', 'Solid build quality',
                'Absolutely loved it', 'Delivery was quick', 'Worth every rupee',
                'Good but could improve', 'Better than expected'];
  var bodies = [
    'Using it for two weeks now and it works flawlessly. Packaging was neat and delivery was on time.',
    'Quality feels premium and matches the photos. Would recommend to anyone looking in this budget.',
    'Does the job well. Minor issues with finish but overall a satisfying purchase from PShop.',
    'Better than what I expected at this price point. Customer support was responsive too.',
    'Product is genuine and sealed. Been comparing for a month and this was the best deal.',
    'Good performance so far. Will update the review after a few months of usage.'
  ];

  var sh = getSheet(CONFIG.SHEETS.REVIEWS);
  var headers = readHeaders(sh, CONFIG.SHEETS.REVIEWS);
  var rows = [];
  var now = new Date();
  var n = 0;

  for (var i = 0; i < products.length; i += 2) {
    var p = products[i];
    var howMany = (i % 3) + 1;
    for (var j = 0; j < howMany; j++) {
      n++;
      var stars = [5, 5, 4, 5, 4, 3][(i + j) % 6];
      rows.push(objectToRow(headers, {
        id: 'R' + ('000' + n).slice(-4),
        productId: p.i, userId: 'U000' + (2 + ((i + j) % 3)),
        user: names[(i + j) % names.length],
        rating: stars,
        title: titles[(i + j) % titles.length],
        comment: bodies[(i + j) % bodies.length],
        images: '[]',
        verified: (i + j) % 3 !== 0,
        helpful: (i * 7 + j * 3) % 120,
        status: 'approved',
        createdAt: new Date(now.getTime() - ((i + j) % 60) * 864e5).toISOString()
      }));
    }
  }

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }
  Logger.log('   ✓ ' + rows.length + ' reviews banaye');
}

/** Notifications aur support tickets. */
function seedDemoEngagement(users) {
  var customers = users.filter(function (u) { return u.role === 'customer'; });
  var now = new Date();

  // Notifications
  var notifs = [
    ['Welcome to PShop', 'Use code NEWUSER for 15% off your first order.', 'offer', 'pages/shop.html', 2],
    ['Flash Sale is live', 'Extra 18% off on selected products for a limited time.', 'offer', 'pages/shop.html?tag=flash', 8],
    ['Your order was delivered', 'Hope you love it! Tap to write a review.', 'order', 'pages/orders.html', 26],
    ['Price drop alert', 'An item in your wishlist is now 20% cheaper.', 'offer', 'pages/wishlist.html', 40]
  ];

  var notifRows = [];
  for (var c = 0; c < customers.length; c++) {
    for (var i = 0; i < notifs.length; i++) {
      var nf = notifs[i];
      notifRows.push({
        id: uid('N'), userId: customers[c].id,
        title: nf[0], body: nf[1], type: nf[2], link: nf[3],
        read: i > 1,
        createdAt: new Date(now.getTime() - nf[4] * 36e5).toISOString()
      });
    }
  }
  appendRows(CONFIG.SHEETS.NOTIFICATIONS, notifRows);

  // Support tickets
  appendRow(CONFIG.SHEETS.MESSAGES, {
    id: uid('MSG'), userId: customers[0].id, name: 'PShop Support',
    email: CONFIG.SUPPORT_EMAIL, subject: 'Welcome to PShop 🎉',
    thread: JSON.stringify([{
      by: 'support',
      text: 'Hi! Thanks for joining PShop. Reply here any time — our team responds within a few hours.',
      at: new Date(now.getTime() - 3 * 864e5).toISOString()
    }]),
    status: 'open', unread: true,
    createdAt: new Date(now.getTime() - 3 * 864e5).toISOString(), updatedAt: nowISO()
  });

  appendRow(CONFIG.SHEETS.MESSAGES, {
    id: uid('MSG'), userId: customers[1].id, name: customers[1].name,
    email: customers[1].email, subject: 'Where is my order?',
    thread: JSON.stringify([
      { by: 'user', text: 'Hi, my order was supposed to arrive yesterday but it has not.',
        at: new Date(now.getTime() - 2 * 864e5).toISOString() },
      { by: 'support', text: 'Sorry about the delay! Your shipment is out for delivery ' +
        'and should reach you by this evening. Tracking has been updated.',
        at: new Date(now.getTime() - 1.8 * 864e5).toISOString() },
      { by: 'user', text: 'Got it, thank you for the quick response!',
        at: new Date(now.getTime() - 1.5 * 864e5).toISOString() }
    ]),
    status: 'closed', unread: false,
    createdAt: new Date(now.getTime() - 2 * 864e5).toISOString(), updatedAt: nowISO()
  });

  Logger.log('   ✓ Notifications aur support tickets banaye');
}

/**
 * Cart, Wishlist, Newsletter aur OTP sheets me bhi demo rows daalta hai,
 * taaki koi bhi sheet khaali na dikhe aur aap har column ka format dekh sakein.
 */
function seedRemainingSheets(users, products) {
  var customers = users.filter(function (u) { return u.role === 'customer'; });
  var now = new Date();

  /* ---------------- CART — 2 users ke live carts ---------------- */
  var cartPlan = [
    { u: 0, picks: [3, 11] },     // demo@pshop.in ke cart me 2 items
    { u: 1, picks: [22] }         // priya@pshop.in ke cart me 1 item
  ];
  var cartCount = 0, cartRows = [];
  for (var c = 0; c < cartPlan.length; c++) {
    var cu = customers[cartPlan[c].u];
    if (!cu) continue;
    for (var k = 0; k < cartPlan[c].picks.length; k++) {
      var p = products[cartPlan[c].picks[k] % products.length];
      cartRows.push({
        id: uid('CRT'), userId: cu.id, productId: p.i,
        name: p.n, brand: p.b, price: p.p, mrp: p.m,
        image: 'assets/img/products/' + p.im, slug: slugifyText(p.n),
        variant: p.co[0] || '', qty: k + 1, stock: p.st,
        codAvailable: p.cod,
        addedAt: new Date(now.getTime() - (k + 1) * 36e5).toISOString()
      });
      cartCount++;
    }
  }
  appendRows(CONFIG.SHEETS.CART, cartRows);

  /* ---------------- WISHLIST — 3 users ke saved items ---------------- */
  var wishPlan = [
    { u: 0, picks: [5, 17, 30] },
    { u: 1, picks: [8, 41] },
    { u: 2, picks: [14] }
  ];
  var wishCount = 0, wishRows = [];
  for (var w = 0; w < wishPlan.length; w++) {
    var wu = customers[wishPlan[w].u];
    if (!wu) continue;
    for (var j = 0; j < wishPlan[w].picks.length; j++) {
      var wp = products[wishPlan[w].picks[j] % products.length];
      var disc = wp.m > wp.p ? Math.round((1 - wp.p / wp.m) * 100) : 0;
      wishRows.push({
        id: uid('WSH'), userId: wu.id, productId: wp.i,
        name: wp.n, brand: wp.b, price: wp.p, mrp: wp.m,
        image: 'assets/img/products/' + wp.im, slug: slugifyText(wp.n),
        rating: wp.r, discount: disc,
        addedAt: new Date(now.getTime() - (j + 1) * 2 * 864e5).toISOString()
      });
      wishCount++;
    }
  }
  appendRows(CONFIG.SHEETS.WISHLIST, wishRows);

  /* ---------------- NEWSLETTER — subscribers ---------------- */
  var emails = [
    ['demo@pshop.in', 3, 'active'],
    ['priya@pshop.in', 8, 'active'],
    ['rahul@pshop.in', 15, 'active'],
    ['aarav.singh@example.com', 20, 'active'],
    ['neha.gupta@example.com', 28, 'active'],
    ['old.subscriber@example.com', 90, 'unsubscribed']
  ];
  var newsRows = [];
  for (var e = 0; e < emails.length; e++) {
    newsRows.push({
      email: emails[e][0],
      subscribedAt: new Date(now.getTime() - emails[e][1] * 864e5).toISOString(),
      status: emails[e][2]
    });
  }
  appendRows('Newsletter', newsRows);

  /* ---------------- OTP — ek live + ek expired example ---------------- */
  // Note: ye sirf format dikhane ke liye hain. Asli OTP app khud banata hai
  // aur 5 minute me expire ho jate hain.
  appendRow(CONFIG.SHEETS.OTP, {
    identifier: 'demo@pshop.in', code: '482913', purpose: 'login',
    attempts: 0,
    expiresAt: new Date(now.getTime() + CONFIG.OTP_TTL_MINUTES * 60000).toISOString(),
    createdAt: nowISO()
  });
  appendRow(CONFIG.SHEETS.OTP, {
    identifier: '9812345670', code: '705264', purpose: 'reset',
    attempts: 1,
    expiresAt: new Date(now.getTime() - 10 * 60000).toISOString(),   // already expired
    createdAt: new Date(now.getTime() - 15 * 60000).toISOString()
  });

  Logger.log('   ✓ Cart (' + cartCount + '), Wishlist (' + wishCount +
             '), Newsletter (' + emails.length + '), OTP (2) me demo rows daale');
}

/**
 * Demo product catalogue.
 * Short keys use kiye hain taaki file chhoti rahe:
 *   i=id  n=name  b=brand  c=categoryId  cn=categoryName  cs=categorySlug
 *   s=subCategory  p=price  m=mrp  st=stock  r=rating  rc=ratingCount
 *   im=image  t=tags  d=deliveryDays  rd=returnDays  cod=codAvailable
 *   so=sold  w=warranty  co=colors  h=highlights
 */
function DEMO_PRODUCTS() {
  return [
  {"i":"P0006","n":"Pulsewave Wireless Earbuds Edge","b":"Pulsewave","c":"c1","cn":"Electronics","cs":"electronics","s":"Headphones","p":15740,"m":24210,"st":3,"r":4.8,"rc":1248,"im":"p006-1.svg","t":["bestseller"],"d":3,"rd":7,"cod":false,"so":5240,"w":"2 Years","co":["Cloud White","Sand Beige","Graphite"],"h":["Cash on Delivery","1 Year Warranty","Bestseller Pick","Made in India"]},
  {"i":"P0001","n":"AuraTech 5G Smartphone Prime","b":"AuraTech","c":"c1","cn":"Electronics","cs":"electronics","s":"Smartphones","p":55550,"m":61720,"st":48,"r":4.6,"rc":783,"im":"p001-1.svg","t":["trending"],"d":1,"rd":30,"cod":false,"so":3677,"w":"1 Year","co":["Forest Green","Midnight Black","Sand Beige"],"h":["Cash on Delivery","1 Year Warranty","Free Delivery","Limited Stock"]},
  {"i":"P0011","n":"AuraTech Fast Charger Plus","b":"AuraTech","c":"c1","cn":"Electronics","cs":"electronics","s":"Accessories","p":2870,"m":4790,"st":48,"r":4.6,"rc":2875,"im":"p011-1.svg","t":["new","recommended"],"d":7,"rd":7,"cod":true,"so":1409,"w":"6 Months","co":["Midnight Black","Cloud White","Sand Beige"],"h":["Cash on Delivery","Bestseller Pick","Limited Stock","7 Day Replacement"]},
  {"i":"P0003","n":"Zenix Thin & Light Laptop Neo","b":"Zenix","c":"c1","cn":"Electronics","cs":"electronics","s":"Laptops","p":77620,"m":119410,"st":150,"r":4.5,"rc":3826,"im":"p003-1.svg","t":["flash","bestseller","recommended"],"d":3,"rd":7,"cod":false,"so":5624,"w":"1 Year","co":["Ocean Blue","Sand Beige","Cloud White"],"h":["7 Day Replacement","Cash on Delivery","Free Delivery","Premium Build"]},
  {"i":"P0007","n":"Volta GPS Watch Core","b":"Volta","c":"c1","cn":"Electronics","cs":"electronics","s":"Smart Watches","p":19270,"m":42830,"st":150,"r":4.4,"rc":454,"im":"p007-1.svg","t":["recommended","flash"],"d":1,"rd":10,"cod":false,"so":2679,"w":"6 Months","co":["Sand Beige","Graphite","Forest Green"],"h":["Made in India","Limited Stock","Top Rated","Cash on Delivery"]},
  {"i":"P0002","n":"Pulsewave Gaming Phone Plus","b":"Pulsewave","c":"c1","cn":"Electronics","cs":"electronics","s":"Smartphones","p":42880,"m":85760,"st":14,"r":4.2,"rc":418,"im":"p002-1.svg","t":["bestseller","new","trending"],"d":1,"rd":10,"cod":true,"so":996,"w":"6 Months","co":["Midnight Black","Forest Green","Cloud White"],"h":["Premium Build","Made in India","7 Day Replacement","Limited Stock"]},
  {"i":"P0019","n":"Denimo Chronograph Watch Ultra","b":"Denimo","c":"c2","cn":"Fashion","cs":"fashion","s":"Watches","p":6550,"m":7710,"st":90,"r":4.6,"rc":2130,"im":"p019-1.svg","t":["recommended"],"d":2,"rd":30,"cod":true,"so":1471,"w":"1 Year","co":["Cloud White","Forest Green","Graphite"],"h":["Limited Stock","Bestseller Pick","Eco Friendly Packaging","1 Year Warranty"]},
  {"i":"P0018","n":"Denimo Casual Sneakers Lite","b":"Denimo","c":"c2","cn":"Fashion","cs":"fashion","s":"Footwear","p":4690,"m":5210,"st":48,"r":4.5,"rc":171,"im":"p018-1.svg","t":["new","featured"],"d":1,"rd":10,"cod":true,"so":4371,"w":"2 Years","co":["Forest Green","Rose Gold","Graphite"],"h":["1 Year Warranty","Made in India","Eco Friendly Packaging","Premium Build"]},
  {"i":"P0013","n":"Craftline Cotton Shirt Plus","b":"Craftline","c":"c2","cn":"Fashion","cs":"fashion","s":"Men's Wear","p":2530,"m":4220,"st":7,"r":4.4,"rc":2882,"im":"p013-1.svg","t":["flash"],"d":7,"rd":10,"cod":true,"so":4146,"w":"2 Years","co":["Forest Green","Sand Beige","Cloud White"],"h":["1 Year Warranty","Limited Stock","Free Delivery","Premium Build"]},
  {"i":"P0017","n":"Denimo Running Shoes Lite","b":"Denimo","c":"c2","cn":"Fashion","cs":"fashion","s":"Footwear","p":4860,"m":6080,"st":7,"r":4.4,"rc":1014,"im":"p017-1.svg","t":["featured","flash","new"],"d":2,"rd":10,"cod":true,"so":6636,"w":"6 Months","co":["Graphite","Sand Beige","Ocean Blue"],"h":["7 Day Replacement","Premium Build","Limited Stock","Cash on Delivery"]},
  {"i":"P0016","n":"Urbanix Floral Dress Edge","b":"Urbanix","c":"c2","cn":"Fashion","cs":"fashion","s":"Women's Wear","p":2150,"m":3910,"st":25,"r":4.3,"rc":1645,"im":"p016-1.svg","t":["new","trending"],"d":7,"rd":30,"cod":false,"so":7263,"w":"2 Years","co":["Rose Gold","Forest Green","Graphite"],"h":["Bestseller Pick","Top Rated","Cash on Delivery","Eco Friendly Packaging"]},
  {"i":"P0014","n":"Métro Slim Fit Jeans Core","b":"Métro","c":"c2","cn":"Fashion","cs":"fashion","s":"Men's Wear","p":790,"m":1580,"st":7,"r":3.8,"rc":3444,"im":"p014-1.svg","t":["new"],"d":2,"rd":7,"cod":true,"so":84,"w":"2 Years","co":["Midnight Black","Graphite","Ocean Blue"],"h":["Bestseller Pick","Top Rated","Made in India","Limited Stock"]},
  {"i":"P0026","n":"Nordika Triply Kadai Neo","b":"Nordika","c":"c3","cn":"Home & Kitchen","cs":"home-kitchen","s":"Cookware","p":1490,"m":2480,"st":240,"r":4.6,"rc":4132,"im":"p026-1.svg","t":["trending","recommended"],"d":2,"rd":30,"cod":true,"so":7868,"w":"6 Months","co":["Midnight Black","Graphite","Forest Green"],"h":["Free Delivery","Bestseller Pick","Premium Build","Made in India"]},
  {"i":"P0031","n":"CasaVia Table Lamp Core","b":"CasaVia","c":"c3","cn":"Home & Kitchen","cs":"home-kitchen","s":"Decor","p":1470,"m":2100,"st":0,"r":4.6,"rc":3516,"im":"p031-1.svg","t":["recommended"],"d":4,"rd":30,"cod":true,"so":7975,"w":"6 Months","co":["Sand Beige","Graphite","Rose Gold"],"h":["Top Rated","Limited Stock","Cash on Delivery","Eco Friendly Packaging"]},
  {"i":"P0029","n":"Chefline Recliner Chair Core","b":"Chefline","c":"c3","cn":"Home & Kitchen","cs":"home-kitchen","s":"Furniture","p":11680,"m":12980,"st":150,"r":4.4,"rc":1907,"im":"p029-1.svg","t":["bestseller","trending"],"d":4,"rd":15,"cod":true,"so":48,"w":"1 Year","co":["Rose Gold","Sand Beige","Midnight Black"],"h":["7 Day Replacement","1 Year Warranty","Bestseller Pick","Eco Friendly Packaging"]},
  {"i":"P0030","n":"CasaVia Bookshelf Prime","b":"CasaVia","c":"c3","cn":"Home & Kitchen","cs":"home-kitchen","s":"Furniture","p":5600,"m":7000,"st":25,"r":4.4,"rc":2386,"im":"p030-1.svg","t":["bestseller"],"d":1,"rd":7,"cod":true,"so":4104,"w":"1 Year","co":["Ocean Blue","Midnight Black","Rose Gold"],"h":["Made in India","Free Delivery","Eco Friendly Packaging","Cash on Delivery"]},
  {"i":"P0032","n":"HomeNest Photo Frame Set Ultra","b":"HomeNest","c":"c3","cn":"Home & Kitchen","cs":"home-kitchen","s":"Decor","p":830,"m":1270,"st":25,"r":3.8,"rc":2451,"im":"p032-1.svg","t":["flash","featured","trending"],"d":6,"rd":10,"cod":false,"so":3624,"w":"2 Years","co":["Graphite","Sand Beige","Ocean Blue"],"h":["Made in India","Cash on Delivery","Premium Build","Top Rated"]},
  {"i":"P0034","n":"Ironhaus Wardrobe Organizer Edge","b":"Ironhaus","c":"c3","cn":"Home & Kitchen","cs":"home-kitchen","s":"Storage","p":2300,"m":3830,"st":7,"r":3.7,"rc":2962,"im":"p034-1.svg","t":["recommended","flash"],"d":4,"rd":15,"cod":true,"so":2104,"w":"1 Year","co":["Graphite","Forest Green","Sand Beige"],"h":["Cash on Delivery","Free Delivery","Premium Build","Top Rated"]},
  {"i":"P0043","n":"Vitalya Body Mist Ultra","b":"Vitalya","c":"c4","cn":"Beauty","cs":"beauty","s":"Fragrance","p":3960,"m":5660,"st":48,"r":4.7,"rc":3786,"im":"p043-1.svg","t":["flash"],"d":1,"rd":7,"cod":true,"so":2652,"w":"6 Months","co":["Sand Beige","Forest Green","Midnight Black"],"h":["Top Rated","Cash on Delivery","Made in India","Bestseller Pick"]},
  {"i":"P0038","n":"Vitalya Gel Moisturizer Lite","b":"Vitalya","c":"c4","cn":"Beauty","cs":"beauty","s":"Skincare","p":160,"m":220,"st":3,"r":4.5,"rc":4147,"im":"p038-1.svg","t":["bestseller","featured"],"d":5,"rd":30,"cod":true,"so":6852,"w":"6 Months","co":["Cloud White","Rose Gold","Sand Beige"],"h":["Premium Build","Cash on Delivery","Top Rated","Bestseller Pick"]},
  {"i":"P0041","n":"Purelis Kajal Pencil Neo","b":"Purelis","c":"c4","cn":"Beauty","cs":"beauty","s":"Makeup","p":590,"m":840,"st":0,"r":4.5,"rc":3899,"im":"p041-1.svg","t":["featured"],"d":3,"rd":10,"cod":true,"so":5966,"w":"1 Year","co":["Graphite","Rose Gold","Cloud White"],"h":["Made in India","1 Year Warranty","Limited Stock","Top Rated"]},
  {"i":"P0037","n":"Sheen Vitamin C Serum Core","b":"Sheen","c":"c4","cn":"Beauty","cs":"beauty","s":"Skincare","p":740,"m":1140,"st":0,"r":4.4,"rc":2530,"im":"p037-1.svg","t":["bestseller","trending"],"d":4,"rd":7,"cod":true,"so":5956,"w":"2 Years","co":["Midnight Black","Cloud White","Rose Gold"],"h":["Made in India","Free Delivery","Premium Build","Top Rated"]},
  {"i":"P0042","n":"Purelis Liquid Foundation Plus","b":"Purelis","c":"c4","cn":"Beauty","cs":"beauty","s":"Makeup","p":140,"m":340,"st":25,"r":4.4,"rc":2604,"im":"p042-1.svg","t":["flash","recommended","bestseller"],"d":4,"rd":30,"cod":false,"so":162,"w":"1 Year","co":["Ocean Blue","Midnight Black","Forest Green"],"h":["Free Delivery","1 Year Warranty","Cash on Delivery","Top Rated"]},
  {"i":"P0048","n":"Vitalya Omega-3 Max","b":"Vitalya","c":"c4","cn":"Beauty","cs":"beauty","s":"Wellness","p":2190,"m":3370,"st":25,"r":4.4,"rc":3368,"im":"p048-1.svg","t":["bestseller"],"d":6,"rd":10,"cod":true,"so":116,"w":"1 Year","co":["Graphite","Ocean Blue","Rose Gold"],"h":["1 Year Warranty","Premium Build","Eco Friendly Packaging","Cash on Delivery"]},
  {"i":"P0059","n":"Kinetiq Foam Roller Ultra","b":"Kinetiq","c":"c5","cn":"Sports","cs":"sports","s":"Yoga","p":1350,"m":1420,"st":0,"r":4.8,"rc":871,"im":"p059-1.svg","t":["new","flash","trending"],"d":5,"rd":15,"cod":false,"so":7850,"w":"2 Years","co":["Forest Green","Sand Beige","Cloud White"],"h":["7 Day Replacement","Made in India","Cash on Delivery","Premium Build"]},
  {"i":"P0060","n":"Zenflow Yoga Block Pro","b":"Zenflow","c":"c5","cn":"Sports","cs":"sports","s":"Yoga","p":1340,"m":2060,"st":3,"r":4.5,"rc":3823,"im":"p060-1.svg","t":["featured","recommended","bestseller"],"d":6,"rd":15,"cod":true,"so":7164,"w":"6 Months","co":["Graphite","Sand Beige","Rose Gold"],"h":["7 Day Replacement","Cash on Delivery","Free Delivery","Limited Stock"]},
  {"i":"P0054","n":"Strider Cycling Helmet Air","b":"Strider","c":"c5","cn":"Sports","cs":"sports","s":"Cycling","p":40670,"m":47850,"st":3,"r":4.4,"rc":1823,"im":"p054-1.svg","t":["trending","bestseller"],"d":5,"rd":30,"cod":true,"so":3909,"w":"1 Year","co":["Sand Beige","Ocean Blue","Forest Green"],"h":["Premium Build","7 Day Replacement","Eco Friendly Packaging","Limited Stock"]},
  {"i":"P0057","n":"Rallye Trekking Pole Pro","b":"Rallye","c":"c5","cn":"Sports","cs":"sports","s":"Outdoor","p":2070,"m":2590,"st":0,"r":4.3,"rc":385,"im":"p057-1.svg","t":["trending","flash","bestseller"],"d":5,"rd":10,"cod":true,"so":2618,"w":"1 Year","co":["Midnight Black","Sand Beige","Forest Green"],"h":["Eco Friendly Packaging","Premium Build","Free Delivery","Top Rated"]},
  {"i":"P0053","n":"Strider Cycling Helmet Prime","b":"Strider","c":"c5","cn":"Sports","cs":"sports","s":"Cycling","p":11150,"m":18580,"st":0,"r":4.1,"rc":345,"im":"p053-1.svg","t":["recommended","trending"],"d":1,"rd":7,"cod":true,"so":3193,"w":"2 Years","co":["Graphite","Cloud White","Midnight Black"],"h":["Eco Friendly Packaging","Top Rated","Free Delivery","1 Year Warranty"]},
  {"i":"P0049","n":"Vantage Adjustable Dumbbell Prime","b":"Vantage","c":"c5","cn":"Sports","cs":"sports","s":"Fitness","p":1850,"m":2060,"st":150,"r":3.9,"rc":2999,"im":"p049-1.svg","t":["new"],"d":5,"rd":15,"cod":true,"so":5720,"w":"1 Year","co":["Sand Beige","Cloud White","Graphite"],"h":["1 Year Warranty","Limited Stock","7 Day Replacement","Eco Friendly Packaging"]},
  {"i":"P0065","n":"Freshkart Green Tea Core","b":"Freshkart","c":"c6","cn":"Grocery","cs":"grocery","s":"Beverages","p":470,"m":1170,"st":25,"r":4.7,"rc":756,"im":"p065-1.svg","t":["bestseller"],"d":4,"rd":7,"cod":true,"so":8123,"w":"6 Months","co":["Cloud White","Rose Gold","Midnight Black"],"h":["Top Rated","Cash on Delivery","Premium Build","Made in India"]},
  {"i":"P0062","n":"Nutrio Atta 10kg Lite","b":"Nutrio","c":"c6","cn":"Grocery","cs":"grocery","s":"Staples","p":680,"m":900,"st":3,"r":4.6,"rc":3219,"im":"p062-1.svg","t":["bestseller"],"d":2,"rd":7,"cod":false,"so":1131,"w":"2 Years","co":["Forest Green","Cloud White","Graphite"],"h":["1 Year Warranty","Limited Stock","Free Delivery","Top Rated"]},
  {"i":"P0069","n":"Freshkart Body Wash Lite","b":"Freshkart","c":"c6","cn":"Grocery","cs":"grocery","s":"Personal Care","p":370,"m":430,"st":90,"r":4.6,"rc":2448,"im":"p069-1.svg","t":["featured"],"d":4,"rd":30,"cod":true,"so":7610,"w":"1 Year","co":["Ocean Blue","Cloud White","Midnight Black"],"h":["Free Delivery","Premium Build","Cash on Delivery","Bestseller Pick"]},
  {"i":"P0072","n":"Harvestly Detergent 4kg Plus","b":"Harvestly","c":"c6","cn":"Grocery","cs":"grocery","s":"Household","p":520,"m":650,"st":48,"r":4.4,"rc":143,"im":"p072-1.svg","t":["recommended"],"d":5,"rd":15,"cod":true,"so":6276,"w":"2 Years","co":["Forest Green","Ocean Blue","Rose Gold"],"h":["Bestseller Pick","Cash on Delivery","7 Day Replacement","Top Rated"]},
  {"i":"P0067","n":"DailyGood Ghee 1L Air","b":"DailyGood","c":"c6","cn":"Grocery","cs":"grocery","s":"Dairy","p":230,"m":410,"st":14,"r":4.1,"rc":3119,"im":"p067-1.svg","t":["trending","flash","bestseller"],"d":2,"rd":30,"cod":true,"so":3805,"w":"1 Year","co":["Rose Gold","Cloud White","Forest Green"],"h":["Limited Stock","1 Year Warranty","Eco Friendly Packaging","Premium Build"]},
  {"i":"P0071","n":"Nutrio Dish Gel Ultra","b":"Nutrio","c":"c6","cn":"Grocery","cs":"grocery","s":"Household","p":260,"m":400,"st":90,"r":4.1,"rc":173,"im":"p071-1.svg","t":["featured"],"d":3,"rd":10,"cod":true,"so":8526,"w":"1 Year","co":["Forest Green","Graphite","Cloud White"],"h":["Eco Friendly Packaging","1 Year Warranty","Made in India","Bestseller Pick"]},
  {"i":"P0078","n":"Zoomies Plush Bunny Neo","b":"Zoomies","c":"c7","cn":"Toys & Baby","cs":"toys-baby","s":"Soft Toys","p":810,"m":1250,"st":7,"r":4.9,"rc":629,"im":"p078-1.svg","t":["flash","recommended","trending"],"d":1,"rd":10,"cod":true,"so":5567,"w":"6 Months","co":["Graphite","Ocean Blue","Midnight Black"],"h":["1 Year Warranty","Limited Stock","Eco Friendly Packaging","Made in India"]},
  {"i":"P0073","n":"Tinybean Robot Figure Pro","b":"Tinybean","c":"c7","cn":"Toys & Baby","cs":"toys-baby","s":"Action Figures","p":420,"m":650,"st":25,"r":4.3,"rc":2896,"im":"p073-1.svg","t":["trending","recommended"],"d":2,"rd":7,"cod":true,"so":7706,"w":"1 Year","co":["Midnight Black","Cloud White","Ocean Blue"],"h":["Made in India","Top Rated","Cash on Delivery","Limited Stock"]},
  {"i":"P0081","n":"Brainy Magnetic Tiles Plus","b":"Brainy","c":"c7","cn":"Toys & Baby","cs":"toys-baby","s":"Learning","p":2120,"m":2500,"st":14,"r":4.3,"rc":691,"im":"p081-1.svg","t":["featured","recommended"],"d":3,"rd":10,"cod":true,"so":4968,"w":"6 Months","co":["Midnight Black","Graphite","Rose Gold"],"h":["7 Day Replacement","Free Delivery","Limited Stock","Made in India"]},
  {"i":"P0083","n":"Playnest Badminton Set Neo","b":"Playnest","c":"c7","cn":"Toys & Baby","cs":"toys-baby","s":"Outdoor Play","p":2140,"m":2520,"st":0,"r":4.3,"rc":3509,"im":"p083-1.svg","t":["bestseller"],"d":6,"rd":10,"cod":true,"so":841,"w":"1 Year","co":["Midnight Black","Graphite","Sand Beige"],"h":["Free Delivery","Cash on Delivery","Limited Stock","Bestseller Pick"]},
  {"i":"P0079","n":"Playnest Feeding Bottle Edge","b":"Playnest","c":"c7","cn":"Toys & Baby","cs":"toys-baby","s":"Baby Care","p":620,"m":1120,"st":25,"r":4.2,"rc":1738,"im":"p079-1.svg","t":["bestseller","flash"],"d":4,"rd":15,"cod":true,"so":5669,"w":"1 Year","co":["Rose Gold","Ocean Blue","Sand Beige"],"h":["Premium Build","Top Rated","1 Year Warranty","Made in India"]},
  {"i":"P0082","n":"Brickly Alphabet Blocks Pro","b":"Brickly","c":"c7","cn":"Toys & Baby","cs":"toys-baby","s":"Learning","p":1420,"m":2180,"st":150,"r":4.2,"rc":459,"im":"p082-1.svg","t":["recommended"],"d":4,"rd":10,"cod":true,"so":1691,"w":"6 Months","co":["Forest Green","Sand Beige","Midnight Black"],"h":["Free Delivery","Made in India","Top Rated","Cash on Delivery"]},
  {"i":"P0091","n":"Notely Comic Bundle Prime","b":"Notely","c":"c8","cn":"Books","cs":"books","s":"Comics","p":740,"m":1850,"st":48,"r":4.8,"rc":2118,"im":"p091-1.svg","t":["trending","recommended"],"d":2,"rd":7,"cod":true,"so":475,"w":"6 Months","co":["Forest Green","Cloud White","Midnight Black"],"h":["Top Rated","Made in India","7 Day Replacement","Cash on Delivery"]},
  {"i":"P0093","n":"Panelverse A5 Notebook Ultra","b":"Panelverse","c":"c8","cn":"Books","cs":"books","s":"Stationery","p":400,"m":470,"st":150,"r":4.8,"rc":115,"im":"p093-1.svg","t":["trending","flash","featured"],"d":4,"rd":7,"cod":true,"so":5304,"w":"1 Year","co":["Graphite","Cloud White","Midnight Black"],"h":["7 Day Replacement","Cash on Delivery","Free Delivery","Premium Build"]},
  {"i":"P0092","n":"Inkwell Manga Vol.1 Core","b":"Inkwell","c":"c8","cn":"Books","cs":"books","s":"Comics","p":660,"m":1460,"st":0,"r":4.5,"rc":3972,"im":"p092-1.svg","t":["recommended","featured"],"d":4,"rd":15,"cod":true,"so":6163,"w":"2 Years","co":["Midnight Black","Cloud White","Ocean Blue"],"h":["1 Year Warranty","Cash on Delivery","Premium Build","Bestseller Pick"]},
  {"i":"P0085","n":"Scholarix Fantasy Saga Plus","b":"Scholarix","c":"c8","cn":"Books","cs":"books","s":"Fiction","p":460,"m":770,"st":3,"r":4.4,"rc":1199,"im":"p085-1.svg","t":["new","bestseller"],"d":3,"rd":15,"cod":false,"so":273,"w":"1 Year","co":["Ocean Blue","Graphite","Cloud White"],"h":["Made in India","Bestseller Pick","Limited Stock","Top Rated"]},
  {"i":"P0087","n":"Scholarix History Book Neo","b":"Scholarix","c":"c8","cn":"Books","cs":"books","s":"Non-Fiction","p":520,"m":580,"st":90,"r":4.2,"rc":3983,"im":"p087-1.svg","t":["bestseller"],"d":5,"rd":7,"cod":true,"so":1456,"w":"2 Years","co":["Cloud White","Graphite","Sand Beige"],"h":["Premium Build","1 Year Warranty","Made in India","Cash on Delivery"]},
  {"i":"P0088","n":"Notely Habit Guide Max","b":"Notely","c":"c8","cn":"Books","cs":"books","s":"Non-Fiction","p":230,"m":460,"st":240,"r":4.1,"rc":2138,"im":"p088-1.svg","t":["trending"],"d":7,"rd":15,"cod":true,"so":6614,"w":"6 Months","co":["Ocean Blue","Rose Gold","Forest Green"],"h":["Limited Stock","Cash on Delivery","Top Rated","Free Delivery"]}
  ];
}


/* ============================================================================
 * SECTION 19: COLUMN DOCUMENTATION
 * Har sheet ke har column ka matlab. Ye do jagah use hota hai:
 *   • Header cell par "note" (column par hover karne se dikhta hai)
 *   • README sheet me poori table
 * ========================================================================== */

/** Har sheet ka title, kaam aur column-wise explanation. */
function SHEET_DOCS() {
  return {
    Users: {
      title: 'Users — Registered accounts',
      about: 'Website par jitne bhi log signup karte hain, sab yahan aate hain.',
      cols: {
        id: 'Unique user ID. Format: U0001, U0002… (khud banta hai)',
        name: 'Poora naam — jaise "Priya Sharma"',
        email: 'Email address (login ke liye). Duplicate nahi ho sakta',
        phone: '10-digit mobile number, bina +91 ke. Jaise 9876543210',
        password: 'SHA-256 hash. YAHAN KABHI PLAIN PASSWORD MAT LIKHEIN',
        role: '"customer" ya "admin". Admin hi admin panel khol sakta hai',
        verified: 'TRUE = email/OTP verify ho chuka hai',
        avatar: 'Profile photo ka URL. Khaali chhodenge to default icon aayega',
        gender: 'Male / Female / Other. Optional',
        dob: 'Janam tareekh, format: YYYY-MM-DD. Optional',
        addresses: 'JSON array — saari delivery addresses. App khud manage karta hai',
        status: '"active" ya "blocked". Blocked user login nahi kar sakta',
        createdAt: 'Account kab bana (ISO date, khud bharta hai)',
        updatedAt: 'Aakhri baar kab update hua',
        lastLogin: 'Aakhri login ka time'
      }
    },
    Products: {
      title: 'Products — Aapka catalogue',
      about: 'Website par jo saaman dikhta hai. Naya product yahan row add karke ya admin panel se daalein.',
      cols: {
        id: 'Unique product ID. Format: P0001 (dohraana nahi)',
        sku: 'Stock code, jaise PS-ELE-0001. Apni marzi se rakh sakte hain',
        name: 'Product ka poora naam — jo customer ko dikhega',
        slug: 'URL-friendly naam, jaise "auratech-5g-phone" (khud banta hai)',
        brand: 'Brand ka naam. Filter me yahi use hota hai',
        categoryId: 'Categories sheet ka id — jaise c1, c2',
        category: 'Category ka naam — "Electronics"',
        categorySlug: 'Category ka slug — "electronics"',
        subCategory: 'Sub-category — "Smartphones"',
        price: 'Bechne ka daam, sirf number. ₹ ya comma MAT lagayein',
        mrp: 'Original daam (kata hua dikhega). price se zyada hona chahiye',
        discount: 'Kitne % chhoot — khud calculate ho jata hai',
        stock: 'Kitne units bache hain. 0 = Out of Stock dikhega',
        inStock: 'TRUE/FALSE — stock se khud set hota hai',
        rating: '0 se 5 tak, jaise 4.3',
        ratingCount: 'Kitne logon ne rating di',
        reviewCount: 'Kitne likhit reviews hain',
        images: 'JSON array of image paths. Jaise ["assets/img/products/p001-1.svg"]',
        thumb: 'Main image (list me yahi dikhti hai)',
        colors: 'JSON array — ["Black","White"]',
        highlights: 'JSON array — bullet points jo product page par dikhte hain',
        description: 'Poora description paragraph',
        specs: 'JSON object — {"Brand":"Sony","Warranty":"1 Year"}',
        tags: 'JSON array — featured / trending / bestseller / flash / new',
        deliveryDays: 'Kitne din me pahunchega (number)',
        returnDays: 'Return window, jaise 7 ya 30',
        codAvailable: 'TRUE = Cash on Delivery chalega',
        sold: 'Ab tak kitne bike (popularity sort me use hota hai)',
        status: '"active" = dikhega, "deleted" = chhup jayega',
        createdAt: 'Kab add hua',
        updatedAt: 'Kab aakhri baar badla'
      }
    },
    Categories: {
      title: 'Categories — Departments',
      about: 'Homepage aur menu me jo categories dikhti hain.',
      cols: {
        id: 'Category ID — c1, c2, c3…',
        name: 'Dikhne wala naam — "Electronics"',
        slug: 'URL me use hota hai — "electronics" (space nahi, chhote akshar)',
        description: 'Ek line ka description',
        icon: 'Icon image ka path',
        banner: 'Category page ka bada banner',
        color: 'Theme colour hex me — #2563eb',
        subCategories: 'JSON array — ["Smartphones","Laptops"]',
        brands: 'JSON array of brands (khud bhar jata hai)',
        productCount: 'Kitne products hain (khud ginta hai)',
        status: '"active" ya "inactive"',
        sortOrder: 'Kis number par dikhe — 1 sabse pehle',
        createdAt: 'Kab bani'
      }
    },
    Orders: {
      title: 'Orders — Customer ke orders',
      about: 'Har order ki poori detail. Status yahan badalne se customer ko turant dikhta hai.',
      cols: {
        id: 'Order ID — PS20261234567 (khud banta hai)',
        userId: 'Kis user ka order — Users sheet ka id',
        items: 'JSON array — kaunse products, kitne, kis daam par',
        address: 'JSON object — delivery ka poora pata',
        contact: 'JSON object — naam, email, phone',
        payment: 'JSON object — {"method":"cod","label":"Cash on Delivery"}',
        totals: 'JSON object — subtotal, discount, shipping, total',
        coupon: 'JSON object agar coupon laga ho, warna khaali',
        status: 'Placed / Confirmed / Packed / Shipped / Out for Delivery / Delivered / Cancelled',
        paymentStatus: 'Pending / Paid / Refund initiated / Refunded / Cancelled',
        placedAt: 'Order kab hua',
        expectedAt: 'Kab tak pahunchega',
        deliveredAt: 'Kab pahuncha (delivered hone par)',
        invoiceNo: 'Bill number — INV-2026-123456',
        awb: 'Courier tracking number',
        courier: 'Courier company ka naam',
        timeline: 'JSON array — har step ka time aur note',
        cancelReason: 'Cancel karne ki wajah',
        returnReason: 'Return karne ki wajah',
        cancellable: 'TRUE = customer abhi cancel kar sakta hai',
        returnable: 'TRUE = return kar sakta hai (delivered ke baad)',
        updatedAt: 'Aakhri badlav ka time'
      }
    },
    Cart: {
      title: 'Cart — Abhi ke shopping carts',
      about: 'Logged-in users ke cart. Order place hote hi rows hat jati hain.',
      cols: {
        id: 'Cart line ID — CRT… (khud banta hai)',
        userId: 'Kis user ka cart',
        productId: 'Kaunsa product',
        name: 'Product ka naam (speed ke liye copy kiya hua)',
        brand: 'Brand',
        price: 'Add karte waqt ka daam',
        mrp: 'Original daam',
        image: 'Thumbnail path',
        slug: 'Product ka slug',
        variant: 'Colour ya size, jaise "Midnight Black"',
        qty: 'Kitne pieces',
        stock: 'Us waqt kitna stock tha',
        codAvailable: 'COD chalega ya nahi',
        addedAt: 'Cart me kab daala'
      }
    },
    Wishlist: {
      title: 'Wishlist — Saved products',
      about: 'Users ne jo products dil (heart) icon se save kiye.',
      cols: {
        id: 'Wishlist row ID',
        userId: 'Kis user ne save kiya',
        productId: 'Kaunsa product',
        name: 'Product ka naam',
        brand: 'Brand',
        price: 'Save karte waqt ka daam',
        mrp: 'Original daam',
        image: 'Thumbnail',
        slug: 'Product slug',
        rating: 'Rating',
        discount: 'Discount %',
        addedAt: 'Kab save kiya'
      }
    },
    Payments: {
      title: 'Payments — Paisa ka record',
      about: 'Har order ka payment aur refund yahan track hota hai.',
      cols: {
        id: 'Payment ID — PAY…',
        orderId: 'Kis order ka payment',
        userId: 'Kis user ne kiya',
        method: 'cod / upi / razorpay',
        amount: 'Kitna paisa (number)',
        status: 'Pending / Paid / Failed / Refunded',
        reference: 'Transaction number — TXN…',
        app: 'UPI app ka naam (Google Pay, PhonePe)',
        last4: 'Card ke aakhri 4 digit (poora card kabhi nahi)',
        refundStatus: 'Initiated / Completed — khaali matlab refund nahi',
        refundAmount: 'Kitna refund hua',
        refundedAt: 'Refund kab hua',
        createdAt: 'Payment kab hua'
      }
    },
    Reviews: {
      title: 'Reviews — Customer feedback',
      about: 'Product page par jo reviews dikhte hain. Yahan se hide/delete kar sakte hain.',
      cols: {
        id: 'Review ID — R0001',
        productId: 'Kis product ka review',
        userId: 'Kis user ne likha',
        user: 'Dikhne wala naam — "Priya K."',
        rating: '1 se 5 tak (number)',
        title: 'Review ka chhota heading',
        comment: 'Poora review text',
        images: 'JSON array of photo URLs (optional)',
        verified: 'TRUE = is user ne sach me kharida tha',
        helpful: 'Kitne logon ne "helpful" kaha',
        status: '"approved" = dikhega, "hidden" = chhupa rahega',
        createdAt: 'Kab likha gaya'
      }
    },
    Coupons: {
      title: 'Coupons — Discount codes',
      about: 'Checkout par jo codes lagte hain. Naya coupon yahan row add karke bana sakte hain.',
      cols: {
        code: 'Coupon code BADE AKSHAR me — PSHOP10 (yahi unique ID hai)',
        type: '"percent" = % off | "flat" = rupee off | "shipping" = free delivery',
        value: 'percent ke liye 10 = 10%, flat ke liye 200 = ₹200',
        minOrder: 'Itne se upar ka order hona chahiye. 0 = koi limit nahi',
        maxDiscount: 'Zyada se zyada itni chhoot (percent type ke liye zaroori)',
        description: 'Customer ko jo line dikhegi',
        usageLimit: 'Kitni baar total use ho sakta hai',
        usedCount: 'Ab tak kitni baar use hua (khud badhta hai)',
        expiry: 'Kab tak valid — YYYY-MM-DD',
        active: 'TRUE = chalu, FALSE = band',
        createdAt: 'Kab bana'
      }
    },
    Notifications: {
      title: 'Notifications — App ke andar ke alerts',
      about: 'Ghanti (bell) icon par jo dikhta hai.',
      cols: {
        id: 'Notification ID',
        userId: 'Kis user ke liye. "all" likhne par sabko jayega',
        title: 'Heading — "Order shipped"',
        body: 'Poora message',
        type: 'order / offer / payment / system (icon isse decide hota hai)',
        link: 'Click karne par kahan jaye — pages/orders.html',
        read: 'TRUE = padh liya',
        createdAt: 'Kab bheja'
      }
    },
    Messages: {
      title: 'Messages — Support tickets',
      about: 'Customer aur support team ki baat-cheet.',
      cols: {
        id: 'Ticket ID — MSG…',
        userId: 'Kis user ka ticket',
        name: 'Customer ka naam',
        email: 'Reply kahan bhejna hai',
        subject: 'Kis baare me hai',
        thread: 'JSON array — poori conversation [{by,text,at}]',
        status: '"open" = chalu, "closed" = solve ho gaya',
        unread: 'TRUE = customer ne abhi padha nahi',
        createdAt: 'Ticket kab bana',
        updatedAt: 'Aakhri message kab aaya'
      }
    },
    Delivery: {
      title: 'Delivery — Shipment tracking',
      about: 'Har order ki delivery ki detail aur courier updates.',
      cols: {
        id: 'Delivery ID — DLV…',
        orderId: 'Kis order ki delivery',
        awb: 'Tracking number',
        courier: 'Courier company',
        status: 'Pending pickup / Shipped / Out for Delivery / Delivered',
        pincode: 'Delivery pincode',
        city: 'Shehar',
        agent: 'Delivery boy ka naam',
        agentPhone: 'Delivery boy ka number',
        eta: 'Kab tak pahunchega',
        updates: 'JSON array — har update ka time aur note',
        createdAt: 'Shipment kab bana',
        updatedAt: 'Aakhri update'
      }
    },
    Settings: {
      title: 'Settings — Website ki settings',
      about: 'Delivery charge, GST wagairah. Admin panel se bhi badal sakte hain.',
      cols: {
        key: 'Setting ka naam — freeShipAbove, shippingFee (BADLEIN MAT)',
        value: 'Iski value — 499, 79 wagairah',
        description: 'Ye setting kya karti hai',
        updatedAt: 'Kab badli'
      }
    },
    Banners: {
      title: 'Banners — Homepage slider',
      about: 'Homepage par jo badi tasveer ghumti hai.',
      cols: {
        id: 'Banner ID — b1, b2',
        title: 'Bada heading — "Monsoon Mega Sale"',
        subtitle: 'Chhoti line neeche',
        cta: 'Button par kya likha ho — "Shop Now"',
        link: 'Button click par kahan jaye',
        image: 'Banner image ka path',
        theme: 'Background colour hex me',
        active: 'TRUE = dikhega',
        sortOrder: 'Kis number par dikhe'
      }
    },
    FAQs: {
      title: 'FAQs — Sawal-jawab',
      about: 'FAQ page ka content. Naya sawal yahan add kar sakte hain.',
      cols: {
        id: 'FAQ ID — F1, F2',
        category: 'Orders / Payments / Delivery / Returns / Account / Products',
        question: 'Sawal',
        answer: 'Jawab (poora paragraph)',
        sortOrder: 'Kis number par dikhe',
        active: 'TRUE = dikhega'
      }
    },
    Newsletter: {
      title: 'Newsletter — Email subscribers',
      about: 'Footer se jo log email subscribe karte hain.',
      cols: {
        email: 'Subscriber ka email',
        subscribedAt: 'Kab subscribe kiya',
        status: '"active" ya "unsubscribed"'
      }
    },
    OTP: {
      title: 'OTP — Temporary codes',
      about: 'Login/reset ke OTP. 5 minute me khud expire ho jate hain. HAATH MAT LAGAYEIN.',
      cols: {
        identifier: 'Kis email/phone ka OTP hai',
        code: '6-digit code',
        purpose: 'login / signup / reset',
        attempts: 'Kitni baar galat try kiya (5 ke baad block)',
        expiresAt: 'Kab expire hoga',
        createdAt: 'Kab bheja gaya'
      }
    }
  };
}

/**
 * Har sheet ke header cells par note (comment) lagata hai.
 * Sheet me column heading par hover karne se matlab dikh jayega.
 */
function applyColumnNotes() {
  var docs = SHEET_DOCS();
  var ss = getSS();
  var done = 0;

  for (var sheetName in docs) {
    if (!docs.hasOwnProperty(sheetName)) continue;
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastColumn() === 0) continue;

    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var notes = [];
    for (var c = 0; c < headers.length; c++) {
      var key = String(headers[c]).trim();
      var text = docs[sheetName].cols[key];
      notes.push([text ? (key + '\n\n' + text) : '']);
    }
    // Notes ek hi call me lagao (fast).
    if (notes.length) {
      sh.getRange(1, 1, 1, notes.length).setNotes([notes.map(function (n) { return n[0]; })]);
      done++;
    }
  }
  Logger.log('   ✓ ' + done + ' sheets par column notes lagaye');
  return done;
}

/**
 * README sheet banata hai — saari sheets aur unke columns ki poori list.
 * Ye sheet sabse pehle dikhti hai taaki naya banda samajh sake.
 */
function buildReadmeSheet() {
  var ss = getSS();
  var name = 'README';
  var sh = ss.getSheetByName(name);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(name, 0);      // 0 = sabse pehli position

  var docs = SHEET_DOCS();
  var rows = [];

  // Title block
  rows.push(['PShop — Database Guide', '', '']);
  rows.push(['Ye sheet sirf samajhne ke liye hai. Ise delete kar sakte hain.', '', '']);
  rows.push(['', '', '']);
  rows.push(['Demo logins:', 'admin@pshop.in / admin123', 'Admin panel ke liye']);
  rows.push(['', 'demo@pshop.in / demo123', 'Customer account']);
  rows.push(['', 'priya@pshop.in / priya123', 'Customer account']);
  rows.push(['', 'rahul@pshop.in / rahul123', 'Customer account']);
  rows.push(['', '', '']);
  rows.push(['SHEET', 'COLUMN', 'MATLAB']);

  var headerRowIndex = rows.length;   // formatting ke liye yaad rakho

  for (var sheetName in docs) {
    if (!docs.hasOwnProperty(sheetName)) continue;
    var d = docs[sheetName];
    rows.push(['', '', '']);
    rows.push([d.title, '', d.about]);
    for (var col in d.cols) {
      if (!d.cols.hasOwnProperty(col)) continue;
      rows.push(['', col, d.cols[col]]);
    }
  }

  sh.getRange(1, 1, rows.length, 3).setValues(rows);

  // Formatting
  sh.getRange(1, 1, 1, 3).merge().setFontSize(16).setFontWeight('bold')
    .setBackground('#2563eb').setFontColor('#ffffff');
  sh.getRange(headerRowIndex, 1, 1, 3).setFontWeight('bold')
    .setBackground('#1e293b').setFontColor('#ffffff');
  sh.setColumnWidth(1, 240);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 620);
  sh.getRange(1, 1, rows.length, 3).setVerticalAlignment('top').setWrap(true);
  sh.setFrozenRows(headerRowIndex);

  Logger.log('   ✓ README sheet banayi (' + rows.length + ' rows)');
  return rows.length;
}
