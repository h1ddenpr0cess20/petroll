/**
 * An autopilot for the jobs: it takes a job on where its giver stands and
 * does it with the same push the controls give — finding its own way
 * across town (`plan.js`) to each place, round each thing to knock or
 * round up (the nearest next), after the car it has to ram, behind the
 * car it has to follow, through the gates of a race — and following set
 * waypoints where the way is tricky (`HINTS`: up onto the pipeline, along
 * the plank, the catwalk, flare alley, the trampoline). It shies away from
 * drums, holds back from moving cars, dashes when it's worth it.
 *
 * If it can do every job against the clock without the bubble popping, a
 * person can. The tests hold the town to that.
 */

import { flareAt } from '../../src/hazards.js';
import { startJob } from '../../src/jobs.js';
import { STEP, stepRun } from '../../src/run.js';
import { along } from '../../src/traffic.js';
import { createPlanner } from './plan.js';

const v = (x, z, o = {}) => [x, z, o];

/** Every flare within `near` of (x, z) out, and staying out for at least `hold` seconds. */
const flaresOut = (x, z, near = 2.2, hold = 0.9) => (run) => run.hazards.flares.every((f) => {
  if (Math.hypot(f.x + 0.5 - x, f.z + 0.5 - z) > near) return true;
  for (let t = 0; t <= hold; t += 0.05) if (flareAt(run.time + t, f.period, f.phase, f.burn) > 0) return false;
  return true;
});

/** Down flare alley behind the wave, a row of vents at a time. */
function flareAlley(to) {
  const out = [v(34.5, 81.2, { speed: 2.5 })];
  const waits = [84, 88.2, 92, 95.8, 99.6, 103.4].filter((z) => z < to + 2);
  waits.forEach((z, i) => {
    const next = waits[i + 1] ?? 107;
    out.push(v(34.5, z, { until: flaresOut(34.5, (z + next) / 2, 2.4, 1.3), stop: true, speed: 3, radius: 0.35 }));
  });
  return out;
}

/**
 * Where the way to a target is tricky: for job `id`, target `i` (of the
 * first stage; `'stage.i'` for a later one), the waypoints to follow from
 * wherever the planner can get to (`from`).
 */
export const HINTS = {
  pipeline: {
    0: { from: [57.4, 68.5], via: [v(64, 68.5, { speed: 2.5 }), v(66.5, 68.5, { speed: 3 })] },
    1: { via: [v(82, 68.5, { speed: 3.2 })] },
    2: { via: [v(97.5, 68.5, { speed: 3.2 })] },
    3: { via: [v(100.5, 67.5, { speed: 2 })] },
    4: {
      via: [v(98, 68.5, { speed: 2 }), v(64.5, 68.5, { speed: 3.2 }), v(58.5, 68.5, { speed: 2 })],
      then: { from: [63.6, 102.5], stop: true, via: [v(64.6, 102.5, { speed: 1.4 }), v(69.8, 102.5, { speed: 1.4 })] },
    },
  },
  flares: {
    0: { from: [21, 82.6], via: [v(21, 73, { speed: 2.5 }), v(21.5, 71.5, { speed: 1.5 }), v(30, 71.5, { speed: 2.5 })] },
    1: { via: [v(36.5, 71.5, { speed: 2.5 }), v(38.5, 70.5, { speed: 2 })] },
    2: { via: [v(36.5, 71.5, { speed: 2 }), v(21.5, 71.5, { speed: 2.5 }), v(21, 73, { speed: 1.5 }), v(21, 82, { speed: 2.5 })], then: { from: [34.5, 80.4], via: flareAlley(82.5) } },
    3: { via: flareAlley(94).slice(1) },
    4: { via: [...flareAlley(107).slice(4), v(35, 106.5, { speed: 3 })] },
  },
  dynamite: {
    // Down the haul road between the haul truck's lanes, where it passes either side.
    '1.0': { from: [218, 66.5], via: [v(218, 70, { speed: 2.5, reckless: true }), v(218, 84.5, { speed: 3, reckless: true }), v(218.5, 88, { speed: 2.5 })] },
  },
  pups: {
    4: { from: [158, 21.4], stop: true, via: [v(158, 19.6, { speed: 5.8, radius: 0.6 }), v(158, 13.8, { speed: 2, air: true })] },
  },
};

