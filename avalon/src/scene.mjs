// The isle of Avalon, drawn pixel by pixel.
//
// Layout (art pixels, the image is shown at 3x):
//   sky + HUD on top, far hills on the horizon, the castle on its island in
//   the middle (towers, windmill, guardian on his dais, keep with the beacon,
//   hall), the Rune Wall (contribution calendar) as the sea wall, and the sea
//   with reflections at the bottom.

import { Raster, rng, hash } from './raster.mjs';
import { grade, mix, shade, lum, nearest } from './color.mjs';
import { seasonPalette, guardianLegs, guardianBody, guardianEyes, ALLY, allyMap, emblem, icon, EYE } from './art.mjs';
import { text, measure } from './font.mjs';

export const W = 280, SH = 150;
const HUD_H = 11, HORIZON = 110, WATER = 131;
const WALL = { x: 33, y: 97, cols: 53, rows: 7 };
const COPE = 94, MERLON = 88;
const DAIS = { x0: 72, x1: 104, top: 84 };
const G = { gx: 69, gy: 60 };
const KEEP = { x0: 122, x1: 170, top: 36 };
const TURRET = { x0: 163, x1: 171, top: 28 };
const TOWERS = [{ x0: 16, top: 56 }, { x0: 246, top: 56 }];
const MILL = { cx: 49, top: 70, hx: 49, hy: 66 };
const HALL = { x0: 179, x1: 238, top: 72 };
const BEACON = { cx: 146, y: 32 };
const CRENELS = Array.from({ length: 19 }, (_, k) => 38 + 11 * k).filter((x) => x + 4 < DAIS.x0 - 1 || x > DAIS.x1 + 1);

const RAMP = ['st0', 'st1', 'st2', 'st3', 'st4', 'st5', 'st6'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ID = (k) => k;

/** A soft two-step halo around a light source. */
function halo(g, cx, cy, rad, col = '#ffb347') {
  g.a.disc(cx, cy, rad, col);
  g.b.disc(cx, cy, rad * 1.7 + 2, col);
}

function makeResolver(pal, light) {
  const cache = new Map();
  return (k) => {
    let v = cache.get(k);
    if (v) return v;
    if (k[0] === '#') v = k;
    else if (k[0] === '~') v = grade(k.slice(1), light);
    else {
      if (!pal[k]) throw new Error(`unknown palette key "${k}"`);
      v = grade(pal[k], light);
    }
    cache.set(k, v);
    return v;
  };
}

/** Per-column brightness offset for a cylinder lit from one side (ld = -1 left, +1 right). */
function cylShade(w, ld) {
  return Array.from({ length: w }, (_, i) => {
    let u = (i + 0.5) / w;
    if (ld > 0) u = 1 - u;
    return Math.round(1.6 * Math.cos(Math.PI * (u - 0.32)) - 0.5) - (u > 0.9 ? 1 : 0);
  });
}
const flatShade = (w, ld) => (i) => (ld < 0 ? (i === 0 ? 1 : i >= w - 2 ? -1 : 0) : (i === w - 1 ? 1 : i <= 1 ? -1 : 0));

/** Ashlar courses with joints, per-stone variation and side shading. */
function masonry(r, x0, y0, w, h, { seed = 1, shadeAt = () => 0, course = 4, stone = 7, base = 3 } = {}) {
  const rand = rng(seed), vari = new Map();
  for (let y = y0; y < y0 + h; y++) {
    const ry = (y - y0) % course, ci = Math.floor((y - y0) / course);
    const off = (ci % 2) * Math.floor(stone / 2);
    for (let x = x0; x < x0 + w; x++) {
      const jx = (x - x0 + off) % stone, si = Math.floor((x - x0 + off) / stone);
      const s = shadeAt(x - x0);
      let idx;
      if (ry === 0 || jx === 0) idx = 1 + (s > 0 ? 1 : 0) + (s < -1 ? -1 : 0);
      else {
        const key = ci * 997 + si;
        if (!vari.has(key)) { const v = rand(); vari.set(key, v < 0.14 ? -1 : v > 0.9 ? 1 : 0); }
        idx = base + vari.get(key) + (ry === 1 ? 1 : 0) + s;
      }
      r.set(x, y, RAMP[clamp(idx, 0, 6)]);
    }
  }
}

// Sky position of a body from its azimuth/altitude. We face south: east is left.
// Due south maps left of the keep, and altitude is compressed so a low winter
// sun still clears the rooftops instead of hiding behind the castle all day.
function skyXY(az, alt) {
  const x = az <= 180 ? 12 + ((az - 90) / 90) * 96 : 108 + ((az - 180) / 90) * 160;
  const lift = alt > 0 ? Math.pow(Math.min(1, alt / 40), 0.6) : -Math.min(1, -alt / 10) * 0.2;
  return { x: Math.round(clamp(x, 12, W - 12)), y: Math.round(Math.max(HUD_H + 8, 96 - 78 * lift)) };
}

export function drawScene(c, w) {
  const { pal, bare, blossom } = seasonPalette(w.season);
  const R = {
    world: makeResolver(pal, w.light.world),
    char: makeResolver(pal, w.light.char),
    far: makeResolver(pal, w.light.far),
    near: makeResolver(pal, w.light.near),
  };
  const kind = w.weather.kind;
  const wet = kind === 'rain' || kind === 'storm';
  const grey = wet || kind === 'overcast' || kind === 'fog' || kind === 'snow';
  const night = w.dark > 0.55;
  const dusky = w.dark > 0.3 || kind === 'storm';
  const lamps = w.dark > 0.26 || kind === 'storm' || (kind === 'fog' && w.dark > 0.12);
  const sunUp = w.sun.alt > 0, moonUp = w.moon.alt > 0;
  const ld = sunUp ? (w.sun.az < 180 ? -1 : 1) : moonUp ? (w.moon.az < 180 ? -1 : 1) : -1;
  const ctx = { c, w, pal, R, kind, wet, grey, night, dusky, lamps, ld, bare, blossom };
  const newR = (wd = W) => new Raster(wd, SH);

  c.def(`<clipPath id="sc"><rect x="2" y="2" width="${W - 4}" height="${SH - 2}"/></clipPath>`);
  const start = c.parts.length;

  sky(ctx);
  ctx.moonXY = moonUp ? skyXY(w.moon.az, w.moon.alt) : null;
  stars(ctx);
  celestial(ctx);
  farHills(ctx);
  mist(ctx, { y0: 96, y1: 113, seed: 3, opacity: kind === 'fog' ? 0.75 : 0.42, dur: 260 });
  clouds(ctx);
  if (kind === 'storm') lightning(ctx, 'bolt');
  if (!grey && !night && w.dark < 0.3 && w.weather.cloud < 90) gulls(ctx);
  if (w.event === 'halloween' && night) bats(ctx);
  if (w.event === 'newyear' && w.dark > 0.4) fireworks(ctx);

  const back = newR(), glow = newR(), glow2 = newR();
  const warm = { a: newR(), b: newR() }; // lamp light: inner and outer halo
  courtTree(back, ctx);
  windmill(back, ctx);
  hall(back, warm, ctx);
  keep(back, warm, ctx);
  TOWERS.forEach((t, i) => tower(back, warm, ctx, t, i));
  parapet(back, glow, ctx);
  runeWall(back, glow, glow2, ctx);
  island(back, ctx);
  cypress(back, ctx, 9, 114, 27);
  stonePine(back, ctx);
  if (kind === 'snow') snowCaps(back);
  ctx.back = back;
  c.raster(back, R.world);

  windmillSails(ctx);
  banners(ctx);
  flag(ctx);
  beacon(ctx, warm);
  torches(ctx, warm);
  chimneySmoke(ctx);
  if (w.event === 'winterfest' || w.event === 'christmas' || w.event === 'newyear') festiveLights(ctx);
  if (w.event === 'halloween') pumpkins(ctx, warm);
  c.raster(warm.b, ID, { opacity: night ? 0.08 : dusky ? 0.06 : 0.03 });
  c.raster(warm.a, ID, { opacity: night ? 0.16 : dusky ? 0.12 : 0.05 });
  c.raster(glow2, ID, { opacity: night ? 0.16 : dusky ? 0.1 : 0.04 });
  c.raster(glow, ID, { opacity: night ? 0.3 : dusky ? 0.2 : 0.06 });
  todayRune(ctx);
  allies(ctx);
  guardian(ctx);

  water(ctx);
  mist(ctx, { y0: 120, y1: 136, seed: 9, opacity: kind === 'fog' ? 0.6 : night ? 0.3 : 0.18, dur: 150 });
  if (kind === 'fog') mist(ctx, { y0: 34, y1: 140, seed: 17, opacity: 0.38, dur: 200, topAmp: 10, botAmp: 3 });
  if (w.season === 'summer' && night && !wet) fireflies(ctx);
  if (kind === 'rain' || kind === 'storm') rain(ctx);
  if (kind === 'snow') snow(ctx);
  if (kind === 'storm') lightning(ctx, 'flash');

  // Everything so far lives inside the scene's rounded frame.
  const body = c.parts.splice(start).join('');
  c.push(`<g clip-path="url(#sc)">${body}</g>`);
  hud(ctx);
}

// ---------------------------------------------------------------------------
// SKY
// ---------------------------------------------------------------------------
function sky({ c, w }) {
  const n = w.sky.length, bandH = HORIZON / n;
  let s = '';
  for (let i = 0; i < n; i++) {
    const y0 = Math.round(i * bandH), y1 = Math.round((i + 1) * bandH);
    s += `<rect y="${y0}" width="${W}" height="${y1 - y0}" fill="${w.sky[i]}"/>`;
  }
  // dithered seams between bands: 25%, 50%, 75%
  for (let i = 0; i < n - 1; i++) {
    const a = w.sky[i], b = w.sky[i + 1], y = Math.round((i + 1) * bandH), id = c.id('p');
    c.def(`<pattern id="${id}a" width="4" height="1" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${a}"/><rect width="1" height="1" fill="${b}"/></pattern>`
      + `<pattern id="${id}b" width="2" height="1" patternUnits="userSpaceOnUse"><rect width="2" height="1" fill="${a}"/><rect width="1" height="1" fill="${b}"/></pattern>`
      + `<pattern id="${id}c" width="4" height="1" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${b}"/><rect x="2" width="1" height="1" fill="${a}"/></pattern>`);
    s += `<rect y="${y - 2}" width="${W}" height="1" fill="url(#${id}a)"/><rect y="${y - 1}" width="${W}" height="1" fill="url(#${id}b)"/><rect y="${y}" width="${W}" height="1" fill="url(#${id}c)"/>`;
  }
  c.push(s);
}

function stars(ctx) {
  const { c, w, grey } = ctx;
  const vis = clamp((w.dark - 0.4) / 0.45, 0, 1);
  if (vis <= 0 || grey) return;
  const L = [new Raster(W, SH), new Raster(W, SH), new Raster(W, SH)];
  const rand = rng(7); // the same star field every night
  const m = ctx.moonXY;
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(rand() * W), y = HUD_H + 2 + Math.floor(Math.pow(rand(), 1.25) * 80);
    const b = rand();
    if (m && Math.abs(x - m.x) < 10 && Math.abs(y - m.y) < 10) continue;
    if (b < 0.35 && vis < 0.85) continue;
    const r = L[i % 3];
    r.set(x, y, b > 0.92 ? '#ffffff' : b > 0.7 ? '#dcdcff' : b > 0.4 ? '#a3a6e6' : '#6c70b2');
    if (b > 0.955) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) r.set(x + dx, y + dy, '#8288cc');
  }
  const tw = c.keyframes('tw', '0%{opacity:1}62%{opacity:.3}78%{opacity:1}100%{opacity:1}');
  c.raster(L[0], ID, { opacity: vis });
  c.raster(L[1], ID, { opacity: vis, anim: [tw, 3.7, 'step-end', -1.3] });
  c.raster(L[2], ID, { opacity: vis, anim: [tw, 5.3, 'step-end', -3.1] });

  // a shooting star now and then
  if (vis > 0.8 && w.weather.cloud < 60) {
    const sr = rng(w.seed);
    const x0 = 30 + Math.floor(sr() * 170), y0 = 16 + Math.floor(sr() * 20);
    const tail = ['#ffffff', '#dfe4ff', '#a9b0f0', '#7076c0', '#4a4e90'];
    let p = '';
    tail.forEach((col, i) => { p += `<rect x="${x0 - i * 2}" y="${y0 - i}" width="2" height="1" fill="${col}"/>`; });
    const k = c.keyframes('shoot', '0%,90%{opacity:0;transform:translate(0,0)}91%{opacity:1;transform:translate(0,0)}96%{opacity:1;transform:translate(34px,17px)}97%,100%{opacity:0;transform:translate(38px,19px)}');
    c.push(`<g opacity="0" style="animation:${k} 23s linear ${-Math.floor(sr() * 20)}s infinite">${p}</g>`);
  }
}

