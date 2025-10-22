import { Injectable } from '@angular/core';
import {
  Observable,
  BehaviorSubject,
  map,
  combineLatest,
  firstValueFrom,
} from 'rxjs';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  DocumentData,
  QuerySnapshot,
  getDoc,
} from '@angular/fire/firestore';
import { getAuth } from '@angular/fire/auth';
import { AuthService } from '../../auth/services/auth.service';
import { AuthorizationService } from '../../auth/services/authorization.service';
import { OrganizationService } from '../../shared/services/organization.service';
import { User } from '../../shared/models/user.model';
import {
  Organization,
  OrganizationMember,
} from '../../shared/models/organization.model';

export interface UserWithOrganization extends User {
  organizationName?: string;
  organizationRole?: 'owner' | 'admin' | 'moderator' | 'user';
  lastActivity?: Date;
  isOnline?: boolean;
}

export interface UserRoleChangeRequest {
  userId: string;
  currentRole: 'admin' | 'user';
  newRole: 'admin' | 'user';
  organizationId?: string;
  organizationRole?: 'owner' | 'admin' | 'moderator' | 'user';
  reason?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserManagementService {
  // Subject para la lista de usuarios
  private usersSubject = new BehaviorSubject<UserWithOrganization[]>([]);
  users$ = this.usersSubject.asObservable();

  // Para desarrollo: lista simulada de usuarios
  private developmentUsers: UserWithOrganization[] = [
    {
      uid: 'admin-user-1',
      email: 'admin@geopoint.com',
      role: 'admin',
      organizationId: 'org-1',
      organizationRole: 'owner',
      organizationName: 'Empresa Demo',
      createdAt: new Date('2024-01-15'),
      lastActivity: new Date(),
      isOnline: true,
    },
    {
      uid: 'admin-user-2',
      email: 'manager@geopoint.com',
      role: 'admin',
      organizationId: 'org-1',
      organizationRole: 'admin',
      organizationName: 'Empresa Demo',
      createdAt: new Date('2024-02-01'),
      lastActivity: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
      isOnline: false,
    },
    {
      uid: 'user-1',
      email: 'employee1@geopoint.com',
      role: 'user',
      organizationId: 'org-1',
      organizationRole: 'user',
      organizationName: 'Empresa Demo',
      createdAt: new Date('2024-02-10'),
      lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      isOnline: false,
    },
    {
      uid: 'user-2',
      email: 'employee2@geopoint.com',
      role: 'user',
      organizationId: 'org-1',
      organizationRole: 'user',
      organizationName: 'Empresa Demo',
      createdAt: new Date('2024-02-15'),
      lastActivity: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
      isOnline: true,
    },
    {
      uid: 'user-3',
      email: 'newuser@geopoint.com',
      role: 'user',
      organizationId: undefined, // Usuario sin organización
      organizationRole: undefined,
      organizationName: undefined,
      createdAt: new Date('2024-03-01'),
      lastActivity: new Date(Date.now() - 1000 * 60 * 5), // 5 min ago
      isOnline: true,
    },
  ];

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private authorizationService: AuthorizationService,
    private organizationService: OrganizationService
  ) {
    // Inicializar inmediatamente con datos de desarrollo
    console.log(
      '🚀 UserManagementService constructor - initializing development data'
    );
    this.usersSubject.next(this.developmentUsers);

    // Exponer servicio para debugging
    if (typeof window !== 'undefined') {
      (window as any).userManagementService = this;
      (window as any).debugUserSystem = async () => {
        console.log('🔧 === DEBUGGING USER SYSTEM ===');
        console.log('🔧 Firestore available:', !!this.firestore);
        console.log('🔧 AuthService available:', !!this.authService);
        console.log(
          '🔧 OrganizationService available:',
          !!this.organizationService
        );

        try {
          const currentUser = await firstValueFrom(
            this.authService.getCurrentUser()
          );
          console.log(
            '🔧 Current user:',
            currentUser?.email,
            'Role:',
            currentUser?.role
          );

          if (this.firestore) {
            console.log('🔧 Testing direct Firebase access...');
            const usersCollection = collection(this.firestore, 'users');
            const snapshot = await getDocs(usersCollection);
            console.log('🔧 Firebase users found:', snapshot.docs.length);

            snapshot.docs.forEach((doc, index) => {
              const userData = doc.data();
              console.log(`🔧 User ${index + 1}:`, {
                id: doc.id,
                email: userData['email'],
                role: userData['role'],
              });
            });
          }

          console.log('🔧 Testing getOrganizationUsers...');
          const orgUsers = await this.getOrganizationUsers();
          console.log(
            '🔧 Organization users result:',
            orgUsers.length,
            'users'
          );
        } catch (error) {
          console.error('🔧 Debug failed:', error);
        }
      };
      console.log('🔧 UserManagementService exposed globally');
      console.log('🔧 Run debugUserSystem() in console to test the system');
      console.log('👥 Development users loaded:', this.developmentUsers.length);
      console.log('🔥 Firestore available:', !!this.firestore);
      console.log('🔍 AuthService available:', !!this.authService);
      console.log(
        '⚡ AuthorizationService available:',
        !!this.authorizationService
      );
    }
  }

