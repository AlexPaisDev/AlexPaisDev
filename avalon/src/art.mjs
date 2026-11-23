// Palette and hand-drawn sprites.
// Palette keys are lit by the time of day; keys starting with '#' are emissive
// (they glow and ignore lighting); keys starting with '~' are literal colours
// that still receive lighting (used for language banners).

export const PAL = {
  // castle stone: lilac grey, in the Avalon night-indigo family
  st0: '#262238', st1: '#3b3655', st2: '#575275', st3: '#777296', st4: '#9b96b9', st5: '#c1bdd9', st6: '#e3e0f2',
  // rune stones (a little bluer than the castle)
  rn0: '#22223e', rn1: '#3e3f62', rn2: '#5a5b82', rn3: '#7a7ca2',
  // cliffs
  rk0: '#16121e', rk1: '#252031', rk2: '#383047', rk3: '#50455e', rk4: '#6b5e79',
  // roofs: Avalon cape blue
  rf0: '#131b44', rf1: '#1e2c6e', rf2: '#2c4196', rf3: '#3b55b3', rf4: '#5872cd',
  // gold
  au0: '#6b4c15', au1: '#a47d29', au2: '#d9ae42', au3: '#f2d27a', au4: '#fff1c0',
  // wood
  wd0: '#28190f', wd1: '#432e1d', wd2: '#654328', wd3: '#8a643c',
  // whitewash (windmill)
  ww0: '#726e88', ww1: '#aaa6bf', ww2: '#d6d3e4', ww3: '#f5f4fb',
  // terracotta
  tc0: '#55271f', tc1: '#843b2a', tc2: '#ad5537',
  // evergreens (cypress, stone pine)
  cy0: '#0e221d', cy1: '#17382c', cy2: '#22513c', cy3: '#336b4b',
  // far hills
  mt0: '#272a50', mt1: '#363a64', mt2: '#4a4f7e',
  // steel and bronze (the allies)
  sl0: '#343a4c', sl1: '#606882', sl2: '#a2abc0', sl3: '#dde3ef',
  bz0: '#472c18', bz1: '#875830', bz2: '#bd8850', bz3: '#e9be88',
  visor: '#141230',
  // the guardian, colours from avalon-os/web/app.js
  gL: '#f7dc84', gG: '#e6bd4e', gD: '#b2892c', gV: '#141230', gN: '#1b1a45', legO: '#efcd68', legI: '#a47d29',
  cape: '#2c4196', capeD: '#22327a', blade: '#f2f8ff', edge: '#9fd3ff', grip: '#7a5520',
  // unlit glass
  gl0: '#141230', gl1: '#232250', gl2: '#3d4380',
  // snow, coals
  sn0: '#aab4d2', sn1: '#dbe3f5', sn2: '#ffffff',
  coal: '#2a1c1c', ash: '#6a5a5a',
};

const FOLIAGE = {
  spring: { lf0: '#1d4430', lf1: '#2d6a3e', lf2: '#4b964b', lf3: '#86c46a', bl: '#f4b6d0', gr0: '#1f4a2c', gr1: '#2f6e38', gr2: '#4f9a46', gr3: '#7cc05c' },
  // Portuguese summers turn the grass gold
  summer: { lf0: '#1b3d2c', lf1: '#2a5e3c', lf2: '#468846', lf3: '#72b058', bl: null, gr0: '#4a4a26', gr1: '#75702f', gr2: '#a39a44', gr3: '#cfc062' },
  autumn: { lf0: '#5a2626', lf1: '#963a24', lf2: '#cf6c2a', lf3: '#efae48', bl: null, gr0: '#2c3e28', gr1: '#466034', gr2: '#6a8440', gr3: '#94a852' },
  winter: { lf0: null, lf1: null, lf2: null, lf3: null, bl: null, gr0: '#24402c', gr1: '#35583a', gr2: '#4e7646', gr3: '#6e9656' },
};

export function seasonPalette(season) {
  const f = FOLIAGE[season];
  const p = { ...PAL };
  for (const [k, v] of Object.entries(f)) if (v) p[k] = v;
  return { pal: p, bare: !f.lf1, blossom: f.bl };
}

