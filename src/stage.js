/**
 * The screen, on Alan's engine (`vendor/gfx`): WebGPU where the browser has
 * it and WebGL 2 where it does not, the same physically based shading, glass
 * and shadows the eye is drawn with. A perspective camera that starts at the
 * isometric corner and can be turned, tilted and zoomed round wherever the
 * hamster is (`view.js`).
 *
 * It is always early evening in Petroleum Springs: a low sun that casts the
 * shadows (following the play), a sky wash, a cool fill. The sky is painted
 * at startup, and what the plastic, the paint and the puddles reflect is
 * the same sky.
 */

import * as GFX from './vendor/gfx/index.js';
import { Renderer } from './vendor/gfx/renderer.js';
import { WebGLBackend } from './vendor/gfx/webgl.js';
import { WebGPUBackend } from './vendor/gfx/webgpu.js';
import { createView } from './view.js';

/** How far back the camera sits at zoom 1, and its lens. Where round the marble it is, is the view's (`view.js`). */
export const LENS = Object.freeze({ distance: 10, fov: 36 });


async function createRenderer(preference) {
  if (preference !== 'webgl' && typeof navigator !== 'undefined' && navigator.gpu) {
    const canvas = document.createElement('canvas');
    try {
      return new Renderer(await WebGPUBackend.create(canvas), canvas);
    } catch (err) {
      if (preference === 'webgpu') throw err;
      console.warn('petroll: WebGPU unavailable, falling back to WebGL 2.', err);
    }
  }
  const canvas = document.createElement('canvas');
  return new Renderer(new WebGLBackend(canvas), canvas);
}

/** Where the sun is: low in the west-south-west, behind the camera's left shoulder at the start, for long evening shadows. */
export const SUN = Object.freeze(new GFX.Vector3(-0.15, 0.42, 0.9).normalize());

const SKY = [[0, '#22305a'], [0.25, '#3c4a7a'], [0.4, '#7a6a8c'], [0.47, '#d88a72'], [0.5, '#f2b07a'], [0.515, '#d8a088'], [0.6, '#b48a7a'], [1, '#6a5a52']];

/**
 * The sky at golden hour, as an equirectangular canvas: deep blue overhead
 * going to violet and then to peach at the horizon, the sun's glow, a
 * ridge of far hills with derricks and a town on it. `u(dx, dz)` says
 * where round the canvas a direction is, which differs between the sky
 * dome and the reflections.
 */
