import { TownMap } from './map.js';

/**
 * The whole world, one map: Petroleum Springs. No levels — it is all there
 * from the start, and the hamster can roll anywhere it can get to.
 *
 *   Maple Grove   the suburbs, north-west: lawns, houses, a drained pool,
 *                 a hedge maze, a skate park. Home is here.
 *   Downtown      north, in the middle: office towers and the alley behind
 *                 them, a parking garage, the plaza, a building site.
 *   Gas 'n' Go    the filling station at the east end of the avenue, with a
 *                 car wash, a footbridge over the interstate and a billboard
 *                 on the hill beyond.
 *   Interstate    the highway down the east side, trucks and tankers in
 *                 both directions, a barrier down the middle.
 *   The Oil Field south-east: rolling dirt, pumpjacks nodding, a pipeline
 *                 to roll along, a derrick, a tar pit, a barrel yard.
 *   The Refinery  south-west: tanks, catwalks, a lift, an alley where the
 *                 gas flares up out of the floor.
 *
 * Traffic drives round the town on the right. x runs to the right of the
 * map, z down it; the map is 128 tiles each way and a ring of grassy bank
 * keeps everything on it.
 */

export const SIZE = 128;
const CURB = 0.15;

/** The bank round the edge: up from nothing five tiles in to two and a half high at the very edge, a fence along the top. */
const berm = (X, Z) => {
  const d = Math.min(X, Z, SIZE - X, SIZE - Z);
  return d < 5 ? (5 - d) * 0.5 : 0;
};

/** The oil field: rolling ground, fading out to level at its edges, flattened under the pads. */
const FIELD = { x0: 42, z0: 58, x1: 108, z1: 124 };
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const pads = [];

function hills(X, Z) {
  const fade = Math.min(smooth((X - FIELD.x0) / 7), smooth((FIELD.x1 - X) / 7), smooth((Z - FIELD.z0) / 7), smooth((FIELD.z1 - Z) / 7));
  if (fade <= 0) return 0;
  let h = 1.0 + 0.75 * Math.sin(X / 6.3) * Math.cos(Z / 7.7) + 0.45 * Math.sin((X + 2 * Z) / 12.5);
  // Slick Hill: a mound in the west of the field.
  const r = Math.hypot(X - 60.5, Z - 84.5);
  if (r < 6) h += 2.6 * smooth(1 - r / 6);
  return Math.max(0, h) * fade;
}

function ground(X, Z) {
  let h = hills(X, Z);
  // Pads: level where something stands, blending back into the hills over two tiles.
  let best = 0, padH = 0;
  for (const p of pads) {
    const dx = Math.max(p.x - X, 0, X - (p.x + p.w)), dz = Math.max(p.z - Z, 0, Z - (p.z + p.d));
    const w = 1 - Math.max(dx, dz) / 2;
    if (w > best) { best = w; padH = p.h; }
  }
  if (best > 0) h = h + (padH - h) * smooth(best);
  return Math.max(h, berm(X, Z));
}

/** A level pad in the oil field at the height of the ground under its middle (see `settle`). */
function pad(x, z, w, d) {
  const p = { x, z, w, d, h: hills(x + w / 2, z + d / 2) };
  pads.push(p);
  return p;
}

/**
 * Pads close enough that their slopes would meet are put at one height
 * between them, so there is never a step where two of them run together.
 */
function settle() {
  const group = pads.map((_, i) => i);
  const root = (i) => (group[i] === i ? i : (group[i] = root(group[i])));
  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const a = pads[i], b = pads[j];
      const gap = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.z - (b.z + b.d), b.z - (a.z + a.d));
      if (gap < 4) group[root(i)] = root(j);
    }
  }
  const sums = new Map();
  pads.forEach((p, i) => {
    const r = root(i), s = sums.get(r) ?? [0, 0];
    sums.set(r, [s[0] + p.h * p.w * p.d, s[1] + p.w * p.d]);
  });
  pads.forEach((p, i) => {
    const [h, area] = sums.get(root(i));
    p.h = Math.round((h / area) * 20) / 20;
  });
}

