# Avalon

The pixel-art scene on my profile. A plain Node.js script (no dependencies) draws it into an
animated SVG from two live sources:

- **GitHub** (GraphQL API, public data only): contribution calendar, public repositories,
  languages, followers.
- **[Open-Meteo](https://open-meteo.com/)**: the current weather at the place in `config.json`.

The sun and moon positions and the moon phase are computed locally (`src/astro.mjs`).
The [workflow](../.github/workflows/avalon.yml) runs every 30 minutes and publishes
`avalon.svg` to the `output` branch, which the profile README shows.

Animation is CSS only (GitHub doesn't run scripts in README images), and everything
stops for visitors who ask their system for reduced motion.

## Run it locally

```sh
GITHUB_TOKEN=$(gh auth token) node avalon/generate.mjs --out dist
```

Preview another time or weather (WMO weather codes: 0 clear, 2 partly cloudy, 3 overcast,
45 fog, 61/63/65 rain, 73 snow, 95 thunderstorm):

```sh
node avalon/generate.mjs --save-data gh.json          # fetch once
node avalon/generate.mjs --data gh.json --offline \
  --at 2026-12-24T21:00:00Z --weather 95 --temp 9 --wind 40 --wind-dir 250 --cloud 100
```

## Change the place

Edit `config.json`: `city`, `lat`, `lon` and `timezone` move the isle's sky and weather.
`ignoreLanguages` hides languages from the banners.

## Files

| File | What |
|---|---|
| `generate.mjs` | Command line: fetch, build the world, write `avalon.svg` and `state.json` |
| `src/data.mjs` | GitHub and weather fetching, stats (streaks, languages, XP) |
| `src/world.mjs` | Time of day, sky and lighting, weather, season, events, the guardian's lines |
| `src/astro.mjs` | Sun and moon positions, moon phase |
| `src/scene.mjs` | The isle: sky, castle, Rune Wall, water, weather, HUD |
| `src/panel.mjs` | The status panel and dialog box |
| `src/art.mjs` | Palette and sprites (the guardian comes from avalon-os) |
| `src/font.mjs` | The two bitmap fonts |
| `src/raster.mjs`, `src/svg.mjs` | Pixel buffer, and its conversion to compact SVG paths |