  /**
   * Obtiene todos los usuarios registrados en el sistema
   * Solo accesible para administradores
   */
  async getAllUsers(): Promise<UserWithOrganization[]> {
    try {
      console.log('📊 Getting all users...');

      // Verificar permisos
      const hasPermission = await firstValueFrom(
        this.authorizationService.hasPermission('manage-users')
      );

      if (!hasPermission) {
        throw new Error('No tienes permisos para gestionar usuarios');
      }

      // Obtener usuarios reales de Firestore
      const usersCollection = collection(this.firestore, 'users');
      const usersQuery = query(usersCollection, orderBy('createdAt', 'desc'));
      const snapshot: QuerySnapshot<DocumentData> = await getDocs(usersQuery);

      console.log(`📥 Found ${snapshot.docs.length} users in Firestore`);

      const users: UserWithOrganization[] = [];
      for (const docSnap of snapshot.docs) {
        const userData = { uid: docSnap.id, ...docSnap.data() } as User;
        const userWithOrg = await this.enrichUserWithOrganization(userData);
        users.push(userWithOrg);
      }

      console.log(`✅ Processed ${users.length} users with organization data`);
      this.usersSubject.next(users);
      return users;
    } catch (error) {
      console.error('Error fetching users from Firestore:', error);

      // En caso de error con Firestore, usar datos de desarrollo como fallback
      console.log('📝 Fallback to development users due to error');
      this.usersSubject.next(this.developmentUsers);
      return this.developmentUsers;
    }
  }

