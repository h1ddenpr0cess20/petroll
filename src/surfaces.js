/**
 * What the ground is made of, tile by tile: how it looks (`top`, and `wall`
 * for the sides where it stands above its neighbour) and how it rolls.
 *
 * - `drag`: rolling resistance, per second. Grass and dirt hold the bubble
 *   back; an oil slick hardly does.
 * - `grip`: how much of the push the hamster gets on it. On oil it is
 *   running in place.
 * - `sinks`: tar. Roll in and the bubble goes under.
 */
export const SURFACES = Object.freeze({
  grass: { top: '#6f9e4c', wall: '#6a4a2c', drag: 1.1, grip: 1, map: '#5f8a3e' },
  lawn: { top: '#7cb257', wall: '#6a4a2c', drag: 1.0, grip: 1, map: '#6da24a' },
  road: { top: '#44464c', wall: '#55575c', drag: 0.5, grip: 1, map: '#3a3c42' },
  highway: { top: '#3d3f45', wall: '#55575c', drag: 0.45, grip: 1, map: '#33353a' },
  sidewalk: { top: '#bdb8ab', wall: '#9a958a', drag: 0.55, grip: 1, map: '#a9a497' },
  concrete: { top: '#aaa69c', wall: '#8b877e', drag: 0.55, grip: 1, map: '#9c988e' },
  forecourt: { top: '#b4b0a6', wall: '#8b877e', drag: 0.55, grip: 1, map: '#c2bdb0' },
  brick: { top: '#a8644c', wall: '#7c4434', drag: 0.6, grip: 1, map: '#9a5a44' },
  dirt: { top: '#9c7a52', wall: '#6a4a2c', drag: 0.9, grip: 0.95, map: '#9c7a52' },
  sand: { top: '#d6b878', wall: '#a88a50', drag: 1.4, grip: 0.9, map: '#c9a96a' },
  gravel: { top: '#9b948a', wall: '#6e675e', drag: 1.0, grip: 0.95, map: '#8a8378' },
  metal: { top: '#8c939b', wall: '#5a6068', drag: 0.45, grip: 1, map: '#7a8189' },
  roof: { top: '#7a4a3a', wall: '#e6dccb', drag: 0.6, grip: 1, map: '#6a4034' },
  flatroof: { top: '#8a8a8e', wall: '#9aa0aa', drag: 0.55, grip: 1, map: '#7c7c80' },
  oil: { top: '#16161b', wall: '#2a2a30', drag: 0.05, grip: 0.22, map: '#101014' },
  wet: { top: '#56646e', wall: '#55575c', drag: 0.2, grip: 0.55, map: '#4a5862' },
  tar: { top: '#0a0a0c', wall: '#1a1a1e', drag: 6, grip: 0.1, sinks: true, map: '#060608' },
  pool: { top: '#8ccbe2', wall: '#dff0f5', drag: 0.45, grip: 1, map: '#7cc0dc' },
  plank: { top: '#9a7448', wall: '#6a4a2c', drag: 0.6, grip: 1, map: '#8a6440' },
  berm: { top: '#8c9a5a', wall: '#6a4a2c', drag: 1.2, grip: 1, map: '#7c8a4c' },
});

export const surfaceOf = (cell) => SURFACES[cell?.surface] ?? SURFACES.road;
