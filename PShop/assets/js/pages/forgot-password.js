/* ==========================================================================
   PShop — Forgot password: 3-step OTP reset flow
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, V, esc } from '../core/utils.js';
import { API } from '../core/api.js';
import { toast } from '../components/toast.js';
import { paintIcons, wirePasswordToggle, wirePasswordStrength, validate, RULES, setError,
         buildOtpInputs, otpTimer } from './_auth-ui.js';

let identifier = '', otp = null, timer = null;

page(async () => {
  await initApp({ page: 'forgot-password', nav: '', newsletter: false });
  paintIcons();
  wirePasswordToggle('toggle-pw', 'new-pw');
  wirePasswordStrength('new-pw');

  /* ---------------------------- step 1 ---------------------------------- */
  $('#request-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate([RULES.identifier])) return;
    const btn = e.target.querySelector('button');
    btn.classList.add('is-loading');
    const id = $('#identifier').value.trim();
    const res = await API.sendOtp({ identifier: id, purpose: 'reset' });
    btn.classList.remove('is-loading');

    if (!res.success) { toast.error(res.message); setError('identifier', true, res.message); return; }

    identifier = id;
    goStep(2);
    $('#otp-target').innerHTML = `Code sent to <b>${esc(res.data.masked)}</b>` +
      (res.data.demoCode ? `<br><span class="xs muted">Demo code: <b>${esc(res.data.demoCode)}</b></span>` : '');
    toast.success(res.message);

    otp = buildOtpInputs('otp-group', () => $('#verify-form').requestSubmit());
    otp.focus();
    startTimer();
  });

  /* ---------------------------- step 2 ---------------------------------- */
  $('#verify-form').addEventListener('submit', async e => {
    e.preventDefault();
    const code = otp?.value() || '';
    if (code.length !== CONFIG.OTP_LENGTH) return toast.warn('Please enter the complete 6-digit code.');
    const btn = e.target.querySelector('button[type="submit"]');
    btn.classList.add('is-loading');
    const res = await API.verifyOtp({ code });
    btn.classList.remove('is-loading');
    if (!res.success) { toast.error(res.message); otp.clear(); return; }
    timer?.stop();
    toast.success('Identity verified.');
    goStep(3);
    $('#new-pw').focus();
  });

  $('#resend').addEventListener('click', async () => {
    const res = await API.sendOtp({ identifier, purpose: 'reset' });
    if (!res.success) return toast.error(res.message);
    otp.clear();
    $('#otp-target').innerHTML = `Code sent to <b>${esc(res.data.masked)}</b>` +
      (res.data.demoCode ? `<br><span class="xs muted">Demo code: <b>${esc(res.data.demoCode)}</b></span>` : '');
    startTimer();
    toast.info('A new code has been sent.');
  });

  /* ---------------------------- step 3 ---------------------------------- */
  $('#reset-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ok = validate([
      { id: 'new-pw', test: V.pw, message: 'Password must be at least 6 characters.' },
      { id: 'confirm-pw', test: v => v === $('#new-pw').value && v.length >= 6,
        message: 'Passwords do not match.' }
    ]);
    if (!ok) return;

    const btn = e.target.querySelector('button');
    btn.classList.add('is-loading');
    const res = await API.resetPassword({ identifier, password: $('#new-pw').value });
    btn.classList.remove('is-loading');

    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    setTimeout(() => location.href = url('pages/login.html'), 900);
  });

  ['new-pw', 'confirm-pw', 'identifier'].forEach(id =>
    $('#' + id)?.addEventListener('input', () => setError(id, false)));
});

function startTimer() {
  timer?.stop();
  timer = otpTimer('otp-timer', CONFIG.OTP_TTL_SECONDS, () => {
    toast.warn('That code has expired. Please resend.');
    $('#otp-timer').textContent = 'expired';
  });
}

function goStep(n) {
  [1, 2, 3].forEach(i => {
    $('#step-' + i).hidden = i !== n;
    $('#s' + i).classList.toggle('done', i <= n);
  });
  $('#step-label').textContent = `Step ${n} of 3 — ` +
    ['Verify your identity', 'Enter the code we sent', 'Choose a new password'][n - 1];
}
