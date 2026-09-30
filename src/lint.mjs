// Run the rules over a DESIGN.md text and return findings.
import { parseDesignMd } from './parse.mjs';
import { buildMotion } from './motion.mjs';
import { RULES, DEFAULTS } from './rules.mjs';
import { isPlainObject } from './units.mjs';

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

/**
 * @param {string} text   the DESIGN.md text
 * @param {object} options overrides for DEFAULTS, plus { disable: string[] }
 * @returns {{ findings: Array, summary: { errors: number, warnings: number, infos: number }, hasMotion: boolean, hasSurfaces: boolean }}
 */
export function lintText(text, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const disabled = new Set(options.disable ?? []);
  const parsed = parseDesignMd(text);
  const model = buildMotion(parsed.fm);
  const findings = [];
  const ack = readAcknowledged(model);

  for (const rule of RULES) {
    if (disabled.has(rule.id)) continue;
    const ctx = {
      fm: parsed.fm,
      model,
      sections: parsed.sections,
      config,
      yamlError: parsed.yamlError,
      add(severity, message, path, line) {
        const f = { rule: rule.id, severity, message, path: path.join('.'), line: line ?? (path.length ? parsed.locate(path) : null) };
        const a = ack.find((x) => x.rule === rule.id && (!x.path || f.path === x.path || f.path.startsWith(`${x.path}.`)));
        if (a) {
          f.severity = 'info';
          f.message = `${message} (acknowledged${a.reason ? `: ${a.reason}` : ''})`;
          f.acknowledged = true;
        }
        findings.push(f);
      },
    };
    rule.run(ctx);
  }
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.line ?? 1e9) - (b.line ?? 1e9));
  const count = (s) => findings.filter((f) => f.severity === s).length;
  return {
    findings,
    summary: { errors: count('error'), warnings: count('warning'), infos: count('info') },
    hasMotion: model.present,
    hasSurfaces: isPlainObject(parsed.fm.surfaces),
    parsed,
    model,
  };
}

// motion.acknowledged: ["rule-id"] or [{ rule, path?, reason? }]. Turns a warning into a recorded decision.
function readAcknowledged(model) {
  const raw = model.raw.acknowledged;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => (typeof e === 'string' ? { rule: e } : isPlainObject(e) && typeof e.rule === 'string' ? { rule: e.rule, path: e.path, reason: e.reason } : null))
    .filter(Boolean);
}

const LABEL = { error: 'FAIL', warning: 'WARN', info: 'INFO' };

export function formatText(file, result) {
  const lines = [file];
  if (!result.findings.length) lines.push('  no findings');
  for (const f of result.findings) {
    const where = [f.path, f.line ? `L${f.line}` : ''].filter(Boolean).join(' ') || 'file';
    lines.push(`  ${LABEL[f.severity]}  ${f.rule}`);
    lines.push(`        ${where}: ${f.message}`);
  }
  const { errors, warnings, infos } = result.summary;
  lines.push(`  ${errors ? 'FAIL' : 'PASS'}  ${errors} errors, ${warnings} warnings, ${infos} info`);
  return lines.join('\n');
}
