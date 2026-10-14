/**
 * An autopilot for the town: it rolls the hamster from place to place with
 * the same push the controls give — finding its own way across the map
 * (`plan.js`) where it can, following set waypoints where the way is
 * tricky (along the pipeline, over the plank, on a lift) — and waits where
 * a waypoint says to: for a lift, for a pumpjack's head to go up, for a
 * flare to die down, for a gap in the traffic. It shies away from drums
 * and won't roll out in front of a moving car.
 *
 * If it can find every golden seed without the bubble popping, a person
 * can. The tests hold the town to that.
 */

import * as GFX from '../../src/vendor/gfx/index.js';
import { flareAt, liftAt, nodAt } from '../../src/hazards.js';
import { createRun, putBack, respawn, STEP, stepRun } from '../../src/run.js';
import { createPlanner } from './plan.js';

const cycle = (time, period, phase) => ((((time + phase) / period) % 1) + 1) % 1;

/** Lift `i` waiting at its start (0) or its far end (1), early enough in the wait to get on or off. */
export const liftAtEnd = (i, end) => (run) => {
  const l = run.hazards.lifts[i];
  const s = liftAt(run.time, l.period, l.phase, l.pause);
  const u = cycle(run.time, l.period, l.phase);
  return end === 0 ? s === 0 && u < l.pause * 0.4 : s === 1 && u > 0.5 && u < 0.5 + l.pause * 0.4;
};

/** Pumpjack `i`'s head on its way up and high enough to go under, with a while before it comes down. */
export const headUp = (i) => (run) => {
  const p = run.hazards.pumpjacks[i];
  const u = cycle(run.time, p.period, p.phase);
  return u > 0.25 && u < 0.42 && nodAt(run.time, p.period, p.phase) > 0.55;
};

/** Every flare within `near` of (x, z) out, and staying out for at least `for` seconds. */
export const flaresOut = (x, z, near = 2.2, hold = 0.9) => (run) => run.hazards.flares.every((f) => {
  if (Math.hypot(f.x + 0.5 - x, f.z + 0.5 - z) > near) return true;
  for (let t = 0; t <= hold; t += 0.05) if (flareAt(run.time + t, f.period, f.phase, f.burn) > 0) return false;
  return true;
});

/** No car on the lanes along x (`xs`) coming up to `z` from either way within `gap` tiles, or just past it. */
export const laneClear = (xs, z, gap = 13) => (run) => run.traffic.cars.every((c) => {
  if (!xs.some((x) => Math.abs(c.x - x) < 0.8)) return true;
  const toward = (z - c.z) * Math.sign(c.dz);
  return toward > gap || toward < -2.6;
});

/**
 * Drive the tour: legs of `{ to: [x, z] }` (find the way), `{ via: [...] }`
 * (follow these: `[x, z, { speed, until, stop, on, radius }]`), each
 * optionally `{ expect }`, the golden seed it should find. Returns how it
 * went: the golden seeds found, the bubble lost, the pops and when.
 */
