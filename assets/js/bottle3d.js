// NOVA bottle in three.js — modelled on the bottle render (bottle@3x.png, 1326×1989).
// 1 unit = 100 px of that render; y = 0 is the base. The camera frames it exactly like the render, so with
// rotation 0 the canvas lines up with the flat image it replaces.
import * as THREE from 'three';

export async function createBottle(canvas, { pixelRatio = Math.min(2, window.devicePixelRatio || 1), labelUrl } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // studio environment: a soft grey room with two tall softboxes, so glass and the cap pick up long vertical highlights
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), new THREE.MeshBasicMaterial({ color: 0xb4b5b0, side: THREE.BackSide })));
  const box = (w, h, az, el, dist, lum) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(lum, lum, lum), side: THREE.DoubleSide }));
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    m.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist); m.lookAt(0, 0, 0); studio.add(m);
  };
  box(7, 22, -48, 8, 14, 4.2);    // main softbox, front-left
  box(6, 18, 58, 6, 14, 2.2);     // weaker strip, front-right
  box(20, 6, 0, 70, 14, 1.4);     // overhead
  box(14, 10, 180, 10, 16, 0.9);  // behind, for the edges
  scene.environment = pmrem.fromScene(studio, 0.02).texture;

  // a large soft key from the front-left (as in the render: broad highlight on the left third), a weak fill from the right
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-7.4, 4.2, 6.7); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(6, 2, 7); scene.add(fill);
  const back = new THREE.DirectionalLight(0xffffff, 0.5); back.position.set(2, 8, -9); scene.add(back);
  scene.environmentIntensity = 1.0;

  // camera: framed like the bottle render (image box 1326×1989 → 13.26×19.89 units), seen slightly from above
  const camera = new THREE.PerspectiveCamera(15, 1326 / 1989, 1, 400);
  const target = new THREE.Vector3(0, 8.455, 0), d = (19.89 / 2) / Math.tan(THREE.MathUtils.degToRad(7.5)), el = THREE.MathUtils.degToRad(11);
  camera.position.set(0, target.y + d * Math.sin(el), d * Math.cos(el));
  camera.lookAt(target);

  const bottle = new THREE.Group(); scene.add(bottle);

  // --- glass body: lathe profile (radius, height) ---
  const R = 3.465;
  // fine grain of acid-etched glass
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const g = grain.getContext('2d'), img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const v = 236 + Math.random() * 19; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); }
  const grainTex = new THREE.CanvasTexture(grain); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.repeat.set(8, 6); grainTex.colorSpace = THREE.SRGBColorSpace;

  // frosted glass is darker where you look through more of it: towards the silhouette
  const edgeDarken = (k0, pow) => shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
      `float nv = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
       gl_FragColor.rgb *= mix(${k0.toFixed(2)}, 1.0, pow(nv, ${pow.toFixed(2)}));
       #include <dithering_fragment>`);
  };
  const frosted = new THREE.MeshPhysicalMaterial({
    color: 0xb8b7b1, map: grainTex, roughness: 0.4, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.35,
  });
  frosted.onBeforeCompile = edgeDarken(0.9, 0.6);
  const upperPts = [[R, 0.95], [R, 9.05]].map(([r, y]) => new THREE.Vector2(r, y));
  bottle.add(new THREE.Mesh(new THREE.LatheGeometry(upperPts, 128), frosted));
  // shoulder and neck are clearer, glossier glass
  const clearGlass = new THREE.MeshPhysicalMaterial({ color: 0xa9aba5, roughness: 0.22, metalness: 0, transparent: true, opacity: 0.86, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 0.55 });
  clearGlass.onBeforeCompile = edgeDarken(0.62, 0.45);
  const shoulderPts = [[R, 9.05], [R, 9.12], [3.42, 9.32], [3.25, 9.5], [2.85, 9.72], [2.35, 9.86], [2.06, 9.95], [2.0, 10.0], [2.0, 10.1], [0, 10.1]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  bottle.add(new THREE.Mesh(new THREE.LatheGeometry(shoulderPts, 128), clearGlass));
  // thick clear-ish base, as on the render
  const baseMat = new THREE.MeshPhysicalMaterial({ color: 0xb3b5af, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.84, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 0.6 });
  baseMat.onBeforeCompile = edgeDarken(0.6, 0.45);
  // the frosted chamber's floor, seen through the clear base
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.2, R - 0.24, 0.06, 96), frosted);
  floor.position.y = 0.92; bottle.add(floor);
  const basePts = [[0, -0.15], [R - 0.3, -0.15], [R - 0.1, -0.1], [R - 0.01, 0.05], [R, 0.25], [R, 0.95]].map(([r, y]) => new THREE.Vector2(r, y));
  bottle.add(new THREE.Mesh(new THREE.LatheGeometry(basePts, 128), baseMat));

  // clear glass neck under the cap
  // clear glass neck with its screw thread, seen as fine horizontal lines
  const thread = document.createElement('canvas'); thread.width = 8; thread.height = 64;
  { const g = thread.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 64);
    [[0, '#d9dbd5'], [.18, '#f6f7f3'], [.3, '#b9bcb4'], [.5, '#eef0ea'], [.62, '#c2c5bd'], [.8, '#f3f4ef'], [1, '#cfd1ca']].forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.fillRect(0, 0, 8, 64); }
  const threadTex = new THREE.CanvasTexture(thread); threadTex.colorSpace = THREE.SRGBColorSpace;
  const neckMat = new THREE.MeshPhysicalMaterial({ map: threadTex, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.08 });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.02, 0.7, 96, 1, true), neckMat);
  neck.position.y = 10.4; bottle.add(neck);

  // faceted olive collar
  const collarMat = new THREE.MeshPhysicalMaterial({ color: 0x4f5639, roughness: 0.28, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.16, flatShading: true });
  const collarTop = new THREE.MeshStandardMaterial({ color: 0x4a5136, roughness: 0.45, envMapIntensity: 0.55 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.315, 2.315, 2.61, 22, 1), [collarMat, collarTop, collarTop]);
  collar.position.y = 10.69 + 1.305; bottle.add(collar);

  // rubber bulb
  const bulbPts = [[1.27, 0], [1.21, 0.25], [1.16, 0.5], [1.12, 0.75], [1.11, 1.0], [1.11, 2.55], [1.07, 2.95], [0.98, 3.2], [0.8, 3.45], [0.45, 3.68], [0, 3.76]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const bulb = new THREE.Mesh(new THREE.LatheGeometry(bulbPts, 96), new THREE.MeshPhysicalMaterial({ color: 0xc6c4bf, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5 }));
  bulb.position.y = 13.30; bottle.add(bulb);

  // --- printed label: front arc of 150°, rows 1000…1700 of the render ---
  const loader = new THREE.TextureLoader();
  const labelTex = await loader.loadAsync(labelUrl);
  labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = 8;
  const labelMat = new THREE.MeshPhysicalMaterial({ map: labelTex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  // rows map to heights on the axis; the printed surface sits R in front of it, so it projects R·sin(el) lower
  const lh = 7.0, ly = (1840 - 1700) / 100 + R * Math.sin(el);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, lh, 128, 1, true, THREE.MathUtils.degToRad(-75), THREE.MathUtils.degToRad(150)), labelMat);
  label.position.y = ly + lh / 2; bottle.add(label);

  // --- the back: three ingredients printed in a column (120° arc around the back) ---
  const backCanvas = document.createElement('canvas'); backCanvas.width = 720; backCanvas.height = 700;
  const backTex = new THREE.CanvasTexture(backCanvas); backTex.colorSpace = THREE.SRGBColorSpace; backTex.anisotropy = 8;
  function drawBack(names = ['Aqua', 'Glycerin', 'Panthenol'], progress = [1, 1, 1]) {
    const g = backCanvas.getContext('2d'); g.clearRect(0, 0, 720, 700);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(84,96,58,.9)';
    g.font = '500 30px Inter, "Helvetica Neue", Arial, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.globalAlpha = Math.min(1, progress[0] * 1.5);
    g.fillText('INGREDIENTS', 360, 205);
    if ('letterSpacing' in g) g.letterSpacing = '-2px';
    g.font = '400 92px Inter, "Helvetica Neue", Arial, sans-serif';
    names.forEach((n, i) => { g.globalAlpha = progress[i]; g.fillText(n, 360, 320 + i * 118); });
    g.globalAlpha = 1; backTex.needsUpdate = true;
  }
  drawBack();
  const backMat = new THREE.MeshPhysicalMaterial({ map: backTex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const backLabel = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, lh, 128, 1, true, THREE.MathUtils.degToRad(120), THREE.MathUtils.degToRad(120)), backMat);
  backLabel.position.y = ly + lh / 2; bottle.add(backLabel);

  function resize(w, h, ratio = pixelRatio) { renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function render() { renderer.render(scene, camera); }
  // where a row of the back print lands on the canvas (0…1 of its box) when the back faces the camera
  function backRow(texY) {
    const v = new THREE.Vector3(0, ly + lh * (1 - texY / 700), -(R + 0.004));
    const saved = bottle.rotation.y; bottle.rotation.y = Math.PI; bottle.updateMatrixWorld();
    v.applyMatrix4(bottle.matrixWorld).project(camera);
    bottle.rotation.y = saved; bottle.updateMatrixWorld();
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, h: (lh * 92 / 700) / 19.89 };   // h: cap-to-descender of a 92px line, as a share of the box height
  }
  return { renderer, scene, camera, bottle, drawBack, backRow, resize, render, dispose: () => renderer.dispose() };
}
