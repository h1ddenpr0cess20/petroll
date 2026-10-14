import { RADIUS } from './hamster.js';
import { createHazards } from './hazards.js';
import { buildMap, DEPTH } from './map.js';
import { BREAK_SPEED, createBall, placeBall, stepBall } from './physics.js';
import { surfaceOf } from './surfaces.js';
import { createTown } from './town.js';
import { createTraffic } from './traffic.js';
import { groundAxes } from './view.js';

/**
 * The world as it runs, with nothing drawn or heard: the town, the traffic,
 * the things that move, the hamster's ball, and the rules — how the bubble
 * gets knocked about and cracked, what pops it, where it comes back to,
 * what it picks up. The game draws and plays it; the tests drive it.
 *
 * The bubble has 100 to start with. Hard landings, cars, drums and the
 * gas flares take it down; an air pump puts it back to 100 and is where the
 * hamster comes back to after a pop. A pumpjack coming down on it pops it
 * outright. Tar swallows it, and it's put back on the last firm ground.
 */

/** The physics runs at a fixed rate, whatever the frame rate. */
export const STEP = 1 / 120;

export const BUBBLE = 100;

/** How hard a landing has to be to hurt, and how much each kind of knock costs. */
export const HURT = Object.freeze({ landing: 9.5, car: 2.6, drum: 3.2, flare: 34 });

/** How close counts as picking something up, from the middle of the ball. */
const REACH = { seed: 0.55, golden: 0.75, pump: 0.95 };

/** A push on the screen (x right, y up) as a push along the ground, for a camera turned to `yaw`. */
export function toGround({ x, y }, yaw) {
  const { right, up } = groundAxes(yaw);
  return [x * right[0] + y * up[0], x * right[1] + y * up[1]];
}

export function createRun(GFX, { ball = createBall({ r: RADIUS }), map = createTown(), found = [] } = {}) {
  const built = buildMap(map);
  const killY = -DEPTH - 2;
  const traffic = createTraffic(GFX, map, built.world);
  const hazards = createHazards(GFX, map, built.world, { killY });
  const { x, z } = map.start;
  const start = [x + 0.5, map.heightAt(x + 0.5, z + 0.5) + ball.r, z + 0.5];
  const seeds = map.seeds.map((s) => ({ ...s, y: (s.y ?? map.heightAt(s.x, s.z) ?? 0) + 0.32, got: false }));
  const golden = map.golden.map((g) => ({ ...g, y: (g.y ?? map.heightAt(g.x, g.z) ?? 0) + 0.42, got: found.includes(g.name) }));
  const pumps = map.pumps.map((p) => ({ ...p, y: map.heightAt(p.x, p.z) ?? 0 }));
  const run = {
    map, built, world: built.world, traffic, hazards, killY, ball, time: 0,
    seeds, golden, pumps,
    bubble: BUBBLE,
    safe: start,
    checkpoint: pumps.find((p) => p.name === 'Home') ?? null,
    district: null,
    sinking: 0,
    cooldown: { car: 0, flare: 0, drum: 0 },
  };
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
 * `live`, the rules apply and the drums chase; while `moving` is false the
 * ball stays where it is. Returns what happened: how hard it hit anything,
 * the knocks and what they cost, what it picked up, and `outcome` — null,
 * or 'popped', 'squashed' or 'sunk'.
 */
export function stepRun(run, push, dt = STEP, { live = true, moving = true } = {}) {
  const ball = run.ball;
  run.time += dt;
  run.hazards.place(run.time, dt);
  const honks = run.traffic.step(dt, live && moving ? ball : null);
  const events = run.hazards.step(dt, run.time, live && moving ? ball : null);
  const out = { impact: 0, hurt: 0, hits: [], honks, picked: [], golden: null, pumped: null, district: null, outcome: null, surface: null };
  if (!moving) return out;

  for (const k in run.cooldown) run.cooldown[k] -= dt;
  const cell = under(run);
  const kind = surfaceOf(cell);
  out.surface = cell?.surface ?? null;
  const grip = cell ? kind.grip : 1;
  const result = stepBall(ball, run.world, push[0] * grip, push[1] * grip, dt, { drag: cell ? kind.drag : 0.5 });
  out.impact = result.impact;
  if (!live) return out;

  const hurt = (n, why) => {
    run.bubble = Math.max(0, run.bubble - n);
    out.hurt += n;
    out.hits.push(why);
  };

  if (result.crushed) { out.outcome = 'squashed'; return out; }
  if (result.landed && result.impact > HURT.landing) {
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
  if (run.bubble <= 0) { out.outcome = 'popped'; return out; }
  if (ball.y < run.killY) { out.outcome = 'sunk'; return out; }

  // Tar: it goes under if it sits in it.
  if (cell && kind.sinks) {
    run.sinking += dt;
    if (run.sinking > 0.7) { out.outcome = 'sunk'; return out; }
  } else {
    run.sinking = Math.max(0, run.sinking - dt * 2);
  }

  // Firm ground to come back to.
  if (cell && !kind.sinks) {
    const cx = Math.floor(ball.x), cz = Math.floor(ball.z);
    if (run.map.isSafe(cx, cz)) run.safe = [cx + 0.5, cell.h[0] + ball.r, cz + 0.5];
  }

  // Seeds, golden seeds, air pumps.
  for (const s of run.seeds) {
    if (s.got || Math.abs(s.x - ball.x) > 1 || Math.abs(s.z - ball.z) > 1) continue;
    if (Math.hypot(s.x - ball.x, s.y - ball.y, s.z - ball.z) < REACH.seed) { s.got = true; out.picked.push(s); }
  }
  for (const g of run.golden) {
    if (g.got || Math.abs(g.x - ball.x) > 1.5 || Math.abs(g.z - ball.z) > 1.5) continue;
    if (Math.hypot(g.x - ball.x, g.y - ball.y, g.z - ball.z) < REACH.golden) { g.got = true; out.golden = g; }
  }
  for (const p of run.pumps) {
    if (Math.hypot(p.x - ball.x, p.z - ball.z) < REACH.pump && Math.abs(ball.y - ball.r - p.y) < 0.6) {
      if (run.checkpoint !== p || run.bubble < BUBBLE) out.pumped = p;
      run.checkpoint = p;
      run.bubble = BUBBLE;
    }
  }
  const d = run.map.districtAt(ball.x, ball.z);
  if (d && d !== run.district) { run.district = d; out.district = d; }
  return out;
}
