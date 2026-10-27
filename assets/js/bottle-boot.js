// Starts the 3D bottle and hands it to intro.js (window.__novaBottle). Without WebGL the flat render stays.
import { createBottle } from './bottle3d.js';

const done = api => (window.__novaBottle ? window.__novaBottle(api) : (window.__novaBottleEarly = api));
try {
  const canvas = document.getElementById('b3d');
  if (!canvas || !('WebGL2RenderingContext' in window || 'WebGLRenderingContext' in window)) throw new Error('no WebGL');
  if (document.fonts) await Promise.all([document.fonts.load('400 92px Inter'), document.fonts.load('500 30px Inter')]).catch(() => {});
  const labelUrl = new URL('assets/img/label-front.png', document.baseURI).href;
  done(await createBottle(canvas, { labelUrl }));
} catch (e) {
  console.warn('NOVA: 3D bottle unavailable, keeping the flat render.', e);
  done(null);
}
