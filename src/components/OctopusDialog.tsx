import { motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sfx } from '../lib/sound';
import { ease, spring } from '../motion';
import { GoldButton } from './GoldButton';
import { OctopusIcon } from './OctopusIcon';

export const OCTOPUS_MAX = 10000;

interface Props {
  onClose: () => void;
  onStart: (count: number) => void;
}

/** Asks how many accounts should get a Pirate Token. */
export function OctopusDialog({ onClose, onStart }: Props) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const n = Number(value);
  const valid = value !== '' && Number.isInteger(n) && n >= 1 && n <= OCTOPUS_MAX;
  const error = touched && value !== '' && !valid ? `Pick a number from 1 to ${OCTOPUS_MAX.toLocaleString()}.` : null;

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 350);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!valid) {
      sfx.error();
      return;
    }
    onStart(n);
  }

  return (
    <motion.div
      className="octo-dialog"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25, ease: ease.in } }}
      transition={{ duration: 0.3, ease: ease.out }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="octo-title"
    >
      <div className="octo-dialog__scrim" onClick={onClose} />
      <motion.form
        className="octo-card"
        onSubmit={submit}
        noValidate
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.soft }}
        exit={{ opacity: 0, y: 24, scale: 0.96, transition: { duration: 0.22, ease: ease.in } }}
      >
        <button type="button" className="icon-btn octo-card__close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <span className="octo-card__icon" aria-hidden="true">
          <OctopusIcon />
        </span>
        <h2 id="octo-title" className="octo-card__title">
          Octopus
        </h2>
        <p className="octo-card__lede">How many accounts get a Pirate Token?</p>

        <label className="octo-card__label" htmlFor="octo-count">
          Number of accounts
        </label>
        <div className={`octo-input ${error ? 'has-error' : ''}`}>
          <input
            ref={inputRef}
            id="octo-count"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="e.g. 250"
            value={value}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
              if (digits.length > value.length) sfx.key();
              setValue(digits);
              if (digits) setTouched(true);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby="octo-hint"
          />
          <span className="octo-input__max">/ {OCTOPUS_MAX.toLocaleString()}</span>
        </div>
        <p id="octo-hint" className={`octo-card__hint ${error ? 'is-error' : ''}`} aria-live="polite">
          {error ?? 'Type any number from 1 to 10,000.'}
        </p>

        <GoldButton type="submit" size="xl" label="Give all" disabled={!valid} />
      </motion.form>
    </motion.div>
  );
}
