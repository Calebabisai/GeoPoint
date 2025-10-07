export interface MapZone {
  id: string;
  name: string;
  description: string;
  coordinates: { lat: number; lng: number }[];
  color: string;
  number: number; // Número identificador de la zona
  type: 'zone' | 'area' | 'sector';
  createdBy: string;
  organizationId: string;
  createdAt: Date;
}
