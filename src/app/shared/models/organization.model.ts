export interface Organization {
  id: string;
  name: string;
  description?: string;
  code: string; // Código único para invitaciones (ej: "EMPRESA-2024")
  ownerId: string; // ID del usuario creador/propietario
  settings: OrganizationSettings;
  members: OrganizationMember[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface OrganizationMember {
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'user';
  joinedAt: Date;
  invitedBy: string;
  status: 'active' | 'inactive' | 'pending';
}

export interface OrganizationSettings {
  allowUserInvites: boolean; // Si los usuarios pueden invitar a otros
  requireApproval: boolean; // Si las invitaciones requieren aprobación
  maxMembers: number; // Límite de miembros (0 = ilimitado)
  features: {
    canCreateZones: boolean;
    canCreateMarkers: boolean;
    canExportData: boolean;
    canViewAnalytics: boolean;
  };
  visibility: 'private' | 'public'; // Si otros pueden ver la organización
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  organizationName: string;
  invitedEmail: string;
  invitedBy: string;
  role: 'admin' | 'user';
  code: string; // Código de invitación
  expiresAt: Date;
  createdAt: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}
