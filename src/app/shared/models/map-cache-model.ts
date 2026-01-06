export interface CacheConfig {
  maxZoom: number;
  minZoom: number;
  tileSize: number;
  maxAge: number; // días
}

export interface CacheStats {
  totalTiles: number;
  cachedTiles: number;
  cacheSize: number; // MB
  lastUpdate: Date | null;
}