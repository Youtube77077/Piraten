// End-to-end checks + screenshots against a running build (vite preview).
// Usage: BASE_URL=http://localhost:4173 node tests/e2e.mjs
import { createRequire } from 'node:module';
import { mkdir, rm } from 'node:fs/promises';

// Uses the project's playwright if installed, otherwise the machine-wide one.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// iphone = iPhone 15 Pro in Safari (visible area between the browser bars)
const VIEWPORTS = {
  iphone: { ctx: { ...devices['iPhone 15 Pro'], defaultBrowserType: undefined } },
  ipad: { ctx: { ...devices['iPad Pro 11'], defaultBrowserType: undefined } },
  desktop: { ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
};

const DISCLAIMER_WORDS = /simulat|unofficial|affiliat|epic games|not granted|no item|demo/i;

async function newPage(browser, vp, extra = {}) {
  const { ctx: ctxOpts, insets } = VIEWPORTS[vp];
  const ctx = await browser.newContext({ ...ctxOpts, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on('console', (m) => m.type() === 'error' && !/status of 503/.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => !r.url().includes('/v2/cosmetics/new') && failed.push(`${r.url()} ${r.failure()?.errorText}`));
  // The "new outfits" feed is an optional background refresh; the app works without it.
  const optional = (url) => url.includes('/v2/cosmetics/new');
  page.on('response', (r) => r.status() >= 400 && !optional(r.url()) && failed.push(`${r.url()} ${r.status()}`));
  await page.addInitScript((insets) => {
    window.__sounds = 0;
    const C = window.AudioContext;
    if (C) {
      const osc = C.prototype.createOscillator;
      const buf = C.prototype.createBufferSource;
      C.prototype.createOscillator = function () { window.__sounds++; return osc.call(this); };
      C.prototype.createBufferSource = function () { window.__sounds++; return buf.call(this); };
    }
    window.__cls = 0;
    window.__longTasks = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; }))
        .observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longTasks.push(Math.round(e.duration))))
        .observe({ type: 'longtask', buffered: true });
    } catch {}
    // Simulate the device safe areas (env() is always 0 in desktop Chromium).
    if (insets) {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = `:root{--safe-top:${insets.top}px;--safe-bottom:${insets.bottom}px}`;
        document.head.appendChild(s);
      });
    }
  }, insets ?? null);
  return { ctx, page, errors, failed };
}

async function enterName(page, name) {
  const input = page.locator('#username');
  await input.waitFor({ state: 'visible' });
  await input.fill('');
  await input.pressSequentially(name, { delay: 25 });
}

async function findAccount(page) {
  await page.getByRole('button', { name: /find my account/i }).click();
  await page.locator('.profile .locker__img').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1700);
}

async function profileInfo(page) {
  return page.evaluate(() => {
    const img = document.querySelector('.profile .locker__img');
    const lvl = document.querySelector('.level__badge span')?.textContent;
    return {
      name: document.querySelector('#profile-name')?.textContent,
      level: lvl ? Number(lvl) : NaN,
      imgOk: Boolean(img && img.complete && img.naturalWidth > 0),
      src: img?.getAttribute('src'),
      text: document.querySelector('.profile')?.innerText ?? '',
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      ctaVisible: (() => {
        const b = [...document.querySelectorAll('.gold-btn')].find((x) => /grant/i.test(x.textContent));
        if (!b) return false;
        const r = b.getBoundingClientRect();
        return r.bottom <= window.innerHeight && r.top >= 0;
      })(),
    };
  });
}

async function openMenuBySwipe(page) {
  const vp = page.viewportSize();
  const y = Math.round(vp.height * 0.55);
  await page.mouse.move(24, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(24 + i * 22, y + 2);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);
}

