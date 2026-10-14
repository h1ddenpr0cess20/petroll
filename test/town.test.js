import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as GFX from '../src/vendor/gfx/index.js';
import { createKit } from '../src/kit.js';
import { isFlat } from '../src/map.js';
import { drawProps, PROP_TYPES } from '../src/props.js';
import { SURFACES } from '../src/surfaces.js';
import { createTown, SIZE } from '../src/town.js';

const town = createTown();
const inside = (s, x, y, z, r = 0) => x > s.min[0] - r && x < s.max[0] + r && y > s.min[1] - r && y < s.max[1] + r && z > s.min[2] - r && z < s.max[2] + r;

test('the town is all there: every tile laid, of a surface there is, and the same every time', () => {
  assert.equal(town.cols, SIZE);
  for (const c of town.cells) {
    assert.ok(c, 'no holes in the map');
    assert.ok(SURFACES[c.surface], `a surface called ${c.surface}`);
    for (const h of c.h) assert.ok(Number.isFinite(h) && h > -2 && h < 12);
  }
  const again = createTown();
  assert.deepEqual(again.cells.map((c) => c.h), town.cells.map((c) => c.h));
});

test('it starts on safe ground at home, with an air pump in the garden', () => {
  assert.ok(town.isSafe(town.start.x, town.start.z));
  assert.equal(town.districtAt(town.start.x, town.start.z).name, 'Maple Grove');
  const home = town.pumps.find((p) => p.name === 'Home');
  assert.ok(Math.hypot(home.x - town.start.x, home.z - town.start.z) < 6);
});

test('22 golden seeds, each with its own name, each somewhere on the map and not inside anything', () => {
  assert.equal(town.golden.length, 22);
  assert.equal(new Set(town.golden.map((g) => g.name)).size, 22);
  for (const g of town.golden) {
    const y = (g.y ?? town.heightAt(g.x, g.z)) + 0.42;
    assert.notEqual(town.heightAt(g.x, g.z), null, g.name);
    for (const s of town.solids) assert.ok(!inside(s, g.x, y, g.z, 0.1), `${g.name} is inside something`);
  }
});

test('every district has golden seeds in it, and every golden seed is in a district', () => {
  for (const g of town.golden) assert.ok(town.districtAt(g.x, g.z), g.name);
  const counts = new Map();
  for (const g of town.golden) {
    const d = town.districtAt(g.x, g.z).name;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  for (const d of ['Maple Grove', 'Downtown', "Gas 'n' Go", 'The Oil Field', 'The Refinery']) assert.ok(counts.get(d) >= 2, `${d} has ${counts.get(d) ?? 0}`);
});

test('the seeds lie on the map, clear of anything solid', () => {
  assert.ok(town.seeds.length > 150);
  for (const s of town.seeds) {
    assert.notEqual(town.heightAt(s.x, s.z), null);
    const y = (s.y ?? town.heightAt(s.x, s.z)) + 0.32;
    for (const b of town.solids) assert.ok(!inside(b, s.x, y, s.z), `seed at ${s.x},${s.z}`);
  }
});

test('air pumps stand on level ground with room round them', () => {
  assert.ok(town.pumps.length >= 5);
  for (const p of town.pumps) {
    const c = town.cell(Math.floor(p.x), Math.floor(p.z));
    assert.ok(isFlat(c), p.name);
    for (const s of town.solids) assert.ok(!inside(s, p.x, c.h[0] + 0.4, p.z, 0.4), `${p.name} is crowded`);
  }
});

test('a fence all the way round: nothing gets off the map', () => {
  const edges = [[0.1, 60], [SIZE - 0.1, 60], [60, 0.1], [60, SIZE - 0.1], [0.1, 0.1]];
  for (const [x, z] of edges) {
    const y = town.heightAt(x, z) + 0.5;
    assert.ok(town.solids.some((s) => inside(s, x, y, z)), `no fence at ${x},${z}`);
  }
});

test('the traffic drives on roads', () => {
  const roadish = new Set(['road', 'highway', 'dirt', 'forecourt', 'concrete']);
  for (const r of town.roads) {
    for (const [x, z] of r.points) {
      const c = town.cell(Math.floor(x), Math.floor(z));
      if (r.open && !c) continue;
      assert.ok(roadish.has(c.surface), `a ${r.kind} loop goes over ${c.surface} at ${x},${z}`);
    }
  }
});

test('pumpjacks nod over their own pads; flares, lifts and drums are on the map', () => {
  for (const p of town.pumpjacks) {
    const c = town.cell(p.x, p.z);
    assert.ok(isFlat(c), `pumpjack at ${p.x},${p.z} on a slope`);
    assert.equal(c.surface, 'gravel');
  }
  for (const f of town.flares) assert.notEqual(town.heightAt(f.x + 0.5, f.z + 0.5), null);
  for (const d of town.drums) assert.notEqual(town.heightAt(d.x, d.z), null);
  for (const l of town.lifts) assert.ok(l.period > 0 && l.to.some((v) => v !== 0));
});

test('every prop is one that can be drawn, and draws', () => {
  for (const p of town.props) assert.ok(PROP_TYPES.includes(p.type), p.type);
  const kit = createKit(GFX);
  drawProps(GFX, kit, town);
  const g = kit.geometries();
  for (const geometry of Object.values(g)) {
    for (const v of geometry.attributes.position.array) assert.ok(Number.isFinite(v));
  }
  assert.ok(g.matte.attributes.position.count > 10000);
});

test('nothing solid stands in the road', () => {
  const road = (x, z) => ['road', 'highway'].includes(town.cell(Math.floor(x), Math.floor(z))?.surface);
  for (const m of town.models) {
    if (['sedan', 'hatchback', 'pickup', 'junker'].includes(m.name)) continue;
    assert.ok(!road(m.x, m.z), `${m.name} at ${m.x},${m.z}`);
  }
  for (const c of town.cylinders) assert.ok(!road(c.x, c.z) || c.y0 > 2, `post at ${c.x},${c.z}`);
  // Solids over the road only up out of the traffic's way (a footbridge's railings), or the tunnel mouths and the barrier at the ends.
  for (const s of town.solids) {
    const cx = (s.min[0] + s.max[0]) / 2, cz = (s.min[2] + s.max[2]) / 2;
    // (A wall along the road's edge, on the line between the tiles, isn't in it.)
    const inside = [[s.min[0] + 0.01, s.min[2] + 0.01], [s.max[0] - 0.01, s.max[2] - 0.01]].every(([x, z]) => road(x, z));
    if (!inside || s.min[1] >= 2) continue;
    assert.ok(s.max[2] <= 4 || s.min[2] >= town.rows - 4, `solid at ${cx},${cz}`);
  }
});