function celestial(ctx) {
  const { c, w, kind } = ctx;
  const body = new Raster(W, SH), halo = new Raster(W, SH), halo2 = new Raster(W, SH);
  let bodyOpacity = 1, haloOpacity = 0.22;

  if (w.sun.alt > -2 && !(kind === 'rain' || kind === 'storm')) {
    const p = skyXY(w.sun.az, w.sun.alt);
    const low = w.sun.alt < 9;
    const hazy = kind === 'overcast' || kind === 'fog' || kind === 'snow';
    const core = hazy ? '#f4f2ea' : low ? '#ffdc8e' : '#fff8e2';
    const rim = hazy ? '#d8d6d0' : low ? '#ff9f54' : '#ffe39a';
    const rad = low ? 5.4 : 4.4;
    body.disc(p.x, p.y, rad, (dx, dy, d) => (d > rad - 1 ? rim : core));
    halo.disc(p.x, p.y, rad + 4, low ? '#ffb46a' : '#fff0b8');
    halo2.disc(p.x, p.y, rad + 9, low ? '#ff9f54' : '#fff6d8');
    if (hazy) { bodyOpacity = 0.55; haloOpacity = 0.12; }
    ctx.sunXY = p;
  }

  if (ctx.moonXY && !(kind === 'rain' || kind === 'storm' || kind === 'overcast')) {
    const p = ctx.moonXY, rad = 5.3, ph = w.moon.phase, cs = Math.cos(2 * Math.PI * ph);
    const day = w.dark < 0.3;
    const r = day ? new Raster(W, SH) : body;
    r.disc(p.x, p.y, rad, (dx, dy, d) => {
      const u = dx / rad, v = clamp(dy / rad, -1, 1), e = Math.sqrt(1 - v * v);
      const lit = ph < 0.5 ? u > e * cs : u < -e * cs;
      if (!lit) return day ? null : '#2a2a54';
      const crater = (dx === -2 && dy === -1) || (dx === 1 && dy === 2) || (dx === 2 && dy === -2) || (dx === -1 && dy === 1) || (dx === -2 && dy === 2);
      return d > rad - 1.1 ? '#d4d0ec' : crater ? '#c6c2e2' : '#f4f2ff';
    });
    if (day) c.raster(r, ID, { opacity: 0.6 });
    else {
      halo.disc(p.x, p.y, rad + 4, '#c8c8ff');
      halo2.disc(p.x, p.y, rad + 10, '#a0a4f0');
      haloOpacity = 0.1 + 0.12 * w.moon.illum;
    }
  }
  c.raster(halo2, ID, { opacity: haloOpacity * 0.45 });
  c.raster(halo, ID, { opacity: haloOpacity });
  c.raster(body, ID, { opacity: bodyOpacity });
}

function farHills({ c, w, R }) {
  const far = new Raster(W, SH), near = new Raster(W, SH);
  for (let x = 0; x < W; x++) {
    const n1 = Math.sin(x * 0.031 + 1.3) * 6 + Math.sin(x * 0.083 + 4.1) * 3 + Math.sin(x * 0.21 + 0.7) * 1.2;
    const top = Math.round(84 + n1);
    for (let y = top; y < HORIZON; y++) far.set(x, y, y === top ? 'mt2' : 'mt1');
    const n2 = Math.sin(x * 0.05 + 2.2) * 4 + Math.sin(x * 0.13 + 5.0) * 2;
    const top2 = Math.round(101 + n2);
    for (let y = top2; y < HORIZON; y++) near.set(x, y, y === top2 ? 'mt1' : 'mt0');
  }
  c.raster(far, R.far);
  c.raster(near, R.near);
  // the far sea between horizon and the island
  const sea = new Raster(W, SH), wc = waterColors(w);
  for (let y = HORIZON; y < WATER; y++) {
    const t = (y - HORIZON) / (WATER - HORIZON);
    sea.hline(0, W - 1, y, y === HORIZON ? wc.hi : mix(wc.ramp[0], wc.ramp[2], t));
  }
  c.raster(sea, ID);
}

function waterColors(w) {
  const n = w.sky.length;
  const top = mix(mix(w.sky[n - 1], w.sky[n - 3], 0.5), '#0b0d29', 0.32);
  const bottom = mix(w.sky[1], '#05061a', 0.5);
  return { ramp: [0, 1, 2, 3, 4, 5].map((i) => mix(top, bottom, i / 5)), hi: mix(w.sky[n - 1], '#ffffff', 0.18) };
}

/** A drifting band of mist, periodic over the width so it loops seamlessly. */
function mist({ c, w }, { y0, y1, seed, opacity, dur, topAmp, botAmp }) {
  const r = new Raster(W * 2, SH), rand = rng(seed);
  const ph = [rand() * 6, rand() * 6, rand() * 6];
  const col = w.dark > 0.6 ? '#4a4c7e' : w.phase === 'dusk' || w.phase === 'dawn' ? '#e6b8c8' : '#eef0fa';
  const span = y1 - y0, ta = topAmp ?? span * 0.55, ba = botAmp ?? span * 0.25;
  for (let x = 0; x < W; x++) {
    const t = (x / W) * Math.PI * 2;
    const top = y0 + (0.5 + 0.3 * Math.sin(t * 3 + ph[0]) + 0.2 * Math.sin(t * 8 + ph[1])) * ta;
    const bot = y1 - (0.5 + 0.5 * Math.sin(t * 5 + ph[2])) * ba;
    for (let y = Math.round(top); y <= Math.round(bot); y++) {
      const edge = y === Math.round(top) || y === Math.round(bot);
      if (edge && (x + y) % 2) continue; // dithered fringe
      r.set(x, y, col); r.set(x + W, y, col);
    }
  }
  const name = w.wind.dir < 0
    ? c.keyframes('driftL', `from{transform:translateX(0)}to{transform:translateX(-${W}px)}`)
    : c.keyframes('driftR', `from{transform:translateX(-${W}px)}to{transform:translateX(0)}`);
  c.raster(r, ID, { opacity, anim: [name, dur / (1 + w.wind.cls * 0.5), `steps(${W})`] });
}

