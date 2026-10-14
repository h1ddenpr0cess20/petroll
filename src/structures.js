import { createKit } from './kit.js';
import { linearRGB } from './map.js';
import { wallMaterial } from './textures.js';

/**
 * The town's bigger things — tanks, the derrick, the crane, the canopy, the
 * car wash, scaffolding, the pipeline and the pipe racks, the flare stack,
 * the tunnels, the billboard, the fence round it all — drawn from the
 * map's props (`map.props`). What's solid about them is on the map already.
 *
 * Surfaces that want a texture (a tank's welded plates, the chain-link,
 * the hedges, concrete) are built of panels a tile or so across, each with
 * the whole texture on it (the renderer doesn't repeat textures), lit by
 * the night's light baked in as the ground is. Steelwork, tubes and trim
 * come from a kit of plain shapes.
 */

const TAU = Math.PI * 2;

/** Textured panels, gathered by texture. */
function panels(light) {
  const layers = new Map();
  const layer = (tex) => {
    if (!layers.has(tex)) layers.set(tex, { position: [], normal: [], color: [], uv: [] });
    return layers.get(tex);
  };
  const quad = (tex, a, b, c, d, n, colour, uv = [[0, 1], [1, 1], [1, 0], [0, 0]]) => {
    const out = layer(tex);
    const base = linearRGB(colour);
    for (const [p, t] of [[a, uv[0]], [b, uv[1]], [c, uv[2]], [a, uv[0]], [c, uv[2]], [d, uv[3]]]) {
      out.position.push(...p);
      out.normal.push(...n);
      const l = light(p[0] + n[0] * 0.3, p[1], p[2] + n[2] * 0.3);
      out.color.push(base[0] * l[0], base[1] * l[1], base[2] * l[2]);
      out.uv.push(...t);
    }
  };
  return {
    layers,
    /** An upright cylinder's side, in panels about a tile wide and a tile high. */
    cylinder(tex, x, z, r, y0, y1, colour, { band = 1 } = {}) {
      const n = Math.max(8, Math.round((TAU * r) / 1.2));
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
        const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
        const am = (a0 + a1) / 2, nn = [Math.cos(am), 0, Math.sin(am)];
        for (let y = y0; y < y1 - 1e-4; y += band) {
          const ya = y, yb = Math.min(y1, y + band), v = (yb - ya) / band;
          quad(tex, [p1[0], ya, p1[1]], [p0[0], ya, p0[1]], [p0[0], yb, p0[1]], [p1[0], yb, p1[1]], nn, colour, [[0, 1], [1, 1], [1, 1 - v], [0, 1 - v]]);
        }
      }
    },
    /** One upright face from (x0, z0) to (x1, z1), y0 to y1, facing `n`, in panels a tile across. */
    face(tex, x0, z0, x1, z1, y0, y1, n, colour, { band = 1 } = {}) {
      const L = Math.hypot(x1 - x0, z1 - z0), cols = Math.max(1, Math.round(L));
      for (let i = 0; i < cols; i++) {
        const t0 = i / cols, t1 = (i + 1) / cols;
        const a = [x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0], b = [x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1];
        for (let y = y0; y < y1 - 1e-4; y += band) {
          const ya = y, yb = Math.min(y1, y + band), v = (yb - ya) / band;
          quad(tex, [a[0], ya, a[1]], [b[0], ya, b[1]], [b[0], yb, b[1]], [a[0], yb, a[1]], n, colour, [[0, 1], [1, 1], [1, 1 - v], [0, 1 - v]]);
        }
      }
    },
    /** A box, every side in panels (the top too, if `top`). */
    box(tex, x0, y0, z0, x1, y1, z1, colour, { top = true, band = 1 } = {}) {
      this.face(tex, x0, z0, x1, z0, y0, y1, [0, 0, -1], colour, { band });
      this.face(tex, x1, z1, x0, z1, y0, y1, [0, 0, 1], colour, { band });
      this.face(tex, x0, z1, x0, z0, y0, y1, [-1, 0, 0], colour, { band });
      this.face(tex, x1, z0, x1, z1, y0, y1, [1, 0, 0], colour, { band });
      if (top) {
        for (let x = x0; x < x1 - 1e-4; x += 1) for (let z = z0; z < z1 - 1e-4; z += 1) {
          const xa = x, xb = Math.min(x1, x + 1), za = z, zb = Math.min(z1, z + 1);
          quad(tex, [xa, y1, za], [xa, y1, zb], [xb, y1, zb], [xb, y1, za], [0, 1, 0], colour);
        }
      }
    },
  };
}

