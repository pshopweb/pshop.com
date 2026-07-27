/**
 * PShop — Google Apps Script emulator (Node ke liye)
 * Real Sheets/Utilities/MailApp ko mock karta hai taaki backend ko locally
 * test kar sakein. Sirf development ke liye — deploy me iski zaroorat nahi.
 */
const fs = require('fs'), crypto = require('crypto');

function createEnv() {
  const sheets = {}, notes = {};
  const ensure = n => (sheets[n] = sheets[n] || []);

  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
    setValues(v) {
      const d = ensure(this.sh);
      for (let i = 0; i < v.length; i++) {
        const row = this.r - 1 + i;
        while (d.length <= row) d.push([]);
        for (let j = 0; j < v[i].length; j++) d[row][this.c - 1 + j] = v[i][j];
      }
      return this;
    }
    getValues() {
      const d = ensure(this.sh), o = [];
      for (let i = 0; i < this.nr; i++) {
        const row = d[this.r - 1 + i] || [], s = [];
        for (let j = 0; j < this.nc; j++) s.push(row[this.c - 1 + j] ?? '');
        o.push(s);
      }
      return o;
    }
    setNotes(n) { notes[this.sh] = n[0]; return this; }
    setFontWeight() { return this; } setBackground() { return this; }
    setFontColor() { return this; } setFontSize() { return this; }
    merge() { return this; } setVerticalAlignment() { return this; }
    setWrap() { return this; }
  }

  class Sheet {
    constructor(n) { this.name = n; ensure(n); }
    getName() { return this.name; }
    getRange(r, c, nr = 1, nc = 1) {
      // Real Apps Script ye errors deta hai — emulator me bhi hone chahiye,
      // warna bug local test me pass ho jata hai aur live par fatta hai.
      if (nc < 1) throw new Error('The number of columns in the range must be at least 1.');
      if (nr < 1) throw new Error('The number of rows in the range must be at least 1.');
      if (r < 1) throw new Error('The starting row of the range is too small.');
      if (c < 1) throw new Error('The starting column of the range is too small.');
      return new Range(this.name, r, c, nr, nc);
    }
    getDataRange() {
      const d = ensure(this.name);
      return new Range(this.name, 1, 1, Math.max(d.length, 1),
        Math.max(1, ...d.map(r => r.length)));
    }
    getLastRow() { return ensure(this.name).length; }
    getMaxRows() { return Math.max(ensure(this.name).length, 1000); }
    getLastColumn() { const d = ensure(this.name); return Math.max(0, ...d.map(r => r.length)); }
    appendRow(r) { ensure(this.name).push(r.slice()); }
    deleteRow(n) { ensure(this.name).splice(n - 1, 1); }
    deleteRows(s, c) { ensure(this.name).splice(s - 1, c); }
    setFrozenRows() {} autoResizeColumns() {} setColumnWidth() {}
  }

  const SS = {
    _s: {},
    getSheetByName(n) { return this._s[n] || null; },
    insertSheet(n) { return (this._s[n] = new Sheet(n)); },
    deleteSheet(sh) { delete this._s[sh.getName()]; delete sheets[sh.getName()]; },
    getName: () => 'pshopdb',
    getId: () => '1wTwksFgwT-cD79l3ccPsR5rvgNZDp3wAxeqI236eD2M',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST/edit',
    getSheets() { return Object.values(this._s); }
  };

  const props = {}, mails = [], logs = [];

  global.SpreadsheetApp = { getActiveSpreadsheet: () => SS, openById: () => SS, getUi: null };
  global.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: k => props[k] || null,
      setProperty: (k, v) => { props[k] = v; },
      deleteProperty: k => { delete props[k]; }
    })
  };
  global.Logger = { log: (...a) => logs.push(a.join(' ')) };
  global.ContentService = {
    MimeType: { JSON: 'json' },
    createTextOutput: t => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } })
  };
  global.Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (_a, s) => Array.from(crypto.createHash('sha256').update(s).digest()),
    computeHmacSha256Signature: (s, k) =>
      Array.from(crypto.createHmac('sha256', k).update(s).digest()),
    base64Encode: b =>
      Buffer.from(typeof b === 'string' ? b : Uint8Array.from(b.map(x => x & 255))).toString('base64'),
    base64Decode: s => Array.from(Buffer.from(s, 'base64')),
    newBlob: (d, mime, name) => ({
      _bytes: d, _mime: mime, _name: name,
      getDataAsString: () => Buffer.from(Uint8Array.from(d.map(x => x & 255))).toString('utf8'),
      getName: () => name,
      getBytes: () => d
    })
  };
  global.MailApp = { sendEmail: o => mails.push(o) };

  // Drive mock — folders aur files track karta hai taaki upload test ho sake.
  const driveFiles = [], driveFolders = {};
  function makeFolder(name) {
    if (driveFolders[name]) return driveFolders[name];
    const folder = {
      _name: name,
      getName: () => name,
      getId: () => 'FOLDER_' + name.replace(/\W/g, '_'),
      createFile(blob) {
        const id = 'FILE_' + (driveFiles.length + 1);
        const file = {
          getId: () => id,
          getName: () => (blob && blob._name) || 'file',
          getSize: () => (blob && blob._bytes ? blob._bytes.length : 0),
          setSharing() { return this; }
        };
        driveFiles.push({ id, folder: name, blob });
        return file;
      },
      getFoldersByName(sub) {
        const key = name + '/' + sub;
        let idx = 0;
        const hit = driveFolders[key];
        return {
          hasNext: () => Boolean(hit) && idx === 0,
          next: () => { idx++; return hit; }
        };
      },
      createFolder(sub) {
        const key = name + '/' + sub;
        driveFolders[key] = makeFolderNamed(key, sub);
        return driveFolders[key];
      }
    };
    driveFolders[name] = folder;
    return folder;
  }
  function makeFolderNamed(key, displayName) {
    const f = makeFolder(key);
    f.getName = () => displayName;
    return f;
  }

  global.DriveApp = {
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', PRIVATE: 'PRIVATE' },
    Permission: { VIEW: 'VIEW', EDIT: 'EDIT' },
    getFoldersByName(name) {
      let idx = 0;
      const hit = driveFolders[name];
      return {
        hasNext: () => Boolean(hit) && idx === 0,
        next: () => { idx++; return hit; }
      };
    },
    createFolder: name => makeFolder(name),
    _files: driveFiles,
    _folders: driveFolders
  };
  global.UrlFetchApp = { fetch: () => ({ getContentText: () => '[]' }) };

  return { sheets, notes, props, mails, logs, SS, drive: global.DriveApp };
}

/** Backend file load karta hai aur uske functions return karta hai. */
function loadBackend(path = '/home/user/PShop/backend/PShop-Complete.gs') {
  const env = createEnv();
  const src = fs.readFileSync(path, 'utf8');
  (0, eval)(src + `
    global.__api = {
      doGet, doPost, routeRequest, setupDatabase, setupDemoStore,
      readAll, appendRow, appendRows, CONFIG, getSS, whichSheet,
      applyColumnNotes, buildReadmeSheet, clearDemoData, clearSheetCache,
      toISO, toDateKey, apiCheckCod, DB_SCHEMA, readHeaders, getSchemaHeaders,
      makeThumbUrl, apiUploadImages
    };`);
  return { ...env, api: global.__api };
}

module.exports = { createEnv, loadBackend };