export function createTown() {
  pads.length = 0;
  const c = new TownMap({ name: 'Petroleum Springs', cols: SIZE, rows: SIZE });

  // The oil field's pads, before the ground is laid, so it is laid round them.
  const P = {
    office: pad(50, 65, 7, 6),
    jack1: pad(54, 70, 6, 4),
    jack2: pad(66, 78, 6, 4),
    jack3: pad(58, 94, 6, 4),
    jack4: pad(82, 72, 6, 4),
    jack5: pad(90, 90, 6, 4),
    jack6: pad(76, 108, 6, 4),
    jack7: pad(54, 108, 6, 4),
    derrick: pad(75, 83, 12, 10),
    tar: pad(63, 97, 14, 11),
    yard: pad(87, 97, 12, 10),
    pipeEnd: pad(98, 65, 5, 5),
  };
  settle();
  for (const k of Object.keys(P)) P[k] = P[k].h;

  c.surface(0, 0, SIZE, SIZE, ground, { surface: 'grass' });
  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      const cell = c.cell(x, z);
      if (cell.h.some((v) => v > 0.05) && Math.min(x, z, SIZE - 1 - x, SIZE - 1 - z) < 5) cell.surface = 'berm';
    }
  }
  c.paint(FIELD.x0, FIELD.z0, FIELD.x1 - FIELD.x0, FIELD.z1 - FIELD.z0, 'dirt');
  for (const p of pads) c.paint(p.x, p.z, p.w, p.d, 'gravel');

  c.start = { x: 17, z: 18 };

  // The fence along the top of the bank, all the way round.
  const F = 0.35, top = berm(0, 0) + 1.3;
  c.prop('fence', 0, 0, { size: SIZE, inset: F });
  c.solid(0, 0, 0, SIZE, top, F).solid(0, 0, SIZE - F, SIZE, top, SIZE);
  c.solid(0, 0, 0, F, top, SIZE).solid(SIZE - F, 0, 0, SIZE, top, SIZE);

  streets(c);
  mapleGrove(c);
  downtown(c);
  gasStation(c);
  interstate(c);
  oilField(c, P);
  refinery(c);
  traffic(c);

  c.district('Maple Grove', 3, 3, 44, 57, '#7cb257');
  c.district('Downtown', 47, 3, 49, 57, '#8a8f9a');
  c.district("Gas 'n' Go", 90, 3, 21, 77, '#e8b04a');
  c.district('The Interstate', 111, 0, 11, SIZE, '#5a5d66');
  c.district('The Far Side', 122, 0, 6, SIZE, '#8c9a5a');
  c.district('The Oil Field', 42, 58, 69, 70, '#b07c48');
  c.district('The Refinery', 0, 58, 42, 70, '#9aa0aa');
  return c;
}

/** The grid of streets: five running down, three across, the avenue on to the gas station. */
const DOWN = [6, 26, 46, 66, 86];
const ACROSS = [6, 28, 52];

function streets(c) {
  for (const x of DOWN) c.flat(x, 6, 4, 50, 0, { surface: 'road' });
  for (const z of ACROSS) c.flat(6, z, 84, 4, 0, { surface: 'road' });
  c.flat(90, 52, 6, 4, 0, { surface: 'road' });
  // South: into the refinery, and the dirt road into the oil field.
  c.flat(26, 56, 4, 6, 0, { surface: 'road' });
  c.flat(46, 56, 4, 7, 0, { surface: 'dirt' });

  const inStreet = (v, list, w = 4) => list.some((s) => v >= s - 0.01 && v <= s + w + 0.01);
  // Yellow dashes down the middle of each street, but not across the junctions.
  for (const z of ACROSS) {
    for (let x = 6.5; x < (z === 52 ? 95 : 89); x += 2) if (!inStreet(x, DOWN) && !inStreet(x + 1, DOWN)) c.mark(x, z + 1.94, 1, 0.12, '#f2c230');
  }
  for (const x of DOWN) {
    for (let z = 6.5; z < 55; z += 2) if (!inStreet(z, ACROSS) && !inStreet(z + 1, ACROSS)) c.mark(x + 1.94, z, 0.12, 1, '#f2c230');
  }
  // Zebra crossings on every side of every junction.
  for (const x of DOWN) {
    for (const z of ACROSS) {
      for (let k = 0; k < 4; k++) {
        if (z > 6) c.mark(x + 0.2 + k, z - 0.9, 0.5, 0.8);
        if (z < 52) c.mark(x + 0.2 + k, z + 4.1, 0.5, 0.8);
        if (x > 6) c.mark(x - 0.9, z + 0.2 + k, 0.8, 0.5);
        if (x < 86) c.mark(x + 4.1, z + 0.2 + k, 0.8, 0.5);
      }
    }
  }
  // Street lamps on the corners, trees along the avenue.
  for (const x of DOWN) for (const z of ACROSS) c.prop('lamp', x - 0.5, z - 0.5);
  for (let x = 8; x < 92; x += 6) if (!inStreet(x, [26, 46])) c.prop('tree', x + 0.5, 57.5, { size: 0.9 + (x % 3) * 0.1 });
  for (let z = 12; z < 50; z += 7) c.prop('tree', 3.5, z + 0.5, { size: 1.1 });
}