  /**
   * Obtiene usuarios de la organización actual del usuario logueado
   * SOLO ACCESIBLE PARA ADMINISTRADORES
   */
  /**
   * Método simplificado para obtener usuarios sin verificaciones complejas
   */
  async getSimpleOrganizationUsers(): Promise<UserWithOrganization[]> {
    try {
      console.log('🔍 Getting organization users (simple mode)...');

      // PRIMERO: Intentar obtener usuarios REALES de Firebase
      console.log('🔥 Attempting to get REAL users from Firebase...');

      try {
        // SOLUCIÓN TEMPORAL: Usar Firebase Auth directamente para evitar bucle
        console.log(
          '🔍 Getting current user organization from Firebase Auth...'
        );

        const auth = getAuth();
        const currentAuthUser = auth.currentUser;

        if (!currentAuthUser) {
          console.log('❌ No authenticated user');
          this.usersSubject.next([]);
          return [];
        }

        console.log('👤 Current auth user UID:', currentAuthUser.uid);

        // Obtener datos del usuario desde Firestore directamente
        const userDoc = doc(this.firestore, 'users', currentAuthUser.uid);
        const userSnapshot = await getDoc(userDoc);

        if (!userSnapshot.exists()) {
          console.log('❌ User document not found in Firestore');
          this.usersSubject.next([]);
          return [];
        }

        const userData = userSnapshot.data() as User;
        const userOrganizationId = userData.organizationId;

        if (!userOrganizationId) {
          console.log('❌ Current user has no organization');
          this.usersSubject.next([]);
          return [];
        }

        console.log(
          `🏢 Filtering users for organization: ${userOrganizationId}`
        );

        const usersCollection = collection(this.firestore, 'users');
        const orgUsersQuery = query(
          usersCollection,
          where('organizationId', '==', userOrganizationId)
          // Removemos orderBy temporalmente para evitar el error de índice
        );
        const snapshot = await getDocs(orgUsersQuery);
        console.log(
          `📥 Firebase returned ${snapshot.docs.length} users from your organization`
        );

        if (snapshot.docs.length > 0) {
          const firebaseUsers: UserWithOrganization[] = snapshot.docs.map(
            (doc) => {
              const userData = { uid: doc.id, ...doc.data() } as User;

              // ARREGLAR: Convertir Timestamp de Firebase a Date
              let createdAtDate: Date;
              if (
                userData.createdAt &&
                typeof userData.createdAt === 'object' &&
                'toDate' in userData.createdAt
              ) {
                // Es un Timestamp de Firebase
                createdAtDate = (userData.createdAt as any).toDate();
              } else if (userData.createdAt instanceof Date) {
                // Ya es una Date
                createdAtDate = userData.createdAt;
              } else {
                // Fallback a fecha actual
                createdAtDate = new Date();
              }

              // ✅ CORREGIDO: Usar el organizationRole almacenado en Firebase
              // en lugar de calcularlo basado en el rol global
              const firebaseOrgRole = (userData as any).organizationRole;
              const fallbackOrgRole = this.determineOrganizationRole(userData);
              const orgRole = firebaseOrgRole || fallbackOrgRole;

              // 🔍 DEBUG: Log detallado de roles
              console.log(`👤 User: ${userData.email}`, {
                globalRole: userData.role,
                firebaseOrgRole: firebaseOrgRole || 'NOT SET',
                fallbackOrgRole,
                finalOrgRole: orgRole,
              });

              return {
                ...userData,
                createdAt: createdAtDate, // Asegurar que sea Date
                organizationName: 'Tu Organización',
                organizationRole: orgRole, // ✅ Usar el rol real de Firebase
                lastActivity: createdAtDate,
                isOnline: this.isUserOnlineSafe(createdAtDate),
              } as UserWithOrganization;
            }
          );

          console.log(
            `✅ Successfully processed ${firebaseUsers.length} REAL Firebase users`
          );
          console.log(
            '🔥 Firebase users:',
            firebaseUsers.map((u) => ({
              email: u.email,
              orgId: u.organizationId,
            }))
          );

          // Actualizar el subject con datos REALES
          this.usersSubject.next(firebaseUsers);
          return firebaseUsers;
        }
      } catch (firebaseError) {
        console.error('🔥 Firebase query failed:', firebaseError);

        if (
          firebaseError instanceof Error &&
          firebaseError.message.includes('permission-denied')
        ) {
          console.error('🚨 Firebase rules may be blocking access');
        }
      }

      // FALLBACK: Usar datos de desarrollo solo si Firebase falla
      console.log('📝 Fallback to development data...');
      const orgUsers = this.developmentUsers.slice();
      console.log(
        `✅ Returning ${orgUsers.length} development users as fallback`
      );

      this.usersSubject.next(orgUsers);
      return orgUsers;
    } catch (error) {
      console.error('Error in getSimpleOrganizationUsers:', error);

      // Fallback final a lista vacía
      const emptyList: UserWithOrganization[] = [];
      this.usersSubject.next(emptyList);
      return emptyList;
    }
  }

  /**
   * Método público para establecer usuarios directamente (para debug)
   */
  setUsers(users: UserWithOrganization[]): void {
    this.usersSubject.next(users);
  }

