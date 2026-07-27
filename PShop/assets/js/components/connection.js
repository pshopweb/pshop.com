/* ==========================================================================
   PShop — Connection status indicator

   Backend down ho, internet jaye, ya demo data chal raha ho — user ko
   saaf dikhta hai. Chup-chaap fail hone se behtar hai ki bata dein.

   • Online          → kuch nahi dikhta (sab theek hai)
   • Offline         → laal bar "Internet nahi hai"
   • Backend down    → peela bar "Demo data dikha rahe hain"
   • Wapas aa gaya   → hara toast "Connection wapas aa gaya"
   ========================================================================== */
import { CONFIG } from '../core/config.js';
import { getConnection, CONNECTION_STATE, pingBackend } from '../core/api.js';
import { icon } from './icons.js';

let bar = null;
let lastState = null;

/** Status bar banata hai (sirf ek baar). */
function ensureBar() {
  if (bar && document.body.contains(bar)) return bar;
  bar = document.createElement('div');
  bar.className = 'conn-bar';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  document.body.append(bar);
  return bar;
}

/** State ke hisaab se bar dikhata/chhupata hai. */
function paint(state, detail = {}) {
  const node = ensureBar();

  // Online ya demo mode — kuch dikhane ki zaroorat nahi.
  if (state === CONNECTION_STATE.ONLINE || state === CONNECTION_STATE.DEMO) {
    node.classList.remove('show');
    // Pehle problem thi aur ab theek ho gayi — chhota confirmation dikhao.
    if (detail.recovered && lastState && lastState !== CONNECTION_STATE.ONLINE) {
      showRecovered();
    }
    lastState = state;
    return;
  }

  const offline = state === CONNECTION_STATE.OFFLINE;

  node.className = 'conn-bar show ' + (offline ? 'offline' : 'degraded');
  node.innerHTML = `
    <span class="cb-ico">${icon(offline ? 'alert' : 'refresh', 16)}</span>
    <span class="cb-text">
      <b>${offline ? 'Internet connection nahi hai' : 'Server se connect nahi ho pa rahe'}</b>
      <span>${offline
        ? 'Connect hote hi apne aap sync ho jayega.'
        : 'Abhi demo data dikha rahe hain. Background me dobara koshish jaari hai.'}</span>
    </span>
    <button class="cb-retry" type="button">Retry</button>`;

  node.querySelector('.cb-retry').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const res = await pingBackend();
    if (res.ok) {
      const { toast } = await import('./toast.js');
      toast.success('Connection wapas aa gaya. Page refresh kar rahe hain…');
      setTimeout(() => location.reload(), 900);
    } else {
      btn.disabled = false;
      btn.textContent = 'Retry';
      const { toast } = await import('./toast.js');
      toast.error(res.message);
    }
  });

  lastState = state;
}

async function showRecovered() {
  const { toast } = await import('./toast.js');
  toast.success('Connection wapas aa gaya.', { duration: 2600 });
}

/**
 * Indicator shuru karta hai. app.js boot par isse call karta hai.
 */
export function initConnectionWatch() {
  // Shuruaat me current state check karo.
  paint(getConnection());

  window.addEventListener('pshop:connection', e => {
    paint(e.detail.state, e.detail);
  });
}

/**
 * Header ke liye chhota badge — kaunsa data source chal raha hai.
 * @returns {string} HTML
 */
export function connectionBadge() {
  const state = getConnection();
  const map = {
    [CONNECTION_STATE.ONLINE]:  ['badge-success', 'Live', 'Google Sheet se juda hai'],
    [CONNECTION_STATE.DEMO]:    ['badge-muted', 'Demo', 'Backend set nahi hai — demo data'],
    [CONNECTION_STATE.DOWN]:    ['badge-warning', 'Offline', 'Backend down — demo data'],
    [CONNECTION_STATE.OFFLINE]: ['badge-danger', 'No net', 'Internet connection nahi hai']
  };
  const [cls, label, title] = map[state] || map[CONNECTION_STATE.DEMO];
  return `<span class="badge ${cls}" title="${title}">${label}</span>`;
}
