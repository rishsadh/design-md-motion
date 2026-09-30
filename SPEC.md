# A motion section and surface profiles for DESIGN.md

Status: draft 0.1, 30 September 2026. An extension that sits beside the DESIGN.md spec. It asks for
no change to the base spec.

Written against DESIGN.md `version: alpha` (docs/spec.md in google-labs-code/design.md) and
`@google/design.md` 0.4.0, both read on 2026-09-30. Sources are listed in [docs/SOURCES.md](docs/SOURCES.md).

This file describes what `design-md-motion` implements. Every rule named here is enforced by the
linter and documented in [docs/RULES.md](docs/RULES.md). Numbers that come from somewhere are
cited. Numbers that are judgement calls say so.

## 0. Where this stands with DESIGN.md

Read on 2026-09-30:

- Issue 47, "Feature: motion tokens (duration, easing) with prefers-reduced-motion fallback", was opened
  on 2026-04-24 and is still open, with 6 comments. On 2026-05-01 the maintainer said motion could be
  added as custom tokens in a custom section, and asked people who do so to share what they made.
- Pull request 74, which added a motion token group to the base spec, was closed without merging on
  2026-06-15. The reason given was the project's PHILOSOPHY.md: the spec stays a structural minimum,
  prose carries design intent, and domain token categories are not added to the spec. The maintainer
  said motion support could live as a shareable rule pack once linter configuration lands.
- `@google/design.md` 0.4.0 has no linter configuration yet. It does export a `lint()` function that
  accepts custom rules.

So this is written as an extension: it adds no requirement to DESIGN.md, it is fine to ignore, and
the prose section carries as much weight as the tokens. It is meant to be the shipped example the
maintainer asked for, and a starting point for a rule pack if one becomes possible.

## 1. What this adds

1. A `motion:` block in the front matter, and a `## Motion` section in the body.
2. A `surfaces:` block in the front matter, and a `## Surfaces` section, for print and video.
3. Lint rules for both, and exporters to CSS custom properties and W3C DTCG JSON.

Nothing here changes how colours, typography, spacing, rounded corners or components work.

### Principles

These follow the maintainer's replies on issue 47 and PR 74: DESIGN.md captures design intent, a mix of
prose and tokens, and should not hard-code a mapping to CSS or any other renderer.

- **Intent first, values second.** An agent asked to build a menu should find `enter` and `exit`,
  not a list of milliseconds to choose from. Intents reference the values.
- **No renderer in the format.** A duration is a duration. An easing is four numbers. A spring is
  stiffness, damping and mass. How those become CSS, a Motion library call or a video keyframe is
  the consumer's job. The exporters here are one consumer, not the definition.
- **Additive.** Current consumers ignore what they do not know. On 2026-09-30 the official linter
  reads the examples in this repo with no errors and one warning per unknown block
  ([docs/UPSTREAM.md](docs/UPSTREAM.md)).
- **Borrow types that already exist.** Durations and cubic beziers follow the W3C Design Tokens
  format 2025.10. References use the `{path.to.token}` syntax DESIGN.md already uses.
- **Reduced motion is a behaviour, not a shorter animation.** See section 4.

## 2. The `motion:` block

```yaml
motion:
  duration:        # the scale for one-way transitions
  easing:          # named curves
  spring:          # named physical springs
  loop:            # motion with no end: spinners, shimmer, ambient
  intent:          # named moves that agents actually ask for
  reduced:         # the global reduced-motion policy
  time-constants:  # optional: time values that are not animations
  acknowledged:    # optional: warnings the author has decided to keep
```

Unknown keys under `motion:` are preserved, and the linter warns about them (`motion-unknown-key`)
because the usual cause is a typo such as `durations`.

### 2.1 `duration`

A map of name to duration. The scale is for one-way transitions.

- Write `150ms`, `0.3s`, or the DTCG object `{ value: 150, unit: ms }`. A bare `150` is an error
  (`motion-duration-invalid`), because milliseconds and seconds get mixed up.
- Names are free. `instant`, `fast`, `medium`, `slow` is a good start. Two names with the same
  value are flagged (`motion-duration-duplicate`).
- The scale does not have to be a ladder. Real libraries are full of durations that belong to one
  named move. Put those on the intent, as a literal, instead of adding a rung.

### 2.2 `easing`

A map of name to curve. Accepted forms:

