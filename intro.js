(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const stage = $('#stage'), viewport = $('#viewport'), bottle = $('#bottle');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the 1920×1080 frame, scaled to the window ----------
     The stage is centred across the window and stands on its bottom edge. Width decides the scale,
     unless the window is so short that the headline would run into the header. On wide windows the stone
     scales up around the spot where the bottle stands, just enough to reach the right edge;
     the full-bleed layers read the window edges in stage px. */
  let view = { s: 1, x: 0, y: 0, w: 1920, h: 1080 };
  const FOOT = { x: 1128.85, y: 940 };     // where the bottle stands on the stone (stage px)
  function fit() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    const s = Math.min(w / 1920, h / 945);                // never let the headline run into the header
    const x = (w - 1920 * s) / 2, y = h - 1080 * s;      // centred across, standing on the bottom edge
    view = { s, x, y, w, h };
    const L = -x / s, T = -y / s, Rt = (w - x) / s, B = (h - y) / s;     // window edges in stage px
    const k = Math.max(1, (Rt - FOOT.x) / (1920 - FOOT.x));   // grow until the stone meets the right edge
    const v = viewport.style;
    v.setProperty('--s', s);
    v.setProperty('--stage-x', x + 'px');
    v.setProperty('--stage-y', y + 'px');
    v.setProperty('--left-edge', Math.min(0, L) + 'px');
    v.setProperty('--top-edge', Math.min(0, T) + 'px');
    v.setProperty('--right-edge', Math.max(1920, Rt) + 'px');
    v.setProperty('--bottom-edge', Math.max(1080, B) + 'px');
    v.setProperty('--stone-k', k);
  }
  addEventListener('resize', fit);
  fit();

  /* ---------- tiny tween kit ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = {
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    in: t => t * t * t,
    sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    camera: t => 1 - Math.pow(1 - t, 2.2),                                    // moves from the first frame, lands softly
  };
  const tween = (ms, fn, e = ease.inOut) => new Promise(res => {
    const t0 = performance.now();
    const step = now => { const raw = clamp((now - t0) / ms); fn(e(raw), raw); raw < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const setV = o => { for (const k in o) bottle.style.setProperty('--' + k, o[k]); };

  /* ---------- geometry, in bottle-frame px (measured from the renders) ---------- */
  const TIP = 4.75 + 1371 * 0.455;     // bottom of the glass tip with the pipette screwed in
  const MOUTH = 180;                   // rim of the open neck
  const LIFT = 559;                    // pipette height in the close-up: tip hangs ~110px above the rim
  const TILT = -12;                    // the pipette leans, like in the reference footage
  const K0 = 2.8;                      // close-up zoom
  // the close-up centres the drip zone (bottle-frame 221,125) in the window, whatever its size
  const cam = () => ({ x: (view.w / 2 - view.x) / view.s - (907.85 + 221), y: (view.h / 2 - view.y) / view.s - (309 + 125) });
  const FAST = 6;                      // the close-up plays faster than real time
  const T = ms => ms / FAST;

  /* ---------- the serum: a heavy clear drop that swells, stretches into a thread and snaps ---------- */
  const stream = $('#stream'), rimRect = $('#rimRect');
  const threadPath = $('#threadPath'), threadEdge = $('#threadEdge'), bulbShade = $('#bulbShade'), hangHi = $('#hangHi'), hangRef = $('#hangRef');
  const fall = $('#fall'), fallPath = $('#fallPath'), splash = $('#splash');
  const CX = 30, W0 = 30;             // the liquid wraps the underside of the glass ball
  const f = n => n.toFixed(2);
  let streamTop = 0;

  function placeStream(lift, tilt = TILT) {
    streamTop = TIP - lift - 14;                           // starts on the lower half of the glass ball
    stream.style.top = streamTop + 'px';
    stream.style.left = 191 + 20 * Math.sin(tilt * Math.PI / 180) + 'px';   // follow the ball's centre when the pipette leans
    rimRect.setAttribute('height', f(MOUTH - streamTop + 22));   // liquid disappears into the neck
  }
  function thread(L, R, nw) {
    const nY = Math.max(L * .5, 4), top = 0;
    const sides =
      `M${f(CX - W0 / 2)} ${top}` +
      `C${f(CX - W0 / 2)} ${f(nY * .45)} ${f(CX - nw / 2)} ${f(nY * .6)} ${f(CX - nw / 2)} ${f(nY)}` +
      `C${f(CX - nw / 2)} ${f(mix(nY, L, .55))} ${f(CX - R)} ${f(L - R * 1.15)} ${f(CX - R)} ${f(L)}` +
      `A${f(R)} ${f(R * 1.05)} 0 0 0 ${f(CX + R)} ${f(L)}` +
      `C${f(CX + R)} ${f(L - R * 1.15)} ${f(CX + nw / 2)} ${f(mix(nY, L, .55))} ${f(CX + nw / 2)} ${f(nY)}` +
      `C${f(CX + nw / 2)} ${f(nY * .6)} ${f(CX + W0 / 2)} ${f(nY * .45)} ${f(CX + W0 / 2)} ${top}`;
    threadPath.setAttribute('d', sides + 'Z');
    threadEdge.setAttribute('d', sides);
    bulbShade.setAttribute('d', `M${f(CX - R)} ${f(L)}A${f(R)} ${f(R * 1.05)} 0 1 0 ${f(CX + R)} ${f(L)}A${f(R)} ${f(R * 1.05)} 0 1 0 ${f(CX - R)} ${f(L)}Z`);
    hangHi.setAttribute('cx', f(CX - R * .42)); hangHi.setAttribute('cy', f(L - R * .25));
    hangHi.setAttribute('rx', f(R * .1)); hangHi.setAttribute('ry', f(R * .26));
    hangRef.setAttribute('d', `M${f(CX - R * .6)} ${f(L + R * .5)}Q${CX} ${f(L + R * 1.0)} ${f(CX + R * .6)} ${f(L + R * .5)}`);
  }
  function strand(y0, y1, w) {            // the piece that breaks off and falls into the neck
    fallPath.setAttribute('d',
      `M${CX} ${f(y0)}C${f(CX + w * .3)} ${f(y0 + (y1 - y0) * .4)} ${f(CX + w / 2)} ${f(y1 - w)} ${f(CX + w / 2)} ${f(y1 - w / 2)}` +
      `A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(CX - w / 2)} ${f(y1 - w / 2)}` +
      `C${f(CX - w / 2)} ${f(y1 - w)} ${f(CX - w * .3)} ${f(y0 + (y1 - y0) * .4)} ${CX} ${f(y0)}Z`);
  }
  function ripple() {
    return tween(T(650), t => { splash.style.opacity = (1 - t) * .85; splash.style.transform = `scale(${.3 + .8 * t}, ${.45 + .6 * t})`; }, ease.out);
  }

  /* liquid level inside the pipette, in pipette-image px (the tube runs from the collar down to y≈1371) */
  const liqBody = $('#liqBody'), liqTop = $('#liqTop'), liqTopHi = $('#liqTopHi'), liqClipRect = $('#liqClipRect');
  function level(y) {
    liqBody.setAttribute('y', f(y));
    liqClipRect.setAttribute('y', f(y + 10));
    liqTop.setAttribute('d', `M503 ${f(y)}Q542 ${f(y + 16)} 581 ${f(y)}`);
    liqTopHi.setAttribute('d', `M503 ${f(y + 6)}Q542 ${f(y + 22)} 581 ${f(y + 6)}`);
  }
  const LEVEL0 = 1105, LEVEL1 = 1262;  // full → almost empty as the drop leaves

  async function pour() {
    const dist = MOUTH - streamTop;                        // tip → rim
    tween(T(7400), t => level(mix(LEVEL0, LEVEL1, t)), ease.inOut);
    await tween(T(2100), t => thread(mix(14, 46, t), mix(15.5, 21, t), mix(30, 29, t)), ease.sine);          // a heavy oil drop swells on the tip
    await tween(T(1500), t => thread(mix(46, 100, t), mix(21, 19, t), mix(29, 9, t)), ease.in);         // slowly gives in to gravity
    tween(T(650), () => {}).then(ripple);
    await tween(T(650), t => thread(mix(100, dist + 24, t), mix(19, 15, t), mix(9, 6.5, t)), ease.in);   // and pours into the neck
    await tween(T(1600), t => thread(dist + 24, 15, mix(6.5, 1.4, t)), ease.inOut);                       // the oily thread holds on, thinning
    // snap: the tail drops into the bottle, the rest springs back to the tip
    const snapY = (dist + 24) * .42;
    fall.setAttribute('opacity', 1);
    const back = tween(T(800), t => thread(mix(dist + 24, 20, t), mix(15, 17, t), mix(1.4, 30, t)), ease.out);
    await tween(T(480), t => strand(mix(snapY, dist + 4, t), mix(dist + 24, dist + 40, t), mix(3.5, 2.2, t)), ease.in);
    fall.setAttribute('opacity', 0);
    await back;
  }

  /* ---------- the hero reveals ---------- */
  const R = k => $$(`[data-r=${k}]`);
  /* Long moves run as Web Animations: the browser plays them on the compositor (GPU),
     so the zoom stays smooth even while the drop is being redrawn on the main thread. */
  const EASE_CAM = 'cubic-bezier(.3,.55,.35,1)';
  const EASE_IO = 'cubic-bezier(.65,0,.35,1)';
  const EASE_OUT = 'cubic-bezier(.33,1,.68,1)';
  const anim = (els, frames, ms, easing, delay = 0) =>
    Promise.all([].concat(els).map(el => el.animate(frames, { duration: ms, easing, delay, fill: 'forwards' }).finished));
  const camAt = (k, x, y) => `translate(${f(x)}px, ${f(y)}px) scale(${f(k)})`;

  async function intro() {
    setV({ lift: LIFT, tilt: TILT }); placeStream(LIFT); thread(14, 15.5, 30); level(LEVEL0);
    const CAM = cam();
    bottle.style.transform = camAt(K0, CAM.x, CAM.y);
    await anim(bottle, [{ opacity: 0 }, { opacity: 1 }], T(700), EASE_OUT);
    bottle.style.opacity = 1;

    // the camera starts pulling back straight away, while the drop is still pouring
    const zoom = anim(bottle, [{ transform: camAt(K0, CAM.x, CAM.y) }, { transform: camAt(1, 0, 0) }], 3300, EASE_CAM);
    await pour();

    // the pipette goes home and straightens
    anim(stream, [{ opacity: 1 }, { opacity: 0 }], 320, EASE_OUT);
    const pipette = $$('.bottle .pip, .bottle .cap');
    await anim(pipette, [
      { transform: `translateY(${-LIFT}px) rotate(${TILT}deg)` },
      { transform: `translateY(${-LIFT * .45}px) rotate(${TILT * .15}deg)`, offset: .5 },
      { transform: 'translateY(0px) rotate(0deg)' }], 1300, EASE_IO, 80);

    // swap the intro renders for the single bottle from the design
    anim($('.bottle .final'), [{ opacity: 0 }, { opacity: 1 }], 450, EASE_IO);
    anim($$('.bottle .open').concat(pipette), [{ opacity: 1 }, { opacity: 0 }], 450, EASE_IO);

    anim(R('stone'), [{ opacity: 0, translate: '0 160px' }, { opacity: 1, translate: '0 0' }], 1200, EASE_OUT);
    anim($$('.bottle .el5, .bottle .el6, .bottle .ghost'), [{ opacity: 0 }, { opacity: 1 }], 700, EASE_OUT, 450);
    await zoom;

    // everything else, in reading order (all compositor animations)
    const up = (els, ms, dy = 36, delay = 0) => anim(els, [{ opacity: 0, translate: `0 ${dy}px` }, { opacity: 1, translate: '0 0' }], ms, EASE_OUT, delay);
    const word = (k, delay) => { $(`[data-r=${k}]`).style.opacity = 1; return anim($(`[data-r=${k}] span`), [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], 900, EASE_OUT, delay); };
    anim(R('fade').concat(R('leaf')), [{ opacity: 0 }, { opacity: 1 }], 1400, EASE_OUT);
    up(R('logo').concat(R('nav'), R('icons')), 800, -20);
    word('w1', 200); word('w2', 340); word('w3', 480); word('w4', 620);
    up(R('perks'), 800, 36, 1240); up(R('lead'), 800, 36, 1360); up(R('cta'), 800, 36, 1480);
    await up(R('socials'), 800, 36, 1600);
    root.classList.remove('intro');
  }

  if (reduce) {
    root.classList.remove('intro');
    $$('.bottle .open, .bottle .pip, .bottle .cap, #stream').forEach(el => el.style.opacity = 0);
    return;
  }
  // decode every image up front so the first frames of the close-up never stall
  const decoded = $$('.bottle img').map(img => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}));
  Promise.all([document.fonts ? document.fonts.ready : null, ...decoded]).then(intro);
})();
