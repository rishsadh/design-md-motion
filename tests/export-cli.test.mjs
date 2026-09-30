import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { main } from '../src/cli.mjs';
import { lintText } from '../src/lint.mjs';
import { parseDesignMd } from '../src/parse.mjs';
import { buildMotion } from '../src/motion.mjs';
import { toCss, toDtcg } from '../src/export.mjs';
import { STARTER_PARTS } from '../src/starter.mjs';
import { rulesMarkdown } from '../scripts/gen-rules-doc.mjs';
import { RULES } from '../src/rules.mjs';

const ROOT = new URL('..', import.meta.url);
const example = (f) => new URL(`examples/${f}`, ROOT);
const exampleText = (f) => fs.readFileSync(example(f), 'utf8');

async function run(args) {
  let out = '';
  let err = '';
  const code = await main(args, { out: (s) => (out += s), err: (s) => (err += s) });
  return { code, out, err };
}

function modelOf(text) {
  const p = parseDesignMd(text);
  return { p, model: buildMotion(p.fm) };
}

test('css export: variables for durations, easings, intents, and reduced overrides', () => {
  const { p, model } = modelOf(exampleText('daylight-prestige.DESIGN.md'));
  const css = toCss(model, p.fm);
  assert.match(css, /--motion-duration-medium: 200ms;/);
  assert.match(css, /--motion-ease-standard: cubic-bezier\(0\.2, 0, 0, 1\);/);
  assert.match(css, /--motion-intent-enter-duration: 200ms;/);
  assert.match(css, /--motion-loop-spinner-reduced: essential;/);
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /--motion-intent-enter-duration: 100ms;/, 'fade uses reduced.duration');
  assert.match(reduced, /--motion-intent-press-duration: 0ms;/, 'instant is zero');
  assert.match(reduced, /--motion-intent-confirm-easing: cubic-bezier\(0, 0, 0\.58, 1\);/, 'ease replaces the spring curve');
  assert.doesNotMatch(reduced, /spinner/, 'loops are not rewritten');
});

