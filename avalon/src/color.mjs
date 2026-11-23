// Small colour helpers. Colours are '#rrggbb' strings throughout.

export const hex2rgb = (h) => {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgb2hex = (c) =>
  '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export const mix = (a, b, t) => {
  const x = hex2rgb(a), y = hex2rgb(b);
  return rgb2hex(x.map((v, i) => v + (y[i] - v) * t));
};

/** Relative luminance, 0..1. */
export const lum = (h) => {
  const [r, g, b] = hex2rgb(h);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** k > 0 lightens toward white, k < 0 darkens toward black. */
export const shade = (h, k) => (k >= 0 ? mix(h, '#ffffff', k) : mix(h, '#000000', -k));

/**
 * Colour grading used for time-of-day and weather lighting:
 * desaturate, multiply per channel, add, then optionally pull toward a haze colour.
 */
export function grade(h, { mul = [1, 1, 1], add = [0, 0, 0], sat = 1, haze = null, k = 0 } = {}) {
  let [r, g, b] = hex2rgb(h);
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  r = l + (r - l) * sat;
  g = l + (g - l) * sat;
  b = l + (b - l) * sat;
  let out = [r * mul[0] + add[0], g * mul[1] + add[1], b * mul[2] + add[2]];
  if (haze && k) {
    const t = hex2rgb(haze);
    out = out.map((v, i) => v + (t[i] - v) * k);
  }
  return rgb2hex(out);
}

/** Nearest colour from a list (plain RGB distance, fine for small palettes). */
export function nearest(h, list) {
  const [r, g, b] = hex2rgb(h);
  let best = list[0], bd = Infinity;
  for (const c of list) {
    const [x, y, z] = hex2rgb(c);
    const d = (x - r) ** 2 * 0.3 + (y - g) ** 2 * 0.59 + (z - b) ** 2 * 0.11;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