async function runFlow(browser, vp) {
  const { ctx, page, errors, failed } = await newPage(browser, vp);
  const shot = (n) => page.screenshot({ path: `${SHOTS}${vp}-${n}.png` });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await shot('01-landing');

  const landing = await page.evaluate(() => {
    const btn = document.querySelector('button[type=submit]').getBoundingClientRect();
    return { text: document.body.innerText, btnVisible: btn.bottom <= window.innerHeight };
  });
  record(`[${vp}] landing: Find button fully on screen`, landing.btnVisible);
  record(`[${vp}] landing: no disclaimers in the experience`, !DISCLAIMER_WORDS.test(landing.text));
  record(`[${vp}] landing: title is just "Pirate Token"`, !/claim your|enter your/i.test(landing.text) && /pirate[\s\u00a0]token/i.test(landing.text));

  await page.locator('#username').click();
  await page.waitForTimeout(400);
  await shot('02a-input-focused');
  await enterName(page, 'CaptainLoot');
  await page.waitForTimeout(350);
  await shot('02b-username-entered');

  await page.getByRole('button', { name: /find my account/i }).click();
  await page.waitForTimeout(450);
  await shot('02c-searching');
  await page.locator('.profile .locker__img').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(650);
  await shot('03a-profile-reveal-midway');
  await page.waitForTimeout(1400);
  await shot('03b-profile');
  const info = await profileInfo(page);
  record(`[${vp}] profile: username shown`, info.name === 'CaptainLoot', info.name);
  record(`[${vp}] profile: account level 30–280 under the name`, info.level >= 30 && info.level <= 280, String(info.level));
  record(`[${vp}] profile: skin picture loaded`, info.imgOk, info.src);
  record(`[${vp}] profile: no outfit name / cosmetic ID shown`, !/outfit|cosmetic id/i.test(info.text));
  record(`[${vp}] profile: no disclaimers`, !DISCLAIMER_WORDS.test(info.text));
  record(`[${vp}] profile: Grant button fully on screen`, info.ctaVisible);
  record(`[${vp}] profile: no horizontal overflow`, !info.overflowX);

  const shape = await page.evaluate(() => {
    const f = document.querySelector('.gold-btn__face');
    const cs = getComputedStyle(f);
    return {
      clip: cs.clipPath,
      radius: cs.borderTopLeftRadius,
      style: getComputedStyle(f.querySelector('.gold-btn__label')).fontStyle,
      bg: cs.backgroundImage,
      text: getComputedStyle(f.querySelector('.gold-btn__label')).color,
    };
  });
  record(`[${vp}] buttons are straight (not slanted)`, shape.clip === 'none' && shape.style === 'normal', `clip-path ${shape.clip}, radius ${shape.radius}, font ${shape.style}`);
  const blue = [...shape.bg.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].every(([, r, g, b]) => +b > +r + 60 && +b > 150);
  record(`[${vp}] buttons are blue with white text`, blue && shape.text === 'rgb(255, 255, 255)', shape.text);

  await page.evaluate(() => {
    const t = (window.__phases = {});
    new MutationObserver(() => {
      const r = document.querySelector('.reward');
      if (r) for (const p of ['charge', 'burst', 'complete']) if (r.classList.contains(`phase-${p}`) && !t[p]) t[p] = performance.now();
      if (t.complete && !t.home && document.querySelector('#username')) t.home = performance.now();
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  });
  await page.getByRole('button', { name: /grant pirate token/i }).click();
  await page.waitForTimeout(1500);
  await shot('04a-grant-charging');
  await page.locator('.reward.phase-burst').waitFor({ timeout: 10000 });
  await page.waitForTimeout(250);
  await shot('04b-grant-burst');
  await page.locator('.reward.phase-complete').waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const done = await page.evaluate(() => ({
    title: document.querySelector('.complete__title')?.textContent,
    name: document.querySelector('.summary__name')?.textContent,
    level: document.querySelector('.summary__level')?.textContent,
    check: Boolean(document.querySelector('.check-badge')),
    text: document.querySelector('.reward')?.innerText ?? '',
  }));
  await shot('05-complete');
  record(`[${vp}] completion: checkmark + "Pirate Token complete"`, /^pirate token\s*complete$/i.test((done.title ?? '').trim()) && done.check, done.title);
  record(`[${vp}] completion: username + level`, done.name === 'CaptainLoot' && done.level === `Level ${info.level}`, `${done.name} / ${done.level}`);
  record(`[${vp}] completion: no disclaimers`, !DISCLAIMER_WORDS.test(done.text));

  await page.locator('#username').waitFor({ state: 'visible', timeout: 6000 });
  await page.waitForTimeout(1300);
  await shot('06-returned-home');
  const value = await page.inputValue('#username');
  const t = await page.evaluate(() => window.__phases);
  const charge = (t.burst - t.charge) / 1000 - 0.75; // the ring starts 0.75 s after the overlay appears
  const back = (t.home - t.complete) / 1000;
  record(`[${vp}] charge (0→100%) takes 2–4 s`, charge >= 1.9 && charge <= 4.25, `${charge.toFixed(2)} s`);
  record(`[${vp}] auto-returns home ~2 s after completing`, back >= 1.8 && back <= 2.6 && value === '', `${back.toFixed(2)} s, field "${value}"`);

  const sounds = await page.evaluate(() => window.__sounds);
  record(`[${vp}] sound effects play`, sounds > 40, `${sounds} audio voices started`);
  const perf = await page.evaluate(() => ({ cls: window.__cls, longTasks: window.__longTasks }));
  record(`[${vp}] cumulative layout shift < 0.1`, perf.cls < 0.1, perf.cls.toFixed(4));
  record(`[${vp}] long tasks`, true, perf.longTasks.length ? perf.longTasks.join('ms, ') + 'ms' : 'none');

  // menu: faint button, swipe, recent, settings with disclaimers
  const btnOpacity = await page.evaluate(() => getComputedStyle(document.querySelector('.menu-btn span')).opacity);
  record(`[${vp}] menu button is 80% transparent`, Number(btnOpacity) <= 0.21, `glyph opacity ${btnOpacity}`);
  await openMenuBySwipe(page);
  const drawerOpen = await page.locator('.drawer').isVisible();
  record(`[${vp}] swipe right opens the menu`, drawerOpen);
  if (!drawerOpen) await page.getByRole('button', { name: /open menu/i }).click();
  await page.waitForTimeout(500);
  await shot('07-menu');
  await page.locator('.nav-row', { hasText: 'Recent' }).click();
  await page.waitForTimeout(600);
  await shot('08-recent');
  const recentText = await page.locator('.recent').innerText().catch(() => '');
  record(`[${vp}] recent list has the granted account`, recentText.includes('CaptainLoot') && recentText.includes(`Level ${info.level}`));
  await page.locator('.back-btn').click();
  await page.waitForTimeout(500);
  await page.locator('.nav-row', { hasText: 'Settings' }).click();
  await page.waitForTimeout(600);
  await shot('09a-settings');
  await page.locator('.disclaimers').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot('09b-settings-disclaimers');
  const disclaimers = await page.locator('.disclaimers').innerText();
  record(`[${vp}] settings shows all disclaimers`, /not affiliated/i.test(disclaimers) && /nothing is granted/i.test(disclaimers) && /randomly generated/i.test(disclaimers));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  record(`[${vp}] menu closes`, !(await page.locator('.drawer').isVisible().catch(() => false)));

  record(`[${vp}] no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  record(`[${vp}] no failed requests`, failed.length === 0, failed.slice(0, 3).join(' | '));
  await ctx.close();
}

async function main() {
  await rm(SHOTS, { recursive: true, force: true });
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ proxy });

  for (const vp of Object.keys(VIEWPORTS)) await runFlow(browser, vp);

  // ---- functional cases (iPhone app viewport) ----
  const { ctx, page, errors } = await newPage(browser, 'iphone');
  await page.goto(BASE, { waitUntil: 'load' });

  const btn = page.getByRole('button', { name: /find my account/i });
  await enterName(page, 'a');
  record('very short (1 char) is blocked', await btn.isDisabled());
  await enterName(page, 'bad!name');
  await page.waitForTimeout(400);
  const err = await page.locator('.field__error').textContent().catch(() => null);
  record('invalid characters show an error', Boolean(err) && (await btn.isDisabled()), err ?? '');

  const names = ['Ninja', 'Player123', 'salty_sea_dog', 'Captain Barnacle', 'Jo', 'TheLongestNameEver_', 'Zz_9', 'Kraken07'];
  const outfits = [];
  const levels = [];
  for (const n of names) {
    if (!(await page.locator('#username').isVisible())) {
      await page.getByRole('button', { name: /change name/i }).click();
      await page.locator('#username').waitFor({ state: 'visible' });
      await page.waitForTimeout(900);
    }
    await enterName(page, n);
    await findAccount(page);
    const info = await profileInfo(page);
    outfits.push(info.src);
    levels.push(info.level);
    record(`username "${n}" accepted`, info.name === n && info.imgOk && info.ctaVisible && !info.overflowX, `level ${info.level}`);
    if (n === 'TheLongestNameEver_') await page.screenshot({ path: `${SHOTS}iphone-10-long-username.png` });
  }
  record('different random skins across submissions', new Set(outfits).size >= names.length - 1, `${new Set(outfits).size} unique of ${names.length}`);
  record('random levels vary and stay in 30–280', new Set(levels).size >= names.length - 2 && levels.every((l) => l >= 30 && l <= 280), levels.join(', '));

  const before = await profileInfo(page);
  await page.setViewportSize({ width: 430, height: 739 });
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 393, height: 659 });
  await page.waitForTimeout(500);
  const after = await profileInfo(page);
  record('skin + level preserved during interaction', after.src === before.src && after.level === before.level);

  record('no console errors in functional run', errors.length === 0, errors.slice(0, 3).join(' | '));

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  record('refresh returns to a working start screen', await page.locator('#username').isVisible());
  await ctx.close();

  // ---- Octopus: give tokens to many random accounts ----
  {
    const { ctx, page, errors } = await newPage(browser, 'iphone');
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const octo = page.getByRole('button', { name: /octopus/i });
    const fits = await octo.evaluate((b) => b.getBoundingClientRect().bottom <= innerHeight);
    record('octopus: button under Find my account, on screen', fits);
    await octo.click();
    await page.waitForTimeout(600);
    const give = page.getByRole('button', { name: /give all/i });
    record('octopus: Give all disabled until a number is typed', await give.isDisabled());
    await page.keyboard.type('20000');
    await page.waitForTimeout(200);
    const typed = await page.inputValue('#octo-count');
    record('octopus: amount capped at 5 digits / 10,000', typed.length <= 5 && (await give.isDisabled()), typed);
    await page.fill('#octo-count', '');
    await page.keyboard.type('8');
    const cardFits = await page.locator('.octo-card').evaluate((c) => c.getBoundingClientRect().right <= innerWidth);
    record('octopus: dialog fits the phone screen', cardFits);
    await page.screenshot({ path: `${SHOTS}iphone-12-octopus-dialog.png` });
    await give.click();
    const seen = new Set();
    const started = Date.now();
    await page.locator('.octo-card-now').first().waitFor({ timeout: 15000 });
    let shot = false;
    while (Date.now() - started < 30000) {
      const { n, complete } = await page.evaluate(() => {
        const names = document.querySelectorAll('.octo-card-now__name');
        return { n: names.length ? names[names.length - 1].textContent : null, complete: Boolean(document.querySelector('.octo-complete')) };
      });
      if (n) seen.add(n);
      if (complete) break;
      if (!shot && seen.size >= 4) {
        await page.screenshot({ path: `${SHOTS}iphone-13-octopus-giving.png` });
        shot = true;
      }
      await page.waitForTimeout(120);
    }
    const secs = (Date.now() - started) / 1000;
    record('octopus: every username shown one by one', seen.size >= 8, `${seen.size} of 8 seen: ${[...seen].join(', ')}`);
    record('octopus: pace readable (about 1 per second for small runs)', secs > 6 && secs < 16, `${secs.toFixed(1)} s for 8`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}iphone-14-octopus-complete.png` });
    const doneText = await page.locator('.octo-complete').innerText();
    record('octopus: completion shows total', /8 accounts/i.test(doneText) && /pirate tokens/i.test(doneText));
    await page.locator('#username').last().waitFor({ state: 'visible', timeout: 8000 });
    record('octopus: returns home afterwards', true);
    record('octopus: no console errors', errors.filter((e) => !/503/.test(e)).length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- broken images: first icon requests fail → another skin is chosen ----
  {
    const { ctx, page } = await newPage(browser, 'iphone');
    let blocked = 0;
    await page.route('**/images/cosmetics/**', (route) => {
      if (blocked < 3) {
        blocked++;
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await enterName(page, 'BrokenImageTest');
    await findAccount(page);
    const info = await profileInfo(page);
    record('missing images are skipped (another skin shown)', blocked === 3 && info.imgOk, `${blocked} blocked → loaded`);
    await ctx.close();
  }

  // ---- outfit API completely unreachable ----
  {
    const { ctx, page } = await newPage(browser, 'iphone');
    await page.route('**/fortnite-api.com/**', (route) => route.abort());
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await enterName(page, 'OfflineTest');
    await page.getByRole('button', { name: /find my account/i }).click();
    const errLoc = page.locator('.field__error');
    await errLoc.waitFor({ state: 'visible', timeout: 90000 }).catch(() => undefined);
    const msg = await errLoc.textContent().catch(() => null);
    record('offline: friendly error instead of broken UI', Boolean(msg), msg ?? 'no error shown');
    await page.screenshot({ path: `${SHOTS}iphone-11-offline-error.png` });
    await ctx.close();
  }

  // ---- reduced motion (system preference) ----
  {
    const { ctx, page, errors } = await newPage(browser, 'iphone', { reducedMotion: 'reduce' });
    await page.goto(BASE, { waitUntil: 'load' });
    await enterName(page, 'CalmSailor');
    await findAccount(page);
    await page.getByRole('button', { name: /grant pirate token/i }).click();
    await page.locator('.reward.phase-complete').waitFor({ timeout: 12000 });
    await page.waitForTimeout(600);
    const anims = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).map((a) => a.animationName),
    );
    record('reduced motion: flow completes', true);
    record('reduced motion: no infinite ambient animations running', anims.length === 0, anims.join(', ') || 'none');
    record('reduced motion: no console errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- in-app settings: Reduced motion + background effects off ----
  {
    const { ctx, page } = await newPage(browser, 'desktop');
    await page.goto(BASE, { waitUntil: 'load' });
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.waitForTimeout(600);
    await page.locator('.nav-row', { hasText: 'Settings' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('radio', { name: 'Reduced' }).click();
    await page.getByRole('switch', { name: 'Background effects' }).click();
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => ({
      cls: document.documentElement.className,
      infinite: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length,
    }));
    record('setting: Reduced motion + effects off stop ambient animation', /motion-reduced/.test(state.cls) && /fx-off/.test(state.cls) && state.infinite === 0, `${state.infinite} infinite running`);
    await page.reload({ waitUntil: 'load' });
    const persisted = await page.evaluate(() => document.documentElement.className);
    record('settings persist across reload', /motion-reduced/.test(persisted) && /fx-off/.test(persisted));
    await ctx.close();
  }

  // ---- background animations pause when hidden ----
  {
    const { ctx, page } = await newPage(browser, 'desktop');
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(1800); // the app starts once fonts + hero art are ready
    const count = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length);
    const running = await count();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200);
    const after = await count();
    record('ambient animations pause when app is hidden', running > 0 && after === 0, `${running} looping → ${after}`);
    await ctx.close();
  }

  await browser.close();
  const failedCount = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failedCount}/${results.length} checks passed`);
  process.exit(failedCount ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
