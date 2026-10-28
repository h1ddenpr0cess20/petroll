import { createKit } from 'madness-engine/kit';
import { CAST as CAST_DEFS, DETAIL } from './cast/index.js';
import { ready } from './cast/library.js';
import { createModel } from 'madness-engine/models/model';
import { createHamster, createPlayer } from 'madness-engine/heroes/hamster';
import { hasWork, objective } from './jobs.js';
import { model } from './models/library.js';
import { rollSpin, turn } from 'madness-engine/physics';
import { materialsOf } from 'madness-engine/models/legacy-bake';
import { mountWheels } from 'madness-engine/scenery/vehicles';

/**
 * The jobs and what there is to knock about, as they look:
 *
 * - the townsfolk (sculpted and rigged: `cast/`), each with a "!" over
 *   their head and a shaft of light going up while they have work going,
 *   turning to watch the hamster go by; and the animals about town, the
 *   cats watching it closer than anybody;
 * - the bubble shops' pads, with a "$" over them, and the air pumps' pads;
 * - the odds and ends standing about to knock flying (cones, bins,
 *   flamingos, crates, yard signs), which fly when they're hit and come
 *   back later;
 * - for the job under way: a beacon where to go next, the things to knock
 *   or round up, the car to ram or follow, the rival's ball, whatever the
 *   hamster is carrying, and an arrow over the ball pointing the way.
 */

/** The model for each kind of thing to knock or round up. */
const MODEL = { cone: 'cone', bin: 'bin', flamingo: 'flamingo', crate: 'crate', sign: 'yardsign', flag: 'flag' };

