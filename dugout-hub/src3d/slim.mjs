// Remove animation channels that never move a bone away from its resting pose (most of the 163 bones are face/finger bones that stay still).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, quantize, meshopt, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
let removed = 0, kept = 0;
const close = (a, b, eps) => a.every((v, i) => Math.abs(v - b[i]) < eps);
for (const anim of doc.getRoot().listAnimations()) {
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode(), path = ch.getTargetPath(), s = ch.getSampler(), out = s.getOutput(), n = out.getCount(), k = out.getElementSize();
    const rest = path === 'rotation' ? node.getRotation() : path === 'translation' ? node.getTranslation() : path === 'scale' ? node.getScale() : null;
    if (!rest) { kept++; continue; }
    let still = true; const el = [];
    for (let i = 0; i < n && still; i++) { out.getElement(i, el); if (!close(el, rest, path === 'rotation' ? 1e-4 : 1e-4) && !(path === 'rotation' && close(el.map(v => -v), rest, 1e-4))) still = false; }
    if (still) { ch.dispose(); s.dispose(); removed++; } else kept++;
  }
}
console.log('channels removed', removed, 'kept', kept);
await doc.transform(resample(), prune(), dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.55, error: 0.0008 }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(process.argv[3], doc);
