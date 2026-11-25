import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-900.css';
import logoUrl from './assets/brand/logo.webp';
import backgroundUrl from './assets/brand/background.webp';
import './styles.css';
import App from './App';
import { hideSplash, initNativeShell, isNative } from './lib/native';
import { unlockAudio } from './lib/sound';

// Browsers only start audio after a user gesture.
const unlock = () => unlockAudio();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

// Pause every ambient CSS animation while the app/tab is not visible.
const syncVisibility = () => document.documentElement.classList.toggle('is-hidden', document.hidden);
document.addEventListener('visibilitychange', syncVisibility);
syncVisibility();

void initNativeShell();

if (!isNative && import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}

function decodeImage(src: string) {
  const img = new Image();
  img.src = src;
  return img.decode().catch(() => undefined);
}

// Start the entrance choreography only once fonts and the hero artwork are ready,
// so the first frame the user sees is already correct (no font swap, no pop-in).
const ready = Promise.race([
  Promise.all([document.fonts?.ready, decodeImage(logoUrl), decodeImage(backgroundUrl)]),
  new Promise((r) => setTimeout(r, 1500)),
]);

ready.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  requestAnimationFrame(() => requestAnimationFrame(() => void hideSplash()));
});
