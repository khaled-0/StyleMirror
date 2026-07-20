(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────
  const API_BASE = (window.SM_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
  const DEMO_MODE = (() => {
    try { return localStorage.getItem('sm_demo_mode') !== 'false'; }
    catch { return true; }
  })();
  const ONBOARDING_KEY = 'sm_onboarded_v1';
  const ESTIMATED_SEC = 15;
  const MAX_POLL_MS = 120_000; // 2 minutes

  // ─── Helpers ─────────────────────────────────────────────
  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
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

  // ─── Image compression ────
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
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, nw, nh);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = source;
    });
  }

  // ─── Product image detection ─────────────────────────────
  function findProductImages() {
    if (DEMO_MODE) {
      return [...document.querySelectorAll('img')]
        .filter(img => {
          const w = img.clientWidth || img.naturalWidth || img.width;
          const ht = img.clientHeight || img.naturalHeight || img.height;
          if (w < 200 || ht < 200) return false;
          const src = (img.src || '').toLowerCase();
          if (src.includes('icon') || src.includes('logo') || src.includes('sprite') || src.includes('btn') || src.includes('avatar')) return false;
          return src.startsWith('http');
        })
        .slice(0, 12)
        .map(img => ({ url: img.src, alt: img.alt || 'Product', el: img }));
    }
    return [...document.querySelectorAll('[data-stylemirror="true"] img, img[data-stylemirror="true"]')]
      .map(img => ({ url: img.src, alt: img.alt || 'Product', el: img }));
  }

  // ─── Main Document Styles (Overlay Buttons) ──────────────
  const OVERLAY_STYLES = `
    .sm-overlay-btn {
      position: absolute; top: 8px; right: 8px; z-index: 2147483646;
      background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(40,36,54,0.92));
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 999px;
      padding: clamp(6px, 1.4vw, 8px) clamp(10px, 2.6vw, 13px);
      color: #f0eef5; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      font-size: clamp(11px, 2.4vw, 12px); font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; align-items: center; gap: 6px;
      min-height: 28px;
      transition: transform .2s, border-color .2s, box-shadow .2s, background .3s;
      touch-action: manipulation;
    }
    .sm-overlay-btn:hover, .sm-overlay-btn:focus-visible {
      transform: scale(1.08);
      border-color: transparent;
      background: linear-gradient(135deg, #8b5cf6, #6366f1, #ec4899, #8b5cf6);
      background-size: 300% 300%;
      animation: sm-gradient-rotate 2s linear infinite;
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.5);
    }
    @keyframes sm-gradient-rotate {
      0% { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    .sm-overlay-btn svg { width: 14px; height: 14px; pointer-events: none; }
    @media (hover: none) {
      .sm-overlay-btn { min-height: 34px; padding: 8px 14px; }
    }
  `;
  const mainStyleEl = document.createElement('style');
  mainStyleEl.textContent = OVERLAY_STYLES;
  document.head.appendChild(mainStyleEl);

  // ─── Shadow DOM mount ────────────────────────────────────
  const host = h('div', { id: 'stylemirror-host' });
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const SHADOW_STYLES = css`
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .sm-root {
      position: fixed;
      bottom: max(20px, env(safe-area-inset-bottom, 0px) + 14px);
      right: max(20px, env(safe-area-inset-right, 0px) + 14px);
      z-index: 2147483647;
    }

    .sm-fab {
      display: flex; align-items: center; gap: clamp(0px, 2vw, 10px);
      background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(40,36,54,0.92));
      backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 999px;
      padding: 10px clamp(10px, 3.5vw, 18px) 10px 12px; color: #f0eef5; cursor: pointer;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s, opacity .2s;
      position: relative; overflow: hidden;
      touch-action: manipulation;
    }
    .sm-fab::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(110deg, transparent 30%, rgba(180,160,255,0.12) 50%, transparent 70%);
      transform: translateX(-100%); transition: transform .6s;
    }
    .sm-fab:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 12px 40px rgba(0,0,0,0.45); }
    .sm-fab:hover::before { transform: translateX(100%); }
    .sm-fab-icon { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #a78bfa, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .sm-fab-label { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; max-width: 160px; transition: max-width .25s ease, opacity .2s ease, margin .25s ease; }

    @media (max-width: 420px) {
      /* Collapse to an icon-only FAB on very narrow viewports; label stays for a11y via aria-label */
      .sm-fab { padding: 10px; }
      .sm-fab-label { max-width: 0; opacity: 0; margin: 0; }
    }

    .sm-tip {
      position: absolute; bottom: calc(100% + 12px); right: 0;
      background: rgba(15,12,22,0.97); color: #e8e4f0;
      border: 1px solid rgba(167,139,250,0.3); border-radius: 12px;
      padding: 12px 16px; width: min(260px, calc(100vw - 40px));
      font-size: 13px; line-height: 1.5;
      box-shadow: 0 12px 36px rgba(0,0,0,0.4);
      animation: sm-tip-in .4s cubic-bezier(.34,1.56,.64,1);
    }
    .sm-tip::after { content: ''; position: absolute; bottom: -6px; right: 28px; width: 12px; height: 12px; background: rgba(15,12,22,0.97); border-right: 1px solid rgba(167,139,250,0.3); border-bottom: 1px solid rgba(167,139,250,0.3); transform: rotate(45deg); }
    .sm-tip-title { font-weight: 700; margin-bottom: 4px; font-size: 14px; }
    .sm-tip-close { position: absolute; top: 8px; right: 10px; background: none; border: none; color: #999; cursor: pointer; font-size: 16px; }
    @keyframes sm-tip-in { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .sm-overlay {
      position: fixed; inset: 0; z-index: 2147483646;
      background: rgba(8,6,14,0.72); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: clamp(0px, 4vw, 24px);
      animation: sm-fade .25s ease;
    }
    @keyframes sm-fade { from { opacity: 0; } to { opacity: 1; } }

    /* Fluid width: fills small screens, settles into a comfortable reading width on large ones */
    .sm-sheet {
      background: linear-gradient(145deg, #14121b, #1c1828);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: clamp(0px, 2vw, 20px);
      width: min(100%, 920px);
      max-height: min(92vh, 900px);
      overflow-y: auto; overscroll-behavior: contain;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
      color: #e8e4f0; position: relative;
      animation: sm-sheet-in .35s cubic-bezier(.34,1.4,.64,1);
      z-index: 999;
    }
    @keyframes sm-sheet-in { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .sm-sheet-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px clamp(16px, 4vw, 24px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      position: sticky; top: 0;
      background: rgba(20,18,28,0.9); backdrop-filter: blur(12px);
      z-index: 2; border-radius: inherit; border-bottom-left-radius: 0; border-bottom-right-radius: 0;
    }
    .sm-sheet-title { font-size: clamp(16px, 3.6vw, 18px); font-weight: 700; letter-spacing: -0.02em; }
    .sm-close { width: 36px; height: 36px; min-width: 36px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: #ccc; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: background .2s; touch-action: manipulation; }
    .sm-close:hover, .sm-close:focus-visible { background: rgba(255,255,255,0.12); }

    /* Base (mobile-first): single column. Grid handles reflow at each tier below. */
    .sm-sheet-body { padding: clamp(16px, 4vw, 24px); display: grid; grid-template-columns: 1fr; gap: 20px; }

    /* Tablet and up: two columns, inputs beside result */
    @media (min-width: 640px) {
      .sm-sheet-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(20px, 3vw, 28px); align-items: start; }
    }

    /* Small phones: edge-to-edge bottom sheet with safe-area padding and a drag-handle affordance */
    @media (max-width: 639px) {
      .sm-overlay { align-items: flex-end; padding: 0; }
      .sm-sheet { border-radius: 20px 20px 0 0; max-height: 94vh; width: 100%; }
      .sm-sheet-header { padding-top: 22px; }
      .sm-sheet-header::before {
        content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
        width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.2);
      }
      .sm-sheet-body { padding-bottom: max(20px, env(safe-area-inset-bottom, 0px) + 16px); }
    }

    .sm-col-left, .sm-col-right { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

    .sm-section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #8b8599; margin-bottom: 4px; }

    /* FIX: minmax(0, 1fr) and min-width: 0 prevent grid overlapping.
       3 columns on mobile/tablet; scales to more columns as the column itself gets wider. */
    .sm-garments { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; max-height: 220px; overflow-y: auto; padding: 2px; }
    @media (min-width: 900px) {
      .sm-garments { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    .sm-garment { aspect-ratio: 1 / 1; border-radius: 10px; overflow: hidden; border: 2px solid transparent; cursor: pointer; position: relative; transition: border-color .2s, box-shadow .2s; min-width: 0; touch-action: manipulation; }
    .sm-garment img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s ease; display: block; }
    .sm-garment:hover img { transform: scale(1.1); }
    .sm-garment.selected { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.2); }

    /* Dropzone / preview / result all share a fluid square-ish frame:
       full-bleed on narrow columns, capped so it doesn't balloon on ultra-wide screens */
    .sm-drop { border: 2px dashed rgba(255,255,255,0.12); border-radius: 14px; padding: 20px; text-align: center; cursor: pointer; transition: border-color .2s, background .2s; aspect-ratio: 3/4; width: 100%; max-width: min(100%, 340px); margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; touch-action: manipulation; }
    .sm-drop:hover, .sm-drop.drag { border-color: #a78bfa; background: rgba(167,139,250,0.06); }
    .sm-drop-icon { font-size: clamp(24px, 6vw, 28px); opacity: 0.6; }
    .sm-drop-text { font-size: 13px; color: #b0aabb; }
    .sm-drop-link { font-size: 12px; color: #a78bfa; cursor: pointer; text-decoration: underline; margin-top: 4px; padding: 4px; }

    .sm-preview { width: 100%; aspect-ratio: 3/4; max-width: min(100%, 340px); margin: 0 auto; border-radius: 14px; overflow: hidden; background: rgba(0,0,0,0.3); position: relative; }
    .sm-preview img { width: 100%; height: 100%; object-fit: cover; }
    .sm-preview-retry { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }

    .sm-result-box { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; width: 100%; aspect-ratio: 3/4; max-width: min(100%, 340px); margin: 0 auto; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }

    .sm-gen { width: 100%; max-width: min(100%, 340px); margin: 0 auto; padding: 14px; border-radius: 12px; border: none; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; transition: transform .15s, opacity .2s; letter-spacing: -0.01em; touch-action: manipulation; }
    .sm-gen:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.35); }
    .sm-gen:disabled { opacity: 0.4; cursor: not-allowed; }

    .sm-status { text-align: center; padding: 20px; width: 100%; }
    .sm-status-msg { font-size: 14px; color: #b0aabb; margin-top: 12px; }
    .sm-status-eta { font-size: 12px; color: #6b6577; margin-top: 4px; }
    .sm-skeleton { width: 100%; height: 100%; background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%); background-size: 200% 100%; animation: sm-shimmer 1.5s infinite; }
    @keyframes sm-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

    .sm-progress { width: 100%; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); margin-top: 14px; overflow: hidden; }
    .sm-progress-fill { height: 100%; background: linear-gradient(90deg, #8b5cf6, #6366f1, #ec4899); background-size: 200% 100%; animation: sm-shimmer 1.5s infinite; border-radius: 3px; transition: width .4s ease; }

    .sm-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 14px; color: #fca5a5; font-size: 13px; width: 100%; text-align: left; }

    .sm-ba { position: relative; width: 100%; height: 100%; user-select: none; cursor: ew-resize; }
    .sm-ba-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .sm-ba-after { clip-path: inset(0 0 0 50%); }
    .sm-ba-handle { position: absolute; top: 0; bottom: 0; left: 50%; width: 3px; background: #fff; transform: translateX(-50%); pointer-events: none; box-shadow: 0 0 12px rgba(0,0,0,0.4); }
    .sm-ba-knob { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: center; font-size: 14px; color: #333; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .sm-ba-label { position: absolute; top: 10px; padding: 4px 10px; border-radius: 6px; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; pointer-events: none; }
    .sm-ba-label-before { left: 10px; }
    .sm-ba-label-after { right: 10px; }

    .sm-cam-video { width: 100%; border-radius: 12px; display: block; transform: scaleX(-1); }
    .sm-cam-actions { display: flex; gap: 8px; margin-top: 10px; }
    .sm-cam-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #e8e4f0; font-size: 13px; cursor: pointer; }
    .sm-cam-btn.primary { background: linear-gradient(135deg, #8b5cf6, #6366f1); border: none; font-weight: 600; }
    .sm-consent { font-size: 11px; color: #8b8599; margin-top: 8px; line-height: 1.4; }

    .sm-visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .sm-hidden { display: none !important; }
  `;

  // ─── State ───────────────────────────────────────────────
  const state = {
    products: [],
    selectedGarment: null,
    bodyURL: null,
    taskID: null,
    status: 'idle',
    resultURL: null,
    error: null,
    progress: 0,
  };

  // ─── Build UI ────────────────────────────────────────────
  const root = h('div', { class: 'sm-root' });
  const styleEl = h('style', {});
  styleEl.textContent = SHADOW_STYLES;
  shadow.appendChild(styleEl);
  shadow.appendChild(root);

  const fab = h('div', { class: 'sm-fab', role: 'button', tabindex: '0', 'aria-label': 'Open StyleMirror try-on' },
    h('div', { class: 'sm-fab-icon' }, '🪞'),
    h('div', { class: 'sm-fab-label' }, 'Try It On'),
  );
  root.appendChild(fab);

  try {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      const tip = h('div', { class: 'sm-tip' },
        h('button', { class: 'sm-tip-close', 'aria-label': 'Dismiss', onclick: () => { tip.remove(); try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {} } }, '×'),
        h('div', { class: 'sm-tip-title' }, 'StyleMirror is ready'),
        h('div', {}, 'Click "Try It On" on any product image to virtually wear it. Your photo stays on your device.'),
      );
      root.appendChild(tip);
    }
  } catch {}

  fab.addEventListener('click', () => openModal(null));
  fab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(null); } });

  // ─── Overlay Buttons ─────────────────────────────────────
  const overlayBtnMap = new Map();

  function findSuitableParent(img) {
    let node = img.parentElement;
    let depth = 0;
    while (node && depth < 3) {
      const pos = getComputedStyle(node).position;
      if (pos === 'relative' || pos === 'absolute' || pos === 'fixed') return node;
      node = node.parentElement;
      depth++;
    }
    return img.parentElement;
  }

  function injectOverlayButtons() {
    const seen = new Set();

    state.products.forEach((p, i) => {
      if (!p.el) return;
      const parent = findSuitableParent(p.el);
      if (!parent) return;

      const computed = getComputedStyle(parent);
      if (computed.position === 'static') {
        parent.style.position = 'relative';
      }

      seen.add(p.el);
      if (overlayBtnMap.has(p.el)) return;

      const btn = h('div', {
        class: 'sm-overlay-btn',
        onclick: (e) => { e.stopPropagation(); e.preventDefault(); openModal(i); }
      }, '🪞 Try It On');
      parent.appendChild(btn);
      overlayBtnMap.set(p.el, btn);
    });

    for (const [imgEl, btnEl] of overlayBtnMap.entries()) {
      if (!seen.has(imgEl)) {
        btnEl.remove();
        overlayBtnMap.delete(imgEl);
      }
    }
  }

  // ─── Modal ───────────────────────────────────────────────
  let overlay, sheet, liveRegion;
  let lastFocused = null;
  let abortController = null;
  let sliderCleanup = null;

  function openModal(preSelectIndex) {
    state.products = findProductImages();
    if (state.products.length === 0) {
      state.products = [{ url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', alt: 'Demo shirt', el: null }];
    }

    state.selectedGarment = (preSelectIndex !== null && preSelectIndex >= 0 && preSelectIndex < state.products.length)
      ? preSelectIndex : 0;

    lastFocused = document.activeElement;
    fab.style.opacity = '0';
    fab.style.pointerEvents = 'none';
    fab.style.transform = 'scale(0.8)';

    overlay = h('div', { class: 'sm-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'StyleMirror Try-On' });
    sheet = h('div', { class: 'sm-sheet' });

    liveRegion = h('div', { role: 'status', 'aria-live': 'polite', class: 'sm-visually-hidden' });
    sheet.appendChild(liveRegion);

    renderModalBody();
    overlay.appendChild(sheet);
    shadow.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', trapKeys);

    setTimeout(() => {
      const first = sheet.querySelector('button:not([disabled]), [tabindex="0"], input');
      if (first) first.focus();
    }, 50);
  }

  function closeModal() {
    if (abortController) { try { abortController.abort(); } catch {} abortController = null; }
    if (sliderCleanup) { sliderCleanup(); sliderCleanup = null; }
    if (overlay) overlay.remove();
    overlay = null; sheet = null; liveRegion = null;
    document.removeEventListener('keydown', trapKeys);

    fab.style.opacity = '';
    fab.style.pointerEvents = '';
    fab.style.transform = '';

    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch {}
    }
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

  function announce(msg) {
    if (liveRegion) { liveRegion.textContent = ''; setTimeout(() => { if (liveRegion) liveRegion.textContent = msg; }, 50); }
  }

  function renderModalBody() {
    if (sliderCleanup) { sliderCleanup(); sliderCleanup = null; }

    sheet.innerHTML = '';
    sheet.appendChild(liveRegion);

    const header = h('div', { class: 'sm-sheet-header' },
      h('div', { class: 'sm-sheet-title' }, '🪞 Virtual Try-On'),
      h('button', { class: 'sm-close', 'aria-label': 'Close', onclick: closeModal }, '×'),
    );
    sheet.appendChild(header);

    const body = h('div', { class: 'sm-sheet-body' });

    // ── Left: Inputs ──
    const left = h('div', { class: 'sm-col-left' },
      h('div', { class: 'sm-section-label' }, '1 · Choose a garment'),
      h('div', { class: 'sm-garments' },
        ...state.products.map((p, i) =>
          h('div', {
            class: 'sm-garment' + (state.selectedGarment === i ? ' selected' : ''),
            onclick: () => { state.selectedGarment = i; renderModalBody(); },
            role: 'button',
            tabindex: '0',
            'aria-label': `Select garment ${i + 1}`,
            'aria-pressed': state.selectedGarment === i ? 'true' : 'false',
          }, h('img', { src: p.url, alt: p.alt, loading: 'lazy' }))
        )
      ),
      h('div', { class: 'sm-section-label' }, '2 · Upload your photo'),
      state.bodyURL
        ? h('div', { class: 'sm-preview' },
            h('img', { src: state.bodyURL, alt: 'Your photo' }),
            h('button', { class: 'sm-preview-retry', onclick: () => { state.bodyURL = null; renderModalBody(); } }, 'Replace')
          )
        : renderDropzone(),
    );
    body.appendChild(left);

    // ── Right: Result & Action ──
    const right = h('div', { class: 'sm-col-right' },
      h('div', { class: 'sm-section-label' }, '3 · Result')
    );

    const resultBox = h('div', { class: 'sm-result-box' });

    if (state.status === 'idle') {
      resultBox.appendChild(h('div', { style: 'text-align:center;color:#6b6577;padding:20px;' },
        h('div', { style: 'font-size:36px;margin-bottom:8px;' }, '✨'),
        h('div', { style: 'font-size:13px;' }, 'Your try-on result will appear here')
      ));
    } else if (state.status === 'uploading') {
      resultBox.appendChild(h('div', { class: 'sm-status' }, h('div', { class: 'sm-skeleton' })));
    } else if (state.status === 'generating') {
      resultBox.appendChild(h('div', { class: 'sm-status' },
        h('div', { class: 'sm-skeleton' }),
        h('div', { class: 'sm-status-msg' }, 'Generating try-on…'),
        h('div', { class: 'sm-status-eta' }, `Usually takes ~${ESTIMATED_SEC}s`),
        h('div', { class: 'sm-progress' },
          h('div', { class: 'sm-progress-fill', style: `width:${Math.max(5, state.progress)}%;` })
        )
      ));
    } else if (state.status === 'done' && state.resultURL) {
      resultBox.appendChild(renderBeforeAfter());
    } else if (state.status === 'error') {
      resultBox.appendChild(h('div', { class: 'sm-error' },
        h('div', { style: 'font-weight:600;margin-bottom:4px;' }, 'Generation failed'),
        h('div', {}, state.error || 'Please try again.'),
        h('button', { class: 'sm-cam-btn', style: 'margin-top:10px;', onclick: () => { state.status = 'idle'; state.error = null; renderModalBody(); } }, 'Try again')
      ));
    }
    right.appendChild(resultBox);

    // ── Generate button ──
    const canGenerate = state.selectedGarment !== null && state.bodyURL !== null && ['idle', 'done', 'error'].includes(state.status);
    right.appendChild(h('button', {
      class: 'sm-gen',
      disabled: !canGenerate,
      onclick: handleGenerate,
    }, state.status === 'done' ? '↻ Regenerate' : '✨ Generate Try-On'));

    body.appendChild(right);
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
  async function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) {
      state.error = 'Image must be under 10 MB.'; state.status = 'error'; renderModalBody(); return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressedURL = await compressImage(reader.result, 1024);
        const img = new Image();
        img.onload = () => {
          if (img.width < 200 || img.height < 200) {
            state.error = 'Image is too small. Use at least 200×200 px.'; state.status = 'error'; renderModalBody(); return;
          }
          const ar = img.width / img.height;
          if (ar > 2.5 || ar < 0.4) {
            state.error = 'Aspect ratio looks off. Use a portrait or square photo with a clear subject.'; state.status = 'error'; renderModalBody(); return;
          }
          state.bodyURL = compressedURL;
          state.status = 'idle';
          renderModalBody();
        };
        img.onerror = () => {
          state.error = 'Failed to process image.'; state.status = 'error'; renderModalBody();
        };
        img.src = compressedURL;
      } catch (e) {
        state.error = 'Failed to process image.'; state.status = 'error'; renderModalBody();
      }
    };
    reader.onerror = () => {
      state.error = 'Failed to read file.'; state.status = 'error'; renderModalBody();
    };
    reader.readAsDataURL(file);
  }

  // ─── Webcam ──────────────────────────────────────────────
  function startWebcam() {
    const leftCol = sheet.querySelector('.sm-col-left');
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

        const dz = leftCol.querySelector('.sm-drop');
        if (dz) dz.replaceWith(camWrap);

        let captured = false;
        captureBtn.onclick = () => {
          if (captured) return;
          captured = true;
          const canvas = document.createElement('canvas');
          const maxDim = 1024;
          let w = video.videoWidth, ht = video.videoHeight;
          if (w > ht && w > maxDim) { ht = Math.round((ht * maxDim) / w); w = maxDim; }
          else if (ht > maxDim) { w = Math.round((w * maxDim) / ht); ht = maxDim; }
          canvas.width = w; canvas.height = ht;
          const ctx = canvas.getContext('2d');
          ctx.translate(w, 0); ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, w, ht);
          stream.getTracks().forEach(t => t.stop());
          const dataURL = canvas.toDataURL('image/jpeg', 0.85);
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

    if (abortController) { try { abortController.abort(); } catch {} }
    abortController = new AbortController();

    state.status = 'generating';
    state.error = null;
    state.resultURL = null;
    state.progress = 0;
    renderModalBody();
    announce('Generating your try-on. This usually takes about 15 seconds.');

    try {
      const resp = await fetch(`${API_BASE}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
        body: JSON.stringify({ garment_url: garment.url, body_url: state.bodyURL }),
        signal: abortController.signal,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      state.taskID = data.task_id;
      await pollStatus();
    } catch (e) {
      if (e.name === 'AbortError') return;
      state.status = 'error';
      state.error = e.message;
      renderModalBody();
      announce('Try-on failed: ' + e.message);
    }
  }

  async function pollStatus() {
    const start = Date.now();
    let stopped = false;
    const stop = () => { stopped = true; };

    const localAbort = abortController;

    const poll = async () => {
      if (stopped || !state.taskID) return;
      if (Date.now() - start > MAX_POLL_MS) {
        state.status = 'error';
        state.error = 'Generation timed out. Please try again.';
        renderModalBody();
        announce('Try-on timed out.');
        return;
      }
      try {
        const resp = await fetch(`${API_BASE}/api/tryon/${state.taskID}`, {
          headers: { 'X-Client-Id': getClientId() },
          signal: localAbort ? localAbort.signal : undefined,
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
    try {
      let id = localStorage.getItem('sm_client_id');
      if (!id) {
        id = 'us_' + Math.random().toString(36).slice(2, 14);
        localStorage.setItem('sm_client_id', id);
      }
      return id;
    } catch {
      if (!window.__sm_client_id) {
        window.__sm_client_id = 'us_' + Math.random().toString(36).slice(2, 14);
      }
      return window.__sm_client_id;
    }
  }

  // ─── Before/After slider ──────
  function renderBeforeAfter() {
    const wrap = h('div', {
      class: 'sm-ba',
      role: 'slider',
      'aria-label': 'Before and after comparison',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '50',
      tabindex: '0'
    });
    const before = h('img', { class: 'sm-ba-img sm-ba-before', src: state.bodyURL, alt: 'Before' });
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
      wrap.setAttribute('aria-valuenow', String(Math.round(pct)));
    };

    const onMouseDown = (e) => { dragging = true; update(e.clientX); };
    const onMouseMove = (e) => { if (dragging) update(e.clientX); };
    const onMouseUp = () => { dragging = false; };
    const onTouchStart = (e) => { update(e.touches[0].clientX); };
    const onTouchMove = (e) => { e.preventDefault(); update(e.touches[0].clientX); };
    const onKeydown = (e) => {
      const cur = parseFloat(handle.style.left) || 50;
      const rect = wrap.getBoundingClientRect();
      if (e.key === 'ArrowLeft') { e.preventDefault(); update(rect.left + (cur - 5) / 100 * rect.width); }
      if (e.key === 'ArrowRight') { e.preventDefault(); update(rect.left + (cur + 5) / 100 * rect.width); }
    };

    wrap.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    wrap.addEventListener('touchmove', onTouchMove, { passive: false });
    wrap.addEventListener('keydown', onKeydown);

    sliderCleanup = () => {
      wrap.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      wrap.removeEventListener('touchstart', onTouchStart);
      wrap.removeEventListener('touchmove', onTouchMove);
      wrap.removeEventListener('keydown', onKeydown);
    };

    return wrap;
  }

  // ─── Initialization ──────────────────────────────────────
  function init() {
    state.products = findProductImages();
    if (state.products.length > 0) {
      injectOverlayButtons();
    }

    setInterval(() => {
      const newProducts = findProductImages();
      const oldUrls = new Set(state.products.map(p => p.url));
      const newUrls = new Set(newProducts.map(p => p.url));
      let changed = oldUrls.size !== newUrls.size;
      if (!changed) {
        for (const u of newUrls) if (!oldUrls.has(u)) { changed = true; break; }
      }
      if (changed) {
        state.products = newProducts;
        injectOverlayButtons();
      }
    }, 3000);

    if (DEMO_MODE) {
      const label = fab.querySelector('.sm-fab-label');
      if (label) label.textContent = '🧪 Try It On (Demo)';
    }

    console.log('[StyleMirror] Injector loaded. Demo mode:', DEMO_MODE, '| Products found:', state.products.length);
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
