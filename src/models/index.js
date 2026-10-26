import { ODDS } from 'madness-engine/scenery/odds';
import { OIL } from 'madness-engine/scenery/oil';
import { STREET } from 'madness-engine/scenery/street';
import { VEHICLES } from 'madness-engine/scenery/vehicles';

/** How much coarser than sculpted a model is meshed, by name: the seeds, a couple of hundred of them and tiny on screen. */
const COARSE = { seed: 1.8 };

/** How much coarser a vehicle's far version (`sedan-far`) is: what the traffic draws away from the hamster. */
export const FAR = 2.2;

/** Every sculpted model, by name; and each vehicle again, coarser, for far off. */
export const MODELS = Object.fromEntries([
  ...Object.entries({ ...VEHICLES, ...STREET, ...OIL, ...ODDS }).map(([name, def]) => [name, { coarse: COARSE[name] ?? 1, ...def }]),
  ...Object.entries(VEHICLES).map(([name, def]) => [`${name}-far`, { ...def, name: `${def.name}-far`, coarse: FAR }]),
]);
