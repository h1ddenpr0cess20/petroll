import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as GFX from '../src/vendor/gfx/index.js';
import { buildMap, TownMap } from '../src/map.js';
import { createBall, placeBall } from '../src/physics.js';
import { createTown } from '../src/town.js';
import { along, createTraffic, roundedPath } from '../src/traffic.js';

test('a loop with its corners rounded off: shorter than the square, and closed', () => {
  const p = roundedPath([[0, 0], [10, 0], [10, 10], [0, 10]], { round: 2 });
  assert.ok(p.length < 40 && p.length > 36);
  const a = along(p, 0), b = along(p, p.length);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
  // Heading round a corner turns from +x to +z.
  const before = along(p, 7), after = along(p, 13);
  assert.ok(before.dx > 0.99 && after.dz > 0.99);
});

test('an open road is a line, its ends where they were', () => {
  const p = roundedPath([[0, -3], [0, 50]], { open: true });
  assert.equal(p.length, 53);
  assert.deepEqual([along(p, 0).x, along(p, 0).z], [0, -3]);
});

test('the town traffic keeps moving, and nothing drives into anything', () => {
  const town = createTown();
  const { world } = buildMap(town);
  const traffic = createTraffic(GFX, town, world);
  const moved = new Map(traffic.cars.map((c) => [c, 0]));
  let worst = Infinity;
  for (let i = 0; i < 120 * 60; i++) {
    for (const c of traffic.cars) moved.set(c, moved.get(c) + c.v / 120);
    traffic.step(1 / 120, null);
    if (i % 12) continue;
    // Cars on the same road never end up inside each other.
    for (const a of traffic.cars) {
      for (const b of traffic.cars) {
        if (a.id >= b.id || a.road !== b.road) continue;
        worst = Math.min(worst, Math.hypot(a.x - b.x, a.z - b.z) - (a.size.length + b.size.length) / 2);
      }
    }
  }
  for (const [c, d] of moved) assert.ok(d > 60, `a ${c.kind} on road ${town.roads.indexOf(c.road)} only went ${d.toFixed(0)} tiles in a minute`);
  assert.ok(worst > -0.2, `cars overlapped by ${-worst}`);
});

test('a town car brakes for a hamster in the road and honks; nothing on the interstate does', () => {
  const m = new TownMap({ name: 't', cols: 40, rows: 10 });
  m.flat(0, 0, 40, 10, 0, { surface: 'road' });
  m.road([[2, 5], [38, 5]], { cars: 1, speed: 5, open: true });
  m.road([[2, 7], [38, 7]], { cars: 1, speed: 5, open: true, brakes: false });
  const { world } = buildMap(m);
  const traffic = createTraffic(GFX, m, world);
  const ball = createBall({ r: 0.36 });
  placeBall(ball, 9, 0.36, 5);
  let honked = 0;
  for (let i = 0; i < 240; i++) honked += traffic.step(1 / 120, ball).length;
  const [town, highway] = traffic.cars;
  assert.ok(town.x < 9 - 1.2, `stopped short, at ${town.x}`);
  assert.ok(town.v < 0.5);
  assert.equal(honked, 1);
  placeBall(ball, 14, 0.36, 7);
  for (let i = 0; i < 120; i++) traffic.step(1 / 120, ball);
  assert.ok(highway.v > 4.9, 'the interstate never slows');
});
