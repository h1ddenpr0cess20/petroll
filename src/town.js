import { windowLamps } from './buildings.js';
import { TownMap } from './map.js';
import { structureLights } from './structures.js';
import { work } from './work.js';

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
 * And over the interstate, on the road bridge or the footbridge, the east
 * side of town:
 *
 *   Big Rig Truck Stop  the diner, rigs parked up, a kicker ramp.
 *   The Drive-in        rows of cars facing the big screen, the snack bar.
 *   Crude Acres         the trailer park: trailers in rows, trampolines.
 *   Baron's Hill        the oil baron's mansion on top of a hill.
 *   Wildcat Speedway    a dirt oval, banked at the ends, walled round.
 *   The Quarry          a pit cut down in steps, a haul road to the floor.
 *
 * Who wants what doing about the place is in `work.js`.
 *
 * Traffic drives round the town on the right. x runs to the right of the
 * map, z down it; the map is 256 tiles across and 128 down, and a ring of
 * grassy bank keeps everything on it.
 */

export const COLS = 256;
export const ROWS = 128;
export const CURB = 0.15;

/** The bank round the edge: up from nothing five tiles in to two and a half high at the very edge, a fence along the top. */
export const berm = (X, Z) => {
  const d = Math.min(X, Z, COLS - X, ROWS - Z);
  return d < 5 ? (5 - d) * 0.5 : 0;
};

/** The oil field: rolling ground, fading out to level at its edges, flattened under the pads. */
const FIELD = { x0: 42, z0: 58, x1: 108, z1: 124 };
/** How high the pipeline's walkway is. */
export const PIPE = 3.6;

export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
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
  const c = new TownMap({ name: 'Petroleum Springs', cols: COLS, rows: ROWS });

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

  c.surface(0, 0, COLS, ROWS, ground, { surface: 'grass' });
  for (let z = 0; z < ROWS; z++) {
    for (let x = 0; x < COLS; x++) {
      const cell = c.cell(x, z);
      if (cell.h.some((v) => v > 0.05) && Math.min(x, z, COLS - 1 - x, ROWS - 1 - z) < 5) cell.surface = 'berm';
    }
  }
  c.paint(FIELD.x0, FIELD.z0, FIELD.x1 - FIELD.x0, FIELD.z1 - FIELD.z0, 'dirt');
  for (const p of pads) c.paint(p.x, p.z, p.w, p.d, 'gravel');

  c.start = { x: 17, z: 18 };

  // The fence along the top of the bank, all the way round.
  const F = 0.35, top = berm(0, 0) + 1.3;
  c.prop('fence', 0, 0, { w: COLS, d: ROWS, inset: F });
  c.solid(0, 0, 0, COLS, top, F).solid(0, 0, ROWS - F, COLS, top, ROWS);
  c.solid(0, 0, 0, F, top, ROWS).solid(COLS - F, 0, 0, COLS, top, ROWS);

  streets(c);
  mapleGrove(c);
  downtown(c);
  gasStation(c);
  interstate(c);
  oilField(c, P);
  refinery(c);
  overpass(c);
  eastStreets(c);
  truckStop(c);
  driveIn(c);
  crudeAcres(c);
  baronsHill(c);
  speedway(c);
  quarry(c);
  traffic(c);
  work(c, { P });
  scrub(c);
  windowLamps(c);
  structureLights(c);

  c.district('Maple Grove', 3, 3, 44, 57, '#7cb257');
  c.district('Downtown', 47, 3, 49, 57, '#8a8f9a');
  c.district("Gas 'n' Go", 90, 3, 21, 77, '#e8b04a');
  c.district('The Interstate', 111, 0, 11, ROWS, '#5a5d66');
  c.district('The Oil Field', 42, 58, 69, 70, '#b07c48');
  c.district('The Refinery', 0, 58, 42, 70, '#9aa0aa');
  c.district('Big Rig Truck Stop', 122, 0, 20, 62, '#d8603a');
  c.district('The Drive-in', 122, 62, 20, 66, '#c85a9a');
  c.district('Crude Acres', 142, 0, 50, 62, '#a8b060');
  c.district("Baron's Hill", 192, 0, 64, 62, '#d8b848');
  c.district('Wildcat Speedway', 142, 62, 50, 66, '#c87a3a');
  c.district('The Quarry', 192, 62, 64, 66, '#a8a090');
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
  // Street lamps on the corners, their arms out over the junction; more along the long blocks.
  // At the kerb's edge, so the pavement past them is wide enough for the ball.
  const kerb = 0.2;
  for (const x of DOWN) for (const z of ACROSS) c.place('streetlamp', x - kerb, z - kerb, { angle: -Math.PI / 4 });
  // (Not along the car park, where the pavement runs between its wall and the kerb.)
  for (const x of DOWN) for (const z of [18.5, 41.5]) if (!(x === 86 && z === 18.5)) c.place('streetlamp', x - kerb, z, { angle: 0 });
  for (const z of ACROSS) for (const x of [17.5, 37.5, 57.5, 77.5]) c.place('streetlamp', x, z - kerb, { angle: -Math.PI / 2 });
  for (let x = 8; x < 92; x += 6) if (!inStreet(x, [26, 46])) c.place(x % 4 ? 'tree' : 'pine', x + 0.5, 57.5, { scale: 0.9 + (x % 3) * 0.1, angle: x });
  for (let z = 12; z < 50; z += 7) c.place('pine', 3.5, z + 0.5, { scale: 1.1, angle: z });
}

