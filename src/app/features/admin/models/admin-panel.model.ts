export interface MarkerForm {
  title: string;
  description: string;
  lat: number;
  lng: number;
  color: string;
}

export interface ZoneForm {
  name: string;
  description: string;
  color: string;
  fillOpacity: number;
  coordinates: [number, number][];
}

export interface RouteForm {
  name: string;
  description: string;
  color: string;
  width: number;
  waypoints: [number, number][];
}

export type ToastColor = 'primary' | 'success' | 'warning' | 'danger' | 'medium';