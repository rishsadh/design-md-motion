// Lint rules. Each rule has an id, a default severity, a one-line summary and the reasoning.
// Rules report through ctx.add(severity, message, path); the runner adds line numbers.
import { parseLength, parsePercent, parseFrameRate, fontSizeToPt, getIn, isPlainObject, fmt } from './units.mjs';
import { isLinearEasing, overshoots } from './easing.mjs';
import {
  MOTION_KEYS, INTENT_KEYS, LOOP_KEYS, INTENT_REDUCED_KEYWORDS, LOOP_REDUCED_KEYWORDS,
  resolveSlot, effectiveIntent, parseReduced,
} from './motion.mjs';
import { sectionRank } from './parse.mjs';

export const DEFAULTS = {
  reduceThresholdMs: 200,
  maxTransitionMs: 1000,
  maxSpringSettleMs: 1000,
  minBleedMm: 2,
  maxBleedMm: 6.35,
};

const has = (sections, title) => sections.some((s) => s.level === 2 && s.title.toLowerCase() === title);
const pathStr = (p) => p.join('.');

function nearest(word, options) {
  const d = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  };
  let best = null;
  for (const o of options) if (d(word, o) <= 2 && (!best || d(word, o) < d(word, best))) best = o;
  return best;
}

// Whether an intent is covered by a reduced path: its own `reduced`, or a global default.
function intentCovered(ctx, intent) {
  const r = isPlainObject(intent.raw) ? intent.raw : {};
  return r.reduced !== undefined || (ctx.model.reduced && ctx.model.reduced.default !== undefined);
}