/** A block: a raised sidewalk all round, and what's inside on top of it. */
function block(c, x, z, w, d, inside = 'lawn') {
  c.flat(x, z, w, d, CURB, { surface: 'sidewalk' });
  c.flat(x + 1, z + 1, w - 2, d - 2, CURB, { surface: inside });
}

function house(c, x, z, w, d, wall, { ridge = 'x', door = 'n' } = {}) {
  c.block(x, z, w, d, CURB + 1.6, { roof: 'pitched', ridge, wall, pitch: 1.0 });
  c.prop('house', x, z, { w, d, h: CURB + 1.6, wall, ridge, door });
}

/** A hedge (or any wall): drawn, and solid. */
function wall(c, x0, z0, x1, z1, y0, y1, colour, finish = 'matte') {
  c.prop('wall', x0, z0, { x1, z1, y0, y1, colour, finish });
  c.solid(x0, y0, z0, x1, y1, z1);
}

function mapleGrove(c) {
  const walls = ['#e6dccb', '#c9d8e8', '#f0d9a8', '#d8b8c8', '#cfe3c2', '#f2e6d0'];

  // Home, and the neighbours.
  block(c, 10, 10, 16, 18);
  house(c, 12, 12, 5, 5, '#f0d9a8');
  house(c, 18, 12, 5, 5, walls[1]);
  house(c, 12, 20, 5, 5, walls[3], { door: 's' });
  house(c, 18, 20, 5, 5, walls[4], { door: 's' });
  c.paint(14, 11, 1, 1, 'concrete');
  c.airPump('Home', 20.5, 18.5);
  c.prop('mailbox', 14.5, 10.6);
  c.prop('tree', 24, 18.5, { size: 1.2 });
  c.prop('tree', 11.5, 18.5, { size: 1 });
  c.goldenSeed('Home sweet home', 23.5, 25.5);
  c.seedLine(17.5, 13, 17.5, 25, 7);

  // The drained pool.
  block(c, 30, 10, 16, 18);
  house(c, 32, 12, 5, 4, walls[2]);
  house(c, 39, 12, 5, 4, walls[5]);
  c.surface(33, 18, 9, 8, (X, Z) => {
    const u = (2 * (X - 33)) / 9 - 1, v = (2 * (Z - 18)) / 8 - 1;
    const k = Math.max(Math.abs(u), Math.abs(v));
    return CURB - 1.3 * (1 - smooth(Math.max(0, (k - 0.35) / 0.65)));
  }, { surface: 'pool' });
  c.goldenSeed('The deep end', 37.5, 22);
  c.seedLine(33.5, 17, 41.5, 17, 5);
  c.prop('chair', 43.5, 20.5).prop('chair', 43.5, 23.5);

  // The hedge maze.
  block(c, 10, 32, 16, 20);
  const g = '#3f7a34', top = CURB + 0.9;
  const ring = (x0, z0, x1, z1, gap) => {
    const t = 0.4;
    // gap: which side has the way in, 'n' or 's'; the way in is two tiles in the middle.
    const mid = (x0 + x1) / 2;
    const side = (zz, open) => {
      if (open) { wall(c, x0, zz, mid - 1, zz + t, CURB, top, g); wall(c, mid + 1, zz, x1, zz + t, CURB, top, g); }
      else wall(c, x0, zz, x1, zz + t, CURB, top, g);
    };
    side(z0, gap === 'n');
    side(z1 - t, gap === 's');
    wall(c, x0, z0, x0 + t, z1, CURB, top, g);
    wall(c, x1 - t, z0, x1, z1, CURB, top, g);
  };
  ring(12, 34, 24, 50, 'n');
  ring(14.2, 36.2, 21.8, 47.8, 's');
  ring(16.4, 38.4, 19.6, 45.6, 'n');
  c.goldenSeed('Middle of the maze', 18, 42);
  c.seedLine(13.2, 36, 13.2, 49, 6);
  c.seedLine(15.4, 49, 22.6, 49, 4);

  // The skate park: a quarter pipe all down one side, a funbox, a bank.
  block(c, 30, 32, 16, 20, 'concrete');
  c.surface(41, 34, 4, 16, (X) => CURB + 1.75 * ((X - 41) / 4) ** 2, { surface: 'concrete' });
  c.flat(34, 39, 3, 5, CURB + 0.8, { surface: 'concrete' });
  c.slope(31, 39, 3, 5, CURB, CURB + 0.8, 'x', { surface: 'concrete' });
  c.slope(34, 44, 3, 3, CURB + 0.8, CURB, 'z', { surface: 'concrete' });
  c.slope(34, 36, 3, 3, CURB, CURB + 0.8, 'z', { surface: 'concrete' });
  c.goldenSeed('Up the quarter pipe', 44.5, 42, { y: CURB + 1.75 * (3.5 / 4) ** 2 });
  c.seedLine(35.5, 40, 35.5, 43, 3);
  c.prop('rail', 38, 47, { length: 5 });
}

