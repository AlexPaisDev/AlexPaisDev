// The status screen under the scene, in the style of an RPG menu:
// character card with level and XP, stats, a quest log of recent public
// repositories, the inventory (tools of the trade), the achievements, and a
// dialog box where the guardian reports. A cursor walks the inventory and the
// medals, and a tooltip describes whatever it points at.

import { Raster } from './raster.mjs';
import { text, measure, fit } from './font.mjs';
import { emblem, icon, EYE } from './art.mjs';
import { ITEMS, achievements, medal, drawItem, TIER_NAMES, TIER_COLORS } from './inventory.mjs';
import { wrap } from './world.mjs';
import { W, SH, langAbbr } from './scene.mjs';

const TOP = SH + 2;
// vertical layout
const L = {
  name: TOP + 5, sub: TOP + 16, div1: TOP + 22,
  rows: TOP + 26, div2: TOP + 68,
  sec: TOP + 72, grid: TOP + 79,
  tip: TOP + 115,
  box: TOP + 137,
};
const BOX_H = 27;
export const H = L.box + BOX_H + 5;

const INV = { x: 9, cols: 9, rows: 2 };
const ACH = { x: 167, cols: 4 };
const PITCH = 16;
const DWELL = 2; // seconds the cursor rests on each slot

const ID = (k) => k;
const INK = '#e9e6ff', INK2 = '#9a94c9', INK3 = '#5d5887', GOLD = '#f7dc84', GOLD2 = '#e6bd4e', LINE = '#3d3a66';
const CHROME = ['#ffffff', '#eef1f8', '#d9deea', '#b7bfd2', '#c9cfe0', '#e3e7f2', '#f6f8fc'];
const BOX = '#0a0b22', SLOT = '#1b1c48', SLOT_HI = '#232458';

