// Road to the Show: his custom player standing in the box at Seed Spitters Park, slowly turning, for the creator and the player card.
import { THREE, world, SPITTERS, gearLook } from './park3d.js';

export function card(cfg) {
  const { stage } = cfg; let me = cfg.me, look = cfg.look;
  const W = world({ stage, me, hudHTML: '', shadow: { x: 0, z: 0, r: 24 }, fov: a => a < 0.8 ? 30 : a < 1.3 ? 26 : 22 });
  const { scene, cam } = W, bat = W.makeBat(gearLook(me).bat);
  let J = null, ang = 0.5, drag = null, spin = 0.22;
  function build() {
    if (J) scene.remove(J.root);
    const S = SPITTERS(me), GL = gearLook(me);
    J = W.human(Object.assign({ mirror: look.bats !== 'R', helmet: true, skin: look.skin, hair: look.hair, finish: GL.finish }, S,
      { colors: Object.assign({}, S.colors, GL.shoes != null ? { shoes: GL.shoes } : {}, look.helmet != null ? { helmet: look.helmet } : GL.helmet != null ? { helmet: GL.helmet } : {}) }));
    scene.add(J.root); W.standInBox(J, bat);
  }
  build();
  // drag sideways to turn him around
  W.cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, a: ang }; W.cv.setPointerCapture && W.cv.setPointerCapture(e.pointerId); });
  W.cv.addEventListener('pointermove', e => { if (drag) ang = drag.a - (e.clientX - drag.x) / 120; });
  const up = () => { drag = null; }; W.cv.addEventListener('pointerup', up); W.cv.addEventListener('pointercancel', up);
  const c = new THREE.Vector3();
  W.run((dt) => {
    if (!drag && !cfg.still) ang += dt * spin;
    J.root.updateMatrixWorld(true); J.parts.root ? J.parts.root.getWorldPosition(c) : c.copy(J.root.position); c.y = 2.9;
    cam.position.set(c.x + Math.sin(ang) * 13, 4.6, c.z + Math.cos(ang) * 13); cam.lookAt(c);
  });
  return { stop: W.stop, set: (m, l) => { me = m; look = l; build(); } };
}
