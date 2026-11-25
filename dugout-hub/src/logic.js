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

  const XP = { A: 100, B: 100, C: 50, record: 25, boss: 50, perLevel: 300, challenge: 20, gamePlay: 5, gameBest: 10, mix: 30, mixWeek: 50 };
  // Arcade games. lower: a smaller score is better (reaction time in ms).
  // The five Arcade games. Older games stay listed (retired) so past best scores and XP still count.
  const GAMES = { derby: { name: 'Home Run Derby', unit: ' HR', lower: false }, kking: { name: 'Strikeout King', unit: ' K', lower: false },
    steal: { name: 'Steal Second', unit: ' SB', lower: false }, outfield: { name: 'Outfield Hero', unit: ' pts', lower: false }, brain: { name: 'Baseball Brain', unit: ' runs', lower: false }, pitchrec: { name: 'Pitch Reader', unit: ' pts', lower: false }, streak: { name: 'Hit Streak', unit: ' hits', lower: false },
    trivia: { name: 'Baseball Trivia (old)', unit: ' of 10', lower: false, retired: true }, reaction: { name: 'Color Call (old)', unit: ' ms', lower: true, retired: true },
    zone: { name: 'Strike Zone Memory (old)', unit: ' of 10', lower: false, retired: true } };
  // Best score per game, and how many times he beat his own best (the first score does not count).
  function gameBests(entries) {
    const best = {}, beats = {};
    for (const e of entries.filter(x => x.kind === 'arcade' && GAMES[x.game] && isNum(x.score)).sort(byDate)) {
      const lower = GAMES[e.game].lower, b = best[e.game];
      if (!b || (lower ? e.score < b.score : e.score > b.score)) { if (b) beats[e.game] = (beats[e.game] || 0) + 1; best[e.game] = { score: e.score, date: e.date }; }
    }
    return { best, beats, total: Object.values(beats).reduce((a, b) => a + b, 0) };
  }
  const TITLES = ['Rookie', 'Starter', 'Slugger', 'All-Star', 'Captain', 'MVP', 'Legend'];
  function game(entries) {
    let xp = 0;
    let bosses = 0;
    for (const e of entries) if (e.kind === 'session' && e.complete) { xp += XP[e.slot] || 0; if (e.boss && e.boss.won) { xp += XP.boss; bosses++; } }
    const breaks = records(entries).breaks;
    xp += breaks * XP.record;
    // Daily challenges, plus a little for the Arcade: the first 3 games each day, and each new game best.
    const chal = new Set(entries.filter(e => e.kind === 'challenge').map(e => e.date)), played = {};
    xp += chal.size * XP.challenge;
    for (const e of entries) if (e.kind === 'arcade') played[e.date] = (played[e.date] || 0) + 1;
    for (const d in played) xp += played[d] * XP.gamePlay;   // every saved game counts, no daily cap
    xp += gameBests(entries).total * XP.gameBest;
    // Arcade Mix: each finished day, plus a bonus for every 7 days in a row.
    const mixDays = [...new Set(entries.filter(e => e.kind === 'mix').map(e => e.date))].sort();
    xp += mixDays.length * XP.mix;
    for (let i = 0, run = 0; i < mixDays.length; i++) { run = i && diffDays(mixDays[i], mixDays[i - 1]) === 1 ? run + 1 : 1; if (run % 7 === 0) xp += XP.mixWeek; }
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
    const sharpBest = entries.filter(e => e.kind === 'machine' && e.of >= 20).reduce((m, e) => Math.max(m, Math.round(e.made / e.of * 20)), 0);
    const bosses = game(entries).bosses, streakBest = longestStreak(entries), dayBest = longestDayStreak(entries);
    const gbx = gameBests(entries).best, gb = {}; for (const k in gbx) gb[k] = gbx[k].score;
    const champs = champMonths(entries).length;
    // have/goal drive the progress bars on badges he has not earned yet.
    return [
      { id: 'first', name: 'First session', how: 'Finish any session.', icon: 'star', on: t.sessions >= 1, have: t.sessions, goal: 1 },
      { id: 'week', name: 'Full week', how: 'Finish Day 1, Day 2 and Day 3 in one week.', icon: 'trophy', on: fullWeek },
      { id: 'streak3', name: 'Three in a row', how: 'Finish Day 1 and Day 2 three weeks in a row.', icon: 'flame', on: streakBest >= 3, have: streakBest, goal: 3 },
      { id: 'tested', name: 'Starting line', how: 'Log your first strength test.', icon: 'flag', on: tested },
      { id: 'breaker', name: 'Record breaker', how: 'Beat one of your records.', icon: 'bolt', on: rec.breaks >= 1 },
      { id: 'sharp', name: 'Sharp eye', how: 'Get 16 solid hits out of 20 on the machine.', icon: 'target', on: sharp, have: sharpBest, goal: 16 },
      { id: 'film', name: 'Film study', how: 'Save your first filmstrip.', icon: 'play', on: entries.some(e => e.kind === 'analysis') },
      { id: 'ten', name: '10 sessions', how: 'Finish 10 sessions.', icon: 'star', on: t.sessions >= 10, have: t.sessions, goal: 10 },
      { id: 'sw500', name: '500 swings', how: 'Log 500 swings.', icon: 'bat', on: t.swings >= 500, have: t.swings, goal: 500 },
      { id: 'boss3', name: 'Boss slayer', how: 'Win 3 Boss Battles.', icon: 'trophy', on: bosses >= 3, have: bosses, goal: 3 },
      { id: 'pu100', name: '100 push-ups', how: 'Log 100 push-ups.', icon: 'bolt', on: t.pushups >= 100, have: t.pushups, goal: 100 },
      { id: 'fire7', name: 'On fire', how: 'Train or finish a daily challenge 7 days in a row.', icon: 'flame', on: dayBest >= 7, have: dayBest, goal: 7 },
      { id: 'whiz', name: 'Baseball brain', how: 'Score 6 runs in Baseball Brain.', icon: 'star', on: gb.trivia >= 10 || gb.brain >= 6, have: Math.min(6, gb.brain || 0), goal: 6 },
      { id: 'quick', name: 'Lightning legs', how: 'Steal 6 bases in one game of Steal Second.', icon: 'bolt', on: (gb.reaction != null && gb.reaction < 350) || gb.steal >= 6, have: Math.min(6, gb.steal || 0), goal: 6 },
      { id: 'champs', name: 'Champions', how: 'Win the title game at the end of a month.', icon: 'trophy', on: champs > 0 }
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
      I('c11', 'Top Half, Bottom Half', 'Machine, skinny bat. Right before each pitch Dad calls "top" (hit a hard grounder) or "bottom" (hit a line drive). 10 pitches. Right result = 1.', { min: 4, sw: 10, pts: 'Right result = 1', max: 10, lvl: 2 }),
      I('c12', 'Front Toss Mini Balls', 'Dad sits behind the screen 12 feet away and tosses mini balls. Skinny bat. 20 tosses. Solid hit = 1.', { min: 4, sw: 20, pts: 'Solid hit = 1', max: 20 }),
      I('c13', 'Rapid Fire Tee', 'Dad reloads the tee as fast as he can. 10 swings in 45 seconds. Solid contact = 1. Stay balanced, not rushed.', { min: 3, sw: 10, pts: 'Solid = 1', max: 10 }),
      I('c14', 'Hit the Towel', 'Hang a towel on the net as a target. 15 machine pitches. Hit the towel = 2, just next to it = 1.', { min: 5, sw: 15, pts: 'Towel 2, close 1', max: 30, lvl: 2 }),
      I('c15', 'Machine Ladder', 'Machine starts slow. Every 3 solid hits in a row, Dad speeds it up one notch. Points = the highest notch you hit.', { min: 5, sw: 15, pts: 'Points = top notch', max: 10, lvl: 2 }),
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
      I('s11', 'Overspeed Swings', 'Sensor on. 5 max swings with the SKLZ unloaded bat, then 5 with the game bat. Points = your best game-bat speed.', { min: 3, sw: 10, pts: 'Points = top mph', max: 90 }),
      I('s12', 'Heavy, Then Hit', 'Radar up. 2 CamWood tee swings, then 3 game-bat tee swings. 3 rounds. Any ball over your average exit speed = 1 point.', { min: 5, heavy: 6, sw: 15, pts: 'Over average = 1', max: 9 }),
      I('s13', 'Bat Speed Bingo', 'Sensor on, tee. Targets: your average, average +2, average +4, a new best. Hit all four in 12 swings for bingo. Each target = 1 point.', { min: 4, sw: 12, pts: 'Each target = 1', max: 4, lvl: 2 }),
      I('s14', 'Launch Pad', 'Tee a little out front. 10 full-effort swings into the net with the radar on. Count balls over your average exit speed.', { min: 3, sw: 10, pts: 'Over average = 1', max: 10 }),
      I('s15', 'Hop Into the Swing', 'Skater hop into your stance, land, then explode into a swing. 5 with no ball, then 5 off the tee. Sensor on.', { min: 3, sw: 10, lvl: 2 }),
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
      I('p11', 'Inside Tee', 'Tee on the inside corner, a little out front. Keep your hands inside the ball. 10 swings. Line drive to the pull side = 1.', { min: 3, sw: 10, pts: 'Pull-side liner = 1', max: 10 }),
      I('p12', 'Long Through the Ball', 'Put a cone 6 feet past the tee toward the net. Swing so your barrel finishes pointing at the cone. 10 swings. Dad scores each good finish = 1.', { min: 3, sw: 10, pts: 'Good finish = 1', max: 10 }),
      I('p13', 'Low Strikes', 'Aim the machine low in the zone. Skinny bat. 10 pitches. Line drive = 2, hard grounder = 1, pop-up = 0.', { min: 4, sw: 10, pts: 'Liner 2, hard grounder 1', max: 20, lvl: 2 }),
      I('p14', 'Deep Tee, Other Way', 'Tee set deep, back toward the catcher. Let the ball get deep and hit it the other way. 10 swings. Opposite-field line drive = 2.', { min: 3, sw: 10, pts: 'Oppo liner = 2', max: 20 }),
      I('p15', 'Slow-Motion Mirror', 'Find a mirror or dark window. 5 slow-motion swings checking that your hands stay inside, then 5 full tee swings the same way.', { min: 3, sw: 10 }),
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
      I('t11', 'One, Two, Three', 'Tee, then machine. Load on Dad\'s "one," stride on "two," swing on "three." 5 tee swings, then 5 pitches using the same rhythm.', { min: 3, sw: 10 }),
      I('t12', 'Let It Travel', 'Machine, skinny bat. Let the ball get deep and hit it to the opposite field. 10 pitches. Oppo contact = 1.', { min: 4, sw: 10, pts: 'Oppo contact = 1', max: 10 }),
      I('t13', 'Hold It', 'Front toss. Dad sometimes pauses before he tosses. Stay loaded and don\'t jump. 12 tosses. On time and balanced = 1.', { min: 4, sw: 12, pts: 'On time = 1', max: 12 }),
      I('t14', 'Move Closer', 'Move the machine 5 feet closer for 5 pitches (it feels faster), then back for 5. Solid hit = 1.', { min: 4, sw: 10, pts: 'Solid = 1', max: 10, lvl: 2 }),
      I('t15', 'Sit Fastball', 'Machine on its fastest setting. Only swing at strikes in your favorite spot. 10 pitches. Smart take or solid hit = 1.', { min: 4, sw: 10, pts: 'Smart take or solid = 1', max: 10, lvl: 2 }),
      I('t10', 'Hit It Where It\'s Pitched', 'Machine, skinny bat. Inside pitch = pull it, outside = other way. 10 pitches. Right direction = 1 point.', { min: 4, sw: 10, pts: 'Right direction = 1', max: 10 })
    ]
  };
  // Fix-it drills aimed at what shows up in games.
  const FIXES = {
    looking: { title: 'Strikeouts looking', drill: I('f1', 'Two-Strike Battle', 'Every machine pitch is strike two. Swing at strikes, foul off the tough ones. 10 pitches. Stay alive = 1 point.', { min: 4, sw: 10, pts: 'Stay alive = 1', max: 10 }) },
    grounders: { title: 'Lots of ground-ball outs', drill: I('f2', 'Barrier Tee', 'Bucket just in front of the tee. Hit line drives over it. 10 swings. Clean line drive = 2 points.', { min: 4, sw: 10, pts: 'Clean liner = 2', max: 20 }) },
    flies: { title: 'Lots of fly and pop outs', drill: I('f3', 'Low Tee Liners', 'Tee at the knees. Hit the top half of the ball. 10 swings. Line drive or hard grounder = 1 point.', { min: 3, sw: 10, pts: 'Liner or hard grounder = 1', max: 10 }) },
    whiffs: { title: 'Lots of strikeouts swinging', drill: I('f4', 'Short Bat Hands', 'Choke up 3 inches. 10 machine pitches. Short swing, just hit it. Contact = 1 point.', { min: 3, count: 10, sw: 10, pts: 'Contact = 1', max: 10 }) },
    // From the swing reader in the Film room.
    head: { title: 'Head drifting toward the pitcher', drill: I('f5', 'Quiet Head', 'Tee. Dad holds a glove just in front of your face, toward the pitcher. Swing without your head touching it. 10 swings. No touch = 1 point.', { min: 3, sw: 10, pts: 'No touch = 1', max: 10 }) },
    drop: { title: 'Head dropping during the swing', drill: I('f5', 'Quiet Head', 'Tee. Dad holds a glove just above your head. Swing without your head moving away from it. 10 swings. Eyes level = 1 point.', { min: 3, sw: 10, pts: 'Eyes level = 1', max: 10 }) },
    stride: { title: 'Stride too long', drill: I('f6', 'Tape Stride', 'Dad puts a strip of tape where a good stride lands. Step to the tape, not past it. 10 tee swings. On the tape = 1 point.', { min: 3, sw: 10, pts: 'On the tape = 1', max: 10 }) },
    foot: { title: 'Front foot down late', drill: I('f7', 'Foot Down First', 'Machine. Get your front foot down by the time the ball comes out. Dad says "late" if it is not. 10 pitches. On time = 1 point.', { min: 4, sw: 10, pts: 'Foot on time = 1', max: 10 }) },
    seq: { title: 'Shoulders turning before the hips', drill: I('f8', 'Hips First', 'No ball. Step, turn your back hip hard while your chest stays closed, then let the bat come. 8 swings. Then 5 tee swings the same way.', { min: 3, sw: 13 }) },
    leg: { title: 'Front leg soft at contact', drill: I('f9', 'Firm Front Leg', 'Tee. Land, then push your front leg straight as you turn, like stepping on the brakes. Freeze at contact for 2 seconds. 8 swings.', { min: 3, sw: 8 }) },
    balance: { title: 'Falling forward at the finish', drill: I('f10', 'Hold Your Finish', 'Tee. Hold your finish for 3 seconds after every swing without stepping. 10 swings. Wobble-free = 1 point.', { min: 3, sw: 10, pts: 'Wobble-free = 1', max: 10 }) }
  };
  const WARMUPS = [
    I('w1', 'Warm up', '10 arm circles each way, 10 leg swings each leg, 10 easy swings with no ball.'),
    I('w2', 'Mirror Me', 'Dad does a move, you copy it fast: skips, side shuffles, high knees, arm circles. 2 minutes.'),
    I('w3', 'Base Path Warm-up', 'Jog to a cone and back 4 times: forward, side shuffle, backpedal, sprint.')
  ];
  const FUN_C = [
    I('z12', 'Frog Jumps', 'Squat low, jump forward like a frog. 8 jumps, 2 times.'),
    I('z13', 'Line Hops', 'Hop over a line, front and back, as fast as you can for 20 seconds. 3 rounds.')];
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
    // Latest side-view swing video from the last 2 weeks: its first problem becomes a target too.
    const vid = entries.filter(e => e.kind === 'analysis' && e.swing && e.swing.ok && Array.isArray(e.swing.faults) && e.date > addDays(today, -14) && e.date <= today).sort(byDate).pop();
    // A call Dad marked wrong never drives a drill.
    const wrong = id => vid && entries.some(r => r.kind === 'review' && r.of === vid.id && r.check === id && r.agree === false &&
      !entries.some(q => q.kind === 'review' && q.of === vid.id && q.check === id && (q.ts || 0) > (r.ts || 0)));
    const vf = vid && vid.swing.faults.find(id => FIXES[id] && !wrong(id));
    if (vf) { const ck = (vid.swing.checks || []).find(c => c.id === vf) || {};
      out.push({ id: vf, why: 'Swing video on ' + vid.date.slice(5).replace('-', '/') + ': ' + String(ck.label || FIXES[vf].title).toLowerCase() + ' was ' + String(ck.value || 'off').replace(/^./, c => c.toLowerCase()) + ' (target: ' + String(ck.target || 'see Film room').toLowerCase() + ').', weight: 0.7, video: true }); }
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

  // Pitching fix-it drills. Every one stays inside the 20-pitch practice cap.
  const PFIXES = {
    wild: { title: 'Missing the strike zone', drill: I('q1', 'Glove Target', "Dad kneels at the plate and holds his glove still in the middle. Hit the glove. 15 pitches at most. Strike = 1 point.", { min: 5, pitches: 15, pts: 'Strike = 1', max: 15 }) },
    deep: { title: 'Falling behind in the count', drill: I('q2', 'Strike One', 'Every pitch is the first pitch to a new batter. Get strike one. 12 pitches at most. Strike = 1 point.', { min: 5, pitches: 12, pts: 'Strike one = 1', max: 12 }) },
    hbp: { title: 'Pitches running inside and hitting batters', drill: I('q3', 'Stay on the Line', 'Tape a line from the rubber toward the plate. Land your front foot on it and finish toward Dad. 12 pitches at most. On the line = 1 point.', { min: 5, pitches: 12, pts: 'Foot on the line = 1', max: 12 }) },
    hittable: { title: 'Strikes are getting hit hard', drill: I('q4', 'Paint the Knees', 'Tape a strip at knee height across the net. Pitch below it but still in the zone. 15 pitches at most. Low strike = 1 point.', { min: 5, pitches: 15, pts: 'Low strike = 1', max: 15 }) }
  };
  // The limits below are rules written for this hub from common youth coaching targets, not research cut-offs.
  const PR = { strikePct: 0.55, bbPerInn: 1, pPerBatter: 4.5, fpsPct: 0.5, hbp: 2, hPerInn: 1.5 };
  // Older GameChanger outings were saved with long field names. Read both styles.
  const PITCH_ALIASES = { bb: 'walks', k: 'strikeouts', h: 'hitsAllowed', bf: 'battersFaced', hbp: 'hitBatters' };
  function normPitch(e) {
    if (!e || e.kind !== 'pitch') return e;
    let o = null;
    for (const k in PITCH_ALIASES) if (!isNum(e[k]) && isNum(e[PITCH_ALIASES[k]])) { o = o || Object.assign({}, e); o[k] = e[PITCH_ALIASES[k]]; }
    return o || e;
  }
  function pitchDiagnose(entries, today) {
    entries = entries.map(normPitch);
    const start = addDays(today, -28), g = entries.filter(e => e.kind === 'pitch' && e.where !== 'practice' && e.date > start && e.date <= today);
    const tot = k => g.reduce((s, e) => s + (isNum(e[k]) ? e[k] : 0), 0), has = k => g.filter(e => isNum(e[k]));
    const out = [], pc = x => Math.round(x * 100) + '%';
    const withS = has('strikes'), sP = withS.reduce((s, e) => s + e.pitches, 0), sS = withS.reduce((s, e) => s + e.strikes, 0);
    const withBB = has('bb'), bbOuts = withBB.reduce((s, e) => s + (e.outs || 0), 0), bb = withBB.reduce((s, e) => s + e.bb, 0);
    if (sP >= 40 && sS / sP < PR.strikePct) out.push({ id: 'wild', why: sS + ' strikes in ' + sP + ' pitches (' + pc(sS / sP) + ') over the last 4 weeks. The target is ' + pc(PR.strikePct) + ' or better.', weight: 0.6 + (PR.strikePct - sS / sP) });
    else if (bbOuts >= 9 && bb / (bbOuts / 3) >= PR.bbPerInn) out.push({ id: 'wild', why: bb + ' walks in ' + fmtInnings(bbOuts) + ' innings (' + (bb / (bbOuts / 3)).toFixed(1) + ' per inning). The target is under ' + PR.bbPerInn + ' per inning.', weight: 0.6 });
    const withF = has('fps').filter(e => isNum(e.bf)), fBF = withF.reduce((s, e) => s + e.bf, 0), fS = withF.reduce((s, e) => s + e.fps, 0);
    const withBF = has('bf'), bP = withBF.reduce((s, e) => s + e.pitches, 0), bF = withBF.reduce((s, e) => s + e.bf, 0);
    if (fBF >= 10 && fS / fBF < PR.fpsPct) out.push({ id: 'deep', why: 'First-pitch strikes to ' + fS + ' of ' + fBF + ' batters (' + pc(fS / fBF) + '). The target is ' + pc(PR.fpsPct) + ' or better.', weight: 0.55 });
    else if (bF >= 10 && bP / bF >= PR.pPerBatter) out.push({ id: 'deep', why: bP + ' pitches to ' + bF + ' batters (' + (bP / bF).toFixed(1) + ' per batter). Under ' + PR.pPerBatter + ' means he is getting ahead.', weight: 0.5 });
    const hbp = tot('hbp'); if (hbp >= PR.hbp) out.push({ id: 'hbp', why: hbp + ' hit batters in the last 4 weeks.', weight: 0.45 });
    const withH = has('h'), hOuts = withH.reduce((s, e) => s + (e.outs || 0), 0), hh = withH.reduce((s, e) => s + e.h, 0);
    if (hOuts >= 9 && hh / (hOuts / 3) >= PR.hPerInn && !out.some(x => x.id === 'wild')) out.push({ id: 'hittable', why: hh + ' hits in ' + fmtInnings(hOuts) + ' innings (' + (hh / (hOuts / 3)).toFixed(1) + ' per inning) while throwing strikes. Next step is keeping the ball low.', weight: 0.4 });
    // Practice: Strike Zone Tic-Tac-Toe scores, when there are no game numbers to go on.
    if (!out.length) {
      const prac = entries.filter(e => e.kind === 'session' && e.date > start && e.date <= today && e.drillPts && isNum(e.drillPts.m2)).map(e => e.drillPts.m2);
      if (prac.length >= 3 && avg(prac) < 3) out.push({ id: 'wild', why: 'Strike Zone Tic-Tac-Toe averaged ' + avg(prac).toFixed(1) + ' of 9 squares over his last ' + prac.length + ' practices.', weight: 0.3 });
    }
    return out.sort((a, b) => b.weight - a.weight).map(x => Object.assign({ title: PFIXES[x.id].title, pitching: true }, x));
  }
  // Strength tests and pitch speed, compared with his own earlier numbers only (no age charts).
  function bodyNotes(entries, today) {
    const out = [], st = entries.filter(e => e.kind === 'strength').sort(byDate);
    if (st.length >= 2) {
      const a = st[st.length - 2], b = st[st.length - 1];
      for (const [k, name, unit, tip] of [['jump', 'Long jump', ' in', 'Add Stick the Landing and squat jumps on the bodyweight day.'], ['pushups', 'Push-ups', '', 'Keep push-ups in every session; try 3 sets instead of 2.'], ['plank', 'Plank', ' sec', 'Add one extra plank hold at the end of each session.']]) {
        if (!isNum(a[k]) || !isNum(b[k])) continue;
        const d = b[k] - a[k];
        out.push(d < 0 ? { kind: 'down', text: name + ' went down: ' + a[k] + unit + ' → ' + b[k] + unit + ' (' + d + unit + '). ' + tip }
          : { kind: 'up', text: name + ' ' + (d > 0 ? 'improved: ' : 'held: ') + a[k] + unit + ' → ' + b[k] + unit + (d > 0 ? ' (+' + d + unit + ').' : '.') });
      }
    } else if (st.length === 1) out.push({ kind: 'info', text: 'One strength test so far. The next one shows what improved.' });
    const v = entries.filter(e => e.kind === 'velo' && e.date <= today), val = e => isNum(e.max) ? e.max : e.avg;
    const now = v.filter(e => e.date > addDays(today, -28)).map(val).filter(isNum), prev = v.filter(e => e.date <= addDays(today, -28) && e.date > addDays(today, -56)).map(val).filter(isNum);
    if (now.length && prev.length) {
      const d = Math.max.apply(null, now) - Math.max.apply(null, prev);
      out.push(d <= -2 ? { kind: 'down', text: 'Top pitch speed is down ' + Math.abs(d).toFixed(1) + ' mph versus the 4 weeks before (' + Math.max.apply(null, prev) + ' → ' + Math.max.apply(null, now) + '). Check he is rested and not sore before adding more throwing; a drop is often tiredness.' }
        : { kind: d > 0 ? 'up' : 'info', text: 'Top pitch speed ' + (d > 0 ? 'up ' + d.toFixed(1) + ' mph' : 'steady') + ' versus the 4 weeks before (' + Math.max.apply(null, prev) + ' → ' + Math.max.apply(null, now) + ').' });
    }
    return out;
  }
  // One cue per drill, in his words. Shown under the drill and used for "next time" tips after a low score.
  const TIPS = {
    fd1: 'Glove down early, then give with the ball.', fd2: 'Get low with your butt down, not your head.', fd3: 'Turn and run first, look for the ball second.', fd4: 'Catch it near your chest so the transfer is short.',
    fd5: 'Stay low and keep the glove open to the ball.', fd6: 'Hop toward Dad, then throw. Easy effort.', fd7: 'Call it loud, then get under it early.',
    sp1: 'Quick, light steps. Pump your arms.', sp2: 'Crossover step first, don\'t stand up.', sp3: 'Stay on the balls of your feet.', sp4: 'Run through the cone, don\'t slow down before it.',
    sp5: 'Lean in like a race car on the turn.', sp6: 'Low and ready. Don\'t guess.', lw1: 'Light feet, eyes up.', lw2: 'Stay low, don\'t cross your feet.', lw3: 'Soft, quick hops.',
    cd1: 'Hold still. No bouncing.', cd2: 'Slow breaths in each pose.', cd3: 'Slow breaths into your belly.',
    k2: 'Turn your shoulders, not just your arms.', k3: 'Hips stay still. Squeeze your belly.', k5: 'Slow. Low back stays on the floor.', k6: 'Swing your arms and land soft.', k7: 'Freeze on each landing for a second.', k8: 'Hips turn first, chest follows.',
    a1j: 'Land soft on the balls of your feet.', a1w: 'Knees over ankles. Breathe.', a2i: 'Body straight like a board.', a2b: 'Back flat like a table.', a3p: 'Flat back. Squeeze your belly.', a3d: 'Move slow. Low back stays down.',
    z10: 'Land soft.', z11: 'Body straight like a board.',
    h1: 'Watch the ball all the way into your hand.', h2: 'Find the number as soon as the ball leaves the machine.', h3: 'Small taps. Watch the balloon, not the bat.', h4: 'Hands ready, eyes on the ball, not Dad.',
    h5: 'Read it out of his hand, then call it.', h6: 'Soft hands. Keep the barrel flat.', h7: 'Catch it out front, then a quick flip.',
    c1: 'Watch the ball all the way to the bat. See it hit.', c2: 'Inside: get the bat out front. Outside: let it get deeper.',
    c3: 'Hit the middle of the ball, not the bottom.', c4: 'Hands go straight to the ball. No big loop.',
    c5: 'Stay through the front ball. Short and level.', c6: 'Decide early. See the color as soon as it leaves.',
    c7: 'Let the ball get deep and push it the other way.', c8: 'Soft hands. Tap it, do not swing hard.',
    c9: 'Relax after a miss. Breathe, then see the next one.', c10: 'Bunt: catch the ball with the bat. Swing: back to normal.',
    s1: 'The heavy bat makes the game bat feel light. Swing it fast.', s2: 'Use the walk-in to build speed, then stay balanced.',
    s3: 'Fast hands, not a big muscle swing.', s4: 'Hit the back of the ball for the loud crack.',
    s5: 'Push off the back foot hard, then turn.', s6: 'Swing hard but stay on balance. Crushed balls come from the barrel.',
    s7: 'Freeze tall at the finish. Chest to the target.', s8: 'Make the whoosh happen in front of the plate.',
    s9: 'Hips turn first, then shoulders, then the bat.', s10: 'Full effort every swing. Rest so each one is fast.',
    p1: 'Smooth first. Speed comes later.', p2: 'Line drives over the bucket. Level swing through the ball.',
    p3: 'Low pitch: bend your knees, do not drop your hands.', p4: 'Pull the knob to the ball with your bottom hand.',
    p5: 'Keep your hands close to your body. Do not cast the bat out.', p6: 'Aim for the middle of the net. Liners win.',
    p7: 'Top hand pushes the barrel through. Palm up at contact.', p8: 'Out front means pull it. Deep means push it the other way.',
    p9: 'Hit it right back where it came from.', p10: 'Knob first, then the barrel whips through.',
    t1: 'Stay ready for fast. Adjust for slow.', t2: 'Load easy and early. Be ready before the ball.',
    t3: 'Decide early. Only swing at the colors that tell you to.', t4: 'Choke up and just put it in play.',
    t5: 'Wait for the real toss. Stay loaded.', t6: 'Front foot down when the ball comes out.',
    t7: 'Ahead in the count, wait for your pitch. Behind, protect the plate.', t8: 'Stay back on slow. Start earlier on fast.',
    t9: 'Be loaded and ready when the ball leaves the machine.', t10: 'Inside: pull it. Outside: go the other way.',
    f1: 'Choke up. Foul off the tough ones. Swing at strikes.', f2: 'Swing level and hit the middle of the ball.',
    f3: 'Hit the top half of the ball. Drive it, do not lift it.', f4: 'Short and quick. Just make contact.',
    f5: 'Keep your head still. Eyes stay on the ball.', f6: 'Small step. Land soft on the tape.',
    f7: 'Get your front foot down early, then swing.', f8: 'Back hip turns first. Keep your chest closed.',
    f9: 'Brace your front leg like stepping on the brakes.', f10: 'Swing hard and stay balanced. Hold the finish.',
    q1: 'Eyes on the glove the whole time. Throw to it, do not aim.', q2: 'First pitch is a strike. Easy speed, hit the middle of the zone.',
    q3: 'Front foot lands on the line. Finish toward Dad.', q4: 'Reach out in front and finish low. Knees, not belt.',
    m1: 'Easy throws. Point your glove at Dad, then throw.', m2: 'Pick a square, look at it, then throw. Same motion every time.',
    g1: 'Stay low. Glove out in front, eyes on the ground.', g2: 'Stand tall over your back leg. Balance before you go.',
    g3: 'Small, quick steps. Stay on the balls of your feet.',
    w1: 'Loosen up. Easy and smooth.', w2: 'Copy fast. Stay light on your feet.', w3: 'Run hard on the sprint, easy on the rest.',
    b1: 'Swing your fastest. Do not worry about the ball.', b2: 'Hit it hard on the barrel. The radar counts your best.',
    b3: 'See the ball, hit the ball. Count your solid ones.',
    x1: 'Swing your arms and land on both feet.', x2: 'Flat back. Chest to the ground every time.', x3: 'Flat back. Squeeze your stomach.',
    a1: 'Sit back like there is a chair. Chest up.', a2: 'Straight line from head to heels.', a3: 'Slow and controlled. Do not yank your neck.',
    z1: 'Sit back like there is a chair. Chest up.', z2: 'Straight line from head to heels.', z3: 'Slow and controlled. Do not yank your neck.',
    z4: 'Knees just off the ground. Slow and steady.', z5: 'Hips up. Hands and feet together.', z6: 'Big step back. Front knee over the ankle.',
    z7: 'Flat back. Squeeze your stomach.', z8: 'Land soft and freeze. Knees bend, not cave in.', z9: 'Squeeze your back. Arms and legs off the floor.',
    k1: 'Twist slow. Keep the water quiet.', k4: 'Turn your hips, then throw. Same as a swing.', k4r: 'Stand tall. Do not let the water slosh.',
    l1: 'Tell Dad your best numbers. He saves them so you get credit.'
  };
  // Why each drill matters, in his words. Shown under the tip so a drill is a reason, not just an order.
  const WHY = {
    fd1: 'Soft hands turn bad hops into outs.', fd2: 'Reading and moving to the ball is half of every ground ball.', fd3: 'The drop step is how outfielders get to balls over their head.',
    fd4: 'A quick transfer gets the ball out of your hand sooner, which gets more outs.', fd5: 'Most balls aren\'t hit right at you. This covers both sides.', fd6: 'The crow hop adds power to your throw without straining your arm.',
    fd7: 'Calling the ball and getting under it early makes pop-ups automatic.',
    sp1: 'Fast feet make you quicker on the bases and in the field.', sp2: 'Trains the exact first step that wins a steal.', sp3: 'Builds rhythm and quick feet.', sp4: 'Beating out grounders starts with running hard through the bag.',
    sp5: 'A good turn at first can turn a single into a double.', sp6: 'Reacting fast on the bases keeps you from getting picked off.',
    lw1: 'Wakes up your feet and gets your body warm.', lw2: 'Side-to-side quickness for fielding and leads.', lw3: 'Gets your legs springy before you swing.',
    cd1: 'Cooling down helps your muscles recover for next time.', cd2: 'Stretching keeps you loose so you can turn and throw freely.', cd3: 'Slowing down your breathing helps your body recover.',
    k2: 'Strong twisting muscles make a faster, steadier swing.', k3: 'A steady middle keeps your swing on plane.', k5: 'Teaches your core to stay tight while arms and legs move, like in a swing or pitch.',
    k6: 'Jumping builds the leg power that drives hits and throws.', k7: 'Side-to-side power helps you push off the rubber and run the bases.', k8: 'Practices turning your hips fast without a ball.',
    a1j: 'Fast legs make a fast swing.', a1w: 'Strong legs keep you balanced in your stance.', a2i: 'Builds the same push as push-ups, a little easier.', a2b: 'Strong shoulders and core in one move.', a3p: 'A strong middle helps you turn fast.', a3d: 'A strong middle helps you turn fast.',
    z10: 'Fast legs make a fast swing.', z11: 'Builds the same push as push-ups, a little easier.',
    h1: 'Tracking a ball into your hand is the same skill as tracking a pitch.', h2: 'Seeing the number means you are seeing the ball well, which helps you hit it.', h3: 'Trains your eyes and hands to work together on a moving target.',
    h4: 'Makes your hands react faster to what your eyes see.', h5: 'Reading a ball early is how hitters pick up pitches.', h6: 'Builds soft hands and barrel control.', h7: 'Quicker glove-to-hand means quicker throws.',
    c1: 'Seeing the ball hit the bat is how you stop missing.', c2: 'Pitchers throw everywhere. This teaches you to hit every spot.',
    c3: 'Hitting the middle of the ball makes line drives, and line drives are hits.', c4: 'A short swing gets to the ball faster, so fast pitches stop beating you.',
    c5: 'It trains your bat to stay level through the ball instead of chopping.', c6: 'Good hitters decide fast. This makes your brain quicker.',
    c7: 'Hitting it the other way means outside pitches become hits, not outs.', c8: 'Soft hands help you control the bat and the barrel.',
    c9: 'Shaking off a miss is how you stay strong for the next pitch.', c10: 'A good bunt wins games, and it teaches you to watch the ball onto the bat.',
    s1: 'Swinging heavy, then light, teaches your body to move faster.', s2: 'Moving into the swing builds speed you can carry into games.',
    s3: 'Bat speed comes from quick hands more than big muscles.', s4: 'A loud crack means you hit it on the sweet spot.',
    s5: 'Pushing off the back leg powers the swing from the ground up.', s6: 'Harder hit balls get through the infield faster.',
    s7: 'Holding the finish builds strength and balance at the end of the swing.', s8: 'Speed has to peak at the ball, not before or after.',
    s9: 'Power starts in the hips. The bat comes last, like a whip.', s10: 'Full-effort swings train your top speed.',
    p1: 'Slow, smooth reps build the right swing path into muscle memory.', p2: 'Line drives turn into hits more than any other ball.',
    p3: 'Pitches come high and low. This makes both feel normal.', p4: 'Your bottom hand steers the bat. A strong bottom hand means a direct swing.',
    p5: 'Hands close to your body make a shorter, faster swing.', p6: 'Line drives are the hits that win games.',
    p7: 'Your top hand gives the swing its power at contact.', p8: 'Where you hit the ball decides where it goes.',
    p9: 'Up the middle is the biggest open space on the field.', p10: 'Knob first keeps the swing short so the barrel snaps through.',
    t1: 'Real pitchers change speeds. This keeps you ready for anything.', t2: 'Starting on time is half of hitting.',
    t3: 'Smart hitters only swing at pitches they can crush.', t4: 'With two strikes, putting the ball in play beats striking out.',
    t5: 'Waiting for the real pitch stops you from swinging too early.', t6: 'If your front foot lands late, you are late on every pitch.',
    t7: 'Knowing the count tells you when to swing big and when to protect.', t8: 'Staying on time when speeds change is what good hitters do.',
    t9: 'Being loaded early gives you time to see the pitch.', t10: 'Hitting the ball where it is pitched makes every pitch hittable.',
    f1: 'Fouling off tough pitches keeps your at-bat alive.', f2: 'Too many ground balls are easy outs. This makes line drives.',
    f3: 'Too many fly balls are easy outs. This makes line drives.', f4: 'A shorter swing means more contact and fewer strikeouts.',
    f5: 'If your head moves, your eyes lose the ball.', f6: 'A long stride throws off your timing and drops your head.',
    f7: 'Your foot has to be down before you can swing on time.', f8: 'Hips before shoulders is where real power comes from.',
    f9: 'A firm front leg stops your body and whips the bat through.', f10: 'Balance at the finish means the whole swing was under control.',
    q1: 'Strikes make batters swing. Balls give them free bases.', q2: 'After strike one, batters are on defense and you are in charge.',
    q3: 'Landing on the line points your whole body at the target.', q4: 'Low strikes are hard to hit hard. They turn into ground-ball outs.',
    m1: 'A good warm-up throw keeps your arm healthy.', m2: 'Hitting your spot is more important than throwing hard.',
    g1: 'Fielders who stay low get to more balls.', g2: 'Good balance at the top makes every pitch the same.', g3: 'Quick feet help you field, run and pitch.',
    w1: 'Warm muscles move faster and get hurt less.', w2: 'It wakes up your body and your reaction speed.', w3: 'It warms up the muscles you use running the bases.',
    b1: 'This is your starting line. Next month you try to beat it.', b2: 'This shows how hard you hit it now, so you can see it grow.',
    b3: 'This shows how often you square it up, so you can see it grow.',
    x1: 'Jumping shows your leg power, which drives your swing and your pitches.', x2: 'Push-ups build arm and chest strength for throwing and swinging.',
    x3: 'A strong middle connects your legs to your arms in every swing.',
    a1: 'Strong legs power your swing and your pitches.', a2: 'Push-ups build arm and chest strength for throwing and swinging.', a3: 'A strong middle helps you turn fast.',
    z1: 'Strong legs power your swing and your pitches.', z2: 'Push-ups build arm and chest strength for throwing and swinging.', z3: 'A strong middle helps you turn fast.',
    z4: 'It builds your shoulders, which protect your throwing arm.', z5: 'It builds your back and shoulders, the muscles behind the throw.',
    z6: 'One leg at a time builds balance for striding and pitching.', z7: 'A strong middle connects your legs to your arms.',
    z8: 'Landing soft and steady protects your knees and builds balance.', z9: 'A strong back keeps you standing tall in your swing and delivery.',
    k1: 'Turning with control is what makes a swing fast and steady.', k4: 'Throwing a med ball trains the same hip turn as your swing.',
    k4r: 'Holding steady builds a strong middle.', l1: 'Logging your numbers is how you earn credit and see yourself get better.'
  };
  // Demo videos, checked by hand: each one exists, allows playing inside other apps, and matches the drill.
  // Several drills share a video when they teach the same movement.
  const VIDEOS = {
    fence: { id: '3RyLpYSzjsQ', title: 'The Fence Drill', by: 'Baseball Tutorials' },
    bottom: { id: 'KAaVirs7UcM', title: 'Tee Drill: Bottom Hand', by: 'Silver Sluggers Academy' },
    tophand: { id: '3USSmzO001k', title: 'Top Hand and Bottom Hand Drills', by: 'DNA Sports' },
    bunt: { id: 'ueahw9wYwZ0', title: 'How to Place Your Bunt Down the Line', by: 'Little League' },
    strike1: { id: 'mHI5hfxIMWY', title: 'The Importance of Strike One', by: 'The Catching Academy Network' },
    stridep: { id: 'e7665TI1C6U', title: 'Pitching: Stride Direction', by: 'Jaime Baseball Academy' },
    finishp: { id: 'FA4S6Qafapc', title: 'Pitching: Follow Through Drills', by: 'Jaime Baseball Academy' },
    head: { id: 'blmWIexJDH4', title: 'Head Down and Back Foot Drills', by: 'Silver Sluggers Academy' },
    pepper: { id: 'U2lqU2ESp9Q', title: 'Pepper Practice', by: 'Mike Scott Baseball' },
    twostrike: { id: 'PTpq20VYyM8', title: 'The Two-Strike Approach', by: "DICK'S Sporting Goods" },
    strideh: { id: 'BbxxaQpOjHg', title: 'Stride and Separation Tee', by: 'HyperFocus Helmet' },
    timing: { id: 'tTBSOTw7XoQ', title: '3 Drills for Timing and Load', by: 'Driveline Baseball' },
    frontleg: { id: '0QvIPPN3edQ', title: 'Best Drill to Teach a Firm Front Side', by: 'Legends Baseball Camps' },
    balance: { id: '7o6GG3rFr88', title: 'Balance While Hitting', by: 'DNA Sports' },
    liners: { id: 'Usp8V3iarj0', title: 'Fence Drill with Tee for Line Drives', by: 'Baseballsmith' },
    lowtee: { id: 'Ad3K8y1w6Fc', title: 'Low Tee Drill', by: 'Driveline Baseball' },
    legbal: { id: 'bec3YTm25uY', title: 'Pitching Drill: Balance', by: 'BASE by Pros' },
    field: { id: 'xoygxT47to0', title: 'Fielding a Ground Ball', by: 'Ripken Baseball' },
    pushup: { id: '4CdGuXoPht0', title: 'How to Do Push-Ups', by: 'The PE Guy' },
    plank: { id: 'Sq_Jc_JAIr8', title: 'How to Do a Plank in 1 Minute', by: 'John Sifferman' },
    jump: { id: 'dVgtvAXeBQw', title: 'Standing Long Jump Basics', by: 'Athletics Coach' },
    squat: { id: '-2eEYWqn2wk', title: 'Squat Technique', by: 'The Move Crew' }
  };
  const DRILL_VIDEO = { p5: 'fence', p4: 'bottom', p7: 'tophand', c10: 'bunt', q1: 'strike1', m2: 'strike1', q2: 'strike1', q3: 'stridep', q4: 'finishp', f5: 'head', c8: 'pepper',
    f8: 'head', s9: 'head', f1: 'twostrike', t4: 'twostrike', f6: 'strideh', f7: 'timing', t6: 'timing', t9: 'timing', f9: 'frontleg', f10: 'balance', s7: 'balance',
    f2: 'liners', p2: 'liners', p6: 'liners', f3: 'lowtee', p3: 'lowtee', g2: 'legbal', g1: 'field', x2: 'pushup', a2: 'pushup', z2: 'pushup', x3: 'plank', z7: 'plank',
    x1: 'jump', z8: 'jump', a1: 'squat', z1: 'squat' };
  // Every video above played with no ad in at least 2 live plays (Nov 21, 2026). Any that later shows ads goes here to hide it.
  const ADS = {};
  function videoFor(item) { const k = DRILL_VIDEO[item.id]; return k && !ADS[k] ? VIDEOS[k] : null; }
  const BOSS_WHY = { speed: 'Beating your own top speed is how you get faster.', contact: 'Beating your own best shows your eye is getting better.', duel: 'Competing makes every swing count.' };
  const WARM_WHY = { 'Warm up': WHY.w1, 'Mirror Me': WHY.w2, 'Base Path Warm-up': WHY.w3 };
  function whyFor(item) { return item.id === 'boss' && item.boss ? BOSS_WHY[item.boss.dad ? 'duel' : item.boss.kind] : /^w\d+$/.test(item.id) ? WARM_WHY[item.title] || null : WHY[item.id] || null; }
  const BOSS_TIPS = { speed: 'Swing your fastest on all 5. Rest between swings.', contact: 'See the ball. Short, quick swing.', duel: 'Line drives score double. Stay level.' };
  // Warm-ups are renumbered per day (w0, w1...), so they are matched by name.
  const WARM_TIPS = { 'Warm up': TIPS.w1, 'Mirror Me': TIPS.w2, 'Base Path Warm-up': TIPS.w3 };
  function tipFor(item) { return item.id === 'boss' && item.boss ? BOSS_TIPS[item.boss.dad ? 'duel' : item.boss.kind] : /^w\d+$/.test(item.id) ? WARM_TIPS[item.title] || null : TIPS[item.id] || null; }
  // After a session: one tip for a low score, one push for a high score (at most two lines in total).
  function scoreTips(items, pts) {
    const lows = [], highs = [];
    for (const i of items) { const v = pts[i.id]; if (!isNum(v) || !(i.max > 0)) continue; const r = v / i.max;
      if (r < 0.5 && tipFor(i)) lows.push({ r, text: i.title + ': ' + v + ' of ' + i.max + '. Next time: ' + tipFor(i) });
      else if (r >= 0.8) highs.push({ r, text: i.title + ': ' + v + ' of ' + i.max + '. Hot! Try to beat ' + v + ' next time.' }); }
    lows.sort((a, b) => a.r - b.r); highs.sort((a, b) => b.r - a.r);
    return lows.slice(0, 1).concat(highs.slice(0, 1)).map(x => x.text);
  }
  // ---------- Season mode: each week is a game, each month a season, the last week of the month is the title game.
  const OPPONENTS = ['Thunder', 'Gators', 'Rockets', 'Mustangs', 'Hornets', 'Sharks', 'Comets', 'Grizzlies'];
  function season(entries, today) {
    const month = today.slice(0, 7), w = weeksMap(entries), first = month + '-01';
    let mon = mondayOf(first); if (mon < first) mon = addDays(mon, 7);
    const weeks = []; while (mon.slice(0, 7) === month) { weeks.push(mon); mon = addDays(mon, 7); }
    const r = seeded('season' + month), foes = shuffle(OPPONENTS, 'foes' + month).slice(0, 4);
    // Weeks before his very first session are pre-season: no game, no loss.
    const firstSes = entries.filter(e => e.kind === 'session' && e.complete).map(e => e.date).sort()[0], startMon = firstSes ? mondayOf(firstSes) : mondayOf(today);
    const games = weeks.map((m, i) => {
      const done = w[m] || {}, opp = foes[i % foes.length], oppRuns = 1 + Math.floor(seeded(m + opp)() * 4);
      const last = i === weeks.length - 1, past = addDays(m, 6) < today, current = !past && m <= today;
      const ours = (done.A ? 2 : 0) + (done.B ? 2 : 0) + (done.C ? 1 : 0);
      const win = !!(done.A && done.B), score = win ? Math.max(ours, oppRuns + 1) : Math.min(ours, oppRuns - 1 < 0 ? 0 : oppRuns - 1);
      const pre = m < startMon;
      return { monday: m, opp, title: last, status: pre ? 'pre' : past ? (win ? 'W' : 'L') : current ? (win ? 'W' : 'live') : 'next', us: score, them: oppRuns, win };
    });
    // The other teams' records come from a fixed random draw, so the standings never change after the fact.
    const played = games.filter(g => g.status === 'W' || g.status === 'L');
    const table = foes.map(name => { let wn = 0, ls = 0; played.forEach((g, i) => { if (g.opp === name) { if (g.win) ls++; else wn++; } else if (r() < 0.5) wn++; else ls++; }); return { name, w: wn, l: ls }; });
    const mine = { name: 'You', w: played.filter(g => g.win).length, l: played.filter(g => !g.win).length, me: true };
    const standings = table.concat([mine]).sort((a, b) => (b.w - a.w) || (a.l - b.l) || (a.me ? -1 : 1));
    const titleGame = games[games.length - 1], champ = titleGame && titleGame.status === 'W' && titleGame.win;
    return { month, games, standings, mine, champ };
  }
  function champMonths(entries) {
    const months = [...new Set(entries.filter(e => e.kind === 'session').map(e => e.date.slice(0, 7)))];
    return months.filter(m => { const lastDay = addDays(addDays(m + '-01', 32).slice(0, 7) + '-01', -1); return season(entries, lastDay > '9999' ? lastDay : lastDay).champ; });
  }

  // ---------- Daily challenge: one per day, the same all day. Some check themselves from Arcade scores.
  const CHALLENGES = [
    { id: 'd1', text: 'Hold your finish: 15 dry swings, freeze for 2 seconds at the end of each one.' },
    { id: 'd2', text: 'Wall sit for 30 seconds. Back flat on the wall, knees bent like a chair.' },
    { id: 'd3', text: '20 jumping jacks, then 10 squats.' },
    { id: 'd4', text: 'Play catch with Dad: 10 throws. Count how many hit his glove.', throwing: true },
    { id: 'd5', text: 'Watch one drill video in the app, then copy the move 5 times.' },
    { id: 'd6', text: 'Score 3 or more runs in Baseball Brain.', auto: { game: 'brain', min: 3 } },
    { id: 'd7', text: 'Steal 4 or more bases in Steal Second.', auto: { game: 'steal', min: 4 } },
    { id: 'd8', text: 'Strike out 3 or more batters in Strikeout King.', auto: { game: 'kking', min: 3 } },
    { id: 'd9', text: 'Hit 3 home runs in Home Run Derby.', auto: { game: 'derby', min: 3 } },
    { id: 'd10', text: 'Balance like your leg lift: 20 seconds on each leg.' },
    { id: 'd11', text: 'Tell Dad one thing you got better at this week.' },
    { id: 'd12', text: 'Shadow grounders: 10 reps. Stay low, glove out in front.' },
    { id: 'd13', text: 'Stride check: 10 dry swings, landing your front foot on the same spot.' },
    { id: 'd14', text: 'Bear crawl across the room and back, 2 times.' },
    { id: 'd15', text: 'Push-ups: do 1 more than your best set.' },
    { id: 'd16', text: 'Plank: hold it 5 seconds longer than last time.' },
    { id: 'd17', text: 'Pitcher’s balance: lift your knee and hold for 3 seconds, 10 times. No ball needed.' },
    { id: 'd18', text: 'Eyes drill: Dad holds up fingers fast, you call the number. 10 rounds.' },
    { id: 'd19', text: 'Score 600 or more in Outfield Hero.', auto: { game: 'outfield', min: 600 } }
  ];
  function challengeFor(today, armOk) {
    const pool = CHALLENGES.filter(c => armOk || !c.throwing);
    return pool[Math.floor(seeded('day' + today)() * pool.length)];
  }
  function challengeDone(entries, today, c) {
    if (entries.some(e => e.kind === 'challenge' && e.date === today)) return true;
    if (!c || !c.auto) return false;
    return entries.some(e => e.kind === 'arcade' && e.date === today && e.game === c.auto.game && isNum(e.score) && (c.auto.min != null ? e.score >= c.auto.min : e.score <= c.auto.max));
  }
  // Days in a row with a finished session or a daily challenge. Today still counts as "alive" until midnight.
  function dayStreak(entries, today) {
    const days = new Set(entries.filter(e => (e.kind === 'session' && e.complete) || e.kind === 'challenge').map(e => e.date));
    let d = days.has(today) ? today : addDays(today, -1), n = 0;
    while (days.has(d)) { n++; d = addDays(d, -1); }
    return { n, today: days.has(today) };
  }
  function longestDayStreak(entries) {
    const days = [...new Set(entries.filter(e => (e.kind === 'session' && e.complete) || e.kind === 'challenge').map(e => e.date))].sort();
    let best = 0, run = 0, prev = null;
    for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
    return best;
  }
  // Card tiers and unlockable themes, by level.
  const TIERS = [[1, 'Bronze'], [3, 'Silver'], [5, 'Gold'], [7, 'All-Star']];
  const tierFor = level => TIERS.filter(t => level >= t[0]).pop()[1];
  // ---------- Arcade Mix: 3 quick goals a day, one of them picked for this week's focus ----------
  const MIX_GOALS = { derby: [3, 'Hit {n} home runs in Home Run Derby'], kking: [3, 'Strike out {n} hitters in Strikeout King'], steal: [4, 'Steal {n} bases in Steal Second'],
    outfield: [700, 'Score {n} points in Outfield Hero'], pitchrec: [15, 'Score {n} points in Pitch Reader'], streak: [4, 'Get {n} hits in Hit Streak'], brain: [3, 'Score {n} runs in Baseball Brain'] };
  const FOCUS_GAME = { baseline: 'derby', contact: 'derby', speed: 'derby', path: 'derby', timing: 'pitchrec' };
  function mixFor(date, focus) {
    const first = FOCUS_GAME[focus] || 'derby', rest = shuffle(Object.keys(MIX_GOALS).filter(g => g !== first), 'mix' + date).slice(0, 2);
    return [first].concat(rest).map((g, i) => ({ game: g, need: MIX_GOALS[g][0], text: MIX_GOALS[g][1].replace('{n}', MIX_GOALS[g][0]), focus: i === 0 }));
  }
  function mixProgress(entries, date, focus) {
    return mixFor(date, focus).map(m => Object.assign(m, { done: entries.some(e => e.kind === 'arcade' && e.date === date && e.game === m.game && isNum(e.score) && e.score >= m.need) }));
  }
  function mixStreak(entries, today) {
    const days = new Set(entries.filter(e => e.kind === 'mix').map(e => e.date));
    let d = days.has(today) ? today : addDays(today, -1), n = 0; while (days.has(d)) { n++; d = addDays(d, -1); }
    return { n, today: days.has(today) };
  }
  // ---------- Locker: gear he earns by leveling up, used in the 3D games ----------
  const LOCKER = {
    bat: { name: 'Bat', items: [{ id: 'wood', name: 'Natural wood', level: 1, c: 0xd9a65e }, { id: 'black', name: 'Black', level: 2, c: 0x1e1e1e }, { id: 'orange', name: 'Spitters orange', level: 4, c: 0xee7f24 }, { id: 'gold', name: 'Gold', level: 6, c: 0xd4af37 }] },
    cleats: { name: 'Cleats', items: [{ id: 'black', name: 'Black', level: 1, c: 0x121212 }, { id: 'white', name: 'White', level: 2, c: 0xf0f0f0 }, { id: 'orange', name: 'Orange', level: 3, c: 0xee7f24 }, { id: 'green', name: 'Green', level: 5, c: 0x1d6a3b }] },
    helmet: { name: 'Helmet', items: [{ id: 'gloss', name: 'Green gloss', level: 1, c: 0x1d6a3b, r: 0.22, m: 0.1 }, { id: 'matte', name: 'Green matte', level: 3, c: 0x1d6a3b, r: 0.75, m: 0 }, { id: 'black', name: 'Black gloss', level: 5, c: 0x141414, r: 0.2, m: 0.15 }, { id: 'chrome', name: 'Orange chrome', level: 8, c: 0xee7f24, r: 0.12, m: 0.85 }] },
    park: { name: 'Ballpark', items: [{ id: 'night', name: 'Night game', level: 1 }, { id: 'day', name: 'Day game', level: 4 }, { id: 'sunset', name: 'Sunset', level: 6 }] }
  };
  // what he has picked, falling back to the first item if a pick is not unlocked
  function gearFor(settings, level) {
    const g = (settings && settings.gear) || {}, out = {};
    for (const k in LOCKER) { const it = LOCKER[k].items, pick = it.find(x => x.id === g[k] && x.level <= level); out[k] = pick || it[0]; }
    return out;
  }
  const THEMES = [{ id: 'classic', name: 'Seed Spitters', level: 1 }, { id: 'night', name: 'Night Game', level: 3 }, { id: 'retro', name: 'Retro', level: 5 }, { id: 'gold', name: 'All-Star Gold', level: 7 }];

  const MOUND_MAX = 20;   // 20 pitches or fewer needs 0 rest days under Pitch Smart, so a practice never blocks the next day.
  // A "pick one" slot: he chooses which drill to do. id is the slot; the chosen drill keeps its own id.
  const CH = (id, name, list) => ({ id, title: name, text: 'Pick one', choices: list.filter(Boolean), min: Math.max.apply(null, list.filter(Boolean).map(d => d.min || 0)) });
  // Hand-eye coordination: catching, tracking and tapping drills that need almost no gear.
  const HAND_EYE = [
    I('h1', 'Bounce and Catch', 'Tennis ball. Bounce it off the wall (underhand) and catch it with one hand. Switch hands every 5. How many in a row before a drop?', { min: 4, pts: 'Catches in a row', max: 40 }),
    I('h2', 'Numbers on the Ball', 'Dad writes numbers 1 to 9 on mini balls with a marker. Machine, skinny bat. Yell the number before you swing. Right number = 1, solid hit +1. 10 pitches.', { min: 5, sw: 10, pts: 'Right number 1, solid +1', max: 20 }),
    I('h3', 'Balloon Taps', 'Blow up a balloon. Keep it in the air with the skinny bat. 30 taps without it touching the floor. Then try top hand only.', { min: 3, pts: 'Taps in a row', max: 60 }),
    I('h4', 'Drop Catch', 'Dad holds a ball at shoulder height and lets go without warning. Catch it before it hits the ground. 15 drops. Start with two hands, then one.', { min: 3, pts: 'Catch = 1', max: 15 }),
    I('h5', 'Color Call Catch', 'Dad hides two different balls behind his back and tosses one. Yell which one it is before you catch it. 15 tosses.', { min: 3, pts: 'Right call and catch = 1', max: 15 }),
    I('h6', 'Bat Bounce', 'Bounce a tennis ball up and down on the barrel of the skinny bat. Best of 3 tries.', { min: 3, pts: 'Best bounces in a row', max: 50 }),
    I('h7', 'Glove Flip', 'Toss a tennis ball up a little and catch it in your glove, then flip it to your throwing hand. 20 tosses, faster each time.', { min: 3, pts: 'Clean flip = 1', max: 20 })
  ];
  const CORE = r => [
    I('k1', 'Tank twists', 'Tidal Tank. 2 sets of ' + r(6) + ' each side. Keep the water quiet.', { min: 4 }),
    I('k2', 'Russian twists', 'Sit, lean back a little, feet up if you can. Touch the floor each side. 2 sets of ' + r(8) + ' each side.', { min: 3 }),
    I('k3', 'Plank shoulder taps', 'Push-up position. Tap each shoulder with the other hand without your hips rocking. 2 sets of ' + r(8) + '.', { min: 3 }),
    I('k5', 'Dead bugs', 'On your back, arms and legs up. Reach one arm back and the other leg out, slowly. 2 sets of ' + r(6) + ' each side.', { min: 3 })];
  const POWER = (r, armRest) => [
    armRest ? null : I('k4', 'Med ball throws', 'Side throws into the net. 2 sets of ' + r(5) + ' each side.', { min: 4 }),
    I('k4r', 'Tank carry', 'Hold the Tidal Tank in front. 2 walks of 20 steps.', { min: 3 }),
    I('k6', 'Broad jumps', 'Jump forward as far as you can and stick the landing. 3 sets of 3.', { min: 3 }),
    I('k7', 'Skater hops', 'Hop side to side like a speed skater, land on one foot and freeze. 2 sets of ' + r(6) + ' each side.', { min: 3 }),
    I('k8', 'Hip turn snaps', 'Hold a towel or the skinny bat across your chest. Load, then turn your hips fast like a swing and stop. 2 sets of ' + r(6) + ' each side.', { min: 3 })];

  // Fielding: ground balls, fly balls and quick hands. throw: uses his throwing arm (left out during arm rest and on mound day).
  const FIELDING = [
    I('fd1', 'Short Hops', 'Dad bounces tennis balls at you from 10 feet. Glove out front, soft hands, give with the ball. 15 balls. Clean pick = 1.', { min: 4, pts: 'Clean pick = 1', max: 15 }),
    I('fd2', 'Ready, Read, Field', 'Get in ready position. Dad rolls grounders left, right and right at you. Shuffle, get low, field it out front. 12 balls. Clean = 1.', { min: 4, pts: 'Clean = 1', max: 12 }),
    I('fd3', 'Drop Step Fly Balls', 'Dad tosses fly balls over your left or right shoulder. Drop step, turn and run, then catch it. 10 balls. Catch = 1.', { min: 4, pts: 'Catch = 1', max: 10 }),
    I('fd4', 'Quick Hands Transfer', 'Dad soft-tosses to your glove. Catch, get the ball into your throwing hand fast and show it. 15 tosses. Clean transfer = 1.', { min: 3, pts: 'Clean transfer = 1', max: 15 }),
    I('fd5', 'Backhand, Forehand', 'Dad rolls balls to your glove side and your backhand side. Stay low and field it with the glove open. 12 balls. Clean = 1.', { min: 4, pts: 'Clean = 1', max: 12, lvl: 2 }),
    I('fd6', 'Crow Hop Throws', 'Field a slow roller, crow hop, and throw to Dad\'s chest from about 40 feet. 10 throws, easy to medium effort. Chest-high = 1.', { min: 4, pts: 'Chest-high = 1', max: 10, throw: true }),
    I('fd7', 'Tennis Ball Pop-ups', 'Dad throws high pop-ups with a tennis ball. Call it ("I got it!"), get under it, catch it above your head. 10 balls. Catch = 1.', { min: 3, pts: 'Catch = 1', max: 10 })
  ];
  // Speed and baserunning, mostly on the agility ladder.
  const SPEED = [
    I('sp1', 'Ladder Speed Run', 'Agility ladder: one foot in each box, then two feet in each box, then sideways. 2 times each. Dad times the two-feet run. Beat your best.', { min: 4, pts: 'Seconds (lower is better)' }),
    I('sp2', 'Ladder to Steal', 'Side shuffle down the ladder (two in, two out), then a crossover step and sprint 15 feet like you\'re stealing second. 6 reps.', { min: 4 }),
    I('sp3', 'Icky Shuffle Race', 'Ladder icky shuffle: in, in, out, down the whole ladder. 4 runs. Dad times them. Beat your best.', { min: 3, pts: 'Seconds (lower is better)' }),
    I('sp4', 'Home to First', 'Sprint the length of a base path (or your longest straight line) and run through a cone like it\'s first base. 4 sprints, full rest between. Dad times them.', { min: 4, pts: 'Seconds (lower is better)' }),
    I('sp5', 'Round the Bag', 'Cone = first base. Curve out a little, touch the inside corner of the cone with either foot, and sprint 10 more steps toward second. 4 reps.', { min: 3 }),
    I('sp6', 'Go on the Clap', 'Take a lead off a towel. Dad claps = sprint 15 feet. Dad says "back" = get back to the towel fast. 8 reps. Right move = 1.', { min: 3, pts: 'Right move = 1', max: 8 })
  ];
  const LADDER_WARM = [
    I('lw1', 'Ladder: Quick Feet', 'Agility ladder: one foot in each box down, two feet in each box back. 3 times. Then 10 arm circles each way.', { min: 3 }),
    I('lw2', 'Ladder: Side Steps', 'Side step down the ladder, two feet in each box, both directions, 3 times. Then 10 leg swings each leg.', { min: 3 }),
    I('lw3', 'Ladder: Hopscotch', 'Hopscotch down the ladder (in, out, in, out) and back, 3 times. Then 10 easy swings with no ball.', { min: 3 })
  ];
  const COOL = [
    I('cd1', 'Stretch Circuit', '1 minute of easy walking, then hold 15 seconds each: hamstrings, quads, calves, chest in a doorway, arm across your chest.', { min: 2 }),
    I('cd2', 'Animal Yoga', 'Hold 20 seconds each: cat-cow, cobra, child\'s pose, down dog, butterfly.', { min: 2 }),
    I('cd3', 'Breathe and Roll', 'Lie on your back with knees up. 5 slow belly breaths. Hug your knees and rock 10 times. Finish with easy arm circles.', { min: 2 })
  ];

  function buildWeek(focus, step, armRest, o) {
    o = o || {};
    const S = Math.max(1, Math.min(5, step || 1)), r = n => n + 2 * (S - 1), hold = 20 + 5 * (S - 1);
    const mon = o.monday || '2000-01-03', level = o.level || 1, recent = o.recent || [], targets = o.targets || [];
    const seed = mon + focus;
    const warmPick = shuffle(WARMUPS, seed + 'w');
    const warm = k => ({ name: 'Warm-up (you pick)', min: 3, items: [CH('wu' + k, 'Your pick: warm-up', shuffle(LADDER_WARM, seed + 'lw' + k).slice(0, 2).concat([Object.assign({}, warmPick[k % warmPick.length], { id: 'w' + k })]))] });
    const log = { name: 'Wrap up', min: 1, items: [I('l1', 'Tell Dad your numbers', 'Points, hits and speeds. He logs them so you get credit.')] };
    const cool = k => ({ name: 'Cool-down (you pick)', min: 2, items: [CH('cd' + k, 'Your pick: cool-down', shuffle(COOL, seed + 'cd' + k))] });
    const field = (k, noThrow) => { const pool = FIELDING.filter(d => (d.lvl || 1) <= level && !(noThrow && d.throw));
      return { name: 'Fielding (you pick)', min: 4, items: [CH('fl' + k, 'Your pick: fielding', shuffle(pool, seed + 'fl' + k).slice(0, 3))] }; };
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
      const rest = pickDrills(pool, 4 - lead.length, { level, recent, seed: seed + 'a', avoid: lead.map(d => d.title) });
      a1 = lead.concat(rest.slice(0, -2)).concat(rest.length >= 2 ? [CH('hc1', 'Your pick: hitting', rest.slice(-2))] : rest.slice(-2));
      a1.push(bossFor(o.entries || [], mon));
    }
    // Day 2: fix-it (second target if there is one), 1 more from the pool, mound or glove work.
    const usedA = a1.flatMap(d => d.choices ? d.choices.map(c => c.title) : [d.title]);
    const lead2 = focus !== 'baseline' && fixB && usedA.indexOf(fixB.drill.title) < 0 ? [tag(fixB.drill, targets[1] || targets[0])] : [];
    // Day 2 is the longest day (mound + fielding + hand-eye), so its hitting drills are the 5-minute-or-shorter ones
    const bp = pickDrills(pool.filter(d => (d.min || 0) <= 5), 3 - lead2.length, { level, recent: recent.concat(a1.flatMap(d => d.choices ? d.choices.map(c => c.id) : [d.id])), seed: seed + 'b', avoid: usedA.concat(lead2.map(d => d.title)) });
    const b1 = lead2.concat(bp.length >= 2 ? bp.slice(0, -2).concat([CH('hc2', 'Your pick: hitting', bp.slice(-2))]) : bp);
    const mound = armRest
      ? { name: 'Glove work (arm rest, no throws)', items: [
          I('g1', 'Shadow Grounders', 'No ball. Dad points left, right or in. Shuffle, get low, field it with your glove, freeze. 12 reps.', { min: 3 }),
          I('g2', 'Balance Beam', 'Pitching leg lift. Hold the top for 3 seconds without wobbling. 5 each side.', { min: 2 }),
          I('g3', 'Quick Feet', 'No ball. Lay 5 socks in a line. Fast feet through them, forward and back. 4 trips.', { min: 2 })] }
      : { name: 'Mound', items: [
          I('m1', 'Easy Catch', 'Play catch with Dad. 10 easy throws, short to a little longer. Not counted as pitches.', { min: 2 }),
          (o.pitchTargets && o.pitchTargets[0] && focus !== 'baseline') ? tag(PFIXES[o.pitchTargets[0].id].drill, o.pitchTargets[0])
            : I('m2', 'Strike Zone Tic-Tac-Toe', 'Tape a 3 by 3 grid on the net. Pitch from your spot. Get 3 in a row to win. ' + MOUND_MAX + ' pitches at most, then stop.', { min: 5, pitches: MOUND_MAX, pts: 'Each square hit = 1', max: 9 })] };
    mound.min = sum(mound.items);
    const bodyA = focus === 'baseline'
      ? { name: 'Strength test', min: 8, items: [
          I('x1', 'Long jump test', '3 tries from standing. Dad measures your best one.'),
          I('x2', 'Push-up test', 'As many as you can with a flat back. Stop when your form slips.'),
          I('x3', 'Plank test', 'Hold as long as you can with a flat back. Dad times it.')] }
      : { name: 'Strength (you pick)', min: 4, items: [
          CH('cs1', 'Your pick: legs', [I('a1', 'Squats', '2 sets of ' + r(8) + '.', { sq: 2 * r(8), min: 2 }), I('a1j', 'Jump squats', '2 sets of ' + r(5) + '. Land soft.', { sq: 2 * r(5), min: 2 }), I('a1w', 'Wall sit', '2 holds of ' + hold + ' seconds, back flat on the wall.', { min: 2 })]),
          CH('cs2', 'Your pick: arms or core', [I('a2', 'Push-ups', '2 sets of ' + r(5) + ' with a flat back.', { pu: 2 * r(5), min: 2 }), I('a3p', 'Plank', '2 holds of ' + hold + ' seconds with a flat back.', { min: 2 }), I('a3d', 'Dead bugs', '2 sets of ' + r(6) + ' each side, slow.', { min: 2 })])] };
    // one pick of core or power work (2 of each to choose from), so Day 2 stays under 30 minutes
    const cp = shuffle(CORE(r), seed + 'cp1').slice(0, 2).concat(shuffle(POWER(r, armRest).filter(Boolean), seed + 'cp2').slice(0, 2));
    // arm rest: no tossing drills that use the throwing arm
    const he = HAND_EYE.filter(d => !(armRest && (d.id === 'h1' || d.id === 'h7')));
    const heB = { name: 'Hand-eye (you pick)', min: 4, items: [CH('he2', 'Your pick: hand-eye', shuffle(he, seed + 'he2').slice(0, 3))] };
    const heC = { name: 'Hand-eye (you pick)', min: 4, items: [CH('he3', 'Your pick: hand-eye', shuffle(he.filter(d => d.id !== 'h2'), seed + 'he3').slice(0, 3))] };
    const fill = t => t.replace('{8}', r(8)).replace('{5}', r(5)).replace('{hold}', hold);
    const mk = d => { const x = Object.assign({ min: 2 }, d, { text: fill(d.text) });
      if (d.r) { if (d.r.sq) x.sq = 2 * r(d.r.sq); if (d.r.pu) x.pu = 2 * r(d.r.pu); if (d.r.su) x.su = 2 * r(d.r.su); delete x.r; } return x; };
    const B = id => mk(BODY_C.concat(FUN_C).find(d => d.id === id)), fun = shuffle(['z5', 'z8', 'z12', 'z13'], seed + 'c');
    const bodyC = { name: 'Strength (you pick)', min: 4, items: [
      CH('cp1', 'Your pick: core or power', cp),
      CH('bc1', 'Your pick: legs or arms', [B('z1'), B('z6'), I('z10', 'Jump squats', '2 sets of ' + r(5) + '. Land soft.', { sq: 2 * r(5), min: 2 }), B('z2'), I('z11', 'Couch push-ups', 'Hands on the couch edge. 2 sets of ' + r(8) + '.', { pu: 2 * r(8), min: 2 })].filter((d, n) => n !== shuffle([0, 1, 2], seed + 'bc')[0]))] };
    const speedC = { name: 'Speed and agility (you pick)', min: 4, items: [CH('sp', 'Your pick: speed and baserunning', shuffle(shuffle(SPEED.filter(d => /Ladder|Icky/.test(d.title)), seed + 'spl').slice(0, 1).concat(shuffle(SPEED.filter(d => !/Ladder|Icky/.test(d.title)), seed + 'spo').slice(0, 2)), seed + 'sp'))] };
    const hitA = { name: 'Hitting', min: sum(a1), items: a1 }, hitB = { name: 'Hitting', min: sum(b1), items: b1 };
    // Keep a day inside his time window: trim the longest options out of "pick one" slots until it fits.
    const fit = (day, max) => {
      const total = () => day.blocks.reduce((t, b) => t + b.min, 0);
      for (let guard = 0; guard < 12 && total() > max; guard++) {
        let best = null; day.blocks.forEach(b => b.items.forEach(i => { if (i.choices && i.choices.length > 2 && (!best || i.min > best.i.min)) best = { b, i }; }));
        if (!best) break;
        const longest = Math.max.apply(null, best.i.choices.map(c => c.min || 0)), keep = best.i.choices.filter(c => (c.min || 0) < longest);
        if (keep.length < 2) { const sorted = best.i.choices.slice().sort((x, y) => (x.min || 0) - (y.min || 0)); best.i.choices = sorted.slice(0, best.i.choices.length - 1); } else best.i.choices = keep;
        const old = best.i.min; best.i.min = Math.max.apply(null, best.i.choices.map(c => c.min || 0)); best.b.min -= old - best.i.min;
      }
      // still long: drop the extra hitting pick (the day keeps its other hitting drills)
      const hit = day.blocks.find(b => b.name === 'Hitting');
      if (total() > max && hit && hit.items.filter(i => !i.choices).length >= 1) { const c = hit.items.find(i => i.choices); if (c) { hit.items = hit.items.filter(i => i !== c); hit.min -= c.min; } }
      day.min = total(); return day;
    };
    const week = {
      A: { title: 'Day 1', sub: focus === 'baseline' ? 'Test day' : 'Hitting + fielding', min: 3 + hitA.min + 4 + bodyA.min + 2 + 1, blocks: [warm(0), hitA, field(1, armRest), bodyA, cool(1), log] },
      // In test week only Day 1 runs the tests; Day 2 is a normal practice so he is not maxing out twice.
      B: armRest ? { title: 'Day 2', sub: 'Hitting + glove work', min: 3 + mound.min + hitB.min + heB.min + 2 + 1, blocks: [warm(1), mound, hitB, heB, cool(2), log] }
        : { title: 'Day 2', sub: 'Pitching + fielding', min: 3 + mound.min + hitB.min + 4 + heB.min + 2 + 1, blocks: [warm(1), mound, field(2, true), hitB, heB, cool(2), log] },
      C: { title: 'Day 3', sub: 'Speed + hand-eye', min: 4 + 4 + 4 + 2, blocks: [speedC, heC, bodyC, cool(3)] }
    };
    fit(week.A, 30); fit(week.B, 30); fit(week.C, 15);
    return week;
  }
  // Swap each "pick one" slot for the drill he chose (or leave the slot to be picked).
  function resolveSession(session, picks) {
    picks = picks || {};
    return Object.assign({}, session, { blocks: session.blocks.map(b => Object.assign({}, b, { items: b.items.map(i => {
      if (!i.choices) return i;
      const c = i.choices.find(x => x.id === picks[i.id]);
      return c ? Object.assign({}, c, { slot: i.id, choices: i.choices, pickName: i.title }) : i; }) })) });
  }
  const drillIds = session => session.blocks.flatMap(b => b.items).map(i => i.id);

  // What a finished session credits automatically.
  function sessionReps(session) {
    const t = { swings: 0, pushups: 0, situps: 0, squats: 0 };
    for (const b of session.blocks) for (const i of b.items) { t.swings += i.sw || 0; t.pushups += i.pu || 0; t.situps += i.su || 0; t.squats += i.sq || 0; }
    return t;
  }

  // ---------- GameChanger season-stats file (Stats > Export Stats, staff accounts) ----------
  // The exact layout is not published, so this reads it by column names: an optional section row
  // (Batting / Pitching / Fielding) above a header row with First/Last and stat names.
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell.trim()); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows.filter(r => r.some(c => c !== ''));
  }
  const GC_BAT = { PA: 'pa', AB: 'ab', H: 'h', SO: 'k', K: 'k', BB: 'bb', HBP: 'hbp', R: 'r', RBI: 'rbi', '1B': 'b1', '2B': 'b2', '3B': 'b3', HR: 'hr', SOL: 'kl', 'K-L': 'kl', KL: 'kl' };
  const GC_PIT = { IP: 'ip', '#P': 'pitches', NP: 'pitches', TP: 'pitches', PITCHES: 'pitches', BF: 'bf', SO: 'k', K: 'k', BB: 'bb', H: 'h', ER: 'er' };
  function parseGC(text, name) {
    const rows = parseCSV(text), U = c => String(c || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const hi = rows.findIndex(r => r.some(c => /^FIRST( NAME)?$/.test(U(c)) || U(c) === 'NAME' || U(c) === 'PLAYER') && r.some(c => ['AB', 'PA', 'IP'].indexOf(U(c)) >= 0));
    if (hi < 0) return { ok: false, why: 'This does not look like a GameChanger stats file. In GameChanger, open the team Stats, tap Export Stats, and pick that file.' };
    const head = rows[hi].map(U), secRow = hi > 0 ? rows[hi - 1].map(U) : [];
    const hasSec = secRow.some(c => /BATTING|OFFEN|PITCHING|FIELDING|DEFEN/.test(c));
    const sec = []; let cur = 'batting', seenIP = false;
    for (let j = 0; j < head.length; j++) {
      if (hasSec && secRow[j]) cur = /PITCH/.test(secRow[j]) ? 'pitching' : /BAT|OFFEN/.test(secRow[j]) ? 'batting' : 'other';
      else if (!hasSec) { if (head[j] === 'IP') { cur = 'pitching'; seenIP = true; } else if (seenIP && /^(TC|PO|A|E|FPCT|DP)$/.test(head[j])) cur = 'other'; }
      sec.push(cur);
    }
    const col = re => head.findIndex(c => re.test(c));
    const iF = col(/^FIRST( NAME)?$/), iL = col(/^LAST( NAME)?$/), iN = iF < 0 ? col(/^(NAME|PLAYER)$/) : -1;
    const people = [];
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r], first = iF >= 0 ? row[iF] : (row[iN] || '').split(' ')[0], last = iL >= 0 ? row[iL] : (row[iN] || '').split(' ').slice(1).join(' ');
      const label = ((first || '') + ' ' + (last || '')).trim();
      if (!label || /^(TOTALS?|TEAM|GLOSSARY)\b/i.test(label) || /:/.test(label)) continue;
      const bat = {}, pit = {};
      head.forEach((h, j) => { const v = row[j]; if (v == null || v === '' || v === '-') return;
        const map = sec[j] === 'pitching' ? GC_PIT : sec[j] === 'batting' ? GC_BAT : null; const key = map && map[h];
        if (!key) return; const x = key === 'ip' ? outsFromInnings(parseFloat(v)) : parseFloat(String(v).replace(/,/g, ''));
        if (isNum(x) && x >= 0) (sec[j] === 'pitching' ? pit : bat)[key] = x; });
      people.push({ first: first || '', last: last || '', label, bat, pit });
    }
    if (!people.length) return { ok: false, why: 'No players were found in this file.' };
    const want = String(name || '').toLowerCase();
    const match = people.filter(p => want && (p.first.toLowerCase() === want || p.label.toLowerCase().indexOf(want) === 0));
    return { ok: true, people, player: match.length === 1 ? match[0] : null, names: people.map(p => p.label) };
  }
  // What changed between two season-total snapshots. Totals going down means a different filter or season.
  function gcDelta(prev, cur) {
    const d = { bat: {}, pit: {} }; let down = false, any = false;
    for (const part of ['bat', 'pit']) for (const k of Object.keys(cur[part] || {})) {
      const a = (prev && prev[part] && prev[part][k]) || 0, x = cur[part][k] - a;
      if (x < 0) down = true; if (x > 0) any = true; d[part][k] = Math.max(0, x);
    }
    return { delta: d, down, any };
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

  return { resolveSession, HAND_EYE, MIX_GOALS, mixFor, mixProgress, mixStreak, LOCKER, gearFor, normPitch, GAMES, gameBests, season, champMonths, OPPONENTS, CHALLENGES, challengeFor, challengeDone, dayStreak, longestDayStreak, TIERS, tierFor, THEMES, VIDEOS, DRILL_VIDEO, videoFor, WHY, whyFor, TIPS, tipFor, scoreTips, PFIXES, PR, pitchDiagnose, bodyNotes, parse, iso, addDays, diffDays, mondayOf, avg, isNum, byDate, pctVsGame, fitStatus, restDays, fmtInnings, outsFromInnings, armStatus, stats,
    decideFocus, diagnose, bossFor, bossWon, recentDrills, drillIds, DRILLS, FIXES, MOUND_MAX, weekInfo, streak, longestStreak, records, totals, game, badges, retest, buildWeek, hitting, sessionReps, tune, fixRun, weekRecap, recapText, fmtHeight, parseCSV, parseGC, gcDelta, HEAVY_CAP, FOCUS, RULES, XP, TITLES };
})();
/*LOGIC-END*/
