import { linearRGB } from 'madness-engine/color';
import { model } from './models/library.js';

/**
 * The sculpted models standing about the map, drawn: every copy of a model
 * near each other merged into one mesh (turned, scaled and moved into place, its paint
 * mixed into its colours), with the night's light baked into it from the
 * lamps round about, the way it is into the ground under it.
 */
const CHUNK = 16;
const NO_SHADOW = new Set(['seed', 'shrub', 'rock', 'cone', 'tyres', 'hydrant']);

export function createPlaced(GFX, map, light) {
  const group = new GFX.Group();
  group.name = 'placed';
  // By model, and by a 16-tile square of the map, so what's out of view isn't drawn.
  const byName = new Map();
  for (const m of map.models) {
    const key = `${m.name}|${Math.floor(m.x / CHUNK)},${Math.floor(m.z / CHUNK)}`;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(m);
  }
  for (const [key, copies] of byName) group.add(mergeCopies(GFX, key.split('|')[0], copies, light));
  return group;
}

/**
 * Copies of one model — each `{ x, y, z, angle, scale, paint }` — merged into
 * one mesh: turned, scaled and moved into place, paint mixed into the
 * paint material's colours, and `light(x, y, z)` baked in.
 */
export function mergeCopies(GFX, name, copies, light) {
  const { def, data, materials } = model(GFX, name);
  const paintIndex = Object.keys(def.materials).indexOf('paint');
  // Which vertices are paint: those in the paint material's triangles.
  const isPaint = new Uint8Array(data.position.length / 3);
  for (const g of data.groups) {
    if (g.materialIndex !== paintIndex) continue;
    for (let i = g.start; i < g.start + g.count; i++) isPaint[data.index[i]] = 1;
  }
  const n = data.position.length / 3;
  const position = new Float32Array(n * 3 * copies.length);
  const normal = new Float32Array(n * 3 * copies.length);
  const color = new Float32Array(n * 3 * copies.length);
  const index = new Uint32Array(data.index.length * copies.length);
  copies.forEach((m, k) => {
    const c = Math.cos(m.angle), s = Math.sin(m.angle), sc = m.scale;
    const paint = m.paint ? linearRGB(m.paint) : null;
    const o = k * n * 3;
    for (let v = 0; v < n; v++) {
      const lx = data.position[v * 3], ly = data.position[v * 3 + 1], lz = data.position[v * 3 + 2];
      const x = m.x + (lx * c + lz * s) * sc, y = m.y + ly * sc, z = m.z + (-lx * s + lz * c) * sc;
      position[o + v * 3] = x; position[o + v * 3 + 1] = y; position[o + v * 3 + 2] = z;
      const nx = data.normal[v * 3], ny = data.normal[v * 3 + 1], nz = data.normal[v * 3 + 2];
      normal[o + v * 3] = nx * c + nz * s; normal[o + v * 3 + 1] = ny; normal[o + v * 3 + 2] = -nx * s + nz * c;
      const l = light(x, y + 0.3, z);
      for (let i = 0; i < 3; i++) {
        const tint = paint && isPaint[v] ? paint[i] : 1;
        color[o + v * 3 + i] = data.color[v * 3 + i] * tint * l[i];
      }
    }
  });
  // The triangles, material by material, every copy's together.
  const groups = [];
  let at = 0;
  for (const g of data.groups) {
    const start = at;
    copies.forEach((_, k) => {
      for (let i = g.start; i < g.start + g.count; i++) index[at++] = data.index[i] + k * n;
    });
    groups.push({ start, count: at - start, materialIndex: g.materialIndex });
  }
  const geometry = new GFX.BufferGeometry();
  geometry.setAttribute('position', new GFX.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new GFX.BufferAttribute(normal, 3));
  geometry.setAttribute('color', new GFX.BufferAttribute(color, 3));
  geometry.setIndex(new GFX.BufferAttribute(index, 1));
  for (const g of groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  geometry.computeBoundingSphere();
  const mesh = new GFX.Mesh(geometry, materials);
  mesh.name = `placed-${name}`;
  // Little things low to the ground don't throw shadows worth drawing twice.
  mesh.castShadow = !NO_SHADOW.has(name);
  mesh.receiveShadow = true;
  return mesh;
}
