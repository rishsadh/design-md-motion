import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lintText } from '../src/lint.mjs';
import { RULES } from '../src/rules.mjs';

const read = (f) => fs.readFileSync(new URL(`../examples/${f}`, import.meta.url), 'utf8');
const ids = (r, severity) => [...new Set(r.findings.filter((f) => !severity || f.severity === severity).map((f) => f.rule))];
const doc = (yaml, body = '## Motion\n\nText.\n') => `---\nname: T\n${yaml}\n---\n\n${body}`;

test('the reference example has no errors and no warnings', () => {
  const r = lintText(read('daylight-prestige.DESIGN.md'));
  assert.equal(r.summary.errors, 0);
  assert.equal(r.summary.warnings, 0);
});

test('the print and video example is clean', () => {
  const r = lintText(read('studio-print-video.DESIGN.md'));
  assert.deepEqual(r.findings, []);
});

test('the motion block from issue 47 is accepted as written', () => {
  const r = lintText(read('issue-47-as-proposed.DESIGN.md'));
  assert.equal(r.summary.errors, 0);
  assert.equal(r.summary.warnings, 0);
  assert.deepEqual(ids(r), ['motion-legacy-fallback']);
});

test('motion-reduce-compat from issue 47: a long duration with no fallback warns', () => {
  const y = `motion:\n  duration:\n    fast: 150ms\n    medium: 300ms\n    slow: 600ms\n  prefers-reduced-motion-fallback:\n    medium: 100ms`;
  const r = lintText(doc(y));
  const w = r.findings.filter((f) => f.rule === 'motion-reduce-compat');
  assert.equal(w.length, 1);
  assert.equal(w[0].path, 'motion.duration.slow');
});

test('the threshold is configurable', () => {
  const y = `motion:\n  duration:\n    medium: 300ms`;
  assert.equal(lintText(doc(y)).findings.filter((f) => f.rule === 'motion-reduce-compat').length, 1);
  assert.equal(lintText(doc(y), { reduceThresholdMs: 400 }).findings.filter((f) => f.rule === 'motion-reduce-compat').length, 0);
});

test('a global reduced default covers every intent', () => {
  const base = `motion:\n  duration:\n    slow: 400ms\n  easing:\n    e: [0.2, 0, 0, 1]\n  intent:\n    reveal:\n      duration: "{motion.duration.slow}"\n      easing: "{motion.easing.e}"\n`;
  assert.ok(ids(lintText(doc(base))).includes('motion-reduce-compat'));
  const covered = base.replace('motion:\n', 'motion:\n  reduced:\n    default: fade\n    duration: 100ms\n');
  assert.ok(!ids(lintText(doc(covered))).includes('motion-reduce-compat'));
});

test('a spring intent is judged by its settle time', () => {
  const y = `motion:\n  spring:\n    slow:\n      stiffness: 100\n      damping: 10\n  intent:\n    pop:\n      spring: "{motion.spring.slow}"\n`;
  const r = lintText(doc(y));
  assert.ok(ids(r).includes('motion-reduce-compat'));
});

test('loops are not shortened: a 1100ms spinner is not flagged by reduce-compat but needs its own reduced', () => {
  const y = `motion:\n  easing:\n    linear: linear\n  loop:\n    spinner:\n      period: 1100ms\n      easing: linear\n`;
  const r = lintText(doc(y));
  assert.ok(!ids(r).includes('motion-reduce-compat'));
  assert.ok(ids(r).includes('motion-loop-reduced'));
  const fixed = lintText(doc(y + '      reduced: essential\n'));
  assert.ok(!ids(fixed).includes('motion-loop-reduced'));
});

test('a loop cannot be given a duration as its reduced value', () => {
  const y = `motion:\n  loop:\n    s:\n      period: 1s\n      reduced: 100ms\n`;
  assert.ok(ids(lintText(doc(y)), 'error').includes('motion-reduced-invalid'));
});

test('linear easing is fine on a loop and flagged on a transition', () => {
  const y = `motion:\n  duration:\n    fast: 120ms\n  easing:\n    linear: linear\n  intent:\n    fade:\n      duration: "{motion.duration.fast}"\n      easing: "{motion.easing.linear}"\n      reduced: instant\n`;
  assert.ok(ids(lintText(doc(y))).includes('motion-linear-on-transition'));
});