function downtown(c) {
  // Offices, and the alley behind them.
  block(c, 50, 10, 16, 18, 'concrete');
  c.block(51, 11, 7, 9, CURB + 7, { wall: '#9fb0c4' });
  c.prop('tower', 51, 11, { w: 7, d: 9, h: CURB + 7, glass: '#7aa0c8' });
  c.block(51, 21, 7, 6, CURB + 5, { wall: '#c4b49f' });
  c.prop('tower', 51, 21, { w: 7, d: 6, h: CURB + 5, glass: '#b8c8d8' });
  c.block(59, 11, 6, 16, CURB + 9.5, { wall: '#7d8a9a' });
  c.prop('tower', 59, 11, { w: 6, d: 16, h: CURB + 9.5, glass: '#5a7ea8' });
  for (const [x, col] of [[53, '#3a7a3a'], [61.5, '#3d6ea0']]) {
    c.prop('dumpster', x, 27.5, { colour: col });
    c.solid(x - 0.7, CURB, 27.1, x + 0.7, CURB + 0.9, 27.9);
  }
  c.goldenSeed('Down the back alley', 58.5, 25.5);
  c.seedLine(58.5, 14, 58.5, 24, 5);

  // The parking garage: round and up to the roof.
  block(c, 70, 10, 16, 18, 'concrete');
  const L = CURB;
  c.flat(71, 25, 2, 2, L, { surface: 'concrete' });
  c.slope(71, 13, 2, 12, 1.1, L, 'z', { surface: 'concrete' });
  c.flat(71, 11, 2, 2, 1.1, { surface: 'concrete' });
  c.slope(73, 11, 10, 2, 1.1, 2.1, 'x', { surface: 'concrete' });
  c.flat(83, 11, 2, 2, 2.1, { surface: 'concrete' });
  c.slope(83, 13, 2, 12, 2.1, 3.1, 'z', { surface: 'concrete' });
  c.flat(83, 25, 2, 2, 3.1, { surface: 'concrete' });
  c.slope(75, 25, 8, 2, 4.1, 3.1, 'x', { surface: 'concrete' });
  c.flat(73, 25, 2, 2, 4.1, { surface: 'concrete' });
  c.flat(73, 13, 10, 12, 4.1, { surface: 'concrete', wall: '#a7a39a' });
  c.prop('garage', 73, 13, { w: 10, d: 12, h: 4.1 });
  const par = '#bdb8ab';
  wall(c, 70.8, 11, 71, 25, 0, 1.6, par);
  wall(c, 71, 10.8, 85, 11, 0, 2.6, par);
  wall(c, 85, 11, 85.2, 27, 0, 3.6, par);
  wall(c, 73, 27, 85, 27.2, 0, 4.6, par);
  c.goldenSeed('Top of the car park', 78, 19, { y: 4.1 });
  c.seedLine(72, 23, 72, 14, 5).seedLine(75, 12, 81, 12, 4).seedLine(84, 14, 84, 23, 5).seedLine(81, 26, 75, 26, 4);
  for (const [x, z, col] of [[75, 15, '#c8382c'], [79, 21, '#2c6ec8'], [76, 22, '#e8e2d6']]) c.prop('parked', x, z, { colour: col, axis: 'z', y: 4.1 });

  // The plaza: a fountain to roll round, a statue of somebody's hamster.
  block(c, 50, 32, 16, 20, 'brick');
  c.surface(54, 38, 8, 8, (X, Z) => {
    const r = Math.hypot(X - 58, Z - 42) / 4;
    return CURB - 0.7 * (1 - smooth(Math.min(1, r)));
  }, { surface: 'pool' });
  c.prop('fountain', 58, 42);
  c.goldenSeed('In the fountain', 56.4, 42);
  c.prop('statue', 52.5, 48.5);
  c.solid(51.9, CURB, 47.9, 53.1, CURB + 1.4, 49.1);
  for (const [x, z] of [[53, 36], [63, 36], [53, 48.5], [63, 47]]) c.prop('tree', x, z, { size: 1.1 });
  c.prop('bench', 56, 35.6).prop('bench', 60, 49.4);
  c.airPump('Downtown', 62.5, 42.5);
  c.seedLine(52, 42, 54, 42, 2).seedLine(62, 38, 62, 46, 4);

  // The building site: switchbacks up the scaffolding to the top.
  block(c, 70, 32, 16, 20, 'dirt');
  c.slope(73, 34, 11, 2, CURB, 2.1, 'x', { surface: 'metal' });
  c.flat(84, 34, 1, 4, 2.1, { surface: 'metal' });
  c.slope(73, 36, 11, 2, 4.1, 2.1, 'x', { surface: 'metal' });
  c.flat(71, 36, 2, 5, 4.1, { surface: 'metal' });
  c.prop('scaffold', 71, 34, { w: 14, d: 7, h: 4.1 });
  c.prop('crane', 80, 45);
  c.solid(79.4, CURB, 44.4, 80.6, 14, 45.6);
  c.goldenSeed('Hard hat area', 71.6, 39.8, { y: 4.1 });
  c.seedLine(75, 35, 82, 35, 4).seedLine(82, 37, 75, 37, 4);
  for (const [x, z] of [[72, 46], [76, 49], [84, 41]]) c.prop('cone', x, z);
  c.drum(74, 46, { range: 6 });
  c.drum(83, 48, { range: 6 });
}

