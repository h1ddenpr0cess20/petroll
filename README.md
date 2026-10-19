# Petroll

A hamster in a plastic run-about ball, loose in an oil town. There are no
levels: Petroleum Springs is one open map, all of it there from the start,
and the hamster can roll anywhere it can get to. West of the interstate are
the suburbs, downtown traffic, a gas station, an oil field with its
pumpjacks nodding, and a refinery where the gas flares up out of the floor;
over the road bridge, east of it, a truck stop, a drive-in, a trailer park,
the oil baron's hill, a dirt speedway and a quarry.

Somewhere in all of it are **30 golden sunflower seeds**, and sunflower
seeds lie about in lines for eating.

And the townsfolk have **jobs** going, the way they do in Springfield: roll
up to anybody with a **!** over their head, hear them out, take it on, and
beat the clock. Nineteen of them, from a paper round to ramming the tax
man's car, tailing a tanker to wherever it's dumping, carrying a jar of
pickled eggs over the interstate without a knock, and racing the
speedway's champion hamster. The jobs pay; knocking things over pays a
little; the **bubble shop** takes it.

It is built the way [Madness](https://github.com/h1ddenpr0cess20/madness) is
built, on the same engine: the renderer, the ball physics, the camera that
turns round the ball, and the ball itself made of two parts. Madness's
marble is a glass shell that rolls with a spark inside it. Petroll's ball
is a plastic shell that rolls with a hamster inside it. The hamster doesn't
roll: it stays on its feet, turns to face where it's going, and runs. It's
sculpted with the SDF sculptor from the
[Rock 'n' Roller](https://github.com/h1ddenpr0cess20/rocknroller-iii) games
(`src/sculpt/`, from [Metroll](https://github.com/h1ddenpr0cess20/metroll)).

![The title screen](docs/screenshots/title.jpg)

## Run

```sh
git clone https://github.com/h1ddenpr0cess20/petroll
cd petroll
npm install
npm run dev               # → http://localhost:5173
```

No server and no keys: it's a static page. `npm run build` puts it in `dist/`,
which runs from any folder or path. WebGPU where the browser has it, WebGL 2
where it doesn't (`?renderer=webgl` pins it). Node 22.12 or later.

## Play

| | |
|---|---|
| <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> or <kbd>WASD</kbd> | Roll. Up always rolls up the screen, however the view is turned. |
| <kbd>Space</kbd> | Hop. |
| <kbd>Shift</kbd> | Dash: a burst of scurrying. The bar under the bubble is the hamster getting its breath back. |
| <kbd>Enter</kbd> | Take a job on (when somebody's offering), or have a look round the bubble shop (on its pad). |
| Hold the mouse or a finger | Roll toward the pointer. The further it is from the ball, the harder the push. |
| <kbd>Q</kbd> <kbd>E</kbd>, or drag with the right mouse button | Turn the view round the ball. Dragging up and down tilts it. |
| Mouse wheel, or <kbd>+</kbd> <kbd>−</kbd> | Zoom. |
| Two fingers | Pinch to zoom, twist to turn, drag up or down to tilt. |
| <kbd>C</kbd> | Put the view back. |
| Gamepad | Left stick or d-pad rolls; right stick turns and tilts; shoulder buttons zoom; <kbd>A</kbd> hops (and takes jobs on), <kbd>X</kbd> or the right trigger dashes, <kbd>Start</kbd> pauses, <kbd>Back</kbd> gives up a job. |
| On a phone | HOP and DASH buttons in the corner. |
| <kbd>P</kbd> / <kbd>Esc</kbd> | Pause. Paused in a job, <kbd>X</kbd> gives it up. |
| <kbd>M</kbd> | Sound on or off. |

The map in the corner turns with the view, so up on it is up the screen. It
shows the traffic, the air pumps, the bubble shops and everybody with work
going; in a job, where to go next (pinned to the rim when it's further off),
the car you're after, or what's left to knock over. In a job an arrow over
the ball points the way too.

### Jobs

Twelve people about town (and their animals: the pigeons in the plaza, a
corgi, a rat in the alley, the cats, who watch the hamster closer than
anybody) have nineteen jobs between them. Roll up to one with a **!** and
they say what they want and what it pays; <kbd>Enter</kbd> takes it on, or
roll away. A job is a run of stages against one clock:

| | |
|---|---|
| Go | Get somewhere, maybe picking something up on the way. Something *fragile*: one hard knock and it's broken. |
| Gates | Through every gate in order: the paper round, the inspection, laps of the oval. |
| Knock | Knock every one of them flying: the flamingos, the other candidate's signs. |
| Grab | Round them all up: survey flags, the grandpups (one's on a roof; there's a trampoline). |
| Ram | A car going round the block: hit it hard enough, enough times, before the clock runs out. |
| Tail | Follow a car wherever it's going without losing it: the meter drains while it's too far ahead. |
| Race | Through the gates ahead of a rival in a ball of their own. |

It fails if the clock runs out, the bubble pops, the tar gets you, what you
carry breaks, the car you're tailing gets away or the rival wins; then it's
**try again** (back to where it starts) or forget it. Done, it pays, and the
next job from the same person comes up.

### Seeds

Sunflower seeds lie about in lines all over town, for eating. The golden
ones are hidden: up the quarter pipe, in the middle of the maze, on top of
the derrick, out on the island in the tar pit, on the Hendersons' roof (the
trampoline out front helps), over the speedway's jump, at the bottom of the
quarry. The map in the corner shows the golden seeds still to find in each
part of town you've been to. The golden seeds found, and your best time for
all of them, are kept with the rest.

### The bubble shop

On the forecourt of the Gas 'n' Go and at the truck stop: new plastic for
the ball (eight colours, Solid Gold the dearest), and three things that make
a difference — **Grippy Treads** (oil and wet floors hardly matter), a
**Turbo Wheel** (the dash comes back twice as fast) and a **Thick Shell**
(knocks cost 40% less). Cones, bins, crates, flamingos and yard signs are
standing about all over town; knock them flying for loose change. They're
stood up again when nobody's looking.

### The bubble

The ball starts at 100. Hard landings, cars, rolling oil drums and the gas
flares take it down; at nothing it **pops**, and the hamster is back at the
last **air pump** it rolled over. Rolling over an air pump puts the bubble
back to 100 and makes it the place you come back to. A pumpjack's head
coming down on the ball pops it outright. **Tar** swallows it, and it's put
back on the last firm ground it crossed.

The golden seeds found, the jobs done, the cash, what's been bought and the
last pump are kept in the browser (`petroll.v2`; golden seeds found before
the jobs came carry over), and the game plays the same with storage blocked.

## Petroleum Springs

| | |
|---|---|
| ![Maple Grove](docs/screenshots/maple-grove.jpg) | **Maple Grove**: the suburbs, and home. Mown lawns, a drained pool to roll round, a hedge maze, a skate park with a quarter pipe you need a run-up for. |
| ![Downtown](docs/screenshots/downtown.jpg) | **Downtown**: office towers and the alley behind them, a parking garage to spiral up to the roof, the plaza and its fountain, a building site with switchback scaffolding. Two rings of traffic round the town, one each way, and two more round the middle; cars brake and honk for a hamster in front of them, and shove one beside them. |
| ![The Gas 'n' Go](docs/screenshots/gas-n-go.jpg) | **The Gas 'n' Go**: pumps, oil spilt on the forecourt (no grip at all), a car wash that's wet all through, a loading ramp up onto the shop's roof, a junkyard, a bubble shop, and a footbridge over the interstate to the billboard on the hill. The canopy fades while you're under it. |
| ![The interstate](docs/screenshots/interstate.jpg) | **The Interstate**: trucks, tankers and cars in both directions, out of a tunnel at one end and into one at the other. Nobody brakes. A barrier down the middle, with a gap in it here and there; the footbridge over it, and the road bridge at the north end, with traffic going over and back. |
| ![The Oil Field](docs/screenshots/oil-field.jpg) | **The Oil Field**: rolling dirt and scrub, pumpjacks nodding on their pads, a pipeline a tile wide to roll along the top of, a derrick with a lift up to the platform, a tar pit with an island in it and a plank out to it, Slick Hill with oil all down one side, and a barrel yard where the drums come after you. |
| ![The Refinery](docs/screenshots/refinery.jpg) | **The Refinery**: tanks (the tall one has a lift), a ramp up to a catwalk, pipe racks overhead, a flare stack, and flare alley, where the gas comes up out of the floor in a wave you have to ride the gap behind. |

Over the interstate, the east side of town, as big again as the west:

| | |
|---|---|
| **Big Rig Truck Stop** | The diner, rigs parked up in rows to weave between, a kicker ramp off the end of the lot, the other bubble shop. |
| **The Drive-in** | Rows of cars facing the big screen (tonight: *Attack of the 50 ft Hamster*), and the snack bar with the projector in it. |
| **Crude Acres** | The mobile home park, round a gravel loop: homes with their porches, awnings and cars in the drives, an Airstream or two, the office by the gate; in the middle a common with an above-ground pool, a swing set, a fire pit, the washing out and party lights strung over it; and trampolines, one in front of the Hendersons' for their roof. |
| **Baron's Hill** | The oil baron's mansion on top of a great round hill, the drive straight up the front, statues, and his poodle. |
| **Wildcat Speedway** | A dirt oval, banked round the ends and walled outside, a grandstand down the back straight, a jump in the infield. |
| **The Quarry** | A pit cut down in steps to a sandy floor, the haul road down the north side with the haul truck on it, the crusher and the blasting shed up top. |

It is always early evening in Petroleum Springs. The sun is low, the shadows
are long, the sky is peach going to violet over hills with derricks on them,
and the plastic, the paint and the puddles all reflect the same sky.

## How it's made

| | |
|---|---|
| `src/vendor/gfx/` | Alan's renderer, as in Madness, unchanged: WebGPU or WebGL 2, physically based shading, transmission, shadows. |
| `src/hamster.js` | The ball (thin tinted plastic, the seam, the twist-off door with its tabs, the air slits) and the hamster, sculpted, baked and running. |
| `src/cast/` | The townsfolk and the animals about town, sculpted and rigged: the people, pigeons, corgi, rat and poodle from [Rock 'n' Roller III](https://github.com/h1ddenpr0cess20/rocknroller-iii), the cats from [Catroller](https://github.com/h1ddenpr0cess20/catroller); baked in workers while the title waits. |
| `src/sculpt/` | Metroll's SDF sculptor (`sdf.js`, `skins.js`), and `bake.js` to make a mesh of a sculpt. |
| `src/map.js` | The map: a grid of tiles, each with four corner heights and a surface, and on top of them road paint, props, solid boxes, decks, roads for the traffic, the hazards and the pickups. It builds the meshes and the collision triangles. |
| `src/town.js` | Petroleum Springs, district by district. |
| `src/work.js` | Who wants what doing: the townsfolk, their jobs, the bubble shops, the things to knock over. |
| `src/jobs.js` | The jobs as they run: offers, the count in, the stages, the clock, how they're passed and failed. Nothing drawn. |
| `src/pickups.js` | The seeds and the golden seeds, as they look. |
| `src/jobview.js`, `src/shop.js` | The jobs as they look (the townsfolk, beacons, the car to ram, the rival, the arrow), and the shop's wares. |
| `src/xray.js` | Whether the ball is hidden from the camera, by rays against the town, for the ring drawn where it is when it is. |
| `src/surfaces.js`, `src/textures.js` | What the ground is made of, how it grips and drags, and how each surface is painted. |
| `src/props.js`, `src/kit.js` | Everything standing on the map, built from plain shapes and merged into a few meshes. |
| `src/traffic.js` | The cars, round their loops with the corners rounded off, waiting behind each other at junctions and braking for the hamster. |
| `src/hazards.js` | Pumpjacks, gas flares, lifts and oil drums. |
| `src/physics.js` | Madness's sphere physics, with grip and drag per surface and still boxes bucketed. |
| `src/run.js` | The world as it runs, with nothing drawn: the rules for the bubble, hops and dashes, trampolines, what's knocked over, the pumps, the jobs. The game draws it; the tests drive it. |
| `src/game.js`, `src/hud.js`, `src/audio.js` | The game, the screen round it (the map in the corner turns with the view), and every sound, synthesised. |

| Script | |
|---|---|
| `npm run dev` | Vite dev server (and `/preview.html`, a turntable for the ball and the hamster: `?tint=f07ab4`, `?speed=4`) |
| `npm run build` | Bundles to `dist/` |
| `npm test` | `node:test`: the physics, the map builder, the town, the traffic, the hazards, the rules, the jobs, the x-ray, the hamster, and two autopilots: one that has to find all 30 golden seeds in one go without the bubble popping, one that has to do every job in town against the clock, with time to spare |
| `npm run lint` | ESLint |

The golden-seed autopilot (`test/helpers/autopilot.js`, its way round in
`test/helpers/tour.js`) finds its own way across town and follows set
waypoints where it has to: up the quarter pipe flat out, off the footbridge
onto the barrier, across the interstate in a gap in the traffic, along the
pipeline, under a pumpjack between nods, along the plank, up and down the
lifts, down flare alley behind the wave, off the trampoline onto the roof,
down the quarry's haul road and over the speedway's jump.

The jobs autopilot (`test/helpers/jobpilot.js`) takes each job on where its giver
stands and does it: it finds its own way across town (`test/helpers/plan.js`,
A* over the tiles, over the bridges), rounds things up nearest first, chases
the car it has to ram, sits a few tiles behind the one it has to tail, and
follows set waypoints where it has to: up onto the pipeline, along the
plank, along the catwalk and down flare alley behind the wave, off the
trampoline onto the trailer roof. Each job has to be done in under 85% of its
time, so there's room for somebody who doesn't know the way as well.

In the browser console, `petroll.debug.teleport(x, z)` puts the hamster
anywhere on the map, `petroll.debug.job('paper')` starts a job, and
`petroll.debug.cash(500)` is a little something for the shop.