/** A block: a raised sidewalk all round, and what's inside on top of it. */
function block(c, x, z, w, d, inside = 'lawn') {
  c.flat(x, z, w, d, CURB, { surface: 'sidewalk' });
  c.flat(x + 1, z + 1, w - 2, d - 2, CURB, { surface: inside });
}

function house(c, x, z, w, d, wall, { ridge = 'x', door = 'n' } = {}) {
  c.block(x, z, w, d, CURB + 1.6, { roof: 'pitched', ridge, wall, pitch: 1.0, facade: 'house', base: CURB, door, lit: 0.55 });
}

/** A hedge (or any wall): drawn, and solid. */
function wall(c, x0, z0, x1, z1, y0, y1, colour, finish = 'matte', tex = null) {
  c.prop('wall', x0, z0, { x1, z1, y0, y1, colour, finish, tex });
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
  c.place('mailbox', 15.6, 10.6, { turn: 2 });
  c.place('tree', 24, 18.5, { scale: 1.1 });
  c.place('tree', 11.5, 18.5, { scale: 0.95, angle: 1 });
  c.place('hydrant', 10.25, 26.4);

  // The drained pool.
  block(c, 30, 10, 16, 18);
  house(c, 32, 12, 5, 4, walls[2]);
  house(c, 39, 12, 5, 4, walls[5]);
  c.surface(33, 18, 9, 8, (X, Z) => {
    const u = (2 * (X - 33)) / 9 - 1, v = (2 * (Z - 18)) / 8 - 1;
    const k = Math.max(Math.abs(u), Math.abs(v));
    return CURB - 1.3 * (1 - smooth(Math.max(0, (k - 0.35) / 0.65)));
  }, { surface: 'pool' });
  c.prop('chair', 43.5, 20.5).prop('chair', 43.5, 23.5);

  // The hedge maze.
  block(c, 10, 32, 16, 20);
  const g = '#3f7a34', top = CURB + 0.9;
  const ring = (x0, z0, x1, z1, gap) => {
    const t = 0.4;
    // gap: which side has the way in, 'n' or 's'; the way in is two tiles in the middle.
    const mid = (x0 + x1) / 2;
    const hedge = (a, b, cc, d) => wall(c, a, b, cc, d, CURB, top, g, 'matte', 'hedge');
    const side = (zz, open) => {
      if (open) { hedge(x0, zz, mid - 1, zz + t); hedge(mid + 1, zz, x1, zz + t); }
      else hedge(x0, zz, x1, zz + t);
    };
    side(z0, gap === 'n');
    side(z1 - t, gap === 's');
    hedge(x0, z0, x0 + t, z1);
    hedge(x1 - t, z0, x1, z1);
  };
  ring(12, 34, 24, 50, 'n');
  ring(14.2, 36.2, 21.8, 47.8, 's');
  ring(16.4, 38.4, 19.6, 45.6, 'n');

  // The skate park: a quarter pipe all down one side, a funbox, a bank.
  block(c, 30, 32, 16, 20, 'concrete');
  c.surface(41, 34, 4, 16, (X) => CURB + 1.75 * ((X - 41) / 4) ** 2, { surface: 'concrete' });
  c.flat(34, 39, 3, 5, CURB + 0.8, { surface: 'concrete' });
  c.slope(31, 39, 3, 5, CURB, CURB + 0.8, 'x', { surface: 'concrete' });
  c.slope(34, 44, 3, 3, CURB + 0.8, CURB, 'z', { surface: 'concrete' });
  c.slope(34, 36, 3, 3, CURB, CURB + 0.8, 'z', { surface: 'concrete' });
  c.prop('rail', 38, 47, { length: 5 });
}

