---
version: alpha
name: Issue 47 As Proposed
description: The motion block from google-labs-code/design.md issue 47, unchanged, to show it is read as written.
colors:
  primary: "#1A1C1E"
motion:
  duration:
    fast: 150ms
    medium: 300ms
    slow: 600ms
  easing:
    standard: "cubic-bezier(0.2, 0, 0, 1)"
    emphasized: "cubic-bezier(0.2, 0, 0, 1.5)"
    decelerate: "cubic-bezier(0, 0, 0, 1)"
  prefers-reduced-motion-fallback:
    medium: 100ms
    slow: 100ms
---

## Overview

The block above is copied from the proposal in issue 47. It is valid as written. The linter reads
the prefers-reduced-motion-fallback map as a duration map and notes that intents and loops can
say more.

## Motion

Durations and easings only. No intents, no loops.
