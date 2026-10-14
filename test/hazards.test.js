import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as GFX from '../src/vendor/gfx/index.js';
import { createHazards, flareAt, liftAt, nodAt } from '../src/hazards.js';
import { buildMap, TownMap } from '../src/map.js';
import { createBall, placeBall } from '../src/physics.js';

test('a pumpjack nods: down on the ground for a moment, up for longer', () => {
  let down = 0, n = 0;
  for (let t = 0; t < 3.2; t += 0.01, n++) {
    const h = nodAt(t, 3.2);
    assert.ok(h >= 0 && h <= 1);
    if (h === 0) down++;
  }
  assert.equal(nodAt(0, 3.2), 0);
  assert.equal(nodAt(1.6, 3.2), 1);
  assert.ok(down / n > 0.05 && down / n < 0.3, `down ${down / n} of the time`);
});

test('a flare burns for its share of the period, and is out the rest', () => {
  let lit = 0, n = 0;
  for (let t = 0; t < 3; t += 0.005, n++) if (flareAt(t, 3, 0, 0.35) > 0) lit++;
  assert.ok(Math.abs(lit / n - 0.35) < 0.02);
  assert.equal(flareAt(2, 3, 0, 0.35), 0);
});

test('a lift waits at each end and glides between', () => {
  assert.equal(liftAt(0.1, 10, 0, 0.2), 0);
  assert.equal(liftAt(5.5, 10, 0, 0.2), 1);
  assert.ok(Math.abs(liftAt(3.5, 10, 0, 0.2) - 0.5) < 1e-9);
  assert.equal(liftAt(10.1, 10, 0, 0.2), 0, 'and round again');
});

function yard() {
  const m = new TownMap({ name: 't', cols: 40, rows: 40 });
  m.flat(0, 0, 40, 40, 0, { surface: 'concrete' });
  m.drum(10, 10, { range: 6 });
  m.flare(30, 30);
  const { world } = buildMap(m);
  return { m, world, hazards: createHazards(GFX, m, world, { killY: -8 }) };
}

test('a drum rolls after a hamster that comes near its patch, and goes home after', () => {
  const { hazards } = yard();
  const drum = hazards.drums[0].ball;
  const ball = createBall({ r: 0.36 });
  placeBall(ball, 14.5, 0.36, 10.5);
  for (let t = 0; t < 1.5; t += 1 / 120) hazards.step(1 / 120, t, ball);
  assert.ok(drum.x > 11.5, 'it came');
  // The hamster rolls off out of reach: the drum gives up and goes home.
  placeBall(ball, 35, 0.36, 10.5);
  for (let t = 0; t < 8; t += 1 / 120) hazards.step(1 / 120, t, ball);
  assert.ok(Math.hypot(drum.x - 10.5, drum.z - 10.5) < 1.2, `home again, at ${drum.x},${drum.z}`);
});

test('a burning flare catches a hamster over it; an unlit one doesn\'t', () => {
  const { hazards } = yard();
  const ball = createBall({ r: 0.36 });
  placeBall(ball, 30.5, 0.36, 30.5);
  hazards.place(0.3);
  assert.ok(hazards.step(1 / 120, 0.3, ball).burned);
  hazards.place(2);
  assert.ok(!hazards.step(1 / 120, 2, ball).burned);
});
