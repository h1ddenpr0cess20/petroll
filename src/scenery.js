import { createKit } from 'madness-engine/kit';
import { linearRGB } from 'madness-engine/color';
import { createBuildings } from './buildings.js';
import { createPlaced } from './placed.js';
import { drawStructures, seams } from './structures.js';
import { surfaceMaterial, wallMaterial } from 'madness-engine/textures/town/textures';

/**
 * The world as it is drawn: the tiles (one mesh per surface, each with its
 * own painted texture), their walls, the paint on the roads, the decks,
 * every prop, and the land beyond the bank — scrub running out to the
 * horizon, with pylons, distant derricks and a water tower on it, so the
 * town sits in a country and not in a void.
 */

export function createWorldMeshes(GFX, map, built) {
  const group = new GFX.Group();
  group.name = 'world';

  const geometry = (parts) => {
    const g = new GFX.BufferGeometry();
    g.setAttribute('position', new GFX.BufferAttribute(parts.position, 3));
    g.setAttribute('normal', new GFX.BufferAttribute(parts.normal, 3));
    g.setAttribute('color', new GFX.BufferAttribute(parts.color, 3));
    if (parts.uv) g.setAttribute('uv', new GFX.BufferAttribute(parts.uv, 2));
    g.computeBoundingSphere();
    return g;
  };

  for (const [surface, parts] of built.tops) {
    const mesh = new GFX.Mesh(geometry(parts), surfaceMaterial(GFX, surface));
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = `ground-${surface}`;
    group.add(mesh);
  }
  for (const [name, parts] of built.walls) {
    const mesh = new GFX.Mesh(geometry(parts), wallMaterial(GFX, name));
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = `walls-${name}`;
    group.add(mesh);
  }

  // Road paint: flat quads just above the ground.
  const paint = { position: [], normal: [], color: [] };
  for (const m of map.marks) {
    const y = (map.heightAt(m.x + m.w / 2, m.z + m.d / 2) ?? 0) + 0.012;
    const l = built.light(m.x + m.w / 2, y, m.z + m.d / 2);
    const c = linearRGB(m.colour).map((v, i) => v * 0.8 * l[i]);
    const quad = [[m.x, m.z], [m.x, m.z + m.d], [m.x + m.w, m.z], [m.x + m.w, m.z], [m.x, m.z + m.d], [m.x + m.w, m.z + m.d]];
    for (const [x, z] of quad) {
      paint.position.push(x, y, z);
      paint.normal.push(0, 1, 0);
      paint.color.push(...c);
    }
  }
  if (paint.position.length) {
    const g = geometry({ position: new Float32Array(paint.position), normal: new Float32Array(paint.normal), color: new Float32Array(paint.color) });
    const lines = new GFX.Mesh(g, new GFX.MeshStandardMaterial({ name: 'road-paint', vertexColors: true, roughness: 0.6 }));
    lines.receiveShadow = true;
    group.add(lines);
  }

  // Decks, props and the country round about, in one kit; roofs over places the hamster goes, each on its own.
  const kit = createKit(GFX);
  const roofKits = [];
  for (const d of map.decks) {
    const k = d.roof ? createKit(GFX) : kit;
    k.slab(d.x, d.h - d.thick, d.z, d.x + d.w, d.h, d.z + d.d, d.colour);
    k.slab(d.x, d.h - d.thick - 0.12, d.z + 0.1, d.x + d.w, d.h - d.thick, d.z + d.d - 0.1, '#5a6068');
    // A roof: standing seams across it, and flashing round its edge.
    if (d.roof) seams(k, d.x, d.z, d.x + d.w, d.z + d.d, d.h, d.colour);
    if (d.roof) { k.bounds = { x0: d.x, z0: d.z, x1: d.x + d.w, z1: d.z + d.d, y: d.h - d.thick }; roofKits.push(k); }
  }
  const structures = drawStructures(GFX, map, built.light);
  roofKits.push(...structures.roofs);
  group.add(structures.group);
  country(kit, map);
  group.add(kit.build({ name: 'decks-and-country' }));
  group.add(land(GFX, map));
  group.add(createPlaced(GFX, map, built.light));
  group.add(createBuildings(GFX, map));

  const occluders = roofKits.map((k) => {
    const mesh = new GFX.Group();
    for (const [finish, g] of Object.entries(k.geometries())) {
      const m = new GFX.Mesh(g, new GFX.MeshStandardMaterial({ name: `roof-${finish}`, vertexColors: true, roughness: 0.7, transparent: true, opacity: 1 }));
      m.castShadow = true;
      m.receiveShadow = true;
      mesh.add(m);
    }
    group.add(mesh);
    return { mesh, bounds: k.bounds, fade: 1 };
  });

  /** Roofs fade away while the ball is under them, and come back after. */
  group.userData.uncover = (ball, dt) => {
    for (const o of occluders) {
      const b = o.bounds;
      const under = ball.x > b.x0 - 0.6 && ball.x < b.x1 + 0.6 && ball.z > b.z0 - 0.6 && ball.z < b.z1 + 0.6 && ball.y < b.y;
      o.fade += ((under ? 0.08 : 1) - o.fade) * Math.min(1, dt * 6);
      for (const m of o.mesh.children) {
        m.material.opacity = o.fade;
        m.material.depthWrite = o.fade > 0.95;
      }
    }
  };
  return group;
}

