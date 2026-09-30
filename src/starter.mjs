// Starter blocks printed by `design-md-motion init`. They lint clean, and a test keeps them that way.

const MOTION = `motion:
  duration:
    instant: 0ms
    fast: 120ms
    medium: 200ms
    slow: 400ms
  easing:
    standard: [0.2, 0, 0, 1]
    decelerate: [0, 0, 0, 1]
    accelerate: [0.3, 0, 1, 1]
    linear: linear
  reduced:
    default: fade
    duration: 100ms
  intent:
    enter:
      duration: "{motion.duration.medium}"
      easing: "{motion.easing.decelerate}"
      properties: opacity 0 to 1
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
    reveal:
      duration: "{motion.duration.slow}"
      easing: "{motion.easing.standard}"
      properties: content arrives as a group
      reduced: fade
  loop:
    spinner:
      period: 1100ms
      easing: linear
      reduced: essential
`;

const SURFACES = `surfaces:
  print:
    trim:
      width: 210mm
      height: 297mm
    bleed: 3mm
    safe-margin: 5mm
    color-mode: cmyk
    color-profile: "the ICC profile name your printer asks for"
    min-text-size: 7pt
  video:
    width: 1920
    height: 1080
    aspect: "16:9"
    frame-rate: 25
    safe-area:
      action: 3.5%
      graphics: 5%
    max-flashes-per-second: 3
`;

const PROSE = `
## Motion

Say when things move and why. Name the intents an agent may use, what moves in each, and any
choreography that does not fit the scale (stagger, sequencing). Say what happens under
prefers-reduced-motion for each intent, in words.
`;

export function STARTER(withSurfaces) {
  return [
    '# Paste under the front matter of your DESIGN.md, then add the "## Motion" section below.',
    '# Keep the YAML between the --- lines. Shown here without them.',
    '',
    MOTION + (withSurfaces ? SURFACES : ''),
    '# Markdown body, between Shapes and Components:',
    PROSE + (withSurfaces ? '\n## Surfaces\n\nSay which artefacts use which surface, and which web tokens do not apply to it.\n' : ''),
  ].join('\n');
}

export const STARTER_PARTS = { MOTION, SURFACES, PROSE };
