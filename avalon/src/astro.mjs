// Low-precision sun and moon positions (good to a fraction of a degree, which is
// plenty for placing pixels in a sky). Formulas follow the usual approximations
// from Meeus' "Astronomical Algorithms" as popularised by suncalc.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588, J2000 = 2451545;
const OBLIQ = RAD * 23.4397;

const toDays = (date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(OBLIQ) - Math.tan(b) * Math.sin(OBLIQ), Math.cos(l));
const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(OBLIQ) + Math.cos(b) * Math.sin(OBLIQ) * Math.sin(l));
const sidereal = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw;
const altitude = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
// azimuth measured from south, positive toward west
const azimuthS = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));

function sunCoords(d) {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d) {
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  return { ra: rightAscension(l, b), dec: declination(l, b) };
}

function position(coords, date, lat, lon) {
  const lw = RAD * -lon, phi = RAD * lat, d = toDays(date);
  const c = coords(d);
  const H = sidereal(d, lw) - c.ra;
  return {
    alt: altitude(H, phi, c.dec) / RAD,
    // degrees from north, clockwise (90 = east, 180 = south, 270 = west)
    az: ((azimuthS(H, phi, c.dec) / RAD) + 180 + 360) % 360,
  };
}

export const sunPosition = (date, lat, lon) => position(sunCoords, date, lat, lon);
export const moonPosition = (date, lat, lon) => position(moonCoords, date, lat, lon);

/** Moon age as a fraction of the synodic month: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(date) {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14); // a known new moon
  const age = ((date.valueOf() - ref) / DAY_MS / synodic) % 1;
  const phase = age < 0 ? age + 1 : age;
  return { phase, illum: (1 - Math.cos(2 * Math.PI * phase)) / 2 };
}

export function moonName(phase) {
  const names = ['NEW MOON', 'WAXING CRESCENT', 'FIRST QUARTER', 'WAXING GIBBOUS', 'FULL MOON', 'WANING GIBBOUS', 'LAST QUARTER', 'WANING CRESCENT'];
  return names[Math.round(phase * 8) % 8];
}
