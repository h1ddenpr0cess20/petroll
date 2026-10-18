/**
 * What the game remembers between visits: the jobs done, the cash, what's
 * been bought at the bubble shop and the ball being worn, the air pump it
 * was last at, and how long it has been rolling. Browser storage can be
 * missing or refuse, so every touch of it is guarded and the game plays
 * the same without it.
 */

const KEY = 'petroll.v2';
const EMPTY = { done: [], cash: 0, owned: [], tint: 'tint:blue', pump: null, time: 0 };

const strings = (v) => (Array.isArray(v) ? [...new Set(v.filter((n) => typeof n === 'string'))] : []);

export function createStorage(store = globalThis.localStorage) {
  let saved = { ...EMPTY, done: [], owned: [] };
  try {
    const raw = JSON.parse(store?.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      saved.done = strings(raw.done);
      saved.owned = strings(raw.owned);
      saved.cash = Number.isFinite(raw.cash) && raw.cash >= 0 ? Math.floor(raw.cash) : 0;
      saved.tint = typeof raw.tint === 'string' ? raw.tint : EMPTY.tint;
      saved.pump = typeof raw.pump === 'string' ? raw.pump : null;
      saved.time = Number.isFinite(raw.time) && raw.time >= 0 ? raw.time : 0;
    }
  } catch {}

  const copy = () => ({ ...saved, done: [...saved.done], owned: [...saved.owned] });
  const save = () => {
    try { store?.setItem(KEY, JSON.stringify(saved)); } catch {}
    return copy();
  };

  return {
    load: copy,
    /** Where it has got to. Any of `done`, `cash`, `owned`, `tint`, `pump`, `time`. */
    progress(next) {
      saved = { ...saved, ...next };
      saved.done = strings(saved.done);
      saved.owned = strings(saved.owned);
      return save();
    },
    /** Start over. */
    clear() {
      saved = { ...EMPTY, done: [], owned: [] };
      return save();
    },
  };
}
