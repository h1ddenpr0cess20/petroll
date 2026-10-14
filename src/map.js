import { World } from './physics.js';
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
    this.districts = [];
    this.decks = [];
  }

  cell(x, z) {
    if (x < 0 || z < 0 || x >= this.cols || z >= this.rows) return null;
    return this.cells[z * this.cols + x];
  }

  /** Tiles over the rectangle, each corner at `height(X, Z)` (grid coordinates). */
  surface(x, z, w, d, height, { surface = 'grass', wall = null } = {}) {
    for (let j = z; j < z + d; j++) {
      for (let i = x; i < x + w; i++) {
        if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) throw new Error(`${this.name}: tile ${i},${j} is off the map`);
        this.cells[j * this.cols + i] = {
          h: [height(i, j), height(i + 1, j), height(i, j + 1), height(i + 1, j + 1)],
          surface, wall,
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
  block(x, z, w, d, h, { roof = 'flat', ridge = 'x', pitch = 1.1, wall = '#e6dccb', surface = null } = {}) {
    if (roof === 'flat') return this.flat(x, z, w, d, h, { surface: surface ?? 'flatroof', wall });
    const across = ridge === 'x' ? (X, Z) => Math.abs((Z - z) / d * 2 - 1) : (X) => Math.abs((X - x) / w * 2 - 1);
    return this.surface(x, z, w, d, (X, Z) => h + pitch * (1 - across(X, Z)), { surface: surface ?? 'roof', wall });
  }

  /** Paint on the ground: a rectangle of `colour`, lying on whatever is under it. */
  mark(x, z, w, d, colour = '#f2f0e8') {
    this.marks.push({ x, z, w, d, colour });
    return this;
  }

  /** A prop: something built from plain shapes (see `props.js`). */
  prop(type, x, z, opts = {}) {
    this.props.push({ type, x, z, ...opts });
    return this;
  }

  /** A box nothing rolls through, in world coordinates. */
  solid(x0, y0, z0, x1, y1, z1) {
    this.solids.push({ min: [x0, y0, z0], max: [x1, y1, z1] });
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
   * drives it: 'car', 'truck' or 'tanker'.
   */
  road(points, { cars = 3, speed = 4, kind = 'car', brakes = true, open = false } = {}) {
    this.roads.push({ points, cars, speed, kind, brakes, open });
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

  /** A golden seed: one of the things the whole game is about. `y` sets it on a deck or a lift's top. */
  goldenSeed(name, x, z, { y = null } = {}) {
    this.golden.push({ name, x, z, y });
    return this;
  }

  /** An air pump: tops the bubble up, and it is where the hamster comes back to after a pop. */
  airPump(name, x, z) {
    this.pumps.push({ name, x, z });
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

  /** The top of whatever is under (x, z): the ground, or a deck over it if there is one below `under`. */
  topAt(x, z, under = Infinity) {
    let y = this.heightAt(x, z);
    for (const s of this.solids) {
      if (x >= s.min[0] && x <= s.max[0] && z >= s.min[2] && z <= s.max[2] && s.max[1] <= under) y = Math.max(y ?? -Infinity, s.max[1]);
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

/** The surfaces with no grain to them, which can be turned any way. */
const TURNS = new Set(['grass', 'dirt', 'gravel', 'sand', 'berm', 'oil', 'tar', 'flatroof', 'road', 'concrete', 'forecourt', 'wet']);

/** A little per-tile variation, the same every time. */
const hash = (x, z) => {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/**
 * Everything drawn and everything collided with, from the tiles: the tops
 * (grouped by surface, so each can have its own texture; one quad per
 * tile with the whole texture on it), the walls down the sides, and a
 * World holding both as triangles for the physics, plus the still boxes.
 */
export function buildMap(map) {
  const world = new World({ cols: map.cols, rows: map.rows });
  const tops = new Map();
  const walls = { position: [], normal: [], color: [] };

  const face = (out, a, b, c, normal, colours, uvs) => {
    out.position.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) out.normal.push(...normal);
    out.color.push(...colours[0], ...colours[1], ...colours[2]);
    if (uvs) out.uv.push(...uvs[0], ...uvs[1], ...uvs[2]);
    world.addTriangle(...a, ...b, ...c);
  };

  const normalOf = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };

  const wallTriangle = (a, b, c, out, shade) => {
    let n = normalOf(a, b, c);
    if (n[0] * out[0] + n[2] * out[2] < 0) { [b, c] = [c, b]; n = normalOf(a, b, c); }
    face(walls, a, b, c, n, [shade(a[1]), shade(b[1]), shade(c[1])]);
  };

  const colours = new Map();
  const colour = (hex) => {
    if (!colours.has(hex)) colours.set(hex, linearRGB(hex));
    return colours.get(hex);
  };

  for (let z = 0; z < map.rows; z++) {
    for (let x = 0; x < map.cols; x++) {
      const c = map.cell(x, z);
      if (!c) continue;
      const kind = surfaceOf(c);
      if (!tops.has(c.surface)) tops.set(c.surface, { position: [], normal: [], color: [], uv: [] });
      const out = tops.get(c.surface);
      const [h00, h10, h01, h11] = c.h;
      // The colour is in the surface's texture; the tile only varies it a little.
      const tint = 0.94 + 0.06 * hash(x, z);
      const col = [tint, tint, tint];
      const A = [x, h00, z], B = [x + 1, h10, z], C = [x, h01, z + 1], D = [x + 1, h11, z + 1];
      // Each tile's texture turned a quarter at random, so the grass and dirt don't look tiled;
      // what has a direction (mowing stripes, planks, slabs, shingles) keeps it.
      const turns = TURNS.has(c.surface) ? Math.floor(hash(z, x) * 4) : 0;
      const uvA = [[0, 1], [1, 1], [1, 0], [0, 0]];
      const uv = (k) => uvA[(k + turns) % 4];
      face(out, A, C, B, normalOf(A, C, B), [col, col, col], [uv(0), uv(3), uv(1)]);
      face(out, B, C, D, normalOf(B, C, D), [col, col, col], [uv(1), uv(3), uv(2)]);

      // The sides: down to the next tile, or into the ground.
      const wallBase = colour(c.wall ?? kind.wall);
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
          const k = Math.max(0, Math.min(1, 1 - (top - y) / 6));
          return wallBase.map((v) => v * (0.45 + 0.55 * k));
        };
        const at = (p, y) => [p[0], y, p[1]];
        const lerp = (t) => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
        const d0 = a0 - b0, d1 = a1 - b1;
        if (d0 <= 1e-6 && d1 <= 1e-6) continue;
        if (d0 >= -1e-6 && d1 >= -1e-6) {
          if (d0 > 1e-6) wallTriangle(at(p0, b0), at(p1, b1), at(p0, a0), outward, shade);
          if (d1 > 1e-6) wallTriangle(at(p1, b1), at(p1, a1), at(p0, a0), outward, shade);
        } else {
          const t = d0 / (d0 - d1);
          const m = lerp(t);
          const ym = a0 + (a1 - a0) * t;
          if (d0 > 0) wallTriangle(at(p0, b0), at(m, ym), at(p0, a0), outward, shade);
          else wallTriangle(at(p1, b1), at(p1, a1), at(m, ym), outward, shade);
        }
      }
    }
  }

  world.finish();
  for (const s of map.solids) world.addStatic({ min: [...s.min], max: [...s.max] });
  const typed = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, new Float32Array(v)]));
  return {
    tops: new Map([...tops].map(([k, v]) => [k, typed(v)])),
    walls: typed(walls),
    world,
  };
}
