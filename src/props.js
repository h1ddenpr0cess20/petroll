/**
 * The furniture of the town, built from plain shapes into a kit
 * (`kit.js`): every prop the map lists (`map.props`), drawn where it
 * stands. Their solid parts are on the map already (`map.solids`); this is
 * only how they look. A few carry words — the billboard, the shop sign, the
 * danger sign — and those come back as their own meshes.
 */

const TAU = Math.PI * 2;

/** A seeded random, so the same town is drawn every time. */
function random(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

/** A canvas with words on it, as a texture; null where there's no document (the tests). */
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
  ctx.font = `${font} "Arial Black", Impact, system-ui, sans-serif`;
  list.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + (i - (list.length - 1) / 2) * size * 1.05));
  const t = new GFX.CanvasTexture(c);
  t.colorSpace = GFX.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A flat panel with a texture on it, facing `facing` radians round y from +z. */
function panel(GFX, texture, at, w, h, facing = 0, glow = 0.35) {
  // Lit by itself, a little dimmed, so the words read at dusk without glaring.
  const shade = Math.round(150 + 105 * glow).toString(16).padStart(2, '0');
  const m = new GFX.Mesh(new GFX.PlaneGeometry(w, h), new GFX.MeshBasicMaterial({
    name: 'sign', map: texture, color: new GFX.Color(texture ? `#${shade}${shade}${shade}` : '#e8e2d6'),
  }));
  m.position.set(...at);
  m.rotation.y = facing;
  m.receiveShadow = true;
  return m;
}

