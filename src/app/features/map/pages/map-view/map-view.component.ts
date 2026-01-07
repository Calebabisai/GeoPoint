import {
  Component,
  inject,
  signal,
  computed,
  effect,
  untracked
} from '@angular/core';

import { MapService } from '../../services/map.service';
import { MapDataService } from '../../services/map-data.service';
import { MapControlsComponent } from '../../components/map-controls/map-controls.component';
import {
  MapMarker as MapDataMarker,
  MapZone as MapDataZone,
} from '../../models/map-data.model';
import { MapMarker as LegacyMarker } from '../../models/marker.model';
import { MapZone as LegacyZone } from '../../models/zone.model';
import { CommonModule } from '@angular/common';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MapCacheService } from '../../services/map-cache.service';
import { LoggerService } from 'src/app/core/services/logger.service';
import { IonSpinner, IonChip, IonIcon, IonLabel } from "@ionic/angular/standalone";
import { MapRoute } from '../../models/route.model';

type MarkerType = 'marker' | 'house' | 'poi';
type LegacyZoneType = 'zone';

interface MarkerTypeMap {
  info: 'house';
  success: 'poi';
  default: 'marker';
  warning: 'marker';
  danger: 'marker';
}
/**
 * @component MapViewComponent
 * @description
 * Componente principal para la visualización y gestión del mapa interactivo.
 *
 * Este componente es responsable de:
 * - Inicializar el mapa usando Leaflet
 * - Gestionar la sincronización en tiempo real de marcadores y zonas desde Firebase
 * - Convertir entre modelos de datos (nuevo formato vs legacy)
 * - Mantener el estado de elementos cargados en el mapa
 * - Limpiar recursos y subscripciones al destruirse
 *
 * @example
 * ```html
 * <app-map-view></app-map-view>
 * ```
 *
 * @standalone true
 * @imports CommonModule, MapControlsComponent
 *
 * @author GeoPoint Team
 * @version 1.0.0
 */
@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss'],
  standalone: true,
  imports: [IonLabel, IonIcon, IonChip, IonSpinner, CommonModule, MapControlsComponent],
})
export class MapViewComponent {
  private readonly MAP_INIT_DELAY_MS = 200;
  private readonly DATA_LOAD_DELAY_MS = 500;
  private readonly RETRY_DELAY_MS = 500;
  private readonly CIRCLE_POINTS = 16;
  private readonly METERS_PER_DEGREE = 111000;
  private readonly DEFAULT_COLOR = '#3880ff';
  private readonly DEFAULT_ZONE_NUMBER = 1;

  private readonly MARKER_TYPE_MAP: MarkerTypeMap = {
    info: 'house',
    success: 'poi',
    default: 'marker',
    warning: 'marker',
    danger: 'marker',
  } as const;

  private readonly mapService = inject(MapService);
  private readonly mapDataService = inject(MapDataService);
  private readonly mapCacheService = inject(MapCacheService);
  private readonly logger = inject(LoggerService);


  private readonly _mapInitialized = signal(false);
  private readonly _loadedMarkers = signal<Set<string>>(new Set());
  private readonly _loadedZones = signal<Set<string>>(new Set());
  private readonly _loadedRoutes = signal<Set<string>>(new Set());

    // Signals para estado de carga
  private readonly _isLoadingLocation = signal(true);
  private readonly _userLocation = signal<{ lat: number; lng: number } | null>(null);
  
  readonly isLoadingLocation = this._isLoadingLocation.asReadonly();
  readonly userLocation = this._userLocation.asReadonly();
  readonly isCaching = this.mapCacheService.isCaching;
  readonly cacheStats = this.mapCacheService.cacheStats;

  readonly mapInitialized = computed(() => this._mapInitialized());

  readonly markers = toSignal(this.mapDataService.getMarkers(), {
    initialValue: [],
  });

  readonly zones = toSignal(this.mapDataService.getZones(), {
    initialValue: [],
  });

  readonly routes = toSignal(this.mapDataService.getRoutes(), {
    initialValue: [],
  });

  readonly markersCount = computed(() => this.markers().length);
  readonly zonesCount = computed(() => this.zones().length);
  readonly routesCount = computed(() => this.routes().length);

  constructor() {
    // Solo inicializar con ubicación (este método maneja todo)
    this.initializeWithLocation();

    // Effects para sincronizar cuando cambian los datos
    // Usamos un flag para evitar sincronización antes de que el mapa esté listo
    effect(() => {
      const initialized = this._mapInitialized();
      const currentMarkers = this.markers();
      // Solo sincronizar si el mapa está inicializado y hay datos
      if (initialized) {
        untracked(() => {
          // Pequeño delay para evitar race conditions
          setTimeout(() => this.syncMarkers(), 50);
        });
      }
    });

    effect(() => {
      const initialized = this._mapInitialized();
      const currentZones = this.zones();
      if (initialized) {
        untracked(() => {
          setTimeout(() => this.syncZones(), 50);
        });
      }
    });

    effect(() => {
      const initialized = this._mapInitialized();
      const currentRoutes = this.routes();
      if (initialized) {
        untracked(() => {
          setTimeout(() => this.syncRoutes(), 50);
        });
      }
    });

    this.mapService.markerClick$
      .pipe(takeUntilDestroyed())
      .subscribe((marker) => {
        // Handle marker click
      });

    this.mapService.zoneClick$
      .pipe(takeUntilDestroyed())
      .subscribe((zone) => {
        // Handle zone click
      });

    this.mapService.mapClick$
      .pipe(takeUntilDestroyed())
      .subscribe((coords) => {
        // Handle map click
      });
  }