function gasStation(c) {
  // The forecourt.
  c.flat(96, 34, 15, 31, 0, { surface: 'forecourt' });
  c.flat(99, 44, 1, 6, 0.2, { surface: 'concrete' });
  c.flat(103, 44, 1, 6, 0.2, { surface: 'concrete' });
  for (const z of [45.2, 48.2]) {
    for (const x of [99.5, 103.5]) {
      c.prop('pump', x, z + 0.5);
      c.solid(x - 0.3, 0.2, z + 0.1, x + 0.3, 1.5, z + 0.9);
    }
  }
  c.prop('canopy', 97, 42, { w: 10, d: 10, h: 2.7 });
  for (const [x, z] of [[97.25, 42.6], [105.75, 42.6], [97.25, 51.4], [105.75, 51.4]]) c.solid(x - 0.15, 0, z - 0.15, x + 0.15, 2.7, z + 0.15);
  c.paint(100, 45, 2, 3, 'oil').paint(104, 48, 2, 2, 'oil').paint(97, 52, 2, 1, 'oil');
  for (let x = 96.5; x < 111; x += 3) c.mark(x, 64.4, 2, 0.12);

  // The shop, with a loading ramp up its side.
  c.block(102, 56, 7, 8, 2.4, { wall: '#e8e2d6' });
  c.prop('shop', 102, 56, { w: 7, d: 8, h: 2.4 });
  c.slope(109, 56, 2, 7, 0, 2.4, 'z', { surface: 'concrete' });
  c.flat(109, 63, 2, 1, 2.4, { surface: 'concrete' });
  c.flat(102, 64, 9, 1, 0, { surface: 'forecourt' });
  wall(c, 110.9, 56, 111.1, 64, 0, 3, '#bdb8ab');
  c.goldenSeed("On the Gas 'n' Go", 105.5, 58.5, { y: 2.4 });
  c.airPump("Gas 'n' Go", 98.5, 55.5);

  // The car wash: a tunnel, wet all through.
  c.block(96, 57, 6, 1, 2.2, { wall: '#3d8ad0' });
  c.block(96, 63, 6, 1, 2.2, { wall: '#3d8ad0' });
  c.flat(96, 58, 6, 5, 0, { surface: 'wet' });
  c.deck(95.8, 56.8, 6.4, 7.4, 2.5, { colour: '#e8e4dc', roof: true });
  c.prop('carwash', 96, 58, { w: 6, d: 5 });
  c.goldenSeed('Through the car wash', 99, 60.5);

  // The footbridge over the interstate, to the billboard on the hill.
  c.slope(101, 34, 10, 2, 0, 2.7, 'x', { surface: 'concrete' });
  c.deck(111, 34, 11.2, 2, 2.7, { colour: '#a7a39a' });
  wall(c, 101, 33.8, 122, 34, 0, 3.3, '#5a6068', 'shiny');
  wall(c, 101, 36, 115.8, 36.2, 0, 3.3, '#5a6068', 'shiny');
  wall(c, 117.4, 36, 122, 36.2, 0, 3.3, '#5a6068', 'shiny');
  c.flat(122, 24, 3, 22, 2.7, { surface: 'grass', wall: '#6a4a2c' });
  c.prop('billboard', 123.6, 31, { text: 'PETROLL' });
  c.solid(123.2, 2.7, 28.6, 124.0, 6.5, 33.4);
  c.goldenSeed('Under the billboard', 122.8, 26.5, { y: 2.7 });
  c.seedLine(103, 35, 109, 35, 4);
  c.seedLine(112, 35, 121, 35, 5, { y: 2.7 });

  // North of the forecourt: a junkyard.
  c.flat(96, 8, 15, 24, 0, { surface: 'gravel' });
  for (const [x, z, col, r] of [[99, 12, '#8a3a26', 0.3], [104, 11, '#4a6a8a', 1.2], [99, 18, '#6a7a3a', 2.1], [106, 19, '#8a8a8e', 0.6], [101, 26, '#a05a2a', 1.6]]) {
    c.prop('junker', x, z, { colour: col, turn: r });
    c.solid(x - 0.9, 0, z - 0.9, x + 0.9, 0.9, z + 0.9);
  }
  for (const [x, z] of [[108, 14], [108, 25], [97, 30]]) {
    c.prop('tires', x, z);
    c.solid(x - 0.45, 0, z - 0.45, x + 0.45, 1.1, z + 0.45);
  }
  c.seedLine(97, 15, 109, 15, 6).seedLine(103, 22, 103, 30, 4);
}

