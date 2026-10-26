import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as GFX from 'madness-engine/gfx';
import { TownMap } from '../src/map.js';
import { placeBall } from 'madness-engine/physics';
import { startJob } from '../src/jobs.js';
import { BUBBLE, createRun, DASH, HOP, putBack, respawn, STEP, stepRun } from '../src/run.js';

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
  m.knock('cone', 3.5, 6.5).knock('flamingo', 3.5, 8.5);
  m.goldenSeed('Shiny', 2.5, 17.5);
  m.seedLine(2.5, 10, 2.5, 12, 3);
  m.flat(14, 12, 2, 2, 0.3, { surface: 'trampoline' });
  m.giver('pat', 'Pat', 3.5, 14.5);
  m.job({ id: 'fetch', giver: 'pat', title: 'Fetch', brief: 'Go there.', reward: 50, time: 6, stages: [{ type: 'go', text: 'Go', at: [3.5, 18.5] }] });
  m.job({ id: 'more', giver: 'pat', after: 'fetch', title: 'More', brief: 'And there.', reward: 70, time: 2, stages: [{ type: 'gates', text: 'Gates', points: [[8.5, 18.5], [8.5, 10.5]] }] });
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

test('knocking things flying pays, and they come back later', () => {
  const run = createRun(GFX, { map: yard() });
  const outs = roll(run, 2.5, [0, 1]);
  assert.equal(outs.flatMap((o) => o.knocked).length, 2);
  assert.equal(run.cash, 1 + 3);
  assert.ok(run.knocks.every((k) => k.down > 0));
});

test('rolling over seeds eats them, and a golden seed is found; found ones stay found', () => {
  const run = createRun(GFX, { map: yard() });
  placeBall(run.ball, 2.5, 0.4, 9);
  const outs = roll(run, 2, [0, 1]);
  assert.equal(outs.flatMap((o) => o.picked).length, 3);
  assert.equal(outs.find((o) => o.golden)?.golden.name, 'Shiny');
  assert.ok(createRun(GFX, { map: yard(), found: ['Shiny'] }).golden[0].got);
});

test('somebody with work: offered on rolling up, taken on, done against the clock, paid; then the next', () => {
  const run = createRun(GFX, { map: yard() });
  placeBall(run.ball, 2.7, 0.4, 14.5);
  const outs = roll(run, 0.5);
  const offer = outs.find((o) => o.job?.offer)?.job.offer;
  assert.equal(offer.job.id, 'fetch');
  startJob(run, offer.job);
  // The count in: held, then go.
  const go = roll(run, 3, [0, 1]);
  assert.ok(go.some((o) => o.job?.go));
  const done = roll(run, 3, [0, 1]).find((o) => o.job?.passed);
  assert.ok(done, 'done');
  assert.equal(run.cash, 50);
  assert.ok(run.board.done.has('fetch'));
  placeBall(run.ball, 2.7, 0.4, 14.5);
  assert.equal(roll(run, 0.3).find((o) => o.job?.offer)?.job.offer.job.id, 'more');
});

test('a job fails when the clock runs out, or the bubble pops', () => {
  const run = createRun(GFX, { map: yard(), done: ['fetch'] });
  startJob(run, run.board.jobs[1]);
  const outs = roll(run, 6);
  assert.equal(outs.find((o) => o.job?.failed)?.job.failed.why, 'time');
  assert.equal(run.board.active, null);
  startJob(run, run.board.jobs[1]);
  roll(run, 2.5);
  run.bubble = 1;
  placeBall(run.ball, 25, 9, 25);
  assert.equal(roll(run, 2).find((o) => o.job?.failed)?.job.failed.why, 'popped');
});

test('a hop leaves the ground; a dash goes faster and has to get its breath back', () => {
  const run = createRun(GFX, { map: yard() });
  roll(run, 0.5);
  run.act.hop = true;
  const [first] = roll(run, STEP);
  assert.ok(first.hopped);
  assert.ok(run.ball.vy > HOP * 0.8);
  roll(run, 1.5);
  const plain = createRun(GFX, { map: yard() });
  roll(plain, 0.5); roll(run, 0.5);
  run.act.dash = true;
  roll(run, DASH.time, [1, 0]);
  roll(plain, DASH.time, [1, 0]);
  assert.ok(run.ball.x > plain.ball.x + 1, 'further in a dash');
  assert.ok(run.dash.breath < 1);
  run.act.dash = true;
  assert.ok(!roll(run, STEP)[0].dashed, 'out of breath');
});

test('a trampoline throws it up, and catching it there doesn\'t hurt', () => {
  const run = createRun(GFX, { map: yard() });
  placeBall(run.ball, 15, 3, 13);
  const outs = roll(run, 3);
  assert.ok(outs.filter((o) => o.bounced).length >= 2);
  assert.equal(run.bubble, BUBBLE);
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