function downtown(c) {
  // Offices, and the alley behind them.
  block(c, 50, 10, 16, 18, 'concrete');
  c.block(51, 11, 7, 9, CURB + 7.2, { wall: '#a8b4c4', facade: 'office', base: CURB, lit: 0.35 });
  c.block(51, 21, 7, 6, CURB + 6, { wall: '#c87a5a', facade: 'brick', base: CURB, lit: 0.45, door: 's' });
  c.block(59, 11, 6, 16, CURB + 9.9, { wall: '#8a98aa', facade: 'office', base: CURB, lit: 0.3 });
  // A dumpster round the side of the car park, out of everybody's way.
  c.place('dumpster', 71.55, 25, { turn: 1 });

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
  c.block(73, 13, 10, 12, 4.1, { surface: 'concrete', wall: '#b0aca2', facade: 'garage', base: CURB, lit: 0 });
  const par = '#bdb8ab';
  wall(c, 70.8, 11, 71, 25, 0, 1.6, par, 'matte', 'block');
  wall(c, 71, 10.8, 85, 11, 0, 2.6, par, 'matte', 'block');
  wall(c, 85, 11, 85.2, 27, 0, 3.6, par, 'matte', 'block');
  wall(c, 73, 27, 85, 27.2, 0, 4.6, par, 'matte', 'block');
  for (const [x, z, col, m] of [[75, 15, '#c8382c', 'sedan'], [79, 21, '#2c6ec8', 'hatchback'], [76.5, 22, '#e8e2d6', 'sedan']]) {
    c.place(m, x, z, { paint: col, y: 4.1 });
  }

  // The plaza: a fountain to roll round, a statue of somebody's hamster.
  block(c, 50, 32, 16, 20, 'brick');
  c.surface(54, 38, 8, 8, (X, Z) => {
    const r = Math.hypot(X - 58, Z - 42) / 4;
    return CURB - 0.7 * (1 - smooth(Math.min(1, r)));
  }, { surface: 'pool' });
  c.prop('fountain', 58, 42);
  c.place('statue', 52.5, 48.5, { turn: 2 });
  for (const [x, z] of [[53, 36], [63, 36], [53, 48.5], [63, 47]]) c.place('tree', x, z, { scale: 1.05, angle: x });
  c.place('bench', 56, 35.6, { turn: 2 }).place('bench', 60, 49.4).place('bin', 58.2, 35.5, { scale: 0.7 });
  c.airPump('Downtown', 62.5, 42.5);

  // The building site: switchbacks up the scaffolding to the top.
  block(c, 70, 32, 16, 20, 'dirt');
  c.slope(73, 34, 11, 2, CURB, 2.1, 'x', { surface: 'metal' });
  c.flat(84, 34, 1, 4, 2.1, { surface: 'metal' });
  c.slope(73, 36, 11, 2, 4.1, 2.1, 'x', { surface: 'metal' });
  c.flat(71, 36, 2, 5, 4.1, { surface: 'metal' });
  c.prop('scaffold', 71, 34, { w: 14, d: 7, h: 4.1 });
  c.prop('crane', 80, 45);
  c.solid(79.4, CURB, 44.4, 80.6, 14, 45.6);
  for (const [x, z] of [[72, 46], [76, 49], [84, 41], [72.6, 46.4], [77, 49.3]]) c.place('cone', x, z);
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
      c.place('gaspump', x, z + 0.5, { y: 0.2, scale: 0.95 });
    }
  }
  c.prop('canopy', 97, 42, { w: 10, d: 10, h: 2.7 });
  for (const [x, z] of [[97.25, 42.6], [105.75, 42.6], [97.25, 51.4], [105.75, 51.4]]) c.solid(x - 0.15, 0, z - 0.15, x + 0.15, 2.7, z + 0.15);
  c.paint(100, 45, 2, 3, 'oil').paint(104, 48, 2, 2, 'oil').paint(97, 52, 2, 1, 'oil');
  for (let x = 96.5; x < 111; x += 3) c.mark(x, 64.4, 2, 0.12);

  // The shop, with a loading ramp up its side.
  c.block(102, 56, 7, 8, 2.4, { wall: '#ece6da', facade: 'shop', base: 0, door: 'n', lit: 1 });
  c.prop('shop', 102, 56, { w: 7, d: 8, h: 2.4 });
  c.slope(109, 56, 2, 7, 0, 2.4, 'z', { surface: 'concrete' });
  c.flat(109, 63, 2, 1, 2.4, { surface: 'concrete' });
  c.flat(102, 64, 9, 1, 0, { surface: 'forecourt' });
  wall(c, 110.9, 56, 111.1, 64, 0, 3, '#bdb8ab', 'matte', 'block');
  c.airPump("Gas 'n' Go", 98.5, 55.5);

  // The car wash: a tunnel, wet all through.
  c.block(96, 57, 6, 1, 2.2, { wall: '#5a9ad8', wtex: 'corrugated' });
  c.block(96, 63, 6, 1, 2.2, { wall: '#5a9ad8', wtex: 'corrugated' });
  c.flat(96, 58, 6, 5, 0, { surface: 'wet' });
  c.deck(95.8, 56.8, 6.4, 7.4, 2.5, { colour: '#e8e4dc', roof: true });
  c.prop('carwash', 96, 58, { w: 6, d: 5 });

  // The footbridge over the interstate, to the billboard on the hill.
  c.slope(101, 34, 10, 2, 0, 2.7, 'x', { surface: 'concrete' });
  c.deck(111, 34, 11.2, 2, 2.7, { colour: '#a7a39a' });
  // Its sides: walls beside the ramp, railings along the deck (the traffic goes under).
  wall(c, 101, 33.8, 111, 34, 0, 3.3, '#5a6068', 'shiny');
  wall(c, 101, 36, 111, 36.2, 0, 3.3, '#5a6068', 'shiny');
  wall(c, 111, 33.8, 122, 34, 2.7, 3.3, '#5a6068', 'shiny');
  wall(c, 111, 36, 115.8, 36.2, 2.7, 3.3, '#5a6068', 'shiny');
  wall(c, 117.4, 36, 122, 36.2, 2.7, 3.3, '#5a6068', 'shiny');
  c.flat(122, 24, 3, 22, 2.7, { surface: 'grass', wall: '#6a4a2c' });
  // (And a bank down off its south end.)
  c.slope(122, 46, 3, 6, 2.7, 0, 'z', { surface: 'grass', wall: '#6a4a2c' });
  c.prop('billboard', 123.6, 31, { text: 'PETROLL' });
  c.solid(123.2, 2.7, 28.6, 124.0, 6.5, 33.4);

  // North of the forecourt: a junkyard.
  c.flat(96, 12, 15, 20, 0, { surface: 'gravel' });
  for (const [x, z, r] of [[99, 15, 0.3], [104, 14.5, 1.2], [99, 20, 2.1], [106, 21, 0.6], [101, 26, 1.6]]) {
    c.place('junker', x, z, { angle: r * 1.3 });
    c.cylinder(x, z, 0.9, 0, 0.9);
  }
  for (const [x, z] of [[108, 14], [108, 25], [97, 30]]) {
    c.place('tyres', x, z, { angle: x });
  }
}

