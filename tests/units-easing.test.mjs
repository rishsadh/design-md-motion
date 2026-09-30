import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, parseLength, parsePercent, parseFrameRate, parseRef, fontSizeToPt } from '../src/units.mjs';
import { parseEasing, parseSpring, describeSpring, springPosition, springToLinear, isLinearEasing, overshoots } from '../src/easing.mjs';

test('durations accept ms, s and the DTCG object form', () => {
  assert.equal(parseDuration('150ms'), 150);
  assert.equal(parseDuration('0.3s'), 300);
  assert.equal(parseDuration('0ms'), 0);
  assert.equal(parseDuration({ value: 1.5, unit: 's' }), 1500);
  assert.equal(parseDuration({ value: 70, unit: 'ms' }), 70);
});

test('durations reject a bare number, spaces, and unknown units', () => {
  for (const bad of [150, '150', '0.3 s', '-5ms', '5min', { value: 5, unit: 'min' }, null, undefined, []]) {
    assert.equal(parseDuration(bad), null, JSON.stringify(bad));
  }
});

test('lengths convert to millimetres', () => {
  assert.equal(parseLength('3mm').mm, 3);
  assert.ok(Math.abs(parseLength('0.125in').mm - 3.175) < 1e-9);
  assert.ok(Math.abs(parseLength('72pt').mm - 25.4) < 1e-9);
  assert.equal(parseLength('3'), null);
});

test('font sizes convert to points at 0.75pt per px', () => {
  assert.equal(fontSizeToPt('16px'), 12);
  assert.equal(fontSizeToPt('9pt'), 9);
  assert.equal(fontSizeToPt('1rem'), null);
});

test('percentages, frame rates and references', () => {
  assert.equal(parsePercent('3.5%'), 3.5);
  assert.equal(parsePercent('3.5'), null);
  assert.equal(parseFrameRate(25), 25);
  assert.ok(Math.abs(parseFrameRate('24000/1001') - 23.976) < 0.001);
  assert.equal(parseFrameRate('fast'), null);
  assert.equal(parseFrameRate(0), null);
  assert.deepEqual(parseRef('{motion.duration.fast}'), ['motion', 'duration', 'fast']);
  assert.equal(parseRef('motion.duration.fast'), null);
});

test('easings: array, css string, keyword, linear()', () => {
  assert.deepEqual(parseEasing([0.2, 0, 0, 1]).bezier, [0.2, 0, 0, 1]);
  assert.deepEqual(parseEasing('cubic-bezier(0.2, 0, 0, 1.5)').bezier, [0.2, 0, 0, 1.5]);
  assert.equal(parseEasing('ease-out').css, 'ease-out');
  assert.equal(parseEasing('linear(0, 0.5, 1)').kind, 'linear-stops');
  assert.ok(isLinearEasing(parseEasing('linear')));
  assert.ok(!isLinearEasing(parseEasing([0.2, 0, 0, 1])));
});

test('easings: x outside 0..1, wrong length and junk are errors', () => {
  assert.match(parseEasing([1.5, 0, 0, 1]).error, /x1 and x2/);
  assert.match(parseEasing([0, 0, 1]).error, /four numbers/);
  assert.match(parseEasing('bounce').error, /not a recognised/);
  assert.match(parseEasing(42).error, /array/);
  assert.ok(parseEasing('linear(0)').error);
});

test('overshoot is detected from y outside 0..1', () => {
  assert.ok(overshoots(parseEasing([0.2, 0, 0, 1.5])));
  assert.ok(!overshoots(parseEasing([0.2, 0, 0, 1])));
});

test('spring validation', () => {
  assert.deepEqual(parseSpring({ stiffness: 100, damping: 10 }), { stiffness: 100, damping: 10, mass: 1, extra: [] });
  assert.match(parseSpring({ stiffness: 0, damping: 10 }).error, /stiffness/);
  assert.match(parseSpring({ stiffness: 10, damping: 10, mass: -1 }).error, /mass/);
  assert.match(parseSpring('bouncy').error, /map/);
  assert.deepEqual(parseSpring({ stiffness: 1, damping: 1, bounce: 0.2 }).extra, ['bounce']);
});

test('spring: critically damped closed form', () => {
  // k=100, c=20, m=1 gives zeta 1 and w0 10. At t=0.1s the remaining distance is 2/e.
  const { position, zeta } = springPosition({ stiffness: 100, damping: 20, mass: 1 });
  assert.ok(Math.abs(zeta - 1) < 1e-12);
  assert.ok(Math.abs(position(100) - (1 - 2 / Math.E)) < 1e-9);
  assert.equal(position(0), 0);
});

test('spring: underdamped overshoot matches exp(-pi zeta / sqrt(1 - zeta^2))', () => {
  const s = { stiffness: 260, damping: 26, mass: 1 };
  const d = describeSpring(s);
  const z = d.dampingRatio;
  const expected = Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z));
  assert.ok(Math.abs(d.overshoot - expected) < 1e-3, `${d.overshoot} vs ${expected}`);
  assert.ok(d.settleMs > 300 && d.settleMs < 500);
});

test('spring: overdamped never overshoots and starts at rest', () => {
  const s = { stiffness: 100, damping: 40, mass: 1 };
  const { position } = springPosition(s);
  assert.ok(Math.abs(position(0)) < 1e-12);
  assert.ok(Math.abs(position(0.001) - 0) < 1e-4);
  assert.equal(describeSpring(s).overshoot, 0);
});

test('spring to linear(): starts at 0, ends at 1, and has the requested number of stops', () => {
  const { css, durationMs } = springToLinear({ stiffness: 260, damping: 26, mass: 1 }, 32);
  const stops = css.slice('linear('.length, -1).split(', ').map(Number);
  assert.equal(stops.length, 32);
  assert.equal(stops[0], 0);
  assert.equal(stops.at(-1), 1);
  assert.ok(stops.some((n) => n > 1), 'an underdamped spring overshoots');
  assert.ok(durationMs > 0);
  // the output is itself a valid easing for this tool
  assert.equal(parseEasing(css).kind, 'linear-stops');
});
