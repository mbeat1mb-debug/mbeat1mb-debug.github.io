/* Road to the Show: make your own player, play 7-inning games (you bat your own at-bats in 3D), climb the standings, win the title, upgrade your player.
   Pure simulator (SIM) up top, screens below. Saved after every play, so he can quit mid-game and pick up where he left off. */
const HubDynasty = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chance = p => Math.random() < p;

  /* ================= the league ================= */
  const TEAMS = [
    { id: 'SPI', name: 'Seed Spitters', short: 'Spitters', c1: '#ee7f24', c2: '#1d6a3b', o: 0.50, p: 0.50 },
    { id: 'HOR', name: 'Hornets', short: 'Hornets', c1: '#1f3f7a', c2: '#f2c230', o: 0.52, p: 0.52, j: 0xd6d4cc, a: 0x1f3f7a },
    { id: 'SHK', name: 'Sharks', short: 'Sharks', c1: '#0e7c86', c2: '#9aa4ad', o: 0.50, p: 0.54, j: 0xf2f2ee, a: 0x0e7c86 },
    { id: 'BUL', name: 'Bulldogs', short: 'Bulldogs', c1: '#b3261e', c2: '#1b1b1b', o: 0.55, p: 0.48, j: 0xf4f2ec, a: 0xb3261e },
    { id: 'COM', name: 'Comets', short: 'Comets', c1: '#5b3a9b', c2: '#c9c9d6', o: 0.47, p: 0.50, j: 0xe9e6f2, a: 0x5b3a9b },
    { id: 'THU', name: 'Thunder', short: 'Thunder', c1: '#d9a400', c2: '#202020', o: 0.48, p: 0.46, j: 0x2a2a2a, a: 0xd9a400 }];
  const FIRST = ['Mason', 'Eli', 'Leo', 'Caden', 'Owen', 'Luke', 'Gavin', 'Ty', 'Bryce', 'Cole', 'Nolan', 'Jace', 'Ryder', 'Wes', 'Drew', 'Max', 'Brody', 'Kai', 'Ezra', 'Finn', 'Miles', 'Rhett', 'Beau', 'Theo', 'Asher', 'Grady', 'Hudson', 'Knox', 'Reid', 'Sawyer'];
  const LAST = ['Rivera', 'Brooks', 'Carter', 'Hayes', 'Diaz', 'Walsh', 'Kim', 'Price', 'Foster', 'Reyes', 'Bennett', 'Shaw', 'Ortiz', 'Coleman', 'Pope', 'Nash', 'Dunn', 'Vega', 'Burke', 'Lowe', 'Fields', 'Stone', 'Mack', 'Quinn', 'Ross', 'Tate', 'Webb', 'Cruz'];
  const POS = ['CF', 'SS', '2B', '3B', '1B', 'LF', 'RF', 'C'];
  const POSNAME = { CF: 'Center Field', SS: 'Shortstop', '2B': 'Second Base', '3B': 'Third Base', '1B': 'First Base', LF: 'Left Field', RF: 'Right Field', C: 'Catcher' };
  const ARCH = {
    contact: { name: 'Contact Hitter', blurb: 'Sprays line drives. Hard to strike out.', a: { con: 66, pow: 48, eye: 62, spd: 58, fld: 56, arm: 52 } },
    power: { name: 'Power Slugger', blurb: 'Hits it a mile when he gets it.', a: { con: 54, pow: 68, eye: 52, spd: 48, fld: 52, arm: 62 } },
    speed: { name: 'Speedster', blurb: 'Beats out grounders. Covers ground.', a: { con: 60, pow: 44, eye: 56, spd: 70, fld: 62, arm: 50 } },
    five: { name: 'Five-Tool', blurb: 'A little of everything.', a: { con: 58, pow: 57, eye: 57, spd: 57, fld: 57, arm: 57 } } };
  const ATTR = [['con', 'Contact', 'Bigger timing window when you swing'], ['pow', 'Power', 'Harder hits, farther home runs'], ['eye', 'Eye', 'More walks, fewer strikeouts when simmed'],
    ['spd', 'Speed', 'Beat out grounders, score from second'], ['fld', 'Fielding', 'Make the play, diving catches'], ['arm', 'Arm', 'Throw runners out']];
  const SKIN = [0xf6d3b8, 0xf0c8a5, 0xd9a57c, 0xb98058, 0x8d5a3b, 0x5e3a24], HAIR = [0x2a1a0e, 0x4a2e18, 0x7a4a22, 0xc9a058, 0x111111, 0xa0461d];
  const HELMET = [[0x1d6a3b, 'Team green'], [0x161616, 'Black'], [0xee7f24, 'Orange'], [0xb8bcc4, 'Chrome']];
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const ovr = a => Math.round(a.con * 0.25 + a.pow * 0.2 + a.eye * 0.15 + a.spd * 0.15 + a.fld * 0.15 + a.arm * 0.1);
  const cost = v => v < 60 ? 1 : v < 70 ? 2 : v < 80 ? 3 : v < 90 ? 4 : 5;
  const team = (d, id) => d.teams.find(t => t.id === id);
  const kidName = () => pick(FIRST) + ' ' + pick(LAST);

  function roster(t, me) {
    const L = [];
    for (let i = 0; i < 9; i++) L.push(mate({ name: kidName(), num: String(Math.floor(rnd(1, 60))), b: clamp(t.o + rnd(-0.1, 0.1), 0.25, 0.85), spd: rnd(0.35, 0.7) }));
    if (me) L[me.slot] = { name: me.name, num: me.num, me: true };
    return { lineup: L, pitcher: kidName(), slot: 0 };
  }
  // a teammate's look and ratings (old saves get them filled in)
  function mate(x) { if (x.me) return x; if (x.con == null) { x.con = Math.round(clamp(38 + x.b * 55 + rnd(-6, 6), 35, 90)); x.pow = Math.round(clamp(32 + x.b * 50 + rnd(-10, 10), 30, 90)); x.spd2 = Math.round(clamp((x.spd || 0.5) * 100, 30, 90)); x.skin = Math.floor(rnd(0, 6)); x.hair = Math.floor(rnd(0, 6)); x.bats = chance(0.3) ? 'L' : 'R'; } return x; }
  function fixUp(d) { if (!d.opts) d.opts = { bat: 'team', field: 'on' }; if (d.roster) d.roster.lineup.forEach(mate); if (d.live && d.live.g) { d.live.g.us = d.roster; if (!d.live.g.box) d.live.g.box = {}; } return d; }
  // round robin: everyone plays everyone twice (10 rounds, 3 games each)
  function schedule(ids) {
    const n = ids.length, rounds = [], a = ids.slice();
    for (let r = 0; r < n - 1; r++) { const g = []; for (let i = 0; i < n / 2; i++) { const x = a[i], y = a[n - 1 - i]; g.push(r % 2 ? [x, y] : [y, x]); } rounds.push(g); a.splice(1, 0, a.pop()); }
    return rounds.concat(rounds.map(g => g.map(([h, v]) => [v, h]))).map(g => g.map(([home, away]) => ({ home, away, res: null })));
  }
  function newDynasty(p) {
    const teams = TEAMS.map(t => Object.assign({}, t, { o: t.o + (t.id === 'SPI' ? 0 : rnd(-0.03, 0.03)), p: t.p + (t.id === 'SPI' ? 0 : rnd(-0.03, 0.03)) }));
    const d = { v: 1, opts: { bat: 'team', field: 'on' }, player: p, season: 1, teams, rounds: schedule(teams.map(t => t.id)), week: 0, po: null, stats: blank(), career: blank(), seasons: [], trophies: [], live: null, log: [] };
    d.roster = roster(team(d, 'SPI'), p);
    return d;
  }
  function newSeason(d) {
    d.seasons.push({ season: d.season, rec: record(d, 'SPI'), stats: d.stats, place: standings(d).findIndex(t => t.id === 'SPI') + 1, champ: !!(d.po && d.po.champ === 'SPI') });
    d.season++; d.week = 0; d.po = null; d.stats = blank(); d.live = null;
    d.teams.forEach(t => { if (t.id !== 'SPI') { t.o = clamp(t.o + 0.02 + rnd(-0.03, 0.03), 0.4, 0.75); t.p = clamp(t.p + 0.02 + rnd(-0.03, 0.03), 0.4, 0.75); } else { t.o = clamp(t.o + 0.02, 0.4, 0.75); t.p = clamp(t.p + 0.02, 0.4, 0.75); } });
    d.rounds = schedule(d.teams.map(t => t.id)); d.roster = roster(team(d, 'SPI'), d.player);
  }
  const blank = () => ({ g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, gem: 0, e: 0, potg: 0 });
  const avg = s => s.ab ? (s.h / s.ab) : 0;
  const fmt3 = x => x >= 1 ? x.toFixed(3) : ('.' + Math.round(x * 1000).toString().padStart(3, '0'));
  const obp = s => s.pa ? (s.h + s.bb) / s.pa : 0, slg = s => s.ab ? (s.h + s.d + 2 * s.t + 3 * s.hr) / s.ab : 0;
  function record(d, id) { let w = 0, l = 0; d.rounds.forEach(r => r.forEach(g => { if (!g.res) return; if (g.home !== id && g.away !== id) return; const us = g.home === id ? g.res.h : g.res.a, them = g.home === id ? g.res.a : g.res.h; if (us > them) w++; else l++; })); return { w, l }; }
  function standings(d) { return d.teams.map(t => Object.assign({ id: t.id, name: t.name, c1: t.c1 }, record(d, t.id))).sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.w - a.w); }

  /* ================= one plate appearance ================= */
  // b = batter skill, p = pitcher skill (both about 0.3 to 0.8). Youth-league rates, tilted by the matchup.
  function paOdds(b, p, x) {
    const dd = b - p, pw = x ? (x.pow - 55) / 100 : 0, ey = x ? (x.eye - 55) / 100 : 0;
    const o = { BB: 0.09 + ey * 0.12, K: Math.max(0.06, 0.18 - dd * 0.22 - ey * 0.1), '1B': 0.18 + dd * 0.16, '2B': 0.05 + dd * 0.05 + pw * 0.04, '3B': 0.012, HR: Math.max(0.004, 0.018 + dd * 0.03 + pw * 0.07), E: 0.035 };
    const used = Object.values(o).reduce((a, c) => a + c, 0), rest = Math.max(0.2, 1 - used);
    o.GO = rest * 0.46; o.FO = rest * 0.38; o.LO = rest * 0.16; return o;
  }
  function draw(o) { let r = Math.random(), k; for (k in o) { r -= o[k]; if (r <= 0) return k; } return 'GO'; }
  const myB = a => clamp((a.con * 0.55 + a.pow * 0.2 + a.eye * 0.25) / 100, 0.3, 0.95);

  /* ================= a 7-inning game ================= */
  function newGame(d, g, playoff) {
    const usHome = g.home === 'SPI', opp = team(d, usHome ? g.away : g.home), them = roster(opp);
    return { home: g.home, away: g.away, usHome, opp: opp.id, playoff: playoff || null, inn: 1, top: true, outs: 0, bases: [null, null, null], score: { h: 0, a: 0 }, line: { h: [], a: [], hh: 0, ah: 0, he: 0, ae: 0 },
      us: d.roster, them, oSlot: 0, uSlot: 0, feed: [], over: false, my: blank(), myAB: [], rbiGame: 0, wp: 0, box: {}, pend: null };
  }
  const battingUs = G => (G.top && !G.usHome) || (!G.top && G.usHome);
  const side = G => G.top ? 'a' : 'h';
  function curBatter(G) { return battingUs(G) ? G.us.lineup[G.uSlot % 9] : G.them.lineup[G.oSlot % 9]; }
  function say(G, text, mine, big) { G.feed.unshift({ t: text, me: !!mine, big: !!big, inn: (G.top ? 'Top ' : 'Bot ') + G.inn }); if (G.feed.length > 40) G.feed.length = 40; }
  function score(G, runner, n) { G.score[side(G)] += n || 1; if (G.line[side(G)][G.inn - 1] == null) G.line[side(G)][G.inn - 1] = 0; G.line[side(G)][G.inn - 1] += n || 1; if (runner && runner.me) G.my.r++; }
  // move runners for a result; returns runs that count as RBI
  function advance(G, code, bat) {
    const B = G.bases, scored = []; let rbi = true;
    const home = r => { if (r) scored.push(r); };
    const sp = r => r && (r.me ? (G.mySpd || 0.55) : (r.spd || 0.5));
    if (code === 'HR') { B.forEach(home); scored.push(bat); G.bases = [null, null, null]; }
    else if (code === '3B') { B.forEach(home); G.bases = [null, null, bat]; }
    else if (code === '2B') { home(B[2]); home(B[1]); let r1 = B[0]; if (r1 && chance(0.35 + sp(r1) * 0.3)) { home(r1); r1 = null; } G.bases = [null, bat, r1]; }
    else if (code === '1B' || code === 'E') { if (code === 'E') rbi = false; home(B[2]); let r2 = B[1], to3 = null; if (r2 && chance(0.4 + sp(r2) * 0.35)) { home(r2); r2 = null; } else if (r2) to3 = r2;
      let r1 = B[0], to2 = null; if (r1 && !to3 && chance(0.15 + sp(r1) * 0.2)) to3 = r1; else to2 = r1; G.bases = [bat, to2, to3]; }
    else if (code === 'BB') { if (B[0]) { if (B[1]) { if (B[2]) home(B[2]); B[2] = B[1]; } B[1] = B[0]; } B[0] = bat; }
    scored.forEach(r => score(G, r)); return { runs: scored.length, rbi: rbi ? scored.length : 0, scored };
  }
  // play out one result in the game (from the sim or from his 3D at-bat)
  function apply(G, code, bat, extra) {
    extra = extra || {}; const us = battingUs(G), mine = !!bat.me, rec = code === 'OUT' ? (extra.out === 'ground' ? 'GO' : extra.out === 'line' ? 'LO' : 'FO') : code;
    const who = mine ? '#' + bat.num + ' ' + bat.name : bat.name;
    let rbi = 0, txt = '', runs = 0, outs0 = G.outs;
    if (code === 'K') { G.outs++; txt = who + ' strikes out' + (extra.looking ? ' looking.' : '.'); }
    else if (code === 'GO' || code === 'FO' || code === 'LO' || code === 'OUT') {
      const kind = code === 'OUT' ? (extra.out === 'ground' ? 'GO' : extra.out === 'line' ? 'LO' : 'FO') : code;
      if (kind === 'GO' && G.bases[0] && G.outs < 2 && chance(0.3)) { G.outs += 2; G.bases[0] = null; txt = who + ' grounds into a double play.'; }
      else { G.outs++; txt = who + (kind === 'GO' ? ' grounds out.' : kind === 'LO' ? ' lines out.' : ' flies out.');
        if (G.outs < 3) { if (kind === 'FO' && G.bases[2] && chance(0.55)) { const r = G.bases[2]; G.bases[2] = null; score(G, r); rbi = 1; runs = 1; extra.sac = true; txt = who + ' hits a sac fly. ' + (r.me ? 'You score' : r.name.split(' ')[0] + ' scores') + '!'; }
          else if (kind === 'GO' && chance(0.5)) { if (G.bases[2] && outs0 < 2) { const r = G.bases[2]; G.bases[2] = null; score(G, r); rbi = 1; runs = 1; } if (G.bases[1] && !G.bases[2]) { G.bases[2] = G.bases[1]; G.bases[1] = null; } if (runs) txt = who + ' grounds out, a run scores.'; } } }
      // his glove when they hit it to him
      const rg = !us && G.mePos && (!G.fieldOn || extra.simD);
      if (rg && chance(0.15)) { if (chance(G.myFld * 0.05)) { G.my.gem++; txt = (kind === 'GO' ? 'Diving stop' : 'Diving catch') + ' by YOU! ' + bat.name.split(' ')[0] + ' is out.'; extra.gem = true; } else txt = bat.name.split(' ')[0] + (kind === 'GO' ? ' grounds to you. You make the play.' : ' flies to you. You make the catch.'); extra.mineD = true; }
    } else {
      const names = { BB: ' walks.', '1B': ' singles.', '2B': ' doubles!', '3B': ' triples!', HR: ' homers!', E: ' reaches on an error.' };
      // his glove can take away a hit
      if (!us && G.mePos && (!G.fieldOn || extra.simD) && (code === '1B' || code === '2B') && chance(0.11) && chance(G.myFld * 0.35)) { G.outs++; G.my.gem++; txt = 'WEB GEM! You rob ' + bat.name.split(' ')[0] + ' of a hit!'; extra.gem = true; extra.mineD = true; }
      else { const a = advance(G, code, bat); runs = a.runs; rbi = a.rbi; txt = who + names[code] + (runs ? ' ' + runs + (runs === 1 ? ' run scores.' : ' runs score.') : '');
        if (!us && G.mePos && (!G.fieldOn || extra.simD) && code === '1B' && a.scored.length === 0 && G.bases[2] && chance(0.08 + G.myArm * 0.1)) { G.bases[2] = null; G.outs++; G.my.gem++; txt += ' You throw out the runner at home!'; extra.gem = true; extra.mineD = true; }
        if (extra.myErr) { G.my.e++; txt = bat.name.split(' ')[0] + ' reaches. You bobbled it. Shake it off.'; extra.mineD = true; }
        else if (!us && code === 'E' && G.mePos && (!G.fieldOn || extra.simD) && chance(0.12) && chance(1 - G.myFld)) { G.my.e++; txt = bat.name.split(' ')[0] + ' reaches on YOUR error. Shake it off.'; extra.mineD = true; } }
      const hitc = ['1B', '2B', '3B', 'HR'].includes(code); if (hitc) G.line[side(G) + 'h']++; if (code === 'E') G.line[(G.top ? 'h' : 'a') + 'e']++;
    }
    if (us) { const bx = G.box[bat.name] || (G.box[bat.name] = { num: bat.num, me: !!bat.me, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0 });
      if (code !== 'BB' && !extra.sac) bx.ab++; if (['1B', '2B', '3B', 'HR'].includes(code)) bx.h++; if (code === 'HR') bx.hr++; if (code === 'BB') bx.bb++; if (code === 'K') bx.k++; bx.rbi += rbi; }
    if (mine) { const m = G.my; m.pa++; if (code !== 'BB' && !extra.sac) m.ab++; if (['1B', '2B', '3B', 'HR'].includes(code)) m.h++; if (code === '2B') m.d++; if (code === '3B') m.t++; if (code === 'HR') m.hr++; if (code === 'BB') m.bb++; if (code === 'K') m.k++; m.rbi += rbi;
      G.myAB.push({ inn: G.inn, code: rec, rbi, text: extra.text || '' }); }
    say(G, txt, mine || extra.mineD, mine && (code === 'HR' || rbi > 0) || extra.gem);
    if (us) G.uSlot++; else G.oSlot++;
    G.last = { code, mine, runs };
    endCheck(G);
  }
  function endCheck(G) {
    const homeUp = !G.top;
    if (homeUp && G.inn >= 7 && G.score.h > G.score.a) { G.over = true; say(G, (G.usHome ? 'WALK-OFF! The Spitters win it!' : 'Walk-off. They win it.'), G.usHome, G.usHome); return; }
    if (G.outs >= 3) {
      if (G.line[side(G)][G.inn - 1] == null) G.line[side(G)][G.inn - 1] = 0;
      G.outs = 0; G.bases = [null, null, null]; G.stealTried = false;
      if (G.top) { if (G.inn >= 7 && G.score.h > G.score.a) { G.over = true; G.line.h[G.inn - 1] = 'X'; return; } G.top = false; }
      else { if (G.inn >= 7 && G.score.h !== G.score.a) { G.over = true; return; } if (G.inn >= 15) { G.over = true; return; } G.inn++; G.top = true; }
      say(G, (G.top ? 'Top ' : 'Bottom ') + G.inn + (G.inn > 7 ? ' · extra innings!' : ''), false, false);
    }
  }
  // sim plays until it's his turn to bat (or the game ends)
  function simOne(G, d) {
    const bat = curBatter(G), us = battingUs(G);
    const p = us ? team(d, G.opp).p : team(d, 'SPI').p;
    const code = draw(paOdds(us ? bat.b : bat.b, p));
    apply(G, code, bat);
  }
  const wpick = o => { let r = Math.random(), k; for (k in o) { r -= o[k]; if (r <= 0) return k; } return k; };
  function whereTo(code) {
    if (code === 'GO') return { pos: wpick({ '3B': 0.24, SS: 0.28, '2B': 0.25, '1B': 0.2, P: 0.03 }), kind: 'ground', diff: 'routine' };
    if (code === 'FO') return chance(0.8) ? { pos: wpick({ LF: 0.3, CF: 0.38, RF: 0.32 }), kind: 'fly', diff: 'routine' } : { pos: wpick({ SS: 0.2, '2B': 0.17, '3B': 0.15, '1B': 0.13, C: 0.35 }), kind: 'pop', diff: 'routine' };
    if (code === 'LO') { const p = wpick({ '1B': 0.11, '2B': 0.13, SS: 0.14, '3B': 0.12, LF: 0.16, CF: 0.18, RF: 0.16 }); return { pos: p, kind: ['LF', 'CF', 'RF'].includes(p) ? 'fly' : 'line', diff: 'routine' }; }
    if (code === '1B') return chance(0.5) ? { pos: wpick({ '3B': 0.25, SS: 0.3, '2B': 0.3, '1B': 0.15 }), kind: 'ground', diff: 'hit' } : { pos: wpick({ LF: 0.33, CF: 0.34, RF: 0.33 }), kind: 'fly', diff: 'hit' };
    if (code === '2B' || code === '3B') return { pos: wpick({ LF: 0.33, CF: 0.34, RF: 0.33 }), kind: 'fly', diff: 'hit' };
    if (code === 'E') return { pos: wpick({ '3B': 0.28, SS: 0.32, '2B': 0.25, '1B': 0.15 }), kind: 'ground', diff: 'routine' };
    return null;
  }
  // the other team is up: roll the result; if it's hit to him (and he's playing the field), stop and let him make the play
  function oppTurn(G, d) {
    const bat = curBatter(G);
    if (G.fieldOn && G.mePos === 'C' && G.bases[0] && !G.bases[1] && G.outs < 2 && !G.stealTried && chance(0.3)) { G.stealTried = true; return { kind: 'steal', pos: 'C', diff: 'routine' }; }
    const code = draw(paOdds(bat.b, team(d, 'SPI').p)), w = whereTo(code);
    if (G.fieldOn && w && w.pos === G.mePos) return Object.assign({ code }, w);
    apply(G, code, bat); return null;
  }
  // his fielding play comes back from 3D
  function applyField(G, r, plan) {
    const bat = curBatter(G), prev = G.bases.slice(), nm = bat.name.split(' ')[0], pick2 = o => o === 0 ? bat : prev[o - 1];
    G.pend = null;
    if (plan.kind === 'steal') { const rn = prev[0]; if (r.outs) { G.outs++; G.bases[0] = null; G.my.gem++; say(G, 'You throw out ' + (rn ? rn.name.split(' ')[0] : 'the runner') + ' stealing second! Caught stealing!', true, true); }
      else { G.bases[1] = prev[0]; G.bases[0] = null; say(G, (rn ? rn.name.split(' ')[0] : 'The runner') + ' steals second. Quicker throw next time.', true, false); }
      G.last = { code: 'SB', mine: false, runs: 0 }; endCheck(G); return; }
    if (r.code === 'FOUL') { say(G, 'Foul pop. Just out of reach.', true, false); const code = draw(paOdds(bat.b, 0.5)); apply(G, code === 'FO' ? 'GO' : code, bat); return; }
    if (['1B', '2B', '3B'].includes(r.code)) { apply(G, r.code, bat, { mineD: true }); return; }
    if (r.code === 'E') { apply(G, 'E', bat, { myErr: true }); return; }
    const outsN = r.outs || 0; G.outs += outsN;
    const runs = []; (r.scored || []).forEach(o => { const x = pick2(o); if (x) { runs.push(x); score(G, x); } });
    G.bases = (r.bases || [null, null, null]).map(o => o == null ? null : pick2(o));
    if (r.gem) G.my.gem++;
    if (r.code === 'IFH') G.line[side(G) + 'h']++;
    let txt = r.code === 'DP' ? 'DOUBLE PLAY! You turn two!' : r.code === 'OUT_AIR' ? 'You catch ' + nm + '\u2019s ' + (plan.kind === 'line' ? 'line drive' : plan.kind === 'pop' ? 'pop-up' : 'fly ball') + '!' : r.code === 'OUT' ? 'You field it and get the out!' : r.code === 'IFH' ? 'You field it, but everyone\u2019s safe. Infield hit.' : 'You get the lead runner. Fielder\u2019s choice.';
    if (r.gem && r.code !== 'IFH') txt = (r.caught ? 'DIVING CATCH! ' : 'DIVING STOP! ') + txt;
    if (runs.length) txt += ' ' + runs.length + (runs.length === 1 ? ' run scores.' : ' runs score.');
    say(G, txt, true, !!r.gem || r.code === 'DP');
    G.oSlot++; G.last = { code: r.code, mine: false, runs: runs.length }; endCheck(G);
  }
  function simAB(G, d) { const a = d.player.a; return draw(paOdds(myB(a), team(d, G.opp).p, a)); }
  function quickGame(d, home, away) {   // other teams' games: just the final score
    const H = team(d, home), A = team(d, away); let h = 0, a = 0;
    const half = (o, p) => { let outs = 0, b = [0, 0, 0], r = 0; while (outs < 3) { const c = draw(paOdds(o + rnd(-0.08, 0.08), p));
      if (c === 'K' || c === 'GO' || c === 'FO' || c === 'LO') outs++; else if (c === 'HR') { r += 1 + b.filter(Boolean).length; b = [0, 0, 0]; } else if (c === '3B') { r += b.filter(Boolean).length; b = [0, 0, 1]; }
      else if (c === '2B') { r += b[1] + b[2]; b = [0, 1, b[0]]; } else if (c === 'BB') { if (b[0] && b[1] && b[2]) r++; b = [1, b[0] || b[1] ? 1 : 0, (b[0] && b[1]) || b[2] ? 1 : 0]; } else { r += b[2]; b = [1, b[0], b[1]]; } } return r; };
    for (let i = 1; i <= 7 || h === a; i++) { a += half(A.o, H.p); if (i >= 7 && h > a) break; h += half(H.o, A.p); if (i > 12) { h++; break; } }
    return { h, a };
  }
  // after his game: the rest of the week, stats, skill points
  function finishGame(d, G) {
    const won = (G.usHome ? G.score.h > G.score.a : G.score.a > G.score.h), m = G.my;
    let sp = 1 + m.h + m.d + m.t + m.hr * 2 + m.rbi + m.gem + (won ? 1 : 0);
    const potg = m.hr >= 1 || m.h >= 3 || m.rbi >= 3 || (won && (m.h >= 2 || m.gem >= 1));
    if (potg) sp += 1;
    m.g = 1; m.potg = potg ? 1 : 0;
    for (const k in m) { d.stats[k] = (d.stats[k] || 0) + m[k]; d.career[k] = (d.career[k] || 0) + m[k]; }
    d.player.sp += sp;
    const res = { h: G.score.h, a: G.score.a };
    if (G.playoff) { const po = d.po; po.games.push({ round: G.playoff, home: G.home, away: G.away, res });
      if (!won) { po.out = true; po.done = true; po.champ = null;
        // the rest of the bracket still plays out, so somebody is crowned
        const opp = G.usHome ? G.away : G.home;
        if (G.playoff === 'semi') { const s = po.seeds, i = s.indexOf('SPI'), other = [0, 1, 2, 3].filter(k => k !== i && k !== 3 - i).map(k => s[k]); const q = quickGame(d, other[0], other[1]); const w2 = q.h > q.a ? other[0] : other[1]; const f = quickGame(d, opp, w2); po.champ = f.h > f.a ? opp : w2; }
        else po.champ = opp; }
      else if (G.playoff === 'final') { po.champ = 'SPI'; po.done = true; d.trophies.push({ kind: 'champ', season: d.season, text: 'Season ' + d.season + ' Champions' }); }
      else { po.round = 'final'; } }
    else { const g = d.rounds[d.week].find(x => x.home === 'SPI' || x.away === 'SPI'); g.res = res;
      d.rounds[d.week].forEach(x => { if (!x.res) x.res = quickGame(d, x.home, x.away); }); d.week++;
      if (d.week >= d.rounds.length) startPlayoffs(d); }
    d.live = null;
    return { won, sp, potg, res };
  }
  function startPlayoffs(d) {
    const st = standings(d), top = st.slice(0, 4).map(t => t.id), i = top.indexOf('SPI');
    d.po = { seeds: top, round: i >= 0 ? 'semi' : null, games: [], out: i < 0, done: i < 0, champ: null };
    if (i < 0) { const a = quickGame(d, top[0], top[3]), b = quickGame(d, top[1], top[2]); const w1 = a.h > a.a ? top[0] : top[3], w2 = b.h > b.a ? top[1] : top[2]; const f = quickGame(d, w1, w2); d.po.champ = f.h > f.a ? w1 : w2; }
    else d.po.opp = top[3 - i];
  }
  function nextGame(d) {
    if (d.po) { if (d.po.done) return null;
      if (d.po.round === 'semi') { const i = d.po.seeds.indexOf('SPI'), o = d.po.seeds[3 - i]; return { g: { home: i < 3 - i ? 'SPI' : o, away: i < 3 - i ? o : 'SPI' }, playoff: 'semi' }; }
      // the other semifinal decides who's in the final
      if (!d.po.fOpp) { const s = d.po.seeds, i = s.indexOf('SPI'), other = [0, 1, 2, 3].filter(k => k !== i && k !== 3 - i).map(k => s[k]); const q = quickGame(d, other[0], other[1]); d.po.fOpp = q.h > q.a ? other[0] : other[1]; }
      const s = d.po.seeds, us = s.indexOf('SPI'), them = s.indexOf(d.po.fOpp); return { g: { home: us < them ? 'SPI' : d.po.fOpp, away: us < them ? d.po.fOpp : 'SPI' }, playoff: 'final' }; }
    const g = d.rounds[d.week] && d.rounds[d.week].find(x => x.home === 'SPI' || x.away === 'SPI'); return g ? { g, playoff: null } : null;
  }
  function awards(d) {
    const s = d.stats, out = [], a = avg(s), ops = obp(s) + slg(s);
    if (s.ab >= 15 && (a >= 0.4 || s.hr >= 4 || s.rbi >= 14)) out.push('League MVP');
    if (ops >= 1.0 && s.ab >= 15) out.push('Silver Slugger');
    if (s.gem >= 4 && s.e <= 1) out.push('Gold Glove');
    if (d.season === 1 && a >= 0.333 && s.ab >= 15) out.push('Rookie of the Year');
    return out;
  }
  const SIM = { fixUp, oppTurn, applyField, whereTo, newDynasty, newGame, nextGame, apply, simOne, simAB, curBatter, battingUs, finishGame, standings, record, quickGame, newSeason, awards, ovr, paOdds, avg, obp, slg, blank, TEAMS };

  /* ================= screens ================= */
  function E(tag, attrs) { const n = document.createElement(tag); if (attrs) for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'html') n.innerHTML = v; else n.setAttribute(k, v === true ? '' : v); }
    const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else n.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }; for (let i = 2; i < arguments.length; i++) add(arguments[i]); return n; }
  const TEST = typeof location !== 'undefined' && /d3test/.test(location.search);

  function start(H) {
    const ui = H.open('Road to the Show', 'Your player · your season');
    const root = E('div', { class: 'dyn' }); ui.stage.classList.add('dynstage'); ui.stage.replaceChildren(root);
    let d = null; try { d = H.load(); if (d && d.player) SIM.fixUp(d); } catch (e) { d = null; }
    let card = null, G = null, timer = null, busy = false;
    const stop3d = () => { if (card) { try { card.stop(); } catch (e) {} card = null; } H.setLive(null); };
    const save = () => { try { H.save(d); } catch (e) {} };
    const tick = () => H.Sound.tick && H.Sound.tick();
    const status = t => { ui.status.textContent = t; };
    let m3d = null; const load3d = () => m3d ? Promise.resolve(m3d) : import('./derby3d.js').then(m => (m.ready || Promise.resolve()).then(() => { m3d = m; return m; }));
    const meFor = p => ({ name: p.first, num: p.num, bats: p.bats === 'R' ? 'right' : 'left', gear: H.me.gear });
    const lookFor = p => ({ skin: SKIN[p.skin], hair: HAIR[p.hair], bats: p.bats, helmet: HELMET[p.helm][0] });
    function mount3d(box, p) {
      stop3d(); box.replaceChildren(E('div', { class: 'dyncardload' }, 'Loading your player…'));
      load3d().then(m => { if (!box.isConnected) return; try { card = m.card({ stage: box, me: meFor(p), look: lookFor(p), gear: H.me.gear, still: H.still }); H.setLive(card); } catch (e) { box.replaceChildren(E('div', { class: 'dyncardload' }, '#' + p.num)); } })
        .catch(() => { box.replaceChildren(E('div', { class: 'dyncardload' }, '#' + p.num)); });
    }
    const show = (...kids) => { if (timer) { clearTimeout(timer); timer = null; } root.replaceChildren(...kids); root.scrollTop = 0; ui.stage.scrollTop = 0; };

    /* ---------- create your player ---------- */
    function create() {
      stop3d();
      const p = { first: H.me.name || 'Jaxson', num: H.me.num || '20', bats: H.me.bats === 'right' ? 'R' : 'L', throws: 'L', pos: 'CF', arch: 'contact', skin: 1, hair: 1, helm: 0, level: H.level || 1, slot: 2, sp: 5 };
      const box = E('div', { class: 'dyn3d' });
      const refresh = () => { if (card && card.set) card.set(meFor(p), lookFor(p)); paint(); };
      const seg = (label, opts, key, after) => E('div', { class: 'dynfield' }, E('span', { class: 'dynlab' }, label), E('div', { class: 'dynseg', role: 'radiogroup', 'aria-label': label },
        opts.map(([v, t]) => E('button', { type: 'button', role: 'radio', 'aria-checked': String(p[key] === v), class: p[key] === v ? 'on' : '', onclick: () => { p[key] = v; tick(); (after || refresh)(); } }, t))));
      const sw = (label, arr, key) => E('div', { class: 'dynfield' }, E('span', { class: 'dynlab' }, label), E('div', { class: 'dynsw', role: 'radiogroup', 'aria-label': label },
        arr.map((c, i) => E('button', { type: 'button', role: 'radio', 'aria-label': label + ' ' + (i + 1), 'aria-checked': String(p[key] === i), class: p[key] === i ? 'on' : '', style: 'background:' + hex(Array.isArray(c) ? c[0] : c), onclick: () => { p[key] = i; tick(); refresh(); } }))));
      const form = E('div', { class: 'dynform' });
      function paint() {
        const a = ARCH[p.arch].a;
        form.replaceChildren(
          E('div', { class: 'dynrow2' },
            E('label', { class: 'dynfield' }, E('span', { class: 'dynlab' }, 'Name'), E('input', { class: 'dyninput', value: p.first, maxlength: '12', autocomplete: 'off', oninput: e => { p.first = e.target.value.replace(/[^A-Za-z .'-]/g, '').slice(0, 12) || 'Jaxson'; }, onchange: refresh })),
            E('label', { class: 'dynfield small' }, E('span', { class: 'dynlab' }, 'Number'), E('input', { class: 'dyninput', value: p.num, inputmode: 'numeric', maxlength: '2', oninput: e => { p.num = e.target.value.replace(/\D/g, '').slice(0, 2) || '0'; }, onchange: refresh }))),
          seg('Bats', [['L', 'Left'], ['R', 'Right']], 'bats'), seg('Throws', [['L', 'Left'], ['R', 'Right']], 'throws', paint),
          seg('Position', POS.map(x => [x, x]), 'pos', paint),
          E('div', { class: 'dynfield' }, E('span', { class: 'dynlab' }, 'Player type'), E('div', { class: 'dynarch' }, Object.keys(ARCH).map(k => E('button', { type: 'button', 'aria-pressed': String(p.arch === k), class: p.arch === k ? 'on' : '', onclick: () => { p.arch = k; tick(); paint(); } },
            E('b', null, ARCH[k].name), E('span', null, ARCH[k].blurb))))),
          E('div', { class: 'dynbars' }, ATTR.map(([k, n]) => E('div', { class: 'dynbar' }, E('span', null, n), E('i', null, E('em', { style: 'width:' + a[k] + '%' })), E('b', null, a[k])))),
          sw('Skin', SKIN, 'skin'), sw('Hair', HAIR, 'hair'), sw('Helmet', HELMET, 'helm'),
          seg('Difficulty', [[1, 'Rookie'], [2, 'Pro'], [3, 'All-Star']], 'level', paint),
          E('button', { type: 'button', class: 'dynbig', id: 'dyn-create', onclick: () => {
            p.a = Object.assign({}, ARCH[p.arch].a); p.name = p.first; d = SIM.newDynasty(p); save(); H.Sound.cheer && H.Sound.cheer(); hub(); } }, 'Start my career'));
      }
      show(E('div', { class: 'dynhead' }, E('p', { class: 'dynkick' }, 'Road to the Show'), E('h1', null, 'Create your player'), E('p', { class: 'dynsub' }, 'Drag the 3D player to spin him around.')),
        E('div', { class: 'dyncreate' }, box, form));
      paint(); mount3d(box, p); status('Create your player.');
    }

    /* ---------- the season hub ---------- */
    function hub() {
      stop3d(); const p = d.player, st = SIM.standings(d), rec = SIM.record(d, 'SPI'), place = st.findIndex(t => t.id === 'SPI') + 1, s = d.stats, nx = SIM.nextGame(d);
      const box = E('div', { class: 'dyn3d small' });
      const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
      let nextCard;
      if (nx) { const opp = team(d, nx.g.home === 'SPI' ? nx.g.away : nx.g.home), home = nx.g.home === 'SPI', orec = SIM.record(d, opp.id);
        nextCard = E('section', { class: 'dynnext' }, E('p', { class: 'dynkick' }, nx.playoff ? (nx.playoff === 'final' ? '🏆 CHAMPIONSHIP GAME' : 'PLAYOFFS · SEMIFINAL') : 'GAME ' + (d.week + 1) + ' OF ' + d.rounds.length),
          E('div', { class: 'dynvs' }, chip(team(d, 'SPI'), rec), E('span', { class: 'dynat' }, home ? 'vs' : '@'), chip(opp, orec)),
          E('p', { class: 'dynsub' }, (home ? 'Home at Seed Spitters Park' : 'Road game') + ' · 7 innings · you bat ' + ord(p.slot + 1)),
          E('button', { type: 'button', class: 'dynbig', id: 'dyn-play', onclick: () => { tick(); if (d.live && d.live.g) { G = d.live.g; game(); } else { G = SIM.newGame(d, nx.g, nx.playoff); setupMine(); d.live = { g: G }; save(); game(); } } }, d.live && d.live.g ? 'Resume game' : 'Play ball'),
          E('button', { type: 'button', class: 'dynghost', onclick: () => { if (busy) return; G = d.live && d.live.g ? d.live.g : SIM.newGame(d, nx.g, nx.playoff); setupMine(); simWhole(); } }, 'Sim this game'));
      } else nextCard = seasonOver();
      show(
        E('div', { class: 'dynhead row' }, E('div', null, E('p', { class: 'dynkick' }, 'Season ' + d.season + ' · 10U Summer League'), E('h1', { class: 'dynteam' }, E('span', { class: 'script' }, 'Spitters'), E('b', null, rec.w + '–' + rec.l)), E('p', { class: 'dynsub' }, ord(place) + ' place' + (d.po ? (d.po.done ? '' : ' · in the playoffs!') : ' · top 4 make the playoffs'))),
          E('div', { class: 'dynsp' }, E('b', null, p.sp), E('span', null, 'skill points'))),
        E('div', { class: 'dynhub' }, nextCard,
          E('section', { class: 'dyncard' }, box, E('div', { class: 'dynovr' }, E('b', null, SIM.ovr(p.a)), E('span', null, 'OVR')),
            E('div', { class: 'dynplate' }, E('b', null, '#' + p.num + ' ' + p.first.toUpperCase()), E('span', null, POSNAME[p.pos] + ' · ' + ARCH[p.arch].name + ' · Bats ' + (p.bats === 'L' ? 'left' : 'right') + ', throws ' + (p.throws === 'R' ? 'right' : 'left'))),
            E('div', { class: 'dynbars' }, ATTR.map(([k, n]) => E('div', { class: 'dynbar' }, E('span', null, n), E('i', null, E('em', { style: 'width:' + p.a[k] + '%' })), E('b', null, p.a[k])))),
            E('button', { type: 'button', class: 'dynghost', id: 'dyn-up', onclick: () => { tick(); upgrade(); } }, p.sp ? 'Upgrade your player (' + p.sp + ' points)' : 'Upgrade your player')),
          E('div', { class: 'dyncol' },
            E('section', { class: 'dynbox' }, E('h2', null, 'Your season'), E('div', { class: 'dynstats' },
              [['AVG', fmt3(SIM.avg(s))], ['HR', s.hr], ['RBI', s.rbi], ['H', s.h], ['R', s.r], ['BB', s.bb], ['OPS', fmt3(SIM.obp(s) + SIM.slg(s))], ['WEB GEMS', s.gem]].map(([k, v]) => E('div', null, E('b', null, v), E('span', null, k))))),
            E('section', { class: 'dynbox' }, E('h2', null, 'Game settings'),
              setRow('Batting', 'bat', [['team', 'Whole team'], ['me', 'Just me']]), setRow('Fielding', 'field', [['on', 'Play my position'], ['off', 'Sim my fielding']])),
            E('section', { class: 'dynbox' }, E('h2', null, 'Standings'), standTable(st)),
            d.trophies.length || d.seasons.length ? E('section', { class: 'dynbox' }, E('h2', null, 'Trophy case'), E('ul', { class: 'dyntro' }, d.trophies.map(t => E('li', null, (t.kind === 'champ' ? '🏆 ' : '🏅 ') + t.text)), d.seasons.map(x => E('li', { class: 'mid' }, 'Season ' + x.season + ': ' + x.rec.w + '–' + x.rec.l + ' · hit ' + fmt3(SIM.avg(x.stats)) + ', ' + x.stats.hr + ' HR')))) : null,
            E('button', { type: 'button', class: 'dynlink', onclick: () => { if (confirmReset()) { d = null; save(); create(); } } }, 'Start a new career'))));
      mount3d(box, p); status('Season ' + d.season + '. ' + rec.w + ' wins, ' + rec.l + ' losses.');
    }
    function setRow(label, key, opts) { return E('div', { class: 'dynfield' }, E('span', { class: 'dynlab' }, label), E('div', { class: 'dynseg', role: 'radiogroup', 'aria-label': label },
      opts.map(([v, t]) => E('button', { type: 'button', role: 'radio', 'aria-checked': String(d.opts[key] === v), class: d.opts[key] === v ? 'on' : '', onclick: () => { d.opts[key] = v; if (d.live && d.live.g && key === 'field') d.live.g.fieldOn = v !== 'off'; tick(); save(); hub(); } }, t)))); }
    function confirmReset() { return TEST || window.confirm('Start over with a new player? Your current career will be erased.'); }
    const chip = (t, rec) => E('div', { class: 'dynchip' }, E('i', { style: 'background:' + t.c1 + ';border-color:' + t.c2 }, t.id), E('b', null, t.short), rec ? E('span', null, rec.w + '–' + rec.l) : null);
    function standTable(st) { return E('table', { class: 'dyntable' }, E('thead', null, E('tr', null, E('th', null, ''), E('th', null, 'Team'), E('th', null, 'W'), E('th', null, 'L'))),
      E('tbody', null, st.map((t, i) => E('tr', { class: t.id === 'SPI' ? 'me' : '' }, E('td', null, i + 1), E('td', null, E('i', { class: 'dot', style: 'background:' + t.c1 }), t.name), E('td', null, t.w), E('td', null, t.l))))); }
    function seasonOver() {
      const po = d.po, champ = po && po.champ === 'SPI', aw = SIM.awards(d);
      return E('section', { class: 'dynnext done' }, E('p', { class: 'dynkick' }, 'Season ' + d.season + ' is over'),
        E('h2', { class: 'dynbigt' }, champ ? '🏆 CHAMPIONS!' : po && po.out && po.seeds.includes('SPI') ? 'Knocked out in the playoffs' : 'Missed the playoffs'),
        po && po.champ && !champ ? E('p', { class: 'dynsub' }, team(d, po.champ).name + ' won the title.') : null,
        aw.length ? E('p', { class: 'dynaw' }, aw.map(a => E('span', null, '🏅 ' + a))) : null,
        E('button', { type: 'button', class: 'dynbig', id: 'dyn-next-season', onclick: () => { aw.forEach(a => d.trophies.push({ kind: 'award', season: d.season, text: 'Season ' + d.season + ' ' + a })); SIM.newSeason(d); d.player.sp += 3; save(); hub(); } }, 'Start Season ' + (d.season + 1)));
    }

    /* ---------- upgrades ---------- */
    function upgrade() {
      stop3d(); const p = d.player;
      const rows = E('div', { class: 'dynup' });
      const paint = () => rows.replaceChildren(...ATTR.map(([k, n, why]) => { const v = p.a[k], c = cost(v), can = p.sp >= c && v < 99;
        return E('div', { class: 'dynuprow' }, E('div', null, E('b', null, n), E('span', null, why)), E('div', { class: 'dynbar wide' }, E('i', null, E('em', { style: 'width:' + v + '%' })), E('b', null, v)),
          E('button', { type: 'button', class: 'dynplus', disabled: !can, 'aria-label': 'Add 1 to ' + n + ' for ' + c + ' points', onclick: () => { p.sp -= c; p.a[k] = Math.min(99, v + 1); tick(); save(); paint(); head(); } }, '+1', E('small', null, c + ' pt' + (c > 1 ? 's' : '')))); }));
      const hd = E('div');
      const head = () => hd.replaceChildren(E('p', { class: 'dynkick' }, 'Upgrade your player'), E('h1', null, 'OVR ' + SIM.ovr(p.a) + ' · ', E('span', { class: 'gold' }, p.sp + ' skill points')),
        E('p', { class: 'dynsub' }, 'Earn points with hits, homers, RBIs, web gems and wins. Higher ratings cost more.'));
      head(); paint();
      show(E('div', { class: 'dynhead' }, hd), rows, E('button', { type: 'button', class: 'dynbig', onclick: () => { tick(); hub(); } }, 'Done'));
      status(p.sp + ' skill points to spend.');
    }

    /* ---------- the game ---------- */
    function setupMine() { const a = d.player.a; G.fieldOn = d.opts.field !== 'off'; G.mePos = d.player.pos; G.myFld = a.fld / 100; G.myArm = a.arm / 100; G.mySpd = a.spd / 100; }
    function lineScore() {
      const A = team(d, G.away), Hm = team(d, G.home), n = Math.max(7, G.inn);
      const cells = (k) => { const out = []; for (let i = 0; i < n; i++) { const v = G.line[k][i]; out.push(E('td', { class: (G.inn === i + 1 && ((k === 'a') === G.top) && !G.over) ? 'now' : '' }, v == null ? '' : v)); } return out; };
      return E('table', { class: 'dynline' }, E('thead', null, E('tr', null, E('th', null, ''), Array.from({ length: n }, (_, i) => E('th', null, i + 1)), E('th', { class: 'rhe' }, 'R'), E('th', { class: 'rhe' }, 'H'), E('th', { class: 'rhe' }, 'E'))),
        E('tbody', null, [[A, 'a'], [Hm, 'h']].map(([t, k]) => E('tr', { class: t.id === 'SPI' ? 'me' : '' }, E('td', null, E('i', { class: 'dot', style: 'background:' + t.c1 }), t.id), cells(k), E('td', { class: 'rhe big' }, G.score[k]), E('td', { class: 'rhe' }, G.line[k + 'h']), E('td', { class: 'rhe' }, G.line[k + 'e'])))));
    }
    function diamond() {
      const b = G.bases, on = i => b[i] ? (b[i].me ? 'me' : 'on') : '';
      const onb = ['first', 'second', 'third'].filter((_, i) => b[i]);
      return E('div', { class: 'dyndia', role: 'img', 'aria-label': onb.length ? 'Runners on ' + onb.join(' and ') : 'Bases empty', html:
        '<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M60 92 L104 50 L60 8 L16 50 Z" fill="#2f7d47" stroke="#c8a274" stroke-width="7" stroke-linejoin="round"/>' +
        '<rect class="' + on(1) + '" x="52" y="0" width="16" height="16" transform="rotate(45 60 8)"/><rect class="' + on(0) + '" x="96" y="42" width="16" height="16" transform="rotate(45 104 50)"/><rect class="' + on(2) + '" x="8" y="42" width="16" height="16" transform="rotate(45 16 50)"/>' +
        '<path d="M53 92 h14 v-6 l-7 -6 l-7 6 z" fill="#fff"/></svg>' });
    }
    function feedList() { return E('ol', { class: 'dynfeed', 'aria-live': 'polite' }, G.feed.slice(0, 7).map((f, i) => E('li', { class: (f.me ? 'me ' : '') + (f.big ? 'big ' : '') + (i === 0 ? 'new' : '') }, E('span', null, f.inn), f.t))); }
    function game() {
      stop3d(); if (G.over) return postgame();
      const us = SIM.battingUs(G), bat = SIM.curBatter(G), A = team(d, G.away), Hm = team(d, G.home), opp = team(d, G.opp);
      const teamMode = d.opts.bat === 'team', ourTurn = us && !G.pend && (bat.me || teamMode);
      const outsDots = E('div', { class: 'dynouts', 'aria-label': G.outs + ' out' + (G.outs === 1 ? '' : 's') }, [0, 1, 2].map(i => E('i', { class: i < G.outs ? 'on' : '' })), E('span', null, 'OUT'));
      const half = (G.top ? '▲ TOP ' : '▼ BOT ') + G.inn, down = (G.usHome ? G.score.h - G.score.a : G.score.a - G.score.h), sit = sitLine(down);
      let action;
      if (G.pend) {   // the ball is coming to him
        const pl = G.pend, steal = pl.kind === 'steal';
        action = E('section', { class: 'dynup2 def' }, E('p', { class: 'dynkick' }, 'DEFENSE · ' + POSNAME[d.player.pos].toUpperCase()), E('h2', null, steal ? 'HE’S RUNNING!' : 'HIT TO YOU!'),
          E('p', { class: 'dynsit' }, sit), E('p', { class: 'dynsub' }, steal ? 'The runner on first is stealing. Catch it and throw to second.' : 'Batting: ' + bat.name + '. ' + ({ ground: 'A ground ball', line: 'A line drive', fly: 'A fly ball', pop: 'A pop-up' }[pl.kind]) + ' is coming your way.'),
          E('div', { class: 'dynbtns' }, E('button', { type: 'button', class: 'dynbig', id: 'dyn-field', onclick: () => { tick(); field3d(sit); } }, '🧤 Make the play'),
            E('button', { type: 'button', class: 'dynghost', id: 'dyn-simfield', onclick: () => { tick(); simField(); afterPlay(); } }, 'Sim it')));
      } else if (ourTurn) {
        const isMe = !!bat.me, nm = isMe ? d.player.first : bat.name, num = isMe ? d.player.num : bat.num, bx = G.box[bat.name];
        const today = bx && (bx.ab || bx.bb) ? bx.h + ' for ' + bx.ab + (bx.bb ? ', ' + bx.bb + ' BB' : '') + (bx.rbi ? ', ' + bx.rbi + ' RBI' : '') : 'first at-bat';
        action = E('section', { class: 'dynup2' + (isMe ? '' : ' mate') }, E('p', { class: 'dynkick' }, isMe ? 'YOU’RE UP' : 'SPITTERS AT BAT · YOU’RE IN CONTROL'), E('h2', null, '#' + num + ' ' + nm.toUpperCase()),
          E('p', { class: 'dynsit' }, sit),
          E('p', { class: 'dynsub' }, (isMe ? '' : 'Contact ' + bat.con + ' · Power ' + bat.pow + ' · Bats ' + (bat.bats === 'L' ? 'left' : 'right') + ' · ') + 'Today: ' + today + ' · Pitching: ' + G.them.pitcher),
          E('div', { class: 'dynbtns three' }, E('button', { type: 'button', class: 'dynbig', id: 'dyn-bat', onclick: () => { tick(); bat3d(sit); } }, '⚾ Bat'),
            E('button', { type: 'button', class: 'dynghost', id: 'dyn-simab', onclick: () => { tick(); const c = isMe ? SIM.simAB(G, d) : simMate(bat); SIM.apply(G, c, bat); afterMine(c); } }, 'Sim this at-bat'),
            isMe ? null : E('button', { type: 'button', class: 'dynghost', id: 'dyn-tome', onclick: () => { tick(); playOn('me'); } }, 'Sim to my at-bat')));
      } else action = E('section', { class: 'dynup2 calm' }, E('p', { class: 'dynkick' }, us ? 'SPITTERS BATTING' : opp.short.toUpperCase() + ' BATTING'), E('p', { class: 'dynsub' }, 'Now batting: ' + bat.name + ' · ' + (us ? 'Pitching: ' + G.them.pitcher : 'You’re in ' + POSNAME[d.player.pos].toLowerCase())),
        E('div', { class: 'dynbtns three' }, E('button', { type: 'button', class: 'dynbig', id: 'dyn-go', onclick: () => { tick(); playOn(); } }, teamMode ? '▶ Play on' : '▶ Play to my next at-bat'),
          teamMode ? E('button', { type: 'button', class: 'dynghost', id: 'dyn-tome', onclick: () => { tick(); playOn('me'); } }, 'Sim to my at-bat') : null,
          E('button', { type: 'button', class: 'dynghost', onclick: () => { tick(); playOn('all'); } }, 'Sim to the end')));
      show(E('div', { class: 'dyngame' },
        E('div', { class: 'dynscore' }, E('div', { class: 'dynhalf' }, half, G.playoff ? E('em', null, G.playoff === 'final' ? 'CHAMPIONSHIP' : 'SEMIFINAL') : null), lineScore()),
        E('div', { class: 'dynmid' }, diamond(), E('div', { class: 'dynmidr' }, outsDots, E('div', { class: 'dynbig2' }, E('span', null, A.id + ' ' + G.score.a), E('span', null, Hm.id + ' ' + G.score.h)))),
        action, feedList(), E('button', { type: 'button', class: 'dynlink', onclick: () => { save(); hub(); } }, 'Save and leave (pick up later)')));
      status(half + '. ' + (G.pend ? 'The ball is coming to you!' : ourTurn ? (bat.me ? 'You’re up!' : bat.name + ' is up. You’re batting for him.') : 'Now batting: ' + bat.name));
      if ((ourTurn && bat.me) || G.pend) { H.Sound.organ && !TEST && H.Sound.organ(); }
    }
    function sitLine(down) {
      const b = G.bases, on = ['1st', '2nd', '3rd'].filter((_, i) => b[i]);
      return (G.top ? 'Top ' : 'Bottom ') + G.inn + ' · ' + G.outs + ' out' + (G.outs === 1 ? '' : 's') + ' · ' + (on.length === 3 ? 'bases loaded' : on.length ? 'runner' + (on.length > 1 ? 's' : '') + ' on ' + on.join(' & ') : 'nobody on') + ' · ' + (down === 0 ? 'tied ' + G.score.h + '–' + G.score.a : (down > 0 ? 'up ' : 'down ') + Math.max(G.score.h, G.score.a) + '–' + Math.min(G.score.h, G.score.a));
    }
    const simMate = bat => { const o = SIM.paOdds(bat.b, team(d, G.opp).p); let r = Math.random(), k; for (k in o) { r -= o[k]; if (r <= 0) return k; } return 'GO'; };
    function simField() { const pl = G.pend, bat = SIM.curBatter(G); if (!pl) return; G.pend = null;
      if (pl.kind === 'steal') SIM.applyField(G, { outs: Math.random() < 0.2 + d.player.a.arm / 400 ? 1 : 0 }, pl); else SIM.apply(G, pl.code, bat, { simD: true }); }
    // move the game along one play at a time; stop when it's our at-bat (whole team or just him) or the ball is hit to him
    function playOn(mode) {
      if (busy) return; busy = true;
      const all = mode === 'all', onlyMe = mode === 'me';
      const step = () => {
        if (G.over) { busy = false; save(); return postgame(); }
        const us = SIM.battingUs(G), bat = SIM.curBatter(G);
        if (!all && us && (bat.me || (!onlyMe && d.opts.bat === 'team'))) { busy = false; d.live = { g: G }; save(); return game(); }
        if (us) { SIM.apply(G, bat.me ? SIM.simAB(G, d) : simMate(bat), bat); }
        else if (all) { const f = G.fieldOn; G.fieldOn = false; SIM.oppTurn(G, d); G.fieldOn = f; }
        else { const pl = SIM.oppTurn(G, d); if (pl) { G.pend = pl; busy = false; d.live = { g: G }; save(); return game(); } }
        d.live = { g: G }; if (G.over) { busy = false; save(); return postgame(); } game();
        const L = G.last, wait = TEST || all ? 0 : L && L.runs ? 900 : 420;
        if (L && L.runs && !TEST && !all) { (G.usHome ? !G.top : G.top) ? (H.Sound.cheer && H.Sound.cheer()) : (H.Sound.ooh && H.Sound.ooh()); }
        timer = setTimeout(step, wait);
      };
      step();
    }
    function simWhole() { busy = true; let n = 0; const f = G.fieldOn; G.fieldOn = false; G.pend = null;
      while (!G.over && n++ < 400) { const bat = SIM.curBatter(G); if (SIM.battingUs(G)) SIM.apply(G, bat.me ? SIM.simAB(G, d) : simMate(bat), bat); else SIM.oppTurn(G, d); }
      G.fieldOn = f; busy = false; postgame(); }
    function afterMine(code) { d.live = { g: G }; save(); if (code === 'HR' || code === '2B' || code === '3B') H.Sound.cheer && H.Sound.cheer(); game(); }
    function afterPlay() { d.live = { g: G }; save(); const L = G.last; if (L && L.runs) H.Sound.ooh && H.Sound.ooh(); game(); }
    const sitFor = (opp, extra) => { const A = team(d, G.away), Hm = team(d, G.home);
      return Object.assign({ title: (G.playoff ? (G.playoff === 'final' ? 'CHAMPIONSHIP · ' : 'SEMIFINAL · ') : 'GAME ' + (d.week + 1) + ' · ') + (G.usHome ? 'vs ' : '@ ') + opp.name.toUpperCase(),
        us: A.id, usR: G.score.a, them: Hm.id, themR: G.score.h, half: G.top ? 'TOP' : 'BOT', inn: G.inn, outs: G.outs, on: G.bases.map(Boolean), oc: opp.a, oj: opp.j,
        ol: { bg: hex(opp.j), fg: opp.c1, edge: opp.c2, num: String(Math.floor(rnd(1, 40))), name: opp.short.toUpperCase(), script: opp.short } }, extra || {}); };
    // an at-bat in 3D: him, or whichever teammate is up
    function bat3d(sit) {
      stop3d(); const opp = team(d, G.opp), p = d.player, hitterNow = SIM.curBatter(G), isMe = !!hitterNow.me;
      const host = E('div', { class: 'dyn3dab' }); root.replaceChildren(host); ui.stage.classList.add('cvstage');
      host.appendChild(E('div', { class: 'd3load' }, E('b', null, 'Walking up to the plate…'), E('i')));
      const sitObj = sitFor(opp, { line: sit, pitcher: 'On the mound: ' + G.them.pitcher + ' (' + opp.short + ')', ctl: clamp(0.72 + opp.p * 0.18, 0.7, 0.9) });
      const back = res => { stop3d(); ui.stage.classList.remove('cvstage'); const bat = SIM.curBatter(G);
        if (!res || !G || bat !== hitterNow) return game();
        SIM.apply(G, res.code, bat, { out: res.out, text: res.text, looking: /looking/i.test(res.text || '') }); afterMine(res.code); };
      const who = isMe ? meFor(p) : { name: hitterNow.name.split(' ')[0], num: hitterNow.num, bats: hitterNow.bats === 'L' ? 'left' : 'right', gear: {} };
      const rr = isMe ? p.a : { con: hitterNow.con, pow: hitterNow.pow, spd: hitterNow.spd2 };
      load3d().then(m => { if (!host.isConnected) return;
        try { const g = m.atbat({ stage: host, level: p.level || 1, me: who, Sound: H.Sound, still: H.still, say: t => status(t), end: () => {}, ab: { r: rr, sit: sitObj, skin: SKIN[isMe ? p.skin : hitterNow.skin], hair: HAIR[isMe ? p.hair : hitterNow.hair], onDone: res => setTimeout(() => back(res), 0) } }); card = g; H.setLive(g); }
        catch (e) { back(null); } })
        .catch(() => { ui.stage.classList.remove('cvstage'); const c = isMe ? SIM.simAB(G, d) : simMate(hitterNow); SIM.apply(G, c, hitterNow); afterMine(c); });
    }
    // a play in the field, in 3D
    function field3d(sit) {
      stop3d(); const opp = team(d, G.opp), p = d.player, pl = G.pend, bat = SIM.curBatter(G);
      const host = E('div', { class: 'dyn3dab' }); root.replaceChildren(host); ui.stage.classList.add('cvstage');
      host.appendChild(E('div', { class: 'd3load' }, E('b', null, 'Taking the field…'), E('i')));
      const st = sitFor(opp); const score = st.us + ' ' + st.usR + ' · ' + st.them + ' ' + st.themR;
      const back = res => { stop3d(); ui.stage.classList.remove('cvstage'); if (!res || !G.pend) return game(); SIM.applyField(G, res, pl); afterPlay(); };
      load3d().then(m => { if (!host.isConnected) return;
        try { const g = m.fieldPlay({ stage: host, level: p.level || 1, me: meFor(p), Sound: H.Sound, say: t => status(t),
            play: { pos: p.pos, kind: pl.kind, diff: pl.diff, on: G.bases.map(Boolean), outs: G.outs, r: p.a, throws: p.throws, skin: SKIN[p.skin], hair: HAIR[p.hair],
              sit: { score, half: (G.top ? 'TOP ' : 'BOT ') + G.inn, title: st.title, line: sit }, opp: { oc: opp.a, oj: opp.j, ol: st.ol }, onDone: res => setTimeout(() => back(res), 0) } });
          card = g; H.setLive(g); }
        catch (e) { back(null); } })
        .catch(() => { ui.stage.classList.remove('cvstage'); simField(); afterPlay(); });
    }
    function postgame() {
      stop3d(); const m = G.my, A = team(d, G.away), Hm = team(d, G.home), first = !G.fin; if (first) { G.fin = SIM.finishGame(d, G); save(); } const r = G.fin;
      const line = m.h + ' for ' + m.ab + (m.hr ? ', ' + m.hr + ' HR' : '') + (m.d ? ', ' + m.d + ' 2B' : '') + (m.t ? ', ' + m.t + ' 3B' : '') + (m.rbi ? ', ' + m.rbi + ' RBI' : '') + (m.bb ? ', ' + m.bb + ' BB' : '') + (m.r ? ', ' + m.r + ' R' : '') + (m.gem ? ', ' + m.gem + ' web gem' + (m.gem > 1 ? 's' : '') : '');
      if (first) { if (r.won) { H.Sound.cheer && H.Sound.cheer(); } else { H.Sound.ooh && H.Sound.ooh(); } }
      if (first) { try { H.record(SIM.ovr(d.player.a)); } catch (e) {} }
      show(E('div', { class: 'dynpost ' + (r.won ? 'win' : 'loss') },
        E('p', { class: 'dynkick' }, 'FINAL' + (G.inn > 7 ? ' / ' + G.inn : '')), E('h1', { class: 'dynfinal' }, r.won ? 'SPITTERS WIN!' : 'Tough loss'),
        E('div', { class: 'dynfscore' }, E('div', null, E('i', { class: 'dot', style: 'background:' + A.c1 }), A.name, E('b', null, G.score.a)), E('div', null, E('i', { class: 'dot', style: 'background:' + Hm.c1 }), Hm.name, E('b', null, G.score.h))),
        lineScore(),
        E('section', { class: 'dynbox' }, E('h2', null, r.potg ? '⭐ PLAYER OF THE GAME' : 'Your game'), E('p', { class: 'dynmyline' }, line || 'No at-bats'),
          E('ul', { class: 'dynabs' }, G.myAB.map(a => E('li', { class: ['1B', '2B', '3B', 'HR'].includes(a.code) ? 'hit' : a.code === 'BB' ? 'bb' : '' }, E('b', null, 'Inning ' + a.inn), { '1B': 'Single', '2B': 'Double', '3B': 'Triple', HR: 'HOME RUN', BB: 'Walk', K: 'Strikeout', OUT: 'Out', GO: 'Ground out', FO: 'Fly out', LO: 'Line out', E: 'Reached on error' }[a.code] + (a.rbi ? ' · ' + a.rbi + ' RBI' : ''))))),
        Object.keys(G.box || {}).length ? E('section', { class: 'dynbox' }, E('h2', null, 'Spitters batting'), E('table', { class: 'dyntable box' }, E('thead', null, E('tr', null, ['Batter', 'AB', 'H', 'HR', 'RBI', 'BB'].map(h => E('th', null, h)))),
          E('tbody', null, G.us.lineup.filter(x => G.box[x.name]).map(x => { const b = G.box[x.name]; return E('tr', { class: x.me ? 'me' : '' }, E('td', null, '#' + (x.me ? d.player.num : x.num) + ' ' + (x.me ? d.player.first : x.name)), E('td', null, b.ab), E('td', null, b.h), E('td', null, b.hr), E('td', null, b.rbi), E('td', null, b.bb)); })))) : null,
        E('div', { class: 'dynspgain' }, E('b', null, '+' + r.sp), E('span', null, 'skill points')),
        E('button', { type: 'button', class: 'dynbig', id: 'dyn-cont', onclick: () => { tick(); G = null; hub(); } }, 'Continue')));
      status((r.won ? 'Win! ' : 'Loss. ') + G.score.a + ' to ' + G.score.h + '. You went ' + line + '.');
    }

    if (d && d.player) { if (d.live && d.live.g) { G = d.live.g; hub(); } else hub(); } else create();
    return { stop: () => { if (timer) clearTimeout(timer); stop3d(); } };
  }
  return { start, SIM };
})();
if (typeof module !== 'undefined') module.exports = HubDynasty;
