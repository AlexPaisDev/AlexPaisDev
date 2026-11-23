#!/usr/bin/env node
// Renders the Avalon profile scene.
//
//   node avalon/generate.mjs                      live data -> dist/avalon.svg
//   node avalon/generate.mjs --out site           choose the output folder
//   node avalon/generate.mjs --data gh.json       use saved GitHub data (no token needed)
//   node avalon/generate.mjs --save-data gh.json  keep the fetched GitHub data
//   node avalon/generate.mjs --at 2026-12-24T22:30:00Z --weather 61 --temp 9 --wind 25 --wind-dir 270 --cloud 80
//                                                 preview another time or weather (WMO weather codes)
//   node avalon/generate.mjs --prev state.json    the last published state.json (its visitor count is the fallback)
//   node avalon/generate.mjs --visitors 1234      preview a visitor count without reading the counter
//
// GITHUB_TOKEN (or GH_TOKEN) must be set when fetching live GitHub data.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGitHub, fetchWeather, fetchViews, computeStats } from './src/data.mjs';
import { buildWorld, localParts } from './src/world.mjs';
import { Composer } from './src/svg.mjs';
import { drawScene, W } from './src/scene.mjs';
import { drawPanel, inventoryKeys, H } from './src/panel.mjs';
import { ITEMS } from './src/inventory.mjs';

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) a[k] = true;
    else { a[k] = v; i++; }
  }
  return a;
}

/** Lay the calendar out as 53 week-columns x 7 weekday-rows, like GitHub's graph. */
function buildGrid(days, today) {
  const list = days.filter((d) => d.date <= today);
  if (!list.length) return [];
  const t0 = Date.parse(`${list[0].date}T00:00:00Z`), offset = new Date(t0).getUTCDay();
  const grid = [];
  for (const d of list) {
    const t = Date.parse(`${d.date}T00:00:00Z`);
    const col = Math.floor((Math.round((t - t0) / 864e5) + offset) / 7);
    (grid[col] ||= [])[new Date(t).getUTCDay()] = { ...d, isToday: d.date === today };
  }
  const last = grid.slice(-53);
  while (last.length < 53) last.unshift([]);
  return last;
}

const args = parseArgs(process.argv.slice(2));
const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(await readFile(args.config || path.join(here, 'config.json'), 'utf8'));
const now = args.at ? new Date(args.at) : new Date();
if (Number.isNaN(now.valueOf())) throw new Error(`Bad --at time: ${args.at}`);

const gh = args.data
  ? JSON.parse(await readFile(args.data, 'utf8'))
  : await fetchGitHub(cfg.login, process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
if (args['save-data']) await writeFile(args['save-data'], JSON.stringify(gh));

let weather = null;
if (!args.offline) {
  try { weather = await fetchWeather(cfg); } catch (e) { console.warn(`Weather unavailable (${e.message}); drawing a clear sky.`); }
}
for (const [flag, key] of [['weather', 'code'], ['temp', 'temp'], ['wind', 'wind'], ['wind-dir', 'windDir'], ['cloud', 'cloud']]) {
  if (args[flag] !== undefined) weather = { ...(weather || {}), [key]: Number(args[flag]) };
}

// Visitors. If the counter can't be read (or the run is offline), the last
// published count stands in.
let prev = null;
if (args.prev) {
  try { prev = JSON.parse(await readFile(args.prev, 'utf8')); } catch { console.warn('No previous state to fall back on.'); }
}
let views = prev?.views?.count != null ? { count: prev.views.count } : null;
if (args.visitors !== undefined) views = { count: Number(args.visitors) };
else if (!args.offline && cfg.views) {
  try {
    views = { count: await fetchViews(cfg.views) };
  } catch (e) { console.warn(`Visitor count unavailable (${e.message}); keeping the last one.`); }
}

const today = localParts(now, cfg.timezone).iso;
const stats = computeStats(gh, { today, ignoreLanguages: cfg.ignoreLanguages, profileRepo: cfg.login });
stats.views = views?.count ?? null;
const world = buildWorld({ now, cfg, weather, stats, createdAt: gh.createdAt });
world.grid = buildGrid(gh.days, today);

const c = new Composer(W, H);
drawScene(c, world);
drawPanel(c, world);

const phaseWords = { night: 'night', blue: 'nightfall', dawn: 'dawn', dusk: 'dusk', golden: 'golden hour', day: 'day' };
const temp = world.weather.temp == null ? '' : `, ${Math.round(world.weather.temp)}°C`;
const title = `${cfg.name}: the isle of Avalon`;
const desc = `Live pixel-art scene. It is ${phaseWords[world.phase]} in ${cfg.city} (${world.local.time}), ${world.weather.label.toLowerCase()}${temp}. `
  + `The rune wall shows ${stats.yearTotal} contributions in the last year. ${stats.repoCount} public repositories, `
  + `${stats.followers} followers${stats.views == null ? '' : `, ${stats.views} visitors`}, level ${stats.level}. `
  + `Inventory: ${inventoryKeys(cfg).map((k) => ITEMS[k].name).join(', ')}. The guardian says: ${world.dialog.join(' ')}`;
const svg = c.toString({ title, desc });

const out = path.resolve(args.out || 'dist');
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'avalon.svg'), svg);
await writeFile(path.join(out, 'state.json'), `${JSON.stringify({
  renderedAt: now.toISOString(),
  local: world.local, phase: world.phase, season: world.season, event: world.event,
  sun: world.sun, moon: { alt: world.moon.alt, az: world.moon.az, name: world.moon.name, illum: world.moon.illum },
  weather: world.weather, wind: world.wind, mood: world.mood, beacon: world.beacon, dialog: world.dialog,
  views,
  stats: { ...stats, quests: stats.quests.map((q) => q.name), languages: stats.languages.slice(0, 6), langRepos: undefined },
}, null, 2)}\n`);
console.log(`avalon.svg: ${(svg.length / 1024).toFixed(1)} KB · ${world.phase} · ${world.weather.label} · ${world.dialog.join(' / ')}`);
