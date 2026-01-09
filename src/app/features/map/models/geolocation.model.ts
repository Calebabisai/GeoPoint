// src/app/features/map/models/geolocation.model.ts

import { LatLng } from './map-model';

// ============================================
// PERMISSION MODELS
// ============================================

export interface LocationPermissionStatus {
  granted: boolean;
  denied: boolean;
  restricted: boolean;
}

// ============================================
// LOCATION DATA MODELS
// ============================================

export interface UserLocation {
  coords: LatLng;
  accuracy: number;
  timestamp: number;
  heading?: number;
  speed?: number;
}

export interface UserLocationData {
  coords: LatLng;
  accuracy: number;
  timestamp: number;
  heading?: number;
  speed?: number;
}

// ============================================
// CONFIGURATION MODELS
// ============================================

export interface LocationConfig {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

// ============================================
// TRACKING MODELS
// ============================================

export enum LocationTrackingMode {
  OFF = 'off',
  PASSIVE = 'passive',
  ACTIVE = 'active',
  HIGH_ACCURACY = 'high-accuracy'
}

export interface LocationTrackingConfig {
  mode: LocationTrackingMode;
  updateInterval: number;
  showAccuracyCircle: boolean;
  centerMapOnUpdate: boolean;
  smoothTransition: boolean;
}

export interface UserLocationState {
  isTracking: boolean;
  isVisible: boolean;
  currentLocation: UserLocationData | null;
  lastUpdate: number;
  accuracy: number;
}

// ============================================
// ERROR MODELS
// ============================================

export interface LocationError {
  code: LocationErrorCode;
  message: string;
  timestamp: number;
}

export enum LocationErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE = 'POSITION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}