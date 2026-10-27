(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const viewport = $('#viewport'), bottle = $('#bottle');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the 1920×1080 frame, scaled to the window ----------
     Figma "Design" (58:170), 27 Oct: the content runs from x 50 to x 1870, so the side margins are 50px.
     Width decides the scale so those margins stay exactly 50px on screen; the logo lines up with the headline,
     the header tools with the headline's right edge and the socials. On short windows the scale drops so the
     headline keeps at least 150px below the header (header bottom 100, headline caps 258, stage px); the
     content then stays centred and the header follows its edges. */
  let view = { s: 1, x: 0, y: 0, w: 1920, h: 1080 };
  const FOOT = { x: 1146.26, y: 991 };     // where the bottle stands on the stone (stage px)
  const MARGIN = 50, CONTENT = 1820, HEAD = 100, CAPS = 258, MIN_GAP = 150;
  function fit() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    const s = Math.max(.1, Math.min((w - 2 * MARGIN) / CONTENT, (h - MIN_GAP) / (1080 - CAPS + HEAD)));
    const left = (w - CONTENT * s) / 2;                  // screen x of the content's left edge (50px when width decides)
    const x = left - MARGIN * s, y = h - 1080 * s;       // stage stands on the bottom edge
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
  addEventListener('resize', () => { fit(); size3d(); });
  fit();

  /* ---------- the 3D bottle (assets/js/bottle3d.js) ----------
     Arrives through window.__novaBottle; null means no WebGL, and the flat render simply stays. */
  const bottleBox = $('#bottle'), canvas3d = $('#b3d');
  let B = null;
  const turn = { rot: 0, target: 0, raf: 0, last: 0 };
  let introOver = false;
  const adopt = api => { B = api; if (B) { size3d(); B.drawBack(['Aqua', 'Glycerin', 'Panthenol'], introOver ? [1, 1, 1] : [0, 0, 0]); } return B; };
  const bottleReady = new Promise(res => {
    if ('__novaBottleEarly' in window) return res(window.__novaBottleEarly);
    window.__novaBottle = api => {
      res(api);
      // arrived after the intro gave up waiting (slow connection): switch to 3D quietly
      if (introOver && api && !B) { adopt(api); turn.rot = 0; show3d(); enableHover(); }
    };
    setTimeout(() => res(null), 6000);            // not loaded yet: the intro carries on with the flat render
  }).then(adopt);
  // no drawing until the bottle is on screen: the first draw compiles the shaders, which would stutter the list animation
  function size3d() { if (B) { B.resize(489.33 * view.s, 734 * view.s, Math.min(2, window.devicePixelRatio || 1)); if (bottleBox.classList.contains('is-3d')) draw3d(); } }
  function draw3d() { if (!B) return; B.bottle.rotation.y = turn.rot; B.render(); }
  function show3d() { if (B && !bottleBox.classList.contains('is-3d')) { draw3d(); bottleBox.classList.add('is-3d'); } }
  // eased spin towards turn.target; renders only while it moves
  function spinTo(target) {
    turn.target = target;
    if (turn.raf) return;
    turn.last = performance.now();
    const step = now => {
      const dt = Math.min(.05, (now - turn.last) / 1000); turn.last = now;
      turn.rot += (turn.target - turn.rot) * (1 - Math.exp(-dt * 5.5));
      if (Math.abs(turn.target - turn.rot) < .0008) turn.rot = turn.target;
      draw3d();
      turn.raf = turn.rot === turn.target ? 0 : requestAnimationFrame(step);
    };
    turn.raf = requestAnimationFrame(step);
  }
  function enableHover() {
    const hit = $('#bottleHit');
    let tilt = 0;
    const toBack = () => spinTo(Math.PI + tilt), toFront = () => { tilt = 0; spinTo(0); };
    hit.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') toBack(); });
    hit.addEventListener('pointermove', e => {           // a little follow of the cursor while the back is shown
      if (e.pointerType !== 'mouse') return;
      const r = hit.getBoundingClientRect(); tilt = ((e.clientX - r.left) / r.width - .5) * .5; toBack();
    });
    hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') toFront(); });
    hit.addEventListener('click', e => { if (e.pointerType !== 'mouse') (turn.target > 1 ? toFront() : toBack()); });   // touch: tap to turn
  }

  /* ---------- helpers: every move is a Web Animation, so the browser runs it on the compositor ---------- */
  const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
  const EASE_IO = 'cubic-bezier(.65,0,.35,1)';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const anim = (els, frames, ms, easing, delay = 0) =>
    Promise.all([].concat(els).map(el => el.animate(frames, { duration: ms, easing, delay, fill: 'forwards' }).finished));
  const R = k => $$(`[data-r=${k}]`);

  /* ---------- the ingredient list ---------- */
  const inci = $('#inci'), list = $('#inciList'), count = $('#inciN'), label = $('.inci-head span');
  const items = $$('.i', list);
  const keep = items.filter(el => el.classList.contains('keep'));
  const cut = items.filter(el => !el.classList.contains('keep'));
  // the comma after each name belongs to that name, so it leaves with it
  items.forEach(el => {
    const sep = el.nextSibling;
    if (sep && sep.nodeType === 3) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = sep.textContent.trim(); el.append(s); sep.textContent = ' '; }
    const line = document.createElement('span'); line.className = 'strike'; el.append(line);
  });
  // a fixed, shuffled order so every visit edits the list the same way
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const order = cut.map(el => [rnd(), el]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

  async function edit() {
    const n0 = items.length, SPAN = 1500;
    let left = n0;
    await Promise.all(order.map((el, k) => {
      const delay = SPAN * Math.pow(k / order.length, 0.85);      // starts deliberate, speeds up
      const strike = el.querySelector('.strike');
      const a = anim(strike, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 180, EASE_OUT, delay);
      const b = anim(el, [{ opacity: 1 }, { opacity: 0 }], 240, 'ease-out', delay + 150);
      setTimeout(() => { count.textContent = --left; }, delay + 190);
      return Promise.all([a, b]);
    }));
  }

  // the three survivors glide into one line in the middle of the card
  async function gather() {
    const box = list.getBoundingClientRect();
    const rects = keep.map(el => el.getBoundingClientRect());
    const seps = keep.map(el => el.querySelector('.sep'));
    const sepW = seps.map(s => s.getBoundingClientRect().width);
    const gap = parseFloat(getComputedStyle(list).fontSize) * 1.1;
    const K = 1.6;                                               // the three names grow as they gather
    const widths = rects.map((r, i) => (r.width - sepW[i]) * K);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (keep.length - 1);
    // centre the line between the card's left edge and the bottle's silhouette, so the bottle never covers it
    const hit = $('#bottleHit').getBoundingClientRect();
    const right = Math.min(box.right, hit.left - 40);
    let x = box.left + Math.max(0, (right - box.left - total) / 2);
    const y = box.top + box.height / 2;
    anim(seps, [{ opacity: 1 }, { opacity: 0 }], 220, 'ease-out');
    await Promise.all(keep.map((el, i) => {
      const r = rects[i], dx = x - r.left, dy = y - (r.top + r.height / 2);
      x += widths[i] + gap;
      return anim(el, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${K})` }], 750, EASE_IO, i * 50);
    }));
  }

  async function relabel(text) {
    await anim(label, [{ opacity: 1 }, { opacity: 0 }], 180, 'ease-in');
    label.textContent = text;
    await anim(label, [{ opacity: 0 }, { opacity: 1 }], 260, 'ease-out');
  }

  /* ---------- the hero ---------- */
  async function hero() {
    const up = (els, ms, dy = 36, delay = 0) => anim(els, [{ opacity: 0, translate: `0 ${dy}px` }, { opacity: 1, translate: '0 0' }], ms, EASE_OUT, delay);
    const word = (k, delay) => { $(`[data-r=${k}]`).style.opacity = 1; return anim($(`[data-r=${k}] span`), [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], 1000, EASE_OUT, delay); };
    anim(R('fade'), [{ opacity: 0 }, { opacity: 1 }], 1600, EASE_OUT);
    word('w1', 0); word('w2', 140); word('w3', 280); word('w4', 420);
    up(R('logo').concat(R('nav'), R('icons')), 900, -16, 450);
    up(R('perks'), 900, 30, 900); up(R('lead'), 900, 30, 1000); up(R('cta'), 900, 30, 1100);
    await up(R('socials'), 900, 30, 1200);
  }

  /* ---------- act 2: the three names land on the back of the bottle, which then turns to face us ---------- */
  const tween = (ms, fn, ease = t => t) => new Promise(res => {
    const t0 = performance.now();
    const step = now => { const t = Math.min(1, (now - t0) / ms); fn(ease(t)); t < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });
  const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const LIFT = -34;                                       // the bottle hovers a little before it settles on the stone

  async function toBottle() {
    await bottleReady;
    // the card's header and rule leave; the bottle appears with its back to us
    anim($('.inci-head'), [{ opacity: 1 }, { opacity: 0 }], 350, EASE_IO);
    if (B) { turn.rot = Math.PI; show3d(); }
    await anim(R('bottle'), [{ opacity: 0, translate: `0 ${LIFT - 26}px`, scale: .97 }, { opacity: 1, translate: `0 ${LIFT}px`, scale: 1 }], 600, EASE_OUT);

    // each name flies to its line on the back and is printed there. The flight uses a fixed-position copy of
    // the word, so the card's own transforms don't get in the way.
    const progress = [0, 0, 0];
    const ink = getComputedStyle(keep[0]).color, family = getComputedStyle(keep[0]).fontFamily;
    await Promise.all(keep.map((el, i) => new Promise(async res => {
      await wait(i * 110);
      const r = el.getBoundingClientRect();
      const fly = document.createElement('span');
      fly.textContent = el.firstChild.textContent.trim();
      fly.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:7;pointer-events:none;
        display:flex;align-items:center;justify-content:center;white-space:nowrap;color:${ink};font-family:${family};
        font-size:${r.height / 1.25}px;line-height:1;letter-spacing:-.01em;transform-origin:50% 50%`;
      document.body.appendChild(fly);
      el.style.visibility = 'hidden';
      const box = canvas3d.getBoundingClientRect();
      const row = B ? B.backRow(320 + i * 118) : { x: .5, y: .42 + i * .07, h: .046 };
      const tx = box.left + row.x * box.width, ty = box.top + row.y * box.height;
      const k = (box.height * row.h) / (r.height / 1.25);              // printed size ÷ flying size
      const dx = tx - (r.left + r.width / 2), dy = ty - (r.top + r.height / 2);
      await anim(fly, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], 560, 'cubic-bezier(.55,0,.25,1)');
      const fade = anim(fly, [{ opacity: 1 }, { opacity: 0 }], 200, 'ease-out');
      if (B) await tween(200, t => { progress[i] = t; B.drawBack(['Aqua', 'Glycerin', 'Panthenol'], progress); draw3d(); });
      await fade; fly.remove();
      res();
    })));
    inci.style.visibility = 'hidden';
    await wait(80);

    // the bottle turns to face us and settles onto the stone as it rises into place
    anim(R('stone'), [{ opacity: 0, translate: '0 140px' }, { opacity: 1, translate: '0 0' }], 1200, EASE_OUT, 100);
    anim(R('bottle'), [{ translate: `0 ${LIFT}px` }, { translate: '0 0' }], 1300, EASE_IO, 80);
    anim($$('.bottle .el5, .bottle .el6, .bottle .ghost'), [{ opacity: 0 }, { opacity: 1 }], 700, EASE_OUT, 800);
    if (B) await tween(1300, t => { turn.rot = Math.PI + Math.PI * t; draw3d(); }, inOut);
    else await wait(1300);
    turn.rot = 0; draw3d();
  }

  async function intro() {
    anim(R('leaf'), [{ opacity: 0 }, { opacity: 1 }], 1200, EASE_OUT);
    await anim($('.inci-card'), [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], 600, EASE_OUT);
    await wait(350);
    await edit();
    // what is left turns NOVA olive
    await anim(keep, [{ color: getComputedStyle(list).color }, { color: getComputedStyle(document.body).getPropertyValue('--olive') || '#626d3a' }], 300, 'ease-out');
    relabel('NOVA serum');
    await gather();
    await wait(200);
    await toBottle();
    await hero();
    inci.remove();
    root.classList.remove('intro');
    introOver = true;
    if (B) enableHover();
  }

  if (reduce) { inci.remove(); root.classList.remove('intro'); bottleReady.then(b => { if (b) { show3d(); enableHover(); } }); return; }
  // the intro starts with text only: wait for the fonts (max 1.5 s), not for the hero images, which decode meanwhile
  $$('.stage img').forEach(img => img.decode && img.decode().catch(() => {}));
  Promise.race([document.fonts ? document.fonts.ready : null, wait(1500)]).then(intro);
})();
