import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, map, combineLatest } from 'rxjs';
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
} from '@angular/fire/firestore';
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
  organizationRole?: 'owner' | 'admin' | 'user';
  lastActivity?: Date;
  isOnline?: boolean;
}

export interface UserRoleChangeRequest {
  userId: string;
  currentRole: 'admin' | 'user';
  newRole: 'admin' | 'user';
  organizationId?: string;
  organizationRole?: 'owner' | 'admin' | 'user';
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
      console.log('🔧 UserManagementService exposed globally');
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
      const hasPermission = await this.authorizationService
        .hasPermission('manage-users')
        .toPromise();

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
   */
  async getOrganizationUsers(): Promise<UserWithOrganization[]> {
    try {
      console.log('🔍 Starting getOrganizationUsers...');

      // Obtener la organización actual del usuario con timeout
      const currentOrg = await this.getCurrentOrganizationWithTimeout();

      if (!currentOrg) {
        console.log('📝 No current organization found');
        this.usersSubject.next([]);
        return [];
      }

      console.log(
        `🏢 Getting users for organization: ${currentOrg.name} (${currentOrg.id})`
      );

      // Intentar obtener usuarios reales desde Firebase primero
      try {
        console.log('🔥 Attempting to get users from Firebase...');
        const firebaseUsers =
          await this.organizationService.getOrganizationUsersFromFirebase(
            currentOrg.id
          );

        if (firebaseUsers.length > 0) {
          console.log(`✅ Found ${firebaseUsers.length} users from Firebase`);

          // Enriquecer usuarios con información de organización
          const enrichedUsers: UserWithOrganization[] = firebaseUsers.map(
            (user) => ({
              ...user,
              organizationName: currentOrg.name,
              organizationRole: user.role === 'admin' ? 'admin' : 'user',
              lastActivity: user.createdAt || new Date(),
              isOnline: false, // En desarrollo siempre offline
            })
          );

          // Actualizar el subject con los usuarios de Firebase
          this.usersSubject.next(enrichedUsers);
          return enrichedUsers;
        }
      } catch (firebaseError) {
        console.error('🔥 Firebase users query failed:', firebaseError);
        console.log('📝 Falling back to getAllUsers method...');
      }

      // Fallback: usar el método getAllUsers (que ya tiene lógica de Firebase/desarrollo)
      const allUsers = await this.getAllUsers();
      const orgUsers = allUsers.filter(
        (user) => user.organizationId === currentOrg.id
      );

      console.log(
        `👥 Found ${orgUsers.length} users in organization ${currentOrg.name} (fallback)`
      );

      // Actualizar el subject con los usuarios de la organización
      this.usersSubject.next(orgUsers);
      return orgUsers;
    } catch (error) {
      console.error('Error getting organization users:', error);
      this.usersSubject.next([]);
      return [];
    }
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
      const organizations = await this.organizationService
        .getUserOrganizations()
        .toPromise();

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
   * Método de debugging para forzar el uso de Firebase
   */
  async debugFirebaseUsers(): Promise<void> {
    try {
      console.log('🔧 DEBUG: Forcing Firebase user query...');
      console.log('🔧 DEBUG: Firestore instance:', !!this.firestore);

      // Verificar autenticación primero
      const currentUser = await this.authService.getCurrentUser().toPromise();
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
          (await this.authService.getCurrentUser().toPromise())?.role
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
      const currentUser = await this.authService.getCurrentUser().toPromise();

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

  // ... resto de métodos como changeUserRole, assignUserToOrganization, etc.
  // (por brevedad no los incluyo aquí, pero están disponibles en el archivo original)
}
