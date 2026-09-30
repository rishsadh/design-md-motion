# Sources

Everything below was read on 2026-09-30. Nothing in this repo is a number from memory: a value is
either from one of these, a judgement call that says so, or left for you to set.

## DESIGN.md and its ecosystem

| Source | What it was used for |
|---|---|
| https://github.com/google-labs-code/design.md/blob/main/docs/spec.md (`version: alpha`) | Base format: front matter schema, section order, token reference syntax, how unknown sections and keys are treated. 28,175 stars, Apache-2.0, last pushed 2026-09-14 |
| https://github.com/google-labs-code/design.md/issues/47 | Opened 2026-04-24, open, 6 comments. The original `motion:` proposal, the `motion-reduce-compat` rule, and the contributor reports behind `loop`, `reduced` keywords, `spring`, `time-constants` and `intent` (comments dated 2026-05-01, 05-18, 05-21, 07-28, 08-22, 08-29) |
| https://github.com/google-labs-code/design.md/issues/156 | Opened 2026-07-09, open, no comments. "Suggestion: animation/transition definitions." |
| https://github.com/google-labs-code/design.md/pull/74 | Closed without merging on 2026-06-15. The maintainer's reasons are summarised in SPEC.md section 0 |
| https://github.com/google-labs-code/design.md/blob/main/PHILOSOPHY.md | The project's stated direction: prose carries intent, tokens are context, no token requirements in the spec |
| https://registry.npmjs.org/@google/design.md | Version 0.4.0, published 2026-07-27. Used to run the compatibility check in [UPSTREAM.md](UPSTREAM.md) |
| https://github.com/kjmagnan1s/frame-md | A wrapper for HyperFrames' `frame.md` video format. 0 stars, last pushed 2026-06-24. Read to state how the video profile differs |
| https://github.com/2233admin/design-pipeline | Keeps motion in a separate MOTION.md next to DESIGN.md. 10 stars, MIT, last pushed 2026-09-29. Only its description was read |

## Motion values and types

| Source | What it was used for |
|---|---|
| https://www.designtokens.org/tr/2025.10/format/ sections 8.5 and 8.6 | `duration` type is `{ value, unit }` with unit `ms` or `s`. `cubicBezier` is four numbers with x in 0 to 1 and y unrestricted |
| https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss | Material 3 (v0.192, web): durations from 50ms to 1000ms (`extra-long4`), and the named easing curves. Basis for the 1000ms ceiling |
| https://raw.githubusercontent.com/carbon-design-system/carbon/main/packages/motion/src/dtcg/motion.json | IBM Carbon: durations 70, 110, 150, 240, 400 and 700ms, as DTCG duration tokens |
| https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion | `prefers-reduced-motion` is Baseline widely available, since January 2020 |
| https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear | The CSS `linear()` easing function, Baseline widely available since December 2023. Used to export springs |

## Accessibility criteria

| Source | What it was used for |
|---|---|
| https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html | SC 2.3.3, level AAA: motion animation triggered by interaction can be disabled unless essential. It has no duration threshold, so the 200ms line in `motion-reduce-compat` is a heuristic |
| https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html | SC 2.2.2: movement that starts automatically, lasts more than five seconds and sits in parallel with other content needs a pause, stop or hide mechanism unless essential. Basis for `motion-loop-pause-control` |
| https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html | SC 2.3.1: no more than three flashes in any one second, or below the general and red flash thresholds. Basis for `video-flash-limit` |

## Print and video

| Source | What it was used for |
|---|---|
| https://tech.ebu.ch/docs/r/r095.pdf (EBU R 95, version 1.1, June 2017) | Note 5: the action-safe area is 3.5% and the graphics-safe area is 5%, at the top, bottom and sides, for 16:9 production |
| https://en.wikipedia.org/wiki/Bleed_(printing) | Imperial bleed is generally 1/8 inch. Metric bleed is generally 2mm to 5mm and varies by printer. 1/4 inch (6mm) is common for die-cut shapes. Basis for the range in `print-bleed-range` |
| https://support.google.com/youtube/answer/1722171 | Common upload frame rates: 24, 25, 30, 48, 50, 60. Basis for the list in `video-frame-rate` |
| https://en.wikipedia.org/wiki/Frame_rate | North American, Japanese and South Korean video is still based on 60/1.001, about 59.94 images per second. Basis for accepting the ratio form `24000/1001` |
| https://www.w3.org/TR/css-values-3/#absolute-lengths | 1in = 96px = 72pt, so 1px = 0.75pt. Used to compare pixel font sizes with a minimum in points |

## Not sourced, on purpose

- **Print minimum text size, minimum stroke and image resolution.** These depend on the printer, the
  paper and the process. The profile holds yours. The linter has no default for them.
- **Platform overlay zones** for short vertical video. They change often. [[CONFIRM: add them to a
  profile yourself, with the date you measured them]].
- **The 200ms reduced-motion line and the 1000ms ceilings.** Judgement calls, both configurable.
