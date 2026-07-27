/* ==========================================================================
   PShop — About page
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { $, $$ } from '../core/utils.js';
import { icon } from '../components/icons.js';

const STATS = [
  ['2.4 Cr+', 'Happy customers'],
  ['19,000+', 'Pincodes served'],
  ['5 Lakh+', 'Products listed'],
  ['4.6 / 5', 'Average rating']
];

const VALUES = [
  ['shield', 'Genuine, always',
   'Every seller is brand-authorised and every product passes a quality check before dispatch. No counterfeits, ever.'],
  ['tag', 'Honest pricing',
   'The price you see is the price you pay. No hidden charges appearing at checkout, no fake "discounts" on inflated MRPs.'],
  ['truck', 'Delivered on time',
   'We give realistic delivery estimates and meet them 96% of the time. If we are late, we tell you why.'],
  ['rotate', 'Easy returns',
   'A clear 7–30 day return window, free pickup, and refunds that actually arrive when we say they will.'],
  ['headphones', 'Real human support',
   'Round-the-clock support in English and Hindi. No endless bots — you reach a person who can actually help.'],
  ['users', 'Sellers we back',
   'We pay our sellers on time and invest in small Indian brands who make genuinely good products.']
];

const JOURNEY = [
  ['2021', 'PShop is born', 'Three founders, one apartment in Bengaluru, and a very bad experience buying a phone charger.'],
  ['2022', 'First 1 lakh orders', 'We crossed 100,000 delivered orders and expanded into fashion and home categories.'],
  ['2023', 'Nationwide delivery', 'Our logistics network reached 19,000+ pincodes, including tier-3 towns and rural districts.'],
  ['2024', 'PShop Express launched', 'Next-day delivery went live in 42 cities with our own fulfilment centres.'],
  ['2025', '2 crore customers', 'We became one of India\u2019s fastest-growing marketplaces, still with zero counterfeit complaints upheld.'],
  ['2026', 'Building what is next', 'Investing in same-day delivery, regional languages and a marketplace for small Indian brands.']
];

page(async () => {
  await initApp({ page: 'about', nav: '' });

  $('#about-stats').innerHTML = STATS.map(([n, l]) =>
    `<div class="about-stat reveal"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');

  $('#value-grid').innerHTML = VALUES.map(([ic, h, p]) => `
    <article class="value-card reveal">
      <span class="ico">${icon(ic, 24)}</span>
      <h3>${h}</h3><p>${p}</p>
    </article>`).join('');

  $('#about-timeline').innerHTML = JOURNEY.map(([yr, h, p]) => `
    <div class="ta-item reveal">
      <div class="yr">${yr}</div><h4>${h}</h4><p>${p}</p>
    </div>`).join('');

  // Stagger the reveal animation.
  requestAnimationFrame(() => $$('.reveal').forEach((n, i) =>
    setTimeout(() => n.classList.add('visible'), Math.min(i * 60, 700))));
});
