/* ==========================================================================
   PShop — toast notifications (stacked, auto-dismiss, a11y live region)
   ========================================================================== */
import { CONFIG } from '../core/config.js';
import { el, esc } from '../core/utils.js';
import { icon } from './icons.js';

let stack;
function getStack() {
  if (stack && document.body.contains(stack)) return stack;
  stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = el('div', { class: 'toast-stack', role: 'region', 'aria-live': 'polite', 'aria-label': 'Notifications' });
    document.body.append(stack);
  }
  return stack;
}

const ICONS = { success: 'check', error: 'close', warning: 'alert', info: 'info' };

/**
 * Show a toast.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {{title?:string,duration?:number,action?:{label:string,onClick:Function}}} opts
 */
export function toast(message, type = 'success', opts = {}) {
  const { title, duration = CONFIG.TOAST_DURATION, action } = opts;
  const box = getStack();
  const node = el('div', {
    class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status',
    style: { '--toast-dur': duration + 'ms' }
  });
  node.innerHTML = `
    <span class="t-ico">${icon(ICONS[type] || 'info', 15)}</span>
    <div class="t-body">
      ${title ? `<div class="t-title">${esc(title)}</div>` : ''}
      <div class="${title ? 't-msg' : 't-title'}">${esc(message)}</div>
    </div>
    <button class="t-close" aria-label="Dismiss notification">${icon('close', 15)}</button>`;

  if (action) {
    const btn = el('button', { class: 'btn btn-sm btn-outline', text: action.label,
      style: { marginTop: '.5rem' } });
    btn.addEventListener('click', () => { action.onClick(); dismiss(); });
    node.querySelector('.t-body').append(btn);
  }

  const dismiss = () => {
    if (node.dataset.closing) return;
    node.dataset.closing = '1';
    node.classList.add('out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };

  node.querySelector('.t-close').addEventListener('click', dismiss);
  box.append(node);

  // Cap the stack so bursts of events stay readable.
  while (box.children.length > 4) box.firstElementChild.remove();

  const timer = setTimeout(dismiss, duration);
  node.addEventListener('mouseenter', () => clearTimeout(timer));
  node.addEventListener('mouseleave', () => setTimeout(dismiss, 1200));
  return dismiss;
}

toast.success = (m, o) => toast(m, 'success', o);
toast.error   = (m, o) => toast(m, 'error', o);
toast.warn    = (m, o) => toast(m, 'warning', o);
toast.info    = (m, o) => toast(m, 'info', o);

/** Promise-based confirm dialog rendered as a modal. */
export function confirmDialog({
  title = 'Are you sure?', message = '', confirmText = 'Confirm',
  cancelText = 'Cancel', danger = false, input = null
} = {}) {
  return new Promise(resolve => {
    const wrap = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    wrap.innerHTML = `
      <div class="overlay open"></div>
      <div class="modal-box" style="max-width:440px;position:relative;z-index:1">
        <div class="modal-head"><h3>${esc(title)}</h3>
          <button class="btn-icon btn-ghost js-x" aria-label="Close">${icon('close', 18)}</button></div>
        <div class="modal-body">
          ${message ? `<p class="muted small">${esc(message)}</p>` : ''}
          ${input ? `<div class="field mt-4">
            <label for="cd-input">${esc(input.label || '')}</label>
            ${input.type === 'select'
              ? `<select class="select" id="cd-input">${(input.options || []).map(o => `<option>${esc(o)}</option>`).join('')}</select>`
              : `<textarea class="textarea" id="cd-input" rows="3" placeholder="${esc(input.placeholder || '')}"></textarea>`}
          </div>` : ''}
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary js-cancel">${esc(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} js-ok">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.append(wrap);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => wrap.classList.add('open'));

    const close = value => {
      wrap.classList.remove('open');
      document.body.classList.remove('no-scroll');
      setTimeout(() => wrap.remove(), 260);
      resolve(value);
    };
    wrap.querySelector('.js-ok').addEventListener('click', () => {
      const field = wrap.querySelector('#cd-input');
      close(input ? (field?.value.trim() || true) : true);
    });
    wrap.querySelector('.js-cancel').addEventListener('click', () => close(false));
    wrap.querySelector('.js-x').addEventListener('click', () => close(false));
    wrap.querySelector('.overlay').addEventListener('click', () => close(false));
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); }
    });
    setTimeout(() => wrap.querySelector('#cd-input, .js-ok')?.focus(), 120);
  });
}

export default toast;