// ---------------------------------------------------------------------------
// The guardian. Same sprite as the avalon-os home page: block helmet, dark
// visor, glowing eyes, blue cape, shield with a cyan gem, a floating sword.
// Origin (gx, gy) matches the 40x30 canvas of the original (bx = gx+11, by = gy+11).
// ---------------------------------------------------------------------------
const BODY = [
  '.......LGGG.......',
  '.......GGGD.......',
  '...LG..GGGD..GD...',
  '..LGGGGGGGGGGGGD..',
  '..GVVVVVVVVVVVVD..',
  '..GVVVVVVVVVVVVD..',
  'LGGVVVVVVVVVVVVDGD',
  'LGGVVVVVVVVVVVVDGD',
  'LGGVVVVVVVVVVVVDGD',
  'LGDDDDDDDDDDDDDDGD',
];
const SHIELD = [
  'YYYYYYY',
  'YNNNNNY',
  'YNNYNNY',
  'YNYCYNY',
  '.YYYYY.',
  '..YNY..',
  '...Y...',
];
const GMAP = { L: 'gL', G: 'gG', D: 'gD', V: 'gV', Y: 'gG', N: 'gN', C: '#62e6f0' };
export const EYE = { ok: '#6fdca0', warn: '#ffc857', hot: '#ff6b6b' };
const EYE_HI = { ok: '#d8ffe9', warn: '#fff4dc', hot: '#fff4dc' };

export function guardianLegs(r, gx, gy) {
  const bx = gx + 11, by = gy + 11;
  for (const [a, b] of [[3, 4], [6, 7], [10, 11], [13, 14]]) {
    r.rect(bx + a, by + 10, 1, 3, 'legO');
    r.rect(bx + b, by + 10, 1, 3, 'legI');
  }
}

/** Cape, body, shield and sword. drop = 1 for the breathing frame; flutter pushes the cape hem toward dir. */
export function guardianBody(r, gx, gy, { drop = 0, flutter = 0, dir = 1, swordLift = 0 } = {}) {
  const bx = gx + 11, by = gy + 11 + drop;
  const feet = gy + 11 + 12;
  for (let row = 0; row < 13; row++) {
    const spread = Math.floor(row / 3), y = by + 4 + row;
    if (y > feet) break; // he stands on the dais: the cape stops at his feet
    const f = flutter && row >= 5 ? 1 : 0;
    const x0 = bx + 1 - spread - (dir < 0 ? f : 0);
    r.rect(x0, y, 16 + spread * 2 + f, 1, 'cape');
    r.rect(bx + 15 + spread + (dir > 0 ? f : 0), y, 2, 1, 'capeD');
  }
  BODY.forEach((row, ry) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') r.set(bx + i, by + ry, GMAP[row[i]]);
  });
  SHIELD.forEach((row, ry) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') r.set(bx - 7 + i, by + 5 + ry, GMAP[row[i]]);
  });
  const sx = bx + 19, top = by - 8 - swordLift;
  r.rect(sx, top + 1, 1, 13, 'blade');
  r.rect(sx + 1, top + 1, 1, 13, 'edge');
  r.set(sx, top, 'blade');
  r.rect(sx - 2, top + 14, 6, 1, 'gG');
  r.rect(sx, top + 15, 2, 3, 'grip');
  r.rect(sx, top + 18, 2, 1, 'gD');
  return { swordX: sx, swordTop: top };
}

export function guardianEyes(r, gx, gy, { drop = 0, mood = 'ok', blink = false } = {}) {
  const bx = gx + 11, by = gy + 11 + drop;
  for (const a of [5, 11]) {
    if (blink) { r.rect(bx + a, by + 7, 2, 1, EYE[mood]); continue; }
    r.rect(bx + a, by + 5, 2, 3, EYE[mood]);
    r.set(bx + a, by + 5, EYE_HI[mood]);
  }
}

// ---------------------------------------------------------------------------
// The allies: small iron soldiers of Avalon (one per follower) peeking out of
// the crenels, steel or bronze, eyes glowing cyan like the investigator's.
// ---------------------------------------------------------------------------
export const ALLY = [
  '.LGG.',
  'LGGGD',
  'GEVED',
  'GVVVD',
  'DDDDD',
  'GGGGD',
  'GGGGD',
];
export const allyMap = (metal) => metal === 'bronze'
  ? { L: 'bz3', G: 'bz2', D: 'bz1', V: 'visor', E: '#62e6f0' }
  : { L: 'sl3', G: 'sl2', D: 'sl1', V: 'visor', E: '#62e6f0' };

// ---------------------------------------------------------------------------
// The Avalon mark: two gold triangles up, one down, with cyan gems (pixel
// version of the wordmark's left half). h = rows; width = 4h - 1.
// ---------------------------------------------------------------------------
export function emblem(r, x, y, h = 4, { up = 'au2', upHi = 'au3', down = 'au1', gem = '#62e6f0' } = {}) {
  for (let row = 0; row < h; row++) {
    for (let c = h - 1 - row; c <= h - 1 + row; c++) {
      r.set(x + c, y + row, c === h - 1 - row ? upHi : up);
      r.set(x + 2 * h + c, y + row, c === h - 1 - row ? upHi : up);
    }
    for (let c = row; c <= 2 * h - 2 - row; c++) r.set(x + h + c, y + row, down);
  }
  if (gem) {
    r.set(x + h - 1, y + h - 2, gem);
    r.set(x + 3 * h - 1, y + h - 2, gem);
    r.set(x + 2 * h - 1, y + 1, gem);
  }
  return 4 * h - 1;
}

