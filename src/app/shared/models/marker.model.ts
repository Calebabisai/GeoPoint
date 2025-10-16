export interface MapMarker {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  color: string;
  type: 'marker' | 'house' | 'poi';
  createdBy: string;
  organizationId: string;
  createdAt: Date;
  number?: number;
}
