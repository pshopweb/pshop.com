/* ==========================================================================
   PShop — Legal pages (privacy + terms): TOC scroll-spy and last-updated
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { $, $$, throttle } from '../core/utils.js';
import { icon } from '../components/icons.js';

page(async () => {
  const pageName = location.pathname.includes('privacy') ? 'privacy' : 'terms';
  await initApp({ page: pageName, nav: '' });

  $('#updated').innerHTML = `${icon('calendar', 13)} Last updated: 1 July 2026`;

  wireScrollSpy();

  // TOC link par smooth scroll (header ki height adjust karke)
  $$('.toc a').forEach(a => a.addEventListener('click', e => {
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 140;
    window.scrollTo({ top, behavior: 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
  }));
});

/** Scroll ke hisab se TOC me active section highlight karta hai. */
function wireScrollSpy() {
  const links = $$('.toc a');
  const sections = links
    .map(a => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);
  if (!sections.length) return;

  const spy = throttle(() => {
    const y = window.scrollY + 180;
    let current = sections[0];
    sections.forEach(s => { if (s.offsetTop <= y) current = s; });
    links.forEach(a =>
      a.classList.toggle('active', a.getAttribute('href') === '#' + current.id));
  }, 120);

  window.addEventListener('scroll', spy, { passive: true });
  spy();
}
