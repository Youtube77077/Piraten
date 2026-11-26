// Generates src/data/usernames.json: 10,000 unique, realistic-looking Fortnite display names.
// Follows Epic's display-name rules (3–16 chars; letters, numbers, spaces, - _ .) and the common
// patterns players use (Word+Word, Name+digits, xX..Xx, lil/its/not prefixes, TTV/YT/FN tags,
// light leetspeak, underscores). Clean word lists only; real creators/pros are excluded.
// Seeded, so the output is the same every run.  Usage: node scripts/make-usernames.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/data/usernames.json', import.meta.url));
const COUNT = 10000;

let seed = 20261126;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;

const ADJ = `Sneaky Frosty Salty Sweaty Cracked Silent Lucky Crazy Chill Toxic Sleepy Hyper Golden Shadow Dark Neon Turbo Spicy Fuzzy Wild Swift Rapid Quiet Lazy Angry Happy Savage Mighty Tiny Giant Cosmic Stormy Icy Fiery Rogue Royal Mystic Electric Rusty Shiny Glitchy Clutch Smooth Sharp Bouncy Grumpy Jolly Sly Brave Bold Cool Epic Mega Ultra Super Hidden Lost Lone Wicked Pixel Retro Vapor Sunny Misty Stealthy Rowdy Zesty Crispy Cheesy Nutty Goofy Wacky Funky Groovy Stinky Moody Sassy Feral Ghostly Atomic Solar Lunar Arctic Toasty Spooky Rebel Prime Alpha Omega Nova Blazing Frozen Hollow Scrappy Speedy Sticky Lit Basic Noble Fancy Midnight Crimson Azure Emerald Violet Scarlet Amber Onyx Silver Cobalt`.split(' ');
const NOUN = `Llama Panda Tiger Fox Wolf Shark Falcon Raven Viper Cobra Dragon Phoenix Ghost Ninja Pirate Kraken Octopus Squid Crab Lobster Banana Taco Nugget Pickle Waffle Muffin Potato Noodle Burrito Donut Cookie Bean Peanut Pretzel Sniper Builder Cranker Boxer Editor Sweat Bot Noob Goat Legend King Queen Knight Wizard Viking Samurai Ranger Hunter Scout Pilot Captain Bandit Outlaw Rider Racer Drifter Surfer Skater Gamer Player Clutcher Sniffer Bear Hawk Eagle Owl Lion Rhino Hippo Gator Frog Toad Turtle Duck Goose Penguin Otter Badger Moose Yeti Goblin Troll Zombie Robot Cyborg Alien Comet Meteor Rocket Storm Thunder Blaze Frost Ember Spark Bolt Pulse Echo Vortex Glitch Pixel Byte Chip Ace Joker Jester Baron Duke Chief Boss Sheriff Cowboy Monk Shogun Titan Golem Wraith Specter Reaper Hydra Griffin Mantis Hornet Wasp Spider Scorpion Jaguar Panther Lynx Cheetah Coyote Dingo Koala Sloth Lemur Walrus Narwhal Whale Dolphin Marlin Tuna Salmon Trout Ferret Hamster Bunny Kitten Puppy Pug Corgi Husky`.split(' ');
const NAMES = `Jayden Mason Liam Noah Ethan Aiden Lucas Logan Caleb Owen Ryan Dylan Tyler Jake Josh Matt Chris Alex Sam Max Leo Kai Eli Zach Cole Luke Nate Evan Gavin Brody Cody Kyle Jace Ryder Colton Hunter Carter Wyatt Landon Bryce Blake Chase Mia Emma Ava Lily Zoe Chloe Ella Aria Nova Luna Maya Ruby Ivy Skye Jade Riley Harper Avery Quinn Sophie Bella Layla Nora Mila Hazel Emily Grace Jamal Andre Marcus Diego Mateo Carlos Javi Luis Omar Yusuf Ali Hassan Kenji Hiro Jin Min Tae Arjun Dev Ravi Nico Theo Felix Oscar Hugo Finn Jonas Lars Erik Sven Piotr Ivan Dmitri Tomas Mateus Joao Pedro Rafa Lukas Elias Milo Remy Jules Enzo`.split(' ');
// Other languages (ASCII only — Epic display names are safest without accents).
const WORLD_WORDS = `Fuego Rapido Gato Lobo Pollo Loco Tigre Fantasma Rayo Sombra Gatinho Brabo Foguete Raio Tubarao Coruja Baguette Croissant LeChat Fromage Loup Requin Kartoffel Wurst Blitz Donner Schatten Fuchs Hund Neko Kitsune Senpai Kawaii Ninjin Ramen Sakura Ryu Tora Kuma Gyoza Mochi Pizza Gelato Lupo Fulmine Volpe Polpo Bratan Medved Volk Kotik Daebak Hangul Kimchi Simba Rafiki Jambo Chai Masala Leeuw Kanon Bjorn Ulv Vargr Hygge Sisu Kaneli Pulpo Calamar Churro Tortuga`.split(' ');
const WORLD_NAMES = `Alejandro Santiago Mateus Gabriel Vitor Thiago Camila Valentina Lucia Sofia Joaquin Pablo Javier Elena Ines Amelie Margaux Lucas Baptiste Chloe Hugo Jannik Lukas Leonie Moritz Finn Haruto Yuto Sota Yui Hina Aoi Ren Riku Minjun Seojun Jiwoo Hana Giulia Lorenzo Matteo Chiara Aleksei Nikita Sasha Olga Mehmet Emre Elif Arjun Aarav Priya Ananya Kwame Amara Tunde Lars Ingrid Astrid Mikko Aino Wiktor Zofia`.split(' ');
// Funny / meme-style handles.
const FUNNY = `Grandma Builds|Mom Get Off|Lag Wizard|Wifi Warrior|Bush Camper|Not A Bot|Free Wins Pls|Sir Lagsalot|Noob Slayer|Pro Noob|Default Dancer|Storm Victim|Chug Jug Enjoyer|Floor Is Lava|Box Fight Me|Emote Spammer|Ping 999|Low Ground Larry|Third Partied|Bus Driver Tips|Loot Goblin|Shield Potato|Slurp Addict|No Mats Matt|One Pump Wonder|Cheese Wizard|Sweaty Sock|Nap Time Ned|Snack Break|Homework Later|Bed Time Boxer|Cereal Sniper|Toaster Gamer|Big Head Mode|Banana Phone|Duck Commander|Goose On Ice|Pizza Delivery|Couch Commando|Ctrl Alt Defeat|Pls Dont Snipe|I Heal You|Revive Me Pls|Crouch Walker|Dance Then Die|Low Health Hero|Llama Whisperer|Pickaxe Only|Tilted Again|Spam Builder|Ghost Peeker|Lucky Noob|Lag Is Real|Sweat Detected|Bot Lobby King|Victory Royale-ish|Built Different|Not Sweating|Chicken Strips|Noodle Arms|Turtle Mode|Snail Sprint|Missed Again|Oops All Edits`.split('|');
const TERMS = `Builds Edits Clips Plays Gaming Games FN Boxes Cranks Snipes Wins Dubs Vibes Moves Tunes Zone Mode Arena Ranked Cash Cup Solo Duo Squad`.split(' ');
const TAGS = ['TTV', 'YT', 'FN', 'OG', 'Pro', 'GG', 'x', 'Xx', 'TV', 'Live'];
const PREFIX = ['lil', 'its', 'Its', 'not', 'the', 'The', 'Mr', 'Sir', 'Lord', 'Captain', 'Big', 'Lil', 'iam', 'ImA', 'just', 'real', 'Only', 'Saint'];