function cloudPalette(w, kind) {
  let p;
  if (w.phase === 'night' || w.phase === 'blue') p = ['#4c4c7e', '#373868', '#2a2b55', '#1f2045'];
  else if (w.phase === 'dawn' || w.phase === 'dusk') p = ['#ffd4aa', '#e99c8c', '#a8637c', '#6a3d68'];
  else if (w.phase === 'golden') p = ['#fff3d6', '#f6d2a6', '#c99c92', '#8c6c82'];
  else p = ['#ffffff', '#e4eaf6', '#b9c4dc', '#97a5c4'];
  if (kind === 'overcast' || kind === 'rain' || kind === 'snow' || kind === 'fog') p = p.map((x) => grade(x, { sat: 0.3, mul: [0.84, 0.84, 0.86] }));
  if (kind === 'storm') p = p.map((x) => grade(x, { sat: 0.2, mul: [0.52, 0.52, 0.58] }));
  return p;
}

/** A cumulus: a flat base with round bumps that rise toward the middle. */
function cloudShape(rand, cw, ch) {
  const n = 3 + Math.floor(cw / 10), circles = [];
  for (let b = 0; b < n; b++) {
    const t = (b + 0.5) / n, mid = Math.max(0, 1 - Math.abs(t - 0.5) * 2);
    // tallest bump reaches the top of the box; the outer ones stay low
    const rr = Math.max(2, ch * (0.3 + 0.27 * mid) + (rand() - 0.5) * 1.2);
    circles.push([t * cw + (rand() - 0.5) * 2, ch - rr * 0.75, rr]);
  }
  return (x, y) => y >= 0 && y < ch && x >= 0 && x < cw
    && ((y >= ch - 2 && x >= 1 && x < cw - 1) || circles.some(([a, b, r]) => (x - a) ** 2 + (y - b) ** 2 <= r * r));
}

function clouds({ c, w, kind }) {
  const cover = w.weather.cloud;
  let n = kind === 'clear' ? Math.round(cover / 22) : kind === 'partly' ? 3 + Math.round(cover / 30) : kind === 'fog' ? 2 : 7;
  n = Math.min(n, 8);
  if (!n) return;
  const pal = cloudPalette(w, kind);
  const r = new Raster(W * 2, SH), rand = rng(w.seed ^ 0x51);
  for (let i = 0; i < n; i++) {
    const big = kind !== 'clear' && kind !== 'partly';
    const cw = (big ? 30 : 18) + Math.floor(rand() * (big ? 28 : 22));
    const ch = Math.round(cw * (big ? 0.28 : 0.36)) + Math.floor(rand() * 2);
    const x = Math.floor(((i + rand() * 0.7) * W) / n);
    const y = HUD_H + 4 + Math.floor(rand() * (big ? 30 : 52));
    const inside = cloudShape(rand, cw, ch);
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
      if (!inside(xx, yy)) continue;
      let col = pal[1];
      if (yy >= ch - 1) col = pal[3];
      else if (yy >= ch - 3 && (yy === ch - 2 || (xx + yy) % 2)) col = pal[2];
      else if (!inside(xx, yy - 1) || (!inside(xx, yy - 2) && (xx + yy) % 2)) col = pal[0];
      for (const off of [-W, 0, W]) r.set(x + xx + off, y + yy, col);
    }
  }
  const name = w.wind.dir < 0
    ? c.keyframes('driftL', `from{transform:translateX(0)}to{transform:translateX(-${W}px)}`)
    : c.keyframes('driftR', `from{transform:translateX(-${W}px)}to{transform:translateX(0)}`);
  c.raster(r, ID, { anim: [name, [520, 380, 240, 140][w.wind.cls], `steps(${W})`] });
}

function gulls({ c, w }) {
  const rand = rng(w.seed ^ 0x9a11);
  const up = ['#...#', '.#.#.', '..#..'], down = ['..#..', '.#.#.', '#...#'];
  for (let i = 0; i < 2; i++) {
    const y = HUD_H + 12 + Math.floor(rand() * 30), dur = 38 + rand() * 20;
    const a = new Raster(12, 4), b = new Raster(12, 4);
    a.sprite(up, { '#': '#f4f4fa' }, 0, 0); b.sprite(down, { '#': '#f4f4fa' }, 0, 1);
    a.set(2, 2, '#9aa0b8'); b.set(2, 1, '#9aa0b8');
    const inner = c.frames([a, b], ID, 0.7, { wrap: (g) => g });
    const dir = rand() < 0.5 ? 1 : -1;
    const k = c.keyframes(`gull${i}${dir > 0 ? 'r' : 'l'}`, dir > 0
      ? `0%{transform:translate(-12px,${y}px)}30%{transform:translate(80px,${y - 3}px)}60%{transform:translate(170px,${y + 1}px)}100%{transform:translate(${W + 12}px,${y - 2}px)}`
      : `0%{transform:translate(${W + 12}px,${y}px)}35%{transform:translate(180px,${y + 2}px)}70%{transform:translate(80px,${y - 2}px)}100%{transform:translate(-12px,${y}px)}`);
    c.push(`<g style="animation:${k} ${dur.toFixed(1)}s linear ${(-rand() * dur).toFixed(1)}s infinite">${inner}</g>`);
  }
}

function bats({ c, w }) {
  const rand = rng(w.seed ^ 0xbad);
  const a = ['#.#.#', '.###.'], b = ['.#.#.', '#####'];
  for (let i = 0; i < 3; i++) {
    const y = HUD_H + 10 + Math.floor(rand() * 40), dur = 18 + rand() * 10;
    const fa = new Raster(6, 3), fb = new Raster(6, 3);
    fa.sprite(a, { '#': '#0a0814' }, 0, 0); fb.sprite(b, { '#': '#0a0814' }, 0, 0);
    const inner = c.frames([fa, fb], ID, 0.3, { wrap: (g) => g });
    const k = c.keyframes(`bat${i}`, `0%{transform:translate(-8px,${y}px)}25%{transform:translate(70px,${y - 6}px)}50%{transform:translate(140px,${y + 4}px)}75%{transform:translate(210px,${y - 4}px)}100%{transform:translate(${W + 8}px,${y}px)}`);
    c.push(`<g style="animation:${k} ${dur.toFixed(1)}s linear ${(-rand() * dur).toFixed(1)}s infinite">${inner}</g>`);
  }
}

function fireworks({ c, w }) {
  const rand = rng(w.seed ^ 0xf1e);
  const cols = ['#ff6b6b', '#f2d27a', '#62e6f0', '#6fdca0', '#e9a8ff'];
  for (let i = 0; i < 3; i++) {
    const cx = 30 + Math.floor(rand() * 220), cy = 22 + Math.floor(rand() * 30), col = cols[i % cols.length];
    const frames = [];
    for (const rad of [1, 3, 6, 8, 9, 0, 0, 0]) {
      const f = new Raster(W, SH);
      if (rad === 1) f.set(cx, cy, '#ffffff');
      else if (rad) for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        f.set(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad + (rad > 6 ? 1 : 0), rad > 8 ? mix(col, '#000000', 0.4) : col);
        if (rad < 8) f.set(cx + Math.cos(a) * (rad - 1), cy + Math.sin(a) * (rad - 1), '#ffffff');
      }
      frames.push(f);
    }
    c.frames(frames, ID, 2.4, { delay: -i * 0.8 });
  }
}

// ---------------------------------------------------------------------------
// THE CASTLE
// ---------------------------------------------------------------------------
function courtTree(r, { bare, blossom, w }) {
  const cx = 111, cy = 80;
  if (bare) {
    r.vline(cx, cy - 2, MERLON + 1, 'wd1');
    for (const [dx, dy] of [[-5, -4], [5, -5], [-3, -7], [3, -8], [-6, -1], [6, -2]]) r.line(cx, cy + 1, cx + dx, cy + dy, 'wd1');
    for (const [dx, dy] of [[-2, -5], [2, -6], [0, -8]]) r.line(cx, cy - 1, cx + dx, cy + dy, 'wd2');
    return;
  }
  const rand = rng(41), blobs = [[cx - 3, cy, 5], [cx + 3, cy - 1, 5.5], [cx, cy - 4, 5]];
  const inside = (x, y) => blobs.some(([a, b, rr]) => (x - a) ** 2 + (y - b) ** 2 <= rr * rr);
  r.vline(cx, cy + 3, MERLON + 1, 'wd1');
  for (let y = cy - 10; y <= cy + 6; y++) for (let x = cx - 9; x <= cx + 9; x++) {
    if (!inside(x, y)) continue;
    let k = 'lf2';
    if (!inside(x, y - 1) || !inside(x - 1, y - 1)) k = 'lf3';
    else if (!inside(x, y + 2)) k = 'lf0';
    else if (!inside(x + 1, y + 1) || (rand() < 0.22)) k = 'lf1';
    r.set(x, y, k);
    if (blossom && k !== 'lf0' && rand() < 0.12) r.set(x, y, '~' + blossom);
  }
}

