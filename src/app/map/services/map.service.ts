import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import * as L from 'leaflet';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
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
  private markerData: Map<string, MapMarker> = new Map(); // Almacenar datos originales
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

  // Detección de plataforma móvil
  private isMobile = Capacitor.isNativePlatform();
  private isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Gestión de memoria para móvil
  private maxMarkersOnMobile = 50; // Límite de marcadores en móvil
  private maxZonesOnMobile = 20; // Límite de zonas en móvil
  private markersLoadedCount = 0;
  private zonesLoadedCount = 0;

  // Método público para consultar si es móvil
  get isMobilePlatform(): boolean {
    return this.isMobile || this.isTouchDevice;
  }

  // Métodos para feedback háptico
  private async hapticLight() {
    if (this.isMobile) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    }
  }

  private async hapticMedium() {
    if (this.isMobile) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    }
  }

  private async hapticHeavy() {
    if (this.isMobile) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    }
  }

  // Gestión de memoria móvil
  private checkMemoryLimits(): void {
    if (this.isMobile || this.isTouchDevice) {
      // Verificar límites de marcadores
      if (this.markersLoadedCount > this.maxMarkersOnMobile) {
        console.warn('⚠️ Marker limit exceeded on mobile, cleaning up...');
        this.cleanupOldMarkers();
      }

      // Verificar límites de zonas
      if (this.zonesLoadedCount > this.maxZonesOnMobile) {
        console.warn('⚠️ Zone limit exceeded on mobile, cleaning up...');
        this.cleanupOldZones();
      }
    }
  }

  private cleanupOldMarkers(): void {
    const markerIds = Array.from(this.markers.keys());
    const excessCount = markerIds.length - this.maxMarkersOnMobile;

    if (excessCount > 0) {
      // Remover los marcadores más antiguos (primeros agregados)
      const markersToRemove = markerIds.slice(0, excessCount);
      markersToRemove.forEach((id) => {
        this.removeMarker(id);
      });
      console.log(
        `🧹 Cleaned up ${excessCount} old markers for memory optimization`
      );
    }
  }

  private cleanupOldZones(): void {
    const zoneIds = Array.from(this.zones.keys());
    const excessCount = zoneIds.length - this.maxZonesOnMobile;

    if (excessCount > 0) {
      // Remover las zonas más antiguas (primeras agregadas)
      const zonesToRemove = zoneIds.slice(0, excessCount);
      zonesToRemove.forEach((id) => {
        this.removeZone(id);
      });
      console.log(
        `🧹 Cleaned up ${excessCount} old zones for memory optimization`
      );
    }
  }

  // Método público para limpiar memoria manualmente
  public cleanupMemory(): void {
    if (this.isMobile || this.isTouchDevice) {
      this.cleanupOldMarkers();
      this.cleanupOldZones();

      // Forzar garbage collection si está disponible
      if ((window as any).gc) {
        (window as any).gc();
      }

      console.log('🧹 Memory cleanup completed');
    }
  }

  // Método público para obtener estadísticas de memoria
  public getMemoryStats(): {
    markers: { count: number; limit: number; percentage: number };
    zones: { count: number; limit: number; percentage: number };
    isMobile: boolean;
  } {
    return {
      markers: {
        count: this.markersLoadedCount,
        limit: this.maxMarkersOnMobile,
        percentage: Math.round(
          (this.markersLoadedCount / this.maxMarkersOnMobile) * 100
        ),
      },
      zones: {
        count: this.zonesLoadedCount,
        limit: this.maxZonesOnMobile,
        percentage: Math.round(
          (this.zonesLoadedCount / this.maxZonesOnMobile) * 100
        ),
      },
      isMobile: this.isMobile || this.isTouchDevice,
    };
  }

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

    // Configuración del mapa optimizada para móvil
    const mapConfig =
      this.isMobile || this.isTouchDevice
        ? {
            center: [25.6866, -100.3161] as L.LatLngTuple,
            zoom: 12, // Zoom inicial menor en móvil
            minZoom: 8,
            maxZoom: 18,
            zoomControl: false,
            attributionControl: false,
            // Optimizaciones táctiles
            tap: true,
            tapTolerance: 15, // Mayor tolerancia para taps en móvil
            touchZoom: true,
            bounceAtZoomLimits: false,
            wheelPxPerZoomLevel: 120, // Zoom más suave
            zoomSnap: 0.5, // Permitir zooms intermedios
            zoomDelta: 0.5,
          }
        : {
            center: [25.6866, -100.3161] as L.LatLngTuple,
            zoom: 13,
            zoomControl: false,
            attributionControl: false,
          };

    this.map = L.map(containerId, mapConfig);

    // Configuración de tiles optimizada para móvil
    const tileLayerOptions =
      this.isMobile || this.isTouchDevice
        ? {
            maxZoom: 18,
            minZoom: 8,
            attribution: '© OpenStreetMap contributors',
            // Optimizaciones para móvil
            updateWhenIdle: false, // Actualizar mientras se mueve
            updateInterval: 150, // Reducir interval para móvil
            keepBuffer: 2, // Buffer menor para ahorrar memoria
            maxNativeZoom: 18,
            tileSize: 256,
            zoomOffset: 0,
            // Loading optimizado para móvil
            crossOrigin: true,
          }
        : {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors',
          };

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileLayerOptions
    ).addTo(this.map);

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
    if (!this.map) {
      console.error('❌ Cannot update user location: map not initialized');
      return;
    }

    console.log('🗺️  Updating user location marker at:', coords);

    // Limpiar referencia de marcador anterior (si existía)
    if (this.userMarker) {
      console.log('🗑️ Cleaning up previous user marker reference');
      this.map.removeLayer(this.userMarker);
      this.userMarker = undefined;
    }

    // MARCADOR DE USUARIO DESACTIVADO - Solo mantener funcionalidad GPS
    console.log('📍 GPS coordinates updated (marker disabled):', coords);

    // NO crear marcador visual - solo registrar las coordenadas para centrado
    // El GPS funciona pero sin mostrar punto azul

    console.log(
      'ℹ️ User location marker disabled - GPS tracking active without visual marker'
    );

    // Forzar refresco del mapa para móviles (especialmente Xiaomi)
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        // Pequeño ajuste de vista para forzar re-renderizado en dispositivos móviles
        if (this.isMobile || this.isTouchDevice) {
          const currentZoom = this.map.getZoom();
          this.map.setView(coords, currentZoom, { animate: false });
          this.map.fire('refresh');
        }
      }
    }, 100);
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

    // Almacenar el marcador y sus datos
    this.markers.set(markerId, leafletMarker);
    this.markerData.set(markerId, marker);

    // Actualizar contador y verificar límites de memoria
    this.markersLoadedCount++;
    this.checkMemoryLimits();

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

    // Actualizar contador y verificar límites de memoria
    this.zonesLoadedCount++;
    this.checkMemoryLimits();

    return zoneId;
  }

  removeMarker(id: string) {
    const marker = this.markers.get(id);
    if (marker && this.map) {
      this.map.removeLayer(marker);
      this.markers.delete(id);
      this.markerData.delete(id); // También limpiar los datos

      // Decrementar contador
      this.markersLoadedCount = Math.max(0, this.markersLoadedCount - 1);
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

      // Decrementar contador
      this.zonesLoadedCount = Math.max(0, this.zonesLoadedCount - 1);
    }
  }

  private createHouseIcon(color: string): L.DivIcon {
    // Tamaños optimizados para móvil
    const iconSize: [number, number] =
      this.isMobile || this.isTouchDevice ? [40, 52] : [32, 42];
    const iconAnchor: [number, number] =
      this.isMobile || this.isTouchDevice ? [20, 52] : [16, 42];

    return L.divIcon({
      className: 'house-marker-icon',
      html: `
        <div class="marker-container" style="--marker-color: ${color}">
          <div class="marker-background"></div>
          <ion-icon name="home" class="marker-icon house-icon"></ion-icon>
        </div>
      `,
      iconSize,
      iconAnchor,
    });
  }

  private createPoiIcon(color: string): L.DivIcon {
    // Tamaños optimizados para móvil
    const iconSize: [number, number] =
      this.isMobile || this.isTouchDevice ? [40, 52] : [32, 42];
    const iconAnchor: [number, number] =
      this.isMobile || this.isTouchDevice ? [20, 52] : [16, 42];

    return L.divIcon({
      className: 'poi-marker-icon',
      html: `
        <div class="marker-container poi-pulse-container" style="--marker-color: ${color}">
          <div class="poi-pulse-ring"></div>
          <div class="marker-background poi-background"></div>
          <ion-icon name="star" class="marker-icon poi-icon"></ion-icon>
        </div>
      `,
      iconSize,
      iconAnchor,
    });
  }

  private createMarkerIcon(color: string): L.DivIcon {
    // Tamaños optimizados para móvil
    const iconSize: [number, number] =
      this.isMobile || this.isTouchDevice ? [40, 52] : [32, 42];
    const iconAnchor: [number, number] =
      this.isMobile || this.isTouchDevice ? [20, 52] : [16, 42];

    return L.divIcon({
      className: 'custom-marker-icon',
      html: `
        <div class="marker-container" style="--marker-color: ${color}">
          <div class="marker-background"></div>
          <ion-icon name="location" class="marker-icon default-icon"></ion-icon>
        </div>
      `,
      iconSize,
      iconAnchor,
    });
  }

  private createMarkerPopup(marker: MapMarker): string {
    // Si es un POI, crear popup especial con enlace a Google Maps
    if (marker.type === 'poi') {
      return this.createPoiPopup(marker);
    }

    return `
      <div class="marker-popup">
        <h4>${marker.title}</h4>
        ${marker.description ? `<p>${marker.description}</p>` : ''}
        <small>Tipo: ${marker.type}</small>
      </div>
    `;
  }

  private createPoiPopup(marker: MapMarker): string {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lng}`;

    return `
      <div class="poi-popup">
        <div class="poi-header">
          <ion-icon name="star" class="poi-popup-icon"></ion-icon>
          <h4>${marker.title}</h4>
        </div>
        ${
          marker.description
            ? `<p class="poi-description">${marker.description}</p>`
            : ''
        }
        <div class="poi-actions">
          <button class="google-maps-btn" onclick="window.open('${googleMapsUrl}', '_blank')">
            <ion-icon name="navigate-outline"></ion-icon>
            Cómo llegar
          </button>
          <div class="poi-coords">
            <small>📍 ${marker.lat.toFixed(6)}, ${marker.lng.toFixed(6)}</small>
          </div>
        </div>
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

    // Limpiar cursor del mapa primero
    this.resetMapCursor();

    // Actualizar el cursor y estilos visuales de todos los elementos
    this.updateElementsForDeleteMode();

    // Aplicar o quitar clase delete-mode del contenedor del mapa
    if (this.map) {
      const mapContainer = this.map.getContainer();
      if (enabled) {
        mapContainer.classList.add('delete-mode');
      } else {
        mapContainer.classList.remove('delete-mode');
      }
    }
  }

  private resetMapCursor() {
    if (this.map) {
      const mapContainer = this.map.getContainer();
      // Restaurar cursor predeterminado
      mapContainer.style.cursor = '';

      // Limpiar cualquier clase relacionada con delete-mode del contenedor
      mapContainer.classList.remove('delete-mode');

      // También limpiar del elemento leaflet-container si existe
      const leafletContainer = mapContainer.querySelector('.leaflet-container');
      if (leafletContainer) {
        leafletContainer.classList.remove('delete-mode');
        (leafletContainer as HTMLElement).style.cursor = '';
      }
    }
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
        // Feedback háptico para eliminación (vibraición fuerte)
        this.hapticHeavy();
        this.markerDelete$.next(markerId);
      });
    } else {
      // Configurar eventos normales
      leafletMarker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent?.stopPropagation();
        console.log('📍 Marker clicked (initial config):', markerId);
        // Feedback háptico suave para interacción normal
        this.hapticLight();
        this.markerClick$.next({ ...marker, id: markerId });
        // Abrir el popup explícitamente
        leafletMarker.openPopup();
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
      // Limpiar eventos existentes completamente
      marker.off('click');
      marker.off('mouseover');
      marker.off('mouseout');

      const markerElement = marker.getElement() as HTMLElement;

      // Reconfigurar eventos y estilos
      if (this.deleteMode) {
        markerElement?.classList.add('delete-mode');
        marker.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent.stopPropagation();
          console.log('🗑️ Marker clicked for deletion:', id);
          this.markerDelete$.next(id);
        });
      } else {
        // LIMPIEZA COMPLETA al salir del modo delete
        markerElement?.classList.remove('delete-mode');

        // Restaurar cursor del elemento específico
        if (markerElement) {
          markerElement.style.cursor = '';
        }

        // Restaurar popup y evento normal de click
        const markerData = this.markerData.get(id);
        if (markerData) {
          // Recrear y vincular el popup con los datos originales
          const popupContent = this.createMarkerPopup(markerData);
          marker.bindPopup(popupContent);
          console.log('✅ Popup restored for marker:', id);
        }

        marker.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent?.stopPropagation();
          console.log('📍 Marker clicked (normal mode):', id);
          // Feedback háptico suave para interacción restaurada
          this.hapticLight();
          // Abrir el popup explícitamente
          marker.openPopup();
        });
      }
    });

    // Actualizar zones existentes
    this.zones.forEach((zone, id) => {
      // Limpiar eventos existentes completamente
      zone.off('click');
      zone.off('mouseover');
      zone.off('mouseout');

      const zoneElement = zone.getElement() as HTMLElement;

      // Reconfigurar eventos y estilos
      if (this.deleteMode) {
        zoneElement?.classList.add('delete-mode');
        zone.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent.stopPropagation();
          console.log('🗑️ Zone clicked for deletion:', id);
          this.zoneDelete$.next(id);
        });
      } else {
        // LIMPIEZA COMPLETA al salir del modo delete
        zoneElement?.classList.remove('delete-mode');

        // Restaurar cursor del elemento específico
        if (zoneElement) {
          zoneElement.style.cursor = '';
        }

        // Reconfigurar evento normal de click
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
