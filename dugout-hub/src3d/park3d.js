// Dugout Hub · shared 3D ballpark and ballplayers for the 3D games (Strikeout King, Steal Second, Outfield Hero).
// Units are feet: home plate at the origin, center field toward -z.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
export { THREE };

// Ballplayers: one rigged kid (MakeHuman CC0 body) with real motion-capture swing, pitch and run (CMU mocap, free for all uses).
export let GLB = null;
export const ready = /nohuman/.test(location.search) ? Promise.resolve() : Promise.race([
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('./player.glb', import.meta.url).href).then(g => { GLB = g; }),
  new Promise(r => setTimeout(r, 20000))]).catch(() => {});

export const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const fence = a => 200 + 25 * Math.cos(clamp(a / 45, -1, 1) * Math.PI / 2);
export const D2R = Math.PI / 180, BASE = 46, FT = 3.2808;
export const ORANGE = 0xee7f24, GREEN = 0x1d6a3b, BLUE = 0x1f3f7a, GOLD = 0xf2c230;
export const font = (w, px) => w + ' ' + px + 'px "Barlow Condensed", Arial Narrow, sans-serif';
// base positions (feet): 1st, 2nd, 3rd, home
export const BASES = [null, [BASE, -BASE], [0, -2 * BASE], [-BASE, -BASE], [0, 0]];

// ---- motion measurements, done once ----
let CLIPS = null, CAL = null;
function calibrate() {
  if (CAL || !GLB) return;
  CLIPS = {}; GLB.animations.forEach(a => { CLIPS[a.name] = a; });
  const cal = skClone(GLB.scene), mx = new THREE.AnimationMixer(cal), B = {}; cal.traverse(o => { if (o.isBone) B[o.name] = o; });
  const at = (name, t) => { mx.stopAllAction(); mx.clipAction(CLIPS[name]).play(); mx.setTime(t); cal.updateMatrixWorld(true); };
  const wp = n => B[n].getWorldPosition(new THREE.Vector3());
  const feet = () => { let m = 1e9; for (const n in B) if (/^(toe|foot)/.test(n)) m = Math.min(m, wp(n).y); return m - 0.025; };
  const lowest = () => { let m = 1e9; for (const n in B) m = Math.min(m, wp(n).y); return m - 0.07; };
  const fastest = (name, a, b) => { let best = a, bs = -1, prev = null; for (let t = a; t <= b; t += 1 / 60) { at(name, t); const p = wp('wristR'); if (prev) { const s = p.distanceTo(prev); if (s > bs) { bs = s; best = t; } } prev = p; } return best; };
  const yawOf = (d, mir) => Math.PI - Math.atan2(d.x * mir, d.z);
  CAL = {};
  const one = (name, t0, t1, extra) => { if (!CLIPS[name]) return; at(name, t0); const h0 = wp('root'), g = -feet(); at(name, t1); const d = wp('root').sub(h0); d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1); CAL[name] = Object.assign({ yaw: yawOf(d, 1), yawM: yawOf(d, -1), g }, extra || {}); };
  const tc = fastest('swing', 0.55, 1.2), tr = fastest('pitch', 0.5, 1.8);
  one('swing', 0, tc, { tc }); one('pitch', 0, Math.min(CLIPS.pitch.duration - 0.01, tr + 0.25), { tr }); one('run', 0, CLIPS.run.duration - 0.01);
  for (const n of ['ready', 'crouch', 'ump', 'catch', 'slide', 'dive']) if (CLIPS[n]) { at(n, 0); CAL[n] = { yaw: Math.PI, yawM: Math.PI, g: -(n === 'slide' || n === 'dive' ? lowest() : feet()) }; }
  let mn = 1e9; for (let t = 0; t < CLIPS.run.duration; t += 1 / 30) { at('run', t); mn = Math.min(mn, feet()); } CAL.run.g = -mn;
  const tk = CLIPS.run.tracks.find(t => /^root\.position$/.test(t.name));
  if (tk && !tk.flat) { const v = tk.values, n = v.length / 3; for (const c of [0, 2]) { const a = v[c], b = v[(n - 1) * 3 + c]; for (let i = 0; i < n; i++) v[i * 3 + c] -= a + (b - a) * i / (n - 1); } tk.flat = true; }
}

