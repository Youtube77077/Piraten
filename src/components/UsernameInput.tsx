import { AnimatePresence, motion } from 'motion/react';
import { forwardRef, useEffect, useState } from 'react';
import { duration, ease } from '../motion';
import { USERNAME_MAX } from '../lib/username';
import { sfx } from '../lib/sound';

const EXAMPLES = ['CaptainLoot', 'Salty_Sea_Dog', 'KrakenKid07', 'GoldDigger_99', 'StormRunner'];

interface Props {
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  disabled?: boolean;
}

export const UsernameInput = forwardRef<HTMLInputElement, Props>(function UsernameInput(
  { value, onChange, error, disabled },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(0);
  const empty = value.length === 0;

  // Cycle example names in the placeholder while the field is empty.
  useEffect(() => {
    if (!empty) return;
    const id = window.setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 2600);
    return () => window.clearInterval(id);
  }, [empty]);

  return (
    <div className={`field ${focused ? 'is-focused' : ''} ${error ? 'has-error' : ''} ${empty ? 'is-empty' : ''}`}>
      <label className="field__label" htmlFor="username">
        Fortnite username
      </label>
      <div className="field__box">
        <span className="field__ring" aria-hidden="true" />
        <svg className="field__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.8" />
          <path d="M4.5 20c1.3-3.6 4.2-5.4 7.5-5.4s6.2 1.8 7.5 5.4" />
        </svg>
        <input
          ref={ref}
          id="username"
          name="username"
          className="field__input"
          value={value}
          onChange={(e) => {
            if (e.target.value.length > value.length) sfx.key();
            onChange(e.target.value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={USERNAME_MAX + 4}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby="username-hint"
        />
        <span className="field__placeholder" aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            {empty && (
              <motion.span
                key={EXAMPLES[example]}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: duration.medium, ease: ease.out }}
              >
                e.g. {EXAMPLES[example]}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="field__count" aria-hidden="true">
          {value.trim().length}/{USERNAME_MAX}
        </span>
      </div>
      <div className="field__hint" id="username-hint" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={error ?? 'hint'}
            className={error ? 'field__error' : undefined}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: duration.short, ease: ease.out }}
          >
            {error ?? '\u00a0'}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
});
