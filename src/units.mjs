// Parsing of the small value types the spec uses: durations, lengths, percentages, frame rates.

const DURATION_RE = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/;

/**
 * Parse a duration. Accepts "150ms", "0.3s" and the W3C DTCG 2025.10 object form
 * { value: 150, unit: "ms" }. Returns milliseconds, or null when the value is not a duration.
 */
export function parseDuration(v) {
  if (typeof v === 'string') {
    const m = DURATION_RE.exec(v.trim());
    if (!m) return null;
    return m[2] === 's' ? Math.round(parseFloat(m[1]) * 1e6) / 1e3 : parseFloat(m[1]);
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const { value, unit } = v;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    if (unit === 'ms') return value;
    if (unit === 's') return Math.round(value * 1e6) / 1e3;
  }
  return null;
}

const LENGTH_RE = /^(-?\d+(?:\.\d+)?|-?\.\d+)(mm|cm|in|pt|px)$/;
const TO_MM = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 };

/** Parse a physical length ("3mm", "0.125in", "7pt"). Returns { value, unit, mm } or null. */
export function parseLength(v) {
  if (typeof v !== 'string') return null;
  const m = LENGTH_RE.exec(v.trim());
  if (!m) return null;
  const value = parseFloat(m[1]);
  return { value, unit: m[2], mm: value * TO_MM[m[2]] };
}

/** Convert a CSS-style font size to points. CSS defines 1in = 96px = 72pt, so 1px = 0.75pt. */
export function fontSizeToPt(v) {
  if (typeof v !== 'string') return null;
  const m = /^(\d+(?:\.\d+)?|\.\d+)(pt|px)$/.exec(v.trim());
  if (!m) return null;
  return m[2] === 'pt' ? parseFloat(m[1]) : parseFloat(m[1]) * 0.75;
}

/** Parse a percentage ("3.5%"). Returns the number, or null. */
export function parsePercent(v) {
  if (typeof v !== 'string') return null;
  const m = /^(-?\d+(?:\.\d+)?|-?\.\d+)%$/.exec(v.trim());
  return m ? parseFloat(m[1]) : null;
}

/** Parse a frame rate: a positive number, or a ratio like "24000/1001". Returns fps or null. */
export function parseFrameRate(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  const r = /^(\d+)\/(\d+)$/.exec(v.trim());
  if (r && Number(r[2]) > 0 && Number(r[1]) > 0) return Number(r[1]) / Number(r[2]);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && v.trim() !== '' ? n : null;
}

/** "{motion.duration.fast}" -> ["motion", "duration", "fast"], or null if v is not a reference. */
export function parseRef(v) {
  if (typeof v !== 'string') return null;
  const m = /^\{([A-Za-z0-9_.-]+)\}$/.exec(v.trim());
  return m ? m[1].split('.') : null;
}

export function getIn(obj, path) {
  let cur = obj;
  for (const k of path) {
    if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, k)) return undefined;
    cur = cur[k];
  }
  return cur;
}

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function fmt(n) {
  return String(Math.round(n * 1000) / 1000);
}
