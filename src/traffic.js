import { createKit } from './kit.js';

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
  car: { length: 1.9, width: 0.95, height: 0.85 },
  truck: { length: 2.7, width: 1.1, height: 1.35 },
  tanker: { length: 4.2, width: 1.15, height: 1.4 },
});

const PAINT = ['#c8382c', '#2c6ec8', '#e8e2d6', '#f2c230', '#3a8a4a', '#1c1b1f', '#8a8f9a', '#e07a2a', '#6a3a8a', '#4ab0c8'];

/** How hard cars speed up and slow down, tiles a second a second. */
const ACCEL = 3.5, BRAKE = 12;

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

/** The meshes for one kind of vehicle in one colour, facing +z, wheels on the ground. */
function vehicleKit(GFX, kind, paint) {
  const kit = createKit(GFX);
  const { length: L, width: W, height: H } = KINDS[kind];
  const hl = L / 2, hw = W / 2;
  const glass = '#26303c', tyre = '#18181b', chrome = '#c8ccd2';
  const wheel = (x, z, r = 0.19) => {
    kit.cyl([x, r, z], r, 0.16, tyre, { rot: [0, 0, Math.PI / 2], segments: 14 });
    kit.cyl([x + Math.sign(x) * 0.07, r, z], r * 0.55, 0.04, chrome, { rot: [0, 0, Math.PI / 2], segments: 10, finish: 'shiny' });
  };
  if (kind === 'car') {
    kit.slab(-hw, 0.18, -hl, hw, 0.52, hl, paint, { finish: 'shiny' });
    kit.slab(-hw * 0.86, 0.52, -hl * 0.55, hw * 0.86, 0.84, hl * 0.3, paint, { finish: 'shiny' });
    kit.slab(-hw * 0.88, 0.55, -hl * 0.5, hw * 0.88, 0.8, hl * 0.26, glass, { finish: 'glass' });
    kit.slab(-hw * 0.9, 0.3, hl - 0.02, -hw * 0.5, 0.42, hl + 0.01, '#fff6d8', { finish: 'glow' });
    kit.slab(hw * 0.5, 0.3, hl - 0.02, hw * 0.9, 0.42, hl + 0.01, '#fff6d8', { finish: 'glow' });
    kit.slab(-hw * 0.9, 0.34, -hl - 0.01, -hw * 0.55, 0.44, -hl + 0.02, '#ff3020', { finish: 'glow' });
    kit.slab(hw * 0.55, 0.34, -hl - 0.01, hw * 0.9, 0.44, -hl + 0.02, '#ff3020', { finish: 'glow' });
    kit.slab(-hw * 0.95, 0.2, hl - 0.05, hw * 0.95, 0.27, hl + 0.04, chrome, { finish: 'shiny' });
    for (const x of [-hw + 0.06, hw - 0.06]) for (const z of [-hl * 0.6, hl * 0.62]) wheel(x, z);
  } else {
    // A cab at the front, and behind it a box (truck) or a tank (tanker).
    const cab = 1.0;
    kit.slab(-hw, 0.25, hl - cab, hw, H * 0.92, hl, paint, { finish: 'shiny' });
    kit.slab(-hw * 0.92, H * 0.55, hl - 0.05, hw * 0.92, H * 0.86, hl + 0.01, glass, { finish: 'glass' });
    kit.slab(-hw * 0.95, 0.3, hl - 0.01, -hw * 0.6, 0.45, hl + 0.02, '#fff6d8', { finish: 'glow' });
    kit.slab(hw * 0.6, 0.3, hl - 0.01, hw * 0.95, 0.45, hl + 0.02, '#fff6d8', { finish: 'glow' });
    kit.slab(-hw * 0.95, 0.18, -hl, hw * 0.95, 0.3, hl - cab, '#3a3a40');
    if (kind === 'truck') {
      kit.slab(-hw, 0.3, -hl, hw, H, hl - cab - 0.06, '#e8e4dc');
      kit.slab(-hw - 0.005, 0.55, -hl * 0.9, hw + 0.005, H * 0.82, hl - cab - 0.3, paint);
    } else {
      kit.cyl([0, 0.3 + hw * 0.95, -cab / 2 + 0.0], hw * 0.95, L - cab - 0.15, '#d8dce2', { rot: [Math.PI / 2, 0, 0], finish: 'shiny', segments: 20 });
      kit.slab(-hw * 0.97, 0.3 + hw * 0.7, -hl + 0.6, hw * 0.97, 0.3 + hw * 1.1, -hl + 1.4, paint);
      kit.slab(-0.2, 0.3 + hw * 1.9, -0.6, 0.2, 0.3 + hw * 2.0, 0.2, '#8a8f9a');
    }
    kit.slab(-hw * 0.9, 0.36, -hl - 0.01, -hw * 0.55, 0.48, -hl + 0.02, '#ff3020', { finish: 'glow' });
    kit.slab(hw * 0.55, 0.36, -hl - 0.01, hw * 0.9, 0.48, -hl + 0.02, '#ff3020', { finish: 'glow' });
    const zs = kind === 'tanker' ? [hl - 0.5, -hl + 0.5, -hl + 1.0, 0] : [hl - 0.5, -hl + 0.5, -hl + 0.95];
    for (const x of [-hw + 0.05, hw - 0.05]) for (const z of zs) wheel(x, z, 0.22);
  }
  return kit;
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
      const key = `${kind}${paint}`;
      if (!looks.has(key)) looks.set(key, vehicleKit(GFX, kind, paint).geometries());
      const mesh = new GFX.Group();
      for (const [finish, g] of Object.entries(looks.get(key))) {
        const m = new GFX.Mesh(g, materialFor(GFX, finish));
        m.castShadow = finish !== 'glow' && finish !== 'glass';
        m.receiveShadow = finish !== 'glow';
        mesh.add(m);
      }
      group.add(mesh);
      const size = KINDS[kind];
      const box = { solid: true, kind: 'car', vx: 0, vy: 0, vz: 0, min: [0, 0, 0], max: [0, 0, 0] };
      cars.push({
        id: id++, road, path, kind, size, mesh, box,
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
    const y = map.heightAt(x, z) ?? 0;
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

    /** Meshes to match, once a frame. */
    sync() {
      for (const c of cars) {
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

let mats = null;
function materialFor(GFX, finish) {
  mats ??= {
    matte: new GFX.MeshStandardMaterial({ name: 'car-matte', vertexColors: true, roughness: 0.8 }),
    shiny: new GFX.MeshPhysicalMaterial({ name: 'car-paint', vertexColors: true, roughness: 0.22, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    glow: new GFX.MeshBasicMaterial({ name: 'car-lights', vertexColors: true }),
    glass: new GFX.MeshPhysicalMaterial({ name: 'car-glass', vertexColors: true, roughness: 0.05, metalness: 0.6, clearcoat: 1 }),
  };
  return mats[finish];
}
