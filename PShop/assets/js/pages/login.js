/* ==========================================================================
   PShop — Login page (password + OTP modes)
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, V, qs } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { paintIcons, wirePasswordToggle, validate, RULES, setError } from './_auth-ui.js';

page(async () => {
  await initApp({ page: 'login', nav: '', newsletter: false });

  // Already signed in? Seedha aage bhej do.
  // Exception: ?admin=1 ke saath aaya hai par current user admin nahi hai —
  // aise me form dikhana hai taaki wo admin account se sign in kar sake.
  const wantsAdmin = qs('admin') === '1';
  if (Auth.isLoggedIn() && !(wantsAdmin && !Auth.isAdmin())) {
    location.replace(Auth.nextUrl());
    return;
  }
  if (wantsAdmin && Auth.isLoggedIn()) {
    Auth.logout({ keepCart: true });   // purana customer session hata do
  }

  paintIcons();
  wirePasswordToggle('toggle-pw', 'password');
  renderHero();

  const form = $('#login-form');

  /* -------- password / OTP mode switch -------- */
  $('#tab-otp').addEventListener('click', () => {
    const id = $('#identifier').value.trim();
    location.href = url('pages/otp-verification.html') + (id ? `?id=${encodeURIComponent(id)}` : '');
  });
  $('#tab-pw').addEventListener('click', () => {
    $('#tab-pw').classList.add('active'); $('#tab-pw').setAttribute('aria-selected', 'true');
  });

  /* -------- guest browsing -------- */
  $('#btn-guest').addEventListener('click', () => {
    toast.info('Browsing as a guest. You can sign in any time at checkout.');
    setTimeout(() => location.href = url('index.html'), 800);
  });

  /* -------- submit -------- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate([RULES.identifier, RULES.password])) return;

    const btn = $('#btn-submit');
    btn.classList.add('is-loading');
    btn.disabled = true;

    const res = await Auth.login($('#identifier').value.trim(), $('#password').value);

    btn.classList.remove('is-loading');
    btn.disabled = false;

    if (!res.success) {
      toast.error(res.message);
      // Point the error at the most likely field.
      if (/password/i.test(res.message)) setError('password', true, res.message);
      else setError('identifier', true, res.message);
      return;
    }

    toast.success(res.message);
    const next = res.data.user.role === 'admin' && qs('admin')
      ? url('admin/dashboard.html')
      : Auth.nextUrl();
    setTimeout(() => location.href = next, 650);
  });

  // Clear errors as the user types.
  ['identifier', 'password'].forEach(id =>
    $('#' + id).addEventListener('input', () => setError(id, false)));
});

function renderHero() {
  const list = $('#hero-list');
  if (!list) return;
  list.innerHTML = [
    ['package', 'Track every order in real time'],
    ['heart', 'Sync your wishlist across devices'],
    ['zap', 'One-tap checkout with saved addresses'],
    ['tag', 'Member-only coupons and early sale access']
  ].map(([ic, t]) => `<li><span class="ico">${icon(ic, 18)}</span><span>${t}</span></li>`).join('');
}