function windmill(r, { ld, lamps, w }) {
  const { cx, top } = MILL, bottom = MERLON + 1;
  for (let y = top; y < bottom; y++) {
    const half = 4.5 + ((y - top) / (bottom - top)) * 2;
    const x0 = Math.round(cx - half), x1 = Math.round(cx + half), sh = cylShade(x1 - x0 + 1, ld);
    for (let x = x0; x <= x1; x++) r.set(x, y, ['ww0', 'ww0', 'ww1', 'ww2', 'ww3'][clamp(2 + sh[x - x0], 0, 4)]);
  }
  // door and a little window
  r.rect(cx - 1, 82, 3, 7, 'wd1'); r.set(cx, 81, 'wd1');
  r.rect(cx, 74, 1, 2, lamps ? '#ffc857' : 'gl0');
  // terracotta cap
  for (let y = top - 7; y < top; y++) {
    const half = 0.5 + ((y - (top - 7)) / 7) * 5.5;
    const x0 = Math.round(cx - half), x1 = Math.round(cx + half), sh = cylShade(x1 - x0 + 1, ld);
    for (let x = x0; x <= x1; x++) r.set(x, y, ['tc0', 'tc0', 'tc1', 'tc2', 'tc2'][clamp(2 + sh[x - x0], 0, 4)]);
  }
  r.hline(cx - 6, cx + 6, top, 'wd1');
  r.set(cx, top - 8, 'wd2');
}

function hall(r, warm, { ld, lamps }) {
  const { x0, x1, top } = HALL, wdt = x1 - x0 + 1;
  masonry(r, x0, top, wdt, MERLON + 2 - top, { seed: 77, shadeAt: flatShade(wdt, ld) });
  // three arched windows
  for (const wx of [x0 + 12, x0 + 29, x0 + 46]) {
    for (let y = top + 4; y < top + 11; y++) for (let x = wx - 2; x <= wx + 2; x++) {
      const arch = y === top + 4 && Math.abs(x - wx) === 2;
      if (arch) continue;
      const frame = Math.abs(x - wx) === 2 || y === top + 10 || (y === top + 4);
      r.set(x, y, frame ? 'st5' : lamps ? (x === wx ? '#ffe7a3' : '#ffb54a') : (y < top + 7 && x === wx - 1 ? 'gl2' : 'gl1'));
    }
    if (lamps) halo(warm, wx, top + 7, 5);
  }
  // roof
  const rTop = top - 13;
  for (let y = rTop; y < top; y++) {
    const t = (y - rTop) / (top - 1 - rTop);
    const a = Math.round(x0 + 8 - t * 10), b = Math.round(x1 - 8 + t * 10);
    for (let x = a; x <= b; x++) {
      let idx = (y - rTop) % 3 === 0 ? 1 : 2;
      if (idx === 2 && ((x + (y - rTop) * 2) % 4 === 0)) idx = 3;
      if (x - a < 2) idx += ld < 0 ? 1 : -1;
      if (b - x < 2) idx += ld < 0 ? -1 : 1;
      r.set(x, y, `rf${clamp(idx, 0, 4)}`);
    }
  }
  r.hline(x0 + 8, x1 - 8, rTop, 'au2');
  r.hline(x0 - 2, x1 + 2, top - 1, 'rf0');
  // chimney
  masonry(r, 224, rTop - 6, 5, 9, { seed: 5, course: 3, stone: 3, shadeAt: flatShade(5, ld) });
  r.hline(223, 229, rTop - 7, 'st5'); r.hline(224, 228, rTop - 6, 'st0');
}

function archWindow(r, warm, cx, y0, wd, h, lit) {
  const half = (wd - 1) / 2, ay = y0 + half;
  for (let y = y0; y < y0 + h; y++) for (let x = cx - half; x <= cx + half; x++) {
    const dx = x - cx, dy = y - ay;
    if (y < ay && dx * dx + dy * dy > half * half + 0.6) continue;
    const edge = y === y0 + h - 1 || Math.abs(dx) >= half || (y < ay && dx * dx + dy * dy > (half - 1) ** 2 + 0.6);
    let k;
    if (edge) k = 'au1';
    else if (dx === 0 || y === Math.round(ay) + 2) k = lit ? '#c9822f' : 'wd1';
    else if (lit) {
      const d = Math.sqrt(dx * dx + (y - (y0 + h * 0.6)) ** 2) / half;
      k = d < 0.55 ? '#fff0c2' : d < 1.1 ? '#ffd27a' : '#ffad47';
    } else k = (x - y) % 7 === 0 || (x - y) % 7 === 1 ? 'gl2' : 'gl1';
    r.set(x, y, k);
  }
  if (lit && warm) halo(warm, cx, y0 + h / 2, half + 3);
}

function keep(r, warm, { ld, lamps, w }) {
  const { x0, x1, top } = KEEP, wd = x1 - x0 + 1;
  const sh = flatShade(wd, ld);
  // merlons
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    const m = (x - (x0 - 1)) % 8 < 5;
    for (let y = top; y < top + 6; y++) {
      if (!m && y < top + 3) continue;
      r.set(x, y, y === top || (!m && y === top + 3) ? 'st5' : RAMP[clamp(4 + sh(clamp(x - x0, 0, wd - 1)), 0, 6)]);
    }
  }
  // corbelled ring
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    const s = sh(clamp(x - x0, 0, wd - 1));
    r.set(x, top + 6, RAMP[clamp(5 + s, 0, 6)]);
    r.set(x, top + 7, RAMP[clamp(4 + s, 0, 6)]);
    r.set(x, top + 8, (x - x0) % 3 === 0 ? RAMP[clamp(3 + s, 0, 6)] : 'st0');
  }
  masonry(r, x0, top + 9, wd, MERLON + 2 - top - 9, { seed: 12, shadeAt: sh });
  // great window and two small ones
  archWindow(r, warm, BEACON.cx, top + 18, 13, 19, lamps);
  archWindow(r, warm, x0 + 6, top + 42, 5, 7, lamps);
  archWindow(r, warm, x1 - 6, top + 42, 5, 7, lamps && w.seed % 3 !== 0);
  // Avalon mark above the great window
  emblem(r, BEACON.cx - 5, top + 12, 3);

  // beacon brazier (flames are animated separately)
  const { cx, y } = BEACON;
  r.hline(cx - 4, cx + 4, y, 'au3');
  r.hline(cx - 3, cx + 3, y + 1, 'au2');
  r.hline(cx - 2, cx + 2, y + 2, 'au1');
  r.rect(cx - 1, y + 3, 3, 1, 'au0');
  r.hline(cx - 3, cx + 3, y - 1, w.beacon ? '#7a2a14' : 'coal');
  if (w.beacon) { r.set(cx - 1, y - 1, '#ff8a2a'); r.set(cx + 2, y - 1, '#ffb347'); }
  else r.set(cx + 1, y - 1, 'ash');

  // flag turret on the corner
  const t = TURRET, tw = t.x1 - t.x0 + 1, ts = cylShade(tw, ld);
  masonry(r, t.x0, t.top + 2, tw, top + 6 - t.top - 2, { seed: 4, course: 3, stone: 4, shadeAt: (i) => ts[i] });
  for (let x = t.x0 - 1; x <= t.x1 + 1; x++) { r.set(x, t.top, 'st5'); r.set(x, t.top + 1, 'st3'); }
  cone(r, (t.x0 + t.x1) / 2, t.top - 8, t.top, tw + 3, ld);
  r.vline(Math.round((t.x0 + t.x1) / 2), t.top - 15, t.top - 9, 'au1');
  r.set(t.x0 + 4, t.top + 6, lamps ? '#ffc857' : 'gl0'); r.set(t.x0 + 4, t.top + 7, lamps ? '#ffc857' : 'gl0');
}

/** Conical roof, Avalon blue, with a gold finial. */
function cone(r, cx, tip, base, wd, ld) {
  for (let y = tip; y < base; y++) {
    const half = Math.max(0.5, ((y - tip + 1) / (base - tip)) * (wd / 2));
    const x0 = Math.round(cx - half), x1 = Math.round(cx + half), sh = cylShade(x1 - x0 + 1, ld);
    for (let x = x0; x <= x1; x++) {
      let idx = 2 + sh[x - x0];
      if ((base - y) % 3 === 0 && (x % 2 === 0)) idx -= 1;
      r.set(x, y, `rf${clamp(idx, 0, 4)}`);
    }
  }
  r.hline(Math.round(cx - wd / 2) - 1, Math.round(cx + wd / 2) + 1, base - 1, 'rf0');
  r.set(Math.round(cx), tip - 1, 'au2');
  r.set(Math.round(cx), tip - 2, 'au3');
}

