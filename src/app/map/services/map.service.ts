import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import * as L from 'leaflet';
import { MapMarker } from '../../shared/models/marker.model';
import { MapZone } from '../../shared/models/zone.model';

export interface LatLng {
  lat: number;
  lng: number;
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private map: L.Map | undefined;
  private userMarker: L.Marker | undefined;
  private markers: Map<string, L.Marker> = new Map();
  private zones: Map<string, L.Polygon> = new Map();

  mapClick$ = new Subject<LatLng>();
  markerClick$ = new Subject<MapMarker>();
  zoneClick$ = new Subject<MapZone>();
  markerDelete$ = new Subject<string>();
  zoneDelete$ = new Subject<string>();

  // Modo de eliminación
  private deleteMode = false;

  // Estado de creación
  private isCreatingMarker = false;
  private isCreatingZone = false;

  // Colores predefinidos para zonas
  private zoneColors = {
    red: '#FF6B6B',
    blue: '#4ECDC4',
    green: '#45B7D1',
    yellow: '#FFA07A',
    purple: '#D6A2E8',
    orange: '#FFB347',
  };

  initMap(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with id ${containerId} not found`);
      return;
    }

    // Asegurarse de que el contenedor tiene dimensiones
    if (container.offsetHeight === 0 || container.offsetWidth === 0) {
      console.warn('Container has no dimensions, setting minimum size');
      container.style.height = '100vh';
      container.style.width = '100%';
    }

    this.map = L.map(containerId, {
      center: [25.6866, -100.3161],
      zoom: 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Esperar a que el mapa se renderice completamente antes de agregar listeners
    setTimeout(() => {
      // Escuchar clicks en el mapa
      this.map!.on('click', (e: L.LeafletMouseEvent) => {
        console.log('🗺️ LEAFLET CLICK EVENT:', e.latlng);
        this.mapClick$.next({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
      });

      // Invalidar el tamaño para asegurar renderizado correcto
      this.map!.invalidateSize();

      console.log('✅ Mapa inicializado correctamente en', containerId);
    }, 100);
  }

  updateUserLocation(coords: LatLng) {
    if (!this.map) return;

    // Remover marcador anterior si existe
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }

    // Crear marcador discreto para el usuario
    this.userMarker = L.marker([coords.lat, coords.lng], {
      icon: L.divIcon({
        className: 'user-location-marker',
        html: `
          <div class="user-location-icon">
            <div class="user-location-dot"></div>
            <div class="user-location-pulse"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(this.map);

    console.log('📍 User location marker updated:', coords);
  }

  addMarker(marker: MapMarker): string {
    if (!this.map) return '';

    const markerId = marker.id || this.generateId();

    // Crear diferentes iconos según el tipo
    let icon: L.DivIcon;
    switch (marker.type) {
      case 'house':
        icon = this.createHouseIcon(marker.color || '#FF6B6B');
        break;
      case 'poi':
        icon = this.createPoiIcon(marker.color || '#4ECDC4');
        break;
      default:
        icon = this.createMarkerIcon(marker.color || '#45B7D1');
    }

    const leafletMarker = L.marker([marker.lat, marker.lng], { icon }).addTo(
      this.map
    );

    // Crear popup con información
    const popupContent = this.createMarkerPopup(marker);
    leafletMarker.bindPopup(popupContent);

    // Configurar eventos según el modo actual
    this.configureMarkerEvents(leafletMarker, markerId, marker);

    this.markers.set(markerId, leafletMarker);
    return markerId;
  }

