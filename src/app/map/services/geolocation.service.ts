import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, from, of, EMPTY } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Platform } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import { LatLng, MapService } from './map.service';
import { LoggerService } from '../../shared/services/logger.service';

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

  // Variables para suavizado y filtrado de ubicación
  private lastKnownLocation: UserLocation | null = null;
  private locationBuffer: UserLocation[] = [];
  private readonly BUFFER_SIZE = 5; // Promedio de últimas 5 ubicaciones para mayor estabilidad
  private readonly MIN_DISTANCE_THRESHOLD = 3; // Metros mínimos para actualizar (más sensible)
  private readonly MAX_ACCURACY_THRESHOLD = 30; // Rechazar ubicaciones menos precisas (más estricto)

  // Optimizaciones para móvil
  private readonly STABLE_ACCURACY_THRESHOLD = 15; // Consideramos ubicación "estable" con esta precisión
  private readonly MAX_CONSECUTIVE_UPDATES = 8; // Máximo de actualizaciones consecutivas antes de estabilizar
  private consecutiveUpdatesCount = 0;
  private isLocationStable = false;

  private logger = inject(LoggerService);

  constructor(private platform: Platform, private mapService: MapService) {
    this.logger.geo('📍 GeolocationService initialized');
    this.checkPermissions();
  }

  /**
   * Calcular distancia entre dos puntos GPS en metros
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Suavizar ubicación usando promedio de buffer
   */
  private smoothLocation(newLocation: UserLocation): UserLocation {
    // Agregar nueva ubicación al buffer
    this.locationBuffer.push(newLocation);

    // Mantener solo las últimas ubicaciones
    if (this.locationBuffer.length > this.BUFFER_SIZE) {
      this.locationBuffer.shift();
    }

    // Si solo tenemos una ubicación, retornarla
    if (this.locationBuffer.length === 1) {
      return newLocation;
    }

    // Calcular promedio ponderado (más peso a ubicaciones más recientes y precisas)
    let totalWeight = 0;
    let avgLat = 0;
    let avgLng = 0;

    this.locationBuffer.forEach((location, index) => {
      // Peso basado en precisión (mejor precisión = mayor peso)
      const accuracyWeight = Math.max(1, 100 - location.accuracy);
      // Peso basado en recencia (más reciente = mayor peso)
      const recencyWeight = index + 1;
      const weight = accuracyWeight * recencyWeight;

      avgLat += location.coords.lat * weight;
      avgLng += location.coords.lng * weight;
      totalWeight += weight;
    });

    return {
      coords: {
        lat: avgLat / totalWeight,
        lng: avgLng / totalWeight,
      },
      accuracy: newLocation.accuracy, // Usar la precisión más reciente
      timestamp: newLocation.timestamp,
      heading: newLocation.heading,
      speed: newLocation.speed,
    };
  }

  /**
   * Determinar si debe actualizarse la ubicación en el mapa
   */
  private shouldUpdateLocation(newLocation: UserLocation): boolean {
    // Siempre actualizar si es la primera ubicación
    if (!this.lastKnownLocation) {
      this.logger.geo('🎯 First location - updating immediately');
      return true;
    }

    // Rechazar si la precisión es muy mala
    if (newLocation.accuracy > this.MAX_ACCURACY_THRESHOLD) {
      this.logger.geo(
        '⚠️ Skipping location update - poor accuracy:',
        newLocation.accuracy +
          'm (threshold: ' +
          this.MAX_ACCURACY_THRESHOLD +
          'm)'
      );
      return false;
    }

    // Verificar si la ubicación está estable
    if (
      this.isLocationStable &&
      newLocation.accuracy > this.STABLE_ACCURACY_THRESHOLD &&
      this.consecutiveUpdatesCount > this.MAX_CONSECUTIVE_UPDATES
    ) {
      this.logger.geo('🔒 Location is stable - ignoring minor updates');
      return false;
    }

    // Calcular distancia desde la última ubicación conocida
    const distance = this.calculateDistance(
      this.lastKnownLocation.coords.lat,
      this.lastKnownLocation.coords.lng,
      newLocation.coords.lat,
      newLocation.coords.lng
    );

    // Condiciones para actualizar
    const significantMovement = distance >= this.MIN_DISTANCE_THRESHOLD;
    const betterAccuracy =
      newLocation.accuracy < this.lastKnownLocation.accuracy * 0.8;
    const highAccuracyReading =
      newLocation.accuracy <= this.STABLE_ACCURACY_THRESHOLD;

    // Lógica de estabilización
    if (
      highAccuracyReading &&
      !significantMovement &&
      this.consecutiveUpdatesCount >= 3
    ) {
      this.isLocationStable = true;
      this.logger.geo(
        '✅ GPS location stabilized at accuracy:',
        newLocation.accuracy + 'm'
      );
    }

    if (
      significantMovement ||
      betterAccuracy ||
      (!this.isLocationStable && highAccuracyReading)
    ) {
      this.consecutiveUpdatesCount++;
      this.logger.geo(
        `📍 Location update: moved ${distance.toFixed(1)}m, accuracy: ${
          newLocation.accuracy
        }m, updates: ${this.consecutiveUpdatesCount}`
      );
      return true;
    }

    this.logger.geo(`🔒 Skipping minor GPS variation: ${distance.toFixed(1)}m`);
    return false;
  }

  /**
   * Procesar nueva ubicación con filtros y suavizado
   */
  private processLocationUpdate(rawLocation: UserLocation): void {
    // BLOQUEAR ACTUALIZACIONES si la ubicación está estabilizada
    if (this.isLocationStable) {
      this.logger.geo(
        '🔒 Location is stable - ignoring GPS update to prevent marker drift'
      );
      return;
    }

    // Verificar si debe actualizarse
    if (!this.shouldUpdateLocation(rawLocation)) {
      return;
    }

    // Aplicar suavizado
    const smoothedLocation = this.smoothLocation(rawLocation);

    // Actualizar estado
    this.currentLocationSubject.next(smoothedLocation);

    // Actualizar marcador en el mapa SOLO si no está estabilizado
    this.logger.geo(
      '🎯 Calling mapService.updateUserLocation with:',
      smoothedLocation.coords
    );
    this.mapService.updateUserLocation(smoothedLocation.coords);
    this.lastKnownLocation = smoothedLocation;

    this.logger.geo('📍 Location processed and updated:', {
      coords: smoothedLocation.coords,
      accuracy: `${smoothedLocation.accuracy}m`,
      smoothed: this.locationBuffer.length > 1,
      stable: this.isLocationStable,
    });
  }

  /**
   * Obtener la ubicación actual una sola vez
   */
  getCurrentLocation(): Observable<LatLng | null> {
    this.logger.geo('📍 Getting current location...');

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
    this.logger.geo('🔄 Starting location watching...');

    if (this.watchingLocationSubject.value) {
      this.logger.warn('⚠️ Already watching location');
      return;
    }

    try {
      // Verificar permisos primero
      const permissions = await this.requestPermissions();
      if (!permissions.granted) {
        this.logger.error('❌ Location permissions not granted');
        return;
      }

      this.watchingLocationSubject.next(true);

      if (this.platform.is('capacitor')) {
        await this.startCapacitorWatch();
      } else {
        this.startBrowserWatch();
      }
    } catch (error) {
      this.logger.error('❌ Error starting location watch:', error);
      this.watchingLocationSubject.next(false);
    }
  }

  /**
   * Detener seguimiento de ubicación
   */
  async stopWatching(): Promise<void> {
    this.logger.geo('🛑 Stopping location watching...');

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
   * Reiniciar estado de ubicación para permitir nuevas actualizaciones
   */
  resetLocationState(): void {
    this.logger.geo('🔄 Resetting location state for new precise reading...');
    this.isLocationStable = false;
    this.consecutiveUpdatesCount = 0;
    this.locationBuffer = [];
  }

  /**
   * Obtener ubicación de alta precisión inmediata (para botón "marcar mi ubicación")
   */
  async getHighPrecisionLocation(): Promise<LatLng | null> {
    this.logger.geo('🎯 Getting high precision location...');

    try {
      if (this.platform.is('capacitor')) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000, // Timeout más rápido para respuesta inmediata
          maximumAge: 0, // Forzar nueva lectura GPS
        });

        const location: UserLocation = {
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        // Actualizar directamente sin filtros para respuesta inmediata
        this.currentLocationSubject.next(location);
        this.mapService.updateUserLocation(location.coords);
        this.lastKnownLocation = location;

        // Resetear estado de estabilidad para permitir nuevas actualizaciones
        this.isLocationStable = false;
        this.consecutiveUpdatesCount = 0;

        this.logger.geo('✅ High precision location obtained:', location.coords);
        return location.coords;
      } else {
        // Para navegador
        return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };

              const location: UserLocation = {
                coords,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
              };

              this.currentLocationSubject.next(location);
              this.mapService.updateUserLocation(coords);
              this.lastKnownLocation = location;
              this.isLocationStable = false;
              this.consecutiveUpdatesCount = 0;

              resolve(coords);
            },
            (error) => reject(error),
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
        });
      }
    } catch (error) {
      this.logger.error('❌ Error getting high precision location:', error);
      return null;
    }
  }

  /**
   * Centrar mapa en ubicación actual (modo fijo - sin tracking continuo)
   */
  async centerMapOnUserLocation(): Promise<void> {
    this.logger.geo(
      '🎯 Getting single precise location (no continuous tracking)...'
    );

    try {
      // 1. DETENER cualquier tracking activo primero
      if (this.watchingLocationSubject.value) {
        this.logger.geo('🛑 Stopping continuous tracking for precise location...');
        await this.stopWatching();
      }

      // 2. Reiniciar estado para permitir nueva actualización
      this.resetLocationState();

      // 3. Obtener UNA ubicación precisa
      const coords = await this.getHighPrecisionLocation();

      if (coords) {
        this.logger.geo(
          '✅ Precise location obtained - updating marker and stopping'
        );

        // 4. Actualizar el marcador con la ubicación precisa
        this.mapService.updateUserLocation(coords);
        this.mapService.centerMap(coords.lat, coords.lng, 17);

        // 5. Marcar que la ubicación está estabilizada para evitar más actualizaciones
        this.isLocationStable = true;
        this.consecutiveUpdatesCount = this.MAX_CONSECUTIVE_UPDATES;

        console.log('🔒 Location marker fixed at precise coordinates');
      } else {
        console.error('❌ Could not obtain high precision location');
        throw new Error('No se pudo obtener ubicación de alta precisión');
      }
    } catch (error) {
      console.error('❌ Error centering map on user location:', error);

      // Fallback: usar ubicación en caché si está disponible
      const currentLocation = this.currentLocationSubject.value;
      if (currentLocation) {
        console.log('📍 Using cached location as fallback (fixed mode)...');
        this.mapService.updateUserLocation(currentLocation.coords);
        this.mapService.centerMap(
          currentLocation.coords.lat,
          currentLocation.coords.lng,
          15
        );

        // También marcar como estable en fallback
        this.isLocationStable = true;
      }
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

          console.log('📍 Browser location obtained:', {
            coords: location.coords,
            accuracy: `${location.accuracy}m`,
            timestamp: new Date(location.timestamp).toLocaleTimeString(),
          });

          // Procesar ubicación con filtros y suavizado
          if (location.accuracy <= 100) {
            this.processLocationUpdate(location);
            observer.next(location.coords);
            observer.complete();
          } else {
            console.warn(
              '⚠️ Browser location too inaccurate:',
              `${location.accuracy}m`
            );
            observer.next(null);
            observer.complete();
          }
        },
        (error) => {
          // Reducir nivel de logging para errores de geolocalización en contextos no críticos
          if (window.location.pathname.includes('/admin/user-management')) {
            console.debug(
              '🔍 Geolocation not available in admin context:',
              error.message
            );
          } else {
            console.warn('⚠️ Browser geolocation error:', error.message);
          }
          observer.next(null);
          observer.complete();
        },
        {
          enableHighAccuracy: true,
          timeout: 20000, // Más tiempo para GPS de calidad
          maximumAge: 2000, // Solo ubicaciones muy recientes
        }
      );
    });
  }

  private async getCapacitorLocation(): Promise<LatLng | null> {
    try {
      console.log('📍 Requesting high-accuracy GPS location...');

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000, // Más tiempo para obtener mejor precisión
        maximumAge: 1000, // Solo ubicaciones muy recientes (1 segundo)
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

      console.log('📍 Capacitor location obtained:', {
        coords: location.coords,
        accuracy: `${location.accuracy}m`,
        timestamp: new Date(location.timestamp).toLocaleTimeString(),
      });

      // Procesar ubicación con filtros y suavizado
      if (location.accuracy <= 100) {
        this.processLocationUpdate(location);
        return location.coords;
      } else {
        console.warn('⚠️ Location accuracy too low:', `${location.accuracy}m`);
        // Intentar de nuevo si la precisión es muy baja
        return this.retryLocationWithBetterAccuracy();
      }
    } catch (error) {
      console.error('❌ Capacitor geolocation error:', error);

      // Intentar con configuración alternativa si falla
      try {
        console.log('🔄 Retrying with fallback configuration...');
        const fallbackPosition = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false, // Usar network location como fallback
          timeout: 8000,
          maximumAge: 10000,
        });

        const fallbackLocation: UserLocation = {
          coords: {
            lat: fallbackPosition.coords.latitude,
            lng: fallbackPosition.coords.longitude,
          },
          accuracy: fallbackPosition.coords.accuracy,
          timestamp: fallbackPosition.timestamp,
        };

        console.log('📍 Fallback location obtained:', fallbackLocation);
        this.processLocationUpdate(fallbackLocation);
        return fallbackLocation.coords;
      } catch (fallbackError) {
        console.error('❌ Fallback geolocation also failed:', fallbackError);
        return null;
      }
    }
  }

  private async retryLocationWithBetterAccuracy(): Promise<LatLng | null> {
    try {
      console.log('🎯 Retrying for better accuracy...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 1000, // Very recent location only
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

      console.log('📍 Retry location result:', {
        coords: location.coords,
        accuracy: `${location.accuracy}m`,
      });

      this.processLocationUpdate(location);
      return location.coords;
    } catch (error) {
      console.error('❌ Retry failed:', error);
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

        // Procesar ubicación con filtros y suavizado
        this.processLocationUpdate(location);
      },
      (error) => {
        console.error('❌ Browser watch error:', error);
        // Don't stop watching on error, just log it
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
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
          timeout: 15000, // Tiempo moderado para mejor precisión en móvil
          maximumAge: 5000, // Permite ubicaciones de hasta 5 segundos (reduce frecuencia de GPS)
        },
        (position, err) => {
          if (err) {
            console.error('❌ Capacitor watch error:', err);
            // Don't stop watching on error, just log it
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

            // Procesar ubicación con filtros y suavizado
            this.processLocationUpdate(location);
          }
        }
      );
    } catch (error) {
      console.error('❌ Error starting Capacitor watch:', error);
      this.stopWatching();
    }
  }
}
