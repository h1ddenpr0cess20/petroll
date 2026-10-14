import './styles.css';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { bakeAll } from './models/library.js';
import { createStage } from './stage.js';
import { createStorage } from './storage.js';

const view = document.getElementById('view');
const audio = createAudio();
const wake = () => audio.wake();
addEventListener('pointerdown', wake);
addEventListener('keydown', wake);

let game = null;
const hud = createHud(document.body, {
  onStart: () => { audio.wake(); game?.start(); },
  onNew: () => { audio.wake(); game?.startOver(); },
});
hud.muted(audio.muted);
document.getElementById('mute').addEventListener('mute', () => hud.muted(audio.toggleMute()));

const input = createInput(view, {
  anchor: () => game?.marbleOnScreen(view.getBoundingClientRect()),
});

try {
  const stage = await createStage(view);
  // The models bake in the background while the title waits, with a bar for how far it has got.
  const bar = document.getElementById('loading');
  bar.hidden = false;
  await bakeAll(stage.GFX, (k) => { bar.style.setProperty('--done', `${Math.round(k * 100)}%`); });
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
