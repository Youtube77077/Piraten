import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';
import { sfx } from '../lib/sound';
import type { Outfit } from '../lib/outfits';
import { duration, ease, fadeUp, pressable, spring, stagger } from '../motion';
import { GoldButton, type ButtonState } from './GoldButton';
import { Token } from './Token';

interface Props {
  username: string;
  level: number;
  outfit: Outfit;
  behind: boolean;
  onGrant: () => void;
  onBack: () => void;
  onImageError: () => void;
}

export function ProfileScreen({ username, level, outfit, behind, onGrant, onBack, onImageError }: Props) {
  const [state, setState] = useState<ButtonState>('idle');
  const nameScale = Math.min(1, 10 / Math.max(username.length, 1));

  // Card flips in, then the level rolls up from 0.
  const levelValue = useMotionValue(0);
  const levelText = useTransform(levelValue, (v) => String(Math.round(v)));
  useEffect(() => {
    const t1 = window.setTimeout(() => sfx.reveal(), 120);
    const t2 = window.setTimeout(() => sfx.count(0.9), 950);
    const controls = animate(levelValue, level, { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.95 });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      controls.stop();
    };
  }, [level, levelValue]);

  function grant() {
    if (state !== 'idle') return;
    setState('loading');
    window.setTimeout(onGrant, 450);
  }

  return (
    <motion.section
      className={`screen profile ${behind ? 'is-behind' : ''}`}
      initial="hidden"
      animate="show"
      exit="exit"
      variants={stagger(0.08, 0.2)}
      aria-labelledby="profile-name"
    >
      <header className="topbar">
        <span className="topbar__slot" aria-hidden="true" />
        <Token layoutId="brand" className="token--mini" />
        <motion.button variants={fadeUp} type="button" className="ghost-btn topbar__back" onClick={onBack} {...pressable}>
          Change name
        </motion.button>
      </header>

      <div className="profile__body">
        <motion.figure
          className="locker"
          variants={{
            hidden: { opacity: 0, scale: 0.8, rotateY: -100, y: 30 },
            show: { opacity: 1, scale: 1, rotateY: 0, y: 0, transition: { ...spring.soft, opacity: { duration: 0.35, ease: ease.out } } },
            exit: { opacity: 0, scale: 0.94, transition: { duration: duration.short, ease: ease.in } },
          }}
        >
          <div className="locker__frame">
            <div className="locker__inner">
              <span className="locker__rays" aria-hidden="true" />
              <motion.img
                key={outfit.id}
                className="locker__img"
                src={outfit.image}
                alt={`${username}'s outfit`}
                draggable={false}
                onError={onImageError}
                initial={{ opacity: 0, scale: 1.12, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ ...spring.soft, delay: 0.42, opacity: { duration: 0.6, delay: 0.42 } }}
              />
              <span className="locker__floor" aria-hidden="true" />
              <span className="locker__shine" aria-hidden="true" />
            </div>
          </div>
        </motion.figure>

        <motion.div className="profile__info" variants={stagger(0.08, 0.5)}>
          <motion.h2
            variants={fadeUp}
            id="profile-name"
            className="player-name"
            style={{ '--name-scale': nameScale } as React.CSSProperties}
          >
            {username}
          </motion.h2>

          <motion.div variants={fadeUp} className="level" aria-label={`Account level ${level}`}>
            <span className="level__badge" aria-hidden="true">
              <svg viewBox="0 0 40 44">
                <path d="M20 2l16.5 9.5v21L20 42 3.5 32.5v-21z" />
              </svg>
              <motion.span>{levelText}</motion.span>
            </span>
            <span className="level__label">Account level</span>
          </motion.div>

          <motion.div variants={fadeUp} className="profile__cta">
            <GoldButton size="xl" label="Grant Pirate Token" loadingLabel="Preparing" state={state} onClick={grant} />
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