function interstate(c) {
  c.flat(111, 0, 11, SIZE, 0, { surface: 'highway' });
  c.flat(116, 4, 1, SIZE - 8, 0.5, { surface: 'concrete' });
  // Crossovers in the barrier, for the police and the breakdown trucks (and hamsters).
  for (const z of [70, 100]) c.flat(116, z, 1, 3, 0, { surface: 'highway' });
  for (let z = 0; z < SIZE; z += 3) {
    c.mark(113.94, z, 0.12, 1.6);
    c.mark(118.94, z, 0.12, 1.6);
  }
  c.mark(111.9, 0, 0.1, SIZE, '#f2f0e8').mark(121.0, 0, 0.1, SIZE, '#f2f0e8');
  // Tunnels where it goes through the bank at each end, and nothing gets past them.
  c.prop('tunnel', 111, 0, { w: 11, d: 4, facing: 1 });
  c.prop('tunnel', 111, SIZE - 4, { w: 11, d: 4, facing: -1 });
  c.solid(111, 0, 3.6, 122, 3, 3.9);
  c.solid(111, 0, SIZE - 3.9, 122, 3, SIZE - 3.6);
  c.goldenSeed('On the central reservation', 116.5, 37.7, { y: 0.5 });
  // The far side: the grass behind the billboard, all the way down to the corner.
  c.seedLine(123.5, 50, 123.5, 118, 12);
  c.goldenSeed('The edge of the world', 124.6, 124.6, { y: berm(124.6, 124.6) });
}

