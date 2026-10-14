import { createKit } from './kit.js';
import { collideBalls, createBall, placeBall, PUSH, rollSpin, stepBall, turn } from './physics.js';

/**
 * Everything in the world that moves on its own and isn't traffic:
 *
 * - pumpjacks, nodding: the horse's head comes down on a tile and goes up
 *   again, and anything under it when it comes down is squashed;
 * - gas flares, coming up out of the floor of the refinery for a moment
 *   every few seconds — hot enough to melt plastic;
 * - lifts, carrying the hamster up a derrick or the side of a tank;
 * - oil drums, which roll after the hamster when it comes near, heavy
 *   enough to knock it about.
 */

const DRUM_RADIUS = 0.34;
const DRUM_MASS = 2.2;
const HEAD = { w: 0.8, d: 0.7, h: 0.75 };
const LIFT_THICKNESS = 0.4;

const smooth = (t) => t * t * (3 - 2 * t);

/** How far up a pumpjack's head is, 0 (down on the ground) to 1: a slow nod, lingering at the bottom. */
export function nodAt(time, period, phase = 0) {
  const u = ((((time + phase) / period) % 1) + 1) % 1;
  return Math.min(1, Math.max(0, 0.5 - 0.62 * Math.cos(u * Math.PI * 2)));
}

/** Whether a flare is burning at `time`, and how hard (0 to 1). */
export function flareAt(time, period, phase = 0, burn = 0.35) {
  const u = ((((time + phase) / period) % 1) + 1) % 1;
  if (u > burn) return 0;
  return Math.sin((u / burn) * Math.PI) ** 0.5;
}

/** How far along its run a lift is, 0 to 1 and back, waiting `pause` (of a period) at each end. */
export function liftAt(time, period, phase = 0, pause = 0.18) {
  const u = ((((time + phase) / period) % 1) + 1) % 1;
  const run = 0.5 - pause;
  if (u < pause) return 0;
  if (u < 0.5) return smooth((u - pause) / run);
  if (u < 0.5 + pause) return 1;
  return 1 - smooth((u - 0.5 - pause) / run);
}

