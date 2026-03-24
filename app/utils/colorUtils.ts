/**
 * Color utility functions for fluid simulation
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Converts HSV color space to RGB color space.
 *
 * @param h - Hue [0, 1]
 * @param s - Saturation [0, 1]
 * @param v - Value (brightness) [0, 1]
 * @param intensity - Multiplier for brightness [default 1.0]
 * @returns RGB color with values in [0, 1] range
 */
export function HSVtoRGB(
  h: number,
  s: number,
  v: number,
  intensity: number = 1.0,
): RGBColor {
  let r = 0;
  let g = 0;
  let b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      r = g = b = 0;
  }

  return {
    r: r * intensity,
    g: g * intensity,
    b: b * intensity,
  };
}

/**
 * Generates a rainbow color based on timestamp (cycles through hue).
 * Useful for animated color effects.
 *
 * @param timestamp - Current timestamp (e.g., Date.now())
 * @param speed - Speed of color cycling (default: 20)
 * @param intensity - Brightness multiplier (default: 0.5)
 * @returns RGB color
 */
export function getColor(
  timestamp: number,
  speed: number = 20,
  intensity: number = 0.5,
): RGBColor {
  const hue = ((timestamp / speed) % 360) / 360;
  return HSVtoRGB(hue, 1.0, 1.0, intensity);
}
