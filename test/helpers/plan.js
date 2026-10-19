/**
 * Finding a way across the town, tile by tile, the way the bubble can go:
 * on to a neighbouring tile that is level with this one or a curb higher at
 * most, or down off one no further than `drop`; never through anything
 * solid; round tar, and the interstate, and oil and the pumpjacks' heads
 * and the flares unless there is no other way. A*, eight ways.
 */

const CLIMB = 0.16;

/** The heights along the edge a tile shares with its neighbour (dx, dz): mine, then theirs. */
function edge(c, n, dx, dz) {
  const H = c.h, N = n.h;
  if (dx === 1) return [[H[1], H[3]], [N[0], N[2]]];
  if (dx === -1) return [[H[0], H[2]], [N[1], N[3]]];
  if (dz === 1) return [[H[2], H[3]], [N[0], N[1]]];
  return [[H[0], H[1]], [N[2], N[3]]];
}

const top = (c) => Math.max(...c.h);

export function createPlanner(map, { drop = 2.2, radius = 0.36 } = {}) {
  const { cols, rows } = map;
  // The bridges: a tile under a bridge's deck is the deck, to the planner (not under a roof, though: there's a way under that).
  const over = new Map();
  for (const d of map.decks) {
    if (d.h > 3.5 || d.roof) continue;
    for (let z = Math.ceil(d.z); z + 1 <= d.z + d.d + 1e-6; z++) {
      for (let x = Math.ceil(d.x); x + 1 <= d.x + d.w + 1e-6; x++) {
        const c = map.cell(x, z);
        if (c) over.set(z * cols + x, { ...c, h: [d.h, d.h, d.h, d.h], surface: 'concrete', deck: true });
      }
    }
  }
  map = Object.assign(Object.create(map), { cell: (x, z) => (x < 0 || z < 0 || x >= cols || z >= rows ? null : over.get(z * cols + x) ?? Object.getPrototypeOf(map).cell.call(map, x, z)) });
  const R = radius + 0.06;
  // The solids and the cylinders, bucketed by the tiles they (grown by the ball) cover.
  const buckets = new Map();
  const file = (o, x0, z0, x1, z1) => {
    for (let z = Math.floor(z0 - R); z <= Math.floor(z1 + R); z++) {
      for (let x = Math.floor(x0 - R); x <= Math.floor(x1 + R); x++) {
        const k = z * cols + x;
        if (!buckets.has(k)) buckets.set(k, { solids: [], cylinders: [] });
        buckets.get(k)[o.min ? 'solids' : 'cylinders'].push(o);
      }
    }
  };
  for (const s of map.solids) file(s, s.min[0], s.min[2], s.max[0], s.max[2]);
  // (The townsfolk stand their ground too.)
  for (const c of [...map.cylinders, ...map.givers.map((g) => ({ x: g.x, z: g.z, r: 0.34, y0: g.y ?? map.heightAt(g.x, g.z), y1: (g.y ?? map.heightAt(g.x, g.z)) + 1.6 }))]) file(c, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r);
  const nearBy = (ax, az, bx, bz) => {
    const seen = new Set(), solids = [], cylinders = [];
    for (let z = Math.floor(Math.min(az, bz)); z <= Math.floor(Math.max(az, bz)); z++) {
      for (let x = Math.floor(Math.min(ax, bx)); x <= Math.floor(Math.max(ax, bx)); x++) {
        const b = buckets.get(z * cols + x);
        if (!b) continue;
        for (const o of b.solids) if (!seen.has(o)) { seen.add(o); solids.push(o); }
        for (const o of b.cylinders) if (!seen.has(o)) { seen.add(o); cylinders.push(o); }
      }
    }
    return { solids, cylinders };
  };
  /** Whether a ball at ground height `y` going from a to b would hit a solid. */
  const blocked = (ax, az, bx, bz, y) => {
    const { solids, cylinders } = nearBy(ax, az, bx, bz);
    for (const s of solids) {
      if (s.max[1] < y + 0.08 || s.min[1] > y + 0.75) continue;
      // The segment against the box grown by the ball's radius.
      const x0 = s.min[0] - R, x1 = s.max[0] + R, z0 = s.min[2] - R, z1 = s.max[2] + R;
      let t0 = 0, t1 = 1;
      const dx = bx - ax, dz = bz - az;
      const clip = (p, q) => {
        if (Math.abs(p) < 1e-12) return q >= 0;
        const r = q / p;
        if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
        return true;
      };
      if (clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az) && t0 <= t1) return true;
    }
    for (const c of cylinders) {
      if (c.y1 < y + 0.08 || c.y0 > y + 0.75) continue;
      // The segment's nearest approach to the cylinder's axis, against its radius grown by the ball's.
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / l2));
      if (Math.hypot(ax + dx * t - c.x, az + dz * t - c.z) < c.r + R) return true;
    }
    return false;
  };
  const cost = new Float32Array(cols * rows).fill(1);
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const c = map.cell(x, z);
      const k = z * cols + x;
      if (!c) { cost[k] = Infinity; continue; }
      if (c.surface === 'tar') cost[k] = Infinity;
      else if (c.surface === 'highway') cost[k] = 30;
      else if (c.surface === 'oil' || c.surface === 'wet') cost[k] = 6;
      else if (c.surface === 'berm') cost[k] = 4;
      // Steep ground: keep off it where there's a choice.
      const slope = Math.max(...c.h) - Math.min(...c.h);
      if (slope > 0.3) cost[k] += slope * 4;
    }
  }
  // Nowhere near a pumpjack's head: the tile under it and every tile round it.
  for (const p of map.pumpjacks) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) cost[(p.z + j) * cols + p.x + i] = Infinity;
  for (const f of map.flares) cost[f.z * cols + f.x] = 200;
  // Away from walls and drops: a tile next to a step it can't take costs more.
  const near = new Float32Array(cols * rows);
  for (let z = 1; z < rows - 1; z++) {
    for (let x = 1; x < cols - 1; x++) {
      const c = map.cell(x, z);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = map.cell(x + dx, z + dz);
        if (!n || Math.abs(top(n) - top(c)) > CLIMB) near[z * cols + x] += 1.5;
      }
    }
  }

  // Whether it can go from tile (x, z) one step (dx, dz): worked out once a step, the first time it's asked.
  const known = new Int8Array(cols * rows * 9);
  const step = (x, z, dx, dz) => {
    if (x < 0 || z < 0 || x >= cols || z >= rows) return false;
    const k = (z * cols + x) * 9 + (dz + 1) * 3 + dx + 1;
    if (!known[k]) known[k] = stepOnce(x, z, dx, dz) ? 1 : 2;
    return known[k] === 1;
  };
  const stepOnce = (x, z, dx, dz) => {
    const c = map.cell(x, z), n = map.cell(x + dx, z + dz);
    if (!c || !n) return false;
    if (dx && dz) return step(x, z, dx, 0) && step(x, z, 0, dz) && step(x + dx, z, 0, dz) && step(x, z + dz, dx, 0);
    const [mine, theirs] = edge(c, n, dx, dz);
    const up = Math.max(theirs[0] - mine[0], theirs[1] - mine[1]);
    const down = Math.max(mine[0] - theirs[0], mine[1] - theirs[1]);
    if (up > CLIMB || down > drop) return false;
    const y = Math.max(mine[0], mine[1]);
    return !blocked(x + 0.5, z + 0.5, x + dx + 0.5, z + dz + 0.5, y);
  };

  /** The way from (x0, z0) to (x1, z1), as tile centres; null if there isn't one. */
  function find([x0, z0], [x1, z1]) {
    const sx = Math.floor(x0), sz = Math.floor(z0), tx = Math.floor(x1), tz = Math.floor(z1);
    const start = sz * cols + sx, goal = tz * cols + tx;
    const g = new Float32Array(cols * rows).fill(Infinity);
    const from = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);
    const heap = [];
    const push = (k, f) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const out = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return out;
    };
    const h = (k) => Math.hypot((k % cols) - tx, Math.floor(k / cols) - tz);
    g[start] = 0;
    push(start, h(start));
    while (heap.length) {
      const [, k] = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === goal) break;
      const x = k % cols, z = Math.floor(k / cols);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const n = (z + dz) * cols + (x + dx);
          if (x + dx < 0 || z + dz < 0 || x + dx >= cols || z + dz >= rows || closed[n] || cost[n] === Infinity) continue;
          if (!step(x, z, dx, dz)) continue;
          const d = g[k] + Math.hypot(dx, dz) * (cost[n] + near[n]);
          if (d < g[n]) {
            g[n] = d;
            from[n] = k;
            push(n, d + h(n));
          }
        }
      }
    }
    if (!closed[goal]) return null;
    const out = [];
    for (let k = goal; k !== -1; k = from[k]) out.push([(k % cols) + 0.5, Math.floor(k / cols) + 0.5]);
    out.reverse();
    out[out.length - 1] = [x1, z1];
    return out;
  }

  return { find, step, blocked };
}
