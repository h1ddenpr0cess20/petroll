/**
 * The way round every golden seed in the town, for the autopilot: where it
 * finds its own way (`to`), and where it follows set waypoints (`via`) —
 * up the quarter pipe flat out, over the footbridge and off it onto the
 * central reservation, across the interstate in a gap in the traffic,
 * along the pipeline, under the pumpjack between nods, along the plank to
 * the island in the tar, up and down the lifts, down flare alley one flare
 * at a time.
 */

import { flaresOut, headUp, laneClear, liftAtEnd } from './autopilot.js';

const v = (x, z, o = {}) => [x, z, o];

/**
 * Down flare alley behind the wave: wait between two rows of vents until
 * the next row has gone out and will stay out long enough, then go.
 */
function flareAlley() {
  const out = [v(34.5, 81.2, { speed: 2.5 })];
  const waits = [84, 88.2, 92, 95.8, 99.6, 103.4];
  waits.forEach((z, i) => {
    const next = waits[i + 1] ?? 107;
    out.push(v(34.5, z, { until: flaresOut(34.5, (z + next) / 2, 2.4, 1.3), stop: true, speed: 3, radius: 0.35 }));
  });
  out.push(v(35, 106.5, { speed: 3 }));
  return out;
}

export const TOUR = [
  { to: [23.5, 25.5], expect: 'Home sweet home' },
  { to: [18, 42], expect: 'Middle of the maze' },
  { to: [37.5, 22], expect: 'The deep end' },
  { to: [37.6, 42], stop: true },
  { via: [v(44.9, 42, { speed: 12, radius: 0.9 })], expect: 'Up the quarter pipe' },
  { to: [58.5, 25.5], expect: 'Down the back alley' },
  { to: [78, 19], expect: 'Top of the car park' },
  { to: [71.6, 39.8], expect: 'Hard hat area' },
  { to: [56.4, 42], expect: 'In the fountain' },
  { to: [99, 60.5], expect: 'Through the car wash' },
  { to: [109.5, 55.6] },
  { via: [v(109.5, 63.5, { speed: 3 }), v(107.6, 63.5, { speed: 2 }), v(105.5, 58.5, { speed: 2.5 })], expect: "On the Gas 'n' Go" },
  { via: [v(108.6, 63.5, { speed: 2 }), v(109.6, 63.4, { speed: 2 }), v(109.5, 56.5, { speed: 2.5 })] },
  { to: [100.4, 35] },
  { via: [v(110.5, 35, { speed: 3 }), v(116.6, 35.1, { speed: 2.5, stop: true }), v(116.6, 37.7, { speed: 1.3, reckless: true, stop: true })], expect: 'On the central reservation' },
  { via: [v(116.5, 38.6, { speed: 1, stop: true, reckless: true, until: laneClear([113, 115], 38.6, 16) }), v(110.6, 38.6, { speed: 6, reckless: true })] },
  { to: [100.4, 35] },
  { via: [v(110.5, 35, { speed: 3 }), v(121.6, 35, { speed: 3 }), v(122.6, 32), v(122.6, 26.5, { speed: 2.5 })], expect: 'Under the billboard' },
  { via: [v(122.6, 44.6, { speed: 3 }), v(123.3, 47.5, { speed: 2 })] },
  { to: [121.6, 121.6] },
  { via: [v(124.7, 124.7, { speed: 5 })], expect: 'The edge of the world' },
  { to: [122.5, 101.5] },
  { via: [v(121.6, 101.5, { until: laneClear([118, 120], 101.5, 16), stop: true, reckless: true }), v(116.5, 101.5, { speed: 6, reckless: true, until: laneClear([113, 115], 101.5, 16), stop: true }), v(110, 101.5, { speed: 6, reckless: true })] },
  { to: [57.4, 68.5] },
  { via: [v(64, 68.5, { speed: 2.5 }), v(97.5, 68.5, { speed: 3.2 }), v(100.5, 67.5, { speed: 2 })], expect: 'End of the line' },
  { to: [66.4, 95.5] },
  { via: [v(66.4, 95.5, { until: headUp(2), stop: true }), v(63.5, 95.5, { speed: 4 }), v(63.5, 97.8, { speed: 3 })], expect: 'Under the nodding donkey' },
  { to: [63.6, 102.5], stop: true },
  { via: [v(64.6, 102.5, { speed: 1.4 }), v(69.8, 102.5, { speed: 1.4, stop: true }), v(64.3, 102.5, { speed: 1.4, stop: true })], expect: 'Tar pit island' },
  { to: [60.5, 84.5], expect: 'Top of Slick Hill' },
  { to: [76.8, 88] },
  { via: [v(76.8, 88, { until: liftAtEnd(0, 0), stop: true }), v(1, 1, { on: 0, until: liftAtEnd(0, 1), stop: true, speed: 2 }), v(82, 88, { speed: 2.5 })], expect: 'Top of the derrick' },
  { via: [v(80.7, 88, { until: liftAtEnd(0, 1), stop: true, speed: 2 }), v(1, 1, { on: 0, until: liftAtEnd(0, 0), stop: true, speed: 2 }), v(76.5, 88, { speed: 2 })] },
  { to: [97.5, 105.5], expect: 'In the barrel yard' },
  { to: [20.4, 88] },
  { via: [v(20.4, 88, { until: liftAtEnd(1, 0), stop: true }), v(1, 1, { on: 1, until: liftAtEnd(1, 1), stop: true, speed: 2 }), v(12.5, 88.5, { speed: 2.5 })], expect: 'Top of the big tank' },
  { via: [v(16.3, 88, { until: liftAtEnd(1, 1), stop: true, speed: 2 }), v(1, 1, { on: 1, until: liftAtEnd(1, 0), stop: true, speed: 2 }), v(20.5, 88, { speed: 2 })] },
  { to: [21, 82.6] },
  { via: [v(21, 73, { speed: 2.5 }), v(21.5, 71.5, { speed: 1.5 }), v(36.5, 71.5, { speed: 2.5 }), v(38.5, 70.5, { speed: 2 })], expect: 'End of the catwalk' },
  { via: [v(36.5, 71.5, { speed: 2 }), v(21.5, 71.5, { speed: 2.5 }), v(21, 73, { speed: 1.5 }), v(21, 82, { speed: 2.5 })] },
  { to: [34.5, 80.4] },
  { via: flareAlley(), expect: 'End of flare alley' },
];
