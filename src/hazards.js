import { createKit } from 'madness-engine/kit';
import { model } from './models/library.js';
import { collideBalls, createBall, placeBall, PUSH, rollSpin, stepBall, turn } from 'madness-engine/physics';

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

  // Pumpjacks: the frame standing on its pad, the walking beam nodding on its bearing; the box is where the carrier bar comes down.
  const yellow = '#f2c230';
  const frameModel = model(GFX, 'pumpframe'), beamModel = model(GFX, 'pumpbeam');
  const pumpjacks = map.pumpjacks.map((p) => {
    const base = map.heightAt(p.x + 0.5, p.z + 0.5) ?? 0;
    const pivot = [p.x - 1.8, base + 2.3, p.z + 0.5];
    const frame = new GFX.Mesh(frameModel.geometry, frameModel.materials);
    frame.position.set(p.x, base, p.z);
    frame.castShadow = frame.receiveShadow = true;
    const beam = new GFX.Mesh(beamModel.geometry, beamModel.materials);
    beam.position.set(...pivot);
    beam.castShadow = true;
    group.add(frame, beam);
    const box = {
      solid: true, kind: 'pumpjack', vx: 0, vy: 0, vz: 0,
      min: [p.x + 0.5 - HEAD.w / 2, base, p.z + 0.5 - HEAD.d / 2], max: [p.x + 0.5 + HEAD.w / 2, base + HEAD.h, p.z + 0.5 + HEAD.d / 2],
    };
    return { ...p, base, pivot, beam, box };
  });

  // Flares: a vent in the floor, and the flame that comes up out of it — soft tongues of flame, camera-facing, round a white-hot heart, and a glow on the ground.
  const ventModel = model(GFX, 'vent');
  const flameMap = flameTexture(GFX);
  const tongue = (color, opacity) => new GFX.SpriteMaterial({ map: flameMap, color: new GFX.Color(color), transparent: true, opacity, depthWrite: false, blending: GFX.AdditiveBlending });
  const tongueMaterials = [tongue('#ff7a1a', 0.75), tongue('#ff9a30', 0.7), tongue('#ffb040', 0.65)];
  const heartMaterial = tongue('#fff2c0', 0.95);
  const flares = map.flares.map((f) => {
    const y = map.heightAt(f.x + 0.5, f.z + 0.5) ?? 0;
    const vent = new GFX.Mesh(ventModel.geometry, ventModel.materials);
    vent.position.set(f.x + 0.5, y, f.z + 0.5);
    vent.receiveShadow = true;
    group.add(vent);
    const flame = new GFX.Group();
    const sprite = (material, x, z) => {
      const s = new GFX.Sprite(material);
      s.center.set(0.5, 0.04);
      s.position.set(x, 0, z);
      flame.add(s);
      return s;
    };
    const licks = tongueMaterials.map((m, i) => sprite(m, Math.cos(i * 2.1) * 0.1, Math.sin(i * 2.1) * 0.1));
    const core = sprite(heartMaterial, 0, 0);
    flame.position.set(f.x + 0.5, y + 0.05, f.z + 0.5);
    flame.visible = false;
    group.add(flame);
    return { ...f, y, flame, licks, core, heat: 0 };
  });

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

  // Oil drums: the sculpted drum, on its side, its middle on the ball's, to roll.
  const drumModel = model(GFX, 'drum');
  const drums = map.drums.map((d) => {
    const y = (map.heightAt(d.x, d.z) ?? 0) + DRUM_RADIUS;
    const mesh = new GFX.Group();
    const inner = new GFX.Mesh(drumModel.geometry, drumModel.materials);
    inner.castShadow = true;
    inner.rotation.z = -Math.PI / 2;
    inner.position.set(-0.44, 0, 0);
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
        // The beam turned so the carrier bar at the foot of the bridle (2.33 along, 1.12 down from the bearing) is where the box's top is.
        const want = p.box.max[1] - p.pivot[1];
        let a = 0;
        for (let i = 0; i < 4; i++) a = Math.asin(Math.max(-1, Math.min(1, (want + 1.12 * Math.cos(a)) / 2.33)));
        p.beam.rotation.z = a;
      }
      for (const l of lifts) l.mesh.position.set((l.box.min[0] + l.box.max[0]) / 2, (l.box.min[1] + l.box.max[1]) / 2, (l.box.min[2] + l.box.max[2]) / 2);
      for (const [i, f] of flares.entries()) {
        f.flame.visible = f.heat > 0.02;
        if (!f.flame.visible) continue;
        f.licks.forEach((lick, k) => {
          const flick = 1 + Math.sin(time * (23 + k * 7) + i * 1.3 + k) * 0.1 + Math.sin(time * 13 + k * 3 + i) * 0.08;
          lick.scale.set((0.75 + 0.25 * f.heat) * (1 + Math.sin(time * 17 + k) * 0.08), 2.3 * f.heat * flick, 1);
        });
        f.core.scale.set(0.4, 1.1 * f.heat * (1 + Math.sin(time * 29 + i) * 0.06), 1);
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

/** A tongue of flame, soft at its edges and its tip, white where it is hottest, for the flares. */
function flameTexture(GFX) {
  if (typeof document === 'undefined') return null;
  const w = 64, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = 1 - y / (h - 1); // 0 at the foot, 1 at the tip
    const half = 0.5 * Math.sin(Math.PI * Math.min(1, 0.18 + v * 0.95)) * (1 - v * 0.55);
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) / Math.max(half, 1e-3);
      const edge = Math.max(0, 1 - u * u);
      const a = edge ** 1.4 * Math.min(1, v * 9) * (1 - v) ** 0.7;
      const hot = edge ** 3 * (1 - v) ** 1.5;
      const i = (y * w + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255 * (0.55 + 0.45 * hot);
      img.data[i + 2] = 255 * (0.25 + 0.75 * hot * hot);
      img.data[i + 3] = 255 * Math.min(1, a * 1.3);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new GFX.CanvasTexture(c);
  t.colorSpace = GFX.SRGBColorSpace;
  return t;
}
