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
  const POS = ['P', 'CF', 'SS', '2B', '3B', '1B', 'LF', 'RF', 'C'];
  const POSNAME = { P: 'Pitcher', CF: 'Center Field', SS: 'Shortstop', '2B': 'Second Base', '3B': 'Third Base', '1B': 'First Base', LF: 'Left Field', RF: 'Right Field', C: 'Catcher' };
  const ARCH = {
    contact: { name: 'Contact Hitter', blurb: 'Sprays line drives. Hard to strike out.', a: { con: 66, vis: 64, pow: 47, eye: 60, clu: 55, spd: 57, rea: 56, fld: 56, arm: 52, acc: 56 } },
    power: { name: 'Power Slugger', blurb: 'Hits it a mile when he gets it.', a: { con: 54, vis: 55, pow: 68, eye: 51, clu: 58, spd: 48, rea: 50, fld: 52, arm: 62, acc: 52 } },
    speed: { name: 'Speedster', blurb: 'Beats out grounders. Covers ground.', a: { con: 60, vis: 58, pow: 44, eye: 56, clu: 52, spd: 70, rea: 62, fld: 60, arm: 50, acc: 55 } },
    glove: { name: 'Glove Wizard', blurb: 'Takes away hits. Strong, accurate arm.', a: { con: 55, vis: 55, pow: 46, eye: 55, clu: 52, spd: 58, rea: 66, fld: 67, arm: 60, acc: 62 } },
    five: { name: 'Five-Tool', blurb: 'A little of everything.', a: { con: 57, vis: 57, pow: 56, eye: 56, clu: 56, spd: 57, rea: 56, fld: 57, arm: 57, acc: 56 } },
    ace: { name: 'Ace Pitcher', blurb: 'Lives on the mound. Can still swing it.', a: { con: 54, vis: 54, pow: 50, eye: 52, clu: 55, spd: 52, rea: 58, fld: 55, arm: 64, acc: 60, vel: 64, ctl: 62, brk: 60, sta: 60 } } };
  // pitching abilities start low for position players (they can grow them if they move to the mound)
  for (const k in ARCH) if (ARCH[k].a.vel == null) Object.assign(ARCH[k].a, { vel: 46, ctl: 46, brk: 44, sta: 45 });
  // 10 abilities, each one used in the game
  const ATTR = [
    ['con', 'Contact', 'How far off the ball you can be and still hit it', 'Hitting'], ['vis', 'Vision', 'Bigger timing window on your swing', 'Hitting'], ['pow', 'Power', 'Harder hits, farther home runs', 'Hitting'],
    ['eye', 'Discipline', 'More walks, fewer strikeouts in simmed at-bats', 'Hitting'], ['clu', 'Clutch', 'Boost with runners on 2nd or 3rd', 'Hitting'],
    ['spd', 'Speed', 'Run faster, beat out grounders, score from second', 'Running'],
    ['rea', 'Reaction', 'Quicker first step on balls hit to you', 'Fielding'], ['fld', 'Fielding', 'Bigger reach, fewer bobbles', 'Fielding'], ['arm', 'Arm Strength', 'Faster throws', 'Fielding'], ['acc', 'Arm Accuracy', 'Fewer wild throws', 'Fielding'],
    ['vel', 'Velocity', 'Faster pitches, harder to hit', 'Pitching'], ['ctl', 'Control', 'Pitches land closer to your target', 'Pitching'], ['brk', 'Break', 'Curves and changeups fool hitters more', 'Pitching'], ['sta', 'Stamina', 'More pitches before the coach takes the ball', 'Pitching']];
  const GROUPS = ['Hitting', 'Running', 'Fielding', 'Pitching'];
  const groupsFor = pos => pos === 'P' ? GROUPS : GROUPS.slice(0, 3);
  // perks: unlocked as he levels up; equip 1 slot at level 2, 2 at level 10, 3 at level 20
  const PERKS = [
    { id: 'moon', name: 'Moonshot', d: '+5 Power', lvl: 2, b: { pow: 5 } }, { id: 'eagle', name: 'Eagle Eye', d: '+8 Discipline', lvl: 4, b: { eye: 8 } },
    { id: 'rbi', name: 'RBI Machine', d: '+8 Clutch', lvl: 6, b: { clu: 8 } }, { id: 'wheels', name: 'Wheels', d: '+6 Speed', lvl: 8, b: { spd: 6 } },
    { id: 'glove', name: 'Golden Glove', d: '+5 Fielding, +5 Reaction', lvl: 10, b: { fld: 5, rea: 5 } }, { id: 'cannon', name: 'Cannon', d: '+6 Arm Strength', lvl: 12, b: { arm: 6 } },
    { id: 'laser', name: 'Laser', d: '+8 Arm Accuracy', lvl: 14, b: { acc: 8 } }, { id: 'barrel', name: 'Barrel Up', d: '+5 Contact, +5 Vision', lvl: 17, b: { con: 5, vis: 5 } },
    { id: 'spark', name: 'Spark Plug', d: '+3 to everything', lvl: 22, b: { con: 3, vis: 3, pow: 3, eye: 3, clu: 3, spd: 3, rea: 3, fld: 3, arm: 3, acc: 3 } }];
  const slots = lvl => lvl >= 20 ? 3 : lvl >= 10 ? 2 : lvl >= 2 ? 1 : 0;
  // the road: one level per season when he's good enough (or wins the title / MVP)
  const TIERS = [{ name: '10U Summer League', short: '10U', need: 0 }, { name: '12U Travel', short: '12U', need: 61 }, { name: '14U Travel', short: '14U', need: 65 }, { name: 'High School Varsity', short: 'HS', need: 69 },
    { name: 'College', short: 'College', need: 73 }, { name: 'Double-A', short: 'AA', need: 77 }, { name: 'Triple-A', short: 'AAA', need: 81 }, { name: 'The Show', short: 'MLB', need: 85 }];
  const SKIN = [0xf6d3b8, 0xf0c8a5, 0xd9a57c, 0xb98058, 0x8d5a3b, 0x5e3a24], HAIR = [0x2a1a0e, 0x4a2e18, 0x7a4a22, 0xc9a058, 0x111111, 0xa0461d];
  const HELMET = [[0x1d6a3b, 'Team green'], [0x161616, 'Black'], [0xee7f24, 'Orange'], [0xb8bcc4, 'Chrome']];
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const W8 = { con: 0.14, vis: 0.12, pow: 0.14, eye: 0.08, clu: 0.07, spd: 0.15, rea: 0.07, fld: 0.1, arm: 0.07, acc: 0.06 };
  const ovrPos = a => Object.keys(W8).reduce((t, k) => t + (a[k] != null ? a[k] : 50) * W8[k], 0);
  const ovrPit = a => (a.vel || 45) * 0.3 + (a.ctl || 45) * 0.3 + (a.brk || 45) * 0.25 + (a.sta || 45) * 0.15;
  const ovr = (a, pos) => Math.round(pos === 'P' ? ovrPit(a) * 0.6 + ovrPos(a) * 0.4 : ovrPos(a));
  const xpNeed = v => v < 60 ? 100 : v < 75 ? 140 : v < 88 ? 180 : 240;          // XP for +1 in an ability
  const lvlNeed = l => 300 + 25 * l;                                                // XP for the next player level
  // his ratings in a spot: perks on top, clutch with runners in scoring position
  function eff(p, risp) { const a = Object.assign({ vel: 46, ctl: 46, brk: 44, sta: 45, con: 50, vis: p.a.con || 50, pow: 50, eye: 50, clu: 50, spd: 50, rea: p.a.fld || 50, fld: 50, arm: 50, acc: p.a.arm || 50 }, p.a); (p.perks && p.perks.on || []).forEach(id => { const k = PERKS.find(x => x.id === id); if (k) for (const q in k.b) a[q] = Math.min(99, a[q] + k.b[q]); });
    if (risp) { const c = (a.clu - 50) / 4; a.con += c; a.vis += c; a.pow += c * 0.8; } return a; }
  const cost = v => v < 60 ? 1 : v < 70 ? 2 : v < 80 ? 3 : v < 90 ? 4 : 5;
  const team = (d, id) => d.teams.find(t => t.id === id);
  const kidName = () => pick(FIRST) + ' ' + pick(LAST);

  function roster(t, me) {
    const L = [];
    const used = new Set(me ? [String(me.num)] : []); const num = () => { let n; do { n = String(Math.floor(rnd(1, 60))); } while (used.has(n)); used.add(n); return n; };
    for (let i = 0; i < 9; i++) L.push(mate({ name: kidName(), num: num(), b: clamp(t.o + rnd(-0.1, 0.1), 0.25, 0.85), spd: rnd(0.35, 0.7) }));
    if (me) L[me.slot] = { name: me.name, num: me.num, me: true };
    return { lineup: L, pitcher: kidName(), slot: 0 };
  }
  // a teammate's look and ratings (old saves get them filled in)
  function mate(x) { if (x.me) return x; if (x.con == null) { x.con = Math.round(clamp(38 + x.b * 55 + rnd(-6, 6), 35, 90)); x.pow = Math.round(clamp(32 + x.b * 50 + rnd(-10, 10), 30, 90)); x.spd2 = Math.round(clamp((x.spd || 0.5) * 100, 30, 90)); x.skin = Math.floor(rnd(0, 6)); x.hair = Math.floor(rnd(0, 6)); x.bats = chance(0.3) ? 'L' : 'R'; } return x; }
  function fixUp(d) { if (!d.opts) d.opts = { bat: 'team', field: 'on' }; if (!d.opts.inn) d.opts.inn = 7;
    const p = d.player; if (p && p.a && p.a.vel == null) Object.assign(p.a, { vel: 46, ctl: 46, brk: 44, sta: 45 });
    if (p && p.a && p.a.vis == null) { p.a.vis = p.a.con; p.a.clu = 52; p.a.rea = p.a.fld; p.a.acc = p.a.arm; }
    if (p && !p.xp) { p.xp = {}; p.lvl = 1; p.lxp = 0; p.perks = { owned: [], on: [] }; } if (d.tier == null) d.tier = 0; if (d.roster) d.roster.lineup.forEach(mate); if (d.live && d.live.g) { d.live.g.us = d.roster; if (!d.live.g.box) d.live.g.box = {}; } return d; }
  // round robin: everyone plays everyone twice (10 rounds, 3 games each)
  function schedule(ids) {
    const n = ids.length, rounds = [], a = ids.slice();
    for (let r = 0; r < n - 1; r++) { const g = []; for (let i = 0; i < n / 2; i++) { const x = a[i], y = a[n - 1 - i]; g.push(r % 2 ? [x, y] : [y, x]); } rounds.push(g); a.splice(1, 0, a.pop()); }
    return rounds.concat(rounds.map(g => g.map(([h, v]) => [v, h]))).map(g => g.map(([home, away]) => ({ home, away, res: null })));
  }
  function newDynasty(p) {
    const teams = TEAMS.map(t => Object.assign({}, t, { o: t.o + (t.id === 'SPI' ? 0 : rnd(-0.03, 0.03)), p: t.p + (t.id === 'SPI' ? 0 : rnd(-0.03, 0.03)) }));
    if (!p.xp) { p.xp = {}; p.lvl = 1; p.lxp = 0; p.perks = { owned: [], on: [] }; }
    const d = { v: 2, tier: 0, opts: { bat: 'team', field: 'on', inn: 7 }, player: p, season: 1, teams, rounds: schedule(teams.map(t => t.id)), week: 0, po: null, stats: blank(), career: blank(), seasons: [], trophies: [], live: null, log: [] };
    d.roster = roster(team(d, 'SPI'), p);
    return d;
  }
  // end of season: called up if he's good enough, or won the title, or was MVP
  function promo(d) { const nxt = TIERS[d.tier + 1]; if (!nxt) return { up: false, top: true }; const o = ovr(d.player.a, d.player.pos), champ = !!(d.po && d.po.champ === 'SPI'), mvp = awards(d).includes('League MVP');
    return { up: o >= nxt.need || champ || mvp, why: o >= nxt.need ? 'OVR ' + o + ' (needed ' + nxt.need + ')' : champ ? 'Won the title' : mvp ? 'League MVP' : '', need: nxt.need, next: nxt }; }
  function newSeason(d) {
    const pr = promo(d);
    d.seasons.push({ season: d.season, tier: d.tier, rec: record(d, 'SPI'), stats: d.stats, place: standings(d).findIndex(t => t.id === 'SPI') + 1, champ: !!(d.po && d.po.champ === 'SPI') });
    if (pr.up) { d.tier++; d.teams.forEach(t => { t.o = clamp(0.5 + d.tier * 0.035 + (t.id === 'SPI' ? 0 : rnd(-0.03, 0.04)), 0.4, 0.85); t.p = clamp(0.5 + d.tier * 0.035 + (t.id === 'SPI' ? 0 : rnd(-0.03, 0.04)), 0.4, 0.85); }); }
    d.season++; d.week = 0; d.po = null; d.stats = blank(); d.live = null;
    if (!pr.up) d.teams.forEach(t => { if (t.id !== 'SPI') { t.o = clamp(t.o + 0.02 + rnd(-0.03, 0.03), 0.4, 0.75); t.p = clamp(t.p + 0.02 + rnd(-0.03, 0.03), 0.4, 0.75); } else { t.o = clamp(t.o + 0.02, 0.4, 0.75); t.p = clamp(t.p + 0.02, 0.4, 0.75); } });
    d.rounds = schedule(d.teams.map(t => t.id));
    if (pr.up || !d.roster) { d.roster = roster(team(d, 'SPI'), d.player); d.chem = 45; }
    else d.roster.lineup.forEach(x => { if (x.me) return; const g = rnd(0.01, 0.035); x.b = clamp(x.b + g, 0.25, 0.92); x.con = Math.min(95, x.con + Math.round(g * 80)); x.pow = Math.min(95, x.pow + Math.round(g * 70)); });
    d.fa = freeAgents(d);
    return pr;
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
  const myB = a => clamp((a.con * 0.35 + (a.vis != null ? a.vis : a.con) * 0.25 + a.pow * 0.15 + a.eye * 0.25) / 100, 0.3, 0.95);

  /* ================= a 7-inning game ================= */
  function newGame(d, g, playoff) {
    const usHome = g.home === 'SPI', opp = team(d, usHome ? g.away : g.home), them = roster(opp);
    return { home: g.home, away: g.away, usHome, opp: opp.id, playoff: playoff || null, inn: 1, top: true, outs: 0, bases: [null, null, null], score: { h: 0, a: 0 }, line: { h: [], a: [], hh: 0, ah: 0, he: 0, ae: 0 },
      len: (d.opts && d.opts.inn) || 7, us: d.roster, them, oSlot: 0, uSlot: 0, feed: [], over: false, my: blank(), myAB: [], rbiGame: 0, wp: 0, box: {}, pend: null, pit: null };
  }
  const gameFor = (d, g, playoff) => { const G = newGame(d, g, playoff); if (d.player && d.player.pos === 'P') startPitching(G, d); return G; };
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
    extra = extra || {}; const risp0 = !!(G.bases[1] || G.bases[2]); const us = battingUs(G), mine = !!bat.me, rec = code === 'OUT' ? (extra.out === 'ground' ? 'GO' : extra.out === 'line' ? 'LO' : 'FO') : code;
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
      if (rg && chance(0.15)) { if (chance(G.myFld * 0.05)) { G.my.gem++; txt = (kind === 'GO' ? 'Diving stop' : 'Diving catch') + ' by YOU! ' + bat.name.split(' ')[0] + ' is out.'; extra.gem = true; } else txt = bat.name.split(' ')[0] + (kind === 'GO' ? ' grounds to you. You make the play.' : ' flies to you. You make the catch.'); extra.mineD = true; if (kind === 'GO') G.my.as = (G.my.as || 0) + 1; else G.my.po = (G.my.po || 0) + 1; }
    } else {
      const names = { BB: ' walks.', '1B': ' singles.', '2B': ' doubles!', '3B': ' triples!', HR: ' homers!', E: ' reaches on an error.' };
      // his glove can take away a hit
      if (!us && G.mePos && (!G.fieldOn || extra.simD) && (code === '1B' || code === '2B') && chance(0.11) && chance(G.myFld * 0.35)) { G.outs++; G.my.gem++; txt = 'WEB GEM! You rob ' + bat.name.split(' ')[0] + ' of a hit!'; extra.gem = true; extra.mineD = true; G.my.po = (G.my.po || 0) + 1; }
      else { const a = advance(G, code, bat); runs = a.runs; rbi = a.rbi; txt = who + names[code] + (runs ? ' ' + runs + (runs === 1 ? ' run scores.' : ' runs score.') : '');
        if (!us && G.mePos && (!G.fieldOn || extra.simD) && code === '1B' && a.scored.length === 0 && G.bases[2] && chance(0.08 + G.myArm * 0.1)) { G.bases[2] = null; G.outs++; G.my.gem++; txt += ' You throw out the runner at home!'; extra.gem = true; extra.mineD = true; G.my.as = (G.my.as || 0) + 1; }
        if (extra.myErr) { G.my.e++; txt = bat.name.split(' ')[0] + ' reaches. You bobbled it. Shake it off.'; extra.mineD = true; }
        else if (!us && code === 'E' && G.mePos && (!G.fieldOn || extra.simD) && chance(0.12) && chance(1 - G.myFld)) { G.my.e++; txt = bat.name.split(' ')[0] + ' reaches on YOUR error. Shake it off.'; extra.mineD = true; } }
      const hitc = ['1B', '2B', '3B', 'HR'].includes(code); if (hitc) G.line[side(G) + 'h']++; if (code === 'E') G.line[(G.top ? 'h' : 'a') + 'e']++;
    }
    if (us) { const bx = G.box[bat.name] || (G.box[bat.name] = { num: bat.num, me: !!bat.me, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0 });
      if (code !== 'BB' && !extra.sac) bx.ab++; if (['1B', '2B', '3B', 'HR'].includes(code)) bx.h++; if (code === 'HR') bx.hr++; if (code === 'BB') bx.bb++; if (code === 'K') bx.k++; bx.rbi += rbi; }
    if (mine) { const m = G.my; m.pa++; if (code !== 'BB' && !extra.sac) m.ab++; if (['1B', '2B', '3B', 'HR'].includes(code)) { m.h++; if (risp0) m.rh = (m.rh || 0) + 1; } if (code === '2B') m.d++; if (code === '3B') m.t++; if (code === 'HR') m.hr++; if (code === 'BB') m.bb++; if (code === 'K') m.k++; m.rbi += rbi;
      G.myAB.push({ inn: G.inn, code: rec, rbi, text: extra.text || '' }); }
    say(G, txt, mine || extra.mineD, mine && (code === 'HR' || rbi > 0) || extra.gem);
    if (us) G.uSlot++; else G.oSlot++;
    G.last = { code, mine, runs };
    endCheck(G);
  }
  function endCheck(G) {
    const homeUp = !G.top;
    const LEN = G.len || 7;
    if (homeUp && G.inn >= LEN && G.score.h > G.score.a) { G.over = true; say(G, (G.usHome ? 'WALK-OFF! The Spitters win it!' : 'Walk-off. They win it.'), G.usHome, G.usHome); return; }
    if (G.outs >= 3) {
      if (G.line[side(G)][G.inn - 1] == null) G.line[side(G)][G.inn - 1] = 0;
      G.outs = 0; G.bases = [null, null, null]; G.stealTried = false;
      if (G.top) { if (G.inn >= LEN && G.score.h > G.score.a) { G.over = true; G.line.h[G.inn - 1] = 'X'; return; } G.top = false; }
      else { if (G.inn >= LEN && G.score.h !== G.score.a) { G.over = true; return; } if (G.inn >= 15) { G.over = true; return; } G.inn++; G.top = true; }
      say(G, (G.top ? 'Top ' : 'Bottom ') + G.inn + (G.inn > (G.len || 7) ? ' · extra innings!' : ''), false, false);
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
    if (G.pit && G.pit.on) { if (G.fieldOn) return { kind: 'pitch' }; simPitch(G, d); return null; }
    if (G.fieldOn && G.mePos === 'C' && G.bases[0] && !G.bases[1] && G.outs < 2 && !G.stealTried && chance(0.3)) { G.stealTried = true; return { kind: 'steal', pos: 'C', diff: 'routine' }; }
    const code = draw(paOdds(bat.b, team(d, 'SPI').p)), w = whereTo(code);
    if (G.fieldOn && w && w.pos === G.mePos) return Object.assign({ code }, w);
    apply(G, code, bat); return null;
  }
  // pitching: Pitch Smart daily max by level, and his Stamina
  const PITCH_MAX = [75, 85, 95, 105, 105, 110, 110, 110];
  const pitchSkill = a => clamp((a.vel * 0.35 + a.ctl * 0.35 + a.brk * 0.3) / 100, 0.3, 0.95);
  function pitchLimit(d) { return Math.min(PITCH_MAX[d.tier || 0], Math.round(38 + eff(d.player).sta * 0.62)); }
  function startPitching(G, d) { G.pit = { on: true, pc: 0, limit: pitchLimit(d), outs: 0, h: 0, r: 0, bb: 0, k: 0, bf: 0, inn0: null }; }
  // record what happened to the batter he faced
  function pitchApply(G, d, code, bat, extra, pitches) {
    const P = G.pit, oppSide = G.top ? 'a' : 'h', r0 = G.score[oppSide], o0 = G.outs, inn0 = G.inn, top0 = G.top;
    apply(G, code, bat, extra || {});
    const changed = G.inn !== inn0 || G.top !== top0, outsMade = changed ? 3 - o0 : G.outs - o0;
    P.outs += Math.max(0, outsMade); P.r += G.score[oppSide] - r0; P.bf++; P.pc += pitches;
    if (['1B', '2B', '3B', 'HR'].includes(code)) P.h++; if (code === 'BB') P.bb++; if (code === 'K') P.k++;
    // the coach comes to get him: out of pitches, or a rough day
    if (P.on && (P.pc >= P.limit || P.r >= 8) && G.over) P.on = false;
    if (P.on && (P.pc >= P.limit || P.r >= 8)) { P.on = false; P.pulled = true;
      say(G, 'Coach takes the ball. Your line: ' + ipStr(P.outs) + ' IP, ' + P.h + ' H, ' + P.r + ' R, ' + P.bb + ' BB, ' + P.k + ' K on ' + P.pc + ' pitches. You move to first base.', true, true); G.mePos = '1B'; }
    // next batter: straight back to the mound, no extra tap
    G.pend = P.on && !G.over && !battingUs(G) && G.fieldOn ? { kind: 'pitch' } : null;
  }
  const ipStr = o => Math.floor(o / 3) + (o % 3 ? '.' + (o % 3) : '');
  function simPitch(G, d) { const bat = curBatter(G), a = eff(d.player); const code = draw(paOdds(bat.b, pitchSkill(a)));
    const pc = code === 'K' ? Math.round(rnd(4, 7)) : code === 'BB' ? Math.round(rnd(5, 7)) : Math.round(rnd(2, 5)); pitchApply(G, d, code, bat, { simD: true }, pc); return code; }
  // his fielding play comes back from 3D
  function applyField(G, r, plan) {
    const bat = curBatter(G), prev = G.bases.slice(), nm = bat.name.split(' ')[0], pick2 = o => o === 0 ? bat : prev[o - 1];
    G.pend = null;
    if (plan.kind === 'steal') { const rn = prev[0]; if (r.outs) { G.outs++; G.bases[0] = null; G.my.gem++; G.my.as = (G.my.as || 0) + 1; say(G, 'You throw out ' + (rn ? rn.name.split(' ')[0] : 'the runner') + ' stealing second! Caught stealing!', true, true); }
      else { G.bases[1] = prev[0]; G.bases[0] = null; say(G, (rn ? rn.name.split(' ')[0] : 'The runner') + ' steals second. Quicker throw next time.', true, false); }
      G.last = { code: 'SB', mine: false, runs: 0 }; endCheck(G); return; }
    if (r.code === 'FOUL') { say(G, 'Foul pop. Just out of reach.', true, false); const code = draw(paOdds(bat.b, 0.5)); apply(G, code === 'FO' ? 'GO' : code, bat); return; }
    if (['1B', '2B', '3B'].includes(r.code)) { apply(G, r.code, bat, { mineD: true }); return; }
    if (r.code === 'E') { apply(G, 'E', bat, { myErr: true }); return; }
    const outsN = r.outs || 0; G.outs += outsN;
    const runs = []; (r.scored || []).forEach(o => { const x = pick2(o); if (x) { runs.push(x); score(G, x); } });
    G.bases = (r.bases || [null, null, null]).map(o => o == null ? null : pick2(o));
    if (r.gem) G.my.gem++;
    if (outsN) { if (r.caught) G.my.po = (G.my.po || 0) + 1; else G.my.as = (G.my.as || 0) + outsN; }
    if (r.code === 'IFH') G.line[side(G) + 'h']++;
    let txt = r.code === 'DP' ? 'DOUBLE PLAY! You turn two!' : r.code === 'OUT_AIR' ? 'You catch ' + nm + '\u2019s ' + (plan.kind === 'line' ? 'line drive' : plan.kind === 'pop' ? 'pop-up' : 'fly ball') + '!' : r.code === 'OUT' ? 'You field it and get the out!' : r.code === 'IFH' ? 'You field it, but everyone\u2019s safe. Infield hit.' : 'You get the lead runner. Fielder\u2019s choice.';
    if (r.gem && r.code !== 'IFH') txt = (r.caught ? 'DIVING CATCH! ' : 'DIVING STOP! ') + txt;
    if (runs.length) txt += ' ' + runs.length + (runs.length === 1 ? ' run scores.' : ' runs score.');
    say(G, txt, true, !!r.gem || r.code === 'DP');
    G.oSlot++; G.last = { code: r.code, mine: false, runs: runs.length }; endCheck(G);
  }
  function simAB(G, d) { const a = eff(d.player, !!(G.bases[1] || G.bases[2])); return draw(paOdds(myB(a), team(d, G.opp).p, a)); }
  function quickGame(d, home, away) {   // other teams' games: just the final score
    const H = team(d, home), A = team(d, away); let h = 0, a = 0;
    const half = (o, p) => { let outs = 0, b = [0, 0, 0], r = 0; while (outs < 3) { const c = draw(paOdds(o + rnd(-0.08, 0.08), p));
      if (c === 'K' || c === 'GO' || c === 'FO' || c === 'LO') outs++; else if (c === 'HR') { r += 1 + b.filter(Boolean).length; b = [0, 0, 0]; } else if (c === '3B') { r += b.filter(Boolean).length; b = [0, 0, 1]; }
      else if (c === '2B') { r += b[1] + b[2]; b = [0, 1, b[0]]; } else if (c === 'BB') { if (b[0] && b[1] && b[2]) r++; b = [1, b[0] || b[1] ? 1 : 0, (b[0] && b[1]) || b[2] ? 1 : 0]; } else { r += b[2]; b = [1, b[0], b[1]]; } } return r; };
    for (let i = 1; i <= 7 || h === a; i++) { a += half(A.o, H.p); if (i >= 7 && h > a) break; h += half(H.o, A.p); if (i > 12) { h++; break; } }
    return { h, a };
  }
  /* ---------- team management ---------- */
  // chemistry: winning together builds it; new faces cost a little. It lifts (or drags) teammates' at-bats a bit.
  const chemB = d => ((d.chem == null ? 50 : d.chem) - 50) / 500;
  const myOrderB = d => myB(eff(d.player, false));
  // free agents: three better-than-average kids each offseason; he signs one
  function freeAgents(d) { const t = team(d, 'SPI'), used = new Set(d.roster.lineup.map(x => String(x.me ? d.player.num : x.num)));
    const num = () => { let n; do { n = String(Math.floor(rnd(1, 60))); } while (used.has(n)); used.add(n); return n; };
    return [0, 1, 2].map(i => mate({ name: kidName(), num: num(), b: clamp(t.o + [0.05, 0.08, 0.12][i] + rnd(-0.02, 0.02), 0.3, 0.92), spd: rnd(0.4, 0.8) })); }
  function sign(d, fa, outIdx) { const L = d.roster.lineup; if (!L[outIdx] || L[outIdx].me) return false;
    L[outIdx] = Object.assign({}, fa); d.faUsed = d.season; d.fa = null; d.chem = clamp((d.chem == null ? 50 : d.chem) - 4, 20, 100); return true; }
  function moveSlot(d, i, dir) { const L = d.roster.lineup, j = i + dir; if (j < 0 || j > 8) return; [L[i], L[j]] = [L[j], L[i]]; d.player.slot = L.findIndex(x => x.me); }
  // best order: fastest good hitter leads off, best hitters 2-4, the rest by skill
  function bestOrder(d) { const L = d.roster.lineup.slice(), val = x => x.me ? myOrderB(d) : x.b, spd = x => x.me ? eff(d.player).spd / 100 : (x.spd2 || 50) / 100;
    L.sort((a, b) => val(b) - val(a)); const top = L.slice(0, 5); const lead = top.slice().sort((a, b) => (spd(b) + val(b)) - (spd(a) + val(a)))[0];
    const rest = L.filter(x => x !== lead); d.roster.lineup.splice(0, 9, ...[lead].concat(rest)); d.player.slot = d.roster.lineup.findIndex(x => x.me); }
  // career milestones
  const MILES = [['h', [1, 10, 25, 50, 100, 200, 300], n => n === 1 ? 'First career hit!' : n + ' career hits'], ['hr', [1, 5, 10, 25, 50, 100], n => n === 1 ? 'First career home run!' : n + ' career home runs'],
    ['rbi', [10, 25, 50, 100, 200], n => n + ' career RBI'], ['gem', [1, 5, 10, 25, 50], n => n === 1 ? 'First web gem!' : n + ' web gems'], ['pK', [1, 10, 25, 50, 100, 200], n => n === 1 ? 'First career strikeout as a pitcher!' : n + ' career strikeouts (pitching)'],
    ['g', [10, 25, 50, 100, 200], n => n + ' career games']];
  function milestones(before, after) { const out = []; MILES.forEach(([k, steps, txt]) => steps.forEach(n => { if ((before[k] || 0) < n && (after[k] || 0) >= n) out.push(txt(n)); })); return out; }
  // after his game: the rest of the week, stats, skill points
  function finishGame(d, G) {
    const won = (G.usHome ? G.score.h > G.score.a : G.score.a > G.score.h), m = G.my;
    const pg = G.pit && G.pit.bf ? G.pit : null;
    const potg = m.hr >= 1 || m.h >= 3 || m.rbi >= 3 || (won && (m.h >= 2 || m.gem >= 1)) || (pg && (pg.k >= 8 || (won && pg.outs >= 12 && pg.r <= 1)));
    m.g = 1; m.potg = potg ? 1 : 0;
    if (G.pit && G.pit.bf) { m.pit = G.pit; const add = (t) => { t.pG = (t.pG || 0) + 1; t.pOuts = (t.pOuts || 0) + G.pit.outs; t.pK = (t.pK || 0) + G.pit.k; t.pBB = (t.pBB || 0) + G.pit.bb; t.pH = (t.pH || 0) + G.pit.h; t.pR = (t.pR || 0) + G.pit.r; t.pPC = (t.pPC || 0) + G.pit.pc; }; add(d.stats); add(d.career); }
    const before = Object.assign({}, d.career, { pK: (d.career.pK || 0) - (pg ? pg.k : 0) });
    for (const k in m) { if (k === 'pit') continue; d.stats[k] = (d.stats[k] || 0) + m[k]; d.career[k] = (d.career[k] || 0) + m[k]; }
    const miles = milestones(before, d.career); if (!d.miles) d.miles = []; miles.forEach(t => d.miles.push({ t, season: d.season }));
    d.chem = clamp((d.chem == null ? 50 : d.chem) + (won ? 3 : -1) + (won && G.playoff ? 3 : 0), 20, 100);
    const prog = progress(d, m, won, potg);
    const sp = prog.tp;
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
    return { won, sp, potg, res, prog, miles };
  }
  // XP from what he actually did; abilities grow on their own, levels give Training Points he spends himself
  function progress(d, m, won, potg) {
    const p = d.player, lv = d.player.level || 1, mult = 1 + 0.15 * (lv - 1), out = { gains: {}, ups: [], lvlUps: 0, tp: 0, perks: [], xp: 0 };
    const k = (m.k || 0), po = m.po || 0, as = m.as || 0, nonK = Math.max(0, m.ab - k);
    const pt = m.pit || null, pk = pt ? pt.k : 0, po2 = pt ? pt.outs : 0;
    const raw = { vel: pt ? 9 * pk + 2 * po2 : 0, brk: pt ? 7 * pk + 2 * po2 : 0, ctl: pt ? 4 * po2 + (pt.bb === 0 && po2 >= 6 ? 20 : 0) - 0 : 0, sta: pt ? Math.round(pt.pc / 2) : 0, con: 10 * m.h + 3 * nonK, vis: 8 * m.h + 6 * m.bb + 2 * m.ab, pow: 14 * (m.d + m.t) + 35 * m.hr + 2 * m.h, eye: 16 * m.bb + 3 * nonK, clu: 15 * (m.rh || 0) + 6 * m.rbi,
      spd: 12 * m.r + 12 * m.t + 3, rea: 10 * po + 8 * as + 15 * m.gem + 3, fld: 12 * po + 8 * as + 15 * m.gem, arm: 14 * as, acc: as && !m.e ? 12 * as : 0 };
    for (const a in raw) { if (['vel', 'ctl', 'brk', 'sta'].includes(a) && d.player.pos !== 'P' && !raw[a]) continue; const g = Math.round((raw[a] + 5) * mult); out.gains[a] = g; out.xp += g; p.xp[a] = (p.xp[a] || 0) + g;
      while (p.a[a] < 99 && p.xp[a] >= xpNeed(p.a[a])) { p.xp[a] -= xpNeed(p.a[a]); p.a[a]++; out.ups.push(a); } if (p.a[a] >= 99) p.xp[a] = 0; }
    out.xp += (won ? 40 : 0) + (potg ? 40 : 0);
    p.lxp += out.xp; while (p.lxp >= lvlNeed(p.lvl)) { p.lxp -= lvlNeed(p.lvl); p.lvl++; out.lvlUps++;
      PERKS.filter(x => x.lvl === p.lvl).forEach(x => { if (!p.perks.owned.includes(x.id)) { p.perks.owned.push(x.id); out.perks.push(x.id); if (p.perks.on.length < slots(p.lvl)) p.perks.on.push(x.id); } }); }
    out.tp = 1 + (won ? 1 : 0) + (potg ? 1 : 0) + out.lvlUps * 3; p.sp += out.tp;
    return out;
  }
  // real practice pays off: training days, drills and tests in the hub give his player XP (and training points for full training days)
  const PRAC_SES = { A: { con: 40, pow: 40, vis: 20 }, B: { fld: 35, arm: 30, acc: 25, con: 15 }, C: { spd: 40, rea: 30, vis: 15 } };
  const PRAC_GAME = { derby: { pow: 20, con: 10 }, streak: { con: 20, vis: 10 }, kking: { arm: 15, acc: 15 }, steal: { spd: 25 }, outfield: { fld: 15, rea: 15 }, pitchrec: { vis: 15, eye: 15 }, brain: { clu: 15, eye: 10 } };
  const PRAC_TEST = { velo: { arm: 20 }, speed: { spd: 20 }, strength: { pow: 15 } };
  const GAMENAME = { derby: 'Home Run Derby', streak: 'Hit Streak', kking: 'Strikeout King', steal: 'Steal Second', outfield: 'Outfield Hero', pitchrec: 'Pitch Reader', brain: 'Baseball Brain' };
  function practice(d, entries, now) {
    now = now || Date.now(); const p = d.player;
    if (!d.prac) d.prac = { seen: now - 7 * 864e5, days: {}, done: [] }; if (!d.prac.done) d.prac.done = [];
    const doneSet = new Set(d.prac.done), from = now - 7 * 864e5;
    const out = { tp: 0, gains: {}, ups: [], items: [], lvlUps: 0 };
    // anything from the last 7 days not counted yet (works even if it was saved offline and arrives late)
    const list = (entries || []).filter(e => e && (e.ts || 0) > Math.min(d.prac.seen, from) && (e.ts || 0) > from && (e.ts || 0) <= now + 6e4 && !doneSet.has(e.kind + ':' + e.ts)).sort((a, b) => a.ts - b.ts);
    const addXp = (g, mult) => { for (const a in g) { const v = Math.round(g[a] * (mult || 1)); out.gains[a] = (out.gains[a] || 0) + v; p.xp[a] = (p.xp[a] || 0) + v;
        while (p.a[a] < 99 && p.xp[a] >= xpNeed(p.a[a])) { p.xp[a] -= xpNeed(p.a[a]); p.a[a]++; out.ups.push(a); } p.lxp += v; } };
    for (const e of list) { d.prac.done.push(e.kind + ':' + e.ts); const day = e.date || '', rec = d.prac.days[day] || (d.prac.days[day] = { ses: 0, arc: 0, test: 0 });
      if (e.kind === 'session' && e.complete && PRAC_SES[e.slot] && !rec.ses) { rec.ses = 1; addXp(PRAC_SES[e.slot]); out.tp += 2; out.items.push('Training day ' + e.slot + ': +2 training points'); }
      else if (e.kind === 'arcade' && PRAC_GAME[e.game] && rec.arc < 4) { rec.arc++; addXp(PRAC_GAME[e.game]); out.items.push(GAMENAME[e.game] + ' drill'); }
      else if (PRAC_TEST[e.kind] && !rec.test) { rec.test = 1; addXp(PRAC_TEST[e.kind]); out.tp += 1; out.items.push((e.kind === 'velo' ? 'Throwing velocity' : e.kind === 'speed' ? 'Speed' : 'Strength') + ' test: +1 training point'); } }
    d.prac.seen = Math.max(d.prac.seen, now); if (d.prac.done.length > 300) d.prac.done = d.prac.done.slice(-300);
    // keep the day log short
    const keys = Object.keys(d.prac.days).sort(); if (keys.length > 40) keys.slice(0, keys.length - 40).forEach(k => delete d.prac.days[k]);
    while (p.lxp >= lvlNeed(p.lvl)) { p.lxp -= lvlNeed(p.lvl); p.lvl++; out.lvlUps++; out.tp += 3;
      PERKS.filter(x => x.lvl === p.lvl).forEach(x => { if (!p.perks.owned.includes(x.id)) { p.perks.owned.push(x.id); if (p.perks.on.length < slots(p.lvl)) p.perks.on.push(x.id); } }); }
    p.sp += out.tp;
    return out.items.length ? out : null;
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
  const SIM = { chemB, freeAgents, sign, moveSlot, bestOrder, milestones, gameFor, pitchSkill, pitchLimit, startPitching, pitchApply, simPitch, ipStr, groupsFor, practice, eff, progress, promo, TIERS, PERKS, ATTR, xpNeed, lvlNeed, slots, fixUp, oppTurn, applyField, whereTo, newDynasty, newGame, nextGame, apply, simOne, simAB, curBatter, battingUs, finishGame, standings, record, quickGame, newSeason, awards, ovr, paOdds, avg, obp, slg, blank, TEAMS };

  /* ================= screens ================= */
  function E(tag, attrs) { const n = document.createElement(tag); if (attrs) for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'html') n.innerHTML = v; else n.setAttribute(k, v === true ? '' : v); }
    const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else n.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }; for (let i = 2; i < arguments.length; i++) add(arguments[i]); return n; }
  const TEST = typeof location !== 'undefined' && /d3test/.test(location.search);

  function start(H) {
    const ui = H.open('Road to the Show', 'Your player · your season');
    const root = E('div', { class: 'dyn' }); ui.stage.classList.add('dynstage'); ui.stage.replaceChildren(root);
    let d = null, pracNote = null; try { d = H.load(); if (d && d.player) { SIM.fixUp(d); pracNote = SIM.practice(d, H.entries || []); if (pracNote) H.save(d); } } catch (e) { d = null; }
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
          E('div', { class: 'dynfield' }, E('span', { class: 'dynlab' }, 'Player type'), E('div', { class: 'dynarch five' }, Object.keys(ARCH).map(k => E('button', { type: 'button', 'aria-pressed': String(p.arch === k), class: p.arch === k ? 'on' : '', onclick: () => { p.arch = k; tick(); paint(); } },
            E('b', null, ARCH[k].name), E('span', null, ARCH[k].blurb))))),
          bars(a, true, p.pos),
          sw('Skin', SKIN, 'skin'), sw('Hair', HAIR, 'hair'), sw('Helmet', HELMET, 'helm'),
          seg('Difficulty', [[1, 'Rookie'], [2, 'Pro'], [3, 'All-Star']], 'level', paint),
          E('button', { type: 'button', class: 'dynbig', id: 'dyn-create', onclick: () => {
            p.a = Object.assign({}, ARCH[p.arch].a); p.name = p.first; d = SIM.newDynasty(p); SIM.fixUp(d); pracNote = SIM.practice(d, H.entries || []); save(); H.Sound.cheer && H.Sound.cheer(); hub(); } }, 'Start my career'));
      }
      show(E('div', { class: 'dynhead' }, E('p', { class: 'dynkick' }, 'Road to the Show'), E('h1', null, 'Create your player'), E('p', { class: 'dynsub' }, 'Drag the 3D player to spin him around.')),
        E('div', { class: 'dyncreate' }, box, form));
      paint(); mount3d(box, p); status('Create your player.');
    }

    /* ---------- highlights ---------- */
    const HLKEY = 'dh_hl';
    const hlAll = () => { try { return JSON.parse(localStorage.getItem(HLKEY) || '[]'); } catch (e) { return []; } };
    const hlSave = a => { for (let n = a.length; n >= 0; n--) { try { localStorage.setItem(HLKEY, JSON.stringify(a.slice(-n))); return; } catch (e) {} } };
    let hlCand = null;
    // which moments are worth a photo: his hits, his catches and outs, his strikeouts on the mound
    function hlArm(kind) { hlCand = null;
      const want = { bat: /HOME RUN|GRAND SLAM|TRIPLE|DOUBLE|SINGLE|HIT!/i, field: /DIVING|CAUGHT|SNAGGED|OUT!|DOUBLE PLAY|CAUGHT STEALING|GOT HIM/i, pitch: /STRIKE THREE/i }[kind];
      const rank = t => /HOME RUN|GRAND SLAM|DIVING/i.test(t) ? 3 : /TRIPLE|DOUBLE|STRIKE THREE|CAUGHT|OUT!/i.test(t) ? 2 : 1;
      window.__dhHL = (main) => !!want && want.test(String(main || '')) && (!hlCand || rank(main) >= hlCand.rank);
      window.__dhHLimg = (img, main, sub) => { if (!img) return; const r = rank(main); if (!hlCand || r >= hlCand.rank) hlCand = { img, main, sub: sub || '', rank: r }; }; }
    function hlDisarm() { window.__dhHL = null; window.__dhHLimg = null; }
    // after the play is in the books: keep the photo with the play-by-play line
    function hlKeep() { const c = hlCand; hlCand = null; if (!c || !G) return; if (!G.gid) G.gid = Date.now();
      const opp = team(d, G.opp), all = hlAll(), mine = all.filter(h => h.gid === G.gid).length; if (mine >= 5) return;
      all.push({ gid: G.gid, img: c.img, title: c.main.replace(/!+$/, '!'), line: ((G.feed.find(f => f.me) || G.feed[0] || {}).t) || c.sub, inn: (G.top ? 'Top ' : 'Bot ') + G.inn, vs: (G.usHome ? 'vs ' : '@ ') + opp.short, season: d.season, ts: Date.now() });
      hlSave(all.slice(-24)); }
    function hlStrip(list, big) { return E('div', { class: 'dynhl' + (big ? ' big' : '') }, list.map(h => E('figure', { tabindex: '0', onclick: e => e.currentTarget.classList.toggle('open') },
      E('img', { src: h.img, alt: h.title + '. ' + h.line, loading: 'lazy' }), E('figcaption', null, E('b', null, h.title), E('span', null, h.line), E('em', null, 'Season ' + h.season + ' · ' + h.vs + ' · ' + h.inn))))); }

    /* ---------- team: batting order, chemistry, free agents ---------- */
    function teamScreen() {
      stop3d(); const L = d.roster.lineup, live = !!(d.live && d.live.g), canSign = !!(d.fa && d.fa.length && d.week === 0 && !live && d.faUsed !== d.season);
      let pickFA = null;
      const chem = d.chem == null ? 50 : d.chem, chemTxt = chem >= 80 ? 'On fire' : chem >= 65 ? 'Clicking' : chem >= 45 ? 'Getting there' : 'Still gelling';
      const body = E('div', { class: 'dynteamwrap' });
      const val = x => x.me ? Math.round(SIM.ovr(d.player.a, d.player.pos)) : Math.round(((x.con || 50) + (x.pow || 50) + (x.spd2 || 50)) / 3);
      function paint() {
        const weakest = L.reduce((w, x, i) => !x.me && (w < 0 || x.b < L[w].b) ? i : w, -1);
        body.replaceChildren(
          E('section', { class: 'dynbox' }, E('h2', null, 'Team chemistry'), E('div', { class: 'dynpc' + (chem < 45 ? ' tired' : ''), role: 'img', 'aria-label': 'Chemistry ' + chem + ' of 100' }, E('span', null, chemTxt.toUpperCase()), E('i', null, E('em', { style: 'width:' + chem + '%' })), E('b', null, chem)),
            E('p', { class: 'dynsub' }, 'Wins build it (+3, playoff wins +6). Losses cost 1, a new signing costs 4. High chemistry helps your teammates hit.')),
          canSign ? E('section', { class: 'dynbox sign' }, E('h2', null, pickFA ? 'Who sits for ' + pickFA.name.split(' ')[0] + '?' : 'Offseason: sign one player'),
            pickFA ? E('p', { class: 'dynsub' }, 'Tap Swap on the teammate he replaces. The weakest hitter is marked.') : E('div', { class: 'dynfa' }, d.fa.map(f => E('button', { type: 'button', class: 'dynfacard', onclick: () => { tick(); pickFA = f; paint(); } },
              E('b', null, '#' + f.num + ' ' + f.name), E('span', null, 'Contact ' + f.con + ' · Power ' + f.pow + ' · Speed ' + f.spd2), E('em', null, 'Sign')))),
            pickFA ? E('button', { type: 'button', class: 'dynlink', onclick: () => { pickFA = null; paint(); } }, 'Pick a different player') : null) : null,
          E('section', { class: 'dynbox' }, E('h2', null, 'Batting order'), live ? E('p', { class: 'dynsub' }, 'A game is in progress. Finish it to change the order.') : null,
            E('ol', { class: 'dynorder' }, L.map((x, i) => E('li', { class: (x.me ? 'me ' : '') + (pickFA && i === weakest ? 'weak' : '') },
              E('span', { class: 'n' }, i + 1), E('div', { class: 'who' }, E('b', null, '#' + (x.me ? d.player.num : x.num) + ' ' + (x.me ? d.player.first + ' (you)' : x.name)),
                E('span', null, x.me ? 'OVR ' + val(x) + ' · ' + POSNAME[d.player.pos] : 'Contact ' + x.con + ' · Power ' + x.pow + ' · Speed ' + x.spd2)),
              pickFA ? (x.me ? E('span') : E('button', { type: 'button', class: 'dynghost sm', onclick: () => { tick(); SIM.sign(d, pickFA, i); pickFA = null; save(); H.Sound.cheer && H.Sound.cheer(); teamScreen(); status('Signed! Welcome to the Spitters.'); } }, 'Swap'))
                : E('div', { class: 'ud' }, E('button', { type: 'button', class: 'dynghost sm', 'aria-label': 'Move up', disabled: live || i === 0, onclick: () => { SIM.moveSlot(d, i, -1); save(); paint(); } }, '▲'),
                  E('button', { type: 'button', class: 'dynghost sm', 'aria-label': 'Move down', disabled: live || i === 8, onclick: () => { SIM.moveSlot(d, i, 1); save(); paint(); } }, '▼'))))),
            live ? null : E('button', { type: 'button', class: 'dynghost', id: 'dyn-best', onclick: () => { tick(); SIM.bestOrder(d); save(); paint(); status('Lineup set: best hitters at the top.'); } }, 'Set the best order for me')));
      }
      paint();
      show(E('div', { class: 'dynhead' }, E('p', { class: 'dynkick' }, 'Season ' + d.season + ' · ' + TIERS[d.tier].name), E('h1', null, 'Your team')), body, E('button', { type: 'button', class: 'dynbig', onclick: () => { tick(); hub(); } }, 'Done'));
      status(canSign ? 'Offseason. Sign one free agent.' : 'Batting order and team chemistry.');
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
          E('p', { class: 'dynsub' }, (home ? 'Home at Seed Spitters Park' : 'Road game') + ' · ' + ((d.opts && d.opts.inn) || 7) + ' innings · you bat ' + ord(p.slot + 1)),
          E('button', { type: 'button', class: 'dynbig', id: 'dyn-play', onclick: () => { tick(); if (d.live && d.live.g) { G = d.live.g; game(); } else { G = SIM.gameFor(d, nx.g, nx.playoff); G.gid = Date.now(); setupMine(); d.live = { g: G }; save(); game(); } } }, d.live && d.live.g ? 'Resume game' : 'Play ball'),
          E('button', { type: 'button', class: 'dynghost', onclick: () => { if (busy) return; G = d.live && d.live.g ? d.live.g : SIM.gameFor(d, nx.g, nx.playoff); setupMine(); simWhole(); } }, 'Sim this game'),
          E('button', { type: 'button', class: 'dynlink', id: 'dyn-team', onclick: () => { tick(); teamScreen(); } }, 'Lineup and team'));
      } else nextCard = seasonOver();
      show(
        E('div', { class: 'dynhead row' }, E('div', null, E('p', { class: 'dynkick' }, 'Season ' + d.season + ' · ' + TIERS[d.tier].name), E('h1', { class: 'dynteam' }, E('span', { class: 'script' }, 'Spitters'), E('b', null, rec.w + '–' + rec.l)), E('p', { class: 'dynsub' }, ord(place) + ' place' + (d.po ? (d.po.done ? '' : ' · in the playoffs!') : ' · top 4 make the playoffs'))),
          E('div', { class: 'dynsp' }, E('b', null, p.sp), E('span', null, 'training pts'))),
        ladder(),
        d.fa && d.fa.length && d.week === 0 && !(d.live && d.live.g) && d.faUsed !== d.season ? E('section', { class: 'dynprac offs' }, E('p', { class: 'dynkick' }, 'OFFSEASON'), E('h2', null, '3 free agents want to join the Spitters'),
          E('p', { class: 'dynsub' }, 'Sign one before the season starts. Best one: Contact ' + Math.max(...d.fa.map(f => f.con)) + ', Power ' + Math.max(...d.fa.map(f => f.pow)) + '.'), E('button', { type: 'button', class: 'dynghost', id: 'dyn-sign', onclick: () => { tick(); teamScreen(); } }, 'See the free agents')) : null,
        pracNote ? E('section', { class: 'dynprac', role: 'status' }, E('p', { class: 'dynkick' }, 'REAL PRACTICE PAID OFF'),
          E('h2', null, (pracNote.tp ? '+' + pracNote.tp + ' training points · ' : '') + Object.values(pracNote.gains).reduce((a, b) => a + b, 0) + ' XP'),
          E('p', { class: 'dynsub' }, pracNote.items.slice(0, 6).join(' · ') + (pracNote.items.length > 6 ? ' · and more' : '')),
          pracNote.ups.length ? E('p', { class: 'dynsub gold' }, 'Ability up: ' + [...new Set(pracNote.ups)].map(k => ATTR.find(x => x[0] === k)[1]).join(', ')) : null,
          E('button', { type: 'button', class: 'dynlink', onclick: () => { pracNote = null; hub(); } }, 'Got it')) : null,
        E('div', { class: 'dynhub' }, nextCard,
          E('section', { class: 'dyncard' }, box, E('div', { class: 'dynovr' }, E('b', null, SIM.ovr(p.a, p.pos)), E('span', null, 'OVR')),
            E('div', { class: 'dynplate' }, E('b', null, '#' + p.num + ' ' + p.first.toUpperCase()), E('span', null, POSNAME[p.pos] + ' · ' + ARCH[p.arch].name + ' · Bats ' + (p.bats === 'L' ? 'left' : 'right') + ', throws ' + (p.throws === 'R' ? 'right' : 'left'))),
            lvlBar(p),
            p.perks.on.length ? E('p', { class: 'dynperkline' }, p.perks.on.map(id => E('span', null, '★ ' + PERKS.find(x => x.id === id).name))) : null,
            bars(p.a, false, p.pos),
            E('button', { type: 'button', class: 'dynghost', id: 'dyn-up', onclick: () => { tick(); upgrade(); } }, p.sp ? 'Train and upgrade (' + p.sp + ' points)' : 'Train and upgrade')),
          E('div', { class: 'dyncol' },
            E('section', { class: 'dynbox' }, E('h2', null, 'Your season'), E('div', { class: 'dynstats' },
              [['AVG', fmt3(SIM.avg(s))], ['HR', s.hr], ['RBI', s.rbi], ['H', s.h], ['R', s.r], ['BB', s.bb], ['OPS', fmt3(SIM.obp(s) + SIM.slg(s))], ['WEB GEMS', s.gem]].concat(s.pOuts ? [['IP', SIM.ipStr(s.pOuts)], ['K', s.pK], ['ERA', (s.pR * (d.opts.inn || 7) * 3 / s.pOuts).toFixed(2)], ['WALKS', s.pBB]] : []).map(([k, v]) => E('div', null, E('b', null, v), E('span', null, k))))),
            E('section', { class: 'dynbox' }, E('h2', null, 'Game settings'),
              setRow('Batting', 'bat', [['team', 'Whole team'], ['me', 'Just me']]), setRow('Fielding', 'field', [['on', 'Play my position'], ['off', 'Sim my fielding']]), setRow('Game length', 'inn', [[3, '3 innings'], [5, '5 innings'], [7, '7 innings']])),
            hlAll().length ? E('section', { class: 'dynbox' }, E('h2', null, 'Highlight reel'), hlStrip(hlAll().slice(-6).reverse(), false)) : null,
            E('section', { class: 'dynbox' }, E('h2', null, 'Standings'), standTable(st)),
            d.trophies.length || d.seasons.length || (d.miles && d.miles.length) ? E('section', { class: 'dynbox' }, E('h2', null, 'Trophy case'), E('ul', { class: 'dyntro' }, d.trophies.map(t => E('li', null, (t.kind === 'champ' ? '🏆 ' : '🏅 ') + t.text)), (d.miles || []).slice(-6).reverse().map(m => E('li', { class: 'mile' }, '⭐ ' + m.t + ' (Season ' + m.season + ')')), d.seasons.map(x => E('li', { class: 'mid' }, 'Season ' + x.season + (x.tier != null ? ' (' + TIERS[x.tier].short + ')' : '') + ': ' + x.rec.w + '–' + x.rec.l + ' · hit ' + fmt3(SIM.avg(x.stats)) + ', ' + x.stats.hr + ' HR')))) : null,
            E('button', { type: 'button', class: 'dynlink', onclick: () => { if (confirmReset()) { d = null; save(); create(); } } }, 'Start a new career'))));
      mount3d(box, p); status('Season ' + d.season + '. ' + rec.w + ' wins, ' + rec.l + ' losses.');
    }
    function setRow(label, key, opts) { return E('div', { class: 'dynfield' }, E('span', { class: 'dynlab' }, label), E('div', { class: 'dynseg', role: 'radiogroup', 'aria-label': label },
      opts.map(([v, t]) => E('button', { type: 'button', role: 'radio', 'aria-checked': String(d.opts[key] === v), class: d.opts[key] === v ? 'on' : '', onclick: () => { d.opts[key] = v; if (d.live && d.live.g && key === 'field') d.live.g.fieldOn = v !== 'off'; tick(); save(); hub(); } }, t)))); }
    function bars(a, small, pos) { return E('div', { class: 'dynbars' + (small ? ' sm' : '') }, SIM.groupsFor(pos).map(g => [E('p', { class: 'dyngrp' }, g), ATTR.filter(x => x[3] === g).map(([k, n]) => E('div', { class: 'dynbar' }, E('span', null, n), E('i', null, E('em', { style: 'width:' + a[k] + '%' })), E('b', null, a[k])))])); }
    function ladder() { return E('ol', { class: 'dynladder', 'aria-label': 'Career path' }, TIERS.map((t, i) => E('li', { class: i < d.tier ? 'done' : i === d.tier ? 'now' : '' }, t.short))); }
    function lvlBar(p) { const need = SIM.lvlNeed(p.lvl); return E('div', { class: 'dynlvl' }, E('b', null, 'LVL ' + p.lvl), E('i', null, E('em', { style: 'width:' + Math.round(100 * p.lxp / need) + '%' })), E('span', null, p.lxp + ' / ' + need + ' XP')); }
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
        (() => { const pr = SIM.promo(d); return pr.top ? E('p', { class: 'dynpromo up' }, '⭐ You made it to The Show!')
          : pr.up ? E('p', { class: 'dynpromo up' }, '📈 CALLED UP! Next season: ' + pr.next.name + ' (' + pr.why + ')')
          : E('p', { class: 'dynpromo' }, 'Reach OVR ' + pr.need + ' (you\u2019re ' + SIM.ovr(d.player.a, d.player.pos) + '), win the title or be MVP to move up to ' + pr.next.name + '. Another season at this level.'); })(),
        E('button', { type: 'button', class: 'dynbig', id: 'dyn-next-season', onclick: () => { aw.forEach(a => d.trophies.push({ kind: 'award', season: d.season, text: 'Season ' + d.season + ' ' + a })); const pr = SIM.newSeason(d); if (pr.up) d.trophies.push({ kind: 'award', season: d.season - 1, text: 'Called up to ' + TIERS[d.tier].name }); d.player.sp += 3; save(); hub(); } }, 'Start Season ' + (d.season + 1)));
    }

    /* ---------- upgrades ---------- */
    function upgrade() {
      stop3d(); const p = d.player;
      const body = E('div', { class: 'dynup' }), hd = E('div');
      const head = () => hd.replaceChildren(E('p', { class: 'dynkick' }, 'Training'), E('h1', null, 'OVR ' + SIM.ovr(p.a, p.pos) + ' · ', E('span', { class: 'gold' }, p.sp + ' training points')), lvlBar(p),
        E('p', { class: 'dynsub' }, 'Every ability also grows on its own from how you play: hits build Contact, homers build Power, walks build Discipline, plays in the field build Fielding and Reaction, throw-outs build your Arm. Level up for more training points and new perks.'));
      const paint = () => { const slotsN = SIM.slots(p.lvl);
        body.replaceChildren(
          ...SIM.groupsFor(p.pos).map(g => E('section', { class: 'dyngroup' }, E('h2', null, g), ...ATTR.filter(x => x[3] === g).map(([k, n, why]) => { const v = p.a[k], c = cost(v), can = p.sp >= c && v < 99, xp = p.xp[k] || 0, need = SIM.xpNeed(v);
            return E('div', { class: 'dynuprow' }, E('div', null, E('b', null, n), E('span', null, why)),
              E('div', { class: 'dynbar wide' }, E('i', null, E('em', { style: 'width:' + v + '%' })), E('b', null, v), E('i', { class: 'xp', title: xp + ' of ' + need + ' XP to the next point' }, E('em', { style: 'width:' + Math.round(100 * xp / need) + '%' }))),
              E('button', { type: 'button', class: 'dynplus', disabled: !can, 'aria-label': 'Add 1 to ' + n + ' for ' + c + ' points', onclick: () => { p.sp -= c; p.a[k] = Math.min(99, v + 1); tick(); save(); paint(); head(); } }, '+1', E('small', null, c + ' pt' + (c > 1 ? 's' : '')))); }))),
          E('section', { class: 'dyngroup' }, E('h2', null, 'Perks · ' + p.perks.on.length + ' of ' + slotsN + ' equipped'),
            E('p', { class: 'dynsub' }, slotsN === 0 ? 'Your first perk slot opens at level 2.' : 'Tap a perk to put it on or take it off. More slots at levels 10 and 20.'),
            E('div', { class: 'dynperks' }, PERKS.map(k => { const own = p.perks.owned.includes(k.id), on = p.perks.on.includes(k.id);
              return E('button', { type: 'button', class: 'dynperk' + (on ? ' on' : '') + (own ? '' : ' locked'), disabled: !own, 'aria-pressed': String(on), onclick: () => {
                if (on) p.perks.on = p.perks.on.filter(x => x !== k.id); else if (p.perks.on.length < slotsN) p.perks.on.push(k.id); else { p.perks.on.shift(); p.perks.on.push(k.id); }
                tick(); save(); paint(); } }, E('b', null, (on ? '★ ' : '') + k.name), E('span', null, own ? k.d : 'Unlocks at level ' + k.lvl)); }))));
      };
      head(); paint();
      show(E('div', { class: 'dynhead' }, hd), body, E('button', { type: 'button', class: 'dynbig', onclick: () => { tick(); hub(); } }, 'Done'));
      status(p.sp + ' training points to spend.');
    }

    /* ---------- the game ---------- */
    function setupMine() { const a = SIM.eff(d.player, false); G.fieldOn = d.opts.field !== 'off'; G.mePos = G.pit && G.pit.pulled ? '1B' : d.player.pos; G.myFld = a.fld / 100; G.myArm = a.arm / 100; G.mySpd = a.spd / 100; }
    function lineScore() {
      const A = team(d, G.away), Hm = team(d, G.home), n = Math.max(G.len || 7, G.inn);
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
      if (G.pend && G.pend.kind === 'pitch') {   // he's on the mound
        const P = G.pit, left = P.limit - P.pc, tired = left <= 15;
        action = E('section', { class: 'dynup2 def' }, E('p', { class: 'dynkick' }, 'YOU’RE PITCHING · ' + SIM.ipStr(P.outs) + ' IP · ' + P.k + ' K'), E('h2', null, 'vs ' + bat.name.toUpperCase()),
          E('p', { class: 'dynsit' }, sit),
          E('p', { class: 'dynsub' }, 'Bats ' + (bat.bats === 'L' ? 'left' : 'right') + ' · Contact ' + bat.con + ' · Power ' + bat.pow),
          E('div', { class: 'dynpc' + (tired ? ' tired' : ''), role: 'img', 'aria-label': 'Pitch count ' + P.pc + ' of ' + P.limit },
            E('span', null, 'PITCH COUNT'), E('i', null, E('em', { style: 'width:' + Math.min(100, P.pc / P.limit * 100) + '%' })), E('b', null, P.pc + ' / ' + P.limit)),
          tired ? E('p', { class: 'dynsub' }, 'Your arm is getting tired. About ' + Math.max(0, left) + ' pitches left before Coach comes out.') : null,
          E('div', { class: 'dynbtns three' }, E('button', { type: 'button', class: 'dynbig', id: 'dyn-pitch', onclick: () => { tick(); pitch3d(sit); } }, '🔥 Pitch'),
            E('button', { type: 'button', class: 'dynghost', id: 'dyn-simpitch', onclick: () => { tick(); G.pend = null; SIM.simPitch(G, d); afterPlay(); } }, 'Sim this batter'),
            E('button', { type: 'button', class: 'dynghost', id: 'dyn-simout', onclick: () => { tick(); G.pend = null; let n = 0; const half0 = G.top; while (G.pit.on && !G.over && G.top === half0 && n++ < 40) SIM.simPitch(G, d); afterPlay(); } }, 'Sim this inning')));
      } else if (G.pend) {   // the ball is coming to him
        const pl = G.pend, steal = pl.kind === 'steal';
        action = E('section', { class: 'dynup2 def' }, E('p', { class: 'dynkick' }, 'DEFENSE · ' + POSNAME[G.mePos || d.player.pos].toUpperCase()), E('h2', null, steal ? 'HE’S RUNNING!' : 'HIT TO YOU!'),
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
      } else action = E('section', { class: 'dynup2 calm' }, E('p', { class: 'dynkick' }, us ? 'SPITTERS BATTING' : opp.short.toUpperCase() + ' BATTING'), E('p', { class: 'dynsub' }, 'Now batting: ' + bat.name + ' · ' + (us ? 'Pitching: ' + G.them.pitcher : (G.pit && G.pit.on ? 'You’re pitching · ' + G.pit.pc + ' pitches' : 'You’re in ' + POSNAME[G.mePos || d.player.pos].toLowerCase()))),
        E('div', { class: 'dynbtns three' }, E('button', { type: 'button', class: 'dynbig', id: 'dyn-go', onclick: () => { tick(); playOn(); } }, teamMode ? '▶ Play on' : '▶ Play to my next at-bat'),
          teamMode ? E('button', { type: 'button', class: 'dynghost', id: 'dyn-tome', onclick: () => { tick(); playOn('me'); } }, 'Sim to my at-bat') : null,
          E('button', { type: 'button', class: 'dynghost', onclick: () => { tick(); playOn('all'); } }, 'Sim to the end')));
      show(E('div', { class: 'dyngame' },
        E('div', { class: 'dynscore' }, E('div', { class: 'dynhalf' }, half, G.playoff ? E('em', null, G.playoff === 'final' ? 'CHAMPIONSHIP' : 'SEMIFINAL') : null), lineScore()),
        E('div', { class: 'dynmid' }, diamond(), E('div', { class: 'dynmidr' }, outsDots, E('div', { class: 'dynbig2' }, E('span', null, A.id + ' ' + G.score.a), E('span', null, Hm.id + ' ' + G.score.h)))),
        action, feedList(), E('button', { type: 'button', class: 'dynlink', onclick: () => { save(); hub(); } }, 'Save and leave (pick up later)')));
      status(half + '. ' + (G.pend && G.pend.kind === 'pitch' ? 'You’re pitching to ' + bat.name + '.' : G.pend ? 'The ball is coming to you!' : ourTurn ? (bat.me ? 'You’re up!' : bat.name + ' is up. You’re batting for him.') : 'Now batting: ' + bat.name));
      if ((ourTurn && bat.me) || G.pend) { H.Sound.organ && !TEST && H.Sound.organ(); }
    }
    function sitLine(down) {
      const b = G.bases, on = ['1st', '2nd', '3rd'].filter((_, i) => b[i]);
      return (G.top ? 'Top ' : 'Bottom ') + G.inn + ' · ' + G.outs + ' out' + (G.outs === 1 ? '' : 's') + ' · ' + (on.length === 3 ? 'bases loaded' : on.length ? 'runner' + (on.length > 1 ? 's' : '') + ' on ' + on.join(' & ') : 'nobody on') + ' · ' + (down === 0 ? 'tied ' + G.score.h + '–' + G.score.a : (down > 0 ? 'up ' : 'down ') + Math.max(G.score.h, G.score.a) + '–' + Math.min(G.score.h, G.score.a));
    }
    const simMate = bat => { const o = SIM.paOdds(bat.b + SIM.chemB(d), team(d, G.opp).p); let r = Math.random(), k; for (k in o) { r -= o[k]; if (r <= 0) return k; } return 'GO'; };
    function simField() { const pl = G.pend, bat = SIM.curBatter(G); if (!pl) return; G.pend = null;
      if (pl.kind === 'pitch') { SIM.simPitch(G, d); return; }
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
      const back = res => { stop3d(); hlDisarm(); ui.stage.classList.remove('cvstage'); const bat = SIM.curBatter(G);
        if (!res || !G || bat !== hitterNow) { hlCand = null; return game(); }
        SIM.apply(G, res.code, bat, { out: res.out, text: res.text, looking: /looking/i.test(res.text || '') }); if (isMe) hlKeep(); else hlCand = null; afterMine(res.code); };
      if (isMe) hlArm('bat'); else hlDisarm();
      const who = isMe ? meFor(p) : { name: hitterNow.name.split(' ')[0], num: hitterNow.num, bats: hitterNow.bats === 'L' ? 'left' : 'right', gear: {} };
      const rr = isMe ? SIM.eff(p, !!(G.bases[1] || G.bases[2])) : { con: hitterNow.con, vis: hitterNow.con, pow: hitterNow.pow, spd: hitterNow.spd2 };
      load3d().then(m => { if (!host.isConnected) return;
        try { const g = m.atbat({ stage: host, level: p.level || 1, me: who, Sound: H.Sound, still: H.still, say: t => status(t), end: () => {}, ab: { r: rr, sit: sitObj, skin: SKIN[isMe ? p.skin : hitterNow.skin], hair: HAIR[isMe ? p.hair : hitterNow.hair], onDone: res => setTimeout(() => back(res), 0) } }); card = g; H.setLive(g); }
        catch (e) { back(null); } })
        .catch(() => { ui.stage.classList.remove('cvstage'); const c = isMe ? SIM.simAB(G, d) : simMate(hitterNow); SIM.apply(G, c, hitterNow); afterMine(c); });
    }
    // pitching to one batter, in 3D (Strikeout King engine)
    function pitch3d(sit) {
      stop3d(); const opp = team(d, G.opp), p = d.player, bat = SIM.curBatter(G), a = SIM.eff(p, false);
      const host = E('div', { class: 'dyn3dab' }); root.replaceChildren(host); ui.stage.classList.add('cvstage');
      host.appendChild(E('div', { class: 'd3load' }, E('b', null, 'Taking the mound…'), E('i')));
      const st = sitFor(opp), score = st.us + ' ' + st.usR + ' · ' + st.them + ' ' + st.themR;
      const back = res => { stop3d(); hlDisarm(); ui.stage.classList.remove('cvstage'); if (!res || !G.pend || G.pend.kind !== 'pitch' || SIM.curBatter(G) !== bat) { hlCand = null; return game(); }
        G.pend = null; SIM.pitchApply(G, d, res.code, bat, { out: res.out, looking: !!res.looking }, res.pitches || 4); hlKeep(); afterPlay(); };
      hlArm('pitch');
      load3d().then(m => { if (!host.isConnected) return;
        try { const g = m.pitchPA({ stage: host, level: p.level || 1, me: meFor(p), Sound: H.Sound, still: H.still, say: t => status(t), end: () => {},
            pa: { sit: { score, half: (G.top ? 'TOP ' : 'BOT ') + G.inn, title: st.title, line: sit, outs: G.outs, on: G.bases.map(Boolean), inn: G.inn },
              batter: { name: bat.name, num: bat.num, hand: bat.bats === 'L' ? 'L' : 'R', contact: clamp(bat.con / 100, 0.35, 0.95), power: clamp(bat.pow / 100, 0.25, 0.95), eye: clamp(bat.b, 0.3, 0.85) },
              r: { vel: a.vel, ctl: a.ctl, brk: a.brk }, pc0: G.pit.pc, opp: { oc: opp.a, oj: opp.j, ol: st.ol }, throws: p.throws, skin: SKIN[p.skin], hair: HAIR[p.hair], onDone: res => setTimeout(() => back(res), 0) } });
          card = g; H.setLive(g); }
        catch (e) { try { console.error('pitch3d: ' + e.message + ' ' + String(e.stack).split('\n')[1]); } catch (x) {} back(null); } })
        .catch(() => { ui.stage.classList.remove('cvstage'); G.pend = null; SIM.simPitch(G, d); afterPlay(); });
    }
    // a play in the field, in 3D
    function field3d(sit) {
      stop3d(); const opp = team(d, G.opp), p = d.player, pl = G.pend, bat = SIM.curBatter(G);
      const host = E('div', { class: 'dyn3dab' }); root.replaceChildren(host); ui.stage.classList.add('cvstage');
      host.appendChild(E('div', { class: 'd3load' }, E('b', null, 'Taking the field…'), E('i')));
      const st = sitFor(opp); const score = st.us + ' ' + st.usR + ' · ' + st.them + ' ' + st.themR;
      const back = res => { stop3d(); hlDisarm(); ui.stage.classList.remove('cvstage'); if (!res || !G.pend) { hlCand = null; return game(); } SIM.applyField(G, res, pl); hlKeep(); afterPlay(); };
      hlArm('field');
      load3d().then(m => { if (!host.isConnected) return;
        try { const g = m.fieldPlay({ stage: host, level: p.level || 1, me: meFor(p), Sound: H.Sound, say: t => status(t),
            play: { pos: G.mePos || p.pos, kind: pl.kind, diff: pl.diff, on: G.bases.map(Boolean), outs: G.outs, r: SIM.eff(p, false), throws: p.throws, skin: SKIN[p.skin], hair: HAIR[p.hair],
              sit: { score, half: (G.top ? 'TOP ' : 'BOT ') + G.inn, title: st.title, line: sit }, opp: { oc: opp.a, oj: opp.j, ol: st.ol }, onDone: res => setTimeout(() => back(res), 0) } });
          card = g; H.setLive(g); }
        catch (e) { back(null); } })
        .catch(() => { ui.stage.classList.remove('cvstage'); simField(); afterPlay(); });
    }
    function progressBox(pg) {
      if (!pg) return E('div', { class: 'dynspgain' }, E('b', null, '+' + (G.fin && G.fin.sp || 0)), E('span', null, 'training points'));
      const p = d.player, top = Object.keys(pg.gains).sort((a, b) => pg.gains[b] - pg.gains[a]).slice(0, 5);
      const nm = k => ATTR.find(x => x[0] === k)[1];
      return E('section', { class: 'dynbox dynprog' }, E('h2', null, 'Player progress'),
        pg.lvlUps ? E('p', { class: 'dynlvlup' }, '⬆ LEVEL UP! Level ' + p.lvl) : null, lvlBar(p),
        E('ul', { class: 'dyngains' }, top.map(k => E('li', { class: pg.ups.includes(k) ? 'up' : '' }, E('b', null, nm(k)), E('span', null, '+' + pg.gains[k] + ' XP'),
          E('i', null, E('em', { style: 'width:' + Math.round(100 * (p.xp[k] || 0) / SIM.xpNeed(p.a[k])) + '%' })), pg.ups.includes(k) ? E('strong', null, '+' + pg.ups.filter(x => x === k).length + ' → ' + p.a[k]) : null))),
        pg.perks.length ? E('p', { class: 'dynlvlup' }, '★ New perk: ' + pg.perks.map(id => PERKS.find(x => x.id === id).name).join(', ')) : null,
        E('div', { class: 'dynspgain' }, E('b', null, '+' + pg.tp), E('span', null, 'training points')));
    }
    function postgame() {
      stop3d(); const m = G.my, A = team(d, G.away), Hm = team(d, G.home), first = !G.fin; if (first) { G.fin = SIM.finishGame(d, G); save(); } const r = G.fin;
      const line = m.h + ' for ' + m.ab + (m.hr ? ', ' + m.hr + ' HR' : '') + (m.d ? ', ' + m.d + ' 2B' : '') + (m.t ? ', ' + m.t + ' 3B' : '') + (m.rbi ? ', ' + m.rbi + ' RBI' : '') + (m.bb ? ', ' + m.bb + ' BB' : '') + (m.r ? ', ' + m.r + ' R' : '') + (m.gem ? ', ' + m.gem + ' web gem' + (m.gem > 1 ? 's' : '') : '');
      if (first) { if (r.won) { H.Sound.cheer && H.Sound.cheer(); } else { H.Sound.ooh && H.Sound.ooh(); } }
      if (first) { try { H.record(SIM.ovr(d.player.a, d.player.pos)); } catch (e) {} }
      show(E('div', { class: 'dynpost ' + (r.won ? 'win' : 'loss') },
        E('p', { class: 'dynkick' }, 'FINAL' + (G.inn > (G.len || 7) ? ' / ' + G.inn : '')), E('h1', { class: 'dynfinal' }, r.won ? 'SPITTERS WIN!' : 'Tough loss'),
        E('div', { class: 'dynfscore' }, E('div', null, E('i', { class: 'dot', style: 'background:' + A.c1 }), A.name, E('b', null, G.score.a)), E('div', null, E('i', { class: 'dot', style: 'background:' + Hm.c1 }), Hm.name, E('b', null, G.score.h))),
        lineScore(),
        (r.miles || []).length ? E('div', { class: 'dynmiles', role: 'status' }, r.miles.map(t => E('p', null, E('span', null, 'MILESTONE'), t))) : null,
        (() => { const hs = hlAll().filter(h => h.gid && h.gid === G.gid); return hs.length ? E('section', { class: 'dynbox' }, E('h2', null, 'Your highlights'), hlStrip(hs, true)) : null; })(),
        E('section', { class: 'dynbox' }, E('h2', null, r.potg ? '⭐ PLAYER OF THE GAME' : 'Your game'), E('p', { class: 'dynmyline' }, line || 'No at-bats'),
          E('ul', { class: 'dynabs' }, G.myAB.map(a => E('li', { class: ['1B', '2B', '3B', 'HR'].includes(a.code) ? 'hit' : a.code === 'BB' ? 'bb' : '' }, E('b', null, 'Inning ' + a.inn), { '1B': 'Single', '2B': 'Double', '3B': 'Triple', HR: 'HOME RUN', BB: 'Walk', K: 'Strikeout', OUT: 'Out', GO: 'Ground out', FO: 'Fly out', LO: 'Line out', E: 'Reached on error' }[a.code] + (a.rbi ? ' · ' + a.rbi + ' RBI' : ''))))),
        G.pit && G.pit.bf ? E('section', { class: 'dynbox' }, E('h2', null, 'On the mound'), E('p', { class: 'dynmyline' }, SIM.ipStr(G.pit.outs) + ' IP · ' + G.pit.h + ' H · ' + G.pit.r + ' R · ' + G.pit.bb + ' BB · ' + G.pit.k + ' K · ' + G.pit.pc + ' pitches')) : null,
        Object.keys(G.box || {}).length ? E('section', { class: 'dynbox' }, E('h2', null, 'Spitters batting'), E('table', { class: 'dyntable box' }, E('thead', null, E('tr', null, ['Batter', 'AB', 'H', 'HR', 'RBI', 'BB'].map(h => E('th', null, h)))),
          E('tbody', null, G.us.lineup.filter(x => G.box[x.name]).map(x => { const b = G.box[x.name]; return E('tr', { class: x.me ? 'me' : '' }, E('td', null, '#' + (x.me ? d.player.num : x.num) + ' ' + (x.me ? d.player.first : x.name)), E('td', null, b.ab), E('td', null, b.h), E('td', null, b.hr), E('td', null, b.rbi), E('td', null, b.bb)); })))) : null,
        progressBox(r.prog),
        E('button', { type: 'button', class: 'dynbig', id: 'dyn-cont', onclick: () => { tick(); G = null; hub(); } }, 'Continue')));
      status((r.won ? 'Win! ' : 'Loss. ') + G.score.a + ' to ' + G.score.h + '. You went ' + line + '.');
    }

    if (d && d.player) { if (d.live && d.live.g) { G = d.live.g; hub(); } else hub(); } else create();
    return { stop: () => { if (timer) clearTimeout(timer); stop3d(); } };
  }
  return { start, SIM };
})();
if (typeof module !== 'undefined') module.exports = HubDynasty;
