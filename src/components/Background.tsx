import { useEffect, useMemo } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

/** Deterministic pseudo-random numbers so particles don't reshuffle between renders. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Props {
  dimmed?: boolean;
}

/**
 * Living backdrop: the supplied background artwork plus a few very slow,
 * compositor-only layers (transform/opacity keyframes) — light rays, a travelling
 * sheen and drifting gold motes. All of it pauses when the app is hidden and
 * switches off under prefers-reduced-motion.
 */
export function Background({ dimmed = false }: Props) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 40, damping: 18 });
  const sy = useSpring(py, { stiffness: 40, damping: 18 });
  const artX = useTransform(sx, (v) => v * -10);
  const artY = useTransform(sy, (v) => v * -8);
  const moteX = useTransform(sx, (v) => v * 22);
  const moteY = useTransform(sy, (v) => v * 16);

  useEffect(() => {
    if (reduce || !window.matchMedia('(pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduce, px, py]);

  const motes = useMemo(() => {
    const rand = seeded(7);
    const count = typeof window !== 'undefined' && window.innerWidth < 640 ? 14 : 22;
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      left: `${(rand() * 100).toFixed(2)}%`,
      size: 2 + rand() * 4,
      duration: 14 + rand() * 16,
      delay: -rand() * 30,
      drift: (rand() - 0.5) * 80,
      peak: 0.35 + rand() * 0.5,
    }));
  }, []);

  return (
    <div className={`bg ${dimmed ? 'bg--dimmed' : ''}`} aria-hidden="true">
      <motion.div className="bg__art-wrap" style={{ x: artX, y: artY }}>
        <div className="bg__art" />
      </motion.div>
      <div className="bg__rays" />
      <div className="bg__sheen" />
      <motion.div className="bg__motes" style={{ x: moteX, y: moteY }}>
        {motes.map((m) => (
          <span
            key={m.key}
            className="mote"
            style={
              {
                left: m.left,
                width: m.size,
                height: m.size,
                animationDuration: `${m.duration}s`,
                animationDelay: `${m.delay}s`,
                '--drift': `${m.drift}px`,
                '--peak': m.peak,
              } as React.CSSProperties
            }
          />
        ))}
      </motion.div>
      <div className="bg__vignette" />
    </div>
  );
}
