import { along, roundedPath } from './traffic.js';

/**
 * Work about town, the way it goes in Springfield: somebody stands about
 * with something they want doing, a "!" over their head. Roll up to them
 * and they say what it is; take it on and the clock starts. A job is a run
 * of stages, done one after another:
 *
 * - `go`: get to a place. On the way it may have you pick something up
 *   (`pickup`), fragile maybe (`fragile`: a knock harder than that and
 *   it's broken), or hand it over (`drop`).
 * - `gates`: through a string of gates, in order (a paper round, a lap).
 * - `knock`: knock every one of these flying.
 * - `grab`: round every one of these up.
 * - `ram`: a car going round a route; ram it `hits` times before the
 *   clock runs out.
 * - `tail`: follow a car to wherever it's going without losing it.
 * - `race`: through the gates, ahead of a rival in a ball of their own.
 *
 * It fails if the clock runs out, the bubble pops, the hamster goes in the
 * tar, what it carries breaks, the car it tails gets away, or the rival
 * gets there first. Done, it pays. Nothing here is drawn: the game draws
 * it (`jobview.js`), and the tests drive it.
 */

/** How long the "3, 2, 1" before a job is, in seconds. */
export const COUNTDOWN = 2.4;

/** How close to somebody counts as talking to them. */
const TALK = 1.15;

/** Why a job failed, in words. */
export const FAILS = Object.freeze({
  time: 'Out of time!',
  popped: 'The bubble popped!',
  squashed: 'Squashed!',
  sunk: 'Down the drain!',
  lost: 'You lost them!',
  broke: 'You broke it!',
  beaten: 'Beaten to the line!',
  quit: 'Gave up.',
});

/** Where a point is: [x, z, y?] with the ground (or `y`) under it, raised `lift`. */
const spot = (map, [x, z, y = null], lift = 0) => ({ x, z, y: (y ?? map.heightAt(x, z) ?? 0) + lift, got: false });

export function createBoard(map, { done = [] } = {}) {
  const givers = map.givers.map((g) => ({ ...g, y: g.y ?? map.heightAt(g.x, g.z) ?? 0 }));
  const byId = new Map(givers.map((g) => [g.id, g]));
  for (const j of map.jobs) if (!byId.has(j.giver)) throw new Error(`${j.id}: nobody called ${j.giver}`);
  return {
    givers,
    jobs: map.jobs,
    done: new Set(done.filter((id) => map.jobs.some((j) => j.id === id))),
    /** Whom the hamster is talking to, and the job they have going: `{ giver, job }`, `job` null when they've nothing left. */
    offer: null,
    /** The job under way. */
    active: null,
    /** The last job tried, for another go. */
    last: null,
  };
}

/** The job `giver` has going next, if any: the first not done whose `after` is. */
export function nextJob(board, giver) {
  return board.jobs.find((j) => j.giver === giver.id && !board.done.has(j.id) && (!j.after || board.done.has(j.after))) ?? null;
}

/** Whether `giver` has a job to give now. */
export const hasWork = (board, giver) => nextJob(board, giver) !== null;

/** Take `job` on: the clock set, the first stage laid out. Returns the job under way. */
export function startJob(run, job) {
  const board = run.board;
  const a = {
    job, stage: -1, clock: job.time, phase: 'ready', countdown: COUNTDOWN,
    targets: [], index: 0, carry: null, mover: null, rival: null, need: 0, hits: 0, meter: 1, cooldown: 0,
  };
  board.active = a;
  board.last = job;
  board.offer = null;
  enterStage(run, a, 0);
  return a;
}

/** Give the job under way up. */
export function quitJob(run) {
  const a = run.board.active;
  if (!a) return null;
  return fail(run, a, 'quit');
}

function enterStage(run, a, i) {
  const map = run.map;
  const s = a.job.stages[i];
  a.stage = i;
  a.index = 0;
  a.targets = [];
  a.mover = null;
  a.rival = null;
  a.hits = 0;
  a.cooldown = 0;
  a.meter = 1;
  if (s.time && i > 0) a.clock += s.time;
  switch (s.type) {
    case 'go':
      a.targets = [spot(map, [...s.at, s.y])];
      break;
    case 'gates':
    case 'race':
      a.targets = s.points.map((p) => spot(map, p));
      break;
    case 'knock':
    case 'grab':
      a.targets = s.points.map((p) => spot(map, p));
      break;
    case 'ram':
    case 'tail': {
      const path = roundedPath(s.route, { open: s.type === 'tail' || s.loop === false, round: 2.2 });
      a.mover = { path, s: 0, v: 0, speed: s.speed ?? 4.5, x: 0, y: 0, z: 0, dx: 0, dz: 1, model: s.model ?? 'sedan', paint: s.paint ?? '#c8382c', size: SIZES[s.model ?? 'sedan'], box: { solid: true, kind: 'car', vx: 0, vy: 0, vz: 0, min: [0, 0, 0], max: [0, 0, 0] }, done: false };
      placeMover(map, a.mover, 0);
      run.world.boxes.push(a.mover.box);
      break;
    }
  }
  if (s.type === 'race') {
    const first = s.from ?? a.job.start ?? [run.ball.x, run.ball.z];
    const path = roundedPath([first, ...(s.line ?? s.points).map((p) => [p[0], p[1]])], { open: true, round: s.round ?? 3 });
    a.rival = { path, s: 0, speed: s.rival.speed, name: s.rival.name, tint: s.rival.tint, x: first[0], y: 0, z: first[1], dx: 0, dz: 1, done: false };
    placeRival(map, a.rival, run.ball.r);
  }
  a.need = s.type === 'ram' ? s.hits : a.targets.length;
}

