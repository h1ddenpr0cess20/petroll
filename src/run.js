import { RADIUS } from './hamster.js';
import { createHazards } from './hazards.js';
import { createBoard, stepJobs } from './jobs.js';
import { buildMap, DEPTH } from './map.js';
import { BREAK_SPEED, createBall, placeBall, PUSH, stepBall, TOP_SPEED } from './physics.js';
import { surfaceOf } from './surfaces.js';
import { createTown } from './town.js';
import { createTraffic } from './traffic.js';
import { groundAxes } from './view.js';

/**
 * The world as it runs, with nothing drawn or heard: the town, the traffic,
 * the things that move, the hamster's ball, and the rules — how the bubble
 * gets knocked about and cracked, what pops it, where it comes back to,
 * what it picks up (sunflower seeds, golden seeds) and knocks flying, the
 * jobs (`jobs.js`) and what they pay. The game
 * draws and plays it; the tests drive it.
 *
 * The bubble has 100 to start with. Hard landings, cars, drums and the
 * gas flares take it down; an air pump puts it back to 100 and is where the
 * hamster comes back to after a pop. A pumpjack coming down on it pops it
 * outright. Tar swallows it, and it's put back on the last firm ground.
 *
 * The hamster can hop (a bounce off the floor of the ball) and dash (a
 * burst of scurrying, which takes a while to get its breath back from).
 */

/** The physics runs at a fixed rate, whatever the frame rate. */
export const STEP = 1 / 120;

export const BUBBLE = 100;

/** How hard a landing has to be to hurt, and how much each kind of knock costs. */
export const HURT = Object.freeze({ landing: 9.5, car: 2.6, drum: 3.2, flare: 34 });

/** How close counts as picking something up (or being on an air pump's pad), from the middle of the ball. */
const REACH = { seed: 0.55, golden: 0.75, pump: 0.95 };

/** The highest step the hamster scrambles up from a standstill (a kerb is 0.15). */
const STEP_UP = 0.22;

/** A hop: how fast it leaves the ground, and how long after rolling off an edge it still can. */
export const HOP = 6.6;
const COYOTE = 0.12;

/** A dash: how long it lasts, how much harder it pushes, how fast it can go, and how long to get its breath back. */
export const DASH = Object.freeze({ time: 0.65, push: 2.3, top: 14.5, kick: 3.5, rest: 2.6 });

/** What there is to buy, and what each buys (see `shop.js`): a thicker shell, a better wheel, grippier treads. */
export const PERKS = Object.freeze({ shell: 0.6, rest: 0.5, grip: 0.7 });

/** What each thing knocked flying pays, and how long until it's stood up again. */
export const KNOCK = Object.freeze({ cash: { cone: 1, bin: 2, flamingo: 3, crate: 2, sign: 3 }, back: 75 });

/** A push on the screen (x right, y up) as a push along the ground, for a camera turned to `yaw`. */
export function toGround({ x, y }, yaw) {
  const { right, up } = groundAxes(yaw);
  return [x * right[0] + y * up[0], x * right[1] + y * up[1]];
}

export function createRun(GFX, { ball = createBall({ r: RADIUS }), map = createTown(), found = [], done = [], cash = 0, perks = [] } = {}) {
  const built = buildMap(map);
  const killY = -DEPTH - 2;
  const traffic = createTraffic(GFX, map, built.world);
  const hazards = createHazards(GFX, map, built.world, { killY });
  const { x, z } = map.start;
  const start = [x + 0.5, map.heightAt(x + 0.5, z + 0.5) + ball.r, z + 0.5];
  const seeds = map.seeds.map((s) => ({ ...s, y: (s.y ?? map.heightAt(s.x, s.z) ?? 0) + 0.32, got: false }));
  const golden = map.golden.map((g) => ({ ...g, y: (g.y ?? map.heightAt(g.x, g.z) ?? 0) + 0.42, got: found.includes(g.name) }));
  const knocks = map.knocks.map((k) => ({ ...k, y: k.y ?? map.heightAt(k.x, k.z) ?? 0, down: 0, vx: 0, vz: 0 }));
  const pumps = map.pumps.map((p) => ({ ...p, y: map.heightAt(p.x, p.z) ?? 0 }));
  const run = {
    map, built, world: built.world, traffic, hazards, killY, ball, time: 0,
    seeds, golden, knocks, pumps,
    board: createBoard(map, { done }),
    cash,
    perks: new Set(perks),
    bubble: BUBBLE,
    /** What the hamster wants to do this step, besides roll: set by the game, used up by `stepRun`. */
    act: { hop: false, dash: false },
    dash: { time: 0, breath: 1 },
    air: 0,
    safe: start,
    checkpoint: pumps.find((p) => p.name === 'Home') ?? null,
    district: null,
    sinking: 0,
    cooldown: { car: 0, flare: 0, drum: 0 },
  };
  // The townsfolk stand their ground: the ball bumps into them.
  for (const g of run.board.givers) run.world.addCylinder({ x: g.x, z: g.z, r: 0.34, y0: g.y, y1: g.y + 1.6 });
  hazards.place(0);
  placeBall(ball, ...start);
  return run;
}

