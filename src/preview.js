import { createPlayer, RADIUS } from 'madness-engine/heroes/hamster';
import { createKit } from 'madness-engine/kit';
import { MODELS } from './models/index.js';
import { bake, materialsOf } from 'madness-engine/models/legacy-bake';
import { createStage } from './stage.js';

/**
 * A turntable: the hamster in its ball by default, or any sculpted model
 * (`?model=sedan`; `?models=sedan,pickup` puts several in a row). `?paint=`
 * colours a vehicle; `?yaw`, `?zoom`, `?pitch` place the view; `?still`
 * stops it turning; `?day` lights it plainly.
 */

const q = new URLSearchParams(location.search);
const stage = await createStage(document.getElementById('view'));
const { GFX, scene, view } = stage;

const kit = createKit(GFX);
kit.slab(-8, -0.2, -6, 8, 0, 6, '#3a3c42');
for (let z = -5.8; z < 6; z += 1) kit.slab(-0.06, 0, z, 0.06, 0.004, z + 0.5, '#d8b030');
const floor = kit.build({ name: 'floor' });
scene.add(floor);

let focus = [0, RADIUS * 0.9, 0];
const names = (q.get('models') ?? q.get('model') ?? '').split(',').filter(Boolean);
if (names.length) {
  let x = -(names.length - 1) * Number(q.get('gap') ?? 3.2) / 2;
  for (const n of names) {
    const def = MODELS[n];
    if (!def) throw new Error(`no model ${n}`);
    const { geometry } = bake(GFX, def);
    const mats = materialsOf(GFX, def, q.has('paint') ? { paint: { color: `#${q.get('paint')}` } } : {});
    const mesh = new GFX.Mesh(geometry, mats);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.x = x;
    scene.add(mesh);
    x += Number(q.get('gap') ?? 3.2);
  }
  focus = [0, 0.6, 0];
} else {
  const { player, spin, run } = createPlayer(GFX, q.has('tint') ? { tint: `#${q.get('tint')}` } : {});
  player.position.set(0, RADIUS, 0);
  scene.add(player);
  const turn = new GFX.Quaternion();
  const axis = new GFX.Vector3(1, 0, 0);
  const speed = Number(q.get('speed') ?? 3);
  if (q.has('pose')) {
    // Frozen at a point in the stride, for a still.
    run(Number(q.get('pose')), 3, 0);
    spin.visible = !q.has('bare');
  } else globalThis.tick = (dt) => {
    turn.setFromAxisAngle(axis, (speed / RADIUS) * dt);
    spin.quaternion.premultiply(turn);
    run(dt, speed, 0);
  };
}

view.yaw = view.aim.yaw = Number(q.get('yaw') ?? 0.6);
view.zoom = view.aim.zoom = Number(q.get('zoom') ?? (names.length ? 0.45 : 0.24));
view.pitch = view.aim.pitch = Number(q.get('pitch') ?? 0.42);
stage.target.set(...focus);
stage.hamster.set(...focus);
if (q.has('day')) { stage.hemi.intensity = 1.4; stage.key.intensity = 2.2; }

let last = performance.now();
stage.renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!q.has('still')) view.yaw = view.aim.yaw += dt * 0.3;
  globalThis.tick?.(dt);
  stage.look();
  stage.render();
});
