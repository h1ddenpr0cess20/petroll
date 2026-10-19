import { model } from './models/library.js';
import { mergeCopies } from './placed.js';

/**
 * What there is to pick up, as it looks:
 *
 * - sunflower seeds, striped black and cream, lying about in lines — drawn
 *   in chunks of the map, each chunk redrawn when a seed in it is eaten;
 * - golden seeds, big, spinning, with a shaft of light going up from each
 *   so they can be seen across the town.
 *
 * (The air pumps' pads are with the jobs' things, in `jobview.js`.)
 */

const CHUNK = 16;
const SEED_SCALE = 2;

export function createPickups(GFX, run) {
  const group = new GFX.Group();
  group.name = 'pickups';
  // The seeds are lit a little more than what's round them, so they can be seen in the dark.
  const lit = run.built?.light ?? (() => [1, 1, 1]);
  const light = (x, y, z) => lit(x, y, z).map((v) => Math.max(0.85, v * 1.2));

  // Seeds, by chunk.
  const chunks = new Map();
  for (const [i, s] of run.seeds.entries()) {
    const key = `${Math.floor(s.x / CHUNK)},${Math.floor(s.z / CHUNK)}`;
    if (!chunks.has(key)) chunks.set(key, { seeds: [], mesh: null });
    chunks.get(key).seeds.push({ s, angle: (i * 2.399) % (Math.PI * 2) });
  }
  const drawChunk = (chunk) => {
    if (chunk.mesh) group.remove(chunk.mesh);
    const copies = chunk.seeds.filter(({ s }) => !s.got).map(({ s, angle }) => ({ x: s.x, y: s.y - 0.32 + 0.03 * SEED_SCALE, z: s.z, angle, scale: SEED_SCALE }));
    chunk.mesh = copies.length ? mergeCopies(GFX, 'seed', copies, light) : null;
    if (chunk.mesh) group.add(chunk.mesh);
  };
  for (const c of chunks.values()) drawChunk(c);

  // Golden seeds.
  const beamMaterial = new GFX.MeshBasicMaterial({ name: 'beam', color: new GFX.Color('#ffd760'), transparent: true, opacity: 0.16, depthWrite: false, blending: GFX.AdditiveBlending, side: GFX.DoubleSide });
  const haloMaterial = new GFX.MeshBasicMaterial({ name: 'halo', color: new GFX.Color('#ffe08a'), transparent: true, opacity: 0.3, depthWrite: false, blending: GFX.AdditiveBlending });
  const beamGeometry = new GFX.CylinderGeometry(0.16, 0.34, 14, 16, 1, true);
  beamGeometry.translate(0, 7, 0);
  const gold = model(GFX, 'goldseed');
  const golden = run.golden.map((g, i) => {
    const holder = new GFX.Group();
    holder.position.set(g.x, g.y, g.z);
    const spin = new GFX.Group();
    const seed = new GFX.Mesh(gold.geometry, gold.materials);
    seed.castShadow = true;
    seed.rotation.x = -0.5;
    spin.add(seed);
    const halo = new GFX.Mesh(new GFX.SphereGeometry(0.4, 16, 12), haloMaterial);
    const beam = new GFX.Mesh(beamGeometry, beamMaterial);
    beam.position.y = -0.3;
    holder.add(spin, halo, beam);
    holder.visible = !g.got;
    group.add(holder);
    return { g, holder, spin, halo, phase: i * 0.7 };
  });

  return {
    group,
    /** A seed was eaten: redraw its chunk. */
    eaten(s) {
      const c = chunks.get(`${Math.floor(s.x / CHUNK)},${Math.floor(s.z / CHUNK)}`);
      if (c) drawChunk(c);
    },
    sync(dt, time) {
      for (const o of golden) {
        o.holder.visible = !o.g.got;
        if (o.g.got) continue;
        o.spin.rotation.y = time * 1.8 + o.phase;
        o.spin.position.y = Math.sin(time * 2.2 + o.phase) * 0.06;
        const k = 1 + Math.sin(time * 4 + o.phase) * 0.1;
        o.halo.scale.setScalar(k);
      }
    },
  };
}
