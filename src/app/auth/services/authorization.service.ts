import { Injectable } from '@angular/core';
import { Observable, map, BehaviorSubject, of, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { User } from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthorizationService {
  // Subject para el rol de desarrollo (solo para testing)
  private developmentRoleSubject = new BehaviorSubject<'admin' | 'user' | null>(
    null // No establecer rol por defecto - usar el rol real del usuario
  );

  constructor(private authService: AuthService) {
    console.log(
      '🔥 AuthorizationService initialized with constructor injection'
    );
    // Exponer el servicio globalmente para debugging (solo en desarrollo)
    if (typeof window !== 'undefined') {
      (window as any).authorizationService = this;
      console.log(
        '🔧 AuthorizationService exposed globally as window.authorizationService'
      );
    }
  }
  /**
   * Obtiene el usuario actual y su rol
   */
  getCurrentUser(): Observable<User | null> {
    return this.authService.getCurrentUser().pipe(
      map((user) => {
        if (!user) return null;

        // En modo desarrollo, usar el rol override si está disponible
        const developmentRole = this.developmentRoleSubject.value;
        if (developmentRole) {
          return {
            ...user,
            role: developmentRole,
          };
        }

        return user;
      })
    );
  }

  /**
   * Verifica si el usuario actual es desarrollador
   * @deprecated - Rol de desarrollador eliminado
   */
  isDev(): Observable<boolean> {
    return of(false);
  }

  /**
   * Verifica si el usuario actual es administrador
   */
  isAdmin(): Observable<boolean> {
    return this.getCurrentUser().pipe(map((user) => user?.role === 'admin'));
  }

  /**
   * Verifica si el usuario actual es un usuario normal
   */
  isUser(): Observable<boolean> {
    return this.getCurrentUser().pipe(map((user) => user?.role === 'user'));
  }

  /**
   * Verifica si el usuario tiene permisos elevados (solo admin)
   */
  hasElevatedPermissions(): Observable<boolean> {
    return this.getCurrentUser().pipe(map((user) => user?.role === 'admin'));
  }

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated(): Observable<boolean> {
    return this.getCurrentUser().pipe(map((user) => user !== null));
  }

  /**
   * Obtiene el rol del usuario actual
   */
  getCurrentUserRole(): Observable<'admin' | 'user' | null> {
    return this.getCurrentUser().pipe(map((user) => user?.role || null));
  }

  /**
   * Verifica permisos específicos
   */
  hasPermission(permission: string): Observable<boolean> {
    return this.getCurrentUser().pipe(
      map((user) => {
        if (!user) return false;

        // Permisos específicos por rol
        const permissions = this.getPermissionsByRole(user.role);
        return permissions.includes(permission);
      })
    );
  }

  /**
   * Define permisos por rol
   */
  private getPermissionsByRole(role: 'admin' | 'user'): string[] {
    const permissionMap = {
      admin: [
        // Administrador tiene todos los permisos
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
    console.log(`🔄 Development mode: Setting role to ${role}`);
    console.log(
      '📊 Current developmentRoleSubject value before:',
      this.developmentRoleSubject.value
    );

    // Actualizar el subject para que los observables se actualicen
    this.developmentRoleSubject.next(role);

    console.log(
      '📊 Current developmentRoleSubject value after:',
      this.developmentRoleSubject.value
    );

    // Emitir evento personalizado para componentes que lo escuchen
    window.dispatchEvent(
      new CustomEvent('roleChanged', {
        detail: { role, timestamp: new Date() },
      })
    );

    console.log(`✅ Role successfully changed to ${role} in development mode`);

    // Verificar que el getCurrentUser devuelve el rol correcto
    this.getCurrentUser().subscribe((user) => {
      console.log('🔍 User after role change:', user);
    });
  }

  /**
   * Actualiza el rol de un usuario en Firebase/Firestore
   * TODO: Conectar con Firestore cuando esté listo
   */
  async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    console.log(`👑 Updating user ${userId} role to ${role}`);

    // Por ahora solo logueamos, en implementación real usaríamos Firestore
    // const userDoc = doc(this.firestore, 'users', userId);
    // await updateDoc(userDoc, { role });

    // Para desarrollo, si es el usuario actual, actualizar el rol temporal
    const currentUser = await firstValueFrom(this.getCurrentUser());
    if (currentUser && currentUser.uid === userId) {
      this.setDevelopmentRole(role);
    }

    console.log(`✅ User role update completed for ${userId}`);
  }

  /**
   * Método de debugging para desarrollo
   */
  debugCurrentState(): void {
    console.log('🐛 DEBUG - Authorization Service State:');
    console.log(
      '- developmentRoleSubject value:',
      this.developmentRoleSubject.value
    );

    this.getCurrentUser().subscribe((user) => {
      console.log('- getCurrentUser() result:', user);
    });

    this.getCurrentUserRole().subscribe((role) => {
      console.log('- getCurrentUserRole() result:', role);
    });

    this.isAdmin().subscribe((isAdmin) => {
      console.log('- isAdmin() result:', isAdmin);
    });
  }
}