function interstate(c) {
  c.flat(111, 0, 11, ROWS, 0, { surface: 'highway' });
  c.flat(116, 4, 1, ROWS - 8, 0.5, { surface: 'concrete' });
  // Crossovers in the barrier, for the police and the breakdown trucks (and hamsters).
  for (const z of [70, 100]) c.flat(116, z, 1, 3, 0, { surface: 'highway' });
  for (let z = 0; z < ROWS; z += 3) {
    c.mark(113.94, z, 0.12, 1.6);
    c.mark(118.94, z, 0.12, 1.6);
  }
  c.mark(111.9, 0, 0.1, ROWS, '#f2f0e8').mark(121.0, 0, 0.1, ROWS, '#f2f0e8');
  // Tunnels where it goes through the bank at each end, and nothing gets past them.
  c.prop('tunnel', 111, 0, { w: 11, d: 4, facing: 1 });
  c.prop('tunnel', 111, ROWS - 4, { w: 11, d: 4, facing: -1 });
  // The tunnels solid, portal and all, so nothing gets in behind them off the banks either side.
  c.solid(110.2, 0, 0, 122.8, 4.2, 3.9);
  c.solid(110.2, 0, ROWS - 3.9, 122.8, 4.2, ROWS);
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

  // The pipeline: a long, thin, high way along the top.
  // The ramp up starts flush with the ground under it, corner for corner.
  c.surface(58, 68, 6, 1, (X, Z) => ground(58, Z) + (PIPE - ground(58, Z)) * ((X - 58) / 6), { surface: 'metal' });
  c.flat(64, 68, 35, 1, PIPE, { surface: 'metal' });
  c.flat(99, 66, 3, 3, PIPE, { surface: 'metal' });
  c.prop('pipeline', 58, 68, { to: 102, h: PIPE });

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

  // The tar pit, and the island in the middle of it.
  const T = P.tar;
  c.flat(65, 99, 10, 7, T - 0.6, { surface: 'tar' });
  c.flat(69, 101, 2, 3, T, { surface: 'dirt' });
  c.flat(65, 102, 4, 1, T, { surface: 'plank' });
  c.prop('sign', 63.6, 101, { text: 'DANGER\nTAR', y: T });

  // The barrel yard: stacks to weave through, and drums that roll after you.
  const Y = P.yard;
  for (const [x, z] of [[89, 99], [92, 101], [95, 98.5], [89, 104], [93, 105], [96.5, 102.5]]) {
    for (const [dx, dz, dy] of [[-0.33, -0.33, 0], [0.33, -0.33, 0], [-0.33, 0.33, 0], [0.33, 0.33, 0], [0, 0, 0.88]]) c.place('drum', x + dx, z + dz, { y: Y + dy, angle: dx * 7 + dz * 3 });
    c.solid(x - 0.7, Y, z - 0.7, x + 0.7, Y + 1.8, z + 0.7);
  }
  c.drum(91, 99); c.drum(96, 105);

  // Slick Hill: oil all down one side of it.
  c.paint(58, 80, 6, 3, 'oil').paint(63, 82, 3, 5, 'oil');
}

