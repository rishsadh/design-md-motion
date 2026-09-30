// Easing curves and the spring model. Springs are kept as physics and derived on export.
import { isPlainObject, fmt } from './units.mjs';

export const KEYWORD_BEZIER = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};
const STEP_KEYWORDS = ['step-start', 'step-end'];

/**
 * Parse an easing value.
 * Accepted: [x1, y1, x2, y2] (canonical), "cubic-bezier(...)", a CSS keyword, or "linear(...)".
 * Returns { kind, bezier?, stops?, css } or { error }.
 */
export function parseEasing(v) {
  if (Array.isArray(v)) return checkBezier(v);
  if (typeof v !== 'string') {
    return { error: 'an easing is a four-number array, a cubic-bezier() string, a CSS keyword or a linear() string' };
  }
  const s = v.trim();
  if (s in KEYWORD_BEZIER) return { kind: 'keyword', name: s, bezier: KEYWORD_BEZIER[s], css: s };
  if (STEP_KEYWORDS.includes(s)) return { kind: 'step', name: s, css: s };
  let m = /^cubic-bezier\(([^)]*)\)$/.exec(s);
  if (m) return checkBezier(m[1].split(',').map((x) => (x.trim() === '' ? NaN : Number(x))));
  m = /^linear\(([^)]*)\)$/.exec(s);
  if (m) {
    const stops = m[1].split(',').map((x) => Number(x.trim().split(/\s+/)[0]));
    if (stops.length < 2 || stops.some((n) => !Number.isFinite(n))) return { error: 'linear() needs at least two numeric stops' };
    return { kind: 'linear-stops', stops, css: s };
  }
  return { error: `"${s}" is not a recognised easing` };
}

function checkBezier(nums) {
  if (nums.length !== 4 || nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    return { error: 'a cubic bezier needs exactly four numbers: x1, y1, x2, y2' };
  }
  if (nums[0] < 0 || nums[0] > 1 || nums[2] < 0 || nums[2] > 1) {
    return { error: `x1 and x2 must be between 0 and 1 (got ${fmt(nums[0])} and ${fmt(nums[2])}); y values may be any number` };
  }
  return { kind: 'bezier', bezier: nums, css: `cubic-bezier(${nums.map(fmt).join(', ')})` };
}

/** True when the curve is a constant-rate progression. */
export function isLinearEasing(e) {
  if (!e || e.error || !e.bezier) return false;
  return e.bezier[0] === 0 && e.bezier[1] === 0 && e.bezier[2] === 1 && e.bezier[3] === 1;
}

/** True when the curve leaves the 0..1 range, so the property overshoots its target. */
export function overshoots(e) {
  if (!e || e.error) return false;
  if (e.kind === 'bezier') return e.bezier[1] < 0 || e.bezier[1] > 1 || e.bezier[3] < 0 || e.bezier[3] > 1;
  if (e.kind === 'linear-stops') return e.stops.some((n) => n > 1 || n < 0);
  return false;
}

/** Validate a spring token. Returns { stiffness, damping, mass, extra } or { error }. */
export function parseSpring(v) {
  if (!isPlainObject(v)) return { error: 'a spring is a map with stiffness and damping (mass is optional, default 1)' };
  const mass = v.mass === undefined ? 1 : v.mass;
  for (const [k, n] of [['stiffness', v.stiffness], ['damping', v.damping], ['mass', mass]]) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return { error: `${k} must be a number greater than 0` };
  }
  const extra = Object.keys(v).filter((k) => !['stiffness', 'damping', 'mass'].includes(k));
  return { stiffness: v.stiffness, damping: v.damping, mass, extra };
}

/**
 * Step response of a damped spring released from rest, target 1.
 * The remaining distance e(t) solves m e'' + c e' + k e = 0 with e(0) = 1 and e'(0) = 0.
 */
export function springPosition({ stiffness: k, damping: c, mass: m }) {
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  let e;
  if (Math.abs(zeta - 1) < 1e-9) {
    e = (t) => Math.exp(-w0 * t) * (1 + w0 * t);
  } else if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    e = (t) => Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  } else {
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - s);
    const r2 = -w0 * (zeta + s);
    e = (t) => (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }
  return { position: (tMs) => 1 - e(tMs / 1000), w0, zeta };
}

/**
 * Describe a spring: damping ratio, natural frequency, peak overshoot and the time it takes
 * to stay inside a 1% band around the target (milliseconds, searched up to 20 seconds).
 */
export function describeSpring(spring, band = 0.01) {
  const { position, w0, zeta } = springPosition(spring);
  let peak = 0;
  let lastOutside = 0;
  for (let t = 0; t <= 20000; t += 1) {
    const p = position(t);
    if (p > peak) peak = p;
    if (Math.abs(1 - p) > band) lastOutside = t;
  }
  return {
    dampingRatio: zeta,
    naturalFrequencyHz: w0 / (2 * Math.PI),
    overshoot: Math.max(0, peak - 1),
    settleMs: lastOutside >= 20000 ? null : lastOutside + 1,
  };
}

/** Sample the spring into a CSS linear() easing. Returns { css, durationMs, points }. */
export function springToLinear(spring, points = 48) {
  const { settleMs } = describeSpring(spring);
  if (settleMs === null) return { css: null, durationMs: null, points };
  const { position } = springPosition(spring);
  const vals = [];
  for (let i = 0; i < points; i++) {
    const v = i === points - 1 ? 1 : position((i / (points - 1)) * settleMs);
    vals.push(fmt(v));
  }
  vals[0] = '0';
  return { css: `linear(${vals.join(', ')})`, durationMs: settleMs, points };
}