function oilField(c, P) {
  // The field office.
  c.prop('trailer', 51, 66, { w: 4, d: 2, y: P.office });
  c.solid(51, P.office, 66, 55, P.office + 1.5, 68);
  c.airPump('Field Office', 55.5, 69.5);

  // Dirt roads round the field.
  const road = (x, z, w, d) => c.paint(x, z, w, d, 'dirt');
  road(47, 63, 58, 2); road(47, 117, 58, 2); road(47, 63, 2, 56); road(103, 63, 2, 56);

  // Pumpjacks. Each nods over the tile at its head.
  const jack = (x, z, h, opts) => {
    c.pumpjack(x, z, opts);
    c.solid(x - 4.4, h, z + 0.1, x - 2.6, h + 1.1, z + 0.9);
  };
  jack(59, 71, P.jack1, { period: 3.4 });
  jack(71, 79, P.jack2, { period: 3.0, phase: 1 });
  jack(63, 95, P.jack3, { period: 3.6, phase: 2 });
  jack(87, 73, P.jack4, { period: 3.2, phase: 0.5 });
  jack(95, 91, P.jack5, { period: 2.8, phase: 1.5 });
  jack(81, 109, P.jack6, { period: 3.3, phase: 2.5 });
  jack(59, 109, P.jack7, { period: 3.1, phase: 0.2 });
  c.goldenSeed('Under the nodding donkey', 63.5, 95.5, { y: P.jack3 });

  // The pipeline: a long, thin, high way along the top.
  const PIPE = 3.6;
  // The ramp up starts flush with the ground under it, corner for corner.
  c.surface(58, 68, 6, 1, (X, Z) => ground(58, Z) + (PIPE - ground(58, Z)) * ((X - 58) / 6), { surface: 'metal' });
  c.flat(64, 68, 35, 1, PIPE, { surface: 'metal' });
  c.flat(99, 66, 3, 3, PIPE, { surface: 'metal' });
  c.prop('pipeline', 58, 68, { to: 102, h: PIPE });
  c.goldenSeed('End of the line', 100.5, 67.5, { y: PIPE });
  c.seedLine(66, 68.5, 96, 68.5, 10);

  // The derrick: up on the lift to the platform at the top.
  const D = P.derrick, TOP = D + 8;
  c.prop('derrick', 80, 86, { w: 4, d: 4, y: D, top: TOP });
  c.deck(80, 86, 4, 4, TOP, { colour: '#8a6a42' });
  for (const [x, z] of [[80, 86], [83.6, 86], [80, 89.6], [83.6, 89.6]]) c.solid(x, D, z, x + 0.4, TOP - 0.3, z + 0.4);
  c.lift(78, 87, 2, 2, D, { to: [0, 8, 0], period: 9, pause: 0.22 });
  wall(c, 79.9, TOP, 84.1, TOP + 0.5, 85.9, 86.1, '#c8382c');
  c.solids.pop();
  c.solid(79.9, TOP, 85.9, 84.1, TOP + 0.5, 86.1);
  c.solid(79.9, TOP, 89.9, 84.1, TOP + 0.5, 90.1);
  c.solid(83.9, TOP, 85.9, 84.1, TOP + 0.5, 90.1);
  c.goldenSeed('Top of the derrick', 82, 88, { y: TOP });
  c.seedLine(76, 85, 76, 91, 4);

  // The tar pit, and the island in the middle of it.
  const T = P.tar;
  c.flat(65, 99, 10, 7, T - 0.6, { surface: 'tar' });
  c.flat(69, 101, 2, 3, T, { surface: 'dirt' });
  c.flat(65, 102, 4, 1, T, { surface: 'plank' });
  c.goldenSeed('Tar pit island', 70, 102.5, { y: T });
  c.prop('sign', 63.6, 101, { text: 'DANGER\nTAR', y: T });

  // The barrel yard: stacks to weave through, and drums that roll after you.
  const Y = P.yard;
  for (const [x, z] of [[89, 99], [92, 101], [95, 98.5], [89, 104], [93, 105], [96.5, 102.5]]) {
    c.prop('drums', x, z, { y: Y });
    c.solid(x - 0.75, Y, z - 0.75, x + 0.75, Y + 1.8, z + 0.75);
  }
  c.drum(91, 99); c.drum(96, 105);
  c.goldenSeed('In the barrel yard', 97.5, 105.5, { y: Y });
  c.seedLine(88, 102.6, 95, 102.6, 4);

  // Slick Hill: oil all down one side of it.
  c.paint(58, 80, 6, 3, 'oil').paint(63, 82, 3, 5, 'oil');
  c.goldenSeed('Top of Slick Hill', 60.5, 84.5);

  // Scrub, rocks and old spills over all the open ground.
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const open = (x, z) => {
    const cell = c.cell(Math.floor(x), Math.floor(z));
    if (!cell || cell.surface !== 'dirt') return false;
    if (Math.abs(x - 48) < 2 || Math.abs(x - 104) < 2 || Math.abs(z - 64) < 2 || Math.abs(z - 118) < 2) return false;
    return !c.solids.some((s) => x > s.min[0] - 1 && x < s.max[0] + 1 && z > s.min[2] - 1 && z < s.max[2] + 1);
  };
  for (let i = 0; i < 420; i++) {
    const x = FIELD.x0 + 2 + rnd() * (FIELD.x1 - FIELD.x0 - 4), z = FIELD.z0 + 2 + rnd() * (FIELD.z1 - FIELD.z0 - 4);
    if (!open(x, z)) continue;
    const k = rnd();
    if (k < 0.55) c.prop('shrub', x, z, { size: 0.7 + rnd() * 0.8 });
    else c.prop('rock', x, z, { size: 0.6 + rnd() * 1.2 });
  }

  // Seeds along the roads.
  c.seedLine(48, 70, 48, 114, 12).seedLine(52, 118, 100, 118, 13).seedLine(104, 112, 104, 68, 12);
}

