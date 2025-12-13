import { Injectable, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  getDoc,
} from '@angular/fire/firestore';
import { getAuth } from '@angular/fire/auth';
import { AuthService } from '../../auth/services/auth.service';
import { AuthorizationService } from '../../auth/services/authorization.service';
import { OrganizationService } from '../../shared/services/organization.service';
import { User } from '../../shared/models/user.model';
import { OrganizationMember } from '../../shared/models/organization.model';

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
  //signals

  private userSignal = signal<UserWithOrganization[]>([]);
  private isLoadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  //Private readonly signals
  readonly users = this.userSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  //Computed signals
  readonly totalUsers = computed(() => this.userSignal().length);
  readonly adminUsers = computed(
    () => this.userSignal().filter((user) => user.role === 'admin').length);
  readonly regularUsers = computed(
    () => this.userSignal().filter((user) => user.role === 'user').length);
  readonly userWithOrganizations = computed(
    () => this.userSignal().filter((user) => !user.organizationId).length);
  readonly recentlyActive = computed(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return this.userSignal().filter(
      (user) => user.lastActivity && user.lastActivity.getTime() > oneDayAgo).length;
  });



// Data de desarrollo
  private readonly developmentUsers: UserWithOrganization[] = [
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
      lastActivity: new Date(Date.now() - 1000 * 60 * 30),
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
      lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2),
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
      lastActivity: new Date(Date.now() - 1000 * 60 * 15),
      isOnline: true,
    },
    {
      uid: 'user-3',
      email: 'newuser@geopoint.com',
      role: 'user',
      organizationId: undefined,
      organizationRole: undefined,
      organizationName: undefined,
      createdAt: new Date('2024-03-01'),
      lastActivity: new Date(Date.now() - 1000 * 60 * 5),
      isOnline: true,
    },
  ];

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private authorizationService: AuthorizationService,
    private organizationService: OrganizationService
  ) {
    console.log(' UserManagementService initialized');
    this.userSignal.set(this.developmentUsers);
  }


  /**
   * Obtiene todos los usuarios del sistema (requiere permisos de admin)
   */
  async getAllUsers(): Promise<UserWithOrganization[]> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const hasPermission = await firstValueFrom(
        this.authorizationService.hasPermission('manage-users')
      );

      if (!hasPermission) {
        throw new Error('No tienes permisos para gestionar usuarios');
      }

      const usersCollection = collection(this.firestore, 'users');
      const usersQuery = query(usersCollection, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(usersQuery);


      const users = this.mapFirebaseUsersToOrganizationUsers(snapshot.docs);
      this.userSignal.set(users);
      return users;
    } catch (error) {
      console.error(' Error fetching users:', error);
      this.errorSignal.set('Error al obtener usuarios');
      this.userSignal.set(this.developmentUsers);
      return this.developmentUsers;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

/**
 * Obtiene usuarios de la organización actual
 */
  async getSimpleOrganizationUsers(): Promise<UserWithOrganization[]> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const auth = getAuth();
      const currentAuthUser = auth.currentUser;

      if(!currentAuthUser) {
        this.userSignal.set([]);
        return [];
      }
      // Obtener datos del usuario desde Firestore
      const userDoc = doc(this.firestore, 'users', currentAuthUser.uid);
      const userSnapshot = await getDoc(userDoc);
      if (!userSnapshot.exists()) {
        this.userSignal.set([]);
        return [];
      }

      const userData = userSnapshot.data() as User;
      const userOrganizationId = userData.organizationId;

      if (!userOrganizationId) {
        this.userSignal.set([]);
        return [];
      }


      // Query de usuarios de la organización
      const usersCollection = collection(this.firestore, 'users');
      const orgUsersQuery = query(
        usersCollection,
        where('organizationId', '==', userOrganizationId)
      );
      const snapshot = await getDocs(orgUsersQuery);

      if (snapshot.docs.length > 0) {
        const firebaseUsers = this.mapFirebaseUsersToOrganizationUsers(
          snapshot.docs
        );
        this.userSignal.set(firebaseUsers);
        return firebaseUsers;
      }

      // Fallback a datos de desarrollo
      const orgUsers = this.developmentUsers.slice();
      this.userSignal.set(orgUsers);
      return orgUsers;
    } catch (error) {
      console.error(' Error in getSimpleOrganizationUsers:', error);
      this.errorSignal.set('Error cargando usuarios');

      // Fallback final
      const emptyList: UserWithOrganization[] = [];
      this.userSignal.set(emptyList);
      return emptyList;
    } finally {
      this.isLoadingSignal.set(false);
    }      
}