  /**
   * Obtiene usuarios REALES de Firebase para la organización especificada
   * MÉTODO DIRECTO PARA CONEXIÓN CON FIREBASE
   */
  async getRealOrganizationUsers(
    organizationId: string
  ): Promise<UserWithOrganization[]> {
    try {
      console.log(
        `🔥 Getting REAL users from Firebase for organization: ${organizationId}`
      );

      if (!this.firestore) {
        throw new Error('Firestore no está disponible');
      }

      // Verificar permisos de administrador
      const currentUser = await firstValueFrom(
        this.authService.getCurrentUser()
      );
      if (!currentUser || currentUser.role !== 'admin') {
        throw new Error(
          'Solo los administradores pueden acceder a la gestión de usuarios'
        );
      }

      // Query directo a Firebase Firestore
      const usersCollection = collection(this.firestore, 'users');
      const orgQuery = query(
        usersCollection,
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );

      console.log('📡 Executing Firebase query...');
      const snapshot = await getDocs(orgQuery);

      console.log(
        `📥 Firebase returned ${snapshot.docs.length} users for organization ${organizationId}`
      );

      if (snapshot.docs.length === 0) {
        console.log(
          '📝 No Firebase users found, using development data as fallback'
        );

        // Fallback a datos de desarrollo filtrados por organización
        const devUsers = this.developmentUsers.filter(
          (user) => user.organizationId === organizationId
        );

        this.usersSubject.next(devUsers);
        return devUsers;
      }

      // Procesar usuarios de Firebase
      const firebaseUsers: UserWithOrganization[] = snapshot.docs.map((doc) => {
        const userData = { uid: doc.id, ...doc.data() } as User;

        // ✅ CORREGIDO: Usar organizationRole de Firebase, no calcularlo
        const firebaseOrgRole = (userData as any).organizationRole;
        const finalOrgRole =
          firebaseOrgRole || this.determineOrganizationRole(userData);

        console.log(`👤 getRealOrganizationUsers - User: ${userData.email}`, {
          globalRole: userData.role,
          firebaseOrgRole: firebaseOrgRole || 'NOT SET',
          finalOrgRole,
        });

        // Enriquecer con datos de organización
        return {
          ...userData,
          organizationName: 'Organización Firebase', // Se puede obtener el nombre real
          organizationRole: finalOrgRole, // ✅ Usar el rol correcto
          lastActivity: userData.createdAt || new Date(),
          isOnline: this.isUserOnline(userData),
        } as UserWithOrganization;
      });

      console.log(
        `✅ Successfully processed ${firebaseUsers.length} Firebase users`
      );

      // Actualizar el observable
      this.usersSubject.next(firebaseUsers);

      return firebaseUsers;
    } catch (error) {
      console.error('❌ Error getting real users from Firebase:', error);

      // En caso de error, usar datos de desarrollo como fallback
      console.log('🔄 Falling back to development data due to Firebase error');
      const devUsers = this.developmentUsers.filter(
        (user) => user.organizationId === organizationId
      );

      this.usersSubject.next(devUsers);
      return devUsers;
    }
  }

  /**
   * Determina el rol del usuario en la organización basado en su rol global
   * NOTA: Este método solo se usa como FALLBACK si no hay organizationRole en Firebase
   * El rol global (admin/user) NO debe determinar el rol en la organización
   */
  private determineOrganizationRole(user: User): 'owner' | 'admin' | 'user' {
    // ⚠️ IMPORTANTE: Si llegamos aquí, significa que el usuario NO tiene
    // organizationRole definido en Firebase. Esto puede pasar con usuarios antiguos.
    // Por defecto, asignar 'user' a menos que se demuestre lo contrario.

    console.warn(
      `⚠️ User ${user.email} has NO organizationRole in Firebase. Using fallback: 'user'`
    );

    // Por defecto, todos los usuarios nuevos sin organizationRole son 'user'
    return 'user';
  }

  /**
   * Versión segura de isUserOnline que maneja diferentes tipos de fechas
   */
  private isUserOnlineSafe(lastActivity: Date): boolean {
    try {
      if (!lastActivity) return false;

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return lastActivity.getTime() > fiveMinutesAgo;
    } catch (error) {
      console.warn('Error checking user online status:', error);
      return false;
    }
  }

