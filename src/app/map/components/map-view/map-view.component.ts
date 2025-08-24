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
import { FirestoreService } from '../../../services/firestore.service';
import { MapControlsComponent } from '../../../shared/components/map-controls/map-controls.component';
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
  private firestoreService = inject(FirestoreService);

  // Subscripciones para cleanup
  private markersSubscription: Subscription = new Subscription();
  private zonesSubscription: Subscription = new Subscription();

  // Propiedades para el debug y estado
  showDebug = false; // Cambiar a true para mostrar debug
  mapInitialized = false;
  markersCount = 0;
  zonesCount = 0;

  // Maps para trackear elementos existentes
  private loadedMarkers = new Set<string>();
  private loadedZones = new Set<string>();

  ngOnInit() {
    // Esperar a que el DOM esté listo antes de inicializar el mapa
    setTimeout(() => {
      this.initializeMap();
      this.loadExistingData();
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

    // Suscripción reactiva a marcadores
    this.markersSubscription = this.firestoreService
      .getMarkers()
      .subscribe((markers) => {
        console.log('📍 Markers data updated:', markers.length);

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
            this.mapService.addMarker(marker);
            this.loadedMarkers.add(marker.id);
          }
        });

        this.markersCount = markers.length;
      });

    // Suscripción reactiva a zonas
    this.zonesSubscription = this.firestoreService
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
            this.mapService.addZone(zone);
            this.loadedZones.add(zone.id);
          }
        });

        this.zonesCount = zones.length;
      });

    console.log('✅ Real-time subscriptions established');
  }
}
