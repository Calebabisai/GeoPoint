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
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
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
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonRefresher,
  IonRefresherContent,
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
} from 'ionicons/icons';
import { Observable, Subscription, BehaviorSubject, combineLatest } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthorizationService } from '../../../auth/services/authorization.service';
import {
  UserManagementService,
  UserWithOrganization,
} from '../../services/user-management.service';
import { OrganizationService } from '../../../shared/services/organization.service';

type UserFilter = 'all' | 'admins' | 'users' | 'without-org' | 'online';

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
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
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
    IonGrid,
    IonRow,
    IonCol,
    IonChip,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
  ],
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private userManagementService = inject(UserManagementService);
  private authorizationService = inject(AuthorizationService);
  private organizationService = inject(OrganizationService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private actionSheetController = inject(ActionSheetController);
  private router = inject(Router);

  // Observables
  users$!: Observable<UserWithOrganization[]>;
  filteredUsers$!: Observable<UserWithOrganization[]>;
  userStats$!: Observable<any>;
  recentActivity$!: Observable<UserWithOrganization[]>;

  // Estado del componente
  selectedFilter: UserFilter = 'all';
  searchTerm$ = new BehaviorSubject<string>('');
  isLoading = true;
  isRefreshing = false;

  // Suscripciones
  private subscriptions = new Subscription();

  constructor() {
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
    });
  }

  async ngOnInit() {
    await this.initializeData();
    this.setupObservables();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private async initializeData() {
    try {
      // Verificar permisos
      const hasPermission = await this.authorizationService
        .hasPermission('manage-users')
        .toPromise();

      if (!hasPermission) {
        await this.showToast(
          'No tienes permisos para acceder a esta sección',
          'danger'
        );
        this.router.navigate(['/home']);
        return;
      }

      // Cargar usuarios
      await this.userManagementService.getAllUsers();
      this.isLoading = false;
    } catch (error) {
      console.error('Error initializing user management:', error);
      await this.showToast('Error al cargar los datos de usuarios', 'danger');
      this.isLoading = false;
    }
  }

  private setupObservables() {
    // Usuario base
    this.users$ = this.userManagementService.users$;

    // Estadísticas
    this.userStats$ = this.userManagementService.getUserStats();

    // Actividad reciente
    this.recentActivity$ = this.userManagementService.getRecentUserActivity();

    // Usuarios filtrados
    this.filteredUsers$ = combineLatest([
      this.users$,
      this.searchTerm$.pipe(debounceTime(300), distinctUntilChanged()),
    ]).pipe(
      map(([users, searchTerm]) => {
        let filtered = users;

        // Aplicar filtro por tipo
        switch (this.selectedFilter) {
          case 'admins':
            filtered = users.filter(
              (u) => u.role === 'admin' || u.role === 'dev'
            );
            break;
          case 'users':
            filtered = users.filter((u) => u.role === 'user');
            break;
          case 'without-org':
            filtered = users.filter((u) => !u.organizationId);
            break;
          case 'online':
            filtered = users.filter((u) => u.isOnline);
            break;
          default:
            filtered = users;
        }

        // Aplicar búsqueda
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          filtered = filtered.filter(
            (user) =>
              user.email?.toLowerCase().includes(term) ||
              user.organizationName?.toLowerCase().includes(term)
          );
        }

        return filtered.sort((a, b) => {
          // Ordenar por: online primero, luego por role, luego por fecha
          if (a.isOnline !== b.isOnline) {
            return a.isOnline ? -1 : 1;
          }

          const roleOrder: Record<string, number> = {
            dev: 0,
            admin: 1,
            user: 2,
          };
          if (a.role !== b.role) {
            return (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
          }

          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      })
    );
  }

  // Manejo de eventos
  onFilterChange(event: any) {
    this.selectedFilter = event.detail.value;
  }

  onSearchInput(event: any) {
    this.searchTerm$.next(event.target.value || '');
  }

  async onRefresh(event: RefresherCustomEvent) {
    this.isRefreshing = true;
    try {
      await this.userManagementService.getAllUsers();
      await this.showToast('Lista de usuarios actualizada', 'success');
    } catch (error) {
      await this.showToast('Error al actualizar la lista', 'danger');
    } finally {
      this.isRefreshing = false;
      event.target.complete();
    }
  }

  async onRefreshButtonClick() {
    try {
      this.isLoading = true;
      await this.userManagementService.getAllUsers();
      await this.showToast('Lista de usuarios actualizada', 'success');
    } catch (error) {
      await this.showToast('Error al actualizar la lista', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // Acciones de usuario
  async showUserActions(user: UserWithOrganization) {
    const currentUser = await this.authorizationService
      .getCurrentUser()
      .toPromise();
    const isCurrentUser = currentUser?.uid === user.uid;

    const actionSheet = await this.actionSheetController.create({
      header: `Gestionar: ${user.email}`,
      subHeader: `Rol actual: ${this.getRoleDisplayName(user.role)}`,
      buttons: [
        {
          text: 'Ver Detalles',
          icon: 'eye',
          handler: () => this.viewUserDetails(user),
        },
        ...(user.role !== 'dev' && !isCurrentUser
          ? [
              {
                text: 'Cambiar Rol',
                icon: 'swap-horizontal',
                handler: () => this.showRoleChangeOptions(user),
              },
            ]
          : []),
        ...(user.organizationId
          ? [
              {
                text: 'Remover de Organización',
                icon: 'business',
                handler: () => this.removeFromOrganization(user),
              },
            ]
          : [
              {
                text: 'Asignar a Organización',
                icon: 'personAdd',
                handler: () => this.assignToOrganization(user),
              },
            ]),
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  async showRoleChangeOptions(user: UserWithOrganization) {
    const currentUser = await this.authorizationService
      .getCurrentUser()
      .toPromise();
    const isCurrentUser = currentUser?.uid === user.uid;

    if (isCurrentUser) {
      await this.showToast('No puedes cambiar tu propio rol', 'warning');
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: 'Cambiar Rol de Usuario',
      subHeader: `Usuario: ${user.email}`,
      buttons: [
        ...(user.role !== 'admin'
          ? [
              {
                text: 'Promover a Administrador',
                icon: 'shieldCheckmark',
                cssClass: 'action-promote',
                handler: () => this.changeUserRole(user, 'admin'),
              },
            ]
          : []),
        ...(user.role !== 'user'
          ? [
              {
                text: 'Cambiar a Usuario Regular',
                icon: 'person',
                cssClass: 'action-demote',
                handler: () => this.changeUserRole(user, 'user'),
              },
            ]
          : []),
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  async changeUserRole(user: UserWithOrganization, newRole: 'admin' | 'user') {
    const alert = await this.alertController.create({
      header: 'Confirmar Cambio de Rol',
      subHeader: `${user.email}`,
      message: `¿Estás seguro de cambiar el rol de este usuario a ${this.getRoleDisplayName(
        newRole
      )}?`,
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Razón del cambio (opcional)',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Confirmar',
          cssClass: 'confirm-button',
          handler: async (data) => {
            try {
              await this.userManagementService.changeUserRole(
                user.uid,
                newRole,
                data.reason
              );

              await this.showToast(
                `Rol actualizado a ${this.getRoleDisplayName(newRole)}`,
                'success'
              );
            } catch (error) {
              console.error('Error changing user role:', error);
              await this.showToast(
                'Error al cambiar el rol del usuario',
                'danger'
              );
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async assignToOrganization(user: UserWithOrganization) {
    // TODO: Implementar selector de organización
    await this.showToast('Funcionalidad en desarrollo', 'warning');
  }

  async removeFromOrganization(user: UserWithOrganization) {
    const alert = await this.alertController.create({
      header: 'Remover de Organización',
      subHeader: `${user.email}`,
      message: `¿Remover este usuario de "${user.organizationName}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Remover',
          cssClass: 'danger-button',
          handler: async () => {
            try {
              await this.userManagementService.removeUserFromOrganization(
                user.uid
              );
              await this.showToast(
                'Usuario removido de la organización',
                'success'
              );
            } catch (error) {
              console.error('Error removing user from organization:', error);
              await this.showToast('Error al remover usuario', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  viewUserDetails(user: UserWithOrganization) {
    // TODO: Navegar a página de detalles del usuario
    console.log('View user details:', user);
  }

  // Utilidades
  getRoleDisplayName(role: string): string {
    const roleNames = {
      dev: 'Desarrollador',
      admin: 'Administrador',
      user: 'Usuario',
    };
    return roleNames[role as keyof typeof roleNames] || role;
  }

  getRoleColor(role: string): string {
    const roleColors = {
      dev: 'danger',
      admin: 'warning',
      user: 'primary',
    };
    return roleColors[role as keyof typeof roleColors] || 'medium';
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays}d`;
  }

  trackByUserId(index: number, user: UserWithOrganization): string {
    return user.uid;
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