| Form | Example | Notes |
|---|---|---|
| Four numbers | `[0.2, 0, 0, 1]` | Canonical. Maps to the DTCG `cubicBezier` type. |
| CSS string | `"cubic-bezier(0.2, 0, 0, 1)"` | Read for compatibility with issue 47. |
| CSS keyword | `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out` | |
| Stop list | `"linear(0, 0.5, 1)"` | For curves that are not beziers. |

The x values of a bezier must be between 0 and 1. The y values may be anything, so `[0.2, 0, 0, 1.5]`
overshoots. The DTCG type has the same rule. A violation is `motion-easing-invalid`.

### 2.3 `spring`

A map of name to a physical spring.

```yaml
spring:
  settle:
    stiffness: 260
    damping: 26
    mass: 1        # optional, default 1
```

A spring is kept as physics, not as a sampled curve, because a sampled curve cannot be tuned. The
linter derives from it: damping ratio, peak overshoot, and the time to stay within 1% of the target.
For the example above that is 0.806, 1.4% and 390ms. `design-md-motion spring` prints them, and the
CSS exporter samples the spring into a `linear()` easing.

Stiffness, damping and mass must be above 0 (`motion-spring-invalid`). A spring that takes more than
1000ms to settle, or never settles, is flagged (`motion-spring-slow-settle`). 1000ms is the top of the
Material 3 duration scale and is a judgement call.

### 2.4 `loop`

Motion with no end. A loop has a period, an easing and a reduced behaviour, not a duration.

```yaml
loop:
  spinner:
    period: 1100ms
    easing: linear
    reduced: essential
```

- A loop must have a `period` (`motion-duration-invalid`).
- Linear easing is expected on a loop. On a one-way transition it is flagged
  (`motion-linear-on-transition`).
- `reduced` is required and is `static` or `essential` (`motion-loop-reduced`, `motion-reduced-invalid`).
  A loop cannot be shortened.
- Automatic movement that lasts more than five seconds and sits next to other content needs a way to
  pause, stop or hide it, unless it is essential (WCAG 2.2, success criterion 2.2.2). The linter
  reminds you once per file (`motion-loop-pause-control`). It cannot check the page.

### 2.5 `intent`

A named move. This is the layer agents should read first.

```yaml
intent:
  enter:
    duration: "{motion.duration.medium}"
    easing: "{motion.easing.decelerate}"
    properties: opacity 0 to 1, rise 8px
    reduced: fade
  confirm:
    spring: "{motion.spring.settle}"
    properties: scale 0.9 to 1 with a small overshoot
    reduced: ease
```

| Field | Type | Meaning |
|---|---|---|
| `duration` | reference, token name or duration | Timing for an eased intent |
| `easing` | reference, token name or curve | Curve for an eased intent |
| `spring` | reference to a spring | Timing and curve for a spring intent |
| `properties` | prose | What moves, for a person and an agent to read |
| `reduced` | duration or keyword | Section 4 |
| `interruptible` | boolean | Whether a new input may cut the move short |

A slot may point at any motion token of the right kind. Choreography stays in prose. An intent needs
a duration or a spring (`motion-intent-incomplete`) and should not set both a spring and a duration
or easing (`motion-intent-ambiguous`). A reference to something that does not exist, or is the wrong
kind, is `motion-ref-broken`. A linear curve on an intent is `motion-linear-on-transition`. An intent
longer than 1000ms is `motion-transition-ceiling`, with the same caveat as the spring limit. A
token nothing uses is `motion-unused-token`, at info level, and zero-length durations are exempt.

Intent names are not fixed. `enter`, `exit`, `press`, `hover`, `reveal` and `confirm` are common.

### 2.6 `reduced`

```yaml
reduced:
  default: fade      # used by any intent that has no `reduced` of its own
  duration: 100ms    # the duration used by `fade`
```

### 2.7 `time-constants`

Optional. Durations that are not animations, such as a meter's decay time or a dwell before a
tooltip. They are validated as durations and exported, and may be referenced by an intent. This
group comes from a contributor's report on issue 47 and is the least settled part of this
proposal. See section 8.

### 2.8 `acknowledged`

A warning is a question, not a ban. To keep one on purpose:

```yaml
acknowledged:
  - rule: motion-reduce-compat
    path: motion.intent.hero-enter
    reason: brand showcase, one per page
```

The finding stays in the output at info level, with the reason attached. `path` is optional and
matches by prefix.

### 2.9 `prefers-reduced-motion-fallback` (legacy)

Issue 47 proposed a map from duration name to a shorter duration. It is still read. It counts as a
reduced path for duration tokens, and the linter notes that intents and loops can say more
(`motion-legacy-fallback`). A key that names no duration is `motion-ref-broken`.

