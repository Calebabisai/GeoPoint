import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';

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
import * as L from 'leaflet';

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
export class MapViewComponent implements OnInit, OnDestroy {
  /** Servicio para operaciones del mapa (Leaflet) */
  private mapService = inject(MapService);

  /** Servicio para sincronización de datos con Firebase */
  private mapDataService = inject(MapDataService);

  /** Subscripción a cambios en marcadores desde Firestore */
  private markersSubscription: Subscription = new Subscription();

  /** Subscripción a cambios en zonas desde Firestore */
  private zonesSubscription: Subscription = new Subscription();

  /** Indica si el mapa ha sido inicializado correctamente */
  mapInitialized = false;

  /** Contador de marcadores cargados en el mapa */
  markersCount = 0;

  /** Contador de zonas cargadas en el mapa */
  zonesCount = 0;

  /**
   * Set de IDs de marcadores ya cargados en el mapa.
   * Previene duplicados y ayuda a detectar eliminaciones.
   */
  private loadedMarkers = new Set<string>();

  /**
   * Set de IDs de zonas ya cargadas en el mapa.
   * Previene duplicados y ayuda a detectar eliminaciones.
   */
  private loadedZones = new Set<string>();

  /**
   * @method convertToLegacyMarker
   * @description
   * Convierte un marcador del nuevo modelo de datos (MapDataMarker) al formato legacy
   * que utiliza el servicio de mapas basado en Leaflet.
   *
   * Mapeo de tipos:
   * - 'info' → 'house'
   * - 'success' → 'poi'
   * - 'default' | 'warning' | 'danger' → 'marker'
   *
   * @param {MapDataMarker} newMarker - Marcador en formato nuevo desde Firestore
   * @returns {LegacyMarker} Marcador en formato legacy compatible con MapService
   *
   * @private
   * @example
   * ```typescript
   * const legacy = this.convertToLegacyMarker({
   *   id: '123',
   *   title: 'Oficina Central',
   *   type: 'info',
   *   latitude: 19.4326,
   *   longitude: -99.1332
   * });
   * ```
   */
  private convertToLegacyMarker(newMarker: MapDataMarker): LegacyMarker {
    // Mapear tipos del nuevo sistema al legacy
    let legacyType: 'marker' | 'house' | 'poi' = 'marker';
    switch (newMarker.type) {
      case 'info':
        legacyType = 'house';
        break;
      case 'success':
        legacyType = 'poi';
        break;
      case 'default':
      case 'warning':
      case 'danger':
      default:
        legacyType = 'marker';
        break;
    }

    return {
      id: newMarker.id,
      title: newMarker.title,
      description: newMarker.description || '',
      lat: newMarker.latitude,
      lng: newMarker.longitude,
      color: newMarker.color || '#3880ff',
      type: legacyType,
      createdBy: newMarker.createdBy,
      organizationId: newMarker.organizationId || '',
      createdAt: newMarker.createdAt,
    };
  }

