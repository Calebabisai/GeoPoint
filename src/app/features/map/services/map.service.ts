import { computed, inject, Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import * as L from 'leaflet';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { MapMarker } from '../models/marker.model';
import { MapZone } from '../models/zone.model';
import { LatLng, MemoryStats, ExtendedPolygon } from '../models/map-model';
import { MapCacheService } from './map-cache.service';
import { LoggerService } from 'src/app/core/services/logger.service';
import { MapRoute } from '../models/route.model';
import { LocationTrackingConfig } from '../models/geolocation.model';


type ZoneColorKey = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

@Injectable({ providedIn: 'root' })
export class MapService {
  //Injects
  private mapCacheService = inject(MapCacheService);
  private logger = inject(LoggerService);

  // Constantes de configuración
  private readonly MAP_INIT_DELAY_MS = 100;
  private readonly REFRESH_DELAY_MS = 100;
  private readonly ZONE_LABEL_SIZE: [number, number] = [30, 30];
  private readonly ZONE_LABEL_ANCHOR: [number, number] = [15, 15];

  // NUEVAS PROPIEDADES para el marcador de ubicación del usuario
  private userLocationMarker: L.CircleMarker | null = null;
  private userAccuracyCircle: L.Circle | null = null;
  private readonly _isUserLocationVisible = signal(false);

  private readonly MOBILE_MAP_CONFIG = {
    center: [25.6866, -100.3161] as L.LatLngTuple,
    zoom: 12,
    minZoom: 8,
    maxZoom: 18,
    zoomControl: false,
    attributionControl: false,
    tap: true,
    tapTolerance: 15,
    touchZoom: true,
    bounceAtZoomLimits: false,
    wheelPxPerZoomLevel: 120,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
  } as const;

  private readonly DESKTOP_MAP_CONFIG = {
    center: [25.6866, -100.3161] as L.LatLngTuple,
    zoom: 13,
    zoomControl: false,
    attributionControl: false,
  } as const;

  private readonly MOBILE_TILE_CONFIG = {
    maxZoom: 18,
    minZoom: 8,
    attribution: '© OpenStreetMap contributors',
    updateWhenIdle: false,
    updateInterval: 150,
    keepBuffer: 2,
    maxNativeZoom: 18,
    tileSize: 256,
    zoomOffset: 0,
    crossOrigin: true,
  } as const;

  // Configuración del marcador de usuario
  private readonly USER_MARKER_CONFIG = {
    radius: 8,
    fillColor: '#007AFF',
    fillOpacity: 1,
    color: '#FFFFFF',
    weight: 3,
    opacity: 1,
    pane: 'markerPane', // Usar el pane correcto
  } as const;
  
  private readonly USER_ACCURACY_CONFIG = {
    fillColor: '#007AFF',
    fillOpacity: 0.15,
    color: '#007AFF',
    weight: 1,
    opacity: 0.3,
  } as const;

  private readonly DESKTOP_TILE_CONFIG = {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors',
  } as const;

  private readonly ZONE_COLORS: Record<ZoneColorKey, string> = {
    red: '#FF6B6B',
    blue: '#4ECDC4',
    green: '#45B7D1',
    yellow: '#FFA07A',
    purple: '#D6A2E8',
    orange: '#FFB347',
  } as const;

  private map: L.Map | undefined;
  private userMarker: L.Marker | undefined;
  private markers: Map<string, L.Marker> = new Map();
  private markerData: Map<string, MapMarker> = new Map();
  private zones: Map<string, ExtendedPolygon> = new Map();
  private zoneData: Map<string, MapZone> = new Map();
  private routes: Map<string, L.Polyline> = new Map();
  private routeData: Map<string, MapRoute> = new Map();

  // Subjects para eventos
  mapClick$ = new Subject<LatLng>();
  markerClick$ = new Subject<MapMarker>();
  zoneClick$ = new Subject<MapZone>();
  markerDelete$ = new Subject<string>();
  zoneDelete$ = new Subject<string>();
  routeDelete$ = new Subject<string>();


  // Signals para estado reactivo
  private readonly _deleteMode = signal(false);
  private readonly _isCreatingMarker = signal(false);
  private readonly _isCreatingZone = signal(false);
  private readonly _markersLoadedCount = signal(0);
  private readonly _zonesLoadedCount = signal(0);
  private readonly _routesLoadedCount = signal(0);
  private readonly _isCreatingRoute = signal(false);
  private readonly _maxMarkersOnMobile = signal(50);
  private readonly _maxZonesOnMobile = signal(20);
  private readonly _maxRoutesOnMobile = signal(30);

  // Signals de configuración
  private readonly _isMobile = signal(Capacitor.isNativePlatform());
  private readonly _isTouchDevice = signal(
    'ontouchstart' in window || navigator.maxTouchPoints > 0
  );

  // Computed signals para valores derivados
  readonly isMobilePlatform = computed(
    () => this._isMobile() || this._isTouchDevice()
  );

  readonly deleteMode = computed(() => this._deleteMode());
  readonly isCreatingMarker = computed(() => this._isCreatingMarker());
  readonly isCreatingZone = computed(() => this._isCreatingZone());
  readonly isCreatingRoute = computed(() => this._isCreatingRoute());
  readonly isUserLocationVisible = computed(() => this._isUserLocationVisible());


  readonly iconSize = computed<[number, number]>(() =>
    this.isMobilePlatform() ? [40, 52] : [32, 42]
  );

  readonly iconAnchor = computed<[number, number]>(() =>
    this.isMobilePlatform() ? [20, 52] : [16, 42]
  );

  readonly memoryStats = computed<MemoryStats>(() => ({
    markers: {
      count: this._markersLoadedCount(),
      limit: this._maxMarkersOnMobile(),
      percentage: Math.round(
        (this._markersLoadedCount() / this._maxMarkersOnMobile()) * 100
      ),
    },
    zones: {
      count: this._zonesLoadedCount(),
      limit: this._maxZonesOnMobile(),
      percentage: Math.round(
        (this._zonesLoadedCount() / this._maxZonesOnMobile()) * 100
      ),
    },
    isMobile: this.isMobilePlatform(),
  }));

  readonly shouldCheckMemoryLimits = computed(
    () =>
      this._markersLoadedCount() > this._maxMarkersOnMobile() ||
      this._zonesLoadedCount() > this._maxZonesOnMobile()
  );

  readonly hasMarkers = computed(() => this._markersLoadedCount() > 0);
  readonly hasZones = computed(() => this._zonesLoadedCount() > 0);
  readonly hasRoutes = computed(() => this._routesLoadedCount() > 0);

  private async hapticLight(): Promise<void> {
    if (this._isMobile()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // Haptics not available
      }
    }
  }

  private async hapticMedium(): Promise<void> {
    if (this._isMobile()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {
        // Haptics not available
      }
    }
  }

  private async hapticHeavy(): Promise<void> {
    if (this._isMobile()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {
        // Haptics not available
      }
    }
  }

  private checkMemoryLimits(): void {
    if (this.isMobilePlatform() && this.shouldCheckMemoryLimits()) {
      if (this._markersLoadedCount() > this._maxMarkersOnMobile()) {
        this.cleanupOldMarkers();
      }
      if (this._zonesLoadedCount() > this._maxZonesOnMobile()) {
        this.cleanupOldZones();
      }
    }
  }

  private cleanupOldMarkers(): void {
    const markerIds = Array.from(this.markers.keys());
    const excessCount = markerIds.length - this._maxMarkersOnMobile();

    if (excessCount > 0) {
      const markersToRemove = markerIds.slice(0, excessCount);
      markersToRemove.forEach((id) => {
        this.removeMarker(id);
      });
    }
  }

  private cleanupOldZones(): void {
    const zoneIds = Array.from(this.zones.keys());
    const excessCount = zoneIds.length - this._maxZonesOnMobile();

    if (excessCount > 0) {
      const zonesToRemove = zoneIds.slice(0, excessCount);
      zonesToRemove.forEach((id) => {
        this.removeZone(id);
      });
    }
  }

  public cleanupMemory(): void {
    if (this.isMobilePlatform()) {
      this.cleanupOldMarkers();
      this.cleanupOldZones();

      if ((window as any).gc) {
        (window as any).gc();
      }
    }
  }

  public getMemoryStats(): MemoryStats {
    return this.memoryStats();
  }

  public destroy(): void {

    this.hideUserLocationMarker();

    this.markers.forEach((marker) => this.map?.removeLayer(marker));
    this.markers.clear();
    this.markerData.clear();

    this.zones.forEach((zone) => {
      if (zone.zoneLabel) {
        this.map?.removeLayer(zone.zoneLabel);
      }
      this.map?.removeLayer(zone);
    });
    this.zones.clear();
    this.zoneData.clear();

    this.routes.forEach((route) => this.map?.removeLayer(route));
    this.routes.clear();
    this.routeData.clear();

    this.mapClick$.complete();
    this.markerClick$.complete();
    this.zoneClick$.complete();
    this.markerDelete$.complete();
    this.zoneDelete$.complete();
    this.routeDelete$.complete();

    this.map?.remove();
    this.map = undefined;

    this._markersLoadedCount.set(0);
    this._zonesLoadedCount.set(0);
    this._routesLoadedCount.set(0);
  }

  initMap(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    if (container.offsetHeight === 0 || container.offsetWidth === 0) {
      container.style.height = '100vh';
      container.style.width = '100%';
    }

    const mapConfig = this.isMobilePlatform()
      ? this.MOBILE_MAP_CONFIG
      : this.DESKTOP_MAP_CONFIG;

    this.map = L.map(containerId, mapConfig);

    const tileLayerOptions = this.isMobilePlatform()
      ? this.MOBILE_TILE_CONFIG
      : this.DESKTOP_TILE_CONFIG;

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileLayerOptions
    ).addTo(this.map);

    setTimeout(() => {
      this.map!.on('click', (e: L.LeafletMouseEvent) => {
        this.mapClick$.next({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
      });

      this.map!.invalidateSize();
    }, this.MAP_INIT_DELAY_MS);

    // Usar tiles con caché
    const tileLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        // NUEVO: Configurar para usar caché
        crossOrigin: true,
        // Interceptar requests para usar caché
      }
    );

    tileLayer.addTo(this.map);

    // Interceptar las peticiones de tiles para usar caché
    this.setupTileCaching();
  }

  private setupTileCaching(): void {
    if ('serviceWorker' in navigator && 'caches' in window) {
      // El service worker manejará el caché automáticamente
      this.logger.firebase(' Caché de tiles habilitado');
    }
  }


  updateUserLocation(coords: LatLng): void {
    if (!this.map) {
      return;
    }

    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = undefined;
    }

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        if (this.isMobilePlatform()) {
          const currentZoom = this.map.getZoom();
          this.map.setView(coords, currentZoom, { animate: false });
          this.map.fire('refresh');
        }
      }
    }, this.REFRESH_DELAY_MS);
  }

  addMarker(marker: MapMarker): string {
    if (!this.map) return '';

    const markerId = marker.id || this.generateId();

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

    const popupContent = this.createMarkerPopup(marker);
    leafletMarker.bindPopup(popupContent);

    this.configureMarkerEvents(leafletMarker, markerId, marker);

    this.markers.set(markerId, leafletMarker);
    this.markerData.set(markerId, marker);

    this._markersLoadedCount.update((count) => count + 1);
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
    }).addTo(this.map) as ExtendedPolygon;

    const el = polygon.getElement() as HTMLElement | null;
    el?.setAttribute('data-zone-id', zoneId);

    const popupContent = this.createZonePopup(zone);
    polygon.popupContent = popupContent;

    if (zone.number) {
      const center = polygon.getBounds().getCenter();
      const zoneLabel = L.marker(center, {
        icon: L.divIcon({
          className: 'zone-label',
          html: `<div class="zone-number-label">${zone.number}</div>`,
          iconSize: this.ZONE_LABEL_SIZE,
          iconAnchor: this.ZONE_LABEL_ANCHOR,
        }),
      }).addTo(this.map);

      polygon.zoneLabel = zoneLabel;
      const labelEl = zoneLabel.getElement() as HTMLElement | null;
      if (labelEl) {
        labelEl.setAttribute('data-zone-id', zoneId);
        labelEl.style.pointerEvents = 'auto';
      }
    }

    this.configureZoneEvents(polygon, zoneId, zone);

    this.zones.set(zoneId, polygon);
    this.zoneData.set(zoneId, zone);

    this._zonesLoadedCount.update((count) => count + 1);
    this.checkMemoryLimits();

    return zoneId;
  }

  removeMarker(id: string): void {
    const marker = this.markers.get(id);
    if (marker && this.map) {
      this.map.removeLayer(marker);
      this.markers.delete(id);
      this.markerData.delete(id);
      this._markersLoadedCount.update((count) => Math.max(0, count - 1));
    }
  }

  removeZone(id: string): void {
    const zone = this.zones.get(id);
    if (zone && this.map) {
      if (zone.zoneLabel) {
        this.map.removeLayer(zone.zoneLabel);
      }
      this.map.removeLayer(zone);
      this.zones.delete(id);
      this.zoneData.delete(id);
      this._zonesLoadedCount.update((count) => Math.max(0, count - 1));
    }
  }

  addRoute(route: MapRoute): string {
    if (!this.map || !route.waypoints.length || route.waypoints.length < 2) return '';

    const routeId = route.id || this.generateId();
    
    const polyline = L.polyline(route.waypoints, {
      color: route.color || '#3388ff',
      weight: route.width || 4,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this.map);

    const el = polyline.getElement() as HTMLElement | null;
    el?.setAttribute('data-route-id', routeId);

    // Popup con información
    const popupContent = `
      <div class="route-popup">
        <h4>${route.name}</h4>
        ${route.description ? `<p>${route.description}</p>` : ''}
        <small>${route.waypoints.length} puntos</small>
      </div>
    `;
    polyline.bindPopup(popupContent);

    // Configurar eventos
    this.configureRouteEvents(polyline, routeId, route);

    this.routes.set(routeId, polyline);
    this.routeData.set(routeId, route);

    this._routesLoadedCount.update((count) => count + 1);

    return routeId;
  }

  private configureRouteEvents(polyline: L.Polyline, routeId: string, route: MapRoute): void {
    polyline.on('click', (e: L.LeafletMouseEvent) => {
      // Si estamos creando marcador O línea, permitir que el click pase al mapa
      if (this._isCreatingMarker() || this._isCreatingRoute()) {
        return;
      }

      L.DomEvent.stopPropagation(e);

      if (this._deleteMode()) {
        this.hapticLight();
        this.routeDelete$.next(routeId);
      } else {
        polyline.openPopup();
      }
    });

    // Estilo hover
    polyline.on('mouseover', () => {
      if (!this._deleteMode()) {
        polyline.setStyle({ weight: (route.width || 4) + 2, opacity: 1 });
      }
    });

    polyline.on('mouseout', () => {
      polyline.setStyle({ weight: route.width || 4, opacity: 0.8 });
    });
  }

  removeRoute(id: string): void {
    const route = this.routes.get(id);
    if (route && this.map) {
      this.map.removeLayer(route);
      this.routes.delete(id);
      this.routeData.delete(id);
      this._routesLoadedCount.update((count) => Math.max(0, count - 1));
    }
  }

  clearAllRoutes(): void {
    this.routes.forEach((route) => {
      if (this.map) {
        this.map.removeLayer(route);
      }
    });
    this.routes.clear();
    this.routeData.clear();
    this._routesLoadedCount.set(0);
  }

  private createIcon(
    className: string,
    iconName: string,
    color: string,
    extraHtml: string = '',
    extraClass: string = ''
  ): L.DivIcon {
    return L.divIcon({
      className,
      html: `
        <div class="marker-container ${extraClass}" style="--marker-color: ${color}">
          ${extraHtml}
          <div class="marker-background ${extraClass.includes('poi') ? 'poi-background' : ''}"></div>
          <ion-icon name="${iconName}" class="marker-icon ${extraClass || 'default-icon'}"></ion-icon>
        </div>
      `,
      iconSize: this.iconSize(),
      iconAnchor: this.iconAnchor(),
    });
  }

  private createHouseIcon(color: string): L.DivIcon {
    return this.createIcon('house-marker-icon', 'home', color, '', 'house-icon');
  }

  private createPoiIcon(color: string): L.DivIcon {
    return this.createIcon(
      'poi-marker-icon',
      'star',
      color,
      '<div class="poi-pulse-ring"></div>',
      'poi-pulse-container poi-icon'
    );
  }

  private createMarkerIcon(color: string): L.DivIcon {
    return this.createIcon('custom-marker-icon', 'location', color);
  }

  private createMarkerPopup(marker: MapMarker): string {
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
            <small>${marker.lat.toFixed(6)}, ${marker.lng.toFixed(6)}</small>
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
    return Math.random().toString(36).substring(2, 11);
  }

  getZoneColors(): Record<ZoneColorKey, string> {
    return this.ZONE_COLORS;
  }

  getZoneColor(key: ZoneColorKey): string {
    return this.ZONE_COLORS[key];
  }

  centerMap(lat: number, lng: number, zoom: number = 15): void {
    this.map?.setView([lat, lng], zoom);
  }

  setDeleteMode(enabled: boolean): void {
    this._deleteMode.set(enabled);
    this.resetMapCursor();
    this.updateElementsForDeleteMode();

    if (this.map) {
      const mapContainer = this.map.getContainer();
      if (enabled) {
        mapContainer.classList.add('delete-mode');
      } else {
        mapContainer.classList.remove('delete-mode');
      }
    }
  }

  private resetMapCursor(): void {
    if (this.map) {
      const mapContainer = this.map.getContainer();
      mapContainer.style.cursor = '';
      mapContainer.classList.remove('delete-mode');

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
  ): void {
    if (this._deleteMode()) {
      (leafletMarker.getElement() as HTMLElement)?.classList.add('delete-mode');
      leafletMarker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation();
        this.hapticHeavy();
        this.markerDelete$.next(markerId);
      });
    } else {
      leafletMarker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent?.stopPropagation();
        this.hapticLight();
        this.markerClick$.next({ ...marker, id: markerId });
        leafletMarker.openPopup();
      });
    }
  }

  private configureZoneEvents(
    polygon: ExtendedPolygon,
    zoneId: string,
    zone: MapZone
  ): void {
    if (this._deleteMode()) {
      (polygon.getElement() as HTMLElement)?.classList.add('delete-mode');
      polygon.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation();
        this.zoneDelete$.next(zoneId);
      });
    } else {
      polygon.on('click', (e: L.LeafletMouseEvent) => {
        // Si estamos en modo de creación de marcador O línea, permitir que el clic pase al mapa
        if (this._isCreatingMarker() || this._isCreatingRoute()) {
          // NO detener propagación, dejar que llegue al listener del mapa
          return;
        }

        try {
          const original = e.originalEvent as MouseEvent;
          const elements = document.elementsFromPoint(
            original.clientX,
            original.clientY
          ) as HTMLElement[];

          const zoneElements = elements.filter(
            (el) => el.hasAttribute?.('data-zone-id')
          );

          let targetZoneId: string | null = null;
          if (zoneElements.length > 0) {
            targetZoneId = original.shiftKey && zoneElements.length > 1
              ? zoneElements[1].getAttribute('data-zone-id')
              : zoneElements[0].getAttribute('data-zone-id');
          }

          if (targetZoneId && targetZoneId !== zoneId) {
            const underlyingZone = this.zones.get(targetZoneId);
            if (underlyingZone?.popupContent) {
              underlyingZone.bindPopup(underlyingZone.popupContent).openPopup();
              this.zoneClick$.next({ ...zone, id: targetZoneId });
              e.originalEvent?.stopPropagation();
              return;
            }
          }

          if (polygon.popupContent) {
            polygon.bindPopup(polygon.popupContent).openPopup();
          }
          this.zoneClick$.next({ ...zone, id: zoneId });
          e.originalEvent?.stopPropagation();
        } catch {
          if (polygon.popupContent) {
            polygon.bindPopup(polygon.popupContent).openPopup();
          }
          this.zoneClick$.next({ ...zone, id: zoneId });
          e.originalEvent?.stopPropagation();
        }
      });
    }
  }

  private updateElementsForDeleteMode(): void {
    this.markers.forEach((marker, id) => {
      marker.off('click');
      marker.off('mouseover');
      marker.off('mouseout');

      const markerElement = marker.getElement() as HTMLElement;

      if (this._deleteMode()) {
        markerElement?.classList.add('delete-mode');
        marker.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent.stopPropagation();
          this.markerDelete$.next(id);
        });
      } else {
        markerElement?.classList.remove('delete-mode');
        if (markerElement) {
          markerElement.style.cursor = '';
        }

        const markerData = this.markerData.get(id);
        if (markerData) {
          const popupContent = this.createMarkerPopup(markerData);
          marker.bindPopup(popupContent);
        }

        marker.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent?.stopPropagation();
          this.hapticLight();
          marker.openPopup();
        });
      }
    });

    this.zones.forEach((zone, id) => {
      zone.off('click');
      zone.off('mouseover');
      zone.off('mouseout');

      const zoneElement = zone.getElement() as HTMLElement;
      const zoneData = this.zoneData.get(id);

      if (this._deleteMode()) {
        zoneElement?.classList.add('delete-mode');
        if (zoneElement) {
          zoneElement.style.pointerEvents = 'auto';
        }
        zone.on('click', (e: L.LeafletMouseEvent) => {
          e.originalEvent.stopPropagation();
          this.zoneDelete$.next(id);
        });
      } else {
        zoneElement?.classList.remove('delete-mode');
        if (zoneElement) {
          zoneElement.style.cursor = '';
          zoneElement.style.pointerEvents = 'auto';
        }

        // CORREGIDO: Reconfigurar evento respetando modos de creación
        zone.on('click', (e: L.LeafletMouseEvent) => {
          // Si estamos en modo de creación de marcador O línea, permitir que el clic pase al mapa
          if (this._isCreatingMarker() || this._isCreatingRoute()) {
            // NO detener propagación, dejar que llegue al listener del mapa
            return;
          }

          // Si no estamos creando nada, mostrar popup normal
          if (zone.popupContent) {
            zone.bindPopup(zone.popupContent).openPopup();
            if (zoneData) {
              this.zoneClick$.next({ ...zoneData, id });
            }
            e.originalEvent?.stopPropagation();
          }
        });
      }
    });

    // Actualizar rutas
    this.routes.forEach((route, id) => {
      route.off('click');
      route.off('mouseover');
      route.off('mouseout');

      const routeElement = route.getElement() as HTMLElement;
      const routeData = this.routeData.get(id);

      if (this._deleteMode()) {
        // NUEVO: Agregar clase delete-mode al elemento
        routeElement?.classList.add('delete-mode');
        
        route.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          this.hapticLight();
          this.routeDelete$.next(id);
        });
        
        // Cambiar estilo hover en modo delete
        route.on('mouseover', () => {
          if (routeData) {
            route.setStyle({ 
              weight: 6,
              opacity: 0.9,
            });
          }
        });

        route.on('mouseout', () => {
          if (routeData) {
            route.setStyle({ 
              weight: 4,
              opacity: 0.7,
            });
          }
        });
      } else {
        // NUEVO: Remover clase delete-mode
        routeElement?.classList.remove('delete-mode');
        
        // Reconfigurar eventos normales
        route.on('click', (e: L.LeafletMouseEvent) => {
          // Si estamos creando marcador O línea, permitir que el click pase al mapa
          if (this._isCreatingMarker() || this._isCreatingRoute()) {
            return;
          }

          L.DomEvent.stopPropagation(e);
          route.openPopup();
        });

        // Estilo hover normal
        route.on('mouseover', () => {
          if (routeData && !this._deleteMode()) {
            route.setStyle({ weight: (routeData.width || 4) + 2, opacity: 1 });
          }
        });

        route.on('mouseout', () => {
          if (routeData) {
            route.setStyle({ weight: routeData.width || 4, opacity: 0.8 });
          }
        });
      }
    });
  }

  /**
   * Actualiza o crea el marcador de ubicación del usuario
   */
  updateUserLocationMarker(
    coords: LatLng,
    accuracy: number,
    config: LocationTrackingConfig
  ): void {
    if (!this.map) {
      this.logger.warn('Cannot update user location: map not initialized');
      return;
    }

    // Remover marcadores anteriores si existen
    if (this.userLocationMarker) {
      this.map.removeLayer(this.userLocationMarker);
    }
    if (this.userAccuracyCircle) {
      this.map.removeLayer(this.userAccuracyCircle);
    }

    // NO crear círculo de precisión (eliminado)

    // Crear el marcador de usuario con tamaño fijo
    this.userLocationMarker = L.circleMarker([coords.lat, coords.lng], {
      ...this.USER_MARKER_CONFIG,
      className: 'user-location-marker',
    }).addTo(this.map);

    this._isUserLocationVisible.set(true);

    this.logger.geo('User location marker updated', {
      coords,
      accuracy: `${accuracy}m`,
    });
  }

  /**
   * Oculta el marcador de ubicación del usuario
   */
  hideUserLocationMarker(): void {
    if (this.userLocationMarker) {
      this.map?.removeLayer(this.userLocationMarker);
      this.userLocationMarker = null;
    }

    if (this.userAccuracyCircle) {
      this.map?.removeLayer(this.userAccuracyCircle);
      this.userAccuracyCircle = null;
    }

    this._isUserLocationVisible.set(false);
    this.logger.geo('User location marker hidden');
  }

  /**
   * Centra el mapa en la ubicación del usuario
   */
  centerMapOnUserLocation(coords: LatLng, smooth: boolean = true): void {
    if (!this.map) {
      return;
    }

    const currentZoom = this.map.getZoom();
    const targetZoom = currentZoom < 15 ? 16 : currentZoom;

    if (smooth) {
      this.map.flyTo([coords.lat, coords.lng], targetZoom, {
        duration: 0.5,
        easeLinearity: 0.25,
      });
    } else {
      this.map.setView([coords.lat, coords.lng], targetZoom, {
        animate: false,
      });
    }

    this.logger.geo('Map centered on user location', coords);
  }

  /**
   * Obtiene las coordenadas actuales del centro del mapa
   */
  getMapCenter(): LatLng | null {
    if (!this.map) {
      return null;
    }

    const center = this.map.getCenter();
    return {
      lat: center.lat,
      lng: center.lng,
    };
  }

  setCreatingMarkerMode(enabled: boolean): void {
    this._isCreatingMarker.set(enabled);
  }

  setCreatingZoneMode(enabled: boolean): void {
    this._isCreatingZone.set(enabled);
  }

  setCreatingRouteMode(enabled: boolean): void {
    this._isCreatingRoute.set(enabled);
  }
}
