import { createKit } from './kit.js';

/**
 * What there is to pick up, as it looks:
 *
 * - sunflower seeds, striped black and cream, lying about in lines — drawn
 *   in chunks of the map, each chunk redrawn when a seed in it is eaten;
 * - golden seeds, big, spinning, with a shaft of light going up from each
 *   so they can be seen across the town;
 * - air pumps, red, with AIR on them and a coiled hose: where the bubble is
 *   topped up.
 */

const CHUNK = 16;

/** One sunflower seed into a kit: a teardrop, pointed at +z, striped. */
function seed(k, x, y, z, turn, size = 1, gold = false) {
  const body = gold ? '#f2c230' : '#2a2624';
  const stripe = gold ? '#fff2b0' : '#efe6d2';
  const finish = gold ? 'shiny' : 'matte';
  const s = size;
  k.sphere([x, y, z], 0.1 * s, body, { scale: [0.62, 0.42, 1.25], rot: [0, turn, 0], finish });
  k.sphere([x + Math.sin(turn) * 0.1 * s, y, z + Math.cos(turn) * 0.1 * s], 0.06 * s, body, { scale: [0.6, 0.42, 1.3], rot: [0, turn, 0], finish });
  for (const o of [-0.035, 0.035]) {
    const ox = Math.cos(turn) * o * s, oz = -Math.sin(turn) * o * s;
    k.box([x + ox, y + 0.028 * s, z + oz], [0.012 * s, 0.03 * s, 0.2 * s], stripe, { rot: [0, turn, 0], finish });
  }
}

export function createPickups(GFX, run) {
  const group = new GFX.Group();
  group.name = 'pickups';

  // Seeds, by chunk.
  const chunks = new Map();
  for (const [i, s] of run.seeds.entries()) {
    const key = `${Math.floor(s.x / CHUNK)},${Math.floor(s.z / CHUNK)}`;
    if (!chunks.has(key)) chunks.set(key, { seeds: [], mesh: null });
    chunks.get(key).seeds.push({ s, turn: (i * 2.399) % (Math.PI * 2) });
  }
  const drawChunk = (chunk) => {
    if (chunk.mesh) group.remove(chunk.mesh);
    const k = createKit(GFX);
    for (const { s, turn } of chunk.seeds) if (!s.got) seed(k, s.x, s.y - 0.2, s.z, turn, 0.95);
    chunk.mesh = k.empty ? null : k.build({ name: 'seeds', castShadow: true });
    if (chunk.mesh) group.add(chunk.mesh);
  };
  for (const c of chunks.values()) drawChunk(c);

  // Golden seeds.
  const beamMaterial = new GFX.MeshBasicMaterial({ name: 'beam', color: new GFX.Color('#ffd760'), transparent: true, opacity: 0.16, depthWrite: false, blending: GFX.AdditiveBlending, side: GFX.DoubleSide });
  const haloMaterial = new GFX.MeshBasicMaterial({ name: 'halo', color: new GFX.Color('#ffe08a'), transparent: true, opacity: 0.35, depthWrite: false, blending: GFX.AdditiveBlending });
  const beamGeometry = new GFX.CylinderGeometry(0.16, 0.34, 14, 16, 1, true);
  beamGeometry.translate(0, 7, 0);
  const goldKit = createKit(GFX);
  seed(goldKit, 0, 0, 0, 0, 2.6, true);
  const goldLook = goldKit.geometries();
  const golden = run.golden.map((g, i) => {
    const holder = new GFX.Group();
    holder.position.set(g.x, g.y, g.z);
    const spin = new GFX.Group();
    for (const [finish, geom] of Object.entries(goldLook)) {
      const m = new GFX.Mesh(geom, new GFX.MeshPhysicalMaterial({ name: 'gold', vertexColors: true, roughness: 0.18, metalness: 1, clearcoat: 1, emissive: new GFX.Color('#a06a10'), emissiveIntensity: 0.35 }));
      m.castShadow = true;
      void finish;
      spin.add(m);
    }
    spin.rotation.x = -0.5;
    const halo = new GFX.Mesh(new GFX.SphereGeometry(0.38, 16, 12), haloMaterial);
    const beam = new GFX.Mesh(beamGeometry, beamMaterial);
    beam.position.y = -0.3;
    holder.add(spin, halo, beam);
    holder.visible = !g.got;
    group.add(holder);
    return { g, holder, spin, halo, phase: i * 0.7 };
  });

  // Air pumps.
  const pumpKit = createKit(GFX);
  for (const p of run.pumps) {
    const x = p.x + 0.55, z = p.z - 0.55, y = p.y;
    pumpKit.box([x, y + 0.55, z], [0.4, 1.1, 0.3], '#c8382c', { finish: 'shiny' });
    pumpKit.box([x, y + 1.14, z], [0.44, 0.08, 0.34], '#e8e2d6');
    pumpKit.box([x, y + 0.82, z + 0.152], [0.3, 0.18, 0.01], '#f4f1ea', { finish: 'glow' });
    pumpKit.cyl([x, y + 0.62, z + 0.16], 0.07, 0.03, '#f4f1ea', { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 3; i++) pumpKit.torus([x - 0.24, y + 0.35 + i * 0.05, z], 0.1, 0.018, '#18181b', { rot: [Math.PI / 2, 0, 0] });
    pumpKit.cyl([p.x, y + 0.01, p.z], 0.62, 0.02, '#f2c230', { segments: 24 });
    pumpKit.cyl([p.x, y + 0.02, p.z], 0.5, 0.02, '#d8d2c4', { segments: 24 });
    pumpKit.cyl([p.x, y + 0.03, p.z], 0.2, 0.02, '#c8382c', { segments: 16 });
  }
  if (!pumpKit.empty) group.add(pumpKit.build({ name: 'air-pumps' }));

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