function refinery(c) {
  c.flat(3, 60, 39, 64, 0, { surface: 'concrete' });
  c.flat(26, 56, 4, 6, 0, { surface: 'road' });
  c.prop('gate', 26, 60, { w: 4 });
  c.airPump('Refinery Gate', 32.5, 63.5);

  /** A tank: the tiles inside its circle at its height, and a drum drawn round them. */
  /** A tank: solid as the cylinder it's drawn as, its roof something to stand on. */
  const tank = (cx, cz, r, h, colour = '#e8e4dc') => {
    c.cylinder(cx, cz, r, 0, h);
    c.prop('tank', cx, cz, { r, h, colour });
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

  // The tall tank: up on the lift.
  c.lift(17, 87, 2, 2, 0, { to: [0, 6, 0], period: 8, pause: 0.24 });

  // Flare alley: the gas comes up out of the floor.
  c.block(32, 82, 1, 26, 1.4, { wall: '#8a9098', wtex: 'block', surface: 'metal' });
  c.block(37, 82, 1, 26, 1.4, { wall: '#8a9098', wtex: 'block', surface: 'metal' });
  // In rows, each row going up a little after the one before: a wave of fire down the alley, with a gap behind it to ride.
  for (let k = 0; k < 6; k++) {
    c.flare(33 + (k % 2 ? 0 : 2), 85 + k * 3.8, { period: 2.8, phase: -k * 0.35, burn: 0.3 });
    c.flare(34, 86.6 + k * 3.8, { period: 2.8, phase: -k * 0.35, burn: 0.3 });
  }
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
  c.block(34, 112, 5, 4, 2.2, { wall: '#c8c2b4', wtex: 'corrugated' });
  c.block(4, 62, 4, 3, 2.0, { wall: '#d8d2c4', wtex: 'corrugated' });

  // Pipes on racks overhead, a sphere tank, drums.
  c.prop('piperack', 4, 79, { to: 30 });
  c.prop('piperack', 4, 98, { to: 30 });
  for (const z of [79, 98]) for (let x = 4.5; x < 30; x += 5) c.solid(x - 0.15, 0, z - 0.15, x + 0.15, 3.4, z + 0.15);
  c.prop('sphere', 30, 116, { r: 3.5 });
  // Solid: its legs, and the sphere itself above them (there's room to roll about underneath).
  for (let i = 0; i < 8; i++) c.cylinder(30 + Math.cos(i * Math.PI / 4) * 3.45, 116 + Math.sin(i * Math.PI / 4) * 3.45, 0.18, 0, 4.7);
  c.cylinder(30, 116, 3.5, 2.4, 8.2);
  c.drum(20, 64); c.drum(6, 98);
}

/**
 * The traffic. Two rings round the west of town, one each way; two more
 * round the middle; a car or two in and out of the gas station; trucks
 * round the oil field; the interstate, which never stops; over the road
 * bridge; and the same again round the east side, with a haul truck in
 * the quarry.
 */
function traffic(c) {
  c.road([[9, 9], [87, 9], [87, 53], [9, 53]], { cars: 6, speed: 4.2 });
  c.road([[7, 7], [7, 55], [89, 55], [89, 7]], { cars: 6, speed: 4.6 });
  c.road([[29, 9], [67, 9], [67, 29], [29, 29]], { cars: 3, speed: 3.6 });
  c.road([[27, 29], [27, 55], [69, 55], [69, 29]], { cars: 3, speed: 3.8 });
  c.road([[92, 55], [106.5, 55], [106.5, 41], [101, 41], [101, 53], [92, 53]], { cars: 2, speed: 2.4 });
  c.road([[48, 64], [48, 118], [104, 118], [104, 64]], { cars: 2, speed: 3.4, kind: 'truck' });
  // The interstate: open at both ends, into the tunnels.
  c.road([[113, -3], [113, ROWS + 3]], { cars: 3, speed: 7.5, kind: 'truck', brakes: false, open: true });
  c.road([[115, -3], [115, ROWS + 3]], { cars: 3, speed: 9, kind: 'car', brakes: false, open: true });
  c.road([[118, ROWS + 3], [118, -3]], { cars: 3, speed: 9.5, kind: 'car', brakes: false, open: true });
  c.road([[120, ROWS + 3], [120, -3]], { cars: 3, speed: 7, kind: 'tanker', brakes: false, open: true });
  // Over the road bridge and back, and round the east side of town.
  c.road([[92, 9], [139, 9], [139, 7], [92, 7]], { cars: 2, speed: 4.4, over: true });
  c.road([[145, 9], [243, 9], [243, 115], [145, 115]], { cars: 6, speed: 4.6 });
  c.road([[143, 7], [143, 117], [245, 117], [245, 7]], { cars: 6, speed: 4.4 });
  c.road([[145, 63], [191, 63], [191, 115], [145, 115]], { cars: 3, speed: 3.8 });
  c.road([[193, 9], [243, 9], [243, 61], [193, 61]], { cars: 3, speed: 3.8 });
  // The haul truck, down into the quarry and back up.
  c.road([[217, 66], [217, 88], [219, 88], [219, 66]], { cars: 1, speed: 2.4, kind: 'truck' });
}

/** Scrub, rocks and old spills over all the open ground of the oil field, clear of anything to be done there. */
function scrub(c) {
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const busy = [...c.givers, ...c.knocks, ...c.jobs.flatMap((j) => j.stages.flatMap((s) => [s.at, ...(s.points ?? [])].filter(Boolean).map(([x, z]) => ({ x, z }))))];
  const open = (x, z) => {
    const cell = c.cell(Math.floor(x), Math.floor(z));
    if (!cell || cell.surface !== 'dirt') return false;
    if (Math.abs(x - 48) < 2 || Math.abs(x - 104) < 2 || Math.abs(z - 64) < 2 || Math.abs(z - 118) < 2) return false;
    if (busy.some((b) => Math.hypot(b.x - x, b.z - z) < 1.8)) return false;
    return !c.solids.some((s) => x > s.min[0] - 1 && x < s.max[0] + 1 && z > s.min[2] - 1 && z < s.max[2] + 1);
  };
  for (let i = 0; i < 420; i++) {
    const x = FIELD.x0 + 2 + rnd() * (FIELD.x1 - FIELD.x0 - 4), z = FIELD.z0 + 2 + rnd() * (FIELD.z1 - FIELD.z0 - 4);
    if (!open(x, z)) continue;
    const k = rnd();
    if (k < 0.6) c.place('shrub', x, z, { scale: 0.7 + rnd() * 0.8, angle: rnd() * 6 });
    else c.place('rock', x, z, { scale: 0.6 + rnd() * 1.1, angle: rnd() * 6 });
  }
}

/** A vehicle parked, square to the map (`turn` quarter turns), solid as the traffic's are. */
const PARKED = { sedan: [0.95, 1.9, 0.85], hatchback: [0.95, 1.7, 0.85], pickup: [1.0, 2.1, 0.9], boxtruck: [1.1, 2.7, 1.4], tanker: [1.15, 4.2, 1.5] };
function parked(c, m, x, z, { turn = 0, paint = null, y = null } = {}) {
  const base = y ?? c.heightAt(x, z) ?? 0;
  c.place(m, x, z, { turn, paint, y: base });
  const [w, l, h] = PARKED[m];
  const ex = turn % 2 ? l / 2 : w / 2, ez = turn % 2 ? w / 2 : l / 2;
  c.solid(x - ex, base, z - ez, x + ex, base + h, z + ez);
  return c;
}

const PAINTS = ['#c8382c', '#2c6ec8', '#e8e2d6', '#f2c230', '#3a8a4a', '#1c1b1f', '#8a8f9a', '#e07a2a', '#6a3a8a', '#4ab0c8'];

/**
 * The road bridge over the interstate: the avenue's north street goes on
 * east, up a ramp, over the traffic on a deck and down the other side,
 * with a parapet all along so nobody rolls off it.
 */
const BRIDGE = 3.2;
function overpass(c) {
  c.flat(90, 6, 2, 4, 0, { surface: 'road' });
  c.slope(92, 6, 18, 4, 0, BRIDGE, 'x', { surface: 'road', wall: '#a7a39a' });
  c.deck(110, 6, 13, 4, BRIDGE, { colour: '#a7a39a' });
  c.slope(123, 6, 18, 4, BRIDGE, 0, 'x', { surface: 'road', wall: '#a7a39a' });
  const height = (x) => (x <= 110 ? BRIDGE * (x - 92) / 18 : x >= 123 ? BRIDGE * (141 - x) / 18 : BRIDGE);
  for (const [z0, z1] of [[5.8, 6], [10, 10.2]]) {
    // Over the interstate it's a railing up on the deck; along the ramps, a wall from the ground, stepped up with the road.
    wall(c, 110, z0, 123, z1, BRIDGE, BRIDGE + 0.6, '#8a8f9a', 'shiny');
    for (let x = 94; x < 110; x += 2) wall(c, x, z0, x + 2, z1, 0, height(x + 2) + 0.6, '#b0aa9e', 'matte', 'block');
    for (let x = 123; x < 139; x += 2) wall(c, x, z0, x + 2, z1, 0, height(x) + 0.6, '#b0aa9e', 'matte', 'block');
  }
  for (let x = 93; x < 141; x += 2) if (x < 110 || x > 123) c.mark(x, 7.94, 1, 0.12, '#f2c230');
  for (let x = 110.5; x < 123; x += 2) c.mark(x, 7.94, 1, 0.12, '#f2c230');
  c.lamp(116.5, 8, { colour: '#ffb35a', reach: 7, height: 4.5, y: BRIDGE });
}

/** The east side's streets: three down, three across, painted and lit like the west's. */
const DOWN_E = [142, 190, 242];
const ACROSS_E = [6, 60, 114];
function eastStreets(c) {
  for (const x of DOWN_E) c.flat(x, 6, 4, 112, 0, { surface: 'road' });
  for (const z of ACROSS_E) c.flat(z === 6 ? 141 : 142, z, z === 6 ? 105 : 104, 4, 0, { surface: 'road' });
  const inStreet = (v, list) => list.some((s) => v >= s - 0.01 && v <= s + 4.01);
  for (const z of ACROSS_E) for (let x = 142.5; x < 245; x += 2) if (!inStreet(x, DOWN_E) && !inStreet(x + 1, DOWN_E)) c.mark(x, z + 1.94, 1, 0.12, '#f2c230');
  for (const x of DOWN_E) for (let z = 6.5; z < 117; z += 2) if (!inStreet(z, ACROSS_E) && !inStreet(z + 1, ACROSS_E)) c.mark(x + 1.94, z, 0.12, 1, '#f2c230');
  for (const x of DOWN_E) {
    for (const z of ACROSS_E) {
      for (let k = 0; k < 4; k++) {
        if (z > 6) c.mark(x + 0.2 + k, z - 0.9, 0.5, 0.8);
        if (z < 114) c.mark(x + 0.2 + k, z + 4.1, 0.5, 0.8);
        if (x > 142) c.mark(x - 0.9, z + 0.2 + k, 0.8, 0.5);
        if (x < 242) c.mark(x + 4.1, z + 0.2 + k, 0.8, 0.5);
      }
    }
  }
  for (const x of DOWN_E) for (const z of ACROSS_E) if (x > 142) c.place('streetlamp', x - 0.2, z - 0.2, { angle: -Math.PI / 4 });
  for (const x of [246.2]) for (const z of [33, 87]) c.place('streetlamp', x, z, { angle: Math.PI });
  for (const z of [60, 114]) for (const x of [166, 218]) c.place('streetlamp', x, z - 0.2, { angle: -Math.PI / 2 });
  // Pines down the far edge and along the bottom.
  for (let z = 10; z < 118; z += 7) c.place('pine', 248.5, z + 0.5, { scale: 1.1, angle: z });
  for (let x = 150; x < 244; x += 9) c.place('pine', x + 0.5, 120.5, { scale: 1 + (x % 3) * 0.1, angle: x });
}

/** Big Rig Truck Stop: the diner, the lot with the rigs parked up, a kicker ramp, by the interstate. */
function truckStop(c) {
  c.flat(126, 12, 15, 47, 0, { surface: 'lot' });
  c.block(129, 13, 9, 6, 2.6, { wall: '#f0e6d0', facade: 'shop', base: 0, door: 's', lit: 1 });
  c.prop('marquee', 133.5, 16, { w: 7, y: 2.6, h: 1.4, facing: 's', text: 'BIG RIG DINER', sub: 'EAT · GAS · NAP', bg: '#1c3a6a', fg: '#ffd27a' });
  for (const x of [127, 140]) c.place('streetlamp', x, 21, { angle: x < 130 ? 0 : Math.PI });
  // The rigs, in two rows, room to roll between them.
  for (const [i, x] of [129, 131.6, 134.2, 136.8, 139.4].entries()) {
    parked(c, 'boxtruck', x, 31, { paint: PAINTS[(i * 3) % PAINTS.length] });
    parked(c, i % 2 ? 'boxtruck' : 'tanker', x, 43.5, { turn: 2, paint: PAINTS[(i * 7 + 1) % PAINTS.length] });
  }
  for (let x = 127.75; x < 141; x += 2.6) {
    c.mark(x, 29, 0.1, 4).mark(x, 41, 0.1, 5);
  }
  // A kicker: up the ramp and off the end.
  c.slope(132, 50, 3, 3, 0, 1.1, 'z', { surface: 'metal', wall: '#5a6068' });
  for (let k = 0; k < 3; k++) c.mark(132.2 + k, 49.2, 0.6, 0.5, '#f2c230');
}

/** The Drive-in: rows of cars facing the big screen, a snack bar with the projector in it. */
function driveIn(c) {
  c.flat(123, 62, 19, 60, 0, { surface: 'gravel' });
  c.prop('marquee', 132, 117.6, { w: 15, y: 1.4, h: 6.4, facing: 'n', text: 'TONIGHT', sub: 'ATTACK OF THE 50 FT HAMSTER', bg: '#f4f1ea', fg: '#c8382c', posts: 3.5 });
  for (const x of [125.2, 132, 138.8]) c.solid(x - 0.2, 0, 117.4, x + 0.2, 7.8, 117.8);
  c.block(129, 66, 6, 4, 2.2, { wall: '#f0d8a0', facade: 'shop', base: 0, door: 's', lit: 1 });
  c.prop('marquee', 132, 68, { w: 5, y: 2.2, h: 0.9, facing: 's', text: 'SNACK BAR', bg: '#c8382c', fg: '#fff6e0' });
  let k = 0;
  for (const z of [82, 90, 98, 106]) {
    for (const x of [126, 129, 132, 135, 138]) {
      if ((x + z) % 7 === 0) continue;
      parked(c, ['sedan', 'hatchback', 'pickup'][k % 3], x, z, { paint: PAINTS[(k * 3 + 2) % PAINTS.length] });
      k++;
    }
  }
  for (const [x, z] of [[124, 78], [140, 78], [124, 110], [140, 110]]) c.place('streetlamp', x, z, { angle: x < 130 ? 0 : Math.PI });
}

/** Crude Acres: trailers in rows on gravel lanes, a trampoline or two, cars on blocks. */
function crudeAcres(c) {
  block(c, 146, 10, 44, 50, 'grass');
  c.flat(147, 23, 42, 2, CURB, { surface: 'gravel' });
  c.flat(147, 40, 42, 2, CURB, { surface: 'gravel' });
  c.flat(166, 11, 2, 48, CURB, { surface: 'gravel' });
  const colours = ['#e8e4dc', '#f0d9a8', '#c9d8e8', '#d8b8c8', '#cfe3c2', '#e8c8a0'];
  const stripes = ['#2c6ec8', '#c8382c', '#3a8a4a', '#e07a2a', '#6a3a8a'];
  let n = 0;
  for (const z of [13, 18, 27, 33, 44, 50]) {
    for (const x of [148, 154.5, 161, 169.5, 176, 182.5]) {
      if (z === 50 && x < 160) continue;
      c.prop('trailer', x, z, { w: 5, d: 2.4, y: CURB, colour: colours[n % colours.length], stripe: stripes[(n * 3) % stripes.length] });
      c.solid(x, CURB, z, x + 5, CURB + 1.6, z + 2.4);
      n++;
    }
  }
  // The trampolines: one out in the yard, one to bounce up onto a trailer's roof.
  for (const [x, z] of [[149, 53], [156, 48]]) {
    c.flat(x, z, 2, 2, CURB + 0.1, { surface: 'trampoline', wall: '#2c6ec8' });
    c.prop('trampoline', x, z, { w: 2, d: 2, y: CURB + 0.1 });
  }
  parked(c, 'pickup', 186.5, 56, { turn: 1, paint: '#8a5a3a' });
  c.place('junker', 152, 57, { angle: 0.4 });
  c.cylinder(152, 57, 0.9, 0, 0.9);
  for (const [x, z] of [[147.5, 22], [188.5, 22], [147.5, 39], [188.5, 39]]) c.place('streetlamp', x, z, { angle: x < 160 ? 0 : Math.PI });
  c.place('tree', 179, 56.5, { scale: 1.1 }).place('tree', 159, 37.5, { scale: 0.9 });
}

/** Baron's Hill: a big round hill, the oil baron's mansion on top, the drive straight up the front. */
export const BARON = { x: 218, z: 35, top: CURB + 5, flat: 7, reach: 24 };
function baronsHill(c) {
  block(c, 194, 10, 48, 50, 'lawn');
  const B = BARON;
  c.surface(195, 11, 46, 48, (X, Z) => {
    const r = Math.hypot(X - B.x, Z - B.z);
    return CURB + (B.top - CURB) * smooth(1 - (r - B.flat) / (B.reach - B.flat));
  }, { surface: 'lawn' });
  c.paint(217, 41, 2, 18, 'brick');
  c.block(213, 30, 10, 7, B.top + 3.2, { roof: 'pitched', ridge: 'x', wall: '#e8dcc0', facade: 'house', base: B.top, door: 's', pitch: 1.2, lit: 0.8 });
  for (const x of [212, 224]) c.place('statue', x, 40, { turn: 2 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.4) continue;
    c.place(i % 2 ? 'pine' : 'tree', B.x + Math.cos(a) * 17.5, B.z + Math.sin(a) * 17.5, { scale: 1.1, angle: i });
  }
  for (const x of [216.6, 219.4]) for (const z of [45, 51, 57]) c.place('streetlamp', x, z, { angle: x < 218 ? 0 : Math.PI, scale: 0.8 });
}

/** Wildcat Speedway: a dirt oval, banked round the ends, walled outside, a grandstand down the west side. */
export const OVAL = { x: 168, z0: 81, z1: 97, inner: 9, outer: 15 };
function speedway(c) {
  const O = OVAL;
  const rOf = (X, Z) => Math.hypot(X - O.x, Z - Math.min(O.z1, Math.max(O.z0, Z)));
  const bank = (X, Z) => smooth(Math.max(O.z0 - Z, Z - O.z1, 0) / 5);
  const height = (X, Z) => {
    const r = rOf(X, Z);
    if (r > O.outer + 2) return 0;
    const k = Math.max(0, Math.min(r, O.outer) - O.inner) / (O.outer - O.inner);
    return 1.4 * bank(X, Z) * k * k;
  };
  c.surface(146, 64, 44, 50, height, { surface: 'grass' });
  for (let j = 64; j < 114; j++) {
    for (let i = 146; i < 190; i++) {
      const r = rOf(i + 0.5, j + 0.5);
      if (r >= O.inner && r < O.outer + 0.3) c.paint(i, j, 1, 1, 'dirt');
      const gap = j >= 87 && j < 91;
      if (r >= O.outer + 0.3 && r < O.outer + 1.9 && !gap) c.flat(i, j, 1, 1, 2 + 1.4 * bank(i + 0.5, j + 0.5), { surface: 'concrete', wall: '#c8c2b4', wtex: 'block' });
    }
  }
  // The grandstand, in two halves either side of the way in.
  for (const [z, d] of [[72, 14], [92, 14]]) {
    c.flat(146, z, 2, d, 1.8, { surface: 'concrete', wall: '#9aa0aa', wtex: 'block' });
    c.flat(148, z, 2, d, 1.2, { surface: 'concrete', wall: '#9aa0aa', wtex: 'block' });
    c.flat(150, z, 1, d, 0.6, { surface: 'concrete', wall: '#9aa0aa', wtex: 'block' });
  }
  // The start and finish, chequered across the west straight.
  for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) c.mark(153 + i * 0.5, 88.5 + j * 0.5, 0.5, 0.5, '#f4f1ea');
  // In the middle: a jump, the pits.
  c.slope(166, 84, 4, 3, 0, 1.0, 'z', { surface: 'metal', wall: '#5a6068' });
  c.block(170, 92, 4, 3, 1.6, { wall: '#c8c2b4', wtex: 'corrugated' });
  c.prop('marquee', 168, 64.4, { w: 9, y: 0.6, h: 1.6, facing: 'n', text: 'WILDCAT SPEEDWAY', bg: '#1c1b1f', fg: '#f2c230' });
  for (const [x, z] of [[160, 73], [176, 73], [160, 105], [176, 105]]) c.place('streetlamp', x, z, { angle: x < 168 ? 0 : Math.PI });
}

