---
version: alpha
name: First Draft
description: A realistic first attempt at a motion block, with the mistakes people usually make.
colors:
  primary: "#1A1C1E"
motion:
  duration:
    fast: 150
    medium: 300ms
    hero: 800ms
  easing:
    standard: [0.2, 0, 0, 1]
    bouncy: [1.2, 0, 0, 1.4]
    linear: linear
  intent:
    enter:
      duration: "{motion.duration.medium}"
      easing: "{motion.easing.standard}"
    hero:
      duration: "{motion.duration.hero}"
      easing: "{motion.easing.linear}"
      reduced: fade
    toast:
      duration: "{motion.duration.quick}"
      easing: "{motion.easing.standard}"
      reduced: instant
  loop:
    spinner:
      period: 1100ms
      easing: linear
---

## Overview

Motion confirms actions. It is not decoration.

## Motion

Use the intents. Do not write raw milliseconds.
