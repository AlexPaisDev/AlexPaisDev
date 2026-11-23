// The inventory and the achievements.
//
// Inventory: the tools of the trade, each a hand-drawn 13x13 pixel item.
// Achievements: medals that climb from bronze to silver to gold as the real
// numbers grow, so there is always a next tier to reach.

// --- tiny sprite builder ---------------------------------------------------
// Sprites are rows of characters; '.' is transparent and other characters
// map to colours. stamp() writes a '#'-glyph onto a sprite with a given char.
const grid = (rows) => rows.map((r) => [...r]);
const done = (g) => g.map((r) => r.join(''));
function stamp(g, glyph, x, y, ch) {
  glyph.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') g[y + j][x + i] = ch; }));
  return g;
}
/** Re-letter the 'x' pixels of a shape with fn(col, row). */
function tint(rows, fn) {
  return rows.map((r, y) => [...r].map((c, x) => (c === 'x' ? fn(x, y) : c)).join(''));
}

// --- shared shapes (13x13) ---------------------------------------------------
const HEX = [
  '.....xxx.....',
  '...xxxxxxx...',
  '.xxxxxxxxxxx.',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  '.xxxxxxxxxxx.',
  '...xxxxxxx...',
  '.....xxx.....',
];
// light upper-left, mid right, dark lower third (like the official hexagons)
const hexTones = (x, y) => (y >= 9 || (x >= 7 && y >= 6) ? 'z' : x >= 7 ? 'y' : 'x');

const SHIELD = [
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  '.xxxxxxxxxxx.',
  '.xxxxxxxxxxx.',
  '.xxxxxxxxxxx.',
  '.xxxxxxxxxxx.',
  '.xxxxxxxxxxx.',
  '..xxxxxxxxx..',
  '..xxxxxxxxx..',
  '....xxxxx....',
  '......x......',
  '.............',
];
const shieldTones = (x) => (x >= 6 ? 'y' : 'x');

const ROUND = [
  '.xxxxxxxxxxx.',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  '.xxxxxxxxxxx.',
];
const roundTones = (x, y) => (y === 0 || x === 0 ? 'y' : 'x');

const CIRCLE = [
  '....xxxxx....',
  '..xxxxxxxxx..',
  '.xxxxxxxxxxx.',
  '.xxxxxxxxxxx.',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  '.xxxxxxxxxxx.',
  '.xxxxxxxxxxx.',
  '..xxxxxxxxx..',
  '....xxxxx....',
];

// --- glyphs used on the items ------------------------------------------------
const G = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  c: ['.##', '#..', '#..', '#..', '.##'],
  hash: ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  five: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  three: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  B: ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '#####.'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
};

/** The Lua mark: a planet with a hole, its moon, and a dotted orbit. */
function luaRows() {
  const g = [];
  for (let y = 0; y < 13; y++) {
    let row = '';
    for (let x = 0; x < 13; x++) {
      const planet = Math.hypot(x - 5.2, y - 7.2), hole = Math.hypot(x - 7, y - 5.4);
      const moon = Math.hypot(x - 10.7, y - 1.6), orbit = Math.hypot(x - 6, y - 6.5);
      if (planet <= 4.9) row += hole <= 1.5 ? 'w' : x + y < 9 ? 'L' : 'N';
      else if (moon <= 1.6) row += 'N';
      else if (Math.abs(orbit - 6.3) < 0.55 && (x + y) % 2 === 0) row += 'o';
      else row += '.';
    }
    g.push(row);
  }
  return g;
}