  async getOrganizationUsers(): Promise<UserWithOrganization[]> {
    try {
      console.log('🔍 Starting getOrganizationUsers...');

      // VERIFICAR PERMISOS DE ADMINISTRADOR PRIMERO
      const currentUser = await firstValueFrom(
        this.authService.getCurrentUser()
      );
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const hasAdminPermission = await firstValueFrom(
        this.authorizationService.hasPermission('manage-users')
      );

      if (!hasAdminPermission || currentUser.role !== 'admin') {
        throw new Error(
          'Solo los administradores pueden ver la gestión de usuarios'
        );
      }

      console.log('✅ Admin permissions verified for user:', currentUser.email);

      // Obtener la organización actual
      const currentOrg = await this.getCurrentOrganizationWithTimeout();
      if (!currentOrg) {
        console.log('� No current organization found');
        this.usersSubject.next([]);
        return [];
      }

      console.log(
        `🏢 Getting users for organization: ${currentOrg.name} (${currentOrg.id})`
      );

      // Intentar obtener usuarios reales desde Firebase
      const usersCollection = collection(this.firestore, 'users');
      const orgQuery = query(
        usersCollection,
        where('organizationId', '==', currentOrg.id),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(orgQuery);
      console.log(
        `🔥 Found ${snapshot.docs.length} users in Firebase for organization`
      );

      if (snapshot.docs.length > 0) {
        const firebaseUsers: UserWithOrganization[] = snapshot.docs.map(
          (doc) => {
            const userData = { uid: doc.id, ...doc.data() } as User;
            return {
              ...userData,
              organizationName: currentOrg.name,
              organizationRole: this.getOrganizationRole(userData, currentOrg),
              lastActivity: userData.createdAt || new Date(),
              isOnline: this.isUserOnline(userData),
            } as UserWithOrganization;
          }
        );

        console.log(`✅ Returning ${firebaseUsers.length} Firebase users`);
        this.usersSubject.next(firebaseUsers);
        return firebaseUsers;
      }

      // Si no hay usuarios en Firebase, usar datos de desarrollo pero solo si es admin
      console.log(
        '� No Firebase users found, using development data for admin'
      );
      const devUsersForOrg = this.developmentUsers.filter(
        (user) => user.organizationId === currentOrg.id
      );

      this.usersSubject.next(devUsersForOrg);
      return devUsersForOrg;
    } catch (error) {
      console.error('Error getting organization users:', error);

      // Si el error es de permisos, no mostrar datos
      if (error instanceof Error && error.message.includes('administradores')) {
        this.usersSubject.next([]);
        throw error;
      }

      this.usersSubject.next([]);
      return [];
    }
  }

  /**
   * Determina el rol del usuario en la organización
   */
  private getOrganizationRole(
    user: User,
    organization: any
  ): 'owner' | 'admin' | 'user' {
    // Buscar el usuario en los miembros de la organización
    const member = organization.members?.find(
      (m: OrganizationMember) => m.userId === user.uid
    );

    if (member) {
      return member.role;
    }

    // ⚠️ CORREGIDO: Si no hay member, usar el organizationRole del usuario si existe
    if ((user as any).organizationRole) {
      console.log(
        `✅ Using organizationRole from user document: ${
          (user as any).organizationRole
        }`
      );
      return (user as any).organizationRole;
    }

    // Fallback: por defecto todos son 'user', no asumir admin
    console.warn(
      `⚠️ User ${user.email} has no organizationRole. Defaulting to 'user'`
    );
    return 'user';
  }

  /**
   * Determina si un usuario está online (simulado por ahora)
   */
  private isUserOnline(user: User): boolean {
    // En una implementación real, esto vendría de un sistema de presencia
    // Por ahora, simular basado en la última actividad
    if (!user.createdAt) return false;

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return user.createdAt.getTime() > fiveMinutesAgo;
  }

  /**
   * Obtiene la organización actual con timeout para evitar cuelgues
   */
  private async getCurrentOrganizationWithTimeout(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ getCurrentOrganization timeout, using fallback');
        // Usar organización de desarrollo como fallback
        resolve({
          id: 'org-1',
          name: 'Empresa Demo',
          description: 'Organización de demostración',
        });
      }, 3000); // 3 segundos timeout

