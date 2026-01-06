import { Component, computed, inject, signal } from '@angular/core';
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
  ActionSheetController, IonBadge } from '@ionic/angular/standalone';
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
  helpOutline, peopleOutline, checkmarkCircle } from 'ionicons/icons';
import { AuthService } from '../../../auth/services/auth.service';
import {
  UserManagementService,
  UserWithOrganization,
} from '../../services/user-management.service';
import {
  getUserDisplayName,
  getUserShortName,
  User,
} from '../../../shared/models/user.model';

// Constants
const INIT_TIMEOUT_MS = 2000;
const LOAD_TIMEOUT_MS = 10000;

const ORG_ROLE_COLORS: Record<string, string> = {
  owner: 'warning',
  admin: 'danger',
  moderator: 'secondary',
  user: 'primary',
};

const ORG_ROLE_ICONS: Record<string, string> = {
  owner: 'ribbon-outline',
  admin: 'shield-checkmark-outline',
  moderator: 'shield-outline',
  user: 'person-outline',
};

const ORG_ROLE_NAMES: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Admin',
  moderator: 'Moderador',
  user: 'Miembro',
};

type OrgRole = 'owner' | 'admin' | 'moderator' | 'user';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
  standalone: true,
  imports: [IonBadge, 
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
    IonChip,
    IonSpinner,
  ],
})
export class UserManagementComponent {
  private readonly userManagementService = inject(UserManagementService);
  private readonly authService = inject(AuthService);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly actionSheetController = inject(ActionSheetController);

  // Signals
  readonly users = signal<UserWithOrganization[]>([], {
  equal: () => false // Forzar detección de cambios
});
  readonly isLoading = signal(true);

  // Use service signal directly
  readonly currentUser = this.authService.currentUser;

  // Computed signals
  readonly currentUserId = computed(() => this.currentUser()?.uid ?? null);
  readonly hasUsers = computed(() => this.users().length > 0);
  readonly usersCount = computed(() => this.users().length);

  constructor() {
    this.initializeIcons();
    this.initializeComponent();
  }

  private initializeIcons(): void {
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

  private async initializeComponent(): Promise<void> {
    const timeoutId = setTimeout(() => {
      if (this.isLoading()) {
        this.isLoading.set(false);
      }
    }, INIT_TIMEOUT_MS);

    try {
      await this.loadUsers();
    } catch (error) {
      this.isLoading.set(false);
      await this.showToast('Error de inicialización', 'danger');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async loadUsers(): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Timeout: La carga tardó más de 10 segundos')),
        LOAD_TIMEOUT_MS
      );
    });

    try {
      const users = await Promise.race([
        this.userManagementService.getSimpleOrganizationUsers(),
        timeoutPromise,
      ]);

      this.users.set(users);
    } catch (error) {
      await this.showToast(
        error instanceof Error ? error.message : 'Error cargando datos',
        'danger'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  // Utility methods using constants
  getOrgRoleColor(role: string): string {
    return ORG_ROLE_COLORS[role] ?? 'medium';
  }

  getOrgRoleIcon(role: string): string {
    return ORG_ROLE_ICONS[role] ?? 'help-outline';
  }

  getOrgRoleDisplayName(role: string): string {
    return ORG_ROLE_NAMES[role] ?? 'Sin rol';
  }

  isCurrentUser(user: UserWithOrganization): boolean {
    return this.currentUserId() === user.uid;
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
    }
    if (words.length === 1) {
      return words[0][0].toUpperCase();
    }
    return 'U';
  }

    // Permission check helper
    async openRoleSelector(user: UserWithOrganization): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser) {
      await this.showToast('Error al verificar permisos', 'danger');
      return;
    }

    // NUEVO: Proteger al propietario
    if (user.organizationRole === 'owner') {
      await this.showToast(
        'No se puede cambiar el rol del propietario de la organización',
        'warning'
      );
      return;
    }

    // NUEVO: Solo el propietario puede asignar roles de admin
    if (currentUser.organizationRole !== 'owner') {
      await this.showToast(
        'Solo el propietario puede cambiar roles de usuarios',
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
        // CAMBIO: Remover opción de owner - solo el sistema puede asignarlo
        // {
        //   type: 'radio',
        //   label: 'Propietario',
        //   value: 'owner',
        //   checked: user.organizationRole === 'owner',
        // },
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
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cambiar',
          handler: async (newRole: OrgRole) => {
            if (newRole && newRole !== user.organizationRole) {
              await this.changeUserRole(user, newRole);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async changeUserRole(
  user: UserWithOrganization,
  newRole: OrgRole
): Promise<void> {
  try {
    await this.userManagementService.updateUserOrganizationRole(
      user.uid,
      newRole
    );

    await this.showToast(
      `Rol actualizado a ${this.getOrgRoleDisplayName(newRole)}`,
      'success'
    );

    // CAMBIO: Solo actualizar el usuario en el array local, NO recargar todo
    this.users.update(currentUsers => 
      currentUsers.map(u => 
        u.uid === user.uid 
          ? { ...u, organizationRole: newRole } 
          : u
      )
    );
  } catch (error) {
    await this.showToast('Error al cambiar el rol del usuario', 'danger');
  }
}

    async openUserOptions(user: UserWithOrganization): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser) {
      await this.showToast('Error al verificar permisos', 'danger');
      return;
    }

    // NUEVO: Proteger al propietario
    if (user.organizationRole === 'owner') {
      await this.showToast(
        'El propietario no puede ser removido de la organización',
        'warning'
      );
      return;
    }

    // NUEVO: Solo el propietario puede gestionar usuarios
    if (currentUser.organizationRole !== 'owner') {
      await this.showToast(
        'Solo el propietario puede gestionar usuarios',
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
      subHeader: user.email ?? '',
      buttons: [
        {
          text: 'Cambiar Rol',
          icon: 'swap-horizontal',
          handler: () => this.openRoleSelector(user),
        },
        {
          text: 'Eliminar de la Organización',
          icon: 'trash',
          role: 'destructive',
          handler: () => this.confirmRemoveUser(user),
        },
        { text: 'Cancelar', icon: 'close', role: 'cancel' },
      ],
    });

    await actionSheet.present();
  }

    private async confirmRemoveUser(user: UserWithOrganization): Promise<void> {
    // NUEVO: Doble verificación de seguridad
    if (user.organizationRole === 'owner') {
      await this.showToast(
        'El propietario no puede ser removido de la organización',
        'danger'
      );
      return;
    }

    const alert = await this.alertController.create({
      header: '¿Eliminar Usuario?',
      subHeader: this.getUserDisplayName(user),
      message: `¿Estás seguro de que deseas eliminar a ${user.email} de la organización? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.removeUser(user),
        },
      ],
    });

    await alert.present();
  }

  private async removeUser(user: UserWithOrganization): Promise<void> {
  try {
    await this.userManagementService.removeUserFromOrganization(user.uid);

    await this.showToast(
      `${this.getUserDisplayName(user)} eliminado de la organización`,
      'success'
    );

    // CAMBIO: Solo remover del array local, NO recargar todo
    this.users.update(currentUsers => 
      currentUsers.filter(u => u.uid !== user.uid)
    );
  } catch (error) {
    await this.showToast('Error al eliminar el usuario', 'danger');
  }
}

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger' = 'success'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

  // Permission check helper
  private hasManagementPermission(user: User | null): boolean {
    if (!user) return false;
    // CAMBIO: Solo el propietario tiene permisos de gestión
    return user.organizationRole === 'owner';
  }
}
