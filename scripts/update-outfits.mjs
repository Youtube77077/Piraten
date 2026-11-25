// Refreshes src/data/outfits.json from fortnite-api.com (community Fortnite cosmetics database).
// Usage: npm run update:outfits
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://fortnite-api.com/v2/cosmetics/br/search/all?type=outfit&language=en';
const OUT = fileURLToPath(new URL('../src/data/outfits.json', import.meta.url));
const META = fileURLToPath(new URL('../src/data/outfits-meta.json', import.meta.url));

// Placeholder / internal entries that are not real, wearable outfits.
// "null" (lowercase) is a placeholder; "Null" is a real outfit, so that one check is case-sensitive.
const BAD_NAMES = new Set(['', 'tbd', 'npc', 'none', 'placeholder']);
const isPlaceholderName = (name) => name === 'null' || BAD_NAMES.has(name.toLowerCase());

export function isUsableOutfit(item) {
  if (!item || item.type?.value !== 'outfit') return false;
  const name = (item.name ?? '').trim();
  if (isPlaceholderName(name)) return false;
  if (/(^|_)npc(_|$)/i.test(item.id)) return false;
  const img = item.images ?? {};
  return Boolean(img.icon || img.smallIcon);
}

async function main() {
  const res = await fetch(ENDPOINT, { headers: { 'user-agent': 'piraten-data-updater' } });
  if (!res.ok) throw new Error(`fortnite-api responded ${res.status}`);
  const body = await res.json();
  if (body.status !== 200 || !Array.isArray(body.data)) throw new Error('Unexpected response shape');

  const seen = new Set();
  const outfits = [];
  for (const item of body.data) {
    if (!isUsableOutfit(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    // [id, name, imageKind]  imageKind 0 = full icon available, 1 = small icon only
    outfits.push([item.id, item.name.trim(), item.images.icon ? 0 : 1]);
  }
  outfits.sort((a, b) => a[0].localeCompare(b[0]));
  if (outfits.length < 1000) throw new Error(`Only ${outfits.length} outfits — refusing to overwrite`);

  const meta = { source: 'fortnite-api.com', updated: new Date().toISOString(), count: outfits.length };
  await writeFile(OUT, JSON.stringify({ ...meta, outfits }).replace(/\],\[/g, '],\n['));
  await writeFile(META, JSON.stringify(meta, null, 2) + '\n');
  console.log(`Wrote ${outfits.length} outfits to src/data/outfits.json`);
  await import('./build-odds.mjs'); // re-apply the popularity odds to the refreshed list
}

main().catch((err) => { console.error(err.message); process.exit(1); });