/** How careful to be: speed, and whether a drop is to be avoided, for a job carrying something fragile. */
const careful = (job) => job.stages.some((s) => s.fragile);

/**
 * Do `job`: from where its giver stands (or its start), take it on, and
 * do it. Returns how it went: `passed`, or `failed` (and why), `stuck`
 * (where), the time it took, and the knocks on the way.
 */
export function doJob(run, job, { log = false, limit = 400 } = {}) {
  const giver = run.board.givers.find((g) => g.id === job.giver);
  const b = run.ball;
  const place = (x, z) => {
    const y = (run.map.topAt(x, z) ?? 0) + b.r + 0.05;
    b.x = x; b.y = y; b.z = z; b.vx = b.vy = b.vz = 0; b.grounded = false; b.on = null;
  };
  // Next to whoever gives it (on the side toward where it's going), or where it starts.
  const first = job.stages[0], to = first.at ?? first.points?.[0] ?? first.route?.[0] ?? [giver.x + 1, giver.z];
  const away = Math.atan2(to[1] - giver.z, to[0] - giver.x);
  const [sx, sz] = job.start ?? [giver.x + Math.cos(away) * 0.75, giver.z + Math.sin(away) * 0.75];
  place(sx, sz);
  run.bubble = 100;
  for (let i = 0; i < 30; i++) stepRun(run, [0, 0]);
  const fragile = careful(job);
  const planner = createPlanner(run.map, { drop: fragile ? 0.5 : 2.2 });
  startJob(run, job);
  const hints = HINTS[job.id] ?? {};
  const hurts = [];
  let replans = 0, t = 0, path = [], wp = 0, stage = -1, index = -1, best = Infinity, sinceBest = 0, replan = 0, aim;

  const plan = (to, opts = {}) => {
    const found = planner.find([b.x, b.z], to);
    if (!found) throw new Error(`${job.id}: no way from ${b.x.toFixed(1)},${b.z.toFixed(1)} to ${to}`);
    const out = found.map(([x, z], i) => [x, z, { speed: opts.speed ?? 4, ...(i === found.length - 1 ? { stop: opts.stop } : { radius: 0.8 }) }]);
    if (out.length > 1) out.shift();
    return out;
  };

  /** The way to target `i` of the stage: planned, or by the hints. */
  const wayTo = (i, target) => {
    const h = hints[`${run.board.active.stage}.${i}`] ?? (run.board.active.stage === 0 ? hints[i] : undefined);
    const speed = fragile ? 3 : job.stages[run.board.active.stage].type === 'race' ? 8.5 : 7.5;
    if (!h) return plan([target.x, target.z], { speed });
    const legs = [];
    let at = [b.x, b.z];
    const leg = (hh) => {
      if (hh.from) {
        const p = planner.find(at, hh.from);
        if (!p) throw new Error(`${job.id}: no way to ${hh.from}`);
        legs.push(...p.slice(1).map(([x, z], k) => [x, z, { speed, ...(k === p.length - 2 ? { stop: hh.stop, radius: 0.4 } : { radius: 0.8 }) }]));
      }
      legs.push(...hh.via.map((p) => [p[0], p[1], { ...(p[2] ?? {}) }]));
      at = legs.length ? [legs.at(-1)[0], legs.at(-1)[1]] : at;
      if (hh.then) leg(hh.then);
    };
    leg(h);
    return legs;
  };

  while (t < limit) {
    const a = run.board.active;
    if (!a) return { passed: false, why: 'no job', time: t, hurts };
    t += STEP;
    if (a.phase === 'ready') { stepRun(run, [0, 0]); continue; }
    const s = a.job.stages[a.stage];
    let dash = false;

    if (s.type === 'ram' || s.type === 'tail') {
      const m = a.mover;
      // Ram: at where it'll be in a moment; tail: a few tiles behind it, on its road.
      let tx, tz;
      if (s.type === 'ram') {
        const lead = Math.min(0.6, Math.hypot(m.x - b.x, m.z - b.z) / 10);
        tx = m.x + m.dx * m.v * lead; tz = m.z + m.dz * m.v * lead;
      } else {
        const p = along(m.path, Math.max(0, m.s - 4));
        tx = p.x; tz = p.z;
      }
      const d = Math.hypot(tx - b.x, tz - b.z);
      replan -= STEP;
      if (d > 5 && (replan <= 0 || wp >= path.length)) {
        replan = 0.8;
        const found = planner.find([b.x, b.z], [tx, tz]);
        path = found ? found.slice(1).map(([x, z]) => [x, z, { speed: s.type === 'tail' ? Math.min(7, m.v + 2 + d * 0.3) : 9, radius: 0.9 }]) : [];
        wp = 0;
      }
      if (d <= 5 || !path.length) {
        aim = [tx, tz, { speed: s.type === 'tail' ? Math.max(0, m.v + (d - 2) * 0.8) : 11, reckless: s.type === 'ram' }];
        dash = s.type === 'ram' && d < 3.5 && run.dash.breath >= 1;
      } else {
        while (wp < path.length - 1 && Math.hypot(path[wp][0] - b.x, path[wp][1] - b.z) < 0.9) wp++;
        aim = path[wp];
      }
    } else {
      // A target at a time: for gates and races the next in order, for knocking and rounding up the nearest standing.
      let i = a.index;
      if (s.type === 'knock' || s.type === 'grab') {
        let bestD = Infinity;
        a.targets.forEach((tg, k) => {
          if (tg.got) return;
          const dd = Math.hypot(tg.x - b.x, tg.z - b.z) + (hints[k] ? 30 : 0);
          if (dd < bestD) { bestD = dd; i = k; }
        });
      }
      if (a.stage !== stage || i !== index) {
        stage = a.stage; index = i;
        const target = a.targets[i];
        path = wayTo(i, target);
        path.push([target.x, target.z, { speed: path.at(-1)?.[2].speed ?? 4, radius: 0.3 }]);
        wp = 0; best = Infinity; sinceBest = 0; replans = 0;
      }
      const w = path[Math.min(wp, path.length - 1)];
      const o = w[2];
      const dd = Math.hypot(w[0] - b.x, w[1] - b.z);
      const waiting = o.until && !o.until(run);
      if (!waiting && dd < (o.radius ?? 0.5) && wp < path.length - 1) { wp++; best = Infinity; sinceBest = 0; }
      if (dd < best - 0.3) { best = dd; sinceBest = 0; } else if (!waiting) sinceBest += STEP;
      // Off the way (knocked aside, fallen off something): find the way again, from here.
      if (sinceBest > 4 && replans < 3 && !hints[index]) {
        const target = a.targets[index];
        path = [...plan([target.x, target.z], { speed: path.at(-1)[2].speed }), [target.x, target.z, { speed: path.at(-1)[2].speed, radius: 0.3 }]];
        wp = 0; best = Infinity; sinceBest = 0; replans++;
      }
      if (sinceBest > 20) return { passed: false, stuck: { job: job.id, stage: a.stage, target: index, wp, at: [b.x, b.y, b.z].map((q) => +q.toFixed(2)), to: [w[0], w[1]] }, time: t, hurts };
      aim = w;
      dash = !fragile && run.dash.breath >= 1 && Math.hypot(b.vx, b.vz) > 6 && dd > 8;
      if (waiting) aim = [w[0], w[1], { ...o, stop: true }];
    }

    // Steer: toward the aim at its speed, easing in where it has to stop.
    const [tx, tz, o] = aim;
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    let speed = o.speed ?? 4;
    if (fragile) speed = Math.min(speed, 3.2);
    // Slower into a sharp turn at the next waypoint, not through every one.
    let turnSpeed = speed;
    if (path.length && path[wp] === aim && wp < path.length - 1 && d < 2.2) {
      const [nx, nz] = path[wp + 1];
      const ax = nx - tx, az = nz - tz, al = Math.hypot(ax, az) || 1;
      const cos = (dx * ax + dz * az) / ((d || 1) * al);
      if (cos < 0.4) turnSpeed = Math.min(speed, 2.5 + Math.max(0, cos + 0.6) * 3);
    }
    const want = o.stop ? Math.min(speed, d * 2.5) : path[wp] === aim && wp === path.length - 1 && s.type !== 'gates' && s.type !== 'race' && !(s.type === 'ram' || s.type === 'tail') ? Math.min(speed, Math.max(1.8, d * 3.2)) : turnSpeed;
    let vx = d > 1e-3 ? (dx / d) * want : 0;
    let vz = d > 1e-3 ? (dz / d) * want : 0;
    for (const q of run.hazards.drums) {
      const ex = b.x - q.ball.x, ez = b.z - q.ball.z, ed = Math.hypot(ex, ez);
      if (q.gone <= 0 && ed < 1.8 && ed > 1e-3) { const k = (1.8 - ed) * 3; vx += (ex / ed) * k; vz += (ez / ed) * k; }
    }
    if (!o.reckless) {
      for (const c of run.traffic.cars) {
        if (c.v < 0.8 || Math.abs(c.y - (b.y - b.r)) > 1.2) continue;
        if (Math.abs(c.x - b.x) > 9 || Math.abs(c.z - b.z) > 9) continue;
        let danger = false;
        for (let k = 0; k <= 1.4 && !danger; k += 0.2) {
          const cx = c.x + c.dx * c.v * k, cz = c.z + c.dz * c.v * k;
          const px = b.x + vx * k, pz = b.z + vz * k;
          const al = Math.abs((px - cx) * c.dx + (pz - cz) * c.dz), ac = Math.abs((px - cx) * c.dz - (pz - cz) * c.dx);
          if (al < c.size.length / 2 + 0.9 && ac < c.size.width / 2 + 0.75) danger = true;
        }
        if (danger) {
          const ax = b.x - c.x, az = b.z - c.z;
          const side = Math.sign(ax * c.dz - az * c.dx) || 1;
          vx = c.dz * side * 2.2 - vx * 0.2; vz = -c.dx * side * 2.2 - vz * 0.2;
          break;
        }
      }
    }
    let push = [(vx - b.vx) * 0.9, (vz - b.vz) * 0.9];
    const l = Math.hypot(push[0], push[1]);
    if (l > 1) { push[0] /= l; push[1] /= l; }
    if (o.air && !b.grounded) push = [0, -1];
    run.act.dash = dash;

    const out = stepRun(run, push);
    if (out.hurt) hurts.push({ how: out.hits.join(','), hurt: +out.hurt.toFixed(1), time: +t.toFixed(1) });
    if (log && Math.floor((t + STEP) / 2) !== Math.floor(t / 2)) console.log(`  ${job.id} t${t.toFixed(0)} stage${a.stage} #${index} wp${wp}/${path.length} at ${b.x.toFixed(1)},${b.z.toFixed(1)} y${b.y.toFixed(1)} clock ${a.clock.toFixed(0)}`);
    if (out.job?.passed) return { passed: true, time: t, left: a.clock, hurts };
    if (out.job?.failed) return { passed: false, why: out.job.failed.why, at: [b.x, b.y, b.z].map((q) => +q.toFixed(1)), stage: a.stage, target: index, time: t, hurts };
  }
  return { passed: false, why: 'limit', time: t, hurts };
}