/* Build the park, renderer, camera, players and the game loop. cfg: { stage, me, hudHTML, shadow: {x, z, w, h}, cam: {fov} } */
export function world(cfg) {
  calibrate();
  if (!GLB) throw new Error('nomodel');
  const { stage, me } = cfg;
  const wrap = document.createElement('div'); wrap.className = 'd3';
  const hud = document.createElement('div'); hud.className = 'd3hud'; hud.innerHTML = cfg.hudHTML || '';
  stage.replaceChildren(wrap); wrap.appendChild(hud);
  const $ = id => hud.querySelector('#' + id);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { throw new Error('nogl'); }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.insertBefore(renderer.domElement, hud);
  const cv = renderer.domElement; cv.className = 'd3cv'; cv.tabIndex = 0;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x1a2440, 500, 1300);
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35; pm.dispose(); }
  const cam = new THREE.PerspectiveCamera(45, 1, 0.5, 3000);

  const canvasTex = (w, h, draw, repeat) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.userData.canvas = c; return t; };
  const toon = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0 }, extra || {}));

  // sky + stars
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: canvasTex(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#03060f'); gr.addColorStop(0.38, '#0b1630'); gr.addColorStop(0.47, '#1d2c4f'); gr.addColorStop(0.5, '#4a4a5a'); gr.addColorStop(0.53, '#1a1a22'); gr.addColorStop(1, '#050505');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); }) })));
  { const n = 300, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = rnd(0.25, 1.3); p.set([Math.cos(a) * Math.cos(e) * 2000, Math.sin(e) * 2000, Math.sin(a) * Math.cos(e) * 2000], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 }))); }

  // lights; the sun's shadow box follows the action
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x2f4a28, 0.9));
  const sun = new THREE.DirectionalLight(0xfffaf0, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
  const shadowAt = (x, z, r) => { sun.position.set(x + 40, 90, z + 45); sun.target.position.set(x, 0, z); Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 10, far: 260 }); sun.shadow.camera.updateProjectionMatrix(); };
  const sh = cfg.shadow || { x: 0, z: -20, r: 70 }; shadowAt(sh.x, sh.z, sh.r);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.9); fill.position.set(-70, 60, -60); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(0, 50, -200); scene.add(rim);

  // field
  const FIELD = 560;
  const fieldTex = canvasTex(2048, 2048, (g, W, H) => {
    const s = W / FIELD, X = x => W / 2 + x * s, Z = z => H * 0.9 + z * s;
    g.fillStyle = '#2f7a33'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 44; i++) if (i % 2 === 0) { g.fillStyle = 'rgba(255,255,255,.075)'; g.fillRect(0, Z(-i * 14 - 14), W, 14 * s); }
    for (let i = -24; i < 24; i++) if (i % 2 === 0) { g.fillStyle = 'rgba(0,0,0,.03)'; g.fillRect(X(i * 14), 0, 14 * s, H); }
    for (let i = 0; i < 60000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    g.beginPath(); for (let a = -46; a <= 46; a += 1) { const t = a * D2R, d = fence(a) + 6; g.lineTo(X(Math.sin(t) * d), Z(-Math.cos(t) * d)); }
    for (let a = 46; a >= -46; a -= 1) { const t = a * D2R, d = fence(a) - 11; g.lineTo(X(Math.sin(t) * d), Z(-Math.cos(t) * d)); } g.closePath(); g.fillStyle = '#9a6a43'; g.fill();
    g.fillStyle = '#b98454'; g.beginPath(); g.moveTo(X(0), Z(6)); for (let a = -48; a <= 48; a += 1) { const t = a * D2R; g.lineTo(X(Math.sin(t) * 98), Z(-Math.cos(t) * 98)); } g.closePath(); g.fill();
    g.fillStyle = '#2f7a33'; g.beginPath(); g.moveTo(X(0), Z(-10)); g.lineTo(X(BASE - 8), Z(-BASE)); g.lineTo(X(0), Z(-2 * BASE + 10)); g.lineTo(X(-BASE + 8), Z(-BASE)); g.closePath(); g.fill();
    for (let i = 0; i < 18000; i++) { const x = rnd(-100, 100), z = rnd(-100, 8); g.fillStyle = 'rgba(80,45,20,.12)'; g.fillRect(X(x), Z(z), 2, 2); }
    g.fillStyle = '#c4905d'; g.beginPath(); g.arc(X(0), Z(-BASE), 7 * s, 0, 7); g.fill();
    g.strokeStyle = '#f4f4f0'; g.lineWidth = Math.max(2, 0.45 * s);
    for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(X(0), Z(0)); g.lineTo(X(sg * 160), Z(-160)); g.stroke(); }
    g.fillStyle = '#ffffff'; g.fillRect(X(-1), Z(-BASE) - 0.2 * s, 2 * s, 0.5 * s);
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FIELD, FIELD), new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -FIELD * 0.4); scene.add(ground);
  const homeTex = canvasTex(1024, 1024, (g, W, H) => {
    const s = W / 40, X = x => W / 2 + x * s, Z = z => H / 2 + z * s;
    const rg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); rg.addColorStop(0, '#c08b58'); rg.addColorStop(0.62, '#b4804f'); rg.addColorStop(0.63, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const a = Math.random() * 7, r = Math.random() * W * 0.3; g.fillStyle = Math.random() < 0.5 ? 'rgba(70,40,15,.18)' : 'rgba(255,230,190,.12)'; g.fillRect(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 2, 2); }
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 0.28 * s;
    for (const sg of [-1, 1]) g.strokeRect(X(sg > 0 ? 1.2 : -4.2), Z(-3), 3 * s, 6 * s);
    g.beginPath(); g.moveTo(X(-1.4), Z(3)); g.lineTo(X(-1.4), Z(9)); g.lineTo(X(1.4), Z(9)); g.lineTo(X(1.4), Z(3)); g.stroke();
    g.fillStyle = '#fbfbf7'; g.beginPath(); g.moveTo(X(-0.71), Z(-0.71)); g.lineTo(X(0.71), Z(-0.71)); g.lineTo(X(0.71), Z(0)); g.lineTo(X(0), Z(0.71)); g.lineTo(X(-0.71), Z(0)); g.closePath(); g.fill();
  });
  const homeArea = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ map: homeTex, transparent: true }));
  homeArea.rotation.x = -Math.PI / 2; homeArea.position.set(0, 0.03, 0); homeArea.receiveShadow = true; scene.add(homeArea);
  // shadow catcher over the area where the action is
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShadowMaterial({ opacity: 0.32 })); shadowDisc.rotation.x = -Math.PI / 2; shadowDisc.receiveShadow = true; scene.add(shadowDisc);
  const setShadowArea = (x, z, r) => { shadowDisc.position.set(x, 0.06, z); shadowDisc.scale.setScalar(r); shadowAt(x, z, r); };
  setShadowArea(sh.x, sh.z, sh.r);
  const mound = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xc4905d })); mound.scale.y = 0.08; mound.position.set(0, 0, -BASE); mound.receiveShadow = true; scene.add(mound);
  // the bases themselves (raised white bags)
  const bagMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  for (const i of [1, 2, 3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.25, 1.25), bagMat); b.position.set(BASES[i][0], 0.12, BASES[i][1]); b.rotation.y = Math.PI / 4; b.castShadow = true; scene.add(b); }

  // fence + signs + poles
  {
    const pts = [], N = 92; for (let i = 0; i <= N; i++) { const a = -46 + 92 * i / N; pts.push([Math.sin(a * D2R) * fence(a), -Math.cos(a * D2R) * fence(a)]); }
    const wall = (h0, h1, col) => { const pos = [], idx = []; pts.forEach(([x, z], i) => { pos.push(x, h0, z, x, h1, z); if (i) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, toon(col, { side: THREE.DoubleSide })); scene.add(m); };
    wall(0, 8, 0x174d2c); wall(8, 8.8, 0xffd23f);
    const sign = (txt, a, w, bg, fg) => { const t = canvasTex(256, 128, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.font = font(800, 92); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, W / 2, H / 2 + 4); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshBasicMaterial({ map: t, transparent: bg === 'transparent' })); const d = fence(a) - 0.3; m.position.set(Math.sin(a * D2R) * d, 4, -Math.cos(a * D2R) * d); m.lookAt(0, 4, 0); scene.add(m); };
    [-44, -22, 0, 22, 44].forEach(a => sign(String(Math.round(fence(a))), a, 12, 'transparent', '#ffffff'));
    [-33, -11, 11, 33].forEach((a, i) => sign(i % 2 ? 'SPITTERS' : '#' + me.num, a, 16, i % 2 ? '#161616' : '#f28c38', i % 2 ? '#f28c38' : '#161616'));
    for (const sg of [-1, 1]) { const d = fence(46 * sg); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 48, 8), toon(0xffd23f)); pole.position.set(Math.sin(46 * sg * D2R) * d, 24, -Math.cos(46 * sg * D2R) * d); scene.add(pole); }
  }

  // stands, crowd, light towers
  const crowd = (() => {
    const tiers = 9, per = 210, n = tiers * per, mat = new THREE.MeshLambertMaterial();
    const bodyG = new THREE.BoxGeometry(1.5, 1.7, 1.0); bodyG.translate(0, -0.2, 0);
    const inst = new THREE.InstancedMesh(bodyG, mat, n), heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.62, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    const base = [], col = new THREE.Color(), m4 = new THREE.Matrix4();
    const COL = [0xf28c38, 0xf28c38, 0x1d6a3b, 0x161616, 0xffffff, 0xd15d0a, 0xffd23f, 0x4a90d9, 0xe04f5f, 0x7bc96f, 0xffffff], SKIN = [0xf0c8a0, 0xd9a47a, 0xa36b45, 0x6e4529, 0xf5d6b8];
    let i = 0;
    for (let t = 0; t < tiers; t++) for (let k = 0; k < per; k++) {
      const a = -56 + 112 * (k + Math.random() * 0.6) / per, d = fence(clamp(a, -45, 45)) + 16 + t * 7, y = 6 + t * 4.6 + 1.6;
      const x = Math.sin(a * D2R) * d, z = -Math.cos(a * D2R) * d; base.push([x, y, z, Math.random() * 6.28, a]);
      m4.makeTranslation(x, y, z); inst.setMatrixAt(i, m4); m4.makeTranslation(x, y + 1.3, z); heads.setMatrixAt(i, m4);
      col.setHex(pick(COL)); inst.setColorAt(i, col); col.setHex(pick(SKIN)); heads.setColorAt(i, col); i++;
    }
    scene.add(heads, inst);
    for (let t = 0; t < tiers; t++) { const pos = [], idx = [], N = 60; for (let j = 0; j <= N; j++) { const a = -58 + 116 * j / N, d0 = fence(clamp(a, -45, 45)) + 12 + t * 7, d1 = d0 + 7, y = 4 + t * 4.6;
        const s = Math.sin(a * D2R), c = Math.cos(a * D2R); pos.push(s * d0, y, -c * d0, s * d1, y, -c * d1, s * d1, y + 4.6, -c * d1); if (j) { const b = j * 3; idx.push(b - 3, b - 2, b, b - 2, b + 1, b, b - 2, b - 1, b + 1, b - 1, b + 2, b + 1); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: t % 2 ? 0x2a2f3a : 0x323846, side: THREE.DoubleSide }))); }
    let wave = 0;
    return { cheer: v => { wave = Math.max(wave, v); }, update: (t, dt) => { wave = Math.max(0, wave - dt * 0.3);
      for (let j = 0; j < n; j++) { const [x, y, z, ph, a] = base[j]; const w = wave > 0 ? Math.max(0, Math.sin(t * 6 - a * 0.12)) * 2.4 * wave : 0; const bob = Math.sin(t * 2 + ph) * 0.15 + w; m4.makeTranslation(x, y + bob, z); inst.setMatrixAt(j, m4); m4.makeTranslation(x, y + 1.3 + bob, z); heads.setMatrixAt(j, m4); }
      inst.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; } };
  })();
  // grandstand behind home plate (seen from the mound and from first base)
  const crowd2 = (() => {
    const tiers = 8, per = 200, n = tiers * per, inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.05, 1.25, 0.8), new THREE.MeshLambertMaterial(), n), heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    const COL = [0xd9772a, 0x1d5a33, 0x202020, 0xbfbfbf, 0x2c4a7a, 0x8a2a35, 0x3d6b37, 0x5a5a66, 0xd9772a, 0x6b4a2a], SKIN = [0xf0c8a0, 0xd9a47a, 0xa36b45, 0x6e4529, 0xf5d6b8], m4 = new THREE.Matrix4(), col = new THREE.Color(); let i = 0;
    for (let t = 0; t < tiers; t++) for (let k = 0; k < per; k++) { const b = (-78 + 156 * (k + Math.random() * 0.6) / per) * D2R, d = 104 + t * 6, y = 13 + t * 4.2;
      m4.makeTranslation(Math.sin(b) * d, y, Math.cos(b) * d - 8); inst.setMatrixAt(i, m4); m4.makeTranslation(Math.sin(b) * d + (Math.random() - 0.5) * 0.6, y + 0.95 + Math.random() * 0.25, Math.cos(b) * d - 8); heads.setMatrixAt(i, m4);
      col.setHex(pick(COL)); inst.setColorAt(i, col); col.setHex(pick(SKIN)); heads.setColorAt(i, col); i++; }
    scene.add(inst, heads);
    for (let t = 0; t < tiers; t++) { const pos = [], idx = [], N = 40; for (let j = 0; j <= N; j++) { const b = (-80 + 160 * j / N) * D2R, d0 = 101 + t * 6, d1 = d0 + 6, y = 11 + t * 4.2;
        pos.push(Math.sin(b) * d0, y, Math.cos(b) * d0 - 8, Math.sin(b) * d1, y, Math.cos(b) * d1 - 8, Math.sin(b) * d1, y + 4.2, Math.cos(b) * d1 - 8); if (j) { const q = j * 3; idx.push(q - 3, q - 2, q, q - 2, q + 1, q, q - 2, q - 1, q + 1, q - 1, q + 2, q + 1); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: t % 2 ? 0x2a2f3a : 0x323846, side: THREE.DoubleSide }))); }
    const wallG = new THREE.CylinderGeometry(100, 100, 16, 48, 1, true, -80 * D2R, 160 * D2R); const wallTex = canvasTex(4096, 256, (g, W, H) => { g.fillStyle = '#123f26'; g.fillRect(0, 0, W, H); g.fillStyle = '#f28c38'; g.fillRect(0, 0, W, 12); g.fillRect(0, H - 12, W, 12);
      g.textAlign = 'center'; g.textBaseline = 'middle'; const words = ['SEED SPITTERS', '#' + me.num, 'GO SPITTERS', 'SPITTERS PARK'];
      for (let i = 0; i < 8; i++) { g.font = font(800, 84); g.fillStyle = i % 2 ? '#ffd23f' : '#ffffff'; g.fillText(words[i % 4], W * (i + 0.5) / 8, H / 2 + 4); } });
    wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.x = -1;
    const wall = new THREE.Mesh(wallG, new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, side: THREE.DoubleSide })); wall.position.set(0, 8, -8); scene.add(wall);
  })();
  const glowTex = canvasTex(128, 128, (g, W) => { const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); r.addColorStop(0, 'rgba(255,250,225,1)'); r.addColorStop(0.25, 'rgba(255,240,200,.55)'); r.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = r; g.fillRect(0, 0, W, W); });
  for (const a of [-62, -25, 25, 62]) { const d = fence(clamp(a, -45, 45)) + 80, x = Math.sin(a * D2R) * d, z = -Math.cos(a * D2R) * d;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 110, 8), toon(0x9aa3b5)); pole.position.set(x, 55, z); scene.add(pole);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 2), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); bank.position.set(x, 112, z); bank.lookAt(0, 0, 0); scene.add(bank);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.set(130, 130, 1); glow.position.set(x, 112, z); scene.add(glow); }
  // scoreboard: lines = [[text, px, color], ...]
  const board = canvasTex(1024, 384, () => {});
  const drawBoard = (lines) => { const g = board.userData.canvas.getContext('2d'), W = 1024, H = 384;
    g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f28c38'; g.lineWidth = 12; g.strokeRect(6, 6, W - 12, H - 12);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f28c38'; g.font = font(800, 64); g.fillText('SEED SPITTERS PARK', W / 2, 62);
    const ys = lines.length === 1 ? [230] : [200, 315]; lines.forEach(([t, px, c], i) => { g.font = font(800, px); g.fillStyle = c || '#fff'; g.fillText(t, W / 2, ys[i] || 300); });
    board.needsUpdate = true; };
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(96, 36), new THREE.MeshBasicMaterial({ map: board, fog: false })); m.position.set(0, 78, -fence(0) - 62); scene.add(m);
    const f = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 3), toon(0x1d1d1d)); f.position.set(0, 78, -fence(0) - 63.8); scene.add(f);
    const l = new THREE.Mesh(new THREE.BoxGeometry(6, 70, 3), toon(0x1d1d1d)); l.position.set(0, 35, -fence(0) - 64); scene.add(l); }

  /* ---------- ballplayers ---------- */
  const SKINS = [0xe8b48f, 0xd49a72, 0xa8714d, 0xf0c8a5, 0x8a5a3c];
  const lettering = (L, flip) => canvasTex(512, 512, (g, W) => {
    if (flip) { g.translate(W, 0); g.scale(-1, 1); }
    g.fillStyle = L.bg; g.fillRect(0, 0, W, W); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    if (L.name) { g.font = font(800, 78); g.fillStyle = L.fg; g.fillText(L.name, W / 2, 118); }
    if (L.num) { g.font = font(800, 330); g.lineWidth = 18; g.strokeStyle = L.edge; g.strokeText(L.num, W / 2, 430); g.fillStyle = L.fg; g.fillText(L.num, W / 2, 430); }
    if (L.script) { g.save(); g.translate(W / 2, W / 2 + 20); g.scale(1, 2.1); g.font = 'italic 800 132px "Barlow Condensed", Arial Narrow, sans-serif'; g.lineWidth = 12; g.strokeStyle = L.edge; g.strokeText(L.script, 0, 20); g.fillStyle = L.fg; g.fillText(L.script, 0, 20); g.restore(); }
  });
  let T = 0;
  // o: { mirror, size, lod, helmet, cap, glove, skin, hair, colors: {jersey, sleeve, pants, socks, belt, helmet, cap}, letters: {bg, fg, edge, num, name, script} }
  function human(o) {
    const root = new THREE.Group(), turn = new THREE.Group(), inner = new THREE.Group(), model = skClone(GLB.scene); root.add(turn); turn.add(inner); inner.add(model);
    const mir = o.mirror ? -1 : 1, sc = FT * (o.size || 1); inner.scale.set(sc * mir, sc, sc);
    const parts = {}; model.traverse(b => { if (b.isBone) parts[b.name] = b; }); parts.handR = parts.wristR; parts.handL = parts.wristL;
    const col = Object.assign({ skin: o.skin || pick(SKINS), hair: o.hair || pick([0x2a1a0e, 0x4a2e18, 0x111111, 0x6b4a2a]), shoes: 0x121212, glove: 0x6b3a16 }, o.colors);
    model.traverse(m => {
      if (!m.isMesh) return;
      m.frustumCulled = false; m.castShadow = !o.lod; m.receiveShadow = false;
      const mm = m.material.clone(); m.material = mm; const k = mm.name;
      if (col[k] != null) mm.color.setHex(col[k]);
      if (k === 'helmet') { mm.roughness = o.finish ? o.finish.r : 0.22; mm.metalness = o.finish ? o.finish.m : 0.1; }
      const nm = m.name || (m.parent && m.parent.name) || '';
      if (o.lod && /^(eye|brow|lip|backnumber|chestscript)$/.test(k)) { m.visible = false; return; }
      if (/^Helmet/.test(nm)) m.visible = !!o.helmet; if (/^Cap/.test(nm)) m.visible = !o.helmet && o.cap !== false; if (/^Glove/.test(nm)) m.visible = !!o.glove;
      if (/^(BackNumber|ChestScript)/.test(nm)) {
        const back = /^Back/.test(nm), L = o.letters;
        if (!L || (!back && !L.script)) { mm.color.setHex(col.jersey); return; }
        mm.color.setHex(0xffffff); mm.map = lettering(back ? { bg: L.bg, fg: L.fg, edge: L.edge, num: L.num, name: L.name } : { bg: L.bg, fg: L.fg, edge: L.edge, script: L.script }, back ? mir > 0 : mir < 0);
        mm.map.flipY = false;
      }
    });
    const mixer = new THREE.AnimationMixer(model); let cur = null;
    const set = (name, t) => { const c = CLIPS[name]; if (!c) return;
      if (cur !== name) { mixer.stopAllAction(); mixer.clipAction(c).play(); cur = name; inner.rotation.y = mir < 0 ? CAL[name].yawM : CAL[name].yaw; inner.position.y = CAL[name].g * sc; }
      mixer.setTime(name === 'run' ? t % c.duration : clamp(t, 0, c.duration - 0.001)); };
    // face a point on the ground (root -z toward it)
    const face = (x, z) => { root.rotation.y = Math.atan2(-(x - root.position.x), -(z - root.position.z)); };
    return { h: true, root, turn, inner, parts, set, face, mir, get clip() { return cur; } };
  }
  // the bat, gripped in both hands and fixed to the top hand
  const makeBat = (color) => { const pts = []; for (let i = 0; i <= 16; i++) { const y = i / 16 * 2.45, r = i < 2 ? 0.07 : y < 1.0 ? 0.055 : Math.min(0.13, 0.055 + (y - 1.0) * 0.06); pts.push(new THREE.Vector2(i === 16 ? 0.0 : r, y)); }
    pts.unshift(new THREE.Vector2(0, -0.02)); const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), toon(color || 0xd9a65e, { roughness: color === 0xd4af37 ? 0.3 : 0.45, metalness: color === 0xd4af37 ? 0.6 : 0 })); m.castShadow = true;
    const tape = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.6, 12), toon(0x161616)); tape.position.y = 0.4; m.add(tape); scene.add(m); return m; };
  const tmpG = new THREE.Vector3(), AX1 = new THREE.Vector3(1, 0, 0), UPV = new THREE.Vector3(0, 1, 0);
  const placeBat = (p, bat) => { p.root.updateMatrixWorld(true); const kn = b => { const ch = b.children.find(c => c.isBone); return (ch || b).getWorldPosition(tmpG); };
    bat.position.copy(kn(p.parts.wristL)); bat.position.add(kn(p.parts.wristR)).multiplyScalar(0.5);
    const d = AX1.clone().transformDirection(p.parts.wristR.matrixWorld); bat.quaternion.setFromUnitVectors(UPV, d); bat.position.addScaledVector(d, -0.3); return d; };
  // put a batter in the box so the sweet spot meets the ball over the plate
  const standInBox = (p, bat) => { p.root.position.set(0, 0, 0); p.set('swing', CAL.swing.tc); const d = placeBat(p, bat); const sw = bat.position.clone().addScaledVector(d, 1.95);
    p.root.position.x -= sw.x; p.root.position.z += -0.5 - sw.z; p.set('swing', 0); placeBat(p, bat); };
  // where the throwing hand is
  const handPos = (p, out) => { p.root.updateMatrixWorld(true); return (p.mir < 0 ? p.parts.wristL : p.parts.wristR).getWorldPosition(out); };
  const gloveHand = (p, out) => { p.root.updateMatrixWorld(true); return (p.mir < 0 ? p.parts.wristR : p.parts.wristL).getWorldPosition(out); };

  // baseball
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })); ball.castShadow = true; ball.visible = false; scene.add(ball);
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); ballGlow.scale.setScalar(1.4); ball.add(ballGlow);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); ballShadow.rotation.x = -Math.PI / 2; ballShadow.visible = false; scene.add(ballShadow);
  // flat ring on the ground or in the air (always drawn on top)
  const ring = (r0, r1, color, opacity, flat) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity == null ? 1 : opacity, depthTest: false, side: THREE.DoubleSide })); m.renderOrder = 12; if (flat) m.rotation.x = -Math.PI / 2; scene.add(m); return m; };

  // HUD helpers
  let call = null;
  const callout = (main, sub, cls, dur) => { const c = $('d3-call'); if (!c) return; c.className = 'd3call js ' + (cls || ''); c.innerHTML = '<b>' + main + '</b>' + (sub ? '<span>' + sub + '</span>' : ''); call = { t0: T, dur: dur || 1.8 }; };
  const callFrame = () => { const c = $('d3-call'); if (!c) return; if (!call) { c.style.opacity = 0; return; } const k = (T - call.t0) / call.dur; if (k >= 1) { call = null; c.style.opacity = 0; return; }
    const s = k < 0.12 ? lerp(0.3, 1.08, k / 0.12) : k < 0.2 ? lerp(1.08, 1, (k - 0.12) / 0.08) : 1, op = k < 0.08 ? k / 0.08 : k > 0.8 ? (1 - k) / 0.2 : 1; c.style.opacity = op; c.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; };
  const toScreen = (v, out) => { const p = v.clone().project(cam), r = cv.getBoundingClientRect(), w = wrap.getBoundingClientRect(); out = out || {}; out.x = (p.x + 1) / 2 * r.width + r.left - w.left; out.y = (1 - p.y) / 2 * r.height + r.top - w.top; out.behind = p.z > 1; return out; };
  // screen point -> spot on a plane
  const ray = new THREE.Raycaster();
  const toPlane = (cx, cy, plane) => { const r = cv.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), cam); const o = new THREE.Vector3(); return ray.ray.intersectPlane(plane, o) ? o : null; };

  // sizing
  const fit = () => { const r = wrap.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; if (cfg.fov) cam.fov = cfg.fov(cam.aspect); cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(fit); ro.observe(wrap); const AQ = autoQuality(renderer, sun, fit);

  // main loop: tick(dt, T); test hooks: ?d3test fixed steps, ?d3rec manual frames
  const FIXED = /d3test|d3rec/.test(location.search) ? 1 / 30 : 0, MANUAL = /d3rec/.test(location.search), FAST = /d3fast/.test(location.search); let nFast = 0;
  let last = performance.now(), raf = 0, alive = true, fpsAcc = 0, fpsN = 0, fps = 0, onTick = () => {};
  const jobs = []; const later = (sec, fn) => jobs.push({ at: T + sec, fn });
  function step() {
    const now = performance.now(), dt = FIXED || Math.min(0.05, (now - last) / 1000); last = now; T += dt; fpsAcc += dt; fpsN++; if (fpsAcc > 1) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    crowd.update(T, dt); for (let i = jobs.length - 1; i >= 0; i--) if (T >= jobs[i].at) { const j = jobs[i]; jobs.splice(i, 1); j.fn(); }
    AQ.frame(now); onTick(dt, T); callFrame(); if (!FAST || (++nFast % 12) === 0) renderer.render(scene, cam);
  }
  function frame() { if (!alive) return; if (!MANUAL) raf = requestAnimationFrame(frame); step(); }
  const run = fn => { onTick = fn; frame(); };
  const cleanups = [];
  function stop() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); cleanups.forEach(f => f());
    scene.traverse(o => { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map && m.map.userData && m.map.userData.canvas) m.map.dispose(); m.dispose(); }); } });
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} }

  applyPark(scene, renderer, (me.gear && me.gear.park && me.gear.park.id) || null);
  return { THREE, wrap, hud, $, renderer, cv, scene, cam, canvasTex, toon, crowd, drawBoard, human, makeBat, placeBat, standInBox, handPos, gloveHand, ball, ballShadow, ring,
    callout, toScreen, toPlane, setShadowArea, later, run, stop, step, cleanups, CAL, get T() { return T; }, get fps() { return fps; } };
}