/** A lattice mast from (x, z) up `h`, `w` square at the foot and `top` at the head, braced in X's every `step`. */
function lattice(k, x, y, z, w, top, h, step, colour, t = 0.035) {
  const at = (f, i) => {
    const s = (w + (top - w) * f) / 2;
    return [[x - s, z - s], [x + s, z - s], [x + s, z + s], [x - s, z + s]][i];
  };
  for (let i = 0; i < 4; i++) {
    const a = at(0, i), b = at(1, i);
    k.beam([a[0], y, a[1]], [b[0], y + h, b[1]], t * 1.6, colour, { finish: 'shiny' });
  }
  for (let e = 0; e < h - 1e-4; e += step) {
    const f0 = e / h, f1 = Math.min(1, (e + step) / h);
    for (let i = 0; i < 4; i++) {
      const a0 = at(f0, i), b0 = at(f0, (i + 1) % 4), a1 = at(f1, i), b1 = at(f1, (i + 1) % 4);
      k.beam([a0[0], y + e, a0[1]], [b0[0], y + e, b0[1]], t, colour);
      k.beam([a0[0], y + e, a0[1]], [b1[0], y + Math.min(h, e + step), b1[1]], t * 0.8, colour);
      k.beam([b0[0], y + e, b0[1]], [a1[0], y + Math.min(h, e + step), a1[1]], t * 0.8, colour);
    }
  }
}

/** A canvas of words, as a texture; null where there's no document (the tests). */
function words(GFX, lines, { w = 512, h = 256, bg = '#f4f1ea', fg = '#1c1b1a', font = '900 120px', accent = null } = {}) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (accent) accent(ctx, w, h);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const list = lines.split('\n');
  const size = parseInt(font.split(' ')[1], 10);
  ctx.font = `${font} Anton, "Arial Black", Impact, system-ui, sans-serif`;
  list.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + (i - (list.length - 1) / 2) * size * 1.05));
  const t = new GFX.CanvasTexture(c);
  t.colorSpace = GFX.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A sign: a plane with words on it, lit by itself (a neon or a lit box), facing `facing` round y from +z. */
function sign(GFX, texture, at, w, h, facing = 0, glow = 1) {
  const shade = Math.round(120 + 135 * glow).toString(16).padStart(2, '0');
  const m = new GFX.Mesh(new GFX.PlaneGeometry(w, h), new GFX.MeshBasicMaterial({ name: 'sign', map: texture, color: new GFX.Color(texture ? `#${shade}${shade}${shade}` : '#e8e2d6') }));
  m.position.set(...at);
  m.rotation.y = facing;
  return m;
}

const STEEL = '#6a7078', RED = '#c8382c', YELLOW = '#e8b020', WHITE = '#e8e4dc', CONCRETE = '#b0aa9e';