/** The ground beyond the map: a wide disc of scrub fading to the haze at the horizon. */
function land(GFX, map) {
  const cx = map.cols / 2, cz = map.rows / 2;
  const rings = [0, 70, 100, 140, 200, 280, 380];
  // Scrub in the dark, going to the glow of the refineries at the horizon.
  const colours = ['#2a2c1c', '#2a2c1c', '#262619', '#231f17', '#211a15', '#1e1613', '#1a1210'].map(linearRGB);
  const seg = 144;
  const position = [], normal = [], color = [];
  // The innermost ring is the map's own edge: the land doesn't run under the town, where it would show through anything sunk below it.
  const edge = (a) => Math.min(cx / Math.max(1e-6, Math.abs(Math.cos(a))), cz / Math.max(1e-6, Math.abs(Math.sin(a)))) - 0.5;
  const pt = (ri, a) => {
    const r = ri === 0 ? edge(a) : Math.max(rings[ri], edge(a) + 2);
    return [cx + Math.cos(a) * r, -0.03, cz + Math.sin(a) * r];
  };
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const quad = [[ri, a0], [ri + 1, a1], [ri + 1, a0], [ri, a0], [ri, a1], [ri + 1, a1]];
      for (const [r, a] of quad) {
        position.push(...pt(r, a));
        normal.push(0, 1, 0);
        color.push(...colours[r]);
      }
    }
  }
  const g = new GFX.BufferGeometry();
  g.setAttribute('position', new GFX.BufferAttribute(new Float32Array(position), 3));
  g.setAttribute('normal', new GFX.BufferAttribute(new Float32Array(normal), 3));
  g.setAttribute('color', new GFX.BufferAttribute(new Float32Array(color), 3));
  g.computeBoundingSphere();
  const mesh = new GFX.Mesh(g, new GFX.MeshStandardMaterial({ name: 'land', vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** What stands in the country round the town: pylons, scrub, derricks, a water tower, the Petroll sign on the hill. */
function country(k, map) {
  const W = map.cols, D = map.rows;
  let s = 17;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Pylons marching past on the west and south.
  const pylon = (x, z) => {
    for (const [a, b] of [[[-0.8, -0.8], [-0.2, -0.2]], [[0.8, -0.8], [0.2, -0.2]], [[-0.8, 0.8], [-0.2, 0.2]], [[0.8, 0.8], [0.2, 0.2]]]) {
      k.beam([x + a[0], 0, z + a[1]], [x + b[0], 11, z + b[1]], 0.06, '#5a6068');
    }
    k.slab(x - 2.4, 9.5, z - 0.1, x + 2.4, 9.7, z + 0.1, '#5a6068');
    k.slab(x - 1.6, 10.8, z - 0.1, x + 1.6, 11, z + 0.1, '#5a6068');
  };
  for (let z = -20; z < D + 40; z += 32) pylon(-14, z);
  for (let x = 4; x < W + 30; x += 32) pylon(x, D + 14);
  // Scrub and rocks out in the country.
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2, d = 82 + r() * 120;
    const x = W / 2 + Math.cos(a) * d, z = D / 2 + Math.sin(a) * d;
    if (x > -2 && x < W + 2 && z > -2 && z < D + 2) continue;
    if (r() < 0.75) k.sphere([x, 0.15, z], 0.5 + r() * 0.8, ['#6a7a3a', '#7a8044', '#5a6a32'][i % 3], { scale: [1, 0.6, 1] });
    else k.box([x, 0.3, z], [1 + r() * 2, 0.8 + r(), 1 + r() * 2], ['#8a6a4a', '#9a7a5a'][i % 2], { rot: [r(), r() * 3, r()] });
  }
  // Derricks and pumpjacks on the skyline, south and east.
  const derrick = (x, z, h) => {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.beam([x + a * 1.4, 0, z + b * 1.4], [x + a * 0.3, h, z + b * 0.3], 0.1, '#3a3034');
    for (let t = 2; t < h; t += 2.5) k.slab(x - 1.4 * (1 - t / h) - 0.3, t, z - 0.05, x + 1.4 * (1 - t / h) + 0.3, t + 0.12, z + 0.05, '#3a3034');
  };
  for (const [x, z, h] of [[40, D + 30, 16], [70, D + 44, 20], [104, D + 26, 14], [W + 30, 90, 18], [W + 46, 60, 22], [W + 26, 120, 15], [-30, D + 20, 17]]) derrick(x, z, h);
  // A water tower behind the suburbs, with the town's name on it.
  const tx = -16, tz = 14;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.beam([tx + a * 2.2, 0, tz + b * 2.2], [tx + a * 1.6, 12, tz + b * 1.6], 0.14, '#9aa0aa');
  k.cyl([tx, 13.8, tz], 3.2, 3.6, '#c8ccd2', { finish: 'shiny', segments: 28 });
  k.cone([tx, 16.6, tz], 3.4, 2, '#9aa0aa', { segments: 28 });
  k.cyl([tx, 13.8, tz], 3.22, 1.0, '#c8382c', { segments: 28, open: true });
  // A refinery's flare stacks out past the south-west corner, glowing.
  for (const [x, z, h] of [[-20, D - 10, 24], [-8, D + 24, 20]]) {
    k.cyl([x, h / 2, z], [0.6, 1.0], h, '#8a8f9a', { segments: 12 });
    k.sphere([x, h + 0.8, z], 0.9, '#ffb040', { finish: 'glow', scale: [1, 1.6, 1] });
  }
  // A mesa or two on the far east.
  k.box([W + 120, 9, 40], [70, 18, 40], '#a8705a', { rot: [0, 0.3, 0] });
  k.box([W + 140, 6, 110], [50, 12, 60], '#b47a62', { rot: [0, -0.2, 0] });
}
