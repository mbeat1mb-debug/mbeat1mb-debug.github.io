// Strikeout King in 3D: Jaxson pitches (left-handed) from the mound at Seed Spitters Park. Same rules as the flat version.
import { THREE, world, GLB, rnd, pick, clamp, lerp, BASE, BASES, SPITTERS, HORNETS, UMP, gearLook } from './park3d.js';
import { hudShell, safeSound } from './hud3d.js';

export function kking(cfg) {
  const { stage, level, me, end, say } = cfg, Sound = safeSound(cfg.Sound);
  const INN = level === 1 ? 2 : 3;
  const LINEUP = [['Speedy Gonzo', 'R', 0.75, 0.3, 0.5], ['Contact Kid', 'L', 0.85, 0.35, 0.7], ['Big Bo', 'R', 0.55, 0.9, 0.35], ['Moonshot', 'L', 0.5, 0.85, 0.4],
    ['Patient Pete', 'R', 0.7, 0.45, 0.85], ['Hacker', 'R', 0.6, 0.6, 0.15], ['Lefty Lou', 'L', 0.65, 0.5, 0.5], ['The Wall', 'R', 0.6, 0.55, 0.6], ['Tiny Tim', 'L', 0.7, 0.25, 0.55]]
    .map(([name, hand, contact, power, eye]) => ({ name, hand, contact: contact * [0, 0.8, 0.95, 1.05][level], power, eye: eye * [0, 0.7, 0.9, 1.1][level] }));
  const KINDS = level === 1 ? ['fast', 'change'] : ['fast', 'change', 'curve'];
  const NM = { fast: 'Fastball', change: 'Changeup', curve: 'Curve' }, SUB = { fast: 'Fast, straight', change: 'Slow, fools them', curve: 'Drops late' };
  let bi = 0, balls = 0, strikes = 0, outs = 0, inning = 1, runs = 0, ks = 0, pitches = 0, strikesThrown = 0, walks = 0, hits = 0, bases = [0, 0, 0];
  let phase = 'intro', pt = 0, sel = 'fast', aim = null, ringK = 0, P = null, prevKind = null, over = false, flyB = null;

  const W = world({ stage, me, shadow: { x: 0, z: -24, r: 40 }, fov: a => a < 0.6 ? 33 : a < 0.8 ? 27 : a < 1.2 ? 23 : 19,
    hudHTML: hudShell({ team: 'SEED SPITTERS', sub: 'STRIKEOUT KING', top: true,
      cells: [['INNING', 'k-inn'], ['COUNT', 'k-cnt'], ['OUTS', 'k-outs'], ['K', 'k-k'], ['RUNS', 'k-runs']],
      kicker: 'SEED SPITTERS PARK', title: 'STRIKEOUT KING',
      lines: ['You’re on the mound. Pick a pitch, then tap where to throw it.', 'Tap when the white ring shrinks onto the yellow ring: better timing = better aim.', 'A changeup after fastballs fools hitters.'],
      extra: '<div class="d3who" id="k-who"></div><div class="d3dia" id="k-dia"><i></i><i></i><i></i></div><div class="d3btns" id="k-btns"></div>' }) });
  const { scene, cam, $ } = W;

  // people: Jaxson (Spitters, throws left) on the mound; Hornets hitters; Spitters defense
  const S = SPITTERS(me);
  const GL = gearLook(me), J = W.human(Object.assign({ mirror: true, glove: true, cap: true, skin: 0xf0c8a5, hair: 0x4a2e18 }, S, { colors: Object.assign({}, S.colors, GL.shoes != null ? { shoes: GL.shoes } : {}) }));
  J.root.position.set(0, 0.55, -BASE); J.root.rotation.y = Math.PI; scene.add(J.root);
  const bat = W.makeBat();
  const hitter = { R: W.human(Object.assign({ helmet: true }, HORNETS(12))), L: W.human(Object.assign({ mirror: true, helmet: true }, HORNETS(14))) };
  for (const k of ['R', 'L']) { scene.add(hitter[k].root); W.standInBox(hitter[k], bat); hitter[k].home = hitter[k].root.position.clone(); }
  const catcher = W.human(Object.assign({ helmet: true, glove: true }, S, { colors: Object.assign({}, S.colors, { helmet: 0x161616 }), letters: null }));
  catcher.root.position.set(0, 0, 3.2); catcher.root.scale.setScalar(0.92); catcher.set('crouch', 0); scene.add(catcher.root);
  const ump = W.human(UMP); ump.root.position.set(0.8, 0, 6.6); ump.set('ump', 0); scene.add(ump.root);
  const D = [[BASE + 6, -BASE - 10], [18, -2 * BASE + 4], [-18, -2 * BASE + 4], [-BASE - 6, -BASE - 10], [-95, -150], [0, -175], [95, -150]].map(([x, z]) => {
    const f = W.human(Object.assign({ lod: true, glove: true }, S, { letters: null })); f.root.position.set(x, 0, z); f.face(0, 0); f.set('ready', 0); scene.add(f.root); return f; });
  const runners = [1, 2, 3].map(i => { const r = W.human(Object.assign({ lod: true, helmet: true }, HORNETS())); const [x, z] = BASES[i]; r.root.position.set(x + (i === 2 ? 3 : -3) * (i === 1 ? -1 : 1), 0, z + 2); r.face(0, -BASE); r.set('ready', 0); r.root.visible = false; scene.add(r.root); return r; });

  // strike zone at the plate, seen from the mound
  const zone = new THREE.Group(); zone.position.set(0, 2.5, 0.05); scene.add(zone);
  { const edge = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }), grid = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false });
    const bar = (w, h, x, y, m) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); b.position.set(x, y, 0); b.renderOrder = 10; b.rotation.y = Math.PI; zone.add(b); };
    const w = 1.7, h = 2.0, t = 0.05; bar(w + t, t, 0, h / 2, edge); bar(w + t, t, 0, -h / 2, edge); bar(t, h + t, -w / 2, 0, edge); bar(t, h + t, w / 2, 0, edge);
    for (const k of [-1, 1]) { bar(0.02, h, k * w / 6, 0, grid); bar(w, 0.02, 0, k * h / 6, grid); } }
  const target = W.ring(0.27, 0.36, 0xffd23f, 1); target.visible = false;
  const shrink = W.ring(0.9, 0.98, 0xffffff, 0.95); shrink.visible = false;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false })); dot.renderOrder = 13; dot.visible = false; scene.add(dot);
  const mark = W.ring(0.13, 0.2, 0xff4040, 1); mark.visible = false; let markT = 9;

  // camera: behind the mound, over Jaxson's shoulder
  const CAM = { pos: new THREE.Vector3(-2.4, 7.6, -BASE - 11), look: new THREE.Vector3(0, 2.9, 0) };
  cam.position.copy(CAM.pos); cam.lookAt(CAM.look);
  const bat_ = () => LINEUP[bi % 9];
  let H = hitter.R; const showHitter = () => { const B = bat_(); H = hitter[B.hand]; hitter.R.root.visible = H === hitter.R; hitter.L.root.visible = H === hitter.L; H.set('swing', 0); W.placeBat(H, bat); };
  showHitter();

  // HUD
  const btns = $('k-btns');
  btns.innerHTML = KINDS.map((k, i) => `<button type="button" class="d3btn" data-k="${k}"><b>${NM[k]}</b><span>${SUB[k]}</span></button>`).join('');
  btns.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (over || !(phase === 'pick' || phase === 'aim')) return; sel = b.dataset.k; Sound.tick(); if (phase === 'pick') phase = 'aim'; paint(); }));
  const tip = t => { $('d3-tip').textContent = t; };
  function paint() {
    $('k-inn').textContent = inning + '/' + INN; $('k-cnt').textContent = balls + '–' + strikes; $('k-outs').textContent = outs % 3; $('k-k').textContent = ks; $('k-runs').textContent = runs;
    btns.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === sel)); btns.classList.toggle('hide', !(phase === 'pick' || phase === 'aim'));
    const B = bat_(); $('k-who').innerHTML = '<span>AT BAT</span><b>' + B.name + '</b><i>' + (B.hand === 'L' ? 'Bats left' : 'Bats right') + '</i>';
    [...$('k-dia').children].forEach((d, i) => d.classList.toggle('on', !!bases[i]));
    runners.forEach((r, i) => { r.root.visible = !!bases[i]; });
    if (phase === 'pick') tip('Pick a pitch, then tap where to throw it'); else if (phase === 'aim') tip('Tap where to throw it (corners are hard to hit)'); else if (phase === 'ring') tip('TAP when the white ring hits the yellow ring'); else tip('');
    W.drawBoard([['INNING ' + inning + '   K ' + ks, 120], ['RUNS ' + runs + ' · ' + balls + '–' + strikes + ' · ' + (outs % 3) + ' OUT', 52, '#bbbbbb']]);
  }

  const inZone = (x, h) => Math.abs(x) <= 0.85 && h >= 1.5 && h <= 3.5;
  function throwIt() {
    const acc = clamp(1 - Math.abs(ringK - 0.35) / 0.35, 0, 1), miss = (1 - acc) * [0, 0.6, 0.9, 1.1][level];
    const a = Math.random() * Math.PI * 2;
    const mph = Math.round((sel === 'fast' ? rnd(48, 54) : sel === 'change' ? rnd(38, 42) : rnd(40, 45)));
    P = { kind: sel, mph, x: aim.x + Math.cos(a) * miss, h: aim.h + Math.sin(a) * miss, t: 0, T: 46 / (mph * 1.4667) * 1.35, acc, swing: null, from: new THREE.Vector3(), sw: null };
    P.zone = inZone(P.x, P.h);
    pitches++;
    target.visible = shrink.visible = dot.visible = false;
    phase = 'wind'; pt = 0; say(NM[sel] + ', ' + (acc > 0.8 ? 'right on target' : acc > 0.5 ? 'close to target' : 'off target'));
    const B = bat_(), two = strikes === 2, edge = Math.min(1, Math.max(Math.abs(P.x) / 0.85, Math.abs(P.h - 2.5) / 1.0)), fooled = (sel === 'change' && prevKind === 'fast') || (sel === 'curve' && Math.random() < 0.45);
    let sp = P.zone ? 0.5 + (two ? 0.3 : 0) + (edge < 0.5 ? 0.15 : 0) : (1 - B.eye) * (0.3 + (two ? 0.35 : 0)) + (sel !== 'fast' ? 0.15 : 0);
    if (balls === 3 && !P.zone) sp *= 0.6;
    if (Math.random() < sp) { const cp = B.contact * (P.zone ? 1 - 0.45 * edge : 0.35) * (fooled ? 0.5 : 1) * (sel === 'fast' ? 0.9 : 1); P.swing = { contact: Math.random() < cp, edge, fooled }; }
    prevKind = sel; paint();
  }
  function call(main, sub, cls, voice) { W.callout(main, sub, cls, 1.7); if (voice) Sound.say(voice); say(main + (sub ? '. ' + sub : '')); phase = 'call'; pt = 0; paint(); }
  function advance(n, walk) {
    let scored = 0;
    if (walk) { if (bases[0] && bases[1] && bases[2]) scored++; if (bases[0] && bases[1]) bases[2] = 1; if (bases[0]) bases[1] = 1; bases[0] = 1; }
    else { for (let i = 2; i >= 0; i--) if (bases[i]) { bases[i] = 0; if (i + n >= 3) scored++; else bases[i + n] = 1; } if (n >= 4) scored++; else bases[n - 1] = 1; }
    runs += scored; return scored;
  }
  function nextBatter() { bi++; balls = 0; strikes = 0; }
  function out(main, sub, voice) { outs++; nextBatter(); if (outs % 3 === 0) bases = [0, 0, 0]; call(main, sub, 'out', voice); }
  // where a batted ball goes (just for the show; the result is already decided)
  function fly(kind) {
    const side = H === hitter.L ? -1 : 1, a = kind === 'foul' ? pick([-1, 1]) * rnd(50, 80) : kind === 'hr' ? rnd(-30, 30) : rnd(-38, 38);
    const d = kind === 'hr' ? rnd(240, 290) : kind === 'foul' ? rnd(40, 90) : kind === 'ground' ? rnd(70, 110) : kind === 'pop' ? rnd(60, 120) : rnd(130, 190);
    const r = (a * side) * Math.PI / 180, to = new THREE.Vector3(Math.sin(r) * d, 0, -Math.cos(r) * d), up = kind === 'ground' ? 4 : kind === 'pop' ? 70 : kind === 'hr' ? 75 : kind === 'foul' ? 35 : 40;
    if (kind === 'foul' && Math.random() < 0.5) to.set(rnd(-10, 10), 0, 40);
    flyB = { t: 0, T: kind === 'ground' ? 1.2 : kind === 'hr' ? 3 : 2.2, from: W.ball.position.clone(), to, up, ground: kind === 'ground' };
  }
  function land() {
    Sound.pop(); mark.position.set(P.x, P.h, 0.08); mark.material.color.setHex(P.zone ? 0xff4040 : 0x40a8ff); mark.lookAt(cam.position); markT = 0;
    if (P.zone || P.swing) strikesThrown++;
    const B = bat_();
    if (P.swing && !P.swing.contact) { W.ball.visible = false; strikes++; if (strikes === 3) { ks++; Sound.crack(); W.crowd.cheer(0.5); out('STRIKE THREE!', 'Swinging · K #' + ks, 'Strike three!'); } else call('STRIKE ' + strikes, 'Swinging' + (P.swing.fooled ? ' · fooled him!' : ''), 'ball', 'Strike!'); return; }
    if (P.swing && P.swing.contact) {
      Sound.crack();
      const r = Math.random(), hitP = 0.28 * (1 - P.swing.edge * 0.6) + B.power * 0.08 + (P.zone ? 0 : -0.12);
      if (r < 0.42) { fly('foul'); if (strikes < 2) strikes++; call('FOUL BALL', balls + '–' + strikes, 'ball'); return; }
      if (Math.random() < hitP) {
        hits++; const hrP = B.power * 0.25 * (P.swing.edge < 0.4 ? 1.4 : 0.4) * (P.acc < 0.5 ? 1.5 : 1);
        const n = Math.random() < hrP ? 4 : Math.random() < 0.25 ? 2 : 1, sc = advance(n); fly(n === 4 ? 'hr' : 'line');
        Sound.ooh(); nextBatter(); call(n === 4 ? 'HOME RUN' : n === 2 ? 'DOUBLE' : 'SINGLE', B.name + (sc ? ' · ' + sc + ' run' + (sc > 1 ? 's' : '') + ' score' + (sc > 1 ? '' : 's') : ''), 'hit'); return;
      }
      const o = pick([['GROUND OUT', 'To second', 'ground'], ['FLY OUT', 'To center', 'line'], ['POP UP', 'To short', 'pop'], ['GROUND OUT', 'Back to you!', 'ground'], ['LINE OUT', 'To third', 'line']]);
      fly(o[2]); W.crowd.cheer(0.3); out(o[0], o[1], null); return;
    }
    W.ball.visible = false;
    if (P.zone) { strikes++; if (strikes === 3) { ks++; W.crowd.cheer(0.5); out('STRIKE THREE!', 'Caught looking · K #' + ks, 'Strike three! You’re out!'); } else call('STRIKE ' + strikes, 'Looking', 'ball', 'Strike!'); return; }
    balls++; if (balls === 4) { walks++; const sc = advance(1, true); nextBatter(); call('BALL FOUR', 'Walk' + (sc ? ' · a run scores' : ''), 'ball', 'Ball four'); } else call('BALL ' + balls, balls + '–' + strikes, 'ball', 'Ball');
  }

  // input: tap the plate area to aim, then tap again to throw
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const onDown = e => {
    e.preventDefault(); Sound.unlock(); if (over || phase === 'intro') return;
    if (phase === 'pick' || phase === 'aim') { const p = W.toPlane(e.clientX, e.clientY, plane); if (p && Math.abs(p.x) < 2.2 && p.y > 0.6 && p.y < 4.6) { aim = { x: p.x, h: p.y }; phase = 'ring'; pt = 0; ringK = 1; Sound.tick(); paint(); } return; }
    if (phase === 'ring') throwIt();
  };
  W.cv.addEventListener('pointerdown', onDown);
  const onKey = e => { if (phase === 'intro') return; if (/^[1-3]$/.test(e.key) && KINDS[+e.key - 1] && (phase === 'pick' || phase === 'aim')) { sel = KINDS[+e.key - 1]; if (phase === 'pick') phase = 'aim'; paint(); }
    else if (e.key === ' ' || e.key === 'Enter') { if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; e.preventDefault(); if (phase === 'aim' || phase === 'pick') { aim = { x: 0, h: 2.5 }; phase = 'ring'; pt = 0; paint(); } else if (phase === 'ring') throwIt(); } };
  window.addEventListener('keydown', onKey); W.cleanups.push(() => window.removeEventListener('keydown', onKey));
  $('d3-go').addEventListener('click', () => { Sound.unlock(); $('d3-intro').classList.add('gone'); phase = 'pick'; paint(); W.cv.focus(); });
  $('d3-go').focus();

  const tmp = new THREE.Vector3();
  J.set('pitch', 0);
  W.run((dt, T) => {
    pt += dt;
    if (window.__d3auto) { if (phase === 'pick' || phase === 'aim') { aim = { x: rnd(-0.6, 0.6), h: rnd(1.9, 3.1) }; phase = 'ring'; pt = 0; } else if (phase === 'ring' && pt > 0.6) { ringK = 1 - ((pt / 0.9) % 1); throwIt(); } }
    if (phase === 'ring') {
      ringK = 1 - ((pt / 0.9) % 1);
      target.visible = shrink.visible = dot.visible = true;
      for (const m of [target, shrink, dot]) { m.position.set(aim.x, aim.h, 0.1); m.lookAt(cam.position); }
      shrink.scale.setScalar(Math.max(0.03, ringK));
      if (pt > 2.7) throwIt();
    }
    // Jaxson's delivery, then the ball
    const tr = W.CAL.pitch.tr;
    if (phase === 'wind') { J.set('pitch', pt * tr / 0.8); if (pt >= 0.8) { W.handPos(J, P.from); W.ball.position.copy(P.from); W.ball.visible = true; phase = 'throw'; P.t = 0; Sound.whoosh(); } }
    else if (phase === 'throw' || (phase === 'call' && pt < 1)) J.set('pitch', tr + (phase === 'throw' ? P.t : 0.6 + pt));
    if (phase === 'throw') {
      P.t += dt; const p = P.t / P.T;
      const brk = P.kind === 'curve' ? 1.3 : P.kind === 'change' ? 0.5 : 0, sd = P.kind === 'curve' ? -0.7 : P.kind === 'change' ? 0.3 : 0, q = Math.min(1, p);
      W.ball.position.set(lerp(P.from.x, P.x, q) + sd * Math.sin(Math.PI * q) * 0.5, lerp(P.from.y, P.h + brk, q) - brk * q * q, lerp(P.from.z, 0, q));
      // hitter: load as the ball comes, swing so contact meets the ball
      const tc = W.CAL.swing.tc, L0 = Math.max(0, tc - 0.2);
      if (p < 0.75) H.set('swing', clamp(p / 0.75, 0, 1) * L0);
      else if (P.swing) H.set('swing', L0 + clamp((p - 0.75) / 0.25, 0, 1) * (tc - L0));
      W.placeBat(H, bat);
      if (p >= 1) land();
    }
    if (phase === 'call') {
      const tc = W.CAL.swing.tc;
      if (P && P.swing) { H.set('swing', tc + Math.min(1, pt / 0.6) * (1.55 - tc)); W.placeBat(H, bat); }
      if (flyB) { flyB.t += dt; const k = Math.min(1, flyB.t / flyB.T); W.ball.visible = true;
        W.ball.position.lerpVectors(flyB.from, flyB.to, k); W.ball.position.y = flyB.ground ? Math.max(0.25, lerp(flyB.from.y, 0.25, Math.min(1, k * 4)) + Math.abs(Math.sin(k * 12)) * (1 - k) * 2) : lerp(flyB.from.y, 0.3, k) + 4 * flyB.up * k * (1 - k);
        W.ballShadow.visible = true; W.ballShadow.position.set(W.ball.position.x, 0.06, W.ball.position.z); if (k >= 1) { flyB = null; W.ball.visible = false; W.ballShadow.visible = false; } }
      if (pt >= 1.9) {
        W.ball.visible = false; W.ballShadow.visible = false; flyB = null;
        if (outs >= INN * 3 || runs >= 6) { over = true; phase = 'end'; W.later(0.4, finishGame); }
        else { if (outs > 0 && outs % 3 === 0 && outs / 3 + 1 > inning) { inning = outs / 3 + 1; W.callout('INNING ' + inning, 'Three up, three down!', 'hit', 1.6); }
          phase = 'pick'; aim = null; P = null; showHitter(); J.set('pitch', 0); paint(); }
      }
    }
    markT += dt; mark.visible = markT < 1.6; if (mark.visible) mark.material.opacity = markT < 1.1 ? 1 : 1 - (markT - 1.1) * 2;
    if (W.ball.visible) W.ball.rotation.x += dt * 30;
    cam.position.copy(CAM.pos); cam.lookAt(CAM.look);
  });
  paint();
  function finishGame() {
    const sp = pitches ? Math.round(strikesThrown / pitches * 100) : 0;
    end(ks, [ks + ' strikeout' + (ks === 1 ? '' : 's') + '!', 'Pitches: ' + pitches + ' · Strikes: ' + strikesThrown + ' of ' + pitches + ' = ' + sp + '%', 'Runs: ' + runs + ' · Hits: ' + hits + ' · Walks: ' + walks,
      runs >= 6 ? 'Coach came to get the ball. Throw more strikes next time!' : sp >= 55 ? 'Over 55% strikes: that’s the goal in real games too.' : 'Aim for 55% strikes or more, same as in real games.',
      walks >= 3 ? 'Coach tip: ' + walks + ' walks. When you’re behind in the count, aim for the middle of the zone and trust your stuff.' : 'Coach tip: a changeup right after a fastball fools hitters the most.']);
  }
  if (/d3test|d3rec|d3probe/.test(location.search)) window.__d3 = { get pt() { return pt; }, get phase() { return phase; }, get outs() { return outs; }, get ks() { return ks; }, get fps() { return W.fps; }, draw: () => W.renderer.render(scene, cam), scene, step: n => { for (let i = 0; i < n; i++) W.step(); }, go: () => $('d3-go').click(), J };
  say('Strikeout King at Seed Spitters Park. Press Play Ball.');
  return { stop: W.stop };
}
