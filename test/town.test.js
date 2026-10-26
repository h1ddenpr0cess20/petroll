import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as GFX from 'madness-engine/gfx';
import { isFlat } from '../src/map.js';
import { drawStructures, STRUCTURES } from '../src/structures.js';
import { SURFACES } from 'madness-engine/textures/town/surfaces';
import { COLS, createTown, ROWS } from '../src/town.js';

const town = createTown();
const inside = (s, x, y, z, r = 0) => x > s.min[0] - r && x < s.max[0] + r && y > s.min[1] - r && y < s.max[1] + r && z > s.min[2] - r && z < s.max[2] + r;

test('the town is all there: every tile laid, of a surface there is, and the same every time', () => {
  assert.equal(town.cols, COLS);
  assert.equal(town.rows, ROWS);
  assert.equal(COLS * ROWS, 2 * 128 * 128, 'twice the old town');
  for (const c of town.cells) {
    assert.ok(c, 'no holes in the map');
    assert.ok(SURFACES[c.surface], `a surface called ${c.surface}`);
    for (const h of c.h) assert.ok(Number.isFinite(h) && h > -5 && h < 12);
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

const free = (x, y, z, r = 0.1) => !town.solids.some((s) => inside(s, x, y, z, r)) && !town.cylinders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r && y > c.y0 && y < c.y1);

test('30 golden seeds, each with its own name, each somewhere on the map, in a district, and not inside anything', () => {
  assert.equal(town.golden.length, 30);
  assert.equal(new Set(town.golden.map((g) => g.name)).size, 30);
  for (const g of town.golden) {
    const y = (g.y ?? town.heightAt(g.x, g.z)) + 0.42;
    assert.notEqual(town.heightAt(g.x, g.z), null, g.name);
    assert.ok(town.districtAt(g.x, g.z), g.name);
    for (const s of town.solids) assert.ok(!inside(s, g.x, y, g.z, 0.1), `${g.name} is inside something`);
  }
  // Some in every part of town.
  const counts = new Map();
  for (const g of town.golden) counts.set(town.districtAt(g.x, g.z).name, (counts.get(town.districtAt(g.x, g.z).name) ?? 0) + 1);
  for (const d of ['Maple Grove', 'Downtown', "Gas 'n' Go", 'The Oil Field', 'The Refinery']) assert.ok(counts.get(d) >= 2, `${d} has ${counts.get(d) ?? 0}`);
  for (const d of ['Big Rig Truck Stop', 'The Drive-in', 'Crude Acres', "Baron's Hill", 'Wildcat Speedway', 'The Quarry']) assert.ok(counts.get(d) >= 1, `${d} has none`);
});

test('the seeds lie on the map, clear of anything solid', () => {
  assert.ok(town.seeds.length > 200);
  for (const s of town.seeds) {
    assert.notEqual(town.heightAt(s.x, s.z), null);
    const y = (s.y ?? town.heightAt(s.x, s.z)) + 0.32;
    for (const b of town.solids) assert.ok(!inside(b, s.x, y, s.z), `seed at ${s.x},${s.z}`);
  }
});

test('the townsfolk stand on the map, clear of anything, each with work, in a district', () => {
  assert.ok(town.givers.length >= 10);
  assert.equal(new Set(town.givers.map((g) => g.id)).size, town.givers.length);
  for (const g of town.givers) {
    const y = (g.y ?? town.heightAt(g.x, g.z)) + 0.4;
    assert.ok(free(g.x, y, g.z, 0.35), `${g.name} is inside something`);
    assert.ok(town.jobs.some((j) => j.giver === g.id), `${g.name} has nothing to do`);
    assert.ok(town.districtAt(g.x, g.z), g.name);
  }
});

test('the jobs: each its own, each from somebody, in an order that can be done, every stage of a kind there is', () => {
  const ids = new Set(town.jobs.map((j) => j.id));
  assert.equal(ids.size, town.jobs.length);
  assert.ok(town.jobs.length >= 15);
  for (const j of town.jobs) {
    assert.ok(town.givers.some((g) => g.id === j.giver), j.id);
    if (j.after) assert.ok(ids.has(j.after), `${j.id} comes after ${j.after}, which isn't a job`);
    assert.ok(j.reward > 0 && j.time > 10 && j.title && j.brief, j.id);
    for (const s of j.stages) {
      assert.ok(['go', 'gates', 'knock', 'grab', 'ram', 'tail', 'race'].includes(s.type), `${j.id}: ${s.type}`);
      assert.ok(s.text, `${j.id}: a stage says nothing`);
      for (const p of [s.at, ...(s.points ?? [])].filter(Boolean)) {
        const [x, z, yy] = p;
        assert.notEqual(town.heightAt(x, z), null, `${j.id} at ${x},${z}`);
        const y = (yy ?? town.heightAt(x, z)) + 0.4;
        assert.ok(free(x, y, z, s.type === 'knock' || s.type === 'grab' ? 0.15 : 0), `${j.id}: ${x},${z} is inside something`);
      }
      for (const [x, z] of s.route ?? []) {
        const c = town.cell(Math.floor(x), Math.floor(z));
        assert.ok(['road', 'highway', 'dirt', 'forecourt'].includes(c.surface), `${j.id} drives over ${c.surface} at ${x},${z}`);
      }
    }
  }
  // Every district has somebody with work.
  const busy = new Set(town.givers.map((g) => town.districtAt(g.x, g.z).name));
  for (const d of ['Maple Grove', 'Downtown', "Gas 'n' Go", 'The Oil Field', 'The Refinery', 'Big Rig Truck Stop', 'The Drive-in', 'Crude Acres', "Baron's Hill", 'Wildcat Speedway', 'The Quarry']) assert.ok(busy.has(d), `nobody wants anything in ${d}`);
});

test('the townsfolk and the animals about town are all in the cast', async () => {
  const { CAST } = await import('../src/cast/index.js');
  for (const g of town.givers) assert.ok(CAST[g.look], `${g.name} is a ${g.look}, who isn't in the cast`);
  for (const c of town.critters) {
    assert.ok(CAST[c.look], c.look);
    assert.notEqual(town.heightAt(c.x, c.z), null);
    assert.ok(free(c.x, (c.y ?? town.heightAt(c.x, c.z)) + 0.3, c.z), `${c.look} at ${c.x},${c.z} is inside something`);
  }
});

test('things to knock flying stand on the map, clear of anything solid and out of the road; the shops have room', () => {
  assert.ok(town.knocks.length > 30);
  for (const k of town.knocks) {
    const c = town.cell(Math.floor(k.x), Math.floor(k.z));
    assert.ok(c, `${k.kind} at ${k.x},${k.z}`);
    assert.ok(!['road', 'highway'].includes(c.surface), `${k.kind} in the road at ${k.x},${k.z}`);
    assert.ok(free(k.x, town.heightAt(k.x, k.z) + 0.3, k.z, 0.15), `${k.kind} at ${k.x},${k.z} is inside something`);
  }
  for (const s of town.shops) assert.ok(free(s.x, town.heightAt(s.x, s.z) + 0.4, s.z, 0.4), s.name);
});

test('air pumps stand on level ground with room round them', () => {
  assert.ok(town.pumps.length >= 10);
  for (const p of town.pumps) {
    const c = town.cell(Math.floor(p.x), Math.floor(p.z));
    assert.ok(isFlat(c), p.name);
    for (const s of town.solids) assert.ok(!inside(s, p.x, c.h[0] + 0.4, p.z, 0.4), `${p.name} is crowded`);
  }
});

test('a fence all the way round: nothing gets off the map', () => {
  const edges = [[0.1, 60], [COLS - 0.1, 60], [60, 0.1], [200, 0.1], [60, ROWS - 0.1], [200, ROWS - 0.1], [0.1, 0.1], [COLS - 0.1, ROWS - 0.1]];
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
  for (const p of town.props) assert.ok(STRUCTURES.includes(p.type), p.type);
  const { group } = drawStructures(GFX, town, () => [1, 1, 1]);
  let n = 0;
  group.traverse((m) => {
    const pos = m.geometry?.attributes?.position;
    if (!pos) return;
    n += pos.count;
    for (const v of pos.array) assert.ok(Number.isFinite(v));
  });
  assert.ok(n > 10000);
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
