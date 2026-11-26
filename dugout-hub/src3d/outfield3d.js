// Outfield Hero in 3D: Jaxson in center field. Run under fly balls, dive, then make the right throw. Same rules as the flat version.
import { THREE, world, rnd, pick, clamp, lerp, BASE, BASES, fence, SPITTERS, HORNETS, gearLook } from './park3d.js';
import { hudShell, safeSound } from './hud3d.js';

export function outfield(cfg) {
  const { stage, level, me, end, say } = cfg, Sound = safeSound(cfg.Sound);
  const N = 10, SPEED = [0, 24, 21, 19][level];
  const SIT = [
    { r: [0, 0, 0], txt: 'Nobody on base.', ans: 2, why: 'With nobody on, get it back to second base fast.' },
    { r: [1, 0, 0], txt: 'Runner on first. He runs back to first.', ans: 2, why: 'Throw to second, one base ahead of the runner.' },
    { r: [0, 1, 0], txt: 'Runner on second. He tags up for third!', ans: 3, why: 'He’s going to third. Beat him there.' },
    { r: [0, 0, 1], txt: 'Runner on third. He tags up for home!', ans: 4, why: 'Throw home to stop the run.' },
    { r: [1, 1, 0], txt: 'Runners on first and second. Lead runner tags for third!', ans: 3, why: 'Throw ahead of the lead runner: third base.' },
    { r: [1, 0, 1], txt: 'Runners on first and third. Runner on third tags up!', ans: 4, why: 'The run is the big one. Throw home.' }];
  let snap = false, n = 0, pts = 0, catches = 0, dives = 0, smart = 0, phase = 'intro', pt = 0, B = null, target = null, sit = null, diving = 0, thr = null, over = false, holdT = 0;
  const meP = new THREE.Vector3(0, 0, -150);

  const W = world({ stage, me, shadow: { x: 0, z: -150, r: 45 }, fov: a => a < 0.8 ? 60 : a < 1.2 ? 52 : 44,
    hudHTML: hudShell({ team: 'SEED SPITTERS', sub: 'OUTFIELD HERO', top: true,
      cells: [['POINTS', 'o-pts'], ['BALL', 'o-n'], ['CATCHES', 'o-c'], ['SMART THROWS', 'o-s']],
      kicker: 'SEED SPITTERS PARK', title: 'OUTFIELD HERO',
      lines: ['You’re #' + me.num + ' in center field.', 'Touch and hold where you want to run.', 'Ball close but not quite? Tap to DIVE! Then tap the right base to throw to.'],
      extra: '<div class="d3sit" id="o-sit"></div><div class="d3bases" id="o-bases"></div><div class="d3dive" id="o-dive">DIVE! TAP!</div>' }) });
  const { scene, cam, $ } = W;
  const S = SPITTERS(me);

  const GL = gearLook(me), J = W.human(Object.assign({ mirror: true, glove: true, cap: true, skin: 0xf0c8a5, hair: 0x4a2e18 }, S, { colors: Object.assign({}, S.colors, GL.shoes != null ? { shoes: GL.shoes } : {}) })); J.root.position.copy(meP); scene.add(J.root);
  // teammates (Spitters) and the Hornets batter + runners
  const mates = [[BASE + 6, -BASE - 10], [18, -2 * BASE + 4], [-18, -2 * BASE + 4], [-BASE - 6, -BASE - 10], [-100, -140], [100, -140], [0, -BASE]].map(([x, z]) => {
    const f = W.human(Object.assign({ glove: true, cap: true }, S, { letters: null })); f.root.position.set(x, z === -BASE ? 0.55 : 0, z); f.face(0, 0); f.set('ready', 0); scene.add(f.root); f.home = f.root.position.clone(); return f; });
  const C = W.human(Object.assign({ helmet: true, glove: true }, S, { letters: null, colors: Object.assign({}, S.colors, { helmet: 0x161616 }) })); C.root.position.set(0, 0, 3.2); C.set('crouch', 0); scene.add(C.root); C.home = C.root.position.clone();
  const cover = b => b === 1 ? mates[0] : b === 2 ? mates[2] : b === 3 ? mates[3] : C;   // who takes the throw at each base
  const bat = W.makeBat(); const hitter = W.human(Object.assign({ helmet: true, lod: true }, HORNETS(12))); scene.add(hitter.root); W.standInBox(hitter, bat);
  const runners = [1, 2, 3].map(i => { const r = W.human(Object.assign({ lod: true, helmet: true }, HORNETS())); r.root.visible = false; scene.add(r.root); return r; });
  const runnerAt = (i, r) => { const [x, z] = BASES[i]; r.root.position.set(x, 0, z); r.face(0, -BASE); r.set('ready', 0); };

  // landing spot (Rookie), base targets
  const spot = W.ring(2.2, 3.0, 0xffd23f, 0.7, true); spot.visible = false;
  const baseRings = [1, 2, 3, 4].map(i => { const r = W.ring(3.2, 4.4, 0xffd23f, 0.95, true); r.position.set(BASES[i][0], 0.2, BASES[i][1]); r.visible = false; return r; });
  const basesEl = $('o-bases');
  basesEl.innerHTML = ['1ST', '2ND', '3RD', 'HOME'].map((t, i) => `<button type="button" class="d3btn" data-b="${i + 1}"><b>${t}</b></button>`).join('');
  basesEl.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); throwTo(+b.dataset.b); }));

  const paint = () => { $('o-pts').textContent = pts; $('o-n').textContent = Math.min(n + 1, N) + '/' + N; $('o-c').textContent = catches; $('o-s').textContent = smart;
    basesEl.classList.toggle('hide', phase !== 'throw'); baseRings.forEach(r => { r.visible = phase === 'throw'; });
    const si = $('o-sit'); si.style.display = (phase === 'throw' || phase === 'thrown') && sit ? '' : 'none';
    if (sit) si.innerHTML = phase === 'throw' ? '<b>' + sit.txt + '</b><span>Tap the base to throw to</span>' : '<b>' + (thr && thr.right ? 'Right!' : 'Not that one.') + '</b><span>' + sit.why + '</span>';
    W.drawBoard([['POINTS ' + pts, 120], ['CATCHES ' + catches + ' · SMART THROWS ' + smart, 48, '#bbbbbb']]); };

  function newBall() {
    const deep = Math.random() < (level === 1 ? 0.08 : 0.14), a = rnd(-32, 32), d = deep ? fence(a) + 8 : rnd(115, 196);
    const T = rnd(2.6, 3.6) - (level - 1) * 0.25, r = a * Math.PI / 180;
    B = { x: d * Math.sin(r), z: -d * Math.cos(r), d, T, t: 0, apex: 9.8 * T * T / 2 * 1.4, deep };
    if (deep) { const k = (fence(a) - 1) / d; B.x *= k; B.z *= k; }
    meP.set(0, 0, -150); snap = true; target = null; diving = 0; sit = null; thr = null; holdT = 0; phase = 'fly'; pt = 0;
    runners.forEach(r => { r.root.visible = false; });
    for (const f of mates.concat([C])) { f.root.position.copy(f.home); f.face(0, 0); f.set(f === C ? 'crouch' : 'ready', 0); }
    hitter.set('swing', W.CAL.swing.tc); W.placeBat(hitter, bat);
    Sound.crack(); say('Fly ball! Run to it. Ball ' + (n + 1) + ' of ' + N + '.'); paint();
  }
  const ballPos = (out) => { const k = clamp(B.t / B.T, 0, 1); out.set(B.x * k, 4 * B.apex * k * (1 - k) / 4 + 3 * (1 - k), B.z * k); out.k = k; return out; };
  function caught(dive) {
    catches++; pts += 100; if (dive) { dives++; pts += 100; W.callout('DIVING CATCH!', '+200', 'hr', 2.2); Sound.cheer(); W.crowd.cheer(1); }
    else { W.callout('CAUGHT!', '+100', 'hit', 1.6); Sound.pop(); W.crowd.cheer(0.4); }
    holdT = dive ? 0.9 : 0.5; toThrow();
  }
  function toThrow() {
    sit = B.deep ? { r: [0, 0, 0], txt: 'Off the wall! The batter is going for second.', ans: 2, why: 'Hit the base he’s heading to: second.' } : pick(SIT); phase = 'throw'; pt = 0;
    runners.forEach((r, i) => { r.root.visible = !!sit.r[i]; if (sit.r[i]) runnerAt(i + 1, r); });
    if (B.deep) { runners[0].root.visible = true; runnerAt(1, runners[0]); runners[0].going = 2; }
    say(sit.txt + ' Where do you throw? Tap the base.'); paint();
  }
  function throwTo(b) {
    if (phase !== 'throw') return;
    const right = b === sit.ans, fast = pt < 1.6; thr = { b, t: 0, right, from: new THREE.Vector3(), to: new THREE.Vector3() };
    if (right) { smart++; pts += 50 + (fast ? 25 : 0); W.callout('SMART THROW!', '+' + (fast ? 75 : 50), 'hit', 1.8); Sound.blip(true); }
    else if (b) { W.callout('WRONG BASE', 'Watch the lead runner', 'out', 1.8); Sound.blip(false); }
    if (b) J.face(BASES[b][0], BASES[b][1]);
    phase = 'thrown'; pt = 0; say((right ? 'Right! ' : 'Not that one. ') + sit.why); paint();
  }
  // input: touch and hold to run there; tap near the ball to dive; tap a base to throw
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmp = new THREE.Vector3(), bp = new THREE.Vector3();
  let held = false;
  const aimAt = e => { const p = W.toPlane(e.clientX, e.clientY, ground); if (p) target = { x: p.x, z: p.z }; };
  W.cv.addEventListener('pointerdown', e => {
    e.preventDefault(); Sound.unlock(); if (over || phase === 'intro') return;
    if (phase === 'throw') { const p = W.toPlane(e.clientX, e.clientY, ground); if (!p) return; let best = 0, bd = 22; for (let i = 1; i <= 4; i++) { const d = Math.hypot(p.x - BASES[i][0], p.z - BASES[i][1]); if (d < bd) { bd = d; best = i; } } if (best) throwTo(best); return; }
    if (phase === 'fly') { ballPos(bp); const d = Math.hypot(bp.x - meP.x, bp.z - meP.z); if (bp.y < 7 && d < 12 && !diving) { diving = 0.01; Sound.whoosh(); return; } held = true; aimAt(e); }
  });
  W.cv.addEventListener('pointermove', e => { if (held && phase === 'fly' && !diving) aimAt(e); });
  const up = () => { held = false; target = null; }; W.cv.addEventListener('pointerup', up); W.cv.addEventListener('pointercancel', up);
  const onKey = e => { if (phase === 'intro') return; if (phase === 'throw' && /^[1-4]$/.test(e.key)) return throwTo(+e.key);
    if (phase === 'fly') { const v = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (v) { e.preventDefault(); target = { x: meP.x + v[0] * 30, z: meP.z + v[1] * 30 }; } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ballPos(bp); if (bp.y < 7 && Math.hypot(bp.x - meP.x, bp.z - meP.z) < 12) diving = 0.01; } } };
  window.addEventListener('keydown', onKey); W.cleanups.push(() => window.removeEventListener('keydown', onKey));
  $('d3-go').addEventListener('click', () => { Sound.unlock(); $('d3-intro').classList.add('gone'); W.cv.focus(); newBall(); });
  $('d3-go').focus();

  const camPos = new THREE.Vector3(0, 40, -200), camLook = new THREE.Vector3(0, 0, -100), wantP = new THREE.Vector3(), wantL = new THREE.Vector3();
  W.run((dt, T) => {
    pt += dt;
    if (window.__d3auto) { if (phase === 'fly') target = { x: B.x, z: B.z }; if (phase === 'throw' && pt > 0.8) throwTo(sit.ans); }
    let anim = 'ready', faceTo = null;
    if (phase === 'fly') {
      B.t += dt; ballPos(bp);
      if (target && !diving) { const dx = target.x - meP.x, dz = target.z - meP.z, d = Math.hypot(dx, dz), st = SPEED * dt; if (d > 1) { meP.x += dx / d * Math.min(st, d); meP.z += dz / d * Math.min(st, d); anim = 'run'; faceTo = [target.x, target.z]; } }
      if (diving) { diving += dt; const dx = bp.x - meP.x, dz = bp.z - meP.z, d = Math.hypot(dx, dz); if (d > 0.5) { meP.x += dx / d * Math.min(d, 40 * dt); meP.z += dz / d * Math.min(d, 40 * dt); } anim = 'dive'; faceTo = [bp.x, bp.z]; }
      if (!faceTo) faceTo = [bp.x, bp.z];
      W.ball.visible = true; W.ball.position.copy(bp); W.ball.rotation.x += dt * 20; W.ball.scale.setScalar(Math.max(1, cam.position.distanceTo(bp) / 28));
      W.ballShadow.visible = true; W.ballShadow.position.set(bp.x, 0.07, bp.z); W.ballShadow.scale.setScalar(1 + bp.y * 0.015);
      spot.visible = level === 1 && bp.k > 0.3; spot.position.set(B.x, 0.12, B.z);
      const d = Math.hypot(bp.x - meP.x, bp.z - meP.z);
      $('o-dive').style.opacity = bp.y < 7 && d < 12 && d > 4.5 && !diving ? 1 : 0;
      if (bp.k >= 1) {
        $('o-dive').style.opacity = 0; spot.visible = false;
        if (B.deep) { W.callout('OFF THE WALL!', 'Get it back in', 'ball', 1.6); Sound.ooh(); W.ball.visible = false; toThrow(); }
        else if (d <= 4.5 && !diving) caught(false);
        else if (diving && d <= 12) caught(true);
        else { W.callout('DROPPED IN', 'Get there sooner', 'out', 1.6); Sound.ooh(); toThrow(); }
        W.ballShadow.visible = false;
      }
    } else if (phase === 'throw' || phase === 'thrown') {
      W.ball.visible = false; W.ball.scale.setScalar(1);
      if (holdT > 0) { holdT -= dt; anim = diving ? 'dive' : 'catch'; } else anim = 'ready';
      if (phase === 'throw') faceTo = [0, -BASE];
      // the lead runner takes off when he sees the throw coming (or right away if he's going)
      const lead = sit ? (sit.ans === 4 ? 3 : sit.ans === 3 ? (sit.r[1] ? 2 : 2) : B.deep ? 1 : 0) : 0;
      if (lead && runners[lead - 1].root.visible) { const r = runners[lead - 1], go = phase === 'thrown' ? clamp(pt / 2.4, 0, 1) * 0.85 : clamp(pt / 4, 0, 0.35); const from = BASES[lead], to = BASES[lead + 1] || BASES[4];
        r.root.position.set(lerp(from[0], to[0], go), 0, lerp(from[1], to[1], go)); r.face(to[0], to[1]); if (go > 0.01) r.runStep(dt, 18); else r.set('ready', 0); }
    }
    if (phase === 'thrown' && thr && thr.b) {
      thr.t += dt; const tr = W.CAL.pitch.tr; J.set('pitch', tr - 0.35 + Math.min(0.9, thr.t * 1.3)); anim = null;
      if (thr.t > 0.25) { if (!thr.go) { thr.go = true; W.handPos(J, thr.from); thr.to.set(BASES[thr.b][0], 3, BASES[thr.b][1]); thr.T = clamp(thr.from.distanceTo(thr.to) / 95, 0.6, 1.8); Sound.whoosh(); }
        const k = Math.min(1, (thr.t - 0.25) / thr.T); W.ball.visible = k < 1; W.ball.position.lerpVectors(thr.from, thr.to, k); W.ball.position.y += Math.sin(k * Math.PI) * thr.T * 14; W.ball.scale.setScalar(Math.max(1, cam.position.distanceTo(W.ball.position) / 45)); }
    }
    // the teammate covering that base runs to the bag and catches the throw
    if (phase === 'thrown' && thr && thr.b) { const f = cover(thr.b), bag = tmp.set(BASES[thr.b][0], 0, BASES[thr.b][1]); bag.addScaledVector(bag.clone().setY(0).normalize(), thr.b === 4 ? -1.5 : 0).add(new THREE.Vector3(thr.b === 4 ? 0 : -1.2, 0, thr.b === 4 ? 0 : 1.2));
      const d = f.root.position.distanceTo(bag), arrived = thr.go && thr.t > 0.25 + thr.T;
      if (d > 0.5 && !arrived) { f.root.position.lerp(bag, Math.min(1, dt * 17 / d)); f.face(bag.x, bag.z); f.runStep(dt, 17); }
      else { f.face(meP.x, meP.z); f.set(arrived && thr.t > 0.6 + thr.T ? 'crouch' : 'catch', 0); }
      if (arrived) { W.ball.visible = true; W.gloveHand(f, W.ball.position); W.ball.scale.setScalar(Math.max(1, cam.position.distanceTo(W.ball.position) / 45)); if (!thr.caught) { thr.caught = true; Sound.pop(); } } }
    if (phase === 'thrown' && pt > 2.6) { n++; W.ball.visible = false; if (n >= N) { over = true; phase = 'end'; W.later(0.3, finishGame); } else newBall(); }
    if (phase === 'throw' && pt > 4) throwTo(0);
    J.root.position.copy(meP); if (faceTo) J.face(faceTo[0], faceTo[1]); if (anim === 'run') J.runStep(dt, SPEED); else if (anim) J.set(anim, T * 1.05);
    if (phase !== 'fly' && phase !== 'intro') hitter.set('swing', 1.55);
    // camera: behind Jaxson looking in toward home; higher for the throw so all four bases show
    const v = tmp.set(meP.x, 0, meP.z).normalize();
    if (phase === 'throw' || phase === 'thrown') { wantP.copy(meP).addScaledVector(v, 34).setY(58); wantL.set(meP.x * 0.35, 0, -BASE + meP.z * 0.15); }
    else if (phase === 'intro') { wantP.set(0, 40, -215); wantL.set(0, 4, -120); }
    else { wantP.copy(meP).addScaledVector(v, 27).setY(17); wantL.copy(meP).addScaledVector(v, -45).setY(phase === 'fly' ? clamp(W.ball.position.y * 0.4, 3, 26) : 3);
      if (phase === 'fly') { wantL.x = lerp(wantL.x, W.ball.position.x, 0.35); wantL.z = lerp(wantL.z, W.ball.position.z, 0.35); } }
    if (snap) { camPos.copy(wantP); camLook.copy(wantL); snap = false; }
    camPos.lerp(wantP, phase === 'fly' ? 0.12 : 0.05); camLook.lerp(wantL, phase === 'fly' ? 0.15 : 0.06); cam.position.copy(camPos); cam.lookAt(camLook);
    W.setShadowArea(meP.x, meP.z, 40);
  });
  J.set('ready', 0); J.face(0, 0); paint();
  function finishGame() { end(pts, [pts + ' points!', 'Catches: ' + catches + ' of ' + N + (dives ? ' (' + dives + ' diving)' : '') + ' · Smart throws: ' + smart + ' of ' + N, catches < 5 ? 'Coach tip: start running the moment it’s hit. Watch the ball’s shadow, not just the ball.' : 'Pro tip: before every pitch, know where you’ll throw if the ball comes to you.']); }
  if (/d3test|d3rec|d3probe/.test(location.search)) window.__d3 = { get phase() { return phase; }, get pts() { return pts; }, get n() { return n; }, get fps() { return W.fps; }, draw: () => W.renderer.render(scene, cam), scene, step: k => { for (let i = 0; i < k; i++) W.step(); }, go: () => $('d3-go').click(), throwTo, get sit() { return sit; } };
  say('Outfield Hero at Seed Spitters Park. Press Play Ball.');
  return { stop: W.stop };
}
