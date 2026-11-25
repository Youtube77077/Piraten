import { useCallback, useEffect, useState } from 'react';

export type MotionPref = 'system' | 'full' | 'reduced';

export interface Settings {
  motion: MotionPref;
  effects: boolean;
  haptics: boolean;
}

const KEY = 'pt.settings.v1';
const DEFAULTS: Settings = { motion: 'system', effects: true, haptics: true };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Current value for non-React code (haptics). */
let current: Settings = read();
export const getSettings = () => current;

function apply(s: Settings) {
  const root = document.documentElement;
  root.classList.toggle('motion-reduced', s.motion === 'reduced');
  root.classList.toggle('motion-full', s.motion === 'full');
  root.classList.toggle('fx-off', !s.effects);
}
apply(current);

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(current);
  useEffect(() => {
    current = settings;
    apply(settings);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable — settings last for this session only */
    }
  }, [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  return [settings, update] as const;
}
