import { TINTS } from 'madness-engine/heroes/hamster';

/**
 * The bubble shop: what the jobs' pay (and the loose change from knocking
 * things over) buys. New plastic for the ball, in colours; and three
 * things that make a difference — a thicker shell (knocks cost less),
 * a better wheel (the dash comes back quicker), grippier treads (oil and
 * wet floors hardly matter).
 */

export const ITEMS = Object.freeze([
  { id: 'tint:blue', kind: 'tint', name: 'Sky Blue', tint: TINTS.blue, price: 0 },
  { id: 'tint:clear', kind: 'tint', name: 'Crystal Clear', tint: TINTS.clear, price: 60 },
  { id: 'tint:pink', kind: 'tint', name: 'Bubblegum', tint: TINTS.pink, price: 80 },
  { id: 'tint:green', kind: 'tint', name: 'Lime Fizz', tint: TINTS.green, price: 100 },
  { id: 'tint:orange', kind: 'tint', name: 'Tangerine', tint: TINTS.orange, price: 120 },
  { id: 'tint:purple', kind: 'tint', name: 'Grape Soda', tint: TINTS.purple, price: 150 },
  { id: 'tint:crude', kind: 'tint', name: 'Crude Black', tint: '#2a2830', price: 400 },
  { id: 'tint:gold', kind: 'tint', name: 'Solid Gold', tint: '#ffcc3a', price: 900 },
  { id: 'perk:treads', kind: 'perk', perk: 'treads', name: 'Grippy Treads', text: 'Keep your footing on oil and wet floors.', price: 200 },
  { id: 'perk:wheel', kind: 'perk', perk: 'wheel', name: 'Turbo Wheel', text: 'Get your breath back twice as fast after a dash.', price: 300 },
  { id: 'perk:shell', kind: 'perk', perk: 'shell', name: 'Thick Shell', text: 'Knocks, bumps and burns cost 40% less.', price: 450 },
]);

/** Buy `id` (if it can be afforded and isn't owned) or, a tint already owned, wear it. Returns what happened. */
export function choose(state, id) {
  const item = ITEMS.find((i) => i.id === id);
  if (!item) return { ok: false, why: 'none' };
  const owned = item.price === 0 || state.owned.includes(id);
  if (!owned) {
    if (state.cash < item.price) return { ok: false, why: 'cash', item };
    state.cash -= item.price;
    state.owned.push(id);
    if (item.kind === 'tint') state.tint = id;
    return { ok: true, bought: true, item };
  }
  if (item.kind === 'tint') {
    state.tint = id;
    return { ok: true, worn: true, item };
  }
  return { ok: false, why: 'owned', item };
}

/** The perks owned, by name. */
export const perksOf = (owned) => ITEMS.filter((i) => i.kind === 'perk' && owned.includes(i.id)).map((i) => i.perk);

/** The plastic of tint `id`. */
export const tintOf = (id) => ITEMS.find((i) => i.id === id)?.tint ?? TINTS.blue;