const fmt = (n) => (n >= 10000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const full = (n) => Number(n).toLocaleString('en-US');

function ago(iso, now) {
  const d = Math.floor((now - new Date(iso)) / 864e5);
  if (d <= 0) return 'TODAY';
  if (d < 14) return `${d}D`;
  if (d < 60) return `${Math.floor(d / 7)}W`;
  if (d < 365) return `${Math.floor(d / 30)}MO`;
  return `${Math.floor(d / 365)}Y`;
}

function dotted(r, x0, x1, y, col = LINE) { for (let x = x0; x <= x1; x += 2) r.set(x, y, col); }
function dottedV(r, x, y0, y1, col = LINE) { for (let y = y0; y <= y1; y += 2) r.set(x, y, col); }

/** The inventory list from the config (unknown keys are skipped), at most one full grid. */
export function inventoryKeys(cfg) {
  const keys = (cfg.inventory || Object.keys(ITEMS)).filter((k) => ITEMS[k]);
  return keys.slice(0, INV.cols * INV.rows);
}

export function drawPanel(c, w) {
  const s = w.stats, p = w.cfg;

  // background
  const bands = ['#17183f', '#141539', '#121334', '#10112f', '#0e0f2a', '#0c0d26'];
  const bh = (H - TOP) / bands.length;
  c.push(bands.map((col, i) => `<rect x="2" y="${Math.round(TOP + i * bh)}" width="${W - 4}" height="${Math.min(Math.ceil(bh) + 1, H - 2 - Math.round(TOP + i * bh))}" fill="${col}"/>`).join(''));

  const r = new Raster(W, H);
  card(r, s, p);
  dotted(r, 7, W - 8, L.div1);
  statRows(r, s);
  questLog(r, s, w.now);
  dotted(r, 7, W - 8, L.div2);

  const keys = inventoryKeys(p);
  const achs = achievements(s);
  inventory(r, keys, s);
  medals(r, achs);
  tooltipBox(r);
  c.raster(r, ID);

  cursor(c, keys, achs, s);
  dialog(c, w);
  frame(c);
}

// --- character card ------------------------------------------------------------
// line 1: name ............................................ LEVEL n
// line 2: class · region   XP [=========-----] a/b      ON GITHUB SINCE y
function card(r, s, p) {
  text(r, p.name, 9, L.name, { font: 'big', color: (row) => CHROME[row], outline: '#05061a' });
  const lv = String(s.level), lvW = measure(lv, { font: 'big' });
  text(r, lv, W - 9 - lvW, L.name, { font: 'big', color: (row) => CHROME[row], outline: '#05061a' });
  text(r, 'LEVEL', W - 9 - lvW - 5 - measure('LEVEL'), L.name + 2, { color: GOLD });

  const y2 = L.sub;
  let x = 9 + text(r, `${p.title} · ${p.region}`, 9, y2, { color: GOLD2 }) + 8;
  x += text(r, 'XP', x, y2, { color: INK3 }) + 4;
  const since = `ON GITHUB SINCE ${s.since}`, sinceX = W - 9 - measure(since);
  text(r, since, sinceX, y2, { color: INK3 });
  const xpTxt = `${s.xpInto}/${s.xpNeed}`;
  const barW = Math.max(30, sinceX - 10 - measure(xpTxt) - 5 - x);
  r.rect(x, y2, barW, 5, LINE);
  r.rect(x + 1, y2 + 1, barW - 2, 3, '#1b1742');
  const fill = Math.round(((barW - 2) * s.xpInto) / s.xpNeed);
  if (fill > 0) { r.rect(x + 1, y2 + 1, fill, 3, GOLD2); r.rect(x + 1, y2 + 1, fill, 1, GOLD); r.rect(x + 1, y2 + 3, fill, 1, '#b2892c'); }
  for (let i = 1; i < 10; i++) {
    const at = Math.round(((barW - 2) * i) / 10);
    r.set(x + 1 + at, y2 + 2, fill > at ? '#b2892c' : '#2a2a58');
  }
  text(r, xpTxt, x + barW + 5, y2, { color: INK2 });
}

// --- stats and quest log -------------------------------------------------------
function statRows(r, s) {
  const stats = [
    ['book', 'REPOSITORIES', fmt(s.repoCount)],
    ['rune', 'CONTRIBUTIONS · YEAR', fmt(s.yearTotal)],
    ['flame', `STREAK · BEST ${s.longest}`, fmt(s.current)],
    ['helm', s.stars > 0 ? `FOLLOWERS · ${fmt(s.stars)} STARS` : 'FOLLOWERS', fmt(s.followers)],
    ['eye', 'VISITORS', s.views == null ? '?' : fmt(s.views)],
  ];
  const colR = 133;
  stats.forEach(([ic, label, val], i) => {
    const y = L.rows + i * 8;
    icon(r, ic, 9, y);
    const lw = text(r, label, 19, y + 1, { color: INK2 });
    const vw = measure(val, { font: 'big' });
    text(r, val, colR - vw, y, { font: 'big', color: (row) => (row < 3 ? GOLD : GOLD2) });
    dotted(r, 19 + lw + 3, colR - vw - 3, y + 5, '#2a2a58');
  });
  dottedV(r, 140, L.rows, L.rows + 38);
}

function questLog(r, s, now) {
  const qx = 147, qr = W - 9;
  text(r, 'QUEST LOG', qx, L.rows + 1, { color: GOLD });
  text(r, 'RECENT REPOS', qr - measure('RECENT REPOS'), L.rows + 1, { color: INK3 });
  s.quests.forEach((q, i) => {
    const y = L.rows + 9 + i * 8;
    const age = ago(q.pushedAt, now);
    const abbr = q.language ? langAbbr(q.language) : '';
    let rx = qr - measure(age);
    text(r, age, rx, y, { color: INK3 });
    if (abbr) {
      rx -= measure(abbr) + 5;
      text(r, abbr, rx, y, { color: INK2 });
      rx -= 5;
      r.rect(rx, y + 1, 3, 3, q.color || '#8a8aa0');
      r.set(rx, y + 1, '#ffffff');
    }
    text(r, '▸', qx, y, { color: GOLD2 });
    text(r, fit(q.name, rx - 5 - (qx + 6)), qx + 6, y, { color: INK });
  });
  if (!s.quests.length) text(r, 'NO PUBLIC QUESTS YET', qx, L.rows + 9, { color: INK3 });
}

// --- inventory and achievements ------------------------------------------------
const slotXY = (i) => [INV.x + (i % INV.cols) * PITCH, L.grid + Math.floor(i / INV.cols) * PITCH];
const medalXY = (i) => [ACH.x + (i % ACH.cols) * PITCH, L.grid + Math.floor(i / ACH.cols) * PITCH];

function slots(r, x0, cols, rows) {
  const w = cols * PITCH, h = rows * PITCH;
  r.rect(x0, L.grid, w + 1, h + 1, LINE);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const sx = x0 + i * PITCH, sy = L.grid + j * PITCH;
      r.rect(sx + 1, sy + 1, PITCH - 1, PITCH - 1, SLOT);
      r.hline(sx + 1, sx + PITCH - 1, sy + 1, SLOT_HI);
    }
  }
}

