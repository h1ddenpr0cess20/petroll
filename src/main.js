import { padPresses, presses } from './controls.js';
import './styles.css';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { createHud } from './hud.js';
import { createInput } from 'madness-engine/input';
import { CAST, DETAIL } from './cast/index.js';
import { preload, readyAll } from './cast/library.js';
import { bakeAll } from './models/library.js';
import { createStage } from './stage.js';
import { createStorage } from './storage.js';

const view = document.getElementById('view');
const audio = createAudio();
const wake = () => audio.wake();
addEventListener('pointerdown', wake);
addEventListener('keydown', wake);

let game = null;
let input = null;
const hud = createHud(document.body, {
  onStart: () => { audio.wake(); game?.start(); },
  onNew: () => { audio.wake(); game?.startOver(); },
  onTake: () => game?.take(),
  onRetry: () => game?.retry(),
  onLeave: () => game?.leave(),
  onChoose: (i) => game?.choose(i),
  onClose: () => game?.closeShop(),
  onPress: (name) => { audio.wake(); input?.press(name); },
});
hud.muted(audio.muted);
document.getElementById('mute').addEventListener('mute', () => hud.muted(audio.toggleMute()));

input = createInput(view, { presses, padPresses,
  anchor: () => game?.marbleOnScreen(view.getBoundingClientRect()),
});

try {
  const stage = await createStage(view);
  // The models bake in the background while the title waits, with a bar for how far it has got.
  // (The townsfolk too, in workers of their own, at the same time.)
  const bar = document.getElementById('loading');
  bar.hidden = false;
  const people = Object.keys(CAST);
  preload(people, DETAIL);
  let models = 0, cast = 0;
  const show = () => bar.style.setProperty('--done', `${Math.round((models * 0.5 + cast * 0.5) * 100)}%`);
  await Promise.all([
    bakeAll(stage.GFX, (k) => { models = k; show(); }),
    readyAll(people, DETAIL, { onProgress: (k) => { cast = k; show(); } }),
  ]);
  bar.hidden = true;
  game = createGame({ stage, hud, input, audio, storage: createStorage() });
  globalThis.petroll = game;

  let last = performance.now();
  stage.renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    game.update(dt, input.take());
    stage.look();
    stage.render();
  });
} catch (err) {
  const box = document.getElementById('error');
  box.hidden = false;
  box.textContent = 'Petroll could not start: this browser offers neither WebGPU nor WebGL 2.\n\n'
    + String(err && err.message ? err.message : err);
  console.error(err);
}
