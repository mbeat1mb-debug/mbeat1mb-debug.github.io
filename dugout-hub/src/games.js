/* Arcade games, trivia and sound effects. Self-contained: draws into its own full-screen layer. */
const HubGames = (() => {
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v); }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    return n;
  };
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = n => Math.floor(Math.random() * n);
  const shuffled = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

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
    // iPads only allow sound to start inside a real tap: unlock() runs in the tap, the sound itself plays right after the screen updates.
    const unlock = () => { ac(); };
    const later = f => { unlock(); setTimeout(f, 0); };
    function crack() { const c = ac(); if (!c) return; const t = c.currentTime, n = noise(c, 0.12), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'highpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11); n.connect(f).connect(g).connect(c.destination); n.start(t);
      const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.06); og.gain.setValueAtTime(0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07); o.connect(og).connect(c.destination); o.start(t); o.stop(t + 0.08); }
    function cheer() { const c = ac(); if (!c) return; const t = c.currentTime, n = noise(c, 2.2), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.7; g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.5); g.gain.setValueAtTime(0.5, t + 1.3); g.gain.exponentialRampToValueAtTime(0.001, t + 2.1);
      n.connect(f).connect(g).connect(c.destination); n.start(t);
      for (let i = 0; i < 10; i++) { const cl = noise(c, 0.03), cg = c.createGain(), at = t + 0.3 + Math.random() * 1.4; cg.gain.setValueAtTime(0.25, at); cg.gain.exponentialRampToValueAtTime(0.001, at + 0.03); cl.connect(cg).connect(c.destination); cl.start(at); } }
    function blip(ok) { const c = ac(); if (!c) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle';
      o.frequency.setValueAtTime(ok ? 660 : 220, t); if (ok) o.frequency.setValueAtTime(990, t + 0.08); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.22); }
    function say(text) { if (!on() || !window.speechSynthesis) return; try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; u.pitch = 0.8; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
    // Warm the buffers once the first tap has unlocked audio.
    const warm = () => { const c = ac(); if (c) { noise(c, 0.12); noise(c, 2.2); noise(c, 0.03); } };
    return { on, set, crack, cheer, blip, say, later, warm };
  })();

  /* ---------- Trivia. lvl 1 = Rookie (rules), 2 = Pro, 3 = Hall of Fame (history). Facts kept to settled ones. ---------- */
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
    ui.stage.replaceChildren(el('div', { class: 'g-end' }, el('p', { class: 'g-big' }, lines[0]), lines.slice(1).map(t => el('p', null, t)),
      el('div', { class: 'g-endbtns' }, score == null ? null : el('button', { type: 'button', class: 'btn line', id: 'game-again', onclick: () => { close(true); done(score, true); } }, 'Save and play again'),
        el('button', { type: 'button', class: 'btn', id: 'game-done', onclick: () => { close(true); done(score); } }, score == null ? 'Back to the Arcade' : 'Save my score'))));
    document.getElementById('game-done').focus();
  }

  /* ---------- Trivia ---------- */
  function trivia(level, done) {
    const pool = shuffled(TRIVIA.filter(q => q.lvl === level)), qs = pool.slice(0, Math.min(10, pool.length));
    const ui = open('Baseball Trivia', ['', 'Rookie', 'Pro', 'Hall of Fame'][level] + ' level');
    let i = 0, right = 0;
    const show = () => {
      if (i >= qs.length) { if (right === qs.length) Sound.cheer(); return finish(ui, right, [right + ' of ' + qs.length + ' right!', right >= 8 ? 'Baseball brain!' : right >= 5 ? 'Nice work. Play again to learn more.' : 'Every pro started somewhere. Try again!'], done); }
      const q = qs[i], opts = shuffled([q.a].concat(q.w));
      ui.status.textContent = 'Question ' + (i + 1) + ' of ' + qs.length + ' · ' + right + ' right';
      const fb = el('div', { class: 'g-fb', 'aria-live': 'assertive' });
      const btns = opts.map(o => el('button', { type: 'button', class: 'g-opt', onclick: e => pick(o, e.currentTarget) }, o));
      const pick = (o, b) => {
        btns.forEach(x => { x.disabled = true; if (x.textContent === q.a) x.classList.add('right'); });
        const ok = o === q.a; if (ok) right++; else b.classList.add('wrong');
        Sound.blip(ok);
        fb.replaceChildren(el('p', null, el('b', null, ok ? 'Yes! ' : 'Not quite. '), q.fact), el('button', { type: 'button', class: 'btn', id: 'g-next', onclick: () => { i++; show(); } }, i + 1 < qs.length ? 'Next question' : 'See my score'));
        document.getElementById('g-next').focus();
      };
      ui.stage.replaceChildren(el('div', { class: 'g-q' }, el('p', { class: 'g-qtext' }, q.q), el('div', { class: 'g-opts' }, btns), fb));
      btns[0].focus();
    };
    show();
  }

  /* ---------- Color Call: tap only when the ball is your color ---------- */
  const COLORS = [['red', '#d2342a'], ['blue', '#1d6aa8'], ['green', '#187a47'], ['yellow', '#e8b400']];
  function reaction(done) {
    const target = COLORS[rand(COLORS.length)], ui = open('Color Call', 'Tap only when the ball is ' + target[0].toUpperCase());
    const ROUNDS = 10, times = []; let round = 0, mistakes = 0, shownAt = 0, timer = null, phase = 'wait', curr = null;
    const pad = el('button', { type: 'button', class: 'g-pad', 'aria-label': 'Tap here when you see a ' + target[0] + ' ball' });
    const ball = el('div', { class: 'g-ball', 'aria-hidden': 'true' }), msg = el('p', { class: 'g-msg' }, 'Get ready…');
    pad.append(ball, msg);
    ui.stage.replaceChildren(el('p', { class: 'g-rule' }, 'Your color: ', el('span', { class: 'chip', style: 'background:' + target[1] }), ' ' + target[0] + '. Other colors: don’t tap!'), pad);
    const next = () => {
      ui.status.textContent = 'Pitch ' + Math.min(round + 1, ROUNDS) + ' of ' + ROUNDS + (mistakes ? ' · ' + mistakes + ' oops' : '');
      if (round >= ROUNDS) return end();
      phase = 'wait'; ball.style.visibility = 'hidden'; msg.textContent = 'Wait for it…';
      timer = setTimeout(() => {
        curr = Math.random() < 0.65 ? target : COLORS.filter(c => c !== target)[rand(3)];
        ball.style.background = curr[1]; ball.style.visibility = 'visible'; msg.textContent = ''; shownAt = performance.now(); phase = 'shown';
        timer = setTimeout(() => { if (phase !== 'shown') return; if (curr === target) { mistakes++; msg.textContent = 'Too slow!'; Sound.blip(false); } else { msg.textContent = 'Good, you held off!'; } phase = 'gap'; round++; timer = setTimeout(next, 700); }, 1100);
      }, 900 + Math.random() * 1600);
    };
    const tap = e => {
      e.preventDefault();
      if (phase === 'wait') { mistakes++; clearTimeout(timer); msg.textContent = 'Too early! Wait for the ball.'; Sound.blip(false); phase = 'gap'; round++; timer = setTimeout(next, 900); return; }
      if (phase !== 'shown') return;
      clearTimeout(timer); phase = 'gap'; round++;
      if (curr === target) { const ms = Math.round(performance.now() - shownAt); if (ms < 120) { mistakes++; msg.textContent = 'Too fast to be real. That was a guess!'; Sound.blip(false); } else { times.push(ms); msg.textContent = ms + ' ms'; Sound.crack(); } }
      else { mistakes++; msg.textContent = 'That was ' + curr[0] + '! Hold off.'; Sound.blip(false); }
      timer = setTimeout(next, 700);
    };
    pad.addEventListener('pointerdown', tap);
    pad.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') tap(e); });
    const end = () => {
      if (!times.length) return finish(ui, null, ['No good taps this time.', 'Wait for your color, then tap fast.'], () => done(null));
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length), score = avg + mistakes * 100;
      finish(ui, score, [score + ' ms', 'Average ' + avg + ' ms + ' + mistakes + ' mistake' + (mistakes === 1 ? '' : 's') + ' × 100 ms = ' + score + ' ms', 'Lower is better.'], done);
    };
    live = { stop: () => clearTimeout(timer) };
    timer = setTimeout(next, 800);
  }

  /* ---------- Strike Zone Memory: a pitch flashes in the zone, tap where it was ---------- */
  function zone(done) {
    const ui = open('Strike Zone Memory', 'Watch the pitch, then tap where it crossed the zone');
    const ROUNDS = 10; let round = 0, right = 0, spot = -1, timer = null, armed = false;
    const cells = [...Array(9)].map((_, k) => el('button', { type: 'button', class: 'g-cell', 'aria-label': ['High', 'Middle', 'Low'][Math.floor(k / 3)] + ' ' + ['inside', 'middle', 'outside'][k % 3], disabled: true, onclick: () => pick(k) }));
    const grid = el('div', { class: 'g-zone' }, cells), msg = el('p', { class: 'g-msg' }, '');
    ui.stage.replaceChildren(grid, msg);
    const flashMs = () => Math.max(180, 650 - round * 50);
    const next = () => {
      if (round >= ROUNDS) return finish(ui, right, [right + ' of ' + ROUNDS, right >= 8 ? 'Umpire-level eyes!' : 'Keep your eyes on it the whole way.'], done);
      ui.status.textContent = 'Pitch ' + (round + 1) + ' of ' + ROUNDS + ' · ' + right + ' right';
      cells.forEach(c => { c.disabled = true; c.classList.remove('hit', 'miss', 'ball'); }); armed = false; msg.textContent = 'Watch…';
      timer = setTimeout(() => {
        spot = rand(9); cells[spot].classList.add('ball');
        timer = setTimeout(() => { cells[spot].classList.remove('ball'); cells.forEach(c => { c.disabled = false; }); armed = true; msg.textContent = 'Where was it?'; cells[4].focus(); }, flashMs());
      }, 700 + Math.random() * 900);
    };
    const pick = k => {
      if (!armed) return; armed = false; cells.forEach(c => { c.disabled = true; });
      const ok = k === spot; if (ok) right++;
      cells[spot].classList.add('hit'); if (!ok) cells[k].classList.add('miss');
      msg.textContent = ok ? 'Strike! Right spot.' : 'It was ' + cells[spot].getAttribute('aria-label').toLowerCase() + '.';
      Sound.blip(ok); round++; timer = setTimeout(next, 900);
    };
    live = { stop: () => clearTimeout(timer) };
    next();
  }

  /* ---------- Home Run Derby: tap to swing when the pitch reaches the hitting zone ---------- */
  function derby(done) {
    const ui = open('Home Run Derby', 'Tap anywhere to swing when the ball reaches the plate');
    const ROUNDS = 10; let round = 0, hr = 0, feet = 0, raf = 0, t0 = 0, dur = 0, swung = false, timer = null;
    const field = el('button', { type: 'button', class: 'g-field', 'aria-label': 'Swing' }), ball = el('div', { class: 'g-pitch', 'aria-hidden': 'true' });
    const plate = el('div', { class: 'g-plate', 'aria-hidden': 'true' }), msg = el('p', { class: 'g-msg' }, ''), tally = el('p', { class: 'g-tally' }, '');
    field.append(plate, ball); ui.stage.replaceChildren(field, msg, tally);
    const pitch = () => {
      if (round >= ROUNDS) return finish(ui, hr, [hr + ' home run' + (hr === 1 ? '' : 's') + '!', 'Total distance: ' + feet + ' feet'].concat(hr >= 5 ? ['Derby champ!'] : []), done);
      ui.status.textContent = 'Pitch ' + (round + 1) + ' of ' + ROUNDS + ' · ' + hr + ' HR';
      swung = false; msg.textContent = ''; ball.style.visibility = 'visible'; ball.style.transform = 'translate(-50%, -50%) scale(.5)'; ball.style.top = '8%';
      dur = 650 + Math.random() * 500; // a mix of fast and slow pitches
      timer = setTimeout(() => { t0 = performance.now(); raf = requestAnimationFrame(fly); }, 600 + Math.random() * 700);
    };
    const fly = now => {
      const p = (now - t0) / dur; // 1.0 = at the plate
      ball.style.transform = 'translate(-50%, -50%) scale(' + (0.5 + Math.min(p, 1.25) * 0.7).toFixed(2) + ')';
      ball.style.top = (8 + p * 72).toFixed(1) + '%';
      if (p > 1.25) { if (!swung) { swung = true; msg.textContent = 'Strike! You didn’t swing.'; Sound.say('Strike!'); round++; timer = setTimeout(pitch, 900); } return; }
      raf = requestAnimationFrame(fly);
    };
    const swing = e => {
      e.preventDefault(); if (swung || !t0) return; swung = true; cancelAnimationFrame(raf);
      const off = Math.round(performance.now() - t0 - dur), a = Math.abs(off); let res, dist = 0;
      if (a <= 40) { res = 'HOME RUN!'; dist = 330 + rand(90); hr++; Sound.crack(); setTimeout(Sound.cheer, 150); }
      else if (a <= 80) { res = off < 0 ? 'Double down the line!' : 'Double to the gap!'; dist = 200 + rand(80); Sound.crack(); }
      else if (a <= 130) { res = 'Single!'; dist = 120 + rand(60); Sound.crack(); }
      else if (a <= 200) { res = off < 0 ? 'Foul ball, too early.' : 'Foul ball, too late.'; }
      else { res = off < 0 ? 'Way out in front! Strike.' : 'Swung late. Strike!'; Sound.blip(false); }
      feet += dist; msg.textContent = res + (dist ? ' ' + dist + ' ft' : '') + ' (' + (off > 0 ? '+' : '') + off + ' ms)';
      tally.textContent = hr + ' HR · ' + feet + ' ft total';
      ball.style.visibility = 'hidden'; t0 = 0; round++; timer = setTimeout(pitch, 1000);
    };
    field.addEventListener('pointerdown', swing);
    field.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') swing(e); });
    live = { stop: () => { cancelAnimationFrame(raf); clearTimeout(timer); } };
    field.focus(); pitch();
  }

  function play(id, opts, done) {
    onExit = done;
    if (id === 'trivia') trivia(opts.level || 1, done); else if (id === 'reaction') reaction(done); else if (id === 'zone') zone(done); else if (id === 'derby') derby(done);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && layer) close(); });
  return { play, close, Sound, TRIVIA, COLORS };
})();
