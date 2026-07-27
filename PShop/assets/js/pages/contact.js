/* ==========================================================================
   PShop — Contact page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { CONFIG, url } from '../core/config.js';
import { $, V, qs } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { API } from '../core/api.js';
import { validate, setError } from './_auth-ui.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';

page(async () => {
  await initApp({ page: 'contact', nav: 'support' });

  renderMethods();

  // Logged-in user ke details pehle se bhar do
  const u = Auth.user();
  if (u) {
    $('#c-name').value = u.name || '';
    $('#c-email').value = u.email || '';
    $('#c-phone').value = u.phone || '';
  }

  // ?order=PS123 se aane par order ID pre-fill ho
  const preOrder = qs('order');
  if (preOrder) {
    $('#c-order').value = preOrder;
    $('#c-topic').value = 'Order issue';
  }

  $('#c-phone').addEventListener('input', e =>
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10));

  const msg = $('#c-msg'), counter = $('#char-count');
  msg.addEventListener('input', () => {
    counter.textContent = `${msg.value.length} / 1000`;
    counter.style.color = msg.value.length > 900 ? 'var(--warning)' : '';
  });

  ['c-name', 'c-email', 'c-phone', 'c-topic', 'c-msg'].forEach(id =>
    $('#' + id).addEventListener('input', () => setError(id, false)));

  $('#contact-form').addEventListener('submit', async e => {
    e.preventDefault();

    const ok = validate([
      { id: 'c-name', test: V.name, message: 'Please enter your name.' },
      { id: 'c-email', test: V.email, message: 'Please enter a valid email address.' },
      { id: 'c-topic', test: V.required, message: 'Please choose a topic.' },
      { id: 'c-msg', test: v => String(v).trim().length >= 10,
        message: 'Please write at least 10 characters.' }
    ]);
    // Phone optional hai, par diya ho to valid hona chahiye
    const phone = $('#c-phone').value.trim();
    if (phone && !V.phone(phone)) {
      setError('c-phone', true, 'Enter a valid 10-digit mobile number.');
      return toast.error('Please check your mobile number.');
    }
    if (!ok) return toast.error('Please complete the required fields.');

    const btn = $('#c-submit');
    btn.classList.add('is-loading');
    btn.disabled = true;

    const orderRef = $('#c-order').value.trim();
    const body = `[${$('#c-topic').value}]${orderRef ? ` [Order: ${orderRef}]` : ''}\n\n${$('#c-msg').value.trim()}`;

    const res = await API.contact({
      name: $('#c-name').value.trim(),
      email: $('#c-email').value.trim(),
      phone: phone,
      subject: $('#c-topic').value + (orderRef ? ` — ${orderRef}` : ''),
      message: body
    });

    btn.classList.remove('is-loading');
    btn.disabled = false;

    if (!res.success) return toast.error(res.message);

    toast.success(res.message, {
      title: 'Message sent',
      action: { label: 'View my messages', onClick: () => location.href = url('pages/messages.html') }
    });

    $('#contact-form').reset();
    counter.textContent = '0 / 1000';
    if (u) { $('#c-name').value = u.name; $('#c-email').value = u.email; }
  });
});

function renderMethods() {
  const methods = [
    ['phone', 'Call us', 'Available 24×7, toll free',
     `tel:${CONFIG.SUPPORT_PHONE.replace(/\s/g, '')}`, CONFIG.SUPPORT_PHONE],
    ['mail', 'Email us', 'We reply within 24 hours',
     `mailto:${CONFIG.SUPPORT_EMAIL}`, CONFIG.SUPPORT_EMAIL],
    ['chat', 'Live chat', 'Fastest way to reach us',
     url('pages/messages.html'), 'Open messages'],
    ['whatsapp', 'WhatsApp', 'Order updates and quick help',
     'https://wa.me/911800209774', '+91 1800 209 7746'],
    ['mapPin', 'Visit us', 'Registered office, Bengaluru',
     'https://maps.google.com/?q=Bengaluru', 'Tech Park, ORR, Bengaluru 560103']
  ];

  $('#contact-methods').innerHTML = methods.map(([ic, h, sub, href, label]) => `
    <div class="contact-card">
      <span class="ico">${icon(ic, 21)}</span>
      <div style="min-width:0">
        <h4>${h}</h4>
        <p>${sub}</p>
        <a href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>
      </div>
    </div>`).join('');
}
