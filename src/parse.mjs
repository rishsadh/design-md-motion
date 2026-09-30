// Read a DESIGN.md file: YAML front matter, markdown sections, and source line lookup.
import { parseDocument, LineCounter } from 'yaml';
import { isPlainObject } from './units.mjs';

/**
 * @returns {{ fm: object, hasFrontMatter: boolean, yamlError: string|null, sections: Array,
 *             locate: (path: Array<string|number>) => number|null }}
 */
export function parseDesignMd(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  let fmText = null;
  let bodyStart = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      fmText = lines.slice(1, end).join('\n');
      bodyStart = end + 1;
    }
  }
  const sections = parseSections(lines, bodyStart);
  if (fmText === null) {
    return { fm: {}, hasFrontMatter: false, yamlError: null, sections, locate: () => null };
  }
  const lc = new LineCounter();
  const doc = parseDocument(fmText, { lineCounter: lc, prettyErrors: false, uniqueKeys: true });
  let yamlError = null;
  if (doc.errors.length) yamlError = doc.errors[0].message.split('\n')[0];
  const js = yamlError ? {} : doc.toJS() ?? {};
  const fm = isPlainObject(js) ? js : {};
  const locate = (path) => {
    if (yamlError) return null;
    try {
      const node = doc.getIn(path, true);
      if (node && node.range) return lc.linePos(node.range[0]).line + 1; // +1 for the opening ---
      if (path.length > 1) return locate(path.slice(0, -1));
    } catch {
      /* fall through */
    }
    return null;
  };
  return { fm, hasFrontMatter: true, yamlError, sections, locate };
}

/** Collect markdown headings outside fenced code blocks. Lines are 1-based. */
function parseSections(lines, from) {
  const out = [];
  let fence = null;
  for (let i = from; i < lines.length; i++) {
    const line = lines[i];
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, title: m[2].trim(), line: i + 1 });
  }
  return out;
}

// The section order in the upstream spec, with Motion and Surfaces proposed at 6.5 and 7.5.
const ORDER = [
  [1, ['overview', 'brand & style', 'brand and style']],
  [2, ['colors']],
  [3, ['typography']],
  [4, ['layout', 'layout & spacing', 'layout and spacing']],
  [5, ['elevation & depth', 'elevation', 'elevation and depth']],
  [6, ['shapes']],
  [6.5, ['motion']],
  [7, ['components']],
  [7.5, ['surfaces']],
  [8, ["do's and don'ts", 'dos and donts', "do's & don'ts"]],
];

export function sectionRank(title) {
  // Curly apostrophes (char codes 8216 and 8217) are treated as straight ones.
  const t = [...title.toLowerCase()].map((c) => (c.charCodeAt(0) === 8216 || c.charCodeAt(0) === 8217 ? "'" : c)).join('');
  for (const [rank, names] of ORDER) if (names.includes(t)) return rank;
  return null;
}
