// Road to the Show defense: one ball hit to Jaxson's position, in 3D.
// Ground balls, line drives, fly balls and pop-ups; the catcher also throws out base stealers.
// He runs (touch and hold), dives (tap when it's close), then taps a base to throw. Runners really race the ball.
import { THREE, world, rnd, pick, clamp, lerp, BASE, BASES, SPITTERS, gearLook } from './park3d.js';
import { hudShell, safeSound } from './hud3d.js';

export const SPOT = { P: [0, -BASE], C: [0, 3.4], '1B': [BASE + 4, -BASE - 8], '2B': [21, -2 * BASE + 8], SS: [-21, -2 * BASE + 8], '3B': [-BASE - 4, -BASE - 8], LF: [-95, -150], CF: [0, -170], RF: [95, -150] };
const INF = { '1B': 1, '2B': 1, SS: 1, '3B': 1 };
const BASENAME = ['', '1ST', '2ND', '3RD', 'HOME'];

export function fieldPlay(cfg) {
  const { stage, level, me, say } = cfg, Sound = safeSound(cfg.Sound), F = cfg.play;
  const pos = F.pos, isIF = !!INF[pos], isC = pos === 'C', R = Object.assign({ fld: 55, arm: 55, spd: 55, rea: 55, acc: 55 }, F.r || {}), FIRST = 0.55 - R.rea / 250;   // Reaction: his first step
  const REACH = 2.3 + R.fld / 55 + (level === 1 ? 0.6 : 0), DIVE = 5.5;
  const SPEED = (isIF || isC ? 17 : 19.5) + (R.spd - 50) * 0.09 + (level === 1 ? 3 : level === 2 ? 1 : 0);
  const ARM = 58 + R.arm * 0.42, ASSIST = [0, 0.5, 0.28, 0][level], BALLK = [0, 0.82, 0.92, 1][level];
  const outs0 = F.outs || 0, on = F.on || [false, false, false];

  const oc = F.opp && F.opp.oc != null ? F.opp.oc : 0x1f3f7a, oj = F.opp && F.opp.oj != null ? F.opp.oj : 0xd6d4cc;
  const OPP = l => ({ colors: { jersey: oj, sleeve: oc, pants: 0xd8d6cf, socks: oc, belt: oc, cap: oc, helmet: oc }, letters: Object.assign({}, (F.opp && F.opp.ol) || { bg: '#d6d4cc', fg: '#1f3f7a', edge: '#f2c230', name: 'HORNETS', script: 'Hornets' }, { num: String(l) }) });
  const home0 = new THREE.Vector3(SPOT[pos][0], 0, SPOT[pos][1]);
  const W = world({ stage, me, shadow: { x: home0.x * 0.6, z: home0.z * 0.6 - 20, r: 70 }, fov: a => a < 0.8 ? 58 : a < 1.2 ? 50 : 42,
    hudHTML: hudShell({ team: F.sit.score, sub: F.sit.half, top: true, cells: [['OUTS', 'f-outs'], ['ON BASE', 'f-on']],
      kicker: F.sit.title, title: 'DEFENSE · ' + pos,
      lines: [F.sit.line, F.kind === 'steal' ? 'The runner is stealing! Catch the pitch, then tap 2ND as fast as you can.' : 'Touch and hold where you want to run. Close but not quite? Tap DIVE!', F.kind === 'steal' ? 'Quick throw = out.' : 'Got it? Tap the base to throw to.'],
      extra: '<div class="d3sit" id="f-sit" style="display:none"></div><div class="d3bases hide" id="f-bases"></div><div class="d3dive" id="f-dive">DIVE! TAP!</div>' }) });
  const { scene, cam, $ } = W;
  $('d3-go').textContent = 'READY';
  $('f-outs').textContent = outs0; $('f-on').textContent = on.map((b, i) => b ? ['1st', '2nd', '3rd'][i] : '').filter(Boolean).join(' ') || '—';

  // Spitters in the field, Jaxson at his position
  const S = SPITTERS(me), GL = gearLook(me);
  const J = W.human(Object.assign({ glove: true, cap: !isC, helmet: isC, skin: F.skin || 0xf0c8a5, hair: F.hair || 0x4a2e18, mirror: F.throws !== 'R' }, S, { colors: Object.assign({}, S.colors, GL.shoes != null ? { shoes: GL.shoes } : {}, isC ? { helmet: 0x161616 } : {}) }));
  scene.add(J.root);
  const mates = {};
  for (const k of Object.keys(SPOT)) { if (k === pos) continue; const [x, z] = SPOT[k];
    const f = W.human(Object.assign({ glove: true, cap: k !== 'C', helmet: k === 'C', lod: !INF[k] && k !== 'P' && k !== 'C' }, S, { letters: null, colors: Object.assign({}, S.colors, k === 'C' ? { helmet: 0x161616 } : {}) }));
    f.root.position.set(x, k === 'P' ? 0.55 : 0, z); f.face(0, k === 'C' ? -BASE : 0); f.set(k === 'C' ? 'crouch' : k === 'P' ? 'pitch' : 'ready', 0); f.home = f.root.position.clone(); scene.add(f.root); mates[k] = f; }
  const P1 = mates.P;
  // who takes a throw at each base
  const coverOf = b => b === 1 ? (pos === '1B' ? 'P' : '1B') : b === 2 ? (pos === 'SS' ? '2B' : 'SS') : b === 3 ? (pos === '3B' ? 'SS' : '3B') : (pos === 'C' ? 'P' : 'C');
  const bagSpot = b => { const [x, z] = BASES[b]; const v = new THREE.Vector3(x, 0, z); if (b === 4) return v.set(0, 0, 1.8); return v.add(new THREE.Vector3(b === 1 ? -1.2 : b === 3 ? 1.2 : 0, 0, b === 2 ? 1.4 : 1.0)); };

  // the other team: batter, runners
  const bat = W.makeBat(); const hitter = W.human(Object.assign({ helmet: true }, OPP(Math.floor(rnd(2, 40))))); scene.add(hitter.root); W.standInBox(hitter, bat);
  const basePt = (s, out) => { s = clamp(s, 0, 4); const i = Math.min(3, Math.floor(s)), f = s - i, A = BASES[i === 0 ? 4 : i], B = BASES[i + 1]; return out.set(lerp(A[0], B[0], f), 0, lerp(A[1], B[1], f)); };
  const RN = [];   // runners: origin 0 = the batter
  on.forEach((b, i) => { if (!b) return; const h = W.human(Object.assign({ helmet: true }, OPP(Math.floor(rnd(2, 40))))); scene.add(h.root);
    RN.push({ h, origin: i + 1, s: i + 1 + (i < 2 ? 0.08 : 0.06), from: i + 1, to: i + 1, v: rnd(17.5, 19.5), go: false, out: false, done: true, scored: false }); });
  const BR = { h: hitter, origin: 0, s: 0, from: 0, to: 0, v: rnd(17, 19.5), go: false, out: false, done: true, scored: false, isBatter: true };

  // targets: dashed lead line for the ball on Rookie
  const spot = W.ring(2.2, 3.0, 0xffd23f, 0.75, true); spot.visible = false;
  const baseRings = [1, 2, 3, 4].map(i => { const r = W.ring(3.2, 4.4, 0xffd23f, 0.95, true); r.position.set(BASES[i][0], 0.2, BASES[i][1]); r.visible = false; return r; });
  const basesEl = $('f-bases');
  basesEl.innerHTML = [1, 2, 3, 4].map(i => `<button type="button" class="d3btn" data-b="${i}"><b>${BASENAME[i]}</b></button>`).join('');
  basesEl.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); throwTo(+b.dataset.b); }));

  /* ---------- the batted ball ---------- */
  const away = home0.clone().setY(0).normalize(), side = new THREE.Vector3(-away.z, 0, away.x);
  const diffOff = { routine: [0, 6], tough: [9, 15], hit: [14, 22] }[F.diff || 'routine'];
  const L = Math.sign(Math.random() - 0.5) || 1, lat = L * rnd(diffOff[0], diffOff[1]) * (level === 1 ? 0.8 : 1);
  let BL = null;
  function makeBall() {
    const k = F.kind;
    if (k === 'ground') { const T = home0.clone().addScaledVector(side, lat).addScaledVector(away, -3); const dir = T.clone().normalize(); const v0 = rnd(68, 84) * BALLK;
      BL = { kind: k, t: 0, dir, v0, a: 13, s: 0, state: 'air' }; }
    else if (k === 'line') { const T = home0.clone().addScaledVector(side, lat * 0.8).addScaledVector(away, rnd(10, 22)); const d = T.length(), Tt = d / (rnd(95, 110) * BALLK);
      BL = { kind: k, t: 0, L: T, T: Tt, peak: rnd(6, 9), state: 'air' }; }
    else if (k === 'fly') { const far = isIF ? 0 : 1; const T = home0.clone().addScaledVector(side, lat * (far ? (F.diff === 'hit' ? 2.9 : 2.2) : 1)).addScaledVector(away, far ? rnd(-12, 26) * (F.diff === 'routine' ? 0.6 : 1.3) : 0);
      const Tt = rnd(2.9, 3.7) / BALLK; BL = { kind: k, t: 0, L: T, T: Tt, peak: 4 * Tt * Tt, state: 'air' }; }
    else if (k === 'pop') { const T = isC ? new THREE.Vector3(rnd(-22, 22) * (F.diff === 'routine' ? 0.5 : 1), 0, rnd(10, 28)) : home0.clone().addScaledVector(side, lat * 0.9).addScaledVector(away, rnd(-14, 6));
      const Tt = rnd(3.3, 3.9) / BALLK; BL = { kind: k, t: 0, L: T, T: Tt, peak: 4 * Tt * Tt, state: 'air' }; }
    else if (k === 'steal') { BL = { kind: k, t: 0, state: 'pitch' }; }
    BL.from = new THREE.Vector3(0, 3, -1);
    // keep it fair (inside the foul lines), except the catcher's foul pop
    const fair = v => { if (!v) return; const d = Math.hypot(v.x, v.z), a = clamp(Math.atan2(v.x, -v.z), -0.72, 0.72); v.set(Math.sin(a) * d, 0, -Math.cos(a) * d); };
    if (!(isC && k === 'pop')) { fair(BL.L); if (BL.dir) { const d = BL.dir.clone().multiplyScalar(100); fair(d); BL.dir.copy(d.normalize()); } }
  }
  const bp = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function ballAt(t, out) {   // where the ball is t seconds after contact (before anyone touches it)
    if (BL.kind === 'ground') { const vEnd = BL.v0 / BL.a, tt = Math.min(t, vEnd), s = BL.v0 * tt - BL.a * tt * tt / 2;
      out.copy(BL.dir).multiplyScalar(s); out.y = 0.25 + 2.4 * Math.exp(-t * 1.7) * Math.abs(Math.sin(t * 6.5)); out.s = s; return out; }
    const k = t / BL.T;
    if (k <= 1) { out.lerpVectors(BL.from, BL.L, k); out.y = lerp(3, 0.3, k) + 4 * BL.peak * k * (1 - k); out.k = k; return out; }
    // landed: rolls on
    const dir = tmp2.copy(BL.L).sub(BL.from).setY(0); const hs = dir.length() / BL.T * 0.45; dir.normalize(); const tt = Math.min(t - BL.T, hs / 10), s = hs * tt - 5 * tt * tt;
    out.copy(BL.L).addScaledVector(dir, s); out.y = 0.25; out.k = k; return out;
  }

  /* ---------- state ---------- */
  let phase = 'intro', pt = 0, ct = 0, meP = home0.clone(), target = null, held = false, diving = 0, divedAt = 0, has = false, caughtAir = false, thr = null, relay = null, res = null, endAt = 0, hint = false, gem = false, error = false, recover = 0, autoT = 0;
  const outsList = [];
  const setRunner = r => { basePt(r.s, tmp); r.h.root.position.copy(tmp); };
  RN.forEach(r => { setRunner(r); r.h.face(0, -BASE); r.h.set('ready', 0); });

  function startPlay() { phase = 'pitch'; pt = 0; say(F.kind === 'steal' ? 'Here comes the pitch. The runner is going!' : 'Here’s the pitch…'); }
  function contact() {
    phase = 'live'; ct = 0; makeBall(); Sound.crack();
    hitter.set('swing', W.CAL.swing.tc);
    // batter runs; forced runners run on grounders; everyone holds on balls in the air
    BR.go = true; BR.done = false; BR.to = 1; BR.delay = 0.35;
    const forced = [true, on[0], on[0] && on[1]];
    RN.forEach(r => { if (F.kind === 'ground' && (r.origin === 1 || (r.origin === 2 && forced[1]) || (r.origin === 3 && forced[2]))) { r.go = true; r.done = false; r.to = r.origin + 1; r.forced = true; } });
    // cover men head to their bags on grounders
    if (F.kind === 'ground') [1, 2].forEach(b => { const c = mates[coverOf(b)]; if (c) c.goTo = bagSpot(b); });
    say(F.kind === 'ground' ? 'Ground ball to you!' : F.kind === 'line' ? 'Line drive!' : F.kind === 'pop' ? 'Pop-up!' : 'Fly ball! Run to it!');
  }
  function caught() {
    has = true;
    // an outfielder picking up a ball that already dropped in: it's a hit, scored by how long it took
    if (!isIF && !isC && BL.kind !== 'ground' && BL.state === 'ground') { const code = ct < 4.6 ? '1B' : ct < 7.2 ? '2B' : '3B'; W.callout({ '1B': 'SINGLE', '2B': 'DOUBLE', '3B': 'TRIPLE' }[code], 'Got it back in', 'out', 1.4); return finish({ code, text: 'Dropped in for a hit.' }); }
    const air = BL.kind !== 'ground' && bp.y > 0.5; caughtAir = air && BL.state === 'air';
    // a bobble now and then
    if (Math.random() < (1 - R.fld / 100) * (F.diff === 'hit' ? 0.14 : 0.06)) { error = true; has = false; BL.state = 'dead'; W.callout('BOBBLED!', 'Error', 'out', 1.6); Sound.ooh(); return finish({ code: 'E', text: 'Bobbled it. Error.' }); }
    if (caughtAir) {
      BR.out = true; outsList.push(0); BR.go = false;
      if (diving) { gem = true; W.callout('DIVING CATCH!', 'What a play!', 'hr', 2); Sound.cheer(); W.crowd.cheer(1); }
      else { W.callout(BL.kind === 'line' ? 'SNAGGED IT!' : 'CAUGHT!', '', 'hit', 1.4); Sound.pop(); W.crowd.cheer(0.4); if (F.diff === 'hit') gem = true; }
      // runner on third tags up with less than two outs
      const r3 = RN.find(r => r.origin === 3);
      if (r3 && outs0 + 1 < 3) { r3.go = true; r3.done = false; r3.to = 4; r3.delay = 0.25; toThrow('He’s tagging up from third! Throw home!'); }
      else { phase = 'done'; endAt = 1.3; }
    } else {
      if (diving) { gem = true; W.callout('DIVING STOP!', 'Now throw!', 'hr', 1.6); Sound.cheer(); W.crowd.cheer(0.8); } else { Sound.pop(); }
      toThrow(F.kind === 'ground' ? 'Got it! Where’s the play? Tap a base.' : 'Tap a base to throw.');
    }
  }
  function toThrow(msg) { phase = 'throw'; pt = 0; recover = diving ? 0.55 : 0.12; $('f-sit').style.display = ''; $('f-sit').innerHTML = '<b>' + msg + '</b><span>Tap the base</span>'; basesEl.classList.remove('hide'); baseRings.forEach(r => { r.visible = true; }); say(msg); }
  function smartBase() {   // the play a coach wants: lead forced runner you can get, else first
    if (F.kind === 'steal') return 2;
    const r3 = RN.find(r => r.origin === 3 && r.go && r.to === 4); if (r3 && caughtAir) return 4;
    // runner on first, less than two outs, middle of the diamond: get the lead runner at second and turn two
    if (F.kind === 'ground' && on[0] && outs0 < 2 && (pos === 'SS' || pos === '2B' || pos === '3B' || pos === 'P')) return 2;
    return 1;
  }
  function throwTo(b) {
    if (phase !== 'throw' || thr) return;
    basesEl.classList.add('hide'); baseRings.forEach(r => { r.visible = false; }); $('f-sit').style.display = 'none';
    const c = mates[coverOf(b)], bag = bagSpot(b);
    if (c) c.goTo = bag.clone();
    const from = W.handPos(J, new THREE.Vector3()), to = bag.clone().setY(3.2), d = from.distanceTo(to);
    const wild = Math.random() < (1 - R.acc / 100) * 0.07;
    thr = { b, t: -recover - 0.28, from, to, T: clamp(d / ARM, 0.25, 2.2), wild };
    J.face(to.x, to.z); Sound.whoosh();
  }
  function arrive(b, at) {   // ball reaches base b
    const r = [BR].concat(RN).find(x => x.go && !x.out && !x.done && x.to === b);
    if (thr && thr.wild) { W.callout('WILD THROW!', 'Runners move up', 'out', 1.6); error = true; [BR].concat(RN).forEach(x => { if (x.go && !x.out) { x.to = Math.min(4, x.to + 1); x.done = false; } }); return; }
    if (r) { r.out = true; r.go = false; outsList.push(r.origin); Sound.blip(true); W.callout('OUT!', 'At ' + (b === 4 ? 'home' : BASENAME[b].toLowerCase()), 'hit', 1.5); W.crowd.cheer(0.5);
      // turn two: the cover man fires to first if the batter is still running
      if (b !== 1 && !BR.out && !BR.done && outs0 + outsList.length < 3) relay = { t: 0, from: bagSpot(b).setY(3.2), to: bagSpot(1).setY(3.2), b: 1 };
    } else { W.callout('SAFE', 'No one was out there', 'ball', 1.3); Sound.blip(false); }
  }
  function finish(r) { if (res) return; res = r; phase = 'done'; endAt = Math.max(endAt, 1.6); }
  function build() {   // final result for the game
    if (res) return res;
    const o = outs0 + outsList.length >= 3;
    const all = [BR].concat(RN), bases = [null, null, null], scored = [];
    all.forEach(x => { if (x.out) return; const at = x.done ? x.to : Math.floor(x.s + 1e-6); if (at >= 4) scored.push(x.origin); else if (at >= 1) bases[at - 1] = x.origin; });
    const n = outsList.length;
    let code = n >= 2 ? 'DP' : n === 1 ? (caughtAir ? 'OUT_AIR' : 'OUT') : error ? 'E' : 'FC';
    if (n === 0 && !error && bases.includes(0)) code = 'IFH';
    return { code, outs: n, bases, scored: o ? [] : scored, gem, error, caught: caughtAir, text: '' };
  }

  /* ---------- input ---------- */
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimAt = e => { const p = W.toPlane(e.clientX, e.clientY, ground); if (p) target = { x: p.x, z: p.z }; };
  const canDive = () => phase === 'live' && !has && !diving && ct > 0.35 && (BL.kind === 'ground' || BL.kind === 'line' || (bp.k || 0) > 0.4) && bp.y < 7.5 && Math.hypot(bp.x - meP.x, bp.z - meP.z) < REACH + DIVE && Math.hypot(bp.x - meP.x, bp.z - meP.z) > REACH * 0.8;
  W.cv.addEventListener('pointerdown', e => {
    e.preventDefault(); Sound.unlock(); if (phase === 'intro' || phase === 'done') return;
    if (phase === 'throw') { const p = W.toPlane(e.clientX, e.clientY, ground); if (!p) return; let best = 0, bd = 24; for (let i = 1; i <= 4; i++) { const d = Math.hypot(p.x - BASES[i][0], p.z - BASES[i][1]); if (d < bd) { bd = d; best = i; } } if (best) throwTo(best); return; }
    if (canDive()) { diving = 0.01; divedAt = ct; Sound.whoosh(); return; }
    held = true; aimAt(e);
  });
  W.cv.addEventListener('pointermove', e => { if (held && !diving) aimAt(e); });
  const up = () => { held = false; target = null; }; W.cv.addEventListener('pointerup', up); W.cv.addEventListener('pointercancel', up);
  const onKey = e => { if (phase === 'throw' && /^[1-4]$/.test(e.key)) return throwTo(+e.key);
    if (phase === 'live') { const v = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (v) { e.preventDefault(); const sx = side.x * v[0] - away.x * v[1], sz = side.z * v[0] - away.z * v[1]; target = { x: meP.x + sx * 25, z: meP.z + sz * 25 }; }
      else if ((e.key === ' ' || e.key === 'Enter') && canDive()) { e.preventDefault(); diving = 0.01; divedAt = ct; } } };
  window.addEventListener('keydown', onKey); W.cleanups.push(() => window.removeEventListener('keydown', onKey));
  $('d3-go').addEventListener('click', () => { Sound.unlock(); $('d3-intro').classList.add('gone'); W.cv.focus(); startPlay(); });
  $('d3-go').focus();

  // where to go to meet the ball (for Rookie help and the test hook)
  function intercept(out) {
    if (BL.kind === 'ground') { const s = Math.max(BL.s || 0, meP.dot(BL.dir) - 2); return out.copy(BL.dir).multiplyScalar(s).setY(0); }
    if (BL.state === 'ground') return out.copy(bp).setY(0);
    return out.copy(BL.L).setY(0);
  }

  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantP = new THREE.Vector3(), wantL = new THREE.Vector3(); let snap = true;
  W.run((dt, T) => {
    pt += dt; const tr = W.CAL.pitch.tr; let anim = 'ready', faceTo = null;
    if (phase === 'pitch') {   // the pitch comes in; contact at 1.05 s
      P1.set('pitch', Math.min(pt / 1.0 * tr, tr + 0.4));
      if (pt > 0.75) { const k = clamp((pt - 0.75) / 0.42, 0, 1); W.handPos(P1, tmp); W.ball.visible = true; W.ball.position.set(lerp(0, 0.3, k), lerp(5.5, 2.6, k), lerp(-BASE + 3, isC && F.kind === 'steal' ? 2.6 : 0, k)); }
      if (F.kind === 'steal') {   // the runner goes on the pitch; the catcher (him) catches it
        RN.forEach(r => { if (r.origin === 1 && !r.go) { r.go = true; r.done = false; r.to = 2; r.delay = 0.4; } });
        anim = 'crouch';
        if (pt > 1.17) { W.ball.visible = true; W.gloveHand(J, W.ball.position); has = true; phase = 'throw'; pt = 0; recover = 0.05; toThrow('He’s stealing! Throw to 2ND!'); BL = { kind: 'steal', state: 'held' }; }
      } else if (pt > 1.05) contact();
    }
    if (phase === 'live') {
      ct += dt; BL.t += dt; ballAt(BL.t, bp); if (BL.kind === 'ground') BL.s = bp.s;
      if (BL.kind !== 'ground' && bp.k >= 1 && BL.state === 'air') { BL.state = 'ground'; if (!has) { W.callout(BL.kind === 'line' || isIF || isC ? 'IT FALLS IN' : 'DROPPED IN', isC ? 'Foul ball' : 'Base hit', 'out', 1.3); Sound.ooh(); } }
      // move: his finger, or a little Rookie/Pro help toward the ball
      let goal = null; if (target && !diving) goal = target; else if (!diving && (ASSIST > 0 || window.__d3auto) && ct > 0.25) { intercept(tmp); goal = { x: tmp.x, z: tmp.z, slow: window.__d3auto ? 1 : ASSIST }; }
      if (goal) { const dx = goal.x - meP.x, dz = goal.z - meP.z, d = Math.hypot(dx, dz), st = SPEED * (goal.slow || 1) * dt * (ct < FIRST ? 0.35 : 1); if (d > 0.8) { meP.x += dx / d * Math.min(st, d); meP.z += dz / d * Math.min(st, d); anim = 'run'; faceTo = [goal.x, goal.z]; } }
      if (diving && diving > 1.1 && !has) diving = 0;   // missed it: get up and keep after it
      if (diving) { diving += dt; const dx = bp.x - meP.x, dz = bp.z - meP.z, d = Math.hypot(dx, dz); if (diving < 0.45 && d > 0.6) { meP.x += dx / d * Math.min(d, 26 * dt); meP.z += dz / d * Math.min(d, 26 * dt); } anim = 'dive'; faceTo = [bp.x, bp.z]; }
      if (window.__d3auto && canDive() && Math.hypot(bp.x - meP.x, bp.z - meP.z) > REACH) { diving = 0.01; divedAt = ct; }
      if (!faceTo) faceTo = [bp.x, bp.z];
      W.ball.visible = true; W.ball.position.copy(bp); W.ball.rotation.x += dt * 22; W.ball.scale.setScalar(Math.max(1, cam.position.distanceTo(bp) / 30));
      W.ballShadow.visible = true; W.ballShadow.position.set(bp.x, 0.07, bp.z); W.ballShadow.scale.setScalar(1 + bp.y * 0.015);
      spot.visible = level <= 2 && BL.kind !== 'ground' && BL.state === 'air' && bp.k > 0.15; if (spot.visible) spot.position.set(BL.L.x, 0.12, BL.L.z);
      const d = Math.hypot(bp.x - meP.x, bp.z - meP.z), reach = REACH + (diving && diving > 0.08 && diving < 0.7 ? DIVE : 0);
      $('f-dive').style.opacity = canDive() ? 1 : 0;
      const catchable = BL.kind === 'ground' ? bp.y < 3.2 : (BL.state === 'air' ? bp.y < 7.5 && (bp.k > 0.45 || BL.kind === 'line') : bp.y < 3);
      if (!has && catchable && d < reach) { caught(); }
      // missed: through the infield, or he has to chase it down in the outfield
      if (!has && phase === 'live') {
        if (isC && BL.kind === 'pop' && BL.state === 'ground') finish({ code: 'FOUL', text: 'Foul ball.' });
        else if ((isIF || pos === 'P') && (BL.kind === 'ground' ? bp.s > home0.length() + 14 : BL.state === 'ground')) { W.callout('BASE HIT', 'Through the infield', 'out', 1.4); finish({ code: '1B', text: 'Got through for a hit.' }); }
        else if (!isIF && !isC && BL.state === 'ground' && ct > (BL.T || 0) + 3.2) { W.callout('DOUBLE', 'A teammate ran it down', 'out', 1.4); finish({ code: '2B', text: 'Dropped in for a double.' }); }
        else if (ct > 15) finish({ code: '1B', text: 'Base hit.' });
        else if (!isIF && !isC && BL.state === 'ground' && d < 3) { has = true; const code = ct < 4.6 ? '1B' : ct < 7.2 ? '2B' : '3B'; W.callout({ '1B': 'SINGLE', '2B': 'DOUBLE', '3B': 'TRIPLE' }[code], 'Got it back in', 'out', 1.4); finish({ code, text: 'Dropped in for a hit.' }); }
      }
      $('f-dive').style.display = '';
    } else $('f-dive').style.opacity = 0;
    if (phase === 'throw' || (phase === 'done' && has && !thr)) { W.ball.visible = has; if (has) { W.gloveHand(J, W.ball.position); W.ball.scale.setScalar(1); } W.ballShadow.visible = false; spot.visible = false;
      if (phase === 'throw') { if (recover > 0) { recover -= dt; anim = diving ? 'dive' : (caughtAir ? 'catch' : isC ? 'crouch' : 'crouch'); } else { anim = 'ready'; diving = 0; } faceTo = faceTo || [0, -BASE];
        if (!hint && pt > 1.4 && level === 1) { hint = true; const sb = smartBase(); baseRings.forEach((r, i) => { r.material.color.set(i + 1 === sb ? 0x39d353 : 0xffd23f); }); $('f-sit').innerHTML = '<b>Throw to ' + BASENAME[sb] + '!</b><span>Tap the green base</span>'; }
        if (window.__d3auto && pt > 0.5) throwTo(smartBase());
        if (pt > 4.2 && !thr) { W.callout('TOO LATE', 'Everybody’s safe', 'out', 1.4); phase = 'done'; endAt = 1.4; basesEl.classList.add('hide'); baseRings.forEach(r => { r.visible = false; }); $('f-sit').style.display = 'none'; } } }
    // the throw (and the relay on a double play)
    if (thr) { thr.t += dt; const tr2 = W.CAL.pitch.tr;
      if (thr.t < 0) { anim = null; J.set('pitch', tr2 - 0.35 + Math.max(0, thr.t + 0.28) * 1.3); }
      else { J.set('pitch', tr2 + Math.min(0.5, thr.t)); anim = null; const k = Math.min(1, thr.t / thr.T); const to = thr.wild ? tmp.copy(thr.to).add(new THREE.Vector3(6, 2, 4)) : thr.to;
        W.ball.visible = true; W.ball.position.lerpVectors(thr.from, to, k); W.ball.position.y += Math.sin(k * Math.PI) * thr.T * 5; W.ball.scale.setScalar(Math.max(1, cam.position.distanceTo(W.ball.position) / 40));
        if (k >= 1 && !thr.done) { thr.done = true; Sound.pop(); arrive(thr.b); if (phase === 'throw') { phase = 'done'; endAt = relay ? 2.4 : 1.5; } } } }
    if (relay) { relay.t += dt; if (relay.t > 0.45) { const k = Math.min(1, (relay.t - 0.45) / (relay.from.distanceTo(relay.to) / 82)); W.ball.visible = true; W.ball.position.lerpVectors(relay.from, relay.to, k); W.ball.position.y += Math.sin(k * Math.PI) * 3;
        if (k >= 1 && !relay.done) { relay.done = true; Sound.pop(); if (!BR.done && !BR.out) { BR.out = true; BR.go = false; outsList.push(0); W.callout('DOUBLE PLAY!', 'Turned two!', 'hr', 2); Sound.cheer(); W.crowd.cheer(1); } else W.callout('SAFE AT FIRST', 'Just one out', 'ball', 1.3); } } }
    // runners
    for (const r of [BR].concat(RN)) {
      if (r.go && !r.out && !r.done) { if (r.delay > 0) { r.delay -= dt; } else { r.s = Math.min(r.to, r.s + r.v * dt / 65); if (r.s >= r.to - 1e-3) { r.done = true; r.s = r.to; if (r.to >= 4) { Sound.pop(); } } } }
      if (r.isBatter && phase === 'pitch') continue;
      if (r.isBatter && !r.go && !r.out) continue;
      if (r.isBatter) bat.visible = false;
      basePt(r.s, tmp); r.h.root.position.copy(tmp); r.h.root.visible = !(r.out && r.isBatter && caughtAir && false);
      if (r.go && !r.done && !r.out && !(r.delay > 0)) { const nx = basePt(Math.min(4, r.s + 0.05), tmp2); r.h.face(nx.x, nx.z); r.h.runStep(dt, r.v); }
      else { r.h.face(0, -BASE); r.h.set(r.out ? 'ready' : 'ready', 0); }
    }
    // teammates covering bags
    for (const k in mates) { const f = mates[k]; if (k === 'P' && phase === 'pitch') continue; if (f.goTo) { const d = f.root.position.distanceTo(f.goTo); if (d > 0.5) { f.root.position.lerp(f.goTo, Math.min(1, dt * 18 / d)); f.face(f.goTo.x, f.goTo.z); f.runStep(dt, 18); } else { f.face(meP.x, meP.z); f.set(thr && thr.done && coverOf(thr.b) === k ? 'catch' : 'ready', 0); } } }
    if (thr && thr.done && !thr.wild) { const c = mates[coverOf(thr.b)]; if (c && !relay) W.gloveHand(c, W.ball.position); }
    // the play is over once everyone has stopped
    if (phase === 'done') { const moving = [BR].concat(RN).some(r => r.go && !r.out && !r.done); if (!moving && (!relay || relay.done)) { endAt -= dt; if (endAt <= 0 && !cfg._sent) { cfg._sent = true; const out = build(); W.later(0.1, () => F.onDone && F.onDone(out)); } } }
    J.root.position.set(meP.x, 0, meP.z); if (faceTo) J.face(faceTo[0], faceTo[1]); if (anim === 'run') J.runStep(dt, SPEED); else if (anim === 'crouch' && isC) J.set('crouch', 0); else if (anim) J.set(anim, T * 1.05);
    if (phase === 'live' && ct < BR.delay + 0.02 && !BR.out) { hitter.set('swing', W.CAL.swing.tc + ct * 2.2); W.placeBat(hitter, bat); }
    if (phase === 'intro' || phase === 'pitch') { W.placeBat(hitter, bat); if (isC) J.set('crouch', 0); }
    // camera: behind him looking in at home; up high for the throw
    const v = tmp.copy(meP).setY(0); if (v.lengthSq() < 1) v.set(0, 0, 1); v.normalize();
    if (isC) { if (phase === 'throw' || phase === 'done' || F.kind === 'steal') { wantP.set(0, 16, 30); wantL.set(0, 0, -BASE - 10); } else { wantP.set(0, 9, 26); wantL.copy(W.ball.position).setY(Math.max(2, W.ball.position.y * 0.6)); } }
    else if (phase === 'throw' || phase === 'done') { wantP.copy(meP).addScaledVector(v, isIF ? 26 : 34).setY(isIF ? 38 : 56); wantL.set(meP.x * 0.3, 0, -BASE + meP.z * 0.1); }
    else { const back = isIF ? 19 : 27, hgt = isIF ? 9.5 : 17; wantP.copy(meP).addScaledVector(v, back).setY(hgt); wantL.copy(meP).addScaledVector(v, -40).setY(phase === 'live' ? clamp(W.ball.position.y * 0.45, 2, 26) : 3);
      if (phase === 'live') { wantL.x = lerp(wantL.x, W.ball.position.x, 0.35); wantL.z = lerp(wantL.z, W.ball.position.z, 0.35); } }
    if (snap) { camPos.copy(wantP); camLook.copy(wantL); snap = false; }
    camPos.lerp(wantP, phase === 'live' ? 0.12 : 0.06); camLook.lerp(wantL, phase === 'live' ? 0.16 : 0.07); cam.position.copy(camPos); cam.lookAt(camLook);
    W.setShadowArea && W.setShadowArea(meP.x * 0.6, meP.z * 0.6 - 10, 70);
  });
  J.set(isC ? 'crouch' : 'ready', 0); J.face(0, isC ? -BASE : 0);
  if (/d3test|d3rec|d3probe/.test(location.search)) window.__d3 = { get phase() { return phase; }, get has() { return has; }, get outs() { return outsList.length; }, get res() { return res || (cfg._sent ? build() : null); }, get fps() { return W.fps; }, get ballY() { return bp.y; }, get dbg() { return BL && [Math.round(meP.x), Math.round(meP.z), BL.L ? Math.round(BL.L.x) : null, BL.L ? Math.round(BL.L.z) : null, Math.round(bp.y), BL.state, +(bp.k || 0).toFixed(2)]; },
    draw: () => W.renderer.render(scene, cam), scene, step: k => { for (let i = 0; i < k; i++) W.step(); }, go: () => $('d3-go').click(), throwTo };
  say(F.sit.line + '. Press Ready.');
  return { stop: W.stop };
}