  addZone(zone: MapZone): string {
    if (!this.map || !zone.coordinates.length) return '';

    const zoneId = zone.id || this.generateId();
    const coordinates: [number, number][] = zone.coordinates.map((coord) => [
      coord.lat,
      coord.lng,
    ]);

    const polygon = L.polygon(coordinates, {
      color: zone.color,
      fillColor: zone.color,
      fillOpacity: 0.3,
      weight: 2,
    }).addTo(this.map);

    // NO bindear popup automáticamente - lo manejaremos manualmente
    const popupContent = this.createZonePopup(zone);
    // Guardar el contenido del popup en el polígono para uso posterior
    (polygon as any).popupContent = popupContent;

    // Agregar etiqueta con el número de la zona en el centro
    if (zone.number) {
      const center = polygon.getBounds().getCenter();
      const zoneLabel = L.marker(center, {
        icon: L.divIcon({
          className: 'zone-label',
          html: `<div class="zone-number-label">${zone.number}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(this.map);

      // Guardar la etiqueta junto con el polígono
      (polygon as any).zoneLabel = zoneLabel;
    }

    // Manejar click en zona
    this.configureZoneEvents(polygon, zoneId, zone);

    this.zones.set(zoneId, polygon);
    return zoneId;
  }

  removeMarker(id: string) {
    const marker = this.markers.get(id);
    if (marker && this.map) {
      this.map.removeLayer(marker);
      this.markers.delete(id);
    }
  }

  removeZone(id: string) {
    const zone = this.zones.get(id);
    if (zone && this.map) {
      // Remover la etiqueta si existe
      if ((zone as any).zoneLabel) {
        this.map.removeLayer((zone as any).zoneLabel);
      }
      // Remover el polígono
      this.map.removeLayer(zone);
      this.zones.delete(id);
    }
  }

  private createHouseIcon(color: string): L.DivIcon {
    return L.divIcon({
      className: 'house-marker',
      html: `<div style="background-color: ${color}; border-radius: 50%; padding: 5px;">🏠</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  private createPoiIcon(color: string): L.DivIcon {
    return L.divIcon({
      className: 'poi-marker',
      html: `<div style="background-color: ${color}; border-radius: 50%; padding: 5px;">📍</div>`,
      iconSize: [25, 25],
      iconAnchor: [12, 12],
    });
  }

  private createMarkerIcon(color: string): L.DivIcon {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; border-radius: 50%; padding: 3px;">●</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

  private createMarkerPopup(marker: MapMarker): string {
    return `
      <div class="marker-popup">
        <h4>${marker.title}</h4>
        ${marker.description ? `<p>${marker.description}</p>` : ''}
        <small>Tipo: ${marker.type}</small>
      </div>
    `;
  }

  private createZonePopup(zone: MapZone): string {
    return `
      <div class="zone-popup">
        <h4><span class="zone-number">#${zone.number || 'N/A'}</span> ${
      zone.name
    }</h4>
        ${zone.description ? `<p>${zone.description}</p>` : ''}
        <small>Tipo: ${zone.type}</small>
      </div>
    `;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Métodos de utilidad
  getZoneColors() {
    return this.zoneColors;
  }

  centerMap(lat: number, lng: number, zoom: number = 15) {
    if (this.map) {
      this.map.setView([lat, lng], zoom);
    }
  }

  // Métodos para modo de eliminación
  setDeleteMode(enabled: boolean) {
    this.deleteMode = enabled;
    console.log('🗑️ Delete mode:', enabled ? 'ENABLED' : 'DISABLED');

    // Actualizar el cursor y estilos visuales de todos los elementos
    this.updateElementsForDeleteMode();
  }

  private configureMarkerEvents(
    leafletMarker: L.Marker,
    markerId: string,
    marker: MapMarker
  ) {
    if (this.deleteMode) {
      // Configurar para modo eliminación
      (leafletMarker.getElement() as HTMLElement)?.classList.add('delete-mode');
      leafletMarker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation();
        console.log('🗑️ Marker clicked for deletion:', markerId);
        this.markerDelete$.next(markerId);
      });
    } else {
      // Configurar eventos normales
      leafletMarker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent?.stopPropagation();
        this.markerClick$.next({ ...marker, id: markerId });
      });
    }
  }

  private configureZoneEvents(
    polygon: L.Polygon,
    zoneId: string,
    zone: MapZone
  ) {
    if (this.deleteMode) {
      // Configurar para modo eliminación - detener propagación para evitar crear marcadores
      (polygon.getElement() as HTMLElement)?.classList.add('delete-mode');
      polygon.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation();
        console.log('🗑️ Zone clicked for deletion:', zoneId);
        this.zoneDelete$.next(zoneId);
      });
    } else {
      // Configurar eventos normales
      polygon.on('click', (e: L.LeafletMouseEvent) => {
        if (this.isCreatingMarker) {
          // Si estamos creando un marcador, NO procesar el click de zona y permitir propagación
          console.log(
            '📍 Zone clicked but marker creation mode active - allowing marker placement'
          );
          // NO llamar ningún método, solo dejar que el evento se propague al mapa
        } else {
          // Solo mostrar popup de zona si no estamos creando marcadores
          console.log(
            '🏗️ Zone clicked (normal mode) - showing zone info:',
            zoneId
          );

          // Mostrar popup manualmente
          const popupContent = (polygon as any).popupContent;
          if (popupContent) {
            polygon.bindPopup(popupContent).openPopup();
          }

          this.zoneClick$.next({ ...zone, id: zoneId });
          // Detener propagación solo cuando queremos mostrar info de zona
          e.originalEvent?.stopPropagation();
        }
      });
    }
  }

  private updateElementsForDeleteMode() {
    // Actualizar markers existentes
    this.markers.forEach((marker, id) => {
      // Limpiar eventos existentes
      marker.off('click');

      // Reconfigurar eventos
      if (this.deleteMode) {
        (marker.getElement() as HTMLElement)?.classList.add('delete-mode');
        marker.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent.stopPropagation();
          console.log('🗑️ Marker clicked for deletion:', id);
          this.markerDelete$.next(id);
        });
      } else {
        (marker.getElement() as HTMLElement)?.classList.remove('delete-mode');
        marker.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent?.stopPropagation();
          // Aquí deberíamos tener los datos del marker, pero como no los tenemos
          // disponibles en este contexto, solo logeamos el click
          console.log('📍 Marker clicked (normal mode):', id);
        });
      }
    });

    // Actualizar zones existentes
    this.zones.forEach((zone, id) => {
      // Limpiar eventos existentes
      zone.off('click');

      // Reconfigurar eventos
      if (this.deleteMode) {
        (zone.getElement() as HTMLElement)?.classList.add('delete-mode');
        zone.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent.stopPropagation();
          console.log('🗑️ Zone clicked for deletion:', id);
          this.zoneDelete$.next(id);
        });
      } else {
        (zone.getElement() as HTMLElement)?.classList.remove('delete-mode');
        zone.on('click', (e: L.LeafletMouseEvent) => {
          if (this.isCreatingMarker) {
            // Si estamos creando un marcador, permitir propagación
            console.log('📍 Zone clicked but marker creation mode active');
          } else {
            // Solo mostrar info de zona si no estamos creando marcadores
            console.log('🏗️ Zone clicked (normal mode):', id);

            // Mostrar popup manualmente si existe
            const popupContent = (zone as any).popupContent;
            if (popupContent) {
              zone.bindPopup(popupContent).openPopup();
            }

            e.originalEvent?.stopPropagation();
          }
        });
      }
    });
  }

  // Métodos para controlar estados de creación
  setCreatingMarkerMode(enabled: boolean) {
    this.isCreatingMarker = enabled;
    console.log('📍 Creating marker mode:', enabled ? 'ENABLED' : 'DISABLED');
  }

  setCreatingZoneMode(enabled: boolean) {
    this.isCreatingZone = enabled;
    console.log('🏗️ Creating zone mode:', enabled ? 'ENABLED' : 'DISABLED');
  }
}
