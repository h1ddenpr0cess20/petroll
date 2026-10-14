import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMap, linearRGB, TownMap } from '../src/map.js';

const map = (cols = 10, rows = 10) => new TownMap({ name: 't', cols, rows });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('heights: on the corners, and in between on a slope', () => {
  const c = map();
  c.slope(2, 2, 4, 2, 8, 4, 'x');
  assert.ok(near(c.heightAt(2, 3), 8));
  assert.ok(near(c.heightAt(5.999, 3), 4.001));
  assert.ok(near(c.heightAt(4, 2.5), 6));
  assert.ok(near(c.heightAt(3.25, 3.75), 6.75));
  assert.equal(c.heightAt(1.5, 3), null);
  assert.equal(c.heightAt(6.5, 3), null);
});

test('tiles off the map are refused', () => {
  assert.throws(() => map(4, 4).flat(3, 3, 2, 1, 0), /off the map/);
});

test('every face is a finite triangle; tops face up, grouped by surface; walls face out', () => {
  const c = map(6, 6);
  c.flat(2, 2, 1, 1, 3, { surface: 'road' });
  c.flat(3, 2, 1, 1, 3, { surface: 'grass' });
  const { tops, walls, world } = buildMap(c);
  assert.deepEqual([...tops.keys()].sort(), ['grass', 'road']);
  for (const t of tops.values()) {
    assert.equal(t.position.length, 2 * 9);
    for (let i = 1; i < t.normal.length; i += 3) assert.equal(t.normal[i], 1);
    for (const v of [...t.position, ...t.uv]) assert.ok(Number.isFinite(v));
  }
  // Two tiles side by side: six sides out, two triangles each, each facing away from the pair.
  assert.equal(walls.position.length / 9, 12);
  for (let t = 0; t < walls.position.length / 9; t++) {
    const p = walls.position.slice(t * 9, t * 9 + 9);
    const cx = (p[0] + p[3] + p[6]) / 3 - 3, cz = (p[2] + p[5] + p[8]) / 3 - 2.5;
    const n = walls.normal.slice(t * 9, t * 9 + 3);
    assert.ok(cx * n[0] + cz * n[2] > 0, 'faces out');
    assert.ok(Math.abs(n[1]) < 1e-9, 'and is upright');
  }
  assert.equal(world.triangles.length / 9, 16);
});

test('a curb has one wall, on the high side, facing the low one', () => {
  const c = map(6, 3);
  c.flat(1, 1, 2, 1, 0.15, { surface: 'sidewalk' }).flat(3, 1, 2, 1, 0, { surface: 'road' });
  const { walls } = buildMap(c);
  const between = [];
  for (let t = 0; t < walls.position.length / 9; t++) {
    const p = walls.position.slice(t * 9, t * 9 + 9);
    if ([p[0], p[3], p[6]].every((x) => x === 3)) between.push(walls.normal.slice(t * 9, t * 9 + 3));
  }
  assert.equal(between.length, 2);
  for (const n of between) assert.deepEqual([...n].map((v) => v + 0), [1, 0, 0]);
});

test('a pitched roof rises to its ridge and comes down to the walls each side', () => {
  const c = map(12, 12);
  c.block(2, 2, 4, 6, 2, { roof: 'pitched', ridge: 'z', pitch: 1 });
  assert.ok(near(c.heightAt(2.01, 5), 2.005, 0.01));
  assert.ok(near(c.heightAt(4, 5), 3));
  assert.ok(near(c.heightAt(5.99, 5), 2.005, 0.01));
  assert.equal(c.cell(3, 3).surface, 'roof');
});

test('painting a surface keeps the heights; raising moves them', () => {
  const c = map();
  c.slope(1, 1, 3, 3, 2, 0, 'z');
  const before = c.cell(2, 2).h.slice();
  c.paint(1, 1, 3, 3, 'oil');
  assert.deepEqual(c.cell(2, 2).h, before);
  assert.equal(c.cell(2, 2).surface, 'oil');
  c.raise(2, 2, 1, 1, 1);
  assert.deepEqual(c.cell(2, 2).h, before.map((v) => v + 1));
});

test('safe ground: level, firm, level all round, nothing standing on it', () => {
  const c = map(12, 12);
  c.flat(1, 1, 10, 10, 0);
  c.flat(5, 3, 1, 1, 0.5);
  c.flat(8, 8, 1, 1, 0, { surface: 'tar' });
  c.solid(2.2, 0, 7.2, 2.8, 1, 7.8);
  assert.ok(c.isSafe(2, 2));
  assert.ok(!c.isSafe(1, 1), 'at the edge');
  assert.ok(!c.isSafe(4, 3), 'next to a bump');
  assert.ok(!c.isSafe(8, 7), 'next to the tar');
  assert.ok(!c.isSafe(2, 7), 'under a post');
  assert.ok(!c.isSafe(0, 0), 'off the map');
});

test('the top of things: a deck over the ground counts, unless asked for below it', () => {
  const c = map();
  c.flat(0, 0, 10, 10, 0);
  c.deck(2, 2, 4, 2, 2.5);
  assert.equal(c.topAt(3, 3), 2.5);
  assert.equal(c.topAt(3, 3, 1), 0);
  assert.equal(c.topAt(8, 8), 0);
});

test('districts: where a point is', () => {
  const c = map(20, 20);
  c.district('North', 0, 0, 20, 10, '#fff').district('South', 0, 10, 20, 10, '#000');
  assert.equal(c.districtAt(5, 5).name, 'North');
  assert.equal(c.districtAt(5, 15).name, 'South');
  assert.equal(c.districtAt(25, 5), null);
});

test('colours are linear', () => {
  assert.deepEqual(linearRGB('#ffffff'), [1, 1, 1]);
  assert.deepEqual(linearRGB('#000000'), [0, 0, 0]);
  assert.ok(Math.abs(linearRGB('#808080')[0] - 0.2158605) < 1e-6);
});
