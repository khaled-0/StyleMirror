(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────
  const DEFAULTS = {
    apiBase: 'http://localhost:8080',
    imageSelector: null,       // e.g. 'img[data-nimg="1"]'
    excludeSelector: null,     // e.g. '.thumbnail-rail img'
  };
  const CONFIG = Object.assign({}, DEFAULTS,
    (typeof window.StyleMirrorConfig === 'object' && window.StyleMirrorConfig) || {});

  const ESTIMATED_SEC = 15;
  const MAX_POLL_MS = 120_000;

  // ─── Helpers ─────────────────────────────────────────────
  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function')
        el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (['disabled', 'checked', 'readonly', 'hidden'].includes(k)) {
        if (v) el.setAttribute(k, ''); else el.removeAttribute(k);
      }
      else if (v !== null && v !== undefined) el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  };

  const css = (strings, ...values) => strings.reduce((a, s, i) => a + s + (values[i] || ''), '');
  const apiBase = () => (CONFIG.apiBase || '').replace(/\/$/, '');

  function compressImage(source, maxDim = 1024) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let nw = img.naturalWidth || img.width;
        let nh = img.naturalHeight || img.height;
        if (nw > nh && nw > maxDim) { nh = Math.round((nh * maxDim) / nw); nw = maxDim; }
        else if (nh > maxDim) { nw = Math.round((nw * maxDim) / nh); nh = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = nw; canvas.height = nh;
        canvas.getContext('2d').drawImage(img, 0, 0, nw, nh);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = source;
    });
  }

  function findProductImages() {
    if (!CONFIG.imageSelector) return [];
    let candidates;
    try { candidates = [...document.querySelectorAll(CONFIG.imageSelector)]; }
    catch { return []; }

    if (CONFIG.excludeSelector) {
      let excluded;
      try { excluded = new Set(document.querySelectorAll(CONFIG.excludeSelector)); }
      catch { excluded = new Set(); }
      candidates = candidates.filter(img => !excluded.has(img));
    }
    return candidates
      .filter(img => (img.src || '').startsWith('http'))
      .map(img => ({ url: img.src, alt: img.alt || 'Garment', el: img }));
  }

  const ICON_SPARK = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L13.6 8.4L20 10L13.6 11.6L12 18L10.4 11.6L4 10L10.4 8.4L12 2Z"/><path d="M19 14L19.7 16.3L22 17L19.7 17.7L19 20L18.3 17.7L16 17L18.3 16.3L19 14Z" opacity="0.7"/></svg>`;

  // ─── Overlay Buttons (Main Document) ─────────────────────
  const overlayStyleEl = document.createElement('style');
  overlayStyleEl.textContent = `
    .sm-overlay-btn {
      position: absolute; top: 10px; right: 10px; z-index: 2147483646;
      width: 34px; height: 34px; padding: 0;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.4);
      color: rgba(255,255,255,0.9);
      backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px);
      border-radius: 50%; cursor: pointer; box-shadow: none;
      display: flex; align-items: center; justify-content: center;
      opacity: 0.5;
      transition: opacity .25s ease, background .25s, border-color .25s, box-shadow .25s, transform .2s cubic-bezier(.34,1.56,.64,1);
      touch-action: manipulation; user-select: none;
    }
    .sm-overlay-btn.sm-active {
      opacity: 1;
      background: rgba(15, 12, 22, 0.85);
      backdrop-filter: blur(12px) saturate(1.4); -webkit-backdrop-filter: blur(12px) saturate(1.4);
      border-color: rgba(255,255,255,0.14);
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    }
    .sm-overlay-btn.sm-active:hover {
      transform: scale(1.1);
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      border-color: transparent;
      box-shadow: 0 8px 24px rgba(139, 92, 246, 0.45);
    }
    .sm-overlay-btn svg { width: 16px; height: 16px; pointer-events: none; }
    @media (hover: none) {
      .sm-overlay-btn { opacity: 1; background: rgba(15, 12, 22, 0.85); backdrop-filter: blur(12px); border-color: rgba(255,255,255,0.14); box-shadow: 0 6px 20px rgba(0,0,0,0.35); }
    }
  `;
  document.head.appendChild(overlayStyleEl);

  // ─── Shadow DOM Setup ────────────────────────────────────
  const host = h('div', { id: 'stylemirror-host' });
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;pointer-events:none;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const SHADOW_STYLES = css`
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; -webkit-font-smoothing: antialiased; }

    /* ─── Full screen drag overlay ─── */
    .sm-drag-overlay { position: fixed; inset: 0; z-index: 2147483647; background: rgba(8,6,14,0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; pointer-events: none; animation: sm-fade .2s ease; }
    @keyframes sm-fade { from { opacity: 0; } to { opacity: 1; } }
    .sm-drag-card { background: rgba(22,19,31,0.9); border: 2px dashed rgba(167,139,250,0.5); border-radius: 24px; padding: 44px 64px; text-align: center; color: #f5f3fa; box-shadow: 0 24px 64px rgba(0,0,0,0.5); }
    .sm-drag-icon { width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(167,139,250,0.2), rgba(99,102,241,0.15)); display: flex; align-items: center; justify-content: center; font-size: 32px; }
    .sm-drag-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 6px; }
    .sm-drag-text { font-size: 14px; color: #8b8599; }

    /* ─── Modal ─── */
    .sm-overlay-bg { position: fixed; inset: 0; z-index: 2147483646; background: rgba(8,6,14,0.75); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: clamp(0px, 4vw, 24px); animation: sm-fade .25s ease; pointer-events: auto; }
    .sm-sheet { background: linear-gradient(160deg, #16131f 0%, #1d1929 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: clamp(0px, 2vw, 24px); width: min(100%, 940px); max-height: min(92vh, 920px); overflow-y: auto; overscroll-behavior: contain; box-shadow: 0 32px 96px rgba(0,0,0,0.6); color: #ece9f3; position: relative; animation: sm-sheet-in .4s cubic-bezier(.32,1.4,.64,1); pointer-events: auto; }
    @keyframes sm-sheet-in { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .sm-sheet-header { display: flex; align-items: center; justify-content: space-between; padding: 22px clamp(18px, 4vw, 28px) 18px; border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; background: rgba(22,19,31,0.92); backdrop-filter: blur(14px); z-index: 2; }
    .sm-header-left { display: flex; align-items: center; gap: 12px; }
    .sm-header-badge { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #a78bfa, #6366f1); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(99,102,241,0.35); flex-shrink: 0; color: #fff; }
    .sm-header-badge svg { width: 18px; height: 18px; }
    .sm-header-titles { display: flex; flex-direction: column; gap: 2px; }
    .sm-header-title { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
    .sm-header-subtitle { font-size: 12px; color: #8b8599; font-weight: 500; }
    .sm-close { width: 36px; height: 36px; min-width: 36px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: #ccc; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: background .2s, transform .2s; }
    .sm-close:hover { background: rgba(255,255,255,0.12); transform: rotate(90deg); }
    .sm-sheet-body { padding: clamp(18px, 4vw, 28px); display: grid; grid-template-columns: 1fr; gap: 24px; }
    @media (min-width: 720px) { .sm-sheet-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(24px, 3vw, 32px); align-items: start; } }
    @media (max-width: 719px) { .sm-overlay-bg { align-items: flex-end; padding: 0; } .sm-sheet { border-radius: 22px 22px 0 0; max-height: 94vh; width: 100%; } .sm-sheet-header { padding-top: 24px; } .sm-sheet-header::before { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.18); } .sm-sheet-body { padding-bottom: max(24px, env(safe-area-inset-bottom, 0px) + 20px); } }

    /* ─── Layout Components ─── */
    .sm-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .sm-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #8b8599; }

    /* ─── Unified Image Box (Garment & Preview) ─── */
    .sm-img-box { width: 100%; aspect-ratio: 3/4; max-width: min(100%, 360px); margin: 0 auto; border-radius: 16px; overflow: hidden; position: relative; background: rgba(0,0,0,0.3); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .sm-img-box img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }

    /* Unified Upload / Result Box */
    .sm-unified-box { border: 2px dashed rgba(255,255,255,0.14); cursor: pointer; transition: border-color .2s, background .2s; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
    .sm-unified-box:hover, .sm-unified-box.drag { border-color: #a78bfa; background: rgba(167,139,250,0.06); }
    .sm-unified-box.has-photo { border: 1px solid rgba(255,255,255,0.05); cursor: default; }
    .sm-unified-box.has-photo:hover { border-color: rgba(255,255,255,0.05); background: rgba(0,0,0,0.3); }

    .sm-drop-icon { width: 48px; height: 48px; border-radius: 14px; background: rgba(167,139,250,0.12); display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .sm-drop-title { font-size: 14px; font-weight: 600; color: #d8d4e3; }
    .sm-drop-text { font-size: 12px; color: #8b8599; line-height: 1.5; max-width: 220px; text-align: center; }
    .sm-drop-link { font-size: 12px; color: #a78bfa; cursor: pointer; margin-top: 4px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(167,139,250,0.3); transition: background .2s; }
    .sm-drop-link:hover { background: rgba(167,139,250,0.1); }

    .sm-overlay-bar { position: absolute; left: 0; right: 0; bottom: 0; padding: 10px 12px; background: linear-gradient(to top, rgba(0,0,0,0.85), transparent); display: flex; align-items: center; justify-content: space-between; z-index: 2; }
    .sm-overlay-label { font-size: 12px; color: #fff; font-weight: 600; }
    .sm-overlay-btn-small { background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 600; }
    .sm-overlay-btn-small:hover { background: rgba(255,255,255,0.25); }

    .sm-gen { width: 100%; max-width: min(100%, 360px); margin: 0 auto; padding: 15px; border-radius: 14px; border: none; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; transition: transform .15s, box-shadow .25s, opacity .2s; box-shadow: 0 6px 18px rgba(99,102,241,0.3); display: flex; align-items: center; justify-content: center; gap: 8px; }
    .sm-gen:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(99,102,241,0.45); }
    .sm-gen:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }

    .sm-status { position: absolute; inset: 0; background: rgba(8,6,14,0.75); backdrop-filter: blur(4px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 20px; }
    .sm-status-msg { font-size: 14px; color: #d8d4e3; font-weight: 600; z-index: 1; }
    .sm-status-eta { font-size: 12px; color: #8b8599; z-index: 1; }
    .sm-skeleton { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%); background-size: 200% 100%; animation: sm-shimmer 1.5s infinite; }
    @keyframes sm-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    .sm-progress { width: 80%; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); overflow: hidden; z-index: 1; }
    .sm-progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #8b5cf6, #6366f1, #ec4899); background-size: 200% 100%; animation: sm-shimmer 1.5s infinite; transition: width .4s ease; }

    .sm-error-overlay { position: absolute; inset: 0; background: rgba(20,0,0,0.85); backdrop-filter: blur(4px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 20px; }
    .sm-error-title { font-weight: 700; font-size: 14px; color: #fca5a5; }
    .sm-error-msg { color: #f87171; line-height: 1.5; font-size: 13px; max-width: 240px; }
    .sm-error-btn { margin-top: 8px; padding: 8px 14px; border-radius: 9px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; font-size: 12px; font-weight: 600; cursor: pointer; }
    .sm-error-btn:hover { background: rgba(239,68,68,0.25); }

    /* ─── Before / After Slider ─── */
    .sm-ba { position: absolute; inset: 0; width: 100%; height: 100%; user-select: none; cursor: ew-resize; }
    .sm-ba-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; pointer-events: none; }
    .sm-ba-after { clip-path: inset(0 0 0 50%); }
    .sm-ba-handle { position: absolute; top: 0; bottom: 0; left: 50%; width: 3px; background: #fff; transform: translateX(-50%); pointer-events: none; box-shadow: 0 0 12px rgba(0,0,0,0.5); z-index: 2; }
    .sm-ba-knob { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: center; font-size: 14px; color: #333; box-shadow: 0 4px 14px rgba(0,0,0,0.35); }
    .sm-ba-label { position: absolute; top: 12px; padding: 5px 11px; border-radius: 7px; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; pointer-events: none; z-index: 2; }
    .sm-ba-label-before { left: 12px; }
    .sm-ba-label-after { right: 12px; }

    /* ─── Webcam ─── */
    .sm-cam-video { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; display: block; transform: scaleX(-1); }
    .sm-cam-actions { position: absolute; left: 0; right: 0; bottom: 0; padding: 10px 12px; background: linear-gradient(to top, rgba(0,0,0,0.85), transparent); display: flex; gap: 8px; z-index: 2; }
    .sm-cam-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); color: #e8e4f0; font-size: 13px; cursor: pointer; font-weight: 600; }
    .sm-cam-btn.primary { background: linear-gradient(135deg, #8b5cf6, #6366f1); border: none; }
    .sm-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
    .sm-hidden { display: none !important; }
  `;
  const styleEl = h('style', {});
  styleEl.textContent = SHADOW_STYLES;
  shadow.appendChild(styleEl);

  // ─── State ───────────────────────────────────────────────
  const state = {
    products: [], draggedGarment: null, selectedGarment: 0,
    bodyURL: null, taskID: null, status: 'idle',
    resultURL: null, error: null, progress: 0,
  };
  const getGarments = () => state.draggedGarment ? [state.draggedGarment, ...state.products] : state.products;

  // ─── Overlay Buttons (Instant Injection) ─────────────────
  const overlayBtnMap = new Map();

  function findSuitableParent(img) {
    let node = img.parentElement, depth = 0;
    while (node && depth < 3) {
      const pos = getComputedStyle(node).position;
      if (pos === 'relative' || pos === 'absolute' || pos === 'fixed') return node;
      node = node.parentElement; depth++;
    }
    return img.parentElement;
  }

  function injectOverlayButtons() {
    const seen = new Set();
    state.products.forEach((p) => {
      if (!p.el || !p.el.isConnected) return;
      const parent = findSuitableParent(p.el);
      if (!parent) return;
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      seen.add(p.el);
      if (overlayBtnMap.has(p.el)) return;

      const btn = h('div', {
        class: 'sm-overlay-btn',
        onclick: (e) => { e.stopPropagation(); e.preventDefault(); openModal(p.url); }
      });
      btn.innerHTML = ICON_SPARK;
      parent.appendChild(btn);

      const onEnter = () => btn.classList.add('sm-active');
      const onLeave = () => btn.classList.remove('sm-active');
      parent.addEventListener('mouseenter', onEnter);
      parent.addEventListener('mouseleave', onLeave);

      overlayBtnMap.set(p.el, { btn, parent, onEnter, onLeave });
    });

    for (const [imgEl, data] of overlayBtnMap.entries()) {
      if (!seen.has(imgEl) || !imgEl.isConnected) {
        data.btn.remove();
        data.parent.removeEventListener('mouseenter', data.onEnter);
        data.parent.removeEventListener('mouseleave', data.onLeave);
        overlayBtnMap.delete(imgEl);
      }
    }
  }

  // ─── Full-screen Drag Overlay ────────────────────────────
  let dragOverlayEl = null, isDragging = false, dragHideTimer = null;

  function showDragOverlay() {
    if (dragOverlayEl) return;
    dragOverlayEl = h('div', { class: 'sm-drag-overlay' });
    dragOverlayEl.innerHTML = `<div class="sm-drag-card"><div class="sm-drag-icon">🪞</div><div class="sm-drag-title">Drop to try it on</div><div class="sm-drag-text">Release anywhere to use this image as a garment</div></div>`;
    shadow.appendChild(dragOverlayEl);
  }
  function hideDragOverlay() { if (dragOverlayEl) { dragOverlayEl.remove(); dragOverlayEl = null; } }

  function extractImageURLFromDataTransfer(dt) {
    const uriList = dt.getData('text/uri-list');
    if (uriList) { const line = uriList.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#')); if (line) return line; }
    const html = dt.getData('text/html');
    if (html) { const match = html.match(/<img[^>]+src=["']([^"']+)["']/i); if (match) return match[1]; }
    const plain = dt.getData('text/plain');
    if (plain && /^https?:\/\//i.test(plain.trim())) return plain.trim();
    return null;
  }

  document.addEventListener('dragover', e => {
    if (overlay) return;
    if (!e.dataTransfer) return;
    const types = [...(e.dataTransfer.types || [])];
    if (!types.includes('Files') && !types.includes('text/uri-list') && !types.includes('text/html')) return;
    e.preventDefault();
    if (!isDragging) { isDragging = true; showDragOverlay(); }
    clearTimeout(dragHideTimer);
    dragHideTimer = setTimeout(() => { isDragging = false; hideDragOverlay(); }, 100);
  });

  document.addEventListener('drop', e => {
    if (!isDragging) return;
    e.preventDefault(); isDragging = false; clearTimeout(dragHideTimer);
    hideDragOverlay();

    const localFile = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (localFile && localFile.type.startsWith('image/')) { openModal(null, { garmentFile: localFile }); return; }

    const draggedURL = e.dataTransfer ? extractImageURLFromDataTransfer(e.dataTransfer) : null;
    if (draggedURL) { openModal(null, { garmentURL: new URL(draggedURL, location.href).href }); }
  });

  // ─── Modal Logic ─────────────────────────────────────────
  let overlay, sheet, liveRegion, lastFocused, abortController, sliderCleanup;

  function openModal(preSelectURL = null, preset = {}) {
    state.products = findProductImages();
    state.draggedGarment = null;
    state.bodyURL = null; state.status = 'idle'; state.error = null; state.resultURL = null; state.progress = 0;

    if (preset.garmentURL) {
      state.draggedGarment = { url: preset.garmentURL, alt: 'Selected image' };
      state.selectedGarment = 0;
    } else {
      const garments = getGarments();
      let idx = preSelectURL ? garments.findIndex(g => g.url === preSelectURL) : -1;
      state.selectedGarment = idx >= 0 ? idx : 0;
    }

    lastFocused = document.activeElement;

    overlay = h('div', { class: 'sm-overlay-bg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'StyleMirror Virtual Try-On' });
    sheet = h('div', { class: 'sm-sheet' });
    liveRegion = h('div', { role: 'status', 'aria-live': 'polite', class: 'sm-visually-hidden' });
    sheet.appendChild(liveRegion);

    renderModalBody();
    overlay.appendChild(sheet);
    shadow.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', trapKeys);
    setTimeout(() => { const f = sheet.querySelector('button:not([disabled]), [tabindex="0"], input'); if (f) f.focus(); }, 50);

    if (preset.garmentFile) handleGarmentFile(preset.garmentFile);
  }

  function closeModal() {
    if (abortController) { try { abortController.abort(); } catch {} abortController = null; }
    if (sliderCleanup) { sliderCleanup(); sliderCleanup = null; }
    if (overlay) overlay.remove();
    overlay = null; sheet = null; liveRegion = null;
    document.removeEventListener('keydown', trapKeys);
    state.draggedGarment = null;
    if (lastFocused && typeof lastFocused.focus === 'function') { try { lastFocused.focus(); } catch {} }
    lastFocused = null;
  }

  function trapKeys(e) {
    if (!sheet) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    const focusable = sheet.querySelectorAll('button:not([disabled]), [tabindex="0"], input, a[href]');
    if (focusable.length === 0) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function renderModalBody() {
    if (sliderCleanup) { sliderCleanup(); sliderCleanup = null; }

    const prevSheetScroll = sheet ? sheet.scrollTop : 0;
    sheet.innerHTML = '';
    sheet.appendChild(liveRegion);

    const garments = getGarments();
    const selectedGarment = garments[state.selectedGarment] || garments[0];

    const badge = h('div', { class: 'sm-header-badge' }); badge.innerHTML = ICON_SPARK;
    const header = h('div', { class: 'sm-sheet-header' },
      h('div', { class: 'sm-header-left' }, badge,
        h('div', { class: 'sm-header-titles' }, h('div', { class: 'sm-header-title' }, 'Virtual Try-On'), h('div', { class: 'sm-header-subtitle' }, 'See how it looks on you'))
      ),
      h('button', { class: 'sm-close', 'aria-label': 'Close', onclick: closeModal }, '×')
    );
    sheet.appendChild(header);

    const body = h('div', { class: 'sm-sheet-body' });

    // Left Column: Garment Only
    const left = h('div', { class: 'sm-col' });
    left.appendChild(h('div', { class: 'sm-section-label' }, 'Garment'));
    if (selectedGarment) {
      left.appendChild(h('div', { class: 'sm-img-box' }, h('img', { src: selectedGarment.url, alt: selectedGarment.alt })));
    }
    body.appendChild(left);

    // Right Column: Unified Upload & Result Box + Generate Button
    const right = h('div', { class: 'sm-col' });
    right.appendChild(h('div', { class: 'sm-section-label' }, state.status === 'done' ? 'Result' : 'Your photo'));
    right.appendChild(renderUnifiedBox());

    const canGenerate = state.selectedGarment !== null && state.bodyURL !== null && ['idle', 'done', 'error'].includes(state.status);
    if (state.bodyURL) {
      right.appendChild(h('button', {
        class: 'sm-gen',
        disabled: !canGenerate,
        onclick: handleGenerate
      }, state.status === 'done' ? '↻ Try Again' : '✨ Create Look'));
    }

    body.appendChild(right);
    sheet.appendChild(body);

    sheet.scrollTop = prevSheetScroll;
  }

  function renderUnifiedBox() {
    const box = h('div', {
      class: 'sm-img-box sm-unified-box' + (state.bodyURL ? ' has-photo' : ''),
      tabindex: '0',
      role: 'button',
      'aria-label': state.bodyURL ? 'Your photo' : 'Upload your photo'
    });

    if (!state.bodyURL) {
      // Empty state -> Dropzone
      box.appendChild(h('div', { class: 'sm-drop-icon' }, '📷'));
      box.appendChild(h('div', { class: 'sm-drop-title' }, 'Add your photo'));
      box.appendChild(h('div', { class: 'sm-drop-text' }, 'Drag an image here or browse your files'));
      box.appendChild(h('div', { class: 'sm-drop-link', onclick: (e) => { e.stopPropagation(); startWebcam(box); } }, 'Use camera'));

      const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'sm-hidden' });
      fileInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) handleFile(f); });
      box.appendChild(fileInput);

      box.addEventListener('click', () => fileInput.click());
      box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
      box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); });
      box.addEventListener('dragleave', () => box.classList.remove('drag'));
      box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleFile(f); });

    } else {
      // Has photo -> Show Preview, Result, or Error overlay
      if (state.status === 'done' && state.resultURL) {
        box.appendChild(renderBeforeAfter());
      } else {
        box.appendChild(h('img', { src: state.bodyURL, alt: 'Your photo' }));
      }

      if (state.status === 'generating') {
        box.appendChild(h('div', { class: 'sm-status' },
          h('div', { class: 'sm-skeleton' }),
          h('div', { class: 'sm-status-msg' }, 'Creating your look…'),
          h('div', { class: 'sm-status-eta' }, `About ${ESTIMATED_SEC} seconds`),
          h('div', { class: 'sm-progress' }, h('div', { class: 'sm-progress-fill', style: `width:${Math.max(5, state.progress)}%;` }))
        ));
      } else if (state.status === 'error') {
        box.appendChild(h('div', { class: 'sm-error-overlay' },
          h('div', { class: 'sm-error-title' }, 'Something went wrong'),
          h('div', { class: 'sm-error-msg' }, state.error || 'Please try again.'),
          h('button', { class: 'sm-error-btn', onclick: () => { state.status = 'idle'; state.error = null; renderModalBody(); } }, 'Try again')
        ));
      } else {
        // Idle state overlay (Replace photo)
        box.appendChild(h('div', { class: 'sm-overlay-bar' },
          h('div', { class: 'sm-overlay-label' }, 'Photo ready'),
          h('button', {
            class: 'sm-overlay-btn-small',
            onclick: (e) => { e.stopPropagation(); state.bodyURL = null; state.status = 'idle'; renderModalBody(); }
          }, 'Replace')
        ));
      }
    }
    return box;
  }

  async function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) { state.error = 'Image must be under 10 MB.'; state.status = 'error'; renderModalBody(); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressedURL = await compressImage(reader.result, 1024);
        const img = new Image();
        img.onload = () => {
          if (img.width < 200 || img.height < 200) { state.error = 'Image is too small. Use at least 200×200 px.'; state.status = 'error'; renderModalBody(); return; }
          const ar = img.width / img.height;
          if (ar > 2.5 || ar < 0.4) { state.error = 'Aspect ratio looks off. Use a portrait or square photo.'; state.status = 'error'; renderModalBody(); return; }
          state.bodyURL = compressedURL; state.status = 'idle'; renderModalBody();
        };
        img.onerror = () => { state.error = 'Failed to process image.'; state.status = 'error'; renderModalBody(); };
        img.src = compressedURL;
      } catch { state.error = 'Failed to process image.'; state.status = 'error'; renderModalBody(); }
    };
    reader.readAsDataURL(file);
  }

  async function handleGarmentFile(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataURL = await compressImage(reader.result, 1024);
        state.draggedGarment = { url: dataURL, alt: 'Selected image' };
        state.selectedGarment = 0; renderModalBody();
      } catch { state.error = 'Failed to process image.'; state.status = 'error'; renderModalBody(); }
    };
    reader.readAsDataURL(file);
  }

  function startWebcam(box) {
    if (!confirm('StyleMirror wants to access your camera.\n\n• Your video stream is processed locally.\n• The captured photo is sent for try-on generation.\n• Nothing is stored.\n\nContinue?')) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } } })
      .then(stream => {
        const video = h('video', { class: 'sm-cam-video', autoplay: true, playsinline: true });
        video.srcObject = stream;

        box.innerHTML = '';
        box.classList.add('has-photo');
        box.appendChild(video);

        const captureBtn = h('button', { class: 'sm-cam-btn primary' }, '📸 Capture');
        const cancelBtn = h('button', { class: 'sm-cam-btn' }, 'Cancel');
        const actions = h('div', { class: 'sm-cam-actions' }, captureBtn, cancelBtn);
        box.appendChild(actions);

        let captured = false;
        captureBtn.onclick = (e) => {
          e.stopPropagation();
          if (captured) return; captured = true;
          const canvas = document.createElement('canvas'); const maxDim = 1024;
          let w = video.videoWidth, ht = video.videoHeight;
          if (w > ht && w > maxDim) { ht = Math.round((ht * maxDim) / w); w = maxDim; } else if (ht > maxDim) { w = Math.round((w * maxDim) / ht); ht = maxDim; }
          canvas.width = w; canvas.height = ht; const ctx = canvas.getContext('2d');
          ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, w, ht);
          stream.getTracks().forEach(t => t.stop());
          state.bodyURL = canvas.toDataURL('image/jpeg', 0.85); state.status = 'idle'; renderModalBody();
        };
        cancelBtn.onclick = (e) => { e.stopPropagation(); stream.getTracks().forEach(t => t.stop()); renderModalBody(); };
      })
      .catch(() => { state.error = 'Could not access camera.'; state.status = 'error'; renderModalBody(); });
  }

  async function handleGenerate() {
    const garments = getGarments();
    const garment = garments[state.selectedGarment];
    if (!garment || !state.bodyURL) return;
    if (abortController) { try { abortController.abort(); } catch {} }
    abortController = new AbortController();
    state.status = 'generating'; state.error = null; state.resultURL = null; state.progress = 0;
    renderModalBody();
    try {
      const resp = await fetch(`${apiBase()}/api/tryon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
        body: JSON.stringify({ garment_url: garment.url, body_url: state.bodyURL }), signal: abortController.signal
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `HTTP ${resp.status}`); }
      state.taskID = (await resp.json()).task_id;
      await pollStatus();
    } catch (e) {
      if (e.name === 'AbortError') return;
      state.status = 'error'; state.error = e.message; renderModalBody();
    }
  }

  async function pollStatus() {
    const start = Date.now(); const localAbort = abortController;
    const poll = async () => {
      if (!state.taskID) return;
      if (Date.now() - start > MAX_POLL_MS) { state.status = 'error'; state.error = 'Timed out.'; renderModalBody(); return; }
      try {
        const resp = await fetch(`${apiBase()}/api/tryon/${state.taskID}`, { headers: { 'X-Client-Id': getClientId() }, signal: localAbort ? localAbort.signal : undefined });
        const data = await resp.json();
        state.progress = Math.min(95, ((Date.now() - start) / 1000 / ESTIMATED_SEC) * 100);
        if (data.status === 'succeeded') { state.status = 'done'; state.resultURL = data.result_url; renderModalBody(); return; }
        if (data.status === 'failed') { state.status = 'error'; state.error = data.error || 'Failed.'; renderModalBody(); return; }
        const fill = sheet && sheet.querySelector('.sm-progress-fill');
        if (fill) fill.style.width = `${Math.max(5, state.progress)}%`;
        setTimeout(poll, data.poll_after_ms || 1500);
      } catch (e) {
        if (e.name === 'AbortError') return;
        setTimeout(poll, 2000);
      }
    };
    await poll();
  }

  function getClientId() {
    try { let id = localStorage.getItem('sm_client_id'); if (!id) { id = 'us_' + Math.random().toString(36).slice(2, 14); localStorage.setItem('sm_client_id', id); } return id; }
    catch { if (!window.__sm_client_id) window.__sm_client_id = 'us_' + Math.random().toString(36).slice(2, 14); return window.__sm_client_id; }
  }

  function renderBeforeAfter() {
    const wrap = h('div', { class: 'sm-ba', role: 'slider', 'aria-label': 'Comparison', tabindex: '0' });
    const before = h('img', { class: 'sm-ba-img', src: state.bodyURL, alt: 'Before' });
    const after = h('img', { class: 'sm-ba-img sm-ba-after', src: state.resultURL, alt: 'After' });
    const handle = h('div', { class: 'sm-ba-handle' }); handle.appendChild(h('div', { class: 'sm-ba-knob' }, '⇆'));
    wrap.append(before, after, handle, h('div', { class: 'sm-ba-label sm-ba-label-before' }, 'You'), h('div', { class: 'sm-ba-label sm-ba-label-after' }, 'Try-On'));
    let dragging = false;
    const update = (cx) => { const r = wrap.getBoundingClientRect(); let p = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100)); after.style.clipPath = `inset(0 0 0 ${p}%)`; handle.style.left = p + '%'; };
    const md = e => { dragging = true; update(e.clientX); };
    const mm = e => { if (dragging) update(e.clientX); };
    const mu = () => { dragging = false; };
    const ts = e => { update(e.touches[0].clientX); };
    const tm = e => { e.preventDefault(); update(e.touches[0].clientX); };
    wrap.addEventListener('mousedown', md); window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    wrap.addEventListener('touchstart', ts, { passive: true }); wrap.addEventListener('touchmove', tm, { passive: false });
    sliderCleanup = () => { wrap.removeEventListener('mousedown', md); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); wrap.removeEventListener('touchstart', ts); wrap.removeEventListener('touchmove', tm); };
    return wrap;
  }

  // ─── Instant DOM Observer & Init ─────────────────────────
  function rescan() {
    const newProducts = findProductImages();
    const oldUrls = new Set(state.products.map(p => p.url));
    const newUrls = new Set(newProducts.map(p => p.url));
    let changed = oldUrls.size !== newUrls.size;
    if (!changed) { for (const u of newUrls) if (!oldUrls.has(u)) { changed = true; break; } }
    state.products = newProducts;
    if (changed) injectOverlayButtons();
  }

  let throttleTimer = null;
  function startObserver() {
    const observer = new MutationObserver(() => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => { rescan(); throttleTimer = null; }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (!CONFIG.imageSelector) console.warn('[StyleMirror] No imageSelector configured.');
    state.products = findProductImages();
    if (state.products.length > 0) injectOverlayButtons();
    startObserver();
  }

  window.StyleMirror = Object.assign(window.StyleMirror || {}, {
    configure(partial) { Object.assign(CONFIG, partial || {}); rescan(); return { ...CONFIG }; },
    getConfig() { return { ...CONFIG }; }, rescan,
    open(productURL) { openModal(productURL); },
    close() { closeModal(); },
  });

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
