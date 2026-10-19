import { World } from './physics.js';
import { MODELS } from './models/index.js';
import { FACADES } from './paint.js';
import { surfaceOf } from './surfaces.js';

/**
 * The world is one big grid of tiles, each with its own four corner heights
 * and what it is made of — so a tile can be flat road, a ramp, a pitched
 * roof or a lump of the oil field, and two tiles side by side can be at
 * different heights with a wall between them (a curb, a loading dock, the
 * side of a house).
 *
 * On top of the tiles go the things the world is furnished with: road
 * paint (`marks`), props (pumps, pumpjacks, signs, trees; `props`), and
 * the solid boxes the props stand in (`solids`). Moving things are listed
 * here too and set going elsewhere.
 */

/** How far the sides of the world reach down below a tile with nothing next to it. */
export const DEPTH = 5;

/** Corner order: (x, z), (x + 1, z), (x, z + 1), (x + 1, z + 1). */
const H00 = 0, H10 = 1, H01 = 2, H11 = 3;

export class TownMap {
  constructor({ name, cols, rows }) {
    this.name = name;
    this.cols = cols;
    this.rows = rows;
    this.cells = new Array(cols * rows).fill(null);
    this.start = { x: 0, z: 0 };
    this.marks = [];
    this.props = [];
    this.solids = [];
    this.roads = [];
    this.pumpjacks = [];
    this.flares = [];
    this.lifts = [];
    this.drums = [];
    this.seeds = [];
    this.golden = [];
    this.pumps = [];
    this.givers = [];
    this.critters = [];
    this.jobs = [];
    this.knocks = [];
    this.shops = [];
    this.districts = [];
    this.decks = [];
    this.lamps = [];
    this.cylinders = [];
    this.models = [];
    this.buildings = [];
  }

  cell(x, z) {
    if (x < 0 || z < 0 || x >= this.cols || z >= this.rows) return null;
    return this.cells[z * this.cols + x];
  }

