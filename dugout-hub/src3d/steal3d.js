// Steal Second in 3D: Jaxson leads off first. Read the pitcher: GO on his first move home, BACK if he spins to first. Same rules as the flat version.
import { THREE, world, rnd, clamp, lerp, BASE, BASES, SPITTERS, HORNETS, gearLook } from './park3d.js';
import { hudShell, safeSound } from './hud3d.js';

export function steal(cfg) {
  const { stage, level, me, end, say } = cfg, Sound = safeSound(cfg.Sound);
  const TRIES = 8, BASEFT = 65;
  const POP = [0, 2.35, 2.15, 1.95][level], KICK = [0, 0.95, 0.85, 0.75][level], PICKT = [0, 0.75, 0.62, 0.52][level];
  let tries = 0, sb = 0, outsN = 0, jumps = [], phase = 'intro', pt = 0, lead = 4, move = null, wait = 0, went = null, back = null, res = null, runX = 0, over = false, throwBall = null, look = 0, msgT = 9;

  const B1 = new THREE.Vector3(BASES[1][0], 0, BASES[1][1]), B2 = new THREE.Vector3(BASES[2][0], 0, BASES[2][1]), U = B2.clone().sub(B1).normalize();
  const along = (ft, out) => (out || new THREE.Vector3()).copy(B1).addScaledVector(U, ft);
  const W = world({ stage, me, shadow: { x: 22, z: -62, r: 45 }, fov: a => a < 0.8 ? 58 : a < 1.2 ? 50 : 42,
    hudHTML: hudShell({ team: 'SEED SPITTERS', sub: 'STEAL SECOND', top: true,
      cells: [['STEALS', 's-sb'], ['TRY', 's-try'], ['OUTS', 's-outs'], ['BEST JUMP', 's-jump']],
      kicker: 'SEED SPITTERS PARK', title: 'STEAL SECOND',
      lines: ['Drag sideways to take your lead. Bigger lead = faster steal, but more pickoff throws.', 'Press GO the moment his knee lifts toward home.', 'If he spins to first, press BACK!'],
      extra: '<div class="d3lead" id="s-lead"></div><div class="d3eyes" id="s-eyes">👀</div><div class="d3go2"><button type="button" class="d3big back" id="s-back">◀ BACK</button><button type="button" class="d3big go" id="s-go">GO! ▶</button></div>' }) });
  const { scene, cam, $ } = W;
  const S = SPITTERS(me), Hn = HORNETS(7);

  // Jaxson on first; Hornets pitcher (right-handed) in the stretch; first baseman holding him on; middle infielder covering second
  const GL = gearLook(me), J = W.human(Object.assign({ helmet: true, skin: 0xf0c8a5, hair: 0x4a2e18, finish: GL.finish }, S, { colors: Object.assign({}, S.colors, GL.shoes != null ? { shoes: GL.shoes } : {}, GL.helmet != null ? { helmet: GL.helmet } : {}) })); scene.add(J.root);
  const P1 = W.human(Object.assign({ glove: true }, Hn)); P1.root.position.set(0, 0.55, -BASE); P1.root.rotation.y = Math.PI; P1.set('pitch', 0); scene.add(P1.root);
  const F1 = W.human(Object.assign({ glove: true }, HORNETS(23))); F1.root.position.set(BASE + 1.5, 0, -BASE + 1.2); F1.face(0, -BASE); F1.set('ready', 0); scene.add(F1.root);
  const SS = W.human(Object.assign({ glove: true }, HORNETS(6))); const ssHome = new THREE.Vector3(-14, 0, -2 * BASE + 8); SS.root.position.copy(ssHome); SS.face(0, 0); SS.set('ready', 0); scene.add(SS.root);
  const F2 = W.human(Object.assign({ lod: true, glove: true }, HORNETS())); F2.root.position.set(22, 0, -2 * BASE + 2); F2.face(0, 0); F2.set('ready', 0); scene.add(F2.root);
  const F3 = W.human(Object.assign({ lod: true, glove: true }, HORNETS())); F3.root.position.set(-BASE - 4, 0, -BASE - 6); F3.face(0, 0); F3.set('ready', 0); scene.add(F3.root);
  [[-90, -150], [0, -175], [90, -150]].forEach(([x, z]) => { const f = W.human(Object.assign({ lod: true, glove: true }, HORNETS())); f.root.position.set(x, 0, z); f.face(0, 0); f.set('ready', 0); scene.add(f.root); });
  const C = W.human(Object.assign({ helmet: true, glove: true }, Hn, { colors: Object.assign({}, Hn.colors, { helmet: 0x161616 }), letters: null })); C.root.position.set(0, 0, 3.2); C.root.scale.setScalar(0.92); C.set('crouch', 0); scene.add(C.root);
  const bat = W.makeBat(); const hitter = W.human(Object.assign({ helmet: true }, S, { letters: Object.assign({}, S.letters, { num: '9', name: 'TEAMMATE' }) })); scene.add(hitter.root); W.standInBox(hitter, bat);

  // lead markings in the dirt every 3 ft (white, then yellow, then red = risky)
  for (let f = 3; f <= 15; f += 3) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.6), new THREE.MeshBasicMaterial({ color: f > 11 ? 0xff6b6b : f > 8 ? 0xffd23f : 0xffffff, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(U.x, U.z); const p = along(f).addScaledVector(new THREE.Vector3(-U.z, 0, U.x), -2.2); m.position.set(p.x, 0.07, p.z); scene.add(m); }

  // camera: behind first base, down the line toward second
  const CAM = { pos: new THREE.Vector3(BASE + 19, 7.5, -BASE + 9), look: new THREE.Vector3(10, 3.2, -BASE - 12) };
  const camPos = CAM.pos.clone(), camLook = CAM.look.clone();

  const startTry = () => { camPos.copy(CAM.pos); camLook.copy(CAM.look); lead = clamp(lead, 3, 15); move = null; went = null; back = null; res = null; runX = lead; throwBall = null; wait = rnd(1.3, 3.6); look = 0; phase = 'set'; pt = 0;
    SS.root.position.copy(ssHome); SS.face(0, 0); SS.set('ready', 0); F1.set('ready', 0); P1.turn.rotation.y = 0; P1.set('pitch', 0); W.ball.visible = false;
    say('Try ' + (tries + 1) + ' of ' + TRIES + '. Drag to take your lead, then press GO when he kicks toward home.'); paint(); };
  const go = () => { if (phase !== 'set' && phase !== 'move') return; if (went != null || back != null) return; went = move ? move.t : -1; Sound.whoosh();
    if (!move) { move = { kind: 'pick', t: 0, early: true }; phase = 'move'; } paint(); };
  const goBack = () => { if (back != null || went != null || (phase !== 'set' && phase !== 'move')) return; back = move ? move.t : -1; paint(); };
  function settle(kind, safe, text, voice) {
    res = { kind, safe, t: 0 }; tries++; phase = 'result'; pt = 0;
    if (kind === 'steal' && safe) { sb++; W.callout('SAFE!', text, 'hit', 2); Sound.cheer(); W.crowd.cheer(0.6); }
    else if (kind === 'steal' || kind === 'picked') { outsN++; W.callout('OUT!', text, 'out', 2); Sound.ooh(); }
    if (voice) Sound.say(voice); say(text); paint();
  }
  function note(main, sub, cls) { W.callout(main, sub, cls || 'ball', 1.6); say(main + (sub ? '. ' + sub : '')); }
  function paint() {
    $('s-sb').textContent = sb; $('s-try').textContent = Math.min(tries + 1, TRIES) + '/' + TRIES; $('s-outs').textContent = outsN + '/3'; $('s-jump').textContent = jumps.length ? Math.min(...jumps) + ' ms' : '–';
    const on = phase === 'set' || phase === 'move'; $('s-go').disabled = !on || went != null || back != null; $('s-back').disabled = !on || went != null || back != null;
    $('s-go').classList.toggle('on', went != null); $('s-back').classList.toggle('on', back != null);
    const L = $('s-lead'); L.style.display = phase === 'set' ? '' : 'none'; L.textContent = 'LEAD ' + Math.round(lead) + ' FT · drag to change'; L.className = 'd3lead ' + (lead > 11 ? 'red' : lead > 8 ? 'amber' : '');
    W.drawBoard([['STEALS ' + sb + '   OUTS ' + outsN, 110], ['#' + me.num + ' ' + me.name.toUpperCase() + ' ON FIRST', 48, '#bbbbbb']]);
  }
  $('s-go').addEventListener('click', e => { e.stopPropagation(); go(); });
  $('s-back').addEventListener('click', e => { e.stopPropagation(); goBack(); });
  // drag anywhere on the field to set the lead
  let drag = null; const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const pxPerFt = () => { const a = W.toScreen(along(lead)), b = W.toScreen(along(lead + 1)); return { dx: b.x - a.x, dy: b.y - a.y }; };
  W.cv.addEventListener('pointerdown', e => { e.preventDefault(); Sound.unlock(); if (over || phase === 'intro') return; if (phase === 'set') { drag = { x: e.clientX, y: e.clientY }; W.cv.setPointerCapture && W.cv.setPointerCapture(e.pointerId); } });
  W.cv.addEventListener('pointermove', e => { if (!drag || phase !== 'set') return; const v = pxPerFt(), L2 = v.dx * v.dx + v.dy * v.dy || 1; const d = ((e.clientX - drag.x) * v.dx + (e.clientY - drag.y) * v.dy) / L2;
    lead = clamp(lead + d, 2, 15); runX = lead; drag = { x: e.clientX, y: e.clientY }; paint(); });
  const up = () => { drag = null; }; W.cv.addEventListener('pointerup', up); W.cv.addEventListener('pointercancel', up);
  const onKey = e => { if (phase === 'intro') return; if (e.key === 'ArrowRight' && phase === 'set') { lead = clamp(lead + 1, 2, 15); runX = lead; paint(); }
    else if (e.key === 'ArrowLeft') { if (phase === 'set' && !move) { lead = clamp(lead - 1, 2, 15); runX = lead; paint(); } else goBack(); }
    else if (e.key === ' ' || e.key === 'Enter') { if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; e.preventDefault(); go(); } };
  window.addEventListener('keydown', onKey); W.cleanups.push(() => window.removeEventListener('keydown', onKey));
  $('d3-go').addEventListener('click', () => { Sound.unlock(); $('d3-intro').classList.add('gone'); W.cv.focus(); startTry(); });
  $('d3-go').focus();

  const ballFrom = new THREE.Vector3(), ballTo = new THREE.Vector3(), eyes = { x: 0, y: 0 };
  W.run((dt, T) => {
    pt += dt;
    if (window.__d3auto && phase === 'move' && move.kind === 'home' && went == null && move.t > 0.18) go();
    const tr = W.CAL.pitch.tr;
    if (phase === 'set') {
      if (Math.random() < dt * 0.25) look = 0.8; look = Math.max(0, look - dt);
      if (pt > wait) { const pickP = clamp(0.18 + (lead - 6) * 0.05, 0.12, 0.55); move = { kind: Math.random() < pickP ? 'pick' : 'home', t: 0 }; phase = 'move'; }
    }
    if (phase === 'move') {
      move.t += dt;
      if (move.kind === 'home') {
        P1.set('pitch', move.t / (KICK + 0.75) * tr);   // leg kick, then the pitch is released at KICK + 0.75
        if (went != null) {
          const jump = went, runT = jump + 0.3 + (BASEFT - lead) / 19.5, throwT = KICK + 0.75 + POP, t = move.t;
          runX = lead + clamp((t - jump - 0.3) / (runT - jump - 0.3), 0, 1) * (BASEFT - lead);
          if (t > KICK + 0.75 && !throwBall) { throwBall = { to: 2, t0: t, T: POP }; Sound.pop(); }
          if (t >= Math.max(runT, throwT)) { const margin = throwT - runT; jumps.push(Math.round(jump * 1000)); Sound.slide();
            settle('steal', margin > 0, margin > 0 ? (margin < 0.12 ? 'Safe by a hair! ' : '') + 'Jump ' + Math.round(jump * 1000) + ' ms' : (margin > -0.12 ? 'Out by a hair. ' : '') + 'Jump ' + Math.round(jump * 1000) + ' ms. Go sooner!', margin > 0 ? 'Safe!' : 'Out!'); }
        } else if (move.t > KICK + 1.0 && phase === 'move') { note('NO GO', 'He didn’t go. Pitch is in.'); phase = 'gap'; pt = 0; }
        else if (move.t > KICK + 0.75 && !throwBall) { throwBall = { to: 0, t0: move.t, T: 0.5 }; }
      } else {   // pickoff: he spins and throws to first
        P1.turn.rotation.y = lerp(0, Math.PI / 2, clamp(move.t / 0.18, 0, 1)); P1.set('pitch', tr - 0.3 + move.t * 1.6);
        if (move.t > 0.25 && !throwBall) { throwBall = { to: 1, t0: move.t, T: PICKT - 0.25 }; Sound.whoosh(); }
        if (went != null) { runX = lead + Math.min(1, move.t / 2) * 10; if (move.t > PICKT + 0.1) settle('picked', false, move.early ? 'Too early! He saw you go. Picked off.' : 'Picked off! He threw to first.', 'Out!'); }
        else { const react = back != null ? back : 0.42, home = react + lead / 21;
          runX = lead * (1 - clamp((move.t - react) / (lead / 21), 0, 1));
          if (move.t > Math.max(home, PICKT)) { const safe = home < PICKT + 0.12; if (safe) { phase = 'gap'; pt = 0; Sound.slide(); note(back != null ? 'BACK IN TIME' : 'SAFE AT FIRST', back != null ? 'Good read!' : 'Pickoff throw, but you got back', 'hit'); }
            else settle('picked', false, 'Lead was too big or you were slow back.', 'Out!'); } }
      }
    }
    // the ball
    if (throwBall) {
      const k = clamp(((move ? move.t : 0) - throwBall.t0) / throwBall.T, 0, 1);
      if (!throwBall.set) { throwBall.set = true; if (throwBall.to === 2) ballFrom.set(0, 5.5, 1.5); else W.handPos(P1, ballFrom);
        if (throwBall.to === 0) ballTo.set(0, 2.5, 2.8); else if (throwBall.to === 1) W.gloveHand(F1, ballTo); else ballTo.set(B2.x + 0.6, 2.2, B2.z + 0.6); }
      W.ball.visible = k < 1 || (res && throwBall.to !== 0); W.ball.position.lerpVectors(ballFrom, ballTo, k); W.ball.position.y += Math.sin(k * Math.PI) * (throwBall.to === 2 ? 4 : 1.2);
      W.ball.rotation.x += dt * 30;
    }
    // Jaxson: lead stance, running, sliding, diving back
    const pos = along(runX);
    if (phase === 'set' || (phase === 'move' && went == null && !(move && move.kind === 'pick' && move.t > (back != null ? back : 0.42)))) { J.root.position.copy(pos); J.face(0, -BASE); J.set('ready', 0); }
    else if (res && res.kind === 'steal') { res.t += dt; const k = clamp(res.t / 0.35, 0, 1); J.root.position.copy(along(lerp(BASEFT - 9, BASEFT - 1, k))); J.face(B2.x, B2.z); J.set('slide', 0); }
    else if (phase === 'move' && went != null) { J.root.position.copy(pos); J.face(B2.x, B2.z); J.set('run', T * 1.05);
      if (move.kind === 'home' && runX > BASEFT - 10 && !throwBall) {} }
    else if (phase === 'move' || (phase === 'gap' && move && move.kind === 'pick') || (res && res.kind === 'picked')) { J.root.position.copy(pos); J.face(B1.x, B1.z); if (runX < 5) J.set('dive', 0); else J.set('run', T * 1.05); }
    // fielders react
    if (move && move.kind === 'home' && went != null) { const k = clamp((move.t - KICK) / 0.9, 0, 1); SS.root.position.lerpVectors(ssHome, tmp.set(B2.x + 1.5, 0, B2.z + 1.5), k); SS.face(B2.x + (k < 1 ? 0 : 0), k < 1 ? B2.z : 0); SS.set(k < 1 ? 'run' : 'catch', T * 1.05); }
    if (move && move.kind === 'pick' && move.t > 0.2) F1.set('catch', 0);
    // he peeks at you
    const eyesEl = $('s-eyes'); if (phase === 'set') P1.set('pitch', 0); if (look > 0 && phase === 'set') { const s = W.toScreen(tmp2.set(0, 8.5, -BASE)); eyesEl.style.opacity = 1; eyesEl.style.left = s.x + 'px'; eyesEl.style.top = s.y + 'px'; P1.parts.head.rotation.y += 0.9; } else eyesEl.style.opacity = 0;
    if (phase === 'set' || phase === 'move') paint.n = (paint.n || 0) + 1;
    if ((phase === 'result' && pt > 2.0) || (phase === 'gap' && pt > 1.4)) { if (tries >= TRIES || outsN >= 3) { over = true; phase = 'end'; W.later(0.3, finishGame); } else startTry(); }
    camPos.lerp(went != null && phase !== 'set' && !(move && move.kind === 'pick') ? tmp.set(BASE + 6, 16, -BASE - 2) : CAM.pos, 0.05); camLook.lerp(went != null && phase !== 'set' && !(move && move.kind === 'pick') ? tmp2.set(4, 2, -2 * BASE + 4) : CAM.look, 0.08); cam.position.copy(camPos); cam.lookAt(camLook);
  });
  paint();
  function finishGame() { const avg = jumps.length ? Math.round(jumps.reduce((a, b) => a + b, 0) / jumps.length) : null;
    end(sb, [sb + ' stolen base' + (sb === 1 ? '' : 's') + '!', 'Outs: ' + outsN + (avg != null ? ' · Average jump: ' + avg + ' ms' : ''), 'Real base stealers go on the pitcher’s first move home, not when the ball is thrown.']); }
  if (/d3test|d3rec|d3probe/.test(location.search)) window.__d3 = { get phase() { return phase; }, get sb() { return sb; }, get outs() { return outsN; }, get tries() { return tries; }, get fps() { return W.fps; }, draw: () => W.renderer.render(scene, cam), scene, step: n => { for (let i = 0; i < n; i++) W.step(); }, go: () => $('d3-go').click(), steal: go, back: goBack, setLead: v => { lead = v; runX = v; } };
  say('Steal Second at Seed Spitters Park. Press Play Ball.');
  return { stop: W.stop };
}
