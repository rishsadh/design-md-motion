# Compatibility with the official linter

Checked on 2026-09-30 with `@google/design.md` 0.4.0 (`design.md lint <file> --format json`).

| File | Errors | Warnings | Exit code | The warnings |
|---|---|---|---|---|
| `examples/daylight-prestige.DESIGN.md` | 0 | 1 | 0 | `token-like-ignored` on `motion` |
| `examples/studio-print-video.DESIGN.md` | 0 | 2 | 0 | `token-like-ignored` on `motion` and on `surfaces` |
| `examples/issue-47-as-proposed.DESIGN.md` | 0 | 2 | 0 | `token-like-ignored` on `motion`, and a missing typography section in a file that has none |

What that means:

- The official linter accepts files with a `motion:` block, a `surfaces:` block and a `## Motion`
  section. It does not fail on them.
- It warns that `motion` and `surfaces` "will be silently ignored by export commands". That is true:
  its Tailwind, DTCG and CSS exporters do not read them. Use `design-md-motion export` for those.
- The warning is the cost of being an extension. To silence it in a pipeline, filter the rule
  `token-like-ignored`.

The test suite runs the same check when `@google/design.md` is installed
(`npm install --no-save @google/design.md@0.4.0`), and skips it otherwise so that this repo keeps a
single small dependency.

## What upstream has said

See SPEC.md section 0. In short: pull request 74 (motion tokens in the base spec) was closed on
2026-06-15 on the grounds that the spec stays a structural minimum, and the maintainer pointed to a
shareable rule pack as the route for motion once linter configuration exists. Issue 47 is open.
Version 0.4.0 exports `lint()` with custom rules but has no configuration file, so a rule pack here
would mean an adapter, which this repo does not ship yet.
