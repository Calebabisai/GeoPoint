import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LoggerService } from 'src/app/core/services/logger.service';
import * as L from 'leaflet';
import { CacheConfig, CacheStats } from '../models/map-cache-model';



@Injectable({
  providedIn: 'root',
})
export class MapCacheService {
  private logger = inject(LoggerService);

  // Signals
  private isCachingSignal = signal(false);
  private cacheStatsSignal = signal<CacheStats>({
    totalTiles: 0,
    cachedTiles: 0,
    cacheSize: 0,
    lastUpdate: null,
  });

  readonly isCaching = this.isCachingSignal.asReadonly();
  readonly cacheStats = this.cacheStatsSignal.asReadonly();

  private readonly DEFAULT_CONFIG: CacheConfig = {
    maxZoom: 17,
    minZoom: 13,
    tileSize: 256,
    maxAge: 30, // 30 días
  };

  private readonly CACHE_NAME = 'map-tiles-cache';
  private readonly ORGANIZATION_AREA_RADIUS = 5000; // 5km radius

  /**
   * Obtiene la ubicación actual del usuario
   */
  async getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
    try {
      // Verificar permisos primero
      const permission = await Geolocation.checkPermissions();
      
      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          this.logger.warn('Permisos de ubicación denegados');
          return null;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (error) {
      this.logger.error('Error obteniendo ubicación:', error);
      return null;
    }
  }

  /**
   * Pre-carga tiles del área de la organización
   */
  async precacheOrganizationArea(
    centerLat: number,
    centerLng: number,
    config: Partial<CacheConfig> = {}
  ): Promise<void> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    this.isCachingSignal.set(true);
    this.logger.firebase(' Iniciando precarga de tiles...');

    try {
      if (!('caches' in window)) {
        this.logger.warn('Cache API no disponible en este navegador');
        return;
      }

      const cache = await caches.open(this.CACHE_NAME);
      const bounds = this.calculateBounds(centerLat, centerLng, this.ORGANIZATION_AREA_RADIUS);
      
      const tileUrls = this.generateTileUrls(bounds, finalConfig);
      this.cacheStatsSignal.update(stats => ({
        ...stats,
        totalTiles: tileUrls.length,
      }));

      let cachedCount = 0;

      // Cachear en lotes para no saturar la red
      const batchSize = 10;
      for (let i = 0; i < tileUrls.length; i += batchSize) {
        const batch = tileUrls.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (url) => {
            try {
              const response = await fetch(url);
              if (response.ok) {
                await cache.put(url, response.clone());
                cachedCount++;
                
                this.cacheStatsSignal.update(stats => ({
                  ...stats,
                  cachedTiles: cachedCount,
                }));
              }
            } catch (error) {
              this.logger.warn(`Error cacheando tile: ${url}`);
            }
          })
        );

        // Pequeña pausa entre lotes
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.cacheStatsSignal.update(stats => ({
        ...stats,
        lastUpdate: new Date(),
      }));

      this.logger.firebase(` Tiles cacheados: ${cachedCount}/${tileUrls.length}`);
    } catch (error) {
      this.logger.error('Error en precarga de tiles:', error);
      throw error;
    } finally {
      this.isCachingSignal.set(false);
    }
  }

  /**
   * Calcula los bounds para el área de precarga
   */
  private calculateBounds(
    lat: number,
    lng: number,
    radius: number
  ): L.LatLngBounds {
    const latOffset = radius / 111000; // ~111km por grado
    const lngOffset = radius / (111000 * Math.cos((lat * Math.PI) / 180));

    return L.latLngBounds(
      [lat - latOffset, lng - lngOffset],
      [lat + latOffset, lng + lngOffset]
    );
  }

  /**
   * Genera URLs de tiles para cachear
   */
  private generateTileUrls(
    bounds: L.LatLngBounds,
    config: CacheConfig
  ): string[] {
    const urls: string[] = [];
    const tileServer = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    for (let z = config.minZoom; z <= config.maxZoom; z++) {
      const min = this.latLngToTile(bounds.getSouthWest(), z);
      const max = this.latLngToTile(bounds.getNorthEast(), z);

      for (let x = min.x; x <= max.x; x++) {
        for (let y = max.y; y <= min.y; y++) {
          const url = tileServer
            .replace('{s}', ['a', 'b', 'c'][Math.floor(Math.random() * 3)])
            .replace('{z}', z.toString())
            .replace('{x}', x.toString())
            .replace('{y}', y.toString());
          urls.push(url);
        }
      }
    }

    return urls;
  }

  /**
   * Convierte lat/lng a coordenadas de tile
   */
  private latLngToTile(
    latlng: L.LatLng,
    zoom: number
  ): { x: number; y: number } {
    const x = Math.floor(((latlng.lng + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((latlng.lat * Math.PI) / 180) +
            1 / Math.cos((latlng.lat * Math.PI) / 180)
        ) /
          Math.PI) /
        2) *
        Math.pow(2, zoom)
    );
    return { x, y };
  }

  /**
   * Limpia caché antigua
   */
  async clearOldCache(): Promise<void> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const requests = await cache.keys();
      
      const now = Date.now();
      const maxAge = this.DEFAULT_CONFIG.maxAge * 24 * 60 * 60 * 1000;

      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const cachedDate = new Date(response.headers.get('date') || '');
          if (now - cachedDate.getTime() > maxAge) {
            await cache.delete(request);
          }
        }
      }

      this.logger.firebase('Caché antigua limpiada');
    } catch (error) {
      this.logger.error('Error limpiando caché:', error);
    }
  }

  /**
   * Obtiene el tamaño estimado del caché
   */
  async getCacheSize(): Promise<number> {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      return 0;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usageInMB = (estimate.usage || 0) / (1024 * 1024);
      
      this.cacheStatsSignal.update(stats => ({
        ...stats,
        cacheSize: usageInMB,
      }));

      return usageInMB;
    } catch (error) {
      this.logger.error('Error calculando tamaño de caché:', error);
      return 0;
    }
  }

  /**
   * Verifica si hay tiles cacheados
   */
  async hasCachedTiles(): Promise<boolean> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const keys = await cache.keys();
      return keys.length > 0;
    } catch {
      return false;
    }
  }
}
