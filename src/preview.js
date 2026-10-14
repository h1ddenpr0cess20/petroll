import { createPlayer, RADIUS } from './hamster.js';
import { createKit } from './kit.js';
import { createStage } from './stage.js';

/**
 * A turntable for the hamster and its ball, on a patch of road. `?speed=4`
 * sets it running; `?yaw=1.2` turns the view; `?zoom=0.3` draws in;
 * `?still=1` stops the turntable.
 */

const q = new URLSearchParams(location.search);
const speed = Number(q.get('speed') ?? 3);
const stage = await createStage(document.getElementById('view'));
const { GFX, scene, view } = stage;

const kit = createKit(GFX);
kit.slab(-3, -0.2, -3, 3, 0, 3, '#44464c');
for (let z = -2.8; z < 3; z += 1) kit.slab(-0.06, 0, z, 0.06, 0.004, z + 0.5, '#f2c230');
kit.slab(-3, 0, 1.6, 3, 0.15, 3, '#bdb8ab');
const floor = kit.build({ name: 'floor' });
scene.add(floor);

const { player, spin, run } = createPlayer(GFX, q.has('tint') ? { tint: '#' + q.get('tint') } : {});
player.position.set(0, RADIUS, 0);
scene.add(player);

view.yaw = view.aim.yaw = Number(q.get('yaw') ?? 0.6);
view.zoom = view.aim.zoom = Number(q.get('zoom') ?? 0.24);
view.pitch = view.aim.pitch = Number(q.get('pitch') ?? 0.42);
stage.target.set(0, RADIUS * 0.9, 0);

const turn = new GFX.Quaternion();
const axis = new GFX.Vector3(1, 0, 0);
let last = performance.now();
stage.renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!q.has('still')) view.yaw = view.aim.yaw += dt * 0.3;
  // Rolling toward +z: the shell turns about +x, the hamster runs facing +z.
  turn.setFromAxisAngle(axis, (speed / RADIUS) * dt);
  spin.quaternion.premultiply(turn);
  run(dt, speed, 0);
  stage.look();
  stage.render();
});
globalThis.preview = { stage, player };
