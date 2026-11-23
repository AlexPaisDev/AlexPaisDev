// Turns "now", the weather and the GitHub stats into the state of the isle:
// time of day, sky and lighting, weather, wind, season, events, and what the
// guardian has to say about it all.

import { sunPosition, moonPosition, moonPhase, moonName } from './astro.mjs';
import { grade, mix } from './color.mjs';
import { hash } from './raster.mjs';
import { measure } from './font.mjs';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function weatherKind(code) {
  if (code === 0) return { kind: 'clear', level: 0, label: 'CLEAR' };
  if (code === 1) return { kind: 'clear', level: 0, label: 'MOSTLY CLEAR' };
  if (code === 2) return { kind: 'partly', level: 0, label: 'PARTLY CLOUDY' };
  if (code === 3) return { kind: 'overcast', level: 0, label: 'OVERCAST' };
  if (code === 45 || code === 48) return { kind: 'fog', level: 0, label: 'FOG' };
  if ([51, 53, 55, 56, 57].includes(code)) return { kind: 'rain', level: 1, label: 'DRIZZLE' };
  if (code === 61) return { kind: 'rain', level: 1, label: 'LIGHT RAIN' };
  if (code === 80) return { kind: 'rain', level: 1, label: 'SHOWERS' };
  if ([63, 66, 81].includes(code)) return { kind: 'rain', level: 2, label: 'RAIN' };
  if ([65, 67, 82].includes(code)) return { kind: 'rain', level: 3, label: 'HEAVY RAIN' };
  if ([71, 77, 85].includes(code)) return { kind: 'snow', level: 1, label: 'LIGHT SNOW' };
  if (code === 73) return { kind: 'snow', level: 2, label: 'SNOW' };
  if (code === 75 || code === 86) return { kind: 'snow', level: 3, label: 'HEAVY SNOW' };
  if (code >= 95) return { kind: 'storm', level: 3, label: 'THUNDERSTORM' };
  return { kind: 'partly', level: 0, label: 'CLOUDY' };
}

export function localParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const hh = Number(p.hour) % 24, mm = Number(p.minute), m = Number(p.month), d = Number(p.day);
  return {
    y: Number(p.year), m, d, hh, mm,
    iso: `${p.year}-${p.month}-${p.day}`,
    time: `${String(hh).padStart(2, '0')}:${p.minute}`,
    label: `${p.weekday.toUpperCase()} ${d} ${MONTHS[m - 1]}`,
  };
}

// Sky gradients, top to horizon, per time of day.
const SKIES = {
  night: ['#05061a', '#080a24', '#0b0d29', '#0f1031', '#121338', '#161540', '#1b1742', '#241d4c'],
  blue: ['#070926', '#0c1033', '#121641', '#191e4f', '#22285b', '#2e2f66', '#3e376e', '#523f74'],
  dawn: ['#151b4b', '#242b67', '#3b3b7b', '#5c4787', '#8c5589', '#c26b80', '#ec9074', '#fbb87e'],
  dusk: ['#100f3b', '#201d57', '#3b2767', '#5f3171', '#8d3b70', '#c14f66', '#ec7756', '#fcab5c'],
  golden: ['#2f5fb0', '#4472bf', '#5f87c8', '#86a0c8', '#b6b2b8', '#e2c098', '#f8d090', '#fde2aa'],
  day: ['#2a66cc', '#3374d6', '#3f84de', '#4f95e6', '#62a6ec', '#79b8f0', '#94c9f3', '#b4daf5'],
};

