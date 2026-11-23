// HUD markup shared by the 3D games: team score bug, callout, tip, intro card.
export function hudShell(o) {
  const cells = (o.cells || []).map(([label, id]) => `<div class="d3bug-cell"><span>${label}</span><b id="${id}">0</b></div>`).join('');
  return `<div class="d3bug${o.top ? ' top' : ''}"><div class="d3bug-team"><b>${o.team}</b><span>${o.sub}</span></div>${cells}</div>
    ${o.extra || ''}
    <div class="d3call" id="d3-call"></div>
    <div class="d3tip" id="d3-tip"></div>
    <div class="d3intro" id="d3-intro"><div class="d3card">
      <div class="d3kicker">${o.kicker}</div><h2>${o.title}</h2>
      ${(o.lines || []).map(l => `<p>${l}</p>`).join('')}
      <button type="button" class="d3go" id="d3-go">PLAY BALL</button></div></div>`;
}
export const bugSet = ($, id, v) => { const e = $(id); if (e) e.textContent = v; };
// Sound effects that never break the game: a missing effect is just silent.
export const safeSound = S => new Proxy(S || {}, { get: (t, k) => typeof t[k] === 'function' ? t[k].bind(t) : () => {} });