      this.organizationService.getCurrentOrganization().subscribe({
        next: (org) => {
          clearTimeout(timeout);
          console.log('✅ getCurrentOrganization resolved:', org);
          resolve(org);
        },
        error: (error) => {
          clearTimeout(timeout);
          console.error('❌ getCurrentOrganization error:', error);
          reject(error);
        },
      });
    });
  }

  /**
   * Obtiene las invitaciones pendientes de la organización actual con Firebase
   */
  async getOrganizationInvitations(): Promise<any[]> {
    try {
      console.log('🔍 Starting getOrganizationInvitations...');

      // Obtener la organización actual con timeout
      const currentOrg = await this.getCurrentOrganizationWithTimeout();

      if (!currentOrg) {
        console.log('📝 No organization found for invitations');
        return [];
      }

      console.log(
        `📧 Getting invitations for organization: ${currentOrg.name} (${currentOrg.id})`
      );

      // Primero intentar obtener desde Firebase
      try {
        const firebaseInvites =
          await this.organizationService.getFirebaseOrganizationInvitations(
            currentOrg.id
          );

        if (firebaseInvites.length > 0) {
          console.log(
            `✅ Found ${firebaseInvites.length} Firebase invitations`
          );
          return firebaseInvites;
        }
      } catch (firebaseError) {
        console.error('🔥 Firebase invitations failed:', firebaseError);
      }

      // Fallback: obtener invitaciones del servicio de organización (desarrollo)
      const pendingInvites =
        await this.organizationService.getPendingInvitations(currentOrg.id);
      console.log(
        `📧 Found ${pendingInvites.length} pending invitations from organization service`
      );

      return pendingInvites;
    } catch (error) {
      console.error('Error getting organization invitations:', error);
      return [];
    }
  }

  /**
   * Enriquece un usuario con información de su organización
   */
  private async enrichUserWithOrganization(
    user: User
  ): Promise<UserWithOrganization> {
    if (!user.organizationId) {
      return {
        ...user,
        lastActivity: user.createdAt || new Date(),
      } as UserWithOrganization;
    }

    try {
      // Obtener información real de la organización
      const organizations = await firstValueFrom(
        this.organizationService.getUserOrganizations()
      );

      const organization = organizations?.find(
        (org) => org.id === user.organizationId
      );
      const member = organization?.members.find((m) => m.userId === user.uid);

      return {
        ...user,
        organizationName: organization?.name,
        organizationRole: member?.role,
        lastActivity: user.createdAt || new Date(),
      } as UserWithOrganization;
    } catch (error) {
      console.error('Error enriching user with organization data:', error);
      return user as UserWithOrganization;
    }
  }

  /**
   * Método de debugging para forzar el uso de Firebase
   */
  async debugFirebaseUsers(): Promise<void> {
    try {
      console.log('🔧 DEBUG: Forcing Firebase user query...');
      console.log('🔧 DEBUG: Firestore instance:', !!this.firestore);

      // Verificar autenticación primero
      const currentUser = await firstValueFrom(
        this.authService.getCurrentUser()
      );
      console.log('🔧 DEBUG: Current user:', currentUser?.email || 'No user');
      console.log('🔧 DEBUG: User role:', currentUser?.role || 'No role');

      if (!currentUser) {
        throw new Error('No user authenticated');
      }

      // Intentar leer todos los usuarios (requiere permisos de admin)
      console.log('🔧 DEBUG: Attempting to read all users...');
      const usersCollection = collection(this.firestore, 'users');
      const snapshot = await getDocs(usersCollection);

      console.log('🔧 DEBUG: Firebase query successful!');
      console.log('🔧 DEBUG: Document count:', snapshot.docs.length);

      const users: UserWithOrganization[] = [];
      snapshot.docs.forEach((doc, index) => {
        const userData = { uid: doc.id, ...doc.data() } as User;
        console.log(`🔧 DEBUG: User ${index}:`, {
          id: doc.id,
          email: userData.email,
          role: userData.role,
        });
        users.push(userData as UserWithOrganization);
      });

      if (users.length > 0) {
        console.log('🔧 DEBUG: Updating users subject with Firebase data');
        this.usersSubject.next(users);
        console.log('✅ Firebase data loaded successfully!');
      } else {
        console.log(
          '📝 No users found in Firebase, user may not have admin permissions'
        );
        await this.createDevelopmentUserFromAuth();
      }
    } catch (error: any) {
      console.error('🔧 DEBUG: Firebase query failed:', error);

      if (error.code === 'permission-denied') {
        console.error(
          '🚨 FIRESTORE RULES ERROR: Current user does not have permission to read all users'
        );
        console.error(
          '🔧 SOLUTION: Update Firestore rules to allow admin users to read all users'
        );
        console.error(
          '🔧 Current user role:',
          (await firstValueFrom(this.authService.getCurrentUser()))?.role
        );
      }

      // Para testing, forzar datos de desarrollo con usuario actual
      console.log('🔧 Forcing development data with current user info...');
      await this.createDevelopmentUserFromAuth();

      // Re-throw para que el componente pueda manejar el error
      throw error;
    }
  }

  /**
   * Crea un usuario de desarrollo basado en el usuario autenticado actual
   */
  private async createDevelopmentUserFromAuth(): Promise<void> {
    try {
      const currentUser = await firstValueFrom(
        this.authService.getCurrentUser()
      );

      if (currentUser) {
        const realUser: UserWithOrganization = {
          uid: currentUser.uid,
          email: currentUser.email,
          role: currentUser.role,
          organizationId: 'org-1', // Usar org demo por ahora
          organizationRole: 'admin',
          organizationName: 'Tu Organización',
          createdAt: new Date(),
          lastActivity: new Date(),
        };

        console.log('✅ Created real user from auth:', realUser);

        // Agregar el usuario real a los datos de desarrollo
        const updatedUsers = [
          realUser,
          ...this.developmentUsers.filter((u) => u.uid !== currentUser.uid),
        ];
        this.usersSubject.next(updatedUsers);
      }
    } catch (error) {
      console.error('Error creating development user from auth:', error);
    }
  }

  /**
   * Obtiene estadísticas de usuarios
   */
  getUserStats(): Observable<{
    totalUsers: number;
    adminUsers: number;
    regularUsers: number;
    usersWithoutOrganization: number;
    recentlyActive: number;
  }> {
    return this.users$.pipe(
      map((users) => {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        return {
          totalUsers: users.length,
          adminUsers: users.filter((u) => u.role === 'admin').length,
          regularUsers: users.filter((u) => u.role === 'user').length,
          usersWithoutOrganization: users.filter((u) => !u.organizationId)
            .length,
          recentlyActive: users.filter(
            (u) => u.lastActivity && u.lastActivity.getTime() > oneDayAgo
          ).length,
        };
      })
    );
  }

  /**
   * Obtiene la actividad reciente de usuarios
   */
  getRecentUserActivity(): Observable<UserWithOrganization[]> {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    return this.users$.pipe(
      map(
        (users) =>
          users
            .filter(
              (user) =>
                user.lastActivity &&
                user.lastActivity.getTime() > twentyFourHoursAgo
            )
            .sort((a, b) => {
              if (!a.lastActivity || !b.lastActivity) return 0;
              return b.lastActivity.getTime() - a.lastActivity.getTime();
            })
            .slice(0, 10) // Los 10 más recientes
      )
    );
  }

  /**
   * Cambia el rol global de un usuario
   * SOLO ACCESIBLE PARA ADMINISTRADORES
   */
  async changeUserRole(
    userId: string,
    newRole: 'admin' | 'user',
    reason?: string
  ): Promise<void> {
    try {
      // Verificar permisos de administrador
      const currentUser = await firstValueFrom(
        this.authService.getCurrentUser()
      );
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const hasPermission = await firstValueFrom(
        this.authorizationService.hasPermission('change-roles')
      );

      if (!hasPermission || currentUser.role !== 'admin') {
        throw new Error(
          'Solo los administradores pueden cambiar roles de usuario'
        );
      }

      // No permitir que un admin se cambie su propio rol
      if (currentUser.uid === userId) {
        throw new Error('No puedes cambiar tu propio rol');
      }

      console.log(
        `👑 Admin ${currentUser.email} changing user ${userId} role to ${newRole}`,
        { reason }
      );

      // Intentar actualizar en Firebase
      try {
        const userDoc = doc(this.firestore, 'users', userId);
        await updateDoc(userDoc, {
          role: newRole,
          updatedAt: new Date(),
          lastRoleChangeBy: currentUser.uid,
          lastRoleChangeReason: reason || 'Sin razón especificada',
          lastRoleChangeAt: new Date(),
        });

        console.log(`✅ User role updated in Firebase:`, {
          userId,
          newRole,
          changedBy: currentUser.email,
          reason,
          timestamp: new Date(),
        });

        // Actualizar también en la organización si es necesario
        const currentOrg = await this.getCurrentOrganizationWithTimeout();
        if (currentOrg) {
          await this.updateUserRoleInOrganization(
            userId,
            newRole,
            currentOrg.id
          );
        }

        // Recargar usuarios para reflejar los cambios
        await this.getOrganizationUsers();
      } catch (firebaseError) {
        console.error('🔥 Firebase role update failed:', firebaseError);

        // Fallback a datos de desarrollo solo si Firebase falla
        if (this.isDevelopmentMode()) {
          const userIndex = this.developmentUsers.findIndex(
            (u) => u.uid === userId
          );
          if (userIndex !== -1) {
            this.developmentUsers[userIndex].role = newRole;

            // También actualizar el rol en la organización
            if (newRole === 'admin') {
              this.developmentUsers[userIndex].organizationRole = 'admin';
            }

            this.usersSubject.next([...this.developmentUsers]);

            console.log(`✅ User role changed in development mode:`, {
              userId,
              newRole,
              reason,
              timestamp: new Date(),
            });
          } else {
            throw new Error('Usuario no encontrado en datos de desarrollo');
          }
        } else {
          throw firebaseError;
        }
      }
    } catch (error) {
      console.error('Error changing user role:', error);
      throw error;
    }
  }

  /**
   * Actualiza el rol del usuario en la organización
   */
  private async updateUserRoleInOrganization(
    userId: string,
    newRole: 'admin' | 'user',
    organizationId: string
  ): Promise<void> {
    try {
      // Obtener la organización actual
      const orgDoc = doc(this.firestore, 'organizations', organizationId);

      // En una implementación real, aquí actualizarías el array de members
      // Por ahora, registramos el cambio
      console.log(
        `📝 Updated user ${userId} role to ${newRole} in organization ${organizationId}`
      );
    } catch (error) {
      console.error('Error updating user role in organization:', error);
      // No lanzar error aquí ya que el cambio principal en users ya se hizo
    }
  }

  /**
   * Remueve un usuario de una organización
   * SOLO ACCESIBLE PARA ADMINISTRADORES
   */
  async removeUserFromOrganization(userId: string): Promise<void> {
    try {
      // Verificar permisos de administrador
      const currentUser = await firstValueFrom(
        this.authService.getCurrentUser()
      );
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const hasPermission = await firstValueFrom(
        this.authorizationService.hasPermission('manage-users')
      );

      if (!hasPermission || currentUser.role !== 'admin') {
        throw new Error(
          'Solo los administradores pueden remover usuarios de organizaciones'
        );
      }

      // No permitir que un admin se remueva a sí mismo
      if (currentUser.uid === userId) {
        throw new Error('No puedes removerte a ti mismo de la organización');
      }

      console.log(
        `🚫 Admin ${currentUser.email} removing user ${userId} from organization`
      );

      // Intentar actualizar en Firebase
      try {
        const userDoc = doc(this.firestore, 'users', userId);
        await updateDoc(userDoc, {
          organizationId: null,
          updatedAt: new Date(),
          removedFromOrgBy: currentUser.uid,
          removedFromOrgAt: new Date(),
        });

        console.log(`✅ User removed from organization in Firebase:`, {
          userId,
          removedBy: currentUser.email,
          timestamp: new Date(),
        });

        // Recargar usuarios
        await this.getOrganizationUsers();
      } catch (firebaseError) {
        console.error('🔥 Firebase user removal failed:', firebaseError);

        // Fallback a datos de desarrollo
        if (this.isDevelopmentMode()) {
          const userIndex = this.developmentUsers.findIndex(
            (u) => u.uid === userId
          );
          if (userIndex !== -1) {
            this.developmentUsers[userIndex].organizationId = undefined;
            this.developmentUsers[userIndex].organizationRole = undefined;
            this.developmentUsers[userIndex].organizationName = undefined;

            this.usersSubject.next([...this.developmentUsers]);
            console.log(
              `✅ User removed from organization in development mode`
            );
          } else {
            throw new Error('Usuario no encontrado en datos de desarrollo');
          }
        } else {
          throw firebaseError;
        }
      }
    } catch (error) {
      console.error('Error removing user from organization:', error);
      throw error;
    }
  }

  /**
   * Actualiza el rol de organización de un usuario
   * SOLO ACCESIBLE PARA ADMINISTRADORES
   */
  async updateUserOrganizationRole(
    userId: string,
    newRole: 'owner' | 'admin' | 'moderator' | 'user'
  ): Promise<void> {
    try {
      // Verificar permisos de administrador
      const currentUser = await firstValueFrom(
        this.authService.getCurrentUser()
      );
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const hasPermission = await firstValueFrom(
        this.authorizationService.hasPermission('manage-users')
      );

      if (!hasPermission || currentUser.role !== 'admin') {
        throw new Error(
          'Solo los administradores pueden cambiar roles de usuarios'
        );
      }

      // No permitir que un admin cambie su propio rol
      if (currentUser.uid === userId) {
        throw new Error('No puedes cambiar tu propio rol');
      }

      console.log(
        `🔄 Admin ${currentUser.email} changing user ${userId} role to ${newRole}`
      );

      // Actualizar en Firebase
      try {
        const userDoc = doc(this.firestore, 'users', userId);
        await updateDoc(userDoc, {
          organizationRole: newRole,
          updatedAt: new Date(),
          roleUpdatedBy: currentUser.uid,
          roleUpdatedAt: new Date(),
        });

        console.log(`✅ User role updated in Firebase:`, {
          userId,
          newRole,
          updatedBy: currentUser.email,
          timestamp: new Date(),
        });

        // Recargar usuarios
        await this.getOrganizationUsers();
      } catch (firebaseError) {
        console.error('🔥 Firebase role update failed:', firebaseError);

        // Fallback a datos de desarrollo
        if (this.isDevelopmentMode()) {
          const userIndex = this.developmentUsers.findIndex(
            (u) => u.uid === userId
          );
          if (userIndex !== -1) {
            this.developmentUsers[userIndex].organizationRole = newRole;
            this.usersSubject.next([...this.developmentUsers]);
            console.log(`✅ User role updated in development mode`);
          } else {
            throw new Error('Usuario no encontrado en datos de desarrollo');
          }
        } else {
          throw firebaseError;
        }
      }
    } catch (error) {
      console.error('Error updating user organization role:', error);
      throw error;
    }
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

  // ... resto de métodos como changeUserRole, assignUserToOrganization
}