function tower(r, warm, { ld, lamps, w }, { x0, top }, i) {
  const wd = 17, bottom = 129, sh = cylShade(wd, ld);
  masonry(r, x0, top + 4, wd, bottom - top - 4, { seed: 20 + i, course: 4, stone: 5, shadeAt: (k) => sh[k] });
  const ring = cylShade(wd + 2, ld);
  for (let k = 0; k < wd + 2; k++) {
    r.set(x0 - 1 + k, top, RAMP[clamp(5 + ring[k], 0, 6)]);
    r.set(x0 - 1 + k, top + 1, RAMP[clamp(4 + ring[k], 0, 6)]);
    r.set(x0 - 1 + k, top + 2, RAMP[clamp(4 + ring[k] - 1, 0, 6)]);
    r.set(x0 - 1 + k, top + 3, k % 3 === 0 ? RAMP[clamp(3 + ring[k], 0, 6)] : 'st0');
  }
  cone(r, x0 + (wd - 1) / 2, top - 17, top, wd + 5, ld);
  // arrow slits; some lit at night
  const cx = x0 + 8;
  [[top + 16, 0], [top + 30, 1], [top + 50, 2]].forEach(([y, n]) => {
    const lit = lamps && (hash(`${i}${n}${w.seed}`) % 3 !== 0);
    r.rect(cx, y, 1, 4, lit ? '#ffc857' : 'gl0');
    r.set(cx, y, lit ? '#ffe7a3' : 'gl0');
    if (lit) halo(warm, cx, y + 2, 3);
  });
}

function parapet(r, glow, { ld, w }) {
  // merlons
  for (let k = 0; k < 20; k++) {
    const mx = 32 + 11 * k;
    if (mx + 5 >= DAIS.x0 - 1 && mx <= DAIS.x1 + 1) continue;
    const sh = flatShade(6, ld);
    for (let y = MERLON; y < COPE; y++) for (let i = 0; i < 6; i++) {
      r.set(mx + i, y, y === MERLON ? 'st5' : y === MERLON + 3 ? 'st2' : RAMP[clamp(4 + sh(i) - (y > MERLON + 3 ? 1 : 0), 0, 6)]);
    }
  }
  // walkway shadow seen through the crenels
  for (const x of CRENELS) r.hline(x, x + 4, COPE - 1, 'st1');
  // coping
  r.hline(31, 247, COPE, 'st5');
  r.hline(31, 247, COPE + 1, 'st4');
  r.hline(31, 247, COPE + 2, 'st1');
  // the dais the guardian stands on
  const { x0, x1, top } = DAIS;
  masonry(r, x0, top + 1, x1 - x0 + 1, COPE - top - 1, { seed: 9, course: 4, stone: 8, base: 4, shadeAt: flatShade(x1 - x0 + 1, ld) });
  r.hline(x0, x1, top, 'st6');
  r.hline(x0, x1, top + 1, 'au2');
  r.hline(x0, x1, COPE - 1, 'au1');
  for (let x = x0 + 9; x <= x1 - 9; x++) for (let y = top + 3; y <= top + 7; y++) r.set(x, y, 'st2');
  emblem(r, x0 + 9, top + 3, 4);
  // torch brackets
  for (const tx of [x0 + 1, x1 - 1]) { r.rect(tx, top - 3, 1, 3, 'wd2'); r.set(tx, top - 4, 'wd1'); }
}

function runeWall(r, glow, glow2, { w, night }) {
  const { x, y, cols, rows } = WALL;
  r.rect(x, y, cols * 4 + 1, rows * 4 + 1, 'rn0');
  const grid = w.grid;
  // carved runes glow cyan: [corner, edge, core] per contribution level
  const RUNE = night
    ? [null, ['#24607a', '#3aa6bc', '#7fe6f0'], ['#2e98ae', '#56d4e2', '#c0fbff'], ['#46c4d6', '#86eef6', '#ecfeff'], ['#72e8f2', '#c4fbff', '#ffffff']]
    : [null, ['#2b6f80', '#3a9db0', '#6fd6e2'], ['#2f8fa2', '#48c0d0', '#a6f2f8'], ['#3aaec0', '#62e0ec', '#d4fcff'], ['#56d0de', '#9cf4fa', '#ffffff']];
  for (let cI = 0; cI < cols; cI++) for (let rI = 0; rI < rows; rI++) {
    const sx = x + 1 + cI * 4, sy = y + 1 + rI * 4;
    const day = grid[cI]?.[rI];
    const lvl = day ? day.level : 0;
    const h = hash(`${cI}:${rI}`);
    if (lvl === 0) {
      // weathered stone, wetter toward the waterline, with a little moss low down
      const b = (h % 10 < 2 ? -1 : h % 10 > 7 ? 1 : 0) - (rI >= 5 ? 1 : 0);
      const hi = `rn${clamp(3 + b, 1, 3)}`, mid = `rn${clamp(2 + b, 1, 3)}`, lo = `rn${clamp(1 + b, 1, 3)}`;
      r.rect(sx, sy, 3, 3, mid);
      switch ((h >> 4) % 4) { // a few different stone faces so the wall doesn't read as tiles
        case 0: r.hline(sx, sx + 2, sy, hi); r.set(sx, sy + 1, hi); r.hline(sx + 1, sx + 2, sy + 2, lo); r.set(sx + 2, sy + 1, lo); break;
        case 1: r.set(sx, sy, hi); r.set(sx + 1, sy, hi); r.hline(sx, sx + 2, sy + 2, lo); break;
        case 2: r.hline(sx, sx + 1, sy, hi); r.vline(sx + 2, sy, sy + 2, lo); r.set(sx + 1, sy + 1, (h >> 8) % 3 ? mid : lo); break;
        default: r.set(sx, sy, hi); r.set(sx + 2, sy + 2, lo); r.set(sx + 1, sy + 2, lo);
      }
      if (rI >= 4 && h % 9 === 0) r.set(sx + (h % 3), sy + 2, 'cy2');
      if (rI >= 5 && h % 13 === 1) r.hline(sx, sx + 1, sy + 2, 'cy1');
      if (!day) r.set(sx + 1, sy + 1, lo);
      continue;
    }
    const [corner, side, core] = RUNE[lvl];
    r.rect(sx, sy, 3, 3, corner);
    for (const [dx, dy] of [[1, 0], [0, 1], [2, 1], [1, 2]]) r.set(sx + dx, sy + dy, side);
    r.set(sx + 1, sy + 1, core);
    glow.rect(sx - 1, sy - 1, 5, 5, '#62e6f0');
    if (lvl >= 3) glow2.rect(sx - 2, sy - 2, 7, 7, '#62e6f0');
  }
}

function island(r, { w }) {
  const rand = rng(61);
  const profile = (x) => {
    if (x < 3) return null;
    if (x < 16) return Math.round(113 + Math.max(0, 11 - x) * 1.4 + Math.sin(x * 1.7) * 0.6);
    if (x > 277) return null;
    if (x > 263) return Math.round(113 + Math.max(0, x - 268) * 1.4 + Math.sin(x * 1.3) * 0.6);
    return 126 + (Math.sin(x * 0.7) > 0.6 ? -1 : 0) + (Math.sin(x * 2.3) > 0.8 ? 1 : 0);
  };
  for (let x = 0; x < W; x++) {
    const top = profile(x);
    if (top == null) continue;
    const tip = x < 16 || x > 263;
    for (let y = top; y < WATER + 1; y++) {
      const d = y - top;
      let k;
      if (tip && d === 0) k = 'gr3';
      else if (tip && d === 1) k = 'gr2';
      else if (tip && d === 2 && rand() < 0.6) k = 'gr1';
      else if (y >= WATER - 1) k = rand() < 0.5 ? 'rk0' : 'cy0';
      else {
        const n = rand();
        k = d < 2 ? 'rk4' : n < 0.12 ? 'rk1' : n < 0.5 ? 'rk2' : 'rk3';
        if (y > WATER - 4) k = n < 0.5 ? 'rk1' : 'rk2';
      }
      r.set(x, y, k);
    }
  }
}

function cypress(r, { ld }, cx, base, h) {
  for (let y = base - h; y <= base; y++) {
    const t = (y - (base - h)) / h;
    const half = 0.3 + 2.6 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.6) * (1 - t * 0.3);
    const x0 = Math.round(cx - half), x1 = Math.round(cx + half);
    for (let x = x0; x <= x1; x++) {
      const u = x1 === x0 ? 0.5 : (x - x0) / (x1 - x0), lit = ld < 0 ? 1 - u : u;
      let k = lit > 0.7 ? 'cy3' : lit > 0.35 ? 'cy2' : 'cy1';
      if ((x * 3 + y * 2) % 7 === 0) k = 'cy1';
      if (x === x0 || x === x1) k = 'cy0';
      r.set(x, y, k);
    }
  }
  r.rect(cx, base - 1, 1, 2, 'wd1');
}