/** A canvas with one big glyph on it, as a texture for a sprite; null in the tests. */
function glyph(GFX, text, { fg = '#ffd23a', stroke = '#3a2400', size = 128 } = {}) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.font = `400 ${size * 0.82}px Anton, Impact, "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.1;
  g.strokeStyle = stroke;
  g.strokeText(text, size / 2, size / 2 + size * 0.04);
  g.fillStyle = fg;
  g.fillText(text, size / 2, size / 2 + size * 0.04);
  const t = new GFX.CanvasTexture(c);
  t.colorSpace = GFX.SRGBColorSpace;
  return t;
}

export function createJobView(GFX, run) {
  const group = new GFX.Group();
  group.name = 'jobs';

  const beamGeometry = new GFX.CylinderGeometry(0.16, 0.42, 16, 16, 1, true);
  beamGeometry.translate(0, 8, 0);
  const beam = (colour, opacity = 0.18) => new GFX.Mesh(beamGeometry, new GFX.MeshBasicMaterial({ name: 'beam', color: new GFX.Color(colour), transparent: true, opacity, depthWrite: false, blending: GFX.AdditiveBlending, side: GFX.DoubleSide }));
  const sprite = (texture, scale) => {
    const s = new GFX.Sprite(new GFX.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    s.scale.setScalar(scale);
    return s;
  };
  const bang = glyph(GFX, '!');
  const dollar = glyph(GFX, '$', { fg: '#7aff9a', stroke: '#0a3a14' });
  const down = glyph(GFX, '▼', { fg: '#ff5a3a', stroke: '#3a0a00' });

  // A body from the cast, stood up at (x, y, z) as soon as it's baked (it bakes in the background): `size` scales it.
  const body = (name, x, y, z, { size = 1, angle = 0 } = {}) => {
    const o = { group: new GFX.Group(), model: null, angle, top: 1.2, clip: 'idle', since: 0 };
    o.group.position.set(x, y, z);
    o.group.rotation.y = angle;
    o.group.scale.setScalar(size);
    group.add(o.group);
    const stand = () => {
      o.model = createModel(GFX, CAST_DEFS[name], { detail: DETAIL });
      o.group.add(o.model.group);
      const g = o.model.mesh.geometry;
      g.computeBoundingBox?.();
      o.top = (g.boundingBox?.max.y ?? 0.8) * o.model.mesh.scale.y * size;
    };
    if (typeof window !== 'undefined') ready(name, DETAIL).then(stand);
    return o;
  };
  const turnTo = (o, want, dt, rate = 3) => {
    let d = want - o.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    o.group.rotation.y += d * Math.min(1, dt * rate);
    return Math.abs(d);
  };

  // The townsfolk.
  const givers = run.board.givers.map((g, i) => {
    const who = body(g.look, g.x, g.y, g.z, { size: 1.3, angle: g.angle ?? i * 1.3 });
    const mark = new GFX.Group();
    const bangSprite = sprite(bang, 0.9);
    const shaft = beam('#ffd760', 0.14);
    shaft.position.y = 0.4;
    mark.add(bangSprite, shaft);
    mark.position.set(g.x, g.y, g.z);
    group.add(mark);
    return { g, who, mark, bangSprite, phase: i * 0.9 };
  });

  // The animals about town.
  const critters = (run.map.critters ?? []).map((c, i) => {
    const y = c.y ?? run.map.heightAt(c.x, c.z) ?? 0;
    return { c, who: body(c.look, c.x, y, c.z, { size: c.size ?? 1, angle: c.angle ?? i * 2.1 }), phase: i * 1.7 };
  });

  // The shops' pads and the air pumps' pads.
  const padKit = createKit(GFX);
  for (const p of run.pumps) {
    padKit.cyl([p.x, p.y + 0.01, p.z], 0.62, 0.02, '#f2c230', { segments: 32 });
    padKit.cyl([p.x, p.y + 0.02, p.z], 0.5, 0.02, '#d8d2c4', { segments: 32 });
    padKit.cyl([p.x, p.y + 0.03, p.z], 0.2, 0.02, '#c8382c', { segments: 24 });
  }
  const shops = run.map.shops.map((s) => {
    const y = run.map.heightAt(s.x, s.z) ?? 0;
    padKit.cyl([s.x, y + 0.01, s.z], 0.72, 0.02, '#3a8a4a', { segments: 32 });
    padKit.cyl([s.x, y + 0.02, s.z], 0.58, 0.02, '#e8f4e0', { segments: 32 });
    padKit.cyl([s.x, y + 0.03, s.z], 0.3, 0.02, '#3a8a4a', { segments: 24 });
    const mark = sprite(dollar, 0.9);
    mark.position.set(s.x, y + 1.25, s.z);
    group.add(mark);
    return { s, y, mark };
  });
  if (!padKit.empty) group.add(padKit.build({ name: 'pads' }));

  // A thing standing about: its mesh, flying when knocked.
  const piece = (kind) => {
    if (kind === 'pup') {
      const { hamster } = createHamster(GFX, { radius: 0.045 });
      hamster.scale.setScalar(1.15);
      const g = new GFX.Group();
      g.add(hamster);
      return g;
    }
    const m = model(GFX, MODEL[kind]);
    const mesh = new GFX.Mesh(m.geometry, m.materials);
    mesh.castShadow = true;
    const g = new GFX.Group();
    g.add(mesh);
    if (kind === 'cone') g.scale.setScalar(0.9);
    if (kind === 'bin') g.scale.setScalar(0.62);
    return g;
  };
  const fly = (o, t) => {
    // Off the way the ball was going, up, spinning, then down and gone.
    o.fly = { t: 0, vx: (t.vx ?? 0) * 1.2 + (Math.random() - 0.5), vy: 4 + Math.random() * 2, vz: (t.vz ?? 0) * 1.2 + (Math.random() - 0.5), spin: [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14] };
  };
  const flyStep = (o, dt) => {
    const f = o.fly;
    f.t += dt;
    f.vy -= 18 * dt;
    o.mesh.position.x += f.vx * dt;
    o.mesh.position.y += f.vy * dt;
    o.mesh.position.z += f.vz * dt;
    o.mesh.rotation.x += f.spin[0] * dt;
    o.mesh.rotation.y += f.spin[1] * dt;
    o.mesh.rotation.z += f.spin[2] * dt;
    const k = Math.max(0, 1 - Math.max(0, f.t - 0.9) / 0.5);
    o.mesh.scale.setScalar(o.scale * k);
    if (k <= 0) { o.fly = null; o.mesh.visible = false; }
  };
  const stand = (o, x, y, z, angle = 0) => {
    o.mesh.position.set(x, y, z);
    o.mesh.rotation.set(0, angle, 0);
    o.mesh.scale.setScalar(o.scale);
    o.mesh.visible = true;
    o.fly = null;
  };

  const knocks = run.knocks.map((k) => {
    const mesh = piece(k.kind);
    const o = { k, mesh, scale: mesh.scale.x, fly: null, was: true };
    stand(o, k.x, k.y, k.z, k.angle ?? (k.x * 3 + k.z) % 6);
    group.add(mesh);
    return o;
  });

  // The job under way.
  const job = new GFX.Group();
  job.name = 'job';
  group.add(job);
  const beacon = new GFX.Group();
  const beaconBeam = beam('#7ad8ff', 0.22);
  const ring = new GFX.Mesh(new GFX.TorusGeometry(1, 0.06, 8, 40), new GFX.MeshBasicMaterial({ name: 'ring', color: new GFX.Color('#7ad8ff'), transparent: true, opacity: 0.85 }));
  ring.rotation.x = Math.PI / 2;
  beacon.add(beaconBeam, ring);
  const next = beam('#7ad8ff', 0.07);
  job.add(beacon, next);
  let targets = [];
  let lastJob = null, lastStage = -1;
  let mover = null, rival = null, carried = null, carriedKind = null;
  const rivalQ = [0, 0, 0, 1], rivalW = [0, 0, 0];

  // The arrow over the ball, pointing the way.
  const arrowKit = createKit(GFX);
  arrowKit.box([0, 0, 0.06], [0.14, 0.05, 0.36], '#ffd23a', { finish: 'glow' });
  arrowKit.cone([0, 0, 0.36], 0.22, 0.32, '#ffd23a', { rot: [Math.PI / 2, 0, 0], finish: 'glow', segments: 4 });
  const arrow = arrowKit.build({ castShadow: false, name: 'arrow' });
  arrow.visible = false;
  group.add(arrow);

  function setStage(a) {
    for (const t of targets) job.remove(t.mesh);
    targets = [];
    if (mover) { job.remove(mover.group); mover = null; }
    if (rival) { job.remove(rival.player); rival = null; }
    if (!a) return;
    const s = a.job.stages[a.stage];
    if (s.type === 'knock' || s.type === 'grab') {
      targets = a.targets.map((t, i) => {
        const mesh = piece(s.kind);
        const o = { t, mesh, scale: mesh.scale.x, fly: null };
        stand(o, t.x, t.y, t.z, i * 1.3);
        const marker = beam(s.type === 'grab' ? '#7aff9a' : '#ff9a5a', 0.16);
        marker.scale.set(0.6, 0.25, 0.6);
        mesh.add(marker);
        job.add(mesh);
        return o;
      });
    }
    if (a.mover) {
      // The body, and its wheels on it, to go round as it drives.
      const m = model(GFX, a.mover.model);
      const body = model(GFX, m.def.body.name);
      const mesh = new GFX.Mesh(body.geometry, materialsOf(GFX, body.def, { paint: { color: a.mover.paint } }));
      mesh.castShadow = true;
      const tyre = model(GFX, m.def.wheel);
      const wheels = mountWheels(GFX, m.def, { geometry: tyre.geometry, material: materialsOf(GFX, tyre.def) });
      mesh.add(wheels.group);
      const g = new GFX.Group();
      const flag = sprite(down, 0.8);
      flag.position.y = a.mover.size.height + 1.2;
      const shaft = beam('#ff5a3a', 0.16);
      shaft.position.y = a.mover.size.height;
      g.add(mesh, flag, shaft);
      job.add(g);
      mover = { group: g, mesh, flag, wheels, last: null };
    }
    if (a.rival) {
      const { player, spin, run: legs } = createPlayer(GFX, { tint: a.rival.tint });
      job.add(player);
      rival = { player, spin, legs, last: [a.rival.x, a.rival.z] };
    }
  }

  return {
    group,

    /** Knocked flying: those of `list` (from the rules). */
    knocked(list) {
      for (const k of list) {
        const o = knocks.find((q) => q.k === k);
        if (o) fly(o, k);
      }
    },

    /** Every frame: the townsfolk, the things standing about, the job under way, the arrow. */
    sync(dt, time) {
      const board = run.board, ball = run.ball;
      const a = board.active;
      for (const o of givers) {
        const working = !a && hasWork(board, o.g);
        o.mark.visible = !a && (working || board.offer?.giver === o.g);
        o.bangSprite.material.opacity = working ? 1 : 0.35;
        o.bangSprite.position.y = o.who.top + 0.55 + Math.sin(time * 3 + o.phase) * 0.08;
        // Watching the hamster while it's about; pleased to see it when it rolls up.
        const d = Math.hypot(ball.x - o.g.x, ball.z - o.g.z);
        if (d < 9) turnTo(o.who, Math.atan2(ball.x - o.g.x, ball.z - o.g.z), dt);
        const clip = board.offer?.giver === o.g ? 'win' : 'idle';
        if (clip !== o.who.clip) { o.who.clip = clip; o.who.since = 0; }
        o.who.since += dt;
        o.who.model?.pose({ clip: o.who.clip, t: o.who.since, time, seed: o.phase, speed: 1 });
      }
      for (const o of critters) {
        // Close enough to see, the cats sit up and stare; the rest go about their business.
        const d = Math.hypot(ball.x - o.c.x, ball.z - o.c.z);
        const cat = o.c.look.startsWith('cat-');
        const clip = cat ? (d < 3 ? 'alert' : d < 9 ? 'look' : o.c.clip ?? 'sit') : d < 4 && o.c.look !== 'pigeon' ? 'idle' : o.c.clip ?? 'idle';
        if (d < 9 && cat) turnTo(o.who, Math.atan2(ball.x - o.c.x, ball.z - o.c.z), dt, 2);
        if (clip !== o.who.clip) { o.who.clip = clip; o.who.since = 0; }
        o.who.since += dt;
        if (d < 40) o.who.model?.pose({ clip: o.who.clip, t: o.who.since, time, seed: o.phase, speed: 1 });
      }
      for (const s of shops) s.mark.position.y = s.y + 1.25 + Math.sin(time * 2.6 + s.s.x) * 0.08;
      for (const o of knocks) {
        if (o.fly) flyStep(o, dt);
        else if (o.k.down <= 0 && !o.mesh.visible) stand(o, o.k.x, o.k.y, o.k.z, (o.k.x * 3 + o.k.z) % 6);
      }

      // The job: laid out again when its stage changes.
      if (a !== lastJob || (a && a.stage !== lastStage)) {
        lastJob = a;
        lastStage = a?.stage ?? -1;
        setStage(a);
      }
      beacon.visible = next.visible = false;
      if (a) {
        const s = a.job.stages[a.stage];
        if (s.type === 'go' || s.type === 'gates' || s.type === 'race') {
          const t = a.targets[a.index];
          if (t) {
            beacon.visible = true;
            beacon.position.set(t.x, t.y, t.z);
            const r = s.r ?? (s.type === 'go' ? 1.1 : 1.5);
            ring.scale.setScalar(r * (1 + Math.sin(time * 5) * 0.04));
            ring.position.y = 0.08;
            const n = a.targets[a.index + 1];
            if (n && s.type !== 'go') {
              next.visible = true;
              next.position.set(n.x, n.y, n.z);
            }
          }
        }
        for (const o of targets) {
          if (o.t.got && !o.fly && o.mesh.visible) {
            if (s.type === 'grab') o.mesh.visible = false;
            else fly(o, o.t);
          }
          if (o.fly) flyStep(o, dt);
          else if (!o.t.got) {
            o.mesh.rotation.y += dt * (s.type === 'grab' ? 1.5 : 0);
            if (s.type === 'grab') o.mesh.position.y = o.t.y + Math.abs(Math.sin(time * 4 + o.t.x)) * 0.12;
          }
        }
        if (mover && a.mover) {
          const m = a.mover;
          mover.group.position.set(m.x, m.y, m.z);
          const yaw = Math.atan2(m.dx, m.dz);
          if (mover.last) {
            const [x, z, was] = mover.last;
            mover.wheels.drive(Math.hypot(m.x - x, m.z - z), Math.atan2(Math.sin(yaw - was), Math.cos(yaw - was)));
          }
          mover.last = [m.x, m.z, yaw];
          mover.mesh.rotation.y = yaw;
          mover.flag.position.y = m.size.height + 1.2 + Math.sin(time * 4) * 0.1;
        }
        if (rival && a.rival) {
          const r = a.rival;
          rival.player.position.set(r.x, r.y, r.z);
          const vx = (r.x - rival.last[0]) / Math.max(dt, 1e-3), vz = (r.z - rival.last[1]) / Math.max(dt, 1e-3);
          rival.last = [r.x, r.z];
          rollSpin({ vx, vy: 0, vz, nx: 0, ny: 1, nz: 0, r: ball.r }, rivalW);
          turn(rivalQ, rivalW, dt);
          rival.spin.quaternion.set(rivalQ[0], rivalQ[1], rivalQ[2], rivalQ[3]);
          rival.legs(dt, Math.hypot(vx, vz), Math.atan2(r.dx, r.dz));
        }
      }

      // What it carries, over its head.
      const kind = a?.carry?.kind ?? null;
      if (kind !== carriedKind) {
        if (carried) group.remove(carried);
        carried = null;
        carriedKind = kind;
        if (kind) {
          const m = model(GFX, kind);
          carried = new GFX.Mesh(m.geometry, m.materials);
          carried.scale.setScalar(1.6);
          group.add(carried);
        }
      }
      if (carried) {
        carried.position.set(ball.x, ball.y + ball.r + 0.12 + Math.sin(time * 3) * 0.04, ball.z);
        carried.rotation.y = time * 1.2;
      }

      // The arrow.
      const goal = objective(board, ball);
      const far = goal ? Math.hypot(goal.x - ball.x, goal.z - ball.z) : 0;
      arrow.visible = Boolean(goal) && a?.phase === 'go' && far > 2.5;
      if (arrow.visible) {
        arrow.position.set(ball.x, ball.y + ball.r + 0.55 + (carried ? 0.4 : 0), ball.z);
        arrow.rotation.y = Math.atan2(goal.x - ball.x, goal.z - ball.z);
      }
    },
  };
}
