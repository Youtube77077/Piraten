/** Thin wrappers around native features; every call is a no-op on the web. */
import { Capacitor } from '@capacitor/core';
import { getSettings } from './settings';

export const isNative = Capacitor.isNativePlatform();

type ImpactStyle = 'LIGHT' | 'MEDIUM' | 'HEAVY';

export async function tap(style: ImpactStyle = 'LIGHT') {
  if (!isNative || !getSettings().haptics) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle[style === 'LIGHT' ? 'Light' : style === 'MEDIUM' ? 'Medium' : 'Heavy'] });
  } catch {
    /* haptics unavailable */
  }
}

export async function success() {
  if (!isNative || !getSettings().haptics) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* haptics unavailable */
  }
}

export async function initNativeShell() {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* ignore */
  }
}

export async function hideSplash() {
  if (!isNative) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 450 });
  } catch {
    /* ignore */
  }
}