/** The sizes of what the jobs have driving about, as the traffic's. */
const SIZES = {
  sedan: { length: 1.9, width: 0.95, height: 0.85 },
  hatchback: { length: 1.7, width: 0.95, height: 0.85 },
  pickup: { length: 2.1, width: 0.95, height: 0.85 },
  boxtruck: { length: 2.7, width: 1.1, height: 1.4 },
  tanker: { length: 4.2, width: 1.15, height: 1.5 },
};

const at = { x: 0, z: 0, dx: 0, dz: 1 };

function placeMover(map, m, dt) {
  along(m.path, m.s, at);
  const y = map.roadAt(at.x, at.z);
  if (dt > 0) {
    m.box.vx = (at.x - m.x) / dt;
    m.box.vz = (at.z - m.z) / dt;
    m.box.vy = (y - m.y) / dt;
  }
  m.x = at.x; m.y = y; m.z = at.z; m.dx = at.dx; m.dz = at.dz;
  const { length: L, width: W, height: H } = m.size;
  const ex = (Math.abs(at.dx) * L + Math.abs(at.dz) * W) / 2;
  const ez = (Math.abs(at.dz) * L + Math.abs(at.dx) * W) / 2;
  m.box.min[0] = at.x - ex; m.box.min[1] = y; m.box.min[2] = at.z - ez;
  m.box.max[0] = at.x + ex; m.box.max[1] = y + H; m.box.max[2] = at.z + ez;
}

function placeRival(map, r, radius) {
  along(r.path, r.s, at);
  r.x = at.x; r.z = at.z; r.dx = at.dx; r.dz = at.dz;
  r.y = (map.heightAt(at.x, at.z) ?? 0) + radius;
}

/** Off the world's list of things to bump into. */
function dropMover(run, a) {
  if (!a.mover) return;
  const i = run.world.boxes.indexOf(a.mover.box);
  if (i >= 0) run.world.boxes.splice(i, 1);
}

function fail(run, a, why) {
  dropMover(run, a);
  run.board.active = null;
  return { job: a.job, why, text: why === 'broke' && a.job.broke ? a.job.broke : FAILS[why] };
}

function pass(run, a) {
  dropMover(run, a);
  run.board.active = null;
  run.board.done.add(a.job.id);
  run.cash += a.job.reward;
  return { job: a.job, reward: a.job.reward };
}

/** Is the ball touching `box` (a car's)? */
function touching(ball, box) {
  const qx = Math.max(box.min[0], Math.min(ball.x, box.max[0]));
  const qy = Math.max(box.min[1], Math.min(ball.y, box.max[1]));
  const qz = Math.max(box.min[2], Math.min(ball.z, box.max[2]));
  return Math.hypot(ball.x - qx, ball.y - qy, ball.z - qz) < ball.r + 0.06;
}

/** A car of the traffic in front of `m`, close enough to brake for: how much room there is, or Infinity. */
function roomAhead(m, cars) {
  let room = Infinity;
  for (const o of cars) {
    const rx = o.x - m.x, rz = o.z - m.z;
    if (Math.abs(rx) > 7 || Math.abs(rz) > 7 || Math.abs(o.y - m.y) > 1.5) continue;
    const ahead = rx * m.dx + rz * m.dz, side = Math.abs(rx * m.dz - rz * m.dx);
    if (ahead <= 0 || side > 1.2) continue;
    room = Math.min(room, ahead - m.size.length / 2 - o.size.length / 2);
  }
  return room;
}

/**
 * One step of the jobs. `ball` before its step was going (`vx`, `vz`);
 * `hap` is what happened to it this step (from `stepRun`: its knocks and
 * the outcome). Returns what happened to the job: `offer` (when whom
 * it's talking to changes), `go` (the clock starts), `stage`, `tick`
 * (a gate, a hit, a thing knocked or grabbed), `passed`, `failed`.
 */
