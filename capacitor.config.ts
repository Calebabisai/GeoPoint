import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig & { bundledWebRuntime?: boolean } = {
  appId: 'com.imaginetz.geopoint',
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
      overlaysWebView: false, // La barra NO se superpone al contenido
    },
    SplashScreen: {
      launchShowDuration: 1500, // Duración en milisegundos (reducido a 1.5s)
      launchAutoHide: true, // Se oculta automáticamente
      backgroundColor: '#000000', // Fondo NEGRO sin imagen
      showSpinner: false, // No mostrar spinner de carga
      splashFullScreen: true, // Pantalla completa
      splashImmersive: true, // Modo inmersivo (oculta barra de navegación)
    },
    Network: {
      allowedHostnames: ['firebaseapp.com', 'googleapis.com', 'emailjs.com', 'tile.openstreetmap.org'],
    },
  },
  server: {
    allowNavigation: [
      'https://firebaseapp.com',
      'https://*.firebaseapp.com',
      'https://googleapis.com',
      'https://*.googleapis.com',
      'https://emailjs.com',
      'https://*.tile.openstreetmap.org',
    ],
        // NUEVO: Permitir Service Workers
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
