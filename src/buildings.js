import { createKit } from 'madness-engine/kit';
import { linearRGB } from 'madness-engine/color';
import { FACADES, WINDOW } from 'madness-engine/textures/town/paint';

/**
 * What a building has besides its walls and roof (which the map draws):
 * the windows lit at night — a warm glow over the glass of some of them,
 * a different warmth in each — the fascia and the eaves round a pitched
 * roof, chimneys, a porch light by the door, and on the flat roofs a
 * parapet cap, air handlers and vents.
 */

const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const WARM = ['#ffd890', '#ffc870', '#ffe0a8', '#fff0d0', '#ffb860', '#d8e8ff'];

export function createBuildings(GFX, map) {
  const group = new GFX.Group();
  group.name = 'buildings';
  const glow = { position: [], color: [] };
  const kit = createKit(GFX);

  /** A lit window: a quad over the glass of the tile at `t` along the side, storey `k`. */
  const pane = (b, side, i, k, style) => {
    const win = WINDOW[style];
    if (!win) return;
    const storey = FACADES[style].storey;
    const y0 = b.base + k * storey + (1 - win.v[1]) * storey, y1 = b.base + k * storey + (1 - win.v[0]) * storey;
    if (y1 > b.h + 1e-3) return;
    const lit = hash(b.x * 7 + i, b.z * 13 + k, side.charCodeAt(0)) < b.lit;
    if (!lit) return;
    const col = linearRGB(WARM[Math.floor(hash(i, k, b.x) * WARM.length)]).map((v) => v * (0.7 + 0.5 * hash(k, i, b.z)));
    const off = 0.012;
    let a, c;
    // The pane's corners along the wall, read left to right from outside.
    const u0 = win.u[0], u1 = win.u[1];
    if (side === 's') { a = [b.x + i + u0, b.z + b.d + off]; c = [b.x + i + u1, b.z + b.d + off]; }
    else if (side === 'n') { a = [b.x + i + 1 - u0, b.z - off]; c = [b.x + i + 1 - u1, b.z - off]; }
    else if (side === 'w') { a = [b.x - off, b.z + i + u0]; c = [b.x - off, b.z + i + u1]; }
    else { a = [b.x + b.w + off, b.z + i + 1 - u0]; c = [b.x + b.w + off, b.z + i + 1 - u1]; }
    const quad = [[a, y0], [c, y0], [c, y1], [a, y0], [c, y1], [a, y1]];
    for (const [[x, z], y] of quad) {
      glow.position.push(x, y, z);
      glow.color.push(...col);
    }
  };

  for (const b of map.buildings) {
    const style = b.facade;
    const storey = FACADES[style].storey;
    const storeys = Math.ceil((b.h - b.base) / storey - 1e-3);
    for (const [side, len] of [['n', b.w], ['s', b.w], ['w', b.d], ['e', b.d]]) {
      for (let i = 0; i < len; i++) {
        for (let k = 0; k < storeys; k++) {
          const doorHere = k === 0 && b.door === side && i === Math.floor(len / 2);
          if (!doorHere) pane(b, side, i, k, style);
        }
      }
    }
    const wall = b.wall;
    if (b.roof === 'pitched') {
      // Fascia boards and the eaves along the low edges, a ridge cap, gutters, a chimney.
      const fascia = '#f4f1ea', ridgeCol = '#4a3a34';
      const along = b.ridge === 'x';
      const [L, D] = along ? [b.w, b.d] : [b.d, b.w];
      for (const sgn of [0, 1]) {
        const e = sgn ? D + 0.12 : -0.12;
        if (along) kit.slab(b.x - 0.12, b.h - 0.12, b.z + e - 0.06, b.x + L + 0.12, b.h + 0.02, b.z + e + 0.06, fascia);
        else kit.slab(b.x + e - 0.06, b.h - 0.12, b.z - 0.12, b.x + e + 0.06, b.h + 0.02, b.z + L + 0.12, fascia);
        if (along) kit.cyl([b.x + L / 2, b.h - 0.08, b.z + e + (sgn ? 0.06 : -0.06)], 0.05, L + 0.2, '#d8d4cc', { rot: [0, 0, Math.PI / 2], segments: 8 });
        else kit.cyl([b.x + e + (sgn ? 0.06 : -0.06), b.h - 0.08, b.z + L / 2], 0.05, L + 0.2, '#d8d4cc', { rot: [Math.PI / 2, 0, 0], segments: 8 });
      }
      if (along) kit.slab(b.x - 0.1, b.h + b.pitch - 0.02, b.z + D / 2 - 0.09, b.x + L + 0.1, b.h + b.pitch + 0.07, b.z + D / 2 + 0.09, ridgeCol);
      else kit.slab(b.x + D / 2 - 0.09, b.h + b.pitch - 0.02, b.z - 0.1, b.x + D / 2 + 0.09, b.h + b.pitch + 0.07, b.z + L + 0.1, ridgeCol);
      const cx = b.x + b.w * 0.24, cz = b.z + b.d * 0.3;
      kit.box([cx, b.h + b.pitch * 0.7, cz], [0.42, b.pitch * 1.3, 0.42], '#8a4a3a');
      kit.box([cx, b.h + b.pitch * 1.36, cz], [0.52, 0.08, 0.52], '#5a3a30');
      void wall;
    } else {
      // A parapet cap all round the top, plant on the roof.
      const t = 0.12, y = b.h;
      kit.slab(b.x - 0.04, y, b.z - 0.04, b.x + b.w + 0.04, y + 0.22, b.z + t, '#c8ccd2');
      kit.slab(b.x - 0.04, y, b.z + b.d - t, b.x + b.w + 0.04, y + 0.22, b.z + b.d + 0.04, '#c8ccd2');
      kit.slab(b.x - 0.04, y, b.z, b.x + t, y + 0.22, b.z + b.d, '#c8ccd2');
      kit.slab(b.x + b.w - t, y, b.z, b.x + b.w + 0.04, y + 0.22, b.z + b.d, '#c8ccd2');
      if (b.w >= 4 && b.d >= 4 && style !== 'garage') {
        const ux = b.x + b.w * 0.35, uz = b.z + b.d * 0.4;
        kit.box([ux, y + 0.4, uz], [1.2, 0.8, 0.9], '#9aa0aa', { finish: 'shiny' });
        kit.cyl([ux, y + 0.81, uz], 0.32, 0.02, '#2a2c30', { segments: 18 });
        kit.cyl([b.x + b.w * 0.72, y + 0.3, b.z + b.d * 0.7], 0.22, 0.6, '#8a8f9a', { segments: 12 });
        kit.sphere([b.x + b.w * 0.72, y + 0.62, b.z + b.d * 0.7], 0.05, '#ff3020', { finish: 'glow' });
      }
    }
  }

  if (glow.position.length) {
    const g = new GFX.BufferGeometry();
    g.setAttribute('position', new GFX.BufferAttribute(new Float32Array(glow.position), 3));
    g.setAttribute('color', new GFX.BufferAttribute(new Float32Array(glow.color), 3));
    g.computeBoundingSphere();
    const m = new GFX.Mesh(g, new GFX.MeshBasicMaterial({ name: 'lit-windows', vertexColors: true, side: GFX.DoubleSide }));
    m.name = 'lit-windows';
    group.add(m);
  }
  if (!kit.empty) group.add(kit.build({ name: 'building-trim' }));
  return group;
}

/** Where the windows that are lit throw light out into the street: a lamp in front of each lit ground-floor window of a house or shop. */
export function windowLamps(map) {
  for (const b of map.buildings) {
    if (b.facade !== 'house' && b.facade !== 'shop') continue;
    if (!b.door) continue;
    const mid = b.door === 'n' || b.door === 's' ? b.x + b.w / 2 : b.door === 'w' ? b.x - 0.6 : b.x + b.w + 0.6;
    const midz = b.door === 'n' ? b.z - 0.6 : b.door === 's' ? b.z + b.d + 0.6 : b.z + b.d / 2;
    map.lamp(mid, midz, { colour: b.facade === 'shop' ? '#fff4e0' : '#ffc070', reach: b.facade === 'shop' ? 6 : 3.5, height: 1.4, glow: 0.8 });
  }
}
