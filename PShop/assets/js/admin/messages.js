/* ==========================================================================
   PShop Admin — Support ticket inbox
   ========================================================================== */
import { adminPage, $, $$, esc, icon, toast } from './_admin-core.js';
import { api, API } from '../core/api.js';
import { timeAgo, fmtDateTime } from '../core/utils.js';
import { emptyState } from '../components/lazy-load.js';

let threads = [], activeId = null, filter = 'all';

adminPage('messages.html', async () => {
  $('#m-send').innerHTML = icon('send', 18);
  await load();

  $$('[data-mstatus]').forEach(b => b.onclick = () => {
    $$('[data-mstatus]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    filter = b.dataset.mstatus;
    activeId = null;
    render();
  });

  $('#m-form').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#m-input');
    const text = input.value.trim();
    if (!text) return;
    if (!activeId) return toast.warn('Select a conversation first.');

    input.value = '';
    const res = await api('adminReplyMessage', { threadId: activeId, text });
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Reply sent.');
    await load(false);
  });
});

async function load(resetActive = true) {
  let res = await api('adminMessages', {});
  if (!res.success) res = await API.getMessages();
  threads = res.success ? (res.data.items || []) : [];
  if (resetActive) activeId = null;
  render();
}

function render() {
  let list = threads;
  if (filter !== 'all') list = list.filter(t => (t.status || 'open') === filter);

  $('#m-count').textContent = `${list.length} ticket${list.length === 1 ? '' : 's'}`;

  const listHost = $('#m-threads');
  if (!list.length) {
    listHost.innerHTML = '<p class="muted small" style="padding:1.2rem">No tickets here.</p>';
    emptyState($('#m-chat'), {
      title: 'No conversation selected',
      text: 'Customer support tickets will appear on the left.'
    });
    return;
  }

  activeId = activeId && list.some(t => t.id === activeId) ? activeId : list[0].id;

  listHost.innerHTML = list.map(t => {
    const last = (t.thread || [])[t.thread.length - 1];
    return `
    <div class="thread-row ${t.id === activeId ? 'active' : ''}" data-t="${esc(t.id)}"
         role="button" tabindex="0">
      <span class="av">${esc(String(t.from || 'C')[0].toUpperCase())}</span>
      <div style="flex:1;min-width:0">
        <div class="sub truncate">${esc(t.subject)}</div>
        <div class="prev truncate">${esc(last?.text || '')}</div>
        <div class="xs muted">${esc(t.from || '')} · ${timeAgo(t.at)}</div>
      </div>
      ${t.unread ? '<span class="dot"></span>' : ''}
    </div>`;
  }).join('');

  $$('[data-t]').forEach(row => {
    const open = () => { activeId = row.dataset.t; render(); };
    row.onclick = open;
    row.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });

  renderChat();
}

function renderChat() {
  const t = threads.find(x => x.id === activeId);
  if (!t) return;

  // Chat pane emptyState se replace ho sakta hai — dobara bana lo.
  const pane = $('#m-chat');
  if (!$('#m-head')) {
    pane.className = 'chat-pane';
    pane.innerHTML = `
      <div class="chat-head" id="m-head"></div>
      <div class="chat-body" id="m-body" aria-live="polite"></div>
      <form class="chat-foot" id="m-form">
        <label class="sr-only" for="m-input">Reply</label>
        <input class="input" id="m-input" placeholder="Type your reply…" autocomplete="off">
        <button class="btn btn-primary btn-icon" type="submit" id="m-send"
          aria-label="Send reply">${icon('send', 18)}</button>
      </form>`;
  }

  $('#m-head').innerHTML = `
    <span class="av" style="width:38px;height:38px;border-radius:50%;background:var(--brand-100);
      color:var(--brand-700);display:grid;place-items:center;font-weight:800">
      ${esc(String(t.from || 'C')[0].toUpperCase())}</span>
    <div style="flex:1;min-width:0">
      <div class="semi truncate">${esc(t.subject)}</div>
      <div class="xs muted">${esc(t.from || '')}${t.email ? ' · ' + esc(t.email) : ''}</div>
    </div>
    <button class="btn btn-sm btn-ghost" id="m-close-ticket">
      ${t.status === 'closed' ? 'Reopen' : 'Close ticket'}</button>`;

  $('#m-body').innerHTML = (t.thread || []).map(m => `
    <div class="bubble ${m.by === 'support' ? 'user' : 'support'}">
      ${esc(m.text)}
      <time datetime="${m.at}">${m.by === 'support' ? 'You' : esc(t.from || 'Customer')}
        · ${fmtDateTime(m.at)}</time>
    </div>`).join('');

  const body = $('#m-body');
  body.scrollTop = body.scrollHeight;

  $('#m-close-ticket').onclick = async () => {
    const res = await api('adminReplyMessage', {
      threadId: t.id,
      text: t.status === 'closed'
        ? 'This ticket has been reopened. How else can we help?'
        : 'Marking this ticket as resolved. Reply any time to reopen it.',
      close: t.status !== 'closed'
    });
    if (!res.success) return toast.error(res.message);
    toast.success(t.status === 'closed' ? 'Ticket reopened.' : 'Ticket closed.');
    await load(false);
  };

  // Reply form dobara bana ho to listener wapas lagao.
  $('#m-form').onsubmit = async e => {
    e.preventDefault();
    const input = $('#m-input');
    const text = input.value.trim();
    if (!text || !activeId) return;
    input.value = '';
    const res = await api('adminReplyMessage', { threadId: activeId, text });
    if (!res.success) return toast.error(res.message);
    toast.success('Reply sent.');
    await load(false);
  };
}
