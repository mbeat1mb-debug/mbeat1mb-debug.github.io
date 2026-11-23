/* Arcade: five baseball games drawn on a canvas, plus sounds. Self-contained full-screen layer.
   Jaxson plays as #20 for the Seed Spitters (black and orange), batting and throwing left-handed. */
const HubGames = (() => {
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v); }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    return n;
  };
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = n => Math.floor(Math.random() * n);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[rand(a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const shuffled = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const TEAM = { black: '#161616', green: '#1d6a3b', orange: '#f28c38', deep: '#d15d0a', name: 'SEED SPITTERS' };
  let ME = { name: 'Jaxson', num: '20', bats: 'left' };

  /* ---------- Sounds: made in the browser, no files. Off switch is per device. ---------- */
  const Sound = (() => {
    let ctx = null;
    const on = () => { try { return localStorage.getItem('dugout-sound') !== 'off'; } catch (e) { return true; } };
    const set = v => { try { localStorage.setItem('dugout-sound', v ? 'on' : 'off'); } catch (e) {} };
    const ac = () => { if (!on()) return null; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch (e) { return null; } };
    // Noise is made once per length and reused, so a tap never waits on it.
    const bufs = {};
    const noise = (c, secs) => { const key = Math.round(secs * 1000); let b = bufs[key];
      if (!b) { b = bufs[key] = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * secs)), c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = c.createBufferSource(); s.buffer = b; return s; };
    const env = (c, g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const nz = (secs, type, freq, peak, a, d, q, delay) => { const c = ac(); if (!c) return; const t = c.currentTime + (delay || 0), n = noise(c, secs), f = c.createBiquadFilter(), g = c.createGain();
      f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; env(c, g, t, peak, a, d); n.connect(f).connect(g).connect(c.destination); n.start(t); };
    const tone = (freq, type, peak, a, d, delay, to) => { const c = ac(); if (!c) return; const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type;
      o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d); env(c, g, t, peak, a, d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + a + d + 0.05); };
    // iPads only allow sound to start inside a real tap: unlock() runs in the tap, the sound itself plays right after the screen updates.
    const unlock = () => { ac(); };
    const later = f => { unlock(); setTimeout(f, 0); };
    const crack = () => { nz(0.12, 'highpass', 1800, 0.9, 0.002, 0.1); tone(900, 'square', 0.25, 0.002, 0.06, 0, 300); };
    const cheer = () => { nz(2.2, 'bandpass', 1100, 0.5, 0.45, 1.6, 0.7); for (let i = 0; i < 10; i++) nz(0.03, 'highpass', 2500, 0.25, 0.002, 0.03, 0, 0.3 + Math.random() * 1.4); };
    const blip = ok => { tone(ok ? 660 : 220, 'triangle', 0.25, 0.005, 0.18); if (ok) tone(990, 'triangle', 0.22, 0.005, 0.15, 0.08); };
    const pop = () => { nz(0.08, 'lowpass', 700, 0.9, 0.002, 0.07); tone(160, 'sine', 0.4, 0.002, 0.08, 0, 70); };
    const whoosh = () => nz(0.3, 'bandpass', 900, 0.35, 0.05, 0.22, 1.2);
    const ooh = () => nz(1.2, 'bandpass', 450, 0.3, 0.25, 0.8, 2);
    const slide = () => nz(0.5, 'lowpass', 900, 0.5, 0.02, 0.45);
    const tick = () => tone(1800, 'square', 0.08, 0.001, 0.03);
    const boom = () => { nz(0.9, 'lowpass', 400, 0.7, 0.01, 0.85); nz(0.4, 'highpass', 3000, 0.15, 0.2, 0.2, 0, 0.15); };
    // The ballpark organ: "charge!"
    const organ = () => [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45], [659, 0.75], [784, 0.9]].forEach(([f, d], i) => tone(f, 'square', 0.12, 0.01, i === 5 ? 0.6 : 0.13, d));
    function say(text) { if (!on() || !window.speechSynthesis) return; try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; u.pitch = 0.8; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
    // Warm the buffers once the first tap has unlocked audio.
    const warm = () => { const c = ac(); if (c) [0.12, 2.2, 0.03, 0.08, 0.3, 1.2, 0.5, 0.9, 0.4].forEach(s => noise(c, s)); };
    return { on, set, crack, cheer, blip, pop, whoosh, ooh, slide, tick, boom, organ, say, later, unlock, warm };
  })();

  /* ---------- Trivia bank. lvl 1 = easy (rules), 2 = medium, 3 = hard (history). Facts kept to settled ones. ---------- */
  const Q = (lvl, q, a, w, fact) => ({ lvl, q, a, w, fact });
  const TRIVIA = [
    Q(1, 'How many outs does each team get in a half-inning?', '3', ['2', '4', '5'], 'Three outs and the teams switch.'),
    Q(1, 'How many strikes make a strikeout?', '3', ['2', '4', '5'], 'Strike three and you are out.'),
    Q(1, 'How many balls make a walk?', '4', ['3', '5', '6'], 'Ball four sends the batter to first base.'),
    Q(1, 'How many players does the team in the field have?', '9', ['8', '10', '11'], 'Pitcher, catcher, 4 infielders and 3 outfielders.'),
    Q(1, 'How many innings are in a regular MLB game?', '9', ['6', '7', '10'], 'Nine innings, plus extra innings if it is tied.'),
    Q(1, 'How many innings are in a regular Little League game?', '6', ['5', '7', '9'], 'Little League games are 6 innings.'),
    Q(1, 'What shape is home plate?', 'It has 5 sides', ['Square', 'Circle', 'Triangle'], 'Home plate is a five-sided shape called a pentagon.'),
    Q(1, 'In scorekeeping, what number is the shortstop?', '6', ['4', '5', '7'], '1 pitcher, 2 catcher, 3 first, 4 second, 5 third, 6 shortstop.'),
    Q(1, 'In scorekeeping, what number is the catcher?', '2', ['1', '3', '9'], 'The catcher is number 2.'),
    Q(1, 'In scorekeeping, what number is the center fielder?', '8', ['7', '9', '6'], '7 left field, 8 center field, 9 right field.'),
    Q(1, 'What is a grand slam?', 'A home run with the bases loaded', ['Hitting 4 home runs in a game', 'A triple play', 'Stealing home'], 'Bases loaded plus a home run.'),
    Q(1, 'How many runs score on a grand slam?', '4', ['3', '2', '5'], 'Three runners plus the batter.'),
    Q(1, 'What does RBI stand for?', 'Run batted in', ['Really big inning', 'Runner on base inside', 'Run by infield'], 'You get an RBI when your hit (or walk, or out) brings a run home.'),
    Q(1, 'You have 2 strikes and hit a foul ball (not a bunt). What happens?', 'The count stays the same', ['You are out', 'It is strike three', 'You get a ball'], 'A foul can be strike one or two, but never strike three, unless you bunt it.'),
    Q(1, 'You have 2 strikes and bunt the ball foul. What happens?', 'You are out on strikes', ['The count stays the same', 'You get another try', 'It is a ball'], 'A foul bunt with 2 strikes is strike three.'),
    Q(1, 'What is a left-handed pitcher often called?', 'A southpaw', ['A sidearm', 'A closer', 'A slugger'], 'Lefties like you are called southpaws.'),
    Q(1, 'What does "can of corn" mean?', 'An easy fly ball to catch', ['A hard ground ball', 'A wild pitch', 'A broken bat'], 'Old baseball slang for a lazy, easy fly ball.'),
    Q(1, 'What is a double play?', 'Two outs on one play', ['Two hits in a row', 'Two runs on one hit', 'Two pitchers in one inning'], 'Turning two is a fielder’s favorite play.'),
    Q(1, 'Which team bats first in a game?', 'The visiting team', ['The home team', 'The team with the best record', 'Whoever wins a coin flip'], 'The home team bats in the bottom of each inning.'),
    Q(1, 'What happens if a pitch hits the batter?', 'The batter goes to first base', ['It is a strike', 'The batter is out', 'Nothing, play on'], 'Hit by pitch means a free trip to first.'),
    Q(1, 'What is a walk-off hit?', 'A hit that wins the game for the home team in its last turn', ['A hit that rolls slowly', 'A hit in the first inning', 'A hit off the wall'], 'The game ends right away, so everyone walks off the field.'),
    Q(1, 'On a caught fly ball, what must a runner do before running to the next base?', 'Touch their base again (tag up)', ['Nothing', 'Run back to home', 'Wait for the umpire to say go'], 'If you leave early and the ball is caught, you can be doubled off.'),
    Q(1, 'What does a 6-4-3 double play mean?', 'Shortstop to second baseman to first baseman', ['Pitcher to catcher to first', 'Third to second to first', 'Center fielder to second to first'], 'Use the position numbers: 6 shortstop, 4 second base, 3 first base.'),
    Q(1, 'What is hitting for the cycle?', 'A single, double, triple and home run in one game', ['4 home runs in one game', 'Getting a hit every inning', 'Hitting to every field'], 'It is rare. The triple is usually the hardest part.'),
    Q(2, 'How far apart are the bases in Little League?', '60 feet', ['45 feet', '75 feet', '90 feet'], 'In MLB they are 90 feet apart.'),
    Q(2, 'How far apart are the bases in MLB?', '90 feet', ['60 feet', '80 feet', '100 feet'], 'Ninety feet, the same since the 1800s.'),
    Q(2, 'How far is it from the pitcher’s rubber to home plate in MLB?', '60 feet, 6 inches', ['50 feet', '46 feet', '66 feet'], 'In Little League Majors it is 46 feet.'),
    Q(2, 'How far is the pitcher’s rubber from home plate in Little League Majors?', '46 feet', ['40 feet', '50 feet', '60 feet, 6 inches'], 'That is why pitches get on you fast in Little League.'),
    Q(2, 'What is a balk?', 'An illegal move by the pitcher with runners on base', ['A ball that bounces before the plate', 'A batter stepping out of the box', 'A catcher dropping strike three'], 'On a balk, every runner moves up one base.'),
    Q(2, 'What is a no-hitter?', 'A game where a team gets no hits', ['A game with no runs at all', 'A game with no walks', 'A rainout'], 'Batters can still reach on walks or errors in a no-hitter.'),
    Q(2, 'What is a perfect game?', 'No batter from the other team reaches base at all', ['A no-hitter with 10 strikeouts', 'A win by 10 runs', 'A shutout in 6 innings'], 'No hits, no walks, no errors, no hit batters. 27 up, 27 down.'),
    Q(2, 'What is a golden sombrero?', 'Striking out 4 times in one game', ['Hitting 4 home runs in one game', 'A fancy catch', 'A pitcher’s first win'], 'Nobody wants a golden sombrero!'),
    Q(2, 'What does ERA measure for a pitcher?', 'Earned runs allowed per 9 innings', ['Strikeouts per game', 'How hard he throws', 'Wins minus losses'], 'Lower is better. Under 3.00 is excellent in MLB.'),
    Q(2, 'Which award goes to the best fielders?', 'The Gold Glove', ['The Silver Slugger', 'The Cy Young', 'The Golden Bat'], 'One Gold Glove for each position in each league.'),
    Q(2, 'Which award goes to the best hitters at each position?', 'The Silver Slugger', ['The Gold Glove', 'The Cy Young', 'The Iron Man'], 'Gold Glove is for defense. Silver Slugger is for hitting.'),
    Q(2, 'Which award goes to the best pitcher in each league?', 'The Cy Young Award', ['The Gold Glove', 'The Silver Slugger', 'The Rolaids Cup'], 'Named after Cy Young, who won 511 games.'),
    Q(2, 'Where is the Baseball Hall of Fame?', 'Cooperstown, New York', ['Boston, Massachusetts', 'Chicago, Illinois', 'Philadelphia, Pennsylvania'], 'It opened in 1939.'),
    Q(2, 'Where is the Little League World Series played?', 'Williamsport, Pennsylvania', ['Cooperstown, New York', 'Omaha, Nebraska', 'Orlando, Florida'], 'Teams come from all over the world every August.'),
    Q(2, 'What is the famous tall left-field wall at Fenway Park called?', 'The Green Monster', ['The Big Blue Wall', 'The Ivy Wall', 'The Monster Mash'], 'Fenway is home of the Boston Red Sox.'),
    Q(2, 'What grows on the outfield walls at Wrigley Field?', 'Ivy', ['Roses', 'Pine trees', 'Corn'], 'Wrigley Field is home of the Chicago Cubs.'),
    Q(2, 'Which team plays at Citizens Bank Park?', 'Philadelphia Phillies', ['Pittsburgh Pirates', 'New York Mets', 'Baltimore Orioles'], 'The Phillies won the World Series in 1980 and 2008.'),
    Q(2, 'Which team plays at PNC Park?', 'Pittsburgh Pirates', ['Philadelphia Phillies', 'Cleveland Guardians', 'Cincinnati Reds'], 'PNC Park sits right on the river in Pittsburgh.'),
    Q(2, 'In what year did MLB start using a pitch clock?', '2023', ['2015', '2019', '2025'], 'Games got about 25 minutes shorter.'),
    Q(2, 'Why can left-handed batters often beat out ground balls?', 'They start closer to first base', ['Their bats are lighter', 'They are allowed a running start', 'Infielders play deeper for them'], 'The lefty box is a step or two closer to first. Use it!'),
    Q(2, 'What pitch do pitchers throw more than any other?', 'The fastball', ['The knuckleball', 'The curveball', 'The eephus pitch'], 'Young pitchers should master the fastball and changeup first.'),
    Q(2, 'What is a "Texas Leaguer"?', 'A soft hit that drops between infielders and outfielders', ['A home run to left field', 'A pitch in the dirt', 'A stolen base'], 'Also called a blooper.'),
    Q(2, 'What is the job of a closer?', 'Pitch the last inning to finish off a win', ['Start the game', 'Close the dugout gate', 'Coach first base'], 'Closers earn saves.'),
    Q(2, 'Who calls balls and strikes?', 'The home plate umpire', ['The catcher', 'The pitching coach', 'The first base umpire'], 'Arguing balls and strikes can get you tossed!'),
    Q(3, 'Who broke MLB’s color barrier in 1947?', 'Jackie Robinson', ['Willie Mays', 'Hank Aaron', 'Roberto Clemente'], 'He played for the Brooklyn Dodgers.'),
    Q(3, 'What number is retired by every MLB team to honor Jackie Robinson?', '42', ['24', '44', '7'], 'Every player wears 42 on Jackie Robinson Day, April 15.'),
    Q(3, 'How many career home runs did Babe Ruth hit?', '714', ['755', '660', '500'], 'It was the record for almost 40 years.'),
    Q(3, 'Whose record of 755 home runs stood until 2007?', 'Hank Aaron', ['Babe Ruth', 'Willie Mays', 'Mickey Mantle'], 'Hammerin’ Hank broke Babe Ruth’s record in 1974.'),
    Q(3, 'Who holds the record for most career home runs?', 'Barry Bonds (762)', ['Hank Aaron (755)', 'Babe Ruth (714)', 'Albert Pujols (703)'], 'Bonds also hit 73 in 2001, the single-season record.'),
    Q(3, 'What is the MLB record for home runs in one season?', '73', ['61', '62', '70'], 'Barry Bonds hit 73 in 2001.'),
    Q(3, 'In 2022, Aaron Judge set the American League home run record with how many?', '62', ['61', '60', '73'], 'He passed Roger Maris, who hit 61 in 1961.'),
    Q(3, 'Joe DiMaggio got a hit in how many straight games in 1941?', '56', ['44', '61', '30'], 'Nobody has come close since.'),
    Q(3, 'Who was the last MLB player to hit .400 for a season?', 'Ted Williams', ['Babe Ruth', 'Tony Gwynn', 'Ichiro Suzuki'], 'He hit .406 in 1941.'),
    Q(3, 'Who has the most strikeouts by a pitcher in MLB history?', 'Nolan Ryan', ['Randy Johnson', 'Roger Clemens', 'Sandy Koufax'], '5,714 strikeouts and 7 no-hitters.'),
    Q(3, 'How many no-hitters did Nolan Ryan throw?', '7', ['3', '5', '10'], 'The most in MLB history.'),
    Q(3, 'Who has the most wins by a pitcher in MLB history?', 'Cy Young', ['Walter Johnson', 'Nolan Ryan', 'Greg Maddux'], '511 wins. The pitching award is named after him.'),
    Q(3, 'Who has the most hits in MLB history?', 'Pete Rose', ['Ty Cobb', 'Hank Aaron', 'Derek Jeter'], '4,256 hits.'),
    Q(3, 'Who has the most stolen bases in MLB history?', 'Rickey Henderson', ['Lou Brock', 'Ty Cobb', 'Jackie Robinson'], '1,406 steals.'),
    Q(3, 'How many hits did Ichiro Suzuki get in 2004, the single-season record?', '262', ['200', '232', '300'], 'He broke a record that had stood since 1920.'),
    Q(3, 'In 2024, who became the first player with 50 home runs and 50 stolen bases in one season?', 'Shohei Ohtani', ['Aaron Judge', 'Ronald Acuña Jr.', 'Mike Trout'], 'He finished with 54 homers and 59 steals.'),
    Q(3, 'Shohei Ohtani is famous for doing what two things?', 'Pitching and hitting', ['Catching and coaching', 'Stealing and bunting', 'Pitching and umpiring'], 'A two-way star, like Babe Ruth was early on.'),
    Q(3, 'Lou Gehrig played in how many straight games?', '2,130', ['1,000', '2,632', '3,000'], 'His streak lasted from 1925 to 1939.'),
    Q(3, 'Who broke Lou Gehrig’s streak of straight games played?', 'Cal Ripken Jr.', ['Derek Jeter', 'Pete Rose', 'Ernie Banks'], 'Ripken played 2,632 straight games.'),
    Q(3, 'Which team has won the most World Series titles?', 'New York Yankees', ['Boston Red Sox', 'St. Louis Cardinals', 'Los Angeles Dodgers'], 'The Yankees have 27 titles.'),
    Q(3, 'When was the first modern World Series?', '1903', ['1869', '1920', '1950'], 'Boston beat Pittsburgh.'),
    Q(3, 'What position did Babe Ruth mostly play when he started with the Red Sox?', 'Pitcher', ['Catcher', 'Shortstop', 'First base'], 'He was a lefty pitcher before he became a slugger.'),
    Q(3, 'Which left-handed pitcher won 5 Cy Young Awards?', 'Randy Johnson', ['Sandy Koufax', 'Clayton Kershaw', 'Steve Carlton'], 'The Big Unit stood 6 feet 10 inches tall.'),
    Q(3, 'Sandy Koufax, a famous lefty, pitched for which team?', 'Dodgers', ['Yankees', 'Cubs', 'Phillies'], 'He threw 4 no-hitters, including a perfect game.'),
    Q(3, 'Which hand does Clayton Kershaw throw with?', 'Left', ['Right', 'Both', 'He is a catcher'], 'A lefty like you, with 3 Cy Young Awards.'),
    Q(3, 'Who has the most saves in MLB history?', 'Mariano Rivera', ['Trevor Hoffman', 'Dennis Eckersley', 'Lee Smith'], '652 saves with his famous cutter.'),
    Q(3, 'Willie Mays made a famous over-the-shoulder catch in which 1954 event?', 'The World Series', ['The All-Star Game', 'Spring training', 'The Little League World Series'], 'It is known simply as "The Catch."'),
    Q(3, 'Roberto Clemente finished his career with exactly how many hits?', '3,000', ['2,500', '3,500', '4,000'], 'He played his whole career for the Pittsburgh Pirates.'),
    Q(3, 'What number did Derek Jeter wear for the Yankees?', '2', ['3', '7', '42'], 'The Yankees retired it in 2017.')
  ];


  /* ---------- Shared game shell ---------- */
  let layer = null, live = null, onExit = null;
  function open(title, sub) {
    close(true);
    layer = el('div', { class: 'arcade', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const quit = el('button', { type: 'button', class: 'btn ghost', id: 'game-quit', onclick: () => close() }, 'Quit');
    const status = el('div', { class: 'g-status', 'aria-live': 'polite' });
    const stage = el('div', { class: 'g-stage' });
    layer.append(el('div', { class: 'g-top' }, el('div', null, el('b', null, title), sub ? el('span', null, sub) : null), status, quit), stage);
    document.body.appendChild(layer); document.body.classList.add('gaming'); quit.focus();
    return { stage, status };
  }
  function close(silent) {
    if (live && live.stop) live.stop(); live = null;
    if (layer) { layer.remove(); layer = null; document.body.classList.remove('gaming'); }
    if (!silent && onExit) { const f = onExit; onExit = null; f(null); }
  }
  function finish(ui, score, lines, done) {
    if (live && live.stop) live.stop(); live = null;
    onExit = null;
    ui.stage.classList.remove('cvstage');
    ui.stage.replaceChildren(el('div', { class: 'g-end' }, el('p', { class: 'g-big' }, lines[0]), lines.slice(1).map(t => el('p', null, t)),
      el('div', { class: 'g-endbtns' }, score == null ? null : el('button', { type: 'button', class: 'btn line', id: 'game-again', onclick: () => { close(true); done(score, true); } }, 'Save and play again'),
        el('button', { type: 'button', class: 'btn', id: 'game-done', onclick: () => { close(true); done(score); } }, score == null ? 'Back to the Arcade' : 'Save my score'))));
    document.getElementById('game-done').focus();
  }

  /* ---------- Canvas engine: sizing, frame loop, touch, particles, floating words, screen shake ---------- */
  function Engine(ui) {
    const cv = el('canvas', { class: 'g-cv', role: 'img', 'aria-label': 'Game field' });
    const sr = el('p', { class: 'g-sr', 'aria-live': 'polite' });
    ui.stage.classList.add('cvstage'); ui.stage.replaceChildren(cv, sr);
    const c = cv.getContext('2d');
    const E = { cv, c, W: 0, H: 0, t: 0, parts: [], floats: [], shakeT: 0, shakeA: 0, draw: null, onResize: null, down: null, move: null, up: null, key: null,
      say: t => { sr.textContent = t; ui.status.textContent = t; } };
    let raf = 0, last = 0, run = true;
    const fit = () => { const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); if (!r.width || !r.height) return;
      E.W = r.width; E.H = r.height; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0); if (E.onResize) E.onResize(); };
    const frame = now => {
      if (!run) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; E.t += dt;
      if (!E.W) fit();
      c.save();
      if (E.shakeT > 0 && !still()) { E.shakeT -= dt; c.translate((Math.random() - 0.5) * E.shakeA, (Math.random() - 0.5) * E.shakeA); }
      if (E.draw && E.W) E.draw(dt);
      fx(dt); c.restore();
      raf = requestAnimationFrame(frame);
    };
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); Sound.unlock(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} if (E.down) E.down(...pos(e)); });
    cv.addEventListener('pointermove', e => { if (E.move) E.move(...pos(e), e.buttons || e.pressure > 0); });
    const up = e => { if (E.up) E.up(...pos(e)); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const key = e => { if (E.key && (e.key === ' ' || e.key === 'Enter' || e.key.startsWith('Arrow') || /^[1-4]$/.test(e.key))) { e.preventDefault(); E.key(e.key); } };
    layer.addEventListener('keydown', key);
    window.addEventListener('resize', fit);
    E.start = () => { fit(); raf = requestAnimationFrame(frame); cv.tabIndex = 0; cv.focus(); };
    E.stop = () => { run = false; cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
    E.shake = (a, t) => { E.shakeA = a; E.shakeT = t; };
    E.burst = (x, y, n, colors, speed, grav, size) => { if (still()) n = Math.ceil(n / 4);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (speed || 220) * (0.3 + Math.random() * 0.7);
        E.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: grav == null ? 300 : grav, life: 0.8 + Math.random() * 0.7, age: 0, col: pick(colors), r: (size || 3) * (0.6 + Math.random() * 0.8) }); } };
    E.float = (text, x, y, col, size) => E.floats.push({ text, x, y, col: col || '#fff', size: size || 34, age: 0, life: 1.6 });
    function fx(dt) {
      E.parts = E.parts.filter(p => (p.age += dt) < p.life);
      for (const p of E.parts) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; c.globalAlpha = 1 - p.age / p.life; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      E.floats = E.floats.filter(f => (f.age += dt) < f.life);
      for (const f of E.floats) { const k = f.age / f.life, pop = f.age < 0.15 ? 0.6 + f.age / 0.15 * 0.4 : 1; c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        txt(c, f.text, f.x, f.y - k * 40, f.size * pop, f.col, 'center', 800, 6); }
      c.globalAlpha = 1;
    }
    return E;
  }

  /* ---------- Drawing helpers ---------- */
  const FONT = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
  function txt(c, s, x, y, size, fill, align, weight, stroke) {
    c.font = (weight || 800) + ' ' + Math.round(size) + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    if (stroke !== 0) { c.lineJoin = 'round'; c.lineWidth = stroke || Math.max(3, size / 7); c.strokeStyle = 'rgba(0,0,0,.65)'; c.strokeText(s, x, y); }
    c.fillStyle = fill || '#fff'; c.fillText(s, x, y);
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function limb(c, ax, ay, bx, by, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
  function ball(c, x, y, r, trail) {
    if (trail) { c.fillStyle = 'rgba(255,140,40,.35)'; c.beginPath(); c.arc(x, y, r * 2.2, 0, 7); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    if (r > 4) { c.strokeStyle = '#d2342a'; c.lineWidth = Math.max(1, r / 6); c.beginPath(); c.arc(x - r * 1.25, y, r * 0.9, -0.7, 0.7); c.stroke(); c.beginPath(); c.arc(x + r * 1.25, y, r * 0.9, Math.PI - 0.7, Math.PI + 0.7); c.stroke(); }
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  }
  // A ballplayer. (x, y) = feet on the ground, s = pixels per foot. Pose angles in radians; 0 = straight down.
  // o: { top, bottom, cap, num, face: 1 right / -1 left, back: seen from behind, lean, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR, crouch, bat, mitt, glove }
  function guy(c, x, y, s, o) {
    o = o || {}; const f = o.face || 1, skin = '#e8b58d', top = o.top || TEAM.black, bot = o.bottom || '#f4f1ea', cap = o.cap || top;
    const cr = o.crouch || 0, hipY = y - s * (2.6 - cr * 1.0), shY = hipY - s * 1.75, lean = (o.lean || 0) * s;
    const hx = x + lean * 0.4, sx = x + lean;
    const leg = (ang, knee, side) => { const kx = hx + Math.sin(ang) * s * 1.3 + side * s * 0.15, ky = hipY + Math.cos(ang) * s * 1.3 - (knee || 0) * s * 0.9;
      const fx2 = kx + Math.sin(ang * 0.4) * s * 0.2 + side * s * 0.05 - (knee || 0) * s * 0.3 * f, fy = Math.min(y, ky + s * 1.3);
      limb(c, hx + side * s * 0.25, hipY, kx, ky, s * 0.62, bot); limb(c, kx, ky, fx2, fy, s * 0.55, bot);
      limb(c, fx2 - f * s * 0.05, fy, fx2 + f * s * 0.35, fy, s * 0.35, '#222'); };
    const arm = (ang, elbow, side, held) => { const ex = sx + side * s * 0.45 + Math.sin(ang) * s * 0.95, ey = shY + s * 0.2 + Math.cos(ang) * s * 0.95;
      const a2 = ang + (elbow || 0), hx2 = ex + Math.sin(a2) * s * 0.9, hy = ey + Math.cos(a2) * s * 0.9;
      limb(c, sx + side * s * 0.45, shY + s * 0.2, ex, ey, s * 0.5, top); limb(c, ex, ey, hx2, hy, s * 0.42, skin);
      if (held === 'glove') { c.fillStyle = '#7a4a22'; c.beginPath(); c.arc(hx2, hy, s * 0.42, 0, 7); c.fill(); }
      return [hx2, hy]; };
    // back leg and arm first
    leg(o.legR || 0.12, o.kneeR, 1);
    const handR = arm(o.armR == null ? 0.25 : o.armR, o.elbowR, f, o.glove === 'R' ? 'glove' : null);
    leg(o.legL || -0.12, o.kneeL, -1);
    // body
    c.fillStyle = top; rr(c, sx - s * 0.62, shY, s * 1.24, hipY - shY + s * 0.2, s * 0.35); c.fill();
    c.fillStyle = bot; rr(c, hx - s * 0.6, hipY - s * 0.1, s * 1.2, s * 0.45, s * 0.15); c.fill();
    c.fillStyle = TEAM.orange; c.fillRect(hx - s * 0.6, hipY - s * 0.12, s * 1.2, s * 0.12);
    if (o.num) txt(c, o.num, sx, shY + s * 0.85, s * (o.back ? 0.95 : 0.6), o.numCol || TEAM.orange, 'center', 800, Math.max(2, s * 0.1));
    if (o.name && o.back) txt(c, o.name, sx, shY + s * 0.25, s * 0.3, '#fff', 'center', 700, 0);
    // head and cap
    const hy = shY - s * 0.55;
    c.fillStyle = skin; c.beginPath(); c.arc(sx, hy, s * 0.42, 0, 7); c.fill();
    c.fillStyle = cap; c.beginPath(); c.arc(sx, hy - s * 0.06, s * 0.44, Math.PI, 0); c.fill();
    if (o.back) { c.fillRect(sx - s * 0.44, hy - s * 0.1, s * 0.88, s * 0.18); }
    else { c.fillStyle = o.brim || cap; c.beginPath(); c.ellipse(sx + f * s * 0.36, hy - s * 0.04, s * 0.36, s * 0.1, 0, 0, 7); c.fill(); }
    if (o.helmet) { c.fillStyle = o.helmet; c.beginPath(); c.arc(sx, hy - s * 0.04, s * 0.5, Math.PI * 0.95, Math.PI * 2.05); c.fill(); }
    const handL = arm(o.armL == null ? -0.25 : o.armL, o.elbowL, -f, o.glove === 'L' ? 'glove' : null);
    return { handL, handR, head: [sx, hy], sh: [sx, shY] };
  }
  function bat(c, hx, hy, ang, s) {   // ang: 0 = pointing straight up
    const L = s * 2.7, ex = hx + Math.sin(ang) * L, ey = hy - Math.cos(ang) * L;
    c.lineCap = 'round'; limb(c, hx, hy, hx + (ex - hx) * 0.45, hy + (ey - hy) * 0.45, s * 0.2, '#c99a5b'); limb(c, hx + (ex - hx) * 0.4, hy + (ey - hy) * 0.4, ex, ey, s * 0.34, '#d8ac6a');
  }
  // Night-game sky with light towers.
  function sky(c, W, H, y2) {
    const g = c.createLinearGradient(0, 0, 0, y2); g.addColorStop(0, '#0b1636'); g.addColorStop(1, '#2b4c8c'); c.fillStyle = g; c.fillRect(0, 0, W, y2);
    for (const lx of [0.08, 0.92]) { const x = W * lx, y = y2 * 0.18; c.fillStyle = 'rgba(255,250,220,.16)'; c.beginPath(); c.arc(x, y, W * 0.12, 0, 7); c.fill();
      c.fillStyle = '#fffbe6'; rr(c, x - 18, y - 8, 36, 16, 3); c.fill(); }
  }
  function crowd(c, dots, wave, t) {
    for (const d of dots) { const bob = wave > 0 ? Math.max(0, Math.sin(t * 9 - d.x * 0.02)) * 5 * wave : 0;
      c.fillStyle = d.col; c.beginPath(); c.arc(d.x, d.y - bob, d.r, 0, 7); c.fill(); }
  }
  const CROWD = ['#f28c38', '#ffffff', '#161616', '#d15d0a', '#ffd23f', '#4a90d9', '#e04f5f', '#7bc96f'];
  function makeCrowd(x0, x1, y0, y1, n) { const a = []; for (let i = 0; i < n; i++) { const y = rnd(y0, y1); a.push({ x: rnd(x0, x1), y, r: 2 + (y - y0) / (y1 - y0 + 1) * 2.5, col: pick(CROWD) }); } return a.sort((p, q) => p.y - q.y); }
  // A wide round button drawn on the canvas. Returns true if (x, y) hits it.
  function cbtn(c, b, label, on, sub) {
    c.fillStyle = on ? TEAM.orange : 'rgba(255,255,255,.92)'; rr(c, b.x, b.y, b.w, b.h, 14); c.fill();
    c.strokeStyle = TEAM.black; c.lineWidth = 3; rr(c, b.x, b.y, b.w, b.h, 14); c.stroke();
    txt(c, label, b.x + b.w / 2, b.y + b.h / 2 - (sub ? 8 : 0), Math.min(26, b.h * 0.42), TEAM.black, 'center', 800, 0);
    if (sub) txt(c, sub, b.x + b.w / 2, b.y + b.h / 2 + 14, 14, '#333', 'center', 600, 0);
  }
  const inB = (b, x, y) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  function scoreboard(c, W, items) {   // items: [[label, value], ...] across the top
    const h = 54, w = Math.min(W - 16, 760), x = (W - w) / 2;
    c.fillStyle = 'rgba(16,16,16,.88)'; rr(c, x, 8, w, h, 10); c.fill(); c.strokeStyle = TEAM.orange; c.lineWidth = 2; rr(c, x, 8, w, h, 10); c.stroke();
    const cw = w / items.length;
    items.forEach(([l, v, col], i) => { const sv = String(v), fs = Math.min(24, (cw - 6) / Math.max(1, sv.length * 0.62)); txt(c, l, x + cw * (i + 0.5), 22, Math.min(13, cw / 7), '#bbb', 'center', 700, 0); txt(c, sv, x + cw * (i + 0.5), 44, fs, col || '#ffd23f', 'center', 800, 0); });
  }
  const dots = (n, of, col) => { let s = ''; for (let i = 0; i < of; i++) s += i < n ? '●' : '○'; return s; };

  /* ---------- 1. HOME RUN DERBY: view from behind the plate, 10 outs ---------- */
  // Home Run Derby is a 3D game in its own file (derby3d.js), loaded the first time it opens.
  // If this device can't run 3D graphics, the flat version below is used instead.
  function derby(level, done) {
    const ui = open('Home Run Derby', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' \u00b7 10 outs');
    ui.stage.classList.add('cvstage');
    ui.stage.replaceChildren(el('div', { class: 'd3load' }, el('b', null, 'Loading Seed Spitters Park\u2026'), el('i', null)));
    import('./derby3d.js').then(m => (m.ready || Promise.resolve()).then(() => m)).then(m => {
      if (!layer) return;
      try {
        const g = m.start({ stage: ui.stage, level, me: ME, Sound, still: still(), say: t => { ui.status.textContent = t; }, end: (score, lines) => finish(ui, score, lines, done) });
        live = { stop: g.stop };
      } catch (e) { close(true); onExit = done; derby2d(level, done); }
    }).catch(() => { if (!layer) return; close(true); onExit = done; derby2d(level, done); });
  }
  function derby2d(level, done) {
    const ui = open('Home Run Derby', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' · 10 outs · fences 200 to 225 ft');
    const E = Engine(ui), c = E.c;
    const SLOW = [0, 1.75, 1.45, 1.2][level], WIN = [0, 150, 120, 100][level], EVB = [0, 7, 4, 2][level];
    const KINDS = level === 1 ? ['fast', 'fast', 'fast', 'change'] : level === 2 ? ['fast', 'fast', 'change', 'curve'] : ['fast', 'change', 'curve', 'fast', 'curve'];
    const NAMES = { fast: 'FASTBALL', change: 'CHANGEUP', curve: 'CURVEBALL' };
    const lefty = ME.bats !== 'right', side = lefty ? 1 : -1;
    let outs = 0, hr = 0, streak = 0, bestStreak = 0, longest = 0, total = 0;
    let phase = 'intro', pt = 0, P = null, sw = null, hit = null, tapMark = null, wave = 0, crowdDots = [], over = false, info = '';
    // camera behind home plate
    let hor = 0, f = 0, fx = 0; const z0 = 48, camH = 7;
    E.onResize = () => { hor = E.H * 0.25; f = (E.H * 0.9 - hor) * z0 / camH; fx = f * Math.min(1, E.W / (E.H * 0.8));
      const wt = proj(0, 225, 8).y; crowdDots = makeCrowd(0, E.W, 70, wt - 4, Math.round(E.W * 0.55)); };
    const proj = (x, z, h) => { const d = Math.max(1, z + z0); return { x: E.W / 2 + x * fx / d, y: hor + (camH - h) * f / d, s: f / d }; };
    const fence = a => 200 + 25 * Math.cos(clamp(a / 45, -1, 1) * Math.PI / 2);
    const polar = (d, a) => [d * Math.sin(a * Math.PI / 180), d * Math.cos(a * Math.PI / 180)];
    const path = pts => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); };

    function field() {
      const W = E.W, H = E.H, wallB = [], wallT = [];
      for (let a = -50; a <= 50; a += 2.5) { const [x, z] = polar(fence(a), a); wallB.push(proj(x, z, 0)); wallT.push(proj(x, z, 8)); }
      sky(c, W, H, wallT[20].y);
      c.fillStyle = '#20232b'; c.fillRect(0, 12, W, wallT[20].y - 8);
      crowd(c, crowdDots, wave, E.t);
      txt(c, TEAM.name + ' PARK', W / 2, 28, 18, TEAM.orange, 'center', 800, 3);
      // grass with mowing stripes
      const g = c.createLinearGradient(0, wallB[20].y, 0, H); g.addColorStop(0, '#2f7d3b'); g.addColorStop(1, '#3f9a4a'); c.fillStyle = g;
      path(wallB); c.lineTo(W + 400, H); c.lineTo(-400, H); c.closePath(); c.fill();
      c.save(); path(wallB); c.lineTo(W + 400, H); c.lineTo(-400, H); c.closePath(); c.clip();
      c.fillStyle = 'rgba(255,255,255,.06)';
      for (let d = 20; d < 230; d += 20) { const p1 = proj(0, d, 0), p2 = proj(0, d + 10, 0); c.fillRect(0, p2.y, W, p1.y - p2.y); }
      c.restore();
      // wall and distance signs
      c.fillStyle = '#14502c'; path(wallT); for (let i = wallB.length - 1; i >= 0; i--) c.lineTo(wallB[i].x, wallB[i].y); c.closePath(); c.fill();
      c.strokeStyle = '#ffd23f'; c.lineWidth = 3; path(wallT); c.stroke();
      for (const a of [-40, -20, 0, 20, 40]) { const [x, z] = polar(fence(a), a), p = proj(x, z, 4); txt(c, String(Math.round(fence(a))), p.x, p.y, clamp(p.s * 2.4, 11, 26), '#fff', 'center', 800, 0); }
      // dirt: infield, mound, home circle; bases for a 65 ft diamond
      const B = 46;
      c.fillStyle = '#b9824f'; path([proj(0, -8, 0), proj(B + 12, B, 0), proj(0, 2 * B + 14, 0), proj(-B - 12, B, 0)]); c.closePath(); c.fill();
      c.fillStyle = '#3a8d45'; path([proj(0, 9, 0), proj(B - 7, B, 0), proj(0, 2 * B - 10, 0), proj(-B + 7, B, 0)]); c.closePath(); c.fill();
      const m = proj(0, 46, 0); c.fillStyle = '#c08a55'; c.beginPath(); c.ellipse(m.x, m.y, m.s * 6 * fx / f, m.s * 1.4, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; for (const sgn of [-1, 1]) { const a = proj(0, 0, 0), b = proj(sgn * 160, 160, 0); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      for (const [x, z] of [[B, B], [0, 2 * B], [-B, B]]) { const p = proj(x, z, 0); c.fillStyle = '#fff'; c.fillRect(p.x - p.s * 0.8, p.y - p.s * 0.3, p.s * 1.6, p.s * 0.6); }
      const hp = proj(0, 0, 0); c.fillStyle = '#c08a55'; c.beginPath(); c.ellipse(hp.x, hp.y, hp.s * 9 * fx / f, hp.s * 2.2, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; path([proj(-0.71, 0.3, 0), proj(0.71, 0.3, 0), proj(0.71, -0.4, 0), proj(0, -1, 0), proj(-0.71, -0.4, 0)]); c.closePath(); c.fill();
    }
    function pitcher() {
      const p = proj(0, 44, 0.8), w = phase === 'wind' ? pt / 1.0 : phase === 'pitch' ? 1 : 0;
      const k = w < 0.35 ? 0 : w < 0.6 ? (w - 0.35) / 0.25 : w < 0.85 ? 1 - (w - 0.6) / 0.25 : 0;   // leg lift
      const throwA = w < 0.6 ? 0.2 : w < 0.88 ? lerp(0.2, Math.PI * 0.95, (w - 0.6) / 0.28) : lerp(Math.PI * 0.95, 0.5, Math.min(1, (w - 0.88) / 0.12));
      guy(c, p.x, p.y, p.s, { top: '#2457a6', cap: '#2457a6', face: -1, kneeL: k * 1.1, legL: -0.2 - k * 0.4, armR: throwA, elbowR: w > 0.6 && w < 0.88 ? -0.6 : 0, armL: w > 0.2 && w < 0.9 ? -1.2 : -0.3, glove: 'L', lean: w > 0.85 ? 0.6 : 0 });
    }
    function batter() {
      const p = proj(side * 3.6, 1.5, 0), s = p.s, swingK = sw ? clamp((E.t - sw.at) / 0.22, 0, 1) : 0;
      const g = guy(c, p.x, p.y, s, { face: -side, back: false, num: ME.num, helmet: TEAM.green, top: TEAM.green, legL: -0.35 - swingK * 0.2, legR: 0.3, armL: side * (1.6 - swingK * 2.6), armR: side * (1.3 - swingK * 2.4), elbowL: -side * 1.4 * (1 - swingK), elbowR: -side * 1.6 * (1 - swingK), lean: -side * 0.2 + swingK * -side * 0.3 });
      const hands = g.handL, ang = side * (-0.6 + swingK * 2.6) - (swingK > 0.9 ? side * (swingK - 0.9) * 8 : 0);
      bat(c, hands[0], hands[1], -ang, s);
    }
    function zone() {
      const a = proj(-0.83, 0, 3.4), b = proj(0.83, 0, 1.6);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.setLineDash([6, 6]); c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); c.setLineDash([]);
    }
    const ballAt = p => {   // pitch position at progress p (1 = over the plate)
      const z = lerp(43, 0, p) - (p > 1 ? (p - 1) * 30 : 0), x = lerp(P.rx, P.x, p) + P.side * Math.sin(Math.PI * Math.min(p, 1)) * 0.6;
      const h = lerp(P.rh, P.h + P.drop, Math.min(p, 1.3)) - P.drop * p * p;
      return proj(x, z, h);
    };
    function newPitch() {
      const kind = pick(KINDS), mph = Math.round((kind === 'fast' ? rnd(47, 56) : kind === 'change' ? rnd(38, 43) : rnd(40, 46)) + (level === 3 ? 5 : 0));
      const strike = Math.random() < (level === 1 ? 0.88 : 0.78);
      let x = rnd(-0.6, 0.6), h = rnd(1.8, 3.1);
      if (!strike) { if (Math.random() < 0.5) x = pick([-1, 1]) * rnd(1.05, 1.5); else h = pick([rnd(0.9, 1.3), rnd(3.7, 4.1)]); }
      const T = 46 / (mph * 1.4667) * SLOW * (kind === 'change' ? 1.1 : 1);
      P = { kind, mph, x, h, T, t: 0, rx: -1.3, rh: 5.6, drop: kind === 'curve' ? 1.4 : kind === 'change' ? 0.5 : 0, side: kind === 'curve' ? 0.8 : 0, strike: Math.abs(x) <= 0.83 && h >= 1.5 && h <= 3.5 };
      sw = null; hit = null; tapMark = null; info = '';
    }
    function swing(x, y) {
      if (over || sw || !(phase === 'pitch' || (phase === 'wind' && pt > 0.6))) return;
      Sound.whoosh();
      const tapH = clamp(camH - (y - hor) / (f / z0), 0.6, 4.4);
      sw = { at: E.t, h: tapH, x: x }; tapMark = { x, y, at: E.t };
      if (phase === 'wind') { result('whiff', 'Way too early!'); return; }
      const e = (P.t - P.T) * 1000 / SLOW * 1.2, v = tapH - P.h, a = Math.abs(e);
      if (a > WIN * 1.6 || Math.abs(v) > 0.95) { result('whiff', a > WIN * 1.6 ? (e < 0 ? 'Swung too early!' : 'Swung too late!') : (v > 0 ? 'Swung over it!' : 'Swung under it!')); return; }
      let q = 1 - 0.7 * Math.pow(Math.min(1, a / (WIN * 1.6)), 1.5) - 0.55 * Math.pow(Math.min(1, Math.abs(v) / 0.95), 1.3);
      if (!P.strike) q -= 0.25;
      const ev = clamp(40 + 34 * q + EVB + gauss() * 2, 25, 82), la = clamp(24 - v * 32 + gauss() * 5, -15, 70), spray = clamp(-e / WIN, -1.5, 1.5) * 34 * side + gauss() * 5;
      let dist = la < 6 ? ev * 1.7 : la > 52 ? ev * 1.1 : ev * ev * Math.sin(2 * la * Math.PI / 180) * 0.052;
      dist = Math.round(dist);
      const foul = Math.abs(spray) > 45, isHR = !foul && la >= 12 && la <= 52 && dist > fence(spray);
      Sound.crack(); E.shake(isHR ? 6 : 3, 0.15);
      hit = { ev: Math.round(ev), la, spray, dist, foul, isHR, t: 0, T: clamp(dist / Math.max(40, ev * 1.4667 * Math.cos(la * Math.PI / 180)) * 1.1, 0.7, 3.4), apex: la < 6 ? 0 : Math.max(4, dist * Math.tan(la * Math.PI / 180) / 4) };
      phase = 'flight'; pt = 0;
    }
    function result(kind, text) {
      phase = 'after'; pt = 0;
      if (kind === 'hr') {
        hr++; streak++; bestStreak = Math.max(bestStreak, streak); longest = Math.max(longest, hit.dist); total += hit.dist; wave = 1;
        Sound.cheer(); Sound.boom(); if (streak === 3) setTimeout(() => { Sound.organ(); }, 600);
        E.float('HOME RUN!', E.W / 2, E.H * 0.42, '#ffd23f', 60); E.float(hit.dist + ' FT · ' + hit.ev + ' MPH', E.W / 2, E.H * 0.5, '#fff', 30);
        if (streak >= 3) E.float('ON FIRE x' + streak, E.W / 2, E.H * 0.57, '#ff7a1a', 34);
        for (let i = 0; i < 4; i++) setTimeout(() => { if (!over) { Sound.boom(); E.burst(rnd(E.W * 0.15, E.W * 0.85), rnd(E.H * 0.05, E.H * 0.18), 60, ['#ffd23f', '#f28c38', '#fff', '#ff5a5a', '#7bdcff'], 260, 120, 3); } }, 250 + i * 350);
        E.say('Home run! ' + hit.dist + ' feet. ' + hr + ' home runs, ' + outs + ' outs.');
      } else if (kind === 'ball') {
        E.float('BALL · GOOD EYE!', E.W / 2, E.H * 0.45, '#7bdcff', 40); Sound.blip(true); E.say('Ball. Good eye, no out.');
      } else {
        outs++; streak = 0;
        E.float(text, E.W / 2, E.H * 0.45, '#fff', 40); E.float('OUT ' + outs, E.W / 2, E.H * 0.52, '#ff8a8a', 30);
        if (kind === 'look') Sound.say('Strike!'); else if (kind === 'whiff') Sound.blip(false); else Sound.ooh();
        E.say(text + ' Out ' + outs + ' of 10.');
      }
    }
    E.down = (x, y) => { if (phase === 'intro') { phase = 'gap'; pt = 0.6; return; } swing(x, y); };
    E.key = k => { if (k === ' ' || k === 'Enter') { if (phase === 'intro') { phase = 'gap'; pt = 0.6; return; } if (P) { const p = proj(0, 0, P.h); swing(E.W / 2, p.y); } } };
    E.draw = dt => {
      pt += dt; wave = Math.max(0, wave - dt * 0.35);
      field(); pitcher();
      // pitch
      if (phase === 'wind' && pt >= 1.0) { phase = 'pitch'; P.t = 0; info = P.mph + ' MPH ' + NAMES[P.kind]; }
      if (phase === 'pitch') {
        P.t += dt; const p = P.t / P.T;
        const b = ballAt(p); ball(c, b.x, b.y, Math.max(2, 0.13 * b.s), streak >= 3);
        if (level === 1 && p > 0.55 && p < 1) { const t = proj(P.x, 0, P.h); c.strokeStyle = 'rgba(255,210,63,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(t.x, t.y, 0.25 * t.s, 0, 7); c.stroke(); }
        if (p > 1.25 && !sw) { Sound.pop(); result(P.strike ? 'look' : 'ball', P.strike ? 'Strike looking!' : ''); }
        else if (p > 1.6) { phase = 'after'; pt = 0; }
      }
      zone();
      if (phase === 'flight') {
        hit.t += dt; const k = Math.min(1, hit.t / hit.T), d = hit.dist * k;
        const h = hit.apex ? 4 * hit.apex * k * (1 - k) + 3 * (1 - k) : Math.abs(Math.sin(k * 9)) * 2 * (1 - k);
        const [x, z] = polar(d, hit.spray), b = proj(x, z, h), sh = proj(x, z, 0);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(sh.x, sh.y, Math.max(2, sh.s * 0.3), Math.max(1, sh.s * 0.12), 0, 0, 7); c.fill();
        ball(c, b.x, b.y, Math.max(2.5, 0.15 * b.s * 1.6), streak >= 2);
        if (k >= 1) {
          if (hit.isHR) result('hr');
          else if (hit.foul) result('out', 'Foul ball · ' + hit.dist + ' ft');
          else result('out', (hit.la < 6 ? 'Ground ball' : hit.la > 52 ? 'Pop up' : 'Fly ball') + ' · ' + hit.dist + ' ft');
        }
      }
      batter();
      if (tapMark && E.t - tapMark.at < 0.6) { c.strokeStyle = 'rgba(255,255,255,' + (1 - (E.t - tapMark.at) / 0.6) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(tapMark.x, tapMark.y, 18 + (E.t - tapMark.at) * 40, 0, 7); c.stroke(); }
      scoreboard(c, E.W, [['HOME RUNS', hr], ['OUTS', dots(outs, 10), '#ff8a8a'], ['LONGEST', longest ? longest + ' ft' : '–'], ['STREAK', streak ? streak + (streak >= 3 ? ' 🔥' : '') : '–']]);
      if (info && (phase === 'pitch' || phase === 'flight' || phase === 'after')) { c.fillStyle = 'rgba(16,16,16,.8)'; rr(c, 10, E.H - 52, 230, 40, 8); c.fill(); txt(c, info, 125, E.H - 32, 20, '#ffd23f', 'center', 800, 0); }
      if (phase === 'intro') {
        c.fillStyle = 'rgba(16,16,16,.82)'; rr(c, E.W * 0.08, E.H * 0.3, E.W * 0.84, 210, 16); c.fill();
        txt(c, 'HOME RUN DERBY', E.W / 2, E.H * 0.3 + 40, 40, TEAM.orange);
        txt(c, 'Tap when the ball reaches the box.', E.W / 2, E.H * 0.3 + 90, 22, '#fff', 'center', 600, 0);
        txt(c, 'Tap where the ball is: higher or lower.', E.W / 2, E.H * 0.3 + 120, 22, '#fff', 'center', 600, 0);
        txt(c, 'Early = pull it. Don’t swing at balls!', E.W / 2, E.H * 0.3 + 150, 22, '#fff', 'center', 600, 0);
        txt(c, 'TAP TO START', E.W / 2, E.H * 0.3 + 188, 24, '#ffd23f', 'center', 800, 0);
      }
      if ((phase === 'after' && pt > (hit && hit.isHR ? 2.2 : 1.3)) || (phase === 'gap' && pt > 0.9)) {
        if (outs >= 10) { over = true; phase = 'end'; setTimeout(end, 400); }
        else { newPitch(); phase = 'wind'; pt = 0; }
      }
    };
    function end() {
      finish(ui, hr, [hr + ' home run' + (hr === 1 ? '' : 's') + '!', 'Longest: ' + (longest || 0) + ' ft · Total: ' + total + ' ft', bestStreak >= 2 ? 'Best streak: ' + bestStreak + ' in a row' : 'Tip: early swings get pulled, late swings go the other way.'].concat(hr >= 8 ? ['Derby champion!'] : []), done);
    }
    live = { stop: E.stop };
    E.start(); E.say('Home Run Derby. Tap to start.');
  }

  /* ---------- 2. STRIKEOUT KING: Jaxson pitches. Pick the pitch, aim, hit the timing ring. ---------- */
  // The other three games are 3D too (same file as Home Run Derby); the flat versions stay as the backup.
  function play3d(name, title, sub, level, done, flat) {
    const ui = open(title, sub);
    ui.stage.classList.add('cvstage');
    ui.stage.replaceChildren(el('div', { class: 'd3load' }, el('b', null, 'Loading Seed Spitters Park\u2026'), el('i', null)));
    const backup = () => { if (!layer) return; close(true); onExit = done; flat(level, done); };
    import('./derby3d.js').then(m => (m.ready || Promise.resolve()).then(() => m)).then(m => {
      if (!layer) return;
      try {
        const g = m[name]({ stage: ui.stage, level, me: ME, Sound, still: still(), say: t => { ui.status.textContent = t; }, end: (score, lines) => finish(ui, score, lines, done) });
        live = { stop: g.stop };
      } catch (e) { backup(); }
    }).catch(backup);
  }
  function kking(level, done) { play3d('kking', 'Strikeout King', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' \u00b7 ' + (level === 1 ? 2 : 3) + ' innings vs the Hornets', level, done, kking2d); }
  function steal(level, done) { play3d('steal', 'Steal Second', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' \u00b7 8 tries, 3 outs and you\u2019re done', level, done, steal2d); }
  function outfield(level, done) { play3d('outfield', 'Outfield Hero', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' \u00b7 10 fly balls in center field', level, done, outfield2d); }
  function pitchrec(level, done) { play3d('pitchrec', 'Pitch Reader', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' \u00b7 10 pitches', level, done, pitchrec2d); }
  function pitchrec2d(level, done) { const ui = open('Pitch Reader', ''); ui.stage.replaceChildren(el('div', { class: 'd3load' }, el('b', null, 'Pitch Reader needs 3D graphics, and this device can\u2019t show them. Tap Quit to go back.'))); }
  function kking2d(level, done) {
    const INN = level === 1 ? 2 : 3;
    const ui = open('Strikeout King', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' · ' + INN + ' innings vs the Hornets');
    const E = Engine(ui), c = E.c;
    const LINEUP = [['Speedy Gonzo', 'R', 0.75, 0.3, 0.5], ['Contact Kid', 'L', 0.85, 0.35, 0.7], ['Big Bo', 'R', 0.55, 0.9, 0.35], ['Moonshot', 'L', 0.5, 0.85, 0.4],
      ['Patient Pete', 'R', 0.7, 0.45, 0.85], ['Hacker', 'R', 0.6, 0.6, 0.15], ['Lefty Lou', 'L', 0.65, 0.5, 0.5], ['The Wall', 'R', 0.6, 0.55, 0.6], ['Tiny Tim', 'L', 0.7, 0.25, 0.55]]
      .map(([name, hand, contact, power, eye]) => ({ name, hand, contact: contact * [0, 0.8, 0.95, 1.05][level], power, eye: eye * [0, 0.7, 0.9, 1.1][level] }));
    const KINDS = level === 1 ? ['fast', 'change'] : ['fast', 'change', 'curve'];
    const NM = { fast: 'Fastball', change: 'Changeup', curve: 'Curve' };
    let bi = 0, balls = 0, strikes = 0, outs = 0, inning = 1, runs = 0, ks = 0, pitches = 0, strikesThrown = 0, walks = 0, hits = 0, bases = [0, 0, 0];
    let phase = 'intro', pt = 0, sel = 'fast', aim = null, ring = 0, P = null, prevKind = null, callText = '', over = false, catcherAt = null, batSw = 0;
    let hor = 0, f = 0, fxs = 0; const cam = 52, camH = 6;
    let btns = [], crowdDots = [];
    E.onResize = () => { hor = E.H * 0.25; f = E.H * 0.088 * cam * Math.min(1, E.W / (E.H * 0.7)); fxs = f; btns = KINDS.map((k, i) => { const left = E.W * 0.24, w = Math.min(170, (E.W - left - 12) / KINDS.length - 10); return { k, x: left + i * (w + 10), y: E.H - 74, w, h: 62 }; });
      crowdDots = makeCrowd(0, E.W, 70, hor + E.H * 0.05, Math.round(E.W * 0.5)); };
    const proj = (x, d, h) => { const k = f / Math.max(1, d); return { x: E.W / 2 + x * k, y: hor + (camH - h) * k, s: k }; };
    const inv = (x, y) => { const k = f / cam; return { x: (x - E.W / 2) / k, h: camH - (y - hor) / k }; };   // screen -> spot at the plate
    const bat = () => LINEUP[bi % 9];
    function scene() {
      const W = E.W, H = E.H;
      c.fillStyle = '#20232b'; c.fillRect(0, 0, W, H);
      crowd(c, crowdDots, 0, E.t);
      // backstop net and wall
      const wall = proj(0, 80, 0); c.fillStyle = '#123b24'; c.fillRect(0, hor + E.H * 0.05, W, wall.y - hor - E.H * 0.05);
      c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; for (let x = 0; x < W; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, wall.y); c.stroke(); }
      txt(c, TEAM.name, W / 2, hor + E.H * 0.05 + 22, 22, TEAM.orange, 'center', 800, 0);
      const g = c.createLinearGradient(0, wall.y, 0, H); g.addColorStop(0, '#a8744a'); g.addColorStop(1, '#c08a55'); c.fillStyle = g; c.fillRect(0, wall.y, W, H - wall.y);
      // batter's boxes and plate
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2;
      for (const s of [-1, 1]) { const a = proj(s * 1.2, 49, 0), b = proj(s * 3.6, 55, 0); c.strokeRect(Math.min(a.x, b.x), b.y, Math.abs(b.x - a.x), a.y - b.y); }
      const pl = [proj(-0.71, 51.6, 0), proj(0.71, 51.6, 0), proj(0.71, 52.3, 0), proj(0, 53, 0), proj(-0.71, 52.3, 0)];
      c.fillStyle = '#fff'; c.beginPath(); pl.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill();
    }
    function people() {
      const B = bat(), bs = B.hand === 'R' ? 1 : -1;   // righty stands on our right
      const u = proj(0.5, 63, 0); c.globalAlpha = 0.9; guy(c, u.x, u.y, u.s, { top: '#333', cap: '#333', crouch: 0.6, face: 1, armL: -0.5, armR: 0.5 }); c.globalAlpha = 1;
      const ca = proj(catcherAt ? catcherAt.x : 0, 55.5, 0); guy(c, ca.x, ca.y, ca.s * 0.85, { top: '#2457a6', cap: '#2457a6', crouch: 1.1, face: 1, armL: -2.2 + (catcherAt ? 0.3 : 0), glove: 'L', armR: 0.4 });
      const p = proj(bs * 3.1, 52, 0), k = batSw ? clamp((E.t - batSw) / 0.2, 0, 1) : 0;
      const g = guy(c, p.x, p.y, p.s, { top: '#7a1f2b', cap: '#7a1f2b', helmet: '#7a1f2b', face: -bs, num: String(10 + (bi % 9)), numCol: '#fff', armL: bs * (1.5 - k * 2.6), armR: bs * (1.2 - k * 2.4), elbowL: -bs * 1.3 * (1 - k), elbowR: -bs * 1.5 * (1 - k) });
      bat(c, g.handL[0], g.handL[1], bs * (0.6 - k * 2.6), p.s);
    }
    function me() {   // Jaxson from behind, bottom left (he throws left-handed)
      const w = phase === 'throw' ? clamp(P.t / 0.35, 0, 1) : 0, s = E.H * 0.042;
      guy(c, E.W * 0.13, E.H - 84 + s * 1.6, s, { back: true, num: ME.num, face: 1, armL: w < 0.5 ? lerp(-0.4, -2.6, w * 2) : lerp(-2.6, 1.4, (w - 0.5) * 2), elbowL: w < 0.5 ? 0.9 : 0, armR: 0.6, glove: 'R', lean: w * 0.5 });
    }
    function zoneBox() {
      const a = proj(-0.83, 52, 3.4), b = proj(0.83, 52, 1.6);
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 2; c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      c.strokeStyle = 'rgba(255,255,255,.18)'; for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(lerp(a.x, b.x, i / 3), a.y); c.lineTo(lerp(a.x, b.x, i / 3), b.y); c.moveTo(a.x, lerp(a.y, b.y, i / 3)); c.lineTo(b.x, lerp(a.y, b.y, i / 3)); c.stroke(); }
      return { a, b };
    }
    const inZone = (x, h) => Math.abs(x) <= 0.85 && h >= 1.5 && h <= 3.5;
    function throwIt() {
      const acc = clamp(1 - Math.abs(ring - 0.35) / 0.35, 0, 1), miss = (1 - acc) * [0, 0.6, 0.9, 1.1][level];
      const a = Math.random() * Math.PI * 2;
      const mph = Math.round((sel === 'fast' ? rnd(48, 54) : sel === 'change' ? rnd(38, 42) : rnd(40, 45)));
      P = { kind: sel, mph, x: aim.x + Math.cos(a) * miss, h: aim.h + Math.sin(a) * miss, t: 0, T: 46 / (mph * 1.4667) * 1.35, acc, swing: null };
      P.zone = inZone(P.x, P.h);
      pitches++; Sound.whoosh();
      phase = 'throw'; pt = 0; E.say(NM[sel] + ', ' + (acc > 0.8 ? 'right on target' : acc > 0.5 ? 'close to target' : 'off target'));
      // batter decides
      const B = bat(), two = strikes === 2, edge = Math.min(1, Math.max(Math.abs(P.x) / 0.85, Math.abs(P.h - 2.5) / 1.0)), fooled = (sel === 'change' && prevKind === 'fast') || (sel === 'curve' && Math.random() < 0.45);
      let sp = P.zone ? 0.5 + (two ? 0.3 : 0) + (edge < 0.5 ? 0.15 : 0) : (1 - B.eye) * (0.3 + (two ? 0.35 : 0)) + (sel !== 'fast' ? 0.15 : 0);
      if (balls === 3 && !P.zone) sp *= 0.6;
      if (Math.random() < sp) { let cp = B.contact * (P.zone ? 1 - 0.45 * edge : 0.35) * (fooled ? 0.5 : 1) * (sel === 'fast' ? 0.9 : 1);
        P.swing = { contact: Math.random() < cp, edge, fooled }; }
      prevKind = sel;
    }
    function call(text, voice) { callText = text; pt = 0; phase = 'call'; if (voice) Sound.say(voice); E.say(text); }
    function advance(n, walk) {
      let scored = 0;
      if (walk) { if (bases[0] && bases[1] && bases[2]) scored++; if (bases[0] && bases[1]) bases[2] = 1; if (bases[0]) bases[1] = 1; bases[0] = 1; }
      else { for (let i = 2; i >= 0; i--) if (bases[i]) { bases[i] = 0; if (i + n >= 3) scored++; else bases[i + n] = 1; } if (n >= 4) scored++; else bases[n - 1] = 1; }
      runs += scored; return scored;
    }
    function nextBatter() { bi++; balls = 0; strikes = 0; }
    function out(text, voice) { outs++; nextBatter(); call(text, voice); if (outs % 3 === 0) { bases = [0, 0, 0]; } }
    function land() {
      Sound.pop(); catcherAt = { x: clamp(P.x, -2, 2) };
      if (P.zone || (P.swing)) strikesThrown++;
      const B = bat();
      if (P.swing && !P.swing.contact) { strikes++; if (strikes === 3) { ks++; E.float('K!', E.W / 2, E.H * 0.4, '#ffd23f', 90); Sound.crack(); E.burst(E.W / 2, E.H * 0.4, 50, ['#ffd23f', '#f28c38', '#fff'], 260, 200); out('STRIKE THREE! Swinging', 'Strike three!'); } else call('Strike ' + strikes + ', swinging' + (P.swing.fooled ? ' (fooled him!)' : ''), 'Strike!'); return; }
      if (P.swing && P.swing.contact) {
        Sound.crack();
        const r = Math.random(), hitP = 0.28 * (1 - P.swing.edge * 0.6) + B.power * 0.08 + (P.zone ? 0 : -0.12);
        if (r < 0.42) { if (strikes < 2) strikes++; call('Foul ball. ' + balls + '–' + strikes, null); return; }
        if (Math.random() < hitP) {
          hits++; const hrP = B.power * 0.25 * (P.swing.edge < 0.4 ? 1.4 : 0.4) * (P.acc < 0.5 ? 1.5 : 1);
          const n = Math.random() < hrP ? 4 : Math.random() < 0.25 ? 2 : 1, sc = advance(n);
          Sound.ooh(); nextBatter(); call((n === 4 ? 'Home run by ' + B.name : n === 2 ? 'Double' : 'Single') + (sc ? '. ' + sc + ' run' + (sc > 1 ? 's' : '') + ' score' + (sc > 1 ? '' : 's') : ''), null); return;
        }
        out(pick(['Ground out to second', 'Fly out to center', 'Pop up to short', 'Ground out to you!', 'Line out to third']) + '. Out!', null); return;
      }
      if (P.zone) { strikes++; if (strikes === 3) { ks++; E.float('K!', E.W / 2, E.H * 0.4, '#ffd23f', 90); E.burst(E.W / 2, E.H * 0.4, 50, ['#ffd23f', '#f28c38', '#fff'], 260, 200); out('STRIKE THREE! Caught looking', 'Strike three! You’re out!'); } else call('Strike ' + strikes + ', looking', 'Strike!'); return; }
      balls++; if (balls === 4) { walks++; const sc = advance(1, true); nextBatter(); call('Ball four. Walk' + (sc ? ', a run scores' : ''), 'Ball four'); } else call('Ball ' + balls, 'Ball');
    }
    E.down = (x, y) => {
      if (over) return;
      if (phase === 'intro') { phase = 'pick'; return; }
      if (phase === 'pick' || phase === 'aim') {
        const b = btns.find(b => inB(b, x, y)); if (b) { sel = b.k; Sound.tick(); if (phase === 'pick') phase = 'aim'; return; }
        const s = inv(x, y); if (Math.abs(s.x) < 2.2 && s.h > 0.6 && s.h < 4.6) { aim = s; phase = 'ring'; pt = 0; ring = 1; Sound.tick(); }
        return;
      }
      if (phase === 'ring') throwIt();
    };
    E.key = k => { if (phase === 'intro') { phase = 'pick'; return; } if (/^[1-3]$/.test(k) && KINDS[+k - 1]) { sel = KINDS[+k - 1]; if (phase === 'pick') phase = 'aim'; } else if ((k === ' ' || k === 'Enter')) { if (phase === 'aim' || phase === 'pick') { aim = { x: 0, h: 2.5 }; phase = 'ring'; pt = 0; } else if (phase === 'ring') throwIt(); } };
    E.draw = dt => {
      pt += dt; scene(); people(); const z = zoneBox();
      if (phase === 'ring') {
        ring = 1 - ((pt / 0.9) % 1);   // shrinks from big to nothing, over and over
        const t = proj(aim.x, 52, aim.h), R = 0.9 * t.s;
        c.strokeStyle = '#ffd23f'; c.lineWidth = 4; c.beginPath(); c.arc(t.x, t.y, R * 0.35, 0, 7); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.beginPath(); c.arc(t.x, t.y, Math.max(2, R * ring), 0, 7); c.stroke();
        c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(t.x, t.y, 4, 0, 7); c.fill();
        txt(c, 'TAP when the white ring hits the yellow ring', E.W / 2, z.b.y + 50, 20, '#fff', 'center', 700);
        if (pt > 2.7) throwIt();
      }
      if (phase === 'throw') {
        P.t += dt; const p = P.t / P.T;
        if (P.swing && !batSw && p > 0.8) batSw = E.t;
        const brk = P.kind === 'curve' ? 1.3 : P.kind === 'change' ? 0.5 : 0, side = P.kind === 'curve' ? 0.7 : P.kind === 'change' ? -0.3 : 0;
        const d = lerp(8, 52, Math.min(1, p)), x = lerp(-1.4, P.x, p) + side * Math.sin(Math.PI * Math.min(1, p)) * 0.5, h = lerp(5.6, P.h + brk, p) - brk * p * p;
        const b = proj(x, d, h); ball(c, b.x, b.y, Math.max(3, 0.13 * b.s));
        if (p >= 1) land();
      }
      if (phase === 'call' && pt < 1.6) { c.fillStyle = 'rgba(16,16,16,.8)'; rr(c, E.W * 0.1, E.H * 0.26, E.W * 0.8, 60, 12); c.fill(); txt(c, callText, E.W / 2, E.H * 0.26 + 30, Math.min(30, E.W / 20), '#fff', 'center', 800, 0); }
      if (phase === 'call' && pt >= 1.6) {
        batSw = 0; catcherAt = null;
        if (outs >= INN * 3 || runs >= 6) { over = true; phase = 'end'; setTimeout(end, 300); }
        else { if (outs > 0 && outs % 3 === 0 && outs / 3 + 1 > inning) { inning = outs / 3 + 1; E.float('INNING ' + inning, E.W / 2, E.H * 0.4, TEAM.orange, 50); } phase = 'pick'; aim = null; }
      }
      me();
      // pitch buttons
      if (phase === 'pick' || phase === 'aim' || phase === 'intro') for (const b of btns) cbtn(c, b, NM[b.k], b.k === sel, b.k === 'fast' ? 'Fast, straight' : b.k === 'change' ? 'Slow, fools them' : 'Drops late');
      if (phase === 'pick' || phase === 'aim') txt(c, phase === 'pick' ? 'Pick a pitch, then tap where to throw it' : 'Now tap where to throw it (corners are hard to hit)', E.W / 2, E.H - 94, 18, '#fff', 'center', 700);
      // mini diamond with runners
      const dx = E.W - 70, dy = 120; c.save(); c.translate(dx, dy); c.rotate(Math.PI / 4); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(-18, -18, 36, 36);
      [[18, 18], [18, -18], [-18, -18]].forEach(([x, y], i) => { c.fillStyle = bases[i] ? '#ffd23f' : '#555'; c.fillRect(x - 6, y - 6, 12, 12); }); c.restore();
      txt(c, bat().name + (bat().hand === 'L' ? ' (L)' : ' (R)'), 16, 82, 16, '#fff', 'left', 700, 3);
      scoreboard(c, E.W, [['INNING', inning + ' of ' + INN], ['COUNT', balls + '–' + strikes], ['OUTS', outs % 3], ['K', ks, '#ffd23f'], ['RUNS', runs, '#ff8a8a'], ['PITCHES', pitches, '#fff']]);
      if (phase === 'intro') {
        c.fillStyle = 'rgba(16,16,16,.85)'; rr(c, E.W * 0.06, E.H * 0.28, E.W * 0.88, 230, 16); c.fill();
        txt(c, 'STRIKEOUT KING', E.W / 2, E.H * 0.28 + 38, 40, TEAM.orange);
        ['1. Pick a pitch.', '2. Tap where to throw it.', '3. Tap when the rings line up: better timing = better aim.', 'A changeup after fastballs fools hitters.'].forEach((l, i) => txt(c, l, E.W / 2, E.H * 0.28 + 84 + i * 30, 20, '#fff', 'center', 600, 0));
        txt(c, 'TAP TO START', E.W / 2, E.H * 0.28 + 208, 24, '#ffd23f', 'center', 800, 0);
      }
    };
    function end() {
      const sp = pitches ? Math.round(strikesThrown / pitches * 100) : 0;
      finish(ui, ks, [ks + ' strikeout' + (ks === 1 ? '' : 's') + '!', 'Pitches: ' + pitches + ' · Strikes: ' + strikesThrown + ' of ' + pitches + ' = ' + sp + '%', 'Runs: ' + runs + ' · Hits: ' + hits + ' · Walks: ' + walks,
        runs >= 6 ? 'Coach came to get the ball. Throw more strikes next time!' : sp >= 55 ? 'Over 55% strikes: that’s the goal in real games too.' : 'Aim for 55% strikes or more, same as in real games.'], done);
    }
    live = { stop: E.stop };
    E.start(); E.say('Strikeout King. Tap to start.');
  }

  /* ---------- 3. STEAL SECOND: take a lead, read the pitcher, go on his first move home ---------- */
  function steal2d(level, done) {
    const TRIES = 8;
    const ui = open('Steal Second', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' · ' + TRIES + ' tries, 3 outs and you’re done');
    const E = Engine(ui), c = E.c;
    const POP = [0, 2.35, 2.15, 1.95][level], KICK = [0, 0.95, 0.85, 0.75][level], PICKT = [0, 0.75, 0.62, 0.52][level];
    let tries = 0, sb = 0, outsN = 0, jumps = [], phase = 'intro', pt = 0, lead = 4, dragX = null, move = null, wait = 0, went = null, back = null, res = null, runX = 0, over = false, throwBall = null, look = 0;
    let L = {}; const BASE = 65;
    E.onResize = () => { const W = E.W, H = E.H; L = { y: H * 0.56, b1: W * 0.12, b2: W * 0.88, ft: (W * 0.76) / BASE, mx: W * 0.5, my: H * 0.78,
      go: { x: W * 0.56, y: H - 100, w: W * 0.4, h: 84 }, bk: { x: W * 0.04, y: H - 100, w: W * 0.4, h: 84 } }; };
    const X = ft => L.b1 + ft * L.ft;
    function scene() {
      const W = E.W, H = E.H;
      sky(c, W, H, H * 0.3); c.fillStyle = '#20232b'; c.fillRect(0, H * 0.18, W, H * 0.12);
      c.fillStyle = '#2f7d3b'; c.fillRect(0, H * 0.3, W, H * 0.7);
      c.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 8; i++) c.fillRect(0, H * 0.3 + i * H * 0.09, W, H * 0.045);
      c.fillStyle = '#c08a55'; rr(c, X(-6), L.y - 18, X(BASE + 6) - X(-6), 36, 18); c.fill();      // base path
      c.beginPath(); c.ellipse(L.mx, L.my, W * 0.12, H * 0.035, 0, 0, 7); c.fill();                  // mound
      c.fillStyle = '#fff'; for (const bx of [L.b1, L.b2]) { c.save(); c.translate(bx, L.y); c.scale(1, 0.45); c.rotate(Math.PI / 4); c.fillRect(-12, -12, 24, 24); c.restore(); }
      txt(c, '1ST', L.b1, L.y + 34, 16, '#fff', 'center', 700, 3); txt(c, '2ND', L.b2, L.y + 34, 16, '#fff', 'center', 700, 3);
      // lead marks every 3 ft
      for (let f = 3; f <= 15; f += 3) { c.fillStyle = f > 11 ? '#ff6b6b' : f > 8 ? '#ffd23f' : 'rgba(255,255,255,.6)'; c.fillRect(X(f) - 1, L.y + 12, 2, 8); }
    }
    function pitcherDraw() {
      const s = E.H * 0.06; let o = { top: '#2457a6', cap: '#2457a6', face: -1, glove: 'L', armL: -1.1, elbowL: -1.2, armR: 0.3 };
      if (look > 0) o.face = -1;
      if (move && move.kind === 'home') { const k = clamp(move.t / KICK, 0, 1); o = Object.assign(o, { kneeL: Math.sin(k * Math.PI) * 1.2, armR: k > 0.6 ? lerp(0.3, 3, (k - 0.6) / 0.4) : 0.3, lean: k > 0.7 ? -0.5 : 0 }); }
      if (move && move.kind === 'pick') { const k = clamp(move.t / 0.25, 0, 1); o = Object.assign(o, { face: k > 0.5 ? -1 : 1, armR: k > 0.5 ? -2.4 : 0.3, lean: -0.3 * k }); o.face = -1; }
      guy(c, L.mx, L.my, s, o);
      if (look > 0) txt(c, '👀', L.mx - s * 1.2, L.my - s * 6.2, 26, '#fff', 'center', 700, 0);
    }
    function runner() {
      const s = E.H * 0.05, x = X(runX), running = res === null && went != null, k = E.t * 14;
      const sliding = res && res.t < 0.5 && res.kind === 'steal';
      guy(c, x, L.y, s, { top: TEAM.green, helmet: TEAM.green, num: ME.num, face: back ? -1 : 1, legL: running ? Math.sin(k) * 0.9 : sliding ? 1.3 : -0.35, legR: running ? -Math.sin(k) * 0.9 : sliding ? 1.4 : 0.35,
        armL: running ? -Math.sin(k) * 1.2 : -0.6, armR: running ? Math.sin(k) * 1.2 : 0.6, lean: running ? 0.6 : 0.25, crouch: !running && !back ? 0.25 : 0 });
    }
    function fielder() { const s = E.H * 0.05; guy(c, L.b2 + 26, L.y, s, { top: '#2457a6', cap: '#2457a6', face: -1, glove: 'L', armL: throwBall && throwBall.to === 2 ? -1.6 : -0.4 }); guy(c, L.b1 - 26, L.y, s, { top: '#2457a6', cap: '#2457a6', face: 1, glove: 'R', armR: 0.4 }); }
    function startTry() { lead = clamp(lead, 3, 15); move = null; went = null; back = null; res = null; runX = lead; throwBall = null; wait = rnd(1.3, 3.6); look = 0; phase = 'set'; pt = 0;
      E.say('Try ' + (tries + 1) + ' of ' + TRIES + '. Slide to take your lead, then press GO when he kicks toward home.'); }
    function go() {
      if (phase !== 'set' && phase !== 'move') return;
      if (went != null || back != null) return;
      went = move ? move.t : -1; Sound.whoosh();
      if (!move) { move = { kind: 'pick', t: 0, early: true }; phase = 'move'; }   // left too early: he throws to first
    }
    function goBack() { if (back != null || went != null) return; back = move ? move.t : -1; }
    function settle(kind, safe, text, voice) {
      res = { kind, safe, t: 0 }; tries++; phase = 'result'; pt = 0;
      if (kind === 'steal' && safe) { sb++; E.float('SAFE!', E.W / 2, E.H * 0.36, '#7bdc8a', 70); Sound.cheer(); E.burst(L.b2, L.y, 30, ['#c08a55', '#a8744a'], 160, 300, 4); }
      else if (kind === 'steal' || kind === 'picked') { outsN++; E.float('OUT!', E.W / 2, E.H * 0.36, '#ff8a8a', 70); Sound.ooh(); if (kind === 'steal') E.burst(L.b2, L.y, 30, ['#c08a55', '#a8744a'], 160, 300, 4); }
      else E.float(text, E.W / 2, E.H * 0.36, '#fff', 44);
      if (voice) Sound.say(voice); E.say(text);
    }
    E.down = (x, y) => {
      if (over) return;
      if (phase === 'intro') { startTry(); return; }
      if (inB(L.go, x, y)) return go();
      if (inB(L.bk, x, y)) return goBack();
      if (phase === 'set' && Math.abs(y - L.y) < E.H * 0.2) dragX = x;
    };
    E.move = (x, y, pressed) => { if (dragX != null && pressed && phase === 'set') { lead = clamp(lead + (x - dragX) / L.ft, 2, 15); dragX = x; runX = lead; } };
    E.up = () => { dragX = null; };
    E.key = k => { if (phase === 'intro') return startTry(); if (k === 'ArrowRight' && phase === 'set') { lead = clamp(lead + 1, 2, 15); runX = lead; } else if (k === 'ArrowLeft') { if (phase === 'set' && !move) { lead = clamp(lead - 1, 2, 15); runX = lead; } else goBack(); } else if (k === ' ' || k === 'Enter') go(); };
    E.draw = dt => {
      pt += dt; scene(); fielder(); pitcherDraw();
      if (phase === 'set') {
        if (Math.random() < dt * 0.25) look = 0.8; look = Math.max(0, look - dt);
        if (pt > wait) { const pickP = clamp(0.18 + (lead - 6) * 0.05, 0.12, 0.55); move = { kind: Math.random() < pickP ? 'pick' : 'home', t: 0 }; phase = 'move'; }
      }
      if (phase === 'move') {
        move.t += dt;
        if (move.kind === 'home') {
          if (went != null) {   // the race
            const jump = went, runT = jump + 0.3 + (BASE - lead) / 19.5, throwT = KICK + 0.75 + POP, t = move.t;
            runX = lead + clamp((t - jump - 0.3) / (runT - jump - 0.3), 0, 1) * (BASE - lead);
            if (t > KICK + 0.75 && !throwBall) { throwBall = { to: 2, t0: t, T: POP }; Sound.pop(); }
            if (t >= Math.max(runT, throwT)) { const margin = throwT - runT; jumps.push(Math.round(jump * 1000));
              Sound.slide(); settle('steal', margin > 0, margin > 0 ? (margin < 0.12 ? 'SAFE by a hair! ' : 'Safe! ') + 'Jump ' + Math.round(jump * 1000) + ' ms' : (margin > -0.12 ? 'Out by a hair. ' : 'Out. ') + 'Jump ' + Math.round(jump * 1000) + ' ms. Go sooner!', margin > 0 ? 'Safe!' : 'Out!'); }
          } else if (move.t > KICK + 1.0) { E.float('He didn’t go. Pitch is in.', E.W / 2, E.H * 0.36, '#fff', 30); phase = 'gap'; pt = 0; }
          else if (move.t > KICK + 0.75 && !throwBall) { throwBall = { to: 0, t0: move.t, T: 0.5 }; }
        } else {   // pickoff throw to first
          if (move.t > 0.25 && !throwBall) { throwBall = { to: 1, t0: move.t, T: PICKT - 0.25 }; Sound.whoosh(); }
          if (went != null) { runX = lead + Math.min(1, move.t / 2) * 10; if (move.t > PICKT + 0.1) settle('picked', false, move.early ? 'Too early! He saw you go. Picked off.' : 'Picked off! He threw to first.', 'Out!'); }
          else { const react = back != null ? back : 0.42, home = react + lead / 21;
            runX = lead * (1 - clamp((move.t - react) / (lead / 21), 0, 1));
            if (move.t > Math.max(home, PICKT)) { const safe = home < PICKT + 0.12; if (safe) { phase = 'gap'; pt = 0; Sound.slide(); E.float(back != null ? 'Back in time! Good read.' : 'Safe back at first', E.W / 2, E.H * 0.36, '#7bdc8a', 34); E.say('Pickoff throw, but you got back.'); } else settle('picked', false, 'Picked off! Lead was too big or you were slow back.', 'Out!'); } }
        }
      }
      if (throwBall) { const k = clamp(((move ? move.t : 0) - throwBall.t0) / throwBall.T, 0, 1);
        const sx = throwBall.to === 1 ? L.mx : throwBall.to === 2 ? E.W * 0.02 : L.mx, sy = throwBall.to === 2 ? E.H * 0.98 : L.my - E.H * 0.25;
        const tx = throwBall.to === 1 ? L.b1 - 20 : throwBall.to === 2 ? L.b2 + 20 : -40, ty = throwBall.to === 0 ? E.H : L.y - 40;
        if (k < 1 || res) ball(c, lerp(sx, tx, k), lerp(sy, ty, k) - Math.sin(k * Math.PI) * E.H * 0.06, 6); }
      runner();
      // controls
      if (phase === 'set' || phase === 'move') { cbtn(c, L.bk, '◀ BACK', back != null); cbtn(c, L.go, 'GO! ▶', went != null); }
      if (phase === 'set') txt(c, 'LEAD ' + Math.round(lead) + ' FT · drag me to change it', E.W / 2, L.y - E.H * 0.17, 20, lead > 11 ? '#ff8a8a' : lead > 8 ? '#ffd23f' : '#fff', 'center', 800);
      if ((phase === 'result' && pt > 1.8) || (phase === 'gap' && pt > 1.3)) {
        if (tries >= TRIES || outsN >= 3) { over = true; phase = 'end'; setTimeout(end, 300); } else startTry();
      }
      scoreboard(c, E.W, [['STEALS', sb], ['TRY', Math.min(tries + 1, TRIES) + ' of ' + TRIES, '#fff'], ['OUTS', dots(outsN, 3), '#ff8a8a'], ['BEST JUMP', jumps.length ? Math.min(...jumps) + ' ms' : '–', '#7bdcff']]);
      if (phase === 'intro') {
        c.fillStyle = 'rgba(16,16,16,.85)'; rr(c, E.W * 0.06, E.H * 0.2, E.W * 0.88, 250, 16); c.fill();
        txt(c, 'STEAL SECOND', E.W / 2, E.H * 0.2 + 38, 40, TEAM.orange);
        ['Drag your runner to take a lead.', 'Bigger lead = faster steal, but more pickoff throws.', 'Press GO the moment his knee lifts toward home.', 'If he spins to first, press BACK!'].forEach((l, i) => txt(c, l, E.W / 2, E.H * 0.2 + 84 + i * 32, 20, '#fff', 'center', 600, 0));
        txt(c, 'TAP TO START', E.W / 2, E.H * 0.2 + 228, 24, '#ffd23f', 'center', 800, 0);
      }
    };
    function end() {
      const avg = jumps.length ? Math.round(jumps.reduce((a, b) => a + b, 0) / jumps.length) : null;
      finish(ui, sb, [sb + ' stolen base' + (sb === 1 ? '' : 's') + '!', 'Outs: ' + outsN + (avg != null ? ' · Average jump: ' + avg + ' ms' : ''), 'Real base stealers go on the pitcher’s first move home, not when the ball is thrown.'], done);
    }
    live = { stop: E.stop };
    E.start(); E.say('Steal Second. Tap to start.');
  }

  /* ---------- 4. OUTFIELD HERO: run under fly balls, dive, then make the right throw ---------- */
  function outfield2d(level, done) {
    const N = 10;
    const ui = open('Outfield Hero', ['', 'Rookie', 'Pro', 'All-Star'][level] + ' · ' + N + ' fly balls in center field');
    const E = Engine(ui), c = E.c;
    const SPEED = [0, 24, 21, 19][level];   // feet per second
    // Situations with a settled right answer (throw ahead of the lead runner / to the base he is going to).
    const SIT = [
      { r: [0, 0, 0], txt: 'Nobody on base.', ans: 2, why: 'With nobody on, get it back to second base fast.' },
      { r: [1, 0, 0], txt: 'Runner on first. He runs back to first.', ans: 2, why: 'Throw to second, one base ahead of the runner.' },
      { r: [0, 1, 0], txt: 'Runner on second. He tags up for third!', ans: 3, why: 'He’s going to third. Beat him there.' },
      { r: [0, 0, 1], txt: 'Runner on third. He tags up for home!', ans: 4, why: 'Throw home to stop the run.' },
      { r: [1, 1, 0], txt: 'Runners on first and second. Lead runner tags for third!', ans: 3, why: 'Throw ahead of the lead runner: third base.' },
      { r: [1, 0, 1], txt: 'Runners on first and third. Runner on third tags up!', ans: 4, why: 'The run is the big one. Throw home.' }
    ];
    let n = 0, pts = 0, catches = 0, dives = 0, smart = 0, phase = 'intro', pt = 0, B = null, me = { x: 0, z: 150 }, target = null, sit = null, diving = 0, thr = null, over = false, msg = '';
    let s = 1, home = { x: 0, y: 0 }, baseP = [];
    E.onResize = () => { s = Math.min((E.H - 175) / 232, E.W / 215); home = { x: E.W / 2, y: E.H - 22 }; baseP = [null, P(46, 46), P(0, 92), P(-46, 46), P(0, 0)]; };
    function P(x, z) { return { x: home.x + x * s, y: home.y - z * s }; }
    const fence = a => 200 + 25 * Math.cos(clamp(a / 45, -1, 1) * Math.PI / 2);
    function field() {
      const W = E.W, H = E.H;
      c.fillStyle = '#1c2a1e'; c.fillRect(0, 0, W, H);
      const pts2 = []; for (let a = -45; a <= 45; a += 3) { const d = fence(a), r = a * Math.PI / 180; pts2.push(P(d * Math.sin(r), d * Math.cos(r))); }
      c.fillStyle = '#3b8f46'; c.beginPath(); c.moveTo(home.x, home.y); pts2.forEach(p => c.lineTo(p.x, p.y)); c.closePath(); c.fill();
      c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,.06)'; for (let i = -20; i < 20; i += 2) { c.save(); c.translate(home.x, home.y); c.rotate(Math.PI / 4); c.fillRect(i * 16 * s, -400 * s, 16 * s, 800 * s); c.restore(); } c.restore();
      c.strokeStyle = '#ffd23f'; c.lineWidth = 5; c.beginPath(); pts2.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
      c.strokeStyle = '#14502c'; c.lineWidth = 12; c.beginPath(); pts2.forEach((p, i) => i ? c.lineTo(p.x - 0, p.y - 7) : c.moveTo(p.x, p.y - 7)); c.stroke();
      c.fillStyle = '#c08a55'; c.beginPath(); [P(0, -6), P(56, 46), P(0, 104), P(-56, 46)].forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill();
      c.fillStyle = '#3b8f46'; c.beginPath(); [P(0, 9), P(39, 46), P(0, 83), P(-39, 46)].forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; for (const sg of [-1, 1]) { const e = P(sg * 150, 150); c.beginPath(); c.moveTo(home.x, home.y); c.lineTo(e.x, e.y); c.stroke(); }
      [1, 2, 3].forEach(i => { const p = baseP[i]; c.fillStyle = '#fff'; c.save(); c.translate(p.x, p.y); c.rotate(Math.PI / 4); c.fillRect(-5, -5, 10, 10); c.restore(); });
      c.fillStyle = '#fff'; c.beginPath(); c.arc(home.x, home.y - 2, 5, 0, 7); c.fill();
    }
    function player(x, y, col, num, big) { const r = (big ? 4.2 : 3.2) * s + 4;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 3, y + 4, r, r * 0.7, 0, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = big ? TEAM.orange : '#fff'; c.lineWidth = 3; c.stroke();
      if (num) txt(c, num, x, y + 1, r * 1.1, TEAM.orange, 'center', 800, 0); }
    function newBall() {
      const deep = Math.random() < (level === 1 ? 0.08 : 0.14), a = rnd(-32, 32), d = deep ? fence(a) + 8 : rnd(115, 196);
      const T = rnd(2.6, 3.6) - (level - 1) * 0.25, r = a * Math.PI / 180;
      B = { x: d * Math.sin(r), z: d * Math.cos(r), d, T, t: 0, apex: 9.8 * T * T / 2 * 1.4, deep, landed: false };
      me = { x: 0, z: 150 }; target = null; diving = 0; sit = null; thr = null; msg = ''; phase = 'fly'; pt = 0;
      Sound.crack(); E.say('Fly ball! Run to it. Ball ' + (n + 1) + ' of ' + N + '.');
    }
    const ballPos = () => { const k = clamp(B.t / B.T, 0, 1); return { x: B.x * k, z: B.z * k, h: 4 * B.apex * k * (1 - k) / 4 + 3 * (1 - k), k }; };
    function caught(dive) {
      catches++; pts += 100; if (dive) { dives++; pts += 100; E.float('DIVING CATCH! +200', E.W / 2, E.H * 0.3, '#ffd23f', 44); Sound.cheer(); E.shake(8, 0.25); }
      else { E.float('CAUGHT! +100', E.W / 2, E.H * 0.3, '#7bdc8a', 44); Sound.pop(); }
      E.burst(P(me.x, me.z).x, P(me.x, me.z).y, 24, ['#fff', '#ffd23f'], 180, 200);
      toThrow();
    }
    function toThrow() { sit = B.deep ? { r: [0, 0, 0], txt: 'Off the wall! The batter is going for second.', ans: 2, why: 'Hit the base he’s heading to: second.' } : pick(SIT); phase = 'throw'; pt = 0;
      E.say(sit.txt + ' Where do you throw? Tap the base.'); }
    function throwTo(b) {
      if (phase !== 'throw') return;
      thr = { b, t: 0 }; const right = b === sit.ans, fast = pt < 1.6;
      if (right) { smart++; pts += 50 + (fast ? 25 : 0); E.float('SMART THROW! +' + (fast ? 75 : 50), E.W / 2, E.H * 0.38, '#7bdcff', 36); Sound.blip(true); }
      else { E.float('Wrong base', E.W / 2, E.H * 0.38, '#ff8a8a', 36); Sound.blip(false); }
      msg = sit.why; phase = 'thrown'; pt = 0; E.say((right ? 'Right! ' : 'Not that one. ') + sit.why);
    }
    E.down = (x, y) => {
      if (over) return;
      if (phase === 'intro') { newBall(); return; }
      if (phase === 'throw') { for (let i = 1; i <= 4; i++) { const p = baseP[i]; if (Math.hypot(x - p.x, y - p.y) < 44) return throwTo(i); } return; }
      if (phase === 'fly') {
        const bp = ballPos(), d = Math.hypot(bp.x - me.x, bp.z - me.z);
        if (bp.h < 7 && d < 12 && !diving) { diving = 0.01; Sound.whoosh(); return; }
        target = { x: (x - home.x) / s, z: (home.y - y) / s };
      }
    };
    E.move = (x, y, pressed) => { if (phase === 'fly' && pressed && !diving) target = { x: (x - home.x) / s, z: (home.y - y) / s }; };
    E.up = () => { target = null; };
    E.key = k => { if (phase === 'intro') return newBall(); if (phase === 'throw' && /^[1-4]$/.test(k)) return throwTo(+k);
      if (phase === 'fly') { const v = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k]; if (v) target = { x: me.x + v[0] * 30, z: me.z + v[1] * 30 }; else if (k === ' ' || k === 'Enter') E.down(-999, -999); } };
    E.draw = dt => {
      pt += dt; field();
      // teammates and runners
      player(P(46, 50).x, P(46, 50).y, '#555', '', false); player(P(-30, 80).x, P(-30, 80).y, '#555', '', false);
      if (sit) sit.r.forEach((on, i) => { if (on) { const p = baseP[i + 1]; player(p.x + 12, p.y - 8, '#7a1f2b', '', false); } });
      if (phase === 'fly') {
        B.t += dt; const bp = ballPos();
        if (target && !diving) { const dx = target.x - me.x, dz = target.z - me.z, d = Math.hypot(dx, dz), step = SPEED * dt; if (d > 1) { me.x += dx / d * Math.min(step, d); me.z += dz / d * Math.min(step, d); } }
        if (diving) { diving += dt; const dx = bp.x - me.x, dz = bp.z - me.z, d = Math.hypot(dx, dz); if (d > 0.5) { me.x += dx / d * Math.min(d, 40 * dt); me.z += dz / d * Math.min(d, 40 * dt); } }
        if (level === 1 && bp.k > 0.3) { const L2 = P(B.x, B.z); c.strokeStyle = 'rgba(255,210,63,.6)'; c.lineWidth = 3; c.setLineDash([5, 5]); c.beginPath(); c.arc(L2.x, L2.y, 5 * s + 6, 0, 7); c.stroke(); c.setLineDash([]); }
        const g = P(bp.x, bp.z), d = Math.hypot(bp.x - me.x, bp.z - me.z);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(g.x, g.y, 5, 3, 0, 0, 7); c.fill();
        player(P(me.x, me.z).x, P(me.x, me.z).y, TEAM.black, ME.num, true);
        ball(c, g.x, g.y - bp.h * s * 0.9, 5 + bp.h * 0.12);
        if (bp.h < 7 && d < 12 && d > 4.5 && !diving) txt(c, 'DIVE! TAP!', P(me.x, me.z).x, P(me.x, me.z).y - 40, 26, '#ffd23f');
        if (bp.k >= 1) {
          if (B.deep) { E.float('Off the wall!', E.W / 2, E.H * 0.3, '#fff', 40); Sound.ooh(); toThrow(); }
          else if (d <= 4.5 && !diving) caught(false);
          else if (diving && d <= 12) caught(true);
          else { E.float('Dropped in!', E.W / 2, E.H * 0.3, '#ff8a8a', 40); Sound.ooh(); toThrow(); }
        }
      } else if (phase !== 'intro') player(P(me.x, me.z).x, P(me.x, me.z).y, TEAM.black, ME.num, true);
      if (phase === 'throw') {
        c.fillStyle = 'rgba(16,16,16,.85)'; rr(c, 10, 74, E.W - 20, 70, 12); c.fill();
        txt(c, sit.txt, E.W / 2, 96, Math.min(22, E.W / 26), '#fff', 'center', 700, 0); txt(c, 'Tap the base to throw to', E.W / 2, 124, 18, '#ffd23f', 'center', 700, 0);
        [1, 2, 3, 4].forEach(i => { const p = baseP[i], pulse = 30 + Math.sin(E.t * 6) * 4; c.strokeStyle = '#ffd23f'; c.lineWidth = 4; c.beginPath(); c.arc(p.x, p.y, pulse, 0, 7); c.stroke(); txt(c, ['', '1ST', '2ND', '3RD', 'HOME'][i], p.x, p.y - pulse - 12, 16, '#fff', 'center', 800, 3); });
        if (pt > 4) throwTo(0);
      }
      if (thr) { thr.t += dt; const k = Math.min(1, thr.t / 0.6), a = P(me.x, me.z), b = thr.b ? baseP[thr.b] : a; ball(c, lerp(a.x, b.x, k), lerp(a.y, b.y, k) - Math.sin(k * Math.PI) * 40, 6); }
      if (phase === 'thrown') { c.fillStyle = 'rgba(16,16,16,.85)'; rr(c, 10, 74, E.W - 20, 50, 12); c.fill(); txt(c, msg, E.W / 2, 99, Math.min(21, E.W / 28), '#fff', 'center', 700, 0);
        if (pt > 2.4) { n++; if (n >= N) { over = true; phase = 'end'; setTimeout(end, 300); } else newBall(); } }
      scoreboard(c, E.W, [['POINTS', pts], ['BALL', Math.min(n + 1, N) + ' of ' + N, '#fff'], ['CATCHES', catches, '#7bdc8a'], ['SMART THROWS', smart, '#7bdcff']]);
      if (phase === 'intro') {
        c.fillStyle = 'rgba(16,16,16,.85)'; rr(c, E.W * 0.06, E.H * 0.25, E.W * 0.88, 250, 16); c.fill();
        txt(c, 'OUTFIELD HERO', E.W / 2, E.H * 0.25 + 38, 40, TEAM.orange);
        ['You’re #' + ME.num + ' in center field.', 'Touch and hold where you want to run.', 'Ball close but not quite? Tap to DIVE!', 'Then tap the right base to throw to.'].forEach((l, i) => txt(c, l, E.W / 2, E.H * 0.25 + 84 + i * 32, 20, '#fff', 'center', 600, 0));
        txt(c, 'TAP TO START', E.W / 2, E.H * 0.25 + 226, 24, '#ffd23f', 'center', 800, 0);
      }
    };
    function end() { finish(ui, pts, [pts + ' points!', 'Catches: ' + catches + ' of ' + N + (dives ? ' (' + dives + ' diving)' : '') + ' · Smart throws: ' + smart + ' of ' + N, 'Pro tip: before every pitch, know where you’ll throw if the ball comes to you.'], done); }
    live = { stop: E.stop };
    E.start(); E.say('Outfield Hero. Tap to start.');
  }

  /* ---------- 5. BASEBALL BRAIN: every question is an at-bat. Pick how big to swing. ---------- */
  function brain(done) {
    const ui = open('Baseball Brain', 'Single = easy · Double = medium · Home run = hard · 3 outs');
    const used = new Set(); let runs = 0, outs = 0, ab = 0, bases = [0, 0, 0], streak = 0, best = 0, timer = 0, tleft = 0, over = false;
    const LIMIT = 15;
    const board = el('div', { class: 'bb-board' }), dia = el('div', { class: 'bb-dia', 'aria-hidden': 'true' }), body = el('div', { class: 'bb-body' });
    ui.stage.classList.remove('cvstage'); ui.stage.replaceChildren(el('div', { class: 'bb' }, board, dia, body));
    const drawBoard = () => { board.replaceChildren(...[['RUNS', runs], ['OUTS', dots(outs, 3)], ['AT-BAT', Math.min(ab + 1, LIMIT) + '/' + LIMIT], ['STREAK', streak ? streak + (streak >= 3 ? ' 🔥' : '') : '–']].map(([l, v]) => el('div', null, el('span', null, l), el('b', null, String(v))))); ui.status.textContent = runs + ' runs, ' + outs + ' outs'; };
    const drawDia = () => { dia.innerHTML = '<svg viewBox="0 0 120 120"><path d="M60 110L110 60L60 10L10 60Z" fill="#3b8f46" stroke="#fff" stroke-width="3"/>' +
      [[110, 60], [60, 10], [10, 60]].map(([x, y], i) => '<rect x="' + (x - 9) + '" y="' + (y - 9) + '" width="18" height="18" transform="rotate(45 ' + x + ' ' + y + ')" fill="' + (bases[i] ? '#f28c38' : '#fff') + '" stroke="#161616" stroke-width="2"/>' + (bases[i] ? '<circle cx="' + x + '" cy="' + (y - 16) + '" r="7" fill="#161616" stroke="#f28c38" stroke-width="2"/>' : '')).join('') +
      '<path d="M52 112h16v-7l-8-7-8 7z" fill="#fff"/></svg>'; };
    const hit = n => { let sc = 0; for (let i = 2; i >= 0; i--) if (bases[i]) { bases[i] = 0; if (i + n >= 3) sc++; else bases[i + n] = 1; } if (n === 4) sc++; else bases[n - 1] = 1; runs += sc; return sc; };
    const qFor = lvl => { let pool = TRIVIA.filter(q => q.lvl === lvl && !used.has(q.q)); if (!pool.length) pool = TRIVIA.filter(q => !used.has(q.q)); if (!pool.length) { used.clear(); pool = TRIVIA; } const q = pick(pool); used.add(q.q); return q; };
    function choose() {
      if (over) return;
      if (outs >= 3 || ab >= LIMIT) return end();
      drawBoard(); drawDia();
      const opts = [[1, 'SINGLE', 'Easy question', 1], [2, 'DOUBLE', 'Medium question', 2], [4, 'HOME RUN', 'Hard question', 3]];
      body.replaceChildren(el('p', { class: 'bb-ask' }, 'At-bat ' + (ab + 1) + '. How big are you swinging?'),
        el('div', { class: 'bb-choices' }, opts.map(([n, t, s, lvl]) => el('button', { type: 'button', class: 'bb-choice c' + n, onclick: () => { Sound.later(Sound.tick); ask(n, lvl); } }, el('b', null, t), el('span', null, s)))));
      body.querySelector('button').focus();
    }
    function ask(n, lvl) {
      const q = qFor(lvl), opts = shuffled([q.a].concat(q.w)), T = 15;
      const bar = el('div', { class: 'bb-timer' }, el('i', { style: 'animation-duration:' + T + 's' }));
      const fb = el('div', { class: 'g-fb', 'aria-live': 'assertive' });
      const btns = opts.map(o => el('button', { type: 'button', class: 'g-opt', onclick: e => answer(o, e.currentTarget) }, o));
      body.replaceChildren(el('p', { class: 'bb-tag c' + n }, ['', 'Swinging for a SINGLE', 'Swinging for a DOUBLE', '', 'Swinging for a HOME RUN'][n]), bar, el('p', { class: 'g-qtext' }, q.q), el('div', { class: 'g-opts' }, btns), fb);
      btns[0].focus(); tleft = T;
      timer = setInterval(() => { tleft--; if (tleft <= 5 && tleft > 0) Sound.tick(); if (tleft <= 0) answer(null, null); }, 1000);
      function answer(o, b) {
        clearInterval(timer); if (btns[0].disabled) return;
        btns.forEach(x => { x.disabled = true; if (x.textContent === q.a) x.classList.add('right'); });
        const ok = o === q.a; ab++;
        let head;
        if (ok) { streak++; best = Math.max(best, streak); const sc = hit(n); Sound.crack();
          if (n === 4) { setTimeout(Sound.cheer, 150); setTimeout(Sound.organ, 900); } else if (sc) setTimeout(Sound.cheer, 150);
          head = ['', 'Base hit!', 'DOUBLE!', '', 'HOME RUN!'][n] + (sc ? ' ' + sc + ' run' + (sc > 1 ? 's' : '') + ' score' + (sc > 1 ? '' : 's') + '!' : '');
          fb.classList.add('bb-good'); }
        else { streak = 0; outs++; if (b) b.classList.add('wrong'); Sound.say(o == null ? 'Strike three!' : 'Out!'); head = o == null ? 'Time ran out. Strike three!' : 'Out!'; }
        drawBoard(); drawDia();
        fb.replaceChildren(el('p', null, el('b', null, head + ' '), q.fact), el('button', { type: 'button', class: 'btn', id: 'g-next', onclick: choose }, outs >= 3 || ab >= LIMIT ? 'See my score' : 'Next batter'));
        document.getElementById('g-next').focus();
      }
    }
    function end() {
      over = true; clearInterval(timer);
      finish(ui, runs, [runs + ' run' + (runs === 1 ? '' : 's') + '!', 'Longest streak: ' + best + ' right in a row' + (ab >= LIMIT && outs < 3 ? ' · Mercy rule: you couldn’t be stopped!' : ''), runs >= 6 ? 'Baseball genius!' : 'Swing for home runs when you know your stuff.'], done);
    }
    live = { stop: () => { over = true; clearInterval(timer); } };
    choose();
  }

  function play(id, opts, done) {
    onExit = done; opts = opts || {};
    if (opts.me) ME = Object.assign({}, ME, opts.me);
    const lv = clamp(opts.level || 1, 1, 3);
    if (id === 'derby') derby(lv, done); else if (id === 'kking') kking(lv, done); else if (id === 'steal') steal(lv, done); else if (id === 'outfield') outfield(lv, done); else if (id === 'pitchrec') pitchrec(lv, done); else if (id === 'brain') brain(done);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && layer) close(); });
  return { play, close, Sound, TRIVIA };
})();
