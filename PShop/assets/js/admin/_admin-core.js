/* ==========================================================================
   PShop Admin — shared bootstrap
   Access guard, sidebar, topbar, theme, backend badge aur common helpers.
   Har admin page isse initAdmin() call karta hai.
   ========================================================================== */
import { CONFIG, url } from '../core/config.js';
import { $, $$, esc, money, ready } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { isLiveBackend } from '../core/api.js';
import { Theme } from '../components/theme.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';

const NAV = [
  ['Overview', [
    ['dashboard.html', 'barChart', 'Dashboard'],
    ['reports.html', 'pieChart', 'Reports & Analytics']
  ]],
  ['Catalogue', [
    ['products.html', 'box', 'Products'],
    ['categories.html', 'layers', 'Categories'],
    ['coupons.html', 'tag', 'Coupons'],
    ['reviews.html', 'star', 'Reviews']
  ]],
  ['Operations', [
    ['orders.html', 'package', 'Orders'],
    ['users.html', 'users', 'Users'],
    ['messages.html', 'chat', 'Messages']
  ]],
  ['System', [
    ['settings.html', 'settings', 'Settings']
  ]]
];

/**
 * Admin page ko boot karta hai.
 * @returns {Promise<boolean>} true agar access mila
 */
export async function initAdmin(activeFile) {
  Theme.init();

  // ---- Access guard: sirf admin role ----
  if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
    $('#admin-gate').hidden = false;
    $('#gate-ico').innerHTML = icon('lock', 28);
    if (Auth.isLoggedIn()) {
      $('#gate-msg').textContent =
        `You are signed in as ${Auth.user().name}, which is not an administrator account.`;
      $('#gate-login').textContent = 'Sign in with an admin account';
    }
    // Login ke baad wapas isi page par aayein
    const back = encodeURIComponent('../admin/' + activeFile);
    $('#gate-login').href = url(`pages/login.html?admin=1&next=${back}`);
    document.querySelector('.page-loader')?.remove();
    return false;
  }

  $('#admin-shell').hidden = false;
  renderNav(activeFile);
  wireChrome();

  $('#admin-name').textContent = Auth.user().name;

  const live = isLiveBackend();
  const badge = $('#backend-badge');
  badge.className = 'badge ' + (live ? 'badge-success' : 'badge-warning');
  badge.textContent = live ? 'Google Sheet' : 'Demo data';
  badge.title = live
    ? 'Connected to your Google Apps Script backend'
    : 'No backend configured — showing local demo data. Set API_BASE_URL in config.js.';

  return true;
}

function renderNav(activeFile) {
  $('#admin-nav').innerHTML = NAV.map(([group, links]) => `
    <div class="grp">${group}</div>
    ${links.map(([href, ic, label]) => `
      <a href="${href}" class="${href === activeFile ? 'active' : ''}"
         ${href === activeFile ? 'aria-current="page"' : ''}>
        ${icon(ic, 18)}<span>${label}</span>
      </a>`).join('')}`).join('');
}

function wireChrome() {
  const side = $('#admin-side'), ov = $('#admin-overlay'), burger = $('#admin-burger');
  burger.innerHTML = icon('menu', 22);

  const toggle = open => {
    side.classList.toggle('open', open);
    ov.classList.toggle('open', open);
    document.body.classList.toggle('no-scroll', open);
  };
  burger.addEventListener('click', () => toggle(true));
  ov.addEventListener('click', () => toggle(false));
  $$('#admin-nav a').forEach(a => a.addEventListener('click', () => toggle(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });

  $('#admin-logout').addEventListener('click', () => {
    Auth.logout();
    toast.success('Signed out.');
    setTimeout(() => location.href = url('index.html'), 600);
  });

  Theme.syncButtons();
}

/* ------------------------------- helpers ---------------------------------- */

/** Status ke hisab se badge class. */
export function orderBadge(status) {
  if (status === 'Delivered') return 'badge-success';
  if (status === 'Cancelled') return 'badge-danger';
  if (/Return|Replacement/.test(status)) return 'badge-warning';
  if (status === 'Shipped' || status === 'Out for Delivery') return 'badge-info';
  return 'badge-muted';
}

/** Table ke andar loading skeleton rows. */
export function tableLoading(tbody, cols, rows = 5) {
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      '<td><div class="skeleton sk-text w-80"></div></td>').join('')}</tr>`).join('');
}

/** Table me "kuch nahi mila" row. */
export function tableEmpty(tbody, cols, message) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:3rem 1rem">
    <div class="muted">${esc(message)}</div></td></tr>`;
}

/** Modal kholna/band karna. */
export function openModal(id) {
  $(id).classList.add('open');
  document.body.classList.add('no-scroll');
}
export function closeModal(id) {
  $(id).classList.remove('open');
  document.body.classList.remove('no-scroll');
}

/** Modal ke close/cancel/overlay buttons ko wire karta hai. */
export function wireModal(modalId, closeIds = []) {
  const modal = $(modalId);
  if (!modal) return;
  const close = () => closeModal(modalId);
  closeIds.forEach(id => $(id)?.addEventListener('click', close));
  modal.querySelector('.overlay')?.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
}

/** Rows ko CSV file ke roop me download karta hai. */
export function exportCSV(filename, rows) {
  if (!rows.length) return toast.warn('Nothing to export.');
  const headers = Object.keys(rows[0]);
  const escape = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast.success(`${rows.length} row(s) exported.`);
}

/** Simple CSS bar chart. */
export function barChart(host, series, formatValue = money) {
  if (!host) return;
  if (!series.length) {
    host.innerHTML = '<p class="muted small">No data for this period yet.</p>';
    return;
  }
  const max = Math.max(...series.map(s => s.value), 1);
  host.innerHTML = series.map(s => `
    <div class="bar" style="height:${Math.max(3, (s.value / max) * 100)}%"
         data-label="${esc(s.label)}" title="${esc(s.label)}: ${formatValue(s.value)}">
      <span>${formatValue(s.value)}</span>
    </div>`).join('');
}

/** SVG donut chart with legend. */
export function donutChart(host, slices) {
  if (!host) return;
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) {
    host.innerHTML = '<p class="muted small">No orders yet.</p>';
    return;
  }
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices.filter(s => s.value > 0).map(s => {
    const len = (s.value / total) * C;
    const arc = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${s.color}"
      stroke-width="22" stroke-dasharray="${len} ${C - len}"
      stroke-dashoffset="${-offset}"><title>${esc(s.label)}: ${s.value}</title></circle>`;
    offset += len;
    return arc;
  }).join('');

  host.innerHTML = `
    <svg viewBox="0 0 140 140" width="140" height="140" role="img"
         aria-label="Order status distribution">
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="22"/>
      ${arcs}
    </svg>
    <div class="donut-legend">
      ${slices.map(s => `<div><i style="background:${s.color}"></i>
        <span>${esc(s.label)}</span><span class="n">${s.value}</span></div>`).join('')}
    </div>`;
}

/** Page bootstrap wrapper — errors ko gracefully handle karta hai. */
export function adminPage(file, main) {
  ready(async () => {
    try {
      const allowed = await initAdmin(file);
      if (allowed) await main();
    } catch (err) {
      console.error('[PShop admin]', err);
      toast.error('Something went wrong loading this page.');
    }
  });
}

export { $, $$, esc, money, icon, toast, Auth };