function stonePine(r, { ld }) {
  // trunk, leaning
  for (const [x, y] of [[271, 113], [271, 112], [270, 111], [270, 110], [270, 109], [269, 108], [269, 107], [269, 106], [268, 105], [268, 104], [268, 103], [267, 102], [267, 101], [266, 100]]) {
    r.set(x, y, 'wd1'); r.set(x + 1, y, 'wd2');
  }
  r.line(268, 103, 273, 99, 'wd1');
  // umbrella canopy
  const blobs = [[260, 97, 4], [265, 95.5, 4.5], [271, 96, 4.5], [276, 97.5, 3.5]];
  const inside = (x, y) => y <= 99 && blobs.some(([a, b, rr]) => (x - a) ** 2 / 1.3 + ((y - b) * 1.6) ** 2 <= rr * rr);
  for (let y = 88; y <= 100; y++) for (let x = 254; x <= 280; x++) {
    if (!inside(x, y)) continue;
    let k = 'cy2';
    if (!inside(x, y - 1)) k = 'cy3';
    else if (!inside(x, y + 1)) k = 'cy0';
    else if ((x + y * 3) % 5 === 0) k = 'cy1';
    r.set(x, y, k);
  }
}

/** Snow settles on every surface that faces the sky. */
function snowCaps(r) {
  for (let x = 0; x < r.w; x++) for (let y = 1; y < r.h - 1; y++) {
    const k = r.get(x, y);
    if (k == null || k[0] === '#' || r.get(x, y - 1) != null) continue;
    r.set(x, y, 'sn2');
    if (y + 1 < WATER && hash(`${x},${y}`) % 2) r.set(x, y + 1, 'sn1');
  }
}

// ---------------------------------------------------------------------------
// ANIMATED PARTS OF THE CASTLE
// ---------------------------------------------------------------------------
function windmillSails({ c, R, w }) {
  const frames = [0, 30, 60].map((deg) => {
    const r = new Raster(W, SH), { hx, hy } = MILL;
    for (let k = 0; k < 4; k++) {
      const a = ((deg + k * 90) * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), vx = uy, vy = -ux;
      for (let t = 3; t <= 10; t += 0.5) for (let s = 0.5; s <= Math.min(3.4, t * 0.42); s += 0.5) {
        r.set(hx + ux * t + vx * s, hy + uy * t + vy * s, t > 9.4 || s > 3 ? 'ww2' : 'ww3');
      }
      for (let t = 1; t <= 10.5; t += 0.5) r.set(hx + ux * t, hy + uy * t, 'wd2');
    }
    r.rect(hx - 1, hy - 1, 2, 2, 'wd1');
    return r;
  });
  // the sails turn with the real wind: becalmed below 6 km/h
  const period = [0, 1.5, 0.9, 0.45][w.wind.cls];
  c.frames(period ? frames : [frames[0]], R.world, period);
}

