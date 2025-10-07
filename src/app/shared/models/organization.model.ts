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
  displayName?: string;
  role: 'owner' | 'admin' | 'moderator' | 'user';
  department?: string; // Para organizar miembros en departamentos
  joinedAt: Date;
  invitedBy: string;
  lastActiveAt?: Date; // Para tracking de actividad
  status: 'active' | 'inactive' | 'pending';
  permissions?: {
    canCreateZones: boolean;
    canCreateMarkers: boolean;
    canExportData: boolean;
    canViewAnalytics: boolean;
    canManageMembers: boolean;
    canBulkInvite: boolean;
  }; // Permisos específicos del miembro
}

export interface OrganizationSettings {
  allowUserInvites: boolean; // Si los usuarios pueden invitar a otros
  requireApproval: boolean; // Si las invitaciones requieren aprobación
  maxMembers: number; // Límite de miembros (0 = ilimitado, default: 100)
  allowedDomains?: string[]; // Dominios de email permitidos (ej: ["empresa.com"])
  autoApproveFromDomains: boolean; // Auto-aprobar invitaciones de dominios permitidos
  features: {
    canCreateZones: boolean;
    canCreateMarkers: boolean;
    canExportData: boolean;
    canViewAnalytics: boolean;
    canManageMembers: boolean; // Solo admins pueden gestionar miembros
    canBulkInvite: boolean; // Permitir invitaciones masivas
  };
  visibility: 'private' | 'public'; // Si otros pueden ver la organización
  departments?: string[]; // Lista de departamentos disponibles
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  organizationName: string;
  invitedEmail: string;
  invitedBy: string;
  role: 'admin' | 'moderator' | 'user';
  department?: string; // Departamento asignado
  code: string; // Código de invitación
  inviteToken?: string; // Token para compatibilidad con URLs
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  message?: string; // Mensaje personalizado del invitador
}

// Interfaz para invitaciones masivas
export interface BulkInviteRequest {
  organizationId: string;
  invites: {
    email: string;
    role: 'admin' | 'moderator' | 'user';
    department?: string;
    message?: string;
  }[];
  defaultRole: 'admin' | 'moderator' | 'user';
  defaultDepartment?: string;
  personalMessage?: string;
}

// Interfaz para filtros de miembros
export interface MemberFilters {
  status?: 'active' | 'inactive' | 'pending';
  role?: 'owner' | 'admin' | 'moderator' | 'user';
  department?: string;
  search?: string; // Búsqueda por nombre o email
  sortBy?: 'name' | 'email' | 'joinedAt' | 'lastActiveAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// Interfaz para estadísticas de organización
export interface OrganizationStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  membersByRole: Record<string, number>;
  membersByDepartment: Record<string, number>;
  memberGrowth: {
    thisMonth: number;
    lastMonth: number;
    growth: number; // Porcentaje
  };
}
