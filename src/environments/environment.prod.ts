// IMPORTANTE: Este archivo contiene tus claves API reales para PRODUCCIÓN
// Nunca lo subas a GitHub - está en .gitignore
// Para otros desarrolladores, usa environment.template.ts como base

import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';

// Detectar plataforma: 'ios', 'android', o 'web'
const platform = Capacitor.getPlatform();

// API Keys por plataforma (restricciones de seguridad)
const API_KEYS: { [key: string]: string } = {
  android: 'AIzaSyAs_Sr6wJinTsLn7jrz2Q4d1xEGYMPdcEc', // ← Pega tu API Key de Android
  ios: 'AIzaSyDy20Vr8fH2F0wl_Gsi-EADsiHB1aux27E', // ← Pega tu API Key de iOS
  web: 'AIzaSyDVZEHMhc9QUqcGK6MQYjZjyJ1YaI7H3po', // ← Pega tu API Key de Web
};

const firebaseConfig = {
  apiKey: API_KEYS[platform] || API_KEYS['web'], // Selecciona automáticamente según plataforma
  authDomain: 'geopoint-f1d56.firebaseapp.com',
  projectId: 'geopoint-f1d56',
  storageBucket: 'geopoint-f1d56.firebasestorage.app',
  messagingSenderId: '815851668907',
  appId: '1:815851668907:web:48fbf0ee98bd8d329bfeee',
  measurementId: 'G-YHTVJ3JEH4',
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const environment = {
  production: true, // ← Modo producción
  firebase: firebaseConfig,
  firebaseConfig: firebaseConfig,
  platform: platform, // Útil para debugging
};
