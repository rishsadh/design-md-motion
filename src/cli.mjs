import fs from 'node:fs';
import { lintText, formatText } from './lint.mjs';
import { RULES, DEFAULTS } from './rules.mjs';
import { parseDesignMd } from './parse.mjs';
import { buildMotion } from './motion.mjs';
import { toCss, toDtcg } from './export.mjs';
import { describeSpring, springToLinear } from './easing.mjs';
import { STARTER } from './starter.mjs';

const HELP = `design-md-motion: a motion section for DESIGN.md, with lint rules and print and video profiles.

Usage:
  design-md-motion lint <file...> [--format text|json] [--strict]
        [--threshold <ms>] [--max-transition <ms>] [--max-settle <ms>] [--disable <rule,rule>]
  design-md-motion export <file> --format css|dtcg
  design-md-motion spring --stiffness <n> --damping <n> [--mass <n>] [--points <n>]
  design-md-motion spring <file> <spring-name>
  design-md-motion init [--surfaces]
  design-md-motion rules
  design-md-motion explain <rule-id>

Exit code: 1 when any file has an error (or a warning, with --strict). 2 for a usage problem.
Use "-" as the file to read from standard input.
`;

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const bool = ['strict', 'surfaces', 'help'].includes(key);
      flags[key] = bool ? true : argv[++i];
    } else pos.push(a);
  }
  return { pos, flags };
}

const read = (f) => (f === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(f, 'utf8'));
const num = (v, name) => {
  const n = Number(v);
  if (v === undefined || !Number.isFinite(n) || n <= 0) throw new UsageError(`--${name} needs a number greater than 0`);
  return n;
};
class UsageError extends Error {}

export async function main(argv, io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) }) {
  const { pos, flags } = parseArgs(argv);
  const cmd = pos[0];
  try {
    if (!cmd || flags.help || cmd === 'help') { io.out(HELP); return cmd || flags.help ? 0 : 2; }

    if (cmd === 'lint') {
      const files = pos.slice(1);
      if (!files.length) throw new UsageError('lint needs at least one file');
      const options = {};
      if (flags.threshold !== undefined) options.reduceThresholdMs = num(flags.threshold, 'threshold');
      if (flags['max-transition'] !== undefined) options.maxTransitionMs = num(flags['max-transition'], 'max-transition');
      if (flags['max-settle'] !== undefined) options.maxSpringSettleMs = num(flags['max-settle'], 'max-settle');
      if (flags.disable) options.disable = String(flags.disable).split(',').map((s) => s.trim());
      const format = flags.format ?? 'text';
      if (!['text', 'json'].includes(format)) throw new UsageError('--format must be text or json');
      let failed = false;
      const all = [];
      for (const f of files) {
        let text;
        try { text = read(f); } catch (e) { io.err(`cannot read ${f}: ${e.code || e.message}\n`); return 2; }
        const r = lintText(text, options);
        if (r.summary.errors || (flags.strict && r.summary.warnings)) failed = true;
        if (format === 'json') all.push({ file: f, findings: r.findings, summary: r.summary });
        else io.out(formatText(f, r) + '\n');
      }
      if (format === 'json') io.out(JSON.stringify(files.length === 1 ? all[0] : all, null, 2) + '\n');
      return failed ? 1 : 0;
    }

    if (cmd === 'export') {
      const file = pos[1];
      if (!file) throw new UsageError('export needs a file');
      const fmtName = flags.format;
      if (!['css', 'dtcg'].includes(fmtName)) throw new UsageError('export needs --format css or --format dtcg');
      const parsed = parseDesignMd(read(file));
      if (parsed.yamlError) { io.err(`front matter is not valid YAML: ${parsed.yamlError}\n`); return 1; }
      const model = buildMotion(parsed.fm);
      if (!model.present) { io.err('no motion: block in this file\n'); return 1; }
      io.out(fmtName === 'css' ? toCss(model, parsed.fm) : toDtcg(model, parsed.fm));
      return 0;
    }

    if (cmd === 'spring') {
      let spring;
      if (pos[1]) {
        const parsed = parseDesignMd(read(pos[1]));
        const model = buildMotion(parsed.fm);
        const t = model.springs.find((s) => s.name === pos[2]);
        if (!t || t.parsed.error) throw new UsageError(`no valid spring named "${pos[2]}" in ${pos[1]}`);
        spring = t.parsed;
      } else {
        spring = { stiffness: num(flags.stiffness, 'stiffness'), damping: num(flags.damping, 'damping'), mass: flags.mass === undefined ? 1 : num(flags.mass, 'mass') };
      }
      const d = describeSpring(spring);
      const lin = springToLinear(spring, flags.points === undefined ? 48 : Math.round(num(flags.points, 'points')));
      io.out([
        `stiffness ${spring.stiffness}, damping ${spring.damping}, mass ${spring.mass}`,
        `damping ratio   ${d.dampingRatio.toFixed(3)} (${d.dampingRatio < 1 ? 'underdamped, overshoots' : d.dampingRatio === 1 ? 'critically damped' : 'overdamped, no overshoot'})`,
        `peak overshoot  ${(d.overshoot * 100).toFixed(1)}%`,
        `settles (1%)    ${d.settleMs === null ? 'never within 20s' : `${d.settleMs}ms`}`,
        `css             ${lin.css ?? 'none'}`,
        '',
      ].join('\n'));
      return 0;
    }

    if (cmd === 'init') { io.out(STARTER(!!flags.surfaces)); return 0; }

    if (cmd === 'rules') {
      const w = Math.max(...RULES.map((r) => r.id.length));
      for (const r of RULES) io.out(`${r.id.padEnd(w)}  ${r.severity.padEnd(7)}  ${r.summary}\n`);
      io.out(`\nDefaults: reduced-motion check above ${DEFAULTS.reduceThresholdMs}ms, transition ceiling ${DEFAULTS.maxTransitionMs}ms, spring settle limit ${DEFAULTS.maxSpringSettleMs}ms.\n`);
      return 0;
    }

    if (cmd === 'explain') {
      const r = RULES.find((x) => x.id === pos[1]);
      if (!r) throw new UsageError(`unknown rule "${pos[1]}"; run "design-md-motion rules"`);
      io.out(`${r.id} (${r.severity})\n${r.summary}\n\nWhy: ${r.why}\n`);
      return 0;
    }

    throw new UsageError(`unknown command "${cmd}"`);
  } catch (e) {
    if (e instanceof UsageError) { io.err(`${e.message}\n\n${HELP}`); return 2; }
    throw e;
  }
}
