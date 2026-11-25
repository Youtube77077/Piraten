/**
 * Outfit data layer.
 *  - The full outfit list ships with the app (src/data/outfits.json, refreshed by
 *    `npm run update:outfits`), so picking an outfit never waits on the network.
 *  - Outfits released after the last build are merged in from fortnite-api.com's
 *    "new cosmetics" feed in the background and remembered locally.
 *  - Icons are served from fortnite-api.com's CDN (long-lived cache headers) and are
 *    preloaded + decoded before they are shown, so a broken image is never revealed.
 */
export interface Outfit {
  id: string;
  name: string;
  image: string;
}

import { randomFloat } from './random';

type Row = [id: string, name: string, kind: 0 | 1];

const IMG_BASE = 'https://fortnite-api.com/images/cosmetics/br/';
const NEW_FEED = 'https://fortnite-api.com/v2/cosmetics/new?language=en';
const EXTRA_KEY = 'pt.extraOutfits.v1';
const BAD_NAMES = new Set(['', 'tbd', 'npc', 'none', 'placeholder']);
const isPlaceholderName = (name: string) => name === 'null' || BAD_NAMES.has(name.toLowerCase());

const imageFor = (id: string, kind: 0 | 1) =>
  `${IMG_BASE}${id.toLowerCase()}/${kind === 0 ? 'icon' : 'smallicon'}.png`;

let outfits: Outfit[] = [];
let loading: Promise<Outfit[]> | null = null;

/**
 * Popularity odds (src/data/outfit-odds.json, built from scripts/outfit-odds.tsv):
 * a skin's chance of being picked is proportional to its weight. Skins without a
 * weight (including ones added after the list was made) are never picked.
 */
let weights: Record<string, number> = {};
let pool: Outfit[] = [];
let cumulative: number[] = [];
let totalWeight = 0;

function rebuildPool() {
  pool = [];
  cumulative = [];
  totalWeight = 0;
  for (const o of outfits) {
    const w = weights[o.id];
    if (!w || w <= 0) continue;
    totalWeight += w;
    pool.push(o);
    cumulative.push(totalWeight);
  }
}

/** Weighted random pick: binary search the cumulative weights. */
function weightedPick(): Outfit | undefined {
  if (!pool.length) return undefined;
  const r = randomFloat() * totalWeight;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] > r) hi = mid;
    else lo = mid + 1;
  }
  return pool[lo];
}

export const pickChance = (id: string) => (totalWeight ? (weights[id] ?? 0) / totalWeight : 0);
const failed = new Set<string>();

function readExtras(): Row[] {
  try {
    const raw = localStorage.getItem(EXTRA_KEY);
    return raw ? (JSON.parse(raw) as Row[]) : [];
  } catch {
    return [];
  }
}

function writeExtras(rows: Row[]) {
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(rows));
  } catch {
    /* storage unavailable (private mode etc.) — extras just aren't remembered */
  }
}

function addRows(rows: Row[]) {
  const known = new Set(outfits.map((o) => o.id));
  for (const [id, name, kind] of rows) {
    if (!known.has(id)) {
      outfits.push({ id, name, image: imageFor(id, kind) });
      known.add(id);
    }
  }
}

interface ApiItem {
  id: string;
  name?: string;
  type?: { value?: string };
  images?: { icon?: string | null; smallIcon?: string | null };
}

/** Background refresh: pull outfits added since this build shipped. */
async function mergeNewOutfits() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(NEW_FEED, { signal: ctrl.signal });
    if (!res.ok) return;
    const body = await res.json();
    const items: ApiItem[] = body?.data?.items?.br ?? [];
    const rows: Row[] = items
      .filter(
        (i) =>
          i?.type?.value === 'outfit' &&
          !isPlaceholderName((i.name ?? '').trim()) &&
          !/(^|_)npc(_|$)/i.test(i.id) &&
          (i.images?.icon || i.images?.smallIcon),
      )
      .map((i) => [i.id, (i.name ?? '').trim(), i.images?.icon ? 0 : 1]);
    if (!rows.length) return;
    const merged = new Map(readExtras().map((r) => [r[0], r]));
    rows.forEach((r) => merged.set(r[0], r));
    const all = [...merged.values()].slice(-400);
    writeExtras(all);
    addRows(all);
  } catch {
    /* offline or API down — the bundled database is complete on its own */
  } finally {
    clearTimeout(timer);
  }
}

export function loadOutfits(): Promise<Outfit[]> {
  if (!loading) {
    loading = Promise.all([import('../data/outfits.json'), import('../data/outfit-odds.json')]).then(([mod, oddsMod]) => {
      const data = (mod.default ?? mod) as unknown as { outfits: Row[] };
      weights = (oddsMod.default ?? oddsMod) as Record<string, number>;
      outfits = data.outfits.map(([id, name, kind]) => ({ id, name, image: imageFor(id, kind) }));
      addRows(readExtras());
      rebuildPool();
      void mergeNewOutfits();
      return outfits;
    });
  }
  return loading;
}

export const outfitCount = () => outfits.length;

/** Resolves once the image is downloaded and decoded; rejects on error/timeout. */
export function preloadImage(src: string, timeoutMs = 9000): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error('timeout'));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      (img.decode ? img.decode() : Promise.resolve()).then(resolve, resolve);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('image failed'));
    };
    img.src = src;
  });
}

/**
 * Picks a random outfit, weighted by popularity, whose icon actually loads.
 * Outfits whose image fails are skipped and another is drawn.
 */
export async function pickRandomOutfit(excludeId?: string, attempts = 8): Promise<Outfit> {
  const list = await loadOutfits();
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    if (!list.length) break;
    const candidate = weightedPick();
    if (!candidate || candidate.id === excludeId || failed.has(candidate.id)) continue;
    try {
      await preloadImage(candidate.image);
      return candidate;
    } catch (err) {
      failed.add(candidate.id);
      lastError = err;
    }
  }
  throw lastError ?? new Error('No outfit image could be loaded');
}

export function markOutfitFailed(id: string) {
  failed.add(id);
}

/**
 * Keeps one random, already-decoded outfit ready so the reveal is instant.
 * Because the prepared outfit is itself a weighted random draw, this does not change the odds.
 */
let prepared: Promise<Outfit> | null = null;

export function prepareNextOutfit(excludeId?: string) {
  prepared = pickRandomOutfit(excludeId);
  prepared.catch(() => {
    prepared = null;
  });
}

export async function takeRandomOutfit(excludeId?: string): Promise<Outfit> {
  const ready = prepared;
  prepared = null;
  let outfit: Outfit | null = null;
  if (ready) {
    try {
      outfit = await ready;
    } catch {
      outfit = null;
    }
  }
  if (!outfit || outfit.id === excludeId) outfit = await pickRandomOutfit(excludeId);
  prepareNextOutfit(outfit.id);
  return outfit;
}