/** How many public repos use an item's language (null when it isn't a language). */
const itemCount = (key, s) => (ITEMS[key].lang ? s.langRepos?.[ITEMS[key].lang] || 0 : null);

function inventory(r, keys, s) {
  text(r, 'INVENTORY', INV.x, L.sec, { color: GOLD });
  const tag = 'SKILLS & TOOLS';
  text(r, tag, INV.x + INV.cols * PITCH - measure(tag), L.sec, { color: INK3 });
  slots(r, INV.x, INV.cols, INV.rows);
  keys.forEach((k, i) => {
    const [sx, sy] = slotXY(i);
    drawItem(r, k, sx + 2, sy + 2);
    const n = itemCount(k, s);
    if (n) {
      const q = String(Math.min(n, 99));
      text(r, q, sx + 15 - measure(q), sy + 10, { color: '#ffffff', outline: '#05061a' });
    }
  });
  dottedV(r, 160, L.sec, L.grid + INV.rows * PITCH);
}

function medals(r, achs) {
  text(r, 'ACHIEVEMENTS', ACH.x, L.sec, { color: GOLD });
  const rows = Math.ceil(achs.length / ACH.cols);
  slots(r, ACH.x, ACH.cols, rows);
  achs.forEach((a, i) => {
    const [sx, sy] = medalXY(i);
    medal(r, a, sx + 3, sy + 2);
    if (!a.known) { text(r, '?', sx + 7, sy + 5, { color: INK3 }); return; }
    // progress to the next tier
    r.hline(sx + 3, sx + 13, sy + 14, '#2a2a58');
    const f = Math.round(11 * Math.min(1, a.progress));
    if (f > 0) r.hline(sx + 3, sx + 2 + f, sy + 14, a.next ? '#62e6f0' : GOLD2);
  });
  // unlocked count, right of the medals
  const got = achs.filter((a) => a.tier > 0).length;
  const cx = ACH.x + ACH.cols * PITCH + 1 + Math.round((W - 9 - (ACH.x + ACH.cols * PITCH + 1)) / 2);
  const big = String(got), small = `/${achs.length}`;
  const tw = measure(big, { font: 'big' }) + 1 + measure(small);
  let x = cx - Math.round(tw / 2);
  x += text(r, big, x, L.grid + 6, { font: 'big', color: (row) => (row < 3 ? GOLD : GOLD2) }) + 1;
  text(r, small, x, L.grid + 8, { color: INK2 });
  text(r, 'UNLOCKED', cx - Math.round(measure('UNLOCKED') / 2), L.grid + 17, { color: INK3 });
  // the best medals earned so far, as tiny pips
  const pips = [3, 2, 1].flatMap((t) => achs.filter((a) => a.tier === t).map(() => t));
  pips.slice(0, 8).forEach((t, i) => {
    const px = cx - Math.round((Math.min(pips.length, 8) * 4 - 1) / 2) + i * 4;
    r.rect(px, L.grid + 25, 3, 3, TIER_COLORS[t].face);
    r.set(px, L.grid + 25, TIER_COLORS[t].hi);
  });
}