// --- the items -----------------------------------------------------------------
// kind: what it is. lang: GitHub language name, used to count public repos.
// note: flavour text shown when there is nothing to count.
export const ITEMS = {
  unity: {
    name: 'Unity', kind: 'GAME ENGINE', note: 'WHERE MY WORLDS ARE FORGED',
    rows: [
      '......a......',
      '....aaaaa....',
      '..aaaaaaaaa..',
      'aaaaaaaaaaaaa',
      'b.aaaaaaaaa.c',
      'bbb.aaaaa.ccc',
      'bbbbb.a.ccccc',
      'bbbbbb.cccccc',
      'bbbbbb.cccccc',
      'bbbbbb.cccccc',
      '.bbbbb.ccccc.',
      '...bbb.ccc...',
      '.....b.c.....',
    ],
    map: { a: '#ffffff', b: '#c3c8d8', c: '#7d859e' },
  },
  love: {
    name: 'LÖVE', kind: '2D FRAMEWORK', note: 'TINY GAMES, WRITTEN IN LUA',
    rows: done(stamp(grid(tint(CIRCLE, (x, y) => (x + y < 12 ? 'p' : 'b'))), G.heart, 3, 4, 'w')),
    map: { p: '#e74a99', b: '#27a9e1', w: '#ffffff' },
  },
  csharp: {
    name: 'C#', kind: 'LANGUAGE', lang: 'C#', note: 'THE TONGUE OF UNITY',
    rows: done(stamp(stamp(grid(tint(HEX, hexTones)), G.c, 2, 4, 'w'), G.hash, 6, 4, 'w')),
    map: { x: '#a75fb0', y: '#813084', z: '#68217a', w: '#ffffff' },
  },
  c: {
    name: 'C', kind: 'LANGUAGE', lang: 'C', note: 'CLOSE TO THE METAL',
    rows: done(stamp(grid(tint(HEX, hexTones)), G.C, 4, 3, 'w')),
    map: { x: '#659ad2', y: '#03599c', z: '#004482', w: '#ffffff' },
  },
  java: {
    name: 'Java', kind: 'LANGUAGE', lang: 'Java', note: 'BREWED HOT, RUNS ANYWHERE',
    rows: [
      '.....o..o....',
      '....o..o.....',
      '.....o..o....',
      '....o..o.....',
      '.............',
      '.bbbbbbbbb...',
      '.BBBBBBBBBbb.',
      '.BBBBBBBBB..b',
      '.BBBBBBBBBbb.',
      '..BBBBBBB....',
      '...BBBBB.....',
      'bbbbbbbbbbb..',
      '.bbbbbbbbb...',
    ],
    map: { o: '#f89820', B: '#5382a1', b: '#8fb8d6' },
  },
  python: {
    name: 'Python', kind: 'LANGUAGE', lang: 'Python', note: 'SCRIPTS AND SORCERY',
    rows: [
      '...BBBBBB....',
      '...BwBBBB....',
      '...BBBBBB....',
      '......BBB....',
      '.BBBBBBBB.YY.',
      'BBBBBBBBB.YYY',
      'BBBB.....YYYY',
      'BBB.YYYYYYYYY',
      '.BB.YYYYYYYY.',
      '....YYY......',
      '....YYYYYY...',
      '....YYYYwY...',
      '....YYYYYY...',
    ],
    map: { B: '#3d7fc1', Y: '#ffd43b', w: '#ffffff' },
  },
  lua: {
    name: 'Lua', kind: 'LANGUAGE', lang: 'Lua', note: 'LUA IS PORTUGUESE FOR MOON',
    rows: luaRows(),
    map: { N: '#3434c0', L: '#4646d6', w: '#ffffff', o: '#9a9ab8' },
  },
  javascript: {
    name: 'JavaScript', kind: 'LANGUAGE', lang: 'JavaScript', note: 'MAKES THE WEB MOVE',
    rows: done(stamp(stamp(grid(tint(ROUND, () => 'x')), G.J, 2, 5, 'k'), G.S, 6, 5, 'k')),
    map: { x: '#f7df1e', k: '#1c1c1c' },
  },
  php: {
    name: 'PHP', kind: 'LANGUAGE', lang: 'PHP', note: 'SPELLS CAST ON THE SERVER',
    rows: done(stamp(stamp(stamp(grid([
      '.............',
      '.............',
      '...xxxxxxx...',
      '.xxxxxxxxxxx.',
      'xxxxxxxxxxxxx',
      'xxxxxxxxxxxxx',
      'xxxxxxxxxxxxx',
      'xxxxxxxxxxxxx',
      'xxxxxxxxxxxxx',
      '.xxxxxxxxxxx.',
      '...xxxxxxx...',
      '.............',
      '.............',
    ]), G.P, 1, 4, 'k'), G.H, 5, 4, 'k'), G.P, 9, 4, 'k')),
    map: { x: '#8892bf', k: '#232531' },
  },
  html: {
    name: 'HTML', kind: 'MARKUP', lang: 'HTML', note: 'THE BONES OF THE WEB',
    rows: done(stamp(grid(tint(SHIELD, shieldTones)), G.five, 4, 2, 'w')),
    map: { x: '#e44d26', y: '#f16529', w: '#ffffff' },
  },
  css: {
    name: 'CSS', kind: 'STYLESHEETS', lang: 'CSS', note: 'THE ARMOUR OF THE WEB',
    rows: done(stamp(grid(tint(SHIELD, shieldTones)), G.three, 4, 2, 'w')),
    map: { x: '#1572b6', y: '#33a9dc', w: '#ffffff' },
  },
  bootstrap: {
    name: 'Bootstrap', kind: 'CSS FRAMEWORK', note: 'GRIDS AND BUTTONS, FAST',
    rows: done(stamp(grid(tint(ROUND, roundTones)), G.B, 4, 3, 'w')),
    map: { x: '#7952b3', y: '#9a76d0', w: '#ffffff' },
  },
  mysql: {
    name: 'MySQL', kind: 'DATABASE', note: 'WHERE THE LOOT IS KEPT',
    rows: [
      '.........o.o.',
      '.........ooo.',
      '..........o..',
      '.....d...dd..',
      '....ddddddd..',
      '...dddddddd..',
      '..dddddddd...',
      '.ddkdddddd...',
      'ddddddddd....',
      '.llllldd.....',
      '...lll.dd....',
      '.............',
      '.............',
    ],
    map: { d: '#3e8fb0', l: '#a8d8ea', k: '#0c2836', o: '#f29111' },
  },
  git: {
    name: 'Git', kind: 'VERSION CONTROL', note: 'EVERY QUEST, SAVED',
    rows: [
      '......x......',
      '.....xxx.....',
      '....xxxxx....',
      '...wxxxxxx...',
      '..xxwxxxxxx..',
      '.xxxxwwxxxxx.',
      'xxxxxwwxxxxxx',
      '.xxxxwxwwwxx.',
      '..xxxwxxwwx..',
      '...xxwwxxx...',
      '....xwwxx....',
      '.....xxx.....',
      '......x......',
    ],
    map: { x: '#f05033', w: '#ffffff' },
  },
  linux: {
    name: 'Linux', kind: 'OPERATING SYSTEM', note: "THE PENGUIN'S REALM",
    rows: [
      '....KKKKk....',
      '...KkkkkkK...',
      '...KwkkkwK...',
      '...KkoookK...',
      '..KkkkokkkK..',
      '..KkwwwwwkK..',
      '.KkwwwwwwwkK.',
      '.KkwwwwwwwkK.',
      'KkkwwwwwwwkkK',
      'KkkwwwwwwwkkK',
      '.KkwwwwwwwkK.',
      'oooKkwwwkKooo',
      '.ooo.....ooo.',
    ],
    map: { K: '#4a4a5e', k: '#15151c', w: '#f4f4f4', o: '#f5b800' },
  },
  vscode: {
    name: 'VS Code', kind: 'CODE EDITOR', note: 'THE WORKBENCH',
    rows: [
      '.........LL..',
      '........mLLL.',
      '.d.....mmLLL.',
      'ddd...mm.LLL.',
      '.ddd.mm..LLL.',
      '..ddmm...LLL.',
      '...dm....LLL.',
      '..ddmm...LLL.',
      '.ddd.mm..LLL.',
      'ddd...mm.LLL.',
      '.d.....mmLLL.',
      '........mLLL.',
      '.........LL..',
    ],
    map: { L: '#1f9cf0', m: '#007acc', d: '#0065a9' },
  },
  discord: {
    name: 'Discord', kind: 'GUILD HALL', note: 'WHERE THE PARTY GATHERS',
    rows: [
      '.............',
      '.............',
      '..xx.....xx..',
      '.xxxxxxxxxxx.',
      '.xxxxxxxxxxx.',
      'xxxxxxxxxxxxx',
      'xxxwwxxxwwxxx',
      'xxxwwxxxwwxxx',
      'xxxxxxxxxxxxx',
      'xxxxxxxxxxxxx',
      '.xxxx...xxxx.',
      '..xx.....xx..',
      '.............',
    ],
    map: { x: '#5865f2', w: '#ffffff' },
  },
  linkedin: {
    name: 'LinkedIn', kind: 'NETWORK', note: "THE MERCHANTS' GUILD",
    rows: [
      '.xxxxxxxxxxx.',
      'xxxxxxxxxxxxx',
      'xxwwxxxxxxxxx',
      'xxwwxxxxxxxxx',
      'xxxxxxxxxxxxx',
      'xxwwxwwwwwxxx',
      'xxwwxwwxxwwxx',
      'xxwwxwwxxwwxx',
      'xxwwxwwxxwwxx',
      'xxwwxwwxxwwxx',
      'xxwwxwwxxwwxx',
      'xxxxxxxxxxxxx',
      '.xxxxxxxxxxx.',
    ],
    map: { x: '#0a66c2', w: '#ffffff' },
  },
};

