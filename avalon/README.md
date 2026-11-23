# Avalon

The pixel-art isle on my profile: a live scene and an RPG status screen, redrawn every
30 minutes from the weather in Lisbon and my public GitHub data. Everything is drawn pixel
by pixel by a plain Node.js script, with no image assets and no dependencies.

## How to read the isle

| In the scene | What it shows |
|---|---|
| Sky, sun and moon | The real time of day in Lisbon, with the sun and moon where they actually are and the real moon phase |
| Clouds, rain, snow, fog, thunder | The current weather |
| Windmill, flag and banners | They turn and wave with the real wind speed and direction |
| **The Rune Wall** | My contribution calendar for the last year: one stone per day, glowing brighter on busier days. Today's stone blinks |
| **The beacon** on the keep | My contributions in the last 7 days. It burns bigger the more I ship and goes cold after a quiet week |
| **Banners** | My most-used languages across public repositories |
| **Allies** on the battlements | My followers |
| **The guardian's eyes** | Green: active this week. Amber: quiet for over a week. Red: away for over a month |
| Chimney smoke, lit windows, torches | Lit when it's cold, or once the sun goes down |

| In the status screen | What it shows |
|---|---|
| Level and XP | One XP per contribution, ever. Each level costs 20 XP more than the last |
| Stats | Public repositories, contributions in the last year, streaks, followers, stars and visitors |
| Quest log | My most recently updated public repositories |
| **Inventory** | The technologies on my CV, grouped by row: games and languages; web, systems and tools; data and cloud. The number on an item is how many of my public repositories use it |
| **Achievements** | Medals that go from bronze to silver to gold as the real numbers grow. The bar under each one is the progress to its next tier, and the line below the medals shows the closest one |
| Tooltip | The cursor walks the inventory and the medals, and the tooltip explains each one |
| The guardian | Reports on the weather and my activity, and greets visitors |

The trees change with the seasons, and a few dates bring their own surprises.

## How it works

- **GitHub** (GraphQL API, public data only): contribution calendar, public repositories,
  languages, followers. Nothing private reaches the image.
- **[Open-Meteo](https://open-meteo.com/)**: the current weather at the place in `config.json`.
- **[Profile views counter](https://github.com/antonkomarev/github-profile-views-counter)**:
  the profile README loads it as an invisible pixel, which counts each visit (the counter
  only counts requests from GitHub's image proxy). The workflow reads the number for the
  scene; if the counter is down, the last count from `state.json` is kept.

The sun and moon positions and the moon phase are computed locally (`src/astro.mjs`).
The [workflow](../.github/workflows/avalon.yml) runs every 30 minutes and publishes
`avalon.svg` and `state.json` to the `output` branch, which the profile README shows.

Animation is CSS only (GitHub doesn't run scripts in README images), and everything
stops for visitors who ask their system for reduced motion.

## Run it locally

```sh
GITHUB_TOKEN=$(gh auth token) node avalon/generate.mjs --out dist --offline
```

`--offline` skips the weather and the visitor counter. Preview another time, weather or visitor count (WMO weather codes: 0 clear,
2 partly cloudy, 3 overcast, 45 fog, 61/63/65 rain, 73 snow, 95 thunderstorm):

```sh
node avalon/generate.mjs --save-data gh.json --offline   # fetch the GitHub data once
node avalon/generate.mjs --data gh.json --offline --visitors 1234 \
  --at 2026-12-24T21:00:00Z --weather 95 --temp 9 --wind 40 --wind-dir 250 --cloud 100
```

## Configure

`config.json`:

| Key | What |
|---|---|
| `city`, `lat`, `lon`, `timezone` | The place whose sky and weather the isle shows |
| `name`, `title`, `region` | The character card |
| `inventory` | Up to 27 items (three rows of nine), in order. Available: `unity`, `csharp`, `c`, `java`, `python`, `sql`, `javascript`, `php`, `scala`, `html`, `css`, `mysql`, `linux`, `docker`, `nodered`, `xcode`, `git`, `vscode`, `databricks`, `azure`, `fabric`, `powerbi`, `sharepoint`, `mongodb`, `redis`, `confluence`, `github`, `love`, `lua`, `bootstrap`, `discord`, `linkedin` (new ones go in `src/inventory.mjs`) |
| `views` | The username of the views counter. It must match the counter pixel in the profile README |
| `ignoreLanguages` | Languages to leave off the banners |

## Files

| File | What |
|---|---|
| `generate.mjs` | Command line: fetch, build the world, write `avalon.svg` and `state.json` |
| `src/data.mjs` | GitHub, weather and visitor fetching; stats (streaks, languages, XP) |
| `src/world.mjs` | Time of day, sky and lighting, weather, season, events, the guardian's lines |
| `src/astro.mjs` | Sun and moon positions, moon phase |
| `src/scene.mjs` | The isle: sky, castle, Rune Wall, water, weather, HUD |
| `src/panel.mjs` | The status screen: card, stats, quest log, inventory, achievements, dialog |
| `src/inventory.mjs` | The inventory items and the achievement medals |
| `src/art.mjs` | Palette and sprites (the guardian comes from avalon-os) |
| `src/font.mjs` | The two bitmap fonts |
| `src/raster.mjs`, `src/svg.mjs` | Pixel buffer, and its conversion to compact SVG paths |