// Team looks
export const SPITTERS = me => ({ colors: { jersey: ORANGE, sleeve: GREEN, pants: 0xf4f2ec, socks: GREEN, belt: GREEN, helmet: GREEN, cap: GREEN },
  letters: { bg: '#ee7f24', fg: '#1d6a3b', edge: '#ffffff', num: me.num, name: me.name.toUpperCase().slice(0, 10), script: 'Spitters' } });
export const HORNETS = num => ({ colors: { jersey: 0xd6d4cc, sleeve: BLUE, pants: 0xd8d6cf, socks: BLUE, belt: BLUE, cap: BLUE, helmet: BLUE },
  letters: num ? { bg: '#d6d4cc', fg: '#1f3f7a', edge: '#f2c230', num: String(num), name: 'HORNETS', script: 'Hornets' } : null });
export const UMP = { size: 1.22, skin: 0xd49a72, colors: { jersey: 0x22252b, sleeve: 0x22252b, pants: 0x6a6f78, cap: 0x111111, socks: 0x111111, belt: 0x111111 } };

// Auto quality: if the device can't hold about 28 frames a second, step down (sharpness, then shadows). The level is remembered for next time.
export function autoQuality(renderer, sun, refit) {
  const KEY = 'dh3dq', dpr = window.devicePixelRatio || 1, test = /d3test|d3rec|d3fast/.test(location.search);
  let lvl = 0; try { lvl = Math.min(3, +(localStorage.getItem(KEY) || 0)); } catch (e) {}
  if (test) lvl = 0;
  const apply = () => { renderer.setPixelRatio([Math.min(2, dpr), Math.min(1.5, dpr), 1, 0.8][lvl]);
    sun.shadow.mapSize.set(lvl >= 1 ? 1024 : 2048, lvl >= 1 ? 1024 : 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } sun.castShadow = lvl < 2; refit(); };
  apply();
  let n = 0, t0 = 0, warm = 0;
  return { get level() { return lvl; }, frame(now) {
    if (test || lvl >= 3) return;
    if (warm < 45) { warm++; t0 = now; n = 0; return; }   // let the first second settle
    n++; const el = now - t0;
    if (el > 2500) { const fps = n * 1000 / el; n = 0; t0 = now;
      if (fps < 27) { lvl++; try { localStorage.setItem(KEY, lvl); } catch (e) {} apply(); warm = 15; } } } };
}

