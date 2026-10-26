import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as GFX from 'madness-engine/gfx';
import { createPlayer, RADIUS, TINTS } from 'madness-engine/heroes/hamster';

const { player, spin, hamster, run } = createPlayer(GFX);
const body = hamster.getObjectByName('hamster-body');

test('the hamster is sculpted, all of it in finite numbers, and fits inside the ball', () => {
  const g = body.geometry;
  const p = g.attributes.position;
  assert.ok(p.count > 2000);
  for (const v of p.array) assert.ok(Number.isFinite(v));
  assert.ok(g.groups.length >= 3, 'fur, skin and eyes at least');
  hamster.updateMatrixWorld(true);
  const v = new GFX.Vector3();
  let far = 0;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(body.matrixWorld);
    far = Math.max(far, v.length());
  }
  assert.ok(far < RADIUS - 0.01, `reaches ${far.toFixed(3)} of ${RADIUS}`);
  assert.ok(far > RADIUS * 0.75, 'and fills it');
});

test('the ball turns; the hamster stays on its feet and faces where it goes', () => {
  assert.ok(player.children.includes(spin) && player.children.includes(hamster));
  assert.ok(!spin.children.some((c) => c === hamster), 'the hamster is not in the part that turns');
  for (let i = 0; i < 60; i++) run(1 / 60, 3, Math.PI / 2);
  assert.ok(Math.abs(hamster.rotation.y - Math.PI / 2) < 0.05);
  assert.equal(hamster.rotation.x, 0);
});

test('the plastic is thin and tinted, not glass', () => {
  const shell = spin.getObjectByName('shell');
  const m = shell.material;
  assert.equal(m.transmission, 1);
  assert.ok(m.thickness < 0.05, 'thin, so it hardly bends what is inside');
  assert.ok(m.roughness > 0.05);
  assert.ok(Object.values(TINTS).every((t) => /^#[0-9a-f]{6}$/.test(t)));
});
