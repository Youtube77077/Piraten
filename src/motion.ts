/**
 * Shared motion system. Every component pulls timing, easing and springs from here
 * so the whole interface moves with one consistent personality.
 */
import type { Transition, Variants } from 'motion/react';

/** Durations in seconds. */
export const duration = {
  micro: 0.16, // presses, small state flips
  short: 0.28, // hovers, focus, fades of small elements
  medium: 0.5, // element entrances
  long: 0.8, // screen-level transitions
  cinematic: 1.4, // hero reveals
} as const;

/** Cubic-bezier curves. */
export const ease = {
  /** Default for entrances: fast start, long soft settle. */
  out: [0.22, 1, 0.36, 1] as const,
  /** iOS-style emphasised curve for larger moves. */
  emphasized: [0.32, 0.72, 0, 1] as const,
  /** Exits accelerate away. */
  in: [0.55, 0, 0.75, 0.06] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
};

/** Springs, tuned to settle without visible overshoot unless noted. */
export const spring = {
  /** Buttons and presses. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } satisfies Transition,
  /** Layout moves and shared-element morphs. */
  smooth: { type: 'spring', stiffness: 220, damping: 30, mass: 1 } satisfies Transition,
  /** Hero objects — a hint of weight and a tiny settle. */
  soft: { type: 'spring', stiffness: 140, damping: 20, mass: 1.1 } satisfies Transition,
  /** Celebratory pops (checkmark, badge). Slight, controlled overshoot. */
  pop: { type: 'spring', stiffness: 420, damping: 18, mass: 0.8 } satisfies Transition,
};

export const transition = {
  enter: { duration: duration.medium, ease: ease.out } satisfies Transition,
  exit: { duration: duration.short, ease: ease.in } satisfies Transition,
  screen: { duration: duration.long, ease: ease.emphasized } satisfies Transition,
};

/** Stagger container: children enter one after another. */
export const stagger = (gap = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
  exit: { transition: { staggerChildren: 0.035, staggerDirection: -1 } },
});

/** Standard element entrance: rise + fade + a touch of focus-pull. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: transition.enter },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: transition.exit },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.enter },
  exit: { opacity: 0, transition: transition.exit },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.86 },
  show: { opacity: 1, scale: 1, transition: spring.soft },
  exit: { opacity: 0, scale: 0.96, transition: transition.exit },
};

/** Shared hover/press behaviour for interactive surfaces. */
export const pressable = {
  whileHover: { scale: 1.025 },
  whileTap: { scale: 0.965 },
  transition: spring.snappy,
};
