import { createEffects } from './effects.js';
import { createPlayer, TINTS } from './hamster.js';
import { createPickups } from './pickups.js';
import { rollSpin, turn } from './physics.js';
import { createRun, putBack, respawn, STEP, stepRun, toGround } from './run.js';
import { createWorldMeshes } from './scenery.js';
import { HOME } from './view.js';

/**
 * The game: one town, all of it open from the start. Roll anywhere; find
 * the 22 golden seeds; eat the sunflower seeds on the way. Pop the bubble
 * and the hamster is back at the last air pump it rolled over; go into the
 * tar and it's back on the last firm ground. What it has found is kept
 * between visits.
 */

const BANNERS = {
  popped: 'POP!',
  squashed: 'SQUASHED!',
  sunk: 'GLOOP!',
};

/** How close the camera comes for the title, and how fast it circles. */
const TITLE_ZOOM = 0.34;
const TITLE_TURN = 0.16;

export function createGame({ stage, hud, input, audio, storage }) {
  const { GFX, scene, view } = stage;
  const effects = createEffects(GFX, scene);
  const tint = TINTS.blue;
  const { player, spin, run: runAnimation } = createPlayer(GFX, { tint });
  scene.add(player);

  let saved = storage.load();
  let run = createRun(GFX, { found: saved.found });
  const world = createWorldMeshes(GFX, run.map, run.built);
  scene.add(world, run.traffic.group, run.hazards.group);
  let pickups = createPickups(GFX, run);
  scene.add(pickups.group);
  effects.setCourse(run.map);
  hud.setMap(run.map);

  const q = [0, 0, 0, 1];
  const w = [0, 0, 0];
  let state = 'title';  // title · play · lost · won
  let paused = false;
  let timer = 0;
  let accumulator = 0;
  let lostHow = null;
  let elapsed = saved.time;
  let seedsEaten = 0;
  let streak = 0, streakTimer = 0;
  let saveTimer = 0;
  let heading = 0;
  let playZoom = HOME.zoom;
  const seen = new Set();

  const found = () => run.golden.filter((g) => g.got).length;

  function enter(next) {
    state = next;
    timer = 0;
  }

  function reset({ fresh = false } = {}) {
    // A new run of the world: everything back where it was, the golden seeds found kept unless starting over.
    if (fresh) saved = storage.clear();
    scene.remove(run.traffic.group, run.hazards.group, pickups.group);
    run = createRun(GFX, { found: saved.found, ball: run.ball, map: run.map });
    scene.add(run.traffic.group, run.hazards.group);
    pickups = createPickups(GFX, run);
    scene.add(pickups.group);
    const pump = run.pumps.find((p) => p.name === saved.pump);
    if (pump) { run.checkpoint = pump; respawn(run); }
    elapsed = saved.time;
    seedsEaten = 0;
    seen.clear();
    const b = run.ball;
    stage.target.set(b.x, b.y, b.z);
  }

  function showTitle() {
    enter('title');
    paused = false;
    hud.paused(false);
    view.aim.zoom = TITLE_ZOOM;
    audio.stopMusic();
    hud.title(saved, { found: found(), total: run.golden.length });
  }

  function start({ fresh = false } = {}) {
    reset({ fresh });
    enter('play');
    view.aim.zoom = playZoom;
    hud.play();
    hud.bubble(run.bubble);
    hud.gold(found(), run.golden.length);
    hud.seeds(seedsEaten);
    hud.clock(elapsed);
    audio.wake();
    audio.startMusic();
  }

  function save() {
    saved = storage.progress({ found: run.golden.filter((g) => g.got).map((g) => g.name), pump: run.checkpoint?.name ?? null, time: elapsed });
  }

  function lose(how) {
    const b = run.ball;
    lostHow = how;
    enter('lost');
    hud.banner(BANNERS[how], 'big');
    if (how === 'sunk') {
      effects.gloop(b.x, b.y, b.z);
      audio.gloop();
    } else {
      effects.pop(b.x, b.y, b.z, b.vx, b.vz, tint);
      spin.visible = false;
      audio.pop();
    }
  }

  function physics(push) {
    const live = state === 'play';
    const moving = state !== 'lost' || lostHow === 'sunk';
    const out = stepRun(run, push, STEP, { live, moving: moving && state !== 'title' });
    if (state !== 'play') return;
    const b = run.ball;
    for (const car of out.honks) audio.honk(car.kind);
    if (out.hurt > 0) {
      hud.bubble(run.bubble);
      hud.hit();
      audio.squeak();
      if (out.hits.includes('car') || out.hits.includes('drum')) {
        effects.sparks(b.x, b.y, b.z);
        audio.clunk(out.impact);
      }
      if (out.hits.includes('flare')) audio.sizzle();
    } else if (out.impact > 3) {
      audio.knock(out.impact);
    }
    for (const s of out.picked) {
      seedsEaten++;
      pickups.eaten(s);
      effects.chaff(s.x, s.y, s.z);
      audio.seed(streak++);
      streakTimer = 0.6;
      hud.seeds(seedsEaten);
    }
    if (out.golden) {
      const n = found();
      effects.confetti(out.golden.x, out.golden.y, out.golden.z);
      audio.golden();
      hud.gold(n, run.golden.length);
      if (n === run.golden.length) {
        hud.banner(`EVERY GOLDEN SEED!\n${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`, 'gold');
        saved = storage.finished(elapsed);
        enter('won');
      } else {
        hud.banner('GOLDEN SEED!', 'gold');
        hud.toast(`★ ${out.golden.name} · ${n} of ${run.golden.length}`, 3.5);
      }
      save();
    }
    if (out.pumped) {
      hud.bubble(run.bubble);
      hud.toast(`Air pump · ${out.pumped.name}`);
      audio.hiss();
      save();
    }
    if (out.district) {
      if (!seen.has(out.district.name)) {
        seen.add(out.district.name);
        hud.toast(out.district.name, 2.2);
        audio.chime();
      }
      hud.place(out.district.name);
    }
    if (out.outcome) lose(out.outcome);
  }

  function update(dt, presses) {
    const stick = input.stick();
    const look = input.view(dt);
    view.turn(look.turn, look.tilt);
    view.zoomBy(look.zoom);
    if (state === 'title') view.aim.yaw += TITLE_TURN * dt;
    else playZoom = view.aim.zoom;
    view.step(dt);

    for (const p of presses) {
      if (p === 'mute') hud.muted(audio.toggleMute());
      if (p === 'home') {
        view.reset();
        if (state === 'title') view.aim.zoom = TITLE_ZOOM;
      }
      if (p === 'pause' && state !== 'title') {
        paused = !paused;
        hud.paused(paused);
        if (paused) audio.stopMusic(); else audio.startMusic();
        if (paused) save();
      }
      if (p === 'start' && state === 'title') start();
      if ((p === 'start' || p === 'tap') && state === 'won' && timer > 2) {
        hud.banner(null);
        enter('play');
      }
    }
    if (paused) {
      audio.rolling(0, false);
      return;
    }

    timer += dt;
    const push = state === 'play' ? toGround(stick, view.yaw) : [0, 0];
    accumulator = Math.min(accumulator + dt, STEP * 12);
    while (accumulator >= STEP) {
      accumulator -= STEP;
      physics(state === 'play' ? push : [0, 0]);
    }

    const b = run.ball;
    switch (state) {
      case 'play':
      case 'won':
        elapsed += dt;
        hud.clock(elapsed);
        if (timer > 1 && hud.bannerShown && state === 'play') hud.banner(null);
        saveTimer += dt;
        if (saveTimer > 10) { saveTimer = 0; save(); }
        break;
      case 'lost':
        elapsed += dt;
        if (timer > 1.6) {
          if (lostHow === 'sunk') putBack(run);
          else respawn(run);
          spin.visible = true;
          player.scale.setScalar(1);
          hud.banner(null);
          hud.bubble(run.bubble);
          enter('play');
        }
        break;
    }
    streakTimer -= dt;
    if (streakTimer <= 0) streak = 0;

    // The ball and the hamster in it.
    player.position.set(b.x, b.y, b.z);
    player.visible = !(state === 'lost' && lostHow !== 'sunk');
    if (state === 'lost' && lostHow === 'sunk') player.position.y = b.y - Math.min(1, timer / 0.8) * 0.8;
    const speed = Math.hypot(b.vx, b.vz);
    if (speed > 0.3) heading = Math.atan2(b.vx, b.vz);
    if (b.grounded) rollSpin(b, w);
    else for (let i = 0; i < 3; i++) w[i] *= Math.max(0, 1 - 0.3 * dt);
    turn(q, w, dt);
    spin.quaternion.set(q[0], q[1], q[2], q[3]);
    runAnimation(dt, state === 'title' ? 0 : speed, heading);

    world.userData.uncover(b, dt);
    run.traffic.sync();
    run.hazards.sync(dt, run.time);
    pickups.sync(dt, run.time);
    effects.update(dt);
    audio.rolling(state === 'play' && b.grounded ? speed : 0, b.grounded);
    if (state !== 'title') {
      hud.minimap({ ball: b, yaw: view.yaw, cars: run.traffic.cars, golden: run.golden, pumps: run.pumps, seen });
    }

    // The camera: after the ball.
    const target = stage.target;
    if (debug.look) {
      target.set(...debug.look.at);
      view.zoom = view.aim.zoom = debug.look.zoom;
      return;
    }
    const k = 1 - Math.exp(-(state === 'title' ? 2 : 6) * dt);
    target.x += (b.x - target.x) * k;
    target.y += (b.y - target.y) * k;
    target.z += (b.z - target.z) * k;
  }

  /** For the console and screenshots: the run, a camera override (`look`), and a way to jump about. */
  const debug = {
    stage, look: null,
    get run() { return run; },
    get ball() { return run.ball; },
    teleport(x, z) {
      const y = (run.map.topAt(x, z) ?? 0) + run.ball.r + 0.05;
      run.ball.x = x; run.ball.y = y; run.ball.z = z;
      run.ball.vx = run.ball.vy = run.ball.vz = 0;
      stage.target.set(x, y, z);
    },
  };

  reset();
  showTitle();

  return {
    update,
    start,
    startOver: () => start({ fresh: true }),
    get state() { return state; },
    get paused() { return paused; },
    /** Where the ball is on the screen, in CSS pixels, for the pointer controls. */
    marbleOnScreen(rect) {
      const b = run.ball;
      const v = new GFX.Vector3(b.x, b.y, b.z).project(stage.camera);
      return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
    },
    debug,
  };
}