  /**
   * @method convertToLegacyZone
   * @description
   * Convierte una zona del nuevo modelo de datos (MapDataZone) al formato legacy.
   *
   * Soporta tres tipos de geometrías:
   * - **Polygon**: Array de coordenadas [lat, lng]
   * - **Circle**: Centro + radio → Convertido a polígono de 16 puntos
   * - **Rectangle**: Southwest + Northeast → Convertido a polígono de 4 esquinas
   *
   * @param {MapDataZone} newZone - Zona en formato nuevo desde Firestore
   * @returns {LegacyZone} Zona en formato legacy compatible con MapService
   *
   * @private
   * @example
   * ```typescript
   * const legacy = this.convertToLegacyZone({
   *   id: '456',
   *   name: 'Zona Norte',
   *   type: 'circle',
   *   coordinates: {
   *     circle: { center: [19.4326, -99.1332], radius: 500 }
   *   }
   * });
   * ```
   */
  private convertToLegacyZone(newZone: MapDataZone): LegacyZone {
    // Convertir coordenadas según el tipo
    let coordinates: { lat: number; lng: number }[] = [];

    if (newZone.type === 'polygon' && newZone.coordinates.polygon) {
      coordinates = newZone.coordinates.polygon.map((point) => ({
        lat: point[0],
        lng: point[1],
      }));
    } else if (newZone.type === 'circle' && newZone.coordinates.circle) {
      // Para círculos, creamos un polígono aproximado de 16 puntos
      const center = newZone.coordinates.circle.center;
      const radius = newZone.coordinates.circle.radius;
      const numPoints = 16;

      for (let i = 0; i < numPoints; i++) {
        const angle = (i * 2 * Math.PI) / numPoints;
        const lat = center[0] + (radius / 111000) * Math.cos(angle); // Aproximación: 1 grado ≈ 111km
        const lng =
          center[1] +
          (radius / (111000 * Math.cos((center[0] * Math.PI) / 180))) *
            Math.sin(angle);
        coordinates.push({ lat, lng });
      }
    } else if (newZone.type === 'rectangle' && newZone.coordinates.rectangle) {
      // Para rectángulos, crear las 4 esquinas
      const sw = newZone.coordinates.rectangle.southwest;
      const ne = newZone.coordinates.rectangle.northeast;
      coordinates = [
        { lat: sw[0], lng: sw[1] }, // Southwest
        { lat: sw[0], lng: ne[1] }, // Southeast
        { lat: ne[0], lng: ne[1] }, // Northeast
        { lat: ne[0], lng: sw[1] }, // Northwest
      ];
    }

    return {
      id: newZone.id,
      name: newZone.name,
      description: newZone.description || '',
      coordinates,
      color: newZone.style.fillColor || '#3880ff',
      number: newZone.metadata?.customFields?.['number'] || 1,
      type: 'zone',
      createdBy: newZone.createdBy,
      organizationId: newZone.organizationId || '',
      createdAt: newZone.createdAt,
    };
  }

  /**
   * @method ngOnInit
   * @description
   * Hook del ciclo de vida de Angular que se ejecuta al inicializar el componente.
   *
   * Flujo de inicialización:
   * 1. Espera 200ms para que el DOM esté completamente renderizado
   * 2. Inicializa el mapa de Leaflet
   * 3. Espera 500ms adicionales para que el mapa esté listo
   * 4. Carga datos existentes desde Firebase
   * 5. Configura listeners para eventos del mapa (clicks en markers, zones, mapa)
   *
   * @lifecycle
   * @public
   */
  ngOnInit() {
    // Esperar a que el DOM esté listo antes de inicializar el mapa
    setTimeout(() => {
      this.initializeMap();

      // Esperar un poco más para asegurar que el mapa esté completamente listo
      setTimeout(() => {
        console.log('🚀 Starting data load after map initialization...');
        this.loadExistingData();
      }, 500);
    }, 200);

    // Subscribirse a cambios en marcadores y zonas
    this.mapService.markerClick$.subscribe((marker) => {
      console.log('Marker clicked:', marker);
    });

    this.mapService.zoneClick$.subscribe((zone) => {
      console.log('Zone clicked:', zone);
    });

    // Agregar debugging para clicks del mapa
    this.mapService.mapClick$.subscribe((coords) => {
      console.log('🗺️ Map clicked at:', coords);
    });
  }

  /**
   * @method ngOnDestroy
   * @description
   * Hook del ciclo de vida de Angular que se ejecuta al destruir el componente.
   *
   * Limpia todas las subscripciones activas para prevenir memory leaks:
   * - Unsubscribe de marcadores
   * - Unsubscribe de zonas
   *
   * @lifecycle
   * @public
   */
  ngOnDestroy() {
    // Cleanup de subscripciones
    this.markersSubscription.unsubscribe();
    this.zonesSubscription.unsubscribe();
    console.log('🧹 MapViewComponent subscriptions cleaned up');
  }

  /**
   * @method initializeMap
   * @description
   * Inicializa el mapa de Leaflet en el contenedor DOM especificado.
   *
   * Proceso:
   * 1. Busca el contenedor con ID 'map-container'
   * 2. Valida que exista el elemento DOM
   * 3. Llama a MapService.initMap() para crear la instancia de Leaflet
   * 4. Marca mapInitialized como true si tiene éxito
   *
   * @private
   * @throws {Error} Si el contenedor del mapa no se encuentra en el DOM
   */
  private initializeMap() {
    console.log('Intentando inicializar mapa...');
    const mapContainer = document.getElementById('map-container');

    if (!mapContainer) {
      console.error('Contenedor del mapa no encontrado!');
      return;
    }

    try {
      this.mapService.initMap('map-container');
      this.mapInitialized = true;
      console.log('Mapa inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar mapa:', error);
    }
  }

