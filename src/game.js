import { createEffects } from './effects.js';
import { createPlayer } from './hamster.js';
import { COUNTDOWN, nextJob, objective, quitJob, startJob } from './jobs.js';
import { createJobView } from './jobview.js';
import { createPickups } from './pickups.js';
import { rollSpin, turn } from './physics.js';
import { createRun, putBack, respawn, STEP, stepRun, toGround } from './run.js';
import { createWorldMeshes } from './scenery.js';
import { choose, ITEMS, perksOf, tintOf } from './shop.js';
import { HOME } from './view.js';
import { hiddenShare } from './xray.js';

/**
 * The game: one town, all of it open from the start, golden seeds hidden
 * all over it and sunflower seeds lying about in lines, and the townsfolk
 * with jobs going — roll up to anybody with a "!" over their head, take
 * the job on, beat the clock. The jobs pay; so does knocking things over;
 * the bubble shop takes it. Pop the bubble and the hamster is back at the
 * last air pump it rolled over; go into the tar and it's back on the last
 * firm ground. What it has done, earned and bought is kept between visits.
 */

const BANNERS = {
  popped: 'POP!',
  squashed: 'SQUASHED!',
  sunk: 'GLOOP!',
};

/** How close the camera comes for the title, and how fast it circles. */
const TITLE_ZOOM = 0.34;
const TITLE_TURN = 0.16;

/** How close to a shop's pad counts as on it. */
const SHOP_REACH = 0.9;

