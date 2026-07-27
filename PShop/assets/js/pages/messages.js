/* ==========================================================================
   PShop — Messages / support chat
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, $$, esc, timeAgo, fmtDateTime } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { API } from '../core/api.js';
import { renderAccountNav } from './_account-nav.js';
import { icon } from '../components/icons.js';
import { toast, confirmDialog } from '../components/toast.js';
import { emptyState } from '../components/lazy-load.js';

let threads = [], activeId = null;

page(async () => {
  await initApp({ page: 'messages', nav: '', newsletter: false });
  renderAccountNav('messages.html');

  $('#send-btn').innerHTML = icon('send', 18);

  await load();

  $('#new-thread').onclick = async () => {
    const subject = await confirmDialog({
      title: 'Start a conversation',
      message: 'Tell us what you need help with and our team will reply shortly.',
      confirmText: 'Create ticket',
      input: { label: 'What is this about?', placeholder: 'e.g. My order has not arrived yet' }
    });
    if (!subject || subject === true) return;
    const res = await API.sendMessage({
      text: subject, subject: subject.slice(0, 60),
      name: Auth.user()?.name || 'Guest', email: Auth.user()?.email || ''
    });
    if (!res.success) return toast.error(res.message);
    toast.success('Ticket created. Our team will respond soon.');
    activeId = res.data.thread.id;
    await load();
  };

  $('#chat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    if (!activeId) return toast.warn('Start a conversation first.');
    input.value = '';
    const res = await API.sendMessage({ threadId: activeId, text });
    if (!res.success) return toast.error(res.message);
    await load(false);
  });
});

async function load(scrollTop = true) {
  const res = await API.getMessages();
  if (!res.success) return;
  threads = res.data.items;

  if (!threads.length) {
    $('#thread-list').innerHTML = '';
    emptyState($('#chat-pane'), {
      title: 'No conversations yet',
      text: 'Start a conversation and our support team will get back to you within a few hours.'
    });
    return;
  }

  activeId = activeId && threads.some(t => t.id === activeId) ? activeId : threads[0].id;

  $('#thread-list').innerHTML = threads.map(t => {
    const last = t.thread[t.thread.length - 1];
    return `
    <div class="thread-row ${t.id === activeId ? 'active' : ''}" data-thread="${t.id}"
         role="button" tabindex="0">
      <span class="av">${esc((t.from || 'P')[0].toUpperCase())}</span>
      <div style="flex:1;min-width:0">
        <div class="sub truncate">${esc(t.subject)}</div>
        <div class="prev truncate">${esc(last?.text || '')}</div>
        <div class="xs muted">${timeAgo(t.at)}</div>
      </div>
      ${t.unread ? '<span class="dot"></span>' : ''}
    </div>`;
  }).join('');

  $$('[data-thread]').forEach(row => {
    const open = () => { activeId = row.dataset.thread; load(); };
    row.onclick = open;
    row.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });

  renderChat(scrollTop);
}

function renderChat(scrollBottom = true) {
  const t = threads.find(x => x.id === activeId);
  if (!t) return;
  t.unread = false;

  $('#chat-head').innerHTML = `
    <span class="av" style="width:38px;height:38px;border-radius:50%;background:var(--brand-100);
      color:var(--brand-700);display:grid;place-items:center;font-weight:800">
      ${esc((t.from || 'P')[0].toUpperCase())}</span>
    <div style="flex:1;min-width:0">
      <div class="semi truncate">${esc(t.subject)}</div>
      <div class="xs muted">${icon('clock', 11)} Usually replies within a few hours</div>
    </div>
    <span class="badge ${t.status === 'open' ? 'badge-success' : 'badge-muted'}">${esc(t.status || 'open')}</span>`;

  $('#chat-body').innerHTML = t.thread.map(m => `
    <div class="bubble ${m.by === 'user' ? 'user' : 'support'}">
      ${esc(m.text)}
      <time datetime="${m.at}">${fmtDateTime(m.at)}</time>
    </div>`).join('');

  if (scrollBottom) {
    const body = $('#chat-body');
    body.scrollTop = body.scrollHeight;
  }
}
