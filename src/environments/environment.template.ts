// PLANTILLA DE CONFIGURACIÓN DE ENTORNO CON DETECCIÓN DE PLATAFORMA
// Este archivo es un template para crear tu archivo environment.ts
// NO contiene claves reales - es solo una guía

// INSTRUCCIONES:
// 1. Copia este archivo y renómbralo a "environment.ts"
// 2. Reemplaza las API keys con las reales de Google Cloud Console
// 3. Nunca subas el archivo environment.ts a GitHub

import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';

// Detectar plataforma: 'ios', 'android', o 'web'
const platform = Capacitor.getPlatform();

// API Keys por plataforma (restricciones de seguridad)
const API_KEYS: { [key: string]: string } = {
  android: 'AIzaSyAs_Sr6wJinTsLn7jrz2Q4d1xEGYMPdcEc', // ← API Key con restricción Android
  ios: 'AIzaSyDy20Vr8fH2F0wl_Gsi-EADsiHB1aux27E', // ← API Key con restricción iOS
  web: 'AIzaSyDVZEHMhc9QUqcGK6MQYjZjyJ1YaI7H3po', // ← API Key con restricción HTTP referrers
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
  production: false,
  firebase: firebaseConfig,
  firebaseConfig: firebaseConfig,
  platform: platform, // Útil para debugging
};
