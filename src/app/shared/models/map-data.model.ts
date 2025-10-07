export interface MapMarker {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  type: 'default' | 'warning' | 'danger' | 'success' | 'info';
  iconName?: string;
  color?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isVisible: boolean;
  metadata?: {
    category?: string;
    tags?: string[];
    customFields?: Record<string, any>;
  };
}

export interface MapZone {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type: 'polygon' | 'circle' | 'rectangle';
  coordinates: ZoneCoordinates;
  style: ZoneStyle;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isVisible: boolean;
  metadata?: {
    area?: number; // en metros cuadrados
    perimeter?: number; // en metros
    category?: string;
    tags?: string[];
    customFields?: Record<string, any>;
  };
}

export interface ZoneCoordinates {
  // Para polygon: array de puntos [lat, lng]
  polygon?: number[][];
  // Para circle: centro y radio
  circle?: {
    center: [number, number]; // [lat, lng]
    radius: number; // en metros
  };
  // Para rectangle: esquinas
  rectangle?: {
    southwest: [number, number];
    northeast: [number, number];
  };
}

export interface ZoneStyle {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWeight: number;
  strokeOpacity: number;
}

export interface MapData {
  organizationId: string;
  markers: MapMarker[];
  zones: MapZone[];
  lastUpdated: Date;
}

// Tipos para filtros y búsquedas
export interface MapFilter {
  organizationId?: string;
  createdBy?: string;
  type?: string;
  category?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  visibility?: boolean;
}

// Tipos para permisos de mapas
export interface MapPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canEditOwn: boolean;
  canDeleteOwn: boolean;
}
