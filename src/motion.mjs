// Build a checked model of the `motion:` block. Nothing here reports findings; the rules do.
import { parseDuration, parseRef, getIn, isPlainObject } from './units.mjs';
import { parseEasing, parseSpring, describeSpring } from './easing.mjs';

export const MOTION_KEYS = ['duration', 'easing', 'spring', 'loop', 'intent', 'reduced', 'time-constants', 'acknowledged', 'prefers-reduced-motion-fallback'];
export const INTENT_KEYS = ['duration', 'easing', 'spring', 'properties', 'reduced', 'interruptible'];
export const LOOP_KEYS = ['period', 'easing', 'reduced', 'properties'];
export const INTENT_REDUCED_KEYWORDS = ['instant', 'fade', 'ease', 'static', 'essential'];
export const LOOP_REDUCED_KEYWORDS = ['static', 'essential'];

const entries = (obj) => (isPlainObject(obj) ? Object.entries(obj) : []);

export function buildMotion(fm) {
  const raw = fm.motion;
  const model = {
    present: raw !== undefined,
    shapeError: raw !== undefined && !isPlainObject(raw),
    raw: isPlainObject(raw) ? raw : {},
    durations: [],
    timeConstants: [],
    easings: [],
    springs: [],
    loops: [],
    intents: [],
    reduced: null,
    legacy: null,
  };
  if (!isPlainObject(raw)) return model;
  const m = raw;

  for (const [name, v] of entries(m.duration)) {
    model.durations.push({ name, path: ['motion', 'duration', name], raw: v, ms: parseDuration(v) });
  }
  for (const [name, v] of entries(m['time-constants'])) {
    model.timeConstants.push({ name, path: ['motion', 'time-constants', name], raw: v, ms: parseDuration(v) });
  }
  for (const [name, v] of entries(m.easing)) {
    model.easings.push({ name, path: ['motion', 'easing', name], raw: v, parsed: parseEasing(v) });
  }
  for (const [name, v] of entries(m.spring)) {
    const parsed = parseSpring(v);
    model.springs.push({ name, path: ['motion', 'spring', name], raw: v, parsed, derived: parsed.error ? null : describeSpring(parsed) });
  }
  for (const [name, v] of entries(m.loop)) model.loops.push({ name, path: ['motion', 'loop', name], raw: v });
  for (const [name, v] of entries(m.intent)) model.intents.push({ name, path: ['motion', 'intent', name], raw: v });

  if (m.reduced !== undefined) {
    const r = isPlainObject(m.reduced) ? m.reduced : {};
    model.reduced = {
      path: ['motion', 'reduced'],
      raw: m.reduced,
      shapeError: !isPlainObject(m.reduced),
      default: r.default,
      durationRaw: r.duration,
      durationMs: r.duration === undefined ? null : parseDuration(r.duration),
    };
  }
  if (m['prefers-reduced-motion-fallback'] !== undefined) model.legacy = m['prefers-reduced-motion-fallback'];
  return model;
}

/** Find a token by kind and name. */
export function findToken(model, kind, name) {
  const list = { duration: model.durations, 'time-constants': model.timeConstants, easing: model.easings, spring: model.springs }[kind];
  return list ? list.find((t) => t.name === name) : undefined;
}

/**
 * Resolve a slot value (a reference, a bare token name, or a literal) to a token.
 * kind is 'duration', 'easing' or 'spring'.
 * Returns { ok, error?, broken?, token?, ms?, easing?, spring?, via }.
 */
export function resolveSlot(model, fm, kind, value) {
  const ref = parseRef(value);
  if (ref) {
    const target = getIn(fm, ref);
    if (target === undefined) return { ok: false, broken: true, error: `{${ref.join('.')}} does not exist` };
    const group = ref.length === 3 && ref[0] === 'motion' ? ref[1] : null;
    const okGroups = kind === 'duration' ? ['duration', 'time-constants'] : [kind];
    if (!group || !okGroups.includes(group)) {
      return { ok: false, broken: true, error: `{${ref.join('.')}} is not a ${kind} token` };
    }
    return tokenResult(model, kind, group, ref[2]);
  }
  if (typeof value === 'string' && kind !== 'duration') {
    const t = findToken(model, kind, value.trim());
    if (t) return tokenResult(model, kind, kind, t.name);
  }
  if (typeof value === 'string' && kind === 'duration') {
    const t = findToken(model, 'duration', value.trim());
    if (t) return tokenResult(model, kind, 'duration', t.name);
  }
  if (kind === 'duration') {
    const ms = parseDuration(value);
    return ms === null ? { ok: false, error: `"${String(value)}" is not a duration or a duration token`, via: 'literal' } : { ok: true, ms, via: 'literal' };
  }
  if (kind === 'easing') {
    const easing = parseEasing(value);
    return easing.error ? { ok: false, error: easing.error, via: 'literal' } : { ok: true, easing, via: 'literal' };
  }
  return { ok: false, error: `a spring must reference a spring token such as {motion.spring.name}`, via: 'literal' };
}

function tokenResult(model, kind, group, name) {
  const token = findToken(model, group, name);
  if (!token) return { ok: false, broken: true, error: `${group} token "${name}" does not exist` };
  if (kind === 'duration') {
    return token.ms === null ? { ok: false, broken: true, error: `${group} token "${name}" is not a valid duration` } : { ok: true, ms: token.ms, token, group, via: 'token' };
  }
  if (kind === 'easing') {
    return token.parsed.error ? { ok: false, broken: true, error: `easing token "${name}" is not valid` } : { ok: true, easing: token.parsed, token, group, via: 'token' };
  }
  return token.parsed.error ? { ok: false, broken: true, error: `spring token "${name}" is not valid` } : { ok: true, spring: token.parsed, derived: token.derived, token, group, via: 'token' };
}

/**
 * Work out what an intent actually does: its resolved duration (or spring settle time) and easing.
 * Invalid slots are skipped here; motion-ref-broken and the token rules report them.
 */
export function effectiveIntent(model, fm, intent) {
  const r = isPlainObject(intent.raw) ? intent.raw : {};
  const out = { ms: null, easing: null, spring: null, slots: {} };
  if (r.duration !== undefined) {
    out.slots.duration = resolveSlot(model, fm, 'duration', r.duration);
    if (out.slots.duration.ok) out.ms = out.slots.duration.ms;
  }
  if (r.easing !== undefined) {
    out.slots.easing = resolveSlot(model, fm, 'easing', r.easing);
    if (out.slots.easing.ok) out.easing = out.slots.easing.easing;
  }
  if (r.spring !== undefined) {
    out.slots.spring = resolveSlot(model, fm, 'spring', r.spring);
    if (out.slots.spring.ok) {
      out.spring = out.slots.spring.spring;
      if (out.ms === null) out.ms = out.slots.spring.derived.settleMs;
    }
  }
  return out;
}

/** Parse a `reduced` value: a duration in ms, or a keyword. */
export function parseReduced(v) {
  const ms = parseDuration(v);
  if (ms !== null) return { kind: 'duration', ms };
  if (typeof v === 'string') return { kind: 'keyword', word: v.trim() };
  return { kind: 'invalid' };
}
