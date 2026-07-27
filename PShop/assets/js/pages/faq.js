/* ==========================================================================
   PShop — FAQ page: accordion, search, category filter, JSON-LD schema
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { $, $$, esc, debounce, groupBy } from '../core/utils.js';
import { API } from '../core/api.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/lazy-load.js';

let faqs = [], activeCat = 'all', term = '';

const CAT_ICONS = {
  Orders: 'package', Payments: 'wallet', Delivery: 'truck',
  Returns: 'rotate', Account: 'user', Products: 'box'
};

page(async () => {
  await initApp({ page: 'faq', nav: '' });
  $('#ico-search').innerHTML = icon('search', 19);

  const res = await API.getFaqs();
  faqs = res.success ? res.data.items : [];

  injectSchema();
  renderCats();
  render();

  $('#faq-q').addEventListener('input', debounce(e => {
    term = e.target.value.trim().toLowerCase();
    render();
  }, 200));

  // #delivery / #returns jaise hash se seedha us section par jao
  if (location.hash) {
    const cat = location.hash.slice(1);
    const match = Object.keys(CAT_ICONS).find(c => c.toLowerCase() === cat.toLowerCase());
    if (match) {
      activeCat = match;
      renderCats(); render();
      setTimeout(() => $(`#group-${match.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth' }), 200);
    }
  }
});

function renderCats() {
  const cats = ['all', ...Object.keys(groupBy(faqs, 'category'))];
  $('#faq-cats').innerHTML = cats.map(c => `
    <button class="chip ${activeCat === c ? 'active' : ''}" data-cat="${esc(c)}">
      ${c === 'all' ? 'All questions' : esc(c)}</button>`).join('');

  $$('[data-cat]').forEach(b => b.onclick = () => {
    activeCat = b.dataset.cat;
    $('#faq-q').value = ''; term = '';
    renderCats(); render();
  });
}

function render() {
  let list = faqs;
  if (activeCat !== 'all') list = list.filter(f => f.category === activeCat);
  if (term) {
    list = list.filter(f =>
      f.question.toLowerCase().includes(term) || f.answer.toLowerCase().includes(term));
  }

  const host = $('#faq-list'), empty = $('#faq-empty');

  if (!list.length) {
    host.innerHTML = '';
    empty.hidden = false;
    emptyState(empty, {
      title: 'No matching questions',
      text: `We could not find anything for "${term || activeCat}". Try different words or contact our team.`,
      actionLabel: 'Contact support', actionHref: 'contact.html'
    });
    return;
  }

  empty.hidden = true;
  const groups = groupBy(list, 'category');

  host.innerHTML = Object.entries(groups).map(([cat, items]) => `
    <section class="faq-group" id="group-${cat.toLowerCase().replace(/\s+/g, '-')}">
      <h2>${icon(CAT_ICONS[cat] || 'helpCircle', 20)} ${esc(cat)}
        <span class="badge badge-muted">${items.length}</span></h2>
      ${items.map((f, i) => {
        const id = `faq-${cat}-${i}`.replace(/\s+/g, '-').toLowerCase();
        return `
        <div class="faq-item">
          <button class="faq-q" aria-expanded="false" aria-controls="${id}">
            <span>${highlight(f.question)}</span>
            <span class="chev">${icon('chevronDown', 18)}</span>
          </button>
          <div class="faq-a" id="${id}" role="region">
            <div>${highlight(f.answer)}</div>
          </div>
        </div>`;
      }).join('')}
    </section>`).join('');

  wireAccordion();
}

/** Search term ko answer me highlight karta hai. */
function highlight(text) {
  const safe = esc(text);
  if (!term) return safe;
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return safe.replace(re, '<mark style="background:var(--warning-bg);color:inherit;padding:0 2px;border-radius:3px">$1</mark>');
}

function wireAccordion() {
  $$('.faq-q').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    // Ek waqt me ek hi khula rahe (accordion behaviour)
    $$('.faq-item.open').forEach(other => {
      other.classList.remove('open');
      other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
    });

    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  }));

  // Search karte waqt pehla result apne aap khul jaye
  if (term) {
    const first = $('.faq-item');
    if (first) {
      first.classList.add('open');
      first.querySelector('.faq-q').setAttribute('aria-expanded', 'true');
    }
  }
}

/** Google rich results ke liye FAQPage schema. */
function injectSchema() {
  const node = document.getElementById('faq-schema');
  if (!node) return;
  node.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer }
    }))
  });
}