export function createHazards(GFX, map, world, { killY }) {
  const group = new GFX.Group();
  group.name = 'hazards';

  // Pumpjacks: the frame drawn once, the beam and the head moving.
  const frame = createKit(GFX);
  const steel = '#3a3d44', red = '#c8382c', yellow = '#f2c230';
  const pumpjacks = map.pumpjacks.map((p) => {
    const base = map.heightAt(p.x + 0.5, p.z + 0.5) ?? 0;
    const pivot = [p.x - 1.8, base + 2.3, p.z + 0.5];
    // The Samson post, the motor and crank at the back, the wellhead under the head.
    frame.beam([pivot[0] - 0.5, base, pivot[2] - 0.45], pivot, 0.07, steel).beam([pivot[0] - 0.5, base, pivot[2] + 0.45], pivot, 0.07, steel);
    frame.beam([pivot[0] + 0.5, base, pivot[2] - 0.45], pivot, 0.07, steel).beam([pivot[0] + 0.5, base, pivot[2] + 0.45], pivot, 0.07, steel);
    frame.slab(p.x - 4.4, base, p.z + 0.1, p.x - 2.6, base + 1.1, p.z + 0.9, '#5a6068');
    frame.cyl([p.x - 3.2, base + 1.25, p.z + 0.5], 0.3, 0.2, red, { rot: [Math.PI / 2, 0, 0] });
    frame.slab(p.x - 5, base - 0.05, p.z - 0.6, p.x + 1.2, base + 0.05, p.z + 1.6, '#7a7f86');
    frame.cyl([p.x + 0.5, base + 0.15, p.z + 0.5], 0.12, 0.3, '#5a6068');
    const beam = new GFX.Group();
    beam.position.set(...pivot);
    const kit = createKit(GFX);
    kit.slab(-1.9, -0.12, -0.1, 2.0, 0.12, 0.1, yellow, { finish: 'shiny' });
    kit.slab(-2.4, -0.5, -0.2, -1.8, 0.1, 0.2, steel);
    beam.add(kit.build({ name: 'beam' }));
    const head = createKit(GFX);
    head.slab(-HEAD.w / 2, -HEAD.h / 2, -HEAD.d / 2, HEAD.w / 2, HEAD.h / 2, HEAD.d / 2, yellow, { finish: 'shiny' });
    head.slab(-HEAD.w / 2 - 0.01, -HEAD.h / 2, -0.1, HEAD.w / 2 + 0.01, -HEAD.h / 2 + 0.12, 0.1, '#1d1d22');
    const headMesh = head.build({ name: 'horsehead' });
    group.add(beam, headMesh);
    const box = {
      solid: true, kind: 'pumpjack', vx: 0, vy: 0, vz: 0,
      min: [p.x + 0.5 - HEAD.w / 2, base, p.z + 0.5 - HEAD.d / 2], max: [p.x + 0.5 + HEAD.w / 2, base + HEAD.h, p.z + 0.5 + HEAD.d / 2],
    };
    return { ...p, base, pivot, beam, head: headMesh, box };
  });
  if (!frame.empty) group.add(frame.build({ name: 'pumpjack-frames' }));

  // Flares: a grate in the floor, and the flame that comes up out of it.
  const grates = createKit(GFX);
  const flameMaterial = new GFX.MeshBasicMaterial({ name: 'flame', color: new GFX.Color('#ffb040'), transparent: true, opacity: 0.85, depthWrite: false, blending: GFX.AdditiveBlending });
  const coreMaterial = new GFX.MeshBasicMaterial({ name: 'flame-core', color: new GFX.Color('#fff2b0'), transparent: true, opacity: 0.9, depthWrite: false, blending: GFX.AdditiveBlending });
  const flameGeometry = new GFX.ConeGeometry(0.42, 1, 14, 1, true);
  flameGeometry.translate(0, 0.5, 0);
  const flares = map.flares.map((f) => {
    const y = map.heightAt(f.x + 0.5, f.z + 0.5) ?? 0;
    grates.cyl([f.x + 0.5, y + 0.01, f.z + 0.5], 0.4, 0.03, '#2a2a30');
    grates.torus([f.x + 0.5, y + 0.03, f.z + 0.5], 0.4, 0.04, '#c8a040', { rot: [Math.PI / 2, 0, 0], finish: 'shiny' });
    for (const k of [-0.2, 0, 0.2]) grates.slab(f.x + 0.12, y + 0.02, f.z + 0.5 + k - 0.025, f.x + 0.88, y + 0.04, f.z + 0.5 + k + 0.025, '#5a5a60');
    const flame = new GFX.Mesh(flameGeometry, flameMaterial);
    const core = new GFX.Mesh(flameGeometry, coreMaterial);
    core.scale.set(0.5, 0.6, 0.5);
    flame.add(core);
    flame.position.set(f.x + 0.5, y, f.z + 0.5);
    flame.visible = false;
    group.add(flame);
    return { ...f, y, flame, heat: 0 };
  });
  if (!grates.empty) group.add(grates.build({ name: 'grates', castShadow: false }));

  // Lifts.
  const lifts = map.lifts.map((l) => {
    const kit = createKit(GFX);
    kit.slab(-l.w / 2, -LIFT_THICKNESS / 2, -l.d / 2, l.w / 2, LIFT_THICKNESS / 2, l.d / 2, '#7a8189', { finish: 'shiny' });
    for (const k of [-1, 1]) kit.slab(-l.w / 2, LIFT_THICKNESS / 2 - 0.01, k * (l.d / 2 - 0.08) - 0.06, l.w / 2, LIFT_THICKNESS / 2 + 0.01, k * (l.d / 2 - 0.08) + 0.06, yellow);
    const mesh = kit.build({ name: 'lift' });
    group.add(mesh);
    const box = {
      solid: true, kind: 'lift', vx: 0, vy: 0, vz: 0,
      min: [l.x, l.h - LIFT_THICKNESS, l.z], max: [l.x + l.w, l.h, l.z + l.d],
    };
    return { ...l, box, mesh };
  });

  // Oil drums.
  const drumKit = createKit(GFX);
  const drumR = DRUM_RADIUS * 0.92;
  drumKit.cyl([0, 0, 0], drumR, DRUM_RADIUS * 2.6, '#2a5aa8', { segments: 20, finish: 'shiny' });
  for (const y of [-0.42, 0, 0.42]) drumKit.torus([0, y, 0], drumR, 0.025, '#1e4280', { rot: [Math.PI / 2, 0, 0] });
  drumKit.cyl([0, 0, 0], drumR * 1.01, 0.12, '#e8e2d6', { segments: 20 });
  const drumLook = drumKit.geometries();
  const drums = map.drums.map((d) => {
    const y = (map.heightAt(d.x, d.z) ?? 0) + DRUM_RADIUS;
    const mesh = new GFX.Group();
    const inner = new GFX.Group();
    for (const [finish, g] of Object.entries(drumLook)) {
      const m = new GFX.Mesh(g, finishMaterial(GFX, finish));
      m.castShadow = true;
      inner.add(m);
    }
    // Lying on its side: its axis across the way it rolls.
    inner.rotation.z = Math.PI / 2;
    mesh.add(inner);
    group.add(mesh);
    return {
      home: [d.x, y, d.z], range: d.range,
      ball: createBall({ x: d.x, y, z: d.z, r: DRUM_RADIUS, mass: DRUM_MASS }),
      mesh, q: [0, 0, 0, 1], spin: [0, 0, 0], gone: 0,
    };
  });

  world.boxes.push(...pumpjacks.map((p) => p.box), ...lifts.map((l) => l.box));

  const moveBox = (box, x, y, z, dt) => {
    if (dt > 0) {
      box.vx = (x - box.min[0]) / dt;
      box.vy = (y - box.min[1]) / dt;
      box.vz = (z - box.min[2]) / dt;
    }
    const sx = box.max[0] - box.min[0], sy = box.max[1] - box.min[1], sz = box.max[2] - box.min[2];
    box.min[0] = x; box.min[1] = y; box.min[2] = z;
    box.max[0] = x + sx; box.max[1] = y + sy; box.max[2] = z + sz;
  };

  /** Puts the things on a timetable where they are at `time`. */
  function place(time, dt = 0) {
    for (const p of pumpjacks) moveBox(p.box, p.box.min[0], p.base + 0.02 + p.lift * nodAt(time, p.period, p.phase), p.box.min[2], dt);
    for (const l of lifts) {
      const s = liftAt(time, l.period, l.phase, l.pause);
      moveBox(l.box, l.x + l.to[0] * s, l.h - LIFT_THICKNESS + l.to[1] * s, l.z + l.to[2] * s, dt);
    }
    for (const f of flares) f.heat = flareAt(time, f.period, f.phase, f.burn);
  }
  place(0);

  return {
    group, pumpjacks, flares, lifts, drums,
    place,

    /**
     * One step for what moves on its own. `ball` is the hamster's, or null.
     * Returns what happened to it: a knock from a drum, and whether a flare
     * caught it.
     */
    step(dt, time, ball) {
      const events = { bump: 0, burned: false };
      for (const d of drums) {
        const b = d.ball;
        if (d.gone > 0) {
          d.gone -= dt;
          if (d.gone <= 0) placeBall(b, ...d.home);
          continue;
        }
        let ax = 0, az = 0;
        const dx = ball ? ball.x - b.x : 0, dz = ball ? ball.z - b.z : 0;
        const dist = Math.hypot(dx, dz);
        // On a leash: only after a hamster near its own patch, and home again after.
        const fromHome = ball ? Math.hypot(ball.x - d.home[0], ball.z - d.home[2]) : Infinity;
        if (ball && dist < d.range && fromHome < d.range + 1.5 && Math.abs(ball.y - b.y) < 2 && dist > 1e-3) {
          ax = dx / dist; az = dz / dist;
        } else {
          const hx = d.home[0] - b.x, hz = d.home[2] - b.z, hd = Math.hypot(hx, hz);
          if (hd > 0.6) { ax = (hx / hd) * 0.5; az = (hz / hd) * 0.5; }
        }
        stepBall(b, world, ax, az, dt, { push: PUSH * 0.45, topSpeed: 3.6 });
        if (ball) events.bump = Math.max(events.bump, collideBalls(ball, b, 0.8));
        if (b.y < killY) d.gone = 3;
      }
      for (let i = 0; i < drums.length; i++) {
        for (let j = i + 1; j < drums.length; j++) collideBalls(drums[i].ball, drums[j].ball, 0.8);
      }
      if (ball) {
        for (const f of flares) {
          if (f.heat < 0.25) continue;
          const d = Math.hypot(ball.x - (f.x + 0.5), ball.z - (f.z + 0.5));
          if (d < 0.5 + ball.r * 0.6 && ball.y - f.y < 1.4 * f.heat + ball.r) events.burned = f;
        }
      }
      return events;
    },

    /** Meshes to match, once a frame. */
    sync(dt, time) {
      for (const p of pumpjacks) {
        const b = p.box;
        const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
        p.head.position.set(cx, cy, (b.min[2] + b.max[2]) / 2);
        // The beam reaches from its pivot to the top of the head.
        p.beam.rotation.z = Math.atan2(b.max[1] - p.pivot[1], cx - p.pivot[0]);
        p.head.rotation.z = p.beam.rotation.z * 0.6;
      }
      for (const l of lifts) l.mesh.position.set((l.box.min[0] + l.box.max[0]) / 2, (l.box.min[1] + l.box.max[1]) / 2, (l.box.min[2] + l.box.max[2]) / 2);
      for (const [i, f] of flares.entries()) {
        f.flame.visible = f.heat > 0.02;
        const flick = 1 + Math.sin(time * 37 + i) * 0.08 + Math.sin(time * 23 + i * 2) * 0.06;
        f.flame.scale.set(0.6 + 0.4 * f.heat, 1.8 * f.heat * flick, 0.6 + 0.4 * f.heat);
      }
      for (const d of drums) {
        const b = d.ball;
        d.mesh.visible = d.gone <= 0;
        d.mesh.position.set(b.x, b.y, b.z);
        if (b.grounded) rollSpin(b, d.spin);
        turn(d.q, d.spin, dt);
        d.mesh.quaternion.set(d.q[0], d.q[1], d.q[2], d.q[3]);
      }
    },
  };
}

let mats = null;
function finishMaterial(GFX, finish) {
  mats ??= {
    matte: new GFX.MeshStandardMaterial({ name: 'drum-matte', vertexColors: true, roughness: 0.6 }),
    shiny: new GFX.MeshPhysicalMaterial({ name: 'drum-paint', vertexColors: true, roughness: 0.35, metalness: 0.4, clearcoat: 0.6 }),
    glow: new GFX.MeshBasicMaterial({ name: 'drum-glow', vertexColors: true }),
    glass: new GFX.MeshBasicMaterial({ name: 'drum-glass', vertexColors: true }),
  };
  return mats[finish];
}
