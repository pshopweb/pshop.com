/* ==========================================================================
   PShop — OTP login / verification page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, V, qs, esc } from '../core/utils.js';
import { API } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { toast } from '../components/toast.js';
import { paintIcons, validate, RULES, setError, buildOtpInputs, otpTimer } from './_auth-ui.js';

let otp = null, timer = null, identifier = '';

page(async () => {
  await initApp({ page: 'otp-verification', nav: '', newsletter: false });
  paintIcons();

  // Pre-fill when arriving from the login page.
  const preset = qs('id', '');
  if (preset) $('#identifier').value = preset;

  $('#send-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate([RULES.identifier])) return;
    await sendOtp($('#identifier').value.trim(), e.target.querySelector('button'));
  });

  $('#identifier').addEventListener('input', () => setError('identifier', false));
});

async function sendOtp(id, btn) {
  btn?.classList.add('is-loading');
  const res = await API.sendOtp({ identifier: id, purpose: 'login' });
  btn?.classList.remove('is-loading');

  if (!res.success) { toast.error(res.message); setError('identifier', true, res.message); return; }

  identifier = id;
  $('#send-step').hidden = true;
  $('#verify-step').hidden = false;

  $('#otp-target').innerHTML =
    `Code sent to <b>${esc(res.data.masked)}</b>` +
    // The demo backend surfaces the code so the flow is testable end-to-end.
    (res.data.demoCode ? `<br><span class="xs muted">Demo code: <b>${esc(res.data.demoCode)}</b></span>` : '');

  toast.success(res.message);

  otp = buildOtpInputs('otp-group', () => $('#otp-form').requestSubmit());
  otp.focus();
  startTimer();

  $('#otp-form').onsubmit = onVerify;
  $('#resend').onclick = async () => {
    otp.clear();
    await sendOtp(identifier, null);
    toast.info('A new code is on its way.');
  };
  $('#change-id').onclick = () => {
    timer?.stop();
    $('#verify-step').hidden = true;
    $('#send-step').hidden = false;
    $('#identifier').focus();
  };
}

function startTimer() {
  timer?.stop();
  timer = otpTimer('otp-timer', CONFIG.OTP_TTL_SECONDS, () => {
    toast.warn('That code has expired. Please request a new one.');
    $('#otp-timer').textContent = 'expired';
  });
}

async function onVerify(e) {
  e.preventDefault();
  const code = otp.value();
  if (code.length !== CONFIG.OTP_LENGTH) {
    setError('otp-group', true);
    $('#err-otp').closest('form').querySelector('#err-otp').style.display = 'block';
    return toast.warn('Please enter the complete 6-digit code.');
  }
  const btn = e.target.querySelector('button[type="submit"]');
  btn.classList.add('is-loading');

  const res = await Auth.verifyOtp(code);

  btn.classList.remove('is-loading');
  if (!res.success) { toast.error(res.message); otp.clear(); return; }

  timer?.stop();
  toast.success('Verified! Signing you in…');
  setTimeout(() => location.href = Auth.isLoggedIn() ? Auth.nextUrl() : url('pages/login.html'), 750);
}