  /** Tiles over the rectangle, each corner at `height(X, Z)` (grid coordinates). */
  surface(x, z, w, d, height, { surface = 'grass', wall = null, wtex = null } = {}) {
    for (let j = z; j < z + d; j++) {
      for (let i = x; i < x + w; i++) {
        if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) throw new Error(`${this.name}: tile ${i},${j} is off the map`);
        this.cells[j * this.cols + i] = {
          h: [height(i, j), height(i + 1, j), height(i, j + 1), height(i + 1, j + 1)],
          surface, wall, wtex,
        };
      }
    }
    return this;
  }

  flat(x, z, w, d, h, opts) {
    return this.surface(x, z, w, d, () => h, opts);
  }

  /** A ramp: `from` along its first edge, `to` along its last, running along `axis`. */
  slope(x, z, w, d, from, to, axis, opts) {
    const along = axis === 'x' ? (X) => (X - x) / w : (X, Z) => (Z - z) / d;
    return this.surface(x, z, w, d, (X, Z) => from + (to - from) * along(X, Z), opts);
  }

  /** Re-surface tiles that are already there, keeping their heights. */
  paint(x, z, w, d, surface) {
    for (let j = z; j < z + d; j++) for (let i = x; i < x + w; i++) {
      const c = this.cell(i, j);
      if (c) c.surface = surface;
    }
    return this;
  }

  /** Lower (or raise) tiles that are already there by `dy`. */
  raise(x, z, w, d, dy) {
    for (let j = z; j < z + d; j++) for (let i = x; i < x + w; i++) {
      const c = this.cell(i, j);
      if (c) c.h = c.h.map((v) => v + dy);
    }
    return this;
  }

  /**
   * A building: walls `h` high in `wall`'s colour, and a roof on top —
   * flat, or pitched along `ridge` ('x' or 'z') rising `pitch` to the
   * ridge line.
   */
  block(x, z, w, d, h, { roof = 'flat', ridge = 'x', pitch = 1.1, wall = '#e6dccb', surface = null, facade = null, base = 0, door = null, lit = 0.5, wtex = null } = {}) {
    if (roof === 'flat') this.flat(x, z, w, d, h, { surface: surface ?? 'flatroof', wall, wtex });
    else {
      const across = ridge === 'x' ? (X, Z) => Math.abs((Z - z) / d * 2 - 1) : (X) => Math.abs((X - x) / w * 2 - 1);
      this.surface(x, z, w, d, (X, Z) => h + pitch * (1 - across(X, Z)), { surface: surface ?? 'roof', wall });
    }
    if (facade) {
      // Its walls drawn as a building's face, storey by storey from `base`; a door in the middle of side `door`.
      for (let j = z; j < z + d; j++) for (let i = x; i < x + w; i++) {
        const c = this.cell(i, j);
        const mid = (door === 'n' || door === 's') ? i === x + Math.floor(w / 2) : j === z + Math.floor(d / 2);
        const edge = door === 'n' ? j === z : door === 's' ? j === z + d - 1 : door === 'w' ? i === x : i === x + w - 1;
        c.facade = { style: facade, base, top: h, door: door && mid && edge ? door : null };
      }
      this.buildings.push({ x, z, w, d, h, base, facade, roof, ridge, pitch, wall, door, lit });
    }
    return this;
  }

  /** Paint on the ground: a rectangle of `colour`, lying on whatever is under it. */
  mark(x, z, w, d, colour = '#f2f0e8') {
    this.marks.push({ x, z, w, d, colour });
    return this;
  }

  /**
   * A sculpted model (`models/`) standing at (x, z), turned `turn` quarter
   * turns (or `angle` radians), on the ground or at `y`, `scale`d, its
   * paint `paint` (a vehicle's). What in it is solid goes into the solids
   * and cylinders, and its lights into the lamps.
   */
  place(name, x, z, { turn = 0, angle = turn * Math.PI / 2, y = null, scale = 1, paint = null } = {}) {
    const def = MODELS[name];
    if (!def) throw new Error(`${this.name}: no model called ${name}`);
    const base = y ?? this.heightAt(x, z) ?? 0;
    const c = Math.cos(angle), s = Math.sin(angle);
    // Local (lx, lz) to the map: turned about y (+z toward +x), then moved.
    const at = (lx, lz) => [x + (lx * c + lz * s) * scale, z + (-lx * s + lz * c) * scale];
    for (const col of def.colliders ?? []) {
      if (col.cyl) {
        const [cx, cz, r, y0, y1] = col.cyl;
        const [wx, wz] = at(cx, cz);
        this.cylinder(wx, wz, r * scale, base + y0 * scale, base + y1 * scale);
      } else {
        const [x0, y0, z0, x1, y1, z1] = col.box;
        const corners = [at(x0, z0), at(x1, z0), at(x0, z1), at(x1, z1)];
        this.solid(Math.min(...corners.map((q) => q[0])), base + y0 * scale, Math.min(...corners.map((q) => q[1])),
          Math.max(...corners.map((q) => q[0])), base + y1 * scale, Math.max(...corners.map((q) => q[1])));
      }
    }
    for (const [lx, ly, lz, colour, reach] of def.lights ?? []) {
      const [wx, wz] = at(lx, lz);
      this.lamp(wx, wz, { colour, reach, height: ly * scale, y: base });
    }
    this.models.push({ name, x, z, y: base, angle, scale, paint });
    return this;
  }

  /** A prop: something built from plain shapes (see `structures.js`). */
  prop(type, x, z, opts = {}) {
    this.props.push({ type, x, z, ...opts });
    return this;
  }

  /** A box nothing rolls through, in world coordinates. */
  solid(x0, y0, z0, x1, y1, z1) {
    this.solids.push({ min: [x0, y0, z0], max: [x1, y1, z1] });
    return this;
  }

  /** An upright cylinder nothing rolls through (a tank, a trunk, a post), standing on `y0` up to `y1`; it can be stood on. */
  cylinder(x, z, r, y0, y1) {
    this.cylinders.push({ x, z, r, y0, y1 });
    return this;
  }

  /** A deck on stilts (a bridge, a catwalk, a roof) the tiles under it pass beneath: solid, and drawn. A `roof` fades while the hamster is under it. */
  deck(x, z, w, d, h, { thick = 0.3, colour = '#9a9a9e', roof = false } = {}) {
    this.decks.push({ x, z, w, d, h, thick, colour, roof });
    return this.solid(x, h - thick, z, x + w, h, z + d);
  }

  /**
   * A loop the traffic drives round: tile-centre points in order, `cars`
   * spaced evenly round it at `speed` tiles a second. `kind` is what
   * drives it: 'car', 'truck' or 'tanker'. A road `over` a bridge drives
   * up on its deck.
   */
  road(points, { cars = 3, speed = 4, kind = 'car', brakes = true, open = false, over = false } = {}) {
    this.roads.push({ points, cars, speed, kind, brakes, open, over });
    return this;
  }

  /** A pumpjack nodding over the tile at (x, z): the head comes down on it every `period` seconds. */
  pumpjack(x, z, { facing = 'x', period = 3.2, phase = 0, lift = 1.8 } = {}) {
    this.pumpjacks.push({ x, z, facing, period, phase, lift });
    return this;
  }

  /** A gas vent in the ground: it flares up for a while every `period` seconds. */
  flare(x, z, { period = 3, phase = 0, burn = 0.35 } = {}) {
    this.flares.push({ x, z, period, phase, burn });
    return this;
  }

  /** A platform with its top at `h`, gliding out by `to` and back every `period` seconds. */
  lift(x, z, w, d, h, { to, period = 6, phase = 0, pause = 0.26 }) {
    this.lifts.push({ x, z, w, d, h, to, period, phase, pause });
    return this;
  }

  /** An oil drum that rolls after the hamster when it comes near. */
  drum(x, z, { range = 7 } = {}) {
    this.drums.push({ x: x + 0.5, z: z + 0.5, range });
    return this;
  }

  /** Sunflower seeds in a line from (x0, z0) to (x1, z1), `n` of them; on the ground, or at `y` (on a deck). */
  seedLine(x0, z0, x1, z1, n, { y = null } = {}) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.seeds.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, y });
    }
    return this;
  }

  /** A golden seed: one of the things to find. `y` sets it on a deck or a lift's top. */
  goldenSeed(name, x, z, { y = null } = {}) {
    this.golden.push({ name, x, z, y });
    return this;
  }

  /**
   * Somebody in town with work going: one of the cast (`look`, see
   * `cast/`), standing at (x, z), who hands out the jobs that name them
   * (`job`).
   */
  giver(id, name, x, z, { look = 'tourist', y = null, angle = null, line = '' } = {}) {
    this.givers.push({ id, name, x, z, y, look, angle, line });
    return this;
  }

  /** An animal about town (from the cast: a cat, a pigeon, a corgi...), sitting or going about its business. */
  critter(look, x, z, { y = null, angle = null, clip = null, size = 1 } = {}) {
    this.critters.push({ look, x, z, y, angle, clip, size });
    return this;
  }

  /**
   * A job: what somebody wants doing, as stages done one after another
   * (see `jobs.js`), against the clock. `after` is the id of a job that
   * has to be done first.
   */
  job(def) {
    this.jobs.push({ reward: 100, time: 60, after: null, ...def });
    return this;
  }

  /** Something standing about to be knocked flying, for a little cash: a cone, a bin, a flamingo, a crate, a sign. */
  knock(kind, x, z, { y = null, angle = 0 } = {}) {
    this.knocks.push({ kind, x, z, y, angle });
    return this;
  }

  /** The bubble shop: a pad to roll onto, to spend what the jobs pay. */
  shop(name, x, z) {
    this.shops.push({ name, x, z });
    return this;
  }

  /** An air pump: tops the bubble up, and it is where the hamster comes back to after a pop. */
  airPump(name, x, z) {
    this.pumps.push({ name, x, z });
    // The pump itself stands at the pad's corner.
    return this.place('airpump', x + 0.72, z - 0.72);
  }

  /**
   * A light: a lamp head `height` above the ground at (x, z), throwing
   * `colour` over `reach` tiles. Its glow is baked into the ground and the
   * walls round it, and the lamps nearest the hamster light it for real.
   */
  lamp(x, z, { colour = '#ffb35a', reach = 6, height = 3, glow = 1, y = null } = {}) {
    this.lamps.push({ x, z, colour, reach, height, glow, y });
    return this;
  }

  /** A named part of the map, for the banner when the hamster first rolls in and for the minimap. */
  district(name, x, z, w, d, colour) {
    this.districts.push({ name, x, z, w, d, colour });
    return this;
  }

  districtAt(x, z) {
    for (const d of this.districts) if (x >= d.x && x < d.x + d.w && z >= d.z && z < d.z + d.d) return d;
    return null;
  }

  /** The height of the ground under (x, z), or null off the map. */
  heightAt(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    const c = this.cell(i, j);
    if (!c) return null;
    const u = x - i, w = z - j, h = c.h;
    if (u + w <= 1) return h[H00] + (h[H10] - h[H00]) * u + (h[H01] - h[H00]) * w;
    return h[H11] + (h[H01] - h[H11]) * (1 - u) + (h[H10] - h[H11]) * (1 - w);
  }

  /** What a car drives on at (x, z): the ground, or a deck over it no higher than `reach` (a road bridge). */
  roadAt(x, z, reach = 3.5) {
    let y = this.heightAt(x, z) ?? 0;
    for (const d of this.decks) if (d.h <= reach && x >= d.x && x <= d.x + d.w && z >= d.z && z <= d.z + d.d) y = Math.max(y, d.h);
    return y;
  }

  /** The top of whatever is under (x, z): the ground, or a deck over it if there is one below `under`. */
  topAt(x, z, under = Infinity) {
    let y = this.heightAt(x, z);
    for (const s of this.solids) {
      if (x >= s.min[0] && x <= s.max[0] && z >= s.min[2] && z <= s.max[2] && s.max[1] <= under) y = Math.max(y ?? -Infinity, s.max[1]);
    }
    for (const cy of this.cylinders) {
      if (Math.hypot(x - cy.x, z - cy.z) <= cy.r && cy.y1 <= under) y = Math.max(y ?? -Infinity, cy.y1);
    }
    return y;
  }

  /**
   * Somewhere to put the hamster back after the tar: a level tile that
   * doesn't sink, with level tiles at the same height all round it and
   * nothing solid standing on it.
   */
  isSafe(x, z) {
    const c = this.cell(x, z);
    if (!c || !isFlat(c) || surfaceOf(c).sinks) return false;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const n = this.cell(x + i, z + j);
        if (!n || !isFlat(n) || surfaceOf(n).sinks || Math.abs(n.h[0] - c.h[0]) > 1e-6) return false;
      }
    }
    for (const s of this.solids) {
      if (s.max[0] > x - 0.2 && s.min[0] < x + 1.2 && s.max[2] > z - 0.2 && s.min[2] < z + 1.2 && s.max[1] > c.h[0] && s.min[1] < c.h[0] + 1.5) return false;
    }
    for (const cy of this.cylinders) {
      const dx = Math.max(x - 0.2 - cy.x, 0, cy.x - (x + 1.2)), dz = Math.max(z - 0.2 - cy.z, 0, cy.z - (z + 1.2));
      if (Math.hypot(dx, dz) < cy.r && cy.y1 > c.h[0] && cy.y0 < c.h[0] + 1.5) return false;
    }
    return true;
  }
}

