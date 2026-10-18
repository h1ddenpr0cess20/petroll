/**
 * Whether the ball is hidden from the camera, for the ring drawn where it
 * is when it is: rays from the ball (its middle, its top and either side
 * of it) to the eye, tested against what it rolls on and bumps into — the
 * town's triangles, the still boxes and the cylinders, and the cars. It
 * counts as hidden when most of the rays are blocked, so a kerb or a
 * lamp post in the way doesn't set it off, and a whole house does.
 */

const EPS = 1e-6;

/** Does the segment from p to p + d (t in [t0, 1]) cross triangle i of `tris`? */
function hitsTriangle(px, py, pz, dx, dy, dz, tris, i, t0) {
  const ax = tris[i], ay = tris[i + 1], az = tris[i + 2];
  const e1x = tris[i + 3] - ax, e1y = tris[i + 4] - ay, e1z = tris[i + 5] - az;
  const e2x = tris[i + 6] - ax, e2y = tris[i + 7] - ay, e2z = tris[i + 8] - az;
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
  const a = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(a) < EPS) return false;
  const f = 1 / a;
  const sx = px - ax, sy = py - ay, sz = pz - az;
  const u = f * (sx * hx + sy * hy + sz * hz);
  if (u < 0 || u > 1) return false;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = f * (dx * qx + dy * qy + dz * qz);
  if (v < 0 || u + v > 1) return false;
  const t = f * (e2x * qx + e2y * qy + e2z * qz);
  return t > t0 && t < 1;
}

/** Does the segment cross the box? (Slabs.) */
function hitsBox(px, py, pz, dx, dy, dz, b, t0) {
  let lo = t0, hi = 1;
  const p = [px, py, pz], d = [dx, dy, dz];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < EPS) {
      if (p[k] < b.min[k] || p[k] > b.max[k]) return false;
      continue;
    }
    let a = (b.min[k] - p[k]) / d[k], c = (b.max[k] - p[k]) / d[k];
    if (a > c) [a, c] = [c, a];
    lo = Math.max(lo, a); hi = Math.min(hi, c);
    if (lo > hi) return false;
  }
  return true;
}

/** Does the segment cross the upright cylinder? */
function hitsCylinder(px, py, pz, dx, dy, dz, c, t0) {
  const ox = px - c.x, oz = pz - c.z;
  const A = dx * dx + dz * dz, B = 2 * (ox * dx + oz * dz), C = ox * ox + oz * oz - c.r * c.r;
  let lo = t0, hi = 1;
  if (A < EPS) { if (C > 0) return false; } else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return false;
    const s = Math.sqrt(disc);
    lo = Math.max(lo, (-B - s) / (2 * A)); hi = Math.min(hi, (-B + s) / (2 * A));
    if (lo > hi) return false;
  }
  // Where it's inside the circle, is it between the bottom and the top?
  const y0 = py + dy * lo, y1 = py + dy * hi;
  return Math.max(y0, y1) > c.y0 && Math.min(y0, y1) < c.y1;
}

/** Is the segment from `from` to `to` ({x, y, z}) blocked by anything in `world` (or `cars`)? Starts `skip` along it, to keep clear of the ball. */
export function blocked(world, from, to, { cars = [], skip = 0 } = {}) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  const t0 = len > EPS || Math.abs(dy) > EPS ? skip / Math.hypot(dx, dy, dz) : 0;
  const tris = world.triangles;
  let hit = false;
  const seen = new Set();
  const visit = (i) => {
    if (!hit && hitsTriangle(from.x, from.y, from.z, dx, dy, dz, tris, i * 9, t0)) hit = true;
  };
  const near = [];
  const steps = Math.max(1, Math.ceil(len / 0.7));
  for (let s = 0; s <= steps && !hit; s++) {
    const t = s / steps;
    if (t < t0 - 0.7 / Math.max(len, EPS)) continue;
    const x = from.x + dx * t, z = from.z + dz * t;
    if (x < 0 || z < 0 || x >= world.cols || z >= world.rows) continue;
    world.near(x, z, 0.5, visit);
    if (hit) break;
    for (const b of world.boxesNear(x, z, 0.5, near)) {
      if (seen.has(b) || world.boxes.includes(b)) continue;
      seen.add(b);
      if (b.cylinder ? hitsCylinder(from.x, from.y, from.z, dx, dy, dz, b, t0) : hitsBox(from.x, from.y, from.z, dx, dy, dz, b, t0)) { hit = true; break; }
    }
  }
  if (!hit) for (const c of cars) if (hitsBox(from.x, from.y, from.z, dx, dy, dz, c, t0)) { hit = true; break; }
  return hit;
}

/**
 * How much of the ball is hidden from `eye`, 0 to 1: the share of rays
 * (middle, top, and either side across the line of sight) that something
 * blocks.
 */
export function hiddenShare(world, ball, eye, { cars = [] } = {}) {
  const dx = eye.x - ball.x, dz = eye.z - ball.z, l = Math.hypot(dx, dz) || 1;
  const sx = -dz / l, sz = dx / l, r = ball.r * 0.75;
  const points = [
    { x: ball.x, y: ball.y, z: ball.z },
    { x: ball.x, y: ball.y + r, z: ball.z },
    { x: ball.x + sx * r, y: ball.y, z: ball.z + sz * r },
    { x: ball.x - sx * r, y: ball.y, z: ball.z - sz * r },
  ];
  let n = 0;
  for (const p of points) if (blocked(world, p, eye, { cars, skip: ball.r * 1.1 })) n++;
  return n / points.length;
}
