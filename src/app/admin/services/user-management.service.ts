import { Injectable, inject } from '@angular/core';
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
  currentRole: 'dev' | 'admin' | 'user';
  newRole: 'dev' | 'admin' | 'user';
  organizationId?: string;
  organizationRole?: 'owner' | 'admin' | 'user';
  reason?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserManagementService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private authorizationService = inject(AuthorizationService);
  private organizationService = inject(OrganizationService);

  // Subject para la lista de usuarios
  private usersSubject = new BehaviorSubject<UserWithOrganization[]>([]);
  users$ = this.usersSubject.asObservable();

  // Para desarrollo: lista simulada de usuarios
  private developmentUsers: UserWithOrganization[] = [
    {
      uid: 'dev-user-1',
      email: 'admin@geopoint.com',
      role: 'dev',
      organizationId: 'org-1',
      organizationRole: 'owner',
      organizationName: 'Empresa Demo',
      createdAt: new Date('2024-01-15'),
      lastActivity: new Date(),
      isOnline: true,
    },
    {
      uid: 'admin-user-1',
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

  constructor() {
    // Inicializar con datos de desarrollo
    this.usersSubject.next(this.developmentUsers);

    // Exponer servicio para debugging
    if (typeof window !== 'undefined') {
      (window as any).userManagementService = this;
      console.log('🔧 UserManagementService exposed globally');
    }
  }

  /**
   * Obtiene todos los usuarios registrados en el sistema
   * Solo accesible para administradores
   */
  async getAllUsers(): Promise<UserWithOrganization[]> {
    // Verificar permisos
    const hasPermission = await this.authorizationService
      .hasPermission('manage-users')
      .toPromise();

    if (!hasPermission) {
      throw new Error('No tienes permisos para gestionar usuarios');
    }

    // En desarrollo, devolver datos simulados
    if (this.isDevelopmentMode()) {
      console.log('🔧 Development mode: returning simulated users');
      return this.developmentUsers;
    }

    // TODO: Implementar consulta real a Firestore
    try {
      const usersCollection = collection(this.firestore, 'users');
      const usersQuery = query(usersCollection, orderBy('createdAt', 'desc'));
      const snapshot: QuerySnapshot<DocumentData> = await getDocs(usersQuery);

      const users: UserWithOrganization[] = [];
      for (const docSnap of snapshot.docs) {
        const userData = docSnap.data() as User;
        const userWithOrg = await this.enrichUserWithOrganization(userData);
        users.push(userWithOrg);
      }

      this.usersSubject.next(users);
      return users;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Error al obtener la lista de usuarios');
    }
  }

  /**
   * Obtiene usuarios filtrados por organización
   */
  async getUsersByOrganization(
    organizationId: string
  ): Promise<UserWithOrganization[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter((user) => user.organizationId === organizationId);
  }

  /**
   * Obtiene usuarios sin organización asignada
   */
  async getUsersWithoutOrganization(): Promise<UserWithOrganization[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter((user) => !user.organizationId);
  }

  /**
   * Cambia el rol global de un usuario
   */
  async changeUserRole(
    userId: string,
    newRole: 'dev' | 'admin' | 'user',
    reason?: string
  ): Promise<void> {
    // Verificar permisos
    const hasPermission = await this.authorizationService
      .hasPermission('change-roles')
      .toPromise();

    if (!hasPermission) {
      throw new Error('No tienes permisos para cambiar roles');
    }

    console.log(`👑 Changing user ${userId} role to ${newRole}`, { reason });

    // En modo desarrollo, actualizar datos simulados
    if (this.isDevelopmentMode()) {
      const userIndex = this.developmentUsers.findIndex(
        (u) => u.uid === userId
      );
      if (userIndex !== -1) {
        this.developmentUsers[userIndex].role = newRole;
        this.usersSubject.next([...this.developmentUsers]);

        // Si es el usuario actual logueado, también actualizar el servicio de autorización
        const currentUser = await this.authService.getCurrentUser().toPromise();
        if (currentUser && currentUser.uid === userId) {
          this.authorizationService.setDevelopmentRole(newRole);
        }

        // Registrar el cambio
        console.log(`✅ User role changed in development mode:`, {
          userId,
          newRole,
          reason,
          timestamp: new Date(),
        });

        return;
      } else {
        throw new Error('Usuario no encontrado');
      }
    }

    // TODO: Implementar actualización real en Firestore
    try {
      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        role: newRole,
        updatedAt: new Date(),
        lastRoleChangeBy: (
          await this.authService.getCurrentUser().toPromise()
        )?.uid,
        lastRoleChangeReason: reason,
      });

      // Actualizar lista local
      await this.getAllUsers();

      console.log(`✅ User role updated successfully:`, {
        userId,
        newRole,
        reason,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      throw new Error('Error al actualizar el rol del usuario');
    }
  }

  /**
   * Asigna un usuario a una organización
   */
  async assignUserToOrganization(
    userId: string,
    organizationId: string,
    organizationRole: 'admin' | 'user' = 'user'
  ): Promise<void> {
    const hasPermission = await this.authorizationService
      .hasPermission('manage-users')
      .toPromise();

    if (!hasPermission) {
      throw new Error('No tienes permisos para gestionar usuarios');
    }

    console.log(
      `🏢 Assigning user ${userId} to organization ${organizationId} as ${organizationRole}`
    );

    // En modo desarrollo
    if (this.isDevelopmentMode()) {
      const userIndex = this.developmentUsers.findIndex(
        (u) => u.uid === userId
      );
      if (userIndex !== -1) {
        // Obtener info de la organización
        const organization = await this.organizationService
          .getUserOrganizations()
          .toPromise()
          .then((orgs) => orgs?.find((org) => org.id === organizationId));

        this.developmentUsers[userIndex].organizationId = organizationId;
        this.developmentUsers[userIndex].organizationRole = organizationRole;
        this.developmentUsers[userIndex].organizationName = organization?.name;

        this.usersSubject.next([...this.developmentUsers]);
        return;
      }
    }

    // TODO: Implementar actualización real
    try {
      // Actualizar usuario
      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        organizationId,
        organizationRole,
        updatedAt: new Date(),
      });

      // Agregar a la lista de miembros de la organización
      // (esto se haría a través del OrganizationService)

      await this.getAllUsers();
    } catch (error) {
      console.error('Error assigning user to organization:', error);
      throw new Error('Error al asignar usuario a la organización');
    }
  }

  /**
   * Remueve un usuario de una organización
   */
  async removeUserFromOrganization(userId: string): Promise<void> {
    const hasPermission = await this.authorizationService
      .hasPermission('manage-users')
      .toPromise();

    if (!hasPermission) {
      throw new Error('No tienes permisos para gestionar usuarios');
    }

    console.log(`🚫 Removing user ${userId} from organization`);

    // En modo desarrollo
    if (this.isDevelopmentMode()) {
      const userIndex = this.developmentUsers.findIndex(
        (u) => u.uid === userId
      );
      if (userIndex !== -1) {
        this.developmentUsers[userIndex].organizationId = undefined;
        this.developmentUsers[userIndex].organizationRole = undefined;
        this.developmentUsers[userIndex].organizationName = undefined;

        this.usersSubject.next([...this.developmentUsers]);
        return;
      }
    }

    // TODO: Implementar remoción real
    try {
      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        organizationId: null,
        organizationRole: null,
        updatedAt: new Date(),
      });

      await this.getAllUsers();
    } catch (error) {
      console.error('Error removing user from organization:', error);
      throw new Error('Error al remover usuario de la organización');
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
    onlineUsers: number;
    recentlyActive: number;
  }> {
    return this.users$.pipe(
      map((users) => {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        return {
          totalUsers: users.length,
          adminUsers: users.filter(
            (u) => u.role === 'admin' || u.role === 'dev'
          ).length,
          regularUsers: users.filter((u) => u.role === 'user').length,
          usersWithoutOrganization: users.filter((u) => !u.organizationId)
            .length,
          onlineUsers: users.filter((u) => u.isOnline).length,
          recentlyActive: users.filter(
            (u) => u.lastActivity && u.lastActivity.getTime() > oneDayAgo
          ).length,
        };
      })
    );
  }

  /**
   * Enriquece un usuario con información de su organización
   */
  private async enrichUserWithOrganization(
    user: User
  ): Promise<UserWithOrganization> {
    if (!user.organizationId) {
      return user as UserWithOrganization;
    }

    try {
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
        lastActivity: new Date(
          Date.now() - Math.random() * 1000 * 60 * 60 * 24
        ), // Random last activity
        isOnline: Math.random() > 0.6, // Random online status
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
    return (
      !this.firestore ||
      (typeof window !== 'undefined' && (window as any).developmentMode)
    );
  }

  /**
   * Busca usuarios por email o nombre
   */
  searchUsers(searchTerm: string): Observable<UserWithOrganization[]> {
    return this.users$.pipe(
      map((users) =>
        users.filter(
          (user) =>
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.organizationName
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase())
        )
      )
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
}
