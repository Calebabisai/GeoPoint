export interface User {
  uid: string;
  email: string | null;
  role: 'dev' | 'admin' | 'user';
  organizationId?: string; // ID de la organización a la que pertenece
  organizationRole?: 'owner' | 'admin' | 'user'; // Rol dentro de la organización
  createdAt: Date;
}
