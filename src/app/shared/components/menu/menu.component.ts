import {
  Component,
  inject,
  computed,
} from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonButton,
  IonMenu,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonAccordion,
  IonAccordionGroup,
  ToastController,
  AlertController,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  personOutline,
  mailOutline,
  shieldCheckmarkOutline,
  ribbonOutline,
  keyOutline,
  peopleOutline,
  codeSlashOutline,
  settingsOutline,
  swapHorizontalOutline,
  businessOutline,
  addOutline,
  shareOutline,
  copyOutline,
  personAddOutline,
  helpOutline,
} from 'ionicons/icons';
import { AuthService } from 'src/app/core/services/auth.service';
import { AuthorizationService } from 'src/app/core/services/authorization.service';
import { OrganizationService } from 'src/app/features/invitations/services/organization.service';
import { Router } from '@angular/router';
import { User, getUserDisplayName, getUserShortName } from 'src/app/core/models/user.model';


@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonButton,
    IonMenu,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonAccordion,
    IonAccordionGroup,
  ],
})
export class MenuComponent {
  private authService = inject(AuthService);
  private authorizationService = inject(AuthorizationService);
  private organizationService = inject(OrganizationService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private menuCtrl = inject(MenuController);

  // Signals
  readonly currentUser = computed(() => this.authService.getCurrentUser()());
  readonly currentOrganization = computed(() =>
    this.organizationService.currentOrganization()
  );
  readonly organizationRole = computed(() =>
    this.organizationService.organizationRole()
  );
  readonly userOrganizations = computed(() =>
    this.organizationService.userOrganizations()
  );
  readonly isDev = computed(() => {
    return (typeof window !== 'undefined' &&
      (window as any).forceDevelopmentMode) ||
      false;
  });

  constructor() {
    addIcons({
      personOutline,
      helpOutline,
      businessOutline,
      settingsOutline,
      personAddOutline,
      peopleOutline,
      copyOutline,
      mailOutline,
      swapHorizontalOutline,
      ribbonOutline,
      addOutline,
      logOutOutline,
      shieldCheckmarkOutline,
      keyOutline,
      codeSlashOutline,
      shareOutline,
    });
  }

  getRoleDisplayName(role: string): string {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'Administrador';
      case 'moderator':
        return 'Moderador';
      case 'user':
        return 'Usuario';
      default:
        return 'Usuario';
    }
  }

  getRoleIcon(role: string): string {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'ribbon-outline';
      case 'moderator':
        return 'shield-checkmark-outline';
      case 'user':
        return 'people-outline';
      default:
        return 'people-outline';
    }
  }

  getRoleClass(role: string): string {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'role-admin';
      case 'moderator':
        return 'role-moderator';
      case 'user':
        return 'role-user';
      default:
        return 'role-user';
    }
  }

  /**
   * Cambiar rol (solo disponible para admins)
   */
  async changeRole(newRole: 'admin' | 'user') {
    try {
      this.authorizationService.setDevelopmentRole(newRole);

      const toast = await this.toastCtrl.create({
        message: `Rol cambiado a ${this.getRoleDisplayName(newRole)}`,
        duration: 2000,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
    } catch (error) {
      console.error('Error changing role', error);

      const toast = await this.toastCtrl.create({
        message: 'Error al cambiar el rol',
        duration: 3000,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    }
  }

  /**
   * Crear nueva organización
   */
  async createOrganization() {
    const alert = await this.alertCtrl.create({
      header: 'Nueva Organización',
      message: 'Crea un nuevo grupo de trabajo',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Nombre de la organización',
          attributes: {
            maxlength: 50,
          },
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Descripción (opcional)',
          attributes: {
            maxlength: 200,
          },
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Crear',
          handler: async (data) => {
            if (data.name?.trim()) {
              try {
                const newOrg =
                  await this.organizationService.createOrganization({
                    name: data.name.trim(),
                    description: data.description?.trim(),
                  });

                await this.organizationService.setCurrentOrganization(newOrg.id);

                const toast = await this.toastCtrl.create({
                  message: `Organización "${newOrg.name}" creada exitosamente`,
                  duration: 3000,
                  position: 'bottom',
                  color: 'success',
                });
                await toast.present();
              } catch (error) {
                console.error('Error creating organization', error);

                const toast = await this.toastCtrl.create({
                  message: 'Error al crear la organización',
                  duration: 3000,
                  position: 'bottom',
                  color: 'danger',
                });
                await toast.present();
              }
            }
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Cambiar de organización
   */
  changeOrganization(organizationId: string) {
    this.organizationService.setCurrentOrganization(organizationId);
  }

  /**
   * Invitar usuario a la organización
   */
  async inviteUser() {
    await this.menuCtrl.close();
    this.router.navigate(['/invitations/email']);
  }


  /**
   * Obtener el nombre del rol de organización
   */
  getOrganizationRoleDisplayName(role: string | null): string {
    if (!role) return 'Miembro';
    switch (role.toLowerCase()) {
      case 'owner':
        return 'Propietario';
      case 'admin':
        return 'Administrador';
      case 'moderator':
        return 'Moderador';
      case 'user':
        return 'Miembro';
      default:
        return 'Miembro';
    }
  }

  /**
   * Obtener el icono del rol de organización
   */
  getOrganizationRoleIcon(role: string | null): string {
    if (!role) return 'people-outline';
    switch (role.toLowerCase()) {
      case 'owner':
        return 'ribbon-outline';
      case 'admin':
        return 'shield-checkmark-outline';
      case 'moderator':
        return 'shield-checkmark-outline';
      case 'user':
        return 'people-outline';
      default:
        return 'people-outline';
    }
  }

  closeMenu() {
    this.menuCtrl.close();
  }

  async onLogout() {
    try {
      //Cerrar el menú primero
      await this.menuCtrl.close();
      //Hacer logout
      await this.authService.logout();

      //Navegar a la pantalla de login
      await this.router.navigateByUrl('/auth/login', {replaceUrl: true});  

    }catch (error) {
      console.error('Error during logout', error);
    }
  }

  /**
   * Abrir la gestión de usuarios
   */
  openUserManagement() {
    this.menuCtrl.close();
    this.router.navigate(['/admin/users']);  
  }

  getUserDisplayName(user: User | null): string {
    return getUserDisplayName(user);
  }

  getUserShortName(user: User | null): string {
    return getUserShortName(user);
  }

  /**
   * Obtener las iniciales del nombre para el avatar
   */
  getUserInitials(user: User | null): string {
    if (!user) return 'U';

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
}