// ---------------------------------------------------------------------------
// Icons (HUD weather, panel stats).
// ---------------------------------------------------------------------------
export const ICONS = {
  sun: { rows: ['...r...', '.r...r.', '..YYY..', 'r.YYY.r', '..YYY..', '.r...r.', '...r...'], map: { Y: '#ffe08a', r: '#f2b84a' } },
  moon: { rows: ['..MMM..', '.MMm...', 'MMm....', 'MMm....', 'MMm....', '.MMm...', '..MMM..'], map: { M: '#e9e6ff', m: '#b9b4e0' } },
  cloud: { rows: ['.......', '..WW...', '.WWWW..', 'WWWWWWW', 'wwwwwww', '.......', '.......'], map: { W: '#e9e6ff', w: '#9a94c9' } },
  partly: { rows: ['....Y..', '..WWYY.', '.WWWWY.', 'WWWWWWW', 'wwwwwww', '.......', '.......'], map: { W: '#e9e6ff', w: '#9a94c9', Y: '#ffe08a' } },
  partlyN: { rows: ['....M..', '..WWM..', '.WWWWM.', 'WWWWWWW', 'wwwwwww', '.......', '.......'], map: { W: '#c9c5ee', w: '#8a84b9', M: '#f4f1ff' } },
  rain: { rows: ['..WW...', '.WWWW..', 'WWWWWWW', 'wwwwwww', '.b.b.b.', 'b.b.b..', '.......'], map: { W: '#c9c5ee', w: '#8a84b9', b: '#62e6f0' } },
  snow: { rows: ['..WW...', '.WWWW..', 'WWWWWWW', 'wwwwwww', '.s...s.', '...s...', '.s...s.'], map: { W: '#c9c5ee', w: '#8a84b9', s: '#ffffff' } },
  storm: { rows: ['..WW...', '.WWWW..', 'WWWWWWW', 'wwwwwww', '...Y...', '..YY...', '...Y...'], map: { W: '#a9a5ce', w: '#6a6499', Y: '#ffe08a' } },
  fog: { rows: ['.......', 'WWWWWW.', '.......', '.WWWWWW', '.......', 'WWWWWW.', '.......'], map: { W: '#c9c5ee' } },
  book: { rows: ['.BBBBBB', 'BPPPPPB', 'BPGGPPB', 'BPPPPPB', 'BPPPPPB', 'BBBBBBB', 'pppppp.'], map: { B: '#2c4196', P: '#3b55b3', G: '#f2d27a', p: '#e9e6ff' } },
  rune: { rows: ['.SSSSS.', 'SsscssS', 'SscCcsS', 'SsCCCsS', 'SscCcsS', 'SsscssS', '.SSSSS.'], map: { S: '#5a5b82', s: '#7a7ca2', c: '#2fa6b8', C: '#b8fbff' } },
  flame: { rows: ['...r...', '..rr...', '..rOr..', '.rOYOr.', '.rOYOr.', '..rOr..', '.aaaaa.'], map: { r: '#e0442a', O: '#ff8a2a', Y: '#fff1a8', a: '#d9ae42' } },
  helm: { rows: ['.LGGG.', 'LGGGGD', 'GEVVED', 'GVVVVD', 'GDDDDD', '.G..D.', '......'], map: { L: '#dde3ef', G: '#a2abc0', D: '#606882', V: '#141230', E: '#62e6f0' } },
  eye: { rows: ['.......', '..WWW..', '.WwCwW.', 'WwCKCwW', '.WwCwW.', '..WWW..', '.......'], map: { W: '#e9e6ff', w: '#9a94c9', C: '#62e6f0', K: '#141230' } },
  star: { rows: ['...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '..YYY..', '.YY.YY.', '.Y...Y.'], map: { Y: '#f2d27a' } },
  head: { rows: ['....LGGG....', '..LGGGGGGGD.', '.GVVVVVVVVD.', '.GVEEVVEEVD.', 'LGVEEVVEEVDG', 'LGDDDDDDDDDG'], map: { L: '#f7dc84', G: '#e6bd4e', D: '#b2892c', V: '#141230', E: '#6fdca0' } },
};

export function icon(r, name, x, y, override = {}) {
  const ic = ICONS[name];
  r.sprite(ic.rows, { ...ic.map, ...override }, x, y);
  return ic.rows[0].length;
}