test('css export: a spring becomes a linear() easing plus its settle time', () => {
  const { p, model } = modelOf(exampleText('daylight-prestige.DESIGN.md'));
  const css = toCss(model, p.fm);
  assert.match(css, /--motion-spring-settle: linear\(0, /);
  assert.match(css, /--motion-spring-settle-duration: 390ms;/);
  assert.match(css, /--motion-intent-confirm-easing: linear\(0, /);
});

test('dtcg export: standard types where they exist, custom types where they do not', () => {
  const { p, model } = modelOf(exampleText('daylight-prestige.DESIGN.md'));
  const j = JSON.parse(toDtcg(model, p.fm)).motion;
  assert.deepEqual(j.duration.fast, { $type: 'duration', $value: { value: 120, unit: 'ms' } });
  assert.deepEqual(j.easing.standard, { $type: 'cubicBezier', $value: [0.2, 0, 0, 1] });
  assert.equal(j.spring.settle.$type, 'design-md-motion.spring');
  assert.deepEqual(j.spring.settle.$value, { stiffness: 260, damping: 26, mass: 1 });
  assert.equal(j.intent.enter.$value.duration, '{motion.duration.medium}', 'references survive as DTCG aliases');
  assert.equal(j.intent.enter.$value.easing, '{motion.easing.decelerate}');
  assert.equal(j.intent.confirm.$value.spring, '{motion.spring.settle}');
  assert.equal(j.loop.spinner.$value.reduced, 'essential');
});

test('dtcg export: every alias points at something that exists', () => {
  const { p, model } = modelOf(exampleText('daylight-prestige.DESIGN.md'));
  const root = JSON.parse(toDtcg(model, p.fm));
  const refs = [];
  (function walk(v) {
    if (typeof v === 'string' && /^\{.+\}$/.test(v)) refs.push(v.slice(1, -1));
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(root);
  assert.ok(refs.length > 5);
  for (const r of refs) {
    const found = r.split('.').reduce((o, k) => (o == null ? o : o[k]), root);
    assert.ok(found, `unresolved alias {${r}}`);
  }
});

test('cli lint: exit 0 on the examples, 1 on errors, 2 on usage problems', async () => {
  assert.equal((await run(['lint', fileOf('daylight-prestige.DESIGN.md')])).code, 0);
  const bad = await run(['lint', fileOf('bad/motion-broken.DESIGN.md')]);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /FAIL {2}motion-duration-invalid/);
  assert.equal((await run(['lint'])).code, 2);
  assert.equal((await run(['frobnicate'])).code, 2);
  assert.equal((await run(['lint', 'does-not-exist.md'])).code, 2);
  assert.equal((await run(['lint', 'x.md', '--format', 'xml'])).code, 2);
});

test('cli lint --strict fails on warnings', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dmm-')), 'w.md');
  fs.writeFileSync(f, '---\nname: T\nmotion:\n  duration:\n    slow: 600ms\n---\n\n## Motion\n\nx\n');
  assert.equal((await run(['lint', f])).code, 0);
  assert.equal((await run(['lint', f, '--strict'])).code, 1);
  assert.equal((await run(['lint', f, '--strict', '--threshold', '700'])).code, 0);
});

test('cli lint --format json is parseable and has the summary', async () => {
  const r = await run(['lint', fileOf('bad/video-broken.DESIGN.md'), '--format', 'json']);
  const j = JSON.parse(r.out);
  assert.equal(j.summary.errors, 3);
  assert.ok(j.findings.every((f) => f.rule && f.severity && f.message));
});

function fileOf(rel) {
  return fileURLToPath(example(rel));
}

test('cli spring: flags and file lookup agree', async () => {
  const a = await run(['spring', '--stiffness', '260', '--damping', '26']);
  const b = await run(['spring', fileOf('daylight-prestige.DESIGN.md'), 'settle']);
  assert.equal(a.code, 0);
  assert.equal(a.out, b.out);
  assert.match(a.out, /damping ratio {3}0\.806/);
  assert.match(a.out, /settles \(1%\) {4}390ms/);
  assert.equal((await run(['spring', '--stiffness', '0', '--damping', '1'])).code, 2);
});

test('cli export: css and dtcg, and a clear failure when there is no motion block', async () => {
  const css = await run(['export', fileOf('daylight-prestige.DESIGN.md'), '--format', 'css']);
  assert.equal(css.code, 0);
  assert.match(css.out, /^\/\* Generated by design-md-motion/);
  const d = await run(['export', fileOf('daylight-prestige.DESIGN.md'), '--format', 'dtcg']);
  assert.ok(JSON.parse(d.out).motion);
  const none = await run(['export', fileOf('bad/print-broken.DESIGN.md'), '--format', 'css']);
  assert.equal(none.code, 1);
  assert.match(none.err, /no motion/);
  assert.equal((await run(['export', fileOf('daylight-prestige.DESIGN.md')])).code, 2);
});

test('cli rules and explain', async () => {
  const r = await run(['rules']);
  for (const rule of RULES) assert.ok(r.out.includes(rule.id), rule.id);
  const e = await run(['explain', 'motion-reduce-compat']);
  assert.match(e.out, /heuristic/);
  assert.equal((await run(['explain', 'nope'])).code, 2);
});

test('the starter block lints with no errors and no warnings', () => {
  const body = '## Motion\n\nx\n\n## Surfaces\n\nx\n';
  for (const withSurfaces of [false, true]) {
    const yaml = STARTER_PARTS.MOTION + (withSurfaces ? STARTER_PARTS.SURFACES : '');
    const r = lintText(`---\nname: Starter\n${yaml}---\n\n${body}`);
    assert.equal(r.summary.errors, 0, JSON.stringify(r.findings));
    assert.equal(r.summary.warnings, 0, JSON.stringify(r.findings));
  }
});

test('the bin runs as a real process (shebang, exit code, stdin)', () => {
  const bin = fileURLToPath(new URL('bin/design-md-motion.mjs', ROOT));
  const r = spawnSync(process.execPath, [bin, 'lint', '-'], { input: exampleText('studio-print-video.DESIGN.md'), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PASS/);
});

test('docs/RULES.md is up to date with the rule table', () => {
  const onDisk = fs.readFileSync(new URL('docs/RULES.md', ROOT), 'utf8').split('\r\n').join('\n');
  assert.equal(onDisk, rulesMarkdown(), 'run: node scripts/gen-rules-doc.mjs');
});

test('SPEC.md mentions every rule id', () => {
  const spec = fs.readFileSync(new URL('SPEC.md', ROOT), 'utf8') + fs.readFileSync(new URL('docs/RULES.md', ROOT), 'utf8');
  for (const r of RULES) assert.ok(spec.includes(r.id), `${r.id} is not documented`);
});

test('upstream compatibility: the official linter reports no errors on the examples (skipped when it is not installed)', (t) => {
  const entry = fileURLToPath(new URL('node_modules/@google/design.md/dist/index.js', ROOT));
  if (!fs.existsSync(entry)) return t.skip('@google/design.md is not installed; see docs/UPSTREAM.md');
  for (const f of ['daylight-prestige.DESIGN.md', 'studio-print-video.DESIGN.md']) {
    const r = spawnSync(process.execPath, [entry, 'lint', fileOf(f), '--format', 'json'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).summary.errors, 0, f);
  }
});

test('the README motion example lints clean and the rule count it quotes is right', () => {
  const readme = fs.readFileSync(new URL('README.md', ROOT), 'utf8').split('\r\n').join('\n');
  const blocks = [...readme.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.equal(blocks.length, 2);
  const r = lintText(`---\nname: Readme\n${blocks[0]}${blocks[1]}---\n\n## Motion\n\nx\n\n## Surfaces\n\nx\n`);
  assert.equal(r.summary.errors, 0, JSON.stringify(r.findings));
  assert.equal(r.summary.warnings, 0, JSON.stringify(r.findings));
  assert.match(readme, new RegExp(`There are ${RULES.length} rules`));
});