// --- achievements ----------------------------------------------------------------
// Each has three tiers (bronze, silver, gold). Symbols are 7x7 and engraved
// into the medal.
const MASKS = {
  book: ['.......', '.##.##.', '#..#..#', '#..#..#', '#..#..#', '.##.##.', '...#...'],
  C: ['..###..', '.#...#.', '#......', '#......', '#......', '.#...#.', '..###..'],
  flame: ['...#...', '..##...', '..###.#', '.#####.', '.##.##.', '.##.##.', '..###..'],
  bubble: ['#######', '#.....#', '#.#.#.#', '#.....#', '#######', '.##....', '.#.....'],
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
  helm: ['..###..', '.#####.', '#######', '#.....#', '#######', '.##.##.', '.......'],
  hourglass: ['#######', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#####.', '#######'],
  eye: ['.......', '..###..', '.#...#.', '#..#..#', '.#...#.', '..###..', '.......'],
};

export const TIER_NAMES = ['LOCKED', 'BRONZE', 'SILVER', 'GOLD'];
export const TIER_COLORS = [
  { rim: '#2a2a58', face: '#1b1c48', hi: '#26275a', ink: '#3d3a66', label: '#5d5887' },
  { rim: '#5a3317', face: '#c07a3a', hi: '#e9a868', ink: '#6b3d1c', label: '#e9a868' },
  { rim: '#4f5870', face: '#b8c2d6', hi: '#eef2fa', ink: '#5d6782', label: '#d3dae8' },
  { rim: '#6b4c15', face: '#e6bd4e', hi: '#fff1c0', ink: '#8a6420', label: '#f7dc84' },
];

/** The achievement list, measured against the stats. */
export function achievements(s) {
  const list = [
    { name: 'QUESTGIVER', mask: 'book', what: 'PUBLIC REPOS', value: s.repoCount, tiers: [1, 10, 25] },
    { name: 'CENTURION', mask: 'C', what: 'CONTRIBUTIONS IN A YEAR', value: s.yearTotal, tiers: [100, 500, 1000] },
    { name: 'ON FIRE', mask: 'flame', what: 'DAY STREAK', value: s.longest, tiers: [7, 30, 100] },
    { name: 'POLYGLOT', mask: 'bubble', what: 'LANGUAGES IN PUBLIC CODE', value: s.languages.length, tiers: [3, 6, 10] },
    { name: 'STARGAZER', mask: 'star', what: 'STARS EARNED', value: s.stars, tiers: [1, 10, 50] },
    { name: 'FELLOWSHIP', mask: 'helm', what: 'FOLLOWERS', value: s.followers, tiers: [10, 50, 100] },
    { name: 'VETERAN', mask: 'hourglass', what: 'YEARS ON GITHUB', value: s.years, tiers: [1, 3, 5] },
    { name: 'RENOWNED', mask: 'eye', what: 'VISITORS', value: s.views, tiers: [100, 1000, 10000] },
  ];
  return list.map((a) => {
    const v = a.value ?? 0;
    const tier = a.tiers.filter((t) => v >= t).length;
    const next = a.tiers[tier] ?? null;
    return { ...a, known: a.value != null, tier, next, progress: next ? v / next : 1 };
  });
}

/** An 11x11 medal with its symbol engraved, at (x, y). */
export function medal(r, a, x, y) {
  const t = TIER_COLORS[a.tier];
  const shape = [
    '...#####...',
    '.##fffff##.',
    '.#fffffff#.',
    '#fffffffff#',
    '#fffffffff#',
    '#fffffffff#',
    '#fffffffff#',
    '#fffffffff#',
    '.#fffffff#.',
    '.##fffff##.',
    '...#####...',
  ];
  shape.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === '#') r.set(x + i, y + j, t.rim);
    else if (c === 'f') r.set(x + i, y + j, t.face);
  }));
  // a highlight arc in the upper left
  for (const [i, j] of [[3, 1], [4, 1], [2, 2], [1, 3], [1, 4]]) r.set(x + i, y + j, t.hi);
  MASKS[a.mask].forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') r.set(x + 2 + i, y + 2 + j, t.ink); }));
}

export function drawItem(r, key, x, y) {
  const it = ITEMS[key];
  r.sprite(it.rows, it.map, x, y);
}