const LANG_ABBR = {
  JavaScript: 'JS', TypeScript: 'TS', Python: 'PY', 'C++': 'C++', 'C#': 'C#', 'Objective-C': 'OBJC', Java: 'JAVA', Kotlin: 'KT',
  Go: 'GO', Rust: 'RS', Ruby: 'RB', Swift: 'SWFT', Dart: 'DART', Lua: 'LUA', HTML: 'HTML', CSS: 'CSS', PHP: 'PHP', Shell: 'SH',
  'ASP.NET': 'ASP', Vue: 'VUE', Svelte: 'SVLT', GDScript: 'GD', Haskell: 'HS', Elixir: 'EX', Scala: 'SCA', Zig: 'ZIG',
  'Jupyter Notebook': 'IPYN', Mathematica: 'MATH', R: 'R', Julia: 'JL', 'Visual Basic .NET': 'VB', Assembly: 'ASM',
};
export const langAbbr = (name) => LANG_ABBR[name] || name.replace(/[^A-Za-z0-9#+]/g, '').slice(0, 4).toUpperCase();

function banners({ c, w, R }) {
  const langs = w.stats.languages.slice(0, 4);
  if (!langs.length) return;
  const slots = [[KEEP.x0 + 5, KEEP.top + 9], [KEEP.x1 - 11, KEEP.top + 9], [TOWERS[0].x0 + 5, TOWERS[0].top + 4], [TOWERS[1].x0 + 5, TOWERS[1].top + 4]];
  const topShare = langs[0].share;
  const make = (sway) => {
    const r = new Raster(W, SH);
    langs.forEach((l, i) => {
      const [x, y] = slots[i];
      const abbr = langAbbr(l.name);
      const len = Math.max(12 + 6 * abbr.length - 6, Math.round(12 + 16 * (l.share / topShare)));
      const base = l.color || '#8a8aa0';
      const hi = `~${shade(base, 0.28)}`, mid = `~${base}`, lo = `~${shade(base, -0.35)}`;
      r.hline(x - 1, x + 7, y, 'au2'); r.set(x - 1, y, 'au3'); r.set(x + 7, y, 'au3');
      for (let j = 1; j < len; j++) {
        const s = sway && j > len / 2 ? sway : 0;
        for (let k = 0; k < 7; k++) {
          if (j === len - 1 && (k === 2 || k === 3 || k === 4)) continue;
          if (j === len - 2 && k === 3) continue;
          r.set(x + k + s, y + j, j === 1 ? 'au1' : k === 0 ? hi : k === 6 ? lo : mid);
        }
      }
      const ink = lum(base) > 0.5 ? '~#16142e' : '~#f4f2ff';
      [...abbr].forEach((ch, n) => {
        const yy = y + 3 + n * 6, s = sway && yy - y > len / 2 ? sway : 0;
        text(r, ch, x + 2 + s - (measure(ch) > 3 ? 1 : 0), yy, { color: ink });
      });
    });
    return r;
  };
  const period = [0, 1.6, 1.0, 0.6][w.wind.cls];
  c.frames(period ? [make(0), make(w.wind.dir)] : [make(0)], R.char, period);
}

function flag({ c, w, R }) {
  const px = Math.round((TURRET.x0 + TURRET.x1) / 2), py = TURRET.top - 15, d = w.wind.dir;
  const cloth = (r, x, y, edge) => r.set(x, y, edge ? 'au2' : 'rf1');
  const make = (f) => {
    const r = new Raster(W, SH);
    if (w.wind.cls === 0) { // hanging limp
      for (let y = 1; y <= 6; y++) { cloth(r, px + d, py + y, y === 6); cloth(r, px + 2 * d, py + y, y === 6); }
      r.set(px + d, py + 3, 'au3');
      return r;
    }
    for (let i = 1; i <= 8; i++) {
      const wave = Math.round(Math.sin(i * 0.9 - f * 2.1) * (i / 8) * 1.2);
      for (let j = 0; j < 5; j++) cloth(r, px + i * d, py + 1 + j + wave, j === 4 || i === 8);
    }
    r.set(px + 4 * d, py + 3 + Math.round(Math.sin(4 * 0.9 - f * 2.1) * 0.6), 'au3');
    r.set(px + 3 * d, py + 3 + Math.round(Math.sin(3 * 0.9 - f * 2.1) * 0.45), 'au2');
    r.set(px + 5 * d, py + 3 + Math.round(Math.sin(5 * 0.9 - f * 2.1) * 0.75), 'au2');
    return r;
  };
  const period = [0, 1.2, 0.75, 0.45][w.wind.cls];
  c.frames(period ? [make(0), make(1), make(2)] : [make(0)], R.world, period);
}

function flameRaster(cx, baseY, fw, fh, f) {
  const r = new Raster(W, SH), rand = rng(100 + f * 7 + fw);
  for (let j = 0; j < fh; j++) {
    const t = j / fh;
    const half = (fw / 2) * (1 - Math.pow(t, 1.25)) + (rand() - 0.5) * 0.8;
    const sway = Math.round(Math.sin(t * 3.2 + f * 2.1) * t * 1.6);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = Math.abs(x - cx) / Math.max(0.6, half);
      const k = u < 0.38 && t < 0.5 ? '#fff4c4' : u < 0.72 && t < 0.78 ? '#ffd25a' : u <= 1.05 && t < 0.92 ? '#ff8a2a' : '#e0442a';
      r.set(x + sway, baseY - 1 - j, k);
    }
  }
  r.set(cx + (f - 1) * 2, baseY - fh - 1 - (f % 2), '#ff8a2a');
  return r;
}

function beacon({ c, w }, warm) {
  const { cx, y } = BEACON;
  if (!w.beacon) {
    // a cold brazier: only a thread of smoke
    const k = c.keyframes('smoke', '0%{transform:translate(0,0);opacity:.7}100%{transform:translate(0,-12px);opacity:0}');
    for (let i = 0; i < 3; i++) {
      c.push(`<rect x="${cx + (i % 2)}" y="${y - 2}" width="1" height="1" fill="#8a8494" opacity="0" style="animation:${k} 3s steps(12) ${-i}s infinite"/>`);
    }
    return;
  }
  const fw = [0, 4, 6, 8][w.beacon], fh = [0, 6, 9, 12][w.beacon];
  c.frames([0, 1, 2].map((f) => flameRaster(cx, y, fw, fh, f)), ID, 0.42);
  for (let i = 0; i < 4; i++) {
    const dx = ((i % 2) ? 1 : -1) * (2 + i);
    const ember = c.keyframes(`ember${dx}`, `0%{transform:translate(0,0);opacity:1}100%{transform:translate(${dx}px,-16px);opacity:0}`);
    c.push(`<rect x="${cx}" y="${y - fh}" width="1" height="1" fill="#ffd25a" opacity="0" style="animation:${ember} 2.2s steps(16) ${(-i * 0.55).toFixed(2)}s infinite"/>`);
  }
  halo(warm, cx, y - fh / 2, fh * 0.6 + 2, '#ff9a3a');
}

function torches({ c, w, lamps }, warm) {
  if (!lamps) return;
  const frames = [0, 1].map((f) => {
    const r = new Raster(W, SH);
    for (const tx of [DAIS.x0 + 1, DAIS.x1 - 1]) {
      r.set(tx, DAIS.top - 5, '#ff8a2a'); r.set(tx, DAIS.top - 6, f ? '#ffd25a' : '#ff8a2a');
      r.set(tx + (f ? 1 : -1), DAIS.top - 7, '#e0442a');
      r.set(tx, DAIS.top - 5, '#fff4c4');
    }
    return r;
  });
  c.frames(frames, ID, 0.5);
  for (const tx of [DAIS.x0 + 1, DAIS.x1 - 1]) halo(warm, tx, DAIS.top - 6, 3);
}

function chimneySmoke({ c, w }) {
  const cold = (w.weather.temp ?? 15) < 16 || w.season === 'winter';
  if (!cold) return;
  const x = 226, y = HALL.top - 21, d = w.wind.dir * (1 + w.wind.cls);
  const col = w.dark > 0.5 ? '#4a4a66' : '#b8b6c8';
  const k = c.keyframes(`puff${d}`, `0%{transform:translate(0,0);opacity:.85}100%{transform:translate(${d * 3}px,-14px);opacity:0}`);
  for (let i = 0; i < 4; i++) {
    c.push(`<rect x="${x - 1 + (i % 2)}" y="${y}" width="${2 + (i % 2)}" height="2" fill="${col}" opacity="0" style="animation:${k} 4s steps(14) ${-i}s infinite"/>`);
  }
}

function festiveLights({ c, w }) {
  const cols = ['#ff6b6b', '#f2d27a', '#6fdca0', '#62e6f0'];
  const a = new Raster(W, SH), b = new Raster(W, SH), wire = new Raster(W, SH);
  let n = 0;
  for (let x = 33; x < 246; x++) {
    const sag = Math.round(Math.sin(((x - 33) / 11) * Math.PI) ** 2 * 1.6);
    wire.set(x, COPE + 2 + sag, '#1a1424');
    if ((x - 33) % 6 === 3) (n++ % 2 ? a : b).set(x, COPE + 3 + sag, cols[n % 4]);
  }
  c.raster(wire, ID);
  c.frames([a, b], ID, 1.4);
  c.frames([b, a], ID, 1.4);
}

function pumpkins({ c, w }, warm) {
  const r = new Raster(W, SH);
  for (const k of [1, 4, 9, 14, 17]) {
    const mx = 32 + 11 * k + 1;
    if (mx + 5 >= DAIS.x0 - 1 && mx <= DAIS.x1 + 1) continue;
    r.rect(mx, MERLON - 3, 4, 3, '~#e07a1f'); r.set(mx + 1, MERLON - 4, '~#4a6a2a');
    if (w.dark > 0.4) { r.set(mx + 1, MERLON - 2, '#ffd25a'); r.set(mx + 2, MERLON - 2, '#ffd25a'); halo(warm, mx + 1.5, MERLON - 2, 2, '#ff9a3a'); }
  }
  c.raster(r, makeResolver({}, w.light.world));
}

function todayRune({ c, w }) {
  const col = w.grid.findIndex((wk) => wk && wk.some((d) => d && d.isToday));
  if (col < 0) return;
  const row = w.grid[col].findIndex((d) => d && d.isToday);
  const sx = WALL.x + col * 4, sy = WALL.y + row * 4;
  const k = c.keyframes('caret', '0%{opacity:1}50%{opacity:0}100%{opacity:0}');
  const col2 = w.stats.todayCount > 0 ? '#ffffff' : '#f2d27a';
  c.push(`<path d="M${sx} ${sy}h5v5h-5zM${sx + 1} ${sy + 1}v3h3v-3z" fill-rule="evenodd" fill="${col2}" style="animation:${k} 1.2s step-end infinite"/>`);
}

// ---------------------------------------------------------------------------
// CHARACTERS
// ---------------------------------------------------------------------------
function allies({ c, w, R }) {
  const n = Math.min(w.stats.followers, CRENELS.length);
  if (!n) return;
  const asleep = w.local.hh >= 1 && w.local.hh < 6;
  const groups = [new Raster(W, SH), new Raster(W, SH)];
  const used = Array.from({ length: n }, (_, i) => CRENELS[Math.round(((i + 0.5) * CRENELS.length) / n - 0.5)]);
  used.forEach((x, i) => {
    const r = groups[i % 2];
    const metal = hash(`ally${i}`) % 3 === 0 ? 'bronze' : 'steel';
    const map = { ...allyMap(metal) };
    if (asleep) map.E = 'visor';
    r.sprite(ALLY, map, x, MERLON - 1);
    if (i % 2 === 0) { // spear bearers
      r.vline(x + 4, MERLON - 9, MERLON + 1, 'wd2');
      r.set(x + 4, MERLON - 10, 'sl3'); r.set(x + 4, MERLON - 11, 'sl2');
    }
  });
  if (asleep) {
    const z = c.keyframes('zz', '0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(3px,-8px);opacity:0}');
    const zr = new Raster(W, SH);
    text(zr, 'Z', used[0] + 3, MERLON - 9, { color: '#c9c5ee' });
    c.raster(zr, ID, { anim: [z, 3, 'steps(8)'] });
  }
  const bob = c.keyframes('abob', '0%{transform:translateY(0)}50%{transform:translateY(1px)}100%{transform:translateY(1px)}');
  c.raster(groups[0], R.char, { anim: [bob, 3.4, 'step-end', -0.7] });
  c.raster(groups[1], R.char, { anim: [bob, 4.1, 'step-end', -2.2] });
}

function guardian({ c, w, R, night }) {
  const { gx, gy } = G;
  const legs = new Raster(W, SH);
  legs.hline(gx + 12, gx + 27, DAIS.top, 'st4');
  legs.hline(gx + 14, gx + 25, DAIS.top, 'st3');
  guardianLegs(legs, gx, gy);
  c.raster(legs, R.char);

  const flutter = w.wind.cls >= 1;
  const bodies = [0, 1].map((f) => { const r = new Raster(W, SH); guardianBody(r, gx, gy, { flutter: f && flutter, dir: w.wind.dir }); return r; });
  const open = new Raster(W, SH), shut = new Raster(W, SH), glow = new Raster(W, SH);
  guardianEyes(open, gx, gy, { mood: w.mood });
  guardianEyes(shut, gx, gy, { mood: w.mood, blink: true });
  for (const a of [5, 11]) glow.rect(gx + 11 + a - 1, gy + 11 + 4, 4, 5, EYE[w.mood]);

  const parts = [];
  parts.push(c.frames(bodies, R.char, flutter ? [0, 1.4, 0.9, 0.5][w.wind.cls] : 0, { wrap: (g) => g }));
  if (night) parts.push(c.group(c.paths(glow, ID), { opacity: 0.3 }));
  const blinkO = c.keyframes('eyeO', '0%{opacity:1}95.7%{opacity:0}100%{opacity:0}');
  const blinkS = c.keyframes('eyeS', '0%{opacity:0}95.7%{opacity:1}100%{opacity:1}');
  parts.push(`<g style="animation:${blinkO} 4.7s step-end infinite">${c.paths(open, ID)}</g>`);
  parts.push(`<g opacity="0" style="animation:${blinkS} 4.7s step-end infinite">${c.paths(shut, ID)}</g>`);
  // a glint runs up the blade every few seconds
  const sx = gx + 11 + 19, top = gy + 11 - 8;
  const glint = c.keyframes('glint', '0%{transform:translateY(0);opacity:.95}17%{transform:translateY(-12px);opacity:.95}17.1%{opacity:0}100%{opacity:0;transform:translateY(-12px)}');
  parts.push(`<rect x="${sx}" y="${top + 13}" width="2" height="1" fill="#ffffff" opacity="0" style="animation:${glint} 7s steps(12) infinite"/>`);

  const bob = c.keyframes('gbob', '0%{transform:translateY(0)}50%{transform:translateY(1px)}100%{transform:translateY(1px)}');
  c.push(`<g style="animation:${bob} 4s step-end infinite">${parts.join('')}</g>`);
}

// ---------------------------------------------------------------------------
// WATER
// ---------------------------------------------------------------------------
function water({ c, w, back, R, kind, grey }) {
  const wc = waterColors(w);
  const reflPal = [...wc.ramp, ...wc.ramp.map((x) => mix(x, '#ffffff', 0.1)), ...wc.ramp.map((x) => mix(x, '#000000', 0.25))];
  const glowPal = ['#3aa6b8', '#5fd8e4', '#a8eef4', '#d8903a', '#ffd27a', '#ff8a2a'];
  const frame = (f) => {
    const r = new Raster(W, SH);
    for (let y = WATER; y < SH; y++) {
      const d = y - WATER, srcY = WATER - 1 - d, base = wc.ramp[Math.min(5, Math.floor(d / 3))];
      const gap = d % 4 === 3;
      for (let x = 0; x < W; x++) {
        let col = base;
        if (!gap) {
          const off = Math.round(Math.sin(d * 1.7 + x * 0.11 + f * 2.4) * (0.6 + d * 0.07));
          const k = back.get(x + off, srcY);
          if (k) {
            const src = R.world(k);
            col = k[0] === '#' ? nearest(mix(src, base, 0.3), glowPal) : nearest(mix(src, base, 0.6), reflPal);
          }
        }
        r.set(x, y, col);
      }
    }
    // glints on the water
    const rand = rng(300 + f);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rand() * W), y = WATER + 2 + Math.floor(rand() * (SH - WATER - 3)), len = 2 + Math.floor(rand() * 3);
      r.hline(x, x + len, y, wc.hi);
    }
    // a path of light under the sun or moon
    const src = (w.dark > 0.5 ? ctxMoon(w) : null) || (w.sun.alt > 0 && !grey ? skyXY(w.sun.az, w.sun.alt) : null);
    if (src) {
      const col = w.dark > 0.5 ? '#d8dcff' : w.sun.alt < 9 ? '#ffc070' : '#fff0c0';
      for (let y = WATER + 1; y < SH; y += 2) {
        const half = 1 + Math.floor(rand() * 3) + Math.floor((y - WATER) / 7);
        const off = Math.floor(rand() * 3) - 1;
        r.hline(src.x - half + off, src.x + half + off, y, col);
      }
    }
    // foam where the sea meets the rocks
    for (let x = 0; x < W; x++) if (back.get(x, WATER - 1) && hash(`${x}${f}`) % 5 === 0) r.set(x, WATER, '#e9ecf8');
    return r;
  };
  c.frames([frame(0), frame(1)], ID, 1.8);
  if (kind === 'rain' || kind === 'storm') ripples(c, w);
}
const ctxMoon = (w) => (w.moon.alt > 0 && !['rain', 'storm', 'overcast', 'fog', 'snow'].includes(w.weather.kind) ? skyXY(w.moon.az, w.moon.alt) : null);

