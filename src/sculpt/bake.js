import { build, Sculpt } from './sdf.js';

/**
 * A sculpt (`sdf.js`, from Metroll's model kit) baked into one geometry:
 * each part meshed on its own grid, the triangles grouped by material, and
 * the materials made from `materials` ({ name: physical material options };
 * the vertex colours give the colour). Baked once per definition.
 */

const cache = new Map();

export function bake(GFX, { name, sculpt, materials, cell = 0.008, cells = {} }) {
  if (cache.has(name)) return cache.get(name);
  const s = new Sculpt();
  sculpt(s);
  const names = Object.keys(materials);
  const buckets = names.map(() => []);
  const chunks = [];
  let base = 0;
  for (const [part, shapes] of s.split()) {
    const m = build(shapes, { cell: cells[part] ?? cell, bones: ['root'], ambient: 0.32 });
    chunks.push(m);
    for (let t = 0; t < m.index.length; t += 3) {
      const a = m.mats[m.index[t]], b = m.mats[m.index[t + 1]], c = m.mats[m.index[t + 2]];
      const mi = Math.max(0, names.indexOf(b === c ? b : a));
      buckets[mi].push(m.index[t] + base, m.index[t + 1] + base, m.index[t + 2] + base);
    }
    base += m.count;
  }
  const join = (field) => {
    const out = new Float32Array(base * 3);
    let o = 0;
    for (const c of chunks) { out.set(c[field], o); o += c.count * 3; }
    return out;
  };
  const g = new GFX.BufferGeometry();
  g.setAttribute('position', new GFX.BufferAttribute(join('position'), 3));
  g.setAttribute('normal', new GFX.BufferAttribute(join('normal'), 3));
  g.setAttribute('color', new GFX.BufferAttribute(join('color'), 3));
  const index = new Uint32Array(buckets.reduce((n, b) => n + b.length, 0));
  let start = 0;
  buckets.forEach((b, materialIndex) => {
    if (!b.length) return;
    index.set(b, start);
    g.addGroup(start, b.length, materialIndex);
    start += b.length;
  });
  g.setIndex(new GFX.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  const mats = names.map((n) => new GFX.MeshPhysicalMaterial({ name: `${name}-${n}`, vertexColors: true, roughness: 0.6, ...materials[n] }));
  const out = { geometry: g, materials: mats };
  cache.set(name, out);
  return out;
}
