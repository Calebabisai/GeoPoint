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
  imports: [CommonModule, MapControlsComponent],
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

  private readonly _mapInitialized = signal(false);
  private readonly _loadedMarkers = signal<Set<string>>(new Set());
  private readonly _loadedZones = signal<Set<string>>(new Set());

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

  private initializeMap(): void {
    const mapContainer = document.getElementById('map-container');

    if (!mapContainer) {
      return;
    }

    try {
      this.mapService.initMap('map-container');
      this._mapInitialized.set(true);
    } catch (error) {
      // Map initialization failed
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