// Real well-known creators/pros/skins to avoid.
const BLOCK = new Set(
  `ninja bugha clix mongraal sypherpk lazarbeam loserfruit ali-a thegrefg mrbeast mrsavage nickeh30 couRage typicalgamer tfue benjyfishy aqua nyhrox rubius dakotaz ikonik inoxtag peterbot`.toLowerCase().split(' '),
);

const LEET = { e: '3', o: '0', a: '4', i: '1', s: '5' };
const leet = (s) => s.replace(/[eoais]/g, (c) => (chance(0.5) ? LEET[c] : c));
const digits = () => {
  const r = rnd();
  if (r < 0.3) return String(Math.floor(rnd() * 10));
  if (r < 0.6) return String(Math.floor(rnd() * 90) + 10);
  if (r < 0.8) return String(Math.floor(rnd() * 900) + 100);
  return String(pick([2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 1999, 2006, 777, 1337, 99, 101, 2005, 12]));
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const styleCase = (s) => {
  const r = rnd();
  if (r < 0.14) return s.toLowerCase();
  if (r < 0.18) return s.toUpperCase();
  return s;
};

const PATTERNS = [
  [5, () => pick(WORLD_WORDS) + (chance(0.6) ? digits() : pick(['', 'FN', '_YT', 'Gamer']))],
  [5, () => pick(WORLD_NAMES) + pick(['', '_', '.']) + (chance(0.7) ? digits() : pick(TERMS))],
  [3, () => pick(ADJ) + pick(WORLD_WORDS)],
  [2, () => pick(WORLD_WORDS) + ' ' + pick(WORLD_WORDS)],
  [6, () => pick(FUNNY) + (chance(0.35) ? digits() : '')],
  [2, () => `Professional ${pick(['Noob', 'Napper', 'Bot', 'Camper', 'Looter'])}`],
  [2, () => `${pick(['Taco', 'Pickle', 'Nugget', 'Waffle', 'Potato', 'Toast', 'Burrito'])} ${pick(['Sniper', 'Lord', 'Bandit', 'Boxer', 'Wizard', 'Thief'])}`],
  [16, () => pick(ADJ) + pick(NOUN) + (chance(0.5) ? digits() : '')],
  [8, () => pick(ADJ) + ' ' + pick(NOUN)],
  [10, () => pick(NAMES) + digits()],
  [6, () => pick(NAMES) + pick(['_', '.', '']) + digits()],
  [7, () => pick(NAMES) + ' ' + pick(TERMS)],
  [6, () => pick(NOUN) + digits()],
  [5, () => `xX${pick(NOUN)}Xx`],
  [3, () => `Xx${pick(ADJ)}${pick(NOUN)}xX`],
  [7, () => pick(PREFIX) + (chance(0.5) ? ' ' : '') + cap(pick([...NOUN, ...NAMES]).toLowerCase())],
  [6, () => pick(TAGS) + ' ' + pick([...NAMES, ...NOUN])],
  [5, () => pick([...NAMES, ...NOUN]) + pick([' ', '']) + pick(TAGS)],
  [6, () => (pick(ADJ) + '_' + pick(NOUN)).toLowerCase()],
  [4, () => leet(pick(ADJ) + pick(NOUN))],
  [4, () => pick(NOUN) + pick(['.', '_', '-']) + pick(TERMS)],
  [3, () => pick(['ur', 'my', 'no', 'one']) + cap(pick(NOUN).toLowerCase()) + (chance(0.5) ? digits() : '')],
  [3, () => pick(NAMES) + pick(['ftw', 'xd', 'yt', 'fn', 'ttv'])],
  [2, () => pick(ADJ).toLowerCase() + '.' + pick(NAMES).toLowerCase()],
  [2, () => `${pick(NOUN)} ${pick(['Main', 'Enjoyer', 'Fan', 'God', 'Hater'])}`],
];
const totalW = PATTERNS.reduce((s, [w]) => s + w, 0);
const gen = () => {
  let r = rnd() * totalW;
  for (const [w, f] of PATTERNS) {
    if ((r -= w) <= 0) return f();
  }
  return PATTERNS[0][1]();
};

const VALID = /^[A-Za-z0-9 ._-]{3,16}$/;
const out = [];
const seen = new Set();
let guard = 0;
while (out.length < COUNT && guard++ < 500000) {
  let name = styleCase(gen()).replace(/\s+/g, ' ').trim();
  if (!VALID.test(name) || /^[ ._-]|[ ._-]$/.test(name)) continue;
  const key = name.toLowerCase();
  if (seen.has(key) || [...BLOCK].some((b) => key.replace(/[^a-z0-9-]/g, '').includes(b))) continue;
  seen.add(key);
  out.push(name);
}
if (out.length < COUNT) throw new Error(`only ${out.length} names`);
await writeFile(OUT, JSON.stringify(out) + '\n');
console.log(`wrote ${out.length} usernames`);
console.log(out.slice(0, 40).join(' | '));