export function stepJobs(run, dt, hap, { vx = 0, vz = 0 } = {}) {
  const board = run.board, ball = run.ball;
  const out = { offer: undefined, go: false, stage: null, tick: null, passed: null, failed: null };
  const a = board.active;

  if (!a) {
    // Talking to anybody?
    let near = null;
    for (const g of board.givers) {
      if (Math.hypot(g.x - ball.x, g.z - ball.z) < TALK && Math.abs(ball.y - ball.r - g.y) < 0.8) { near = g; break; }
    }
    const was = board.offer?.giver ?? null;
    if (near !== was || (near && board.offer.job !== nextJob(board, near))) {
      board.offer = near ? { giver: near, job: nextJob(board, near) } : null;
      out.offer = board.offer;
    }
    return out;
  }

  if (a.phase === 'ready') {
    a.countdown -= dt;
    if (a.countdown <= 0) { a.phase = 'go'; out.go = true; }
    return out;
  }

  if (hap.outcome) { out.failed = fail(run, a, hap.outcome); return out; }
  a.clock -= dt;
  a.cooldown -= dt;
  if (a.carry?.fragile && (hap.hurt > 0 || hap.impact > a.carry.fragile)) { out.failed = fail(run, a, 'broke'); return out; }

  const s = a.job.stages[a.stage];
  const close = (t, r, high = 1.6) => Math.hypot(t.x - ball.x, t.z - ball.z) < r && Math.abs(ball.y - ball.r - t.y) < high;
  let cleared = false;

  switch (s.type) {
    case 'go': {
      if (close(a.targets[0], s.r ?? 1.1)) {
        if (s.pickup) a.carry = { kind: s.pickup, fragile: s.fragile ?? 0 };
        if (s.drop) a.carry = null;
        cleared = true;
      }
      break;
    }
    case 'gates':
    case 'race': {
      const t = a.targets[a.index];
      if (close(t, s.r ?? 1.5, 2.2)) {
        t.got = true;
        a.index++;
        if (s.bonus) a.clock += s.bonus;
        out.tick = { kind: 'gate', n: a.index, of: a.targets.length };
        if (a.index >= a.targets.length) cleared = true;
      }
      if (a.rival && !cleared) {
        const r = a.rival;
        r.s += r.speed * dt;
        placeRival(run.map, r, ball.r);
        if (r.s >= r.path.length) { out.failed = fail(run, a, 'beaten'); return out; }
      }
      break;
    }
    case 'knock':
    case 'grab': {
      for (const t of a.targets) {
        if (t.got || Math.abs(t.x - ball.x) > 1.2 || Math.abs(t.z - ball.z) > 1.2) continue;
        if (Math.hypot(t.x - ball.x, t.z - ball.z) < ball.r + 0.32 && Math.abs(ball.y - ball.r - t.y) < 0.7) {
          t.got = true;
          t.vx = ball.vx; t.vz = ball.vz;
          a.index++;
          out.tick = { kind: s.type, n: a.index, of: a.targets.length, target: t };
        }
      }
      if (a.index >= a.targets.length) cleared = true;
      break;
    }
    case 'ram':
    case 'tail': {
      const m = a.mover;
      const room = roomAhead(m, run.traffic.cars);
      const want = Math.min(m.speed, Math.max(0, (room - 0.8) * 2));
      m.v += Math.max(-12 * dt, Math.min(3.5 * dt, want - m.v));
      m.s += m.v * dt;
      if (m.path.open) m.s = Math.min(m.s, m.path.length);
      placeMover(run.map, m, dt);
      if (s.type === 'ram') {
        if (a.cooldown <= 0 && touching(ball, m.box)) {
          const rel = Math.hypot(vx - m.box.vx, vz - m.box.vz);
          if (rel > (s.hard ?? 2.2)) {
            a.hits++;
            a.cooldown = 0.7;
            // Rattled, it puts its foot down.
            m.speed *= 1.06;
            out.tick = { kind: 'hit', n: a.hits, of: s.hits, at: [m.x, m.y + 0.6, m.z] };
            if (a.hits >= s.hits) cleared = true;
          }
        }
      } else {
        const d = Math.hypot(m.x - ball.x, m.z - ball.z);
        const far = s.far ?? 14;
        a.meter = d > far ? a.meter - dt / (s.slack ?? 5) : Math.min(1, a.meter + dt / 3);
        if (a.meter <= 0) { out.failed = fail(run, a, 'lost'); return out; }
        if (m.s >= m.path.length && d < far) cleared = true;
      }
      break;
    }
  }

  if (cleared) {
    if (a.stage + 1 >= a.job.stages.length) { out.passed = pass(run, a); return out; }
    dropMover(run, a);
    enterStage(run, a, a.stage + 1);
    out.stage = a.stage;
    return out;
  }
  if (a.clock <= 0) { a.clock = 0; out.failed = fail(run, a, 'time'); }
  return out;
}

/** Where the job under way wants the hamster to go next, as { x, y, z }, for the arrow and the map. */
export function objective(board, ball) {
  const a = board.active;
  if (!a) return null;
  const s = a.job.stages[a.stage];
  if (a.mover) return { x: a.mover.x, y: a.mover.y + 0.6, z: a.mover.z };
  if (s.type === 'knock' || s.type === 'grab') {
    // Whichever still standing is nearest.
    let best = null, d = Infinity;
    for (const t of a.targets) {
      if (t.got) continue;
      const e = Math.hypot(t.x - ball.x, t.z - ball.z);
      if (e < d) { d = e; best = t; }
    }
    return best;
  }
  return a.targets[a.index] ?? null;
}