export const isFlat = (c) => c.h.every((v) => Math.abs(v - c.h[0]) < 1e-6);

/** sRGB hex to linear RGB — vertex colours are linear. */
export function linearRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

/** The night, everywhere: what the ground looks like with no lamp near it. */
export const AMBIENT = Object.freeze([0.3, 0.32, 0.46]);

/**
 * The light baked into the ground and the walls: the night everywhere, and
 * a pool round every lamp, warm under the sodium lamps, white under the
 * canopy, orange round the flares.
 */
export function bakeLight(map) {
  const lamps = map.lamps.map((l) => {
    const y = (l.y ?? map.heightAt(l.x, l.z) ?? 0) + l.height;
    return { x: l.x, y, z: l.z, reach: l.reach, colour: linearRGB(l.colour).map((v) => v * l.glow * 2.4) };
  });
  // Bucketed, so each point only looks at the lamps near it.
  const B = 8, buckets = new Map();
  for (const l of lamps) {
    for (let bz = Math.floor((l.z - l.reach) / B); bz <= Math.floor((l.z + l.reach) / B); bz++) {
      for (let bx = Math.floor((l.x - l.reach) / B); bx <= Math.floor((l.x + l.reach) / B); bx++) {
        const k = `${bx},${bz}`;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(l);
      }
    }
  }
  return (x, y, z) => {
    const out = [...AMBIENT];
    for (const l of buckets.get(`${Math.floor(x / B)},${Math.floor(z / B)}`) ?? []) {
      const d = Math.hypot(x - l.x, (y - l.y) * 0.6, z - l.z);
      if (d >= l.reach) continue;
      const k = (1 - d / l.reach) ** 2;
      out[0] += l.colour[0] * k; out[1] += l.colour[1] * k; out[2] += l.colour[2] * k;
    }
    return out.map((v) => Math.min(1.8, v));
  };
}

