import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as GFX from '../src/vendor/gfx/index.js';
import { TownMap } from '../src/map.js';
import { placeBall } from '../src/physics.js';
import { BUBBLE, createRun, putBack, respawn, STEP, stepRun } from '../src/run.js';

/** A little test yard: level ground, a tar pit, a pump, a flare, a pumpjack, a tower to fall off, a road. */
function yard() {
  const m = new TownMap({ name: 'yard', cols: 40, rows: 30 });
  m.flat(0, 0, 40, 30, 0, { surface: 'concrete' });
  m.start = { x: 3, z: 3 };
  m.flat(10, 2, 3, 3, -0.6, { surface: 'tar' });
  m.flat(20, 2, 2, 2, 6, { surface: 'concrete' });
  m.airPump('Yard', 5.5, 10.5);
  m.flare(30, 3);
  m.pumpjack(30, 12, { period: 3 });
  m.flat(0, 20, 40, 4, 0, { surface: 'road' });
  m.road([[1, 22], [39, 22]], { cars: 1, speed: 6, open: true, brakes: false });
  m.goldenSeed('Shiny', 3.5, 14.5);
  m.seedLine(3.5, 6, 3.5, 8, 3);
  m.district('Yard', 0, 0, 40, 30, '#888');
  return m;
}

const roll = (run, seconds, push = [0, 0]) => {
  const outs = [];
  for (let t = 0; t < seconds; t += STEP) outs.push(stepRun(run, push));
  return outs;
};

test('it starts whole, at the start, and knows where it is', () => {
  const run = createRun(GFX, { map: yard() });
  assert.equal(run.bubble, BUBBLE);
  const outs = roll(run, 0.5);
  assert.equal(outs.find((o) => o.district)?.district.name, 'Yard');
  assert.ok(Math.abs(run.ball.x - 3.5) < 0.01);
});

test('rolling over seeds eats them, and a golden seed is found', () => {
  const run = createRun(GFX, { map: yard() });
  const outs = roll(run, 3, [0, 1]);
  assert.equal(outs.flatMap((o) => o.picked).length, 3);
  assert.equal(outs.find((o) => o.golden)?.golden.name, 'Shiny');
  assert.ok(run.golden[0].got);
});

test('golden seeds already found stay found', () => {
  const run = createRun(GFX, { map: yard(), found: ['Shiny'] });
  assert.ok(run.golden[0].got);
});

test('a hard landing cracks the bubble; a long drop pops it more than a short one', () => {
  const hurt = (y) => {
    const run = createRun(GFX, { map: yard() });
    placeBall(run.ball, 25, y, 25);
    return roll(run, 2).reduce((n, o) => n + o.hurt, 0);
  };
  assert.equal(hurt(1.5), 0, 'a little drop is nothing');
  assert.ok(hurt(4) > 0);
  assert.ok(hurt(9) > hurt(5));
});

test('the air pump tops the bubble up and is where it comes back to', () => {
  const run = createRun(GFX, { map: yard() });
  run.bubble = 30;
  placeBall(run.ball, 5.5, 0.4, 10.5);
  const outs = roll(run, 0.3);
  assert.ok(outs.some((o) => o.pumped));
  assert.equal(run.bubble, BUBBLE);
  placeBall(run.ball, 30, 0.4, 25);
  run.bubble = 0;
  respawn(run);
  assert.ok(Math.hypot(run.ball.x - 5.5, run.ball.z - 10.5) < 0.01);
  assert.equal(run.bubble, BUBBLE);
});

test('tar swallows it, and it goes back to the last firm ground', () => {
  const run = createRun(GFX, { map: yard() });
  placeBall(run.ball, 6.5, 0.4, 3.5);
  const outs = roll(run, 4, [1, 0]);
  assert.equal(outs.find((o) => o.outcome)?.outcome, 'sunk');
  putBack(run);
  assert.ok(run.ball.x < 10, 'back on firm ground');
  assert.ok(run.map.isSafe(Math.floor(run.ball.x), Math.floor(run.ball.z)));
});

test('a gas flare burns it and throws it up', () => {
  const run = createRun(GFX, { map: yard() });
  placeBall(run.ball, 30.5, 0.36, 3.5);
  run.time = 2.9;
  const outs = roll(run, 0.5);
  const hit = outs.find((o) => o.hits.includes('flare'));
  assert.ok(hit, 'burned');
  assert.ok(run.bubble < BUBBLE && run.bubble > 0);
});

test('a pumpjack coming down on it pops it outright', () => {
  const run = createRun(GFX, { map: yard() });
  placeBall(run.ball, 30.5, 0.36, 12.5);
  // Half way through its nod the head is at the top, about to come down.
  run.time = 1.5;
  const outs = roll(run, 2);
  assert.equal(outs.find((o) => o.outcome)?.outcome, 'squashed');
});

test('a car knocks it about and cracks the bubble', () => {
  const run = createRun(GFX, { map: yard() });
  const car = run.traffic.cars[0];
  placeBall(run.ball, car.x + 3, 0.36, 22);
  const outs = roll(run, 1.5);
  assert.ok(outs.some((o) => o.hits.includes('car')), 'hit');
  assert.ok(run.ball.x > car.x, 'shoved along ahead of it');
  assert.ok(run.bubble < BUBBLE);
});

test('enough knocks and it pops', () => {
  const run = createRun(GFX, { map: yard() });
  run.bubble = 5;
  placeBall(run.ball, 25, 8, 25);
  const outs = roll(run, 2);
  assert.equal(outs.find((o) => o.outcome)?.outcome, 'popped');
});
