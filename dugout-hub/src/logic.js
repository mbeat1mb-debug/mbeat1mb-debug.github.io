/*LOGIC-START*/
const HubLogic = (() => {
  const DAY = 86400000;
  const parse = s => { const p = String(s).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
  const iso = dt => dt.toISOString().slice(0, 10);
  const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * DAY));
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY);
  const mondayOf = s => addDays(s, -((parse(s).getUTCDay() + 6) % 7));
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const byDate = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0);

  const pctVsGame = (oz, game) => (isNum(oz) && isNum(game) && game > 0) ? (oz - game) / game * 100 : null;
  const fitStatus = p => p == null ? 'unknown' : Math.abs(p) <= 3 ? 'match' : p < -20 ? 'verylight' : p <= 20 ? 'inrange' : p <= 50 ? 'heavy' : 'veryheavy';

  // MLB Pitch Smart, ages 7-14: rest days by pitches thrown in a day.
  const restDays = p => p <= 20 ? 0 : p <= 35 ? 1 : p <= 50 ? 2 : p <= 65 ? 3 : 4;
  // Accepts scorebook style (2.1 = 2 innings + 1 out) and decimals (2.33).
  const outsFromInnings = x => { if (!isNum(x) || x < 0) return 0; const f = x - Math.floor(x); return Math.floor(x) * 3 + ((f > 0.05 && f < 0.15) || (f >= 0.28 && f < 0.5) ? 1 : (f >= 0.15 && f < 0.28) || f >= 0.5 ? 2 : 0); };
  const fmtInnings = outs => Math.floor(outs / 3) + (outs % 3 ? ' ' + (outs % 3) + '/3' : '');

  function armStatus(entries, today, dailyMax) {
    const days = {};
    for (const e of entries) {
      if (e.kind !== 'pitch' || !e.date || e.date > today) continue;
      const d = days[e.date] || (days[e.date] = { pitches: 0, outs: 0 });
      d.pitches += e.pitches || 0; d.outs += e.outs || 0;
    }
    const dates = Object.keys(days).sort();
    let clearedOn = null, driver = null, outs12 = 0, over = null;
    const yearAgo = addDays(today, -365);
    for (const dt of dates) {
      const d = days[dt], c = addDays(dt, restDays(d.pitches) + 1);
      if (!clearedOn || c > clearedOn) { clearedOn = c; driver = { date: dt, pitches: d.pitches, rest: restDays(d.pitches) }; }
      if (dt > yearAgo) outs12 += d.outs;
      if (d.pitches > dailyMax && dt > addDays(today, -7)) over = { date: dt, pitches: d.pitches };
    }
    let threeDay = false;
    if (days[addDays(today, -1)] && days[addDays(today, -2)]) {
      threeDay = true;
      const t = addDays(today, 1);
      if (!clearedOn || t > clearedOn) clearedOn = t;
    }
    const outs3 = [0, 1, 2].reduce((s, n) => s + ((days[addDays(today, -n)] || {}).outs || 0), 0);
    const last = dates.length ? Object.assign({ date: dates[dates.length - 1] }, days[dates[dates.length - 1]]) : null;
    return { last, driver, clearedOn, cleared: !clearedOn || today >= clearedOn, threeDay, outs12, outs3, over };
  }

  function stats(entries, today) {
    const rStart = addDays(today, -28), pStart = addDays(today, -56);
    const inRecent = e => e.date > rStart && e.date <= today;
    const inPrior = e => e.date > pStart && e.date <= rStart;
    const sw = entries.filter(e => e.kind === 'swing');
    const bat = f => avg(sw.filter(f).map(e => e.batSpeed).filter(isNum));
    const batRecent = bat(inRecent), batPrior = bat(inPrior);
    const real = sw.filter(e => e.ball !== 'mini');
    const exitRecent = avg(real.filter(inRecent).map(e => e.exitVelo).filter(isNum));
    const ratio = e => (isNum(e.batSpeed) && isNum(e.exitVelo) && e.batSpeed > 0) ? e.exitVelo / e.batSpeed : null;
    const ratiosAll = real.map(ratio).filter(isNum);
    const squareRecent = avg(real.filter(inRecent).map(ratio).filter(isNum));
    const squareBest = ratiosAll.length ? Math.max.apply(null, ratiosAll) : null;
    const mach = entries.filter(e => e.kind === 'machine' && inRecent(e));
    const made = mach.reduce((s, e) => s + (e.made || 0), 0), of = mach.reduce((s, e) => s + (e.of || 0), 0);
    const games = entries.filter(e => e.kind === 'game' && inRecent(e));
    const sum = k => games.reduce((s, e) => s + (e[k] || 0), 0);
    const ab = sum('ab'), hits = sum('h'), k = sum('k'), bb = sum('bb'), pa = ab + bb;
    return {
      swingN: sw.filter(inRecent).length, batRecent, batPrior,
      batTrend: (batRecent != null && batPrior != null) ? batRecent - batPrior : null,
      exitRecent, squareRecent, squareBest,
      contactMade: made, contactOf: of, contactRate: of > 0 ? made / of : null,
      ab, hits, k, bb, pa, kRate: pa > 0 ? k / pa : null, battingAvg: ab > 0 ? hits / ab : null
    };
  }

  const pc = x => Math.round(x * 100) + '%';
  // Starting rules written for this hub, not published standards.
  const RULES = { contactGood: 0.70, contactLow: 0.60, kHigh: 0.30, minPA: 8, squareDrop: 0.90, speedFlat: 1 };

  function decideFocus(s, entries, today, rules) {
    const R = rules || RULES;
    if (s.swingN < 1 && s.contactOf < 10) return { focus: 'baseline', why: 'No bat speed or machine count in the last 4 weeks. This week measures where he stands.' };
    const prev = today ? [1, 2].map(k => weekInfo(entries, addDays(mondayOf(today), -7 * k)).lockedFocus) : [];
    const tired = f => prev.length === 2 && prev[0] === f && prev[1] === f;   // already ran the last two weeks
    const gameBad = s.pa >= R.minPA && s.kRate >= R.kHigh;
    if (s.contactRate != null && s.contactRate >= R.contactGood && gameBad && !tired('timing'))
      return { focus: 'timing', why: 'Machine contact is ' + pc(s.contactRate) + ' but he struck out in ' + pc(s.kRate) + ' of ' + s.pa + ' game trips. Practice is not carrying over.' };
    if (s.contactRate != null && s.contactRate < R.contactLow && !tired('contact'))
      return { focus: 'contact', why: 'Machine contact is ' + pc(s.contactRate) + ' (' + s.contactMade + ' of ' + s.contactOf + '). The target is ' + pc(R.contactGood) + '.' };
    if (gameBad && s.contactRate == null && !tired('contact'))
      return { focus: 'contact', why: 'He struck out in ' + pc(s.kRate) + ' of ' + s.pa + ' game trips and there is no machine count yet.' };
    if (s.squareRecent != null && s.squareBest != null && s.squareRecent < R.squareDrop * s.squareBest && !tired('contact'))
      return { focus: 'contact', why: 'Squared-up score is ' + s.squareRecent.toFixed(2) + ' against his best of ' + s.squareBest.toFixed(2) + '. The swing is fine but he is missing the middle of the bat.' };
    if (s.batTrend != null && s.batTrend < R.speedFlat && !tired('speed'))
      return { focus: 'speed', why: 'Bat speed moved ' + (s.batTrend >= 0 ? '+' : '') + s.batTrend.toFixed(1) + ' mph against the 4 weeks before. Contact is holding, so speed is next.' };
    const hintable = ['path', 'speed', 'contact', 'timing'];
    const hint = today ? entries.filter(e => e.kind === 'analysis' && hintable.indexOf(e.fixArea) >= 0 && e.date > addDays(today, -14) && e.date <= today).sort(byDate).pop() : null;
    if (hint && !tired(hint.fixArea)) return { focus: hint.fixArea, why: 'The numbers flag nothing, so the plan follows the latest filmstrip note: ' + String((hint.fix && hint.fix.title) || FOCUS[hint.fixArea].name).slice(0, 60) + '.' };
    const order = ['path', 'speed', 'contact'], lastUsed = {};
    for (const e of entries) if (e.kind === 'session' && order.indexOf(e.focus) >= 0 && (!lastUsed[e.focus] || e.date > lastUsed[e.focus])) lastUsed[e.focus] = e.date;
    const pick = order.slice().sort((a, b) => (lastUsed[a] || '') < (lastUsed[b] || '') ? -1 : (lastUsed[a] || '') > (lastUsed[b] || '') ? 1 : order.indexOf(a) - order.indexOf(b))[0];
    return { focus: pick, why: 'Nothing is flagged, so the plan rotates to the focus he has gone longest without.' };
  }

  function weekInfo(entries, today) {
    const mon = mondayOf(today);
    const ses = entries.filter(e => e.kind === 'session' && e.complete && mondayOf(e.date) === mon).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const done = {}; for (const e of ses) done[e.slot] = true;
    return { monday: mon, done, count: Object.keys(done).length, lockedFocus: ses.length ? ses[0].focus : null, lockedWhy: ses.length ? ses[0].why : null };
  }

  function weeksMap(entries) {
    const byWeek = {};
    for (const e of entries) if (e.kind === 'session' && e.complete) { const m = mondayOf(e.date); (byWeek[m] || (byWeek[m] = {}))[e.slot] = true; }
    return byWeek;
  }
  function streak(entries, today) {
    const w = weeksMap(entries), full = m => w[m] && w[m].A && w[m].B;
    let m = mondayOf(today), n = 0;
    if (!full(m)) m = addDays(m, -7);
    while (full(m)) { n++; m = addDays(m, -7); }
    return n;
  }
  function longestStreak(entries) {
    const w = weeksMap(entries), mons = Object.keys(w).filter(m => w[m].A && w[m].B).sort();
    let best = 0, run = 0, prev = null;
    for (const m of mons) { run = (prev && addDays(prev, 7) === m) ? run + 1 : 1; if (run > best) best = run; prev = m; }
    return best;
  }

  // Every tracked best, and how many times a best was beaten (the first value does not count).
  function records(entries) {
    const r = { bat: null, exit: null, contact: null, jump: null, pushups: null, plank: null, velo: null };
    let breaks = 0;
    const up = (k, v, e, extra) => { if (!isNum(v)) return; if (!r[k]) r[k] = Object.assign({ v, date: e.date }, extra); else if (v > r[k].v) { r[k] = Object.assign({ v, date: e.date }, extra); breaks++; } };
    for (const e of entries.slice().sort(byDate)) {
      if (e.kind === 'swing') { up('bat', e.batMax != null ? e.batMax : e.batSpeed, e); if (e.ball !== 'mini') up('exit', e.exitMax != null ? e.exitMax : e.exitVelo, e); }
      if (e.kind === 'machine' && e.of >= 10) up('contact', e.made / e.of, e, { made: e.made, of: e.of });
      if (e.kind === 'strength') { up('jump', e.jump, e); up('pushups', e.pushups, e); up('plank', e.plank, e); }
      if (e.kind === 'velo') up('velo', isNum(e.max) ? e.max : e.avg, e);
    }
    r.breaks = breaks;
    return r;
  }

  function totals(entries) {
    const t = { swings: 0, pushups: 0, situps: 0, squats: 0, sessions: 0 };
    for (const e of entries) {
      if (e.kind === 'reps') { t.swings += e.swings || 0; t.pushups += e.pushups || 0; t.situps += e.situps || 0; t.squats += e.squats || 0; }
      if (e.kind === 'session' && e.complete) t.sessions++;
    }
    return t;
  }

  const XP = { A: 100, B: 100, C: 50, record: 25, boss: 50, perLevel: 300 };
  const TITLES = ['Rookie', 'Starter', 'Slugger', 'All-Star', 'Captain', 'MVP', 'Legend'];
  function game(entries) {
    let xp = 0;
    let bosses = 0;
    for (const e of entries) if (e.kind === 'session' && e.complete) { xp += XP[e.slot] || 0; if (e.boss && e.boss.won) { xp += XP.boss; bosses++; } }
    const breaks = records(entries).breaks;
    xp += breaks * XP.record;
    const level = Math.floor(xp / XP.perLevel) + 1;
    const into = xp % XP.perLevel, base = Math.min(3, Math.floor(into / XP.perLevel * 4));
    return { xp, bosses, level, title: TITLES[Math.min(level, TITLES.length) - 1], into, need: XP.perLevel, breaks, frac: into / XP.perLevel,
      baseText: ['Heading to first base', 'Past first, heading to second', 'Past second, heading to third', 'Rounding third, heading home'][base] };
  }

  function badges(entries) {
    const t = totals(entries), w = weeksMap(entries), rec = records(entries);
    const fullWeek = Object.keys(w).some(m => w[m].A && w[m].B && w[m].C);
    const sharp = entries.some(e => e.kind === 'machine' && e.of >= 20 && e.made / e.of >= 0.8);
    const tested = entries.some(e => e.kind === 'strength');
    return [
      { id: 'first', name: 'First session', how: 'Finish any session.', icon: 'star', on: t.sessions >= 1 },
      { id: 'week', name: 'Full week', how: 'Finish A, B and C in one week.', icon: 'trophy', on: fullWeek },
      { id: 'streak3', name: 'Three in a row', how: 'Finish A and B three weeks straight.', icon: 'flame', on: longestStreak(entries) >= 3 },
      { id: 'tested', name: 'Starting line', how: 'Log your first strength test.', icon: 'flag', on: tested },
      { id: 'breaker', name: 'Record breaker', how: 'Beat one of your records.', icon: 'bolt', on: rec.breaks >= 1 },
      { id: 'sharp', name: 'Sharp eye', how: 'Get 16 solid hits out of 20 on the machine.', icon: 'target', on: sharp },
      { id: 'film', name: 'Film study', how: 'Save your first filmstrip.', icon: 'play', on: entries.some(e => e.kind === 'analysis') },
      { id: 'ten', name: '10 sessions', how: 'Finish 10 sessions.', icon: 'star', on: t.sessions >= 10 },
      { id: 'sw500', name: '500 swings', how: 'Log 500 swings.', icon: 'bat', on: t.swings >= 500 },
      { id: 'boss3', name: 'Boss slayer', how: 'Win 3 Boss Battles.', icon: 'trophy', on: game(entries).bosses >= 3 },
      { id: 'pu100', name: '100 push-ups', how: 'Log 100 push-ups.', icon: 'bolt', on: t.pushups >= 100 }
    ];
  }

  function retest(entries, today) {
    const t = entries.filter(e => e.kind === 'strength').map(e => e.date).sort();
    if (!t.length) return { due: today, inDays: 0, first: null, last: null };
    const due = addDays(t[t.length - 1], 28);
    return { due, inDays: diffDays(due, today), first: t[0], last: t[t.length - 1] };
  }

  const HEAVY_CAP = 10; // most heavy-bat swings in one session (a rule written for this hub)
  const FOCUS = {
    baseline: { name: 'Test week', kid: 'Show what you can do. These numbers are your starting line.', icon: 'flag' },
    contact: { name: 'Contact', kid: 'Hit it on the sweet spot, every time.', icon: 'target' },
    speed: { name: 'Bat speed', kid: 'Swing fast. Chase a new top speed.', icon: 'bolt' },
    path: { name: 'Swing path', kid: 'Smooth swing, straight to the ball.', icon: 'bat' },
    timing: { name: 'Timing', kid: 'Be on time for every pitch.', icon: 'clock' }
  };

  const I = (id, title, text, o) => Object.assign({ id, title, text }, o || {});

  // ---------- drill library ----------
  // pts: how he scores it. max: most points. lvl: level that unlocks it. heavy: heavy-bat swings (capped per session).
  const DRILLS = {
    contact: [
      I('c1', 'Beat the Machine', 'Skinny bat, mini balls. 20 pitches. Solid hit = you score. Miss or foul = machine scores. Win the game.', { min: 6, count: 20, sw: 20 }),
      I('c2', 'Around the Clock', 'Tee. Inside, middle, outside, then high and low. 3 swings at each spot. Line drive = 1 point.', { min: 4, sw: 15, pts: 'Line drive = 1 point', max: 15 }),
      I('c3', 'Small Ball', 'Mini balls on the machine with the skinny bat. Hit the ball right back at the machine (aim low, not at Dad). Up the middle = 2 points, anywhere else solid = 1.', { min: 4, sw: 10, pts: 'Middle 2, solid 1', max: 20 }),
      I('c4', 'Short Bat Hands', 'Choke up 3 inches on the practice bat. 10 tee swings. Short and quick to the ball. Line drive = 1 point.', { min: 3, sw: 10, pts: 'Line drive = 1 point', max: 10 }),
      I('c5', 'Two-Ball Tee', 'Set a second ball just behind the tee ball. Hit the front ball without touching the back one. Clean = 1 point.', { min: 3, sw: 10, pts: 'Clean swing = 1 point', max: 10, lvl: 2 }),
      I('c6', 'Color Call', 'Dad: dot some mini balls red and some blue. Red = pull it. Blue = hit it the other way. No dot = take it. 15 pitches. Right call = 1, solid hit too = +1.', { min: 5, sw: 15, pts: 'Right call 1, solid +1', max: 30, lvl: 2 }),
      I('c7', 'Oppo Gate', 'Tape a big square on the left half of the net. 10 tee swings set a little outside. Hit the square = 2 points.', { min: 3, sw: 10, pts: 'In the square = 2', max: 20 }),
      I('c8', 'Pepper With Dad', 'Dad soft-tosses mini balls from 15 feet. Tap them back to him on the ground with a short swing. 15 tosses. Clean tap = 1 point.', { min: 3, sw: 15, pts: 'Clean tap = 1', max: 15 }),
      I('c9', 'Three Strikes, You\'re Out', 'Skinny bat on the machine. Keep hitting until you miss 3 times. Every solid hit = 1 point. Can you get 10?', { min: 4, sw: 15, pts: 'Solid hit = 1', max: 30, lvl: 2 }),
      I('c10', 'Bunt, Then Swing', 'Machine. Bunt the first 3 pitches down, then swing away at 7. Good bunt = 1, solid swing = 1.', { min: 4, sw: 10, pts: 'Good bunt 1, solid 1', max: 10 })
    ],
    speed: [
      I('s1', 'Heavy, Light, Game', 'Sensor on. 3 swings with the SKLZ hand-loaded bat, 3 with the SKLZ unloaded bat, then 3 with the game bat. Can the game bat beat the heavy bat speed?', { min: 4, heavy: 3, sw: 9 }),
      I('s2', 'Walk-Through Swings', 'Tee. Start 2 steps back, walk in and swing like a big leaguer. 8 swings. Sensor on. Top speed = your points.', { min: 3, sw: 8, pts: 'Points = top mph', max: 90 }),
      I('s3', 'Speed Ladder', 'Unloaded bat. 3 rounds of 4 fast swings, no ball. Each round must be faster than the last. Dad reads the sensor.', { min: 3, sw: 12 }),
      I('s4', 'Loud Contact', 'Practice bat, real balls off the tee into the net. 10 swings. Dad scores the sound: crack = 2, thud = 1.', { min: 3, sw: 10, pts: 'Crack 2, thud 1', max: 20 }),
      I('s5', 'Step-Back Launch', 'Tee. Back foot steps toward the catcher, then explode forward and swing. 8 swings.', { min: 3, sw: 8, lvl: 2 }),
      I('s6', 'Exit Speed Derby', 'Radar up. 10 real balls off the tee. Every ball over your average = 1 point. New top speed = 5.', { min: 4, sw: 10, pts: 'Over average 1, new best 5', max: 15, lvl: 2 }),
      I('s7', 'Heavy Bat Holds', 'SKLZ end-loaded bat on the tee. 4 swings, freeze at the finish for 3 seconds each.', { min: 2, heavy: 4, sw: 4 }),
      I('s8', 'Whoosh Swings', 'Flip the practice bat over and hold the skinny end. Swing hard so the whoosh is loud out in front, not behind you. 10 swings.', { min: 2, sw: 10 }),
      I('s9', 'Hips First', 'No ball. Step, turn your back hip hard, then let the bat come. 8 swings. Then 5 tee swings the same way.', { min: 3, sw: 13 }),
      I('s10', 'Max Effort Five', 'Sensor on, practice bat, tee. 5 swings, rest 20 seconds between. Any swing within 2 mph of your best = 1 point.', { min: 3, sw: 5, pts: 'Within 2 mph of best = 1', max: 5, lvl: 2 })
    ],
    path: [
      I('p1', 'CamWood Smooth', 'On the tee. 2 sets of 4 slow, smooth swings. Hands stay inside the ball. Dad films one.', { min: 4, heavy: 8, sw: 8 }),
      I('p2', 'Barrier Tee', 'Put a bucket just in front of the tee, a bat length out. Hit line drives over it without hitting it. 10 swings. Clean line drive = 2.', { min: 4, sw: 10, pts: 'Clean liner = 2', max: 20 }),
      I('p3', 'High Tee, Low Tee', 'Tee at belt height for 5, then at the knees for 5. Line drives only. 1 point each.', { min: 3, sw: 10, pts: 'Line drive = 1', max: 10 }),
      I('p4', 'Bottom-Hand Only', 'CamWood or a short grip on the practice bat. Bottom hand only, 5 tee swings. Then 5 with both hands.', { min: 3, heavy: 5, sw: 10 }),
      I('p5', 'Fence Drill', 'Stand a bat length from the net, facing the tee. Swing without touching the net. 8 swings. Clean = 1 point.', { min: 3, sw: 8, pts: 'No net touch = 1', max: 8, lvl: 2 }),
      I('p6', 'Machine: Line Drives', 'Skinny bat. 10 pitches. Grounder = 0, line drive = 2, pop-up = 0.', { min: 3, count: 10, sw: 10, pts: 'Line drive = 2', max: 20 }),
      I('p7', 'Top Hand Only', 'CamWood one-arm trainer, top hand. 5 slow tee swings. Then 5 with both hands on the practice bat.', { min: 3, heavy: 5, sw: 10 }),
      I('p8', 'Where\'s the Tee?', 'Dad moves the tee: out front = pull it, deep = hit it the other way. 10 swings. Right direction = 1 point.', { min: 3, sw: 10, pts: 'Right direction = 1', max: 10 }),
      I('p9', 'Up the Middle', 'Skinny bat, machine. 10 pitches. Back up the middle = 2, solid anywhere else = 1.', { min: 3, sw: 10, pts: 'Middle 2, solid 1', max: 20, lvl: 2 }),
      I('p10', 'Knob to the Ball', 'Tee. Short swings where the knob of the bat leads to the ball, then the barrel whips through. 8 swings.', { min: 3, sw: 8 })
    ],
    timing: [
      I('t1', 'Mix It Up', 'Skinny bat. 15 pitches. Dad changes the machine speed without telling you. Solid hits count.', { min: 5, count: 15, sw: 15 }),
      I('t2', 'Go on the Call', 'Tee. Start your load when Dad says go. He waits a different time every swing. 10 swings.', { min: 3, sw: 10 }),
      I('t3', 'Color Call', 'Red dot = pull it. Blue dot = other way. No dot = take it. 15 machine pitches. Right call = 1, solid hit too = +1.', { min: 5, sw: 15, pts: 'Right call 1, solid +1', max: 30 }),
      I('t4', 'Two-Strike Battle', 'Every machine pitch is strike two. Shorten up. 10 pitches. Any fair ball or foul tip keeps you alive = 1 point. Miss = out.', { min: 4, sw: 10, pts: 'Stay alive = 1', max: 10 }),
      I('t5', 'Front Toss Mystery', 'Dad tosses mini balls from a knee behind a screen. He fakes some tosses. Only swing at real ones. 12 tosses.', { min: 4, sw: 12, lvl: 2 }),
      I('t6', 'Stride and Freeze', 'Machine on. Stride and freeze when the ball leaves. Dad checks your front foot is down on time. 8 pitches, no swings. Then 8 with swings.', { min: 4, sw: 8, lvl: 2 }),
      I('t7', 'Call the Count', 'Before each machine pitch Dad calls a count. 3-0: only swing at a perfect strike. 0-2: protect the plate. 10 pitches. Right choice = 1 point.', { min: 4, sw: 10, pts: 'Right choice = 1', max: 10 }),
      I('t8', 'Slow, Fast, Slow', 'Machine. 5 slow, 5 fast, 5 slow. Stay on time when it changes. Solid hits count.', { min: 5, count: 15, sw: 15 }),
      I('t9', 'Early Load', 'Machine. Be loaded and ready before the ball comes out. Dad scores each on-time load = 1 point. 10 pitches.', { min: 3, sw: 10, pts: 'On-time load = 1', max: 10, lvl: 2 }),
      I('t10', 'Hit It Where It\'s Pitched', 'Machine, skinny bat. Inside pitch = pull it, outside = other way. 10 pitches. Right direction = 1 point.', { min: 4, sw: 10, pts: 'Right direction = 1', max: 10 })
    ]
  };
  // Fix-it drills aimed at what shows up in games.
  const FIXES = {
    looking: { title: 'Strikeouts looking', drill: I('f1', 'Two-Strike Battle', 'Every machine pitch is strike two. Swing at strikes, foul off the tough ones. 10 pitches. Stay alive = 1 point.', { min: 4, sw: 10, pts: 'Stay alive = 1', max: 10 }) },
    grounders: { title: 'Lots of ground-ball outs', drill: I('f2', 'Barrier Tee', 'Bucket just in front of the tee. Hit line drives over it. 10 swings. Clean line drive = 2 points.', { min: 4, sw: 10, pts: 'Clean liner = 2', max: 20 }) },
    flies: { title: 'Lots of fly and pop outs', drill: I('f3', 'Low Tee Liners', 'Tee at the knees. Hit the top half of the ball. 10 swings. Line drive or hard grounder = 1 point.', { min: 3, sw: 10, pts: 'Liner or hard grounder = 1', max: 10 }) },
    whiffs: { title: 'Lots of strikeouts swinging', drill: I('f4', 'Short Bat Hands', 'Choke up 3 inches. 10 machine pitches. Short swing, just hit it. Contact = 1 point.', { min: 3, count: 10, sw: 10, pts: 'Contact = 1', max: 10 }) }
  };
  const WARMUPS = [
    I('w1', 'Warm up', '10 arm circles each way, 10 leg swings each leg, 10 easy swings with no ball.'),
    I('w2', 'Mirror Me', 'Dad does a move, you copy it fast: skips, side shuffles, high knees, arm circles. 2 minutes.'),
    I('w3', 'Base Path Warm-up', 'Jog to a cone and back 4 times: forward, side shuffle, backpedal, sprint.')
  ];
  const BODY_C = [
    I('z1', 'Squats', '2 sets of {8}.', { r: { sq: 8 } }),
    I('z2', 'Push-ups', '2 sets of {5}.', { r: { pu: 5 } }),
    I('z3', 'Sit-ups', '2 sets of {8}.', { r: { su: 8 } }),
    I('z4', 'Bear Crawl', 'Crawl 10 steps forward, 10 back. Knees off the ground. 2 times.'),
    I('z5', 'Crab Walk Race', 'Crab walk to a line and back. Race Dad or the clock. 2 times.'),
    I('z6', 'Lunges', 'Step back. 2 sets of {5} each leg.'),
    I('z7', 'Plank', '2 holds of {hold} seconds.'),
    I('z8', 'Stick the Landing', '5 big jumps. Freeze on every landing for 2 seconds.'),
    I('z9', 'Superman Holds', 'Lie on your belly, arms and legs up. 3 holds of 10 seconds.')
  ];

  // Small, repeatable shuffle so a week's plan stays the same every time the page opens.
  function seeded(seed) { let x = 2166136261; for (let i = 0; i < seed.length; i++) { x ^= seed.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return () => { x = (Math.imul(x ^ (x >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return x / 4294967296; }; }
  function shuffle(list, seed) { const a = list.slice(), r = seeded(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Pick n drills: unlocked, not used in the last 2 weeks if possible, no repeats, heavy swings under the cap.
  function pickDrills(pool, n, o) {
    const level = o.level || 1, recent = o.recent || [], avoid = o.avoid || [], heavyLeft = o.heavyLeft == null ? HEAVY_CAP : o.heavyLeft;
    const open = pool.filter(d => (d.lvl || 1) <= level && avoid.indexOf(d.id) < 0 && avoid.indexOf(d.title) < 0);
    const order = shuffle(open, o.seed || 'x');
    // recent runs oldest to newest, so a drill last done 2 weeks ago comes back before one done last week.
    const fresh = order.filter(d => recent.indexOf(d.id) < 0), used = order.filter(d => recent.indexOf(d.id) >= 0).sort((a, b) => recent.lastIndexOf(a.id) - recent.lastIndexOf(b.id));
    const out = []; let heavy = 0;
    for (const d of fresh.concat(used)) {
      if (out.length >= n) break;
      if ((d.heavy || 0) + heavy > heavyLeft) continue;
      heavy += d.heavy || 0; out.push(d);
    }
    return out;
  }
  // What game results point to. Needs the optional game boxes (looking, ground outs, fly outs).
  function diagnose(entries, today) {
    const start = addDays(today, -28), g = entries.filter(e => e.kind === 'game' && e.date > start && e.date <= today);
    const out = [];
    const withKL = g.filter(e => isNum(e.kl)), k = withKL.reduce((s, e) => s + (e.k || 0), 0), kl = withKL.reduce((s, e) => s + e.kl, 0);
    if (kl >= 2 && k > 0 && kl / k >= 0.4) out.push({ id: 'looking', why: kl + ' of his ' + k + ' strikeouts were looking (' + Math.round(kl / k * 100) + '%) in the last 4 weeks.', weight: kl / k });
    const withB = g.filter(e => isNum(e.go) || isNum(e.fo)), go = withB.reduce((s, e) => s + (e.go || 0), 0), fo = withB.reduce((s, e) => s + (e.fo || 0), 0), outs = go + fo;
    if (outs >= 5 && go / outs >= 0.6) out.push({ id: 'grounders', why: go + ' of his ' + outs + ' outs in play were on the ground (' + Math.round(go / outs * 100) + '%).', weight: go / outs });
    else if (outs >= 5 && fo / outs >= 0.6) out.push({ id: 'flies', why: fo + ' of his ' + outs + ' outs in play were in the air (' + Math.round(fo / outs * 100) + '%).', weight: fo / outs });
    const ab = g.reduce((s, e) => s + (e.ab || 0), 0), allK = g.reduce((s, e) => s + (e.k || 0), 0);
    const swingK = withKL.length ? k - kl : null;
    if (ab >= 8 && swingK != null && swingK / ab >= 0.25) out.push({ id: 'whiffs', why: swingK + ' swinging strikeouts in ' + ab + ' at-bats (' + Math.round(swingK / ab * 100) + '%).', weight: swingK / ab });
    else if (ab >= 8 && !withKL.length && allK / ab >= 0.3) out.push({ id: 'whiffs', why: allK + ' strikeouts in ' + ab + ' at-bats (' + Math.round(allK / ab * 100) + '%).', weight: allK / ab });
    return out.sort((a, b) => b.weight - a.weight).map(x => Object.assign({ title: FIXES[x.id].title }, x));
  }
  // Weekly boss: rotates speed, machine round, Dad duel. The target comes from his own records.
  function bossFor(entries, monday) {
    const kinds = ['speed', 'contact', 'duel'], idx = Math.floor(parse(monday).getTime() / (7 * DAY)) % 3;
    const rec = records(entries), kind = kinds[(idx + 3) % 3];
    if (kind === 'speed') {
      const t = rec.bat ? rec.bat.v : null;
      return I('boss', 'Boss Battle: Speed Boss', t != null ? 'Sensor on, game bat, tee. 5 swings. Beat your best bat speed: ' + (Math.round(t * 10) / 10) + ' mph.' : 'Sensor on, game bat, tee. 5 swings. Set the speed to beat.', { min: 2, sw: 5, boss: { kind, target: t, unit: 'mph', label: 'Top bat speed' } });
    }
    if (kind === 'contact') {
      const t = rec.contact ? Math.min(10, Math.round(rec.contact.v * 10)) : null;
      return I('boss', 'Boss Battle: Machine Boss', t != null ? 'Skinny bat, 10 pitches. Beat ' + t + ' solid hits' + (t >= 10 ? ' (match 10 to win).' : '.') : 'Skinny bat, 10 pitches. Set the number to beat.', { min: 3, sw: 10, boss: { kind, target: t, unit: 'solid hits', label: 'Solid hits out of 10' } });
    }
    return I('boss', 'Boss Battle: Beat Dad', 'Tee. You and Dad each take 10 swings. Line drive = 2, grounder = 1. Most points wins.', { min: 3, sw: 10, boss: { kind, target: null, unit: 'points', label: 'Your points', dad: true } });
  }
  function bossWon(b, result, dad) {
    if (!b || !isNum(result)) return null;
    if (b.kind === 'duel') return isNum(dad) ? result > dad : null;
    if (b.target == null) return true;   // first one sets the bar
    return b.kind === 'contact' && b.target >= 10 ? result >= 10 : result > b.target;
  }
  // Drill ids from finished sessions in the 2 weeks before this Monday.
  function recentDrills(entries, monday) {
    const lo = addDays(monday, -14), ids = [];
    const ses = entries.filter(e => e.kind === 'session' && e.complete && e.date >= lo && e.date < monday && Array.isArray(e.drills)).sort(byDate);
    for (const e of ses) ids.push.apply(ids, e.drills);
    return ids;
  }
  function hitting(focus) { return (DRILLS[focus] || DRILLS.contact).slice(0, 3); }

  const MOUND_MAX = 20;   // 20 pitches or fewer needs 0 rest days under Pitch Smart, so a practice never blocks the next day.
  function buildWeek(focus, step, armRest, o) {
    o = o || {};
    const S = Math.max(1, Math.min(5, step || 1)), r = n => n + 2 * (S - 1), hold = 20 + 5 * (S - 1);
    const mon = o.monday || '2000-01-03', level = o.level || 1, recent = o.recent || [], targets = o.targets || [];
    const seed = mon + focus;
    const warmPick = shuffle(WARMUPS, seed + 'w');
    const warm = k => ({ name: 'Warm-up', min: 3, items: [Object.assign({}, warmPick[k % warmPick.length], { id: 'w' + k })] });
    const log = { name: 'Wrap up', min: 2, items: [I('l1', 'Tell Dad your numbers', 'Points, hits and speeds. He logs them so you get credit.')] };
    const sum = items => items.reduce((s, i) => s + (i.min || 0), 0);
    const pool = DRILLS[focus === 'baseline' ? 'contact' : focus] || DRILLS.contact;
    const fixA = targets[0] && FIXES[targets[0].id], fixB = targets[1] && FIXES[targets[1].id] || fixA;
    const tag = (d, why) => Object.assign({}, d, { fix: why });

    // Day 1: fix-it drill, 2 from the pool, boss battle.
    let a1 = [];
    if (focus === 'baseline') a1 = [
      I('b1', 'Bat speed test', 'Sensor on the practice bat. 10 full swings off the tee.', { min: 4, sw: 10 }),
      I('b2', 'Exit speed test', 'Radar set up. 10 real baseballs off the tee into the net.', { min: 4, sw: 10 }),
      I('b3', 'Contact test', 'Machine, skinny bat, 20 pitches. Count your solid hits.', { min: 4, count: 20, sw: 20 })];
    else {
      const lead = fixA ? [tag(fixA.drill, targets[0])] : [];
      const rest = pickDrills(pool, 3 - lead.length, { level, recent, seed: seed + 'a', avoid: lead.map(d => d.title) });
      a1 = lead.concat(rest);
      a1.push(bossFor(o.entries || [], mon));
    }
    // Day 2: fix-it (second target if there is one), 1 more from the pool, mound or glove work.
    const usedA = a1.map(d => d.title);
    const lead2 = focus !== 'baseline' && fixB && usedA.indexOf(fixB.drill.title) < 0 ? [tag(fixB.drill, targets[1] || targets[0])] : [];
    const b1 = lead2.concat(pickDrills(pool, 2 - lead2.length, { level, recent: recent.concat(a1.map(d => d.id)), seed: seed + 'b', avoid: usedA.concat(lead2.map(d => d.title)) }));
    const mound = armRest
      ? { name: 'Glove work (arm rest, no throws)', items: [
          I('g1', 'Shadow Grounders', 'No ball. Dad points left, right or in. Shuffle, get low, field it with your glove, freeze. 12 reps.', { min: 3 }),
          I('g2', 'Balance Beam', 'Pitching leg lift. Hold the top for 3 seconds without wobbling. 5 each side.', { min: 2 })] }
      : { name: 'Mound', items: [
          I('m1', 'Easy Catch', 'Play catch with Dad. 10 easy throws, short to a little longer. Not counted as pitches.', { min: 2 }),
          I('m2', 'Strike Zone Tic-Tac-Toe', 'Tape a 3 by 3 grid on the net. Pitch from your spot. Get 3 in a row to win. ' + MOUND_MAX + ' pitches at most, then stop.', { min: 5, pitches: MOUND_MAX, pts: 'Each square hit = 1', max: 9 })] };
    mound.min = sum(mound.items);
    const bodyA = focus === 'baseline'
      ? { name: 'Strength test', min: 8, items: [
          I('x1', 'Long jump test', '3 tries from standing. Dad measures your best one.'),
          I('x2', 'Push-up test', 'As many as you can with a flat back. Stop when your form slips.'),
          I('x3', 'Plank test', 'Hold as long as you can with a flat back. Dad times it.')] }
      : { name: 'Strength', min: 7, items: [
          I('a1', 'Squats', '2 sets of ' + r(8) + '.', { sq: 2 * r(8) }),
          I('a2', 'Push-ups', '2 sets of ' + r(5) + ' with a flat back.', { pu: 2 * r(5) }),
          I('a3', 'Sit-ups', '2 sets of ' + r(8) + '.', { su: 2 * r(8) })] };
    const bodyB = { name: 'Tidal Tank', min: 4, items: [
      I('k1', 'Tank twists', 'Tidal Tank. 2 sets of ' + r(6) + ' each side. Keep the water quiet.'),
      armRest ? I('k4r', 'Tank carry', 'Hold the Tidal Tank in front. 2 walks of 20 steps.')
              : I('k4', 'Med ball throws', 'Side throws into the net. 2 sets of ' + r(5) + ' each side.')] };
    const fill = t => t.replace('{8}', r(8)).replace('{5}', r(5)).replace('{hold}', hold);
    const cPick = shuffle(BODY_C.slice(3), seed + 'c').slice(0, 3);
    const bodyC = { name: 'Bodyweight', min: 10, items: BODY_C.slice(0, 3).concat(cPick).map(d => {
      const x = Object.assign({}, d, { text: fill(d.text) });
      if (d.r) { if (d.r.sq) x.sq = 2 * r(d.r.sq); if (d.r.pu) x.pu = 2 * r(d.r.pu); if (d.r.su) x.su = 2 * r(d.r.su); delete x.r; }
      return x; }) };
    const hitA = { name: 'Hitting', min: sum(a1), items: a1 }, hitB = { name: 'Hitting', min: sum(b1), items: b1 };
    return {
      A: { title: 'Day 1', sub: focus === 'baseline' ? 'Test day' : 'Hitting + Boss Battle', min: 3 + hitA.min + bodyA.min + 2, blocks: [warm(0), hitA, bodyA, log] },
      // In test week only Day 1 runs the tests; Day 2 is a normal practice so he is not maxing out twice.
      B: { title: 'Day 2', sub: armRest ? 'Hitting + glove work' : 'Hitting + pitching', min: 3 + mound.min + hitB.min + bodyB.min + 2, blocks: [warm(1), mound, hitB, bodyB, log] },
      C: { title: 'Day 3', sub: 'Bodyweight only', min: 10, blocks: [bodyC] }
    };
  }
  const drillIds = session => session.blocks.flatMap(b => b.items).map(i => i.id);

  // What a finished session credits automatically.
  function sessionReps(session) {
    const t = { swings: 0, pushups: 0, situps: 0, squats: 0 };
    for (const b of session.blocks) for (const i of b.items) { t.swings += i.sw || 0; t.pushups += i.pu || 0; t.situps += i.su || 0; t.squats += i.sq || 0; }
    return t;
  }

  // ---------- 5. rules that tune themselves to his numbers ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function tune(entries, today) {
    const rules = Object.assign({}, RULES), notes = [], lo = addDays(today, -112), hi = addDays(today, -28);
    const base = entries.filter(e => e.kind === 'machine' && e.date > lo && e.date <= hi);
    const made = base.reduce((s, e) => s + (e.made || 0), 0), of = base.reduce((s, e) => s + (e.of || 0), 0);
    if (of >= 40) {
      const r = made / of; rules.contactGood = clamp(r, 0.5, 0.9); rules.contactLow = clamp(r - 0.10, 0.4, 0.8);
      notes.push('Contact is tuned to him. His norm is ' + made + ' ÷ ' + of + ' = ' + pc(r) + ' (weeks 5 to 16 back). The hub flags contact under ' + pc(rules.contactLow) + ' and calls it good at ' + pc(rules.contactGood) + '.');
    } else notes.push('Contact is on the starting rule (flag under ' + pc(RULES.contactLow) + ', good at ' + pc(RULES.contactGood) + ') until he has 40 machine pitches older than 4 weeks. He has ' + of + '.');
    const sp = entries.filter(e => e.kind === 'swing' && isNum(e.batSpeed) && e.date > lo && e.date <= today).map(e => e.batSpeed);
    if (sp.length >= 6) {
      const m = avg(sp), sd = Math.sqrt(avg(sp.map(x => (x - m) * (x - m)))); rules.speedFlat = clamp(sd / 2, 0.5, 2);
      notes.push('Bat speed is tuned to him. His readings vary by ' + sd.toFixed(1) + ' mph, and ' + sd.toFixed(1) + ' ÷ 2 = ' + (sd / 2).toFixed(1) + ', so a gain under ' + rules.speedFlat.toFixed(1) + ' mph counts as flat' + (Math.abs(sd / 2 - rules.speedFlat) > 0.001 ? ' (held between 0.5 and 2.0)' : '') + '.');
    } else notes.push('Bat speed is on the starting rule (a gain under ' + RULES.speedFlat + ' mph counts as flat) until he has 6 bat speed entries. He has ' + sp.length + '.');
    return { rules, notes, tuned: of >= 40 || sp.length >= 6 };
  }

  // ---------- 2. how often the same fix keeps coming up ----------
  function fixRun(checksNewestFirst) {
    const last = checksNewestFirst.slice(0, 4), area = last.length ? last[0].fixArea : null;
    if (!area || area === 'none' || !FOCUS[area]) return null;
    return { area, name: FOCUS[area].name, count: last.filter(c => c.fixArea === area).length, of: last.length };
  }

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const short = s => MON[parse(s).getUTCMonth()] + ' ' + parse(s).getUTCDate();
  const REC_NAMES = { bat: 'top bat speed', exit: 'top exit speed', contact: 'best machine round', jump: 'long jump', pushups: 'push-up test', plank: 'plank', velo: 'top pitch speed' };
  function weekRecap(entries, today) {
    const mon = mondayOf(today), sun = addDays(mon, 6), wk = entries.filter(e => e.date >= mon && e.date <= sun);
    const slots = {}; for (const e of wk) if (e.kind === 'session' && e.complete && ['A', 'B', 'C'].indexOf(e.slot) >= 0) slots[e.slot] = true;
    const m = wk.filter(e => e.kind === 'machine'), sw = wk.filter(e => e.kind === 'swing' && isNum(e.batSpeed));
    const g = wk.filter(e => e.kind === 'game'), pt = wk.filter(e => e.kind === 'pitch'), ck = wk.filter(e => e.kind === 'analysis').sort(byDate);
    const sum = (a, k) => a.reduce((s, e) => s + (isNum(e[k]) ? e[k] : 0), 0);
    const before = records(entries.filter(e => e.date < mon)), after = records(entries.filter(e => e.date <= sun));
    const nextMon = addDays(mon, 7);
    return {
      mon, sun, sessions: Object.keys(slots).sort(), reps: totals(wk),
      made: sum(m, 'made'), of: sum(m, 'of'),
      batN: sw.length, batAvg: avg(sw.map(e => e.batSpeed)), batBest: sw.length ? Math.max.apply(null, sw.map(e => isNum(e.batMax) ? e.batMax : e.batSpeed)) : null,
      games: { n: g.length, ab: sum(g, 'ab'), h: sum(g, 'h'), k: sum(g, 'k'), bb: sum(g, 'bb') },
      pitch: { n: pt.length, pitches: sum(pt, 'pitches'), outs: sum(pt, 'outs') },
      velo: (function () { const v = wk.filter(e => e.kind === 'velo'), a = v.filter(e => isNum(e.avg)).map(e => e.avg), m = v.map(e => isNum(e.max) ? e.max : e.avg).filter(isNum);
        return { n: v.length, avg: a.length ? avg(a) : null, aN: a.length, max: m.length ? Math.max.apply(null, m) : null }; })(),
      body: wk.filter(e => e.kind === 'body').sort(byDate).pop() || null,
      checks: ck.length, lastFix: ck.length && ck[ck.length - 1].fix && typeof ck[ck.length - 1].fix.title === 'string' ? ck[ck.length - 1].fix.title.slice(0, 60) : '',
      newRecords: Object.keys(REC_NAMES).filter(k => before[k] && after[k] && after[k].v > before[k].v).map(k => REC_NAMES[k]),
      next: decideFocus(stats(entries, nextMon), entries, nextMon, tune(entries, nextMon).rules)
    };
  }
  function fmtHeight(inches) { const f = Math.floor(inches / 12), i = Math.round((inches - f * 12) * 10) / 10; return f + ' ft ' + i + ' in'; }
  function recapText(r, name) {
    const out = [(name || 'Player') + ', week of ' + short(r.mon) + ' to ' + short(r.sun)];
    out.push('Sessions: ' + r.sessions.length + ' of 3' + (r.sessions.length ? ' (' + r.sessions.map(s => ({ A: 'Day 1', B: 'Day 2', C: 'Day 3' })[s] || s).join(', ') + ')' : ''));
    const parts = [[r.reps.swings, 'swings'], [r.reps.squats, 'squats'], [r.reps.pushups, 'push-ups'], [r.reps.situps, 'sit-ups']].filter(x => x[0] > 0).map(x => x[0] + ' ' + x[1]);
    out.push('Reps: ' + (parts.join(', ') || 'none logged'));
    if (r.of > 0) out.push('Machine contact: ' + r.made + ' ÷ ' + r.of + ' = ' + Math.round(r.made / r.of * 100) + '%');
    if (r.batN) out.push('Bat speed: average ' + r.batAvg.toFixed(1) + ' mph from ' + r.batN + (r.batN === 1 ? ' entry' : ' entries') + ', best ' + r.batBest.toFixed(1) + ' mph');
    if (r.games.n) out.push('Games: ' + r.games.h + ' for ' + r.games.ab + ', ' + r.games.k + (r.games.k === 1 ? ' strikeout, ' : ' strikeouts, ') + r.games.bb + (r.games.bb === 1 ? ' walk' : ' walks'));
    if (r.pitch.n) out.push('Pitching: ' + r.pitch.n + (r.pitch.n === 1 ? ' outing, ' : ' outings, ') + r.pitch.pitches + ' pitches, ' + fmtInnings(r.pitch.outs) + ' innings');
    if (r.velo && r.velo.n) out.push('Pitch speed: ' + (r.velo.avg != null ? 'average ' + r.velo.avg.toFixed(1) + ' mph from ' + r.velo.aN + (r.velo.aN === 1 ? ' check, ' : ' checks, ') : '') + 'fastest ' + r.velo.max.toFixed(1) + ' mph');
    if (r.body) out.push('Measured: ' + [isNum(r.body.heightIn) ? fmtHeight(r.body.heightIn) : null, isNum(r.body.weightLb) ? r.body.weightLb + ' lb' : null].filter(Boolean).join(', '));
    if (r.checks) out.push('Filmstrips: ' + r.checks + (r.lastFix ? '. Latest note: ' + r.lastFix : ''));
    if (r.newRecords.length) out.push('New records: ' + r.newRecords.join(', '));
    out.push('Likely focus next week: ' + FOCUS[r.next.focus].name + '. ' + r.next.why);
    return out;
  }

  return { parse, iso, addDays, diffDays, mondayOf, avg, isNum, byDate, pctVsGame, fitStatus, restDays, fmtInnings, outsFromInnings, armStatus, stats,
    decideFocus, diagnose, bossFor, bossWon, recentDrills, drillIds, DRILLS, FIXES, MOUND_MAX, weekInfo, streak, longestStreak, records, totals, game, badges, retest, buildWeek, hitting, sessionReps, tune, fixRun, weekRecap, recapText, fmtHeight, HEAVY_CAP, FOCUS, RULES, XP, TITLES };
})();
/*LOGIC-END*/
