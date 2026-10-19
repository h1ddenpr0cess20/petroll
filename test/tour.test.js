import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as GFX from '../src/vendor/gfx/index.js';
import { createRun } from '../src/run.js';
import { drive } from './helpers/autopilot.js';
import { doJob } from './helpers/jobpilot.js';
import { TOUR } from './helpers/tour.js';

test('the autopilot does every job in town against the clock, with time to spare, without the bubble popping', () => {
  const run = createRun(GFX);
  for (const job of run.board.jobs) {
    const r = doJob(run, job);
    assert.ok(r.passed, `${job.id}: ${JSON.stringify({ ...r, hurts: undefined })}`);
    // Room for somebody who doesn't know the way as well.
    assert.ok(r.time < job.time * 0.85, `${job.id} took ${r.time.toFixed(1)}s of ${job.time}`);
    assert.ok(!r.hurts.some((h) => h.hurt >= 100), `${job.id}: popped`);
  }
  assert.equal(run.board.done.size, run.board.jobs.length);
  // Paid for every one (and maybe a little loose change from what it knocked over on the way).
  assert.ok(run.cash >= run.board.jobs.reduce((n, j) => n + j.reward, 0));
});

test('the autopilot finds every golden seed in one go, without the bubble popping', () => {
  const result = drive(TOUR);
  assert.ok(result.finished, `stuck: ${JSON.stringify(result.stuck)}`);
  assert.equal(result.losses.length, 0, JSON.stringify(result.losses));
  const golden = result.run.golden.map((g) => g.name);
  assert.deepEqual([...result.found].sort(), [...golden].sort());
  for (const leg of TOUR.filter((l) => l.expect)) assert.ok(result.found.includes(leg.expect), leg.expect);
  assert.ok(result.time < 1300, `took ${result.time.toFixed(0)}s`);
});
