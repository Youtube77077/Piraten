import type { Outfit } from './outfits';

export interface RecentAccount {
  username: string;
  level: number;
  outfit: Outfit;
  at: number;
}

const KEY = 'pt.recent.v1';
const MAX = 20;

export function readRecent(): RecentAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentAccount[]) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: RecentAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}

export function addRecent(list: RecentAccount[], entry: RecentAccount): RecentAccount[] {
  const next = [entry, ...list.filter((r) => r.username.toLowerCase() !== entry.username.toLowerCase())].slice(0, MAX);
  saveRecent(next);
  return next;
}