  private async initializeWithLocation(): Promise<void> {
    try {
      // 1. Obtener ubicación del usuario
      const location = await this.mapCacheService.getCurrentPosition();
      
      if (location) {
        this._userLocation.set(location);
        this.logger.firebase(' Ubicación obtenida:', location);
      } else {
        // Ubicación por defecto
        const defaultLocation = { lat: 19.4326, lng: -99.1332 };
        this._userLocation.set(defaultLocation);
        this.logger.warn(' Usando ubicación por defecto');
      }

      this._isLoadingLocation.set(false);

      // 2. Inicializar mapa
      await this.initializeMap();

      // 3. Precargar área cercana (en background) - SOLO si hay ubicación real
      if (location) {
        setTimeout(async () => {
          try {
            const hasCached = await this.mapCacheService.hasCachedTiles();
            if (!hasCached) {
              await this.mapCacheService.precacheOrganizationArea(
                location.lat,
                location.lng,
                {
                  maxZoom: 16,
                  minZoom: 13,
                }
              );
            }
          } catch (e) {
            // Ignorar errores de caché
          }
        }, 2000);
      }

      // NO llamar a syncMarkers/Zones/Routes aquí - los effects lo manejan

    } catch (error) {
      this.logger.error('Error en inicialización con ubicación:', error);
      this._isLoadingLocation.set(false);
      // Continuar con ubicación por defecto
      await this.initializeMap();
    }
  }

  private async initializeMap(): Promise<void> {
    const mapContainer = document.getElementById('map-container');

    if (!mapContainer) {
      return;
    }

    try {
      await this.mapService.initMap('map-container');
      
      // Centrar en la ubicación del usuario
      const location = this._userLocation();
      if (location) {
        this.mapService.centerMap(location.lat, location.lng, 15);
      }
      
      this._mapInitialized.set(true);
    } catch (error) {
      this.logger.error('Error inicializando mapa:', error);
    }
  }

  private syncMarkers(): void {
    if (!this._mapInitialized()) {
      setTimeout(() => this.syncMarkers(), this.RETRY_DELAY_MS);
      return;
    }

    const currentMarkers = this.markers();
    const loadedMarkers = this._loadedMarkers();
    const currentMarkerIds = new Set(
      currentMarkers.map((m) => m.id).filter((id): id is string => !!id)
    );

    const newLoadedMarkers = new Set<string>();

    // Eliminar marcadores que ya no existen
    loadedMarkers.forEach((markerId) => {
      if (!currentMarkerIds.has(markerId)) {
        this.mapService.removeMarker(markerId);
      }
    });

    // Agregar marcadores nuevos
    currentMarkers.forEach((marker) => {
      if (marker.id) {
        if (!loadedMarkers.has(marker.id)) {
          const legacyMarker = this.convertToLegacyMarker(marker);
          this.mapService.addMarker(legacyMarker);
        }
        newLoadedMarkers.add(marker.id);
      }
    });

    this._loadedMarkers.set(newLoadedMarkers);
  }

  private syncZones(): void {
    if (!this._mapInitialized()) {
      setTimeout(() => this.syncZones(), this.RETRY_DELAY_MS);
      return;
    }

    const currentZones = this.zones();
    const loadedZones = this._loadedZones();
    const currentZoneIds = new Set(
      currentZones.map((z) => z.id).filter((id): id is string => !!id)
    );

    const newLoadedZones = new Set<string>();

    // Eliminar zonas que ya no existen
    loadedZones.forEach((zoneId) => {
      if (!currentZoneIds.has(zoneId)) {
        this.mapService.removeZone(zoneId);
      }
    });

    // Agregar zonas nuevas
    currentZones.forEach((zone) => {
      if (zone.id) {
        if (!loadedZones.has(zone.id)) {
          const legacyZone = this.convertToLegacyZone(zone);
          this.mapService.addZone(legacyZone);
        }
        newLoadedZones.add(zone.id);
      }
    });

    this._loadedZones.set(newLoadedZones);
  }

