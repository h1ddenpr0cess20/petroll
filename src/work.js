/**
 * Who wants what doing in Petroleum Springs: the townsfolk (see `cast/`),
 * the animals about town, the jobs each of them has going, the
 * bubble shops to spend the pay in, and the odds and ends standing about
 * the place to knock flying for loose change.
 *
 * A job's stages are as `jobs.js` describes. Points are [x, z] (or
 * [x, z, y] up on something); a job with `start` puts the hamster there
 * when it's taken on.
 */

import { ACRES_ROOF, BARON, OVAL, PIPE, PIT } from './town.js';

/** Round the speedway's oval, along the middle of the track, starting on the line and going north up the west straight. */
function lap(step = 4) {
  const O = OVAL, r = (O.inner + O.outer) / 2;
  const out = [];
  const line = (x, z0, z1) => {
    const n = Math.max(1, Math.round(Math.abs(z1 - z0) / step));
    for (let i = 0; i < n; i++) out.push([x, z0 + ((z1 - z0) * i) / n]);
  };
  const bend = (z, sign) => {
    const n = Math.max(2, Math.round((Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI;
      out.push([O.x - Math.cos(a) * r * sign, z - Math.sin(a) * r * sign]);
    }
  };
  line(O.x - r, 89, O.z0);
  bend(O.z0, 1);
  line(O.x + r, O.z0, O.z1);
  bend(O.z1, -1);
  line(O.x - r, O.z1, 89);
  out.push([O.x - r, 89]);
  return out;
}

export function work(c, { P }) {
  // The gates round a lap: close enough together that the way through them keeps to the track.
  const LAP_GATES = lap(9).slice(1);
  // ── The townsfolk ──────────────────────────────────────────────────────
  c.giver('penny', 'Mr. Pennywhistle', 14.6, 18.6, { look: 'tourist', line: "Back from the Grand Canyon. It's a big hole. Anyway: a job?" });
  c.giver('mayor', 'Mayor Whiskers', 55.5, 49.5, { look: 'gent', line: 'Vote Whiskers! Er, I mean: I have a little favour to ask.' });
  c.giver('hoss', 'Foreman Hoss', 85.4, 32.6, { look: 'security', line: 'Hard hats on. Well, hard balls.' });
  c.giver('gus', 'Gus', 109.3, 46.5, { look: 'cabbie', line: "Fill 'er up? Nah, I need a hand." });
  c.giver('walt', 'Wildcat Walt', 52.5, 69.6, { look: 'archaeologist', line: 'Forty years I been digging for oil in this field. Found a lot of oil.' });
  c.giver('sprocket', 'Sprocket', 29.5, 64.5, { look: 'robot', line: 'BEEP. I AM THE REFINERY SAFETY ROBOT. SAFETY IS MY THIRD PRIORITY.' });
  c.giver('tex', 'Big Tex', 133.5, 21.5, { look: 'superfan', line: 'Breaker breaker, little buddy.' });
  c.giver('hal', 'Hot Dog Hal', 137.5, 71.5, { look: 'hotdog', line: 'The show must go on! And so must the hot dogs.' });
  c.giver('granny', 'Granny Gristle', 163.5, 56.5, { look: 'nonna', line: 'Look at you, you\'re all fur and no meat. Come here.' });
  c.giver('baron', 'Baron Von Crude', 214.5, 40.5, { look: 'dancer', y: BARON.top, line: 'Money is no object. You, however, are an object. A useful one.' });
  c.giver('ruts', 'Rusty "Ruts" McGee', 163.5, 89.5, { look: 'skier', line: "Raced everything there is to race. Skis included. Mostly skis." });
  c.giver('dusty', 'Dusty', 210.5, 67.5, { look: 'yodeler', line: 'Stand back. Further. Further than that.' });

  // ── The animals about town ─────────────────────────────────────────────
  c.critter('pigeon', 57, 46.5).critter('pigeon', 59.5, 37.5, { angle: 2 }).critter('pigeon', 62, 49, { angle: 4 });
  c.critter('corgi', 22.5, 19, { angle: 1 });
  c.critter('rat', 57.6, 22.5, { angle: Math.PI });
  c.critter('poodle', 221, 41.5, { y: BARON.top, angle: -0.5 });
  c.critter('cat-ginger', 171.5, 38.6, { size: 0.7 });
  c.critter('cat-black', 102.5, 24, { size: 0.7, clip: 'sleep' });
  c.critter('cat-grey', 127, 19.5, { size: 0.7 });
  c.critter('cat-calico', 124.5, 76, { size: 0.65 });
  c.critter('cat-siamese', 219, 39.2, { size: 0.65, y: BARON.top });
  c.critter('cat-tom', 225, 74, { size: 0.6, clip: 'sleep' });

  // ── Air pumps on the east side ─────────────────────────────────────────
  c.airPump('Truck Stop', 128.5, 23.5);
  c.airPump('Drive-in', 139.5, 64.5);
  c.airPump('Crude Acres', 172.5, 56.5);
  c.airPump("Baron's Gate", 240.5, 58.5);
  c.airPump('Speedway', 174.5, 89.5);
  c.airPump('Quarry', 204.5, 68.5);

  // ── The bubble shops ───────────────────────────────────────────────────
  c.shop("Gas 'n' Go Bubble Shop", 109.3, 51.5);
  c.shop('Truck Stop Bubble Shop', 139.5, 23.5);

  // ── The jobs ───────────────────────────────────────────────────────────

  // Maple Grove.
  c.job({
    id: 'paper', giver: 'penny', title: 'Paper Round', reward: 100, time: 55,
    brief: "The paper boy's off sick. Roll the Petroleum Springs Gazette round to every door on the street before the coffee's cold.",
    stages: [{ type: 'gates', text: 'Deliver the paper to every door', r: 1.1, points: [[14.5, 25.6], [20.5, 25.6], [20.5, 11.5], [14.5, 11.5], [34.5, 11.5], [41.5, 11.5]] }],
  });
  c.job({
    id: 'flamingos', giver: 'penny', after: 'paper', title: 'Flamingo Fiasco', reward: 150, time: 70,
    brief: 'Somebody has put plastic flamingos on every lawn in Maple Grove. The residents association is beside itself. Knock them all over.',
    stages: [{ type: 'knock', kind: 'flamingo', text: 'Knock over the flamingos', points: [[11.4, 26.5], [24.6, 22.5], [24.6, 13], [17.5, 26.6], [31.4, 26.5], [44.6, 12.5], [44.6, 26.5], [31.4, 13.2], [11.4, 40], [24.6, 44]] }],
  });

  // Downtown.
  c.job({
    id: 'signs', giver: 'mayor', title: 'Campaign Trail', reward: 150, time: 70,
    brief: 'My opponent, Councillor Grubb, has put his signs up all over downtown. It would be a terrible shame if they were knocked over. Terrible.',
    stages: [{ type: 'knock', kind: 'sign', text: 'Knock down the VOTE GRUBB signs', points: [[50.5, 18], [58.5, 26.2], [65.5, 20], [50.5, 40], [65.5, 37.5], [58, 32.6], [72.5, 50.4], [85.5, 45]] }],
  });
  c.job({
    id: 'taxman', giver: 'mayor', after: 'signs', title: 'The Tax Man Cometh', reward: 220, time: 60,
    brief: "The county tax collector is circling downtown in that grey sedan. Ram it till he gives up and goes home. I never asked you this.",
    stages: [{ type: 'ram', text: "Ram the tax man's car", hits: 5, model: 'sedan', paint: '#8a8f9a', speed: 4.4, route: [[47, 29], [47, 55], [89, 55], [89, 29]] }],
  });

  // The building site.
  c.job({
    id: 'hardhat', giver: 'hoss', title: 'Hard Hat Hustle', reward: 160, time: 60,
    brief: 'Run the site inspection: up the scaffold to the top, then the fountain and the back alley. The inspector does it in under a minute.',
    stages: [{ type: 'gates', text: 'Up the scaffold, then round downtown', r: 1.3, points: [[78.5, 35], [84.5, 36], [78.5, 37], [72, 38.5], [58, 42], [58.5, 26.2]] }],
  });

  // The Gas 'n' Go.
  c.job({
    id: 'eggs', giver: 'gus', title: 'Handle With Care', reward: 200, time: 95,
    brief: "Big Tex at the Big Rig Diner wants a jar of my famous pickled eggs. Take it over the interstate. Gently! One good knock and it's smashed.",
    broke: 'The jar smashed! Pickled eggs everywhere.',
    stages: [
      { type: 'go', text: 'Pick up the pickled eggs', at: [108.1, 46.5], r: 1.4, pickup: 'jar', fragile: 6.5 },
      { type: 'go', text: 'Take the jar to the Big Rig Diner', at: [133.5, 20.4], r: 1.2, drop: true },
    ],
  });
  c.job({
    id: 'dumping', giver: 'gus', after: 'eggs', title: 'Midnight Dumping', reward: 260, time: 120,
    brief: "That tanker's been at my pumps every night, then off somewhere with its tank full. Follow it. Don't lose it.",
    stages: [{ type: 'tail', text: 'Follow the tanker', model: 'tanker', paint: '#3a3d44', speed: 4.0, far: 14, route: [[101, 49], [101, 53], [89, 53], [89, 9], [143, 9], [143, 63], [217, 63], [217, 84]] }],
  });

  // The oil field.
  c.job({
    id: 'survey', giver: 'walt', title: 'Survey Says', reward: 180, time: 95,
    brief: "The wind blew my survey flags all over the field. Round 'em up before the boss comes asking.",
    stages: [{ type: 'grab', kind: 'flag', text: 'Round up the survey flags', points: [[57, 78], [70, 88], [85, 79], [97, 84], [86, 111], [58, 115]] }],
  });
  c.job({
    id: 'pipeline', giver: 'walt', after: 'survey', title: 'Line Walker', reward: 230, time: 80,
    brief: 'Walk the pipeline end to end for leaks, then check the island out in the tar pit. Watch your step on that plank.',
    stages: [{ type: 'gates', text: 'Along the pipeline, then out to the island', r: 1.2, points: [[66, 68.5, PIPE], [82, 68.5, PIPE], [97.5, 68.5, PIPE], [100.5, 67.5, PIPE], [70, 102.5, P.tar]] }],
  });

  // The refinery.
  c.job({
    id: 'flares', giver: 'sprocket', title: 'Flare Up', reward: 230, time: 85,
    brief: 'Inspect the catwalk, then the flare alley valves. The flares are on a timer. Ride the gap behind them.',
    stages: [{ type: 'gates', text: 'Along the catwalk, then down flare alley', r: 1.3, points: [[30, 71.5, 3], [38.5, 70.5, 3], [34.5, 82.5], [34.5, 94], [35, 106.5]] }],
  });
  c.job({
    id: 'valves', giver: 'sprocket', after: 'flares', title: 'Pressure Drop', reward: 210, time: 55,
    brief: 'The pressure is climbing in every line. Get to each shut-off valve before something goes bang.',
    stages: [{ type: 'gates', text: 'Shut every valve', r: 1.1, points: [[24, 66.5], [7, 81.5], [16.5, 101], [31, 99.5], [37, 109]] }],
  });

  // The truck stop.
  c.job({
    id: 'roadhog', giver: 'tex', title: 'Road Hog', reward: 260, time: 95,
    brief: "Some road hog in an orange pickup's been cutting up my rigs all week. Go teach him some manners. Six good knocks ought to do it.",
    stages: [{ type: 'ram', text: 'Ram the road hog', hits: 6, model: 'pickup', paint: '#e07a2a', speed: 4.8, route: [[143, 24], [143, 63], [193, 63], [193, 7], [143, 7]] }],
  });

  // The drive-in.
  c.job({
    id: 'reel', giver: 'hal', title: 'Reel Trouble', reward: 190, time: 110,
    brief: 'The film reel went through the car wash at the Gas \'n\' Go. Long story. Fetch it before the intermission ends!',
    stages: [
      { type: 'go', text: "Fetch the reel from the Gas 'n' Go car wash", at: [99, 60.5], r: 1.3, pickup: 'reel' },
      { type: 'go', text: 'Get the reel to the projector', at: [132, 71], r: 1.2, drop: true },
    ],
  });

  // Crude Acres.
  c.job({
    id: 'pups', giver: 'granny', title: 'Grandpups', reward: 200, time: 80,
    brief: "My grandpups got out of their cage again. Six of 'em! One's up on the Hendersons' roof — use the trampoline out front.",
    stages: [{ type: 'grab', kind: 'pup', text: 'Round up the grandpups', points: [[149, 48.6], [172.5, 37.8], [187.6, 42.5], [165, 43], [158, 13.8, ACRES_ROOF], [188.4, 57.4]] }],
  });

  // Baron's Hill.
  c.job({
    id: 'limo', giver: 'baron', title: 'Repossession', reward: 320, time: 100,
    brief: 'My former business partner has absconded with my limousine. It is going round and round the block. Ram it until he surrenders it.',
    stages: [{ type: 'ram', text: "Ram the Baron's limo", hits: 6, model: 'sedan', paint: '#1c1b1f', speed: 5.0, route: [[193, 61], [193, 9], [243, 9], [243, 61]] }],
  });
  c.job({
    id: 'hill', giver: 'baron', after: 'limo', title: 'King of the Hill', reward: 260, time: 55,
    brief: 'I race my staff round the hill every Sunday. Nobody ever beats my time. Go on, then.',
    start: [218, 58],
    stages: [{ type: 'gates', text: 'Round the hill and up to the top', r: 1.6, points: [[236, 47], [238, 30], [222, 15], [204, 20], [200, 40], [218, 40, BARON.top]] }],
  });

  // Wildcat Speedway.
  c.job({
    id: 'trial', giver: 'ruts', title: 'Time Trial', reward: 220, time: 50,
    brief: "Two laps of the oval. Beat the clock and maybe, just maybe, I'll race you.",
    start: [156, 91.5],
    stages: [{ type: 'gates', text: 'Two laps of the oval', r: 3.5, points: [...LAP_GATES, ...LAP_GATES] }],
  });
  c.job({
    id: 'champ', giver: 'ruts', after: 'trial', title: 'Beat the Champ', reward: 380, time: 60,
    brief: "My hamster Lightning has never lost on this oval. Two laps, ball to ball. First over the line wins.",
    start: [156, 91.5],
    stages: [{
      type: 'race', text: 'Beat Lightning over two laps', r: 3.5, from: [156, 91.5],
      points: [...LAP_GATES, ...LAP_GATES], line: [...lap(), ...lap().slice(1)],
      rival: { name: 'Lightning', tint: '#e8402e', speed: 6.6 },
    }],
  });

  // The quarry.
  c.job({
    id: 'dynamite', giver: 'dusty', title: 'Blast Off', reward: 260, time: 75,
    brief: "Fetch the dynamite from the blasting shed and get it down to the pit floor. Don't drop it. Seriously. Don't drop it.",
    broke: 'BOOM. Well. That could have gone better.',
    stages: [
      { type: 'go', text: 'Get the dynamite from the blasting shed', at: [237.5, 76.5], r: 1.3, pickup: 'dynamite', fragile: 6 },
      { type: 'go', text: 'Carry it down to the pit floor', at: [PIT.x + 1, PIT.z + 2, PIT.floor], r: 1.5, drop: true },
    ],
  });

  // ── Odds and ends to knock flying ──────────────────────────────────────
  const knock = (kind, list) => { for (const [x, z] of list) c.knock(kind, x, z); };
  knock('cone', [[73, 47.5], [75, 49.5], [82, 41], [130, 48.5], [135.5, 48.5], [131, 54], [136, 54], [94, 34.5], [94, 36.5], [215, 65.5], [221, 65.5], [208.5, 72], [227.5, 72]]);
  knock('bin', [[10.6, 27.4], [30.6, 27.4], [50.6, 27.4], [70.5, 27.5], [92.6, 33.5], [127.5, 58.5], [146.6, 59.4], [194.6, 59.4], [141, 37], [25.4, 32.6], [50.6, 32.6]]);
  knock('crate', [[127, 26], [127.5, 37.5], [140.5, 37.5], [127, 49], [233, 71], [234.5, 71], [199, 71], [5, 66], [39, 66], [36, 76], [97.5, 31], [109.5, 31]]);
  knock('flamingo', [[155.7, 13.2], [164.5, 13.3], [176.8, 13.3], [184.6, 13.5], [162.5, 25], [174.5, 25.2], [162.5, 42.5], [173.5, 42.5], [150.4, 31.5], [187.6, 31.5]]);
  knock('sign', [[196, 57.5], [240, 57.5], [196, 12], [240, 12]]);
}
