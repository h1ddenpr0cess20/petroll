/**
 * The look of each surface, painted on a canvas at startup: one tile of it,
 * seamless at the edges, in its real colours (the tiles' vertex colours
 * only vary it a little from tile to tile). Each comes with how it
 * reflects (`material`) and how bumpy it is (`bump`).
 */

const N = 256;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const rgb = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const shade = (c, k) => rgb(hex(c).map((v) => Math.max(0, Math.min(255, v * k))));

/** Speckle: `n` dots of `size`, shades of `base` either side of it by `spread`. */
function speckle(ctx, r, base, n, size, spread, alpha = 1) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rgb(hex(base).map((v) => v * (1 + (r() - 0.5) * 2 * spread)), alpha);
    const s = size * (0.5 + r());
    const x = r() * N, y = r() * N;
    // Wrapped, so the tile has no seam.
    for (const ox of [0, -N]) for (const oy of [0, -N]) ctx.fillRect(x + ox, y + oy, s, s);
  }
}

const PAINT = {
  grass(ctx, r) {
    ctx.fillStyle = '#5f8f3e';
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, r, '#5f8f3e', 900, 6, 0.18, 0.5);
    for (let i = 0; i < 2600; i++) {
      const x = r() * N, y = r() * N, l = 3 + r() * 6;
      ctx.strokeStyle = rgb(hex(['#6fa24a', '#4f7f34', '#7cae55', '#58893a'][i % 4]), 0.8);
      ctx.lineWidth = 1 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 3, y - l);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = ['#f4f1ea', '#f2d040', '#e8a0c0'][i % 3];
      ctx.beginPath();
      ctx.arc(r() * N, r() * N, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  lawn(ctx, r) {
    // Mown in stripes.
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#6aa848' : '#7cba58';
      ctx.fillRect(0, (i * N) / 4, N, N / 4);
    }
    for (let i = 0; i < 2200; i++) {
      const x = r() * N, y = r() * N;
      ctx.strokeStyle = rgb(hex(['#86c462', '#5e9a40', '#72b050'][i % 3]), 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 2, y - 2 - r() * 3);
      ctx.stroke();
    }
  },
  road(ctx, r) {
    ctx.fillStyle = '#3e4046';
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, r, '#44464c', 5000, 2, 0.35);
    speckle(ctx, r, '#2a2b30', 300, 3, 0.2, 0.6);
    // A crack or two, and an old oil spot.
    ctx.strokeStyle = 'rgba(20,20,24,0.5)';
    ctx.lineWidth = 1.2;
    for (let c = 0; c < 2; c++) {
      let x = r() * N, y = r() * N;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 6; i++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(N * 0.6, N * 0.4, 0, N * 0.6, N * 0.4, 40);
    g.addColorStop(0, 'rgba(10,10,14,0.35)');
    g.addColorStop(1, 'rgba(10,10,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
  },
  highway(ctx, r) {
    ctx.fillStyle = '#36383e';
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, r, '#3c3e44', 5000, 2, 0.3);
    // Tyre tracks, worn darker.
    for (const x of [N * 0.28, N * 0.72]) {
      const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(20,20,24,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 26, 0, 52, N);
    }
  },
  sidewalk(ctx, r) {
    ctx.fillStyle = '#c4bfb2';
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, r, '#c4bfb2', 3000, 2, 0.08);
    ctx.strokeStyle = 'rgba(90,86,78,0.55)';
    ctx.lineWidth = 3;
    for (const t of [1.5, N / 2]) {
      ctx.beginPath(); ctx.moveTo(t, 0); ctx.lineTo(t, N); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, t); ctx.lineTo(N, t); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(4, 4, N / 2 - 8, 3);
    ctx.fillRect(N / 2 + 4, N / 2 + 4, N / 2 - 8, 3);
  },
  concrete(ctx, r) {
    ctx.fillStyle = '#aca89e';
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, r, '#aca89e', 2400, 3, 0.05);
    for (let i = 0; i < 4; i++) {
      const x = r() * N, y = r() * N;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + r() * 60);
      g.addColorStop(0, 'rgba(70,64,56,0.18)');
      g.addColorStop(1, 'rgba(70,64,56,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, N, N);
    }
    ctx.strokeStyle = 'rgba(70,66,60,0.6)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(1, 1, N - 2, N - 2);
  },
  forecourt(ctx, r) {
    PAINT.concrete(ctx, r);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 2; i++) {
      const x = r() * N, y = r() * N, g = ctx.createRadialGradient(x, y, 0, x, y, 22);
      g.addColorStop(0, 'rgba(30,26,22,0.4)');
      g.addColorStop(1, 'rgba(30,26,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, N, N);
    }
  },
  brick(ctx, r) {
    ctx.fillStyle = '#6a4436';
    ctx.fillRect(0, 0, N, N);
    const bh = N / 8, bw = N / 4;
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * bw + (row % 2 ? bw / 2 : 0);
        ctx.fillStyle = shade(['#a8644c', '#9a5642', '#b4705a', '#94523e'][Math.floor(r() * 4)], 0.95 + r() * 0.1);
        ctx.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    speckle(ctx, r, '#a8644c', 800, 2, 0.25, 0.4);
  },
  dirt(ctx, r) {
    ctx.fillStyle = '#9c7a52';
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 16; i++) {
      const x = r() * N, y = r() * N, g = ctx.createRadialGradient(x, y, 0, x, y, 20 + r() * 50);
      const c = r() < 0.5 ? '110,80,50' : '170,140,100';
      g.addColorStop(0, `rgba(${c},0.4)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, N, N);
    }
    speckle(ctx, r, '#8e6c46', 2600, 2, 0.3);
    speckle(ctx, r, '#c0a07a', 180, 4, 0.2);
    // Cracks in the dry ground.
    ctx.strokeStyle = 'rgba(70,50,30,0.35)';
    ctx.lineWidth = 1;
    for (let c = 0; c < 5; c++) {
      let x = r() * N, y = r() * N;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 4; i++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // Tufts of dry grass.
    for (let i = 0; i < 40; i++) {
      const x = r() * N, y = r() * N;
      ctx.strokeStyle = ['rgba(150,140,70,0.8)', 'rgba(120,120,60,0.8)'][i % 2];
      for (let k = 0; k < 4; k++) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y - 3 - r() * 4); ctx.stroke();
      }
    }
  },
  sand(ctx, r) {
    ctx.fillStyle = '#d4b67a';
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, r, '#d4b67a', 4000, 2, 0.15);
  },
  gravel(ctx, r) {
    ctx.fillStyle = '#8f887e';
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = shade(['#a8a196', '#7a746a', '#9b948a', '#bdb6aa', '#6e675e'][i % 5], 0.9 + r() * 0.2);
      ctx.beginPath();
      ctx.ellipse(r() * N, r() * N, 2 + r() * 3, 1.5 + r() * 2.5, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  metal(ctx) {
    // Diamond plate.
    ctx.fillStyle = '#8a9098';
    ctx.fillRect(0, 0, N, N);
    const s = N / 8;
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        const x = i * s + s / 2, y = j * s + s / 2, a = (i + j) % 2 ? 0.6 : -0.6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = '#b4bac2';
        ctx.fillRect(-s * 0.32, -2.5, s * 0.64, 5);
        ctx.fillStyle = '#5a6068';
        ctx.fillRect(-s * 0.32, 2.5, s * 0.64, 1.5);
        ctx.restore();
      }
    }
    ctx.strokeStyle = 'rgba(40,44,50,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, N - 3, N - 3);
  },
  roof(ctx, r) {
    ctx.fillStyle = '#4a2c22';
    ctx.fillRect(0, 0, N, N);
    const rows = 8, h = N / rows, w = N / 6;
    for (let row = 0; row < rows; row++) {
      for (let col = -1; col < 7; col++) {
        const x = col * w + (row % 2 ? w / 2 : 0);
        ctx.fillStyle = shade(['#7a4a3a', '#6e4234', '#86523f'][Math.floor(r() * 3)], 0.9 + r() * 0.15);
        ctx.fillRect(x + 1, row * h + 1, w - 2, h - 1);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 1, row * h + h - 4, w - 2, 3);
      }
    }
  },
  flatroof(ctx, r) {
    ctx.fillStyle = '#7e7e84';
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, r, '#8a8a90', 3600, 2, 0.25);
    ctx.strokeStyle = 'rgba(30,30,34,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, N / 2); ctx.lineTo(N, N / 2); ctx.stroke();
  },
  oil(ctx, r) {
    ctx.fillStyle = '#121216';
    ctx.fillRect(0, 0, N, N);
    // A faint rainbow sheen in long smears; the material's iridescence does the rest.
    for (let i = 0; i < 7; i++) {
      const x = r() * N, y = r() * N, hue = Math.floor(r() * 360);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * Math.PI);
      const g = ctx.createLinearGradient(-90, 0, 90, 0);
      g.addColorStop(0, `hsla(${hue},70%,50%,0)`);
      g.addColorStop(0.3, `hsla(${hue},70%,50%,0.12)`);
      g.addColorStop(0.5, `hsla(${(hue + 90) % 360},70%,55%,0.1)`);
      g.addColorStop(0.7, `hsla(${(hue + 180) % 360},70%,50%,0.12)`);
      g.addColorStop(1, `hsla(${hue},70%,50%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 90, 18 + r() * 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  wet(ctx, r) {
    PAINT.concrete(ctx, r);
    ctx.fillStyle = 'rgba(40,70,100,0.45)';
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(200,230,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(r() * N, r() * N, 10 + r() * 30, 6 + r() * 14, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  tar(ctx, r) {
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = 'rgba(120,120,130,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r() * N, r() * N, 2 + r() * 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  pool(ctx, r) {
    ctx.fillStyle = '#5a9ab0';
    ctx.fillRect(0, 0, N, N);
    const s = N / 6;
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
      ctx.fillStyle = shade('#8ccbe2', 0.95 + r() * 0.1);
      ctx.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
    // Dead leaves at the bottom of a drained pool.
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['#8a5a2a', '#a07030', '#6a4a2a'][i];
      ctx.beginPath();
      ctx.ellipse(r() * N, r() * N, 6, 3, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  plank(ctx, r) {
    const h = N / 4;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = shade('#9a7448', 0.85 + r() * 0.25);
      ctx.fillRect(0, i * h, N, h);
      ctx.strokeStyle = 'rgba(60,40,20,0.35)';
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        const y = i * h + r() * h;
        ctx.moveTo(0, y); ctx.bezierCurveTo(N / 3, y + 4, (2 * N) / 3, y - 4, N, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,20,10,0.7)';
      ctx.fillRect(0, i * h, N, 3);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(10, i * h + h / 2 - 3, 6, 6);
      ctx.fillRect(N - 16, i * h + h / 2 - 3, 6, 6);
    }
  },
  berm(ctx, r) {
    PAINT.grass(ctx, r);
    ctx.fillStyle = 'rgba(150,140,60,0.25)';
    ctx.fillRect(0, 0, N, N);
  },
};

const MATERIAL = {
  road: { roughness: 0.88 },
  highway: { roughness: 0.85 },
  metal: { roughness: 0.38, metalness: 0.7 },
  oil: { roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.6 },
  wet: { roughness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.05 },
  tar: { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 },
  pool: { roughness: 0.3, clearcoat: 0.6 },
  forecourt: { roughness: 0.7 },
  flatroof: { roughness: 0.9 },
};
const BUMP = { grass: 1.2, lawn: 0.8, brick: 2, roof: 2.2, metal: 2.5, gravel: 2.2, sidewalk: 1.2, plank: 1.5, dirt: 1.2, road: 0.8, highway: 0.6, berm: 1.2, pool: 1 };

const made = new Map();

/** The surface's material: its painted map (and bump), and how it shines. */
export function surfaceMaterial(GFX, name) {
  if (made.has(name)) return made.get(name);
  let map = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    const paint = PAINT[name] ?? PAINT.concrete;
    paint(ctx, rng(name.length * 7919 + name.charCodeAt(0)));
    map = new GFX.CanvasTexture(c);
    map.colorSpace = GFX.SRGBColorSpace;
    map.anisotropy = 8;
  }
  const bumpScale = BUMP[name] ?? 0;
  const material = new GFX.MeshPhysicalMaterial({
    name: `ground-${name}`, vertexColors: true, map, roughness: 0.92, metalness: 0,
    ...(bumpScale && map ? { bumpMap: map, bumpScale } : {}),
    ...MATERIAL[name],
  });
  made.set(name, material);
  return material;
}
