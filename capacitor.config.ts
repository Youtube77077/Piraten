import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.piraten.piratetoken',
  appName: 'Pirate Token',
  webDir: 'dist',
  backgroundColor: '#0a3c9a',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0a3c9a',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 450,
      backgroundColor: '#0a3c9a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true,
    },
  },
};

export default config;
