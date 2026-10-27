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
  addEventListener('resize', fit);
  fit();

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
    const n0 = items.length, SPAN = 2300;
    let left = n0;
    await Promise.all(order.map((el, k) => {
      const delay = SPAN * Math.pow(k / order.length, 0.85);      // starts deliberate, speeds up
      const strike = el.querySelector('.strike');
      const a = anim(strike, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 240, EASE_OUT, delay);
      const b = anim(el, [{ opacity: 1 }, { opacity: 0 }], 320, 'ease-out', delay + 200);
      setTimeout(() => { count.textContent = --left; }, delay + 260);
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
    let x = box.left + (box.width - total) / 2;
    const y = box.top + box.height / 2;
    anim(seps, [{ opacity: 1 }, { opacity: 0 }], 300, 'ease-out');
    await Promise.all(keep.map((el, i) => {
      const r = rects[i], dx = x - r.left, dy = y - (r.top + r.height / 2);
      x += widths[i] + gap;
      return anim(el, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${K})` }], 1100, EASE_IO, i * 70);
    }));
  }

  async function relabel(text) {
    await anim(label, [{ opacity: 1 }, { opacity: 0 }], 260, 'ease-in');
    label.textContent = text;
    await anim(label, [{ opacity: 0 }, { opacity: 1 }], 360, 'ease-out');
  }

  /* ---------- the hero ---------- */
  async function hero() {
    const up = (els, ms, dy = 36, delay = 0) => anim(els, [{ opacity: 0, translate: `0 ${dy}px` }, { opacity: 1, translate: '0 0' }], ms, EASE_OUT, delay);
    const word = (k, delay) => { $(`[data-r=${k}]`).style.opacity = 1; return anim($(`[data-r=${k}] span`), [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], 1000, EASE_OUT, delay); };
    up(R('bottle'), 1300, 46);
    up(R('stone'), 1400, 120, 150);
    anim($$('.bottle .el5, .bottle .el6, .bottle .ghost'), [{ opacity: 0 }, { opacity: 1 }], 900, EASE_OUT, 700);
    anim(R('fade'), [{ opacity: 0 }, { opacity: 1 }], 1600, EASE_OUT, 300);
    word('w1', 450); word('w2', 590); word('w3', 730); word('w4', 870);
    up(R('logo').concat(R('nav'), R('icons')), 900, -16, 900);
    up(R('perks'), 900, 30, 1350); up(R('lead'), 900, 30, 1450); up(R('cta'), 900, 30, 1550);
    await up(R('socials'), 900, 30, 1650);
  }

  async function intro() {
    anim(R('leaf'), [{ opacity: 0 }, { opacity: 1 }], 1600, EASE_OUT);
    await anim($('.inci-card'), [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], 900, EASE_OUT);
    await wait(700);
    await edit();
    // what is left turns NOVA olive
    await anim(keep, [{ color: getComputedStyle(list).color }, { color: getComputedStyle(document.body).getPropertyValue('--olive') || '#626d3a' }], 450, 'ease-out');
    relabel('NOVA serum');
    await gather();
    await wait(1100);
    anim($('.inci-card'), [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -18px' }], 700, EASE_IO);
    await wait(380);
    await hero();
    inci.remove();
    root.classList.remove('intro');
  }

  if (reduce) { inci.remove(); root.classList.remove('intro'); return; }
  const decoded = $$('.stage img').map(img => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}));
  Promise.all([document.fonts ? document.fonts.ready : null, ...decoded]).then(intro);
})();
