import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  IonSelect,
  IonSelectOption,
  ToastController,
  AlertController,
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
} from 'ionicons/icons';
import { AuthService } from 'src/app/auth/services/auth';
import { AuthorizationService } from 'src/app/auth/services/authorization.service';
import { OrganizationService } from '../../services/organization.service';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { User } from '../../models/user.model';
import { Organization } from '../../models/organization.model';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
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
export class MenuComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private authorizationService = inject(AuthorizationService);
  private organizationService = inject(OrganizationService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  currentUser$: Observable<User | null>;
  isDev$: Observable<boolean>;
  currentOrganization$: Observable<Organization | null>;
  userOrganizations$: Observable<Organization[]>;
  organizationRole$: Observable<'owner' | 'admin' | 'user' | null>;
  private roleChangeSubscription?: Subscription;

  constructor() {
    addIcons({
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
    });

    this.currentUser$ = this.authorizationService.getCurrentUser();
    this.isDev$ = this.authorizationService.isDev();
    this.currentOrganization$ =
      this.organizationService.getCurrentOrganization();
    this.userOrganizations$ = this.organizationService.getUserOrganizations();
    this.organizationRole$ =
      this.organizationService.getCurrentOrganizationRole();
  }

  ngOnInit() {
    // Escuchar eventos de cambio de rol
    window.addEventListener('roleChanged', this.onRoleChanged.bind(this));
    // Escuchar eventos de cambio de organización
    window.addEventListener(
      'organizationChanged',
      this.onOrganizationChanged.bind(this)
    );
  }

  ngOnDestroy() {
    // Limpiar listeners
    window.removeEventListener('roleChanged', this.onRoleChanged.bind(this));
    window.removeEventListener(
      'organizationChanged',
      this.onOrganizationChanged.bind(this)
    );
    if (this.roleChangeSubscription) {
      this.roleChangeSubscription.unsubscribe();
    }
  }

  private onRoleChanged(event: any) {
    console.log('🔄 Menu: Role change detected', event.detail);
    // Forzar actualización del observable
    this.currentUser$ = this.authorizationService.getCurrentUser();
    this.isDev$ = this.authorizationService.isDev();
    this.cdr.detectChanges();
  }

  private onOrganizationChanged(event: any) {
    console.log('🏢 Menu: Organization change detected', event.detail);
    // Forzar actualización de observables de organización
    this.currentOrganization$ =
      this.organizationService.getCurrentOrganization();
    this.organizationRole$ =
      this.organizationService.getCurrentOrganizationRole();
    this.cdr.detectChanges();
  }

  getRoleDisplayName(role: string): string {
    switch (role?.toLowerCase()) {
      case 'dev':
        return 'Desarrollador';
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
      case 'dev':
        return 'code-slash-outline';
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
      case 'dev':
        return 'role-dev';
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

  // Cambiar rol (solo disponible para DEV)
  async changeRole(newRole: 'dev' | 'admin' | 'user') {
    try {
      console.log(`🔄 Changing role to: ${newRole}`);
      this.authorizationService.setDevelopmentRole(newRole);

      const toast = await this.toastCtrl.create({
        message: `Rol cambiado a ${this.getRoleDisplayName(newRole)}`,
        duration: 2000,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
    } catch (error) {
      console.error('❌ Error changing role:', error);

      const toast = await this.toastCtrl.create({
        message: 'Error al cambiar el rol',
        duration: 3000,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    }
  }

  // === MÉTODOS DE ORGANIZACIÓN ===

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

                // Cambiar a la nueva organización
                this.organizationService.setCurrentOrganization(newOrg.id);

                const toast = await this.toastCtrl.create({
                  message: `Organización "${newOrg.name}" creada exitosamente`,
                  duration: 3000,
                  position: 'bottom',
                  color: 'success',
                });
                await toast.present();
              } catch (error) {
                console.error('❌ Error creating organization:', error);

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
    const alert = await this.alertCtrl.create({
      header: 'Invitar Usuario',
      message: 'Envía una invitación para unirse a tu organización',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'correo@ejemplo.com',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Enviar Invitación',
          handler: async (data) => {
            if (data.email?.trim()) {
              try {
                const currentOrg = await this.currentOrganization$
                  .pipe()
                  .toPromise();
                if (currentOrg) {
                  const invite = await this.organizationService.inviteUser(
                    currentOrg.id,
                    data.email.trim()
                  );

                  const toast = await this.toastCtrl.create({
                    message: `Invitación enviada a ${data.email}`,
                    duration: 3000,
                    position: 'bottom',
                    color: 'success',
                  });
                  await toast.present();
                }
              } catch (error) {
                console.error('❌ Error sending invite:', error);

                const toast = await this.toastCtrl.create({
                  message: 'Error al enviar la invitación',
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
   * Copiar código de invitación
   */
  async copyInviteCode() {
    try {
      const currentOrg = await this.currentOrganization$.pipe().toPromise();
      if (currentOrg) {
        await navigator.clipboard.writeText(currentOrg.code);

        const toast = await this.toastCtrl.create({
          message: `Código copiado: ${currentOrg.code}`,
          duration: 2000,
          position: 'bottom',
          color: 'success',
        });
        await toast.present();
      }
    } catch (error) {
      console.error('❌ Error copying code:', error);

      const toast = await this.toastCtrl.create({
        message: 'Error al copiar el código',
        duration: 2000,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    }
  }

  /**
   * Obtener el nombre del rol de organización
   */
  getOrganizationRoleDisplayName(role: string): string {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'Propietario';
      case 'admin':
        return 'Administrador';
      case 'user':
        return 'Miembro';
      default:
        return 'Miembro';
    }
  }

  /**
   * Obtener el icono del rol de organización
   */
  getOrganizationRoleIcon(role: string): string {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'ribbon-outline';
      case 'admin':
        return 'shield-checkmark-outline';
      case 'user':
        return 'people-outline';
      default:
        return 'people-outline';
    }
  }

  onLogout() {
    this.authService.logout();
    this.router.navigateByUrl('/auth', { replaceUrl: true });
  }
}