export const RULES = [
  {
    id: 'design-md-frontmatter',
    severity: 'error',
    summary: 'The YAML front matter must parse.',
    why: 'Tokens live in the front matter. If it does not parse, every agent reading the file sees no tokens at all.',
    run(ctx) {
      if (ctx.yamlError) ctx.add('error', `front matter is not valid YAML: ${ctx.yamlError}`, []);
    },
  },
  // ---------------------------------------------------------------- motion: shape
  {
    id: 'motion-unknown-key',
    severity: 'warning',
    summary: 'A key under motion, an intent or a loop is not in the spec.',
    why: 'Typos such as "durations" or "easings" are silently ignored by consumers, so the tokens never reach the agent.',
    run({ model, add }) {
      if (model.shapeError) return add('error', 'motion must be a map', ['motion']);
      for (const k of Object.keys(model.raw)) {
        if (!MOTION_KEYS.includes(k)) {
          const n = nearest(k, MOTION_KEYS);
          add('warning', `"${k}" is not a motion key${n ? `; did you mean "${n}"?` : ''}`, ['motion', k]);
        }
      }
      for (const it of model.intents) {
        if (!isPlainObject(it.raw)) { add('error', 'an intent must be a map', it.path); continue; }
        for (const k of Object.keys(it.raw)) {
          if (!INTENT_KEYS.includes(k)) add('warning', `"${k}" is not an intent key (${INTENT_KEYS.join(', ')})`, [...it.path, k]);
        }
      }
      for (const lp of model.loops) {
        if (!isPlainObject(lp.raw)) { add('error', 'a loop must be a map', lp.path); continue; }
        for (const k of Object.keys(lp.raw)) {
          if (!LOOP_KEYS.includes(k)) add('warning', `"${k}" is not a loop key (${LOOP_KEYS.join(', ')})`, [...lp.path, k]);
        }
      }
    },
  },
  // ---------------------------------------------------------------- motion: tokens
  {
    id: 'motion-duration-invalid',
    severity: 'error',
    summary: 'A duration must be a number with ms or s, or a DTCG { value, unit } object.',
    why: 'A bare number like 150 has no unit, and agents guess. Seconds and milliseconds get mixed up.',
    run({ model, fm, add }) {
      for (const t of [...model.durations, ...model.timeConstants]) {
        if (t.ms === null) add('error', `${JSON.stringify(t.raw)} is not a duration; write it like 150ms or 0.3s`, t.path);
      }
      for (const lp of model.loops) {
        if (!isPlainObject(lp.raw)) continue;
        if (lp.raw.period === undefined) { add('error', 'a loop needs a period', lp.path); continue; }
        const r = resolveSlot(model, fm, 'duration', lp.raw.period);
        if (!r.ok && !r.broken) add('error', `${JSON.stringify(lp.raw.period)} is not a duration; write it like 1100ms`, [...lp.path, 'period']);
      }
      if (model.reduced && model.reduced.durationRaw !== undefined && model.reduced.durationMs === null) {
        add('error', `${JSON.stringify(model.reduced.durationRaw)} is not a duration`, ['motion', 'reduced', 'duration']);
      }
    },
  },
  {
    id: 'motion-easing-invalid',
    severity: 'error',
    summary: 'An easing must be a four-number bezier with x between 0 and 1, a CSS keyword or linear().',
    why: 'A bezier with x outside 0 to 1 is rejected by browsers and by the W3C DTCG cubicBezier type.',
    run({ model, add }) {
      for (const t of model.easings) if (t.parsed.error) add('error', t.parsed.error, t.path);
    },
  },
  {
    id: 'motion-spring-invalid',
    severity: 'error',
    summary: 'A spring needs stiffness and damping above 0 (mass defaults to 1).',
    why: 'Zero or negative physics never settles or has no meaning. The model is the source of truth, so it has to be valid.',
    run({ model, add }) {
      for (const t of model.springs) {
        if (t.parsed.error) add('error', t.parsed.error, t.path);
        else if (t.parsed.extra.length) add('warning', `unknown spring field(s): ${t.parsed.extra.join(', ')}. Only stiffness, damping and mass are defined`, t.path);
      }
    },
  },
  {
    id: 'motion-spring-slow-settle',
    severity: 'warning',
    summary: 'A spring takes longer than 1s to settle, or never settles.',
    why: 'Settle time is when the element stops moving, which is what the user waits for. It is derived from the physics, so it is checked.',
    run({ model, config, add }) {
      for (const t of model.springs) {
        if (!t.derived) continue;
        if (t.derived.settleMs === null) add('warning', 'spring does not settle within 20 seconds', t.path);
        else if (t.derived.settleMs > config.maxSpringSettleMs) add('warning', `spring needs ${t.derived.settleMs}ms to settle (limit ${config.maxSpringSettleMs}ms); raise damping or stiffness`, t.path);
      }
    },
  },
  {
    id: 'motion-duration-duplicate',
    severity: 'warning',
    summary: 'Two duration tokens have the same value.',
    why: 'A scale with duplicates has a name that means nothing. Agents then pick either at random.',
    run({ model, add }) {
      const seen = new Map();
      for (const t of model.durations) {
        if (t.ms === null) continue;
        if (seen.has(t.ms)) add('warning', `${t.name} and ${seen.get(t.ms)} are both ${fmt(t.ms)}ms`, t.path);
        else seen.set(t.ms, t.name);
      }
    },
  },
  {
    id: 'motion-unused-token',
    severity: 'info',
    summary: 'A duration, easing or spring token is not used by any intent or loop.',
    why: 'Only checked when intents exist. An unused token is either dead weight or a sign an intent is missing. Zero-length durations are exempt.',
    run({ model, fm, add }) {
      if (!model.intents.length) return;
      const used = new Set();
      const note = (r) => { if (r && r.ok && r.token) used.add(`${r.group}.${r.token.name}`); };
      for (const it of model.intents) {
        const e = effectiveIntent(model, fm, it);
        Object.values(e.slots).forEach(note);
      }
      for (const lp of model.loops) {
        if (!isPlainObject(lp.raw)) continue;
        if (lp.raw.period !== undefined) note(resolveSlot(model, fm, 'duration', lp.raw.period));
        if (lp.raw.easing !== undefined) note(resolveSlot(model, fm, 'easing', lp.raw.easing));
      }
      for (const [group, list] of [['duration', model.durations], ['easing', model.easings], ['spring', model.springs]]) {
        for (const t of list) {
          if (group === 'duration' && t.ms === 0) continue;
          if (!used.has(`${group}.${t.name}`)) add('info', `${group} token "${t.name}" is not used by any intent or loop`, t.path);
        }
      }
    },
  },
  // ---------------------------------------------------------------- motion: intents
  {
    id: 'motion-ref-broken',
    severity: 'error',
    summary: 'A reference or token name in an intent or loop does not resolve to a token of the right kind.',
    why: 'A broken reference means the agent falls back to inventing a value, which is the problem the section exists to solve.',
    run({ model, fm, add }) {
      for (const it of model.intents) {
        if (!isPlainObject(it.raw)) continue;
        const e = effectiveIntent(model, fm, it);
        for (const [slot, r] of Object.entries(e.slots)) if (!r.ok) add('error', r.error, [...it.path, slot]);
      }
      for (const lp of model.loops) {
        if (!isPlainObject(lp.raw)) continue;
        for (const [slot, kind] of [['period', 'duration'], ['easing', 'easing']]) {
          if (lp.raw[slot] === undefined) continue;
          const r = resolveSlot(model, fm, kind, lp.raw[slot]);
          if (!r.ok && r.broken) add('error', r.error, [...lp.path, slot]);
          else if (!r.ok && kind === 'easing') add('error', r.error, [...lp.path, slot]);
        }
      }
      if (model.legacy !== null) {
        if (!isPlainObject(model.legacy)) return;
        for (const k of Object.keys(model.legacy)) {
          if (!model.durations.some((d) => d.name === k)) add('error', `"${k}" is not a duration token, so this fallback applies to nothing`, ['motion', 'prefers-reduced-motion-fallback', k]);
        }
      }
    },
  },
  {
    id: 'motion-intent-incomplete',
    severity: 'error',
    summary: 'An intent needs a duration or a spring.',
    why: 'An intent with no timing gives the agent a name and nothing to implement.',
    run({ model, add }) {
      for (const it of model.intents) {
        if (!isPlainObject(it.raw)) continue;
        if (it.raw.duration === undefined && it.raw.spring === undefined) add('error', 'has neither duration nor spring', it.path);
      }
    },
  },
  {
    id: 'motion-intent-ambiguous',
    severity: 'warning',
    summary: 'An intent sets a spring and also a duration or an easing.',
    why: 'A spring carries its own timing and curve. Setting both leaves it unclear which one wins.',
    run({ model, add }) {
      for (const it of model.intents) {
        if (!isPlainObject(it.raw)) continue;
        if (it.raw.spring !== undefined && (it.raw.duration !== undefined || it.raw.easing !== undefined)) {
          add('warning', 'sets spring together with duration or easing; use one model', it.path);
        }
      }
    },
  },
  {
    id: 'motion-reduced-invalid',
    severity: 'error',
    summary: 'A reduced value must be a duration or a known keyword.',
    why: 'Reduced-motion behaviour is a small fixed vocabulary so every consumer reads it the same way.',
    run({ model, add }) {
      const check = (r, words, path, what) => {
        if (r === undefined) return;
        const p = parseReduced(r);
        if (p.kind === 'invalid') add('error', `reduced must be a duration or one of: ${words.join(', ')}`, path);
        else if (p.kind === 'keyword' && !words.includes(p.word)) add('error', `"${p.word}" is not an ${what} reduced keyword (${words.join(', ')})`, path);
        else if (p.kind === 'duration' && words === LOOP_REDUCED_KEYWORDS) add('error', 'a loop cannot be shortened; use static or essential', path);
      };
      for (const it of model.intents) if (isPlainObject(it.raw)) check(it.raw.reduced, INTENT_REDUCED_KEYWORDS, [...it.path, 'reduced'], 'intent');
      for (const lp of model.loops) if (isPlainObject(lp.raw)) check(lp.raw.reduced, LOOP_REDUCED_KEYWORDS, [...lp.path, 'reduced'], 'loop');
      const r = model.reduced;
      if (r) {
        if (r.shapeError) add('error', 'motion.reduced must be a map with default and duration', r.path);
        else check(r.default, INTENT_REDUCED_KEYWORDS, [...r.path, 'default'], 'intent');
      }
    },
  },
  {
    id: 'motion-reduced-ease-noop',
    severity: 'warning',
    summary: 'reduced: ease on an intent that has no spring and no overshoot.',
    why: '"ease" replaces a spring or an overshooting curve with a plain one. If there is nothing to replace, the fallback changes nothing.',
    run({ model, fm, add }) {
      for (const it of model.intents) {
        if (!isPlainObject(it.raw) || it.raw.reduced !== 'ease') continue;
        const e = effectiveIntent(model, fm, it);
        if (!e.spring && !overshoots(e.easing)) add('warning', 'reduced is ease, but this intent has no spring or overshoot to remove', [...it.path, 'reduced']);
      }
    },
  },
  {
    id: 'motion-reduce-compat',
    severity: 'warning',
    summary: 'A transition longer than 200ms has no reduced-motion path.',
    why: 'Checks intents when there are any, otherwise duration tokens. The 200ms line is a heuristic for when a change reads as deliberate motion, not a WCAG number. Loops are checked by motion-loop-reduced.',
    run(ctx) {
      const { model, fm, config, add } = ctx;
      if (model.intents.length) {
        for (const it of model.intents) {
          if (!isPlainObject(it.raw)) continue;
          const e = effectiveIntent(model, fm, it);
          if (e.ms !== null && e.ms > config.reduceThresholdMs && !intentCovered(ctx, it)) {
            add('warning', `${fmt(e.ms)}ms is over ${config.reduceThresholdMs}ms and there is no reduced path; add reduced here or motion.reduced.default`, it.path);
          }
        }
        return;
      }
      const legacy = isPlainObject(model.legacy) ? model.legacy : {};
      for (const t of model.durations) {
        if (t.ms !== null && t.ms > config.reduceThresholdMs && !(model.reduced && model.reduced.default !== undefined) && legacy[t.name] === undefined) {
          add('warning', `${fmt(t.ms)}ms is over ${config.reduceThresholdMs}ms and nothing says what happens under prefers-reduced-motion`, t.path);
        }
      }
    },
  },
  {
    id: 'motion-loop-reduced',
    severity: 'warning',
    summary: 'A loop has no reduced behaviour of its own.',
    why: 'A loop has no end, so shortening it is wrong. It has to say whether it stops (static) or keeps only its essential movement (essential).',
    run({ model, add }) {
      for (const lp of model.loops) {
        if (!isPlainObject(lp.raw)) continue;
        if (lp.raw.reduced === undefined) add('warning', 'no reduced; say static or essential', lp.path);
      }
    },
  },
  {
    id: 'motion-loop-pause-control',
    severity: 'info',
    summary: 'Loops that start on their own and run past 5 seconds need a way to pause, stop or hide them.',
    why: 'WCAG 2.2 success criterion 2.2.2 covers movement that starts automatically, lasts more than five seconds and sits beside other content, unless it is essential.',
    run({ model, add }) {
      const live = model.loops.filter((l) => isPlainObject(l.raw) && l.raw.reduced !== 'essential');
      if (live.length) add('info', `${live.length} loop(s) are not marked essential; if they start automatically, provide a pause control (WCAG 2.2.2)`, ['motion', 'loop']);
    },
  },
  {
    id: 'motion-linear-on-transition',
    severity: 'warning',
    summary: 'A transition intent uses linear easing.',
    why: 'A constant rate is right for loops and progress. A one-way transition that starts and stops at full speed reads as mechanical.',
    run({ model, fm, add }) {
      for (const it of model.intents) {
        if (!isPlainObject(it.raw)) continue;
        const e = effectiveIntent(model, fm, it);
        if (isLinearEasing(e.easing)) add('warning', 'uses linear easing; use an eased curve, or define this as a loop', [...it.path, 'easing']);
      }
    },
  },
  {
    id: 'motion-transition-ceiling',
    severity: 'warning',
    summary: 'A transition intent runs longer than 1000ms.',
    why: 'Material 3 stops its duration scale at 1000ms. Past that a transition blocks the user. Raise the ceiling with --max-transition if it is deliberate.',
    run({ model, fm, config, add }) {
      for (const it of model.intents) {
        if (!isPlainObject(it.raw)) continue;
        const e = effectiveIntent(model, fm, it);
        if (e.ms !== null && e.ms > config.maxTransitionMs) add('warning', `${fmt(e.ms)}ms is over the ${config.maxTransitionMs}ms ceiling`, it.path);
      }
    },
  },
  {
    id: 'motion-legacy-fallback',
    severity: 'info',
    summary: 'Uses the prefers-reduced-motion-fallback map from the original proposal.',
    why: 'It is read for compatibility and counts as a reduced path for duration tokens. The reduced keyword on intents and loops says more.',
    run({ model, add }) {
      if (model.legacy !== null) add('info', 'prefers-reduced-motion-fallback is read as a duration map; prefer motion.reduced plus reduced on each intent', ['motion', 'prefers-reduced-motion-fallback']);
    },
  },
  // ---------------------------------------------------------------- motion: prose
  {
    id: 'motion-section-missing',
    severity: 'info',
    summary: 'There are motion tokens but no "## Motion" section.',
    why: 'Tokens are the values. The prose is the intent: when to move, what moves, and the choreography that does not fit a scale.',
    run({ model, sections, add }) {
      if (model.present && !has(sections, 'motion')) add('info', 'add a "## Motion" section that explains when and why things move', ['motion']);
    },
  },
  {
    id: 'motion-tokens-missing',
    severity: 'info',
    summary: 'There is a "## Motion" section but no motion tokens.',
    why: 'Prose alone gives agents nothing they can apply exactly.',
    run({ model, sections, add }) {
      const s = sections.find((x) => x.level === 2 && x.title.toLowerCase() === 'motion');
      if (s && !model.present) add('info', '"## Motion" has no matching motion: block in the front matter', [], s.line);
    },
  },
  {
    id: 'motion-section-order',
    severity: 'warning',
    summary: '"## Motion" is not between Shapes and Components.',
    why: 'The upstream spec says known sections appear in a fixed order. This proposes Motion sits after Shapes and before Components.',
    run({ sections, add }) {
      const ranked = sections.filter((s) => s.level === 2).map((s) => ({ s, r: sectionRank(s.title) })).filter((x) => x.r !== null);
      const mo = ranked.find((x) => x.r === 6.5);
      if (!mo) return;
      const i = ranked.indexOf(mo);
      if (ranked.slice(0, i).some((x) => x.r > 6.5) || ranked.slice(i + 1).some((x) => x.r < 6.5)) {
        add('warning', '"## Motion" should come after Shapes and before Components', [], mo.s.line);
      }
    },
  },
  // ---------------------------------------------------------------- surfaces
  {
    id: 'surface-unknown',
    severity: 'info',
    summary: 'A surface other than print or video is defined.',
    why: 'Unknown surfaces are preserved, not rejected, so this is only a note that no rules apply to them.',
    run({ fm, add }) {
      if (fm.surfaces === undefined) return;
      if (!isPlainObject(fm.surfaces)) return add('error', 'surfaces must be a map of surface name to profile', ['surfaces']);
      for (const [k, v] of Object.entries(fm.surfaces)) {
        if (!['print', 'video'].includes(k)) add('info', `surface "${k}" has no rules in this linter and is preserved as written`, ['surfaces', k]);
        else if (!isPlainObject(v)) add('error', `surfaces.${k} must be a map`, ['surfaces', k]);
      }
    },
  },
  {
    id: 'surface-section-missing',
    severity: 'info',
    summary: 'There are surface profiles but no "## Surfaces" section.',
    why: 'The profile holds the numbers. The prose says which artefacts use which surface and what to do when they conflict with the web tokens.',
    run({ fm, sections, add }) {
      if (isPlainObject(fm.surfaces) && !has(sections, 'surfaces')) add('info', 'add a "## Surfaces" section', ['surfaces']);
    },
  },
  {
    id: 'print-length-invalid',
    severity: 'error',
    summary: 'A print length must be a number with mm, cm, in or pt.',
    why: 'Print sizes without a unit are ambiguous between millimetres and inches.',
    run({ fm, add }) {
      const p = getIn(fm, ['surfaces', 'print']);
      if (!isPlainObject(p)) return;
      const check = (path, v) => { if (v !== undefined && parseLength(v) === null) add('error', `${JSON.stringify(v)} is not a length; write it like 3mm or 0.125in`, path); };
      if (p.trim !== undefined) {
        if (!isPlainObject(p.trim)) add('error', 'trim must be a map with width and height', ['surfaces', 'print', 'trim']);
        else {
          check(['surfaces', 'print', 'trim', 'width'], p.trim.width);
          check(['surfaces', 'print', 'trim', 'height'], p.trim.height);
          if (p.trim.width === undefined || p.trim.height === undefined) add('error', 'trim needs both width and height', ['surfaces', 'print', 'trim']);
        }
      }
      for (const k of ['bleed', 'safe-margin', 'min-text-size', 'min-stroke']) check(['surfaces', 'print', k], p[k]);
    },
  },
  {
    id: 'print-bleed-missing',
    severity: 'error',
    summary: 'A print surface with a trim size has no bleed.',
    why: 'Without bleed, any background or image that reaches the edge leaves a white sliver when the sheet is trimmed.',
    run({ fm, add }) {
      const p = getIn(fm, ['surfaces', 'print']);
      if (!isPlainObject(p) || p.trim === undefined) return;
      const b = p.bleed === undefined ? null : parseLength(p.bleed);
      if (p.bleed === undefined || (b && b.mm <= 0)) add('error', 'define a bleed greater than 0; printers commonly ask for about 3mm or 1/8 inch', ['surfaces', 'print', 'bleed']);
    },
  },
  {
    id: 'print-bleed-range',
    severity: 'warning',
    summary: 'Bleed is outside the usual 2mm to 1/4 inch range.',
    why: 'Bleed is generally 2 to 5mm or 1/8 inch, with 1/4 inch common for die-cut shapes. Your printer sets the real number.',
    run({ fm, config, add }) {
      const b = parseLength(getIn(fm, ['surfaces', 'print', 'bleed']));
      if (!b || b.mm <= 0) return;
      if (b.mm < config.minBleedMm) add('warning', `${fmt(b.mm)}mm is under ${config.minBleedMm}mm; trimming tolerance can expose paper`, ['surfaces', 'print', 'bleed']);
      else if (b.mm > config.maxBleedMm) add('warning', `${fmt(b.mm)}mm is over 1/4 inch (${config.maxBleedMm}mm); check your printer's template`, ['surfaces', 'print', 'bleed']);
    },
  },
  {
    id: 'print-safe-margin',
    severity: 'warning',
    summary: 'The safe margin inside the trim is missing or does not fit.',
    why: 'Text too close to the trim edge gets cut off when the trim drifts. The margin must also leave room on the page.',
    run({ fm, add }) {
      const p = getIn(fm, ['surfaces', 'print']);
      if (!isPlainObject(p) || p.trim === undefined) return;
      if (p['safe-margin'] === undefined) return add('warning', 'no safe-margin; keep text and logos a fixed distance inside the trim', ['surfaces', 'print', 'safe-margin']);
      const m = parseLength(p['safe-margin']);
      const w = isPlainObject(p.trim) ? parseLength(p.trim.width) : null;
      const h = isPlainObject(p.trim) ? parseLength(p.trim.height) : null;
      if (!m) return;
      if (m.mm <= 0) add('error', 'safe-margin must be greater than 0', ['surfaces', 'print', 'safe-margin']);
      else if (w && h && m.mm * 2 >= Math.min(w.mm, h.mm)) add('error', 'safe-margin leaves no live area inside the trim', ['surfaces', 'print', 'safe-margin']);
    },
  },
  {
    id: 'print-color-mode',
    severity: 'warning',
    summary: 'Colour mode is missing or not one of cmyk, rgb, grayscale, spot.',
    why: 'Agents default to screen colour. A print file needs to say which colour model the printer expects.',
    run({ fm, add }) {
      const p = getIn(fm, ['surfaces', 'print']);
      if (!isPlainObject(p)) return;
      const modes = ['cmyk', 'rgb', 'grayscale', 'spot'];
      if (p['color-mode'] === undefined) add('warning', `no color-mode; one of ${modes.join(', ')}`, ['surfaces', 'print', 'color-mode']);
      else if (!modes.includes(p['color-mode'])) add('error', `"${p['color-mode']}" is not a colour mode (${modes.join(', ')})`, ['surfaces', 'print', 'color-mode']);
    },
  },
  {
    id: 'print-profile-missing',
    severity: 'warning',
    summary: 'CMYK output with no named colour profile.',
    why: 'Converting the screen colours to CMYK gives different results with different profiles. Name the one your printer asks for.',
    run({ fm, add }) {
      const p = getIn(fm, ['surfaces', 'print']);
      if (isPlainObject(p) && p['color-mode'] === 'cmyk' && !p['color-profile']) add('warning', 'color-mode is cmyk but no color-profile is named', ['surfaces', 'print', 'color-profile']);
    },
  },
  {
    id: 'print-text-below-min',
    severity: 'warning',
    summary: 'A typography token is smaller than the print minimum text size.',
    why: 'Uses the CSS ratio of 1px = 0.75pt. List tokens that never reach print under surfaces.print.exclude.',
    run({ fm, add }) {
      const p = getIn(fm, ['surfaces', 'print']);
      if (!isPlainObject(p) || p['min-text-size'] === undefined || !isPlainObject(fm.typography)) return;
      const min = parseLength(p['min-text-size']);
      if (!min) return;
      const minPt = min.mm / (25.4 / 72);
      const skip = Array.isArray(p.exclude) ? p.exclude : [];
      let unchecked = 0;
      for (const [name, t] of Object.entries(fm.typography)) {
        if (skip.includes(name) || !isPlainObject(t) || t.fontSize === undefined) continue;
        const pt = fontSizeToPt(t.fontSize);
        if (pt === null) { unchecked++; continue; }
        if (pt < minPt - 1e-9) add('warning', `${t.fontSize} is ${fmt(pt)}pt, under the ${fmt(minPt)}pt print minimum`, ['typography', name, 'fontSize']);
      }
      if (unchecked) add('info', `${unchecked} typography token(s) use rem or em and were not checked against min-text-size`, ['surfaces', 'print', 'min-text-size']);
    },
  },
  {
    id: 'video-size-invalid',
    severity: 'error',
    summary: 'Video width and height must be positive whole numbers, and match aspect if given.',
    why: 'A frame size is pixels. A stated aspect ratio that disagrees with the size means one of them is wrong.',
    run({ fm, add }) {
      const v = getIn(fm, ['surfaces', 'video']);
      if (!isPlainObject(v)) return;
      const ok = (n) => Number.isInteger(n) && n > 0;
      for (const k of ['width', 'height']) {
        if (v[k] !== undefined && !ok(v[k])) add('error', `${k} must be a positive whole number of pixels`, ['surfaces', 'video', k]);
      }
      if (v.aspect !== undefined) {
        const m = /^(\d+):(\d+)$/.exec(String(v.aspect));
        if (!m) add('error', 'aspect must look like 16:9', ['surfaces', 'video', 'aspect']);
        else if (ok(v.width) && ok(v.height) && Math.abs(v.width / v.height - Number(m[1]) / Number(m[2])) > 0.01) {
          add('error', `${v.width}x${v.height} is not ${v.aspect}`, ['surfaces', 'video', 'aspect']);
        }
      }
    },
  },
  {
    id: 'video-frame-rate',
    severity: 'error',
    summary: 'Frame rate must be a positive number or a ratio like 24000/1001.',
    why: 'Durations only land on whole frames if the rate is known exactly. NTSC-family rates are 1000/1001 fractions, so the ratio form is accepted.',
    run({ fm, add }) {
      const v = getIn(fm, ['surfaces', 'video']);
      if (!isPlainObject(v)) return;
      if (v['frame-rate'] === undefined) return add('info', 'no frame-rate; motion timing cannot be checked against frames', ['surfaces', 'video', 'frame-rate']);
      const fps = parseFrameRate(v['frame-rate']);
      if (fps === null) return add('error', `${JSON.stringify(v['frame-rate'])} is not a frame rate`, ['surfaces', 'video', 'frame-rate']);
      const common = [24, 25, 30, 48, 50, 60, 24000 / 1001, 30000 / 1001, 60000 / 1001];
      if (!common.some((c) => Math.abs(c - fps) < 0.001)) add('info', `${fmt(fps)}fps is not one of the common rates (24, 25, 30, 48, 50, 60 and their 1000/1001 forms)`, ['surfaces', 'video', 'frame-rate']);
    },
  },
  {
    id: 'video-safe-area',
    severity: 'warning',
    summary: 'Safe-area insets are missing, out of range, or the graphics area is not inside the action area.',
    why: 'EBU R 95 puts the action-safe area 3.5% and the graphics-safe area 5% in from each edge of a 16:9 frame. Graphics must sit inside the action area.',
    run({ fm, add }) {
      const v = getIn(fm, ['surfaces', 'video']);
      if (!isPlainObject(v)) return;
      const sa = v['safe-area'];
      if (sa === undefined) return add('warning', 'no safe-area; titles and logos can be cropped on some displays and platforms', ['surfaces', 'video', 'safe-area']);
      if (!isPlainObject(sa)) return add('error', 'safe-area must be a map with action and graphics insets', ['surfaces', 'video', 'safe-area']);
      const vals = {};
      for (const k of ['action', 'graphics']) {
        if (sa[k] === undefined) { add('warning', `safe-area.${k} is missing`, ['surfaces', 'video', 'safe-area']); continue; }
        const n = parsePercent(sa[k]);
        if (n === null || n < 0 || n >= 25) add('error', `${JSON.stringify(sa[k])} is not an inset between 0% and 25%`, ['surfaces', 'video', 'safe-area', k]);
        else vals[k] = n;
      }
      if (vals.action !== undefined && vals.graphics !== undefined && vals.graphics < vals.action) {
        add('error', `graphics inset (${vals.graphics}%) is smaller than action inset (${vals.action}%); graphics must sit inside the action-safe area`, ['surfaces', 'video', 'safe-area', 'graphics']);
      }
    },
  },
  {
    id: 'video-flash-limit',
    severity: 'error',
    summary: 'The flash limit is missing, or above 3 per second.',
    why: 'WCAG 2.2 success criterion 2.3.1 allows no more than three flashes in any one second, unless below the general and red flash thresholds.',
    run({ fm, add }) {
      const v = getIn(fm, ['surfaces', 'video']);
      if (!isPlainObject(v)) return;
      const n = v['max-flashes-per-second'];
      if (n === undefined) return add('info', 'no max-flashes-per-second; WCAG 2.3.1 allows at most 3', ['surfaces', 'video', 'max-flashes-per-second']);
      if (typeof n !== 'number' || n < 0) add('error', 'max-flashes-per-second must be a number, 0 or more', ['surfaces', 'video', 'max-flashes-per-second']);
      else if (n > 3) add('error', `${n} flashes per second is over the WCAG 2.3.1 limit of 3`, ['surfaces', 'video', 'max-flashes-per-second']);
    },
  },
  {
    id: 'video-duration-off-grid',
    severity: 'info',
    summary: 'A motion duration does not land on a whole number of video frames.',
    why: 'When motion tokens are reused in video, a duration that is not a whole number of frames gets rounded, so the move runs a little short or long.',
    run({ fm, model, add }) {
      const fps = parseFrameRate(getIn(fm, ['surfaces', 'video', 'frame-rate']));
      if (fps === null) return;
      for (const t of model.durations) {
        if (t.ms === null || t.ms === 0) continue;
        const frames = (t.ms / 1000) * fps;
        if (Math.abs(frames - Math.round(frames)) > 0.05) add('info', `${fmt(t.ms)}ms is ${fmt(frames)} frames at ${fmt(fps)}fps; nearest whole frame is ${fmt((Math.round(frames) / fps) * 1000)}ms`, t.path);
      }
    },
  },
];

export const RULE_IDS = RULES.map((r) => r.id);
