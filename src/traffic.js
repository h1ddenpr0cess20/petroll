import { model } from './models/library.js';
import { materialsOf } from './sculpt/bake.js';

/**
 * The traffic: cars, trucks and tankers driving round the roads of the
 * map (`map.roads`). Each road is a loop (or, on the interstate, a line
 * the cars come in at one end of and leave by the other), its corners
 * rounded off, and the cars on it spaced evenly round it to start.
 *
 * A car is a box the bubble can hit — it moves, so it shoves — and it
 * drives at its road's speed unless something is in front of it: another
 * car, which it waits behind, or (in town, where drivers look) the
 * hamster, which it brakes for and honks at. On the interstate nobody
 * brakes for anything.
 */

export const KINDS = Object.freeze({
  car: { length: 1.9, width: 0.95, height: 0.85, models: ['sedan', 'hatchback', 'pickup'] },
  truck: { length: 2.7, width: 1.1, height: 1.4, models: ['boxtruck'] },
  tanker: { length: 4.2, width: 1.15, height: 1.5, models: ['tanker'] },
});

const PAINT = ['#c8382c', '#2c6ec8', '#e8e2d6', '#f2c230', '#3a8a4a', '#1c1b1f', '#8a8f9a', '#e07a2a', '#6a3a8a', '#4ab0c8'];

/** How hard cars speed up and slow down, tiles a second a second. */
const ACCEL = 3.5, BRAKE = 12;

/** Within this of where the camera looks, a car is drawn in full; further, its lighter version (the difference doesn't show at that size). */
const NEAR = 9;

/** A path round `points` with its corners rounded to radius `round`: points, and the distance to each. */
export function roundedPath(points, { open = false, round = 1.6, steps = 6 } = {}) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (open && (i === 0 || i === n - 1)) { out.push(p); continue; }
    const a = points[(i - 1 + n) % n], b = points[(i + 1) % n];
    const la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const r = Math.min(round, la / 2, lb / 2);
    const s = [p[0] + (a[0] - p[0]) * (r / la), p[1] + (a[1] - p[1]) * (r / la)];
    const e = [p[0] + (b[0] - p[0]) * (r / lb), p[1] + (b[1] - p[1]) * (r / lb)];
    // A quadratic curve through the corner: close enough to an arc.
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      out.push([
        (1 - t) * (1 - t) * s[0] + 2 * (1 - t) * t * p[0] + t * t * e[0],
        (1 - t) * (1 - t) * s[1] + 2 * (1 - t) * t * p[1] + t * t * e[1],
      ]);
    }
  }
  if (!open) out.push(out[0]);
  const dist = [0];
  for (let i = 1; i < out.length; i++) dist.push(dist[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { points: out, dist, length: dist[dist.length - 1], open };
}

/** Where along a path `s` is, and which way it's going there. */
export function along(path, s, out = { x: 0, z: 0, dx: 0, dz: 1 }) {
  const L = path.length;
  s = path.open ? Math.min(Math.max(s, 0), L) : ((s % L) + L) % L;
  const d = path.dist;
  let lo = 0, hi = d.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (d[mid] <= s) lo = mid; else hi = mid;
  }
  const a = path.points[lo], b = path.points[hi];
  const seg = d[hi] - d[lo] || 1;
  const t = (s - d[lo]) / seg;
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  out.dx = (b[0] - a[0]) / seg;
  out.dz = (b[1] - a[1]) / seg;
  return out;
}

