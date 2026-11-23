// Fetches the two live inputs: public GitHub data and the current weather.
// Only public repositories are read, so nothing private ever reaches the image.

const UA = 'avalon-profile-scene';

async function gql(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GitHub GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  return json.data;
}

const MAIN_QUERY = `
query($login: String!) {
  user(login: $login) {
    login name createdAt
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: {field: PUSHED_AT, direction: DESC}) {
      totalCount
      nodes {
        name description isFork isArchived stargazerCount pushedAt
        primaryLanguage { name color }
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name color } } }
      }
    }
    contributionsCollection {
      contributionYears
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

export async function fetchGitHub(login, token) {
  if (!token) throw new Error('A GitHub token is needed (set GITHUB_TOKEN).');
  const { user } = await gql(token, MAIN_QUERY, { login });
  if (!user) throw new Error(`GitHub user "${login}" not found`);
  const cc = user.contributionsCollection;

  // All-time total (one contributionsCollection per year, aliased into one request).
  const years = cc.contributionYears;
  let allTime = 0;
  if (years.length) {
    const parts = years.map((y) =>
      `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { contributionCalendar { totalContributions } }`);
    const d = await gql(token, `query($login: String!) { user(login: $login) { ${parts.join('\n')} } }`, { login });
    allTime = years.reduce((s, y) => s + d.user[`y${y}`].contributionCalendar.totalContributions, 0);
  }

  return {
    fetchedAt: new Date().toISOString(),
    login: user.login,
    name: user.name || user.login,
    createdAt: user.createdAt,
    followers: user.followers.totalCount,
    repoCount: user.repositories.totalCount,
    repos: user.repositories.nodes.map((n) => ({
      name: n.name,
      description: n.description,
      fork: n.isFork,
      archived: n.isArchived,
      stars: n.stargazerCount,
      pushedAt: n.pushedAt,
      language: n.primaryLanguage?.name || null,
      color: n.primaryLanguage?.color || null,
      languages: n.languages.edges.map((e) => ({ name: e.node.name, color: e.node.color, size: e.size })),
    })),
    yearTotal: cc.contributionCalendar.totalContributions,
    allTime,
    years,
    days: cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays).map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'].indexOf(d.contributionLevel),
    })),
  };
}

export async function fetchWeather({ lat, lon, timezone }) {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,weather_code,is_day,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation'
    + `&timezone=${encodeURIComponent(timezone)}&forecast_days=1`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const c = (await res.json()).current;
  return {
    code: c.weather_code,
    temp: c.temperature_2m,
    cloud: c.cloud_cover,
    wind: c.wind_speed_10m,
    windDir: c.wind_direction_10m,
    precip: c.precipitation,
    isDay: !!c.is_day,
    time: c.time,
  };
}

/**
 * Profile views from the komarev counter. The README shows the same counter
 * as an invisible pixel, which is what counts each visit. Reading the number
 * here counts one view too, so the caller subtracts its own reads.
 */
export async function fetchViews(username) {
  const res = await fetch(`https://komarev.com/ghpvc/?username=${encodeURIComponent(username)}&style=flat`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`view counter ${res.status}`);
  const nums = [...(await res.text()).matchAll(/<text[^>]*>([\d.,\s]+)<\/text>/g)].map((m) => Number(m[1].replace(/\D/g, '')));
  if (!nums.length) throw new Error('view counter: no number in the badge');
  return nums.at(-1);
}

// Languages that say little about what someone writes (styles, build files).
const NOISE = new Set(['CSS', 'SCSS', 'Less', 'Sass', 'Stylus', 'Makefile', 'CMake', 'Batchfile', 'Dockerfile',
  'PowerShell', 'Procfile', 'Roff', 'Jupyter Notebook', 'HLSL', 'ShaderLab', 'GLSL', 'Smarty', 'Twig', 'Hack']);

/** Everything derived from the GitHub data that the scene needs. */
export function computeStats(gh, { today, ignoreLanguages = [], profileRepo } = {}) {
  const ignore = new Set([...NOISE, ...ignoreLanguages]);
  const days = gh.days.filter((d) => d.date <= today);
  const counts = days.map((d) => d.count);

  // Streaks: today with no contribution yet doesn't break a streak that reached yesterday.
  let current = 0;
  let i = counts.length - 1;
  if (i >= 0 && counts[i] === 0) i--;
  for (; i >= 0 && counts[i] > 0; i--) current++;
  let longest = 0, run = 0;
  for (const c of counts) { run = c > 0 ? run + 1 : 0; longest = Math.max(longest, run); }

  let sinceLast = null;
  for (let j = counts.length - 1; j >= 0; j--) if (counts[j] > 0) { sinceLast = counts.length - 1 - j; break; }

  const last7 = counts.slice(-7).reduce((a, b) => a + b, 0);
  const todayCount = counts.at(-1) || 0;

  // Language share: each public, non-fork repo gets one vote, split by bytes,
  // so a single vendored library can't drown out everything else.
  const votes = new Map();
  for (const r of gh.repos) {
    if (r.fork) continue;
    const langs = r.languages.filter((l) => !ignore.has(l.name));
    const total = langs.reduce((s, l) => s + l.size, 0);
    if (!total) continue;
    for (const l of langs) {
      const v = votes.get(l.name) || { name: l.name, color: l.color || '#8a8aa0', share: 0 };
      v.share += l.size / total;
      votes.set(l.name, v);
    }
  }
  const voteSum = [...votes.values()].reduce((s, v) => s + v.share, 0) || 1;
  const languages = [...votes.values()].map((v) => ({ ...v, share: v.share / voteSum })).sort((a, b) => b.share - a.share);

  const own = gh.repos.filter((r) => !r.fork);
  const quests = own.filter((r) => r.name.toLowerCase() !== String(profileRepo || gh.login).toLowerCase()).slice(0, 4);

  // How many public repositories use each language at all (the inventory's item counts).
  const langRepos = {};
  for (const r of own) for (const l of r.languages) langRepos[l.name] = (langRepos[l.name] || 0) + 1;

  const years = Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(gh.createdAt)) / (365.2425 * 864e5));

  // XP: one per contribution, ever. Level n -> n+1 costs 20n XP.
  const xp = gh.allTime;
  let level = 1, floor = 0;
  while (xp >= floor + 20 * level) { floor += 20 * level; level++; }

  return {
    current, longest, sinceLast, last7, todayCount,
    yearTotal: gh.yearTotal,
    repoCount: gh.repoCount,
    stars: own.reduce((s, r) => s + r.stars, 0),
    followers: gh.followers,
    since: Number(gh.createdAt.slice(0, 4)),
    years: Math.max(0, years),
    languages,
    langRepos,
    quests,
    xp, level, xpInto: xp - floor, xpNeed: 20 * level,
  };
}
