import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isNative } from '../lib/native';
import { sfx } from '../lib/sound';
import type { RecentAccount } from '../lib/recent';
import type { MotionPref, Settings } from '../lib/settings';
import { duration, ease, spring } from '../motion';
import logoSmallUrl from '../assets/brand/logo-256.webp';

type View = 'menu' | 'recent' | 'settings';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Swipe/button are disabled while the reward sequence plays. */
  enabled: boolean;
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  recent: RecentAccount[];
  onClearRecent: () => void;
  onOpenRecent: (entry: RecentAccount) => void;
  onHome: () => void;
  outfitCount: number;
  databaseUpdated: string;
}

const PANEL_MAX = 360;
const panelWidth = () => Math.min(window.innerWidth * 0.86, PANEL_MAX);

export function Menu(props: Props) {
  const { open, onOpenChange, enabled } = props;
  const [view, setView] = useState<View>('menu');
  const width = useRef(panelWidth());
  const x = useMotionValue(-width.current - 24);
  const scrim = useTransform(x, [-width.current, 0], [0, 1]);
  const [visible, setVisible] = useState(false);

  const settle = (toOpen: boolean, velocity = 0) => {
    width.current = panelWidth();
    animate(x, toOpen ? 0 : -width.current - 24, { ...spring.smooth, velocity });
  };

  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else sfx.menu(open);
    if (open) setVisible(true);
    settle(open);
    if (!open) {
      const t = window.setTimeout(() => {
        setVisible(false);
        setView('menu');
      }, 450);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Swipe right anywhere on the left half of the screen to pull the drawer open;
  // the panel follows the finger and settles by distance or flick velocity.
  useEffect(() => {
    if (!enabled || open) return;
    let start: { x: number; y: number; t: number } | null = null;
    let dragging = false;

    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (e.button !== 0 || target.closest('input, textarea, [data-no-swipe]')) return;
      if (e.clientX > window.innerWidth * 0.5) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      dragging = false;
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
          start = null;
          return;
        }
        if (dx > 14 && dx > Math.abs(dy) * 1.3) {
          dragging = true;
          width.current = panelWidth();
          setVisible(true);
        } else return;
      }
      x.set(Math.min(0, -width.current - 24 + dx));
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const v = dx / Math.max(1, performance.now() - start.t); // px/ms
      if (dragging) {
        const shouldOpen = dx > width.current * 0.35 || v > 0.5;
        if (shouldOpen) onOpenChange(true);
        else settle(false, v * 1000);
        if (!shouldOpen) window.setTimeout(() => setVisible(false), 450);
      }
      start = null;
      dragging = false;
    };
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const onPanelDragEnd = (_: unknown, info: PanInfo) => {
    const close = info.offset.x < -width.current * 0.3 || info.velocity.x < -400;
    if (close) onOpenChange(false);
    else settle(true, info.velocity.x);
  };

  return (
    <>
      <motion.button
        type="button"
        className="menu-btn"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => onOpenChange(true)}
        animate={{ opacity: enabled && !open ? 1 : 0, pointerEvents: enabled && !open ? 'auto' : 'none' }}
        transition={{ duration: duration.short, ease: ease.out }}
        whileTap={{ scale: 0.9 }}
      >
        <span />
        <span />
        <span />
      </motion.button>

      {visible && (
        <div className="drawer-root">
          <motion.div className="drawer-scrim" style={{ opacity: scrim }} onClick={() => onOpenChange(false)} />
          <motion.aside
            className="drawer"
            style={{ x, width: width.current }}
            drag={open ? 'x' : false}
            dragConstraints={{ left: -width.current - 24, right: 0 }}
            dragElastic={{ left: 0, right: 0.04 }}
            dragMomentum={false}
            onDragEnd={onPanelDragEnd}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            data-no-swipe
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {view === 'menu' && (
                <Pane key="menu" back={false}>
                  <DrawerHeader onClose={() => onOpenChange(false)} />
                  <nav className="drawer__nav">
                    <NavRow icon={<HomeIcon />} label="Home" onClick={props.onHome} />
                    <NavRow
                      icon={<ClockIcon />}
                      label="Recent"
                      badge={props.recent.length || undefined}
                      onClick={() => setView('recent')}
                      chevron
                    />
                    <NavRow icon={<GearIcon />} label="Settings" onClick={() => setView('settings')} chevron />
                  </nav>
                  <p className="drawer__foot">Version 1.0.0</p>
                </Pane>
              )}
              {view === 'recent' && (
                <Pane key="recent" back>
                  <SubHeader title="Recent" onBack={() => setView('menu')} />
                  <RecentList {...props} />
                </Pane>
              )}
              {view === 'settings' && (
                <Pane key="settings" back>
                  <SubHeader title="Settings" onBack={() => setView('menu')} />
                  <SettingsView {...props} />
                </Pane>
              )}
            </AnimatePresence>
          </motion.aside>
        </div>
      )}
    </>
  );
}

/* ---------- pieces ---------- */

function Pane({ children, back }: { children: ReactNode; back: boolean }) {
  return (
    <motion.div
      className="drawer__pane"
      initial={{ x: back ? '100%' : '-30%', opacity: back ? 1 : 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: back ? '100%' : '-30%', opacity: back ? 1 : 0 }}
      transition={{ duration: 0.42, ease: ease.emphasized }}
    >
      {children}
    </motion.div>
  );
}

function DrawerHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="drawer__header">
      <img src={logoSmallUrl} alt="" className="drawer__logo" draggable={false} />
      <span className="drawer__title">Pirate Token</span>
      <button type="button" className="icon-btn" aria-label="Close menu" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="drawer__header drawer__header--sub">
      <button type="button" className="back-btn" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 6l-6 6 6 6" />
        </svg>
        Menu
      </button>
      <span className="drawer__title">{title}</span>
    </div>
  );
}

function NavRow({
  icon,
  label,
  onClick,
  badge,
  chevron,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
  chevron?: boolean;
}) {
  return (
    <motion.button
      type="button"
      className="nav-row"
      onClick={() => {
        sfx.tap();
        onClick();
      }}
      whileTap={{ scale: 0.98 }} transition={spring.snappy}>
      <span className="nav-row__icon">{icon}</span>
      <span className="nav-row__label">{label}</span>
      {badge !== undefined && <span className="nav-row__badge">{badge}</span>}
      {chevron && (
        <svg className="nav-row__chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.5 6l6 6-6 6" />
        </svg>
      )}
    </motion.button>
  );
}

function timeAgo(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function RecentList({ recent, onOpenRecent, onClearRecent }: Props) {
  if (!recent.length) {
    return <p className="drawer__empty">Accounts you grant a Pirate Token to will show up here.</p>;
  }
  return (
    <div className="drawer__scroll">
      <ul className="recent">
        {recent.map((r) => (
          <li key={r.username + r.at}>
            <button type="button" className="recent__row" onClick={() => onOpenRecent(r)}>
              <span className="recent__avatar">
                <img src={r.outfit.image} alt="" loading="lazy" draggable={false} />
              </span>
              <span className="recent__text">
                <span className="recent__name">{r.username}</span>
                <span className="recent__meta">
                  Level {r.level} · {timeAgo(r.at)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="text-btn" onClick={onClearRecent}>
        Clear recent
      </button>
    </div>
  );
}

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      <motion.span className="switch__knob" layout transition={spring.snappy} />
    </button>
  );
}

const MOTION_OPTIONS: { value: MotionPref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
];

function SettingsView({ settings, onSettings, outfitCount, databaseUpdated, recent, onClearRecent }: Props) {
  const updated = new Date(databaseUpdated);
  const updatedText = Number.isNaN(updated.getTime())
    ? 'unknown'
    : updated.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="drawer__scroll">
      <section className="set-group">
        <h3 className="set-group__title">Experience</h3>
        <div className="set-row set-row--stack">
          <span className="set-row__label">Motion</span>
          <div className="segmented" role="radiogroup" aria-label="Motion">
            {MOTION_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={settings.motion === o.value}
                className={`segmented__opt ${settings.motion === o.value ? 'is-active' : ''}`}
                onClick={() => onSettings({ motion: o.value })}
              >
                {settings.motion === o.value && (
                  <motion.span layoutId="seg-pill" className="segmented__pill" transition={spring.snappy} />
                )}
                <span className="segmented__text">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <span className="set-row__label">
            Background effects
            <small>Light rays and floating particles</small>
          </span>
          <Toggle label="Background effects" checked={settings.effects} onChange={(v) => onSettings({ effects: v })} />
        </div>
        <div className="set-row">
          <span className="set-row__label">
            Sound effects
            <small>Clicks, whooshes and the reward fanfare</small>
          </span>
          <Toggle label="Sound effects" checked={settings.sound} onChange={(v) => onSettings({ sound: v })} />
        </div>
        <div className="set-row">
          <span className="set-row__label">
            Haptics
            <small>{isNative ? 'Vibration feedback on taps' : 'Available in the iPhone app'}</small>
          </span>
          <Toggle label="Haptics" checked={settings.haptics && isNative} disabled={!isNative} onChange={(v) => onSettings({ haptics: v })} />
        </div>
      </section>

      <section className="set-group">
        <h3 className="set-group__title">Data</h3>
        <div className="set-row">
          <span className="set-row__label">
            Outfit database
            <small>
              {outfitCount.toLocaleString()} outfits · updated {updatedText}
            </small>
          </span>
        </div>
        <div className="set-row">
          <span className="set-row__label">
            Recent accounts
            <small>{recent.length} saved on this device</small>
          </span>
          <button type="button" className="text-btn text-btn--inline" onClick={onClearRecent} disabled={!recent.length}>
            Clear
          </button>
        </div>
      </section>

      <section className="set-group">
        <h3 className="set-group__title">Disclaimers</h3>
        <ul className="disclaimers">
          <li>
            <strong>Unofficial fan project.</strong> Not affiliated with, endorsed, sponsored or approved by Epic Games,
            Inc. Fortnite and related names and artwork are trademarks of Epic Games, Inc.
          </li>
          <li>
            <strong>Simulated experience.</strong> The Pirate Token is a visual demonstration only. Nothing is granted,
            purchased, unlocked or added to any Fortnite or Epic Games account.
          </li>
          <li>
            <strong>No account access.</strong> The app never asks for passwords or sign-ins and never connects to any
            Epic Games account. Usernames are not looked up or verified.
          </li>
          <li>
            <strong>Random results.</strong> Outfits are picked at random from a public cosmetics database and do not
            reflect what an account actually owns. Account levels are randomly generated, not real stats.
          </li>
          <li>
            <strong>Your data stays on your device.</strong> Usernames you enter and your recent list are stored only on
            this device and are never sent anywhere.
          </li>
          <li>
            <strong>Outfit data &amp; images</strong> are provided by the community-run fortnite-api.com.
          </li>
        </ul>
      </section>

      <p className="drawer__foot">Pirate Token · Version 1.0.0</p>
    </div>
  );
}

/* ---------- icons ---------- */
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
const GearIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" />
  </svg>
);