const DRAW = {
  fence(k, t, p, y, map) {
    // Chain-link panels round the top of the bank, galvanised posts every two tiles.
    const S = p.size, i = p.inset / 2;
    const at = (x, z) => Math.min(2.5, Math.max(0, (5 - Math.min(x, z, S - x, S - z)) * 0.5));
    for (const [x0, z0, x1, z1, n] of [[0, i, S, i, [0, 0, 1]], [S, S - i, 0, S - i, [0, 0, -1]], [i, S, i, 0, [1, 0, 0]], [S - i, 0, S - i, S, [-1, 0, 0]]]) {
      const L = Math.hypot(x1 - x0, z1 - z0);
      for (let s = 0; s < L; s += 1) {
        const ax = x0 + ((x1 - x0) * s) / L, az = z0 + ((z1 - z0) * s) / L, bx = x0 + ((x1 - x0) * (s + 1)) / L, bz = z0 + ((z1 - z0) * (s + 1)) / L;
        const ya = at(ax, az);
        t.face('chainlink', ax, az, bx, bz, ya + 0.05, ya + 1.3, n, '#9aa0a8', { band: 1.25 });
        if (s % 2 === 0) k.cyl([ax, ya + 0.7, az], 0.035, 1.4, '#8a9098', { segments: 8, finish: 'shiny' });
      }
      k.beam([x0, 2.5 + 1.32, z0], [x1, 2.5 + 1.32, z1], 0.025, '#8a9098', { finish: 'shiny' });
    }
    void y; void map;
  },

  wall(k, t, p) {
    if (p.tex) {
      const top = p.tex !== 'hedge';
      t.box(p.tex, p.x, p.y0, p.z, p.x1, p.y1, p.z1, p.colour, { top, band: Math.max(0.5, p.y1 - p.y0) });
      if (!top) {
        // A hedge: rounded along the top with leafy lumps.
        for (let x = p.x + 0.2; x < p.x1; x += 0.45) for (let z = p.z + 0.2; z < p.z1; z += 0.45) k.sphere([x, p.y1 - 0.05, z], 0.26, '#3e7a32', { scale: [1, 0.6, 1] });
      }
    } else k.slab(p.x, p.y0, p.z, p.x1, p.y1, p.z1, p.colour, { finish: p.finish });
  },

  chair(k, t, p, y) {
    k.box([p.x, y + 0.22, p.z], [0.5, 0.05, 1.2], '#f4f1ea', { rot: [0.1, 0, 0] });
    k.box([p.x, y + 0.42, p.z - 0.55], [0.5, 0.45, 0.05], '#f4f1ea', { rot: [-0.55, 0, 0] });
    for (let i = -4; i <= 4; i++) k.box([p.x, y + 0.255, p.z + i * 0.12], [0.46, 0.012, 0.06], '#3a8ac8', { rot: [0.1, 0, 0] });
    for (const sx of [-0.22, 0.22]) for (const sz of [-0.5, 0.5]) k.cyl([p.x + sx, y + 0.1, p.z + sz], 0.018, 0.2, '#c8ccd2', { finish: 'shiny' });
  },

  rail(k, t, p, y) {
    k.cyl([p.x + p.length / 2, y + 0.45, p.z], 0.04, p.length, '#c8ccd2', { rot: [0, 0, Math.PI / 2], finish: 'shiny', segments: 12 });
    for (const s of [0.3, p.length - 0.3]) {
      k.cyl([p.x + s, y + 0.22, p.z], 0.03, 0.45, '#8a8f9a', { finish: 'shiny' });
      k.cyl([p.x + s, y + 0.01, p.z], 0.12, 0.02, '#5a6068');
    }
  },

  fountain(k, t, p, y) {
    // A stone basin in tiers, water in each, spilling over.
    k.cyl([p.x, y + 0.2, p.z], [0.32, 0.46], 0.4, '#c8c2b4', { segments: 24 });
    k.cyl([p.x, y + 0.45, p.z], [0.85, 0.6], 0.14, '#c8c2b4', { segments: 28 });
    k.cyl([p.x, y + 0.52, p.z], 0.78, 0.01, '#5aa8d0', { segments: 28, finish: 'glass' });
    k.cyl([p.x, y + 0.75, p.z], 0.1, 0.5, '#c8c2b4', { segments: 12 });
    k.cyl([p.x, y + 1.0, p.z], [0.42, 0.3], 0.1, '#c8c2b4', { segments: 20 });
    k.cyl([p.x, y + 1.05, p.z], 0.38, 0.01, '#5aa8d0', { segments: 20, finish: 'glass' });
    k.cyl([p.x, y + 1.4, p.z], [0.02, 0.06], 0.7, '#bfe6f5', { finish: 'glass', segments: 10 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      k.beam([p.x + Math.cos(a) * 0.4, y + 1.0, p.z + Math.sin(a) * 0.4], [p.x + Math.cos(a) * 0.62, y + 0.55, p.z + Math.sin(a) * 0.62], 0.012, '#d8f0fa', { finish: 'glass' });
    }
  },

  scaffold(k, t, p) {
    const { x, z, w, d, h } = p;
    for (let s = 0; s <= w; s += 2) for (const zz of [z, z + d]) k.cyl([x + s, h / 2 + 0.3, zz], 0.03, h + 0.6, '#9aa0a8', { segments: 8, finish: 'shiny' });
    for (let lv = 1; lv <= h + 0.5; lv += 1) for (const zz of [z, z + d]) k.cyl([x + w / 2, lv, zz], 0.025, w, '#9aa0a8', { rot: [0, 0, Math.PI / 2], segments: 8, finish: 'shiny' });
    for (let s = 0; s < w; s += 2) for (const zz of [z, z + d]) k.beam([x + s, 0.2, zz], [x + s + 2, h, zz], 0.02, '#9aa0a8');
    // Green safety netting down the far side, the boards' toe plates, a hoarding.
    t.face('chainlink', x + w, z + d + 0.02, x, z + d + 0.02, 0.2, h + 0.6, [0, 0, 1], '#3a7a4a', { band: 1.2 });
    k.slab(x, h + 0.6, z - 0.03, x + 4, h + 1.1, z + 0.03, YELLOW);
  },

  crane(k, t, p, y) {
    // A tower crane: a lattice mast, the slewing deck and cab, a long jib, the counter-jib and its weights, the hook.
    const H = 13;
    lattice(k, p.x, y, p.z, 1.2, 1.2, H, 1.2, YELLOW, 0.03);
    t.box('block', p.x - 1, y, p.z - 1, p.x + 1, y + 0.6, p.z + 1, CONCRETE);
    k.slab(p.x - 0.8, y + H, p.z - 0.8, p.x + 0.8, y + H + 0.3, p.z + 0.8, YELLOW, { finish: 'shiny' });
    k.box([p.x + 0.9, y + H + 0.7, p.z + 0.4], [0.9, 0.9, 0.9], '#e8e4dc', { finish: 'shiny' });
    k.box([p.x + 1.36, y + H + 0.8, p.z + 0.4], [0.02, 0.5, 0.75], '#2a3a4a', { finish: 'glass' });
    for (const [x0, x1] of [[-3.5, 0], [0, 10]]) {
      for (const dz of [-0.3, 0.3]) k.beam([p.x + x0, y + H + 0.35, p.z + dz], [p.x + x1, y + H + 0.35, p.z + dz], 0.035, YELLOW, { finish: 'shiny' });
      k.beam([p.x + x0, y + H + 1.0, p.z], [p.x + x1, y + H + 1.0, p.z], 0.035, YELLOW, { finish: 'shiny' });
      for (let s = x0; s < x1; s += 0.8) {
        k.beam([p.x + s, y + H + 0.35, p.z - 0.3], [p.x + s + 0.4, y + H + 1.0, p.z], 0.02, YELLOW);
        k.beam([p.x + s, y + H + 0.35, p.z + 0.3], [p.x + s + 0.4, y + H + 1.0, p.z], 0.02, YELLOW);
      }
    }
    k.beam([p.x, y + H + 2.4, p.z], [p.x + 10, y + H + 1.0, p.z], 0.015, '#2a2c30');
    k.beam([p.x, y + H + 2.4, p.z], [p.x - 3.5, y + H + 1.0, p.z], 0.015, '#2a2c30');
    lattice(k, p.x, y + H + 0.3, p.z, 0.8, 0.2, 2.1, 0.7, YELLOW, 0.025);
    k.box([p.x - 3.1, y + H - 0.1, p.z], [0.8, 1.0, 1.0], '#8a8680');
    k.beam([p.x + 7, y + H + 0.3, p.z], [p.x + 7, y + H - 4.5, p.z], 0.012, '#2a2c30');
    k.box([p.x + 7, y + H - 4.65, p.z], [0.3, 0.25, 0.2], RED, { finish: 'shiny' });
    k.sphere([p.x + 10, y + H + 1.1, p.z], 0.08, '#ff3020', { finish: 'glow' });
    k.sphere([p.x, y + H + 2.5, p.z], 0.08, '#ff3020', { finish: 'glow' });
  },

  canopy(k, t, p, y, map, roof) {
    const { x, z, w, d, h } = p;
    // The roof: a deep white fascia with a red band, lit panels underneath.
    roof.slab(x, h, z, x + w, h + 0.55, z + d, '#eceae4');
    for (const [a, b, c2, d2] of [[x - 0.02, z - 0.02, x + w + 0.02, z + 0.04], [x - 0.02, z + d - 0.04, x + w + 0.02, z + d + 0.02], [x - 0.02, z, x + 0.04, z + d], [x + w - 0.04, z, x + w + 0.02, z + d]]) {
      roof.slab(a, h + 0.14, b, c2, h + 0.4, d2, RED);
    }
    for (let i = 1; i < 5; i++) for (let j = 1; j < 5; j++) roof.slab(x + (w * i) / 5 - 0.5, h - 0.02, z + (d * j) / 5 - 0.3, x + (w * i) / 5 + 0.5, h, z + (d * j) / 5 + 0.3, '#fffbe8', { finish: 'glow' });
    roof.bounds = { x0: x, z0: z, x1: x + w, z1: z + d, y: h };
    for (const [cx, cz] of [[x + 0.25, z + 0.6], [x + w - 0.25, z + 0.6], [x + 0.25, z + d - 0.6], [x + w - 0.25, z + d - 0.6]]) {
      k.cyl([cx, h / 2, cz], 0.16, h, '#e8e4dc', { finish: 'shiny', segments: 16 });
      k.cyl([cx, 0.35, cz], 0.22, 0.7, RED, { segments: 16, finish: 'shiny' });
    }
    for (let i = 1; i < 5; i++) for (let j = 1; j < 5; j++) map.lamp(x + (w * i) / 5, z + (d * j) / 5, { colour: '#f4f6ff', reach: 3.4, height: h - 0.1, y: 0, glow: 0.45 });
  },

  carwash(k, t, p) {
    const { x, z, d } = p;
    // Brushes: tall spinning mops and one over the top, the spray bar, the drip of water.
    for (const s of [1.5, 4]) {
      for (const zz of [0.7, d - 0.7]) {
        k.cyl([x + s, 1.15, z + zz], 0.08, 1.9, '#c8ccd2', { finish: 'shiny', segments: 8 });
        for (let r = 0; r < 6; r++) k.cyl([x + s, 0.35 + r * 0.3, z + zz], 0.4, 0.22, ['#3d8ad0', '#5aa8f0'][r % 2], { segments: 14 });
      }
      k.cyl([x + s, 2.0, z + d / 2], 0.3, d - 1.4, '#5aa8f0', { rot: [Math.PI / 2, 0, 0], segments: 14 });
    }
    k.slab(x + 2.8, 2.05, z, x + 2.9, 2.15, z + d, '#c8ccd2', { finish: 'shiny' });
    for (let i = 0; i < 10; i++) k.cyl([x + 2.85, 2.0, z + 0.3 + i * 0.48], 0.02, 0.1, '#e8f4ff', { finish: 'glass' });
  },

  billboard(k, t, p, y, map) {
    // Two steel legs, a catwalk, the board, the floodlights on it.
    for (const s of [-1.6, 1.6]) {
      k.cyl([p.x, y + 1.8, p.z + s], 0.14, 3.6, '#5a6068', { segments: 12, finish: 'shiny' });
      k.beam([p.x, y + 0.5, p.z + s], [p.x, y + 3.0, p.z - s * 0.4], 0.05, '#5a6068');
    }
    k.slab(p.x - 0.14, y + 3.0, p.z - 2.55, p.x + 0.06, y + 6.0, p.z + 2.55, '#2a2c30');
    k.slab(p.x - 0.6, y + 2.88, p.z - 2.45, p.x - 0.05, y + 2.94, p.z + 2.45, '#5a6068', { finish: 'shiny' });
    for (let s = -2.3; s <= 2.31; s += 0.4) k.cyl([p.x - 0.58, y + 3.2, p.z + s], 0.012, 0.5, '#5a6068');
    for (const s of [-1.5, 0, 1.5]) {
      k.beam([p.x - 0.4, y + 2.95, p.z + s], [p.x - 0.75, y + 3.15, p.z + s], 0.025, '#5a6068');
      k.box([p.x - 0.78, y + 3.18, p.z + s], [0.2, 0.1, 0.24], '#2a2c30');
      k.box([p.x - 0.73, y + 3.24, p.z + s], [0.04, 0.06, 0.2], '#fff4d8', { finish: 'glow' });
      map.lamp(p.x - 0.7, p.z + s, { colour: '#fff0d0', reach: 3.2, height: 3.3, y, glow: 0.8 });
    }
  },

  tunnel(k, t, p) {
    const { x, z, w, d, facing } = p;
    const face = facing > 0 ? z + d : z;
    const n = [0, 0, facing];
    t.box('block', x - 0.8, 0, face - 0.35, x, 3.8, face + 0.35, CONCRETE, { band: 1 });
    t.box('block', x + w, 0, face - 0.35, x + w + 0.8, 3.8, face + 0.35, CONCRETE, { band: 1 });
    t.box('block', x - 0.8, 2.9, face - 0.35, x + w + 0.8, 4.0, face + 0.35, CONCRETE, { band: 1.1 });
    k.slab(x, 0, z, x + w, 2.9, z + d, '#050506');
    k.slab(x - 1, 4.0, face - 0.45, x + w + 1, 4.2, face + 0.45, '#8b877e');
    for (let s = 1; s < w; s += 2.2) k.box([x + s, 2.75, face + n[2] * 0.36], [0.5, 0.08, 0.12], '#ffd88a', { finish: 'glow' });
  },

  trailer(k, t, p) {
    const { x, z, w, d, y } = p;
    t.box('corrugated', x, y + 0.3, z, x + w, y + 1.6, z + d, '#e8e4dc', { band: 1.3 });
    k.slab(x - 0.02, y + 0.95, z - 0.02, x + w + 0.02, y + 1.05, z + d + 0.02, '#2c6ec8');
    k.slab(x + 0.8, y + 0.4, z + d + 0.01, x + 1.4, y + 1.4, z + d + 0.04, '#8a8f9a', { finish: 'shiny' });
    k.slab(x + 2.4, y + 0.85, z + d + 0.01, x + 3.4, y + 1.3, z + d + 0.04, '#ffe6a8', { finish: 'glow' });
    for (const s of [0.3, w - 0.3]) for (const zz of [z + 0.2, z + d - 0.2]) k.box([x + s, y + 0.15, zz], [0.3, 0.3, 0.3], '#7a7f86');
    k.slab(x + 0.6, y, z + d, x + 1.6, y + 0.3, z + d + 0.6, '#8a6a42');
    k.box([x + 1.1, y + 1.5, z + d + 0.05], [0.18, 0.1, 0.06], '#ffe8b0', { finish: 'glow' });
  },

  pipeline(k, t, p) {
    const { x, z, to, h } = p;
    // A fat pipe under the walkway, flanged every few tiles, on legs, with a handrail along one side.
    const x0 = x + 6;
    k.cyl([(x0 + to) / 2, h - 0.4, z + 0.5], 0.36, to - x0, '#8a9098', { rot: [0, 0, Math.PI / 2], finish: 'shiny', segments: 20 });
    for (let s = x0 + 1; s < to; s += 3) {
      k.torus([s, h - 0.4, z + 0.5], 0.38, 0.05, '#5a6068', { rot: [0, Math.PI / 2, 0], finish: 'shiny' });
      k.beam([s, 0, z + 0.15], [s, h - 0.6, z + 0.35], 0.05, '#4a4e56');
      k.beam([s, 0, z + 0.85], [s, h - 0.6, z + 0.65], 0.05, '#4a4e56');
    }
  },

  derrick(k, t, p) {
    const { x, z, w, d, y, top } = p;
    const H = top - y + 7;
    // The mast: red and white, tapering, braced; the crown block, a red light; rails round the deck; the lift's guide rails.
    lattice(k, x + w / 2, y, z + d / 2, w, 1.2, H, 1.5, RED, 0.045);
    lattice(k, x + w / 2, y + 0.75, z + d / 2, w * 0.98, 1.22, H - 0.75, 1.5, WHITE, 0.02);
    k.slab(x + w / 2 - 0.75, y + H, z + d / 2 - 0.75, x + w / 2 + 0.75, y + H + 0.4, z + d / 2 + 0.75, '#3a3d44');
    k.sphere([x + w / 2, y + H + 0.6, z + d / 2], 0.16, '#ff3020', { finish: 'glow' });
    for (const [a, b] of [[[x, z], [x + w, z]], [[x + w, z], [x + w, z + d]], [[x, z + d], [x + w, z + d]]]) {
      for (const hh of [0.25, 0.5]) k.beam([a[0], top + hh, a[1]], [b[0], top + hh, b[1]], 0.025, YELLOW, { finish: 'shiny' });
      for (let s = 0; s <= 1; s += 0.25) k.cyl([a[0] + (b[0] - a[0]) * s, top + 0.25, a[1] + (b[1] - a[1]) * s], 0.02, 0.5, YELLOW);
    }
    for (const s of [0, 2]) k.cyl([x - 2 + s, (y + top) / 2 + 0.3, z + 0.9], 0.05, top - y + 1, '#5a6068', { segments: 8, finish: 'shiny' });
    k.slab(x - 2.2, top + 0.6, z + 0.7, x + 0.2, top + 0.7, z + 3.3, '#5a6068');
  },

  gate(k, t, p, y) {
    for (const s of [-0.3, p.w + 0.3]) {
      k.box([p.x + s, y + 0.7, p.z], [0.3, 1.4, 0.3], '#e8e2d6');
      k.box([p.x + s, y + 1.42, p.z], [0.36, 0.06, 0.36], RED);
    }
    k.box([p.x - 1.2, y + 0.9, p.z + 0.2], [1.1, 1.8, 1.2], '#e8e4dc', { finish: 'shiny' });
    k.box([p.x - 0.64, y + 1.2, p.z + 0.2], [0.02, 0.6, 0.9], '#ffe6b0', { finish: 'glow' });
    k.box([p.x - 1.2, y + 1.85, p.z + 0.2], [1.3, 0.1, 1.4], RED);
    // The barrier arm, up.
    k.box([p.x - 0.1, y + 2.0, p.z], [0.1, 2.2, 0.1], '#f4f1ea', { rot: [0, 0, -0.2] });
    for (let i = 0; i < 4; i++) k.box([p.x - 0.1 + Math.sin(0.2) * (i * 0.5 - 0.6), y + 1.4 + i * 0.5, p.z], [0.11, 0.2, 0.11], RED, { rot: [0, 0, -0.2] });
  },

  tank(k, t, p, y, map) {
    const { x, z, r, h, colour } = p;
    // Welded plates all round, a shallow domed roof, a handrail round its rim, a ladder cage up the side, a band of colour.
    t.cylinder('tankshell', x, z, r, 0, h, colour, { band: 1 });
    const seg = 40;
    for (let i = 0; i < 6; i++) k.cyl([x, h + 0.02 + i * 0.03, z], r * (1 - i * 0.12), 0.04, '#b8bec6', { segments: seg });
    k.torus([x, h, z], r, 0.06, '#9aa0a8', { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < Math.round(r * 6); i++) {
      const a = (i / Math.round(r * 6)) * TAU;
      k.cyl([x + Math.cos(a) * r * 0.97, h + 0.3, z + Math.sin(a) * r * 0.97], 0.02, 0.6, YELLOW, { segments: 4 });
    }
    k.torus([x, h + 0.6, z], r * 0.97, 0.025, YELLOW, { rot: [Math.PI / 2, 0, 0] });
    k.cyl([x, h * 0.62, z], r * 1.006, 0.5, RED, { segments: seg, open: true });
    const lx = x - r - 0.12;
    for (const s of [-0.24, 0.24]) k.cyl([lx, h / 2, z + s], 0.025, h, '#5a6068', { segments: 6 });
    for (let yy = 0.3; yy < h; yy += 0.32) k.cyl([lx, yy, z], 0.014, 0.48, '#5a6068', { rot: [Math.PI / 2, 0, 0], segments: 4 });
    for (let yy = 2; yy < h; yy += 0.6) k.torus([lx - 0.2, yy, z], 0.32, 0.015, '#5a6068', { rot: [Math.PI / 2, 0, 0] });
    map.lamp(x - r - 0.3, z, { colour: '#ffcf8a', reach: 4.5, height: Math.min(h, 3.2), y: 0, glow: 0.7 });
    void y;
  },

  catwalk(k, t, p) {
    const { x, z, w, h } = p;
    for (let s = x + 0.5; s < x + w; s += 3) {
      k.beam([s, 0, z + 0.1], [s, h - 0.05, z + 0.5], 0.05, STEEL);
      k.beam([s, 0, z + 0.9], [s, h - 0.05, z + 0.5], 0.05, STEEL);
    }
    for (const side of [0.05, 0.95]) {
      k.cyl([x + w / 2, h + 0.55, z + side], 0.025, w, YELLOW, { rot: [0, 0, Math.PI / 2], finish: 'shiny' });
      k.cyl([x + w / 2, h + 0.28, z + side], 0.018, w, YELLOW, { rot: [0, 0, Math.PI / 2] });
      for (let s = x; s <= x + w; s += 1.5) k.cyl([s, h + 0.28, z + side], 0.02, 0.56, YELLOW);
    }
  },

  stack(k, t, p, y, map) {
    t.cylinder('tankshell', p.x, p.z, 0.7, 0, p.h, '#c8c2b4', { band: 1 });
    for (let s = 1.5; s < p.h; s += 2.5) k.torus([p.x, y + s, p.z], 0.74, 0.05, RED, { rot: [Math.PI / 2, 0, 0] });
    for (let s = 0.4; s < p.h; s += 0.4) k.cyl([p.x - 0.8, y + s, p.z], 0.012, 0.36, '#5a6068', { rot: [Math.PI / 2, 0, 0] });
    k.cyl([p.x, y + p.h + 0.15, p.z], 0.75, 0.3, '#3a3d44');
    map.lamp(p.x, p.z, { colour: '#ff9a3a', reach: 9, height: p.h + 1, y, glow: 1.4 });
  },

  piperack(k, t, p) {
    const { x, z, to } = p;
    for (let s = x + 0.5; s < to; s += 5) {
      for (const dz of [-0.75, 0.75]) k.cyl([s, 1.7, z + dz], 0.08, 3.4, STEEL, { segments: 8, finish: 'shiny' });
      k.slab(s - 0.1, 3.3, z - 0.85, s + 0.1, 3.45, z + 0.85, STEEL);
      k.beam([s, 2.4, z - 0.75], [s, 3.3, z], 0.04, STEEL);
    }
    const cols = ['#c8c2b4', RED, YELLOW, '#3a7a3a', '#2a5aa8'];
    for (let i = 0; i < 5; i++) {
      k.cyl([(x + to) / 2, 3.6, z - 0.64 + i * 0.32], 0.13, to - x, cols[i], { rot: [0, 0, Math.PI / 2], finish: 'shiny', segments: 12 });
      for (let s = x + 2; s < to; s += 4) k.torus([s, 3.6, z - 0.64 + i * 0.32], 0.15, 0.025, '#5a6068', { rot: [0, Math.PI / 2, 0] });
    }
  },

  sphere(k, t, p, y) {
    k.sphere([p.x, y + p.r + 1.2, p.z], p.r, '#e8e4dc', { finish: 'shiny' });
    k.torus([p.x, y + p.r + 1.2, p.z], p.r * 1.003, 0.05, '#b8bec6', { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      k.cyl([p.x + Math.cos(a) * p.r * 0.82, y + 1.0, p.z + Math.sin(a) * p.r * 0.82], 0.14, 2.0, STEEL, { segments: 8 });
    }
    k.beam([p.x + p.r * 0.9, y, p.z], [p.x + 0.3, y + p.r * 2 + 1.2, p.z], 0.04, '#5a6068');
  },

  valves(k, t, p, y) {
    const L = p.length ?? 3;
    k.cyl([p.x, y + 0.5, p.z], 0.13, 1, STEEL, { segments: 12, finish: 'shiny' });
    for (const yy of [0.2, 0.55, 0.85]) k.cyl([p.x, y + yy, p.z], 0.2, 0.05, '#5a6068', { segments: 14, finish: 'shiny' });
    k.cyl([p.x, y + 0.6, p.z + L / 2], 0.1, L, '#c8c2b4', { rot: [Math.PI / 2, 0, 0], finish: 'shiny', segments: 12 });
    k.torus([p.x, y + 1.08, p.z], 0.18, 0.03, RED, { rot: [Math.PI / 2, 0, 0] });
    k.beam([p.x - 0.18, y + 1.08, p.z], [p.x + 0.18, y + 1.08, p.z], 0.02, RED);
    k.box([p.x, y + 0.6, p.z + L], [0.3, 0.3, 0.3], '#8a8f9a', { finish: 'shiny' });
  },

  cylinders(k, t, p, y) {
    for (let i = 0; i < 4; i++) {
      const c = ['#3a7a3a', '#e8e2d6', RED, '#2a5aa8'][i];
      const cx = p.x + (i % 2) * 0.32, cz = p.z + Math.floor(i / 2) * 0.32;
      k.cyl([cx, y + 0.45, cz], 0.13, 0.9, c, { segments: 14, finish: 'shiny' });
      k.sphere([cx, y + 0.9, cz], 0.13, c, { finish: 'shiny' });
      k.cyl([cx, y + 1.05, cz], 0.04, 0.12, '#c8ccd2', { finish: 'shiny' });
    }
    t.box('chainlink', p.x - 0.25, y, p.z - 0.25, p.x + 0.57, y + 1.1, p.z + 0.57, '#8a9098', { top: false, band: 1.1 });
  },

  sign(k, t, p, y) {
    k.cyl([p.x, y + 0.6, p.z + 0.5], 0.04, 1.2, '#5a6068', { segments: 8 });
  },

  shop() {},
};

/** Words for the structures that carry them. */
const WORDS = {
  billboard(GFX, p, y) {
    const tex = words(GFX, 'PETROLL\nRoll on in', {
      w: 1024, h: 600, bg: '#f4c430', fg: '#1c1b1a', font: '400 190px',
      accent(ctx, w, h) {
        ctx.fillStyle = '#c8382c';
        ctx.fillRect(0, h * 0.8, w, h * 0.2);
        ctx.fillStyle = '#f4f1ea';
        ctx.font = '400 66px Anton, "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("GAS 'N' GO · NEXT LEFT", w / 2, h * 0.91);
      },
    });
    return [sign(GFX, tex, [p.x - 0.15, y + 4.5, p.z], 4.95, 2.95, -Math.PI / 2, 0.75)];
  },
  shop(GFX, p) {
    const tex = words(GFX, "GAS 'N' GO · OPEN 24 HRS", { w: 1024, h: 120, bg: '#c8402e', fg: '#fff6e0', font: '400 84px' });
    return [sign(GFX, tex, [p.x + p.w / 2, p.h - 0.3, p.z - 0.04], p.w * 0.94, 0.42, Math.PI, 1)];
  },
  sign(GFX, p, y) {
    const tex = words(GFX, p.text, { w: 256, h: 192, bg: '#f2c230', fg: '#1c1b1a', font: '400 76px' });
    return [sign(GFX, tex, [p.x - 0.05, y + 1.15, p.z + 0.5], 0.8, 0.6, -Math.PI / 2, 0.5)];
  },
  canopy(GFX, p) {
    const tex = words(GFX, 'PETROLL  ·  REGULAR 2.99  ·  DIESEL 3.19', { w: 1536, h: 96, bg: '#c8382c', fg: '#fff6e0', font: '400 70px' });
    return [sign(GFX, tex, [p.x + p.w / 2, p.h + 0.27, p.z + p.d + 0.04], p.w * 0.96, 0.26, 0, 1)];
  },
  carwash(GFX, p) {
    const tex = words(GFX, 'CAR WASH', { w: 512, h: 96, bg: '#2c74b8', fg: '#f4f1ea', font: '400 76px' });
    return [sign(GFX, tex, [p.x - 0.29, 2.35, p.z + p.d / 2], 3.2, 0.24, -Math.PI / 2, 1)];
  },
  tank(GFX, p) {
    if (p.r < 5) return [];
    const tex = words(GFX, 'PETROLL', { w: 768, h: 160, bg: '#e8e4dc', fg: '#c8382c', font: '400 140px' });
    return [sign(GFX, tex, [p.x + p.r * 0.71 + 0.03, p.h * 0.4, p.z + p.r * 0.71 + 0.03], 3.6, 0.75, Math.PI / 4, 0.5)];
  },
};

/**
 * The structures, drawn: one kit for the steelwork, the textured panels by
 * texture, the signs, and the roofs (each its own, to fade while the
 * hamster is under it). Lights some of them carry go onto the map.
 */
export function drawStructures(GFX, map, light) {
  // The steelwork in a kit for each 24-tile square of the map, so what's out of view isn't drawn.
  const kits = new Map();
  const kitAt = (x, z) => {
    const key = `${Math.floor(x / 24)},${Math.floor(z / 24)}`;
    if (!kits.has(key)) kits.set(key, createKit(GFX));
    return kits.get(key);
  };
  const t = panels(light);
  const extras = [], roofs = [];
  // The lights are on the map already (`structureLights`): drawing doesn't add them again.
  const quiet = Object.create(map);
  quiet.lamp = () => quiet;
  map.props.forEach((p) => {
    const draw = DRAW[p.type];
    if (!draw) throw new Error(`no structure called ${p.type}`);
    const y = p.y ?? map.heightAt(p.x, p.z) ?? 0;
    const roof = createKit(GFX);
    // The fence goes all the way round: it gets a kit of its own.
    draw(p.type === 'fence' ? kitAt(-100, -100) : kitAt(p.x, p.z), t, p, y, quiet, roof);
    if (!roof.empty) roofs.push(roof);
    if (WORDS[p.type]) extras.push(...WORDS[p.type](GFX, p, y));
  });
  const group = new GFX.Group();
  group.name = 'structures';
  for (const k of kits.values()) if (!k.empty) group.add(k.build({ name: 'steelwork' }));
  for (const [tex, parts] of t.layers) {
    const g = new GFX.BufferGeometry();
    g.setAttribute('position', new GFX.BufferAttribute(new Float32Array(parts.position), 3));
    g.setAttribute('normal', new GFX.BufferAttribute(new Float32Array(parts.normal), 3));
    g.setAttribute('color', new GFX.BufferAttribute(new Float32Array(parts.color), 3));
    g.setAttribute('uv', new GFX.BufferAttribute(new Float32Array(parts.uv), 2));
    g.computeBoundingSphere();
    const mesh = new GFX.Mesh(g, wallMaterial(GFX, tex));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = `panels-${tex}`;
    group.add(mesh);
  }
  for (const e of extras) group.add(e);
  return { group, roofs };
}

/** The lights the structures carry, put on the map before it is built (so they are baked into the ground). */
export function structureLights(map) {
  const dummy = { slab() {}, box() {}, cyl() {}, cone() {}, sphere() {}, torus() {}, beam() {}, get empty() { return true; } };
  const t = { cylinder() {}, face() {}, box() {} };
  for (const p of map.props) {
    if (!['canopy', 'billboard', 'tank', 'stack'].includes(p.type)) continue;
    const y = p.y ?? map.heightAt(p.x, p.z) ?? 0;
    DRAW[p.type](dummy, t, p, y, map, dummy);
  }
}

export const STRUCTURES = Object.keys(DRAW);