  /**
   * @method loadExistingData
   * @description
   * Establece subscripciones en tiempo real a Firestore para marcadores y zonas.
   *
   * **Características clave:**
   * - Sincronización bidireccional: Agregar/Eliminar/Actualizar
   * - Detección automática de elementos eliminados en Firestore
   * - Prevención de duplicados usando Sets (loadedMarkers, loadedZones)
   * - Manejo de reintentos si el mapa no está listo
   *
   * **Flujo de marcadores:**
   * 1. Recibe array actualizado desde Firestore
   * 2. Identifica marcadores eliminados (en Set pero no en array)
   * 3. Elimina del mapa los marcadores borrados
   * 4. Agrega nuevos marcadores que no estén en el Set
   * 5. Actualiza contador de marcadores
   *
   * **Flujo de zonas:**
   * - Mismo proceso que marcadores pero para zonas geográficas
   *
   * @private
   * @requires mapInitialized === true
   */
  private loadExistingData() {
    console.log('🔄 Setting up real-time data subscriptions...');
    console.log('🗺️ Map initialized?', this.mapInitialized);

    // Verificar que el mapa esté inicializado antes de suscribirse
    if (!this.mapInitialized) {
      console.error('❌ Map not initialized yet! Delaying data load...');
      setTimeout(() => this.loadExistingData(), 500);
      return;
    }

    // Suscripción reactiva a marcadores
    this.markersSubscription = this.mapDataService
      .getMarkers()
      .subscribe((markers) => {
        console.log('📍 Markers data updated:', markers.length);
        console.log('📍 Markers raw data:', markers);

        // Identificar marcadores eliminados
        const currentMarkerIds = new Set(
          markers.map((m) => m.id).filter((id) => id)
        );

        // Eliminar marcadores que ya no existen en Firestore
        this.loadedMarkers.forEach((markerId) => {
          if (!currentMarkerIds.has(markerId)) {
            console.log('🗑️ Removing deleted marker from map:', markerId);
            this.mapService.removeMarker(markerId);
            this.loadedMarkers.delete(markerId);
          }
        });

        // Agregar o actualizar marcadores
        markers.forEach((marker) => {
          if (marker.id && !this.loadedMarkers.has(marker.id)) {
            console.log('➕ Adding new marker to map:', marker.id);
            console.log('🔄 Converting marker:', marker);
            const legacyMarker = this.convertToLegacyMarker(marker);
            console.log('🔄 Legacy marker:', legacyMarker);
            const markerId = this.mapService.addMarker(legacyMarker);
            console.log('✅ Marker added with ID:', markerId);
            this.loadedMarkers.add(marker.id);
          } else if (marker.id) {
            console.log('⏭️ Marker already loaded:', marker.id);
          }
        });

        this.markersCount = markers.length;
      });

    // Suscripción reactiva a zonas
    this.zonesSubscription = this.mapDataService
      .getZones()
      .subscribe((zones) => {
        console.log('🏗️ Zones data updated:', zones.length);

        // Identificar zonas eliminadas
        const currentZoneIds = new Set(
          zones.map((z) => z.id).filter((id) => id)
        );

        // Eliminar zonas que ya no existen en Firestore
        this.loadedZones.forEach((zoneId) => {
          if (!currentZoneIds.has(zoneId)) {
            console.log('🗑️ Removing deleted zone from map:', zoneId);
            this.mapService.removeZone(zoneId);
            this.loadedZones.delete(zoneId);
          }
        });

        // Agregar o actualizar zonas
        zones.forEach((zone) => {
          if (zone.id && !this.loadedZones.has(zone.id)) {
            console.log('➕ Adding new zone to map:', zone.id);
            const legacyZone = this.convertToLegacyZone(zone);
            this.mapService.addZone(legacyZone);
            this.loadedZones.add(zone.id);
          }
        });

        this.zonesCount = zones.length;
      });

    console.log('✅ Real-time subscriptions established');
  }
}
