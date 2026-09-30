---
version: alpha
name: Broken Motion
description: Every line in the motion block here trips a rule. Used by the tests.
colors:
  primary: "#111111"
motion:
  durations:
    fast: 150ms
  duration:
    fast: 150
    medium: 0.3 s
    slow: 600ms
    slower: 600ms
  easing:
    bad-x: [1.5, 0, 0, 1]
    three: [0, 0, 1]
    ok: [0.2, 0, 0, 1]
    lin: linear
  spring:
    zero:
      stiffness: 0
      damping: 10
    sluggish:
      stiffness: 20
      damping: 40
  loop:
    pulse:
      period: 1s
      easing: lin
  intent:
    enter:
      duration: "{motion.duration.nope}"
      easing: "{motion.easing.ok}"
    nothing:
      properties: nothing is defined here
    slide:
      duration: "{motion.duration.slow}"
      easing: lin
      reduced: wobble
    wait:
      duration: 1500ms
      easing: "{motion.easing.ok}"
    pop:
      spring: "{motion.spring.sluggish}"
      duration: 200ms
    flat:
      duration: 100ms
      easing: "{motion.easing.ok}"
      reduced: ease
---

## Overview

A file that breaks the motion rules on purpose.

## Components

Buttons.

## Motion

This heading is after Components, which is the wrong place.
