import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Outfit } from '../lib/outfits';
import { success, tap } from '../lib/native';
import { randomInt } from '../lib/random';
import { duration, ease, fadeUp, spring, stagger } from '../motion';
import { Token } from './Token';
import logoSmallUrl from '../assets/brand/logo-256.webp';

type Phase = 'charge' | 'burst' | 'complete';

interface Props {
  username: string;
  level: number;
  outfit: Outfit;
  /** Called when the sequence is finished and the app should return home. */
  onFinished: () => void;
}

const CHARGE_DELAY = 0.75;
/** The charge (0 → 100%) takes a random 2–4 seconds each time. */
const randomChargeSeconds = () => randomInt(2000, 4000) / 1000;
const BURST_MS = 1100;
/** How long the completion state is shown before fading back home. */
export const RETURN_MS = 2000;
const CHARGE_SCALE = 1.45;
const STATUS = [
  { at: 0, text: 'Preparing reward' },
  { at: 0.34, text: 'Charging Pirate Token' },
  { at: 0.74, text: 'Sealing the treasure' },
];

export function RewardSequence({ username, level, outfit, onFinished }: Props) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('charge');
  const [statusIdx, setStatusIdx] = useState(0);
  const progress = useMotionValue(0);
  const ring = useTransform(progress, (v) => v / 100);
  const pct = useTransform(progress, (v) => `${Math.round(v)}%`);
  const [chargeSeconds] = useState(randomChargeSeconds);
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  };

  // 1. charge
  useEffect(() => {
    const controls = animate(progress, 100, {
      duration: chargeSeconds,
      ease: [0.45, 0.05, 0.25, 1],
      delay: CHARGE_DELAY,
      onUpdate: (v) => {
        const idx = STATUS.reduce((acc, s, i) => (v / 100 >= s.at ? i : acc), 0);
        setStatusIdx((cur) => (cur === idx ? cur : idx));
      },
      onComplete: () => {
        setPhase('burst');
        void success();
      },
    });
    const ticks = [0.34, 0.74].map((f) =>
      window.setTimeout(() => void tap('LIGHT'), (CHARGE_DELAY + chargeSeconds * f) * 1000),
    );
    return () => {
      controls.stop();
      ticks.forEach(clearTimeout);
    };
  }, [progress, chargeSeconds]);

  // 2. burst → complete → 3. auto-return home
  useEffect(() => {
    if (phase === 'burst') {
      const t = window.setTimeout(() => setPhase('complete'), BURST_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'complete') {
      const t = window.setTimeout(finish, RETURN_MS);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        key: i,
        angle: (360 / 18) * i + (i % 2 ? 7 : -5),
        dist: 120 + ((i * 37) % 70),
        delay: ((i * 0.23) % 1.6).toFixed(2),
        size: 3 + (i % 4),
      })),
    [],
  );

  const done = phase !== 'charge';
  const complete = phase === 'complete';

  // The layout is fixed from the first frame (hero at its final spot, completion content
  // reserved but hidden). While charging, the hero group is moved to the screen centre and
  // enlarged with transforms only, so finishing never causes a layout shift.
  const groupRef = useRef<HTMLDivElement>(null);
  const gy = useMotionValue(0);
  const gs = useMotionValue(CHARGE_SCALE);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useLayoutEffect(() => {
    const place = () => {
      const el = groupRef.current;
      if (!el || phaseRef.current === 'complete') return;
      const r = el.getBoundingClientRect();
      const untransformedCentre = r.top + r.height / 2 - gy.get();
      gy.set(window.innerHeight / 2 - untransformedCentre);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [gy]);
  useEffect(() => {
    if (!complete) return;
    const a = animate(gy, 0, spring.smooth);
    const b = animate(gs, 1, spring.smooth);
    return () => {
      a.stop();
      b.stop();
    };
  }, [complete, gy, gs]);

  return (
    <motion.div
      className={`reward phase-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label="Pirate Token reward"
      initial="hidden"
      animate="show"
      exit="exit"
      onClick={complete ? finish : undefined}
    >
      {/* backdrop: darken, then the golden key art blooms in behind the token */}
      <motion.div
        className="reward__scrim"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { duration: 0.6, ease: ease.out } },
          exit: { opacity: 0, transition: { duration: 0.7, ease: ease.inOut } },
        }}
      />
      <motion.div
        className="reward__keyart"
        variants={{
          hidden: { opacity: 0, scale: 1.18 },
          show: { opacity: complete ? 0.28 : 0.4, scale: 1, transition: { duration: 2.4, ease: ease.out, delay: 0.2 } },
          exit: { opacity: 0, transition: { duration: 0.6 } },
        }}
      />
      <motion.div className="reward__rays-wrap" animate={{ y: complete ? '-18vh' : '0vh' }} transition={spring.smooth}>
        <motion.div
          className="reward__rays"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { duration: 1.6, delay: 0.5 } },
            exit: { opacity: 0, transition: { duration: 0.4 } },
          }}
        />
      </motion.div>

      <motion.div
        className="reward__stage"
        variants={{
          hidden: {},
          show: {},
          exit: { opacity: 0, scale: 0.96, transition: { duration: 0.6, ease: ease.inOut } },
        }}
      >
        <motion.div ref={groupRef} className="reward__group" style={{ y: gy, scale: gs }}>
          <div className="reward__hero">
            {/* progress ring */}
            <AnimatePresence>
              {!complete && (
                <motion.svg
                  className="ring"
                  viewBox="0 0 200 200"
                  initial={{ opacity: 0, scale: 0.85, rotate: -90 }}
                  animate={{ opacity: done ? 0 : 1, scale: done ? 1.15 : 1, rotate: -90 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: done ? 0.5 : 0.8, ease: ease.out, delay: done ? 0 : 0.5 }}
                  aria-hidden="true"
                >
                  <circle className="ring__track" cx="100" cy="100" r="92" />
                  <motion.circle className="ring__bar" cx="100" cy="100" r="92" style={{ pathLength: ring }} />
                </motion.svg>
              )}
            </AnimatePresence>

            {/* sparks drifting outward while charging */}
            {!reduce && !complete && (
              <div className={`sparks ${done ? 'is-done' : ''}`} aria-hidden="true">
                {sparks.map((s) => (
                  <span
                    key={s.key}
                    className="spark"
                    style={
                      {
                        '--angle': `${s.angle}deg`,
                        '--dist': `${s.dist}px`,
                        animationDelay: `${s.delay}s`,
                        width: s.size,
                        height: s.size,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            )}

            <motion.div
              className="reward__token"
              initial={{ opacity: 0, scale: 0.55, y: 40 }}
              animate={phase === 'burst' ? { opacity: 1, y: 0, scale: [1, 1.14, 1] } : { opacity: 1, scale: 1, y: 0 }}
              transition={
                phase === 'burst'
                  ? { duration: 0.7, ease: ease.out, times: [0, 0.3, 1] }
                  : { ...spring.soft, opacity: { duration: 0.5, ease: ease.out } }
              }
            >
              <Token className="token--reward" glow float={!done} sheen={complete} />
            </motion.div>

            {/* burst: flash + shockwave */}
            <AnimatePresence>
              {phase === 'burst' && (
                <>
                  <motion.span
                    key="flash"
                    className="burst-flash"
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1.4, 1.8] }}
                    transition={{ duration: 0.9, ease: ease.out, times: [0, 0.25, 1] }}
                    aria-hidden="true"
                  />
                  <motion.span
                    key="wave"
                    className="burst-wave"
                    initial={{ opacity: 0.9, scale: 0.6 }}
                    animate={{ opacity: 0, scale: 2.6 }}
                    transition={{ duration: 1.1, ease: ease.out }}
                    aria-hidden="true"
                  />
                </>
              )}
            </AnimatePresence>

            {/* checkmark badge */}
            <AnimatePresence>
              {done && (
                <motion.div
                  className="check-badge"
                  initial={{ scale: 0, opacity: 0, rotate: -30 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ ...spring.pop, delay: 0.25 }}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 52 52">
                    <motion.path
                      d="M14 27.5l8 8L38.5 18"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.55, ease: ease.out, delay: 0.5 }}
                    />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            className="reward__status"
            initial={{ opacity: 0, y: 12 }}
            animate={
              complete
                ? { opacity: 0, y: -8, transition: { duration: duration.short } }
                : { opacity: 1, y: 0, transition: { delay: 0.7, duration: duration.medium, ease: ease.out } }
            }
            aria-live="polite"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={done ? 'done' : statusIdx}
                className="reward__status-text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: duration.short, ease: ease.out }}
              >
                {done ? 'Token unlocked' : STATUS[statusIdx].text}
              </motion.span>
            </AnimatePresence>
            <motion.span className="reward__pct">{pct}</motion.span>
          </motion.div>
        </motion.div>

        <motion.div
          className="complete"
          variants={stagger(0.08, 0.2)}
          initial="hidden"
          animate={complete ? 'show' : 'hidden'}
          inert={!complete}
          aria-hidden={!complete}
        >
          <motion.h2 variants={fadeUp} className="complete__title">
            Pirate Token <span>experience complete</span>
          </motion.h2>

          <motion.div variants={fadeUp} className="summary">
            <span className="summary__avatar">
              <img src={outfit.image} alt="" draggable={false} />
            </span>
            <span className="summary__text">
              <span className="summary__name">{username}</span>
              <span className="summary__level">Level {level}</span>
            </span>
            <span className="summary__token">
              <img src={logoSmallUrl} alt="" draggable={false} />
              <span>×1</span>
            </span>
          </motion.div>

          <motion.div variants={fadeUp} className="return-bar" aria-hidden="true">
            <span className={complete ? 'is-running' : undefined} style={{ animationDuration: `${RETURN_MS}ms` }} />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
