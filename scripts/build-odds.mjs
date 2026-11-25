// Turns scripts/outfit-odds.tsv (name → pick count) into src/data/outfit-odds.json (outfit id → weight).
// A skin's chance of being picked is proportional to its count; skins with no count are never picked.
// When the database has several entries with the same name, the weight is split evenly between them.
// Usage: npm run build:odds   (also runs automatically after npm run update:outfits)
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TSV = fileURLToPath(new URL('./outfit-odds.tsv', import.meta.url));
const OUTFITS = fileURLToPath(new URL('../src/data/outfits.json', import.meta.url));
const OUT = fileURLToPath(new URL('../src/data/outfit-odds.json', import.meta.url));

const norm = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function parseCount(raw) {
  const m = /^([\d.]+)\s*([KM]?)$/i.exec(raw.trim());
  if (!m) throw new Error(`Bad count "${raw}"`);
  const mult = { '': 1, K: 1e3, M: 1e6 }[m[2].toUpperCase()];
  return Math.round(parseFloat(m[1]) * mult);
}

const lines = (await readFile(TSV, 'utf8')).split('\n').filter((l) => l.trim() && !l.startsWith('#'));
const odds = lines.map((l) => {
  const [name, count] = l.split('\t');
  return { name, count: parseCount(count) };
});

const { outfits } = JSON.parse(await readFile(OUTFITS, 'utf8'));
const byName = new Map();
for (const [id, name] of outfits) {
  const k = norm(name);
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(id);
}
// Some list names carry an " Outfit" suffix the database doesn't (and vice versa).
const lookup = (name) => byName.get(norm(name)) ?? byName.get(norm(name.replace(/ outfit$/i, ''))) ?? byName.get(norm(`${name} Outfit`));

const weights = {};
const unmatched = [];
let total = 0;
let matchedTotal = 0;
for (const { name, count } of odds) {
  total += count;
  const ids = lookup(name);
  if (!ids) {
    unmatched.push(`${name} (${count})`);
    continue;
  }
  matchedTotal += count;
  if (count === 0) continue;
  const each = count / ids.length;
  for (const id of ids) weights[id] = Math.round(((weights[id] ?? 0) + each) * 100) / 100;
}

await writeFile(OUT, JSON.stringify(weights) + '\n');
console.log(`${odds.length} names in list → ${Object.keys(weights).length} outfit entries with odds`);
console.log(`matched ${odds.length - unmatched.length}/${odds.length} names (${((matchedTotal / total) * 100).toFixed(2)}% of all picks)`);
if (unmatched.length) console.log(`not in database (never picked): ${unmatched.slice(0, 40).join(', ')}${unmatched.length > 40 ? ' …' : ''}`);
