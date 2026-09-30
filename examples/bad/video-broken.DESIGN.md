---
version: alpha
name: Broken Video
motion:
  duration:
    fast: 120ms
    odd: 130ms
    slow: 400ms
  easing:
    standard: [0.2, 0, 0, 1]
  intent:
    enter:
      duration: "{motion.duration.fast}"
      easing: "{motion.easing.standard}"
      reduced: fade
surfaces:
  video:
    width: 1920
    height: 1080
    aspect: "4:3"
    frame-rate: 25
    safe-area:
      action: 5%
      graphics: 2%
    max-flashes-per-second: 5
---

## Motion

Durations that are not whole frames, a wrong aspect, inverted safe areas and too many flashes.
