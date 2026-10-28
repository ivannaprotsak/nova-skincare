// Starts the 3D bottle and hands it to intro.js (window.__novaBottle). Without WebGL the flat render stays.

const done = api => (window.__novaBottle ? window.__novaBottle(api) : (window.__novaBottleEarly = api));
try {
  const canvas = document.getElementById('b3d');
  if (!canvas || !('WebGL2RenderingContext' in window || 'WebGLRenderingContext' in window)) throw new Error('no WebGL');
  // wait until the page is idle, so the 3D library doesn't compete with the fonts and images of the first screen
  await new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 600)));
  if (document.fonts) await Promise.all([document.fonts.load('400 92px Inter'), document.fonts.load('500 30px Inter')]).catch(() => {});
  const labelUrl = new URL('assets/img/label-front.webp', document.baseURI).href;
  const { createBottle } = await import('./bottle3d.js?v=20261028d');   // three.js loads here, not with the page
  done(await createBottle(canvas, { labelUrl, pixelRatio: Math.min(1.5, window.devicePixelRatio || 1) }));
} catch (e) {
  console.warn('NOVA: 3D bottle unavailable, keeping the flat render.', e);
  done(null);
}
