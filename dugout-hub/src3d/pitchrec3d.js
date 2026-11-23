// Pitch Reader: stand in the box and call the pitch (fastball, changeup, curve) as early as you can.
// Scoring per pitch: right call in the first 40% of the flight = 3 (elite read), by 65% = 2, before the plate = 1, wrong or too late = 0.
import { THREE, world, rnd, pick, clamp, lerp, BASE, SPITTERS, HORNETS, UMP, gearLook } from './park3d.js';
import { hudShell, safeSound } from './hud3d.js';

export function pitchrec(cfg) {
  const { stage, level, me, end, say } = cfg, Sound = safeSound(cfg.Sound);
  const N = 10, SLOW = [0, 1.6, 1.3, 1.1][level];
  const KINDS = level === 1 ? ['fast', 'change'] : ['fast', 'change', 'curve'];
  const NM = { fast: 'FASTBALL', change: 'CHANGEUP', curve: 'CURVEBALL' };
  const WHY = { fast: 'Fastball: tight backspin, the seams blur, and it gets on you fast.', change: 'Changeup: same arm speed, but it floats in slower and tumbles a little.',
    curve: 'Curveball: it pops up out of his hand, then dives. Look for the spin rolling forward.' };
  let n = 0, pts = 0, right = 0, phase = 'intro', pt = 0, P = null, over = false; const miss = { fast: 0, change: 0, curve: 0 }, seen = { fast: 0, change: 0, curve: 0 }; let sumRead = 0, nRead = 0;
  const lefty = me.bats !== 'right', side = lefty ? 1 : -1;

  const W = world({ stage, me, shadow: { x: 0, z: -20, r: 50 }, fov: a => a < 0.6 ? 40 : a < 0.8 ? 34 : a < 1.2 ? 30 : 26,
    hudHTML: hudShell({ team: 'SEED SPITTERS', sub: 'PITCH READER', top: true,
      cells: [['POINTS', 'r-pts'], ['PITCH', 'r-n'], ['RIGHT', 'r-ok'], ['READ', 'r-read']],
      kicker: 'SEED SPITTERS PARK', title: 'PITCH READER',
      lines: ['Watch the ball out of his hand. Tap FASTBALL, CHANGEUP' + (level === 1 ? '' : ' or CURVEBALL') + ' as early as you can.', 'Early and right = 3 points. Late = 1. Wrong = 0.', 'Big leaguers know the pitch before it’s halfway. Train your eyes!'],
      extra: '<div class="d3btns" id="r-btns"></div><div class="d3sit" id="r-why" style="display:none"></div>' }) });
  const { scene, cam, $ } = W;

  // you in the box (lefty), catcher, ump; Hornets pitcher
  const S = SPITTERS(me), GL = gearLook(me), bat = W.makeBat(GL.bat);
  const J = W.human(Object.assign({ mirror: lefty, helmet: true, skin: 0xf0c8a5, hair: 0x4a2e18, finish: GL.finish }, S, { colors: Object.assign({}, S.colors, GL.shoes != null ? { shoes: GL.shoes } : {}, GL.helmet != null ? { helmet: GL.helmet } : {}) })); scene.add(J.root); W.standInBox(J, bat);
  const C = W.human(Object.assign({ helmet: true, glove: true }, HORNETS(), { colors: Object.assign({}, HORNETS().colors, { helmet: 0x161616 }) })); C.root.position.set(0, 0, 3.2); C.root.scale.setScalar(0.92); C.set('crouch', 0); C.root.visible = false; scene.add(C.root);
  const U = W.human(UMP); U.root.position.set(-side * 2.3, 0, 7.6); U.root.rotation.y = -side * 0.18; U.set('ump', 0); scene.add(U.root);
  const P1 = W.human(Object.assign({ glove: true }, HORNETS(7))); P1.root.position.set(0, 0.55, -BASE + 0.6); P1.root.rotation.y = Math.PI; P1.set('pitch', 0); scene.add(P1.root);
  [[BASE + 6, -BASE - 10], [18, -2 * BASE + 4], [-18, -2 * BASE + 4], [-BASE - 6, -BASE - 10], [-95, -150], [0, -175], [95, -150]].forEach(([x, z]) => {
    const f = W.human(Object.assign({ lod: true, glove: true }, HORNETS())); f.root.position.set(x, 0, z); f.face(0, 0); f.set('ready', 0); scene.add(f.root); });

  // a real-looking ball: white leather with red stitches, so the spin shows
  const seamTex = W.canvasTex(512, 256, (g, Wd, H) => { g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, Wd, H);
    g.strokeStyle = '#c4262e'; g.lineWidth = 7; g.setLineDash([9, 6]);
    for (const off of [0, Math.PI]) { g.beginPath(); for (let x = 0; x <= Wd; x += 4) { const a = x / Wd * Math.PI * 2; const y = H / 2 + Math.sin(a * 2 + off) * H * 0.28; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } });
  W.ball.material.map = seamTex; W.ball.material.needsUpdate = true; W.ball.children[0].material.opacity = 0.25;
  const SPIN = new THREE.Vector3();

  // batter's eye camera: just behind and above the plate, looking out at the pitcher
  const CAM = { pos: new THREE.Vector3(-side * 0.5, 5.2, 10.5), look: new THREE.Vector3(0, 4.2, -BASE) };
  cam.position.copy(CAM.pos); cam.lookAt(CAM.look);

  const btns = $('r-btns');
  btns.innerHTML = KINDS.map(k => `<button type="button" class="d3btn" data-k="${k}"><b>${NM[k]}</b></button>`).join('');
  btns.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); callIt(b.dataset.k); }));
  const paint = () => { $('r-pts').textContent = pts; $('r-n').textContent = Math.min(n + 1, N) + '/' + N; $('r-ok').textContent = right;
    $('r-read').textContent = nRead ? Math.round(sumRead / nRead * 100) + '%' : '–'; btns.classList.toggle('hide', !(phase === 'wind' || phase === 'pitch'));
    W.drawBoard([['POINTS ' + pts, 120], ['PITCH READER · ' + right + ' RIGHT', 48, '#bbbbbb']]); };

  function newPitch() {
    const kind = pick(KINDS), mph = Math.round(kind === 'fast' ? rnd(48, 56) : kind === 'change' ? rnd(38, 43) : rnd(40, 46)) + (level === 3 ? 5 : 0);
    P = { kind, mph, x: rnd(-0.6, 0.6), h: rnd(1.9, 3.1), T: 44 / (mph * 1.4667) * SLOW * (kind === 'change' ? 1.1 : 1), t: 0, from: new THREE.Vector3(), call: null, at: null };
    // spin: fastball = fast backspin, change = slower tumble, curve = forward roll
    if (kind === 'fast') SPIN.set(-38, 0, 0); else if (kind === 'change') SPIN.set(-14, 6, 0); else SPIN.set(30, 0, 8);
    phase = 'wind'; pt = 0; $('r-why').style.display = 'none'; paint();
  }
  function callIt(k) {
    if (over || !P || P.call || !(phase === 'wind' || phase === 'pitch')) return;
    const p = phase === 'wind' ? 0 : P.t / P.T; P.call = k; P.at = p; Sound.tick();
    if (phase === 'wind') { W.callout('TOO SOON', 'Wait for the ball to leave his hand', 'out', 1.4); P.call = 'early'; }
    paint();
  }
  function judge() {
    seen[P.kind]++;
    let got = 0, main, sub, cls;
    if (P.call === P.kind) { got = P.at < 0.4 ? 3 : P.at < 0.65 ? 2 : 1; right++; sumRead += P.at; nRead++;
      main = got === 3 ? 'ELITE READ!' : got === 2 ? 'GOOD READ' : 'LATE READ'; sub = NM[P.kind] + ' · ' + P.mph + ' mph · +' + got; cls = got === 3 ? 'hr' : 'hit';
      if (got === 3) { Sound.cheer(); W.crowd.cheer(0.5); } else Sound.pop(); }
    else { miss[P.kind]++; main = P.call ? 'IT WAS A ' + NM[P.kind] : 'TOO LATE'; sub = P.call ? 'You called ' + (NM[P.call] || 'it too soon').toLowerCase() : NM[P.kind] + ' · ' + P.mph + ' mph'; cls = 'out'; Sound.ooh(); }
    pts += got; W.callout(main, sub, cls, 2.0); say(main + '. ' + sub);
    const why = $('r-why'); why.style.display = ''; why.innerHTML = '<b>' + WHY[P.kind].split(':')[0] + '</b><span>' + WHY[P.kind].split(':')[1].trim() + '</span>';
    phase = 'result'; pt = 0; paint();
  }
  W.cv.addEventListener('pointerdown', e => { e.preventDefault(); Sound.unlock(); });
  const onKey = e => { if (phase === 'intro') return; const k = { '1': 'fast', f: 'fast', '2': 'change', c: 'change', '3': 'curve', v: 'curve' }[e.key.toLowerCase()]; if (k && KINDS.indexOf(k) >= 0) callIt(k); };
  window.addEventListener('keydown', onKey); W.cleanups.push(() => window.removeEventListener('keydown', onKey));
  $('d3-go').addEventListener('click', () => { Sound.unlock(); $('d3-intro').classList.add('gone'); W.cv.focus(); newPitch(); });
  $('d3-go').focus();

  const tmp = new THREE.Vector3();
  W.run((dt, T) => {
    pt += dt;
    const tr = W.CAL.pitch.tr;
    if (phase === 'wind') { P1.set('pitch', pt * tr / 0.85); if (pt >= 0.85) { W.handPos(P1, P.from); W.ball.position.copy(P.from); W.ball.visible = true; phase = 'pitch'; P.t = 0; } }
    if (phase === 'pitch') {
      P1.set('pitch', tr + P.t); P.t += dt; const p = Math.min(1.1, P.t / P.T), q = Math.min(1, p);
      if (window.__d3auto && !P.call && p > 0.3) callIt(Math.random() < 0.8 ? P.kind : pick(KINDS));
      // flight: the curve "pops up" out of the hand, then dives late; the changeup sinks a little
      const hump = P.kind === 'curve' ? Math.sin(Math.PI * Math.min(1, q / 0.55)) * 0.9 * (q < 0.55 ? 1 : 0) : 0;
      const drop = P.kind === 'curve' ? 2.2 : P.kind === 'change' ? 0.7 : 0;
      W.ball.position.set(lerp(P.from.x, P.x, q) + (P.kind === 'curve' ? -side * 0.6 * Math.sin(Math.PI * q) : 0), lerp(P.from.y, P.h + drop, q) - drop * q * q + hump, lerp(P.from.z, 0.5, q));
      W.ball.rotation.x += SPIN.x * dt; W.ball.rotation.y += SPIN.y * dt; W.ball.rotation.z += SPIN.z * dt;
      W.ball.scale.setScalar(1.5);
      J.set('swing', clamp(q / 0.8, 0, 1) * Math.max(0, W.CAL.swing.tc - 0.22)); W.placeBat(J, bat);
      if (p >= 1.05) { W.ball.visible = false; Sound.pop(); judge(); }
    }
    if (phase === 'result' && pt > 2.6) { n++; P1.set('pitch', 0); J.set('swing', 0); W.placeBat(J, bat); if (n >= N) { over = true; phase = 'end'; W.later(0.3, finishGame); } else newPitch(); }
    cam.position.copy(CAM.pos); cam.lookAt(CAM.look);
  });
  J.set('swing', 0); W.placeBat(J, bat); paint();
  function finishGame() {
    const worst = Object.keys(seen).filter(k => seen[k]).sort((a, b) => miss[b] / seen[b] - miss[a] / seen[a])[0];
    const avgRead = nRead ? Math.round(sumRead / nRead * 100) : null;
    end(pts, [pts + ' points!', 'Right calls: ' + right + ' of ' + N + (avgRead != null ? ' · You read it ' + avgRead + '% of the way in (lower is better)' : ''),
      worst && miss[worst] ? 'The ' + NM[worst].toLowerCase() + ' fooled you most. ' + WHY[worst] : 'Every pitch read right. Try the next level!']);
  }
  if (/d3test|d3rec|d3probe/.test(location.search)) window.__d3 = { get phase() { return phase; }, get pts() { return pts; }, get n() { return n; }, get fps() { return W.fps; }, draw: () => W.renderer.render(scene, cam), scene, step: k => { for (let i = 0; i < k; i++) W.step(); }, go: () => $('d3-go').click() };
  say('Pitch Reader at Seed Spitters Park. Press Play Ball.');
  return { stop: W.stop };
}