export function createGame({ stage, hud, input, audio, storage }) {
  const { GFX, scene, view } = stage;
  const effects = createEffects(GFX, scene);

  let saved = storage.load();
  let tint = tintOf(saved.tint);
  let { player, spin, run: runAnimation } = createPlayer(GFX, { tint });
  scene.add(player);
  const xray = createXray(GFX);
  scene.add(xray.sprite);

  const fresh = () => createRun(GFX, { found: saved.found, done: saved.done, cash: saved.cash, perks: perksOf(saved.owned), ...(run ? { ball: run.ball, map: run.map } : {}) });
  let run = null;
  run = fresh();
  const world = createWorldMeshes(GFX, run.map, run.built);
  scene.add(world, run.traffic.group, run.hazards.group);
  let jobs = createJobView(GFX, run);
  let pickups = createPickups(GFX, run);
  scene.add(jobs.group, pickups.group);
  effects.setCourse(run.map);
  hud.setMap(run.map);

  const q = [0, 0, 0, 1];
  const w = [0, 0, 0];
  let state = 'title';  // title · play · lost · failed · shop
  let paused = false;
  let timer = 0;
  let accumulator = 0;
  let lostHow = null;
  let elapsed = saved.time;
  let seedsEaten = 0;
  let streak = 0, streakTimer = 0, seedStreak = 0, seedTimer = 0;
  let saveTimer = 0;
  let heading = 0;
  let playZoom = HOME.zoom;
  let failure = null, failAfterLoss = null;
  let shop = null, shopAt = null;
  let lastCount = -1, lastTick = -1;
  const seen = new Set();

  const total = () => run.board.jobs.length;
  const found = () => run.golden.filter((g) => g.got).length;
  const done = () => run.board.done.size;

  // The town's lamps, where their light comes from; the nearest few light the hamster for real.
  const lamps = run.map.lamps.map((l) => ({ ...l, y: (l.y ?? run.map.heightAt(l.x, l.z) ?? 0) + l.height, color: new GFX.Color(l.colour) }));
  let lampTimer = 0;
  /** The real lights to the lamps nearest (x, z). */
  function lightUp(x, z) {
    const near = lamps.map((l) => ({ l, d: Math.hypot(l.x - x, l.z - z) - l.reach * 0.3 })).sort((a, b) => a.d - b.d);
    stage.lampLights.forEach((light, i) => {
      const n = near[i];
      if (!n || n.d > 14) { light.intensity = 0; return; }
      light.position.set(n.l.x, n.l.y - 0.15, n.l.z);
      light.color.copy(n.l.color);
      light.distance = n.l.reach * 1.25;
      light.intensity = 1.6 * n.l.glow;
    });
  }

  function enter(next) {
    state = next;
    timer = 0;
  }

  /** New plastic for the ball. */
  function wear(id) {
    tint = tintOf(id);
    const was = player;
    ({ player, spin, run: runAnimation } = createPlayer(GFX, { tint }));
    player.position.copy(was.position);
    scene.remove(was);
    scene.add(player);
  }

  function reset({ clear = false } = {}) {
    // A new run of the world: everything back where it was, what's been done kept unless starting over.
    if (clear) {
      saved = storage.clear();
      if (tintOf(saved.tint) !== tint) wear(saved.tint);
    }
    scene.remove(run.traffic.group, run.hazards.group, jobs.group, pickups.group);
    run = fresh();
    scene.add(run.traffic.group, run.hazards.group);
    jobs = createJobView(GFX, run);
    pickups = createPickups(GFX, run);
    scene.add(jobs.group, pickups.group);
    seedsEaten = 0;
    const pump = run.pumps.find((p) => p.name === saved.pump);
    if (pump) { run.checkpoint = pump; respawn(run); }
    elapsed = saved.time;
    seen.clear();
    failure = failAfterLoss = null;
    const b = run.ball;
    stage.target.set(b.x, b.y, b.z);
  }

  function showTitle() {
    enter('title');
    paused = false;
    hud.paused(false);
    view.aim.zoom = TITLE_ZOOM;
    audio.stopMusic();
    hud.title(saved, { done: done(), total: total(), found: found(), golden: run.golden.length });
  }

  function start({ clear = false } = {}) {
    reset({ clear });
    enter('play');
    view.aim.zoom = playZoom;
    hud.play();
    hud.bubble(run.bubble);
    hud.cash(run.cash);
    hud.jobs(done(), total());
    hud.gold(found(), run.golden.length);
    hud.seeds(seedsEaten);
    hud.job(null);
    hud.offer(null);
    hud.failed(null);
    hud.shop(null);
    audio.wake();
    audio.startMusic();
  }

  function save() {
    saved = storage.progress({ found: run.golden.filter((g) => g.got).map((g) => g.name), done: [...run.board.done], cash: run.cash, pump: run.checkpoint?.name ?? null, time: elapsed });
  }

  /** Take `job` on: off to where it starts, the bubble topped up, the count in. */
  function take(job) {
    const giver = run.board.givers.find((g) => g.id === job.giver);
    const [x, z] = job.start ?? (failure ? [giver.x + 1.2, giver.z] : [run.ball.x, run.ball.z]);
    if (job.start || failure) teleport(x, z);
    run.bubble = 100;
    hud.bubble(run.bubble);
    failure = null;
    hud.failed(null);
    hud.offer(null);
    startJob(run, job);
    lastCount = -1;
    hud.toast(`${job.title} · ${job.stages[0].text}`, 3.5);
    audio.chime();
    enter('play');
  }

  function failed(f) {
    failure = f;
    audio.fail();
    hud.job(null);
    hud.banner(null);
    if (f.why === 'quit') { failure = null; hud.toast(`Gave up: ${f.job.title}`); return; }
    hud.failed(f);
    enter('failed');
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

  /** The shop the ball is on the pad of, if any. */
  function shopHere() {
    const b = run.ball;
    return run.map.shops.find((s) => Math.hypot(s.x - b.x, s.z - b.z) < SHOP_REACH) ?? null;
  }

  function shopView() {
    return {
      name: shop.name, cash: run.cash, at: shop.at,
      items: ITEMS.map((i) => ({ ...i, owned: i.price === 0 || saved.owned.includes(i.id), worn: saved.tint === i.id })),
    };
  }

  function openShop(s) {
    shop = { name: s.name, at: Math.max(0, ITEMS.findIndex((i) => i.id === saved.tint)) };
    const b = run.ball;
    b.vx = b.vy = b.vz = 0;
    hud.offer(null);
    hud.shop(shopView());
    audio.till();
    enter('shop');
  }

  function closeShop() {
    shop = null;
    hud.shop(null);
    shopAt = null;
    enter('play');
  }

  function buy(i) {
    if (!shop) return;
    shop.at = i;
    const wallet = { cash: run.cash, owned: [...saved.owned], tint: saved.tint };
    const r = choose(wallet, ITEMS[i].id);
    if (r.ok) {
      run.cash = wallet.cash;
      saved = storage.progress({ cash: run.cash, owned: wallet.owned, tint: wallet.tint });
      run.perks = new Set(perksOf(saved.owned));
      if (r.item.kind === 'tint') wear(wallet.tint);
      hud.cash(run.cash, r.bought);
      if (r.bought) { audio.till(); hud.toast(`Bought: ${r.item.name}`); } else audio.chime();
    } else {
      audio.nope();
      if (r.why === 'cash') hud.toast(`Not enough cash for ${r.item.name}`);
    }
    hud.shop(shopView());
  }

  function teleport(x, z) {
    const y = (run.map.topAt(x, z) ?? 0) + run.ball.r + 0.05;
    const b = run.ball;
    b.x = x; b.y = y; b.z = z;
    b.vx = b.vy = b.vz = 0;
    b.grounded = false;
    b.on = null;
    stage.target.set(x, y, z);
  }

  function physics(push) {
    const live = state === 'play';
    const moving = state === 'play' || (state === 'lost' && lostHow === 'sunk');
    const out = stepRun(run, push, STEP, { live, moving });
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
    if (out.hopped) audio.hop();
    if (out.bounced) audio.boing();
    if (out.dashed) audio.dash();
    if (out.knocked.length) {
      jobs.knocked(out.knocked);
      audio.thwack();
    }
    for (const sd of out.picked) {
      seedsEaten++;
      pickups.eaten(sd);
      effects.chaff(sd.x, sd.y, sd.z);
      audio.seed(seedStreak++);
      seedTimer = 0.6;
      hud.seeds(seedsEaten);
    }
    if (out.golden) {
      const n = found();
      effects.confetti(out.golden.x, out.golden.y, out.golden.z);
      audio.golden();
      hud.gold(n, run.golden.length);
      if (n === run.golden.length) {
        saved = storage.finished(elapsed);
        hud.banner(`EVERY GOLDEN SEED!\n${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`, 'gold');
      } else {
        hud.banner('GOLDEN SEED!', 'gold');
        hud.toast(`★ ${out.golden.name} · ${n} of ${run.golden.length}`, 3.5);
      }
      timer = -1;
      save();
    }
    if (out.cash) {
      hud.cash(run.cash, true);
      audio.coin(streak++);
      streakTimer = 0.8;
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
    const j = out.job;
    if (j) {
      if (j.offer !== undefined) hud.offer(j.offer);
      if (j.go) { hud.banner('GO!', 'big'); audio.beep(true); timer = 0; }
      if (j.stage != null) {
        const s = run.board.active.job.stages[j.stage];
        hud.toast(s.text, 3);
        audio.tick(4);
      }
      if (j.tick) {
        audio.tick(j.tick.n);
        if (j.tick.kind === 'hit') {
          effects.sparks(...j.tick.at);
          audio.clunk(8);
          hud.toast(`Hit! ${j.tick.n} of ${j.tick.of}`, 1.2);
        }
        if (j.tick.kind === 'knock') audio.thwack();
      }
      if (j.passed) {
        const n = done();
        effects.confetti(b.x, b.y + 0.5, b.z);
        audio.fanfare();
        hud.job(null);
        hud.cash(run.cash, true);
        hud.jobs(n, total());
        if (n === total()) hud.banner(`EVERY JOB DONE!\nTHE KEY TO THE CITY`, 'gold');
        else hud.banner(`JOB DONE!\n+$${j.passed.reward}`, 'gold');
        hud.toast(`${j.passed.job.title} · ${n} of ${total()} jobs done`, 3.5);
        save();
        timer = -1.5;
      }
      if (j.failed) {
        if (out.outcome) failAfterLoss = j.failed;
        else failed(j.failed);
      }
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
      if (state === 'title') {
        if (p === 'start' || p === 'hop') start();
        continue;
      }
      if (state === 'failed') {
        if (p === 'start' || p === 'hop') take(failure.job);
        else if (p === 'back' || p === 'quit') { failure = null; hud.failed(null); enter('play'); }
        continue;
      }
      if (state === 'shop') {
        if (p === 'up') { shop.at = (shop.at + ITEMS.length - 1) % ITEMS.length; hud.shop(shopView()); }
        if (p === 'down') { shop.at = (shop.at + 1) % ITEMS.length; hud.shop(shopView()); }
        if (p === 'start' || p === 'hop') buy(shop.at);
        if (p === 'back' || p === 'pause') closeShop();
        continue;
      }
      if (p === 'pause') {
        paused = !paused;
        hud.paused(paused, { job: Boolean(run.board.active) });
        if (paused) audio.stopMusic(); else audio.startMusic();
        if (paused) save();
        continue;
      }
      if (paused) {
        if (p === 'quit' && run.board.active) {
          failed(quitJob(run));
          paused = false;
          hud.paused(false);
          audio.startMusic();
        }
        continue;
      }
      if (state !== 'play') continue;
      if (p === 'start' || p === 'hop') {
        const offer = run.board.offer;
        const here = shopHere();
        if (offer?.job && !run.board.active) take(offer.job);
        else if (here && !run.board.active) openShop(here);
        else run.act.hop = true;
      }
      if (p === 'dash') run.act.dash = true;
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
    const a = run.board.active;
    switch (state) {
      case 'play': {
        elapsed += dt;
        if (timer > 1.2 && hud.bannerShown && !(a?.phase === 'ready')) hud.banner(null);
        saveTimer += dt;
        if (saveTimer > 10) { saveTimer = 0; save(); }
        // The bubble shop: a word when the ball rolls onto its pad.
        const here = !a ? shopHere() : null;
        if (here !== shopAt) {
          shopAt = here;
          if (here) hud.offer({ giver: { name: here.name }, job: null, thanks: 'Bubble Shop', line: 'New plastic, a thicker shell, a better wheel. Press Enter (or A, or HOP) to have a look.' });
          else if (!run.board.offer) hud.offer(null);
        }
        break;
      }
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
          if (failAfterLoss) { const f = failAfterLoss; failAfterLoss = null; failed(f); }
        }
        break;
    }
    streakTimer -= dt;
    if (streakTimer <= 0) streak = 0;
    seedTimer -= dt;
    if (seedTimer <= 0) seedStreak = 0;

    // The job under way, on the screen.
    if (a && state !== 'title') {
      const s = a.job.stages[a.stage];
      if (a.phase === 'ready') {
        const n = Math.ceil(a.countdown / (COUNTDOWN / 3));
        if (n !== lastCount && n > 0) { lastCount = n; hud.banner(String(n), 'big'); audio.beep(); }
      } else if (a.clock < 5.5 && Math.ceil(a.clock) !== lastTick) {
        lastTick = Math.ceil(a.clock);
        audio.clockTick();
      }
      const count = s.type === 'ram' ? `${a.hits}/${s.hits} hits` : s.type === 'tail' || s.type === 'go' ? '' : `${a.index}/${a.targets.length}`;
      hud.job({
        title: a.job.title,
        text: s.type === 'race' && a.rival ? `${s.text} · ${a.rival.name} ${Math.round((a.rival.s / a.rival.path.length) * 100)}%` : s.text,
        count: a.carry ? `${count} carrying` : count,
        clock: a.clock,
        meter: s.type === 'tail' ? a.meter : null,
      });
    } else hud.job(null);
    hud.dash(run.dash.breath);

    // The lantern over the hamster, and the lamps round it.
    stage.hamster.set(b.x, b.y, b.z);
    lampTimer -= dt;
    if (lampTimer <= 0) { lampTimer = 0.2; lightUp(b.x, b.z); }

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
    runAnimation(dt, state === 'title' ? 0 : speed * (run.dash.time > 0 ? 1.6 : 1), heading);

    world.userData.uncover(b, dt);
    xray.update(dt, b, stage.camera.position, run, player.visible && state !== 'title');
    run.traffic.sync(stage.target);
    run.hazards.sync(dt, run.time);
    jobs.sync(dt, run.time);
    pickups.sync(dt, run.time);
    effects.update(dt);
    audio.rolling(state === 'play' && b.grounded ? speed : 0, b.grounded);
    if (state !== 'title') {
      const goal = objective(run.board, b);
      hud.minimap({
        ball: b, yaw: view.yaw, cars: run.traffic.cars, pumps: run.pumps, shops: a ? [] : run.map.shops,
        givers: a ? [] : run.board.givers.filter((g) => nextJob(run.board, g)),
        goal, goals: a && (a.job.stages[a.stage].type === 'knock' || a.job.stages[a.stage].type === 'grab') ? a.targets.filter((t) => !t.got) : [],
        mover: a?.mover ?? null, rival: a?.rival ?? null, golden: run.golden, seen,
      });
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

  /** For the console and screenshots: the run, a camera override (`look`), a way to jump about, and to take a job. */
  const debug = {
    stage, look: null,
    get run() { return run; },
    get ball() { return run.ball; },
    teleport,
    job(id) {
      const j = run.board.jobs.find((x) => x.id === id);
      if (j) take(j);
      return j ?? null;
    },
    cash(n) { run.cash += n; hud.cash(run.cash, true); save(); },
  };

  reset();
  showTitle();

  return {
    update,
    start,
    startOver: () => start({ clear: true }),
    take: () => { if (state === 'play' && run.board.offer?.job) take(run.board.offer.job); },
    retry: () => { if (state === 'failed') take(failure.job); },
    leave: () => { if (state === 'failed') { failure = null; hud.failed(null); enter('play'); } },
    choose: (i) => buy(i),
    closeShop: () => { if (state === 'shop') closeShop(); },
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

/**
 * The ball, seen through what's in front of it: when a house or a tank is
 * between the camera and the ball, a ring where the ball is, drawn over
 * everything, so the hamster is never lost behind the scenery. Whether
 * it's hidden is worked out with rays (`xray.js`); it has to stay hidden
 * (or seen) a moment before the ring comes (or goes), so it doesn't
 * flicker at the edge of a wall.
 */
function createXray(GFX) {
  let map = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(140, 200, 255, 0.18)';
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(200, 235, 255, 0.95)';
    g.lineWidth = 7;
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255, 210, 150, 0.8)';
    g.beginPath(); g.ellipse(64, 74, 20, 15, 0, 0, Math.PI * 2); g.fill();
    map = new GFX.CanvasTexture(c);
    map.colorSpace = GFX.SRGBColorSpace;
  }
  const material = new GFX.SpriteMaterial({ map, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const sprite = new GFX.Sprite(material);
  sprite.renderOrder = 1000;
  sprite.visible = false;
  let shown = 0, on = false, lean = 0, every = 0;
  return {
    sprite,
    update(dt, b, eye, run, visible) {
      every -= dt;
      if (every <= 0) {
        every = 1 / 30;
        const share = visible ? hiddenShare(run.world, b, eye, { cars: run.traffic.cars.map((c) => c.box) }) : 0;
        // Leaning toward hidden or seen; it has to lean that way a while before it changes.
        if (!on) lean = share >= 0.75 ? lean + 1 / 30 : 0;
        else lean = share <= 0.25 ? lean + 1 / 30 : 0;
        if (lean > (on ? 0.2 : 0.1)) { on = !on; lean = 0; }
      }
      shown += ((on && visible ? 1 : 0) - shown) * Math.min(1, dt * 10);
      material.opacity = shown;
      sprite.visible = shown > 0.02;
      sprite.position.set(b.x, b.y, b.z);
      sprite.scale.setScalar(b.r * 2.1);
    },
  };
}
