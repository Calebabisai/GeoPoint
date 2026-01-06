import { Injectable, inject, signal, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthorizationService {
  private authService = inject(AuthService);

  //Signal para rol de desarrollo(Solo para testing)
  private developmentRoleSignal = signal<'admin' | 'user' | null>(null);

  //Computed Signals - Use authService.currentUser directly (it's already a signal)
  readonly currentUser = computed(() => this.authService.currentUser());
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');
  readonly isUser = computed(() => this.currentUser()?.role === 'user');
  readonly hasElevatedPermissions = computed(() => this.isAdmin());
  readonly currentUserRole = computed(() => this.currentUser()?.role ?? null);

  /**
   * Obtiene el usuario actual con rol override si está en desarrollo
   */
  getUserWithDevelopmentRole(): User | null {
    const user = this.currentUser();
    if (!user) return null;

    const devRole = this.developmentRoleSignal();
    if (devRole) {
      return {
        ...user,
        role: devRole,
      };
    }

    return user;
  }

  /**
   * Verifica si el usuario es desarrollador
   * @deprecated - Rol de desarrollador eliminado
   */
  isDev(): boolean {
    return false;
  }

  /**
   * Define permisos por rol
   */
  private getPermissionsByRole(role: 'admin' | 'user'): string[] {
    const permissionMap = {
      admin: [
        'create-marker',
        'edit-marker',
        'delete-marker',
        'create-zone',
        'edit-zone',
        'delete-zone',
        'create-route',
        'edit-route',
        'delete-route',
        'manage-users',
        'change-roles',
        'view-analytics',
        'export-data',
        'system-settings',
        'debug-mode',
        'developer-tools',
      ],
      user: [
        'create-marker',
        'edit-own-marker',
        'delete-own-marker',
        'view-zones',
        'view-routes',
      ],
    };

    return permissionMap[role] || [];
  }

  /**
   * Obtiene permisos basados en el rol de organización
   */
  private getPermissionsByOrganizationRole(orgRole: 'owner' | 'admin' | 'moderator' | 'user' | null): string[] {
    if (!orgRole) return [];
    
    const permissionMap = {
      owner: [
        'create-marker',
        'edit-marker',
        'delete-marker',
        'create-zone',
        'edit-zone',
        'delete-zone',
        'create-route',
        'edit-route',
        'delete-route',
        'manage-users',
        'change-roles',
        'view-analytics',
        'export-data',
        'system-settings',
      ],
      admin: [
        'create-marker',
        'edit-marker',
        'delete-marker',
        'create-zone',
        'edit-zone',
        'delete-zone',
        'create-route',
        'edit-route',
        'delete-route',
        'view-analytics',
        'export-data',
      ],
      moderator: [
        'create-marker',
        'edit-marker',
        'delete-marker',
        'create-zone',
        'edit-zone',
        'delete-zone',
        'create-route',
        'edit-route',
        'delete-route',
      ],
      user: [
        'create-marker',
        'edit-own-marker',
        'delete-own-marker',
        'view-zones',
        'view-routes',
      ],
    };

    return permissionMap[orgRole] || [];
  }

  /**
   * Obtiene todos los permisos del usuario (combina rol global y rol de organización)
   */
  readonly userPermissions = computed(() => {
    const user = this.currentUser();
    if (!user) return [];
    
    // Permisos por rol global (admin/user)
    const globalPermissions = this.getPermissionsByRole(user.role);
    
    // Permisos por rol de organización
    const orgPermissions = this.getPermissionsByOrganizationRole(user.organizationRole || null);
    
    // Combinar ambos (sin duplicados)
    return [...new Set([...globalPermissions, ...orgPermissions])];
  });

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  hasPermission(permission: string): boolean {
    return this.userPermissions().includes(permission);
  }

  /**
   * Simulador de usuario para desarrollo (temporal)
   * TODO: Remover cuando la autenticación esté completa
   */
  simulateUser(role: 'admin' | 'user'): User {
    return {
      uid: `simulated-${role}-${Date.now()}`,
      email: `${role}@test.com`,
      role: role,
      createdAt: new Date(),
    };
  }

  /**
   * Método para cambiar rol temporalmente en desarrollo
   * TODO: Implementar correctamente con Firebase/Firestore
   */
  setDevelopmentRole(role: 'admin' | 'user'): void {

    this.developmentRoleSignal.set(role);

    // Emitir evento personalizado para componentes que lo escuchen
    window.dispatchEvent(
      new CustomEvent('roleChanged', {
        detail: { role, timestamp: new Date() },
      })
    );
  }

  /**
   * Actualiza el rol de un usuario en Firebase/Firestore
   * TODO: Conectar con Firestore cuando esté listo
   */
  async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {

    const currentUser = this.currentUser();
    if (currentUser && currentUser.uid === userId) {
      this.setDevelopmentRole(role);
    }
  }
}