test('references must point at the right kind of token', () => {
  const y = `motion:\n  duration:\n    fast: 120ms\n  easing:\n    e: [0.2, 0, 0, 1]\n  intent:\n    a:\n      duration: "{motion.easing.e}"\n      easing: "{motion.duration.fast}"\n`;
  const errs = lintText(doc(y)).findings.filter((f) => f.rule === 'motion-ref-broken');
  assert.equal(errs.length, 2);
  assert.match(errs[0].message, /not a (duration|easing) token/);
});

test('a bare token name works in a slot', () => {
  const y = `motion:\n  duration:\n    fast: 120ms\n  easing:\n    e: [0.2, 0, 0, 1]\n  intent:\n    a:\n      duration: fast\n      easing: e\n      reduced: instant\n`;
  const r = lintText(doc(y));
  assert.equal(r.summary.errors, 0);
  assert.equal(r.summary.warnings, 0);
});

test('DTCG object durations are read', () => {
  const y = `motion:\n  duration:\n    fast:\n      value: 120\n      unit: ms\n`;
  assert.equal(lintText(doc(y)).summary.errors, 0);
});

test('a bare number duration is an error with a fix in the message', () => {
  const r = lintText(doc(`motion:\n  duration:\n    fast: 150`));
  const f = r.findings.find((x) => x.rule === 'motion-duration-invalid');
  assert.ok(f);
  assert.match(f.message, /150ms/);
  assert.equal(f.severity, 'error');
});

test('typo in a motion key suggests the right one', () => {
  const r = lintText(doc(`motion:\n  durations:\n    fast: 120ms`));
  const f = r.findings.find((x) => x.rule === 'motion-unknown-key');
  assert.match(f.message, /did you mean "duration"/);
});

test('acknowledged warnings are kept but downgraded, with the reason', () => {
  const y = `motion:\n  acknowledged:\n    - rule: motion-reduce-compat\n      path: motion.duration.hero\n      reason: brand showcase\n  duration:\n    hero: 700ms`;
  const r = lintText(doc(y));
  const f = r.findings.find((x) => x.rule === 'motion-reduce-compat');
  assert.equal(f.severity, 'info');
  assert.match(f.message, /acknowledged: brand showcase/);
  assert.equal(r.summary.warnings, 0);
});

test('disabling a rule removes its findings', () => {
  const y = `motion:\n  duration:\n    medium: 300ms`;
  const r = lintText(doc(y), { disable: ['motion-reduce-compat'] });
  assert.ok(!ids(r).includes('motion-reduce-compat'));
});

test('findings carry the source line of the token', () => {
  const r = lintText(doc(`motion:\n  duration:\n    fast: 150`));
  const f = r.findings.find((x) => x.rule === 'motion-duration-invalid');
  // line 1 ---, 2 name, 3 motion:, 4 duration:, 5 fast
  assert.equal(f.line, 5);
});

test('invalid YAML is reported, not thrown', () => {
  const r = lintText('---\nname: [unclosed\n---\n');
  assert.equal(r.summary.errors, 1);
  assert.equal(r.findings[0].rule, 'design-md-frontmatter');
});

test('a file with no front matter lints without error', () => {
  const r = lintText('# Just prose\n\n## Motion\n\nText.\n');
  assert.equal(r.summary.errors, 0);
  assert.ok(ids(r).includes('motion-tokens-missing'));
});

test('section order: Motion after Components is a warning; between Shapes and Components is fine', () => {
  const y = `motion:\n  duration:\n    fast: 120ms`;
  const bad = lintText(doc(y, '## Components\n\nx\n\n## Motion\n\nx\n'));
  assert.ok(ids(bad).includes('motion-section-order'));
  const ok = lintText(doc(y, '## Shapes\n\nx\n\n## Motion\n\nx\n\n## Components\n\nx\n'));
  assert.ok(!ids(ok).includes('motion-section-order'));
});

test('headings inside code fences are not sections', () => {
  const y = `motion:\n  duration:\n    fast: 120ms`;
  const r = lintText(doc(y, '## Shapes\n\n```md\n## Components\n```\n\n## Motion\n\nx\n'));
  assert.ok(!ids(r).includes('motion-section-order'));
});