function paintSky(u, { width = 2048, ridge = true } = {}) {
  const height = width / 2;
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  for (const [t, col] of SKY) g.addColorStop(t, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  const horizon = height / 2;
  // The sun, low, and its glow along the horizon.
  const sx = u(SUN.x, SUN.z) * width, sy = horizon - (Math.asin(SUN.y) / Math.PI) * height;
  for (const ox of [-width, 0, width]) {
    const glow = ctx.createRadialGradient(sx + ox, sy, 0, sx + ox, sy, height * 0.5);
    glow.addColorStop(0, 'rgba(255,236,190,0.95)');
    glow.addColorStop(0.08, 'rgba(255,200,140,0.6)');
    glow.addColorStop(0.35, 'rgba(255,150,100,0.18)');
    glow.addColorStop(1, 'rgba(255,150,100,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff6dc';
    ctx.beginPath();
    ctx.arc(sx + ox, sy, height * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  // Streaks of cloud, lit underneath.
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const y = horizon - height * (0.04 + r() * 0.2), x = r() * width, w = width * (0.05 + r() * 0.12);
    ctx.fillStyle = `rgba(${230 + r() * 25},${150 + r() * 50},${130 + r() * 30},${0.12 + r() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, height * (0.004 + r() * 0.006), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!ridge) return c;
  // Far hills, purple in the haze, with the odd derrick and a town's lights on them.
  ctx.fillStyle = '#8a6a78';
  ctx.beginPath();
  ctx.moveTo(0, horizon + 4);
  for (let x = 0; x <= width; x += 8) ctx.lineTo(x, horizon - 6 - 10 * (0.5 + 0.5 * Math.sin(x / 90)) - 8 * Math.sin(x / 23 + 1) ** 2);
  ctx.lineTo(width, horizon + 4);
  ctx.fill();
  ctx.fillStyle = '#6a5262';
  for (let i = 0; i < 18; i++) {
    const x = r() * width, h = 10 + r() * 14, base = horizon - 8;
    ctx.beginPath();
    ctx.moveTo(x - 4, base); ctx.lineTo(x, base - h); ctx.lineTo(x + 4, base); ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = width * 0.62 + r() * width * 0.08, h = 6 + r() * 22;
    ctx.fillRect(x, horizon - 8 - h, 3 + r() * 5, h);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,${200 + r() * 55},140,${0.4 + r() * 0.5})`;
    ctx.fillRect(width * 0.62 + r() * width * 0.08, horizon - 8 - r() * 20, 1.5, 1.5);
  }
  return c;
}

/** Round the sky dome (SphereGeometry's u), and round the reflections (equirectangular). */
const domeU = (dx, dz) => ((Math.atan2(dz, -dx) / (Math.PI * 2)) % 1 + 1) % 1;
const envU = (dx, dz) => Math.atan2(dz, dx) / (Math.PI * 2) + 0.5;

export async function createStage(host) {
  const preference = new URLSearchParams(globalThis.location?.search ?? '').get('renderer');
  const renderer = await createRenderer(preference);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = GFX.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new GFX.Scene();
  const camera = new GFX.PerspectiveCamera(LENS.fov, 1, 0.3, 400);

  if (renderer.isWebGPU && preference !== 'webgpu') {
    renderer.backend.onLost = () => {
      const old = renderer.domElement;
      const canvas = document.createElement('canvas');
      try {
        renderer.setBackend(new WebGLBackend(canvas), canvas);
        old.replaceWith(canvas);
        console.warn('petroll: the GPU went away; carrying on with WebGL 2.');
      } catch (err) {
        console.error('petroll: the GPU went away and WebGL 2 is not available.', err);
      }
    };
  }

  // Evening: a blue sky wash from above and warm bounce from the ground, the low sun, a cool fill opposite.
  scene.add(new GFX.HemisphereLight(0xa8bce8, 0x6a5038, 0.85));
  const key = new GFX.DirectionalLight(0xffd6a8, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  // The shadows cover what's in view: further out, a wider square.
  let span = 0;
  const shadowSpan = (zoom) => {
    const want = Math.ceil(16 * Math.max(1, zoom));
    if (want === span) return;
    span = want;
    Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 100 + span * 2 });
    key.shadow.camera.updateProjectionMatrix();
  };
  shadowSpan(1);
  scene.add(key, key.target);
  const fill = new GFX.DirectionalLight(0x8aa0d8, 0.45);
  scene.add(fill, fill.target);

  // Opaque all round: the glass refracts whatever is behind it, and over
  // nothing at all it would bend the renderer's stand-in grey.
  const sky = paintSky(domeU);
  const skyMap = sky ? new GFX.CanvasTexture(sky) : null;
  if (skyMap) skyMap.colorSpace = GFX.SRGBColorSpace;
  const backdrop = new GFX.Mesh(
    new GFX.SphereGeometry(300, 64, 32),
    new GFX.MeshBasicMaterial({ name: 'backdrop', map: skyMap, color: new GFX.Color(skyMap ? '#ffffff' : '#d8a088'), side: GFX.BackSide, depthWrite: false }),
  );
  backdrop.renderOrder = -1;
  backdrop.frustumCulled = false;
  backdrop.onBeforeRender = (r, s, cam) => {
    backdrop.position.copy(cam.position);
    backdrop.updateMatrixWorld();
  };
  scene.add(backdrop);

  const room = paintSky(envU, { width: 1024, ridge: false });
  if (room) {
    const texture = new GFX.Texture(room);
    texture.mapping = GFX.EquirectangularReflectionMapping;
    texture.colorSpace = GFX.SRGBColorSpace;
    texture.needsUpdate = true;
    const pmrem = new GFX.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(texture).texture;
    pmrem.dispose();
  }

  const stage = {
    GFX, renderer, scene, camera, key,
    view: createView(),
    target: new GFX.Vector3(),
  };

  const direction = new GFX.Vector3();

  /** Point the camera and the lights at `stage.target`, from where the view is; called every frame. */
  stage.look = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    camera.aspect = w / h;
    // An upright phone sees as much course across as a wide screen does.
    camera.fov = LENS.fov * Math.max(1, Math.min(1.75, 0.8 * h / w));
    camera.updateProjectionMatrix();
    direction.set(...stage.view.direction());
    camera.position.copy(stage.target).addScaledVector(direction, LENS.distance * stage.view.zoom);
    shadowSpan(stage.view.zoom);
    camera.lookAt(stage.target);
    camera.updateMatrixWorld();
    key.position.copy(stage.target).addScaledVector(SUN, 45 + span);
    key.target.position.copy(stage.target);
    key.target.updateMatrixWorld();
    fill.position.copy(stage.target).add(new GFX.Vector3(4, 5, -8));
    fill.target.position.copy(stage.target);
    fill.target.updateMatrixWorld();
  };

  const fit = () => renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
  fit();
  new ResizeObserver(fit).observe(host);

  stage.render = () => renderer.render(scene, camera);
  return stage;
}
