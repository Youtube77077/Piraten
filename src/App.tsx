import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import outfitMeta from './data/outfits-meta.json';
import { Background } from './components/Background';
import { IntroScreen } from './components/IntroScreen';
import { Menu } from './components/Menu';
import { ProfileScreen } from './components/ProfileScreen';
import { RewardSequence } from './components/RewardSequence';
import { loadOutfits, markOutfitFailed, outfitCount, prepareNextOutfit, takeRandomOutfit, type Outfit } from './lib/outfits';
import { tap } from './lib/native';
import { randomLevel } from './lib/random';
import { addRecent, readRecent, saveRecent, type RecentAccount } from './lib/recent';
import { useSettings } from './lib/settings';
import { sfx } from './lib/sound';

type Stage = 'intro' | 'profile' | 'reward';

interface Session {
  username: string;
  level: number;
  outfit: Outfit;
}

const MIN_SEARCH_MS = 1100; // long enough for the loading state to read as intentional

export default function App() {
  const [stage, setStage] = useState<Stage>('intro');
  const [session, setSession] = useState<Session | null>(null);
  const [prefill, setPrefill] = useState('');
  const [introKey, setIntroKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent, setRecent] = useState<RecentAccount[]>(readRecent);
  const [settings, updateSettings] = useSettings();
  const [count, setCount] = useState(outfitMeta.count);
  const lastOutfit = useRef<string | undefined>(undefined);

  useEffect(() => {
    loadOutfits()
      .then(() => {
        prepareNextOutfit();
        setCount(outfitCount());
      })
      .catch(() => undefined);
  }, []);

  const findAccount = useCallback(async (username: string) => {
    void tap('LIGHT');
    sfx.search();
    const started = performance.now();
    const outfit = await takeRandomOutfit(lastOutfit.current);
    lastOutfit.current = outfit.id;
    const wait = MIN_SEARCH_MS - (performance.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    setSession({ username, level: randomLevel(), outfit });
    sfx.found();
    await new Promise((r) => setTimeout(r, 260)); // let the "Found" state register
    setStage('profile');
  }, []);

  const swapBrokenOutfit = useCallback(async () => {
    if (!session) return;
    markOutfitFailed(session.outfit.id);
    try {
      const outfit = await takeRandomOutfit(session.outfit.id);
      lastOutfit.current = outfit.id;
      setSession({ ...session, outfit });
    } catch {
      /* leave as is */
    }
  }, [session]);

  const grant = useCallback(() => {
    void tap('MEDIUM');
    setStage('reward');
  }, []);

  /** Back to the start screen. `keepName` pre-fills the field (used by "Change name"). */
  const goHome = useCallback(
    (keepName: boolean) => {
      setPrefill(keepName && session ? session.username : '');
      setIntroKey((k) => k + 1);
      setStage('intro');
    },
    [session],
  );

  const rewardFinished = useCallback(() => {
    if (session) setRecent((list) => addRecent(list, { ...session, at: Date.now() }));
    sfx.home();
    goHome(false);
  }, [session, goHome]);

  const openRecent = useCallback((entry: RecentAccount) => {
    setMenuOpen(false);
    lastOutfit.current = entry.outfit.id;
    setSession({ username: entry.username, level: entry.level, outfit: entry.outfit });
    window.setTimeout(() => setStage('profile'), 200);
  }, []);

  const motionMode = settings.motion === 'full' ? 'never' : settings.motion === 'reduced' ? 'always' : 'user';

  return (
    <MotionConfig reducedMotion={motionMode}>
      <Background dimmed={stage === 'reward'} />
      <LayoutGroup>
        <motion.main className="app" layoutScroll aria-hidden={menuOpen}>
          <AnimatePresence mode="popLayout">
            {stage === 'intro' && (
              <IntroScreen key={`intro-${introKey}`} initialName={prefill} onSubmit={findAccount} />
            )}
            {stage !== 'intro' && session && (
              <ProfileScreen
                key={`profile-${session.username}-${session.outfit.id}`}
                username={session.username}
                level={session.level}
                outfit={session.outfit}
                behind={stage === 'reward'}
                onGrant={grant}
                onBack={() => {
                  void tap('LIGHT');
                  goHome(true);
                }}
                onImageError={swapBrokenOutfit}
              />
            )}
          </AnimatePresence>
        </motion.main>
        <AnimatePresence>
          {stage === 'reward' && session && (
            <RewardSequence
              key="reward"
              username={session.username}
              level={session.level}
              outfit={session.outfit}
              onFinished={rewardFinished}
            />
          )}
        </AnimatePresence>
      </LayoutGroup>
      <Menu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        enabled={stage !== 'reward'}
        settings={settings}
        onSettings={updateSettings}
        recent={recent}
        onClearRecent={() => {
          setRecent([]);
          saveRecent([]);
        }}
        onOpenRecent={openRecent}
        onHome={() => {
          setMenuOpen(false);
          if (stage !== 'intro') goHome(false);
        }}
        outfitCount={count}
        databaseUpdated={outfitMeta.updated}
      />
    </MotionConfig>
  );
}
