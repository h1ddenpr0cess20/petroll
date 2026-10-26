import { bakeData } from 'madness-engine/models/legacy-bake';
import { MODELS } from './index.js';

/** Bakes models off the main thread: a name in, the mesh's arrays out (handed over, not copied). */
self.onmessage = ({ data: { name } }) => {
  const data = bakeData(MODELS[name]);
  self.postMessage({ name, data }, [data.position.buffer, data.normal.buffer, data.color.buffer, data.index.buffer]);
};
