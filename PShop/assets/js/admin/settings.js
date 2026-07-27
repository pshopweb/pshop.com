/* ==========================================================================
   PShop Admin — Website settings
   ========================================================================== */
import { adminPage, $, $$, esc, icon, toast } from './_admin-core.js';
import { api } from '../core/api.js';
import { CONFIG } from '../core/config.js';
import { isLiveBackend } from '../core/api.js';

adminPage('settings.html', async () => {
  await load();
  renderBackendInfo();

  $('#set-form').addEventListener('submit', onSave);
  $('#s-reload').addEventListener('click', async () => {
    await load();
    toast.info('Settings reloaded from the server.');
  });
});

async function load() {
  const res = await api('adminSettings', {});
  const s = res.success ? (res.data.settings || {}) : {};

  // Backend na ho to config.js ke defaults dikha do.
  const fallback = {
    siteName: CONFIG.APP_NAME,
    supportEmail: CONFIG.SUPPORT_EMAIL,
    supportPhone: CONFIG.SUPPORT_PHONE,
    currency: CONFIG.CURRENCY_CODE,
    freeShipAbove: CONFIG.FREE_SHIP_ABOVE,
    shippingFee: CONFIG.SHIPPING_FEE,
    expressFee: CONFIG.EXPRESS_FEE,
    codFee: CONFIG.COD_FEE,
    taxRate: CONFIG.TAX_RATE,
    maintenanceMode: 'false'
  };

  $$('[data-key]').forEach(node => {
    const key = node.dataset.key;
    const value = s[key] !== undefined ? s[key] : fallback[key];
    if (node.type === 'checkbox') {
      node.checked = value === true || value === 'true' || value === 'TRUE';
    } else {
      node.value = value ?? '';
    }
  });
}

async function onSave(e) {
  e.preventDefault();
  const settings = {};
  $$('[data-key]').forEach(node => {
    settings[node.dataset.key] = node.type === 'checkbox' ? String(node.checked) : node.value;
  });

  const btn = $('#s-save');
  btn.classList.add('is-loading');
  const res = await api('adminUpdateSettings', { settings });
  btn.classList.remove('is-loading');

  if (!res.success) return toast.error(res.message);
  toast.success(res.message, {
    title: 'Settings saved',
    duration: 4200
  });
}

function renderBackendInfo() {
  const live = isLiveBackend();
  $('#backend-info').innerHTML = `
    <div class="flex gap-3 items-center mb-4">
      <span style="color:var(--${live ? 'success' : 'warning'})">
        ${icon(live ? 'checkCircle' : 'alert', 26)}</span>
      <div>
        <div class="semi">${live ? 'Connected to Google Sheets' : 'Running on demo data'}</div>
        <div class="xs muted">${live
          ? 'All changes are saved to your Google Sheet in real time.'
          : 'Set API_BASE_URL in assets/js/core/config.js to connect your backend.'}</div>
      </div>
    </div>
    <div class="sum-row"><span class="lbl">API endpoint</span>
      <span class="xs" style="font-family:ui-monospace,monospace;word-break:break-all">
        ${esc(CONFIG.API_BASE_URL || 'not configured')}</span></div>
    <div class="sum-row"><span class="lbl">Offline fallback</span>
      <span class="badge ${CONFIG.USE_MOCK_FALLBACK ? 'badge-success' : 'badge-muted'}">
        ${CONFIG.USE_MOCK_FALLBACK ? 'Enabled' : 'Disabled'}</span></div>
    <div class="sum-row"><span class="lbl">App version</span>
      <span class="semi">v${esc(CONFIG.VERSION)}</span></div>
    ${!live ? `<p class="xs muted mt-4">
      Setup guide: <b>docs/BACKEND-SETUP-HINDI.md</b></p>` : ''}`;
}
