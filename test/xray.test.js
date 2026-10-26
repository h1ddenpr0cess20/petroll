import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMap, TownMap } from '../src/map.js';
import { createBall, placeBall } from 'madness-engine/physics';
import { hiddenShare } from '../src/xray.js';

/** Level ground, a house-sized block in the middle, a lamp post off to one side. */
function yard() {
  const m = new TownMap({ name: 'yard', cols: 30, rows: 30 });
  m.flat(0, 0, 30, 30, 0, { surface: 'concrete' });
  m.block(12, 12, 4, 4, 3, { wall: '#ccc' });
  m.flat(4, 20, 6, 1, 0.15, { surface: 'sidewalk' });
  m.cylinder(20, 8, 0.09, 0, 3.4);
  return buildMap(m).world;
}

const ball = (x, z) => { const b = createBall({ r: 0.36 }); placeBall(b, x, 0.36, z); return b; };

test('behind a house, the ball is hidden; out in the open, or next to a kerb, it is not', () => {
  const world = yard();
  // The eye high up to the north-east, looking down past the house at a ball to its south-west.
  assert.equal(hiddenShare(world, ball(11, 17), { x: 17, y: 4, z: 11 }), 1);
  assert.equal(hiddenShare(world, ball(5, 5), { x: 11, y: 7, z: 11 }), 0);
  assert.equal(hiddenShare(world, ball(6, 19.4), { x: 12, y: 6, z: 25 }), 0, 'a kerb beside it hides nothing');
  // Low and close to a wall: only once the wall is between them.
  assert.equal(hiddenShare(world, ball(10.5, 14), { x: 7, y: 2, z: 14 }), 0, 'in front of the wall');
});

test('a lamp post across the line of sight is not enough to count as hidden', () => {
  const world = yard();
  // (The ring comes up when three rays in four are blocked.)
  assert.ok(hiddenShare(world, ball(20, 4), { x: 20, y: 3, z: 14 }) < 0.75);
});