## 3. The `## Motion` section

Place it after Shapes and before Components (`motion-section-order`). Tokens without the section get
an info (`motion-section-missing`), and the reverse too (`motion-tokens-missing`).

Put in it what a scale cannot hold:

- When to animate at all, and when not to.
- What each intent is for and what moves in it.
- Choreography: stagger, sequencing, which element leads.
- What happens under reduced motion for each intent, in words.
- Anything that is a rule, such as "linear easing is for loops only".

[examples/daylight-prestige.DESIGN.md](examples/daylight-prestige.DESIGN.md) is a complete example.

## 4. Reduced motion

A reduced path for a transition is almost never the same animation, shorter. It is a different
behaviour. `reduced` takes a duration, or one of these keywords:

| Value | Applies to | Meaning |
|---|---|---|
| a duration | intent | The same move, shortened to this |
| `instant` | intent | The state changes with no transition |
| `fade` | intent | Only opacity changes, for `motion.reduced.duration` |
| `ease` | intent | Replace a spring or overshooting curve with a plain decelerating one, same duration |
| `static` | intent, loop | Nothing moves. For a loop, show one still frame |
| `essential` | intent, loop | Keep the movement, because it carries information. Drop anything extra |

- `ease` on an intent with no spring and no overshoot changes nothing and is flagged
  (`motion-reduced-ease-noop`).
- Any value outside this table is `motion-reduced-invalid`.
- An eased intent over 200ms with no `reduced`, and no `motion.reduced.default`, is
  `motion-reduce-compat`. With no intents, the same check runs on duration tokens.

The 200ms line is a heuristic for when a change reads as deliberate motion rather than a state
change. Issue 47 cites WCAG 2.2 and vestibular guidance for it. The WCAG understanding document for
success criterion 2.3.3 (animation from interactions, level AAA) has no duration threshold, so this
is a judgement call. It is configurable with `--threshold`. The CSS `prefers-reduced-motion` media
feature is what `reduce` maps to in a browser.

## 5. Surface profiles

DESIGN.md is written for screens. The same brand also ships as a PDF, a flyer or a video title, and
an agent asked for one of those has no numbers to work from. A surface profile gives it the few that
matter. Only `print` and `video` are defined. Other names are preserved and get an info
(`surface-unknown`).

### 5.1 `surfaces.print`

```yaml
surfaces:
  print:
    trim: { width: 210mm, height: 297mm }   # finished size
    bleed: 3mm                              # artwork past the trim, every side
    safe-margin: 6mm                        # keep text and logos this far inside the trim
    color-mode: cmyk                        # cmyk | rgb | grayscale | spot
    color-profile: "profile named by the printer"
    min-text-size: 7pt
    min-stroke: 0.25pt
    min-image-ppi: 300
    exclude: [caption]                      # typography tokens that never reach print
```

| Field | Rule |
|---|---|
| lengths | A number with `mm`, `cm`, `in` or `pt`. Otherwise `print-length-invalid` |
| `bleed` | Required when `trim` is set (`print-bleed-missing`). Outside 2mm to 1/4 inch is `print-bleed-range` |
| `safe-margin` | Should exist, and must fit inside the trim (`print-safe-margin`) |
| `color-mode` | One of the four values (`print-color-mode`) |
| `color-profile` | Should be named when the mode is `cmyk` (`print-profile-missing`) |
| `min-text-size` | Every `typography` token in px or pt is compared, at 1px = 0.75pt (`print-text-below-min`) |

Bleed is generally 1/8 inch in imperial printing and 2mm to 5mm in metric, with 1/4 inch common for
die-cut shapes, and printers set their own. The linter's range is a prompt to check your printer's
template, not a rule about printing. `min-text-size`, `min-stroke` and `min-image-ppi` have no default:
the right values depend on the printer and the paper, so the profile holds yours and the linter only
checks the ones it can.

### 5.2 `surfaces.video`

```yaml
surfaces:
  video:
    width: 1920
    height: 1080
    aspect: "16:9"
    frame-rate: 25                    # or a ratio such as 24000/1001
    safe-area: { action: 3.5%, graphics: 5% }
    max-flashes-per-second: 3
```

| Field | Rule |
|---|---|
| `width`, `height`, `aspect` | Whole pixels, and the aspect must match (`video-size-invalid`) |
| `frame-rate` | A positive number or a ratio (`video-frame-rate`). Rates outside the common set are an info |
| `safe-area` | `action` and `graphics` insets per side, graphics at least as large as action (`video-safe-area`) |
| `max-flashes-per-second` | At most 3 (`video-flash-limit`) |

