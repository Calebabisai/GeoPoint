import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonLabel,
  IonList,
  IonItem,
  IonAvatar,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonSpinner,
  AlertController,
  ToastController,
  ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  person,
  shield,
  shieldCheckmark,
  business,
  search,
  filter,
  add,
  ellipsisVertical,
  create,
  trash,
  checkmark,
  close,
  time,
  globe,
  settings,
  analytics,
  people,
  personAdd,
  swapHorizontal,
  eye,
  refresh,
  home,
  ribbonOutline,
  shieldCheckmarkOutline,
  personOutline,
  helpOutline,
} from 'ionicons/icons';
import { Observable, Subscription, firstValueFrom } from 'rxjs';

import { AuthorizationService } from '../../../auth/services/authorization.service';
import { AuthService } from '../../../auth/services/auth.service';
import {
  UserManagementService,
  UserWithOrganization,
} from '../../services/user-management.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import {
  getUserDisplayName,
  getUserShortName,
} from '../../../shared/models/user.model';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonLabel,
    IonList,
    IonItem,
    IonAvatar,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonSpinner,
  ],
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private userManagementService = inject(UserManagementService);
  private authorizationService = inject(AuthorizationService);
  private authService = inject(AuthService);
  private organizationService = inject(OrganizationService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private actionSheetController = inject(ActionSheetController);
  private router = inject(Router);

  // Observables
  users$!: Observable<UserWithOrganization[]>;
  isLoading = true;
  private subscriptions = new Subscription();

  // UID del usuario actual para comparaciones en template
  currentUserId: string | null = null;

  constructor() {
    this.subscriptions = new Subscription();

    addIcons({
      person,
      shield,
      shieldCheckmark,
      business,
      search,
      filter,
      add,
      ellipsisVertical,
      'ellipsis-vertical': ellipsisVertical,
      create,
      trash,
      checkmark,
      close,
      time,
      globe,
      settings,
      analytics,
      people,
      personAdd,
      swapHorizontal,
      'swap-horizontal': swapHorizontal,
      eye,
      refresh,
      home,
      ribbonOutline,
      'ribbon-outline': ribbonOutline,
      shieldCheckmarkOutline,
      'shield-checkmark-outline': shieldCheckmarkOutline,
      'shield-outline': shield,
      personOutline,
      'person-outline': personOutline,
      helpOutline,
      'help-outline': helpOutline,
    });
  }

  async ngOnInit() {
    // FORZAR detener loading inmediatamente
    setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
      }
    }, 2000);

    this.isLoading = true;

    try {

      // Configurar observables primero
      this.users$ = this.userManagementService.users$;

      // Obtener usuario actual con timeout
      const currentUser = await Promise.race([
        firstValueFrom(this.authService.getCurrentUser()),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            resolve(null);
          }, 1000)
        ),
      ]);


      // Guardar UID del usuario actual
      this.currentUserId = currentUser?.uid || null;

      // Cargar usuarios REALES de Firebase
      await this.loadDevelopmentData();

    } catch (error) {
      this.isLoading = false;
      await this.showToast('Error de inicialización', 'danger');
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private loadTestData() {
    console.log('📥 loadTestData() called');

    const testUsers: UserWithOrganization[] = [
      {
        uid: 'test-admin-1',
        email: 'admin@test.com',
        displayName: 'Juan Carlos Administrador',
        role: 'admin',
        organizationId: 'test-org',
        organizationRole: 'owner',
        organizationName: 'Organización de Prueba',
        createdAt: new Date('2024-01-01'),
        lastActivity: new Date(),
        isOnline: true,
      },
      {
        uid: 'test-user-1',
        email: 'usuario@test.com',
        displayName: 'María López García',
        role: 'user',
        organizationId: 'test-org',
        organizationRole: 'user',
        organizationName: 'Organización de Prueba',
        createdAt: new Date('2024-02-01'),
        lastActivity: new Date(),
        isOnline: false,
      },
      {
        uid: 'test-moderator-1',
        email: 'moderador@test.com',
        displayName: 'Pedro Moderador',
        role: 'user',
        organizationId: 'test-org',
        organizationRole: 'moderator',
        organizationName: 'Organización de Prueba',
        createdAt: new Date('2024-03-01'),
        lastActivity: new Date(),
        isOnline: true,
      },
    ];

    console.log('📥 Setting test users:', testUsers.length, 'users');
    this.userManagementService.setUsers(testUsers);
    console.log('✅ Test users loaded successfully');
  }

  /**
   * Carga usuarios REALES desde Firebase
   */
  private async loadDevelopmentData() {
    console.log('📦 Loading development data directly...');

    // Timeout de seguridad de 10 segundos
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Timeout: La carga tardó más de 10 segundos')),
        10000
      );
    });

    try {
      console.log('📞 Calling getSimpleOrganizationUsers...');

      // Race entre la carga y el timeout
      const users = await Promise.race([
        this.userManagementService.getSimpleOrganizationUsers(),
        timeoutPromise,
      ]);

      console.log(`✅ Development data loaded: ${users.length} users`);

      if (users.length > 0) {
        await this.showToast(`Cargados ${users.length} usuarios`, 'success');
      } else {
        await this.showToast('No se encontraron usuarios', 'warning');
      }

      this.isLoading = false;
      console.log('✅ isLoading set to false');
    } catch (error) {
      console.error('❌ Error loading development data:', error);
      await this.showToast(
        error instanceof Error ? error.message : 'Error cargando datos',
        'danger'
      );
      this.isLoading = false;
      console.log('✅ isLoading set to false (error path)');
    }
  }

  // Métodos para el template
  getOrgRoleColor(role: string): string {
    switch (role) {
      case 'owner':
        return 'warning';
      case 'admin':
        return 'danger';
      case 'moderator':
        return 'secondary';
      case 'user':
        return 'primary';
      default:
        return 'medium';
    }
  }

  getOrgRoleIcon(role: string): string {
    switch (role) {
      case 'owner':
        return 'ribbon-outline';
      case 'admin':
        return 'shield-checkmark-outline';
      case 'moderator':
        return 'shield-outline';
      case 'user':
        return 'person-outline';
      default:
        return 'help-outline';
    }
  }

  getOrgRoleDisplayName(role: string): string {
    switch (role) {
      case 'owner':
        return 'Propietario';
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderador';
      case 'user':
        return 'Miembro';
      default:
        return 'Sin rol';
    }
  }

  /**
   * Verifica si el usuario dado es el usuario actual logueado
   */
  isCurrentUser(user: UserWithOrganization): boolean {
    return this.currentUserId === user.uid;
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger' = 'success'
  ) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

  // Métodos utilitarios para obtener nombres de usuario
  getUserDisplayName(user: UserWithOrganization): string {
    return getUserDisplayName(user);
  }

  getUserShortName(user: UserWithOrganization): string {
    return getUserShortName(user);
  }

  // Obtener las iniciales del nombre para el avatar
  getUserInitials(user: UserWithOrganization): string {
    const displayName = this.getUserDisplayName(user);
    const words = displayName.split(' ').filter((word) => word.length > 0);

    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    } else if (words.length === 1) {
      return words[0][0].toUpperCase();
    } else {
      return 'U';
    }
  }

  /**
   * Método de prueba para verificar clicks
   */
  testClick(user: UserWithOrganization, source: string) {
    console.log('🔥 TEST CLICK from:', source, 'User:', user.email);
    alert(`Click detectado en ${source} para ${user.email}`);
  }

  /**
   * Abre el selector de roles para cambiar el rol del usuario
   */
  async openRoleSelector(user: UserWithOrganization) {
    console.log('🎯 openRoleSelector para:', user.email);

    try {
      // Obtener usuario actual de Firebase con timeout de 2 segundos
      console.log('🔍 Obteniendo usuario actual de Firebase...');

      const currentUser = await Promise.race([
        firstValueFrom(this.authService.getCurrentUser()),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('⏱️ getCurrentUser timeout (2s)');
            resolve(null);
          }, 2000);
        }),
      ]);

      console.log('📦 Usuario recibido:', currentUser?.email);

      if (!currentUser) {
        console.error('❌ No se pudo obtener el usuario actual');
        await this.showToast('Error al verificar permisos', 'danger');
        return;
      }

      console.log('👤 Datos del usuario:', {
        email: currentUser.email,
        globalRole: currentUser.role,
        orgRole: currentUser.organizationRole,
      });

      // Verificar permisos: owner, admin de org, o admin global
      const hasPermission =
        currentUser.organizationRole === 'owner' ||
        currentUser.organizationRole === 'admin' ||
        currentUser.role === 'admin';

      if (!hasPermission) {
        console.log(
          '❌ Access denied. OrgRole:',
          currentUser.organizationRole,
          'GlobalRole:',
          currentUser.role
        );
        await this.showToast(
          'Solo los propietarios y administradores pueden cambiar roles',
          'warning'
        );
        return;
      }

      // No permitir cambiar el rol propio
      if (currentUser.uid === user.uid) {
        console.log('❌ Cannot change own role');
        await this.showToast('No puedes cambiar tu propio rol', 'warning');
        return;
      }

      console.log('✅ Opening role selector alert...');

      const alert = await this.alertController.create({
        header: 'Cambiar Rol de Usuario',
        subHeader: `${this.getUserDisplayName(user)}`,
        message: 'Selecciona el nuevo rol para este usuario:',
        inputs: [
          {
            type: 'radio',
            label: 'Propietario',
            value: 'owner',
            checked: user.organizationRole === 'owner',
          },
          {
            type: 'radio',
            label: 'Administrador',
            value: 'admin',
            checked: user.organizationRole === 'admin',
          },
          {
            type: 'radio',
            label: 'Moderador',
            value: 'moderator',
            checked: user.organizationRole === 'moderator',
          },
          {
            type: 'radio',
            label: 'Usuario',
            value: 'user',
            checked: user.organizationRole === 'user',
          },
        ],
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel',
            handler: () => {
              console.log('❌ User cancelled role change');
            },
          },
          {
            text: 'Cambiar',
            handler: async (newRole) => {
              console.log('✅ User selected new role:', newRole);
              if (newRole && newRole !== user.organizationRole) {
                await this.changeUserRole(user, newRole);
              } else {
                console.log('⚠️ Same role selected, no change needed');
              }
            },
          },
        ],
      });

      console.log('📱 Alert created, presenting...');
      await alert.present();
      console.log('✅ Alert presented successfully');
    } catch (error) {
      console.error('❌ Error creating/presenting alert:', error);
      await this.showToast('Error al abrir selector de roles', 'danger');
    }
  }

  /**
   * Cambia el rol de un usuario en la organización
   */
  private async changeUserRole(
    user: UserWithOrganization,
    newRole: 'owner' | 'admin' | 'moderator' | 'user'
  ) {
    try {
      console.log(`🔄 Changing role for ${user.email} to ${newRole}`);

      // Actualizar en Firebase
      await this.userManagementService.updateUserOrganizationRole(
        user.uid,
        newRole
      );

      await this.showToast(
        `Rol actualizado a ${this.getOrgRoleDisplayName(newRole)}`,
        'success'
      );

      // Recargar usuarios
      this.loadTestData();
    } catch (error) {
      console.error('❌ Error changing user role:', error);
      await this.showToast('Error al cambiar el rol del usuario', 'danger');
    }
  }

  /**
   * Abre el menú de opciones del usuario (eliminar, etc.)
   */
  async openUserOptions(user: UserWithOrganization) {
    console.log('⚙️ openUserOptions para:', user.email);

    try {
      // Obtener usuario actual de Firebase con timeout de 2 segundos
      console.log('🔍 Obteniendo usuario actual de Firebase...');

      const currentUser = await Promise.race([
        firstValueFrom(this.authService.getCurrentUser()),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('⏱️ getCurrentUser timeout (2s)');
            resolve(null);
          }, 2000);
        }),
      ]);

      console.log('📦 Usuario recibido:', currentUser?.email);

      if (!currentUser) {
        console.error('❌ No se pudo obtener el usuario actual');
        await this.showToast('Error al verificar permisos', 'danger');
        return;
      }

      console.log('👤 Datos del usuario:', {
        email: currentUser.email,
        globalRole: currentUser.role,
        orgRole: currentUser.organizationRole,
      });

      // Verificar permisos: owner, admin de org, o admin global
      const hasPermission =
        currentUser.organizationRole === 'owner' ||
        currentUser.organizationRole === 'admin' ||
        currentUser.role === 'admin';

      if (!hasPermission) {
        console.log(
          '❌ Access denied. OrgRole:',
          currentUser.organizationRole,
          'GlobalRole:',
          currentUser.role
        );
        await this.showToast(
          'Solo los propietarios y administradores pueden gestionar usuarios',
          'warning'
        );
        return;
      }

      // No permitir eliminar el propio usuario
      if (currentUser.uid === user.uid) {
        console.log('❌ Cannot remove self from organization');
        await this.showToast(
          'No puedes eliminarte a ti mismo de la organización',
          'warning'
        );
        return;
      }

      console.log('✅ Opening action sheet...');

      const actionSheet = await this.actionSheetController.create({
        header: this.getUserDisplayName(user),
        subHeader: user.email || '',
        buttons: [
          {
            text: 'Cambiar Rol',
            icon: 'swap-horizontal',
            handler: () => {
              console.log('🔄 User selected: Change Role');
              this.openRoleSelector(user);
            },
          },
          {
            text: 'Eliminar de la Organización',
            icon: 'trash',
            role: 'destructive',
            handler: () => {
              console.log('🗑️ User selected: Remove from organization');
              this.confirmRemoveUser(user);
            },
          },
          {
            text: 'Cancelar',
            icon: 'close',
            role: 'cancel',
            handler: () => {
              console.log('❌ User cancelled action sheet');
            },
          },
        ],
      });

      console.log('📱 Action sheet created, presenting...');
      await actionSheet.present();
      console.log('✅ Action sheet presented successfully');
    } catch (error) {
      console.error('❌ Error en openUserOptions:', error);
      await this.showToast('Error al abrir menú de opciones', 'danger');
    }
  }

  /**
   * Confirma la eliminación de un usuario
   */
  private async confirmRemoveUser(user: UserWithOrganization) {
    const alert = await this.alertController.create({
      header: '¿Eliminar Usuario?',
      subHeader: this.getUserDisplayName(user),
      message: `¿Estás seguro de que deseas eliminar a ${user.email} de la organización? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.removeUser(user);
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Elimina un usuario de la organización
   */
  private async removeUser(user: UserWithOrganization) {
    try {
      console.log(`🗑️ Removing user ${user.email} from organization`);

      await this.userManagementService.removeUserFromOrganization(user.uid);

      await this.showToast(
        `${this.getUserDisplayName(user)} eliminado de la organización`,
        'success'
      );

      // Recargar usuarios
      this.loadTestData();
    } catch (error) {
      console.error('❌ Error removing user:', error);
      await this.showToast('Error al eliminar el usuario', 'danger');
    }
  }
}
