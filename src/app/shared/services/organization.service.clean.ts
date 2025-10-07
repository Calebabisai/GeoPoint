import { Injectable } from '@angular/core';
import {
  Observable,
  BehaviorSubject,
  map,
  switchMap,
  of,
  throwError,
} from 'rxjs';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  addDoc,
  getDoc,
} from '@angular/fire/firestore';
import { AuthService } from '../../auth/services/auth.service';
import { EmailService, EmailInviteConfig } from './email.service';
import {
  Organization,
  OrganizationMember,
  OrganizationInvite,
  OrganizationSettings,
  BulkInviteRequest,
  MemberFilters,
  OrganizationStats,
} from '../models/organization.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
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
        maxMembers: 100,
        autoApproveFromDomains: false,
        allowedDomains: [],
        features: {
          canCreateZones: true,
          canCreateMarkers: true,
          canExportData: true,
          canViewAnalytics: true,
          canManageMembers: true,
          canBulkInvite: true,
        },
        visibility: 'private',
        departments: ['General', 'Administración', 'Operaciones', 'Técnico'],
      },
      members: [
        {
          userId: 'user-1',
          email: 'demo@test.com',
          role: 'owner',
          joinedAt: new Date('2024-01-01'),
          invitedBy: 'system',
          status: 'active',
          displayName: 'Usuario Demo',
          department: 'General',
          lastActiveAt: new Date(),
          permissions: {
            canCreateZones: true,
            canCreateMarkers: true,
            canExportData: true,
            canViewAnalytics: true,
            canManageMembers: true,
            canBulkInvite: true,
          },
        },
      ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
      isActive: true,
    },
  ];

  // Almacenar invitaciones en memoria (para desarrollo)
  private pendingInvites: OrganizationInvite[] = [
    {
      id: 'invite-1',
      organizationId: 'org-1',
      organizationName: 'Empresa Demo',
      invitedEmail: 'nuevo.usuario@ejemplo.com',
      invitedBy: 'admin-user-1',
      role: 'user',
      code: 'ABC123XYZ',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // hace 2 días
      status: 'pending',
      department: 'General',
      message: 'Te invitamos a unirte a nuestro equipo de trabajo',
    },
    {
      id: 'invite-2',
      organizationId: 'org-1',
      organizationName: 'Empresa Demo',
      invitedEmail: 'colaborador@empresa.com',
      invitedBy: 'admin-user-1',
      role: 'user',
      code: 'DEF456UVW',
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 días
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // hace 1 día
      status: 'pending',
      department: 'Operaciones',
    },
    {
      id: 'invite-3',
      organizationId: 'org-1',
      organizationName: 'Empresa Demo',
      invitedEmail: 'supervisor@trabajo.com',
      invitedBy: 'admin-user-1',
      role: 'moderator',
      code: 'GHI789RST',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 días
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // hace 3 horas
      status: 'pending',
      department: 'Administración',
    },
  ];

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private emailService: EmailService
  ) {
    // Inicializar inmediatamente con la organización de desarrollo
    console.log(
      '🚀 OrganizationService constructor - initializing development organization'
    );
    this.currentOrganizationSubject.next(this.developmentOrganizations[0]);

    // Exponer servicio para debugging
    if (typeof window !== 'undefined') {
      (window as any).organizationService = this;
      console.log('🔧 OrganizationService exposed globally');
      console.log(
        '🏢 Development organization loaded:',
        this.developmentOrganizations[0]
      );
      console.log('🔥 Firestore available:', !!this.firestore);
      console.log('🔍 AuthService available:', !!this.authService);
      console.log('📧 EmailService available:', !!this.emailService);
    }
  }

  /**
   * Obtiene la organización actual del usuario logueado
   */
  getCurrentOrganization(): Observable<Organization | null> {
    return this.currentOrganizationSubject.asObservable();
  }

  /**
   * Obtiene todas las organizaciones del usuario
   */
  getUserOrganizations(): Observable<Organization[]> {
    return this.authService.getCurrentUser().pipe(
      switchMap((user) => {
        if (!user) {
          return of([]);
        }

        // En desarrollo, usar datos simulados
        if (this.isDevelopmentMode()) {
          console.log('📝 Using development organizations');
          return of(this.developmentOrganizations);
        }

        // TODO: Implementar consulta real a Firestore
        return of([]);
      })
    );
  }

  /**
   * NUEVO: Obtiene usuarios de una organización desde Firebase
   */
  async getOrganizationUsersFromFirebase(
    organizationId: string
  ): Promise<User[]> {
    try {
      console.log(
        `🔥 Getting users from Firebase for organization: ${organizationId}`
      );

      // Consultar usuarios que pertenecen a esta organización
      const usersCollection = collection(this.firestore, 'users');
      const usersQuery = query(
        usersCollection,
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(usersQuery);

      const users: User[] = [];
      snapshot.docs.forEach((doc) => {
        const userData = { uid: doc.id, ...doc.data() } as User;
        users.push(userData);
      });

      console.log(
        `✅ Found ${users.length} users in Firebase for organization ${organizationId}`
      );
      return users;
    } catch (error) {
      console.error(
        '🔥 Error getting organization users from Firebase:',
        error
      );
      return [];
    }
  }

  /**
   * NUEVO: Crea una invitación en Firebase
   */
  async createInvitationInFirebase(
    inviteData: Partial<OrganizationInvite>
  ): Promise<string> {
    try {
      console.log('🔥 Creating invitation in Firebase:', inviteData);

      // Crear documento en la colección 'invitations'
      const invitationsCollection = collection(this.firestore, 'invitations');

      const inviteDocument = {
        organizationId: inviteData.organizationId,
        organizationName: inviteData.organizationName,
        invitedEmail: inviteData.invitedEmail,
        invitedBy: inviteData.invitedBy,
        role: inviteData.role || 'user',
        code: inviteData.code,
        expiresAt: inviteData.expiresAt,
        createdAt: new Date(),
        status: 'pending',
        department: inviteData.department,
        message: inviteData.message,
      };

      const docRef = await addDoc(invitationsCollection, inviteDocument);

      console.log('✅ Invitation created in Firebase with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('🔥 Error creating invitation in Firebase:', error);
      throw error;
    }
  }

  /**
   * NUEVO: Obtiene invitaciones de una organización desde Firebase
   */
  async getFirebaseOrganizationInvitations(
    organizationId: string
  ): Promise<OrganizationInvite[]> {
    try {
      console.log(
        `🔥 Getting invitations from Firebase for organization: ${organizationId}`
      );

      // Consultar invitaciones de esta organización
      const invitationsCollection = collection(this.firestore, 'invitations');
      const invitationsQuery = query(
        invitationsCollection,
        where('organizationId', '==', organizationId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(invitationsQuery);

      const invitations: OrganizationInvite[] = [];
      snapshot.docs.forEach((doc) => {
        const inviteData = { id: doc.id, ...doc.data() } as OrganizationInvite;
        invitations.push(inviteData);
      });

      console.log(
        `✅ Found ${invitations.length} pending invitations in Firebase for organization ${organizationId}`
      );
      return invitations;
    } catch (error) {
      console.error('🔥 Error getting invitations from Firebase:', error);
      return [];
    }
  }

  /**
   * Obtiene las invitaciones pendientes de una organización (desarrollo)
   */
  async getPendingInvitations(
    organizationId: string
  ): Promise<OrganizationInvite[]> {
    console.log(
      `📧 Getting pending invitations for organization: ${organizationId}`
    );

    // Primero intentar Firebase
    try {
      const firebaseInvites = await this.getFirebaseOrganizationInvitations(
        organizationId
      );
      if (firebaseInvites.length > 0) {
        return firebaseInvites;
      }
    } catch (error) {
      console.error('Firebase invitations failed, using fallback:', error);
    }

    // Fallback a datos de desarrollo
    const pendingInvites = this.pendingInvites.filter(
      (invite) =>
        invite.organizationId === organizationId && invite.status === 'pending'
    );

    console.log(
      `📧 Found ${pendingInvites.length} pending invitations (development fallback)`
    );
    return pendingInvites;
  }

  /**
   * Envía invitaciones por email usando Firebase backend
   */
  async sendBulkInvitations(request: BulkInviteRequest): Promise<{
    sent: OrganizationInvite[];
    failed: { email: string; error: string }[];
  }> {
    console.log('📧 Starting bulk invitation process...');
    console.log('📧 Request:', request);

    const currentUser = await this.authService.getCurrentUser().toPromise();

    if (!currentUser) {
      throw new Error('Usuario no autenticado');
    }

    const sent: OrganizationInvite[] = [];
    const failed: { email: string; error: string }[] = [];

    // Obtener información de la organización
    const organization = await this.getCurrentOrganization().toPromise();

    if (!organization) {
      throw new Error('No se encontró la organización');
    }

    for (const inviteRequest of request.invites) {
      try {
        console.log(`📧 Processing invitation for: ${inviteRequest.email}`);

        // Generar código único
        const inviteCode = this.generateInviteCode();

        // Calcular fecha de expiración (7 días por defecto)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Crear invitación
        const invite: OrganizationInvite = {
          id: '', // Se asignará en Firebase
          organizationId: organization.id,
          organizationName: organization.name,
          invitedEmail: inviteRequest.email,
          invitedBy: currentUser.uid,
          role: inviteRequest.role || request.defaultRole,
          code: inviteCode,
          expiresAt,
          createdAt: new Date(),
          status: 'pending',
          department: inviteRequest.department || request.defaultDepartment,
          message: inviteRequest.message || request.personalMessage,
        };

        // Intentar crear en Firebase primero
        try {
          const firebaseId = await this.createInvitationInFirebase(invite);
          invite.id = firebaseId;
          console.log(
            `✅ Invitation created in Firebase for ${inviteRequest.email}`
          );
        } catch (firebaseError) {
          console.error(
            `🔥 Firebase creation failed for ${inviteRequest.email}:`,
            firebaseError
          );
          // Fallback: usar ID temporal y agregar a lista local
          invite.id = `temp-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          this.pendingInvites.push(invite);
          console.log(
            `📝 Added invitation to local storage for ${inviteRequest.email}`
          );
        }

        // Configurar email
        const emailConfig: EmailInviteConfig = {
          organizationName: organization.name,
          inviterName: currentUser.email || 'Administrador',
          inviterEmail: currentUser.email || '',
          inviteToken: inviteCode,
          joinUrl: `${window.location.origin}/join?code=${inviteCode}`,
          expirationDate: expiresAt,
          personalMessage: inviteRequest.message || request.personalMessage,
          userRole: inviteRequest.role || request.defaultRole,
          department: inviteRequest.department || request.defaultDepartment,
        };

        // Enviar email
        await this.emailService.sendInvitation(invite, emailConfig);

        sent.push(invite);
        console.log(
          `✅ Invitation sent successfully to: ${inviteRequest.email}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to send invitation to ${inviteRequest.email}:`,
          error
        );
        failed.push({
          email: inviteRequest.email,
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    console.log('📧 Bulk invitation process completed');
    console.log(`✅ Sent: ${sent.length}, ❌ Failed: ${failed.length}`);

    return { sent, failed };
  }

  /**
   * Genera un código único para invitaciones
   */
  private generateInviteCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 9; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
      if (i === 2 || i === 5) result += '-'; // Formato: ABC-123-XYZ
    }
    return result;
  }

  /**
   * Verifica si estamos en modo desarrollo
   */
  private isDevelopmentMode(): boolean {
    // Si Firestore está disponible, usar datos reales independientemente del entorno
    const hasFirestore = !!this.firestore;

    // Solo usar modo desarrollo si Firestore NO está disponible o si está explícitamente activado
    const forceDevelopmentMode =
      typeof window !== 'undefined' && (window as any).forceDevelopmentMode;

    const isDev = !hasFirestore || forceDevelopmentMode;

    console.log('🔧 Development mode check:', {
      hasFirestore,
      forceDevelopmentMode,
      isDev,
      note: isDev ? 'Using development data' : 'Using Firebase data',
    });

    return isDev;
  }

  /**
   * Obtiene estadísticas de la organización
   */
  getOrganizationStats(organizationId: string): Observable<OrganizationStats> {
    return this.getUserOrganizations().pipe(
      map((organizations) => {
        const org = organizations.find((o) => o.id === organizationId);

        if (!org) {
          return {
            totalMembers: 0,
            activeMembers: 0,
            pendingInvites: 0,
            membersByRole: {},
            membersByDepartment: {},
            memberGrowth: {
              thisMonth: 0,
              lastMonth: 0,
              growth: 0,
            },
          };
        }

        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
        const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000;

        // Calcular miembros por rol
        const membersByRole: Record<string, number> = {};
        org.members.forEach((member) => {
          membersByRole[member.role] = (membersByRole[member.role] || 0) + 1;
        });

        // Calcular miembros por departamento
        const membersByDepartment: Record<string, number> = {};
        org.members.forEach((member) => {
          if (member.department) {
            membersByDepartment[member.department] =
              (membersByDepartment[member.department] || 0) + 1;
          }
        });

        // Calcular crecimiento de miembros
        const thisMonthMembers = org.members.filter(
          (m) => m.joinedAt.getTime() > oneMonthAgo
        ).length;

        const lastMonthMembers = org.members.filter(
          (m) =>
            m.joinedAt.getTime() > twoMonthsAgo &&
            m.joinedAt.getTime() <= oneMonthAgo
        ).length;

        const growth =
          lastMonthMembers > 0
            ? ((thisMonthMembers - lastMonthMembers) / lastMonthMembers) * 100
            : 0;

        return {
          totalMembers: org.members.length,
          activeMembers: org.members.filter(
            (m) => m.lastActiveAt && m.lastActiveAt.getTime() > oneDayAgo
          ).length,
          pendingInvites: this.pendingInvites.filter(
            (i) => i.organizationId === organizationId && i.status === 'pending'
          ).length,
          membersByRole,
          membersByDepartment,
          memberGrowth: {
            thisMonth: thisMonthMembers,
            lastMonth: lastMonthMembers,
            growth: Math.round(growth * 100) / 100,
          },
        };
      })
    );
  }

  /**
   * Busca miembros por email o nombre
   */
  searchMembers(
    organizationId: string,
    searchTerm: string
  ): Observable<OrganizationMember[]> {
    return this.getUserOrganizations().pipe(
      map((organizations) => {
        const org = organizations.find((o) => o.id === organizationId);

        if (!org) return [];

        return org.members.filter(
          (member) =>
            member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
    );
  }

  /**
   * Filtra miembros según criterios
   */
  filterMembers(
    organizationId: string,
    filters: MemberFilters
  ): Observable<OrganizationMember[]> {
    return this.getUserOrganizations().pipe(
      map((organizations) => {
        const org = organizations.find((o) => o.id === organizationId);

        if (!org) return [];

        let filteredMembers = [...org.members];

        if (filters.role) {
          filteredMembers = filteredMembers.filter(
            (m) => m.role === filters.role
          );
        }

        if (filters.department) {
          filteredMembers = filteredMembers.filter(
            (m) => m.department === filters.department
          );
        }

        if (filters.status) {
          filteredMembers = filteredMembers.filter(
            (m) => m.status === filters.status
          );
        }

        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredMembers = filteredMembers.filter(
            (m) =>
              m.email.toLowerCase().includes(searchLower) ||
              (m.displayName &&
                m.displayName.toLowerCase().includes(searchLower))
          );
        }

        return filteredMembers;
      })
    );
  }
}
