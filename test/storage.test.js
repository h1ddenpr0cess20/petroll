import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createStorage } from '../src/storage.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};
const EMPTY = { done: [], cash: 0, owned: [], tint: 'tint:blue', pump: null, time: 0 };

test('remembers the jobs done, the cash, what was bought and worn, the last pump and the time', () => {
  const store = memory();
  const s = createStorage(store);
  assert.deepEqual(s.load(), EMPTY);
  s.progress({ done: ['paper', 'signs', 'paper'], cash: 250, pump: 'Downtown', time: 120 });
  s.progress({ owned: ['tint:pink'], tint: 'tint:pink' });
  const again = createStorage(store).load();
  assert.deepEqual(again.done, ['paper', 'signs']);
  assert.equal(again.cash, 250);
  assert.deepEqual(again.owned, ['tint:pink']);
  assert.equal(again.tint, 'tint:pink');
  assert.equal(again.pump, 'Downtown');
  assert.equal(again.time, 120);
  assert.deepEqual(createStorage(store).clear(), EMPTY);
});

test('plays on without storage, or with storage that throws or holds rubbish', () => {
  assert.deepEqual(createStorage(null).load(), EMPTY);
  const angry = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  assert.equal(createStorage(angry).progress({ cash: 10 }).cash, 10);
  assert.deepEqual(createStorage({ getItem: () => '{nope', setItem() {} }).load().done, []);
  assert.deepEqual(createStorage({ getItem: () => '{"done":"lots","time":-4,"cash":"x","pump":3,"owned":[1,"a"]}', setItem() {} }).load(), { ...EMPTY, owned: ['a'] });
});
