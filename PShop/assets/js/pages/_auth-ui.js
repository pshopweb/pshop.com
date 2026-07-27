/* ==========================================================================
   PShop — shared helpers for the auth pages
   Field validation, password toggles, strength meter, OTP boxes & timers.
   ========================================================================== */
import { CONFIG } from '../core/config.js';
import { $, $$, el, V, pwStrength, pad } from '../core/utils.js';
import { icon } from '../components/icons.js';

/** Show or clear an inline field error. */
export function setError(inputId, show, message) {
  const input = $('#' + inputId);
  const field = input?.closest('.field');
  if (!field) return;
  field.classList.toggle('error', show);
  input.setAttribute('aria-invalid', String(show));
  if (message) {
    const msg = field.querySelector('.err-msg');
    if (msg) msg.textContent = message;
  }
}

/** Validate a set of {id, test, message} rules; returns true when all pass. */
export function validate(rules) {
  let ok = true;
  rules.forEach(({ id, test, message }) => {
    const val = $('#' + id)?.type === 'checkbox' ? $('#' + id).checked : ($('#' + id)?.value ?? '');
    const pass = test(val);
    setError(id, !pass, message);
    if (!pass && ok) { $('#' + id)?.focus(); ok = false; }
    else if (!pass) ok = false;
  });
  return ok;
}

/** Wire a show/hide password button. */
export function wirePasswordToggle(btnId, inputId) {
  const btn = $('#' + btnId), input = $('#' + inputId);
  if (!btn || !input) return;
  const paint = () => {
    btn.innerHTML = icon(input.type === 'password' ? 'eye' : 'eyeOff', 18);
    btn.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
  };
  paint();
  btn.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    paint();
    input.focus();
  });
}

/** Live password strength meter. */
export function wirePasswordStrength(inputId, barId = 'pw-bar', labelId = 'pw-label') {
  const input = $('#' + inputId), bar = $('#' + barId), label = $('#' + labelId);
  if (!input || !bar) return;
  input.addEventListener('input', () => {
    const v = input.value;
    if (!v) { bar.style.width = '0'; label.textContent = ''; return; }
    const s = pwStrength(v);
    bar.style.width = s.pct + '%';
    bar.style.background = s.color;
    label.textContent = s.label;
    label.style.color = s.color;
  });
}

/** Fill the standard input-group icons if the page declares them. */
export function paintIcons(map = {}) {
  const defaults = {
    'ico-user': 'user', 'ico-lock': 'lock', 'ico-lock2': 'lock',
    'ico-mail': 'mail', 'ico-phone': 'phone'
  };
  Object.entries({ ...defaults, ...map }).forEach(([id, name]) => {
    const node = $('#' + id);
    if (node) node.innerHTML = icon(name, 19);
  });
}

/**
 * Build the OTP input boxes with paste, arrow-key and auto-advance support.
 * @returns {{value:()=>string, clear:()=>void, focus:()=>void}}
 */
export function buildOtpInputs(containerId, onComplete) {
  const host = $('#' + containerId);
  if (!host) return { value: () => '', clear() {}, focus() {} };
  const n = CONFIG.OTP_LENGTH;

  host.innerHTML = '';
  const boxes = Array.from({ length: n }, (_, i) => {
    const input = el('input', {
      type: 'text', inputmode: 'numeric', maxlength: '1', autocomplete: i === 0 ? 'one-time-code' : 'off',
      'aria-label': `Digit ${i + 1} of ${n}`, pattern: '[0-9]*'
    });
    host.append(input);
    return input;
  });

  const value = () => boxes.map(b => b.value).join('');
  const sync = () => {
    boxes.forEach(b => b.classList.toggle('filled', Boolean(b.value)));
    if (value().length === n) onComplete?.(value());
  };

  boxes.forEach((box, i) => {
    box.addEventListener('input', e => {
      const digits = e.target.value.replace(/\D/g, '');
      e.target.value = digits.slice(-1);
      if (e.target.value && i < n - 1) boxes[i + 1].focus();
      sync();
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ''; sync(); }
      if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
      if (e.key === 'ArrowRight' && i < n - 1) boxes[i + 1].focus();
    });
    box.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, n);
      text.split('').forEach((ch, k) => { if (boxes[k]) boxes[k].value = ch; });
      boxes[Math.min(text.length, n - 1)].focus();
      sync();
    });
  });

  return {
    value,
    clear() { boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); }); boxes[0].focus(); },
    focus() { boxes[0].focus(); }
  };
}

/**
 * Countdown timer for OTP expiry.
 * @returns {{stop:Function, restart:Function}}
 */
export function otpTimer(displayId, seconds = CONFIG.OTP_TTL_SECONDS, onExpire) {
  const node = $('#' + displayId);
  let left = seconds, handle = null;
  const paint = () => { if (node) node.textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`; };
  const tick = () => {
    left--; paint();
    if (left <= 0) { clearInterval(handle); onExpire?.(); }
  };
  const start = () => { clearInterval(handle); left = seconds; paint(); handle = setInterval(tick, 1000); };
  start();
  return { stop: () => clearInterval(handle), restart: start };
}

/** Standard validators reused across the auth forms. */
export const RULES = {
  identifier: { id: 'identifier', test: v => V.email(v) || V.phone(v),
                message: 'Enter a valid email or 10-digit mobile number.' },
  name:     { id: 'name', test: V.name, message: 'Please enter your name (letters only, min 2 characters).' },
  email:    { id: 'email', test: V.email, message: 'Please enter a valid email address.' },
  phone:    { id: 'phone', test: V.phone, message: 'Enter a valid 10-digit Indian mobile number.' },
  password: { id: 'password', test: V.pw, message: 'Password must be at least 6 characters.' }
};
