/* ==========================================================================
   PShop Admin — Image uploader
   Drag & drop, client-side resize, preview grid, drag-to-reorder.

   Upload se pehle image ko browser me hi chhota kar dete hain:
   • Drive ka quota bachta hai
   • Apps Script ka payload limit (~50 MB) kabhi nahi tootta
   • Website tez load hoti hai
   ========================================================================== */
import { $, $$, esc, icon, toast } from './_admin-core.js';
import { api } from '../core/api.js';

const MAX_IMAGES = 8;

/**
 * Upload dimension — 1600px zoom ke liye kaafi hai aur file chhoti rehti hai.
 *
 * Note: Drive me chahe kitni bhi jagah ho, BADI image = SLOW website.
 * Mobile user ko 4000px ki image bhejna bekaar hai — dikhegi 400px me.
 * Isliye 1600px par cap rakhte hain; listing ke liye Google khud
 * chhoti copy bana deta hai (neeche thumbUrl dekhe).
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.9;     // 5 TB hai to quality high rakh sakte hain

/**
 * Image ko canvas par redraw karke chhota karta hai.
 * @returns {Promise<{base64:string, filename:string, width:number, height:number}>}
 */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File padhi nahi ja saki'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ye valid image nahi hai'));
      img.onload = () => {
        let { width, height } = img;

        // Aspect ratio bigade bina bada side MAX_DIMENSION tak laao.
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // PNG transparency ko white background do, warna JPEG me kaala aata hai.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        resolve({ base64, filename: name, width, height });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploader banata hai.
 * @param {object} cfg
 * @param {string} cfg.zone      upload zone ka selector
 * @param {string} cfg.input     file input ka selector
 * @param {string} cfg.preview   preview grid ka selector
 * @param {string} cfg.folder    Drive subfolder — 'Products' / 'Avatars'
 * @param {Function} cfg.onChange(urls) — list badalne par chalta hai
 */
export function createUploader(cfg) {
  const zone = $(cfg.zone);
  const input = $(cfg.input);
  const preview = $(cfg.preview);
  if (!zone || !input || !preview) return null;

  /** @type {{url:string, uploading:boolean, failed:boolean, local:string}[]} */
  let images = [];

  $('#uz-icon')?.insertAdjacentHTML('beforeend', icon('image', 30));

  /* ------------------------------ render -------------------------------- */
  function render() {
    preview.innerHTML = images.map((im, i) => `
      <div class="cell ${im.failed ? 'failed' : ''}" data-idx="${i}"
           draggable="${!im.uploading}" title="${im.uploading ? 'Uploading…' : 'Drag to reorder'}">
        <img src="${esc(im.local || im.url)}" alt="Product image ${i + 1}" loading="lazy">
        ${im.uploading ? '<span class="up-spinner"></span>' : ''}
        ${i === 0 && !im.uploading && !im.failed ? '<span class="thumb-tag">THUMB</span>' : ''}
        ${!im.uploading ? `<button type="button" data-remove="${i}"
          aria-label="Remove image ${i + 1}">${icon('close', 13)}</button>` : ''}
      </div>`).join('');

    wirePreview();
    cfg.onChange?.(getUrls());
  }

  const getUrls = () =>
    images.filter(im => im.url && !im.failed && !im.uploading).map(im => im.url);

  function wirePreview() {
    // Remove
    $$('[data-remove]', preview).forEach(b => b.onclick = e => {
      e.stopPropagation();
      images.splice(+b.dataset.remove, 1);
      render();
    });

    // Drag to reorder — pehli image thumbnail banti hai
    let dragFrom = null;
    $$('.cell', preview).forEach(cell => {
      cell.addEventListener('dragstart', e => {
        dragFrom = +cell.dataset.idx;
        cell.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      cell.addEventListener('dragend', () => cell.classList.remove('dragging'));
      cell.addEventListener('dragover', e => { e.preventDefault(); });
      cell.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        const to = +cell.dataset.idx;
        if (dragFrom === null || dragFrom === to) return;
        const [moved] = images.splice(dragFrom, 1);
        images.splice(to, 0, moved);
        dragFrom = null;
        render();
        toast.info('Image order badal gaya. Pehli image thumbnail hai.');
      });
    });
  }

  /* ------------------------------ upload -------------------------------- */
  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) return toast.warn('Sirf image files upload kar sakte hain.');

    const room = MAX_IMAGES - images.length;
    if (room <= 0) return toast.warn(`Zyada se zyada ${MAX_IMAGES} images.`);
    const batch = files.slice(0, room);
    if (files.length > room) {
      toast.warn(`Sirf ${room} aur image add ho sakti hain.`);
    }

    zone.classList.add('busy');
    $('#uz-progress').hidden = false;
    const bar = $('#uz-bar-fill'), status = $('#uz-status');

    // Placeholders dikhao taaki user ko turant feedback mile.
    const startIndex = images.length;
    for (const f of batch) {
      images.push({ url: '', uploading: true, failed: false,
                    local: URL.createObjectURL(f) });
    }
    render();

    let done = 0;
    for (let i = 0; i < batch.length; i++) {
      const slot = startIndex + i;
      status.textContent = `Uploading ${i + 1} of ${batch.length}…`;

      try {
        const resized = await resizeImage(batch[i]);
        const res = await api('uploadImage', {
          base64: resized.base64,
          filename: resized.filename,
          folder: cfg.folder || 'Products'
        });

        if (res.success) {
          images[slot].url = res.data.url;
          images[slot].uploading = false;
        } else {
          images[slot].uploading = false;
          images[slot].failed = true;
          toast.error(`${batch[i].name}: ${res.message}`);
        }
      } catch (err) {
        images[slot].uploading = false;
        images[slot].failed = true;
        toast.error(`${batch[i].name}: ${err.message}`);
      }

      done++;
      bar.style.width = (done / batch.length * 100) + '%';
      render();
    }

    // Fail hui images 2 second baad hata do.
    setTimeout(() => {
      const before = images.length;
      images = images.filter(im => !im.failed);
      if (images.length !== before) render();
    }, 2000);

    zone.classList.remove('busy');
    $('#uz-progress').hidden = true;
    bar.style.width = '0';

    const ok = images.filter(im => im.url && !im.failed).length;
    if (ok > 0) toast.success(`${ok} image(s) ready.`);
  }

  /* ------------------------------ events -------------------------------- */
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', e => {
    handleFiles(e.target.files);
    e.target.value = '';   // same file dobara chun sakein
  });

  ['dragenter', 'dragover'].forEach(ev =>
    zone.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.add('dragover');
    }));
  ['dragleave', 'drop'].forEach(ev =>
    zone.addEventListener(ev, e => {
      e.preventDefault();
      if (ev === 'dragleave' && zone.contains(e.relatedTarget)) return;
      zone.classList.remove('dragover');
    }));
  zone.addEventListener('drop', e => {
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });

  /* ------------------------------- API ---------------------------------- */
  return {
    /** Existing URLs se preview bharo (edit mode). */
    setUrls(urls) {
      images = (urls || []).filter(Boolean)
        .map(u => ({ url: u, uploading: false, failed: false, local: '' }));
      render();
    },
    getUrls,
    clear() { images = []; render(); },
    get count() { return images.length; }
  };
}
