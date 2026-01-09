import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Platform } from '@ionic/angular';
import { Geolocation, Position } from '@capacitor/geolocation';
import { MapService } from './map.service';
import { LoggerService } from 'src/app/core/services/logger.service';
import { LatLng } from '../models/map-model';
import {
  LocationPermissionStatus,
  UserLocation,
  UserLocationData,
  LocationConfig,
  LocationTrackingMode,
  LocationTrackingConfig,
} from '../models/geolocation.model';




@Injectable({ providedIn: 'root' })
export class GeolocationService {

  // Configuración por defecto
  private readonly DEFAULT_TRACKING_CONFIG: LocationTrackingConfig = {
    mode: LocationTrackingMode.ACTIVE,
    updateInterval: 5000,
    showAccuracyCircle: true,
    centerMapOnUpdate: false,
    smoothTransition: true,
  };
  
  private currentTrackingConfig: LocationTrackingConfig = this.DEFAULT_TRACKING_CONFIG;

  // Constantes de configuración
  private readonly BUFFER_SIZE = 5;
  private readonly MIN_DISTANCE_THRESHOLD = 3;
  private readonly MAX_ACCURACY_THRESHOLD = 30;
  private readonly STABLE_ACCURACY_THRESHOLD = 15;
  private readonly MAX_CONSECUTIVE_UPDATES = 8;
  private readonly BETTER_ACCURACY_RATIO = 0.8;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly MAX_BROWSER_ACCURACY = 100;