const DRAW = {
  tree(k, p, y, rnd) {
    const s = p.size ?? 1;
    k.cyl([p.x, y + 0.6 * s, p.z], [0.07 * s, 0.11 * s], 1.2 * s, '#5a3d26', { segments: 8 });
    const greens = ['#3f7a34', '#4f8a3a', '#5a9a42', '#36702e'];
    for (let i = 0; i < 6; i++) {
      const a = rnd() * TAU, r = (0.2 + rnd() * 0.35) * s;
      k.sphere([p.x + Math.cos(a) * r, y + (1.25 + rnd() * 0.6) * s, p.z + Math.sin(a) * r], (0.42 + rnd() * 0.2) * s, greens[i % 4], { scale: [1, 0.85, 1] });
    }
    k.sphere([p.x, y + 1.85 * s, p.z], 0.45 * s, greens[2]);
  },

  lamp(k, p, y) {
    k.cyl([p.x, y + 1.6, p.z], [0.04, 0.06], 3.2, '#3a3d44', { segments: 8, finish: 'shiny' });
    k.beam([p.x, y + 3.15, p.z], [p.x + 0.7, y + 3.25, p.z + 0.7], 0.035, '#3a3d44');
    k.box([p.x + 0.75, y + 3.2, p.z + 0.75], [0.36, 0.08, 0.2], '#2a2c30', { rot: [0, -Math.PI / 4, 0] });
    k.box([p.x + 0.75, y + 3.15, p.z + 0.75], [0.3, 0.02, 0.14], '#fff0c8', { rot: [0, -Math.PI / 4, 0], finish: 'glow' });
  },

  house(k, p, y0, rnd) {
    const { x, z, w, d, h, wall, ridge, door } = p;
    const base = 0.15;
    const win = '#2c3a4a', frame = '#f4f1ea';
    // Windows along each wall, with white frames and shutters.
    const along = (len) => { const out = []; for (let t = 1; t < len; t += 1.6) out.push(t); return out; };
    const shutter = ['#3a5a3a', '#5a3a2a', '#2a4a6a', '#6a2a2a'][Math.floor(rnd() * 4)];
    for (const t of along(w)) {
      for (const [zz, s] of [[z, -1], [z + d, 1]]) {
        const isDoor = Math.abs(t - w / 2) < 0.6 && ((door === 'n' && s < 0) || (door === 's' && s > 0));
        if (isDoor) continue;
        k.box([x + t, base + 1.0, zz + s * 0.02], [0.62, 0.72, 0.04], frame);
        k.box([x + t, base + 1.0, zz + s * 0.04], [0.5, 0.6, 0.02], win, { finish: 'glass' });
        k.box([x + t - 0.4, base + 1.0, zz + s * 0.03], [0.14, 0.7, 0.03], shutter);
        k.box([x + t + 0.4, base + 1.0, zz + s * 0.03], [0.14, 0.7, 0.03], shutter);
      }
    }
    for (const t of along(d)) {
      for (const [xx, s] of [[x, -1], [x + w, 1]]) {
        k.box([xx + s * 0.02, base + 1.0, z + t], [0.04, 0.72, 0.62], frame);
        k.box([xx + s * 0.04, base + 1.0, z + t], [0.02, 0.6, 0.5], win, { finish: 'glass' });
      }
    }
    // The front door, a step and a porch light.
    const dz = door === 'n' ? z : z + d, s = door === 'n' ? -1 : 1;
    k.box([x + w / 2, base + 0.62, dz + s * 0.03], [0.62, 1.2, 0.05], ['#8a2a1e', '#2a4a7a', '#3a5a3a'][Math.floor(rnd() * 3)]);
    k.box([x + w / 2 + 0.2, base + 0.6, dz + s * 0.06], [0.05, 0.05, 0.03], '#d8b040', { finish: 'shiny' });
    k.box([x + w / 2, base + 0.06, dz + s * 0.3], [1.1, 0.12, 0.6], '#bdb8ab');
    k.box([x + w / 2 + 0.55, base + 1.45, dz + s * 0.06], [0.1, 0.16, 0.06], '#ffe8b0', { finish: 'glow' });
    // Eaves: a fascia board round the roof edge.
    k.slab(x - 0.06, h - 0.08, z - 0.06, x + w + 0.06, h + 0.02, z + d + 0.06, '#f4f1ea');
    // A chimney.
    const cx = x + w * 0.25, cz = z + d * 0.3;
    k.box([cx, h + 0.7, cz], [0.42, 1.4, 0.42], '#8a4a3a');
    k.box([cx, h + 1.42, cz], [0.5, 0.06, 0.5], '#6a3a2a');
    void y0; void ridge; void wall;
  },

  wall(k, p) {
    k.slab(p.x, p.y0, p.z, p.x1, p.y1, p.z1, p.colour, { finish: p.finish });
  },

  mailbox(k, p, y) {
    k.cyl([p.x, y + 0.45, p.z], 0.03, 0.9, '#5a3d26', { segments: 6 });
    k.box([p.x, y + 0.98, p.z], [0.22, 0.2, 0.36], '#2a3a5a', { finish: 'shiny' });
    k.box([p.x + 0.13, y + 1.08, p.z - 0.05], [0.02, 0.16, 0.06], '#c8382c');
  },

  chair(k, p, y) {
    k.box([p.x, y + 0.2, p.z], [0.5, 0.06, 1.2], '#f4f1ea', { rot: [0.1, 0, 0] });
    k.box([p.x, y + 0.45, p.z - 0.55], [0.5, 0.5, 0.06], '#f4f1ea', { rot: [-0.5, 0, 0] });
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.5, 0.5]) k.cyl([p.x + sx, y + 0.1, p.z + sz], 0.02, 0.2, '#c8ccd2');
  },

  rail(k, p, y) {
    k.cyl([p.x + p.length / 2, y + 0.45, p.z], 0.04, p.length, '#c8ccd2', { rot: [0, 0, Math.PI / 2], finish: 'shiny' });
    for (const t of [0.3, p.length - 0.3]) k.cyl([p.x + t, y + 0.22, p.z], 0.03, 0.45, '#8a8f9a');
  },

  tower(k, p) {
    const { x, z, w, d, h, glass } = p;
    // Bands of windows floor by floor, mullions between, a parapet on top.
    for (let f = 0.9; f < h - 0.4; f += 0.9) {
      for (const [zz, s] of [[z, -1], [z + d, 1]]) k.slab(x + 0.15, f - 0.3, zz + s * 0.03 - 0.015, x + w - 0.15, f + 0.25, zz + s * 0.03 + 0.015, glass, { finish: 'glass' });
      for (const [xx, s] of [[x, -1], [x + w, 1]]) k.slab(xx + s * 0.03 - 0.015, f - 0.3, z + 0.15, xx + s * 0.03 + 0.015, f + 0.25, z + d - 0.15, glass, { finish: 'glass' });
    }
    for (let t = 0.8; t < w; t += 0.8) for (const [zz, s] of [[z, -1], [z + d, 1]]) k.slab(x + t - 0.03, 0.5, zz + s * 0.05 - 0.02, x + t + 0.03, h - 0.3, zz + s * 0.05 + 0.02, '#c8ccd2');
    for (let t = 0.8; t < d; t += 0.8) for (const [xx, s] of [[x, -1], [x + w, 1]]) k.slab(xx + s * 0.05 - 0.02, 0.5, z + t - 0.03, xx + s * 0.05 + 0.02, h - 0.3, z + t + 0.03, '#c8ccd2');
    k.slab(x - 0.04, h, z - 0.04, x + w + 0.04, h + 0.25, z + 0.12, '#c8ccd2');
    k.slab(x - 0.04, h, z + d - 0.12, x + w + 0.04, h + 0.25, z + d + 0.04, '#c8ccd2');
    k.slab(x - 0.04, h, z, x + 0.12, h + 0.25, z + d, '#c8ccd2');
    k.slab(x + w - 0.12, h, z, x + w + 0.04, h + 0.25, z + d, '#c8ccd2');
    // Plant on the roof.
    k.box([x + w * 0.35, h + 0.45, z + d * 0.4], [1.2, 0.9, 0.9], '#9aa0aa');
    k.cyl([x + w * 0.7, h + 0.3, z + d * 0.7], 0.3, 0.6, '#8a8f9a');
    k.sphere([x + w * 0.7, h + 0.32, z + d * 0.7], 0.06, '#ff3020', { finish: 'glow' });
  },

  dumpster(k, p, y) {
    // Against the wall, along x: a lidded bin on castors.
    const c = p.colour ?? '#3a7a3a';
    k.box([p.x, y + 0.42, p.z], [1.4, 0.8, 0.8], c, { finish: 'shiny' });
    k.box([p.x, y + 0.85, p.z - 0.02], [1.44, 0.06, 0.86], '#2a2c30', { rot: [0.1, 0, 0] });
    for (const sx of [-0.55, 0.55]) k.cyl([p.x + sx, y + 0.05, p.z], 0.05, 0.6, '#18181b', { rot: [Math.PI / 2, 0, 0] });
  },

  garage(k, p) {
    const { x, z, w, d, h } = p;
    // The concrete core under the roof deck: bays with stripes, columns, a sign.
    for (let t = 1; t < w; t += 2.5) for (const zz of [z, z + d]) k.slab(x + t - 0.15, 0, zz - 0.15, x + t + 0.15, h, zz + 0.15, '#bdb8ab');
    for (let t = 0.5; t < w - 0.4; t += 1) k.slab(x + t, h + 0.005, z + 0.4, x + t + 0.06, h + 0.01, z + 2.4, '#f4f1ea');
    for (let t = 0.5; t < w - 0.4; t += 1) k.slab(x + t, h + 0.005, z + d - 2.4, x + t + 0.06, h + 0.01, z + d - 0.4, '#f4f1ea');
    k.slab(x + 1, h - 0.9, z + d + 0.02, x + 4, h - 0.3, z + d + 0.06, '#2c6ec8');
    k.slab(x + 1.2, h - 0.8, z + d + 0.05, x + 1.6, h - 0.4, z + d + 0.08, '#f4f1ea');
    for (const [lx, lz] of [[x + 1, z + 1], [x + w - 1, z + 1], [x + 1, z + d - 1], [x + w - 1, z + d - 1]]) {
      k.cyl([lx, h + 1, lz], 0.04, 2, '#5a6068');
      k.box([lx, h + 2.02, lz], [0.3, 0.06, 0.18], '#fff0c8', { finish: 'glow' });
    }
  },

  parked(k, p, y) {
    const c = p.colour;
    const yy = p.y ?? y;
    k.slab(p.x - 0.47, yy + 0.18, p.z - 0.95, p.x + 0.47, yy + 0.52, p.z + 0.95, c, { finish: 'shiny' });
    k.slab(p.x - 0.4, yy + 0.52, p.z - 0.5, p.x + 0.4, yy + 0.82, p.z + 0.3, c, { finish: 'shiny' });
    k.slab(p.x - 0.42, yy + 0.55, p.z - 0.45, p.x + 0.42, yy + 0.78, p.z + 0.25, '#26303c', { finish: 'glass' });
    for (const sx of [-0.43, 0.43]) for (const sz of [-0.6, 0.6]) k.cyl([p.x + sx, yy + 0.19, p.z + sz], 0.19, 0.14, '#18181b', { rot: [0, 0, Math.PI / 2] });
  },

  fountain(k, p, y) {
    k.cyl([p.x, y + 0.2, p.z], [0.35, 0.5], 0.8, '#c8c2b4', { segments: 16 });
    k.cyl([p.x, y + 0.65, p.z], 0.75, 0.1, '#c8c2b4', { segments: 20 });
    k.cyl([p.x, y + 0.9, p.z], 0.12, 0.5, '#c8c2b4');
    k.cone([p.x, y + 1.35, p.z], 0.35, 0.5, '#bfe6f5', { finish: 'glass' });
  },

  statue(k, p, y) {
    k.box([p.x, y + 0.5, p.z], [1.1, 1.0, 1.1], '#bdb8ab');
    k.box([p.x, y + 1.02, p.z], [1.2, 0.06, 1.2], '#a7a39a');
    // A bronze hamster, on its hind legs, one paw raised.
    const b = '#8a6a32';
    k.sphere([p.x, y + 1.35, p.z], 0.3, b, { scale: [1, 1.15, 0.95], finish: 'shiny' });
    k.sphere([p.x, y + 1.78, p.z + 0.04], 0.22, b, { finish: 'shiny' });
    for (const s of [-1, 1]) {
      k.sphere([p.x + s * 0.14, y + 1.98, p.z], 0.07, b, { scale: [1, 1, 0.4], finish: 'shiny' });
      k.sphere([p.x + s * 0.13, y + 1.7, p.z + 0.12], 0.1, b, { finish: 'shiny' });
    }
    k.beam([p.x + 0.2, y + 1.5, p.z + 0.1], [p.x + 0.3, y + 2.15, p.z + 0.15], 0.05, b, { finish: 'shiny' });
  },

  bench(k, p, y) {
    k.slab(p.x - 0.8, y + 0.4, p.z - 0.2, p.x + 0.8, y + 0.46, p.z + 0.2, '#8a5a32');
    k.slab(p.x - 0.8, y + 0.5, p.z + 0.16, p.x + 0.8, y + 0.85, p.z + 0.22, '#8a5a32');
    for (const sx of [-0.65, 0.65]) k.slab(p.x + sx - 0.04, y, p.z - 0.18, p.x + sx + 0.04, y + 0.42, p.z + 0.18, '#2a2c30');
  },

  scaffold(k, p) {
    const { x, z, w, d, h } = p;
    for (let t = 0; t <= w; t += 2) for (const zz of [z, z + d]) k.cyl([x + t, h / 2, zz], 0.035, h + 0.6, '#8a8f9a', { segments: 6 });
    for (let lv = 1; lv <= h; lv += 1) {
      for (const zz of [z, z + d]) k.cyl([x + w / 2, lv, zz], 0.03, w, '#8a8f9a', { rot: [0, 0, Math.PI / 2], segments: 6 });
    }
    for (let t = 0; t < w; t += 2) k.beam([x + t, 0.2, z], [x + t + 2, h, z], 0.025, '#8a8f9a');
    k.slab(x, h + 0.6, z - 0.02, x + 4, h + 1.1, z + 0.02, '#f2c230');
  },

  crane(k, p, y) {
    const H = 13;
    for (let t = 0; t < H; t += 1) {
      for (const [a, b] of [[[-0.4, -0.4], [0.4, -0.4]], [[0.4, -0.4], [0.4, 0.4]], [[0.4, 0.4], [-0.4, 0.4]], [[-0.4, 0.4], [-0.4, -0.4]]]) {
        k.beam([p.x + a[0], y + t, p.z + a[1]], [p.x + b[0], y + t + 1, p.z + b[1]], 0.025, '#f2c230');
      }
    }
    for (const sx of [-0.4, 0.4]) for (const sz of [-0.4, 0.4]) k.cyl([p.x + sx, y + H / 2, p.z + sz], 0.05, H, '#f2c230', { segments: 6 });
    k.slab(p.x - 3, y + H, p.z - 0.3, p.x + 9, y + H + 0.6, p.z + 0.3, '#f2c230');
    k.box([p.x - 2.5, y + H - 0.2, p.z], [1.2, 0.9, 1], '#bdb8ab');
    k.box([p.x + 0.9, y + H + 0.2, p.z], [1.2, 1.2, 1], '#3a3d44');
    k.beam([p.x + 7, y + H, p.z], [p.x + 7, y + H - 5, p.z], 0.015, '#2a2c30');
    k.box([p.x + 7, y + H - 5.2, p.z], [0.3, 0.3, 0.3], '#c8382c');
  },

  cone(k, p, y) {
    k.box([p.x, y + 0.02, p.z], [0.36, 0.04, 0.36], '#e07a2a');
    k.cone([p.x, y + 0.3, p.z], 0.14, 0.52, '#f07a2a');
    k.cyl([p.x, y + 0.32, p.z], [0.075, 0.095], 0.1, '#f4f1ea');
  },

  pump(k, p, y) {
    const yy = 0.2;
    k.box([p.x, yy + 0.65, p.z], [0.55, 1.3, 0.75], '#e8e2d6', { finish: 'shiny' });
    k.box([p.x, yy + 1.2, p.z], [0.58, 0.2, 0.78], '#c8382c', { finish: 'shiny' });
    for (const s of [-1, 1]) {
      k.box([p.x + s * 0.285, yy + 0.85, p.z], [0.02, 0.3, 0.4], '#1c2a1c');
      k.box([p.x + s * 0.29, yy + 0.88, p.z], [0.01, 0.06, 0.3], '#7aff9a', { finish: 'glow' });
      k.box([p.x + s * 0.31, yy + 0.5, p.z + 0.2], [0.06, 0.18, 0.08], '#2a2c30');
      k.beam([p.x + s * 0.31, yy + 0.45, p.z + 0.2], [p.x + s * 0.4, yy + 0.05, p.z + 0.4], 0.02, '#18181b');
    }
    void y;
  },

  canopy(k, p, y, rnd, roof) {
    const { x, z, w, d, h } = p;
    roof.slab(x, h, z, x + w, h + 0.45, z + d, '#e8e4dc');
    // The red band round its edge.
    for (const [a, b, c2, d2] of [[x - 0.02, z - 0.02, x + w + 0.02, z + 0.04], [x - 0.02, z + d - 0.04, x + w + 0.02, z + d + 0.02], [x - 0.02, z, x + 0.04, z + d], [x + w - 0.04, z, x + w + 0.02, z + d]]) {
      roof.slab(a, h + 0.12, b, c2, h + 0.34, d2, '#c8382c');
    }
    for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) roof.slab(x + (w * i) / 4 - 0.4, h - 0.02, z + (d * j) / 4 - 0.25, x + (w * i) / 4 + 0.4, h, z + (d * j) / 4 + 0.25, '#fffbe8', { finish: 'glow' });
    roof.bounds = { x0: x, z0: z, x1: x + w, z1: z + d, y: h };
    for (const [cx, cz] of [[x + 0.25, z + 0.6], [x + w - 0.25, z + 0.6], [x + 0.25, z + d - 0.6], [x + w - 0.25, z + d - 0.6]]) {
      k.cyl([cx, h / 2, cz], 0.15, h, '#e8e2d6', { finish: 'shiny' });
      k.cyl([cx, 0.3, cz], 0.2, 0.6, '#c8382c');
    }
  },

  shop(k, p) {
    const { x, z, w, d, h } = p;
    // The shop front faces the forecourt, north: glass, a door, a red band, ice and propane by the door.
    k.slab(x + 0.3, 0.1, z - 0.04, x + w - 0.3, 1.7, z + 0.02, '#26303c', { finish: 'glass' });
    for (let t = 0.3; t <= w - 0.3; t += 1.1) k.slab(x + t - 0.03, 0, z - 0.06, x + t + 0.03, 1.8, z, '#c8ccd2');
    k.slab(x, h - 0.6, z - 0.08, x + w, h - 0.05, z, '#c8382c');
    k.slab(x - 0.05, h, z - 0.05, x + w + 0.05, h + 0.12, z + d + 0.05, '#f4f1ea');
    k.box([x + w - 0.7, 0.55, z - 0.45], [0.9, 1.1, 0.6], '#e8f4fa', { finish: 'shiny' });
    for (let i = 0; i < 3; i++) k.cyl([x + 0.6 + i * 0.35, 0.4, z - 0.4], 0.14, 0.8, '#e8e8e8', { finish: 'shiny' });
    for (const [ax, az] of [[x + 2, z + 2], [x + 5, z + 5]]) k.box([ax, h + 0.35, az], [1, 0.7, 0.8], '#9aa0aa');
  },

  carwash(k, p) {
    const { x, z, w, d } = p;
    // Brushes hanging from the roof, blue and soft, and spray bars.
    for (const t of [1.5, 4]) {
      for (const s of [0.6, d - 0.6]) k.cyl([x + t, 1.2, z + s], 0.42, 1.8, '#3d8ad0', { segments: 12 });
      k.cyl([x + t, 2.05, z + d / 2], 0.32, d - 1.4, '#5aa8f0', { rot: [Math.PI / 2, 0, 0], segments: 12 });
    }
    k.slab(x + 2.8, 2.1, z, x + 2.9, 2.2, z + d, '#c8ccd2');
    // A blue band round the roof, and bubbles painted on it.
    const x0 = x - 0.25, x1 = x + w + 0.25, z0 = z - 1.25, z1 = z + d + 1.25;
    k.slab(x0 - 0.02, 2.22, z0 - 0.02, x1 + 0.02, 2.48, z0 + 0.04, '#2c74b8');
    k.slab(x0 - 0.02, 2.22, z1 - 0.04, x1 + 0.02, 2.48, z1 + 0.02, '#2c74b8');
    k.slab(x0 - 0.02, 2.22, z0, x0 + 0.04, 2.48, z1, '#2c74b8');
    k.slab(x1 - 0.04, 2.22, z0, x1 + 0.02, 2.48, z1, '#2c74b8');
    for (const [bx, bz, r] of [[x + 1, z + 1, 0.35], [x + 2, z + 3, 0.5], [x + 4.3, z + 1.8, 0.4], [x + 4.6, z + 4, 0.3]]) k.cyl([bx, 2.505, bz], r, 0.01, '#bfe4ff', { segments: 18 });
  },

  shrub(k, p, y, rnd) {
    const s = p.size ?? 1;
    const c = ['#7a8044', '#8a8a50', '#6a7a3a', '#9a9058'][Math.floor(rnd() * 4)];
    for (let i = 0; i < 4; i++) {
      const a = rnd() * Math.PI * 2;
      k.sphere([p.x + Math.cos(a) * 0.15 * s, y + 0.12 * s, p.z + Math.sin(a) * 0.15 * s], (0.16 + rnd() * 0.1) * s, c, { scale: [1, 0.75, 1] });
    }
  },

  rock(k, p, y, rnd) {
    const s = p.size ?? 1;
    k.box([p.x, y + 0.08 * s, p.z], [0.35 * s, 0.22 * s, 0.28 * s], ['#8a7a6a', '#7a6a5a', '#9a8a78'][Math.floor(rnd() * 3)], { rot: [rnd() * 0.5, rnd() * 3, rnd() * 0.5] });
  },


  valves(k, p, y) {
    k.cyl([p.x, y + 0.5, p.z], 0.12, 1, '#5a6068', { segments: 10 });
    k.cyl([p.x, y + 0.6, p.z + (p.length ?? 3) / 2], 0.1, p.length ?? 3, '#c8c2b4', { rot: [Math.PI / 2, 0, 0], segments: 10, finish: 'shiny' });
    k.torus([p.x, y + 1.08, p.z], 0.18, 0.03, '#c8382c', { rot: [Math.PI / 2, 0, 0] });
    k.beam([p.x - 0.18, y + 1.08, p.z], [p.x + 0.18, y + 1.08, p.z], 0.02, '#c8382c');
    k.box([p.x, y + 0.6, p.z + (p.length ?? 3)], [0.3, 0.3, 0.3], '#8a8f9a');
  },

  cylinders(k, p, y) {
    for (let i = 0; i < 4; i++) {
      const c = ['#3a7a3a', '#e8e2d6', '#c8382c', '#2a5aa8'][i];
      k.cyl([p.x + (i % 2) * 0.32, y + 0.45, p.z + Math.floor(i / 2) * 0.32], 0.13, 0.9, c, { segments: 10, finish: 'shiny' });
      k.sphere([p.x + (i % 2) * 0.32, y + 0.9, p.z + Math.floor(i / 2) * 0.32], 0.13, c, { finish: 'shiny' });
    }
    k.slab(p.x - 0.25, y, p.z - 0.25, p.x + 0.57, y + 0.05, p.z + 0.57, '#5a6068');
  },

  junker(k, p, y) {
    const c = p.colour;
    const ry = p.turn ?? 0;
    k.box([p.x, y + 0.35, p.z], [0.9, 0.5, 1.8], c, { rot: [0.05, ry, 0.08] });
    k.box([p.x, y + 0.72, p.z - 0.1], [0.8, 0.3, 0.9], c, { rot: [0.05, ry, 0.12] });
    k.box([p.x, y + 0.72, p.z - 0.1], [0.82, 0.22, 0.8], '#1c2028', { rot: [0.05, ry, 0.12] });
  },

  tires(k, p, y) {
    for (let i = 0; i < 5; i++) k.torus([p.x + (i % 2) * 0.03, y + 0.12 + i * 0.2, p.z], 0.3, 0.1, '#18181b', { rot: [Math.PI / 2, 0, 0] });
  },

  tunnel(k, p) {
    const { x, z, w, d, facing } = p;
    const face = facing > 0 ? z + d : z;
    // A concrete portal, the dark inside, and lamps round the mouth.
    k.slab(x - 0.6, 0, face - 0.3, x, 3.6, face + 0.3, '#a7a39a');
    k.slab(x + w, 0, face - 0.3, x + w + 0.6, 3.6, face + 0.3, '#a7a39a');
    k.slab(x - 0.6, 2.8, face - 0.3, x + w + 0.6, 3.8, face + 0.3, '#a7a39a');
    k.slab(x, 0, z, x + w, 2.8, z + d, '#0a0a0c');
    k.slab(x - 0.8, 3.8, face - 0.4, x + w + 0.8, 4.0, face + 0.4, '#8b877e');
    for (let t = 1; t < w; t += 2.5) k.box([x + t, 2.6, face], [0.4, 0.08, 0.1], '#ffd88a', { finish: 'glow' });
  },

  trailer(k, p) {
    const { x, z, w, d, y } = p;
    k.slab(x, y + 0.25, z, x + w, y + 1.5, z + d, '#e8e2d6');
    k.slab(x - 0.02, y + 0.8, z - 0.02, x + w + 0.02, y + 0.95, z + d + 0.02, '#2c6ec8');
    k.slab(x + 0.8, y + 0.4, z + d + 0.01, x + 1.4, y + 1.35, z + d + 0.03, '#8a8f9a');
    k.slab(x + 2.4, y + 0.85, z + d + 0.01, x + 3.4, y + 1.3, z + d + 0.03, '#26303c', { finish: 'glass' });
    for (const t of [0.3, w - 0.3]) for (const s of [z + 0.2, z + d - 0.2]) k.box([x + t, y + 0.12, s], [0.3, 0.25, 0.3], '#7a7f86');
    k.slab(x + 0.6, y, z + d, x + 1.6, y + 0.3, z + d + 0.6, '#8a6a42');
  },

  pipeline(k, p) {
    const { x, z, to, h } = p;
    // A fat pipe under the walkway, held up on legs every few tiles.
    k.cyl([(x + 6 + to) / 2, h - 0.38, z + 0.5], 0.34, to - x - 6, '#7a8189', { rot: [0, 0, Math.PI / 2], finish: 'shiny', segments: 16 });
    for (let t = x + 7; t < to; t += 4) {
      k.cyl([t, h / 2 - 0.4, z + 0.5], 0.06, h, '#5a6068', { segments: 8 });
      k.torus([t, h - 0.38, z + 0.5], 0.36, 0.05, '#5a6068', { rot: [0, Math.PI / 2, 0] });
    }
    for (let t = x + 6; t < to; t += 1.5) k.slab(t, h + 0.001, z + 0.05, t + 0.05, h + 0.012, z + 0.95, '#5a6068');
  },

  derrick(k, p) {
    const { x, z, w, d, y, top } = p;
    const H = top - y + 7;
    const corner = (t, i) => {
      const inset = (t / H) * 1.5;
      return [[x + inset, z + inset], [x + w - inset, z + inset], [x + w - inset, z + d - inset], [x + inset, z + d - inset]][i];
    };
    for (let i = 0; i < 4; i++) {
      const a = corner(0, i), b = corner(H, i);
      k.beam([a[0], y, a[1]], [b[0], y + H, b[1]], 0.07, '#c8382c');
    }
    for (let t = 1.5; t < H; t += 1.5) {
      for (let i = 0; i < 4; i++) {
        const a = corner(t, i), b = corner(t, (i + 1) % 4), c = corner(t + 1.5, (i + 1) % 4);
        k.beam([a[0], y + t, a[1]], [b[0], y + t, b[1]], 0.035, '#c8382c');
        if (t + 1.5 < H) k.beam([a[0], y + t, a[1]], [c[0], y + t + 1.5, c[1]], 0.025, '#e8e4dc');
      }
    }
    k.slab(x + 1.3, y + H - 0.1, z + 1.3, x + w - 1.3, y + H + 0.3, z + d - 1.3, '#3a3d44');
    k.sphere([x + w / 2, y + H + 0.5, z + d / 2], 0.15, '#ff3020', { finish: 'glow' });
    k.beam([x + w / 2, y + H, z + d / 2], [x + w / 2, top + 0.4, z + d / 2], 0.02, '#2a2c30');
    // Rails round the deck, and the lift's guide rails.
    for (const [a, b] of [[[x, z], [x + w, z]], [[x + w, z], [x + w, z + d]], [[x, z + d], [x + w, z + d]]]) {
      k.beam([a[0], top + 0.5, a[1]], [b[0], top + 0.5, b[1]], 0.03, '#f2c230');
    }
    for (const s of [0, 2]) k.cyl([x - 2 + s, (y + top) / 2 + 0.3, z + 0.9], 0.04, top - y + 1, '#5a6068', { segments: 6 });
  },

  sign(k, p, y) {
    k.cyl([p.x, y + 0.5, p.z + 0.5], 0.04, 1, '#5a3d26', { segments: 6 });
  },

  drums(k, p) {
    const cols = ['#2a5aa8', '#c8382c', '#3a7a3a', '#e8b04a'];
    const y = p.y;
    for (const [dx, dz, lv] of [[-0.38, -0.38, 0], [0.38, -0.38, 0], [-0.38, 0.38, 0], [0.38, 0.38, 0], [0, 0, 1]]) {
      const c = cols[Math.floor(Math.abs(p.x * 7 + p.z * 3 + dx * 10 + lv * 5)) % 4];
      k.cyl([p.x + dx, y + 0.45 + lv * 0.9, p.z + dz], 0.34, 0.88, c, { finish: 'shiny', segments: 16 });
      k.torus([p.x + dx, y + 0.45 + lv * 0.9, p.z + dz], 0.34, 0.02, '#1c1b1f', { rot: [Math.PI / 2, 0, 0] });
    }
  },

  gate(k, p, y) {
    for (const t of [-0.3, p.w + 0.3]) {
      k.box([p.x + t, y + 0.7, p.z], [0.3, 1.4, 0.3], '#e8e2d6');
      k.box([p.x + t, y + 1.42, p.z], [0.36, 0.06, 0.36], '#c8382c');
    }
    k.box([p.x - 0.3, y + 1.7, p.z], [0.18, 0.18, 0.18], '#f2c230', { finish: 'glow' });
    // The barrier arm, up.
    k.box([p.x - 0.1, y + 1.0 + 1.0, p.z], [0.1, 2.2, 0.1], '#f4f1ea', { rot: [0, 0, -0.2] });
    k.box([p.x + 0.12, y + 1.45 + 1.0, p.z], [0.11, 0.3, 0.11], '#c8382c', { rot: [0, 0, -0.2] });
  },

  tank(k, p) {
    const { x, z, r, h, colour } = p;
    k.cyl([x, h / 2, z], r, h, colour, { segments: 40 });
    k.cyl([x, h + 0.01, z], r * 0.98, 0.02, '#a7adb5', { segments: 40 });
    for (let y = 1; y < h; y += 1.2) k.torus([x, y, z], r * 1.002, 0.02, '#bdb8ab', { rot: [Math.PI / 2, 0, 0] });
    // Rails round the top, a ladder up the side.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      k.cyl([x + Math.cos(a) * r * 0.97, h + 0.3, z + Math.sin(a) * r * 0.97], 0.02, 0.6, '#f2c230', { segments: 4 });
    }
    k.torus([x, h + 0.6, z], r * 0.97, 0.025, '#f2c230', { rot: [Math.PI / 2, 0, 0] });
    for (const s of [-0.22, 0.22]) k.cyl([x - r - 0.08, h / 2, z + s], 0.025, h, '#5a6068', { segments: 4 });
    for (let y = 0.3; y < h; y += 0.35) k.cyl([x - r - 0.08, y, z], 0.015, 0.44, '#5a6068', { rot: [Math.PI / 2, 0, 0], segments: 4 });
    // A logo band.
    k.cyl([x, h * 0.62, z], r * 1.004, 0.5, '#c8382c', { segments: 40, open: true });
  },

  catwalk(k, p) {
    const { x, z, w, h } = p;
    for (let t = x + 0.5; t < x + w; t += 3) {
      k.cyl([t, h / 2, z + 0.5], 0.05, h, '#5a6068', { segments: 6 });
    }
    for (const s of [0.04, 0.96]) k.cyl([x + w / 2 + 6, h + 0.55, z + s], 0.025, w - 12, '#f2c230', { rot: [0, 0, Math.PI / 2] });
  },

  stack(k, p, y) {
    k.cyl([p.x, y + p.h / 2, p.z], [0.55, 0.8], p.h, '#c8c2b4', { segments: 20 });
    for (let t = 1.5; t < p.h; t += 2.5) k.torus([p.x, y + t, p.z], 0.62 + 0.25 * (1 - t / p.h), 0.04, '#c8382c', { rot: [Math.PI / 2, 0, 0] });
    k.cyl([p.x, y + p.h + 0.15, p.z], 0.6, 0.3, '#3a3d44');
  },

  piperack(k, p) {
    const { x, z, to } = p;
    for (let t = x + 0.5; t < to; t += 5) {
      k.cyl([t, 1.7, z], 0.08, 3.4, '#5a6068', { segments: 6 });
      k.slab(t - 0.1, 3.3, z - 0.8, t + 0.1, 3.45, z + 0.8, '#5a6068');
    }
    const cols = ['#c8c2b4', '#c8382c', '#e8b04a', '#3a7a3a'];
    for (let i = 0; i < 4; i++) k.cyl([(x + to) / 2, 3.6, z - 0.6 + i * 0.4], 0.13, to - x, cols[i], { rot: [0, 0, Math.PI / 2], finish: 'shiny', segments: 10 });
  },

  sphere(k, p, y) {
    k.sphere([p.x, y + p.r + 1.2, p.z], p.r, '#e8e4dc', { finish: 'shiny' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      k.cyl([p.x + Math.cos(a) * p.r * 0.8, y + 0.9, p.z + Math.sin(a) * p.r * 0.8], 0.12, 1.8, '#8a8f9a', { segments: 6 });
    }
  },

  fence(k, p) {
    // Chain-link on posts along the top of the bank, round all four sides.
    const S = p.size, i = p.inset / 2, top = 2.5;
    const sides = [[[0, i], [S, i]], [[0, S - i], [S, S - i]], [[i, 0], [i, S]], [[S - i, 0], [S - i, S]]];
    for (const [a, b] of sides) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= len; t += 2) {
        const x = a[0] + ((b[0] - a[0]) * t) / len, z = a[1] + ((b[1] - a[1]) * t) / len;
        const y = Math.min(top, Math.max(0, (5 - Math.min(x, z, S - x, S - z)) * 0.5));
        k.cyl([x, y + 0.65, z], 0.04, 1.3, '#8a8f9a', { segments: 6 });
      }
      for (const h of [0.5, 1.25]) {
        k.beam([a[0], top + h, a[1]], [b[0], top + h, b[1]], 0.025, '#8a8f9a');
      }
      // The mesh itself, as a faint panel.
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
      k.slab(x0 - 0.005, top + 0.05, z0 - 0.005, x1 + 0.005, top + 1.25, z1 + 0.005, '#6a6e76');
    }
  },

  billboard(k, p, y) {
    for (const s of [-1.6, 1.6]) k.cyl([p.x, y + 1.8, p.z + s], 0.12, 3.6, '#5a6068', { segments: 8 });
    k.slab(p.x - 0.12, y + 3.0, p.z - 2.5, p.x + 0.05, y + 6.0, p.z + 2.5, '#3a3d44');
    k.slab(p.x - 0.5, y + 2.9, p.z - 2.4, p.x, y + 2.96, p.z + 2.4, '#5a6068');
    for (const s of [-1.6, 0, 1.6]) k.beam([p.x - 0.45, y + 2.95, p.z + s], [p.x - 0.7, y + 3.2, p.z + s], 0.03, '#5a6068');
  },
};

