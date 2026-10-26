/**
 * The screen, on Alan's engine (`vendor/gfx`): WebGPU where the browser has
 * it and WebGL 2 where it does not, the same physically based shading, glass
 * and shadows the eye is drawn with. A perspective camera that starts at the
 * isometric corner and can be turned, tilted and zoomed round wherever the
 * hamster is (`view.js`).
 *
 * It is night in Petroleum Springs, as it is in Rock 'n' Roller's venues:
 * a dim wash, the moon high up for the shadows, a lantern over the hamster,
 * and the real light of the lamps nearest it (`LAMP_LIGHTS` of them, a
 * fixed number); every other lamp is baked into the ground (`map.js`).
 */

import * as GFX from 'madness-engine/gfx';
import { Renderer } from 'madness-engine/gfx/renderer';
import { WebGLBackend } from 'madness-engine/gfx/webgl';
import { WebGPUBackend } from 'madness-engine/gfx/webgpu';
import { createView } from 'madness-engine/views/town';
import { paintRoom } from 'madness-engine/textures/rooms/town';
import { paintSky } from 'madness-engine/textures/skies/town';

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

/** Where the moon is: high, behind the camera's left shoulder at the start, for the shadows. */
export const MOON = Object.freeze(new GFX.Vector3(-0.35, 1, 0.55).normalize());

/** How many of the town's lamps get a real light at once (the nearest the hamster). The count is fixed, so no shader ever changes. */
export const LAMP_LIGHTS = 6;

/** Round the sky dome (SphereGeometry's u), and round the reflections (equirectangular). */
const domeU = (dx, dz) => ((Math.atan2(dz, -dx) / (Math.PI * 2)) % 1 + 1) % 1;

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

  // Night: a dim blue wash, the moon for the shadows, a lantern over the hamster, and the lamps nearest it lit for real.
  const hemi = new GFX.HemisphereLight(0x7a88c0, 0x2a1c14, 0.55);
  scene.add(hemi);
  const key = new GFX.DirectionalLight(0xb8c6ff, 0.75);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  // The shadows cover what's in view: further out, a wider square.
  let span = 0;
  const shadowSpan = (zoom) => {
    const want = Math.ceil(14 * Math.max(1, zoom));
    if (want === span) return;
    span = want;
    Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 100 + span * 2 });
    key.shadow.camera.updateProjectionMatrix();
  };
  shadowSpan(1);
  scene.add(key, key.target);
  const lantern = new GFX.PointLight(0xffe2b8, 2.2, 12, 1.1);
  scene.add(lantern);
  const lampLights = Array.from({ length: LAMP_LIGHTS }, () => {
    const light = new GFX.PointLight(0xffffff, 0, 8, 1.2);
    scene.add(light);
    return light;
  });

  // Opaque all round: the glass refracts whatever is behind it, and over
  // nothing at all it would bend the renderer's stand-in grey.
  const sky = paintSky(domeU);
  const skyMap = sky ? new GFX.CanvasTexture(sky) : null;
  if (skyMap) skyMap.colorSpace = GFX.SRGBColorSpace;
  const backdrop = new GFX.Mesh(
    new GFX.SphereGeometry(300, 64, 32),
    new GFX.MeshBasicMaterial({ name: 'backdrop', map: skyMap, color: new GFX.Color(skyMap ? '#ffffff' : '#070a1c'), side: GFX.BackSide, depthWrite: false }),
  );
  backdrop.renderOrder = -1;
  backdrop.frustumCulled = false;
  backdrop.onBeforeRender = (r, s, cam) => {
    backdrop.position.copy(cam.position);
    backdrop.updateMatrixWorld();
  };
  scene.add(backdrop);

  const room = paintRoom();
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
    GFX, renderer, scene, camera, key, hemi, lantern, lampLights,
    /** Where the hamster is, for the lantern; set every frame. */
    hamster: new GFX.Vector3(),
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
    key.position.copy(stage.target).addScaledVector(MOON, 45 + span);
    key.target.position.copy(stage.target);
    key.target.updateMatrixWorld();
    lantern.position.set(stage.hamster.x + 0.6, stage.hamster.y + 3.5, stage.hamster.z + 0.6);
  };

  const fit = () => renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
  fit();
  new ResizeObserver(fit).observe(host);

  stage.render = () => renderer.render(scene, camera);
  return stage;
}
