import { Injectable, inject, signal, computed, effect, Signal, Injector } from '@angular/core';
import {
  Observable,
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
import { FirestoreService } from 'src/app/services/firestore.service';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private authService = inject(AuthService);
  private emailService = inject(EmailService);
  private injector = inject(Injector);

  // Signals
  private currentOrganizationSignal = signal<Organization | null>(null);
  private isLoadingSignal = signal(false);
  private lastErrorSignal = signal<string | null>(null);
  private isInitializedSignal = signal(false);
  private organizationRoleSignal = signal<'owner' | 'admin' | 'moderator' | 'user' | null>(null);
  private userOrganizationsSignal = signal<Organization[]>([]);
  private organizationStatsSignal = signal<OrganizationStats | null>(null);
  private searchResultsSignal = signal<OrganizationMember[]>([]);
  private filteredMembersSignal = signal<OrganizationMember[]>([]);

  // Readonly exports
  readonly currentOrganization = this.currentOrganizationSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();
  readonly organizationRole = this.organizationRoleSignal.asReadonly();
  readonly userOrganizations = this.userOrganizationsSignal.asReadonly();
  readonly organizationStats = this.organizationStatsSignal.asReadonly();
  readonly searchResults = this.searchResultsSignal.asReadonly();
  readonly filteredMembers = this.filteredMembersSignal.asReadonly();

  // Computed signals
  readonly hasError = computed(() => this.lastErrorSignal() !== null);
  readonly currentOrgName = computed(() => this.currentOrganizationSignal()?.name || null);
  readonly currentOrgId = computed(() => this.currentOrganizationSignal()?.id || null);
  readonly memberCount = computed(() => this.currentOrganizationSignal()?.members.length || 0);

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

  // Almacenar invitaciones en memoria
  private pendingInvites: OrganizationInvite[] = [
    {
      id: 'invite-1',
      organizationId: 'org-1',
      organizationName: 'Empresa Demo',
      invitedEmail: 'nuevo.usuario@ejemplo.com',
      invitedBy: 'admin-user-1',
      role: 'user',
      code: 'ABC123XYZ',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
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
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
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
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      status: 'pending',
      department: 'Administración',
    },
  ];

  constructor() {
    // Effect para cargar la organización cuando el usuario cambia
    effect(() => {
      const user = this.authService.currentUser();
      
      if (user) {
        // Cargar organización del usuario desde Firebase
        this.loadCurrentUserOrganization(user.uid);
      } else {
        // Sin usuario, limpiar o usar demo
        if (this.isDevelopmentMode()) {
          this.currentOrganizationSignal.set(this.developmentOrganizations[0]);
        } else {
          this.currentOrganizationSignal.set(null);
        }
        this.organizationRoleSignal.set(null);
      }
    });

    // Debug tools (mantener si lo necesitas)
    if (typeof window !== 'undefined') {
      (window as any).organizationService = this;
    }
  }

  /**
   * Carga la organización actual del usuario desde Firebase
   */
  private async loadCurrentUserOrganization(userId: string): Promise<void> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      // Primero, intentar obtener el organizationId del signal del usuario
      const currentUser = this.authService.currentUser();
      let organizationId = currentUser?.organizationId;

      // Si no está en el signal, buscarlo en Firestore
      if (!organizationId) {
        console.log(' organizationId not in signal, fetching from Firestore...');
        const userDocRef = doc(this.firestore, `users/${userId}`);
        const userSnapshot = await getDoc(userDocRef);

        if (!userSnapshot.exists()) {
          console.warn(' User document not found in Firestore');
          this.currentOrganizationSignal.set(null);
          return;
        }

        const userData = userSnapshot.data();
        organizationId = userData['organizationId'];
      }

      if (!organizationId) {
        console.log(' User has no organization assigned');
        this.currentOrganizationSignal.set(null);
        return;
      }

      console.log(' Loading organization:', organizationId);

      // Cargar la organización
      const orgDoc = doc(this.firestore, `organizations/${organizationId}`);
      const orgSnapshot = await getDoc(orgDoc);

      if (!orgSnapshot.exists()) {
        console.warn(' Organization not found:', organizationId);
        this.currentOrganizationSignal.set(null);
        return;
      }

      const data = orgSnapshot.data();
      const organization: Organization = {
        ...data,
        id: orgSnapshot.id,
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date(),
        members: data['members']?.map((member: any) => ({
          ...member,
          joinedAt: member.joinedAt?.toDate() || new Date(),
          lastActiveAt: member.lastActiveAt?.toDate() || new Date(),
        })) || [],
      } as Organization;

      // Obtener el rol del usuario en la organización
      const userMember = organization.members.find(m => m.userId === userId);
      if (userMember) {
        this.organizationRoleSignal.set(userMember.role as any);
      }

      this.currentOrganizationSignal.set(organization);
      console.log(' Organization loaded:', organization.name);

    } catch (error) {
      console.error(' Error loading user organization:', error);
      this.lastErrorSignal.set(error instanceof Error ? error.message : 'Error loading organization');
      this.currentOrganizationSignal.set(null);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Inicializa la organización del usuario autenticado
   */
  private async initializeUserOrganization(): Promise<void> {
    if (this.isInitializedSignal()) {
      return;
    }

    this.isInitializedSignal.set(true);
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const user = this.authService.getCurrentUser()();
      
      try {
        if (!user) {
          this.currentOrganizationSignal.set(this.developmentOrganizations[0]);
          return;
        }

        const userOrganizations =
          await this.loadUserOrganizationsFromFirebase(user.uid);

        if (userOrganizations.length > 0) {
          this.currentOrganizationSignal.set(userOrganizations[0]);

          if (
            !this.developmentOrganizations.find(
              (org) => org.id === userOrganizations[0].id
            )
          ) {
            this.developmentOrganizations.push(userOrganizations[0]);
          }
        } else {
          this.currentOrganizationSignal.set(this.developmentOrganizations[0]);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error loading organization';
        this.lastErrorSignal.set(errorMsg);
        this.currentOrganizationSignal.set(this.developmentOrganizations[0]);
      } finally {
        this.isLoadingSignal.set(false);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Initialization error';
      this.lastErrorSignal.set(errorMsg);
      this.currentOrganizationSignal.set(this.developmentOrganizations[0]);
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Carga las organizaciones del usuario desde Firebase
   */
  private async loadUserOrganizationsFromFirebase(
    userId: string
  ): Promise<Organization[]> {
    try {
      const userDoc = doc(this.firestore, `users/${userId}`);
      const userSnapshot = await getDoc(userDoc);

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        const currentOrgId = userData['organizationId'];

        if (currentOrgId) {
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

            return [org];
          }
        }
      }

      return [];
    } catch (error) {
      console.error('Error loading organizations from Firebase:', error);
      return [];
    }
  }

  /**
   * Obtiene la organización actual como Observable
   */
  getCurrentOrganization(): Observable<Organization | null> {
    return new Observable((observer) => {
      observer.next(this.currentOrganizationSignal());
      observer.complete();
    });
  }

  /**
   * Obtiene todas las organizaciones del usuario
   */
  getUserOrganizations(): Signal<Organization[]> {
    return this.userOrganizationsSignal.asReadonly();
  }

  /**
   * Carga las organizaciones del usuario desde Firebase (private)
   */
  private async loadUserOrganizationsToSignal(): Promise<void> {
    try {
      const user = this.authService.getCurrentUser()();
      
      if (!user) {
        this.userOrganizationsSignal.set([]);
        return;
      }

      const organizationsQuery = query(
        collection(this.firestore, 'organizations'),
        where('members', 'array-contains-any', [
          { userId: user.uid },
          user.uid,
        ])
      );

      const snapshot = await getDocs(organizationsQuery);
      const firebaseOrgs: Organization[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
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

        const isMember = org.members.some((m: OrganizationMember) => m.userId === user.uid);
        if (isMember) {
          firebaseOrgs.push(org);
        }
      });

      const devOrgs = this.isDevelopmentMode()
        ? this.developmentOrganizations
        : [];
      const allOrgs = [...firebaseOrgs, ...devOrgs];

      const uniqueOrgs = allOrgs.filter(
        (org: Organization, index: number, self: Organization[]) =>
          index === self.findIndex((o: Organization) => o.id === org.id)
      );

      this.userOrganizationsSignal.set(uniqueOrgs);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      const devOrgs = this.isDevelopmentMode() ? this.developmentOrganizations : [];
      this.userOrganizationsSignal.set(devOrgs);
    }
  }

  /**
   * Obtiene usuarios de una organización desde Firebase
   */
  async getOrganizationUsersFromFirebase(
    organizationId: string
  ): Promise<User[]> {
    try {
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

      return users;
    } catch (error) {
      console.error('Error getting organization users:', error);
      return [];
    }
  }

  /**
   * Crea una invitación en Firebase
   */
  async createInvitationInFirebase(
    inviteData: Partial<OrganizationInvite>
  ): Promise<string> {
    try {
      const invitationsCollection = collection(this.firestore, 'invitations');

      const inviteDocument = {
        organizationId: inviteData.organizationId,
        organizationName: inviteData.organizationName,
        invitedEmail: inviteData.invitedEmail,
        invitedBy: inviteData.invitedBy,
        role: inviteData.role || 'user',
        code: inviteData.code,
        inviteToken: inviteData.code,
        expiresAt: inviteData.expiresAt,
        createdAt: new Date(),
        status: 'pending',
        department: inviteData.department,
        message: inviteData.message,
      };

      const docRef = await addDoc(invitationsCollection, inviteDocument);
      return docRef.id;
    } catch (error) {
      console.error('Error creating invitation in Firebase:', error);
      throw error;
    }
  }

  /**
   * Obtiene invitaciones de una organización desde Firebase
   */
  async getFirebaseOrganizationInvitations(
    organizationId: string
  ): Promise<OrganizationInvite[]> {
    try {
      const invitationsCollection = collection(this.firestore, 'invitations');
      
      const invitationsQuery = query(
        invitationsCollection,
        where('organizationId', '==', organizationId),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(invitationsQuery);
      const invitations: OrganizationInvite[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        invitations.push({
          id: docSnap.id,
          ...data,
          createdAt: data['createdAt']?.toDate?.() || new Date(),
          expiresAt: data['expiresAt']?.toDate?.() || new Date(),
        } as OrganizationInvite);
      });

      return invitations.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.warn('Could not fetch invitations from Firebase:', error);
      return [];
    }
  }

  /**
   * Obtiene las invitaciones pendientes de una organización
   */
  async getPendingInvitations(
    organizationId: string
  ): Promise<OrganizationInvite[]> {
    try {
      const firebaseInvites = await this.getFirebaseOrganizationInvitations(
        organizationId
      );
      if (firebaseInvites.length > 0) {
        return firebaseInvites;
      }
    } catch (error) {
      console.error('Firebase invitations failed:', error);
    }

    const pendingInvites = this.pendingInvites.filter(
      (invite) =>
        invite.organizationId === organizationId && invite.status === 'pending'
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
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const firebaseUser = this.auth.currentUser;

      if (!firebaseUser) {
        throw new Error('Usuario no autenticado');
      }

      const sent: OrganizationInvite[] = [];
      const failed: { email: string; error: string }[] = [];

      const organization = this.currentOrganizationSignal();

      if (!organization) {
        throw new Error('No se encontró la organización');
      }

      for (const inviteRequest of request.invites) {
        try {
          const inviteCode = this.generateInviteCode();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          const invite: OrganizationInvite = {
            id: '',
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

          try {
            const firebaseId = await this.createInvitationInFirebase(invite);
            invite.id = firebaseId;
          } catch (firebaseError) {
            invite.id = `temp-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            this.pendingInvites.push(invite);
          }

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

          await this.emailService.sendInvitation(invite, emailConfig);
          sent.push(invite);
        } catch (error) {
          failed.push({
            email: inviteRequest.email,
            error: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      }

      return { sent, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error en bulk invitations';
      this.lastErrorSignal.set(errorMsg);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Genera un código único para invitaciones
   */
  private generateInviteCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const timestamp = Date.now().toString(36).toUpperCase().slice(-3);
    let result = '';

    for (let i = 0; i < 6; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
      if (i === 2) result += '-';
    }

    result += '-' + timestamp;
    return result;
  }

  /**
   * Verifica si estamos en modo desarrollo
   */
  private isDevelopmentMode(): boolean {
    const hasFirestore = !!this.firestore;
    const forceDevelopmentMode =
      typeof window !== 'undefined' && (window as any).forceDevelopmentMode;

    return !hasFirestore || forceDevelopmentMode;
  }

  /**
   * Obtiene estadísticas de la organización como Signal
   */
  getOrganizationStats(organizationId: string): Signal<OrganizationStats | null> {
    const statsComputed = computed(() => {
      const organizations = this.userOrganizationsSignal();
      const org = organizations.find((o: Organization) => o.id === organizationId);

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

      const membersByRole: Record<string, number> = {};
      org.members.forEach((member: OrganizationMember) => {
        membersByRole[member.role] = (membersByRole[member.role] || 0) + 1;
      });

      const membersByDepartment: Record<string, number> = {};
      org.members.forEach((member: OrganizationMember) => {
        if (member.department) {
          membersByDepartment[member.department] =
            (membersByDepartment[member.department] || 0) + 1;
        }
      });

      const thisMonthMembers = org.members.filter(
        (m: OrganizationMember) => m.joinedAt.getTime() > oneMonthAgo
      ).length;

      const lastMonthMembers = org.members.filter(
        (m: OrganizationMember) =>
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
          (m: OrganizationMember) => m.lastActiveAt && m.lastActiveAt.getTime() > oneDayAgo
        ).length,
        pendingInvites: this.pendingInvites.filter(
          (i: OrganizationInvite) => i.organizationId === organizationId && i.status === 'pending'
        ).length,
        membersByRole,
        membersByDepartment,
        memberGrowth: {
          thisMonth: thisMonthMembers,
          lastMonth: lastMonthMembers,
          growth: Math.round(growth * 100) / 100,
        },
      };
    });

    return statsComputed;
  }

  /**
   * Busca miembros por email o nombre como Signal
   */
  searchMembers(
    organizationId: string,
    searchTerm: string
  ): Signal<OrganizationMember[]> {
    const resultsComputed = computed(() => {
      const organizations = this.userOrganizationsSignal();
      const org = organizations.find((o: Organization) => o.id === organizationId);

      if (!org) return [];

      return org.members.filter(
        (member: OrganizationMember) =>
          member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          member.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    return resultsComputed;
  }

  /**
   * Filtra miembros según criterios como Signal
   */
  filterMembers(
    organizationId: string,
    filters: MemberFilters
  ): Signal<OrganizationMember[]> {
    const filteredComputed = computed(() => {
      const organizations = this.userOrganizationsSignal();
      const org = organizations.find((o: Organization) => o.id === organizationId);

      if (!org) return [];

      let filteredMembers = [...org.members];

      if (filters.role) {
        filteredMembers = filteredMembers.filter(
          (m: OrganizationMember) => m.role === filters.role
        );
      }

      if (filters.department) {
        filteredMembers = filteredMembers.filter(
          (m: OrganizationMember) => m.department === filters.department
        );
      }

      if (filters.status) {
        filteredMembers = filteredMembers.filter(
          (m: OrganizationMember) => m.status === filters.status
        );
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredMembers = filteredMembers.filter(
          (m: OrganizationMember) =>
            m.email.toLowerCase().includes(searchLower) ||
            (m.displayName &&
              m.displayName.toLowerCase().includes(searchLower))
        );
      }

      return filteredMembers;
    });

    return filteredComputed;
  }

  /**
   * Alias para sendBulkInvitations
   */
  async processBulkInvites(request: BulkInviteRequest): Promise<{
    sent: OrganizationInvite[];
    failed: { email: string; error: string }[];
  }> {
    return this.sendBulkInvitations(request);
  }

  /**
   * Obtiene todas las invitaciones
   */
  getAllInvitations(organizationId: string): Promise<OrganizationInvite[]> {
    return this.getPendingInvitations(organizationId);
  }

  /**
   * Invita a un usuario por email
   */
  async inviteUserWithEmail(
    email: string,
    role: 'admin' | 'moderator' | 'user' = 'user',
    department?: string,
    message?: string
  ): Promise<OrganizationInvite> {
    const organization = this.currentOrganizationSignal();

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
   * Establece la organización actual
   */
  async setCurrentOrganization(organizationId: string): Promise<void> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      let org = this.developmentOrganizations.find(
        (o) => o.id === organizationId
      );

      if (!org) {
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

          this.developmentOrganizations.push(org);
        }
      }

      if (org) {
        this.currentOrganizationSignal.set(org);

        const firebaseUser = this.auth.currentUser;
        if (firebaseUser) {
          await this.updateUserOrganization(
            firebaseUser.uid,
            organizationId,
            'user'
          );
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error setting organization';
      this.lastErrorSignal.set(errorMsg);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Obtiene el rol del usuario actual en la organización
   */
  getCurrentOrganizationRole(): Observable<
    'owner' | 'admin' | 'moderator' | 'user' | null
  > {
    return new Observable((observer) => {
      observer.next(this.organizationRoleSignal());
      observer.complete();
    });
  }

  /**
   * Crea una nueva organización
   */
  async createOrganization(data: {
    name: string;
    description?: string;
    settings?: Partial<OrganizationSettings>;
  }): Promise<Organization> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const firebaseUser = this.auth.currentUser;

      if (!firebaseUser) {
        throw new Error('Usuario no autenticado');
      }

      const orgId = `org-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

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

      await setDoc(orgDoc, firestoreData);

      this.developmentOrganizations.push(newOrg);
      this.currentOrganizationSignal.set(newOrg);

      await this.updateUserOrganization(firebaseUser.uid, orgId, 'owner');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('organizationCreated', {
            detail: { organization: newOrg },
          })
        );
        window.dispatchEvent(
          new CustomEvent('organizationChanged', {
            detail: { organization: newOrg },
          })
        );
      }

      return newOrg;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error creating organization';
      this.lastErrorSignal.set(errorMsg);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
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
    } catch (error) {
      console.error('Error updating user organization:', error);
    }
  }

  /**
   * Acepta una invitación por email desde Firebase
   */
  async acceptEmailInvite(code: string): Promise<Organization> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const invitationsRef = collection(this.firestore, 'invitations');

      let q = query(
        invitationsRef,
        where('inviteToken', '==', code),
        where('status', '==', 'pending')
      );
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        q = query(
          invitationsRef,
          where('code', '==', code),
          where('status', '==', 'pending')
        );
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
        throw new Error('Invitación no encontrada o ya utilizada');
      }

      const inviteDoc = querySnapshot.docs[0];
      const invite = {
        id: inviteDoc.id,
        ...inviteDoc.data(),
      } as OrganizationInvite;

      const now = new Date();
      const expiresAt =
        invite.expiresAt instanceof Timestamp
          ? invite.expiresAt.toDate()
          : new Date(invite.expiresAt);

      if (expiresAt < now) {
        throw new Error('Esta invitación ha expirado');
      }

      // Verificar que la organización existe
      const orgDocRef = doc(this.firestore, 'organizations', invite.organizationId);
      const orgDoc = await getDoc(orgDocRef);

      if (!orgDoc.exists()) {
        throw new Error('Organización no encontrada');
      }

      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        throw new Error('Debes estar autenticado');
      }

      // PRIMERO: Agregar el miembro a la organización
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

      // Actualizar documento del usuario
      const userDocRef = doc(this.firestore, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        organizationId: invite.organizationId,
        organizationRole: invite.role,
        department: invite.department || null,
        updatedAt: Timestamp.now(),
      });

      // DESPUÉS: Volver a leer la organización actualizada (ya con el nuevo miembro)
      const updatedOrgDoc = await getDoc(orgDocRef);
      const orgData = updatedOrgDoc.data()!;
      const organization: Organization = {
        ...orgData,
        id: updatedOrgDoc.id,
        createdAt: orgData['createdAt']?.toDate() || new Date(),
        updatedAt: orgData['updatedAt']?.toDate() || new Date(),
        members: orgData['members']?.map((member: any) => ({
          ...member,
          joinedAt: member.joinedAt?.toDate?.() || new Date(),
          lastActiveAt: member.lastActiveAt?.toDate?.() || new Date(),
        })) || [],
      } as Organization;

      // Actualizar el signal del usuario en AuthService
      this.authService.updateUserOrganization(invite.organizationId, invite.role);

      // Establecer la organización actual (ya con el nuevo miembro)
      this.currentOrganizationSignal.set(organization);
      this.organizationRoleSignal.set(invite.role as any);

      // Establecer la organización actual (ya con el nuevo miembro)
      this.currentOrganizationSignal.set(organization);
      this.organizationRoleSignal.set(invite.role as any);

      // Usar inyección perezosa para evitar dependencia circular
      const firestoreDataService = this.injector.get(FirestoreService);
      firestoreDataService.invalidateAllCaches();

      console.log(' Invitación aceptada, organización establecida:', organization.name);

      console.log(' Invitación aceptada, organización establecida:', organization.name);
      console.log(' Miembros en la organización:', organization.members.length);
      console.log(' Tu rol:', invite.role);

      return organization;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error accepting invitation';
      this.lastErrorSignal.set(errorMsg);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
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
  this.isLoadingSignal.set(true);
  this.lastErrorSignal.set(null);

  try {
    const orgDocRef = doc(this.firestore, 'organizations', organizationId);
    const orgDoc = await getDoc(orgDocRef);

    if (!orgDoc.exists()) {
      throw new Error('Organización no encontrada');
    }

    const orgData = orgDoc.data();
    const existingMembers = orgData['members'] || [];

    // Crear el nuevo miembro con Timestamp de Firebase
    const newMemberForFirestore = {
      userId: userData.userId,
      email: userData.email,
      role: userData.role,
      department: userData.department || 'General',
      joinedAt: Timestamp.now(),
      invitedBy: 'system',
      status: 'active',
      displayName: userData.email,
      lastActiveAt: Timestamp.now(),
      permissions: {
        canCreateZones: userData.role !== 'user',
        canCreateMarkers: true,
        canExportData: userData.role !== 'user',
        canViewAnalytics: userData.role !== 'user',
        canManageMembers: userData.role === 'admin',
        canBulkInvite: userData.role === 'admin',
      },
    };

    // Verificar si el usuario ya es miembro
    const existingMemberIndex = existingMembers.findIndex(
      (m: any) => m.userId === userData.userId
    );

    let updatedMembers;
    if (existingMemberIndex >= 0) {
      // Actualizar miembro existente
      updatedMembers = [...existingMembers];
      updatedMembers[existingMemberIndex] = newMemberForFirestore;
      console.log('🔄 Actualizando miembro existente');
    } else {
      // Agregar nuevo miembro
      updatedMembers = [...existingMembers, newMemberForFirestore];
      console.log('➕ Agregando nuevo miembro');
    }

    console.log('📝 Miembros antes de guardar:', updatedMembers.length);
    console.log('📝 UIDs:', updatedMembers.map((m: any) => m.userId));

    // Actualizar el documento de organización con el nuevo array de miembros
    await updateDoc(orgDocRef, {
      members: updatedMembers,
      updatedAt: Timestamp.now(),
    });

    console.log('✅ Documento de organización actualizado en Firestore');

    // Actualizar documento del usuario
    const userRef = doc(this.firestore, 'users', userData.userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      await updateDoc(userRef, {
        organizationId: organizationId,
        organizationRole: userData.role,
        updatedAt: Timestamp.now(),
      });
    } else {
      await setDoc(userRef, {
        email: userData.email,
        displayName: userData.email,
        organizationId: organizationId,
        organizationRole: userData.role,
        role: 'user',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    console.log('✅ Miembro agregado a la organización:', userData.email);
  } catch (error) {
    console.error('❌ Error añadiendo miembro:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error añadiendo miembro';
    this.lastErrorSignal.set(errorMsg);
    throw error;
  } finally {
    this.isLoadingSignal.set(false);
  }
}

  /**
   * Alias para acceptEmailInvite
   */
  async acceptInvite(inviteToken: string): Promise<Organization> {
    return this.acceptEmailInvite(inviteToken);
  }

  /**
   * Limpia el último error
   */
  clearLastError(): void {
    this.lastErrorSignal.set(null);
  }
}