The 3.5% and 5% insets are the EBU R 95 figures for 16:9 television production, version 1.1, June
2017: action-safe 3.5% and graphics-safe 5% at the top, bottom and sides. Platform overlays such as
the interface drawn over short vertical video change often and are not in this spec. Put them in the
profile if you need them, and date them.

The flash limit is the WCAG 2.2 success criterion 2.3.1 threshold: no more than three flashes in any
one second, unless below the general and red flash thresholds. The linter checks the number you
declare. It cannot check a video.

When a video profile has a `frame-rate`, every `motion.duration` is checked against it
(`video-duration-off-grid`). 130ms at 25fps is 3.25 frames and would be rounded. This is the one rule
that joins the two halves of this spec: motion tokens are reused in video titles.

### 5.3 The `## Surfaces` section

Place it after Components and before Do's and Don'ts. Say which artefacts use which surface, and
which web tokens do not carry over. No section is an info (`surface-section-missing`).

### 5.4 Relation to `frame.md`

HyperFrames has its own `frame.md` for video-native compositions. This spec does not replace it. A
surface profile is a short block of limits inside a DESIGN.md that already exists, for an agent that
produces more than video. `frame.md` describes how to compose a video. If you use both, treat
the profile here as the limits and `frame.md` as the style.

## 6. How a consumer should read this

1. Read intents first. If the task names an intent, use it.
2. Resolve references to tokens. Never write a raw duration or curve into code when a token exists.
3. Under reduced motion, use the behaviour named on the intent, then `motion.reduced.default`.
4. Preserve anything you do not understand. Unknown keys and unknown surfaces are not errors.
5. Where prose and tokens disagree, the tokens are normative, as in the base spec.

## 7. Export mapping

| Token | CSS (`export --format css`) | DTCG (`export --format dtcg`) |
|---|---|---|
| duration | `--motion-duration-<name>: 200ms` | `duration` type, `{ value, unit }` |
| easing | `--motion-ease-<name>` | `cubicBezier` type, four numbers |
| spring | `--motion-spring-<name>` as `linear(...)`, plus `-duration` | custom type `design-md-motion.spring` |
| loop | `--motion-loop-<name>-period`, `-easing`, `-reduced` | custom type `design-md-motion.loop` |
| intent | `--motion-intent-<name>-duration`, `-easing`, `-reduced` | custom type `design-md-motion.intent`, with DTCG aliases |
| reduced | a `@media (prefers-reduced-motion: reduce)` block for `instant`, `fade`, `ease` | custom type `design-md-motion.reduced` |

DTCG 2025.10 defines duration and cubic bezier types and the alias syntax. It does not define
springs or composite motion types, so those use a custom `$type`, and a consumer that does not know
it should ignore it. `static` and `essential` cannot be expressed in a CSS custom property, so they
are exported as a value for the consumer to read.

## 8. Open questions

These are the parts most likely to change if the upstream maintainers take any of this.

1. **Spring shape.** Stiffness, damping and mass is the physical form. Some systems describe a spring
   with a response time and a damping ratio, which designers find easier to tune. Both describe the
   same thing. This spec picked the physical form because it has one definition. A second form could be
   added if it is needed.
2. **`time-constants`.** Audio and real-time interfaces have time values that are not animations, and
   some are counted in audio blocks, not milliseconds. This group covers only the millisecond case.
3. **Linking components to intents.** A component could carry `motion: "{motion.intent.press}"`. The
   base spec accepts unknown component properties with a warning, so this spec leaves it out.
4. **Intent names.** None are required. A short recommended list, like the recommended colour and type
   names in the base spec, might help agents.
5. **Whether `surfaces` belongs in DESIGN.md** or in a sibling file. It is here because one file is
   easier for an agent to find.

## 9. What this draws on

The shape of this proposal comes from the discussion on issue 47 in google-labs-code/design.md.
Contributors there raised the points that became the `loop`, `reduced` keyword, `spring`,
`time-constants` and `intent` parts: that loops are not transitions and should not be shortened, that
reduced motion is usually a substitution, that springs have no standard representation, that some time
values are not animations, and that agents consume named moves rather than raw values. The original
`motion-reduce-compat` rule and the `prefers-reduced-motion-fallback` map are from the issue's author.
Material Design 3, IBM Carbon, the W3C Design Tokens Community Group and MDN supplied the reference
values and types cited in [docs/SOURCES.md](docs/SOURCES.md).