/** The Quarry: a pit cut down in steps to a sandy floor, a haul road down the north side, the crusher and the blasting shed up top. */
export const PIT = { x: 218, z: 89, floor: -4.2 };
function quarry(c) {
  c.flat(194, 64, 48, 50, 0, { surface: 'gravel' });
  for (let j = 66; j < 112; j++) {
    for (let i = 196; i < 240; i++) {
      const r = Math.hypot(i + 0.5 - PIT.x, j + 0.5 - PIT.z);
      const level = r < 6 ? PIT.floor : r < 10.5 ? -2.8 : r < 15 ? -1.4 : 0;
      if (level < 0) c.flat(i, j, 1, 1, level, { surface: r < 6 ? 'sand' : 'gravel', wall: '#9a8a72' });
    }
  }
  c.slope(216, 70, 4, 14, 0, PIT.floor, 'z', { surface: 'dirt', wall: '#9a8a72' });
  c.paint(216, 64, 4, 6, 'dirt').paint(216, 84, 4, 6, 'dirt');
  c.block(228, 65, 6, 4, 3.0, { wall: '#c8c2b4', wtex: 'corrugated' });
  c.block(236, 72, 3, 3, 1.8, { wall: '#c8382c', wtex: 'corrugated' });
  c.prop('trailer', 198, 66, { w: 4, d: 2, y: 0 });
  c.solid(198, 0, 66, 202, 1.6, 68);
  parked(c, 'boxtruck', 213.5, 92, { paint: '#f2c230' });
  parked(c, 'boxtruck', 223, 87.5, { turn: 1, paint: '#e07a2a' });
  for (const [x, z, s] of [[208, 80, 2.4], [228, 98, 2.8], [206, 99, 2.2], [231, 82, 2.0], [221, 104, 2.6]]) c.place('rock', x, z, { scale: s, angle: x });
  for (const [x, z] of [[205, 76], [231, 102], [204, 102]]) c.place('streetlamp', x, z, { angle: Math.atan2(PIT.z - z, PIT.x - x) - Math.PI / 2 });
  c.lamp(PIT.x, PIT.z, { colour: '#ffd8a0', reach: 8, height: 3.5, y: PIT.floor });
  c.prop('sign', 214.6, 67, { text: 'BLASTING\nZONE', y: 0 });
}
