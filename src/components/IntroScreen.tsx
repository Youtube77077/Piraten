import { motion, type Variants } from 'motion/react';
import { useRef, useState, type FormEvent } from 'react';
import { checkUsername } from '../lib/username';
import { sfx } from '../lib/sound';
import { ease, fadeUp, spring, stagger } from '../motion';
import { GoldButton, type ButtonState } from './GoldButton';
import { Token } from './Token';
import { UsernameInput } from './UsernameInput';
import { OctopusIcon } from './OctopusIcon';

interface Props {
  initialName: string;
  onSubmit: (username: string) => Promise<void>;
  onOctopus: () => void;
  behind?: boolean;
}

const TITLE = 'Pirate Token';

/** Letters drop in one after another with a springy pop and a slight tilt. */
const letter: Variants = {
  hidden: (i: number) => ({ opacity: 0, y: 70, scale: 0.4, rotate: i % 2 ? 14 : -14 }),
  show: { opacity: 1, y: 0, scale: 1, rotate: 0, transition: spring.pop },
  exit: { opacity: 0, y: -24, transition: { duration: 0.22, ease: ease.in } },
};

export function IntroScreen({ initialName, onSubmit, onOctopus, behind = false }: Props) {
  const [value, setValue] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<ButtonState>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const check = checkUsername(value);
  const error = failure ?? (!check.ok && touched ? check.reason : null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!check.ok) {
      if (check.reason) sfx.error();
      return;
    }
    if (state !== 'idle') return;
    inputRef.current?.blur();
    setFailure(null);
    setState('loading');
    try {
      await onSubmit(check.value);
      setState('done');
    } catch {
      setState('idle');
      sfx.error();
      setFailure('Couldn’t load outfits — check your connection and try again.');
    }
  }

  return (
    <motion.section
      className={`screen intro ${behind ? 'is-behind' : ''}`}
      variants={stagger(0.08, 0.1)}
      initial="hidden"
      animate="show"
      exit="exit"
      aria-labelledby="intro-title"
    >
      <motion.div variants={fadeUp} className="eyebrow">
        <span className="eyebrow__dot" aria-hidden="true" />
        Limited-time event
      </motion.div>

      <motion.div
        className="intro__logo"
        variants={{
          hidden: { opacity: 0, scale: 0.3, rotate: -140 },
          show: { opacity: 1, scale: 1, rotate: 0, transition: { ...spring.soft, opacity: { duration: 0.4, ease: ease.out } } },
          exit: { opacity: 1 },
        }}
      >
        {/* entrance flare + shockwave behind the token */}
        <motion.span
          className="intro__flare"
          aria-hidden="true"
          variants={{
            hidden: { opacity: 0, scale: 0.2 },
            show: { opacity: [0, 1, 0], scale: [0.2, 1.3, 1.9], transition: { duration: 1.2, ease: ease.out, delay: 0.35, times: [0, 0.25, 1] } },
            exit: { opacity: 0 },
          }}
        />
        <motion.span
          className="intro__wave"
          aria-hidden="true"
          variants={{
            hidden: { opacity: 0, scale: 0.5 },
            show: { opacity: [0, 0.9, 0], scale: [0.5, 1, 2.4], transition: { duration: 1.3, ease: ease.out, delay: 0.45, times: [0, 0.12, 1] } },
            exit: { opacity: 0 },
          }}
        />
        <Token layoutId="brand" className="token--hero" float glow sheen />
      </motion.div>

      <motion.h1
        id="intro-title"
        className="title"
        aria-label={TITLE}
        variants={stagger(0.04, 0.15)}
      >
        {TITLE.split('').map((ch, i) => (
          <motion.span key={i} custom={i} variants={letter} className="title__char" aria-hidden="true">
            {ch === ' ' ? ' ' : ch}
          </motion.span>
        ))}
      </motion.h1>

      <motion.form variants={fadeUp} className="intro__form" onSubmit={submit} noValidate>
        <UsernameInput
          ref={inputRef}
          value={value}
          onChange={(v) => {
            setValue(v);
            setFailure(null);
            if (v.trim().length >= 2) setTouched(true);
          }}
          error={error}
          disabled={state !== 'idle'}
        />
        <GoldButton
          type="submit"
          size="xl"
          label="Find my account"
          loadingLabel="Searching"
          doneLabel="Found"
          state={state}
          disabled={!check.ok && state === 'idle'}
        />
      </motion.form>

      <motion.div variants={fadeUp} className="intro__octo">
        <GoldButton
          variant="secondary"
          size="lg"
          label="Octopus"
          icon={<OctopusIcon />}
          onClick={onOctopus}
          disabled={state !== 'idle'}
        />
      </motion.div>
    </motion.section>
  );
}
