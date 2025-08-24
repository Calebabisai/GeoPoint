import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, map, switchMap, of } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';
import {
  Organization,
  OrganizationMember,
  OrganizationInvite,
  OrganizationSettings,
} from '../models/organization.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  private authService = inject(AuthService);

  // Subject para la organización actual del usuario
  private currentOrganizationSubject = new BehaviorSubject<Organization | null>(
    null
  );

  // Para desarrollo: simular organizaciones
  private developmentOrganizations: Organization[] = [
    {
      id: 'org-1',
      name: 'Empresa Demo',
      description: 'Organización de demostración',
      code: 'DEMO-2024',
      ownerId: 'user-1',
      settings: {
        allowUserInvites: true,
        requireApproval: false,
        maxMembers: 50,
        features: {
          canCreateZones: true,
          canCreateMarkers: true,
          canExportData: true,
          canViewAnalytics: true,
        },
        visibility: 'private',
      },
      members: [
        {
          userId: 'user-1',
          email: 'admin@demo.com',
          role: 'owner',
          joinedAt: new Date(),
          invitedBy: 'system',
          status: 'active',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    },
  ];

  constructor() {
    // Exponer para debugging
    if (typeof window !== 'undefined') {
      (window as any).organizationService = this;
      console.log(
        '🏢 OrganizationService exposed globally as window.organizationService'
      );
    }

    // Por defecto, asignar la organización demo
    this.setCurrentOrganization('org-1');
  }

  /**
   * Obtiene la organización actual del usuario
   */
  getCurrentOrganization(): Observable<Organization | null> {
    return this.currentOrganizationSubject.asObservable();
  }

  /**
   * Obtiene el ID de la organización actual
   */
  getCurrentOrganizationId(): Observable<string | null> {
    return this.currentOrganizationSubject.pipe(map((org) => org?.id || null));
  }

  /**
   * Cambia la organización actual (para desarrollo)
   */
  setCurrentOrganization(organizationId: string): void {
    const org = this.developmentOrganizations.find(
      (o) => o.id === organizationId
    );
    if (org) {
      this.currentOrganizationSubject.next(org);
      console.log(`🏢 Organization changed to: ${org.name}`);

      // Emitir evento para que otros componentes se actualicen
      window.dispatchEvent(
        new CustomEvent('organizationChanged', {
          detail: { organization: org, timestamp: new Date() },
        })
      );
    }
  }

  /**
   * Obtiene todas las organizaciones del usuario actual
   */
  getUserOrganizations(): Observable<Organization[]> {
    // En desarrollo, devolver organizaciones de prueba
    return of(this.developmentOrganizations);
  }

  /**
   * Crea una nueva organización
   */
  async createOrganization(organizationData: {
    name: string;
    description?: string;
    settings?: Partial<OrganizationSettings>;
  }): Promise<Organization> {
    const currentUser = await this.authService
      .getCurrentUser()
      .pipe(map((user) => user || { uid: 'anonymous', email: 'test@demo.com' }))
      .toPromise();

    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: organizationData.name,
      description: organizationData.description || '',
      code: this.generateOrganizationCode(),
      ownerId: currentUser!.uid,
      settings: {
        allowUserInvites: true,
        requireApproval: false,
        maxMembers: 0,
        features: {
          canCreateZones: true,
          canCreateMarkers: true,
          canExportData: false,
          canViewAnalytics: false,
        },
        visibility: 'private',
        ...organizationData.settings,
      },
      members: [
        {
          userId: currentUser!.uid,
          email: currentUser!.email || '',
          role: 'owner',
          joinedAt: new Date(),
          invitedBy: 'system',
          status: 'active',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    // Agregar a la lista de desarrollo
    this.developmentOrganizations.push(newOrg);

    console.log('🏢 Organization created:', newOrg);
    return newOrg;
  }

  /**
   * Genera un código único para la organización
   */
  private generateOrganizationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Invita un usuario a la organización
   */
  async inviteUser(
    organizationId: string,
    email: string,
    role: 'admin' | 'user' = 'user'
  ): Promise<OrganizationInvite> {
    const organization = this.developmentOrganizations.find(
      (o) => o.id === organizationId
    );
    if (!organization) {
      throw new Error('Organización no encontrada');
    }

    const currentUser = await this.authService
      .getCurrentUser()
      .pipe(map((user) => user || { uid: 'anonymous' }))
      .toPromise();

    const invite: OrganizationInvite = {
      id: `invite-${Date.now()}`,
      organizationId,
      organizationName: organization.name,
      invitedEmail: email,
      invitedBy: currentUser!.uid,
      role,
      code: this.generateInviteCode(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      createdAt: new Date(),
      status: 'pending',
    };

    console.log('📧 User invited to organization:', invite);
    return invite;
  }

  /**
   * Genera un código de invitación
   */
  private generateInviteCode(): string {
    return Math.random().toString(36).substr(2, 12).toUpperCase();
  }

  /**
   * Acepta una invitación y une al usuario a la organización
   */
  async acceptInvite(inviteCode: string, userId: string): Promise<void> {
    // Aquí se implementaría la lógica para aceptar invitaciones
    console.log('✅ Invite accepted:', inviteCode, userId);
  }

  /**
   * Verifica si el usuario tiene permisos específicos en la organización actual
   */
  hasOrganizationPermission(permission: string): Observable<boolean> {
    return this.getCurrentOrganization().pipe(
      switchMap((org) => {
        if (!org) return of(false);

        return this.authService.getCurrentUser().pipe(
          map((user) => {
            if (!user) return false;

            // Buscar el miembro en la organización
            const member = org.members.find((m) => m.userId === user.uid);
            if (!member || member.status !== 'active') return false;

            // Verificar permisos basados en el rol y configuración de la organización
            return this.checkOrganizationPermission(
              permission,
              member.role,
              org.settings
            );
          })
        );
      })
    );
  }

  /**
   * Verifica permisos específicos según el rol y configuración
   */
  private checkOrganizationPermission(
    permission: string,
    userRole: 'owner' | 'admin' | 'user',
    settings: OrganizationSettings
  ): boolean {
    // El owner siempre tiene todos los permisos
    if (userRole === 'owner') return true;

    // Mapeo de permisos
    const permissionMap: Record<string, boolean> = {
      'create-zone':
        userRole === 'admin' ||
        (settings.features.canCreateZones && userRole === 'user'),
      'create-marker':
        userRole === 'admin' ||
        (settings.features.canCreateMarkers && userRole === 'user'),
      'export-data':
        userRole === 'admin' ||
        (settings.features.canExportData && userRole === 'user'),
      'view-analytics':
        userRole === 'admin' ||
        (settings.features.canViewAnalytics && userRole === 'user'),
      'manage-users': userRole === 'admin',
      'invite-users':
        userRole === 'admin' ||
        (settings.allowUserInvites && userRole === 'user'),
    };

    return permissionMap[permission] || false;
  }

  /**
   * Obtiene el rol del usuario en la organización actual
   */
  getCurrentOrganizationRole(): Observable<'owner' | 'admin' | 'user' | null> {
    return this.getCurrentOrganization().pipe(
      switchMap((org) => {
        if (!org) return of(null);

        return this.authService.getCurrentUser().pipe(
          map((user) => {
            if (!user) return null;
            const member = org.members.find((m) => m.userId === user.uid);
            return member?.role || null;
          })
        );
      })
    );
  }

  /**
   * Método de debugging
   */
  debugCurrentState(): void {
    console.log('🏢 DEBUG - Organization Service State:');
    console.log('- Available organizations:', this.developmentOrganizations);

    this.getCurrentOrganization().subscribe((org) => {
      console.log('- Current organization:', org);
    });

    this.getCurrentOrganizationRole().subscribe((role) => {
      console.log('- Current organization role:', role);
    });
  }
}
