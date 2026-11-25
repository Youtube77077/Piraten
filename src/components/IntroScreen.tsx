import { motion } from 'motion/react';
import { useRef, useState, type FormEvent } from 'react';
import { fadeUp, stagger, transition } from '../motion';
import { checkUsername } from '../lib/username';
import { GoldButton, type ButtonState } from './GoldButton';
import { Token } from './Token';
import { UsernameInput } from './UsernameInput';

interface Props {
  initialName: string;
  onSubmit: (username: string) => Promise<void>;
}

export function IntroScreen({ initialName, onSubmit }: Props) {
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
    if (!check.ok || state !== 'idle') return;
    inputRef.current?.blur();
    setFailure(null);
    setState('loading');
    try {
      await onSubmit(check.value);
      setState('done');
    } catch {
      setState('idle');
      setFailure('Couldn’t load outfits — check your connection and try again.');
    }
  }

  return (
    <motion.section
      className="screen intro"
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
          hidden: { opacity: 0, scale: 0.82 },
          show: { opacity: 1, scale: 1, transition: { ...transition.screen, duration: 1.1 } },
          exit: { opacity: 1 },
        }}
      >
        <Token layoutId="brand" className="token--hero" float glow sheen />
      </motion.div>

      <motion.div variants={fadeUp} className="title-wrap">
        <h1 id="intro-title" className="title">
          <span className="title__kicker">Claim your</span>
          <span className="title__main">Pirate Token</span>
        </h1>
      </motion.div>

      <motion.p variants={fadeUp} className="lede">
        Enter your Fortnite username to get your Pirate Token.
      </motion.p>

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

    </motion.section>
  );
}
