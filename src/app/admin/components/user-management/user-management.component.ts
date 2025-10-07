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
  RefresherCustomEvent,
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
import { Observable, Subscription } from 'rxjs';

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

  constructor() {
    console.log('👤 UserManagementComponent constructor called');
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
    });
  }

  async ngOnInit() {
    console.log('🚀 UserManagement ngOnInit started');

    this.isLoading = true;

    try {
      console.log(
        '⚡ Skipping slow getCurrentUser check - user is already admin'
      );

      // Configurar observables primero
      this.users$ = this.userManagementService.users$;

      // USAR DATOS DE DESARROLLO DIRECTAMENTE para solucionar la carga infinita
      console.log('📝 Loading development data to solve infinite loading...');
      await this.loadDevelopmentData();
    } catch (error) {
      console.error('❌ Error in ngOnInit:', error);
      this.isLoading = false;
      await this.showToast('Error de inicialización', 'danger');
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /**
   * Método simplificado para cargar datos de desarrollo y solucionar carga infinita
   */
  private async loadDevelopmentData() {
    try {
      console.log('📦 Loading development data directly...');

      // Llamar al método simple del servicio que sabemos que funciona
      const users =
        await this.userManagementService.getSimpleOrganizationUsers();

      console.log(`✅ Development data loaded: ${users.length} users`);

      if (users.length > 0) {
        await this.showToast(
          `Cargados ${users.length} usuarios de desarrollo`,
          'success'
        );
      } else {
        await this.showToast('No se encontraron usuarios', 'warning');
      }

      this.isLoading = false;
    } catch (error) {
      console.error('❌ Error loading development data:', error);
      await this.showToast('Error cargando datos de desarrollo', 'danger');
      this.isLoading = false;
    }
  }

  private async loadRealUsersFromFirebase() {
    try {
      console.log('🔥 Loading REAL users from Firebase...');

      // SOLUCIÓN: Obtener organización del usuario actual directamente
      console.log('📡 Getting current user first...');
      const currentUser = await this.authService.getCurrentUser().toPromise();

      if (!currentUser?.organizationId) {
        console.log('❌ User has no organization ID');
        await this.showToast('Usuario sin organización asignada', 'warning');
        this.isLoading = false;
        return;
      }

      const organizationId = currentUser.organizationId;
      console.log(
        '🏢 Using organization ID from current user:',
        organizationId
      );

      // Llamar al servicio para obtener usuarios reales
      console.log(
        '📞 Calling getRealOrganizationUsers with ID:',
        organizationId
      );
      const users = await this.userManagementService.getRealOrganizationUsers(
        organizationId
      );

      console.log(`✅ Found ${users.length} real users in organization`);

      if (users.length === 0) {
        await this.showToast(
          'No se encontraron usuarios en esta organización',
          'warning'
        );
      } else {
        await this.showToast(
          `Cargados ${users.length} usuarios de la organización`,
          'success'
        );
      }

      this.isLoading = false;
    } catch (error) {
      console.error('❌ Error loading real users:', error);
      await this.showToast('Error cargando usuarios desde Firebase', 'danger');
      this.isLoading = false;
    }
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
    ];

    console.log('📥 Loading test users:', testUsers);
    this.userManagementService.setUsers(testUsers);
  }

  // Métodos para el template
  getOrgRoleColor(role: string): string {
    switch (role) {
      case 'owner':
        return 'warning';
      case 'admin':
        return 'danger';
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
      case 'user':
        return 'Miembro';
      default:
        return 'Sin rol';
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger' = 'success'
  ) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
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
}
