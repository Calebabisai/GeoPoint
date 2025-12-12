import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  ellipsisVertical,
  trash,
  close,
  people,
  swapHorizontal,
  ribbonOutline,
  shieldCheckmarkOutline,
  personOutline,
  helpOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../auth/services/auth.service';
import {
  UserManagementService,
  UserWithOrganization,
} from '../../services/user-management.service';
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
export class UserManagementComponent {
  private userManagementService = inject(UserManagementService);
  private authService = inject(AuthService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private actionSheetController = inject(ActionSheetController);

  // Signals
  users = signal<UserWithOrganization[]>([]);
  isLoading = signal(true);
  currentUserId = signal<string | null>(null);


  constructor() {
    console.log('👤 UserManagementComponent constructor called');
    this.initializeIcons();
    this.initializeComponent();
  }

  private initializeIcons() {
    addIcons({
      person,
      shield,
      ellipsisVertical,
      'ellipsis-vertical': ellipsisVertical,
      trash,
      close,
      ribbonOutline,
      'ribbon-outline': ribbonOutline,
      shieldCheckmarkOutline,
      'shield-checkmark-outline': shieldCheckmarkOutline,
      'shield-outline': shield,
      personOutline,
      'person-outline': personOutline,
      helpOutline,
      'help-outline': helpOutline,
      swapHorizontal,
      'swap-horizontal': swapHorizontal,
      people,
    });
  }

  private async initializeComponent() {

    const timeoutId = setTimeout(() => {
      if (this.isLoading()) {
        this.isLoading.set(false);
      }
    }, 2000);

    try {
      console.log('⚡ Starting quick initialization...');

      const currentUser = await this.getCurrentUserWithTimeout();
      this.currentUserId.set(currentUser?.uid || null);

      await this.loadDevelopmentData();

    } catch (error) {
      console.error('Error during initialization:', error);
      this.isLoading.set(false);
      await this.showToast('Error de inicialización', 'danger');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async getCurrentUserWithTimeout(timeout = 1000) {
    return Promise.race([
      this.authService.getCurrentUser().toPromise(),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          resolve(null);
        }, timeout);
      }),
    ]);
  }

  private loadTestData() {

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

    this.userManagementService.setUsers(testUsers);
    this.users.set(testUsers);
  }

  private async loadDevelopmentData() {

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Timeout: La carga tardó más de 10 segundos')),
        10000
      );
    });

    try {

      const users = await Promise.race([
        this.userManagementService.getSimpleOrganizationUsers(),
        timeoutPromise,
      ]);

      this.users.set(users);

      if (users.length > 0) {
        await this.showToast(`Cargados ${users.length} usuarios`, 'success');
      } else {
        await this.showToast('No se encontraron usuarios', 'warning');
      }

      this.isLoading.set(false);
    } catch (error) {
      await this.showToast(
        error instanceof Error ? error.message : 'Error cargando datos',
        'danger'
      );
      this.isLoading.set(false);
    }
  }

  getOrgRoleColor(role: string): string {
    const colors: Record<string, string> = {
      owner: 'warning',
      admin: 'danger',
      moderator: 'secondary',
      user: 'primary',
    };
    return colors[role] || 'medium';
  }

  getOrgRoleIcon(role: string): string {
    const icons: Record<string, string> = {
      owner: 'ribbon-outline',
      admin: 'shield-checkmark-outline',
      moderator: 'shield-outline',
      user: 'person-outline',
    };
    return icons[role] || 'help-outline';
  }

  getOrgRoleDisplayName(role: string): string {
    const names: Record<string, string> = {
      owner: 'Propietario',
      admin: 'Admin',
      moderator: 'Moderador',
      user: 'Miembro',
    };
    return names[role] || 'Sin rol';
  }

  isCurrentUser(user: UserWithOrganization): boolean {
    return this.currentUserId() === user.uid;
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

  getUserDisplayName(user: UserWithOrganization): string {
    return getUserDisplayName(user);
  }

  getUserShortName(user: UserWithOrganization): string {
    return getUserShortName(user);
  }

  getUserInitials(user: UserWithOrganization): string {
    const displayName = this.getUserDisplayName(user);
    const words = displayName.split(' ').filter((word) => word.length > 0);

    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    } else if (words.length === 1) {
      return words[0][0].toUpperCase();
    }
    return 'U';
  }

  async openRoleSelector(user: UserWithOrganization) {

    try {
      const currentUser = await this.getCurrentUserWithTimeout(2000);

      if (!currentUser) {
        console.error('❌ No se pudo obtener el usuario actual');
        await this.showToast('Error al verificar permisos', 'danger');
        return;
      }

      const hasPermission =
        currentUser.organizationRole === 'owner' ||
        currentUser.organizationRole === 'admin' ||
        currentUser.role === 'admin';

      if (!hasPermission) {
        await this.showToast(
          'Solo los propietarios y administradores pueden cambiar roles',
          'warning'
        );
        return;
      }

      if (currentUser.uid === user.uid) {
        await this.showToast('No puedes cambiar tu propio rol', 'warning');
        return;
      }

      const alert = await this.alertController.create({
        header: 'Cambiar Rol de Usuario',
        subHeader: this.getUserDisplayName(user),
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
          },
          {
            text: 'Cambiar',
            handler: async (newRole) => {
              if (newRole && newRole !== user.organizationRole) {
                await this.changeUserRole(user, newRole);
              }
            },
          },
        ],
      });

      await alert.present();
    } catch (error) {
      console.error('Error opening role selector:', error);
      await this.showToast('Error al abrir selector de roles', 'danger');
    }
  }

  private async changeUserRole(
    user: UserWithOrganization,
    newRole: 'owner' | 'admin' | 'moderator' | 'user'
  ) {
    try {

      await this.userManagementService.updateUserOrganizationRole(
        user.uid,
        newRole
      );

      await this.showToast(
        `Rol actualizado a ${this.getOrgRoleDisplayName(newRole)}`,
        'success'
      );

      this.loadTestData();
    } catch (error) {
      await this.showToast('Error al cambiar el rol del usuario', 'danger');
    }
  }

  async openUserOptions(user: UserWithOrganization) {

    try {
      const currentUser = await this.getCurrentUserWithTimeout(2000);

      if (!currentUser) {
        await this.showToast('Error al verificar permisos', 'danger');
        return;
      }

      const hasPermission =
        currentUser.organizationRole === 'owner' ||
        currentUser.organizationRole === 'admin' ||
        currentUser.role === 'admin';

      if (!hasPermission) {
        await this.showToast(
          'Solo los propietarios y administradores pueden gestionar usuarios',
          'warning'
        );
        return;
      }

      if (currentUser.uid === user.uid) {
        await this.showToast(
          'No puedes eliminarte a ti mismo de la organización',
          'warning'
        );
        return;
      }

      const actionSheet = await this.actionSheetController.create({
        header: this.getUserDisplayName(user),
        subHeader: user.email || '',
        buttons: [
          {
            text: 'Cambiar Rol',
            icon: 'swap-horizontal',
            handler: () => {
              this.openRoleSelector(user);
            },
          },
          {
            text: 'Eliminar de la Organización',
            icon: 'trash',
            role: 'destructive',
            handler: () => {
              this.confirmRemoveUser(user);
            },
          },
          {
            text: 'Cancelar',
            icon: 'close',
            role: 'cancel',
          },
        ],
      });

      await actionSheet.present();
    } catch (error) {
      await this.showToast('Error al abrir menú de opciones', 'danger');
    }
  }

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

  private async removeUser(user: UserWithOrganization) {
    try {

      await this.userManagementService.removeUserFromOrganization(user.uid);

      await this.showToast(
        `${this.getUserDisplayName(user)} eliminado de la organización`,
        'success'
      );

      this.loadTestData();
    } catch (error) {
      await this.showToast('Error al eliminar el usuario', 'danger');
    }
  }
}
