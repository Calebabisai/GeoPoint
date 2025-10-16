import { Capacitor } from '@capacitor/core';

// Detectar plataforma: 'ios', 'android', o 'web'
const platform = Capacitor.getPlatform();

// API Keys por plataforma (restricciones de seguridad)
const API_KEYS: { [key: string]: string } = {
  android: 'TU_API_KEY_ANDROID', // ← API Key con restricción Android
  ios: 'TU_API_KEY_IOS', // ← API Key con restricción iOS
  web: 'TU_API_KEY_WEB', // ← API Key con restricción HTTP referrers
};

const firebaseConfig = {
  apiKey: API_KEYS[platform] || API_KEYS['web'], // Selecciona automáticamente según plataforma
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto-id',
  storageBucket: 'tu-proyecto.firebasestorage.app',
  messagingSenderId: 'TU_SENDER_ID',
  appId: 'TU_APP_ID',
  measurementId: 'TU_MEASUREMENT_ID',
};
export const environment = {
  production: false,
  firebase: firebaseConfig,
  firebaseConfig: firebaseConfig,
  platform: platform,
};
