export interface LatLng {
  lat: number;
  lng: number;
}

export interface MemoryStats {
  markers: { count: number; limit: number; percentage: number };
  zones: { count: number; limit: number; percentage: number };
  isMobile: boolean;
}

export interface ExtendedPolygon extends L.Polygon {
  popupContent?: string;
  zoneLabel?: L.Marker;
}