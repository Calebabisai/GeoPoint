export interface MapRoute {
  id: string;
  name: string;
  description: string;
  waypoints: [number, number][];
  color: string;
  width: number;
  createdBy: string;
  createdAt: Date;
  organizationId?: string;
}

// Tipo para crear sin los campos autogenerados
export type CreateRouteData = Omit<MapRoute, 'id' | 'createdBy' | 'createdAt' | 'organizationId'>;