const TIP = { x0: 6, x1: W - 7 };
function tooltipBox(r) {
  const y0 = L.tip, y1 = L.tip + 13;
  r.rect(TIP.x0 + 1, y0 + 1, TIP.x1 - TIP.x0 - 1, y1 - y0 - 1, BOX);
  r.hline(TIP.x0 + 1, TIP.x1 - 1, y0, LINE); r.hline(TIP.x0 + 1, TIP.x1 - 1, y1, LINE);
  r.vline(TIP.x0, y0 + 1, y1 - 1, LINE); r.vline(TIP.x1, y0 + 1, y1 - 1, LINE);
}

/** One frame per slot: the cursor on it, and its tooltip. */
function cursor(c, keys, achs, s) {
  const frames = [];
  const tipText = (r, name, nameCol, tag, tagCol, note) => {
    let x = TIP.x0 + 5;
    x += text(r, '▸', x, L.tip + 4, { color: GOLD2 }) + 4;
    x += text(r, name, x, L.tip + 3, { font: 'big', color: nameCol }) + 6;
    x += text(r, tag, x, L.tip + 4, { color: tagCol });
    const room = TIP.x1 - 5 - (x + 10);
    if (note && measure(note) <= room) text(r, note, TIP.x1 - 5 - measure(note), L.tip + 4, { color: INK2 });
  };
  const select = (r, sx, sy) => {
    r.hline(sx, sx + PITCH, sy, GOLD2); r.hline(sx, sx + PITCH, sy + PITCH, GOLD2);
    r.vline(sx, sy, sy + PITCH, GOLD2); r.vline(sx + PITCH, sy, sy + PITCH, GOLD2);
    for (const [dx, dy] of [[0, 0], [PITCH, 0], [0, PITCH], [PITCH, PITCH]]) r.set(sx + dx, sy + dy, '#fff1c0');
  };

  keys.forEach((k, i) => {
    const r = new Raster(W, H), it = ITEMS[k], n = itemCount(k, s);
    select(r, ...slotXY(i));
    const tag = n ? `${it.kind} · ${n} REPO${n === 1 ? '' : 'S'}` : it.kind;
    tipText(r, it.name, '#ffffff', tag, GOLD2, it.note);
    frames.push(r);
  });
  achs.forEach((a, i) => {
    const r = new Raster(W, H);
    select(r, ...medalXY(i));
    const t = TIER_COLORS[a.tier];
    const note = !a.known ? `${a.what} · NOT COUNTED YET`
      : a.next ? `${full(a.value)}/${full(a.next)} ${a.what}`
      : `${full(a.value)} ${a.what} · MAXED`;
    tipText(r, a.name, '#ffffff', TIER_NAMES[a.tier], t.label, note);
    frames.push(r);
  });
  c.frames(frames, ID, frames.length * DWELL);
}

