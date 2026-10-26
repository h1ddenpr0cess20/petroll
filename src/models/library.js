import { adopt, bake, isBaked } from 'madness-engine/models/legacy-bake';
import { MODELS } from './index.js';

/**
 * The models, baked as the page starts: a few workers share out the work
 * and each mesh is handed over as it is done. `ready` resolves when they
 * all are (reporting progress on the way). Where there are no workers (the
 * tests) everything bakes here, as it's asked for.
 */

export function bakeAll(GFX, onProgress = () => {}) {
  const names = Object.keys(MODELS).filter((n) => !isBaked(n));
  if (typeof Worker === 'undefined' || !names.length) {
    for (const n of names) bake(GFX, MODELS[n]);
    onProgress(1);
    return Promise.resolve();
  }
  // Biggest first, so no worker is left with a pumpjack at the end.
  const queue = names.slice().sort((a, b) => (MODELS[a].cell ?? 0.02) - (MODELS[b].cell ?? 0.02));
  const total = queue.length;
  let done = 0;
  return new Promise((resolve) => {
    const count = Math.max(1, Math.min(queue.length, (navigator.hardwareConcurrency || 4) - 1, 6));
    let live = count;
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL('./bake.worker.js', import.meta.url), { type: 'module' });
      const next = () => {
        const name = queue.shift();
        if (!name) {
          worker.terminate();
          if (--live === 0) resolve();
          return;
        }
        worker.postMessage({ name });
      };
      worker.onmessage = ({ data: { name, data } }) => {
        adopt(GFX, MODELS[name], data);
        onProgress(++done / total);
        next();
      };
      worker.onerror = (e) => {
        console.error('petroll: a model would not bake in the background; baking it here', e);
        worker.terminate();
        for (const n of queue.splice(0)) bake(GFX, MODELS[n]);
        if (--live === 0) resolve();
      };
      next();
    }
  });
}

/** A model's geometry and materials (baking it here if it isn't yet). */
export const model = (GFX, name) => {
  const def = MODELS[name];
  if (!def) throw new Error(`no model called ${name}`);
  return { def, ...bake(GFX, def) };
};
