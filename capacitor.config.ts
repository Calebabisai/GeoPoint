import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig & { bundledWebRuntime?: boolean } = {
  appId: 'io.ionic.starter',
  appName: 'GeoPoint',
  webDir: 'www',
  bundledWebRuntime: false,
  plugins: {
    Geolocation: {
      permissions: {
        location: 'always',
      },
    },
  },
};

export default config;