/**
   * Obtiene usuarios de la organización actual con verificación de permisos
   */
  async getOrganizationUsers(): Promise<UserWithOrganization[]> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {

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

      const currentOrg = await this.getCurrentOrganizationWithTimeout();
      if (!currentOrg) {
        this.userSignal.set([]);
        return [];
      }

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
        const firebaseUsers = snapshot.docs.map((doc) => {
          const userData = { uid: doc.id, ...doc.data() } as User;
          return {
            ...userData,
            organizationName: currentOrg.name,
            organizationRole: this.getOrganizationRole(userData, currentOrg),
            lastActivity: userData.createdAt || new Date(),
            isOnline: this.isUserOnline(userData),
          } as UserWithOrganization;
        });

        this.userSignal.set(firebaseUsers);
        return firebaseUsers;
      }

      const devUsersForOrg = this.developmentUsers.filter(
        (user) => user.organizationId === currentOrg.id
      );
      this.userSignal.set(devUsersForOrg);
      return devUsersForOrg;
    } catch (error) {
      console.error(' Error getting organization users:', error);
      this.errorSignal.set('Error al obtener usuarios de la organización');
      this.userSignal.set([]);
      return [];
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

   /**
   * Actualiza el rol de organización de un usuario
   */
  async updateUserOrganizationRole(
    userId: string,
    newRole: 'owner' | 'admin' | 'moderator' | 'user'
  ): Promise<void> {
    try {
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

      if (currentUser.uid === userId) {
        throw new Error('No puedes cambiar tu propio rol');
      }

      // Actualizar en Firebase
      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        organizationRole: newRole,
        updatedAt: new Date(),
        roleUpdatedBy: currentUser.uid,
        roleUpdatedAt: new Date(),
      });


      // Actualizar en el signal localmente
      const updatedUsers = this.userSignal().map((u) =>
        u.uid === userId ? { ...u, organizationRole: newRole } : u
      );
      this.userSignal.set(updatedUsers);

      // Recargar usuarios
      await this.getOrganizationUsers();
    } catch (error) {
      console.error('Error updating user organization role:', error);
      this.errorSignal.set('Error al actualizar el rol del usuario');
      throw error;
    }
  }

  /**
   * Remueve un usuario de la organización
   */
  async removeUserFromOrganization(userId: string): Promise<void> {
    try {
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

      if (currentUser.uid === userId) {
        throw new Error('No puedes removerte a ti mismo de la organización');
      }

      console.log(
        ` Removing user ${userId} from organization`
      );

      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        organizationId: null,
        updatedAt: new Date(),
        removedFromOrgBy: currentUser.uid,
        removedFromOrgAt: new Date(),
      });


      // Actualizar signal localmente
      const updatedUsers = this.userSignal().filter((user) => user.uid !== userId);
      this.userSignal.set(updatedUsers);

      // Recargar usuarios
      await this.getOrganizationUsers();
    } catch (error) {
      console.error('Error removing user from organization:', error);
      this.errorSignal.set('Error al eliminar el usuario');
      throw error;
    }
  }
  /**
   * Establece usuarios directamente (para debug)
   */
  setUsers(users: UserWithOrganization[]): void {
    this.userSignal.set(users);
  }

  /**
   * Métodos privados auxiliares
   */

  private mapFirebaseUsersToOrganizationUsers(docs: any[]): UserWithOrganization[] {
    return docs.map((doc) => {
      const userData = { uid: doc.id, ...doc.data() } as User;
      const createdAtDate = this.convertToDate(userData.createdAt);
      const firebaseOrgRole = (userData as any).organizationRole;
      const orgRole = firebaseOrgRole || this.determineOrganizationRole(userData);

      return {
        ...userData,
        createdAt: createdAtDate,
        organizationName: 'Tu Organización',
        organizationRole: orgRole,
        lastActivity: createdAtDate,
        isOnline: this.isUserOnlineSafe(createdAtDate),
      } as UserWithOrganization;
    });
  }

  private convertToDate(value: any): Date {
    if (value && typeof value === 'object' && 'toDate' in value) {
      return (value as any).toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    return new Date();
  }

  private determineOrganizationRole(user: User): 'owner' | 'admin' | 'user' {
    console.warn(
      ` User ${user.email} has NO organizationRole in Firebase. Using fallback: 'user'`
    );
    return 'user';
  }

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

  private getOrganizationRole(
    user: User,
    organization: any
  ): 'owner' | 'admin' | 'moderator' | 'user' {
    const member = organization.members?.find(
      (m: OrganizationMember) => m.userId === user.uid
    );

    if (member) {
      return member.role;
    }

    if ((user as any).organizationRole) {
      return (user as any).organizationRole;
    }

    console.warn(
      `⚠️ User ${user.email} has no organizationRole. Defaulting to 'user'`
    );
    return 'user';
  }

  private isUserOnline(user: User): boolean {
    if (!user.createdAt) return false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return user.createdAt.getTime() > fiveMinutesAgo;
  }

  private async getCurrentOrganizationWithTimeout(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ getCurrentOrganization timeout, using fallback');
        resolve({
          id: 'org-1',
          name: 'Empresa Demo',
          description: 'Organización de demostración',
        });
      }, 3000);

      this.organizationService.getCurrentOrganization().subscribe({
        next: (org) => {
          clearTimeout(timeout);
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
 
}
