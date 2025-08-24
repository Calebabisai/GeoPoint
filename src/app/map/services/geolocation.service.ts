import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, from, of, EMPTY } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Platform } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import { LatLng, MapService } from './map.service';

export interface LocationPermissionStatus {
  granted: boolean;
  denied: boolean;
  restricted: boolean;
}

export interface UserLocation {
  coords: LatLng;
  accuracy: number;
  timestamp: number;
  heading?: number;
  speed?: number;
}

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private platform = inject(Platform);
  private mapService = inject(MapService);

  // Estado de la ubicación del usuario
  private currentLocationSubject = new BehaviorSubject<UserLocation | null>(
    null
  );
  private watchingLocationSubject = new BehaviorSubject<boolean>(false);
  private permissionStatusSubject =
    new BehaviorSubject<LocationPermissionStatus>({
      granted: false,
      denied: false,
      restricted: false,
    });

  // Observables públicos
  currentLocation$ = this.currentLocationSubject.asObservable();
  watchingLocation$ = this.watchingLocationSubject.asObservable();
  permissionStatus$ = this.permissionStatusSubject.asObservable();

  private watchId: string | null = null;

  constructor() {
    this.checkPermissions();
  }

  /**
   * Obtener la ubicación actual una sola vez
   */
  getCurrentLocation(): Observable<LatLng | null> {
    console.log('📍 Getting current location...');

    if (!this.platform.is('capacitor')) {
      // En el navegador, usar HTML5 Geolocation API
      return this.getBrowserLocation();
    }

    // En dispositivo móvil, usar Capacitor Geolocation
    return from(this.getCapacitorLocation());
  }

  /**
   * Iniciar seguimiento de ubicación en tiempo real
   */
  async startWatching(): Promise<void> {
    console.log('🔄 Starting location watching...');

    if (this.watchingLocationSubject.value) {
      console.log('⚠️ Already watching location');
      return;
    }

    try {
      // Verificar permisos primero
      const permissions = await this.requestPermissions();
      if (!permissions.granted) {
        console.error('❌ Location permissions not granted');
        return;
      }

      this.watchingLocationSubject.next(true);

      if (this.platform.is('capacitor')) {
        await this.startCapacitorWatch();
      } else {
        this.startBrowserWatch();
      }
    } catch (error) {
      console.error('❌ Error starting location watch:', error);
      this.watchingLocationSubject.next(false);
    }
  }

  /**
   * Detener seguimiento de ubicación
   */
  async stopWatching(): Promise<void> {
    console.log('🛑 Stopping location watching...');

    if (this.watchId) {
      if (this.platform.is('capacitor')) {
        await Geolocation.clearWatch({ id: this.watchId });
      } else {
        navigator.geolocation.clearWatch(parseInt(this.watchId));
      }
      this.watchId = null;
    }

    this.watchingLocationSubject.next(false);
  }

  /**
   * Centrar mapa en ubicación actual
   */
  async centerMapOnUserLocation(): Promise<void> {
    const currentLocation = this.currentLocationSubject.value;

    if (currentLocation) {
      console.log('🎯 Centering map on user location:', currentLocation.coords);
      this.mapService.updateUserLocation(currentLocation.coords);
      this.mapService.centerMap(
        currentLocation.coords.lat,
        currentLocation.coords.lng,
        15
      );
    } else {
      console.log('📍 Getting fresh location to center map...');
      this.getCurrentLocation().subscribe((coords) => {
        if (coords) {
          this.mapService.updateUserLocation(coords);
          this.mapService.centerMap(coords.lat, coords.lng, 15);
        }
      });
    }
  }

  // === MÉTODOS PRIVADOS ===

  private async checkPermissions(): Promise<void> {
    try {
      if (this.platform.is('capacitor')) {
        const status = await Geolocation.checkPermissions();
        this.permissionStatusSubject.next({
          granted: status.location === 'granted',
          denied: status.location === 'denied',
          restricted: false, // Capacitor no usa 'denied-forever'
        });
      } else {
        // En navegador, asumimos permisos disponibles
        this.permissionStatusSubject.next({
          granted: 'geolocation' in navigator,
          denied: false,
          restricted: false,
        });
      }
    } catch (error) {
      console.error('❌ Error checking permissions:', error);
    }
  }

  private async requestPermissions(): Promise<LocationPermissionStatus> {
    try {
      if (this.platform.is('capacitor')) {
        const status = await Geolocation.requestPermissions();
        const permissionStatus = {
          granted: status.location === 'granted',
          denied: status.location === 'denied',
          restricted: false, // Capacitor no usa 'denied-forever'
        };

        this.permissionStatusSubject.next(permissionStatus);
        return permissionStatus;
      } else {
        // En navegador, los permisos se solicitan automáticamente
        return {
          granted: 'geolocation' in navigator,
          denied: false,
          restricted: false,
        };
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return { granted: false, denied: true, restricted: false };
    }
  }

  private getBrowserLocation(): Observable<LatLng | null> {
    if (!('geolocation' in navigator)) {
      console.error('❌ Geolocation not supported in browser');
      return of(null);
    }

    return new Observable((observer) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: UserLocation = {
            coords: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
          };

          console.log('📍 Browser location obtained:', location);
          this.currentLocationSubject.next(location);
          this.mapService.updateUserLocation(location.coords);
          observer.next(location.coords);
          observer.complete();
        },
        (error) => {
          console.error('❌ Browser geolocation error:', error);
          observer.next(null);
          observer.complete();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    });
  }

  private async getCapacitorLocation(): Promise<LatLng | null> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const location: UserLocation = {
        coords: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        heading: position.coords.heading || undefined,
        speed: position.coords.speed || undefined,
      };

      console.log('📍 Capacitor location obtained:', location);
      this.currentLocationSubject.next(location);
      this.mapService.updateUserLocation(location.coords);
      return location.coords;
    } catch (error) {
      console.error('❌ Capacitor geolocation error:', error);
      return null;
    }
  }

  private startBrowserWatch(): void {
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: UserLocation = {
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
        };

        console.log('🔄 Browser location updated:', location);
        this.currentLocationSubject.next(location);
        this.mapService.updateUserLocation(location.coords);
      },
      (error) => {
        console.error('❌ Browser watch error:', error);
        this.stopWatching();
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 5000,
      }
    );

    this.watchId = watchId.toString();
  }

  private async startCapacitorWatch(): Promise<void> {
    try {
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 30000,
        },
        (position, err) => {
          if (err) {
            console.error('❌ Capacitor watch error:', err);
            this.stopWatching();
            return;
          }

          if (position) {
            const location: UserLocation = {
              coords: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined,
            };

            console.log('🔄 Capacitor location updated:', location);
            this.currentLocationSubject.next(location);
            this.mapService.updateUserLocation(location.coords);
          }
        }
      );
    } catch (error) {
      console.error('❌ Error starting Capacitor watch:', error);
      this.stopWatching();
    }
  }
}
