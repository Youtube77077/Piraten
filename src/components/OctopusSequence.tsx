import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logoSmallUrl from '../assets/brand/logo-256.webp';
import { pickRandomOutfit, type Outfit } from '../lib/outfits';
import { randomIndex, randomLevel } from '../lib/random';
import { grantTick, sfx } from '../lib/sound';
import { success } from '../lib/native';
import { ease, fadeUp, spring, stagger } from '../motion';
import { OctopusIcon } from './OctopusIcon';
import { Token } from './Token';

interface Account {
  i: number;
  username: string;
  level: number;
  outfit: Outfit;
}

type Phase = 'prepare' | 'running' | 'burst' | 'complete';

interface Props {
  count: number;
  onFinished: () => void;
}

const FEED_SIZE = 7;
const RETURN_MS = 2600;
const POOL_TARGET = 160; // distinct preloaded skins to draw from during the run
const POOL_START = 8; // skins ready before the first account

/**
 * Time between accounts. Every username is shown one by one: up to 10 accounts go
 * about one per second; bigger runs speed up but never past ~10 names per second,
 * so each name stays readable. The first few are a little slower to ease in.
 */
function intervalFor(total: number, i: number) {
  const base = total <= 10 ? 1000 : Math.max(95, 1000 * Math.pow(10 / total, 0.45));
  return base * (1 + 0.9 * Math.exp(-i / 3));
}

