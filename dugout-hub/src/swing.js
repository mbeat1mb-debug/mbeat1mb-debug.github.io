/* Swing reader: turns body positions from a side-view swing video into checks, grades and fixes.
   Pure math, no page code, so it can be tested on its own. Landmark numbers follow the body-tracking model:
   0 nose, 11/12 shoulders, 23/24 hips, 25/26 knees, 27/28 ankles. Positions are in pixels, y grows downward. */
const HubSwing = (function () {
  const NOSE = 0, SH = [11, 12], HIP = [23, 24], KNEE = [25, 26], ANK = [27, 28], WR = [15, 16];
  const HANDS_GAP_MAX = 0.12, HANDS_TRAVEL_MIN = 0.20;   // share of his height; a batter's wrists sit about 4-6% apart and travel 40% or more
  const SAMPLES_PER_SEC = 30, BEFORE = 1.2, AFTER = 0.3;   // real-time seconds around contact
  const NOSE_TO_ANKLE = 0.87;   // share of standing height between nose and ankle (adult body proportions; an estimate for a child)
  const ok = p => p && isFinite(p.x) && isFinite(p.y) && (p.v == null || p.v >= 0.5);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v == null ? 1 : a.v, b.v == null ? 1 : b.v) });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function angle(a, b, c) {   // angle at b, degrees
    const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
    const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y); if (!d) return null;
    return Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d))) * 180 / Math.PI;
  }
  const median = a => { const s = a.filter(isFinite).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

  // Video times to sample: 1.2 s before contact to 0.3 s after, 30 per real second, stretched by the slow-motion factor.
  function sampleTimes(contact, speed, duration) {
    const sp = speed > 0 ? speed : 1, step = sp / SAMPLES_PER_SEC, out = [];
    if (!(duration > 0) || !isFinite(duration)) duration = null;
    for (let k = -Math.round(BEFORE * SAMPLES_PER_SEC); k <= Math.round(AFTER * SAMPLES_PER_SEC); k++) {
      const t = contact + k * step; if (t >= 0 && (duration == null || t <= duration)) out.push({ k, t });
    }
    return out;
  }
  // Fill single-frame gaps and smooth jitter with a 3-frame median per coordinate.
  function clean(frames) {
    const n = frames.length, out = [];
    for (let i = 0; i < n; i++) {
      const f = frames[i]; if (!f) { out.push(null); continue; }
      const pts = f.map((p, j) => {
        const near = [frames[i - 1], f, frames[i + 1]].filter(Boolean).map(g => g[j]).filter(ok);
        if (!near.length) return p;
        return { x: median(near.map(q => q.x)), y: median(near.map(q => q.y)), v: p ? p.v : 0 };
      });
      out.push(pts);
    }
    return out;
  }
  const RESEARCH = {
    stride: 'Teen hitters in a lab study strode about 47% of their height (Escamilla and others, 2009). Strides vary a lot by style, so only very long strides are flagged.',
    head: 'College hitters off a tee moved the head about 4.5 cm back and 4.4 cm down on average (Haag, 2017). Drifting toward the pitcher is the lunge to avoid.',
    foot: 'Teen hitters took about 0.51 s from front foot up to contact, 0.29 s of it striding (Escamilla and others, 2009), leaving roughly 0.2 s with the foot down before contact.',
    seq: 'Swings build speed from the ground up: hips turn, then shoulders, then arms. In teen hitters the hips and chest peaked almost together (Escamilla and others, 2009), so only shoulders clearly leading is flagged.',
    leg: 'At contact, teen hitters had the front knee bent about 15 degrees, so the leg was close to straight (Escamilla and others, 2009). A firm front leg helps turn force into bat speed (Orishimo and others, 2023).',
    balance: 'Coaching check, not a research number: at the finish his head should sit over his feet, not past the front foot.'
  };
  const FIX = {
    head: { area: 'contact', title: 'Head drifting toward the pitcher', drill: 'f5' },
    drop: { area: 'contact', title: 'Head dropping during the swing', drill: 'f5' },
    stride: { area: 'timing', title: 'Stride too long', drill: 'f6' },
    foot: { area: 'timing', title: 'Front foot down late', drill: 'f7' },
    seq: { area: 'speed', title: 'Shoulders turning before the hips', drill: 'f8' },
    leg: { area: 'speed', title: 'Front leg soft at contact', drill: 'f9' },
    balance: { area: 'path', title: 'Falling forward at the finish', drill: 'f10' }
  };

  /* frames: array of 33-point pose arrays (or null), one per sample; times: matching sample list from sampleTimes;
     contactIdx: index of the contact sample; speed: slow-motion factor. */
  function analyze(frames, times, contactIdx, speed) {
    const sp = speed > 0 ? speed : 1, f = clean(frames), n = f.length;
    const seen = f.filter(Boolean).length, quality = { frames: n, found: seen };
    const fail = why => ({ ok: false, why, quality, checks: [], faults: [] });
    if (!(contactIdx >= 0 && contactIdx < n)) return fail('The contact moment could not be found in the video.');
    const c = contactIdx;
    if (-times[0].k / SAMPLES_PER_SEC < 0.7) return fail('The video starts too close to contact. Start filming at least 1 second before he swings.');
    if (n < 15 || seen < n * 0.7) return fail('He was not found clearly enough in the video. Film from the side with his whole body in the picture.');
    if (!f[c]) return fail('He was not found at the contact frame.');
    const realT = i => (times[i].t - times[c].t) / sp;   // seconds relative to contact, real time
    const first = f.findIndex(Boolean), stanceIdx = [];
    for (let i = first; i < n && stanceIdx.length < 5; i++) if (f[i]) stanceIdx.push(i);
    const S = j => ({ x: median(stanceIdx.map(i => f[i][j].x)), y: median(stanceIdx.map(i => f[i][j].y)) });
    const seenFeet = stanceIdx.filter(i => ok(f[i][ANK[0]]) && ok(f[i][ANK[1]]) && ok(f[i][NOSE])).length;
    if (seenFeet < Math.ceil(stanceIdx.length / 2)) return fail('His head or feet were cut off or hidden at the start. Keep his whole body, head to feet, in the picture.');
    const ankY = (S(ANK[0]).y + S(ANK[1]).y) / 2, H = Math.abs(ankY - S(NOSE).y) / NOSE_TO_ANKLE;
    if (!(H > 40)) return fail('He is too small in the picture. Move the camera closer so he fills most of the height.');
    // Is this a swing at all? Both hands on the bat (wrists together) and moving through the zone in the last 0.3 s.
    const hand = i => ({ x: (f[i][WR[0]].x + f[i][WR[1]].x) / 2, y: (f[i][WR[0]].y + f[i][WR[1]].y) / 2 });
    const near = []; for (let i = first; i <= c; i++) if (f[i] && realT(i) >= -0.4) near.push(i);
    const gap = median(near.map(i => dist(f[i][WR[0]], f[i][WR[1]]) / H));
    const from = near.find(i => realT(i) >= -0.3), travel = from != null ? dist(hand(from), hand(c)) / H : 0;
    quality.handsGap = gap == null ? null : Math.round(gap * 100) / 100; quality.handsTravel = Math.round(travel * 100) / 100;
    if (!(gap != null && gap <= HANDS_GAP_MAX && travel >= HANDS_TRAVEL_MIN))
      return fail('This does not look like a swing: his hands were not together on the bat and moving through the hitting zone. Film one full swing from the side. If the video is slow motion, set Video speed to match.');
    // Front foot = the ankle that travels farthest by contact. Its direction points to the pitcher.
    const dx = ANK.map(j => f[c][j].x - S(j).x), front = Math.abs(dx[0]) >= Math.abs(dx[1]) ? 0 : 1;
    // Direction to the pitcher is only trusted when there is a real stride (5% of height or more) and the foot is clearly seen.
    const FA = ANK[front], strideRaw = dx[front], dir = Math.abs(strideRaw) >= 0.05 * H && ok(f[c][FA]) ? Math.sign(strideRaw) : null;
    const checks = [], faults = [];
    const add = (id, label, status, value, target, note) => { checks.push({ id, label, status, value, target, note, research: RESEARCH[id === 'drop' ? 'head' : id] }); if (status === 'work') faults.push(id); };
    const pct = x => Math.round(x * 100);

    // Foot plant: first sample where the front ankle sits within 2% of height of where it is at contact, and stays there.
    let plant = null;
    if (dir) { for (let i = c; i >= first; i--) { if (!f[i]) continue; if (Math.abs(f[i][FA].x - f[c][FA].x) < 0.02 * H && Math.abs(f[i][FA].y - f[c][FA].y) < 0.03 * H) plant = i; else break; } }

    // 1. Stride length
    if (dir && ok(f[c][FA])) {
      const s = Math.abs(strideRaw) / H;
      add('stride', 'Stride length', s > 0.6 ? 'work' : 'good', pct(s) + '% of height', 'Up to 60% of height', s > 0.6 ? 'Long stride. Overstriding drops the head and makes him late.' : s < 0.15 ? 'Short or no stride. Fine if he is on time.' : 'Good stride.');
    } else add('stride', 'Stride length', 'info', 'No stride seen', 'Up to 60% of height', 'No stride, or a toe tap. Fine if he is on time. Without a stride the reader cannot tell which way the pitcher is, so head, foot, leg and finish checks are skipped.');

    // 2. Head movement from stance to contact
    const hx = (f[c][NOSE].x - S(NOSE).x) * (dir || 0) / H, hy = (f[c][NOSE].y - S(NOSE).y) / H;
    if (ok(f[c][NOSE]) && dir) {
      const st = hx > 0.10 ? 'work' : hx > 0.05 ? 'watch' : 'good';
      add('head', 'Head toward the pitcher', st, pct(Math.max(0, hx)) + '% of height', 'Under 5% of height', st === 'good' ? 'Head stayed back. Good.' : 'His head slid toward the pitcher. That is a lunge, and it makes it hard to see the ball.');
    }
    if (ok(f[c][NOSE])) {
      const st = hy > 0.08 ? 'work' : hy > 0.05 ? 'watch' : 'good';
      add('drop', 'Head drop', st, pct(Math.max(0, hy)) + '% of height', 'Under 5% of height', st === 'good' ? 'Eyes stayed level.' : 'His head dropped a lot, so his eyes changed level during the pitch.');
    }

    // 3. Front foot down before contact
    if (plant != null) {
      const ms = Math.round(-realT(plant) * 1000), st = ms >= 120 ? 'good' : ms >= 60 ? 'watch' : 'work';
      add('foot', 'Front foot down before contact', st, ms + ' ms', 'About 120 ms or more', st === 'good' ? 'Foot was down early. On time.' : 'His foot landed just before contact, so he was rushing. Get it down earlier.');
    } else if (dir) add('foot', 'Front foot down before contact', 'unsure', 'Not clear', 'About 120 ms or more', 'The front foot was still moving at contact or could not be tracked.');

    // 4. Hips before shoulders: when each starts to turn (side view looks narrower as he turns to the pitcher).
    const wid = (i, J) => f[i] && ok(f[i][J[0]]) && ok(f[i][J[1]]) ? Math.abs(f[i][J[0]].x - f[i][J[1]].x) : null;
    const base = J => median(stanceIdx.map(i => wid(i, J)));
    const onset = J => { const b = base(J); if (!b) return null; const from = plant != null ? Math.max(first, plant - Math.round(0.3 * SAMPLES_PER_SEC)) : first;
      for (let i = from; i <= c; i++) { const w = wid(i, J); if (w != null && w < 0.85 * b) return i; } return null; };
    const oh = onset(HIP), os = onset(SH);
    if (oh != null && os != null) {
      const gap = Math.round((realT(os) - realT(oh)) * 1000), st = gap >= -1000 / SAMPLES_PER_SEC ? 'good' : gap >= -40 ? 'watch' : 'work';
      add('seq', 'Hips turn before shoulders', st, gap >= 0 ? 'Hips first by ' + gap + ' ms' : 'Shoulders first by ' + (-gap) + ' ms', 'Hips first or together', st === 'good' ? 'Hips led the swing. Good.' : 'His shoulders started turning before his hips, so he swings with his upper body.');
    } else add('seq', 'Hips turn before shoulders', 'unsure', 'Not clear', 'Hips first or together', 'The turn was not clear from this angle. Film straight from the side.');

    // 5. Front leg at contact
    const fk = angle(f[c][HIP[front]], f[c][KNEE[front]], f[c][FA]);
    if (fk != null && ok(f[c][KNEE[front]]) && ok(f[c][HIP[front]]) && dir) {
      const st = fk >= 150 ? 'good' : fk >= 135 ? 'watch' : 'work';
      add('leg', 'Front leg firm at contact', st, Math.round(fk) + ' degrees', '150 degrees or straighter', st === 'good' ? 'Front leg firm. Good.' : 'His front knee was still bent at contact, which leaks power.');
    }

    // 6. Balance at the finish (last sample)
    const L = f[n - 1] ? n - 1 : f.map(Boolean).lastIndexOf(true);
    if (L > c && dir && ok(f[L][NOSE]) && ok(f[L][ANK[0]]) && ok(f[L][ANK[1]])) {
      const lead = Math.max(f[L][ANK[0]].x * dir, f[L][ANK[1]].x * dir), past = (f[L][NOSE].x * dir - lead) / H;
      const st = past > 0.05 ? 'work' : 'good';
      add('balance', 'Balanced finish', st, st === 'good' ? 'Over his feet' : pct(past) + '% of height past his front foot', 'Head over his feet', st === 'good' ? 'Balanced finish.' : 'He fell toward the pitcher after the swing.');
    }

    const order = ['head', 'foot', 'seq', 'leg', 'drop', 'stride', 'balance'];
    faults.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const top = faults[0] ? FIX[faults[0]] : null;
    return { ok: true, v: 1, quality, H: Math.round(H), front: front === 0 ? 'left' : 'right', checks, faults,
      top: top ? { id: faults[0], title: top.title, area: top.area, drill: top.drill } : null,
      events: { plant: plant != null ? Math.round(realT(plant) * 1000) : null, hips: oh != null ? Math.round(realT(oh) * 1000) : null, shoulders: os != null ? Math.round(realT(os) * 1000) : null } };
  }

  /* Two reads of the same video, the second half a frame later. A problem only counts when both reads find it;
     a big disagreement is shown as unclear instead of being guessed. */
  function merge(a, b) {
    if (!a || !a.ok) return a;
    if (!b || !b.ok) return Object.assign({}, a, { ok: false, why: 'The two reads of this video did not agree that it shows a clear swing. ' + ((b && b.why) || 'Film again from the side with a steady camera.'), checks: [], faults: [], top: null });
    const checks = [], faults = [];
    for (const x of a.checks) {
      const y = b.checks.find(k => k.id === x.id); let st = x.status, value = x.value, note = x.note;
      if (!y) { st = 'unsure'; value = 'Unclear'; note = 'Only one of the two reads could measure this. Film again from the side with a steady camera.'; }
      else if (x.status !== y.status) {
        const pair = [x.status, y.status].sort().join('/');
        if (pair === 'watch/work') st = 'watch';
        else if (pair === 'good/watch') st = 'watch';
        else if (pair === 'info/info') st = 'info';
        else { st = 'unsure'; note = 'The two reads of this video disagreed (' + x.value + ' and ' + y.value + '), so it is not graded. Film again from the side with a steady camera.'; }
        if (st !== 'unsure') value = x.value === y.value ? x.value : x.value + ' (2nd read: ' + y.value + ')';
        else value = 'Unclear';
      }
      const ck = Object.assign({}, x, { status: st, value, note }); checks.push(ck); if (st === 'work') faults.push(x.id);
    }
    const order = ['head', 'foot', 'seq', 'leg', 'drop', 'stride', 'balance'];
    faults.sort((p, q) => order.indexOf(p) - order.indexOf(q));
    const top = faults[0] ? FIX[faults[0]] : null;
    return Object.assign({}, a, { checks, faults, reads: 2, top: top ? { id: faults[0], title: top.title, area: top.area, drill: top.drill } : null });
  }
  // Compare one check with his earlier side-view swings (newest first). Returns the earlier average and how many.
  const num = s => { const m = /(-?[\d.]+)/.exec(String(s)); return m ? parseFloat(m[1]) : null; };
  function trend(id, earlier) {
    const vals = []; for (const r of earlier) { const ck = r && r.checks && r.checks.find(x => x.id === id); if (ck && ck.status !== 'unsure' && ck.status !== 'info') { const v = num(ck.value); if (v != null) vals.push(ck.value.indexOf('Shoulders first') === 0 ? -v : v); } if (vals.length >= 5) break; }
    return vals.length ? { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), n: vals.length } : null;
  }
  // Skeleton lines for drawing over a frame.
  const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [11, 13], [13, 15], [12, 14], [14, 16], [0, 11], [0, 12]];
  return { sampleTimes, clean, analyze, merge, trend, angle, FIX, RESEARCH, BONES, SAMPLES_PER_SEC, BEFORE, AFTER, num };
})();
if (typeof module !== 'undefined') module.exports = HubSwing;
