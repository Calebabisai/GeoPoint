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

@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss'],
  standalone: true,
  imports: [CommonModule, MapControlsComponent],
})
export class MapViewComponent implements OnInit, OnDestroy {
  private mapService = inject(MapService);
  private mapDataService = inject(MapDataService);

  // Subscripciones para cleanup
  private markersSubscription: Subscription = new Subscription();
  private zonesSubscription: Subscription = new Subscription();

  // Propiedades para el estado
  mapInitialized = false;
  markersCount = 0;
  zonesCount = 0;

  // Maps para trackear elementos existentes
  private loadedMarkers = new Set<string>();
  private loadedZones = new Set<string>();

  /**
   * Convierte un MapMarker del nuevo modelo al modelo legacy
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
      organizationId: newMarker.organizationId || '', // Mapear organizationId
      createdAt: newMarker.createdAt,
    };
  }

  /**
   * Convierte un MapZone del nuevo modelo al modelo legacy
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
      // Para círculos, creamos un polígono aproximado
      const center = newZone.coordinates.circle.center;
      const radius = newZone.coordinates.circle.radius;
      const numPoints = 16;

      for (let i = 0; i < numPoints; i++) {
        const angle = (i * 2 * Math.PI) / numPoints;
        const lat = center[0] + (radius / 111000) * Math.cos(angle); // Aproximación
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
      number: newZone.metadata?.customFields?.['number'] || 1, // ✅ USAR el número real de metadata
      type: 'zone', // Mapear a tipo legacy
      createdBy: newZone.createdBy,
      organizationId: newZone.organizationId || '', // Mapear organizationId
      createdAt: newZone.createdAt,
    };
  }

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

  ngOnDestroy() {
    // Cleanup de subscripciones
    this.markersSubscription.unsubscribe();
    this.zonesSubscription.unsubscribe();
    console.log('🧹 MapViewComponent subscriptions cleaned up');
  }

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