function formatLeft(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${Math.max(1, s)} s left`;
  const m = Math.round(s / 60);
  return `about ${m} min left`;
}

/** Random usernames without repeats: partial Fisher–Yates over the 10,000-name list. */
function sampleNames(all: string[], n: number) {
  const a = all.slice();
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const j = k + randomIndex(a.length - k);
    [a[k], a[j]] = [a[j], a[k]];
    out.push(a[k]);
  }
  return out;
}

export function OctopusSequence({ count, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>('prepare');
  const [done, setDone] = useState(0);
  const [feed, setFeed] = useState<Account[]>([]);
  const [current, setCurrent] = useState<Account | null>(null);
  const [confettiOn, setConfettiOn] = useState(false);
  const names = useRef<string[]>([]);
  const pool = useRef<Outfit[]>([]);
  const index = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const finished = useRef(false);
  const progress = useMotionValue(0);
  const ring = useTransform(progress, (v) => v);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  }, [onFinished]);

  // Prepare: load the username list and a first batch of skins (popularity-weighted).
  useEffect(() => {
    let cancelled = false;
    const loadSkin = () =>
      pickRandomOutfit()
        .then((o) => {
          if (!pool.current.some((p) => p.id === o.id)) pool.current.push(o);
        })
        .catch(() => undefined);

    (async () => {
      const mod = await import('../data/usernames.json');
      const all = (mod.default ?? mod) as unknown as string[];
      names.current = sampleNames(all, count);
      await Promise.race([
        Promise.all(Array.from({ length: Math.min(POOL_START, count) }, loadSkin)),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
      if (cancelled) return;
      setPhase('running');
      // keep growing the pool in the background so skins keep varying
      const target = Math.min(POOL_TARGET, count);
      const worker = async () => {
        while (!cancelled && pool.current.length < target) await loadSkin();
      };
      for (let w = 0; w < 2; w++) void worker();
    })();
    return () => {
      cancelled = true;
    };
  }, [count]);

  const skinFor = useCallback((i: number) => {
    const p = pool.current;
    if (!p.length) return null;
    // early accounts take fresh skins in order; later ones draw from the (weighted) pool
    return i < p.length ? p[i] : p[randomIndex(p.length)];
  }, []);

  // Running: one account at a time.
  useEffect(() => {
    if (phase !== 'running') return;
    const step = () => {
      const i = index.current;
      if (i >= count) {
        setPhase('burst');
        return;
      }
      const outfit = skinFor(i);
      if (!outfit) {
        timer.current = window.setTimeout(step, 150);
        return;
      }
      const acc: Account = { i, username: names.current[i], level: randomLevel(), outfit };
      index.current = i + 1;
      setCurrent(acc);
      setFeed((f) => [acc, ...f].slice(0, FEED_SIZE));
      setDone(i + 1);
      grantTick((i + 1) / count);
      timer.current = window.setTimeout(step, intervalFor(count, i));
    };
    timer.current = window.setTimeout(step, 450);
    return () => clearTimeout(timer.current);
  }, [phase, count, skinFor]);

  useEffect(() => {
    const a = animate(progress, done / count, { duration: 0.35, ease: ease.out });
    return () => a.stop();
  }, [done, count, progress]);

  // Burst → complete → home
  useEffect(() => {
    if (phase === 'burst') {
      sfx.burst();
      void success();
      setConfettiOn(true);
      const c = window.setTimeout(() => setConfettiOn(false), 2600);
      const t = window.setTimeout(() => setPhase('complete'), 1100);
      return () => {
        clearTimeout(c);
        clearTimeout(t);
      };
    }
    if (phase === 'complete') {
      const s = window.setTimeout(() => sfx.complete(), 120);
      const t = window.setTimeout(finish, RETURN_MS);
      return () => {
        clearTimeout(s);
        clearTimeout(t);
      };
    }
  }, [phase, finish]);

  function skip() {
    if (phase !== 'running') return;
    sfx.tap();
    clearTimeout(timer.current);
    // fill in the remaining accounts instantly and show the last few in the feed
    const last: Account[] = [];
    for (let i = Math.max(index.current, count - FEED_SIZE); i < count; i++) {
      const outfit = skinFor(i) ?? pool.current[0];
      if (outfit) last.unshift({ i, username: names.current[i], level: randomLevel(), outfit });
    }
    index.current = count;
    if (last.length) {
      setFeed((f) => [...last, ...f].slice(0, FEED_SIZE));
      setCurrent(last[0]);
    }
    setDone(count);
    setPhase('burst');
  }

  const interval = intervalFor(count, done);
  const swap = Math.min(0.32, (interval / 1000) * 0.7); // card swap must finish before the next one
  const left = phase === 'running' ? (count - done) * intervalFor(count, done + 10) : 0;
  const complete = phase === 'complete';

  const confetti = useMemo(() => {
    const colors = ['#1f8ef1', '#0b5fd6', '#ffffff', '#5cc8ff', '#fff3b0'];
    return Array.from({ length: 46 }, (_, i) => {
      const a = (i / 46) * Math.PI * 2 + (i % 3) * 0.21;
      const d = 140 + ((i * 53) % 190);
      return {
        key: i,
        color: colors[i % colors.length],
        w: 6 + (i % 4) * 2,
        h: i % 3 === 0 ? 6 + (i % 4) * 2 : 12 + (i % 5) * 2,
        round: i % 4 === 0,
        x: Math.cos(a) * d,
        y: Math.sin(a) * d * 0.8 - 60,
        fall: 260 + ((i * 37) % 220),
        r1: (i % 2 ? 1 : -1) * (180 + ((i * 41) % 360)),
        r2: (i % 2 ? 1 : -1) * (540 + ((i * 29) % 360)),
        delay: (i % 6) * 0.025,
      };
    });
  }, []);

  return (
    <motion.div
      className={`reward octo-run phase-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label="Giving Pirate Tokens"
      initial="hidden"
      animate="show"
      exit="exit"
      onClick={complete ? finish : undefined}
    >
      <motion.div
        className="reward__scrim"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { duration: 0.6, ease: ease.out } },
          exit: { opacity: 0, transition: { duration: 0.7, ease: ease.inOut } },
        }}
      />
      <motion.div
        className="reward__rays-wrap"
        animate={{ scale: phase === 'burst' ? [1, 1.25, 1.1] : 1 }}
        transition={{ duration: 0.9, ease: ease.out }}
      >
        <motion.div
          className="reward__rays"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 1.4, delay: 0.3 } }, exit: { opacity: 0 } }}
        />
      </motion.div>

      <motion.div
        className="octo-stage"
        variants={{ hidden: {}, show: {}, exit: { opacity: 0, scale: 0.96, transition: { duration: 0.6, ease: ease.inOut } } }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!complete ? (
            <motion.div
              key="run"
              className="octo-run__body"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.out } }}
              exit={{ opacity: 0, y: -16, transition: { duration: 0.3, ease: ease.in } }}
            >
              <div className="octo-head">
                <div className="octo-head__token">
                  <svg className="ring octo-ring" viewBox="0 0 200 200" aria-hidden="true">
                    <circle className="ring__track" cx="100" cy="100" r="92" />
                    <motion.circle className="ring__bar" cx="100" cy="100" r="92" style={{ pathLength: ring }} />
                  </svg>
                  <motion.div
                    className="octo-head__logo"
                    animate={phase === 'burst' ? { scale: [1, 1.22, 1], rotateY: [0, 360] } : { scale: 1 }}
                    transition={{ duration: 0.9, ease: ease.emphasized }}
                  >
                    <Token className="token--reward" glow float={phase !== 'burst'} />
                  </motion.div>
                </div>
                <div className="octo-head__text">
                  <span className="octo-head__eyebrow">
                    <OctopusIcon /> {phase === 'prepare' ? 'Getting ready' : phase === 'burst' ? 'All done' : 'Giving Pirate Tokens'}
                  </span>
                  <span className="octo-head__count">
                    <span>{done.toLocaleString()}</span>
                    <small> / {count.toLocaleString()}</small>
                  </span>
                  <span className="octo-head__eta">{phase === 'running' && count > 10 ? formatLeft(left) : ' '}</span>
                </div>
              </div>

              {/* the account receiving a token right now */}
              <div className="octo-current">
                <AnimatePresence mode="popLayout" initial={false}>
                  {current && (
                    <motion.div
                      key={current.i}
                      className="octo-card-now"
                      initial={{ opacity: 0, x: 60, scale: 0.96 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -50, scale: 0.94, transition: { duration: swap * 0.55, ease: ease.in } }}
                      transition={{ duration: swap, ease: ease.out, delay: swap * 0.25 }}
                    >
                      <span className="octo-card-now__avatar">
                        <img src={current.outfit.image} alt="" draggable={false} />
                      </span>
                      <span className="octo-card-now__text">
                        <span className="octo-card-now__name">{current.username}</span>
                        <span className="octo-card-now__level">Level {current.level}</span>
                      </span>
                      <motion.span
                        className="octo-card-now__token"
                        initial={{ opacity: 0, y: -70, scale: 0.4, rotate: -40 }}
                        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                        transition={{ duration: Math.min(0.45, swap * 1.4), ease: ease.out, delay: swap * 0.3 }}
                      >
                        <img src={logoSmallUrl} alt="" draggable={false} />
                        <motion.span
                          className="octo-card-now__check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ ...spring.pop, delay: Math.min(0.4, swap * 1.2) }}
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M6 12.5l4 4L18 8" />
                          </svg>
                        </motion.span>
                      </motion.span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* everyone who just got one */}
              <ol className="octo-feed" aria-live="off">
                {feed.slice(1).map((a, k) => (
                  <li key={a.i} className="octo-row" style={{ opacity: 1 - k * 0.13 }}>
                    <span className="octo-row__avatar">
                      <img src={a.outfit.image} alt="" loading="lazy" draggable={false} />
                    </span>
                    <span className="octo-row__name">{a.username}</span>
                    <span className="octo-row__level">Lv {a.level}</span>
                    <span className="octo-row__got">
                      <img src={logoSmallUrl} alt="" draggable={false} />
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 12.5l4 4L18 8" />
                      </svg>
                    </span>
                  </li>
                ))}
              </ol>

              <button type="button" className="ghost-btn octo-skip" onClick={skip} disabled={phase !== 'running'}>
                Skip
              </button>
            </motion.div>
          ) : (
            <motion.div key="complete" className="complete octo-complete" variants={stagger(0.08, 0.1)} initial="hidden" animate="show">
              <motion.div variants={fadeUp} className="octo-complete__token">
                <Token className="token--reward" glow sheen />
              </motion.div>
              <motion.h2
                className="complete__title"
                variants={{
                  hidden: { opacity: 0, scale: 1.7 },
                  show: { opacity: 1, scale: 1, transition: { ...spring.pop, opacity: { duration: 0.2, ease: ease.out } } },
                }}
              >
                Pirate Tokens <span>complete</span>
              </motion.h2>
              <motion.div variants={fadeUp} className="summary octo-summary">
                <span className="octo-summary__icon">
                  <OctopusIcon />
                </span>
                <span className="summary__text">
                  <span className="summary__name">{count.toLocaleString()} accounts</span>
                  <span className="summary__level">Every account got a Pirate Token</span>
                </span>
                <span className="summary__token">
                  <img src={logoSmallUrl} alt="" draggable={false} />
                  <span>×{count.toLocaleString()}</span>
                </span>
              </motion.div>
              <motion.div variants={fadeUp} className="return-bar" aria-hidden="true">
                <span className="is-running" style={{ animationDuration: `${RETURN_MS}ms` }} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {confettiOn && (
        <div className="confetti" aria-hidden="true">
          {confetti.map((c) => (
            <span
              key={c.key}
              className="confetti__piece"
              style={
                {
                  width: c.w,
                  height: c.h,
                  background: c.color,
                  borderRadius: c.round ? '50%' : '2px',
                  animationDelay: `${c.delay}s`,
                  '--x': `${c.x}px`,
                  '--y': `${c.y}px`,
                  '--fall': `${c.fall}px`,
                  '--r1': `${c.r1}deg`,
                  '--r2': `${c.r2}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
