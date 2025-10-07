import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig & { bundledWebRuntime?: boolean } = {
  appId: 'com.geopoint.app',
  appName: 'GeoPoint',
  webDir: 'www',
  bundledWebRuntime: false,
  plugins: {
    Geolocation: {
      permissions: {
        location: 'always',
      },
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#999999',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Network: {
      allowedHostnames: ['firebaseapp.com', 'googleapis.com', 'emailjs.com'],
    },
  },
  server: {
    allowNavigation: [
      'https://firebaseapp.com',
      'https://*.firebaseapp.com',
      'https://googleapis.com',
      'https://*.googleapis.com',
      'https://emailjs.com',
    ],
  },
};

export default config;