function refinery(c) {
  c.flat(3, 60, 39, 64, 0, { surface: 'concrete' });
  c.flat(26, 56, 4, 6, 0, { surface: 'road' });
  c.prop('gate', 26, 60, { w: 4 });
  c.airPump('Refinery Gate', 32.5, 63.5);

  /** A tank: the tiles inside its circle at its height, and a drum drawn round them. */
  const tank = (cx, cz, r, h, colour = '#e8e4dc') => {
    for (let z = Math.floor(cz - r); z <= cz + r; z++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r) c.flat(x, z, 1, 1, h, { surface: 'metal', wall: colour });
      }
    }
    c.prop('tank', cx, cz, { r: r + 0.62, h, colour });
  };
  tank(12, 70, 4.5, 3);
  tank(12, 88, 5, 6, '#d8d0c0');
  tank(26, 104, 4, 4.5, '#c8d0d8');
  tank(10, 112, 5, 5);

  // Up the ramp, along the catwalk, onto the short tank.
  c.slope(20, 72, 2, 10, 3, 0, 'z', { surface: 'metal' });
  c.flat(16, 71, 22, 1, 3, { surface: 'metal' });
  c.flat(37, 69, 3, 3, 3, { surface: 'metal' });
  c.prop('catwalk', 16, 71, { w: 24, h: 3 });
  c.goldenSeed('End of the catwalk', 38.5, 70.5, { y: 3 });
  c.seedLine(21, 80, 21, 73, 4).seedLine(23, 71.5, 35, 71.5, 6);

  // The tall tank: up on the lift.
  c.lift(17, 87, 2, 2, 0, { to: [0, 6, 0], period: 8, pause: 0.24 });
  c.goldenSeed('Top of the big tank', 12.5, 88.5, { y: 6 });

  // Flare alley: the gas comes up out of the floor.
  c.block(32, 82, 1, 26, 1.4, { wall: '#7a8189' });
  c.block(37, 82, 1, 26, 1.4, { wall: '#7a8189' });
  // In rows, each row going up a little after the one before: a wave of fire down the alley, with a gap behind it to ride.
  for (let k = 0; k < 6; k++) {
    c.flare(33 + (k % 2 ? 0 : 2), 85 + k * 3.8, { period: 2.8, phase: -k * 0.35, burn: 0.3 });
    c.flare(34, 86.6 + k * 3.8, { period: 2.8, phase: -k * 0.35, burn: 0.3 });
  }
  c.goldenSeed('End of flare alley', 35, 106.5);
  c.prop('stack', 22, 92, { h: 14 });
  c.solid(21.2, 0, 91.2, 22.8, 14, 92.8);

  // Yellow walkways painted round the yard, hatching by the hazards, clutter.
  for (const z of [65.5, 81.5]) c.mark(4, z, 26, 0.12, '#f2c230');
  c.mark(30.5, 62, 0.12, 60, '#f2c230').mark(24.5, 82, 0.12, 40, '#f2c230');
  for (let k = 0; k < 8; k++) c.mark(31.2, 82.5 + k * 3.1, 0.6, 0.18, '#f2c230');
  for (const [x, z, l] of [[25, 66, 4], [6, 81, 3], [29, 99, 5], [15, 100, 3]]) c.prop('valves', x, z, { length: l });
  for (const [x, z] of [[27, 75], [5, 104], [38, 112]]) {
    c.prop('cylinders', x, z);
    c.solid(x - 0.2, 0, z - 0.2, x + 0.55, 1.1, z + 0.55);
  }
  c.block(34, 112, 5, 4, 2.2, { wall: '#c8c2b4' });
  c.block(4, 62, 4, 3, 2.0, { wall: '#d8d2c4' });

  // Pipes on racks overhead, a sphere tank, drums.
  c.prop('piperack', 4, 79, { to: 30 });
  c.prop('piperack', 4, 98, { to: 30 });
  for (const z of [79, 98]) for (let x = 4.5; x < 30; x += 5) c.solid(x - 0.15, 0, z - 0.15, x + 0.15, 3.4, z + 0.15);
  c.prop('sphere', 30, 116, { r: 3.5 });
  c.solid(27.2, 0, 113.2, 32.8, 6.5, 118.8);
  c.drum(20, 64); c.drum(6, 98);
  c.seedLine(6, 78, 30, 78, 8).seedLine(28, 64, 28, 110, 10).seedLine(5, 100, 5, 120, 5);
}

/**
 * The traffic. Two rings round the whole town, one each way; two more
 * round the middle; a car or two in and out of the gas station; trucks
 * round the oil field; and the interstate, which never stops.
 */
function traffic(c) {
  c.road([[9, 9], [87, 9], [87, 53], [9, 53]], { cars: 6, speed: 4.2 });
  c.road([[7, 7], [7, 55], [89, 55], [89, 7]], { cars: 6, speed: 4.6 });
  c.road([[29, 9], [67, 9], [67, 29], [29, 29]], { cars: 3, speed: 3.6 });
  c.road([[27, 29], [27, 55], [69, 55], [69, 29]], { cars: 3, speed: 3.8 });
  c.road([[92, 55], [106.5, 55], [106.5, 41], [101, 41], [101, 53], [92, 53]], { cars: 2, speed: 2.4 });
  c.road([[48, 64], [48, 118], [104, 118], [104, 64]], { cars: 2, speed: 3.4, kind: 'truck' });
  // The interstate: open at both ends, into the tunnels.
  c.road([[113, -3], [113, SIZE + 3]], { cars: 3, speed: 7.5, kind: 'truck', brakes: false, open: true });
  c.road([[115, -3], [115, SIZE + 3]], { cars: 3, speed: 9, kind: 'car', brakes: false, open: true });
  c.road([[118, SIZE + 3], [118, -3]], { cars: 3, speed: 9.5, kind: 'car', brakes: false, open: true });
  c.road([[120, SIZE + 3], [120, -3]], { cars: 3, speed: 7, kind: 'tanker', brakes: false, open: true });
}