  private readonly HIGH_PRECISION_CONFIG: LocationConfig = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  } as const;

  private readonly STANDARD_CONFIG: LocationConfig = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 1000,
  } as const;

  private readonly WATCH_CONFIG: LocationConfig = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000,
  } as const;

  private readonly FALLBACK_CONFIG: LocationConfig = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 10000,
  } as const;

  // Signals para estado reactivo
  private readonly _currentLocation = signal<UserLocation | null>(null);
  private readonly _isWatching = signal(false);
  private readonly _permissionStatus = signal<LocationPermissionStatus>({
    granted: false,
    denied: false,
    restricted: false,
  });
  private readonly _isLocationStable = signal(false);
  private readonly _consecutiveUpdatesCount = signal(0);

  // NUEVAS PROPIEDADES para tracking de ubicación en tiempo real
  private readonly _isRealTimeTracking = signal(false);
  private readonly _trackingMode = signal<LocationTrackingMode>(LocationTrackingMode.OFF);
  private readonly _userLocationData = signal<UserLocationData | null>(null);
  private realTimeWatchId: string | null = null;

  // Estado interno
  private watchId: string | null = null;
  private lastKnownLocation: UserLocation | null = null;
  private locationBuffer: UserLocation[] = [];

  // Computed signals
  readonly currentLocation = computed(() => this._currentLocation());
  readonly isWatching = computed(() => this._isWatching());
  readonly permissionStatus = computed(() => this._permissionStatus());
  readonly isLocationStable = computed(() => this._isLocationStable());

  readonly hasLocation = computed(() => this._currentLocation() !== null);
  readonly locationAccuracy = computed(() => this._currentLocation()?.accuracy ?? 0);
  readonly isHighAccuracy = computed(
    () => this.locationAccuracy() <= this.STABLE_ACCURACY_THRESHOLD
  );

  //Computed signals publicos para tracking en tiempo real
  readonly isRealTimeTracking = computed(() => this._isRealTimeTracking());
  readonly trackingMode = computed(() => this._trackingMode());
  readonly userLocationData = computed(() => this._userLocationData());
  readonly hasUserLocation = computed(() => this._userLocationData() !== null);

  private readonly platform = inject(Platform);
  private readonly mapService = inject(MapService);
  private readonly logger = inject(LoggerService);

  constructor() {
    this.logger.geo('GeolocationService initialized');
    this.checkPermissions();

    effect(() => {
      const location = this._currentLocation();
      if (location) {
        this.logger.geo('Location updated:', {
          coords: location.coords,
          accuracy: `${location.accuracy}m`,
          stable: this._isLocationStable(),
        });
      }
    });
  }

  getCurrentLocation(): Observable<LatLng | null> {
    this.logger.geo('Getting current location...');

    if (!this.platform.is('capacitor')) {
      return this.getBrowserLocation();
    }

    return from(this.getCapacitorLocation());
  }

  async startWatching(): Promise<void> {
    this.logger.geo('Starting location watching...');

    if (this._isWatching()) {
      this.logger.warn('Already watching location');
      return;
    }

    try {
      const permissions = await this.requestPermissions();
      if (!permissions.granted) {
        this.logger.error('Location permissions not granted');
        return;
      }

      this._isWatching.set(true);

      if (this.platform.is('capacitor')) {
        await this.startCapacitorWatch();
      } else {
        this.startBrowserWatch();
      }
    } catch (error) {
      this.logger.error('Error starting location watch:', error);
      this._isWatching.set(false);
    }
  }

  async stopWatching(): Promise<void> {
    this.logger.geo('Stopping location watching...');

    if (this.watchId) {
      if (this.platform.is('capacitor')) {
        await Geolocation.clearWatch({ id: this.watchId });
      } else {
        navigator.geolocation.clearWatch(parseInt(this.watchId));
      }
      this.watchId = null;
    }

    this._isWatching.set(false);
  }

  resetLocationState(): void {
    this.logger.geo('Resetting location state...');
    this._isLocationStable.set(false);
    this._consecutiveUpdatesCount.set(0);
    this.locationBuffer = [];
  }

  async getHighPrecisionLocation(): Promise<LatLng | null> {
    this.logger.geo('Getting high precision location...');

    try {
      if (this.platform.is('capacitor')) {
        const position = await Geolocation.getCurrentPosition(
          this.HIGH_PRECISION_CONFIG
        );

        const location = this.createCapacitorLocation(position);

        this._currentLocation.set(location);
        this.mapService.updateUserLocation(location.coords);
        this.lastKnownLocation = location;

        this._isLocationStable.set(false);
        this._consecutiveUpdatesCount.set(0);

        this.logger.geo('High precision location obtained:', location.coords);
        return location.coords;
      } else {
        return this.getBrowserHighPrecisionLocation();
      }
    } catch (error) {
      this.logger.error('Error getting high precision location:', error);
      return null;
    }
  }

  async centerMapOnUserLocation(): Promise<void> {
    this.logger.geo('Getting single precise location...');

    try {
      if (this._isWatching()) {
        this.logger.geo('Stopping continuous tracking for precise location...');
        await this.stopWatching();
      }

      this.resetLocationState();

      const coords = await this.getHighPrecisionLocation();

      if (coords) {
        this.logger.geo('Precise location obtained - updating marker');
        this.mapService.updateUserLocation(coords);
        this.mapService.centerMap(coords.lat, coords.lng, 15);

        this._isLocationStable.set(true);
        this._consecutiveUpdatesCount.set(this.MAX_CONSECUTIVE_UPDATES);
      } else {
        throw new Error('No se pudo obtener ubicación de alta precisión');
      }
    } catch (error) {
      this.logger.error('Error centering map on user location:', error);

      const currentLocation = this._currentLocation();
      if (currentLocation) {
        this.logger.geo('Using cached location as fallback...');
        this.mapService.updateUserLocation(currentLocation.coords);
        this.mapService.centerMap(
          currentLocation.coords.lat,
          currentLocation.coords.lng,
          14
        );
        this._isLocationStable.set(true);
      }
    }
  } 

  public destroy(): void {
    this.stopWatching();
    this.locationBuffer = [];
    this.lastKnownLocation = null;
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3;
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

  private smoothLocation(newLocation: UserLocation): UserLocation {
    this.locationBuffer.push(newLocation);

    if (this.locationBuffer.length > this.BUFFER_SIZE) {
      this.locationBuffer.shift();
    }

    if (this.locationBuffer.length === 1) {
      return newLocation;
    }

    let totalWeight = 0;
    let avgLat = 0;
    let avgLng = 0;

    this.locationBuffer.forEach((location, index) => {
      const accuracyWeight = Math.max(1, 100 - location.accuracy);
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
      accuracy: newLocation.accuracy,
      timestamp: newLocation.timestamp,
      heading: newLocation.heading,
      speed: newLocation.speed,
    };
  }

  private shouldUpdateLocation(newLocation: UserLocation): boolean {
    if (!this.lastKnownLocation) {
      this.logger.geo('First location - updating immediately');
      return true;
    }

    if (newLocation.accuracy > this.MAX_ACCURACY_THRESHOLD) {
      this.logger.geo(
        'Skipping location update - poor accuracy:',
        `${newLocation.accuracy}m`
      );
      return false;
    }

    if (
      this._isLocationStable() &&
      newLocation.accuracy > this.STABLE_ACCURACY_THRESHOLD &&
      this._consecutiveUpdatesCount() > this.MAX_CONSECUTIVE_UPDATES
    ) {
      this.logger.geo('Location is stable - ignoring minor updates');
      return false;
    }

    const distance = this.calculateDistance(
      this.lastKnownLocation.coords.lat,
      this.lastKnownLocation.coords.lng,
      newLocation.coords.lat,
      newLocation.coords.lng
    );

    const significantMovement = distance >= this.MIN_DISTANCE_THRESHOLD;
    const betterAccuracy =
      newLocation.accuracy <
      this.lastKnownLocation.accuracy * this.BETTER_ACCURACY_RATIO;
    const highAccuracyReading =
      newLocation.accuracy <= this.STABLE_ACCURACY_THRESHOLD;

    if (
      highAccuracyReading &&
      !significantMovement &&
      this._consecutiveUpdatesCount() >= 3
    ) {
      this._isLocationStable.set(true);
      this.logger.geo(
        'GPS location stabilized at accuracy:',
        `${newLocation.accuracy}m`
      );
    }

    if (
      significantMovement ||
      betterAccuracy ||
      (!this._isLocationStable() && highAccuracyReading)
    ) {
      this._consecutiveUpdatesCount.update((count) => count + 1);
      this.logger.geo(
        `Location update: moved ${distance.toFixed(1)}m, accuracy: ${newLocation.accuracy}m`
      );
      return true;
    }

    this.logger.geo(`Skipping minor GPS variation: ${distance.toFixed(1)}m`);
    return false;
  }

  private processLocationUpdate(rawLocation: UserLocation): void {
    if (this._isLocationStable()) {
      this.logger.geo('Location is stable - ignoring GPS update');
      return;
    }

    if (!this.shouldUpdateLocation(rawLocation)) {
      return;
    }

    const smoothedLocation = this.smoothLocation(rawLocation);

    this._currentLocation.set(smoothedLocation);
    this.mapService.updateUserLocation(smoothedLocation.coords);
    this.lastKnownLocation = smoothedLocation;
  }

  private async checkPermissions(): Promise<void> {
    try {
      if (this.platform.is('capacitor')) {
        const status = await Geolocation.checkPermissions();
        this._permissionStatus.set({
          granted: status.location === 'granted',
          denied: status.location === 'denied',
          restricted: false,
        });
      } else {
        this._permissionStatus.set({
          granted: 'geolocation' in navigator,
          denied: false,
          restricted: false,
        });
      }
    } catch (error) {
      this.logger.error('Error checking permissions:', error);
    }
  }

  private async requestPermissions(): Promise<LocationPermissionStatus> {
    try {
      if (this.platform.is('capacitor')) {
        const status = await Geolocation.requestPermissions();
        const permissionStatus = {
          granted: status.location === 'granted',
          denied: status.location === 'denied',
          restricted: false,
        };

        this._permissionStatus.set(permissionStatus);
        return permissionStatus;
      } else {
        return {
          granted: 'geolocation' in navigator,
          denied: false,
          restricted: false,
        };
      }
    } catch (error) {
      this.logger.error('Error requesting permissions:', error);
      return { granted: false, denied: true, restricted: false };
    }
  }

  private getBrowserLocation(): Observable<LatLng | null> {
    if (!('geolocation' in navigator)) {
      this.logger.error('Geolocation not supported in browser');
      return from(Promise.resolve(null));
    }

    return new Observable((observer) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = this.createBrowserLocation(position);

          this.logger.geo('Browser location obtained:', {
            coords: location.coords,
            accuracy: `${location.accuracy}m`,
          });

          if (location.accuracy <= this.MAX_BROWSER_ACCURACY) {
            this.processLocationUpdate(location);
            observer.next(location.coords);
          } else {
            this.logger.warn('Browser location too inaccurate:', `${location.accuracy}m`);
            observer.next(null);
          }
          observer.complete();
        },
        (error) => {
          if (window.location.pathname.includes('/admin/user-management')) {
            this.logger.debug('Geolocation not available in admin context');
          } else {
            this.logger.warn('Browser geolocation error:', error.message);
          }
          observer.next(null);
          observer.complete();
        },
        this.STANDARD_CONFIG
      );
    });
  }

  private getBrowserHighPrecisionLocation(): Promise<LatLng | null> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = this.createBrowserLocation(position);

          this._currentLocation.set(location);
          this.mapService.updateUserLocation(location.coords);
          this.lastKnownLocation = location;
          this._isLocationStable.set(false);
          this._consecutiveUpdatesCount.set(0);

          resolve(location.coords);
        },
        (error) => reject(error),
        this.HIGH_PRECISION_CONFIG
      );
    });
  }

  private async getCapacitorLocation(): Promise<LatLng | null> {
    try {
      this.logger.geo('Requesting high-accuracy GPS location...');

      const position = await Geolocation.getCurrentPosition(this.STANDARD_CONFIG);
      const location = this.createCapacitorLocation(position);

      this.logger.geo('Capacitor location obtained:', {
        coords: location.coords,
        accuracy: `${location.accuracy}m`,
      });

      if (location.accuracy <= this.MAX_BROWSER_ACCURACY) {
        this.processLocationUpdate(location);
        return location.coords;
      } else {
        this.logger.warn('Location accuracy too low:', `${location.accuracy}m`);
        return this.retryLocationWithBetterAccuracy();
      }
    } catch (error) {
      this.logger.error('Capacitor geolocation error:', error);
      return this.getFallbackLocation();
    }
  }

  private async getFallbackLocation(): Promise<LatLng | null> {
    try {
      this.logger.geo('Retrying with fallback configuration...');
      const fallbackPosition = await Geolocation.getCurrentPosition(
        this.FALLBACK_CONFIG
      );

      const location = this.createCapacitorLocation(fallbackPosition);
      this.logger.geo('Fallback location obtained:', location);
      this.processLocationUpdate(location);
      return location.coords;
    } catch (error) {
      this.logger.error('Fallback geolocation also failed:', error);
      return null;
    }
  }

  private async retryLocationWithBetterAccuracy(): Promise<LatLng | null> {
    try {
      this.logger.geo('Retrying for better accuracy...');
      await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY_MS));

      const position = await Geolocation.getCurrentPosition(this.STANDARD_CONFIG);
      const location = this.createCapacitorLocation(position);

      this.logger.geo('Retry location result:', {
        coords: location.coords,
        accuracy: `${location.accuracy}m`,
      });

      this.processLocationUpdate(location);
      return location.coords;
    } catch (error) {
      this.logger.error('Retry failed:', error);
      return null;
    }
  }

  // NUEVOS MÉTODOS para tracking en tiempo real

  /**
   * Inicia el tracking de ubicación en tiempo real
   * Este método actualiza continuamente la ubicación del usuario en el mapa
   */
  async startRealTimeTracking(config?: Partial<LocationTrackingConfig>): Promise<void> {
    if (this._isRealTimeTracking()) {
      this.logger.warn('Real-time tracking already active');
      return;
    }

    this.currentTrackingConfig = {
      ...this.DEFAULT_TRACKING_CONFIG,
      ...config,
    };

    this.logger.geo('Starting real-time location tracking', {
      mode: this.currentTrackingConfig.mode,
      interval: this.currentTrackingConfig.updateInterval,
    });

    try {
      const permissions = await this.requestPermissions();
      if (!permissions.granted) {
        this.logger.error('Location permissions denied for real-time tracking');
        throw new Error('Location permissions required');
      }

      this._isRealTimeTracking.set(true);
      this._trackingMode.set(this.currentTrackingConfig.mode);

      if (this.platform.is('capacitor')) {
        await this.startCapacitorRealTimeWatch();
      } else {
        await this.startBrowserRealTimeWatch();
      }

      this.logger.geo('Real-time tracking started successfully');
    } catch (error) {
      this.logger.error('Failed to start real-time tracking:', error);
      this._isRealTimeTracking.set(false);
      this._trackingMode.set(LocationTrackingMode.OFF);
      throw error;
    }
  }

  /**
   * Detiene el tracking de ubicación en tiempo real
   */
  async stopRealTimeTracking(): Promise<void> {
    if (!this._isRealTimeTracking()) {
      return;
    }

    this.logger.geo('Stopping real-time location tracking');

    if (this.realTimeWatchId) {
      if (this.platform.is('capacitor')) {
        await Geolocation.clearWatch({ id: this.realTimeWatchId });
      } else {
        navigator.geolocation.clearWatch(parseInt(this.realTimeWatchId));
      }
      this.realTimeWatchId = null;
    }

    this._isRealTimeTracking.set(false);
    this._trackingMode.set(LocationTrackingMode.OFF);
    this.mapService.hideUserLocationMarker();
    
    this.logger.geo('Real-time tracking stopped');
  }

  /**
   * Actualiza la configuración del tracking en tiempo real
   */
  updateTrackingConfig(config: Partial<LocationTrackingConfig>): void {
    this.currentTrackingConfig = {
      ...this.currentTrackingConfig,
      ...config,
    };

    if (config.mode) {
      this._trackingMode.set(config.mode);
    }

    this.logger.geo('Tracking config updated', this.currentTrackingConfig);
  }

  /**
   * Inicia el watch de Capacitor para tracking en tiempo real
   */
  private async startCapacitorRealTimeWatch(): Promise<void> {
    const watchConfig = this.getWatchConfigForMode(this.currentTrackingConfig.mode);

    this.realTimeWatchId = await Geolocation.watchPosition(
      watchConfig,
      (position, error) => {
        if (error) {
          this.logger.error('Real-time watch position error:', error);
          return;
        }

        if (position) {
          this.handleRealTimeLocationUpdate(position);
        }
      }
    );
  }

  /**
   * Inicia el watch del navegador para tracking en tiempo real
   */
  private async startBrowserRealTimeWatch(): Promise<void> {
    const watchConfig = this.getWatchConfigForMode(this.currentTrackingConfig.mode);

    this.realTimeWatchId = navigator.geolocation.watchPosition(
      (position) => {
        this.handleRealTimeLocationUpdate(this.convertBrowserPosition(position));
      },
      (error) => {
        this.logger.error('Browser watch position error:', error);
      },
      watchConfig
    ).toString();
  }

  /**
   * Maneja la actualización de ubicación en tiempo real
   */
  private handleRealTimeLocationUpdate(position: Position): void {
    const locationData: UserLocationData = {
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined,
    };

    // Filtrar actualizaciones con baja precisión si estamos en modo HIGH_ACCURACY
    if (
      this.currentTrackingConfig.mode === LocationTrackingMode.HIGH_ACCURACY &&
      locationData.accuracy > this.STABLE_ACCURACY_THRESHOLD
    ) {
      this.logger.warn('Location accuracy too low, skipping update', {
        accuracy: locationData.accuracy,
        threshold: this.STABLE_ACCURACY_THRESHOLD,
      });
      return;
    }

    this._userLocationData.set(locationData);

    // Actualizar el marcador en el mapa
    this.mapService.updateUserLocationMarker(
      locationData.coords,
      locationData.accuracy,
      this.currentTrackingConfig
    );

    // Centrar el mapa si está configurado
    if (this.currentTrackingConfig.centerMapOnUpdate) {
      this.mapService.centerMapOnUserLocation(
        locationData.coords,
        this.currentTrackingConfig.smoothTransition
      );
    }
  }

  /**
   * Obtiene la configuración de watch según el modo
   */
  private getWatchConfigForMode(mode: LocationTrackingMode): LocationConfig {
    switch (mode) {
      case LocationTrackingMode.HIGH_ACCURACY:
        return this.HIGH_PRECISION_CONFIG;
      case LocationTrackingMode.ACTIVE:
        return this.WATCH_CONFIG;
      case LocationTrackingMode.PASSIVE:
        return this.STANDARD_CONFIG;
      default:
        return this.FALLBACK_CONFIG;
    }
  }

  /**
   * Convierte la posición del navegador al formato de Capacitor
   */
  private convertBrowserPosition(position: GeolocationPosition): Position {
    return {
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
      },
      timestamp: position.timestamp,
    };
  }

  private startBrowserWatch(): void {
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = this.createBrowserLocation(position);
        this.processLocationUpdate(location);
      },
      (error) => {
        this.logger.error('Browser watch error:', error);
      },
      this.WATCH_CONFIG
    );

    this.watchId = watchId.toString();
  }

  private async startCapacitorWatch(): Promise<void> {
    try {
      this.watchId = await Geolocation.watchPosition(
        this.WATCH_CONFIG,
        (position, err) => {
          if (err) {
            this.logger.error('Capacitor watch error:', err);
            return;
          }

          if (position) {
            const location = this.createCapacitorLocation(position);
            this.processLocationUpdate(location);
          }
        }
      );
    } catch (error) {
      this.logger.error('Error starting Capacitor watch:', error);
      this.stopWatching();
    }
  }

  private createBrowserLocation(position: GeolocationPosition): UserLocation {
    return {
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined,
    };
  }

  private createCapacitorLocation(position: Position): UserLocation {
    return {
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined,
    };
  }
}

