/*
 * Tutorial overlay, injected into the page by record-tutorial.cjs.
 *
 * Draws step callouts with an arrow and a highlight ring around the element being
 * explained, plus a visible cursor (headless screencasts do not draw one). Lives
 * in its own shadow root above everything, and never takes pointer events, so the
 * page underneath behaves exactly as for a real user.
 */
(() => {
  if (window.__tutorial) return;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .layer { position: fixed; inset: 0; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      .ring {
        position: fixed; border: 3px solid #ffd700; border-radius: 10px;
        box-shadow: 0 0 0 4px rgba(255, 215, 0, 0.25), 0 0 24px rgba(255, 215, 0, 0.45);
        transition: all .35s ease; opacity: 0;
      }
      .ring.on { opacity: 1; }
      .box {
        position: fixed; max-width: 380px; padding: 14px 16px 14px 16px;
        background: rgba(18, 18, 18, 0.96); color: #f2f2f2; border-radius: 12px;
        border: 1px solid #ffd700; box-shadow: 0 10px 30px rgba(0, 0, 0, .55);
        opacity: 0; transform: translateY(6px); transition: opacity .3s, transform .3s;
      }
      .box.on { opacity: 1; transform: none; }
      .step {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; margin-right: 8px; border-radius: 50%;
        background: #ffd700; color: #111; font-weight: 700; font-size: 14px; vertical-align: 1px;
      }
      .title { font-size: 17px; font-weight: 700; }
      .text { margin-top: 6px; color: #cfcfcf; }
      svg { position: fixed; inset: 0; width: 100%; height: 100%; overflow: visible; }
      .arrow { stroke: #ffd700; stroke-width: 3.5; fill: none; stroke-linecap: round; opacity: 0; transition: opacity .3s; }
      .arrow.on { opacity: 1; }
      .cursor { position: fixed; width: 22px; height: 22px; margin: -2px 0 0 -2px; transition: transform .08s; }
      .ripple {
        position: fixed; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%;
        border: 3px solid #ffd700; animation: ripple .5s ease-out forwards;
      }
      @keyframes ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
      .banner {
        position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
        background: rgba(10, 10, 10, .82); opacity: 0; transition: opacity .4s;
      }
      .banner.on { opacity: 1; }
      .banner.opaque { background: #0a0a0a; }
      .banner .inner { text-align: center; color: #fff; max-width: 760px; padding: 0 24px; }
      .banner h1 { font-size: 44px; margin: 0 0 12px; letter-spacing: -.01em; }
      .banner h1 span { color: #ffd700; }
      .banner p { font-size: 20px; color: #ccc; margin: 0; }
    </style>
    <div class="layer">
      <div class="ring"></div>
      <svg><defs><marker id="head" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#ffd700"/></marker></defs>
        <path class="arrow" marker-end="url(#head)"/></svg>
      <div class="box"><div><span class="step"></span><span class="title"></span></div><div class="text"></div></div>
      <div class="banner"><div class="inner"><h1></h1><p></p></div></div>
      <svg class="cursor" viewBox="0 0 24 24"><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.3 L17.5 13.3 Z"
        fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const ring = $('.ring'), box = $('.box'), arrow = $('.arrow'), cursor = $('.cursor'), banner = $('.banner');

  // The fake cursor follows the real (synthetic) mouse
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  }, true);
  document.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    r.className = 'ripple';
    r.style.left = `${e.clientX}px`;
    r.style.top = `${e.clientY}px`;
    $('.layer').appendChild(r);
    setTimeout(() => r.remove(), 600);
  }, true);

  const PAD = 6, GAP = 26, MARGIN = 16;

  /** Place the box beside the target on the side with the most room */
  function place(rect, w, h, placement) {
    const vw = innerWidth, vh = innerHeight;
    const room = { right: vw - rect.right, left: rect.left, bottom: vh - rect.bottom, top: rect.top };
    const side = placement && placement !== 'auto' ? placement : Object.entries(room).sort((a, b) => b[1] - a[1])[0][0];
    let x, y;
    if (side === 'right') { x = rect.right + GAP + 30; y = rect.top + rect.height / 2 - h / 2; }
    if (side === 'left') { x = rect.left - GAP - 30 - w; y = rect.top + rect.height / 2 - h / 2; }
    if (side === 'bottom') { x = rect.left + rect.width / 2 - w / 2; y = rect.bottom + GAP + 30; }
    if (side === 'top') { x = rect.left + rect.width / 2 - w / 2; y = rect.top - GAP - 30 - h; }
    x = Math.max(MARGIN, Math.min(vw - w - MARGIN, x));
    y = Math.max(MARGIN, Math.min(vh - h - MARGIN, y));
    return { x, y, side };
  }

  window.__tutorial = {
    /**
     * rect: target box in viewport px (or null for a free-standing note)
     * at: optional {x, y} to pin the box instead of auto-placing it
     * aim: optional part of rect for the arrow to point at, e.g. one option in a menu
     */
    callout({ rect, step, title, text, placement = 'auto', at, aim }) {
      $('.step').textContent = step ?? '';
      $('.step').style.display = step === undefined ? 'none' : '';
      $('.title').textContent = title || '';
      $('.text').textContent = text || '';
      $('.text').style.display = text ? '' : 'none';
      box.style.left = '-9999px';
      box.classList.add('on');
      const w = box.offsetWidth, h = box.offsetHeight;

      if (!rect) {
        ring.classList.remove('on');
        arrow.classList.remove('on');
        const p = at || { x: (innerWidth - w) / 2, y: innerHeight - h - 40 };
        box.style.left = `${p.x}px`;
        box.style.top = `${p.y}px`;
        return;
      }

      ring.style.left = `${rect.x - PAD}px`;
      ring.style.top = `${rect.y - PAD}px`;
      ring.style.width = `${rect.width + PAD * 2}px`;
      ring.style.height = `${rect.height + PAD * 2}px`;
      ring.classList.add('on');

      let r = { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height, width: rect.width, height: rect.height };
      const p = at ? { ...at, side: placement } : place(r, w, h, placement);
      box.style.left = `${p.x}px`;
      box.style.top = `${p.y}px`;

      // Arrow from the box edge nearest the target to the middle of the ring's
      // side facing the box, so it points at the target and not past a corner
      if (aim) r = { left: aim.x, top: aim.y, right: aim.x + aim.width, bottom: aim.y + aim.height, width: aim.width, height: aim.height };
      const bx = Math.max(p.x, Math.min(p.x + w, r.left + r.width / 2));
      const by = Math.max(p.y, Math.min(p.y + h, r.top + r.height / 2));
      const gapX = Math.max(r.left - (p.x + w), p.x - r.right);
      const gapY = Math.max(r.top - (p.y + h), p.y - r.bottom);
      const edge = PAD + 4;
      let tx, ty;
      if (gapY > gapX) {
        tx = Math.max(r.left + r.width * 0.25, Math.min(r.right - r.width * 0.25, bx));
        ty = p.y + h < r.top ? r.top - edge : r.bottom + edge;
      } else {
        tx = p.x + w < r.left ? r.left - edge : r.right + edge;
        ty = Math.max(r.top + r.height * 0.25, Math.min(r.bottom - r.height * 0.25, by));
      }
      const mx = (bx + tx) / 2 + (ty - by) * 0.15, my = (by + ty) / 2 - (tx - bx) * 0.15;
      arrow.setAttribute('d', `M${bx},${by} Q${mx},${my} ${tx},${ty}`);
      arrow.classList.toggle('on', Math.hypot(tx - bx, ty - by) > 20);
    },
    clear() {
      box.classList.remove('on');
      ring.classList.remove('on');
      arrow.classList.remove('on');
    },
    /** opaque: hide the page entirely, e.g. while the video is still loading */
    banner(title, text, { opaque = false } = {}) {
      banner.querySelector('h1').innerHTML = title;
      banner.querySelector('p').textContent = text || '';
      banner.classList.toggle('opaque', opaque);
      banner.classList.add('on');
    },
    hideBanner() {
      banner.classList.remove('on');
    },
    /**
     * Keep NRK's controls out of the picture while the pointer moves about, and
     * NRK's subtitles where they are. Off while a step needs the controls.
     */
    calmPlayer(on) {
      let style = document.getElementById('tutorial-calm-player');
      if (!on) return style?.remove();
      if (style) return;
      style = document.createElement('style');
      style.id = 'tutorial-calm-player';
      style.textContent = `
        tv-player-controls, tv-player-nav-bar { opacity: 0 !important; transition: opacity .3s !important; }
        tv-player-subtitles.displace-subtitles { --active-controls-height: 0px !important; }`;
      document.head.appendChild(style);
    },
    /**
     * NRK hides its controls soon after its subtitle menu opens, and both lines
     * slide back down behind the menu. Pin them at the height they have now.
     */
    holdSubtitlesUp(on) {
      let style = document.getElementById('tutorial-hold-subtitles');
      if (!on) return style?.remove();
      const layer = document.querySelector('tv-player-subtitles.displace-subtitles');
      if (style || !layer) return;
      const distance = getComputedStyle(layer).getPropertyValue('--active-controls-height').trim();
      style = document.createElement('style');
      style.id = 'tutorial-hold-subtitles';
      style.textContent = `
        tv-player-subtitles { --active-controls-height: ${distance} !important; bottom: ${getComputedStyle(layer).bottom} !important; }
        .nrk-oversetter-translation { --nrk-ov-displace: ${distance} !important; }`;
      document.head.appendChild(style);
    },
    hideCursor(hidden) {
      cursor.style.display = hidden ? 'none' : '';
    },
  };
})();