// --- dialog box ------------------------------------------------------------------
function dialog(c, w) {
  const by = L.box, bx0 = 6, bx1 = W - 7, by1 = by + BOX_H;
  const box = new Raster(W, H);
  box.rect(bx0 + 1, by + 1, bx1 - bx0 - 1, by1 - by - 1, BOX);
  box.hline(bx0 + 1, bx1 - 1, by, '#b2892c'); box.hline(bx0 + 1, bx1 - 1, by1, '#6b4c15');
  box.vline(bx0, by + 1, by1 - 1, '#b2892c'); box.vline(bx1, by + 1, by1 - 1, '#6b4c15');
  box.hline(bx0 + 2, bx1 - 2, by + 1, '#1b1a45');
  // nameplate
  const tag = 'GUARDIAN', tw = measure(tag);
  box.rect(13, by - 4, tw + 8, 8, BOX);
  box.hline(14, 13 + tw + 6, by - 4, '#b2892c'); box.vline(13, by - 3, by, '#b2892c'); box.vline(13 + tw + 7, by - 3, by, '#6b4c15');
  text(box, tag, 17, by - 2, { color: GOLD });
  // portrait with the guardian's current eye colour
  icon(box, 'head', 12, by + 10, { E: EYE[w.mood] });
  c.raster(box, ID);

  // the guardian's words, typed out
  const tx = 29, maxW = bx1 - 10 - tx;
  const lines = w.dialog.flatMap((d) => wrap(d, maxW)).slice(0, 3);
  const words = new Raster(W, H);
  lines.forEach((ln, i) => text(words, ln, tx, by + 5 + i * 7, { color: i === 0 ? INK : i === 1 ? INK2 : GOLD }));
  c.raster(words, ID);
  c.def(`<clipPath id="tc"><rect x="${tx - 1}" y="${by + 3}" width="${maxW + 4}" height="${lines.length * 7 + 1}"/></clipPath>`);
  let t = 0.8, covers = '';
  lines.forEach((ln, i) => {
    const lw = measure(ln) + 2, n = Math.max(1, ln.length), dur = n * 0.045;
    const k = c.keyframes(`type${i}`, `from{transform:translateX(0)}to{transform:translateX(${lw}px)}`);
    covers += `<rect x="${tx - 1}" y="${by + 4 + i * 7}" width="${lw}" height="7" fill="${BOX}" transform="translate(${lw} 0)" style="animation:${k} ${dur.toFixed(2)}s steps(${n}) ${t.toFixed(2)}s 1 both"/>`;
    t += dur + 0.25;
  });
  c.push(`<g clip-path="url(#tc)">${covers}</g>`);
  const more = new Raster(W, H);
  text(more, '▼', bx1 - 9, by1 - 6, { color: GOLD2 });
  // hidden (base opacity 0) until the typing is done, then it blinks
  const blink = c.keyframes('more', '0%{opacity:1}50%{opacity:0}100%{opacity:0}');
  c.push(`<g opacity="0" style="animation:${blink} 1s step-end ${t.toFixed(2)}s infinite">${c.paths(more, ID)}</g>`);
}

/** Outer frame with notched corners, and the divider between scene and panel. */
function frame(c) {
  const r = new Raster(W, H);
  for (let x = 0; x < W; x++) {
    r.set(x, 0, '#05061a'); r.set(x, H - 1, '#05061a');
    r.set(x, 1, '#b2892c'); r.set(x, H - 2, '#6b4c15');
  }
  for (let y = 0; y < H; y++) {
    r.set(0, y, '#05061a'); r.set(W - 1, y, '#05061a');
    r.set(1, y, '#b2892c'); r.set(W - 2, y, '#6b4c15');
  }
  // notched corners
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [W - 1, 0], [W - 2, 0], [W - 1, 1], [0, H - 1], [1, H - 1], [0, H - 2], [W - 1, H - 1], [W - 2, H - 1], [W - 1, H - 2]]) r.clear(x, y);
  for (const [x, y] of [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]]) r.set(x, y, '#05061a');
  // divider
  for (let x = 2; x < W - 2; x++) { r.set(x, SH - 1, '#05061a'); r.set(x, SH, '#d9ae42'); r.set(x, SH + 1, '#6b4c15'); }
  const ew = 4 * 3 - 1, ex = Math.round((W - ew) / 2);
  r.rect(ex - 4, SH - 2, ew + 8, 5, '#05061a');
  r.hline(ex - 4, ex + ew + 3, SH - 2, '#b2892c');
  r.hline(ex - 4, ex + ew + 3, SH + 2, '#6b4c15');
  emblem(r, ex, SH - 1, 3, { up: '#e6bd4e', upHi: '#f7dc84', down: '#b2892c' });
  c.raster(r, ID);
}