/** The floor textures with no grain to them, which can be turned any way. */
const TURNS = new Set(['grass', 'dirt', 'scree', 'sand', 'asphalt', 'concrete', 'cobble', 'plate']);

/** A little per-tile variation, the same every time. */
const hash = (x, z) => {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/**
 * Everything drawn and everything collided with, from the tiles: the tops
 * (a layer for each surface, one quad per tile with the whole floor texture
 * on it, turned and flipped its own way where the texture has no grain),
 * the walls down the sides (cut into bands a tile high so the bricks and
 * boards line up, a layer for each wall texture), the night's light baked
 * into both, and a World holding it all as triangles for the physics, with
 * the still boxes.
 */
export function buildMap(map) {
  const world = new World({ cols: map.cols, rows: map.rows });
  const blank = () => ({ position: [], normal: [], color: [], uv: [] });
  const tops = new Map(), walls = new Map();
  const layer = (m, k) => {
    if (!m.has(k)) m.set(k, blank());
    return m.get(k);
  };
  const light = bakeLight(map);
  const colours = new Map();
  const colour = (hex) => {
    if (!colours.has(hex)) colours.set(hex, linearRGB(hex));
    return colours.get(hex);
  };
  const lit = (base, p) => {
    const l = light(p[0], p[1], p[2]);
    return [base[0] * l[0], base[1] * l[1], base[2] * l[2]];
  };

  const normalOf = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };
  const face = (out, a, b, c, normal, cols, uvs) => {
    out.position.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) out.normal.push(...normal);
    out.color.push(...cols[0], ...cols[1], ...cols[2]);
    out.uv.push(...uvs[0], ...uvs[1], ...uvs[2]);
  };

  /** One wall along p0 → p1 between the bottom and the top lines (`poly` in [t, y]), facing `out`: whole to the physics, in bands to the mesh. */
  const wall = (key, p0, p1, poly, out, shade, len) => {
    const at = (t, y) => [p0[0] + (p1[0] - p0[0]) * t, y, p0[1] + (p1[1] - p0[1]) * t];
    const pts = poly.map(([t, y]) => at(t, y));
    const facing = (a, b, c) => {
      const n = normalOf(a, b, c);
      return n[0] * out[0] + n[2] * out[2] < 0 ? null : n;
    };
    for (let k = 1; k < pts.length - 1; k++) {
      let a = pts[0], b = pts[k], c = pts[k + 1];
      if (!facing(a, b, c)) [b, c] = [c, b];
      world.addTriangle(...a, ...b, ...c);
    }
    const lowY = Math.min(...poly.map((p) => p[1])), highY = Math.max(...poly.map((p) => p[1]));
    for (let y0 = Math.floor(lowY); y0 < highY; y0++) {
      const band = clip(clip(poly, (p) => p[1] - y0), (p) => y0 + 1 - p[1]);
      if (band.length < 3) continue;
      const bp = band.map(([t, y]) => at(t, y));
      for (let k = 1; k < band.length - 1; k++) {
        let ib = k, ic = k + 1;
        let n = facing(bp[0], bp[ib], bp[ic]);
        if (!n) { [ib, ic] = [ic, ib]; n = normalOf(bp[0], bp[ib], bp[ic]); }
        const vs = [0, ib, ic];
        face(layer(walls, key), bp[0], bp[ib], bp[ic], n,
          vs.map((v) => lit(shade(band[v][1]), bp[v])),
          vs.map((v) => [band[v][0] * len, 1 - (band[v][1] - y0)]));
      }
    }
  };

  /**
   * A building's wall: whole to the physics; to the mesh in bands a storey
   * high from the building's foot, each with the whole facade texture on it
   * — the door's on the bottom storey where there is one, the plain gable
   * above the eaves.
   */
  const facadeWall = (f, side, p0, p1, poly, out, base) => {
    const at = (t, y) => [p0[0] + (p1[0] - p0[0]) * t, y, p0[1] + (p1[1] - p0[1]) * t];
    const pts = poly.map(([t, y]) => at(t, y));
    const facing = (a, b, cc) => {
      const n = normalOf(a, b, cc);
      return n[0] * out[0] + n[2] * out[2] < 0 ? null : n;
    };
    for (let k = 1; k < pts.length - 1; k++) {
      let a = pts[0], b = pts[k], cc = pts[k + 1];
      if (!facing(a, b, cc)) [b, cc] = [cc, b];
      world.addTriangle(...a, ...b, ...cc);
    }
    const storey = FACADES[f.style].storey;
    const highY = Math.max(...poly.map((p) => p[1]));
    // Faces read left to right from outside: flip u on the sides where the edge runs the other way.
    const flip = side === 'n' || side === 'e';
    for (let y0 = f.base, k = 0; y0 < highY - 1e-4; y0 += storey, k++) {
      const band = clip(clip(poly, (p) => p[1] - y0), (p) => y0 + storey - p[1]);
      if (band.length < 3) continue;
      const style = y0 >= f.top - 1e-3 ? (f.style === 'house' ? 'gable' : f.style) : k === 0 && f.door === side ? (f.style === 'house' ? 'house-door' : f.style) : f.style;
      const bp = band.map(([t, y]) => at(t, y));
      for (let q = 1; q < band.length - 1; q++) {
        let ib = q, ic = q + 1;
        let n = facing(bp[0], bp[ib], bp[ic]);
        if (!n) { [ib, ic] = [ic, ib]; n = normalOf(bp[0], bp[ib], bp[ic]); }
        const vs = [0, ib, ic];
        face(layer(walls, `facade:${style}`), bp[0], bp[ib], bp[ic], n,
          vs.map((v) => lit(base, bp[v])),
          vs.map((v) => [flip ? 1 - band[v][0] : band[v][0], 1 - (band[v][1] - y0) / storey]));
      }
    }
  };

  for (let z = 0; z < map.rows; z++) {
    for (let x = 0; x < map.cols; x++) {
      const c = map.cell(x, z);
      if (!c) continue;
      const kind = surfaceOf(c);
      const [h00, h10, h01, h11] = c.h;
      const tint = 0.92 + 0.08 * hash(x, z);
      const col = colour(c.top ?? kind.top).map((v) => v * tint);
      const A = [x, h00, z], B = [x + 1, h10, z], C = [x, h01, z + 1], D = [x + 1, h11, z + 1];
      // Each tile turned and flipped its own way where the texture has no grain, so it doesn't repeat.
      const spin = TURNS.has(kind.tex) ? Math.floor(hash(z, x) * 8) : 0;
      const uv = ([u, v]) => {
        if (spin & 4) u = 1 - u;
        for (let k = 0; k < (spin & 3); k++) [u, v] = [v, 1 - u];
        return [u, v];
      };
      if (!c.hidden) {
        const out = layer(tops, c.surface);
        face(out, A, C, B, normalOf(A, C, B), [lit(col, A), lit(col, C), lit(col, B)], [uv([0, 1]), uv([0, 0]), uv([1, 1])]);
        face(out, B, C, D, normalOf(B, C, D), [lit(col, B), lit(col, C), lit(col, D)], [uv([1, 1]), uv([0, 0]), uv([1, 0])]);
      }
      world.addTriangle(...A, ...C, ...B);
      world.addTriangle(...B, ...C, ...D);

      // The sides: down to the next tile, or into the ground.
      const wallBase = colour(c.wall ?? kind.wall);
      const key = c.hidden ? null : c.wtex ?? kind.wtex;
      const low = Math.min(...c.h) - DEPTH;
      const edges = [
        [[x, z], [x + 1, z], h00, h10, map.cell(x, z - 1), (n) => [n.h[H01], n.h[H11]], [0, 0, -1]],
        [[x, z + 1], [x + 1, z + 1], h01, h11, map.cell(x, z + 1), (n) => [n.h[H00], n.h[H10]], [0, 0, 1]],
        [[x, z], [x, z + 1], h00, h01, map.cell(x - 1, z), (n) => [n.h[H10], n.h[H11]], [-1, 0, 0]],
        [[x + 1, z], [x + 1, z + 1], h10, h11, map.cell(x + 1, z), (n) => [n.h[H00], n.h[H01]], [1, 0, 0]],
      ];
      for (const [p0, p1, a0, a1, n, theirs, outward] of edges) {
        const [b0, b1] = n ? theirs(n) : [low, low];
        const top = Math.max(a0, a1);
        const shade = (y) => {
          const k = Math.max(0, Math.min(1, 1 - (top - y) / 4));
          return wallBase.map((v) => v * (0.35 + 0.65 * k));
        };
        const d0 = a0 - b0, d1 = a1 - b1;
        if (d0 <= 1e-6 && d1 <= 1e-6) continue;
        const side = outward[2] < 0 ? 'n' : outward[2] > 0 ? 's' : outward[0] < 0 ? 'w' : 'e';
        const add = (poly) => {
          if (c.facade) facadeWall(c.facade, side, p0, p1, poly, outward, wallBase);
          else if (key) wall(key, p0, p1, poly, outward, shade, 1);
          else {
            // Hidden (a building draws its own): to the physics only.
            const at = (t, y) => [p0[0] + (p1[0] - p0[0]) * t, y, p0[1] + (p1[1] - p0[1]) * t];
            const pts = poly.map(([t, y]) => at(t, y));
            for (let k = 1; k < pts.length - 1; k++) {
              let a = pts[0], b = pts[k], cc = pts[k + 1];
              const nn = normalOf(a, b, cc);
              if (nn[0] * outward[0] + nn[2] * outward[2] < 0) [b, cc] = [cc, b];
              world.addTriangle(...a, ...b, ...cc);
            }
          }
        };
        if (d0 >= -1e-6 && d1 >= -1e-6) add([[0, b0], [1, b1], [1, a1], [0, a0]]);
        else {
          const t = d0 / (d0 - d1);
          const ym = a0 + (a1 - a0) * t;
          if (d0 > 0) add([[0, b0], [t, ym], [0, a0]]);
          else add([[1, b1], [1, a1], [t, ym]]);
        }
      }
    }
  }

  world.finish();
  for (const s of map.solids) world.addStatic({ min: [...s.min], max: [...s.max] });
  for (const cy of map.cylinders) world.addCylinder({ ...cy });
  const typed = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, new Float32Array(v)]));
  return {
    tops: new Map([...tops].map(([k, v]) => [k, typed(v)])),
    walls: new Map([...walls].map(([k, v]) => [k, typed(v)])),
    world,
    light,
  };
}

/** The part of a polygon of [t, y] points where `inside(p) >= 0` (Sutherland–Hodgman, against one line). */
function clip(poly, inside) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = inside(a), fb = inside(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out.filter((p, i) => {
    const q = out[(i + 1) % out.length];
    return out.length < 2 || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-7;
  });
}
