// The status window under the scene, in the style of an RPG menu:
// character card with level and XP, stats, a quest log of recent public
// repositories, and a dialog box where the guardian reports.

import { Raster } from './raster.mjs';
import { text, measure, fit } from './font.mjs';
import { emblem, icon, EYE } from './art.mjs';
import { wrap } from './world.mjs';
import { W, SH, langAbbr } from './scene.mjs';

export const H = 237;
const ID = (k) => k;
const INK = '#e9e6ff', INK2 = '#9a94c9', INK3 = '#5d5887', GOLD = '#f7dc84', GOLD2 = '#e6bd4e', LINE = '#3d3a66';
const CHROME = ['#ffffff', '#eef1f8', '#d9deea', '#b7bfd2', '#c9cfe0', '#e3e7f2', '#f6f8fc'];
const BOX = '#0a0b22';

const fmt = (n) => (n >= 10000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

function ago(iso, now) {
  const d = Math.floor((now - new Date(iso)) / 864e5);
  if (d <= 0) return 'TODAY';
  if (d < 14) return `${d}D`;
  if (d < 60) return `${Math.floor(d / 7)}W`;
  if (d < 365) return `${Math.floor(d / 30)}MO`;
  return `${Math.floor(d / 365)}Y`;
}

function dotted(r, x0, x1, y, col = LINE) { for (let x = x0; x <= x1; x += 2) r.set(x, y, col); }

export function drawPanel(c, w) {
  const s = w.stats, p = w.cfg;
  const top = SH + 2;

  // background
  const bands = ['#17183f', '#141539', '#121334', '#10112f', '#0e0f2a', '#0c0d26'];
  const bh = (H - top) / bands.length;
  c.push(bands.map((col, i) => `<rect x="2" y="${Math.round(top + i * bh)}" width="${W - 4}" height="${Math.min(Math.ceil(bh) + 1, H - 2 - Math.round(top + i * bh))}" fill="${col}"/>`).join(''));

  const r = new Raster(W, H);

  // --- character card ------------------------------------------------------
  // line 1: name ............................................ LV n
  // line 2: class · region   XP [=========-----] a/b      ON GITHUB SINCE y
  const nameY = top + 5;
  text(r, p.name, 9, nameY, { font: 'big', color: (row) => CHROME[row], outline: '#05061a' });
  const lv = String(s.level), lvW = measure(lv, { font: 'big' });
  text(r, lv, W - 9 - lvW, nameY, { font: 'big', color: (row) => CHROME[row], outline: '#05061a' });
  text(r, 'LEVEL', W - 9 - lvW - 5 - measure('LEVEL'), nameY + 2, { color: GOLD });

  const y2 = nameY + 11;
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

  dotted(r, 7, W - 8, top + 22);

  // --- stats ---------------------------------------------------------------
  const rowsY = top + 26;
  const stats = [
    ['book', 'REPOSITORIES', fmt(s.repoCount)],
    ['rune', 'CONTRIBUTIONS · YEAR', fmt(s.yearTotal)],
    ['flame', `STREAK · BEST ${s.longest}`, fmt(s.current)],
    ['helm', s.stars > 0 ? `FOLLOWERS · ${fmt(s.stars)} STARS` : 'FOLLOWERS', fmt(s.followers)],
  ];
  const colR = 133;
  stats.forEach(([ic, label, val], i) => {
    const y = rowsY + i * 8;
    icon(r, ic, 9, y);
    const lw = text(r, label, 19, y + 1, { color: INK2 });
    const vw = measure(val, { font: 'big' });
    text(r, val, colR - vw, y, { font: 'big', color: (row) => (row < 3 ? GOLD : GOLD2) });
    dotted(r, 19 + lw + 3, colR - vw - 3, y + 5, '#2a2a58');
  });

  // column divider
  for (let y = rowsY; y < rowsY + 31; y += 2) r.set(140, y, LINE);

  // --- quest log -----------------------------------------------------------
  const qx = 147, qr = W - 9;
  text(r, 'QUEST LOG', qx, rowsY + 1, { color: GOLD });
  text(r, 'RECENT REPOS', qr - measure('RECENT REPOS'), rowsY + 1, { color: INK3 });
  s.quests.forEach((q, i) => {
    const y = rowsY + 9 + i * 8;
    const age = ago(q.pushedAt, w.now);
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
  if (!s.quests.length) text(r, 'NO PUBLIC QUESTS YET', qx, rowsY + 9, { color: INK3 });

  // --- dialog box ----------------------------------------------------------
  const by = top + 62, bx0 = 6, bx1 = W - 7, by1 = H - 5;
  c.raster(r, ID);
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
  icon(box, 'head', 12, by + 7, { E: EYE[w.mood] });
  c.raster(box, ID);

  // the guardian's words, typed out
  const tx = 29, maxW = bx1 - 10 - tx;
  const lines = [...wrap(w.dialog[0], maxW), ...wrap(w.dialog[1], maxW)].slice(0, 2);
  const words = new Raster(W, H);
  lines.forEach((ln, i) => text(words, ln, tx, by + 5 + i * 7, { color: i ? INK2 : INK }));
  c.raster(words, ID);
  c.def(`<clipPath id="tc"><rect x="${tx - 1}" y="${by + 3}" width="${maxW + 4}" height="15"/></clipPath>`);
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

  frame(c);
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
