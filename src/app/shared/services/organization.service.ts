import { Injectable } from '@angular/core';
import {
  Observable,
  BehaviorSubject,
  map,
  switchMap,
  of,
  throwError,
  firstValueFrom,
  take,
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
  updateDoc,
  Timestamp,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
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

  // ✅ Flag para evitar múltiples inicializaciones
  private isInitialized = false;

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
    private auth: Auth,
    private authService: AuthService,
    private emailService: EmailService
  ) {
    // NO inicializar automáticamente - esperar a que el usuario se autentique
    console.log(
      '🚀 OrganizationService constructor - waiting for user authentication'
    );

    // Inicializar cuando el usuario esté autenticado
    this.initializeUserOrganization();

    // Exponer servicio para debugging
    if (typeof window !== 'undefined') {
      (window as any).organizationService = this;
      (window as any).debugInviteSystem = async () => {
        console.log('🔧 === DEBUGGING INVITATION SYSTEM ===');
        console.log('🔧 Firestore available:', !!this.firestore);
        console.log('🔧 AuthService available:', !!this.authService);
        console.log('🔧 EmailService available:', !!this.emailService);

        try {
          const currentUser = await firstValueFrom(
            this.authService.getCurrentUser()
          );
          console.log('🔧 Current user:', currentUser?.email);

          const currentOrg = await firstValueFrom(
            this.getCurrentOrganization()
          );
          console.log('🔧 Current organization:', currentOrg?.name);

          if (this.firestore && currentOrg) {
            console.log('🔧 Testing Firebase invitations access...');
            const invitationsCollection = collection(
              this.firestore,
              'invitations'
            );
            const snapshot = await getDocs(invitationsCollection);
            console.log('🔧 Firebase invitations found:', snapshot.docs.length);

            console.log('🔧 Testing invitation creation...');
            try {
              const testInvite = {
                organizationId: currentOrg.id,
                organizationName: currentOrg.name,
                invitedEmail: 'test@example.com',
                invitedBy: currentUser?.uid || 'test',
                role: 'user' as const,
                department: 'Test',
                message: 'Test invitation',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              };

              const result = await this.createInvitationInFirebase(testInvite);
              console.log('🔧 Test invitation created successfully:', result);
            } catch (inviteError) {
              console.error('🔧 Test invitation failed:', inviteError);
            }
          }
        } catch (error) {
          console.error('🔧 Debug failed:', error);
        }
      };
      console.log('🔧 OrganizationService exposed globally');
      console.log('🔧 Run debugInviteSystem() in console to test invitations');
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
   * Inicializa la organización del usuario autenticado
   */
  private async initializeUserOrganization(): Promise<void> {
    // ✅ Evitar múltiples inicializaciones
    if (this.isInitialized) {
      console.log('⚠️ OrganizationService already initialized, skipping...');
      return;
    }

    this.isInitialized = true;
    console.log('🚀 Initializing OrganizationService...');

    try {
      // ✅ CORREGIDO: Usar take(1) para evitar múltiples emisiones
      // Esperar a que el usuario esté autenticado (solo una vez)
      this.authService
        .getCurrentUser()
        .pipe(take(1))
        .subscribe(async (user) => {
          if (!user) {
            console.log(
              '❌ No authenticated user - using development fallback'
            );
            console.log(
              '📍 Setting organization to:',
              this.developmentOrganizations[0].name
            );
            this.currentOrganizationSubject.next(
              this.developmentOrganizations[0]
            );
            console.log('✅ Organization set successfully');
            return;
          }

          console.log('👤 User authenticated:', user.email);
          console.log('🔍 Loading user organization from Firebase...');

          try {
            // Intentar cargar la organización del usuario desde Firebase
            const userOrganizations =
              await this.loadUserOrganizationsFromFirebase(user.uid);

            if (userOrganizations.length > 0) {
              // Usar la primera organización encontrada (o la más reciente)
              const currentOrg = userOrganizations[0];
              console.log(
                '✅ User organization loaded from Firebase:',
                currentOrg.name
              );
              console.log('📍 Setting organization to:', currentOrg.name);
              this.currentOrganizationSubject.next(currentOrg);
              console.log('✅ Organization set successfully');

              // También agregar a la lista de desarrollo para compatibilidad
              if (
                !this.developmentOrganizations.find(
                  (org) => org.id === currentOrg.id
                )
              ) {
                this.developmentOrganizations.push(currentOrg);
              }
            } else {
              console.log(
                '⚠️ No organizations found for user - using development fallback'
              );
              console.log(
                '📍 Setting organization to:',
                this.developmentOrganizations[0].name
              );
              this.currentOrganizationSubject.next(
                this.developmentOrganizations[0]
              );
              console.log('✅ Organization set successfully');
            }
          } catch (error) {
            console.error('❌ Error loading user organization:', error);
            console.log('🔄 Falling back to development organization');
            console.log(
              '📍 Setting organization to:',
              this.developmentOrganizations[0].name
            );
            this.currentOrganizationSubject.next(
              this.developmentOrganizations[0]
            );
            console.log('✅ Organization set successfully');
          }
        });
    } catch (error) {
      console.error('❌ Error in initializeUserOrganization:', error);
      console.log(
        '📍 Setting organization to:',
        this.developmentOrganizations[0].name
      );
      this.currentOrganizationSubject.next(this.developmentOrganizations[0]);
      console.log('✅ Organization set successfully');
    }
  }

  /**
   * Carga las organizaciones del usuario desde Firebase
   */
  private async loadUserOrganizationsFromFirebase(
    userId: string
  ): Promise<Organization[]> {
    try {
      console.log('🔥 Querying Firebase for user organizations...');

      // Primero buscar en el documento del usuario cuál es su organización actual
      const userDoc = doc(this.firestore, `users/${userId}`);
      const userSnapshot = await getDoc(userDoc);

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        const currentOrgId = userData['organizationId'];

        if (currentOrgId) {
          console.log('🎯 Found user current organization ID:', currentOrgId);

          // Cargar la organización específica del usuario
          const orgDoc = doc(this.firestore, `organizations/${currentOrgId}`);
          const orgSnapshot = await getDoc(orgDoc);

          if (orgSnapshot.exists()) {
            const data = orgSnapshot.data();
            const org: Organization = {
              ...data,
              id: orgSnapshot.id,
              createdAt: data['createdAt']?.toDate() || new Date(),
              updatedAt: data['updatedAt']?.toDate() || new Date(),
              members:
                data['members']?.map((member: any) => ({
                  ...member,
                  joinedAt: member.joinedAt?.toDate() || new Date(),
                  lastActiveAt: member.lastActiveAt?.toDate() || new Date(),
                })) || [],
            } as Organization;

            console.log('✅ Loaded user organization from Firebase:', org.name);
            return [org];
          }
        }
      }

      // Fallback: buscar organizaciones donde el usuario es miembro
      console.log(
        '🔍 Fallback: searching organizations where user is member...'
      );
      const organizationsQuery = query(
        collection(this.firestore, 'organizations'),
        where('members', 'array-contains-any', [
          { userId: userId },
          userId, // Por si está guardado de forma simple
        ]),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(organizationsQuery);
      const firebaseOrgs: Organization[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Convertir Timestamps de vuelta a Date
        const org: Organization = {
          ...data,
          id: doc.id,
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date(),
          members:
            data['members']?.map((member: any) => ({
              ...member,
              joinedAt: member.joinedAt?.toDate() || new Date(),
              lastActiveAt: member.lastActiveAt?.toDate() || new Date(),
            })) || [],
        } as Organization;

        // Verificar que el usuario realmente es miembro
        const isMember = org.members.some((m) => m.userId === userId);
        if (isMember) {
          firebaseOrgs.push(org);
        }
      });

      console.log(
        `✅ Found ${firebaseOrgs.length} organizations for user in Firebase`
      );
      return firebaseOrgs;
    } catch (error) {
      console.error('❌ Error loading organizations from Firebase:', error);
      return [];
    }
  }

  /**
   * Obtiene la organización actual del usuario logueado
   */
  getCurrentOrganization(): Observable<Organization | null> {
    console.log('🔍 getCurrentOrganization() called');
    return this.currentOrganizationSubject.asObservable();
  }

  /**
   * Obtiene todas las organizaciones del usuario
   */
  getUserOrganizations(): Observable<Organization[]> {
    return this.authService.getCurrentUser().pipe(
      switchMap(async (user) => {
        if (!user) {
          return [];
        }

        try {
          // Buscar organizaciones en Firebase donde el usuario es miembro
          const organizationsQuery = query(
            collection(this.firestore, 'organizations'),
            where('members', 'array-contains-any', [
              { userId: user.uid },
              user.uid, // Por si está guardado de forma simple
            ])
          );

          const snapshot = await getDocs(organizationsQuery);
          const firebaseOrgs: Organization[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            // Convertir Timestamps de vuelta a Date
            const org: Organization = {
              ...data,
              id: doc.id,
              createdAt: data['createdAt']?.toDate() || new Date(),
              updatedAt: data['updatedAt']?.toDate() || new Date(),
              members:
                data['members']?.map((member: any) => ({
                  ...member,
                  joinedAt: member.joinedAt?.toDate() || new Date(),
                  lastActiveAt: member.lastActiveAt?.toDate() || new Date(),
                })) || [],
            } as Organization;

            // Verificar que el usuario realmente es miembro
            const isMember = org.members.some((m) => m.userId === user.uid);
            if (isMember) {
              firebaseOrgs.push(org);
            }
          });

          console.log(
            `� Found ${firebaseOrgs.length} organizations in Firebase for user ${user.email}`
          );

          // Combinar con datos de desarrollo si existen
          const devOrgs = this.isDevelopmentMode()
            ? this.developmentOrganizations
            : [];
          const allOrgs = [...firebaseOrgs, ...devOrgs];

          // Eliminar duplicados por ID
          const uniqueOrgs = allOrgs.filter(
            (org, index, self) =>
              index === self.findIndex((o) => o.id === org.id)
          );

          return uniqueOrgs;
        } catch (error) {
          console.error(
            '❌ Error fetching organizations from Firebase:',
            error
          );

          // Fallback a datos de desarrollo
          if (this.isDevelopmentMode()) {
            console.log('📝 Falling back to development organizations');
            return this.developmentOrganizations;
          }

          return [];
        }
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
        inviteToken: inviteData.code, // Para compatibilidad con búsquedas
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

    // Usar Firebase Auth directamente para evitar el problema de toPromise()
    const firebaseUser = this.auth.currentUser;

    if (!firebaseUser) {
      throw new Error('Usuario no autenticado');
    }

    const sent: OrganizationInvite[] = [];
    const failed: { email: string; error: string }[] = [];

    // Obtener información de la organización desde el BehaviorSubject
    const organization = this.currentOrganizationSubject.value;

    if (!organization) {
      console.error('❌ No current organization found');
      throw new Error('No se encontró la organización');
    }

    console.log('✅ Using organization:', organization.name);

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
          invitedBy: firebaseUser.uid,
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
          inviterName: firebaseUser.email || 'Administrador',
          inviterEmail: firebaseUser.email || '',
          inviteToken: inviteCode,
          joinUrl: `${window.location.origin}/join/${inviteCode}`,
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
    const timestamp = Date.now().toString(36).toUpperCase().slice(-3); // Últimos 3 chars del timestamp
    let result = '';

    // Generar 6 caracteres aleatorios
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
      if (i === 2) result += '-'; // Formato: ABC-123-XYZ
    }

    // Agregar timestamp para garantizar unicidad
    result += '-' + timestamp;

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

  /**
   * Método legacy: processBulkInvites - alias para sendBulkInvitations
   */
  async processBulkInvites(request: BulkInviteRequest): Promise<{
    sent: OrganizationInvite[];
    failed: { email: string; error: string }[];
  }> {
    return this.sendBulkInvitations(request);
  }

  /**
   * Obtiene todas las invitaciones (desarrollo)
   */
  getAllInvitations(organizationId: string): Promise<OrganizationInvite[]> {
    return this.getPendingInvitations(organizationId);
  }

  /**
   * Invita a un usuario por email (método individual)
   */
  async inviteUserWithEmail(
    email: string,
    role: 'admin' | 'moderator' | 'user' = 'user',
    department?: string,
    message?: string
  ): Promise<OrganizationInvite> {
    // Obtener organización del BehaviorSubject en lugar de toPromise()
    const organization = this.currentOrganizationSubject.value;
    if (!organization) {
      throw new Error('No se encontró la organización');
    }

    const bulkRequest: BulkInviteRequest = {
      organizationId: organization.id,
      invites: [
        {
          email,
          role,
          department,
          message,
        },
      ],
      defaultRole: role,
      defaultDepartment: department,
      personalMessage: message,
    };

    const result = await this.sendBulkInvitations(bulkRequest);

    if (result.sent.length > 0) {
      return result.sent[0];
    } else if (result.failed.length > 0) {
      throw new Error(result.failed[0].error);
    } else {
      throw new Error('Error inesperado al enviar la invitación');
    }
  }

  /**
   * Establece la organización actual (para navegación) y la guarda en Firebase
   */
  async setCurrentOrganization(organizationId: string): Promise<void> {
    try {
      // Buscar la organización en la lista de desarrollo primero
      let org = this.developmentOrganizations.find(
        (o) => o.id === organizationId
      );

      // Si no está en desarrollo, buscarla en Firebase
      if (!org) {
        console.log(
          '🔍 Organization not found in local list, searching Firebase...'
        );
        const orgDoc = doc(this.firestore, `organizations/${organizationId}`);
        const orgSnapshot = await getDoc(orgDoc);

        if (orgSnapshot.exists()) {
          const data = orgSnapshot.data();
          org = {
            ...data,
            id: orgSnapshot.id,
            createdAt: data['createdAt']?.toDate() || new Date(),
            updatedAt: data['updatedAt']?.toDate() || new Date(),
            members:
              data['members']?.map((member: any) => ({
                ...member,
                joinedAt: member.joinedAt?.toDate() || new Date(),
                lastActiveAt: member.lastActiveAt?.toDate() || new Date(),
              })) || [],
          } as Organization;

          // Agregarla a la lista local para futuras referencias
          this.developmentOrganizations.push(org);
          console.log('✅ Organization loaded from Firebase:', org.name);
        }
      }

      if (org) {
        // Establecer como organización actual
        this.currentOrganizationSubject.next(org);
        console.log(`🏢 Current organization set to: ${org.name}`);

        // Guardar la selección en Firebase para el usuario
        const firebaseUser = this.auth.currentUser;
        if (firebaseUser) {
          await this.updateUserOrganization(
            firebaseUser.uid,
            organizationId,
            'user'
          );
          console.log('💾 User organization preference saved to Firebase');
        }
      } else {
        console.error('❌ Organization not found:', organizationId);
      }
    } catch (error) {
      console.error('❌ Error setting current organization:', error);
    }
  }

  /**
   * Obtiene el rol del usuario actual en la organización
   */
  getCurrentOrganizationRole(): Observable<
    'owner' | 'admin' | 'moderator' | 'user' | null
  > {
    return this.authService.getCurrentUser().pipe(
      map((user) => {
        if (!user) return null;

        // ✅ CORREGIDO: Leer organizationRole directamente del usuario
        // en lugar de buscarlo en org.members
        const userOrgRole = (user as any).organizationRole;

        console.log(`🔍 getCurrentOrganizationRole for ${user.email}:`, {
          organizationRole: userOrgRole || 'NOT SET',
          globalRole: user.role,
        });

        return userOrgRole || null;
      })
    );
  }

  /**
   * Crea una nueva organización
   */
  async createOrganization(data: {
    name: string;
    description?: string;
    settings?: Partial<OrganizationSettings>;
  }): Promise<Organization> {
    console.log('🔥 Starting organization creation...', data);

    // Obtener usuario directamente desde Firebase Auth
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      console.error('❌ No authenticated user found');
      throw new Error('Usuario no autenticado');
    }

    console.log('✅ Authenticated user found:', firebaseUser.uid);

    try {
      // Crear la organización con un ID único
      const orgId = `org-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      console.log('🔥 Creating organization with ID:', orgId);

      const newOrg: Organization = {
        id: orgId,
        name: data.name,
        description: data.description || '',
        code: `${data.name
          .substring(0, 3)
          .toUpperCase()}-${new Date().getFullYear()}`,
        ownerId: firebaseUser.uid,
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
          departments: ['General'],
          ...data.settings,
        },
        members: [
          {
            userId: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: 'owner',
            joinedAt: new Date(),
            invitedBy: 'system',
            status: 'active',
            displayName: firebaseUser.email || 'Usuario',
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
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      console.log('🔥 Organization data prepared:', newOrg);

      // Guardar en Firebase
      console.log('🔥 Saving organization to Firebase...');
      const orgDoc = doc(this.firestore, `organizations/${orgId}`);

      const firestoreData = {
        ...newOrg,
        createdAt: Timestamp.fromDate(newOrg.createdAt),
        updatedAt: Timestamp.fromDate(newOrg.updatedAt),
        members: newOrg.members.map((member) => ({
          ...member,
          joinedAt: Timestamp.fromDate(member.joinedAt),
          lastActiveAt: member.lastActiveAt
            ? Timestamp.fromDate(member.lastActiveAt)
            : Timestamp.now(),
        })),
      };

      console.log('🔥 Firestore data prepared:', firestoreData);

      await setDoc(orgDoc, firestoreData);
      console.log('✅ Organization saved to Firebase successfully');

      // También guardar en desarrollo para compatibilidad
      this.developmentOrganizations.push(newOrg);
      this.currentOrganizationSubject.next(newOrg);

      // Actualizar el usuario con la organización
      console.log('🔥 Updating user organization...');
      await this.updateUserOrganization(firebaseUser.uid, orgId, 'owner');
      console.log('✅ User organization updated');

      console.log('✅ Organization creation completed:', newOrg);

      // Disparar evento para que otros servicios se actualicen
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('organizationCreated', {
            detail: { organization: newOrg },
          })
        );
        // También disparar evento de cambio para que el menú se actualice
        window.dispatchEvent(
          new CustomEvent('organizationChanged', {
            detail: { organization: newOrg },
          })
        );
      }

      return newOrg;
    } catch (error) {
      console.error('❌ Error creating organization:', error);
      throw new Error(`Error al crear la organización: ${error}`);
    }
  }

  /**
   * Actualiza la organización del usuario en Firebase
   */
  private async updateUserOrganization(
    userId: string,
    organizationId: string,
    role: string
  ): Promise<void> {
    try {
      const userDoc = doc(this.firestore, `users/${userId}`);
      await updateDoc(userDoc, {
        organizationId: organizationId,
        organizationRole: role,
        updatedAt: Timestamp.now(),
      });
      console.log('✅ User organization updated in Firebase');
    } catch (error) {
      console.error('❌ Error updating user organization:', error);
    }
  }

  /**
   * Acepta una invitación por email desde Firebase
   */
  async acceptEmailInvite(code: string): Promise<Organization> {
    try {
      console.log('🔍 Searching for invitation with code:', code);

      // Buscar la invitación en Firebase (buscamos por ambos campos para compatibilidad)
      const invitationsRef = collection(this.firestore, 'invitations');

      // Primero intentamos buscar por inviteToken
      let q = query(
        invitationsRef,
        where('inviteToken', '==', code),
        where('status', '==', 'pending')
      );
      let querySnapshot = await getDocs(q);

      // Si no encontramos por inviteToken, buscamos por code
      if (querySnapshot.empty) {
        console.log('🔍 Not found by inviteToken, trying by code field...');
        q = query(
          invitationsRef,
          where('code', '==', code),
          where('status', '==', 'pending')
        );
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
        console.error('❌ No invitation found with code:', code);
        // Mostrar todas las invitaciones pendientes para debug
        const allPendingQ = query(
          invitationsRef,
          where('status', '==', 'pending')
        );
        const allPending = await getDocs(allPendingQ);
        console.log(
          '📋 All pending invitations:',
          allPending.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              code: data['code'],
              inviteToken: data['inviteToken'],
              email: data['invitedEmail'],
            };
          })
        );
        throw new Error('Invitación no encontrada o ya utilizada');
      }

      const inviteDoc = querySnapshot.docs[0];
      const invite = {
        id: inviteDoc.id,
        ...inviteDoc.data(),
      } as OrganizationInvite;

      console.log('📧 Found invitation:', invite);

      // Verificar si está expirada
      const now = new Date();
      const expiresAt =
        invite.expiresAt instanceof Timestamp
          ? invite.expiresAt.toDate()
          : new Date(invite.expiresAt);

      if (expiresAt < now) {
        throw new Error('Esta invitación ha expirado');
      }

      // Buscar la organización en Firebase
      const orgDoc = await getDoc(
        doc(this.firestore, 'organizations', invite.organizationId)
      );

      if (!orgDoc.exists()) {
        throw new Error('Organización no encontrada');
      }

      const organization = { id: orgDoc.id, ...orgDoc.data() } as Organization;
      console.log('🏢 Found organization:', organization);

      // Obtener el usuario actual
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        throw new Error('Debes estar autenticado para aceptar la invitación');
      }

      // Agregar el usuario a la organización
      await this.addMemberToOrganization(invite.organizationId, {
        userId: currentUser.uid,
        email: currentUser.email || invite.invitedEmail,
        role: invite.role,
        department: invite.department,
      });

      // Marcar la invitación como aceptada
      await updateDoc(doc(this.firestore, 'invitations', inviteDoc.id), {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        acceptedBy: currentUser.uid,
      });

      // Actualizar el perfil del usuario con la organización
      const userDoc = doc(this.firestore, 'users', currentUser.uid);
      await updateDoc(userDoc, {
        organizationId: invite.organizationId,
        role: invite.role,
        department: invite.department || null,
        updatedAt: Timestamp.now(),
      });

      // Establecer como organización actual
      await this.setCurrentOrganization(organization.id);

      console.log('✅ Email invitation accepted successfully:', organization);
      return organization;
    } catch (error) {
      console.error('❌ Error accepting email invitation:', error);
      throw error;
    }
  }

  /**
   * Acepta una invitación
   */
  async acceptInvite(inviteToken: string): Promise<Organization> {
    return this.acceptEmailInvite(inviteToken);
  }

  /**
   * Agrega un miembro a la organización
   */
  async addMemberToOrganization(
    organizationId: string,
    userData: {
      userId: string;
      email: string;
      role: 'admin' | 'moderator' | 'user';
      department?: string;
    }
  ): Promise<void> {
    try {
      console.log('👤 Adding member to organization:', {
        organizationId,
        userData,
      });

      // Verificar que la organización existe en Firebase
      const orgDoc = await getDoc(
        doc(this.firestore, 'organizations', organizationId)
      );

      if (!orgDoc.exists()) {
        throw new Error('Organización no encontrada');
      }

      const newMember: OrganizationMember = {
        userId: userData.userId,
        email: userData.email,
        role: userData.role,
        department: userData.department || 'General',
        joinedAt: new Date(),
        invitedBy: 'system',
        status: 'active',
        displayName: userData.email,
        lastActiveAt: new Date(),
        permissions: {
          canCreateZones: userData.role !== 'user',
          canCreateMarkers: true,
          canExportData: userData.role !== 'user',
          canViewAnalytics: userData.role !== 'user',
          canManageMembers: userData.role === 'admin',
          canBulkInvite: userData.role === 'admin',
        },
      };

      // Agregar el miembro a la subcolección 'members' de la organización
      const membersRef = collection(
        this.firestore,
        'organizations',
        organizationId,
        'members'
      );
      await addDoc(membersRef, newMember);

      console.log('✅ Member added to organization successfully');
    } catch (error) {
      console.error('❌ Error adding member to organization:', error);
      throw error;
    }
  }
}