test('the broken motion example trips the intended rules', () => {
  const r = lintText(read('bad/motion-broken.DESIGN.md'));
  for (const id of [
    'motion-duration-invalid', 'motion-easing-invalid', 'motion-spring-invalid', 'motion-spring-slow-settle',
    'motion-ref-broken', 'motion-intent-incomplete', 'motion-intent-ambiguous', 'motion-reduced-invalid',
    'motion-reduced-ease-noop', 'motion-reduce-compat', 'motion-loop-reduced', 'motion-linear-on-transition',
    'motion-transition-ceiling', 'motion-duration-duplicate', 'motion-unknown-key', 'motion-section-order',
    'motion-unused-token', 'motion-loop-pause-control',
  ]) assert.ok(ids(r).includes(id), `expected ${id}`);
});

// ------------------------------------------------------------------ surfaces
test('print: missing bleed, bad unit, bad colour mode and small text are caught', () => {
  const r = lintText(read('bad/print-broken.DESIGN.md'));
  for (const id of ['print-bleed-missing', 'print-length-invalid', 'print-color-mode', 'print-text-below-min', 'surface-unknown']) {
    assert.ok(ids(r).includes(id), `expected ${id}`);
  }
  const text = r.findings.filter((f) => f.rule === 'print-text-below-min');
  assert.equal(text.length, 2, 'one warning for caption, one info for the rem token');
});

test('print: bleed range, safe margin and missing colour profile', () => {
  const r = lintText(read('bad/print-bleed.DESIGN.md'));
  for (const id of ['print-bleed-range', 'print-safe-margin', 'print-profile-missing', 'print-text-below-min']) {
    assert.ok(ids(r).includes(id), `expected ${id}`);
  }
  assert.ok(!ids(r).includes('print-bleed-missing'));
});

test('print: 3mm and 0.125in bleed are both fine', () => {
  const p = (b) => `surfaces:\n  print:\n    trim:\n      width: 100mm\n      height: 100mm\n    bleed: ${b}\n    safe-margin: 5mm\n    color-mode: rgb`;
  for (const b of ['3mm', '0.125in']) {
    const r = lintText(doc(p(b), '## Surfaces\n\nx\n'));
    assert.deepEqual(r.findings, [], b);
  }
});

test('print: excluded typography tokens are not checked', () => {
  const y = `typography:\n  caption:\n    fontSize: 10px\nsurfaces:\n  print:\n    color-mode: rgb\n    min-text-size: 9pt\n    exclude: [caption]`;
  assert.ok(!ids(lintText(doc(y, '## Surfaces\n\nx\n'))).includes('print-text-below-min'));
});

test('video: aspect, safe areas and flash limit', () => {
  const r = lintText(read('bad/video-broken.DESIGN.md'));
  for (const id of ['video-size-invalid', 'video-safe-area', 'video-flash-limit', 'video-duration-off-grid']) {
    assert.ok(ids(r).includes(id), `expected ${id}`);
  }
  const off = r.findings.filter((f) => f.rule === 'video-duration-off-grid');
  assert.equal(off.length, 1);
  assert.equal(off[0].path, 'motion.duration.odd');
});

test('video: the EBU R 95 insets (3.5% and 5%) pass and a 24000/1001 rate is accepted', () => {
  const y = `surfaces:\n  video:\n    width: 1920\n    height: 1080\n    aspect: "16:9"\n    frame-rate: 24000/1001\n    safe-area:\n      action: 3.5%\n      graphics: 5%\n    max-flashes-per-second: 3`;
  const r = lintText(doc(y, '## Surfaces\n\nx\n'));
  assert.deepEqual(r.findings, []);
});

test('video: an unusual frame rate is an info, not an error', () => {
  const y = `surfaces:\n  video:\n    frame-rate: 37\n    safe-area:\n      action: 3.5%\n      graphics: 5%\n    max-flashes-per-second: 3`;
  const r = lintText(doc(y, '## Surfaces\n\nx\n'));
  assert.equal(r.summary.errors, 0);
  assert.ok(ids(r, 'info').includes('video-frame-rate'));
});

test('every rule has an id, severity, summary and reason, and ids are unique', () => {
  const seen = new Set();
  for (const r of RULES) {
    assert.match(r.id, /^[a-z]+(-[a-z]+)+$/);
    assert.ok(['error', 'warning', 'info'].includes(r.severity));
    assert.ok(r.summary.length > 10 && r.why.length > 10);
    assert.ok(!seen.has(r.id), `duplicate ${r.id}`);
    seen.add(r.id);
  }
});

test('the first-draft example (shown in the README) has the counts the README quotes', () => {
  const r = lintText(read('first-draft.DESIGN.md'));
  assert.deepEqual(r.summary, { errors: 3, warnings: 3, infos: 3 });
});
