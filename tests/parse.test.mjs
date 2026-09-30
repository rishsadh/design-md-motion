import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDesignMd, sectionRank } from '../src/parse.mjs';

test('section ranks follow the proposed order, with Motion between Shapes and Components', () => {
  const order = ['Overview', 'Colors', 'Typography', 'Layout', 'Elevation & Depth', 'Shapes', 'Motion', 'Components', 'Surfaces', "Do's and Don'ts"];
  const ranks = order.map(sectionRank);
  assert.ok(ranks.every((r) => r !== null));
  assert.deepEqual([...ranks].sort((a, b) => a - b), ranks);
  assert.equal(sectionRank('Iconography'), null);
});

test('curly apostrophes in a heading rank like straight ones', () => {
  const curly = `Do${String.fromCharCode(8217)}s and Don${String.fromCharCode(8217)}ts`;
  assert.equal(sectionRank(curly), 8);
});

test('front matter, sections and line lookup', () => {
  const p = parseDesignMd('---\nname: X\nmotion:\n  duration:\n    fast: 120ms\n---\n\n# Title\n\n## Motion\n\n```md\n## Hidden\n```\n\n### Sub\n');
  assert.equal(p.fm.motion.duration.fast, '120ms');
  assert.deepEqual(p.sections.map((s) => s.title), ['Title', 'Motion', 'Sub']);
  assert.equal(p.locate(['motion', 'duration', 'fast']), 5);
  assert.equal(p.locate(['motion', 'nope']), 4, 'falls back to the nearest parent, which starts at its first key');
});

test('CRLF files and a byte order mark parse the same as LF', () => {
  const lf = '---\nname: X\nmotion:\n  duration:\n    fast: 120ms\n---\n\n## Motion\n';
  const crlf = `﻿${lf.split('\n').join('\r\n')}`;
  assert.deepEqual(parseDesignMd(crlf).fm, parseDesignMd(lf).fm);
  assert.equal(parseDesignMd(crlf).sections.length, 1);
});

test('duplicate keys are a YAML error, not a silent overwrite', () => {
  const p = parseDesignMd('---\nname: X\nname: Y\n---\n');
  assert.ok(p.yamlError);
});
