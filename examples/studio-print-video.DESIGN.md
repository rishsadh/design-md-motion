---
version: alpha
name: Fieldnotes Studio
description: A fictional studio brand used to show one DESIGN.md carrying web, print and video surfaces.
colors:
  primary: "#22262B"
  secondary: "#6F757C"
  tertiary: "#C2562F"
  neutral: "#F4F1EC"
typography:
  headline:
    fontFamily: Source Serif 4
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: Source Sans 3
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: Source Sans 3
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.4
spacing:
  sm: 8px
  md: 16px
  lg: 32px
rounded:
  sm: 4px
motion:
  duration:
    instant: 0ms
    fast: 120ms
    medium: 200ms
    slow: 400ms
  easing:
    standard: [0.2, 0, 0, 1]
    decelerate: [0, 0, 0, 1]
    accelerate: [0.3, 0, 1, 1]
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
    reveal:
      duration: "{motion.duration.slow}"
      easing: "{motion.easing.standard}"
      properties: lower third slides in from the left
      reduced: fade
surfaces:
  print:
    trim:
      width: 210mm
      height: 297mm
    bleed: 3mm
    safe-margin: 6mm
    color-mode: cmyk
    color-profile: "profile named by the printer"
    min-text-size: 7pt
    min-stroke: 0.25pt
    min-image-ppi: 300
  video:
    width: 1920
    height: 1080
    aspect: "16:9"
    frame-rate: 25
    safe-area:
      action: 3.5%
      graphics: 5%
    max-flashes-per-second: 3
---

# Fieldnotes Studio

## Overview

A calm studio brand. Serif headlines, sans body, one warm accent.

## Colors

- **Primary (#22262B):** ink for text.
- **Secondary (#6F757C):** captions and rules.
- **Tertiary (#C2562F):** the one accent.
- **Neutral (#F4F1EC):** paper.

## Typography

Source Serif 4 for headlines, Source Sans 3 for everything else.

## Shapes

Small, even corners on the web. Print and video use square edges.

## Motion

Motion on the web follows the intents above. The same durations are reused in video titles, which
is why they are all whole numbers of frames at 25fps: 120ms is 3 frames, 200ms is 5, 400ms is 10.

Under reduced motion, entrances become a fade and exits become instant.

## Surfaces

Every artefact names its surface. If it does not, it is web.

### Print

A4 flyers and one-pagers. Artwork reaches 3mm past the trim on every side. Text and logos stay
6mm inside it. Colour is converted to CMYK with the printer's own profile, never with a default.
Text is never smaller than 7pt, and lines never thinner than 0.25pt. Images are placed at 300 ppi
or more at their final size.

### Video

1920 by 1080 at 25fps. Logos and titles sit inside the graphics-safe area, which is inset 5% from
each edge. Anything the viewer must see happens inside the action-safe area, inset 3.5%. Nothing
flashes more than three times in any one second.

## Do's and Don'ts

- Do say which surface a piece is for before designing it.
- Don't reuse web spacing tokens in print without converting them to millimetres.
- Don't put a lower third outside the graphics-safe area.
