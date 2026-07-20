// ==UserScript==
// @name         StyleMirror — Virtual Try-On Injector
// @namespace    https://stylemirror.local
// @version      0.1.0
// @description  Inject a virtual try-on bar into partner product pages. Demo mode auto-detects product images; production mode reads data-stylemirror="true" tags.
// @author       BSc Thesis — Uttara University
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────
  const API_BASE = (window.SM_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
  const DEMO_MODE = localStorage.getItem('sm_demo_mode') !== 'false';
  const ONBOARDING_KEY = 'sm_onboarded_v1';
  const ESTIMATED_SEC = 15;

  // ─── Helpers ─────────────────────────────────────────────
  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function')
        el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v !== null && v !== undefined) el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  };

  const css = (strings, ...values) => strings.reduce((a, s, i) => a + s + (values[i] || ''), '');

  // ─── Product image detection ─────────────────────────────
  function findProductImages() {
    if (DEMO_MODE) {
      return [...document.querySelectorAll('img')]
        .filter(img => {
          const w = img.naturalWidth || img.width;
          const hgt = img.naturalHeight || img.height;
          return w >= 200 && hgt >= 200 && img.src.startsWith('http');
        })
        .slice(0, 12)
        .map(img => ({ url: img.src, alt: img.alt || 'Product', el: img }));
    }
    return [...document.querySelectorAll('[data-stylemirror="true"] img, img[data-stylemirror="true"]')]
      .map(img => ({ url: img.src, alt: img.alt || 'Product', el: img }));
  }

  // ─── Shadow DOM mount ────────────────────────────────────
  const host = h('div', { id: 'stylemirror-host' });
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const STYLES = css`
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .sm-root { position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; }

    /* Floating bar */
    .sm-fab {
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(40,36,54,0.92));
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 999px;
      padding: 10px 18px 10px 12px;
      color: #f0eef5;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s;
      position: relative; overflow: hidden;
    }
    .sm-fab::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(110deg, transparent 30%, rgba(180,160,255,0.12) 50%, transparent 70%);
      transform: translateX(-100%); transition: transform .6s;
    }
    .sm-fab:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 12px 40px rgba(0,0,0,0.45); }
    .sm-fab:hover::before { transform: translateX(100%); }
    .sm-fab-icon {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #a78bfa, #6366f1);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
    }
    .sm-fab-label { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; }

    /* Onboarding tooltip */
    .sm-tip {
      position: absolute; bottom: calc(100% + 12px); right: 0;
      background: rgba(15,12,22,0.97); color: #e8e4f0;
      border: 1px solid rgba(167,139,250,0.3);
      border-radius: 12px; padding: 12px 16px; width: 260px;
      font-size: 13px; line-height: 1.5;
      box-shadow: 0 12px 36px rgba(0,0,0,0.4);
      animation: sm-tip-in .4s cubic-bezier(.34,1.56,.64,1);
    }
    .sm-tip::after {
      content: ''; position: absolute; bottom: -6px; right: 28px;
      width: 12px; height: 12px; background: rgba(15,12,22,0.97);
      border-right: 1px solid rgba(167,139,250,0.3);
      border-bottom: 1px solid rgba(167,139,250,0.3);
      transform: rotate(45deg);
    }
    .sm-tip-title { font-weight: 700; margin-bottom: 4px; font-size: 14px; }
    .sm-tip-close {
      position: absolute; top: 8px; right: 10px;
      background: none; border: none; color: #999; cursor: pointer; font-size: 16px;
    }
    @keyframes sm-tip-in { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

    /* Overlay */
    .sm-overlay {
      position: fixed; inset: 0; z-index: 2147483646;
      background: rgba(8,6,14,0.72);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
      animation: sm-fade .25s ease;
    }
    @keyframes sm-fade { from { opacity: 0; } to { opacity: 1; } }

    .sm-sheet {
      background: linear-gradient(145deg, #14121b, #1c1828);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px; width: 100%; max-width: 880px;
      max-height: 90vh; overflow-y: auto;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
      color: #e8e4f0; position: relative;
      animation: sm-sheet-in .35s cubic-bezier(.34,1.4,.64,1);
    }
    @keyframes sm-sheet-in { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .sm-sheet-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
      position: sticky; top: 0; background: rgba(20,18,28,0.9); backdrop-filter: blur(12px); z-index: 2;
      border-radius: 20px 20px 0 0;
    }
    .sm-sheet-title { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .sm-close {
      width: 32px; height: 32px; border-radius: 8px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
      color: #ccc; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center;
      transition: background .2s;
    }
    .sm-close:hover { background: rgba(255,255,255,0.12); }

    .sm-sheet-body { padding: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 680px) {
      .sm-overlay { align-items: flex-end; padding: 0; }
      .sm-sheet { border-radius: 20px 20px 0 0; max-height: 92vh; }
      .sm-sheet-body { grid-template-columns: 1fr; }
    }

    .sm-section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: #8b8599; margin-bottom: 10px;
    }

    /* Garment grid */
    .sm-garments { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 200px; overflow-y: auto; }
    .sm-garment {
      aspect-ratio: 1; border-radius: 10px; overflow: hidden;
      border: 2px solid transparent; cursor: pointer; position: relative;
      transition: border-color .2s, transform .2s;
    }
    .sm-garment img { width: 100%; height: 100%; object-fit: cover; }
    .sm-garment:hover { transform: scale(1.03); }
    .sm-garment.selected { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.2); }

    /* Dropzone */
    .sm-drop {
      border: 2px dashed rgba(255,255,255,0.12); border-radius: 14px;
      padding: 28px 16px; text-align: center; cursor: pointer;
      transition: border-color .2s, background .2s; min-height: 180px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    }
    .sm-drop:hover, .sm-drop.drag { border-color: #a78bfa; background: rgba(167,139,250,0.06); }
    .sm-drop-icon { font-size: 28px; opacity: 0.6; }
    .sm-drop-text { font-size: 13px; color: #b0aabb; }
    .sm-drop-link { font-size: 12px; color: #a78bfa; cursor: pointer; text-decoration: underline; }

    .sm-preview {
      width: 100%; aspect-ratio: 3/4; border-radius: 14px; overflow: hidden;
      background: rgba(0,0,0,0.3); position: relative;
    }
    .sm-preview img { width: 100%; height: 100%; object-fit: cover; }
    .sm-preview-retry {
      position: absolute; bottom: 8px; right: 8px;
      background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.15);
      color: #fff; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;
    }

    /* Generate button */
    .sm-gen {
      width: 100%; padding: 14px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
      transition: transform .15s, opacity .2s; margin-top: 16px;
      letter-spacing: -0.01em;
    }
    .sm-gen:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.35); }
    .sm-gen:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Status */
    .sm-status { text-align: center; padding: 40px 20px; }
    .sm-status-msg { font-size: 14px; color: #b0aabb; margin-top: 12px; }
    .sm-status-eta { font-size: 12px; color: #6b6577; margin-top: 4px; }
    .sm-skeleton {
      width: 100%; aspect-ratio: 3/4; border-radius: 14px;
      background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
      background-size: 200% 100%; animation: sm-shimmer 1.5s infinite;
    }
    @keyframes sm-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

    .sm-error {
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
      border-radius: 12px; padding: 14px; color: #fca5a5; font-size: 13px;
    }

    /* Before/After slider */
    .sm-ba { position: relative; width: 100%; aspect-ratio: 3/4; border-radius: 14px; overflow: hidden; user-select: none; cursor: ew-resize; }
    .sm-ba-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .sm-ba-after { clip-path: inset(0 0 0 50%); }
    .sm-ba-handle {
      position: absolute; top: 0; bottom: 0; left: 50%; width: 3px;
      background: #fff; transform: translateX(-50%); pointer-events: none;
      box-shadow: 0 0 12px rgba(0,0,0,0.4);
    }
    .sm-ba-knob {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: center;
      font-size: 14px; color: #333; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .sm-ba-label {
      position: absolute; top: 10px; padding: 4px 10px; border-radius: 6px;
      background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em; pointer-events: none;
    }
    .sm-ba-label-before { left: 10px; }
    .sm-ba-label-after { right: 10px; }

    /* Webcam */
    .sm-cam-video { width: 100%; border-radius: 12px; display: block; }
    .sm-cam-actions { display: flex; gap: 8px; margin-top: 10px; }
    .sm-cam-btn {
      flex: 1; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06); color: #e8e4f0; font-size: 13px; cursor: pointer;
    }
    .sm-cam-btn.primary { background: linear-gradient(135deg, #8b5cf6, #6366f1); border: none; font-weight: 600; }
    .sm-consent { font-size: 11px; color: #8b8599; margin-top: 8px; line-height: 1.4; }

    .sm-hidden { display: none !important; }
  `;

  // ─── State ───────────────────────────────────────────────
  const state = {
    products: [],
    selectedGarment: null,
    bodyDataURL: null,    // persists across try-ons in one session
    bodyURL: null,        // uploaded URL or data URI
    taskID: null,
    status: 'idle',       // idle | uploading | generating | done | error
    resultURL: null,
    error: null,
    progress: 0,
  };

  // ─── Build UI ────────────────────────────────────────────
  const root = h('div', { class: 'sm-root' });
  const styleEl = h('style', {});
  styleEl.textContent = STYLES;
  shadow.appendChild(styleEl);
  shadow.appendChild(root);

  const fab = h('div', { class: 'sm-fab', role: 'button', tabindex: '0', 'aria-label': 'Open StyleMirror try-on' },
    h('div', { class: 'sm-fab-icon' }, '🪞'),
    h('div', { class: 'sm-fab-label' }, 'Try It On'),
  );
  root.appendChild(fab);

  // Onboarding
  if (!localStorage.getItem(ONBOARDING_KEY)) {
    const tip = h('div', { class: 'sm-tip' },
      h('button', { class: 'sm-tip-close', 'aria-label': 'Dismiss', onclick: () => { tip.remove(); localStorage.setItem(ONBOARDING_KEY, '1'); } }, '×'),
      h('div', { class: 'sm-tip-title' }, 'StyleMirror is ready'),
      h('div', {}, 'Click "Try It On" on any product image to virtually wear it. Your photo stays on your device.'),
    );
    root.appendChild(tip);
  }

  fab.addEventListener('click', openModal);
  fab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); } });

  // ─── Modal ───────────────────────────────────────────────
  let overlay, sheet, liveRegion;

  function openModal() {
    state.products = findProductImages();
    if (state.products.length === 0) {
      state.products = [{ url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', alt: 'Demo shirt', el: null }];
    }

    overlay = h('div', { class: 'sm-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'StyleMirror Try-On' });
    sheet = h('div', { class: 'sm-sheet' });

    liveRegion = h('div', { role: 'status', 'aria-live': 'polite', class: 'sm-hidden' });
    sheet.appendChild(liveRegion);

    renderModalBody();
    overlay.appendChild(sheet);
    shadow.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', trapKeys);
  }

  function closeModal() {
    if (overlay) overlay.remove();
    overlay = null; sheet = null; liveRegion = null;
    document.removeEventListener('keydown', trapKeys);
  }

  function trapKeys(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    const focusable = sheet.querySelectorAll('button, [tabindex="0"], input');
    if (focusable.length === 0) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function announce(msg) {
    if (liveRegion) { liveRegion.textContent = ''; setTimeout(() => { liveRegion.textContent = msg; }, 50); }
  }

  function renderModalBody() {
    sheet.innerHTML = '';
    sheet.appendChild(liveRegion);

    const header = h('div', { class: 'sm-sheet-header' },
      h('div', { class: 'sm-sheet-title' }, '🪞 Virtual Try-On'),
      h('button', { class: 'sm-close', 'aria-label': 'Close', onclick: closeModal }, '×'),
    );
    sheet.appendChild(header);

    const body = h('div', { class: 'sm-sheet-body' });

    // ── Left: Garment + body ──
    const left = h('div', {},
      h('div', { class: 'sm-section-label' }, '1 · Choose a garment'),
      h('div', { class: 'sm-garments' },
        ...state.products.map((p, i) =>
          h('div', {
            class: 'sm-garment' + (state.selectedGarment === i ? ' selected' : ''),
            onclick: () => { state.selectedGarment = i; renderModalBody(); },
          }, h('img', { src: p.url, alt: p.alt, loading: 'lazy' }))
        )
      ),
      h('div', { class: 'sm-section-label', style: 'margin-top:20px;' }, '2 · Upload your photo'),
      state.bodyDataURL
        ? h('div', { class: 'sm-preview' },
            h('img', { src: state.bodyDataURL, alt: 'Your photo' }),
            h('button', { class: 'sm-preview-retry', onclick: () => { state.bodyDataURL = null; state.bodyURL = null; renderModalBody(); } }, 'Replace')
          )
        : renderDropzone(),
    );
    body.appendChild(left);

    // ── Right: Result ──
    const right = h('div', {}, h('div', { class: 'sm-section-label' }, '3 · Result'));
    if (state.status === 'idle') {
      right.appendChild(h('div', { class: 'sm-drop', style: 'min-height:300px;display:flex;align-items:center;justify-content:center;' },
        h('div', { style: 'text-align:center;color:#6b6577;' },
          h('div', { style: 'font-size:36px;margin-bottom:8px;' }, '✨'),
          h('div', { style: 'font-size:13px;' }, 'Your try-on result will appear here'),
        )
      ));
    } else if (state.status === 'uploading') {
      right.appendChild(h('div', { class: 'sm-status' },
        h('div', { class: 'sm-skeleton' }),
        h('div', { class: 'sm-status-msg' }, 'Uploading photo…'),
      ));
    } else if (state.status === 'generating') {
      right.appendChild(h('div', { class: 'sm-status' },
        h('div', { class: 'sm-skeleton' }),
        h('div', { class: 'sm-status-msg' }, 'Generating try-on…'),
        h('div', { class: 'sm-status-eta' }, `Usually takes ~${ESTIMATED_SEC}s`),
      ));
    } else if (state.status === 'done' && state.resultURL) {
      right.appendChild(renderBeforeAfter());
    } else if (state.status === 'error') {
      right.appendChild(h('div', { class: 'sm-error' },
        h('div', { style: 'font-weight:600;margin-bottom:4px;' }, 'Generation failed'),
        h('div', {}, state.error || 'Please try again.'),
        h('button', { class: 'sm-cam-btn', style: 'margin-top:10px;', onclick: () => { state.status = 'idle'; state.error = null; renderModalBody(); } }, 'Try again'),
      ));
    }
    body.appendChild(right);

    // ── Generate button ──
    const canGenerate = state.selectedGarment !== null && state.bodyURL && ['idle', 'done', 'error'].includes(state.status);
    body.appendChild(h('button', {
      class: 'sm-gen',
      disabled: !canGenerate,
      onclick: handleGenerate,
      style: 'grid-column:1/-1;',
    }, state.status === 'done' ? '↻ Try Another Garment' : 'Generate Try-On →'));

    sheet.appendChild(body);
  }

  function renderDropzone() {
    const dz = h('div', { class: 'sm-drop', tabindex: '0', role: 'button', 'aria-label': 'Upload photo' },
      h('div', { class: 'sm-drop-icon' }, '📷'),
      h('div', { class: 'sm-drop-text' }, 'Drag a photo here or click to browse'),
      h('div', { class: 'sm-drop-link', onclick: (e) => { e.stopPropagation(); startWebcam(); } }, 'or use your webcam'),
    );

    const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'sm-hidden' });
    fileInput.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) handleFile(f);
    });
    dz.appendChild(fileInput);
    dz.addEventListener('click', () => fileInput.click());
    dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith('image/')) handleFile(f);
    });
    return dz;
  }

  // ─── File handling + validation ──────────────────────────
  function handleFile(file) {
    if (file.size > 5 * 1024 * 1024) {
      state.error = 'Image must be under 5 MB.'; state.status = 'error'; renderModalBody(); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Heuristic validation
        if (img.width < 200 || img.height < 200) {
          state.error = 'Image is too small. Use at least 200×200 px.'; state.status = 'error'; renderModalBody(); return;
        }
        const ar = img.width / img.height;
        if (ar > 2.5 || ar < 0.4) {
          state.error = 'Aspect ratio looks off. Use a portrait or square photo with a clear subject.'; state.status = 'error'; renderModalBody(); return;
        }
        state.bodyDataURL = reader.result;
        state.bodyURL = reader.result; // data URI — DashScope accepts these
        state.status = 'idle';
        renderModalBody();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // ─── Webcam ──────────────────────────────────────────────
  function startWebcam() {
    const left = sheet.querySelector('.sm-sheet-body > div:first-child');
    const consent = confirm(
      'StyleMirror wants to access your camera.\n\n' +
      '• Your video stream is processed locally in your browser.\n' +
      '• The captured photo is sent to our servers for try-on generation.\n' +
      '• Nothing is stored beyond the generation session.\n\n' +
      'Continue?'
    );
    if (!consent) return;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } } })
      .then(stream => {
        const video = h('video', { class: 'sm-cam-video', autoplay: true, playsinline: true });
        video.srcObject = stream;
        const captureBtn = h('button', { class: 'sm-cam-btn primary' }, '📸 Capture');
        const cancelBtn = h('button', { class: 'sm-cam-btn' }, 'Cancel');
        const camWrap = h('div', {},
          video,
          h('div', { class: 'sm-cam-actions' }, captureBtn, cancelBtn),
          h('div', { class: 'sm-consent' }, 'Live preview is local. Click capture to take a still photo for try-on.'),
        );

        // Replace dropzone
        const dz = left.querySelector('.sm-drop');
        if (dz) dz.replaceWith(camWrap);

        captureBtn.onclick = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          stream.getTracks().forEach(t => t.stop());
          const dataURL = canvas.toDataURL('image/jpeg', 0.9);
          state.bodyDataURL = dataURL;
          state.bodyURL = dataURL;
          state.status = 'idle';
          renderModalBody();
        };
        cancelBtn.onclick = () => {
          stream.getTracks().forEach(t => t.stop());
          renderModalBody();
        };
      })
      .catch(() => {
        state.error = 'Could not access camera. Please upload a file instead.';
        state.status = 'error';
        renderModalBody();
      });
  }

  // ─── Generate flow ───────────────────────────────────────
  async function handleGenerate() {
    const garment = state.products[state.selectedGarment];
    if (!garment || !state.bodyURL) return;

    state.status = 'generating';
    state.error = null;
    state.resultURL = null;
    renderModalBody();
    announce('Generating your try-on. This usually takes about 15 seconds.');

    try {
      const resp = await fetch(`${API_BASE}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
        body: JSON.stringify({ garment_url: garment.url, body_url: state.bodyURL }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      state.taskID = data.task_id;
      await pollStatus();
    } catch (e) {
      state.status = 'error';
      state.error = e.message;
      renderModalBody();
      announce('Try-on failed: ' + e.message);
    }
  }

  async function pollStatus() {
    const start = Date.now();
    const poll = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/tryon/${state.taskID}`, {
          headers: { 'X-Client-Id': getClientId() },
        });
        const data = await resp.json();
        const elapsed = (Date.now() - start) / 1000;
        state.progress = Math.min(95, (elapsed / ESTIMATED_SEC) * 100);

        if (data.status === 'succeeded') {
          state.status = 'done';
          state.resultURL = data.result_url;
          renderModalBody();
          announce('Your try-on is ready.');
          return;
        }
        if (data.status === 'failed') {
          state.status = 'error';
          state.error = data.error || 'Generation failed on the server.';
          renderModalBody();
          announce('Try-on failed.');
          return;
        }
        setTimeout(poll, data.poll_after_ms || 1500);
      } catch {
        setTimeout(poll, 2000);
      }
    };
    await poll();
  }

  function getClientId() {
    let id = localStorage.getItem('sm_client_id');
    if (!id) {
      id = 'us_' + Math.random().toString(36).slice(2, 14);
      localStorage.setItem('sm_client_id', id);
    }
    return id;
  }

  // ─── Before/After slider ─────────────────────────────────
  function renderBeforeAfter() {
    const wrap = h('div', { class: 'sm-ba', role: 'slider', 'aria-label': 'Before and after comparison', tabindex: '0' });
    const before = h('img', { class: 'sm-ba-img sm-ba-before', src: state.bodyDataURL, alt: 'Before' });
    const after = h('img', { class: 'sm-ba-img sm-ba-after', src: state.resultURL, alt: 'After' });
    const handle = h('div', { class: 'sm-ba-handle' });
    const knob = h('div', { class: 'sm-ba-knob' }, '⇆');
    handle.appendChild(knob);
    const labelBefore = h('div', { class: 'sm-ba-label sm-ba-label-before' }, 'You');
    const labelAfter = h('div', { class: 'sm-ba-label sm-ba-label-after' }, 'Try-On');
    wrap.append(before, after, handle, labelBefore, labelAfter);

    let dragging = false;
    const update = (clientX) => {
      const rect = wrap.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      after.style.clipPath = `inset(0 0 0 ${pct}%)`;
      handle.style.left = pct + '%';
    };
    wrap.addEventListener('mousedown', e => { dragging = true; update(e.clientX); });
    window.addEventListener('mousemove', e => { if (dragging) update(e.clientX); });
    window.addEventListener('mouseup', () => { dragging = false; });
    wrap.addEventListener('touchstart', e => { update(e.touches[0].clientX); }, { passive: true });
    wrap.addEventListener('touchmove', e => { e.preventDefault(); update(e.touches[0].clientX); }, { passive: false });
    wrap.addEventListener('keydown', e => {
      const cur = parseFloat(handle.style.left) || 50;
      if (e.key === 'ArrowLeft') update(wrap.getBoundingClientRect().left + (cur - 5) / 100 * wrap.getBoundingClientRect().width);
      if (e.key === 'ArrowRight') update(wrap.getBoundingClientRect().left + (cur + 5) / 100 * wrap.getBoundingClientRect().width);
    });
    return wrap;
  }

  // Mark demo mode visually
  if (DEMO_MODE) {
    fab.querySelector('.sm-fab-label').textContent = '🧪 Try It On (Demo)';
  }

  console.log('[StyleMirror] Injector loaded. Demo mode:', DEMO_MODE, '| Products found:', findProductImages().length);
})();
