/* ==========================================================================
   PShop — Edit profile & change password
   ========================================================================== */
import { initApp, page } from '../core/app.js';
import { url } from '../core/config.js';
import { $, V } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { API } from '../core/api.js';
import { renderAccountNav } from './_account-nav.js';
import { validate, setError, wirePasswordStrength } from './_auth-ui.js';
import { toast } from '../components/toast.js';

page(async () => {
  await initApp({ page: 'edit-profile', nav: '', newsletter: false });
  if (!Auth.require()) return;

  renderAccountNav('profile.html');
  wirePasswordStrength('new-pw');

  const user = Auth.user();
  $('#name').value = user.name || '';
  $('#email').value = user.email || '';
  $('#phone').value = user.phone || '';
  $('#dob').value = user.dob || '';
  $('#gender').value = user.gender || '';
  if (user.avatar) $('#avatar-preview').src = user.avatar;

  $('#phone').addEventListener('input', e =>
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10));

  /* ------------------------- avatar upload -------------------------- */
  let avatarData = user.avatar || '';
  $('#avatar-input').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file.');
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be smaller than 2 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      // Downscale client-side so the stored data URL stays small.
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        avatarData = canvas.toDataURL('image/jpeg', 0.85);
        $('#avatar-preview').src = avatarData;
        toast.success('Photo ready — remember to save your changes.');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  $('#remove-avatar').addEventListener('click', () => {
    avatarData = '';
    $('#avatar-preview').src = url('assets/img/misc/avatar.svg');
    toast.info('Photo removed — save to apply.');
  });

  /* --------------------------- save profile -------------------------- */
  $('#edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ok = validate([
      { id: 'name', test: V.name, message: 'Please enter your name.' },
      { id: 'email', test: V.email, message: 'Please enter a valid email.' },
      { id: 'phone', test: V.phone, message: 'Enter a valid 10-digit mobile number.' }
    ]);
    if (!ok) return;

    const btn = $('#btn-save');
    btn.classList.add('is-loading');
    const patch = {
      name: $('#name').value.trim(), email: $('#email').value.trim().toLowerCase(),
      phone: $('#phone').value.trim(), dob: $('#dob').value,
      gender: $('#gender').value, avatar: avatarData
    };
    const res = await API.updateProfile({ userId: Auth.id(), patch });
    btn.classList.remove('is-loading');

    if (!res.success) return toast.error(res.message);
    Auth.patchUser(res.data.user || patch);
    toast.success('Profile updated successfully.');
    setTimeout(() => location.href = url('pages/profile.html'), 800);
  });

  /* -------------------------- change password ------------------------ */
  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ok = validate([
      { id: 'current-pw', test: V.required, message: 'Enter your current password.' },
      { id: 'new-pw', test: V.pw, message: 'Password must be at least 6 characters.' }
    ]);
    if (!ok) return;

    const btn = e.target.querySelector('button');
    btn.classList.add('is-loading');
    const res = await API.changePassword({
      userId: Auth.id(), current: $('#current-pw').value, next: $('#new-pw').value
    });
    btn.classList.remove('is-loading');

    if (!res.success) { toast.error(res.message); setError('current-pw', true, res.message); return; }
    toast.success(res.message);
    e.target.reset();
    $('#pw-bar').style.width = '0';
    $('#pw-label').textContent = '';
  });

  ['name', 'email', 'phone', 'current-pw', 'new-pw'].forEach(id =>
    $('#' + id)?.addEventListener('input', () => setError(id, false)));
});
