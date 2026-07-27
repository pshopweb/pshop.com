/* ==========================================================================
   PShop Admin — Manage Users
   ========================================================================== */
import { adminPage, $, $$, esc, money, icon, toast, tableLoading, tableEmpty,
         Auth } from './_admin-core.js';
import { api } from '../core/api.js';
import { debounce, fmtDate } from '../core/utils.js';
import { confirmDialog } from '../components/toast.js';

let users = [], term = '', roleFilter = 'all';

adminPage('users.html', async () => {
  $('#ico-search').innerHTML = icon('search', 18);
  tableLoading($('#u-rows'), 8);
  await load();

  $('#u-search').addEventListener('input', debounce(e => {
    term = e.target.value.trim(); render();
  }, 220));
  $('#u-role').addEventListener('change', e => { roleFilter = e.target.value; render(); });
});

async function load() {
  const res = await api('adminUsers', {});
  users = res.success ? res.data.items : [];
  render();
}

function render() {
  let list = users;
  if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
  if (term) {
    const t = term.toLowerCase();
    list = list.filter(u =>
      String(u.name).toLowerCase().includes(t) ||
      String(u.email).toLowerCase().includes(t) ||
      String(u.phone).includes(t));
  }

  $('#u-count').textContent = `${list.length} user${list.length === 1 ? '' : 's'}`;
  const tbody = $('#u-rows');

  if (!list.length) return tableEmpty(tbody, 8, 'No users match these filters.');

  const me = Auth.user()?.id;

  tbody.innerHTML = list.map(u => {
    const blocked = u.status === 'blocked';
    return `
    <tr>
      <td><div class="cell-main">
        <span class="thumb" style="display:grid;place-items:center;background:var(--brand-50);
          color:var(--brand-700);font-weight:800">${esc(String(u.name || '?')[0].toUpperCase())}</span>
        <div style="min-width:0"><div class="nm">${esc(u.name)}
          ${u.id === me ? '<span class="badge badge-info" style="font-size:9px">You</span>' : ''}</div>
          <div class="xs muted">${esc(u.id)}</div></div>
      </div></td>
      <td><div class="small">${esc(u.email)}</div>
        <div class="xs muted">${esc(u.phone || '—')}</div></td>
      <td class="semi">${u.orderCount || 0}</td>
      <td class="semi">${money(u.totalSpent || 0)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-brand' : 'badge-muted'}">${esc(u.role)}</span></td>
      <td><span class="badge ${blocked ? 'badge-danger' : 'badge-success'}">
        ${blocked ? 'Blocked' : 'Active'}</span></td>
      <td class="muted xs">${fmtDate(u.createdAt)}</td>
      <td><div class="actions">
        ${u.id === me ? '<span class="xs muted">—</span>' : `
          <button data-toggle="${esc(u.id)}" data-blocked="${blocked}"
            title="${blocked ? 'Unblock' : 'Block'}" aria-label="${blocked ? 'Unblock' : 'Block'}">
            ${icon(blocked ? 'checkCircle' : 'lock', 16)}</button>
          <button data-role="${esc(u.id)}" data-current="${esc(u.role)}"
            title="Change role" aria-label="Change role">${icon('shield', 16)}</button>
          ${u.role !== 'admin' ? `<button class="danger" data-del="${esc(u.id)}"
            title="Delete" aria-label="Delete">${icon('trash', 16)}</button>` : ''}`}
      </div></td>
    </tr>`;
  }).join('');

  wireRows();
}

function wireRows() {
  $$('[data-toggle]').forEach(b => b.onclick = async () => {
    const blocked = b.dataset.blocked === 'true';
    const res = await api('adminUpdateUser',
      { userId: b.dataset.toggle, status: blocked ? 'active' : 'blocked' });
    if (!res.success) return toast.error(res.message);
    toast.success(blocked ? 'User unblocked.' : 'User blocked.');
    await load();
  });

  $$('[data-role]').forEach(b => b.onclick = async () => {
    const next = b.dataset.current === 'admin' ? 'customer' : 'admin';
    const ok = await confirmDialog({
      title: `Make this user ${next}?`,
      message: next === 'admin'
        ? 'Admins can manage products, orders, users and settings.'
        : 'This user will lose access to the admin panel.',
      confirmText: `Make ${next}`, danger: next === 'customer'
    });
    if (!ok) return;
    const res = await api('adminUpdateUser', { userId: b.dataset.role, role: next });
    if (!res.success) return toast.error(res.message);
    toast.success(`Role changed to ${next}.`);
    await load();
  });

  $$('[data-del]').forEach(b => b.onclick = async () => {
    const u = users.find(x => x.id === b.dataset.del);
    const ok = await confirmDialog({
      title: 'Delete this user?',
      message: `${u?.name}'s account will be removed permanently. Their orders remain in the system.`,
      confirmText: 'Delete user', danger: true
    });
    if (!ok) return;
    const res = await api('adminDeleteUser', { userId: b.dataset.del });
    if (!res.success) return toast.error(res.message);
    toast.success('User deleted.');
    await load();
  });
}
