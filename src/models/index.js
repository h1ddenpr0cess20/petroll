import { OIL } from './oil.js';
import { STREET } from './street.js';
import { VEHICLES } from './vehicles.js';

/** Every sculpted model, by name. */
export const MODELS = { ...VEHICLES, ...STREET, ...OIL };