export function createTraffic(GFX, map, world) {
  const group = new GFX.Group();
  group.name = 'traffic';
  const looks = new Map();
  const cars = [];
  let id = 0;
  for (const [ri, road] of map.roads.entries()) {
    const path = roundedPath(road.points, { open: road.open });
    for (let i = 0; i < road.cars; i++) {
      const kind = road.kind === 'truck' && i % 2 && !road.open ? 'tanker' : road.kind;
      const paint = PAINT[(ri * 3 + i * 7) % PAINT.length];
      const which = KINDS[kind].models[(ri + i) % KINDS[kind].models.length];
      const { geometry, def } = model(GFX, which);
      const far = model(GFX, `${which}-far`).geometry;
      const key = `${which}${paint}`;
      if (!looks.has(key)) looks.set(key, materialsOf(GFX, def, { paint: { color: paint } }));
      const mesh = new GFX.Mesh(geometry, looks.get(key));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const size = which === 'pickup' ? { ...KINDS.car, length: 2.1 } : which === 'hatchback' ? { ...KINDS.car, length: 1.7 } : KINDS[kind];
      const box = { solid: true, kind: 'car', vx: 0, vy: 0, vz: 0, min: [0, 0, 0], max: [0, 0, 0] };
      cars.push({
        id: id++, road, path, kind, size, mesh, box, near: geometry, far,
        s: (path.length * i) / road.cars, v: road.speed,
        x: 0, y: 0, z: 0, dx: 0, dz: 1, honked: 0,
      });
    }
  }
  world.boxes.push(...cars.map((c) => c.box));
  const at = { x: 0, z: 0, dx: 0, dz: 1 };

  function place(c, dt) {
    along(c.path, c.s, at);
    const x = at.x, z = at.z;
    const y = c.road.over ? map.roadAt(x, z) : map.heightAt(x, z) ?? 0;
    if (dt > 0) {
      // From where it was: a wrap at the end of an open road is a jump, not a speed.
      const jump = Math.hypot(x - c.x, z - c.z) > 2;
      c.box.vx = jump ? 0 : (x - c.x) / dt;
      c.box.vz = jump ? 0 : (z - c.z) / dt;
      c.box.vy = jump ? 0 : (y - c.y) / dt;
    }
    c.x = x; c.y = y; c.z = z; c.dx = at.dx; c.dz = at.dz;
    const { length: L, width: W, height: H } = c.size;
    const ex = (Math.abs(at.dx) * L + Math.abs(at.dz) * W) / 2;
    const ez = (Math.abs(at.dz) * L + Math.abs(at.dx) * W) / 2;
    c.box.min[0] = x - ex; c.box.min[1] = y; c.box.min[2] = z - ez;
    c.box.max[0] = x + ex; c.box.max[1] = y + H; c.box.max[2] = z + ez;
  }
  for (const c of cars) place(c, 0);

  return {
    group, cars,

    /**
     * One step: every car decides how fast to go and goes. `ball` is the
     * hamster's, or null. Returns the cars that honked this step.
     */
    step(dt, ball) {
      const honks = [];
      for (const c of cars) {
        let want = c.road.speed;
        const reach = c.size.length / 2 + 2.6;
        for (const o of cars) {
          if (o === c) continue;
          const rx = o.x - c.x, rz = o.z - c.z;
          if (Math.abs(rx) > 6 || Math.abs(rz) > 6) continue;
          const ahead = rx * c.dx + rz * c.dz, side = Math.abs(rx * c.dz - rz * c.dx);
          if (ahead <= 0 || ahead > reach + o.size.length / 2 || side > 1.2) continue;
          // Both in each other's way (crossing at a junction): the older car goes first.
          const back = -(rx * o.dx + rz * o.dz), oside = Math.abs(rx * o.dz - rz * o.dx);
          if (back > 0 && back < reach && oside < 1.2 && c.id < o.id) continue;
          want = Math.min(want, Math.max(0, (ahead - c.size.length / 2 - o.size.length / 2 - 0.5) * 2));
        }
        if (ball && c.road.brakes) {
          const rx = ball.x - c.x, rz = ball.z - c.z;
          const ahead = rx * c.dx + rz * c.dz, side = Math.abs(rx * c.dz - rz * c.dx);
          if (ahead > 0 && ahead < c.size.length / 2 + 2.4 && side < c.size.width / 2 + 0.6 && Math.abs(ball.y - c.y) < 1.5) {
            want = Math.min(want, Math.max(0, (ahead - c.size.length / 2 - 0.7) * 1.5));
            if (c.honked <= 0) { honks.push(c); c.honked = 3; }
          }
        }
        c.honked -= dt;
        c.v += Math.max(-BRAKE * dt, Math.min(ACCEL * dt, want - c.v));
        c.s += c.v * dt;
        if (c.path.open && c.s > c.path.length) c.s -= c.path.length;
        place(c, dt);
      }
      return honks;
    },

    /** Meshes to match, once a frame; the cars more than `NEAR` from `eye` (where the camera looks) in their lighter versions. */
    sync(eye = null) {
      for (const c of cars) {
        c.mesh.geometry = eye && Math.hypot(c.x - eye.x, c.z - eye.z) > NEAR ? c.far : c.near;
        c.mesh.position.set(c.x, c.y, c.z);
        c.mesh.rotation.y = Math.atan2(c.dx, c.dz);
      }
    },

    /** The car (if any) whose box the ball at (x, y, z) is touching. */
    touching(ball) {
      for (const c of cars) {
        const b = c.box;
        const qx = Math.max(b.min[0], Math.min(ball.x, b.max[0]));
        const qy = Math.max(b.min[1], Math.min(ball.y, b.max[1]));
        const qz = Math.max(b.min[2], Math.min(ball.z, b.max[2]));
        if (Math.hypot(ball.x - qx, ball.y - qy, ball.z - qz) < ball.r + 0.04) return c;
      }
      return null;
    },
  };
}

