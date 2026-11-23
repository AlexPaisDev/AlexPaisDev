// A pixel buffer that holds palette keys (or literal '#rrggbb' colours), plus the
// code that turns it into compact SVG: runs of equal colour are merged into
// rectangles, and every colour becomes one <path> using relative moves.

export class Raster {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (c == null || !this.inside(x, y)) return;
    this.px[y * this.w + x] = c;
  }

  get(x, y) {
    x = Math.round(x); y = Math.round(y);
    return this.inside(x, y) ? this.px[y * this.w + x] : null;
  }

  clear(x, y) {
    x = Math.round(x); y = Math.round(y);
    if (this.inside(x, y)) this.px[y * this.w + x] = null;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c); }
  vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c); }

  /** Bresenham line. */
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Filled disc; fn(dx, dy, d) may return a colour per pixel. */
  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d <= r) this.set(x, y, typeof c === 'function' ? c(dx, dy, d) : c);
      }
    }
  }

  /** Stamp an ASCII sprite. map: char -> colour; '.' and ' ' are transparent. */
  sprite(rows, map, x, y, { flip = false } = {}) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const c = map[ch];
        if (c === undefined) throw new Error(`sprite: no colour for '${ch}'`);
        this.set(flip ? x + row.length - 1 - i : x + i, y + j, c);
      }
    });
  }

  /** Copy non-empty pixels of another raster on top of this one. */
  blit(src, dx = 0, dy = 0) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.px[y * src.w + x];
      if (c != null) this.set(x + dx, y + dy, c);
    }
  }

  isEmpty() { return this.px.every((p) => p == null); }
}

/** Merge equal-colour runs into rectangles (horizontal runs, then stacked vertically). */
function toRects(r, resolve) {
  const cache = new Map();
  const res = (k) => {
    if (!cache.has(k)) cache.set(k, resolve(k));
    return cache.get(k);
  };
  const open = new Map();
  const done = [];
  for (let y = 0; y < r.h; y++) {
    const seen = new Set();
    let x = 0;
    while (x < r.w) {
      const k = r.px[y * r.w + x];
      const col = k == null ? null : res(k);
      if (!col) { x++; continue; }
      let x2 = x + 1;
      while (x2 < r.w) {
        const k2 = r.px[y * r.w + x2];
        if (k2 == null || res(k2) !== col) break;
        x2++;
      }
      const key = `${x},${x2 - x},${col}`;
      const o = open.get(key);
      if (o) o.h++;
      else open.set(key, { x, y, w: x2 - x, h: 1, col });
      seen.add(key);
      x = x2;
    }
    for (const [key, o] of open) if (!seen.has(key)) { done.push(o); open.delete(key); }
  }
  for (const o of open.values()) done.push(o);
  return done;
}

function pathData(rects) {
  rects.sort((a, b) => a.y - b.y || a.x - b.x);
  let d = '', px = 0, py = 0;
  rects.forEach((q, i) => {
    d += i === 0 ? `M${q.x} ${q.y}` : `m${q.x - px} ${q.y - py}`;
    d += `h${q.w}v${q.h}h-${q.w}z`;
    px = q.x; py = q.y;
  });
  return d;
}

/** Raster -> SVG <path> elements (one per colour). */
export function rasterToSVG(r, resolve) {
  const byCol = new Map();
  for (const q of toRects(r, resolve)) {
    if (!byCol.has(q.col)) byCol.set(q.col, []);
    byCol.get(q.col).push(q);
  }
  let out = '';
  for (const [col, rects] of byCol) out += `<path fill="${col}" d="${pathData(rects)}"/>`;
  return out;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable integer hash of a string. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
