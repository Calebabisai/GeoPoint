import { enableProdMode, ErrorHandler } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// Importaciones de Firebase y providers
import { initializeApp, provideFirebaseApp, getApp } from '@angular/fire/app';
import { getAuth, indexedDBLocalPersistence, initializeAuth, provideAuth, browserLocalPersistence } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

// Iconos para marcadores POI
import { addIcons } from 'ionicons';
import { navigateOutline, star, location } from 'ionicons/icons';

// Manejador global de errores
import { GlobalErrorHandler } from './app/shared/utils/error-handler.service';
import { Capacitor } from '@capacitor/core';

if (environment.production) {
  enableProdMode();
}

// Registrar íconos globalmente
addIcons({
  navigateOutline,
  star,
  location,
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler }, 
    provideIonicAngular(),
    provideRouter(routes),
    
    // Provee Firebase App (solo una vez)
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    
    // Configuración de Auth con persistencia correcta
    provideAuth(() => {
      const app = getApp(); // Usa getApp() para obtener la app ya inicializada
      
      if (Capacitor.isNativePlatform()) {
        // Para móvil usa indexedDB persistence
        return initializeAuth(app, {
          persistence: indexedDBLocalPersistence
        });
      } else {
        // Para web usa browserLocalPersistence explícitamente
        return initializeAuth(app, {
          persistence: browserLocalPersistence
        });
      }
    }),
    
    provideFirestore(() => getFirestore()),
  ],
});

// Registrar service worker para caché de tiles
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => console.log(' Service Worker registrado'))
    .catch((err) => console.error(' Error registrando Service Worker:', err));
}