// Ballpark look from the Locker: night (default), day game, or sunset. Works on any of the 3D scenes after they're built.
export function applyPark(scene, renderer, id) {
  if (!id || id === 'night') return;
  const day = id === 'day';
  const c = document.createElement('canvas'); c.width = 16; c.height = 512; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  if (day) { gr.addColorStop(0, '#2f6fc4'); gr.addColorStop(0.4, '#6fa8e6'); gr.addColorStop(0.5, '#cfe6fb'); gr.addColorStop(0.53, '#9aa7b5'); gr.addColorStop(1, '#4a4a4a'); }
  else { gr.addColorStop(0, '#1b1b4a'); gr.addColorStop(0.36, '#5a3a78'); gr.addColorStop(0.46, '#e0705a'); gr.addColorStop(0.5, '#ffb35c'); gr.addColorStop(0.53, '#3a2a2a'); gr.addColorStop(1, '#141010'); }
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.fog.color.set(day ? 0xbcd6f0 : 0x6a4a5a);
  scene.environmentIntensity = day ? 0.7 : 0.45;
  scene.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.radius === 2200) { o.material.map = tex; o.material.needsUpdate = true; }
    if (o.isPoints && o.material.size === 3) o.visible = !day;
    if (o.isSprite && o.scale.x === 130) o.visible = !day;
    if (o.isHemisphereLight) { o.intensity = day ? 1.5 : 1.1; if (!day) o.color.set(0xffd9c0); }
    if (o.isDirectionalLight && o.castShadow) { o.intensity = day ? 3.2 : 2.4; o.color.set(day ? 0xffffff : 0xffb070); }
  });
  renderer.toneMappingExposure = day ? 1.0 : 1.05;
}
// Jaxson's Locker gear as player options (cleats, helmet finish)
export function gearLook(me) {
  const g = (me && me.gear) || {};
  return { shoes: g.cleats && g.cleats.c, helmet: g.helmet && g.helmet.c, finish: g.helmet ? { r: g.helmet.r, m: g.helmet.m } : null, bat: g.bat && g.bat.c, park: g.park && g.park.id };
}