const LIGHTS = {
  day: { mul: [1, 1, 1], add: [0, 0, 0], sat: 1 },
  golden: { mul: [1.05, 0.92, 0.8], add: [10, 3, 0], sat: 1.05 },
  dawn: { mul: [0.8, 0.68, 0.82], add: [16, 6, 22], sat: 0.9 },
  dusk: { mul: [0.76, 0.6, 0.72], add: [20, 5, 20], sat: 0.9 },
  blue: { mul: [0.44, 0.48, 0.72], add: [8, 10, 30], sat: 0.75 },
  night: { mul: [0.32, 0.36, 0.6], add: [6, 8, 28], sat: 0.7 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const lerpLight = (a, b, t) => ({
  mul: a.mul.map((v, i) => lerp(v, b.mul[i], t)),
  add: a.add.map((v, i) => lerp(v, b.add[i], t)),
  sat: lerp(a.sat, b.sat, t),
  haze: a.haze, k: a.k ? a.k * (1 - t) : 0,
});

function season(m, d, lat) {
  const v = m * 100 + d;
  let s = v >= 1221 || v < 320 ? 'winter' : v < 621 ? 'spring' : v < 922 ? 'summer' : 'autumn';
  if (lat < 0) s = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }[s];
  return s;
}

function eventFor(l, createdAt) {
  const v = l.m * 100 + l.d;
  if ((l.m === 12 && l.d === 31 && l.hh >= 20) || (l.m === 1 && l.d === 1)) return 'newyear';
  if (v >= 1224 && v <= 1225) return 'christmas';
  if (v >= 1201 || v <= 106) return 'winterfest';
  if (v >= 1025 && v <= 1031) return 'halloween';
  if (createdAt && Number(createdAt.slice(5, 7)) === l.m && Number(createdAt.slice(8, 10)) === l.d) return 'anniversary';
  return null;
}

function pick(list, seed) { return list[((seed % list.length) + list.length) % list.length]; }

function dialogLines(w, cfg, stats, seed) {
  const sub = (s) => s
    .replaceAll('{CITY}', cfg.city.toUpperCase())
    .replaceAll('{TEMP}', w.weather.temp == null ? 'MILD' : `${Math.round(w.weather.temp)}°C`)
    .replaceAll('{WIND}', String(Math.round(w.weather.wind || 0)))
    .replaceAll('{TIME}', w.local.time)
    .replaceAll('{YEARS}', String(w.local.y - stats.since));
  const k = w.weather.kind, lv = w.weather.level, t = w.weather.temp ?? 18;
  const night = w.phase === 'night' || w.phase === 'blue';
  let env;
  if (w.event === 'newyear') env = ['HAPPY NEW YEAR FROM AVALON! MAY ALL YOUR BUILDS BE GREEN.'];
  else if (w.event === 'christmas') env = ['MERRY CHRISTMAS FROM AVALON! EVEN GUARDIANS GET PRESENTS.'];
  else if (w.event === 'halloween' && night) env = ['SOMETHING STIRS IN THE MIST TONIGHT... HAPPY HALLOWEEN.'];
  else if (w.event === 'anniversary') env = ['{YEARS} YEARS SINCE THE FIRST RUNE WAS CARVED. HAPPY GITHUB DAY!'];
  else if (w.weather.missing) {
    env = night ? ['ALL QUIET ON THE WALLS. I KEEP WATCH.']
      : w.phase === 'dawn' ? ['DAWN BREAKS OVER THE ISLE. A FINE DAY TO SHIP SOMETHING.']
      : w.phase === 'dusk' ? ['DUSK OVER {CITY}. THE NIGHT WATCH BEGINS.']
      : ['THE WEATHER SCOUTS ARE LATE TODAY. ALL QUIET ON THE WALLS.'];
  } else if (k === 'storm') env = ['THUNDER OVER AVALON! STAY BEHIND THE WALLS.', 'LIGHTNING ON THE HORIZON. THE RUNES CRACKLE.'];
  else if (k === 'snow') env = ['SNOW IN {CITY}?! THAT HAPPENS ONCE A CENTURY.', 'SNOW ON THE BATTLEMENTS. MY CAPE IS FROZEN STIFF.'];
  else if (k === 'fog') env = ['THE MIST RISES. AVALON VANISHES FROM SIGHT.', 'THICK FOG TODAY. ONLY THE RUNES SHOW THE WAY.'];
  else if (k === 'rain' && lv >= 3) env = ['HEAVY RAIN DRUMS ON MY HELMET. THE WALLS HOLD.', 'A DOWNPOUR OVER {CITY}. A GOOD DAY TO STAY IN AND CODE.'];
  else if (k === 'rain') env = ['RAIN ON THE BATTLEMENTS, {TEMP}. GOOD WEATHER FOR CODING.', 'RAIN OVER {CITY}. MY ARMOR WILL RUST AT THIS RATE.'];
  else if (t >= 32) env = ['{TEMP} IN {CITY}. THIS ARMOR WAS A MISTAKE.'];
  else if (t <= 5) env = ['{TEMP} IN {CITY}. THE HEARTH IS LIT IN THE HALL.'];
  else if ((w.weather.wind || 0) >= 35) env = ['STRONG WIND TODAY, {WIND} KM/H. THE WINDMILL IS DELIGHTED.'];
  else if (night) {
    if (w.local.hh >= 1 && w.local.hh < 5) env = ['{TIME} IN {CITY}. THE ALLIES SLEEP. I KEEP WATCH.'];
    else if (k === 'overcast' || (w.weather.cloud ?? 0) > 70) env = ['A CLOUDY NIGHT OVER {CITY}. THE RUNES GLOW ALL THE SAME.'];
    else if (w.moon.illum > 0.95 && w.moon.alt > 0) env = ['A FULL MOON OVER AVALON. THE RUNES DRINK ITS LIGHT.'];
    else if (w.moon.illum < 0.05) env = ['NO MOON TONIGHT. ONLY THE RUNES LIGHT THE WALLS.'];
    else env = ['ALL QUIET ON THE WALLS. THE STARS KEEP COUNT.', 'A CLEAR NIGHT OVER {CITY}, {TEMP}. I KEEP WATCH.'];
  } else if (w.phase === 'dawn') env = ['DAWN BREAKS OVER THE ISLE. A FINE DAY TO SHIP SOMETHING.', 'FIRST LIGHT OVER {CITY}. THE NIGHT WATCH ENDS.'];
  else if (w.phase === 'dusk') env = ['THE SUN SINKS BEHIND THE MIST. THE TORCHES ARE LIT.', 'DUSK OVER {CITY}. THE NIGHT WATCH BEGINS.'];
  else if (w.phase === 'golden' && k !== 'overcast') env = ['GOLDEN HOUR OVER {CITY}. EVEN MY ARMOR LOOKS GOOD.'];
  else if (k === 'overcast') env = ['GREY SKIES OVER {CITY}, {TEMP}. THE GULLS STAY HOME.', 'OVERCAST TODAY. THE CLOUDS PASS LIKE MERGE CONFLICTS.'];
  else if (k === 'partly') env = ['CLOUDS DRIFT OVER {CITY}, {TEMP}. A CALM WATCH.', 'SUN AND CLOUDS OVER THE ISLE. THE GULLS ARE OUT.'];
  else env = ['CLEAR SKIES OVER {CITY}, {TEMP}. THE GULLS ARE OUT.', 'A BRIGHT DAY ON THE ISLE, {TEMP}. NOTHING ON THE HORIZON.'];

  const s = stats, quest = s.quests[0]?.name?.toUpperCase();
  let act;
  if (s.todayCount > 0) act = [`${s.todayCount} NEW RUNE${s.todayCount === 1 ? '' : 'S'} CARVED TODAY. THE BEACON BURNS BRIGHT.`];
  else if (s.current >= 3) act = [`${s.current} DAYS OF RUNES IN A ROW. THE BEACON ROARS.`];
  else if (s.last7 > 0) {
    act = [`${s.yearTotal} RUNES CARVED THIS YEAR. THE BEACON STILL BURNS.`];
    if (quest) act.push(`LATEST QUEST: ${quest}. THE BEACON STILL BURNS.`);
  } else if (s.sinceLast != null && s.sinceLast <= 30) act = [`NO NEW RUNES FOR ${s.sinceLast} DAYS. THE BEACON HAS GONE COLD.`];
  else if (s.sinceLast != null) act = [`${s.sinceLast} DAYS WITHOUT A RUNE. I STAND GUARD ALL THE SAME.`];
  else act = ['NO RUNES CARVED YET. THE WALL AWAITS ITS FIRST.'];

  // the third line greets whoever is looking, with the real visitor count
  const n = s.views == null ? null : Number(s.views).toLocaleString('en-US');
  const greet = n == null ? ['WELCOME TO AVALON, TRAVELLER. MAKE YOURSELF AT HOME.']
    : [`WELCOME, TRAVELLER! ${n} HAVE VISITED AVALON BEFORE YOU.`, `${n} TRAVELLERS HAVE FOUND THE ISLE. WELCOME, FRIEND!`];

  return [sub(pick(env, seed)), sub(pick(act, seed >>> 3)), pick(greet, seed >>> 5)];
}

/** Word-wrap to lines of at most maxW pixels in the small font. */
export function wrap(str, maxW) {
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const wd of words) {
    const t = cur ? `${cur} ${wd}` : wd;
    if (measure(t) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function buildWorld({ now, cfg, weather, stats, createdAt }) {
  const local = localParts(now, cfg.timezone);
  const sun = sunPosition(now, cfg.lat, cfg.lon);
  const moonPos = moonPosition(now, cfg.lat, cfg.lon);
  const mp = moonPhase(now);
  const morning = sun.az < 180;

  let phase;
  if (sun.alt >= 10) phase = 'day';
  else if (sun.alt >= 2) phase = 'golden';
  else if (sun.alt >= -6) phase = morning ? 'dawn' : 'dusk';
  else if (sun.alt >= -12) phase = 'blue';
  else phase = 'night';
  const dark = Math.max(0, Math.min(1, (2 - sun.alt) / 14)); // 0 in daylight, 1 at full night

  const wk = weatherKind(weather?.code ?? 0);
  const wx = { ...weather, ...wk, missing: weather?.code == null, temp: weather?.temp ?? null, wind: weather?.wind ?? 8, windDir: weather?.windDir ?? 300, cloud: weather?.cloud ?? (wk.kind === 'clear' ? 5 : 50) };

  // Sky, graded by weather.
  const dayHaze = { overcast: '#9aa3b4', rain: '#7d8698', storm: '#2b2f40', fog: '#c9ced9', snow: '#c4cad8' }[wx.kind];
  const nightHaze = { overcast: '#15162a', rain: '#101122', storm: '#0d0e1a', fog: '#26283f', snow: '#1c1e34' }[wx.kind];
  const skyGrade = {
    clear: null, partly: null,
    overcast: { sat: 0.3, k: 0.55 }, rain: { sat: 0.35, k: 0.55 }, storm: { sat: 0.25, mul: [0.6, 0.6, 0.6], k: 0.55 },
    fog: { sat: 0.4, k: 0.68 }, snow: { sat: 0.4, k: 0.5 },
  }[wx.kind];
  const haze = dayHaze ? mix(dayHaze, nightHaze, dark) : null;
  const sky = SKIES[phase].map((c) => (skyGrade ? grade(c, { ...skyGrade, haze, k: skyGrade.k }) : c));

  // Lighting for the world, the characters (kept a little brighter so they read at night) and the far hills.
  let world = { ...LIGHTS[phase === 'golden' ? 'golden' : phase] };
  const wmod = { overcast: [0.72, 0.88], rain: [0.65, wx.level >= 3 ? 0.72 : 0.84], storm: [0.55, 0.64], snow: [0.75, 0.94], fog: [0.6, 0.95] }[wx.kind];
  if (wmod) world = { ...world, sat: world.sat * wmod[0], mul: world.mul.map((v) => v * wmod[1]) };
  if (wx.kind === 'fog') world = { ...world, haze: mix('#d6dae4', '#2a2c44', dark), k: 0.3 };
  const char = lerpLight(world, LIGHTS.day, 0.5);
  const far = { ...world, haze: sky.at(-1), k: 0.6 };
  const near = { ...world, haze: sky.at(-1), k: 0.3 };

  // Wind: we look south over the sea, so a wind toward the east moves things left.
  const sx = Math.sin((wx.windDir * Math.PI) / 180);
  const wind = {
    dir: Math.abs(sx) < 0.15 ? 1 : Math.sign(sx),
    speed: wx.wind,
    cls: wx.wind < 6 ? 0 : wx.wind < 15 ? 1 : wx.wind < 30 ? 2 : 3,
  };

  const mood = stats.sinceLast == null || stats.sinceLast > 30 ? 'hot' : stats.sinceLast > 7 ? 'warn' : 'ok';
  const beacon = stats.last7 === 0 ? 0 : stats.last7 <= 3 ? 1 : stats.last7 <= 10 ? 2 : 3;
  const seed = hash(`${local.iso}T${local.hh}`);

  const w = {
    now, local, cfg, sun, morning, phase, dark,
    moon: { ...moonPos, ...mp, name: moonName(mp.phase) },
    sky, light: { world, char, far, near },
    weather: wx, wind,
    season: season(local.m, local.d, cfg.lat),
    event: eventFor(local, createdAt),
    stats, mood, beacon, seed,
  };
  w.dialog = dialogLines(w, cfg, stats, seed);
  return w;
}
