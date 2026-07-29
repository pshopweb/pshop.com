/* ==========================================================================
   PShop — Signup page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, V } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { paintIcons, wirePasswordToggle, wirePasswordStrength, validate, RULES, setError } from './_auth-ui.js';

page(async () => {
  await initApp({ page: 'signup', nav: '', newsletter: false });

  if (Auth.isLoggedIn()) { location.replace(url('pages/profile.html')); return; }

  paintIcons();
  wirePasswordToggle('toggle-pw', 'password');
  wirePasswordStrength('password');
  renderHero();

  // Digits only for the phone field.
  $('#phone').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  $('#signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ok = validate([
      RULES.name, RULES.email, RULES.phone, RULES.password,
      { id: 'confirm', test: v => v === $('#password').value && v.length >= 6,
        message: 'Passwords do not match.' },
      { id: 'terms', test: v => v === true, message: 'Please accept the terms to continue.' }
    ]);
    if (!ok) return;

    const btn = $('#btn-submit');
    btn.classList.add('is-loading'); btn.disabled = true;

    const res = await Auth.signup({
      name: $('#name').value.trim(),
      email: $('#email').value.trim().toLowerCase(),
      phone: $('#phone').value.trim(),
      password: $('#password').value
    });

    btn.classList.remove('is-loading'); btn.disabled = false;

    if (!res.success) {
      toast.error(res.message);
      if (/email/i.test(res.message)) setError('email', true, res.message);
      else if (/mobile|number/i.test(res.message)) setError('phone', true, res.message);
      return;
    }

    toast.success('Welcome to PShop! Your account is ready.');
    setTimeout(() => location.href = url('pages/profile.html'), 800);
  });

  ['name', 'email', 'phone', 'password', 'confirm'].forEach(id =>
    $('#' + id).addEventListener('input', () => setError(id, false)));
  $('#terms').addEventListener('change', () => setError('terms', false));
});

function renderHero() {
  const list = $('#hero-list');
  if (!list) return;
  list.innerHTML = [
    ['gift', '15% off your first order with NEWUSER'],
    ['truck', 'Free delivery on orders above \u20B9499'],
    ['rotate', 'Hassle-free returns up to 30 days'],
    ['shield', '100% genuine, brand-authorised products']
  ].map(([ic, t]) => `<li><span class="ico">${icon(ic, 18)}</span><span>${t}</span></li>`).join('');
}