/** Back to the last air pump, the bubble topped up. */
export function respawn(run) {
  const p = run.checkpoint;
  if (p) placeBall(run.ball, p.x, p.y + run.ball.r + 0.05, p.z);
  else placeBall(run.ball, ...run.safe);
  run.bubble = BUBBLE;
  run.sinking = 0;
  run.dash.time = 0;
}

/** Back onto the last firm ground it crossed (after the tar). */
export function putBack(run) {
  placeBall(run.ball, ...run.safe);
  run.sinking = 0;
}

/** The surface the ball is rolling on, if it's on the ground and not on something. */
export function under(run) {
  const b = run.ball;
  if (!b.grounded || b.on) return null;
  const c = run.map.cell(Math.floor(b.x), Math.floor(b.z));
  if (!c) return null;
  // Only if it's on the tile itself, not on a deck over it.
  const h = run.map.heightAt(b.x, b.z);
  return h != null && b.y - b.r - h < 0.12 ? c : null;
}

/**
 * One step of everything. `push` is along the ground ([x, z]). While
 * `live`, the rules apply, the drums chase and the jobs run; while
 * `moving` is false the ball stays where it is. Returns what happened: how
 * hard it hit anything, the knocks and what they cost, the seeds it ate
 * and the golden seed it found, what it knocked flying, the pump it topped up at, `job` (see `stepJobs`), and `outcome`
 * — null, or 'popped', 'squashed' or 'sunk'.
 */
