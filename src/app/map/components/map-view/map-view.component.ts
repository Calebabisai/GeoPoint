import {
  Component,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';

import { MapService } from '../../services/map.service';
import { MapDataService } from '../../../shared/services/map-data.service';
import { MapControlsComponent } from '../../../shared/components/map-controls/map-controls.component';
import {
  MapMarker as MapDataMarker,
  MapZone as MapDataZone,
} from '../../../shared/models/map-data.model';
import { MapMarker as LegacyMarker } from '../../../shared/models/marker.model';
import { MapZone as LegacyZone } from '../../../shared/models/zone.model';
import { CommonModule } from '@angular/common';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MapCacheService } from '../../services/map-cache.service';
import { LoggerService } from 'src/app/shared/services/logger.service';
import { IonSpinner, IonChip, IonIcon, IonLabel } from "@ionic/angular/standalone";

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

  readonly markersCount = computed(() => this.markers().length);
  readonly zonesCount = computed(() => this.zones().length);

  constructor() {
    //Esperar ubicacion antes de inicializar mapa
    this.initializeWithLocation();

    setTimeout(() => {
      this.initializeMap();
      setTimeout(() => {
        if (this._mapInitialized()) {
          this.syncMarkers();
          this.syncZones();
        }
      }, this.DATA_LOAD_DELAY_MS);
    }, this.MAP_INIT_DELAY_MS);

    effect(() => {
      if (this._mapInitialized()) {
        this.syncMarkers();
      }
    });

    effect(() => {
      if (this._mapInitialized()) {
        this.syncZones();
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
        // Ubicación por defecto (centro de tu ciudad/organización)
        const defaultLocation = { lat: 19.4326, lng: -99.1332 }; // CDMX ejemplo
        this._userLocation.set(defaultLocation);
        this.logger.warn(' Usando ubicación por defecto');
      }

      this._isLoadingLocation.set(false);

      // 2. Inicializar mapa
      await this.initializeMap();

      // 3. Precargar área cercana (en background)
      if (location) {
        setTimeout(async () => {
          const hasCached = await this.mapCacheService.hasCachedTiles();
          if (!hasCached) {
            await this.mapCacheService.precacheOrganizationArea(
              location.lat,
              location.lng,
              {
                maxZoom: 16, // Menos zoom = menos tiles = más rápido
                minZoom: 13,
              }
            );
          }
        }, 2000); // Esperar 2 segundos después de cargar el mapa
      }

      // 4. Cargar marcadores y zonas
      setTimeout(() => {
        if (this._mapInitialized()) {
          this.syncMarkers();
          this.syncZones();
        }
      }, this.DATA_LOAD_DELAY_MS);

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

    loadedMarkers.forEach((markerId) => {
      if (!currentMarkerIds.has(markerId)) {
        this.mapService.removeMarker(markerId);
        const updated = new Set(loadedMarkers);
        updated.delete(markerId);
        this._loadedMarkers.set(updated);
      }
    });

    currentMarkers.forEach((marker) => {
      if (marker.id && !loadedMarkers.has(marker.id)) {
        const legacyMarker = this.convertToLegacyMarker(marker);
        this.mapService.addMarker(legacyMarker);
        const updated = new Set(loadedMarkers);
        updated.add(marker.id);
        this._loadedMarkers.set(updated);
      }
    });
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

    loadedZones.forEach((zoneId) => {
      if (!currentZoneIds.has(zoneId)) {
        this.mapService.removeZone(zoneId);
        const updated = new Set(loadedZones);
        updated.delete(zoneId);
        this._loadedZones.set(updated);
      }
    });

    currentZones.forEach((zone) => {
      if (zone.id && !loadedZones.has(zone.id)) {
        const legacyZone = this.convertToLegacyZone(zone);
        this.mapService.addZone(legacyZone);
        const updated = new Set(loadedZones);
        updated.add(zone.id);
        this._loadedZones.set(updated);
      }
    });
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
}