  private syncRoutes(): void {
    if (!this._mapInitialized()) {
      setTimeout(() => this.syncRoutes(), this.RETRY_DELAY_MS);
      return;
    }

    const currentRoutes = this.routes();
    const loadedRoutes = this._loadedRoutes();
    const currentRouteIds = new Set(
      currentRoutes.map((r) => r.id).filter((id): id is string => !!id)
    );

    // Crear nuevo Set para actualizar de una vez
    const newLoadedRoutes = new Set<string>();

    // Eliminar rutas que ya no existen en los datos
    loadedRoutes.forEach((routeId) => {
      if (!currentRouteIds.has(routeId)) {
        this.mapService.removeRoute(routeId);
      }
    });

    // Agregar rutas nuevas y mantener las existentes
    currentRoutes.forEach((route) => {
      if (route.id) {
        if (!loadedRoutes.has(route.id)) {
          // Ruta nueva, agregarla
          const convertedRoute = this.convertToMapRoute(route);
          this.mapService.addRoute(convertedRoute);
        }
        // Marcar como cargada (nueva o existente)
        newLoadedRoutes.add(route.id);
      }
    });

    // Actualizar el Set de rutas cargadas de una vez
    this._loadedRoutes.set(newLoadedRoutes);
  }

  private convertToLegacyMarker(newMarker: MapDataMarker): LegacyMarker {
    const legacyType: MarkerType =
      this.MARKER_TYPE_MAP[newMarker.type as keyof MarkerTypeMap] || 'marker';

    return {
      id: newMarker.id,
      title: newMarker.title,
      description: newMarker.description || '',
      lat: newMarker.latitude,
      lng: newMarker.longitude,
      color: newMarker.color || this.DEFAULT_COLOR,
      type: legacyType,
      createdBy: newMarker.createdBy,
      organizationId: newMarker.organizationId || '',
      createdAt: newMarker.createdAt,
    };
  }

  private convertToLegacyZone(newZone: MapDataZone): LegacyZone {
    let coordinates: { lat: number; lng: number }[] = [];

    if (newZone.type === 'polygon' && newZone.coordinates.polygon) {
      coordinates = newZone.coordinates.polygon.map((point) => ({
        lat: point[0],
        lng: point[1],
      }));
    } else if (newZone.type === 'circle' && newZone.coordinates.circle) {
      coordinates = this.convertCircleToPolygon(newZone.coordinates.circle);
    } else if (newZone.type === 'rectangle' && newZone.coordinates.rectangle) {
      coordinates = this.convertRectangleToPolygon(
        newZone.coordinates.rectangle
      );
    }

    return {
      id: newZone.id,
      name: newZone.name,
      description: newZone.description || '',
      coordinates,
      color: newZone.style.fillColor || this.DEFAULT_COLOR,
      number:
        newZone.metadata?.customFields?.['number'] || this.DEFAULT_ZONE_NUMBER,
      type: 'zone' as LegacyZoneType,
      createdBy: newZone.createdBy,
      organizationId: newZone.organizationId || '',
      createdAt: newZone.createdAt,
    };
  }

  private convertCircleToPolygon(circle: {
    center: [number, number];
    radius: number;
  }): { lat: number; lng: number }[] {
    const { center, radius } = circle;
    const coordinates: { lat: number; lng: number }[] = [];

    for (let i = 0; i < this.CIRCLE_POINTS; i++) {
      const angle = (i * 2 * Math.PI) / this.CIRCLE_POINTS;
      const lat =
        center[0] + (radius / this.METERS_PER_DEGREE) * Math.cos(angle);
      const lng =
        center[1] +
        (radius /
          (this.METERS_PER_DEGREE * Math.cos((center[0] * Math.PI) / 180))) *
          Math.sin(angle);
      coordinates.push({ lat, lng });
    }

    return coordinates;
  }

  private convertRectangleToPolygon(rectangle: {
    southwest: [number, number];
    northeast: [number, number];
  }): { lat: number; lng: number }[] {
    const { southwest: sw, northeast: ne } = rectangle;
    return [
      { lat: sw[0], lng: sw[1] },
      { lat: sw[0], lng: ne[1] },
      { lat: ne[0], lng: ne[1] },
      { lat: ne[0], lng: sw[1] },
    ];
  }

  private convertToMapRoute(route: any): MapRoute {
    // Los waypoints pueden venir como [{lat, lng}] o [[lat, lng]]
    let waypoints: [number, number][] = [];
    
    if (route.waypoints && route.waypoints.length > 0) {
      // Verificar si es array de objetos o array de arrays
      if (typeof route.waypoints[0] === 'object' && !Array.isArray(route.waypoints[0])) {
        // Es [{lat, lng}, ...] - convertir a [[lat, lng], ...]
        waypoints = route.waypoints.map((wp: {lat: number, lng: number}) => [wp.lat, wp.lng] as [number, number]);
      } else {
        // Ya es [[lat, lng], ...]
        waypoints = route.waypoints;
      }
    }

    return {
      id: route.id,
      name: route.name || '',
      description: route.description || '',
      waypoints: waypoints,
      color: route.color || '#3388ff',
      width: route.width || 4,
      createdBy: route.createdBy || '',
      createdAt: route.createdAt instanceof Date ? route.createdAt : new Date(),
      organizationId: route.organizationId || '',
    };
  }
}
