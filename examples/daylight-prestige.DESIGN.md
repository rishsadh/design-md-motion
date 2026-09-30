---
version: alpha
name: Daylight Prestige
description: A calm, high-contrast editorial system used here to show a complete motion section.
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.md}"
    padding: 12px
motion:
  duration:
    instant: 0ms
    fast: 120ms
    medium: 200ms
    slow: 400ms
    hero: 700ms
  easing:
    standard: [0.2, 0, 0, 1]
    decelerate: [0, 0, 0, 1]
    accelerate: [0.3, 0, 1, 1]
    linear: linear
  spring:
    settle:
      stiffness: 260
      damping: 26
      mass: 1
  loop:
    spinner:
      period: 1100ms
      easing: linear
      reduced: essential
    shimmer:
      period: 1600ms
      easing: linear
      reduced: static
  reduced:
    default: fade
    duration: 100ms
  intent:
    enter:
      duration: "{motion.duration.medium}"
      easing: "{motion.easing.decelerate}"
      properties: opacity 0 to 1, rise 8px
      reduced: fade
    exit:
      duration: "{motion.duration.fast}"
      easing: "{motion.easing.accelerate}"
      properties: opacity 1 to 0
      reduced: instant
    press:
      duration: "{motion.duration.fast}"
      easing: "{motion.easing.standard}"
      properties: scale 1 to 0.98
      reduced: instant
    hero-enter:
      duration: "{motion.duration.hero}"
      easing: "{motion.easing.decelerate}"
      properties: headline and image arrive together, once per page
      reduced: fade
    reveal:
      duration: "{motion.duration.slow}"
      easing: "{motion.easing.standard}"
      properties: clip from the leading edge, stagger 40ms
      reduced: fade
    confirm:
      spring: "{motion.spring.settle}"
      properties: scale 0.9 to 1 with a small overshoot
      reduced: ease
---

# Daylight Prestige

## Overview

A quiet editorial brand. Type does the work, colour is rationed, and nothing on the page moves
unless the movement tells the reader something.

## Colors

- **Primary (#1A1C1E):** deep ink for headlines and core text.
- **Secondary (#6C7278):** slate for borders, captions and metadata.
- **Tertiary (#B8422E):** the single interaction colour.
- **Neutral (#F7F5F2):** warm limestone page background.

## Typography

Public Sans throughout. Headlines semi-bold, body regular at 16px.

## Layout

An 8px scale with a 4px half step. Generous internal padding on cards.

## Shapes

Small, even corner radii. No mixing of sharp and rounded corners in one view.

## Motion

Motion confirms an action or explains a change of state. It is never decoration.

**Use the tokens.** Every transition names an intent (`enter`, `exit`, `press`, `reveal`,
`hero-enter`, `confirm`) and takes its duration and easing from that intent. Do not write raw milliseconds or
curves in component code.

**Scale.** Durations run from `instant` to `hero`. State changes stay at `fast` or `medium`.
`slow` is for content that arrives as a group. `hero` is reserved for one moment per page and
always has a reduced path.

**Direction.** Things that arrive decelerate, things that leave accelerate, things that move
inside the viewport use `standard`. Linear easing is for loops only.

**Springs.** `confirm` is the only spring in the system. It is a physical model, so keep the
stiffness and damping values and derive the curve for whichever renderer is in use.

**Choreography.** When several things move together, the lead element starts first and the rest
follow at 40ms steps. The stagger is prose on purpose: it belongs to the move, not to the scale.

**Reduced motion.** Under `prefers-reduced-motion: reduce`, each intent falls back to the
behaviour named on it, not to a shorter version of the same animation. Entrances become a fade
of `reduced.duration`. Presses and exits become instant. The spinner keeps turning, because it
is the only sign that work is happening, and loses everything else. The shimmer becomes a still
block.

## Components

Buttons use `press` on activation and never animate their colour change for longer than `fast`.

## Do's and Don'ts

- Do give every new animation an intent name before writing code.
- Do pair every intent with a reduced path.
- Don't animate layout properties that cause reflow when a transform will do.
- Don't loop anything for decoration.
