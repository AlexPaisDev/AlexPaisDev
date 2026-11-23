// Assembles layers into one SVG. Animation is CSS only (no scripts), which is
// what GitHub allows in a README image. Frame animations swap whole pixel
// layers with step timing, so motion always lands on the pixel grid.

import { rasterToSVG } from './raster.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v) => +v.toFixed(3);

export class Composer {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.parts = [];
    this.css = new Map();
    this.defs = [];
    this.n = 0;
  }

  id(prefix = 'i') { return `${prefix}${(this.n++).toString(36)}`; }

  keyframes(name, body) {
    if (!this.css.has(`@${name}`)) this.css.set(`@${name}`, `@keyframes ${name}{${body}}`);
    return name;
  }

  def(s) { this.defs.push(s); }
  push(s) { if (s) this.parts.push(s); }

  /** Wrap content in a <g>. anim: [name, seconds, timing, delaySeconds] */
  group(content, { anim, opacity, clip, transform, cls } = {}) {
    if (!content) return '';
    let a = '';
    if (cls) a += ` class="${cls}"`;
    if (opacity != null && opacity !== 1) a += ` opacity="${num(opacity)}"`;
    if (clip) a += ` clip-path="url(#${clip})"`;
    if (transform) a += ` transform="${transform}"`;
    if (anim) {
      const [name, dur, timing = 'linear', delay = 0, count = 'infinite'] = anim;
      a += ` style="animation:${name} ${num(dur)}s ${timing} ${num(delay)}s ${count}"`;
    }
    return `<g${a}>${content}</g>`;
  }

  paths(r, resolve) { return rasterToSVG(r, resolve); }

  raster(r, resolve, opts = {}) {
    const body = rasterToSVG(r, resolve);
    this.push(this.group(body, opts));
    return body;
  }

  /** N rasters shown one after another, each for period/N seconds. Frame 0 is the static fallback. */
  frames(rasters, resolve, period, { opacity, clip, wrap, delay: shift = 0 } = {}) {
    const n = rasters.length;
    if (n === 1 || !period) {
      const g = this.group(rasterToSVG(rasters[0], resolve), { opacity, clip });
      return wrap ? wrap(g) : this.push(g);
    }
    const name = this.keyframes(`fr${n}`, `0%{opacity:1}${num(100 / n)}%{opacity:0}100%{opacity:0}`);
    let out = '';
    rasters.forEach((r, i) => {
      const body = rasterToSVG(r, resolve);
      if (!body) return;
      // negative delays put frame i on screen during [i/n, (i+1)/n) of the period
      const delay = (i === 0 ? 0 : -(period - (i * period) / n)) + shift;
      out += `<g opacity="${i === 0 ? 1 : 0}" style="animation:${name} ${num(period)}s step-end ${num(delay)}s infinite">${body}</g>`;
    });
    const g = this.group(out, { opacity, clip });
    return wrap ? wrap(g) : this.push(g);
  }

  toString({ title, desc, scale = 3 }) {
    const css = [...this.css.values()].join('')
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W * scale}" height="${this.H * scale}" viewBox="0 0 ${this.W} ${this.H}" shape-rendering="crispEdges" role="img" aria-labelledby="t d">`
      + `<title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>`
      + `<style>${css}</style><defs>${this.defs.join('')}</defs>${this.parts.join('')}</svg>`;
  }
}