export function stepRun(run, push, dt = STEP, { live = true, moving = true } = {}) {
  const ball = run.ball;
  run.time += dt;
  run.hazards.place(run.time, dt);
  const honks = run.traffic.step(dt, live && moving ? ball : null);
  const events = run.hazards.step(dt, run.time, live && moving ? ball : null);
  const out = { impact: 0, hurt: 0, hits: [], honks, picked: [], golden: null, knocked: [], cash: 0, pumped: null, district: null, outcome: null, surface: null, hopped: false, dashed: false, bounced: false, job: null };
  const act = run.act;
  if (!moving) { act.hop = act.dash = false; return out; }
  // Held for the count in to a job.
  if (run.board.active?.phase === 'ready') { push = [0, 0]; act.hop = act.dash = false; }

  for (const k in run.cooldown) run.cooldown[k] -= dt;
  const cell = under(run);
  const kind = surfaceOf(cell);
  out.surface = cell?.surface ?? null;
  const grip = cell ? Math.max(kind.grip, run.perks.has('treads') ? PERKS.grip : 0) : 1;

  // Hop and dash.
  run.air = ball.grounded ? 0 : run.air + dt;
  if (act.hop && run.air < COYOTE && live) {
    ball.vy = Math.max(ball.vy, HOP);
    ball.grounded = false;
    ball.on = null;
    run.air = COYOTE;
    out.hopped = true;
  }
  const d = run.dash;
  d.breath = Math.min(1, d.breath + dt / (DASH.rest * (run.perks.has('wheel') ? PERKS.rest : 1)));
  if (act.dash && d.breath >= 1 && live) {
    d.time = DASH.time;
    d.breath = 0;
    // A kick the way it's pushed (or, with no push, the way it's going).
    let kx = push[0], kz = push[1];
    if (Math.hypot(kx, kz) < 0.2) { kx = ball.vx; kz = ball.vz; }
    const l = Math.hypot(kx, kz);
    if (l > 1e-3) { ball.vx += (kx / l) * DASH.kick; ball.vz += (kz / l) * DASH.kick; }
    out.dashed = true;
  }
  act.hop = act.dash = false;
  const dashing = d.time > 0;
  d.time -= dt;

  // A kerb, or any little step up, pushed against slowly: a lift up onto it, as the hamster scrambles.
  const pl = Math.hypot(push[0], push[1]);
  if (ball.grounded && pl > 0.4 && Math.hypot(ball.vx, ball.vz) < 1.5) {
    const ux = push[0] / pl, uz = push[1] / pl;
    const reach = ball.r + 0.08;
    const here = run.map.heightAt(ball.x, ball.z);
    const mid = run.map.heightAt(ball.x + ux * reach * 0.5, ball.z + uz * reach * 0.5);
    const ahead = run.map.heightAt(ball.x + ux * reach, ball.z + uz * reach);
    // (A step, not a slope: one half of the way there is level.)
    const step = here != null && mid != null && ahead != null && Math.min(Math.abs(mid - here), Math.abs(ahead - mid)) < 0.01;
    if (step && ahead - here > 0.03 && ahead - here < STEP_UP && ball.y - ball.r < ahead + 0.02) {
      ball.vy = Math.max(ball.vy, 2.6);
      ball.vx += ux * 0.6; ball.vz += uz * 0.6;
    }
  }

  const vx0 = ball.vx, vz0 = ball.vz;
  const result = stepBall(ball, run.world, push[0] * grip, push[1] * grip, dt, {
    drag: cell ? kind.drag : 0.5,
    push: dashing ? PUSH * DASH.push : PUSH,
    topSpeed: dashing ? DASH.top : TOP_SPEED,
  });
  // Never under the ground: if something shoved it there (a car into a kerb or a bank), up onto it again.
  const ground = run.map.heightAt(ball.x, ball.z);
  if (ground != null && ball.y < ground - 0.02) {
    ball.y = ground + ball.r;
    ball.vy = Math.max(0, ball.vy);
  }
  out.impact = result.impact;
  // A trampoline throws it up again, and catches it kindly.
  const now = under(run);
  const sprung = now && surfaceOf(now).bounce;
  if (sprung && ball.grounded && ball.vy < 1) {
    ball.vy = surfaceOf(now).bounce;
    ball.grounded = false;
    ball.on = null;
    out.bounced = true;
  }
  if (!live) return out;

  const hurt = (n, why) => {
    n *= run.perks.has('shell') ? PERKS.shell : 1;
    run.bubble = Math.max(0, run.bubble - n);
    out.hurt += n;
    out.hits.push(why);
  };

  if (result.crushed) out.outcome = 'squashed';
  else {
    if (result.landed && result.impact > HURT.landing && !sprung) {
      hurt(result.impact >= BREAK_SPEED ? 55 + (result.impact - BREAK_SPEED) * 10 : (result.impact - HURT.landing) * 9, 'landing');
    }
    const car = run.traffic.touching(ball);
    if (car && result.impact > HURT.car && run.cooldown.car <= 0) {
      hurt(8 + (result.impact - HURT.car) * 7, 'car');
      run.cooldown.car = 0.5;
      if (!honks.includes(car)) honks.push(car);
    }
    if (events.bump > HURT.drum && run.cooldown.drum <= 0) {
      hurt((events.bump - HURT.drum) * 6 + 4, 'drum');
      run.cooldown.drum = 0.4;
    }
    if (events.burned && run.cooldown.flare <= 0) {
      hurt(HURT.flare, 'flare');
      ball.vy = Math.max(ball.vy, 5.5);
      run.cooldown.flare = 0.8;
    }
    if (run.bubble <= 0) out.outcome = 'popped';
    else if (ball.y < run.killY) out.outcome = 'sunk';
    else if (cell && kind.sinks) {
      // Tar: it goes under if it sits in it.
      run.sinking += dt;
      if (run.sinking > 0.7) out.outcome = 'sunk';
    } else {
      run.sinking = Math.max(0, run.sinking - dt * 2);
    }
  }
  if (out.outcome) {
    out.job = stepJobs(run, dt, out, { vx: vx0, vz: vz0 });
    return out;
  }

  // Firm ground to come back to.
  if (cell && !kind.sinks) {
    const cx = Math.floor(ball.x), cz = Math.floor(ball.z);
    if (run.map.isSafe(cx, cz)) run.safe = [cx + 0.5, cell.h[0] + ball.r, cz + 0.5];
  }

  // Seeds, golden seeds, things to knock flying, air pumps.
  for (const s of run.seeds) {
    if (s.got || Math.abs(s.x - ball.x) > 1 || Math.abs(s.z - ball.z) > 1) continue;
    if (Math.hypot(s.x - ball.x, s.y - ball.y, s.z - ball.z) < REACH.seed) { s.got = true; out.picked.push(s); }
  }
  for (const g of run.golden) {
    if (g.got || Math.abs(g.x - ball.x) > 1.5 || Math.abs(g.z - ball.z) > 1.5) continue;
    if (Math.hypot(g.x - ball.x, g.y - ball.y, g.z - ball.z) < REACH.golden) { g.got = true; out.golden = g; }
  }
  for (const k of run.knocks) {
    if (k.down > 0) {
      k.down -= dt;
      // Stood up again when nobody's looking.
      if (k.down <= 0 && Math.hypot(k.x - ball.x, k.z - ball.z) < 14) k.down = 2;
      continue;
    }
    if (Math.abs(k.x - ball.x) > 1 || Math.abs(k.z - ball.z) > 1) continue;
    if (Math.hypot(k.x - ball.x, k.z - ball.z) < ball.r + 0.28 && Math.abs(ball.y - ball.r - k.y) < 0.7) {
      k.down = KNOCK.back;
      k.vx = ball.vx; k.vz = ball.vz;
      const pay = KNOCK.cash[k.kind] ?? 1;
      run.cash += pay;
      out.cash += pay;
      out.knocked.push(k);
    }
  }
  for (const p of run.pumps) {
    if (Math.hypot(p.x - ball.x, p.z - ball.z) < REACH.pump && Math.abs(ball.y - ball.r - p.y) < 0.6) {
      if (run.checkpoint !== p || run.bubble < BUBBLE) out.pumped = p;
      run.checkpoint = p;
      run.bubble = BUBBLE;
    }
  }
  const dist = run.map.districtAt(ball.x, ball.z);
  if (dist && dist !== run.district) { run.district = dist; out.district = dist; }
  out.job = stepJobs(run, dt, out, { vx: vx0, vz: vz0 });
  return out;
}