export function drive(tour, { limit = 2400, log = false } = {}) {
  const run = createRun(GFX);
  const planner = createPlanner(run.map);
  const b = run.ball;
  const losses = [];
  const hurts = [];
  const found = [];
  let t = 0, down = 0, legIndex = 0, wp = 0, path = null, lastLost = null;
  let best = Infinity, sinceBest = 0;

  const startLeg = () => {
    const leg = tour[legIndex];
    wp = 0;
    best = Infinity; sinceBest = 0;
    if (leg.to) {
      path = planner.find([b.x, b.z], leg.to);
      if (!path) throw new Error(`no way from ${b.x.toFixed(1)},${b.z.toFixed(1)} to ${leg.to} (leg ${legIndex})`);
      path = path.map(([x, z], i) => [x, z, { speed: leg.speed ?? 4, ...(i === path.length - 1 ? { stop: leg.stop, until: leg.until } : { radius: 0.8 }) }]);
      // Skip the first point if it's behind.
      if (path.length > 1) path.shift();
    } else {
      path = leg.via.map((p) => [p[0], p[1], p[2] ?? {}]);
    }
  };
  startLeg();

  const target = (w) => {
    const o = w[2];
    if (o.on === undefined) return [w[0], w[1]];
    const box = run.hazards.lifts[o.on].box;
    return [box.min[0] + w[0], box.min[2] + w[1]];
  };

  while (t < limit) {
    if (log && Math.floor((t + STEP) / 2) !== Math.floor(t / 2)) console.log(`  t${t.toFixed(0)} leg${legIndex} wp${wp}/${path.length} at ${b.x.toFixed(2)},${b.z.toFixed(2)} y${b.y.toFixed(2)} v${Math.hypot(b.vx, b.vz).toFixed(2)}`);
    t += STEP;
    if (down > 0) {
      down -= STEP;
      stepRun(run, [0, 0], STEP, { live: false, moving: false });
      if (down <= 0) {
        if (lastLost === 'sunk') putBack(run); else respawn(run);
        // Find the way again from where it was put back.
        if (tour[legIndex].to) startLeg();
        else {
          let bestI = 0, bestD = Infinity;
          for (let i = 0; i <= wp; i++) {
            const [x, z] = target(path[i]);
            const d = Math.hypot(x - b.x, z - b.z);
            if (d < bestD) { bestD = d; bestI = i; }
          }
          // Find the way back to it, then carry on from there.
          const back = planner.find([b.x, b.z], target(path[bestI]));
          const detour = path[bestI][2].on === undefined && back ? back.slice(0, -1).map(([x, z]) => [x, z, { speed: 3, radius: 0.8 }]) : [];
          path = [...detour, ...path.slice(bestI)];
          wp = 0;
        }
      }
      continue;
    }

    const w = path[wp];
    const o = w[2];
    const [tx, tz] = target(w);
    const dx = tx - b.x, dz = tz - b.z;
    const d = Math.hypot(dx, dz);
    const waiting = o.until && !o.until(run);
    const last = wp === path.length - 1;

    if (!waiting && d < (o.radius ?? 0.5)) {
      if (!last) { wp++; best = Infinity; sinceBest = 0; continue; }
      legIndex++;
      if (legIndex >= tour.length) return { finished: true, time: t, found, losses, hurts, bubble: run.bubble, run };
      startLeg();
      continue;
    }
    if (d < best - 0.3) { best = d; sinceBest = 0; } else if (!waiting) sinceBest += STEP;
    if (sinceBest > 25) {
      return { finished: false, time: t, found, losses, hurts, stuck: { leg: legIndex, wp, at: [b.x, b.y, b.z].map((v) => +v.toFixed(2)), to: [tx, tz] }, run };
    }

    // Where it wants to be going, easing in if it has to stop.
    let speed = o.speed ?? 4;
    // Slower into a sharp turn.
    if (!last && d < 1.5) {
      const [nx, nz] = target(path[wp + 1]);
      const ax = nx - tx, az = nz - tz, al = Math.hypot(ax, az) || 1;
      const cos = (dx * ax + dz * az) / ((d || 1) * al);
      if (cos < 0.5) speed = Math.min(speed, 2.5);
    }
    const stop = waiting || o.stop;
    // Close to a point it has to pass through, slow enough to turn inside it rather than circle it.
    const want = stop ? Math.min(speed, d * 2.5) : d < 1.2 ? Math.min(speed, Math.max(1.8, d * 3.2)) : speed;
    let vx = d > 1e-3 ? (dx / d) * want : 0;
    let vz = d > 1e-3 ? (dz / d) * want : 0;

    // Out of the drums' way.
    for (const s of run.hazards.drums) {
      const sx = b.x - s.ball.x, sz = b.z - s.ball.z, sd = Math.hypot(sx, sz);
      if (s.gone <= 0 && sd < 1.8 && sd > 1e-3) {
        const k = (1.8 - sd) * 3;
        vx += (sx / sd) * k; vz += (sz / sd) * k;
      }
    }
    // Don't roll out in front of a moving car: if one would be where it's going, hold back.
    if (!o.reckless) {
      for (const c of run.traffic.cars) {
        if (c.v < 0.8 || Math.abs(c.y - (b.y - b.r)) > 1.2) continue;
        if (Math.abs(c.x - b.x) > 9 || Math.abs(c.z - b.z) > 9) continue;
        let danger = false;
        for (let s = 0; s <= 1.4 && !danger; s += 0.2) {
          const cx = c.x + c.dx * c.v * s, cz = c.z + c.dz * c.v * s;
          const px = b.x + vx * s, pz = b.z + vz * s;
          const along = Math.abs((px - cx) * c.dx + (pz - cz) * c.dz), across = Math.abs((px - cx) * c.dz - (pz - cz) * c.dx);
          if (along < c.size.length / 2 + 0.9 && across < c.size.width / 2 + 0.75) danger = true;
        }
        if (danger) {
          // Back off, away from its path.
          const ax = b.x - c.x, az = b.z - c.z;
          const side = Math.sign(ax * c.dz - az * c.dx) || 1;
          vx = c.dz * side * 2.2 - vx * 0.2; vz = -c.dx * side * 2.2 - vz * 0.2;
          break;
        }
      }
    }

    // On a lift, its velocity is the lift's and its own roll across it; the lift's only matters for where the target is.
    let px = (vx - b.vx) * 0.9, pz = (vz - b.vz) * 0.9;
    const l = Math.hypot(px, pz);
    if (l > 1) { px /= l; pz /= l; }

    const out = stepRun(run, [px, pz], STEP);
    if (out.hurt) hurts.push({ how: out.hits.join(','), hurt: +out.hurt.toFixed(1), leg: legIndex, time: +t.toFixed(1) });
    if (out.golden) {
      found.push(out.golden.name);
      if (log) console.log(`${t.toFixed(1)}s ★ ${out.golden.name} (bubble ${run.bubble.toFixed(0)})`);
    }
    if (out.outcome) {
      losses.push({ how: out.outcome, at: [b.x, b.y, b.z].map((v) => +v.toFixed(1)), leg: legIndex, wp, time: +t.toFixed(1) });
      if (log) console.log(`${t.toFixed(1)}s ${out.outcome} at leg ${legIndex}`, losses.at(-1).at);
      lastLost = out.outcome;
      down = 1.6;
    }
  }
  return { finished: false, time: t, found, losses, hurts, stuck: { leg: legIndex, wp }, run };
}