function ripples(c, w) {
  const rand = rng(w.seed ^ 0x77);
  const k = c.keyframes('ripple', '0%{opacity:1}33%{opacity:0}100%{opacity:0}');
  let s = '';
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rand() * W), y = WATER + 3 + Math.floor(rand() * 15), d = -(rand() * 1.2).toFixed(2);
    s += `<rect x="${x}" y="${y}" width="1" height="1" fill="#c9d2f0" style="animation:${k} 1.2s step-end ${d}s infinite"/>`;
    s += `<path d="M${x - 1} ${y}h1v1h-1zM${x + 1} ${y}h1v1h-1z" fill="#9aa6d6" opacity="0" style="animation:${k} 1.2s step-end ${(d - 0.4).toFixed(2)}s infinite"/>`;
  }
  c.push(s);
}

// ---------------------------------------------------------------------------
// WEATHER
// ---------------------------------------------------------------------------
function rain({ c, w }) {
  const lvl = w.weather.level || 2, slant = w.wind.cls >= 2 ? w.wind.dir : 0;
  const col = w.dark > 0.5 ? ['#5c6aa4', '#8090c8'] : ['#9fb0d8', '#d0dcf4'];
  const layer = (count, len, dur, color, seed) => {
    const rand = rng(seed);
    let d = '';
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * (W + 40)) - 20, y = Math.floor(rand() * SH);
      for (const off of [0, -SH]) {
        for (let j = 0; j < len; j++) d += `M${x + Math.floor((j * slant) / 2)} ${y + off + j}h1v1h-1z`;
      }
    }
    const dx = slant * Math.round(SH / 2);
    const k = c.keyframes(`fall${seed}`, `from{transform:translate(0,0)}to{transform:translate(${dx}px,${SH}px)}`);
    c.push(`<g style="animation:${k} ${dur}s steps(${Math.round(SH / 3)}) infinite"><path fill="${color}" d="${d}"/></g>`);
  };
  layer(30 * lvl, 2, 1.1, col[0], 11);
  layer(22 * lvl, 3, 0.65, col[1], 12);
}

function snow({ c, w }) {
  const lvl = w.weather.level || 2;
  const layer = (count, size, dur, color, seed) => {
    const rand = rng(seed);
    let d = '';
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * W), y = Math.floor(rand() * SH);
      for (const off of [0, -SH]) d += `M${x} ${y + off}h${size}v${size}h-${size}z`;
    }
    const k = c.keyframes(`snow${seed}`, `from{transform:translate(0,0)}to{transform:translate(${w.wind.dir * 10}px,${SH}px)}`);
    const sway = c.keyframes('sway', '0%{transform:translateX(0)}50%{transform:translateX(2px)}100%{transform:translateX(0)}');
    c.push(`<g style="animation:${sway} 3s steps(2) infinite"><g style="animation:${k} ${dur}s steps(${SH}) infinite"><path fill="${color}" d="${d}"/></g></g>`);
  };
  layer(30 * lvl, 1, 9, '#d6def4', 21);
  layer(16 * lvl, 2, 6, '#ffffff', 22);
}

/** The bolt lives in the sky, behind the castle; the flash lights up everything in front. */
function lightning({ c, w }, part) {
  const k = c.keyframes('bolt', '0%,61%{opacity:0}62%{opacity:1}63%{opacity:0}65%{opacity:1}67%,100%{opacity:0}');
  if (part === 'flash') {
    c.push(`<rect width="${W}" height="${SH}" fill="#dfe6ff" fill-opacity=".28" opacity="0" style="animation:${k} 7.3s step-end infinite"/>`);
    return;
  }
  const rand = rng(w.seed ^ 0x1e);
  // strike through open sky: between the windmill and the guardian, or over the hall
  const [a, b, end] = rand() < 0.4 ? [60, 68, 84] : [184, 234, 60];
  let x = a + Math.floor(rand() * (b - a)), y = HUD_H + 2, d = '';
  while (y < end) {
    const len = 3 + Math.floor(rand() * 4);
    d += `M${x} ${y}h1v${len}h-1z`;
    y += len; x += rand() < 0.5 ? -1 : 1;
    if (rand() < 0.25) d += `M${x + 1} ${y}h1v3h-1z`;
  }
  c.push(`<path d="${d}" fill="#f4f7ff" opacity="0" style="animation:${k} 7.3s step-end infinite"/>`);
}

function fireflies({ c, w }) {
  const rand = rng(w.seed ^ 0xf17);
  const k = c.keyframes('fly', '0%{opacity:0;transform:translate(0,0)}30%{opacity:1}70%{opacity:1;transform:translate(3px,-4px)}100%{opacity:0;transform:translate(5px,-2px)}');
  let s = '';
  for (let i = 0; i < 8; i++) {
    const near = i % 2 ? [4, 20] : [255, 278];
    const x = near[0] + Math.floor(rand() * (near[1] - near[0])), y = 96 + Math.floor(rand() * 18);
    s += `<rect x="${x}" y="${y}" width="1" height="1" fill="#d8ff7a" opacity="0" style="animation:${k} ${(3 + rand() * 2).toFixed(1)}s steps(6) ${(-rand() * 4).toFixed(1)}s infinite"/>`;
  }
  c.push(s);
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function hud({ c, w }) {
  c.push(`<rect x="2" y="2" width="${W - 4}" height="9" fill="#0b0d29" opacity=".6"/>`);
  const r = new Raster(W, SH);
  for (let x = 2; x < W - 2; x++) r.set(x, 11, x % 2 ? '#3d3a66' : '#b2892c');
  emblem(r, 5, 5, 3, { up: '#e6bd4e', upHi: '#f7dc84', down: '#b2892c' });
  let x = 19;
  x += text(r, w.cfg.city, x, 4, { color: '#e9e6ff' }) + 4;
  x += text(r, '·', x, 4, { color: '#5d5887' }) + 4;
  x += text(r, w.local.label, x, 4, { color: '#9a94c9' }) + 4;
  x += text(r, '·', x, 4, { color: '#5d5887' }) + 4;
  text(r, w.local.time, x, 4, { color: '#f7dc84' });

  const wx = w.weather, k = wx.kind;
  const ic = k === 'clear' ? (w.dark > 0.5 ? 'moon' : 'sun') : k === 'partly' ? (w.dark > 0.5 ? 'partlyN' : 'partly')
    : k === 'overcast' ? 'cloud' : k === 'fog' ? 'fog' : k === 'snow' ? 'snow' : k === 'storm' ? 'storm' : 'rain';
  const parts = [];
  if (wx.missing) parts.push(['NO WEATHER REPORT', '#9a94c9']);
  else {
    if (wx.temp != null) parts.push([`${Math.round(wx.temp)}°C`, '#f7dc84']);
    parts.push([wx.label, '#e9e6ff']);
    parts.push([`${w.wind.dir > 0 ? '→' : '←'} ${Math.round(wx.wind)} KM/H`, '#9a94c9']);
  }
  let total = 0;
  parts.forEach(([s], i) => { total += measure(s) + (i ? 12 : 0); });
  let rx = W - 5 - total;
  icon(r, ic, rx - 10, 3);
  parts.forEach(([s, col], i) => {
    if (i) { text(r, '·', rx + 4, 4, { color: '#5d5887' }); rx += 12; }
    rx += text(r, s, rx, 4, { color: col });
  });
  c.raster(r, ID);
}
