/* ==========================================================================
   PShop — lazy image loading + scroll reveal + skeleton helpers
   ========================================================================== */
import { $$, el } from '../core/utils.js';
import { url } from '../core/config.js';

let imgObserver;

/** Observe every [data-src] image inside root and load it when near viewport. */
export function lazyImages(root = document) {
  const imgs = $$('img[data-src]', root);
  if (!imgs.length) return;

  if (!('IntersectionObserver' in window)) {
    imgs.forEach(load);
    return;
  }
  imgObserver ||= new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      load(e.target);
      obs.unobserve(e.target);
    });
  }, { rootMargin: '220px 0px', threshold: .01 });

  imgs.forEach(img => imgObserver.observe(img));
}

function load(img) {
  const src = img.dataset.src;
  if (!src) return;
  const done = () => { img.classList.add('loaded'); img.removeAttribute('data-src'); };
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', () => {
    img.src = url('assets/img/misc/placeholder.svg');
    done();
  }, { once: true });
  img.src = src;
}

/** Build N skeleton product cards. */
export function skeletonCards(n = 8, container) {
  const html = Array.from({ length: n }, () => `
    <div class="sk-card" aria-hidden="true">
      <div class="skeleton sk-img"></div>
      <div class="sk-pad">
        <div class="skeleton sk-text w-40"></div>
        <div class="skeleton sk-title"></div>
        <div class="skeleton sk-text w-60"></div>
        <div class="skeleton sk-text w-80" style="margin-top:1rem"></div>
      </div>
    </div>`).join('');
  if (container) container.innerHTML = html;
  return html;
}

/** Generic skeleton rows (orders, messages, tables). */
export function skeletonRows(n = 5, container) {
  const html = Array.from({ length: n }, () => `
    <div class="sk-row" aria-hidden="true">
      <div class="skeleton sk-circle"></div>
      <div style="flex:1">
        <div class="skeleton sk-text w-40"></div>
        <div class="skeleton sk-text w-80"></div>
      </div>
    </div>`).join('');
  if (container) container.innerHTML = html;
  return html;
}

/** Render an empty state block. */
export function emptyState(container, { icon: img = 'empty', title, text, actionLabel, actionHref, onAction }) {
  const node = el('div', { class: 'empty-state' });
  node.innerHTML = `
    <img src="${url(`assets/img/misc/${img}.svg`)}" alt="" loading="lazy">
    <h3>${title}</h3>
    ${text ? `<p>${text}</p>` : ''}`;
  if (actionLabel) {
    const btn = el(actionHref ? 'a' : 'button', {
      class: 'btn btn-primary mt-2', text: actionLabel,
      ...(actionHref ? { href: actionHref } : {})
    });
    if (onAction) btn.addEventListener('click', onAction);
    node.append(btn);
  }
  if (container) { container.innerHTML = ''; container.append(node); }
  return node;
}