/** Words for the props that carry them. */
const WORDS = {
  billboard(GFX, p, y) {
    const t = words(GFX, 'PETROLL\nRoll on in', {
      w: 1024, h: 600, bg: '#f4c430', fg: '#1c1b1a', font: '900 170px',
      accent(ctx, w, h) {
        ctx.fillStyle = '#c8382c';
        ctx.fillRect(0, h * 0.82, w, h * 0.18);
        ctx.fillStyle = '#f4f1ea';
        ctx.font = '700 60px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("GAS 'N' GO · NEXT LEFT", w / 2, h * 0.91);
      },
    });
    return [panel(GFX, t, [p.x - 0.14, y + 4.5, p.z], 4.9, 2.9, -Math.PI / 2, 0.25)];
  },
  shop(GFX, p) {
    const t = words(GFX, "GAS 'N' GO", { w: 1024, h: 160, bg: '#c8382c', fg: '#f4f1ea', font: '900 120px' });
    return [panel(GFX, t, [p.x + p.w / 2, p.h - 0.33, p.z - 0.09], p.w * 0.9, 0.5, Math.PI, 0.6)];
  },
  sign(GFX, p, y) {
    const t = words(GFX, p.text, { w: 256, h: 192, bg: '#f2c230', fg: '#1c1b1a', font: '900 70px' });
    return [panel(GFX, t, [p.x - 0.03, y + 1.15, p.z + 0.5], 0.8, 0.6, -Math.PI / 2, 0.2)];
  },
  carwash(GFX, p) {
    const t = words(GFX, 'CAR WASH', { w: 512, h: 96, bg: '#2c74b8', fg: '#f4f1ea', font: '900 72px' });
    return [panel(GFX, t, [p.x - 0.29, 2.35, p.z + p.d / 2], 3.2, 0.24, -Math.PI / 2, 0.5)];
  },
  canopy(GFX, p) {
    const t = words(GFX, 'PETROLL  2.99', { w: 1024, h: 96, bg: '#c8382c', fg: '#f4f1ea', font: '900 72px' });
    return [panel(GFX, t, [p.x + p.w / 2, p.h + 0.23, p.z + p.d + 0.04], p.w * 0.95, 0.24, 0, 0.5)];
  },
};

/**
 * Draws the map's props into `kit`; returns any extra meshes (signs with
 * words on them), and the roofs — what a prop draws into its `roof` kit —
 * each its own mesh, so it can be faded out while the hamster is under it.
 */
export function drawProps(GFX, kit, map, createKit) {
  const extras = [], roofs = [];
  map.props.forEach((p, i) => {
    const draw = DRAW[p.type];
    if (!draw) throw new Error(`no prop called ${p.type}`);
    const y = p.y ?? map.heightAt(p.x, p.z) ?? 0;
    const roof = createKit ? createKit(GFX) : kit;
    draw(kit, p, y, random(i + 1), roof);
    if (roof !== kit && !roof.empty) roofs.push(roof);
    if (WORDS[p.type]) extras.push(...WORDS[p.type](GFX, p, y).filter(Boolean));
  });
  return { extras, roofs };
}

export const PROP_TYPES = Object.keys(DRAW);
