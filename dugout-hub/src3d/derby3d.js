// Dugout Hub · Home Run Derby in 3D. Seed Spitters Park at dusk. Jaxson (#20) bats left-handed.
// Loaded only when the game opens. Units are feet: home plate at the origin, center field toward -z.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLB, ready, autoQuality, applyPark, gearLook, shotOf, wantShot } from './park3d.js';
export { ready };
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export function start(cfg) {
  const { stage, level, me, Sound, still, end, say } = cfg;
  // Hit Streak mode: same at-bat, but every base hit counts. 3 outs, 3 strikes is an out, bananas rain on base hits.
  const STREAK = cfg.mode === 'streak', AB = cfg.mode === 'ab' && cfg.ab, OUTMAX = STREAK || AB ? 3 : 10;
  // single at-bat (Road to the Show): his ratings change the swing; the game situation comes in cfg.ab.sit
  const R_ = AB ? cfg.ab.r : null, SIT = AB ? cfg.ab.sit : null;
  const CON = R_ ? R_.con : 55, POW = R_ ? R_.pow : 55, SPD = R_ ? R_.spd : 55, VIS = R_ ? (R_.vis != null ? R_.vis : R_.con) : 55;
  let abB = 0, abS = 0, abRes = null;
  const GL = gearLook(me);
  // Seed Spitters orange and green. Opponent: Hornets navy and gold.
  const ORANGE = 0xee7f24, GREEN = 0x1d6a3b, DKGREEN = 0x0f3d22, BLACK = 0x161616, DEEP = 0xd15d0a, BLUE = 0x1f3f7a, GOLD = 0xf2c230;
  const lefty = me.bats !== 'right', side = lefty ? 1 : -1;
  const SLOW = [0, 1.7, 1.4, 1.15][level], WIN = [0, 150, 120, 100][level] * (AB ? 0.8 + VIS / 250 : 1), EVB = [0, 8, 5, 2][level] + (AB ? (POW - 55) * 0.2 : 0), AIMTOL = 0.95 * (AB ? 0.85 + CON / 330 : 1);
  const KINDS = level === 1 ? ['fast', 'fast', 'fast', 'change'] : level === 2 ? ['fast', 'fast', 'change', 'curve'] : ['fast', 'change', 'curve', 'fast', 'curve'];
  const NAMES = { fast: 'FASTBALL', change: 'CHANGEUP', curve: 'CURVEBALL' };
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const fence = a => 200 + 25 * Math.cos(clamp(a / 45, -1, 1) * Math.PI / 2);
  const D2R = Math.PI / 180;

  /* ---------- page parts: 3D view + TV-style overlay ---------- */
  const wrap = document.createElement('div'); wrap.className = 'd3';
  const hud = document.createElement('div'); hud.className = 'd3hud';
  hud.innerHTML = `
    ${AB ? `<div class="d3bug ab"><div class="d3bug-team"><b>${SIT.us} ${SIT.usR} · ${SIT.them} ${SIT.themR}</b><span>${SIT.half} ${SIT.inn}</span></div>
      <div class="d3bug-cell"><span>COUNT</span><b id="d3-cnt">0–0</b></div>
      <div class="d3bug-cell outs"><span>OUTS</span><div id="d3-outs"></div></div>
      <div class="d3bug-cell"><span>ON BASE</span><b class="d3dia2">${[1, 2, 3].map(i => '<i class="' + (SIT.on[i - 1] ? 'on' : '') + ' b' + i + '"></i>').join('')}</b></div>
      <i hidden id="d3-hr"></i><i hidden id="d3-long"></i></div>` : `
    <div class="d3bug"><div class="d3bug-team"><b>SEED SPITTERS</b><span>${STREAK ? 'HIT STREAK' : 'HR DERBY'}</span></div>
      ${STREAK ? '<div class="d3bug-cell"><span>HITS</span><b id="d3-hits">0</b></div>' : ''}
      <div class="d3bug-cell"><span>HR</span><b id="d3-hr">0</b></div>
      ${STREAK ? '<div class="d3bug-cell"><span>STRIKES</span><b id="d3-k">0</b></div>' : ''}
      <div class="d3bug-cell outs"><span>OUTS</span><div id="d3-outs"></div></div>
      <div class="d3bug-cell"><span>${STREAK ? 'BEST RUN' : 'LONGEST'}</span><b id="d3-long">–</b></div></div>`}
    <div class="d3pitch" id="d3-pitch"></div>
    <div class="d3streak" id="d3-streak"></div>
    <div class="d3call" id="d3-call"></div>
    <div class="d3tip" id="d3-tip"></div>
    <div class="d3intro" id="d3-intro"><div class="d3card">${AB ? `
      <div class="d3kicker">${SIT.title}</div><h2>#${me.num} ${me.name.toUpperCase()}</h2>
      <p class="d3sitline">${SIT.line}</p>
      <p>${SIT.pitcher}</p>
      <p>Tap to swing when the ball reaches the box. 4 balls = walk. 3 strikes = out.</p>
      <button type="button" class="d3go" id="d3-go">STEP IN</button></div></div>` : `
      <div class="d3kicker">SEED SPITTERS PARK</div><h2>${STREAK ? 'HIT STREAK' : 'HOME RUN DERBY'}</h2>
      <p>Tap the screen to swing when the ball reaches the box.</p>
      <p>${level === 1 ? 'Rookie: just nail the timing.' : 'Tap where the ball is: higher or lower.'} Swing early to pull it.</p>
      <p>${STREAK ? 'Every base hit counts. Bananas for hits, fireworks for homers! 3 strikes is an out. 3 outs and you’re done.' : '10 outs. Don’t swing at balls!'}</p>
      <button type="button" class="d3go" id="d3-go">PLAY BALL</button></div></div>`}`;
  stage.replaceChildren(wrap); wrap.appendChild(hud);
  const $ = id => hud.querySelector('#' + id);
  const outsEl = $('d3-outs'); for (let i = 0; i < OUTMAX; i++) outsEl.appendChild(document.createElement('i'));

  /* ---------- renderer, scene, camera ---------- */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { throw new Error('nogl'); }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.insertBefore(renderer.domElement, hud);
  renderer.domElement.className = 'd3cv'; renderer.domElement.setAttribute('aria-label', 'Home Run Derby ballpark');
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a2440, 500, 1300);
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35; pm.dispose(); }
  const cam = new THREE.PerspectiveCamera(42, 1, 0.5, 3000);
  const BAT_CAM = { pos: new THREE.Vector3(-side * 0.25, 6.1, 16.5), look: new THREE.Vector3(0, 3.0, -42) };

  /* ---------- textures made in code ---------- */
  const canvasTex = (w, h, draw, repeat) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.userData.canvas = c; return t; };
  const grad = (() => { const d = new Uint8Array([90, 170, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const toon = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0 }, extra || {}));
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x141414, side: THREE.BackSide });

  // Sky: deep blue overhead fading to a warm sunset on the horizon.
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: canvasTex(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#03060f'); gr.addColorStop(0.38, '#0b1630'); gr.addColorStop(0.47, '#1d2c4f'); gr.addColorStop(0.5, '#4a4a5a'); gr.addColorStop(0.53, '#1a1a22'); gr.addColorStop(1, '#050505');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); }) })));
  // a few stars
  { const n = 300, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = rnd(0.25, 1.3); p.set([Math.cos(a) * Math.cos(e) * 2000, Math.sin(e) * 2000, Math.sin(a) * Math.cos(e) * 2000], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 }))); }

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x2f4a28, 0.9));
  const sun = new THREE.DirectionalLight(0xfffaf0, 2.6); sun.position.set(40, 90, 45); sun.target.position.set(0, 0, -20);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 80, bottom: -40, near: 10, far: 260 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.9); fill.position.set(-70, 60, -60); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(0, 50, -200); scene.add(rim);

  /* ---------- the field: one big painted ground + a detailed home-plate area ---------- */
  const FIELD = 560, BASE = 46;   // 65 ft bases
  const fieldTex = canvasTex(2048, 2048, (g, W, H) => {
    const s = W / FIELD, X = x => W / 2 + x * s, Z = z => H * 0.9 + z * s;   // home plate sits low on the canvas
    g.fillStyle = '#2f7a33'; g.fillRect(0, 0, W, H);
    // mowing pattern: a diamond check across the whole outfield
    for (let i = 0; i < 44; i++) if (i % 2 === 0) { g.fillStyle = 'rgba(255,255,255,.075)'; g.fillRect(0, Z(-i * 14 - 14), W, 14 * s); }
    for (let i = -24; i < 24; i++) if (i % 2 === 0) { g.fillStyle = 'rgba(0,0,0,.03)'; g.fillRect(X(i * 14), 0, 14 * s, H); }
    // grass grain
    for (let i = 0; i < 60000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    const arc = (r, a0, a1, cx, cz) => { g.beginPath(); for (let a = a0; a <= a1 + 0.001; a += 1) { const t = a * D2R; g.lineTo(X((cx || 0) + Math.sin(t) * r), Z((cz || 0) - Math.cos(t) * r)); } };
    // warning track (10 ft of dirt in front of the fence)
    g.beginPath(); for (let a = -46; a <= 46; a += 1) { const t = a * D2R, d = fence(a) + 6; g.lineTo(X(Math.sin(t) * d), Z(-Math.cos(t) * d)); }
    for (let a = 46; a >= -46; a -= 1) { const t = a * D2R, d = fence(a) - 11; g.lineTo(X(Math.sin(t) * d), Z(-Math.cos(t) * d)); } g.closePath(); g.fillStyle = '#9a6a43'; g.fill();
    // infield dirt: arc around the mound plus the base paths
    g.fillStyle = '#b98454';
    g.beginPath(); g.moveTo(X(0), Z(6)); for (let a = -48; a <= 48; a += 1) { const t = a * D2R; g.lineTo(X(Math.sin(t) * 98), Z(-Math.cos(t) * 98)); } g.closePath(); g.fill();
    g.fillStyle = '#2f7a33'; g.beginPath(); g.moveTo(X(0), Z(-10)); g.lineTo(X(BASE - 8), Z(-BASE)); g.lineTo(X(0), Z(-2 * BASE + 10)); g.lineTo(X(-BASE + 8), Z(-BASE)); g.closePath(); g.fill();
    for (let i = 0; i < 18000; i++) { const x = rnd(-100, 100), z = rnd(-100, 8); g.fillStyle = 'rgba(80,45,20,.12)'; g.fillRect(X(x), Z(z), 2, 2); }
    // mound
    g.fillStyle = '#c4905d'; g.beginPath(); g.arc(X(0), Z(-BASE), 7 * s, 0, 7); g.fill();
    // chalk foul lines
    g.strokeStyle = '#f4f4f0'; g.lineWidth = Math.max(2, 0.45 * s);
    for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(X(0), Z(0)); g.lineTo(X(sg * 160), Z(-160)); g.stroke(); }
    // bases
    g.fillStyle = '#ffffff'; for (const [x, z] of [[BASE, -BASE], [0, -2 * BASE], [-BASE, -BASE]]) { g.save(); g.translate(X(x), Z(z)); g.rotate(Math.PI / 4); g.fillRect(-1 * s, -1 * s, 2 * s, 2 * s); g.restore(); }
    g.fillStyle = '#ffffff'; g.fillRect(X(-1), Z(-BASE) - 0.2 * s, 2 * s, 0.5 * s);   // rubber
  });
  fieldTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FIELD, FIELD), new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -FIELD * 0.4); ground.receiveShadow = false; scene.add(ground);
  // detailed home plate area, painted at high resolution
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
  // infield shadow catcher: only this area shows player shadows
  const catcherDisc = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.ShadowMaterial({ opacity: 0.32 })); catcherDisc.rotation.x = -Math.PI / 2; catcherDisc.position.set(0, 0.05, -30); catcherDisc.receiveShadow = true; scene.add(catcherDisc);
  // mound hill
  const mound = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xc4905d })); mound.scale.y = 0.08; mound.position.set(0, 0, -BASE); mound.receiveShadow = true; scene.add(mound);

  /* ---------- outfield fence, foul poles, distance signs ---------- */
  {
    const pts = [], N = 92; for (let i = 0; i <= N; i++) { const a = -46 + 92 * i / N; pts.push([Math.sin(a * D2R) * fence(a), -Math.cos(a * D2R) * fence(a)]); }
    const wall = (h0, h1, col, off) => { const pos = [], idx = []; pts.forEach(([x, z], i) => { const k = 1 + (off || 0) / Math.hypot(x, z); pos.push(x * k, h0, z * k, x * k, h1, z * k); if (i) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, toon(col, { side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m); return m; };
    wall(0, 8, 0x174d2c); wall(8, 8.8, 0xffd23f);
    // signs on the fence: one per distance + team panels
    const sign = (txt, a, w, bg, fg) => { const t = canvasTex(256, 128, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.font = '800 92px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, W / 2, H / 2 + 4); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshBasicMaterial({ map: t, transparent: bg === 'transparent' })); const d = fence(a) - 0.3; m.position.set(Math.sin(a * D2R) * d, 4, -Math.cos(a * D2R) * d); m.lookAt(0, 4, 0); scene.add(m); };
    [-44, -22, 0, 22, 44].forEach(a => sign(String(Math.round(fence(a))), a, 12, 'transparent', '#ffffff'));
    [-33, -11, 11, 33].forEach((a, i) => sign(i % 2 ? 'SPITTERS' : '#' + me.num, a, 16, i % 2 ? '#161616' : '#f28c38', i % 2 ? '#f28c38' : '#161616'));
    for (const sg of [-1, 1]) { const d = fence(46 * sg); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 48, 8), toon(0xffd23f)); pole.position.set(Math.sin(46 * sg * D2R) * d, 24, -Math.cos(46 * sg * D2R) * d); scene.add(pole); }
  }

  /* ---------- stands with a crowd, light towers, scoreboard ---------- */
  const crowd = (() => {
    const tiers = 9, per = 210, n = tiers * per, mat = new THREE.MeshLambertMaterial();
    const bodyG = new THREE.BoxGeometry(1.5, 1.7, 1.0); bodyG.translate(0, -0.2, 0);
    const inst = new THREE.InstancedMesh(bodyG, mat, n), heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.62, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    const base = [], col = new THREE.Color(), m4 = new THREE.Matrix4();
    const COL = [0xf28c38, 0xf28c38, 0x161616, 0x161616, 0xffffff, 0xd15d0a, 0xffd23f, 0x4a90d9, 0xe04f5f, 0x7bc96f, 0xffffff], SKIN = [0xf0c8a0, 0xd9a47a, 0xa36b45, 0x6e4529, 0xf5d6b8];
    let i = 0;
    for (let t = 0; t < tiers; t++) for (let k = 0; k < per; k++) {
      const a = -56 + 112 * (k + Math.random() * 0.6) / per, d = fence(clamp(a, -45, 45)) + 16 + t * 7, y = 6 + t * 4.6 + 1.6;
      const x = Math.sin(a * D2R) * d, z = -Math.cos(a * D2R) * d; base.push([x, y, z, Math.random() * 6.28, a]);
      m4.makeTranslation(x, y, z); inst.setMatrixAt(i, m4); m4.makeTranslation(x, y + 1.3, z); heads.setMatrixAt(i, m4);
      col.setHex(pick(COL)); inst.setColorAt(i, col); col.setHex(pick(SKIN)); heads.setColorAt(i, col); i++;
    }
    scene.add(heads);
    scene.add(inst);
    // seating bowl under the crowd
    for (let t = 0; t < tiers; t++) { const pos = [], idx = [], N = 60; for (let j = 0; j <= N; j++) { const a = -58 + 116 * j / N, d0 = fence(clamp(a, -45, 45)) + 12 + t * 7, d1 = d0 + 7, y = 4 + t * 4.6;
        const s = Math.sin(a * D2R), c = Math.cos(a * D2R); pos.push(s * d0, y, -c * d0, s * d1, y, -c * d1, s * d1, y + 4.6, -c * d1); if (j) { const b = j * 3; idx.push(b - 3, b - 2, b, b - 2, b + 1, b, b - 2, b - 1, b + 1, b - 1, b + 2, b + 1); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: t % 2 ? 0x2a2f3a : 0x323846, side: THREE.DoubleSide }))); }
    let wave = 0;
    return { cheer: v => { wave = Math.max(wave, v); }, update: (t, dt) => { wave = Math.max(0, wave - dt * 0.3); const idle = 0.15;
      for (let j = 0; j < n; j++) { const [x, y, z, ph, a] = base[j]; const w = wave > 0 ? Math.max(0, Math.sin(t * 6 - a * 0.12)) * 2.4 * wave : 0; const bob = Math.sin(t * 2 + ph) * idle + w; m4.makeTranslation(x, y + bob, z); inst.setMatrixAt(j, m4); m4.makeTranslation(x, y + 1.3 + bob, z); heads.setMatrixAt(j, m4); }
      inst.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; } };
  })();
  const glowTex = canvasTex(128, 128, (g, W) => { const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); r.addColorStop(0, 'rgba(255,250,225,1)'); r.addColorStop(0.25, 'rgba(255,240,200,.55)'); r.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = r; g.fillRect(0, 0, W, W); });
  for (const a of [-62, -25, 25, 62]) { const d = fence(clamp(a, -45, 45)) + 80, x = Math.sin(a * D2R) * d, z = -Math.cos(a * D2R) * d;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 110, 8), toon(0x9aa3b5)); pole.position.set(x, 55, z); scene.add(pole);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 2), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); bank.position.set(x, 112, z); bank.lookAt(0, 0, 0); scene.add(bank);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.set(130, 130, 1); glow.position.set(x, 112, z); scene.add(glow); }
  const board = canvasTex(1024, 384, () => {});
  const drawBoard = (big) => { const g = board.userData.canvas.getContext('2d'), W = 1024, H = 384;
    g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f28c38'; g.lineWidth = 12; g.strokeRect(6, 6, W - 12, H - 12);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f28c38'; g.font = '800 64px "Barlow Condensed", Arial Narrow, sans-serif'; g.fillText('SEED SPITTERS PARK', W / 2, 62);
    if (big) { g.fillStyle = '#ffd23f'; g.font = '800 150px "Barlow Condensed", Arial Narrow, sans-serif'; g.fillText(big, W / 2, 230); }
    else if (AB) { g.font = '800 112px "Barlow Condensed", Arial Narrow, sans-serif'; g.fillStyle = '#ffffff'; g.fillText(SIT.us + ' ' + SIT.usR + '   ' + SIT.them + ' ' + SIT.themR, W / 2, 210); g.font = '600 46px "Barlow Condensed", Arial Narrow, sans-serif'; g.fillStyle = '#bbbbbb'; g.fillText(SIT.half + ' ' + SIT.inn + ' · #' + me.num + ' ' + me.name.toUpperCase() + ' AT BAT', W / 2, 318); }
    else { g.font = '800 120px "Barlow Condensed", Arial Narrow, sans-serif'; g.fillStyle = '#ffffff'; g.fillText(STREAK ? 'HITS ' + (typeof hits === 'number' ? hits + hr : 0) + '   OUTS ' + outs : 'HR ' + hr + '   OUTS ' + outs, W / 2, 220); g.font = '600 46px "Barlow Condensed", Arial Narrow, sans-serif'; g.fillStyle = '#bbbbbb'; g.fillText('#' + me.num + ' ' + me.name.toUpperCase() + ' AT BAT', W / 2, 320); }
    board.needsUpdate = true; };
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(96, 36), new THREE.MeshBasicMaterial({ map: board, fog: false })); boardMesh.position.set(0, 78, -fence(0) - 62); scene.add(boardMesh);
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 3), toon(0x1d1d1d)); boardFrame.position.set(0, 78, -fence(0) - 63.8); scene.add(boardFrame);
  const boardLeg = new THREE.Mesh(new THREE.BoxGeometry(6, 70, 3), toon(0x1d1d1d)); boardLeg.position.set(0, 35, -fence(0) - 64); scene.add(boardLeg);

  /* ---------- ballplayers with real proportions ---------- */
  const font = (w, px) => w + ' ' + px + 'px "Barlow Condensed", Arial Narrow, sans-serif';
  const numberTex = (num, name, fg, bg, edge) => canvasTex(256, 256, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
    if (name) { g.fillStyle = fg; g.font = font(800, 40); g.fillText(name, W / 2, 40); }
    g.font = font(800, 150); g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = edge || '#ffffff'; g.strokeText(num, W / 2, 152); g.fillStyle = fg; g.fillText(num, W / 2, 152); });
  const scriptTex = (word, fg, bg, edge) => canvasTex(512, 160, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 800 104px "Barlow Condensed", Arial Narrow, sans-serif'; g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = edge; g.strokeText(word, W / 2, H / 2 + 4); g.fillStyle = fg; g.fillText(word, W / 2, H / 2 + 4); });
  const HIPY = 2.5;
  const SKINS = [0xe8b48f, 0xd49a72, 0xa8714d, 0xf0c8a5, 0x8a5a3c];
  function player(o) {
    const root = new THREE.Group(), parts = {}, SK = o.skin || pick(SKINS);
    const M = {}; const mat = (c, r, m) => { const k = c + ':' + (r || 0.75) + ':' + (m || 0); return M[k] || (M[k] = toon(c, { roughness: r == null ? 0.75 : r, metalness: m || 0 })); };
    const add = (parent, geo, material, x, y, z) => { const m = new THREE.Mesh(geo, typeof material === 'number' ? mat(material) : material); m.position.set(x, y, z); m.castShadow = !o.lod; parent.add(m); return m; };
    const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const shirt = mat(o.shirt, 0.85), pants = mat(o.pants, 0.9), sleeve = mat(o.sleeve || o.shirt, 0.85), under = mat(o.under || o.shirt, 0.8), sock = mat(o.socks || o.pants, 0.9), skin = mat(SK, 0.6), trim = mat(o.trim || o.under || o.shirt, 0.8);
    parts.hips = grp(root, 0, HIPY, 0);
    const pel = add(parts.hips, new THREE.CapsuleGeometry(0.38, 0.16, 4, 16), pants, 0, -0.06, 0); pel.scale.z = 0.78;
    const belt = add(parts.hips, new THREE.CylinderGeometry(0.39, 0.39, 0.12, 20), mat(o.belt || BLACK, 0.5), 0, 0.2, 0); belt.scale.z = 0.78;
    parts.torso = grp(parts.hips, 0, 0.22, 0);
    // tapered torso, wider at the shoulders
    const prof = [[0.001, 0], [0.41, 0], [0.42, 0.35], [0.47, 0.8], [0.54, 1.1], [0.53, 1.27], [0.33, 1.42], [0.001, 1.45]].map(([r, y]) => new THREE.Vector2(r, y));
    const chest = add(parts.torso, new THREE.LatheGeometry(prof, 28), shirt, 0, 0, 0); chest.scale.z = 0.66;
    if (o.piping) { const pip = add(parts.torso, new THREE.BoxGeometry(0.05, 1.2, 0.02), trim, 0, 0.62, -0.285); pip.position.z = -0.315; pip.rotation.x = -0.05; }
    add(parts.torso, new THREE.CylinderGeometry(0.12, 0.14, 0.24, 12), skin, 0, 1.5, 0);
    if (o.num) {
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: numberTex(o.num, o.name, o.numCss, o.shirtCss, o.numEdge), roughness: 0.85 })); back.position.set(0, 0.8, 0.34); parts.torso.add(back);
      if (o.script) { const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.24), new THREE.MeshStandardMaterial({ map: scriptTex(o.script, o.numCss, o.shirtCss, o.numEdge || '#ffffff'), roughness: 0.85 })); fr.position.set(0, 0.98, -0.335); fr.rotation.y = Math.PI; parts.torso.add(fr); }
    }
    parts.head = grp(parts.torso, 0, 1.62, 0);
    const head = add(parts.head, new THREE.SphereGeometry(0.29, 24, 18), skin, 0, 0.27, 0); head.scale.set(0.9, 1.08, 0.98);
    const hair = add(parts.head, new THREE.SphereGeometry(0.3, 20, 14), mat(o.hair || pick([0x2a1a0e, 0x4a2e18, 0x111111, 0x6b4a2a]), 0.9), 0, 0.32, 0.045); hair.scale.set(0.93, 0.92, 0.94);
    add(parts.head, new THREE.SphereGeometry(0.05, 10, 8), skin, 0, 0.24, -0.285);
    for (const sx of [-1, 1]) { const ear = add(parts.head, new THREE.SphereGeometry(0.07, 10, 8), skin, sx * 0.265, 0.26, 0.02); ear.scale.set(0.45, 1, 0.75);
      if (!o.lod) { const wht = add(parts.head, new THREE.SphereGeometry(0.05, 12, 10), mat(0xf4f1ea, 0.35), sx * 0.098, 0.305, -0.245); wht.scale.set(1, 0.62, 0.45); add(parts.head, new THREE.SphereGeometry(0.028, 10, 8), mat(0x2b1a10, 0.25), sx * 0.098, 0.305, -0.268); const brow = add(parts.head, new THREE.BoxGeometry(0.1, 0.022, 0.02), mat(0x3a2414), sx * 0.1, 0.37, -0.262); brow.rotation.z = sx * -0.12;
        if (o.eyeBlack) add(parts.head, new THREE.BoxGeometry(0.09, 0.03, 0.02), mat(0x0a0a0a, 0.9), sx * 0.11, 0.23, -0.262); } }
    if (!o.lod) add(parts.head, new THREE.BoxGeometry(0.1, 0.018, 0.02), mat(0x8a4a3a), 0, 0.13, -0.27);
    if (o.helmet) {
      const hm = mat(o.helmet, 0.25, 0.15);
      add(parts.head, new THREE.SphereGeometry(0.335, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), hm, 0, 0.31, 0.02);
      const flap = add(parts.head, new THREE.SphereGeometry(0.2, 16, 12), hm, -side * 0.255, 0.18, 0.02); flap.scale.set(0.32, 1, 1);
      const brim = add(parts.head, new THREE.CylinderGeometry(0.22, 0.22, 0.03, 24, 1, false, -Math.PI / 2, Math.PI), hm, 0, 0.33, -0.27); brim.scale.z = 0.8; brim.rotation.x = 0.08;
      if (o.helmetStripe) { const st = add(parts.head, new THREE.TorusGeometry(0.338, 0.018, 6, 32, Math.PI), mat(o.helmetStripe, 0.3), 0, 0.31, 0.02); st.rotation.y = Math.PI / 2; }
    } else {
      add(parts.head, new THREE.SphereGeometry(0.31, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(o.cap, 0.8), 0, 0.33, 0.01);
      const brim = add(parts.head, new THREE.CylinderGeometry(0.21, 0.21, 0.025, 24, 1, false, -Math.PI / 2, Math.PI), mat(o.brim || o.cap, 0.8), 0, 0.34, -0.28); brim.scale.z = 0.85;
    }
    const arm = sx => { const sh = grp(parts.torso, sx * 0.56, 1.2, 0);
      add(sh, new THREE.CapsuleGeometry(0.15, 0.2, 4, 12), sleeve, 0, -0.14, 0);
      add(sh, new THREE.CapsuleGeometry(0.12, 0.34, 4, 10), under, 0, -0.48, 0);
      const el = grp(sh, 0, -0.78, 0); add(el, new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), o.longSleeve ? under : skin, 0, -0.32, 0);
      const hand = grp(el, 0, -0.7, 0); add(hand, new THREE.SphereGeometry(0.1, 12, 10), o.gloves && !o.gloveSide ? mat(o.gloves, 0.6) : skin, 0, 0, 0);
      if (o.gloveSide === sx) { const g2 = add(hand, new THREE.SphereGeometry(0.24, 14, 10), mat(0x8b5527, 0.55), 0, -0.07, -0.07); g2.scale.set(0.55, 1, 1); }
      return { sh, el, hand }; };
    const leg = sx => { const hp = grp(parts.hips, sx * 0.2, -0.12, 0);
      const th = add(hp, new THREE.CapsuleGeometry(0.195, 0.7, 4, 12), pants, 0, -0.5, 0); th.scale.z = 0.95;
      if (o.legStripe) add(hp, new THREE.BoxGeometry(0.02, 0.9, 0.06), mat(o.legStripe, 0.8), sx * 0.17, -0.5, 0);
      const kn = grp(hp, 0, -1.08, 0);
      add(kn, new THREE.CapsuleGeometry(0.14, 0.12, 4, 10), pants, 0, -0.05, 0);
      add(kn, new THREE.CapsuleGeometry(0.115, 0.68, 4, 10), sock, 0, -0.55, 0);
      const cleat = add(kn, new THREE.BoxGeometry(0.2, 0.15, 0.44), mat(0x121212, 0.35), 0, -1.22, -0.08);
      add(kn, new THREE.BoxGeometry(0.205, 0.035, 0.445), mat(0xf2f2f2, 0.6), 0, -1.29, -0.08);
      return { hp, kn }; };
    const L = arm(-1), R = arm(1), LL = leg(-1), RL = leg(1);
    Object.assign(parts, { shL: L.sh, elL: L.el, handL: L.hand, shR: R.sh, elR: R.el, handR: R.hand, hipL: LL.hp, knL: LL.kn, hipR: RL.hp, knR: RL.kn });
    return { root, parts };
  }
  // Pose = rotations for each joint: [x, y, z] in radians. Missing joints go to 0.
  const JOINTS = ['hips', 'torso', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'hipR', 'knR'];
  function setPose(p, a, b, t) { t = t || 0; if (p.h) return p.pose(a, b, t); for (const j of JOINTS) { const A = (a && a[j]) || [0, 0, 0], B = b ? (b[j] || [0, 0, 0]) : A; p.parts[j].rotation.set(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
    const ya = (a && a.y) || 0, yb = b ? (b.y || 0) : ya; p.parts.hips.position.y = HIPY + lerp(ya, yb, t); }
  function playKeys(p, keys, t) { if (p.h) return p.set('pitch', t <= 0.82 ? t * CAL.pitch.tr / 0.82 : CAL.pitch.tr + (t - 0.82)); let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++; const k0 = keys[i], k1 = keys[i + 1]; setPose(p, k0.p, k1.p, ease(clamp((t - k0.t) / (k1.t - k0.t), 0, 1))); }

  /* ---------- real ballplayers (rigged body + motion capture) ---------- */
  const FT = 3.2808, UPV = new THREE.Vector3(0, 1, 0), AX1 = new THREE.Vector3(1, 0, 0);
  const CLIPS = {}; let CAL = null;
  if (GLB) {
    GLB.animations.forEach(a => { CLIPS[a.name] = a; });
    // measure each motion once on a spare copy (meters, the model's own space)
    const cal = skClone(GLB.scene), mx = new THREE.AnimationMixer(cal), B = {}; cal.traverse(o => { if (o.isBone) B[o.name] = o; });
    const at = (name, t) => { mx.stopAllAction(); mx.clipAction(CLIPS[name]).play(); mx.setTime(t); cal.updateMatrixWorld(true); };
    const wp = n => B[n].getWorldPosition(new THREE.Vector3());
    const feet = () => { let m = 1e9; for (const n in B) if (/^(toe|foot)/.test(n)) m = Math.min(m, wp(n).y); return m - 0.025; };
    const fastest = (name, a, b) => { let best = a, bs = -1, prev = null; for (let t = a; t <= b; t += 1 / 60) { at(name, t); const p = wp('wristR'); if (prev) { const s = p.distanceTo(prev); if (s > bs) { bs = s; best = t; } } prev = p; } return best; };
    const yawOf = (d, mir) => Math.PI - Math.atan2(d.x * mir, d.z);
    CAL = {};
    const one = (name, t0, t1, extra) => { if (!CLIPS[name]) return; at(name, t0); const h0 = wp('root'), g = -feet(); at(name, t1); const d = wp('root').sub(h0); d.y = 0;
      if (d.lengthSq() < 1e-6) d.set(0, 0, 1); CAL[name] = Object.assign({ yaw: yawOf(d, 1), yawM: yawOf(d, -1), g }, extra || {}); };
    const tc = fastest('swing', 0.55, 1.2), tr = fastest('pitch', 0.5, 1.8);
    one('swing', 0, tc, { tc }); one('pitch', 0, Math.min(CLIPS.pitch.duration - 0.01, tr + 0.25), { tr }); one('run', 0, CLIPS.run.duration - 0.01);
    for (const n of ['ready', 'crouch', 'ump', 'catch']) if (CLIPS[n]) { at(n, 0); CAL[n] = { yaw: Math.PI, yawM: Math.PI, g: -feet() }; }
    // running in place: take the forward travel out of the hips (the game moves the fielder)
    { let mn = 1e9; for (let t = 0; t < CLIPS.run.duration; t += 1 / 30) { at('run', t); mn = Math.min(mn, feet()); } CAL.run.g = -mn;
      const tk = CLIPS.run.tracks.find(t => /^root\.position$/.test(t.name));
      if (tk && !tk.flat) { const v = tk.values, n = v.length / 3; for (const c of [0, 2]) { const a = v[c], b = v[(n - 1) * 3 + c]; for (let i = 0; i < n; i++) v[i * 3 + c] -= a + (b - a) * i / (n - 1); } tk.flat = true; } }
  }
  const SPEC = (o) => o;
  const lettering = (lines, flip) => canvasTex(512, 512, (g, W) => {
    if (flip) { g.translate(W, 0); g.scale(-1, 1); }
    g.fillStyle = lines.bg; g.fillRect(0, 0, W, W); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    if (lines.name) { g.font = font(800, 78); g.fillStyle = lines.fg; g.fillText(lines.name, W / 2, 118); }
    if (lines.num) { g.font = font(800, 330); g.lineWidth = 18; g.strokeStyle = lines.edge; g.strokeText(lines.num, W / 2, 430); g.fillStyle = lines.fg; g.fillText(lines.num, W / 2, 430); }
    if (lines.script) { g.save(); g.translate(W / 2, W / 2 + 20); g.scale(1, 2.1); g.font = 'italic 800 132px "Barlow Condensed", Arial Narrow, sans-serif'; g.lineWidth = 12; g.strokeStyle = lines.edge; g.strokeText(lines.script, 0, 20); g.fillStyle = lines.fg; g.fillText(lines.script, 0, 20); g.restore(); }
  });
  function human(o) {
    const root = new THREE.Group(), inner = new THREE.Group(), model = skClone(GLB.scene); root.add(inner); inner.add(model);
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
        mm.map.flipY = false; mm.map.colorSpace = THREE.SRGBColorSpace; mm.map.anisotropy = 4;
      }
    });
    const mixer = new THREE.AnimationMixer(model); let cur = null;
    const set = (name, t) => { const c = CLIPS[name]; if (!c) return;
      if (cur !== name) { mixer.stopAllAction(); mixer.clipAction(c).play(); cur = name; inner.rotation.y = mir < 0 ? CAL[name].yawM : CAL[name].yaw; inner.position.y = CAL[name].g * sc; }
      mixer.setTime(name === 'run' ? t % c.duration : clamp(t, 0, c.duration - 0.001)); };
    const h = { h: true, root, inner, parts, set };
    h.pose = (a, b, t) => {
      if (a && a.run) return set('run', T * 1.05);
      if (a && a.hold) return set(a.hold, 0);
      if ((a === BP.stance || a === BP.load || a === BP.contact || a === BP.finish)) {
        const tc = CAL.swing.tc, d = CLIPS.swing.duration, L0 = Math.max(0, tc - 0.2);
        if (a === BP.stance && b === BP.load) return set('swing', t * L0);
        if (a === BP.stance || (a === BP.load && !b)) return set('swing', a === BP.load ? L0 : 0);
        if (a === BP.load) return set('swing', L0 + t * (tc - L0));
        return set('swing', tc + t * (d - tc));
      }
      if (a === READY) return set('ready', 0);
      if (a === CROUCH) return set('crouch', 0);
    };
    return h;
  }
  // where the bat is: gripped in both hands, fixed to the top hand's grip
  const gripOf = (p, out) => { const kn = b => { const ch = b.children.find(c => c.isBone); return (ch || b).getWorldPosition(tmpG); };
    out.copy(kn(p.parts.wristL)); out.add(kn(p.parts.wristR)).multiplyScalar(0.5); return out; };
  const tmpG = new THREE.Vector3(), batDir = new THREE.Vector3();

  // Jaxson
  const bat = (() => { const pts = []; for (let i = 0; i <= 16; i++) { const y = i / 16 * 2.45, r = i < 2 ? 0.07 : y < 1.0 ? 0.055 : Math.min(0.13, 0.055 + (y - 1.0) * 0.06); pts.push(new THREE.Vector2(i === 16 ? 0.0 : r, y)); }
    pts.unshift(new THREE.Vector2(0, -0.02)); const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), toon(GL.bat || 0xd9a65e, { roughness: GL.bat === 0xd4af37 ? 0.3 : 0.45, metalness: GL.bat === 0xd4af37 ? 0.6 : 0 })); m.castShadow = true;
    const tape = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.6, 12), toon(BLACK)); tape.position.y = 0.4; m.add(tape); return m; })();
  const OC = AB && SIT.oc ? SIT.oc : BLUE, OPPC = { jersey: AB && SIT.oj ? SIT.oj : 0xd6d4cc, sleeve: OC, pants: 0xd8d6cf, socks: OC, belt: OC, cap: OC, helmet: OC };
  const J = GLB ? human({ mirror: lefty, helmet: true, skin: AB && cfg.ab.skin ? cfg.ab.skin : 0xf0c8a5, hair: AB && cfg.ab.hair ? cfg.ab.hair : 0x4a2e18, finish: GL.finish, colors: Object.assign({ jersey: ORANGE, sleeve: GREEN, pants: 0xf4f2ec, socks: GREEN, belt: GREEN, helmet: GL.helmet != null ? GL.helmet : GREEN }, GL.shoes != null ? { shoes: GL.shoes } : {}),
    letters: { bg: '#ee7f24', fg: '#1d6a3b', edge: '#ffffff', num: me.num, name: me.name.toUpperCase().slice(0, 10), script: 'Spitters' } }) : player({ shirt: ORANGE, shirtCss: '#ee7f24', sleeve: ORANGE, under: GREEN, longSleeve: true, trim: GREEN, piping: true, pants: 0xf4f2ec, legStripe: GREEN, belt: GREEN, socks: GREEN, helmet: GREEN, helmetStripe: ORANGE,
    num: me.num, name: me.name.toUpperCase().slice(0, 10), numCss: '#1d6a3b', numEdge: '#ffffff', script: 'Spitters', eyeBlack: true, gloves: ORANGE, skin: 0xf0c8a5 });
  J.root.position.set(side * 2.7, 0, 0.2); J.root.rotation.y = J.h ? 0 : side * Math.PI / 2; scene.add(J.root);
  const batPivot = new THREE.Group(); if (J.h) scene.add(bat); else { J.parts.torso.add(batPivot); batPivot.position.set(0, 1.0, -0.15); batPivot.add(bat); }
  const placeBat = () => { J.root.updateMatrixWorld(true); gripOf(J, bat.position); batDir.copy(AX1).transformDirection(J.parts.wristR.matrixWorld); bat.quaternion.setFromUnitVectors(UPV, batDir); bat.position.addScaledVector(batDir, -0.3); };
  if (J.h) {   // stand him so the sweet spot of the bat meets the ball over the plate
    J.set('swing', CAL.swing.tc); placeBat(); const sweet = bat.position.clone().addScaledVector(batDir, 1.95);
    J.root.position.x -= sweet.x; J.root.position.z += -0.5 - sweet.z; }
  // stance -> load -> swing -> follow-through (left-handed; mirrored for righties by the root rotation and sign s)
  const s = side;
  const BP = {
    stance: { y: -0.15, hips: [0, 0.25, 0], torso: [0.12, 0.35, 0], head: [0, -0.55, 0], shL: [-0.9, 0, 0.7], elL: [-1.3, 0, 0], shR: [-1.2, 0, -0.3], elR: [-1.1, 0, 0], hipL: [-0.25, 0, -0.15], knL: [0.45, 0, 0], hipR: [-0.2, 0, 0.18], knR: [0.4, 0, 0], bat: [0.5, 0, 0.9] },
    load: { y: -0.22, hips: [0, 0.45, 0], torso: [0.12, 0.6, 0], head: [0, -0.75, 0], shL: [-1.0, 0, 0.9], elL: [-1.4, 0, 0], shR: [-1.3, 0, -0.2], elR: [-1.2, 0, 0], hipL: [-0.55, 0, -0.1], knL: [0.85, 0, 0], hipR: [-0.15, 0, 0.2], knR: [0.5, 0, 0], bat: [0.55, 0, 1.15] },
    contact: { y: -0.2, hips: [0, -0.9, 0], torso: [0.25, -0.75, 0], head: [0.1, 0.4, 0], shL: [-1.5, 0, 0.1], elL: [-0.1, 0, 0], shR: [-1.55, 0, -0.1], elR: [-0.2, 0, 0], hipL: [0.15, 0, -0.1], knL: [0.1, 0, 0], hipR: [-0.35, 0, 0.1], knR: [0.7, 0, 0], bat: [1.55, 0, -0.1] },
    finish: { y: -0.1, hips: [0, -1.4, 0], torso: [0.1, -1.4, 0], head: [0, 0.9, 0], shL: [-2.6, 0, -0.6], elL: [-1.2, 0, 0], shR: [-2.3, 0, -0.9], elR: [-1.6, 0, 0], hipL: [0.1, 0, -0.1], knL: [0.05, 0, 0], hipR: [-0.2, 0, 0.15], knR: [0.9, 0, 0], bat: [2.4, 0, -1.9] }
  };
  const setBat = (a, b, t) => { if (J.h) return placeBat(); t = t || 0; const A = a.bat, B = b ? b.bat : A; batPivot.rotation.set(lerp(A[0], B[0], t), 0, s * lerp(A[2], B[2], t)); };

  // Pitcher (Hornets: blue and gold) and the defense
  const OPP = { shirt: 0xf2f0ea, shirtCss: '#f2f0ea', sleeve: BLUE, under: BLUE, pants: 0xd8d6cf, legStripe: BLUE, belt: BLUE, socks: BLUE, cap: BLUE, brim: BLUE, trim: GOLD, piping: true, gloveSide: -1 };
  const P1 = GLB ? human({ glove: true, colors: OPPC, letters: AB && SIT.ol ? SIT.ol : { bg: '#d6d4cc', fg: '#1f3f7a', edge: '#f2c230', num: '7', name: 'HORNETS', script: 'Hornets' } }) : player(Object.assign({ num: '7', numCss: '#1f3f7a', numEdge: '#f2c230', name: 'HORNETS', script: 'Hornets' }, OPP)); P1.root.position.set(0, 0.55, -BASE + 0.6); P1.root.rotation.y = Math.PI; scene.add(P1.root);
  const PK = [   // windup keyframes (right-handed pitcher facing home)
    { t: 0, p: { y: -0.12, torso: [0.12, 0, 0], shL: [-0.5, 0, -0.3], elL: [-1.4, 0, 0], shR: [-0.5, 0, 0.3], elR: [-1.4, 0, 0], hipL: [-0.2, 0, -0.08], knL: [0.35, 0, 0], hipR: [-0.2, 0, 0.08], knR: [0.35, 0, 0] } },
    { t: 0.3, p: { y: 0.1, hips: [0, -0.9, 0], torso: [0, -0.2, 0], shL: [-0.6, 0, -0.3], elL: [-1.5, 0, 0], shR: [-0.6, 0, 0.3], elR: [-1.5, 0, 0], hipL: [-1.5, 0, 0], knL: [1.6, 0, 0] } },
    { t: 0.62, p: { y: -0.35, hips: [0, -0.3, 0], torso: [-0.2, -0.6, 0], shL: [-1.4, 0, -0.9], elL: [-0.3, 0, 0], shR: [0.4, 0, 1.3], elR: [-1.6, 0, 0], hipL: [-0.9, 0, 0], knL: [0.5, 0, 0], hipR: [0.6, 0, 0], knR: [0.6, 0, 0] } },
    { t: 0.82, p: { y: -0.5, hips: [0, 0.5, 0], torso: [0.6, 0.6, 0], shL: [-0.6, 0, -0.4], elL: [-1.2, 0, 0], shR: [-2.6, 0, 0.4], elR: [-0.4, 0, 0], hipL: [-0.6, 0, 0], knL: [0.5, 0, 0], hipR: [0.5, 0, 0], knR: [0.9, 0, 0] } },
    { t: 1.0, p: { y: -0.45, hips: [0, 0.7, 0], torso: [0.9, 0.7, 0], shL: [-0.3, 0, -0.3], elL: [-1, 0, 0], shR: [-0.6, 0, 0.3], elR: [-0.3, 0, 0], hipL: [-0.3, 0, 0], knL: [0.3, 0, 0], hipR: [0.9, 0, 0], knR: [1.2, 0, 0] } },
    { t: 1.6, p: { y: -0.2, hips: [0, 0.2, 0], torso: [0.3, 0.2, 0], shL: [-0.5, 0, -0.3], elL: [-1.4, 0, 0], shR: [-0.4, 0, 0.3], elR: [-1.4, 0, 0], hipL: [-0.2, 0, 0], knL: [0.3, 0, 0], hipR: [0.2, 0, 0], knR: [0.3, 0, 0] } }];
  const READY = { y: -0.25, torso: [0.35, 0, 0], shL: [-0.6, 0, -0.3], elL: [-0.9, 0, 0], shR: [-0.6, 0, 0.3], elR: [-0.9, 0, 0], hipL: [-0.4, 0, -0.15], knL: [0.7, 0, 0], hipR: [-0.4, 0, 0.15], knR: [0.7, 0, 0] };
  const CROUCH = { y: -1.3, torso: [0.25, 0, 0], shL: [-1.2, 0, -0.4], elL: [-0.8, 0, 0], shR: [-0.4, 0, 0.3], elR: [-1.2, 0, 0], hipL: [-1.7, 0, -0.35], knL: [2.2, 0, 0], hipR: [-1.7, 0, 0.35], knR: [2.2, 0, 0] };
  const fielders = [[BASE + 6, -BASE - 10], [18, -2 * BASE + 4], [-18, -2 * BASE + 4], [-BASE - 6, -BASE - 10], [-95, -150], [0, -175], [95, -150]].map(([x, z]) => {
    const f = GLB ? human({ lod: true, glove: true, colors: OPPC }) : player(Object.assign({ lod: true }, OPP)); f.root.position.set(x, 0, z); f.root.lookAt(0, 0, 0); f.home = new THREE.Vector3(x, 0, z); f.root.rotation.y += Math.PI; setPose(f, READY); scene.add(f.root); return f; });
  const catcher = GLB ? human({ helmet: true, glove: true, colors: Object.assign({}, OPPC, { helmet: 0x1a1a1a }) }) : player(Object.assign({}, OPP, { helmet: 0x1a1a1a, cap: 0x1a1a1a })); catcher.root.position.set(0, 0, 3.2); catcher.root.rotation.y = 0; catcher.root.scale.setScalar(catcher.h ? 0.92 : 0.9); setPose(catcher, CROUCH); scene.add(catcher.root);
  const ump = GLB ? human({ size: 1.22, skin: 0xd49a72, colors: { jersey: 0x22252b, sleeve: 0x22252b, pants: 0x6a6f78, cap: 0x111111, socks: 0x111111, belt: 0x111111 } }) : player({ shirt: 0x22252b, under: 0x22252b, pants: 0x6a6f78, cap: 0x111111, socks: 0x111111, longSleeve: true }); ump.root.position.set(-side * (GLB ? 2.3 : 0.7), 0, GLB ? 7.6 : 6.9); ump.root.rotation.y = GLB ? -side * 0.18 : 0; setPose(ump, { y: -0.95, torso: [0.5, 0, 0], shL: [-0.5, 0, -0.2], elL: [-1.2, 0, 0], shR: [-0.5, 0, 0.2], elR: [-1.2, 0, 0], hipL: [-0.6, 0, -0.3], knL: [1, 0, 0], hipR: [-0.6, 0, 0.3], knR: [1, 0, 0] }); scene.add(ump.root);
  // Road to the Show: his teammates on base, leading off
  if (AB && GLB) [[BASE - 5, -BASE - 5], [-5, -2 * BASE + 5], [-BASE + 4, -BASE + 4]].forEach(([x, z], i) => { if (!SIT.on[i]) return;
    const r = human({ helmet: true, colors: { jersey: ORANGE, sleeve: GREEN, pants: 0xf4f2ec, socks: GREEN, belt: GREEN, helmet: GREEN }, letters: { bg: '#ee7f24', fg: '#1d6a3b', edge: '#ffffff', num: String(3 + i * 4), name: 'SPITTERS', script: 'Spitters' } });
    r.root.position.set(x, 0, z); r.root.lookAt(0, 0, 0); r.root.rotation.y += Math.PI; setPose(r, READY); scene.add(r.root); });
  applyPark(scene, renderer, GL.park);
  setPose(J, BP.stance); setBat(BP.stance);
  setPose(P1, PK[0].p); if (ump.h) ump.set('ump', 0); if (P1.h) playKeys(P1, PK, 0);

  /* ---------- the ball, its trail, the strike zone ---------- */
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), ballMat); ball.castShadow = true; ball.visible = false; scene.add(ball);
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ballGlow.scale.setScalar(1.6); ball.add(ballGlow);
  const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.visible = false; scene.add(shadowBlob);
  const TR = 18, trail = []; for (let i = 0; i < TR; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; scene.add(m); trail.push(m); }
  const trailPos = [];
  const zone = new THREE.Group(); zone.position.set(0, 2.5, 0.02); zone.renderOrder = 10; scene.add(zone);
  { const edge = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }), grid = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthTest: false });
    const bar = (w, h, x, y, m) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); b.position.set(x, y, 0); b.renderOrder = 10; zone.add(b); };
    const W = 1.7, H = 1.9, t = 0.045; bar(W + t, t, 0, H / 2, edge); bar(W + t, t, 0, -H / 2, edge); bar(t, H + t, -W / 2, 0, edge); bar(t, H + t, W / 2, 0, edge);
    for (const k of [-1, 1]) { bar(0.018, H, k * W / 6, 0, grid); bar(W, 0.018, 0, k * H / 6, grid); }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, depthTest: false })); fill.renderOrder = 9; zone.add(fill); }
  const spot = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.2, 28), new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0, depthTest: false })); spot.renderOrder = 11; scene.add(spot);
  const spotDot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false })); spotDot.renderOrder = 11; spot.add(spotDot);
  let spotT = 9;
  const showSpot = () => { spot.position.set(P.x, P.h, 0.04); spot.material.color.setHex(P.strike ? 0xff4040 : 0x40a8ff); spotT = 0; };
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 28), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, depthTest: false })); aimRing.renderOrder = 12; aimRing.position.z = 0.05; scene.add(aimRing);
  const cursor = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false })); cursor.renderOrder = 12; scene.add(cursor);
  const flashTex = canvasTex(256, 256, (g, W) => { const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,220,140,.9)'); r.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = r; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * 30, W / 2 + Math.sin(a) * 30); g.lineTo(W / 2 + Math.cos(a) * 120, W / 2 + Math.sin(a) * 120); g.stroke(); } });
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); scene.add(flash);
  // swing arc: a white ribbon that shows the bat path
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const arcMesh = new THREE.Mesh(new THREE.RingGeometry(1.9, 3.1, 40, 1, Math.PI * 0.05, Math.PI * 0.9), arcMat); arcMesh.rotation.x = -Math.PI / 2 + 0.15; scene.add(arcMesh);

  /* ---------- banana rain (base hits in Hit Streak) ---------- */
  const bananaGeo = (() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.1, 0.45, 0), new THREE.Vector3(0, -0.55, 0), new THREE.Vector3(1.1, 0.45, 0));
    const TS = 24, RS = 10, g = new THREE.TubeGeometry(curve, TS, 0.3, RS, false), pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= TS; i++) { const t = i / TS; curve.getPointAt(t, c); const taper = Math.max(0.22, Math.pow(Math.sin(Math.PI * t), 0.55));
      for (let j = 0; j <= RS; j++) { const k = i * (RS + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(taper).add(c); pos.setXYZ(k, v.x, v.y, v.z);
        const tip = t < 0.07 || t > 0.95, green = t > 0.86 && !tip; col.set(tip ? [0.25, 0.17, 0.07] : green ? [0.62, 0.72, 0.18] : [0.98, 0.82, 0.2], k * 3); } }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g; })();
  const bananaMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0 });
  const bananas = [];
  // Bananas start just above the top of the screen, spread across the view, and flutter down over about 3 seconds.
  function bananaRain() {
    const n = still ? 14 : 44, v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const d = rnd(20, 50); v.set(rnd(-0.95, 0.95), rnd(1.05, 1.5), 0.5).unproject(cam).sub(cam.position).normalize();
      const m = new THREE.Mesh(bananaGeo, bananaMat); m.position.copy(cam.position).addScaledVector(v, d);
      m.rotation.set(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)); const sc = rnd(1.2, 1.9) * (d / 30 + 0.5); m.scale.setScalar(sc); m.castShadow = !still; m.visible = false;
      scene.add(m); bananas.push({ m, vy: -rnd(2, 6), spin: [rnd(-5, 5), rnd(-5, 5), rnd(-5, 5)], age: 0, delay: rnd(0, 1.2), s: sc, landed: false, sway: rnd(0, 6.28) });
    }
    Sound.whoosh(); later(0.5, () => Sound.pop());
  }
  function updateBananas(dt) { for (let k = bananas.length - 1; k >= 0; k--) { const b = bananas[k]; b.age += dt; if (b.age < b.delay) continue; b.m.visible = true; const a = b.age - b.delay;
      if (!b.landed) { b.vy = Math.max(-26, b.vy - 14 * dt); b.m.position.y += b.vy * dt; b.m.position.x += Math.sin(a * 3 + b.sway) * 3 * dt;
        b.m.rotation.x += b.spin[0] * dt; b.m.rotation.y += b.spin[1] * dt; b.m.rotation.z += b.spin[2] * dt;
        if (b.m.position.y <= 0.3 * b.s) { b.m.position.y = 0.3 * b.s; if (Math.abs(b.vy) > 7) { b.vy = -b.vy * 0.3; b.spin = b.spin.map(x => x * 0.5); } else { b.landed = true; b.m.rotation.x = Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1); } } }
      if (a > 3.4) b.m.scale.setScalar(Math.max(0.001, b.s * (1 - (a - 3.4) / 0.6)));
      if (a > 4.0) { scene.remove(b.m); bananas.splice(k, 1); } } }

  /* ---------- fireworks ---------- */
  const fw = [];
  function firework(x, y, z) { const n = still ? 40 : 160, pos = new Float32Array(n * 3), vel = [], col = new THREE.Color(pick([0xffd23f, 0xf28c38, 0xffffff, 0xff5a5a, 0x7bdcff, 0xb26bff]));
    for (let i = 0; i < n; i++) { pos.set([x, y, z], i * 3); const u = Math.random() * 2 - 1, a = Math.random() * 6.28, r = Math.sqrt(1 - u * u), sp = rnd(28, 48); vel.push([r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: 5, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    scene.add(m); fw.push({ m, vel, age: 0 }); Sound.boom(); }
  function updateFw(dt) { for (let k = fw.length - 1; k >= 0; k--) { const f = fw[k]; f.age += dt; const a = f.m.geometry.attributes.position;
      for (let i = 0; i < f.vel.length; i++) { const v = f.vel[i]; v[1] -= 18 * dt; v[0] *= 0.985; v[1] *= 0.985; v[2] *= 0.985; a.array[i * 3] += v[0] * dt; a.array[i * 3 + 1] += v[1] * dt; a.array[i * 3 + 2] += v[2] * dt; }
      a.needsUpdate = true; f.m.material.opacity = Math.max(0, 1 - f.age / 2.2); if (f.age > 2.2) { scene.remove(f.m); f.m.geometry.dispose(); fw.splice(k, 1); } } }

  /* ---------- game state ---------- */
  let hr = 0, outs = 0, streak = 0, bestStreak = 0, longest = 0, total = 0, strikes = 0, hitRun = 0, bestRun = 0;
  let hits = 0, doubles = 0, balls = 0, takes = 0, chases = 0, early = 0, late = 0;
  let phase = 'intro', pt = 0, P = null, sw = null, hit = null, over = false, timeScale = 1, shakeT = 0, introT = 0, camMode = 'intro', flashT = 9, arcT = 9;
  const dbg = { p: new THREE.Vector3(), l: new THREE.Vector3() }, camPos = new THREE.Vector3(0, 160, -300), camLook = new THREE.Vector3(0, 0, -60);
  drawBoard();
  if (AB) outs = SIT.outs;
  const setOuts = () => { [...outsEl.children].forEach((d, i) => d.classList.toggle('on', i < outs)); $('d3-hr').textContent = hr; if (AB) { $('d3-cnt').textContent = abB + '–' + abS; return; }
    if (STREAK) { $('d3-hits').textContent = hits + hr; $('d3-k').textContent = strikes; $('d3-long').textContent = bestRun || '–'; }
    else $('d3-long').textContent = longest ? longest + ' ft' : '–';
    const run = STREAK ? hitRun : streak, st = $('d3-streak'); st.textContent = run >= 2 ? (run >= 3 ? '🔥 ON FIRE ×' + run : run + (STREAK ? ' HITS IN A ROW' : ' IN A ROW')) : ''; st.classList.toggle('on', run >= 2); };
  setOuts();
  let callTimer = 0, call = null;
  let shotReq = null, contactImg = null, contactAt = 0;
  function callout(main, sub, cls) { const w = wantShot(main, sub, cls); if (w && contactImg) { try { window.__dhHLimg && window.__dhHLimg(contactImg, main, sub); } catch (e) {} } else if (w) shotReq = Object.assign(w, { at: T + 0.3 }); const c = $('d3-call'); c.className = 'd3call js ' + (cls || ''); c.innerHTML = '<b>' + main + '</b>' + (sub ? '<span>' + sub + '</span>' : ''); call = { t0: T, dur: cls === 'hr' ? 2.6 : 1.6 }; }
  function callFrame() { const c = $('d3-call'); if (!call) { c.style.opacity = 0; return; } const k = (T - call.t0) / call.dur; if (k >= 1) { call = null; c.style.opacity = 0; return; }
    const sc = k < 0.12 ? lerp(0.3, 1.08, k / 0.12) : k < 0.2 ? lerp(1.08, 1, (k - 0.12) / 0.08) : 1, op = k < 0.08 ? k / 0.08 : k > 0.8 ? (1 - k) / 0.2 : 1, dy = k > 0.8 ? (k - 0.8) / 0.2 * -10 : 0;
    c.style.opacity = op; c.style.transform = 'translate(-50%,' + (-50 + dy) + '%) scale(' + sc + ')'; }
  function tip(t) { $('d3-tip').textContent = t; }

  const jobs = []; const later = (sec, fn) => jobs.push({ at: T + sec, fn });
  function newPitch() {
    if (P && !P.strike) balls++;
    const kind = pick(KINDS), mph = Math.round((kind === 'fast' ? rnd(47, 56) : kind === 'change' ? rnd(38, 43) : rnd(40, 46)) + (level === 3 ? 5 : 0));
    const strike = Math.random() < (AB && SIT.ctl != null ? SIT.ctl : level === 1 ? 0.88 : 0.78);
    let x = rnd(-0.55, 0.55), h = rnd(1.8, 3.1);
    if (!strike) { if (Math.random() < 0.5) x = pick([-1, 1]) * rnd(1.15, 1.6); else h = pick([rnd(0.8, 1.2), rnd(3.75, 4.2)]); }
    P = { kind, mph, x, h, T: 44 / (mph * 1.4667) * SLOW * (kind === 'change' ? 1.1 : 1), t: 0, drop: kind === 'curve' ? 1.5 : kind === 'change' ? 0.55 : 0, brk: kind === 'curve' ? -0.9 : 0,
      strike: Math.abs(x) <= 0.85 && h >= 1.55 && h <= 3.45, from: new THREE.Vector3() };
    sw = null; hit = null; $('d3-pitch').classList.remove('show');
  }
  const ballAt = (p, out) => { const q = Math.min(p, 1.35), z = lerp(P.from.z, 0, q) + (p > 1 ? -(p - 1) * 0 : 0);
    const x = lerp(P.from.x, P.x, q) + P.brk * Math.sin(Math.PI * Math.min(q, 1)) * 0.6, y = lerp(P.from.y, P.h + P.drop, q) - P.drop * q * q;
    return out.set(x, y, p > 1 ? (p - 1) * (3.2 / 0.35) * 0.35 + 0 : z); };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function swing(sx, sy) {
    if (over || sw || !(phase === 'pitch' || (phase === 'wind' && pt > 0.75))) return;
    Sound.whoosh(); arcT = 0;
    // where on the plate did he aim? cast the tap onto the plate's plane
    const r = renderer.domElement.getBoundingClientRect(), ndc = new THREE.Vector2((sx - r.left) / r.width * 2 - 1, -(sy - r.top) / r.height * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, cam); const hitP = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP);
    let aimH = clamp(hitP ? hitP.y : 2.5, 0.6, 4.4); if (level === 1 && P) aimH = P.h + gauss() * 0.15;
    sw = { t: 0, h: aimH }; cursor.position.set(clamp(hitP ? hitP.x : 0, -2, 2), aimH, 0.1); cursor.material.opacity = 0.9; cursor.scale.setScalar(1);
    if (phase === 'wind') { early++; result('whiff', 'Way too early!'); return; }
    if (!P.strike) chases++;
    const e = (P.t - P.T) * 1000 / SLOW * 1.2, v = aimH - P.h, a = Math.abs(e);
    if (a > WIN * 1.6) { if (e < 0) early++; else late++; }
    if (a > WIN * 1.6 || Math.abs(v) > AIMTOL) { sw.miss = true; result('whiff', a > WIN * 1.6 ? (e < 0 ? 'Swung too early!' : 'Swung too late!') : (v > 0 ? 'Swung over it!' : 'Swung under it!')); return; }
    let q = 1 - 0.7 * Math.pow(Math.min(1, a / (WIN * 1.6)), 1.5) - 0.55 * Math.pow(Math.min(1, Math.abs(v) / AIMTOL), 1.3);
    if (!P.strike) q -= 0.25;
    // Early swing pulls it, late goes the other way; inside pitches get pulled, outside pitches go the other way.
    const nrm = () => gauss() * 3;   // about one standard deviation
    const ev = clamp(31 + 40 * q + EVB + nrm() * 5, 25, 86), la = clamp(16 - v * 34 + nrm() * 13, -25, 75), spray0 = clamp(-e / WIN, -1.6, 1.6) * 32 * side + P.x * 16 + nrm() * 13;
    // weak contact is often fouled off to the side or straight back
    const spray = Math.random() < (q < 0.55 ? 0.55 : q < 0.8 ? 0.22 : 0.03) ? (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 60) : spray0;
    const v0 = ev * 1.4667;
    ballAt(P.t / P.T, ball.position);
    hit = playOut(ball.position.clone(), new THREE.Vector3(Math.sin(spray * D2R) * Math.cos(la * D2R) * v0, Math.sin(la * D2R) * v0, -Math.cos(spray * D2R) * Math.cos(la * D2R) * v0), Math.round(ev), la);
    trailPos.length = 0; ballGlow.material.opacity = 0.85;
    if (typeof window.__dhHL === 'function') { contactImg = null; contactAt = T + 0.1; }
    Sound.crack(); shakeT = ev > 70 ? 0.25 : 0.15; flashT = 0; flash.position.copy(ball.position);
    phase = 'flight'; pt = 0; camMode = 'flight'; tip(''); showSpot();
  }
  const POS = ['first baseman', 'second baseman', 'shortstop', 'third baseman', 'left fielder', 'center fielder', 'right fielder'];
  // Fly the ball with air drag, bounces, rolling and the fence. Samples every 1/60 s.
  function simulate(p0, v0) {
    const p = p0.clone(), v = v0.clone(), H = 1 / 240, pts = [p.clone()];
    let t = 0, land = null, over = null, overP = null, wall = false, wallT = 0, peak = 0;
    for (let n = 0; n < 240 * 9; n++) {
      const sp = v.length(), k = 0.0012;
      if (p.y > 0.26 || v.y > 0) { v.x -= k * sp * v.x * H; v.z -= k * sp * v.z * H; v.y -= (32.2 + k * sp * v.y) * H; }
      else { const hs = Math.hypot(v.x, v.z); if (hs > 0) { const f = Math.max(0, hs - 16 * H) / hs; v.x *= f; v.z *= f; } }
      p.addScaledVector(v, H); t += H; peak = Math.max(peak, p.y);
      const dxz = Math.hypot(p.x, p.z), ang = Math.atan2(p.x, -p.z) / D2R;
      if (!over && p.z < 0 && Math.abs(ang) <= 46 && dxz >= fence(ang) - 0.5) {
        if (p.y > 8.8 && !wall) { over = { t, dist: carry(p, v) }; overP = p.clone(); }
        else { p.multiplyScalar((fence(ang) - 0.7) / dxz); const nx = p.x / dxz, nz = p.z / dxz, dot = v.x * nx + v.z * nz; if (dot > 0) { v.x -= 1.55 * dot * nx; v.z -= 1.55 * dot * nz; } if (!wall) { wall = true; wallT = t; } }
      }
      if (over) { const st = 10 + Math.max(0, dxz - fence(clamp(ang, -45, 45)) - 16) * 0.66; if (p.y < st && dxz > fence(clamp(ang, -45, 45)) + 14) { pts.push(p.clone()); break; } }
      if (p.y <= 0.25 && !over) { if (!land) land = { t, p: p.clone() }; p.y = 0.25; if (v.y < 0) { v.y = -v.y * 0.32; v.x *= 0.74; v.z *= 0.74; if (v.y < 2.5) v.y = 0; } }
      if (n % 4 === 3) pts.push(p.clone());
      if (land && v.y === 0 && Math.hypot(v.x, v.z) < 1.2) break;
    }
    return { pts, step: 4 * H, land, over, overP, wall, wallT, peak, end: t };
  }
  const pathAt = (sim, t, out) => { const f = t / sim.step, n = sim.pts.length, i0 = Math.min(Math.floor(f), n - 1), i1 = Math.min(i0 + 1, n - 1); return out.copy(sim.pts[i0]).lerp(sim.pts[i1], clamp(f - i0, 0, 1)); };
  // Decide what happens: home run, foul, caught, ground out, or a real hit.
  function playOut(p0, v0, ev, la) {
    const sim = simulate(p0, v0), n = sim.pts.length, step = sim.step, ang = q => Math.atan2(q.x, -q.z) / D2R;
    const h = { ev, la, sim, t: 0, kind: null, fielder: null, catchT: null, catchP: null, resultAt: 0, said: false, dist: 0, chaser: null };
    if (sim.over && Math.abs(ang(sim.overP)) <= 45) { h.kind = 'hr'; h.dist = sim.over.dist; h.resultAt = sim.over.t; return h; }
    const rest = sim.pts[n - 1], landP = sim.land ? sim.land.p : rest;
    let judge = landP; if (la < 10 || (sim.land && Math.hypot(landP.x, landP.z) < 50)) { judge = rest; for (const q of sim.pts) if (Math.hypot(q.x, q.z) > 50) { judge = q; break; } }
    h.dist = Math.round(Math.hypot(landP.x, landP.z));
    if (judge.z > -1 || Math.abs(ang(judge)) > 45) { h.kind = 'foul'; h.resultAt = Math.min(sim.land ? sim.land.t + 0.2 : 1.2, 2); return h; }
    const ground = la < 10 || (sim.land && sim.land.t < 0.5);
    if (ground) {
      for (let i = 0; i < n; i++) { const q = sim.pts[i], ti = i * step; if (Math.hypot(q.x, q.z) > 120) break;
        for (let f = 0; f < 4; f++) { const d = fielders[f].home.distanceTo(tmp.set(q.x, 0, q.z)); if (q.y < 3 && 0.3 + d / 19 <= ti) {
          const sp = i + 1 < n ? sim.pts[i + 1].distanceTo(q) / step : 0; if (sp > 85 && d > 4) continue;   // smoked past him
          h.kind = 'groundout'; h.fielder = f; h.catchT = ti; h.catchP = q.clone(); h.resultAt = ti + 0.1;
          if (AB && f >= 1 && ti > 0.55 && Math.random() < clamp((SPD - 45) / 180, 0.03, 0.3)) { h.kind = 'hit'; h.hitName = 'INFIELD HIT'; h.where = 'Beat the throw'; h.fielder = null; h.catchT = null; h.dist = Math.round(Math.hypot(q.x, q.z)); }
          return h; } } }
      let tPass = sim.end; for (let i = 0; i < n; i++) if (Math.hypot(sim.pts[i].x, sim.pts[i].z) > 120) { tPass = i * step; break; }
      h.kind = 'hit'; h.hitName = 'SINGLE'; h.where = Math.abs(ang(rest)) > 25 ? 'Down the line' : 'Through the infield'; h.dist = Math.round(Math.hypot(rest.x, rest.z)); h.resultAt = Math.min(tPass, 2.2); return h;
    }
    // ball in the air: can someone get there in time?
    const tl = sim.land ? sim.land.t : sim.end;
    if (!(sim.wall && sim.wallT < tl)) {
      let best = -1, bt = 1e9;
      fielders.forEach((f, i) => { const d = f.home.distanceTo(tmp.set(landP.x, 0, landP.z)), need = 0.4 + d / (i >= 4 ? 24 : 19); if (need < bt) { bt = need; best = i; } });
      if (bt <= tl + (la < 20 ? 0.25 : 0.15)) { h.kind = 'caught'; h.fielder = best; h.catchT = Math.max(0.35, tl - 0.08); h.catchP = pathAt(sim, h.catchT, new THREE.Vector3()); h.resultAt = h.catchT; return h; }
    }
    const a = Math.abs(ang(landP));
    h.kind = 'hit'; h.resultAt = sim.wall ? Math.min(sim.wallT, tl) + 0.1 : tl;
    if (sim.wall) { h.hitName = a > 28 && Math.random() < 0.3 ? 'TRIPLE' : 'DOUBLE'; h.where = 'Off the wall'; h.dist = Math.round(fence(clamp(ang(landP), -45, 45))); }
    else if (h.dist > 175 && a > 12 && a < 36) { h.hitName = 'DOUBLE'; h.where = 'In the gap'; }
    else { h.hitName = 'SINGLE'; h.where = h.dist < 110 ? 'Blooper' : a > 30 ? 'Down the line' : 'Base hit'; }
    return h;
  }
  // Where the ball would have landed with no stands in the way.
  function carry(p0, v0) { const p = p0.clone(), v = v0.clone(), h = 1 / 120; for (let i = 0; i < 2000 && p.y > 0; i++) { const sp = v.length(), k = 0.0012; v.x -= k * sp * v.x * h; v.z -= k * sp * v.z * h; v.y -= (32.2 + k * sp * v.y) * h; p.addScaledVector(v, h); } return Math.round(Math.hypot(p.x, p.z)); }
  function abEnd(code, main, sub, cls, extra) {
    over = true; abRes = Object.assign({ code, text: main + (sub ? ' · ' + sub : ''), ev: hit ? hit.ev : null, dist: hit ? hit.dist : null, pitches: abB + abS }, extra || {});
    callout(main, sub, cls); say(main + (sub ? '. ' + sub : '')); setOuts();
    later(code === 'HR' ? 3.4 : 2.4, () => { if (alive && cfg.ab.onDone) cfg.ab.onDone(abRes); });
  }
  function abResult(kind, text, sub) {
    const cnt = () => abB + '–' + abS;
    if (kind === 'ball') { abB++; if (abB >= 4) { Sound.blip(true); return abEnd('BB', 'BALL FOUR', 'Take your base', 'hit'); } callout('BALL ' + abB, 'Count ' + cnt(), 'ball'); Sound.blip(true); say('Ball ' + abB + '. ' + cnt()); setOuts(); return; }
    if (kind === 'look' || kind === 'whiff') { abS++; if (abS >= 3) { if (kind === 'look') Sound.say('Strike three!'); else Sound.blip(false); return abEnd('K', 'STRIKE THREE!', kind === 'look' ? 'Caught looking' : text, 'out'); }
      callout(kind === 'look' ? 'STRIKE ' + abS : text, 'Count ' + cnt(), 'ball'); if (kind === 'look') Sound.say('Strike!'); else Sound.blip(false); say((kind === 'look' ? 'Strike ' + abS : text) + '. ' + cnt()); setOuts(); return; }
    if (kind === 'foul') { if (abS < 2) abS++; callout('FOUL BALL', 'Count ' + cnt(), 'ball'); Sound.ooh(); say('Foul ball. ' + cnt()); setOuts(); return; }
    if (kind === 'hr') { hr++; Sound.cheer(); crowd.cheer(1); later(0.7, () => Sound.organ()); for (let i = 0; i < 7; i++) later(0.3 + i * 0.3, () => { if (alive) firework(rnd(-120, 120), rnd(90, 150), -fence(0) - rnd(20, 90)); });
      drawBoard('HOME RUN!'); return abEnd('HR', 'HOME RUN!', hit.dist + ' FT · ' + hit.ev + ' MPH', 'hr'); }
    if (kind === 'hit') { const code = text === 'DOUBLE!' ? '2B' : text === 'TRIPLE!' ? '3B' : '1B'; Sound.cheer(); crowd.cheer(code === '1B' ? 0.5 : 0.8); return abEnd(code, text, sub, 'hit'); }
    Sound.ooh(); return abEnd('OUT', text, sub, 'out', { out: hit && hit.kind === 'groundout' ? 'ground' : hit && hit.la != null && hit.la < 18 ? 'line' : 'fly', fielder: hit && hit.fielder });
  }
  function result(kind, text, sub) {
    if (phase !== 'flight') { phase = 'after'; pt = 0; }
    if (AB) return abResult(kind, text, sub);
    if (STREAK) {   // Hit Streak rules: strikes add up, any hit keeps the run going
      if (kind === 'hr' || kind === 'hit') { strikes = 0; hitRun++; bestRun = Math.max(bestRun, hitRun); }
      if (kind === 'hit') { bananaRain(); later(0.05, () => drawBoard()); }
      if (kind === 'hr') later(2.8, () => drawBoard());
      if (kind === 'look' || kind === 'whiff') { strikes++; if (strikes < 3) { callout(kind === 'look' ? 'STRIKE ' + strikes : text, 'Strike ' + strikes + ' · ' + (3 - strikes) + ' left', 'ball'); if (kind === 'look') Sound.say('Strike!'); else Sound.blip(false); say(text + ' Strike ' + strikes + '.'); setOuts(); return; }
        strikes = 0; text = 'STRIKE THREE!'; }
      if (kind === 'foul') { if (strikes < 2) strikes++; callout('FOUL BALL', 'Strike ' + strikes + ' · keep swinging', 'ball'); Sound.ooh(); say('Foul ball.'); setOuts(); return; }
      if (kind !== 'hr' && kind !== 'hit' && kind !== 'ball') { strikes = 0; hitRun = 0; }
    }
    if (kind === 'hr') {
      hr++; streak++; bestStreak = Math.max(bestStreak, streak); longest = Math.max(longest, hit.dist); total += hit.dist;
      Sound.cheer(); crowd.cheer(1); if (streak === 3) later(0.7, () => Sound.organ());
      callout('HOME RUN!', hit.dist + ' FT · ' + hit.ev + ' MPH', 'hr'); drawBoard('HOME RUN!');
      for (let i = 0; i < 6; i++) later(0.3 + i * 0.32, () => { if (!over) firework(rnd(-120, 120), rnd(90, 150), -fence(0) - rnd(20, 90)); });
      say('Home run! ' + hit.dist + ' feet. ' + hr + ' home runs, ' + outs + ' outs.');
    } else if (kind === 'ball') { callout('BALL', 'Good eye! No out.', 'ball'); Sound.blip(true); say('Ball. Good eye, no out.'); }
    else if (kind === 'hit') { hits++; if (text !== 'SINGLE!') doubles++; streak = 0; callout(text, STREAK ? sub + ' · ' + (hits + hr) + (hits + hr === 1 ? ' hit' : ' hits') : sub + ' · No out', 'hit'); Sound.cheer(); crowd.cheer(0.4); say(text + ' ' + sub + (STREAK ? '. ' + (hits + hr) + (hits + hr === 1 ? ' hit.' : ' hits.') : '. No out.')); }
    else if (kind === 'foul') { streak = 0; callout('FOUL BALL', 'No out · keep swinging', 'ball'); Sound.ooh(); say('Foul ball. No out.'); }
    else { outs++; streak = 0; callout(text, (sub ? sub + ' · ' : '') + 'OUT ' + outs + ' OF ' + OUTMAX, 'out');
      if (kind === 'look') Sound.say('Strike!'); else if (kind === 'whiff') Sound.blip(false); else Sound.ooh();
      say(text + ' Out ' + outs + ' of ' + OUTMAX + '.'); drawBoard(); }
    setOuts();
  }

  /* ---------- input ---------- */
  const cv = renderer.domElement;
  const onDown = e => { e.preventDefault(); Sound.unlock(); if (phase === 'intro') return; swing(e.clientX, e.clientY); };
  cv.addEventListener('pointerdown', onDown);
  const onKey = e => { if ((e.key === ' ' || e.key === 'Enter') && phase !== 'intro' && document.activeElement !== $('d3-go')) { e.preventDefault(); if (P) { const p = tmp.set(0, P.h, 0).project(cam), r = cv.getBoundingClientRect(); swing(r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height); } } };
  window.addEventListener('keydown', onKey);
  $('d3-go').addEventListener('click', () => { Sound.unlock(); $('d3-intro').classList.add('gone'); phase = 'gap'; pt = 0.3; camMode = 'toBat'; introT = 0; cv.focus(); tip(level === 1 ? 'Tap when the ball hits the box' : 'Tap on the ball when it reaches the box'); });
  $('d3-go').focus();

  /* ---------- sizing ---------- */
  const fit = () => { const r = wrap.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.fov = cam.aspect < 0.8 ? 56 : cam.aspect < 1.2 ? 48 : 40; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(fit); ro.observe(wrap); const AQ = autoQuality(renderer, sun, fit);

  /* ---------- main loop ---------- */
  let last = performance.now(), raf = 0, alive = true, T = 0, fpsAcc = 0, fpsN = 0, fpsNow = 0; const FIXED = /d3test|d3rec/.test(location.search) ? 1 / 30 : 0;
  const lookNow = new THREE.Vector3().copy(camLook);
  const MANUAL = /d3rec/.test(location.search);   // recording: the test steps frames one at a time
  function frame() { if (!alive) return; if (!MANUAL) raf = requestAnimationFrame(frame); tick(); }
  function tick() {
    if (window.__d3auto && (window.__d3auto !== 'eye' || P && P.strike) && phase === 'pitch' && P && !sw && P.t >= P.T * 0.99) { const p = tmp.set(0, P.h, 0).project(cam), r = cv.getBoundingClientRect(); swing(r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height); }
    const now = performance.now(); AQ.frame(now); const now_ = now, rdt = FIXED || Math.min(0.05, (now - last) / 1000), dt = rdt * timeScale; last = now; T += rdt; pt += dt; fpsAcc += rdt; fpsN++; if (fpsAcc > 1) { fpsNow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    crowd.update(T, rdt); updateFw(rdt); updateBananas(rdt); callFrame(); for (let i = jobs.length - 1; i >= 0; i--) if (T >= jobs[i].at) { const j = jobs[i]; jobs.splice(i, 1); j.fn(); }
    // fielders idle
    if (!GLB) fielders.forEach((f, i) => { f.root.position.y = Math.abs(Math.sin(T * 2 + i)) * 0.05; });

    if (phase === 'gap' && pt > 0.9 && AB && over) {}
    else if (phase === 'gap' && pt > 0.9) { if (outs >= OUTMAX) { over = true; phase = 'end'; later(0.6, finishGame); } else { newPitch(); phase = 'wind'; pt = 0; setPose(J, BP.stance); setBat(BP.stance); } }
    if (phase === 'wind') {
      playKeys(P1, PK, pt);
      setPose(J, BP.stance, BP.load, clamp((pt - 0.4) / 0.5, 0, 1)); setBat(BP.stance, BP.load, clamp((pt - 0.4) / 0.5, 0, 1));
      if (pt >= 0.82) { P.from.copy(P1.parts.handR.getWorldPosition(tmp)); phase = 'pitch'; P.t = 0; ball.visible = true; const pe = $('d3-pitch'); pe.innerHTML = '<b>' + P.mph + '</b><span>MPH</span><i>' + NAMES[P.kind] + '</i>'; pe.classList.add('show'); }
    }
    if (phase === 'pitch') {
      playKeys(P1, PK, 0.82 + P.t); P.t += dt; const p = P.t / P.T;
      ballAt(p, ball.position); ball.rotation.x += dt * 30;
      if (level === 1 && p > 0.45 && p < 1) { aimRing.position.set(P.x, P.h, 0.05); aimRing.material.opacity = 0.85 * Math.min(1, (p - 0.45) * 4); } else aimRing.material.opacity = 0;
      if (!catcher.h) catcher.parts.shL.rotation.x = lerp(catcher.parts.shL.rotation.x, -1.2 - (P.h - 2.5) * 0.4, 0.15);
      if (p > 1.08 && !sw) { if (!P.strike) takes++; ball.visible = false; Sound.pop(); aimRing.material.opacity = 0; showSpot(); result(P.strike ? 'look' : 'ball', P.strike ? 'Strike looking!' : ''); }
      else if (p > 1.08 && sw && sw.miss && ball.visible) { ball.visible = false; Sound.pop(); showSpot(); }
    }
    // swing animation
    if (sw) { sw.t += rdt; const k = sw.t; const a = k < 0.1 ? [BP.load, BP.contact, k / 0.1] : [BP.contact, BP.finish, Math.min(1, (k - 0.1) / 0.25)]; setPose(J, a[0], a[1], a[2]); setBat(a[0], a[1], a[2]); }
    if (arcT < 0.35) { arcT += rdt; arcMat.opacity = Math.max(0, 0.55 * (1 - arcT / 0.35)); arcMesh.position.set(side * 2.6, 3.0, 0.2); arcMesh.rotation.z = side > 0 ? 0 : Math.PI; } else arcMat.opacity = 0;
    spotT += rdt; spot.material.opacity = spotDot.material.opacity = spotT < 1.4 ? 0.95 : Math.max(0, 0.95 - (spotT - 1.4) * 2);
    cursor.material.opacity = Math.max(0, cursor.material.opacity - rdt * 1.6); cursor.scale.multiplyScalar(1 + rdt * 0.8);
    if (flashT < 0.4) { flashT += rdt; const k = flashT / 0.4; flash.material.opacity = 1 - k; flash.scale.setScalar(2 + k * 7); } else flash.material.opacity = 0;

    if (phase === 'flight') {
      hit.t += dt;
      const held = hit.catchT != null && hit.t >= hit.catchT;
      if (held) fielders[hit.fielder].parts.handL.getWorldPosition(ball.position); else pathAt(hit.sim, hit.t, ball.position);
      ball.rotation.x += dt * 40; ball.scale.setScalar(Math.max(1, cam.position.distanceTo(ball.position) / 40));
      if (!held) { trailPos.unshift(ball.position.clone()); if (trailPos.length > TR) trailPos.pop(); }
      trail.forEach((m, i) => { const q = trailPos[i]; m.visible = !!q && i > 0 && !held; if (q) { m.position.copy(q); m.material.opacity = (1 - i / TR) * 0.6; m.material.color.setHex(streak >= 2 ? 0xff8a2a : 0xffffff); m.scale.setScalar((1 - i / TR * 0.6) * Math.max(1, cam.position.distanceTo(q) / 40)); } });
      shadowBlob.visible = !held; shadowBlob.position.set(ball.position.x, 0.05, ball.position.z); shadowBlob.scale.setScalar(1 + ball.position.y * 0.02);
      // fielders: the one making the play runs to the spot and gets there just in time
      const runPose = (f, k) => { const r = Math.sin(T * 14); setPose(f, { run: 1, y: -0.12, torso: [0.3, 0, 0], shL: [r * 1.1, 0, -0.2], elL: [-1.3, 0, 0], shR: [-r * 1.1, 0, 0.2], elR: [-1.3, 0, 0], hipL: [-r * 0.9, 0, 0], knL: [0.6 + r * 0.4, 0, 0], hipR: [r * 0.9, 0, 0], knR: [0.6 - r * 0.4, 0, 0] }); };
      const face = (f, x, z) => { f.root.lookAt(x, 0, z); f.root.rotation.y += Math.PI; };
      if (hit.fielder != null) { const f = fielders[hit.fielder], k = clamp((hit.t - 0.3) / Math.max(0.1, hit.catchT - 0.3), 0, 1);
        if (k < 1) { f.root.position.lerpVectors(f.home, tmp.set(hit.catchP.x, 0, hit.catchP.z), k); face(f, hit.catchP.x, hit.catchP.z); runPose(f); }
        else setPose(f, { hold: 'catch', y: -0.15, torso: [0.2, 0, 0], shL: [-2.4, 0, -0.3], elL: [-0.4, 0, 0], shR: [-0.6, 0, 0.3], elR: [-1, 0, 0], hipL: [-0.3, 0, 0], knL: [0.4, 0, 0], hipR: [-0.3, 0, 0], knR: [0.4, 0, 0] }); }
      else if (hit.kind === 'hit') {   // closest fielder chases it down
        if (hit.chaser == null) { let bd = 1e9; fielders.forEach((f, i) => { const d = f.home.distanceTo(tmp.set(hit.sim.pts[hit.sim.pts.length - 1].x, 0, hit.sim.pts[hit.sim.pts.length - 1].z)); if (d < bd) { bd = d; hit.chaser = i; } }); }
        const f = fielders[hit.chaser]; tmp.set(ball.position.x, 0, ball.position.z).sub(f.root.position); const d = tmp.length();
        if (d > 1.5 && hit.t > 0.3) { f.root.position.addScaledVector(tmp.normalize(), Math.min(d, 21 * dt)); face(f, ball.position.x, ball.position.z); runPose(f); }
      }
      if (hit.kind === 'hr' && !hit.slow && hit.t >= hit.resultAt - 0.35) { hit.slow = true; timeScale = still ? 1 : 0.35; later(0.9, () => { timeScale = 1; }); }
      if (!hit.said && hit.t >= hit.resultAt) { hit.said = true;
        if (hit.kind === 'hr') result('hr');
        else if (hit.kind === 'caught') result('out', hit.sim.peak > 60 && hit.dist < 130 ? 'POP OUT' : hit.la < 18 ? 'LINE OUT' : 'CAUGHT!', 'By the ' + POS[hit.fielder] + ' · ' + hit.dist + ' ft');
        else if (hit.kind === 'groundout') result('out', 'GROUND OUT', 'To the ' + POS[hit.fielder]);
        else if (hit.kind === 'foul') result('foul');
        else result('hit', hit.hitName + '!', hit.where + ' · ' + hit.dist + ' ft'); }
      if (hit.said && hit.t >= hit.resultAt + (hit.kind === 'hr' ? 2.8 : hit.kind === 'hit' ? 1.8 : 1.3)) { phase = 'after'; pt = 0; }
    }
    if (phase === 'after') {
      const wait = hit ? 0.3 : 1.1;
      if (pt > wait) { ball.visible = false; ball.scale.setScalar(1); ballGlow.material.opacity = 0; shadowBlob.visible = false; trail.forEach(m => { m.visible = false; }); hit = null; sw = null;
        fielders.forEach(f => { f.root.position.copy(f.home); f.root.lookAt(0, 0, 0); f.root.rotation.y += Math.PI; setPose(f, READY); }); drawBoard(); camMode = 'bat'; phase = 'gap'; pt = 0; }
    }

    // camera: fly-in at the start, batting view, then chase the ball on contact
    if (camMode === 'intro') { introT += rdt; const a = introT * 0.12; camPos.set(Math.sin(a) * 260, 140, -120 + Math.cos(a) * 260); camLook.set(0, 0, -90); }
    else if (camMode === 'toBat') { introT += rdt; const k = ease(Math.min(1, introT / 1.8)); camPos.lerp(BAT_CAM.pos, k * 0.18 + 0.02); camLook.lerp(BAT_CAM.look, k * 0.18 + 0.02); if (introT > 2.2) camMode = 'bat'; }
    else if (camMode === 'bat') { camPos.lerp(BAT_CAM.pos, 0.12); camLook.lerp(BAT_CAM.look, 0.12); }
    else if (camMode === 'debug') { camPos.copy(dbg.p); camLook.copy(dbg.l); }
    else if (camMode === 'flight' && hit) {
      // TV view: high behind home plate, drifting toward where the ball is going, always looking at the ball
      const d = Math.hypot(ball.position.x, ball.position.z), k = clamp(d / 220, 0, 1);
      const want = tmp.set(ball.position.x * 0.25, 22 + k * 30, 34 - k * 40);
      camPos.lerp(want, 0.06); camLook.lerp(ball.position, 0.3);
    }
    cam.position.copy(camPos);
    if (shakeT > 0 && !still) { shakeT -= rdt; cam.position.x += (Math.random() - 0.5) * 0.5; cam.position.y += (Math.random() - 0.5) * 0.5; }
    lookNow.lerp(camLook, camMode === 'flight' ? 0.4 : 1); if (camMode === 'debug') lookNow.copy(camLook); cam.lookAt(lookNow);
    renderer.render(scene, cam);
    if (contactAt && T >= contactAt) { contactAt = 0; contactImg = shotOf(renderer.domElement); }
    if (shotReq && T >= shotReq.at) { const q = shotReq; shotReq = null; const img = shotOf(renderer.domElement); try { img && window.__dhHLimg && window.__dhHLimg(img, q.main, q.sub); } catch (e) {} }
  }
  frame();

  function finishGame() {
    if (P && !P.strike) balls++;
    const tip = chases >= 3 ? 'Coach tip: you chased ' + chases + ' balls. Only swing at strikes. A ball you take can\u2019t get you out.'
      : early > late + 1 ? 'Coach tip: you were early ' + early + ' times. Let the ball travel a little longer before you swing.'
      : late > early + 1 ? 'Coach tip: you were late ' + late + ' times. Start your load when the pitcher\u2019s arm goes back.'
      : 'Coach tip: early swings get pulled, late swings go the other way. Use it!';
    if (STREAK) {
      const tot = hits + hr;
      end(tot, [tot + (tot === 1 ? ' hit!' : ' hits!') + ' (' + (tot - hr) + ' base hit' + (tot - hr === 1 ? '' : 's') + ', ' + hr + ' home run' + (hr === 1 ? '' : 's') + ')',
        'Longest hit run: ' + bestRun + ' in a row' + (doubles ? ' · Extra-base hits: ' + doubles : ''),
        'Good eye: took ' + takes + ' of ' + balls + ' balls' + (chases ? ' · chased ' + chases : ' · no chases!'), tip]);
      return;
    }
    end(hr, [hr + ' home run' + (hr === 1 ? '' : 's') + '!', 'Longest: ' + (longest || 0) + ' ft \u00b7 Other hits: ' + hits + (doubles ? ' (' + doubles + ' for extra bases)' : ''),
      'Good eye: took ' + takes + ' of ' + balls + ' balls' + (chases ? ' \u00b7 chased ' + chases : ' \u00b7 no chases!'),
      bestStreak >= 2 ? 'Best streak: ' + bestStreak + ' in a row' : null, tip].filter(Boolean).concat(hr >= 8 ? ['Derby champion!'] : []));
  }
  function stop() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keydown', onKey);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} }
  // Test hook (only with ?d3test in the address): lets the automated tests read the pitch and swing on time.
  if (/d3test|d3rec|d3probe/.test(location.search)) window.__d3 = { get phase() { return phase; }, get P() { return P; }, get hr() { return hr; }, get hits() { return hits; }, get bananas() { return bananas.length; }, get strikes() { return strikes; }, get ab() { return { b: abB, s: abS, res: abRes }; }, get outs() { return outs; }, get fps() { return fpsNow; },
    setOuts: n => { outs = n; setOuts(); }, scene, J, catcher, ump, P1, step: n => { for (let i = 0; i < n; i++) tick(); }, go: () => $('d3-go').click(),
    cam: (x, y, z, lx, ly, lz) => { dbg.p.set(x, y, z); dbg.l.set(lx, ly, lz); camMode = 'debug'; },
    swingAt: (dms) => { const p = tmp.set(0, P.h, 0).project(cam), r = cv.getBoundingClientRect(); swing(r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height); } };
  say(AB ? SIT.line + '. Press Step In.' : 'Home Run Derby at Seed Spitters Park. Press Play Ball.');
  return { stop };
}
export function streak(cfg) { return start(Object.assign({}, cfg, { mode: 'streak' })); }
export function atbat(cfg) { return start(Object.assign({}, cfg, { mode: 'ab' })); }
