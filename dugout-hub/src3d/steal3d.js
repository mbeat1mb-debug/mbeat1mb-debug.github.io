// Steal Second in 3D: Jaxson leads off first. Tap LEAD OFF to shuffle out, GO on the pitcher's first move home,
// tap anywhere to slide into second, BACK to dive head-first into first on a pickoff.
import { THREE, world, rnd, clamp, lerp, BASE, BASES, SPITTERS, HORNETS, gearLook } from './park3d.js';
import { hudShell, safeSound } from './hud3d.js';

export function steal(cfg) {
  const { stage, level, me, end, say } = cfg, Sound = safeSound(cfg.Sound);
  const TRIES = 8, BASEFT = 65, SPEED = 19.5, STEP = 3, MAXLEAD = 15;
  const POP = [0, 2.35, 2.15, 1.95][level], KICK = [0, 0.95, 0.85, 0.75][level], PICKT = [0, 0.75, 0.62, 0.52][level];
  const REL = KICK + 0.75, THROWT = REL + POP;   // pitch release, and when the catcher's throw reaches second
  let tries = 0, sb = 0, outsN = 0, jumps = [], slides = { good: 0, early: 0, late: 0, none: 0 }, phase = 'intro', pt = 0, armed = false, move = null, wait = 0, went = null, back = null, res = null, over = false, look = 0, slow = 1, slowUntil = 0;
  // the runner: x = feet from first base along the line to second
  const R = { mode: 'lead', x: 0, to: 0, ph: 0, hop: 0, s0: 0, x0: 0, dur: 0, m0: 1, m1: 0.35, arr: null, kind: '', dustT: 0, diveT: 0, lastX: null, landed: false };

  const B1 = new THREE.Vector3(BASES[1][0], 0, BASES[1][1]), B2 = new THREE.Vector3(BASES[2][0], 0, BASES[2][1]), U = B2.clone().sub(B1).normalize();
  const IN = new THREE.Vector3(U.z, 0, -U.x);   // sideways, toward the infield grass
  const along = (ft, out) => (out || new THREE.Vector3()).copy(B1).addScaledVector(U, ft);
  const W = world({ stage, me, shadow: { x: 22, z: -62, r: 45 }, fov: a => a < 0.8 ? 58 : a < 1.2 ? 50 : 42,
    hudHTML: hudShell({ team: 'SEED SPITTERS', sub: 'STEAL SECOND', top: true,
      cells: [['STEALS', 's-sb'], ['TRY', 's-try'], ['OUTS', 's-outs'], ['BEST JUMP', 's-jump']],
      kicker: 'SEED SPITTERS PARK', title: 'STEAL SECOND',
      lines: ['Tap LEAD OFF to shuffle off first. Bigger lead = faster steal, but more pickoff throws.', 'Press GO the moment his knee lifts toward home.', 'Running? Tap anywhere to SLIDE when you reach the yellow zone before second.', 'If he spins to first, press BACK and dive in head-first!'],
      extra: '<div class="d3lead" id="s-lead"></div><div class="d3eyes" id="s-eyes">👀</div>' +
        '<div class="d3go2 three" id="s-btns"><button type="button" class="d3big back" id="s-back">◀ BACK</button><button type="button" class="d3big lead" id="s-off">LEAD OFF</button><button type="button" class="d3big go" id="s-go">GO! ▶</button></div>' +
        '<div class="d3go2" id="s-slidebar" style="display:none"><button type="button" class="d3big slide" id="s-slide" tabindex="-1">TAP ANYWHERE TO SLIDE · in the yellow zone</button></div>' }) });
  const { scene, cam, $ } = W;
  const S = SPITTERS(me), Hn = HORNETS(7), CAL = W.CAL, FTS = 3.2808;
  const STRIDE = CAL.run && CAL.run.dist > 0.3 ? CAL.run.dist * FTS * 0.95 : 9, RUNDUR = (CAL.run && CAL.run.dur) || 0.8;
  const DIVE = CAL.dive && CAL.dive.reach > 0.3 ? CAL.dive.reach * FTS : 3.6, SLIDEF = CAL.slide && CAL.slide.reach > 0.3 ? CAL.slide.reach * FTS : 3.2;

  // Jaxson on first; Hornets pitcher (right-handed) in the stretch; first baseman holding him on; shortstop covers second
  const GL = gearLook(me), J = W.human(Object.assign({ helmet: true, skin: 0xf0c8a5, hair: 0x4a2e18, finish: GL.finish }, S, { colors: Object.assign({}, S.colors, GL.shoes != null ? { shoes: GL.shoes } : {}, GL.helmet != null ? { helmet: GL.helmet } : {}) })); scene.add(J.root);
  const P1 = W.human(Object.assign({ glove: true }, Hn)); P1.root.position.set(0, 0.55, -BASE); P1.root.rotation.y = Math.PI; P1.set('pitch', 0); scene.add(P1.root);
  const f1Home = new THREE.Vector3(BASE + 0.3, 0, -BASE + 2.3);
  const F1 = W.human(Object.assign({ glove: true }, HORNETS(23))); F1.root.position.copy(f1Home); F1.face(0, -BASE); F1.set('ready', 0); scene.add(F1.root);
  const SS = W.human(Object.assign({ glove: true }, HORNETS(6))); const ssHome = new THREE.Vector3(-14, 0, -2 * BASE + 8), ssBag = B2.clone().addScaledVector(IN, -2.0).addScaledVector(U, 0.8);
  SS.root.position.copy(ssHome); SS.face(0, 0); SS.set('ready', 0); scene.add(SS.root);
  const F2 = W.human(Object.assign({ lod: true, glove: true }, HORNETS())); F2.root.position.set(22, 0, -2 * BASE + 2); F2.face(0, 0); F2.set('ready', 0); scene.add(F2.root);
  const F3 = W.human(Object.assign({ lod: true, glove: true }, HORNETS())); F3.root.position.set(-BASE - 4, 0, -BASE - 6); F3.face(0, 0); F3.set('ready', 0); scene.add(F3.root);
  [[-90, -150], [0, -175], [90, -150]].forEach(([x, z]) => { const f = W.human(Object.assign({ lod: true, glove: true }, HORNETS())); f.root.position.set(x, 0, z); f.face(0, 0); f.set('ready', 0); scene.add(f.root); });
  const C = W.human(Object.assign({ helmet: true, glove: true }, Hn, { colors: Object.assign({}, Hn.colors, { helmet: 0x161616 }), letters: null })); C.root.position.set(0, 0, 3.2); C.root.scale.setScalar(0.92); C.set('crouch', 0); scene.add(C.root);
  const bat = W.makeBat(); const hitter = W.human(Object.assign({ helmet: true }, S, { letters: Object.assign({}, S.letters, { num: '9', name: 'TEAMMATE' }) })); scene.add(hitter.root); W.standInBox(hitter, bat);

  // lead marks in the dirt every 3 ft (white, then yellow, then red = risky), just off the line
  for (let f = 3; f <= MAXLEAD; f += 3) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.6), new THREE.MeshBasicMaterial({ color: f > 11 ? 0xff6b6b : f > 8 ? 0xffd23f : 0xffffff, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(U.x, U.z); const p = along(f).addScaledVector(IN, -2.2); m.position.set(p.x, 0.07, p.z); scene.add(m); }

  // the slide zone: a yellow strip in the dirt 2.5 to 13 ft before second, shown only while he runs
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 10.5), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.7, depthWrite: false }));
  zone.rotation.x = -Math.PI / 2; zone.rotation.z = Math.atan2(U.x, U.z); zone.position.copy(along(BASEFT - 7.75)); zone.position.y = 0.06; zone.visible = false; scene.add(zone);
  // dirt puffs for slides and dives
  const dustTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const dust = [];
  function puff(p, n, spd) { for (let i = 0; i < n && dust.length < 90; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, color: 0xcfa77c, transparent: true, opacity: 0.75, depthWrite: false }));
      m.position.set(p.x + rnd(-0.7, 0.7), rnd(0.3, 1.0), p.z + rnd(-0.7, 0.7)); m.scale.setScalar(rnd(1.2, 2.2)); scene.add(m);
      dust.push({ m, v: new THREE.Vector3(rnd(-1, 1) * spd, rnd(0.6, 2.4), rnd(-1, 1) * spd), a: 0, life: rnd(0.7, 1.2) }); } }
  function updateDust(dt) { for (let k = dust.length - 1; k >= 0; k--) { const d = dust[k]; d.a += dt; d.m.position.addScaledVector(d.v, dt); d.v.multiplyScalar(Math.max(0, 1 - 2.5 * dt));
      d.m.scale.multiplyScalar(1 + 1.4 * dt); d.m.material.opacity = 0.75 * Math.max(0, 1 - d.a / d.life); if (d.a > d.life) { scene.remove(d.m); d.m.material.dispose(); dust.splice(k, 1); } } }

  // cameras: behind first while he reads the pitcher; alongside him (from the infield grass) once he runs
  const CAM = { pos: new THREE.Vector3(BASE + 19, 7.5, -BASE + 9), look: new THREE.Vector3(10, 3.2, -BASE - 12) };
  const camPos = CAM.pos.clone(), camLook = CAM.look.clone(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
  const ball = { seg: null, pitched: false, thrown: false };
  const fly = (from, to, t0, T, arc) => { ball.seg = { from: from.clone(), to: to.clone(), t0, T, arc }; };

  const startTry = () => { camPos.copy(CAM.pos); camLook.copy(CAM.look); move = null; went = null; back = null; res = null; armed = false; wait = rnd(1.4, 3.4); look = 0; phase = 'set'; pt = 0; slow = 1; slowUntil = 0;
    Object.assign(R, { mode: 'lead', x: 0, to: 0, hop: 0, arr: null, kind: '', short: false, diveT: 0, lastX: null, landed: false }); Object.assign(ball, { seg: null, pitched: false, thrown: false }); W.ball.visible = false;
    SS.root.position.copy(ssHome); SS.face(0, 0); SS.set('ready', 0); F1.root.position.copy(f1Home); F1.face(0, -BASE); F1.set('ready', 0); C.root.rotation.y = 0; C.set('crouch', 0); P1.turn.rotation.y = 0; P1.set('pitch', 0);
    say('Try ' + (tries + 1) + ' of ' + TRIES + '. Tap Lead Off to take your lead, then press GO when he kicks toward home.'); paint(); };
  const leadOff = () => { if (phase !== 'set' || R.mode !== 'lead' || R.to >= MAXLEAD) return; R.to = Math.min(MAXLEAD, R.to + STEP); armed = true; Sound.tick(); paint(); };
  const go = () => { if (phase !== 'set' && phase !== 'move') return; if (went != null || back != null) return; went = move ? move.t : -1; Sound.whoosh(); R.mode = 'go'; R.x0 = R.x; R.ph = 0;
    if (!move) { move = { kind: 'pick', t: 0, early: true }; phase = 'move'; } paint(); };
  const goBack = () => { if (phase === 'set' && !move) { if (R.to <= 0) return; R.to = Math.max(0, R.to - STEP); Sound.tick(); paint(); return; }
    if (back != null || went != null || phase !== 'move') return; back = move.t; paint(); };
  // tap anywhere while running = slide
  function slide() { if (R.mode !== 'go' || res || !move || move.kind !== 'home') return; const d = BASEFT - R.x; R.s0 = move.t; R.x0 = R.x; R.mode = 'slide'; R.dustT = 0; Sound.slide();
    if (d > 18) { R.kind = 'early'; R.short = true; R.dur = 12 / SPEED * 1.7; R.m0 = 1.7; R.m1 = 0; R.arr = move.t + R.dur + (d - 12) / 6; }
    else if (d > 13) { R.kind = 'early'; R.short = false; R.dur = d / SPEED; R.m0 = 1; R.m1 = 0.2; R.arr = move.t + R.dur + 0.1; }
    else if (d >= 2.5) { R.kind = 'good'; R.dur = d / SPEED; R.m0 = 1; R.m1 = 0.35; R.arr = move.t + R.dur; }
    else { R.kind = 'late'; R.dur = Math.max(0.08, d / SPEED); R.m0 = 1; R.m1 = 0.6; R.arr = move.t + R.dur + 0.12; }
    if (Math.abs(R.arr - THROWT) < 0.22) { slow = 0.4; slowUntil = Math.max(R.arr, THROWT) + 0.25; }
    paint(); }
  const herm = (k, m0, m1) => { const k2 = k * k, k3 = k2 * k; return (k3 - 2 * k2 + k) * m0 + (-2 * k3 + 3 * k2) + (k3 - k2) * m1; };
  const runDist = tg => { const u = tg - 0.125; if (u <= 0) return 0; return u < 0.35 ? SPEED * u * u / 0.7 : SPEED * 0.175 + SPEED * (u - 0.35); };   // same total time as the old 0.3 s first step

  function settle(kind, safe, text, voice) {
    res = { kind, safe, t: 0 }; tries++; phase = 'result'; pt = 0;
    if (kind === 'steal' && safe) { sb++; W.callout('SAFE!', text, 'hit', 2.2); Sound.cheer(); W.crowd.cheer(0.6); }
    else { outsN++; W.callout('OUT!', text, 'out', 2.2); Sound.ooh(); }
    if (voice) Sound.say(voice); say(text); paint();
  }
  function note(main, sub, cls) { W.callout(main, sub, cls || 'ball', 1.6); say(main + (sub ? '. ' + sub : '')); }
  function paint() {
    $('s-sb').textContent = sb; $('s-try').textContent = Math.min(tries + 1, TRIES) + '/' + TRIES; $('s-outs').textContent = outsN + '/3'; $('s-jump').textContent = jumps.length ? Math.min(...jumps) + ' ms' : '–';
    const running = R.mode === 'go' && !res && move && move.kind === 'home', on = (phase === 'set' || phase === 'move') && went == null && back == null;
    $('s-btns').style.display = running || R.mode === 'slide' || R.mode === 'brake' ? 'none' : ''; $('s-slidebar').style.display = running ? '' : 'none';
    $('s-go').disabled = !on; $('s-back').disabled = !on || (phase === 'set' && R.to <= 0); $('s-off').disabled = !on || phase !== 'set' || R.to >= MAXLEAD;
    $('s-go').classList.toggle('on', went != null); $('s-back').classList.toggle('on', back != null);
    const L = $('s-lead'); L.style.display = phase === 'set' ? '' : 'none'; const ld = Math.round(R.to);
    L.textContent = ld === 0 ? 'ON THE BAG · tap LEAD OFF' : 'LEAD ' + ld + ' FT' + (ld > 11 ? ' · BIG (risky)' : ld > 8 ? ' · GOOD' : ' · SHORT'); L.className = 'd3lead ' + (ld > 11 ? 'red' : ld > 8 ? 'amber' : '');
    W.drawBoard([['STEALS ' + sb + '   OUTS ' + outsN, 110], ['#' + me.num + ' ' + me.name.toUpperCase() + ' ON FIRST', 48, '#bbbbbb']]);
  }
  $('s-go').addEventListener('click', e => { e.stopPropagation(); go(); });
  $('s-back').addEventListener('click', e => { e.stopPropagation(); goBack(); });
  $('s-off').addEventListener('click', e => { e.stopPropagation(); leadOff(); });
  const onTap = e => { Sound.unlock(); if (R.mode === 'go' && move && move.kind === 'home' && !res) { e.preventDefault(); slide(); } };
  stage.addEventListener('pointerdown', onTap, true); W.cleanups.push(() => stage.removeEventListener('pointerdown', onTap, true));
  const onKey = e => { if (phase === 'intro') return;
    if (e.key === 'ArrowRight') leadOff();
    else if (e.key === 'ArrowLeft') goBack();
    else if (e.key === 'ArrowDown') slide();
    else if (e.key === ' ' || e.key === 'Enter') { if (R.mode === 'go') { e.preventDefault(); slide(); return; } if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; e.preventDefault(); go(); } };
  window.addEventListener('keydown', onKey); W.cleanups.push(() => window.removeEventListener('keydown', onKey));
  $('d3-go').addEventListener('click', () => { Sound.unlock(); $('d3-intro').classList.add('gone'); W.cv.focus(); startTry(); });
  $('d3-go').focus();

  W.run((dtReal, T) => {
    if (slowUntil && move && move.t > slowUntil) { slow = 1; slowUntil = 0; }
    const dt = dtReal * slow; pt += dt;
    const tr = W.CAL.pitch.tr, auto = window.__d3auto;
    if (phase === 'set') {
      if (auto && R.to < 9 && pt > 0.3) leadOff();
      if (Math.random() < dt * 0.25) look = 0.8; look = Math.max(0, look - dt);
      if (armed || pt > 4.5) { wait -= dt; if (wait <= 0 && Math.abs(R.x - R.to) < 0.2) { const pickP = clamp(0.15 + (R.to - 6) * 0.05, 0.1, 0.55); move = { kind: Math.random() < pickP ? 'pick' : 'home', t: 0 }; phase = 'move'; paint(); } }
    }
    if (move && (phase === 'move' || phase === 'result')) move.t += dt;
    if (phase === 'move') {
      if (auto && move.kind === 'home' && went == null && move.t > 0.18) go();
      if (move.kind === 'home') {
        P1.set('pitch', Math.min(move.t / REL * tr, tr + 0.5));
        if (move.t > REL && !ball.pitched) { ball.pitched = true; W.handPos(P1, tmp); fly(tmp, tmp2.set(0, 2.4, 2.6), REL, 0.45, 0.4); }
        if (went != null) {
          const tg = move.t - Math.max(went, 0), tT = THROWT - 1.05;
          if (R.mode === 'go') { R.x = Math.min(BASEFT, R.x0 + runDist(tg)); if (auto && BASEFT - R.x <= 8.5) slide();
            if (R.mode === 'go' && R.x >= BASEFT - 3) { R.mode = 'brake'; R.kind = 'none'; R.s0 = move.t; R.x0 = R.x; R.dur = 0.3; R.arr = move.t + 0.3 + 0.12; paint(); } }
          // the catcher pops up and fires to second
          if (move.t > REL + 0.45 && move.t < tT + 0.4) { C.face(B2.x, B2.z); C.set('pitch', lerp(tr - 0.55, tr + 0.2, clamp((move.t - (tT - 0.5)) / 0.7, 0, 1))); }
          if (move.t > tT && !ball.thrown) { ball.thrown = true; Sound.pop(); W.handPos(C, tmp); fly(tmp, tmp2.copy(ssBag).addScaledVector(U, -0.9).setY(2.3), tT, 1.05, 3.2); }
        } else if (move.t > KICK + 1.0) { note('NO GO', 'He didn’t go. Pitch is in.'); phase = 'gap'; pt = 0; }
      } else {   // pickoff: he spins and throws to first
        P1.turn.rotation.y = lerp(0, Math.PI / 2, clamp(move.t / 0.18, 0, 1)); P1.set('pitch', tr - 0.3 + move.t * 1.6);
        if (move.t > 0.25 && !ball.thrown) { ball.thrown = true; Sound.whoosh(); W.handPos(P1, tmp); W.gloveHand(F1, tmp2); fly(tmp, tmp2, 0.25, PICKT - 0.25, 1.0); }
        if (went != null) { if (R.mode === 'go') R.x = Math.min(R.x0 + Math.max(0, move.t - Math.max(went, 0)) * 12, R.x0 + 10);
          if (move.t > PICKT + 0.1) { R.mode = 'caught'; settle('picked', false, move.early ? 'Too early! He saw you go. Picked off.' : 'Picked off! He threw to first.', 'Out!'); } }
        else { const react = back != null ? back : 0.42, dur = R.to / 21, home = react + dur;
          if (move.t >= react && R.mode === 'lead' && R.to > 0) { R.mode = 'back'; R.s0 = react; R.x0 = R.x; R.dur = Math.max(dur, 0.12); }
          if (move.t > Math.max(home, PICKT)) { const safe = home < PICKT + 0.12;
            if (safe) { phase = 'gap'; pt = 0; if (R.to > 0) Sound.slide(); note(back != null ? 'BACK IN TIME' : 'SAFE AT FIRST', back != null ? 'Good read! Head-first dive.' : 'Pickoff throw, but you got back', 'hit'); }
            else settle('picked', false, 'Lead was too big or you were slow back.', 'Out!'); } }
      }
    }
    // steal result: wait for both the runner and the tag
    if (move && move.kind === 'home' && R.arr != null && !res && move.t >= Math.max(R.arr, THROWT) + 0.05) {
      const margin = THROWT - R.arr, jump = Math.max(0, went), safe = margin > 0; jumps.push(Math.round(jump * 1000)); slides[R.kind]++;
      const how = { good: safe ? 'Great slide!' : 'Good slide.', early: R.short ? 'Way too early! You stopped short.' : 'A little early.', late: 'Slide a step sooner.', none: 'You went in standing up. Slide!' }[R.kind];
      puff(along(BASEFT), 12, 4);
      settle('steal', safe, (safe ? (margin < 0.12 ? 'Safe by a hair! ' : '') : (margin > -0.12 ? 'Out by a hair. ' : '')) + how + ' Jump ' + Math.round(jump * 1000) + ' ms' + (!safe && jump > 250 ? '. Go sooner!' : ''), safe ? 'Safe!' : 'Out!'); }
    // the ball
    W.ball.visible = false;
    if (ball.seg && move && move.t >= ball.seg.t0) { const s = ball.seg, k = clamp((move.t - s.t0) / s.T, 0, 1);
      W.ball.visible = true; W.ball.position.lerpVectors(s.from, s.to, k); W.ball.position.y += Math.sin(k * Math.PI) * s.arc; if (k < 1) W.ball.rotation.x += dt * 30; }

    zone.visible = R.mode === 'go' && !!move && move.kind === 'home'; if (zone.visible) zone.material.opacity = 0.62 + 0.25 * Math.sin(T * 10);
    // ---- Jaxson ----
    J.root.position.y = 0;
    if (R.mode === 'lead') {   // side shuffle with little hops, facing the pitcher
      const d = R.to - R.x, st = Math.sign(d) * Math.min(Math.abs(d), 9 * dt); R.x += st; if (Math.abs(d) > 0.05) R.hop += dt * 13; else R.hop = 0;
      J.root.position.copy(along(R.x)); J.root.position.y = Math.abs(Math.sin(R.hop)) * 0.35; J.face(0, -BASE); J.set('ready', 0);
    } else if (R.mode === 'go') {   // legs matched to his speed so his feet don't skate
      const v = R.lastX == null ? 0 : Math.max(0, R.x - R.lastX) / Math.max(dt, 1e-4); R.lastX = R.x;
      R.ph += dt * Math.max(v, 5) / STRIDE * RUNDUR; J.root.position.copy(along(R.x)); J.face(B2.x, B2.z); J.set('run', R.ph);
    } else if (R.mode === 'caught') { J.root.position.copy(along(R.x)); J.face(B1.x, B1.z); J.set('ready', 0); }
    else if (R.mode === 'slide') {   // feet-first; feet reach the bag at R.arr (stops short and scoots in if too early)
      const k = clamp((move.t - R.s0) / R.dur, 0, 1), len = R.short ? 12 : BASEFT - R.x0;
      let fx = R.x0 + len * clamp(herm(k, R.m0, R.m1), 0, 1);
      if (R.short && k >= 1) fx = Math.min(BASEFT, R.x0 + 12 + (move.t - R.s0 - R.dur) * 6);
      const blend = clamp(k * 4, 0, 1); R.x = fx;
      J.root.position.copy(along(fx - SLIDEF * blend)); J.face(B2.x, B2.z); J.set('slide', 0.3 * blend);
      R.dustT -= dt; if ((k < 1 || fx < BASEFT) && R.dustT <= 0) { R.dustT = 0.045; puff(along(fx), 2, 2.5); }
    } else if (R.mode === 'brake') {   // never slid: chop steps and stand on the bag
      const k = clamp((move.t - R.s0) / R.dur, 0, 1); R.x = lerp(R.x0, BASEFT - 0.6, 1 - (1 - k) * (1 - k)); R.ph += dt * (1 - k) * 10 / STRIDE * RUNDUR;
      J.root.position.copy(along(R.x)); J.face(B2.x, B2.z); if (k < 1) J.set('run', R.ph); else J.set('ready', 0);
    } else if (R.mode === 'back') {   // crossover and run, then a head-first dive with his hands on the bag
      const k = clamp((move.t - R.s0) / R.dur, 0, 1); J.face(B1.x, B1.z);
      if (R.x0 <= DIVE + 0.5) { const rx = R.x0 * (1 - k); R.x = rx; R.ph += dt * 10 / STRIDE * RUNDUR; J.root.position.copy(along(rx)); if (k < 1) J.set('run', R.ph); else { J.face(0, -BASE); J.set('ready', 0); } }
      else { const rx = lerp(R.x0, DIVE, k); R.x = rx;   // rx = his hips; his hands are DIVE feet ahead of them
        if (rx > DIVE + 4.5 && k < 1) { R.ph += dt * 16 / STRIDE * RUNDUR; J.root.position.copy(along(rx)); J.set('run', R.ph); }
        else { if (!R.diveT) R.diveT = move.t; const dk = clamp((move.t - R.diveT) / 0.2, 0, 1);
          J.root.position.copy(along(rx)); J.root.position.y = Math.sin(dk * Math.PI) * 0.8; J.set('dive', 0);
          if (k >= 1 && !R.landed) { R.landed = true; puff(along(0.6), 10, 3.5); } } }
    }
    if (R.mode !== 'go') R.lastX = null;

    // fielders react
    if (move && move.kind === 'home' && went != null) { const k = clamp((move.t - KICK) / 0.9, 0, 1); SS.root.position.lerpVectors(ssHome, ssBag, k);
      if (k < 1) { SS.face(ssBag.x, ssBag.z); SS.runStep(dt, ssHome.distanceTo(ssBag) / 0.9); }
      else { SS.face(B1.x, B1.z); SS.set(move.t > THROWT + 0.05 ? 'crouch' : 'catch', 0); } }
    if (move && move.kind === 'pick' && move.t > 0.2) { F1.face(B1.x + U.x * 3, B1.z + U.z * 3); F1.set(move.t > PICKT + 0.05 ? 'crouch' : 'catch', 0); }
    if (move && move.kind === 'home' && went == null && move.t > REL + 0.45) C.set('catch', 0);
    // he peeks at you
    const eyesEl = $('s-eyes'); if (phase === 'set') P1.set('pitch', 0); if (look > 0 && phase === 'set') { const s = W.toScreen(tmp3.set(0, 8.5, -BASE)); eyesEl.style.opacity = 1; eyesEl.style.left = s.x + 'px'; eyesEl.style.top = s.y + 'px'; P1.parts.head.rotation.y += 0.9; } else eyesEl.style.opacity = 0;
    if ((phase === 'result' && pt > 2.3) || (phase === 'gap' && pt > 1.5)) { if (tries >= TRIES || outsN >= 3) { over = true; phase = 'end'; W.later(0.3, finishGame); } else startTry(); }
    updateDust(dtReal);
    // camera
    const chase = went != null && move && move.kind === 'home', pick = move && move.kind === 'pick' && went == null && R.to > 0;
    if (chase) { const p = along(Math.min(R.x, BASEFT - 4)); tmp.copy(p).addScaledVector(IN, 20).addScaledVector(U, -6); tmp.y = 6.5; tmp2.copy(p).addScaledVector(U, 4); tmp2.y = 2.4; }
    else if (pick) { tmp.set(BASE + 14, 14, -BASE + 13); tmp2.copy(along(3)); tmp2.y = 1; }   // up high so the first baseman doesn't hide the dive
    else { tmp.copy(CAM.pos); tmp2.copy(CAM.look); }
    const kc = 1 - Math.exp(-dtReal * (chase ? 3.2 : 4)); camPos.lerp(tmp, kc); camLook.lerp(tmp2, kc); cam.position.copy(camPos); cam.lookAt(camLook);
    const dg = window.__d3diag; if (dg) { J.root.position.set(dg.p[0], 0, dg.p[1]); J.face(dg.f[0], dg.f[1]); J.set(dg.clip, dg.t); cam.position.set(dg.c[0], dg.c[1], dg.c[2]); cam.lookAt(dg.p[0], 2, dg.p[1]); }
  });
  paint();
  function finishGame() { const avg = jumps.length ? Math.round(jumps.reduce((a, b) => a + b, 0) / jumps.length) : null, nS = slides.good + slides.early + slides.late + slides.none;
    const slideLine = nS ? 'Slides: ' + slides.good + ' of ' + nS + ' just right' + (slides.early ? ' · ' + slides.early + ' too early' : '') + (slides.late ? ' · ' + slides.late + ' too late' : '') + (slides.none ? ' · ' + slides.none + ' standing up' : '') : null;
    end(sb, [sb + ' stolen base' + (sb === 1 ? '' : 's') + '!', 'Outs: ' + outsN + (avg != null ? ' · Average jump: ' + avg + ' ms' : ''), slideLine, 'Real base stealers go on the pitcher’s first move home, and start the slide 1 to 4 big steps from the bag.'].filter(Boolean)); }
  if (/d3test|d3rec|d3probe/.test(location.search)) window.__d3 = { get phase() { return phase; }, get sb() { return sb; }, get outs() { return outsN; }, get tries() { return tries; }, get fps() { return W.fps; },
    get mode() { return R.mode; }, get x() { return R.x; }, get kind() { return move ? move.kind : null; }, get mt() { return move ? move.t : 0; }, get slides() { return slides; }, get bseg() { return ball.seg && [ball.seg.from.toArray().map(Math.round), ball.seg.to.toArray().map(Math.round), ball.seg.t0, ball.seg.T]; }, get bpos() { return W.ball.position.toArray().map(Math.round).concat([W.ball.visible]); }, stride: STRIDE, dive: DIVE, slidef: SLIDEF, J, U,
    draw: () => W.renderer.render(scene, cam), scene, step: n => { for (let i = 0; i < n; i++) W.step(); }, go: () => $('d3-go').click(), steal: go, back: goBack, slide, lead: leadOff, setLead: v => { R.to = v; R.x = v; armed = true; },
    force: k => { if (phase === 'set') { move = { kind: k, t: 0 }; phase = 'move'; paint(); } } };
  say('Steal Second at Seed Spitters Park. Press Play Ball.');
  return { stop: W.stop };
}
