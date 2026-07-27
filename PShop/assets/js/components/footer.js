/* ==========================================================================
   PShop — footer + newsletter + trust strip + mobile bottom navigation
   ========================================================================== */
import { CONFIG, url } from '../core/config.js';
import { $, el, esc } from '../core/utils.js';
import { API } from '../core/api.js';
import { icon } from './icons.js';
import { toast } from './toast.js';

const P = p => url('pages/' + p);

const COLS = [
  { title: 'Shop', links: [
    ['All Products', P('shop.html')], ['Categories', P('category.html')],
    ['Flash Sale', P('shop.html?tag=flash')], ['Best Sellers', P('shop.html?tag=bestseller')],
    ['New Arrivals', P('shop.html?sort=newest')], ['Compare', P('compare.html')]
  ]},
  { title: 'Account', links: [
    ['My Profile', P('profile.html')], ['My Orders', P('orders.html')],
    ['Wishlist', P('wishlist.html')], ['Cart', P('cart.html')],
    ['Addresses', P('address.html')], ['Settings', P('settings.html')]
  ]},
  { title: 'Help', links: [
    ['Track Order', P('track-order.html')], ['FAQ', P('faq.html')],
    ['Contact Us', P('contact.html')], ['Messages', P('messages.html')],
    ['Returns & Refunds', P('faq.html#returns')], ['Shipping Info', P('faq.html#delivery')]
  ]},
  { title: 'Company', links: [
    ['About PShop', P('about.html')], ['Privacy Policy', P('privacy.html')],
    ['Terms of Use', P('terms.html')], ['Careers', P('about.html#careers')],
    ['Press', P('about.html#press')], ['Sitemap', P('shop.html')]
  ]}
];

const TRUST = [
  ['truck',  'Free Delivery', `On orders above ${CONFIG.CURRENCY}${CONFIG.FREE_SHIP_ABOVE}`],
  ['rotate', 'Easy Returns',  '7\u201330 day return window'],
  ['shield', 'Secure Payments', '100% protected checkout'],
  ['headphones', '24\u00D77 Support', `Call ${CONFIG.SUPPORT_PHONE}`]
];

export function renderFooter({ newsletter = true } = {}) {
  const mount = $('#site-footer');
  if (!mount) return;

  mount.innerHTML = `
  <footer class="site-footer">
    <div class="container">
      <div class="trust-strip">
        ${TRUST.map(([ic, h, p]) => `
          <div class="trust-item">
            <span class="ico">${icon(ic, 21)}</span>
            <div><h5>${h}</h5><p>${p}</p></div>
          </div>`).join('')}
      </div>

      ${newsletter ? `
      <section class="newsletter" aria-labelledby="nl-title">
        <div>
          <h3 id="nl-title">Never miss a deal</h3>
          <p>Join 2 lakh+ shoppers. Get price-drop alerts, early sale access and exclusive coupons.</p>
        </div>
        <form id="newsletter-form" novalidate>
          <label class="sr-only" for="nl-email">Email address</label>
          <input type="email" id="nl-email" name="email" placeholder="you@example.com" required
                 autocomplete="email" aria-describedby="nl-msg">
          <button class="btn btn-accent" type="submit">Subscribe</button>
        </form>
        <p id="nl-msg" class="sr-only" role="status"></p>
      </section>` : ''}

      <div class="footer-cols">
        <div class="footer-brand">
          <img src="${url('assets/img/icons/logo.svg')}" alt="PShop" width="220" height="56">
          <p>${CONFIG.TAGLINE}. Genuine products, honest prices and delivery to 19,000+ pincodes across India.</p>
          <div class="socials">
            <a href="#" aria-label="PShop on Facebook">${icon('facebook', 18)}</a>
            <a href="#" aria-label="PShop on Twitter">${icon('twitter', 18)}</a>
            <a href="#" aria-label="PShop on Instagram">${icon('instagram', 18)}</a>
            <a href="#" aria-label="PShop on YouTube">${icon('youtube', 18)}</a>
            <a href="#" aria-label="PShop on WhatsApp">${icon('whatsapp', 18)}</a>
          </div>
          <div class="pay-marks" aria-label="Accepted payment methods">
            <img src="${url('assets/img/icons/pay-upi.svg')}" alt="UPI accepted" width="120" height="48">
            <img src="${url('assets/img/icons/pay-razorpay.svg')}" alt="Razorpay accepted" width="120" height="48">
            <img src="${url('assets/img/icons/pay-visa.svg')}" alt="Visa accepted" width="120" height="48">
            <img src="${url('assets/img/icons/pay-cod.svg')}" alt="Cash on delivery available" width="120" height="48">
          </div>
        </div>
        ${COLS.map(c => `
          <nav class="footer-col" aria-label="${c.title}">
            <h5>${c.title}</h5>
            ${c.links.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}
          </nav>`).join('')}
      </div>

      <div class="footer-bottom">
        <span>&copy; ${new Date().getFullYear()} PShop Retail India Pvt. Ltd. All rights reserved.</span>
        <div class="links">
          <a href="${P('privacy.html')}">Privacy</a>
          <a href="${P('terms.html')}">Terms</a>
          <a href="${P('faq.html')}">FAQ</a>
          <a href="mailto:${CONFIG.SUPPORT_EMAIL}">${CONFIG.SUPPORT_EMAIL}</a>
        </div>
      </div>
    </div>
  </footer>`;

  const form = $('#newsletter-form');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button');
    const input = $('#nl-email');
    btn.classList.add('is-loading');
    const res = await API.subscribeNewsletter({ email: input.value.trim() });
    btn.classList.remove('is-loading');
    $('#nl-msg').textContent = res.message;
    res.success ? toast.success(res.message) : toast.error(res.message);
    if (res.success) input.value = '';
  });
}

/* -------------------------- Mobile bottom nav ----------------------------- */
const BOTTOM = [
  { label: 'Home',     href: url('index.html'),  icon: 'home',  match: ['index'] },
  { label: 'Shop',     href: P('shop.html'),     icon: 'grid',  match: ['shop', 'category', 'search', 'product-details'] },
  { label: 'Wishlist', href: P('wishlist.html'), icon: 'heart', match: ['wishlist'], badge: 'wish' },
  { label: 'Cart',     href: P('cart.html'),     icon: 'cart',  match: ['cart', 'checkout', 'payment'], badge: 'cart' },
  { label: 'Account',  href: P('profile.html'),  icon: 'user',  match: ['profile', 'orders', 'settings', 'login', 'address'] }
];

export function renderBottomNav(activeKey = '') {
  const mount = $('#bottom-nav');
  if (!mount) return;
  const page = activeKey || (location.pathname.split('/').pop() || 'index').replace('.html', '');

  mount.innerHTML = `
    <nav class="bottom-nav" aria-label="Primary mobile navigation">
      ${BOTTOM.map(b => `
        <a class="bn-item ${b.match.includes(page) ? 'active' : ''}" href="${b.href}"
           ${b.match.includes(page) ? 'aria-current="page"' : ''}>
          <span class="ico-wrap">${icon(b.icon, 22)}
            ${b.badge ? `<span class="count-bubble" data-${b.badge}-count aria-hidden="true"></span>` : ''}</span>
          <span>${b.label}</span>
        </a>`).join('')}
    </nav>`;

  // Scroll-to-top helper is part of the same layer.
  if (!$('.to-top')) {
    const btn = el('button', { class: 'to-top', 'aria-label': 'Scroll to top', html: icon('arrowUp', 20) });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.append(btn);
    window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 700), { passive: true });
  }
}
