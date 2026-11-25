import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type PointerEvent } from 'react';
import { sfx } from '../lib/sound';
import { duration, ease, spring } from '../motion';

export type ButtonState = 'idle' | 'loading' | 'done';

interface Props {
  label: string;
  loadingLabel?: string;
  doneLabel?: string;
  state?: ButtonState;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  size?: 'lg' | 'xl';
  className?: string;
}

const labelMotion = {
  initial: { opacity: 0, y: 12, filter: 'blur(3px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -12, filter: 'blur(3px)' },
  transition: { duration: duration.short, ease: ease.out },
};

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

/** Primary call-to-action. States: default, hover, pressed, loading, disabled, completed. */
export function GoldButton({
  label,
  loadingLabel = 'Loading',
  doneLabel = 'Done',
  state = 'idle',
  disabled = false,
  onClick,
  type = 'button',
  size = 'lg',
  className = '',
}: Props) {
  const interactive = !disabled && state === 'idle';
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  // Ripple of light spreading from the exact press point.
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const size = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2;
    const id = nextId.current++;
    setRipples((list) => [...list, { id, x, y, size }]);
  };

  return (
    <motion.button
      type={type}
      className={`gold-btn gold-btn--${size} is-${state} ${disabled ? 'is-disabled' : ''} ${className}`}
      onPointerDown={onPointerDown}
      onClick={
        interactive
          ? () => {
              sfx.tap();
              onClick?.();
            }
          : undefined
      }
      aria-disabled={!interactive}
      aria-busy={state === 'loading'}
      disabled={disabled}
      whileHover={interactive ? { scale: 1.025, y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.955, y: 1 } : undefined}
      transition={spring.snappy}
    >
      <span className="gold-btn__glow" aria-hidden="true" />
      <span className="gold-btn__face">
        <span className="gold-btn__sheen" aria-hidden="true" />
        <span className="gold-btn__progress" aria-hidden="true" />
        {ripples.map((rp) => (
          <motion.span
            key={rp.id}
            className="gold-btn__ripple"
            style={{ left: rp.x - rp.size / 2, top: rp.y - rp.size / 2, width: rp.size, height: rp.size }}
            initial={{ scale: 0, opacity: 0.55 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 0.7, ease: ease.out }}
            onAnimationComplete={() => setRipples((list) => list.filter((x) => x.id !== rp.id))}
            aria-hidden="true"
          />
        ))}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={state} className="gold-btn__label" {...labelMotion}>
            {state === 'loading' && <span className="spinner" aria-hidden="true" />}
            {state === 'done' && (
              <svg className="gold-btn__check" viewBox="0 0 24 24" aria-hidden="true">
                <motion.path
                  d="M5 12.5l4.2 4.2L19 7"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: duration.medium, ease: ease.out }}
                />
              </svg>
            )}
            {state === 'idle' ? label : state === 'loading' ? loadingLabel : doneLabel}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
