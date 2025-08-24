export interface MapRoute {
  id: string;
  name: string;
  description: string;
  waypoints: [number, number][];
  color: string;
  width: number;
  createdBy: string;
  createdAt: Date;
}
