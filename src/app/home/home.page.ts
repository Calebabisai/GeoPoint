import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonFabButton,
  IonIcon,
  IonButton,
  IonButtons,
  IonMenu,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonFooter,
  IonTitle,
  ModalController,
  MenuController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  settingsOutline,
  logOutOutline,
  locationOutline,
  menuOutline,
  peopleOutline,
  people,
  business,
  analytics,
  mapOutline,
  layersOutline,
  settings,
  personCircle,
  chevronForward,
  codeSlash,
  shieldCheckmark,
  person,
} from 'ionicons/icons';
import { MapViewComponent } from '../map/components/map-view/map-view.component';
import { GeolocationService } from '../map/services/geolocation.service';
import { FirestoreService } from '../services/firestore.service';
import { AuthService } from '../auth/services/auth.service';
import { AuthorizationService } from '../auth/services/authorization.service';
import { User } from '../shared/models/user.model';
import { AdminPanelComponent } from '../map/components/admin-panel/admin-panel.component';
import { Subscription, Observable } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonFabButton,
    IonIcon,
    IonButton,
    IonButtons,
    IonMenu,
    IonList,
    IonItem,
    IonLabel,
    IonChip,
    IonFooter,
    IonTitle,
    MapViewComponent,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  private geolocationService = inject(GeolocationService);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private authorizationService = inject(AuthorizationService);
  private menuController = inject(MenuController);
  private modalController = inject(ModalController);
  private toastController = inject(ToastController);
  private router = inject(Router);

  // Propiedades del componente
  isAdmin = false;
  userRole: 'dev' | 'admin' | 'user' | null = null;
  currentUserEmail: string | null = null;
  locationWatching = false;

  // Observables
  userRole$!: Observable<'dev' | 'admin' | 'user' | null>;

  // Suscripciones
  private subscriptions = new Subscription();

  constructor() {
    addIcons({
      settingsOutline,
      logOutOutline,
      locationOutline,
      menuOutline,
      peopleOutline,
      people,
      business,
      analytics,
      mapOutline,
      layersOutline,
      settings,
      personCircle,
      chevronForward,
      codeSlash,
      shieldCheckmark,
      person,
    });

    // Inicializar observables
    this.userRole$ = this.authorizationService.getCurrentUserRole();
  }

  ngOnInit() {
    console.log('🏠 HomePage initialized');
    this.loadUserData();
    this.initializeLocation();
    this.setupUserRoleSubscription();
  }

  ngOnDestroy() {
    console.log('🧹 HomePage destroyed - cleaning up');
    this.subscriptions.unsubscribe();
    this.geolocationService.stopWatching();
  }

  private setupUserRoleSubscription() {
    const roleSub = this.userRole$.subscribe((role) => {
      this.userRole = role;
      this.isAdmin = role === 'admin' || role === 'dev';
    });

    const userSub = this.authService.getCurrentUser().subscribe((user) => {
      this.currentUserEmail = user?.email || null;
    });

    this.subscriptions.add(roleSub);
    this.subscriptions.add(userSub);
  }

  private initializeLocation() {
    // Suscribirse al estado de seguimiento de ubicación
    const watchingSub = this.geolocationService.watchingLocation$.subscribe(
      (watching: boolean) => {
        this.locationWatching = watching;
        console.log('📍 Location watching status:', watching);
      }
    );

    // Suscribirse a cambios de ubicación
    const locationSub = this.geolocationService.currentLocation$.subscribe(
      (location: any) => {
        if (location) {
          console.log('📍 User location updated:', location);
        }
      }
    );

    this.subscriptions.add(watchingSub);
    this.subscriptions.add(locationSub);

    // Iniciar seguimiento automático de ubicación al cargar la app
    this.startLocationTracking();
  }

  private async startLocationTracking() {
    try {
      console.log('🚀 Starting automatic location tracking...');
      await this.geolocationService.startWatching();

      // Centrar mapa en ubicación actual
      setTimeout(() => {
        this.geolocationService.centerMapOnUserLocation();
      }, 1000);
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      this.showLocationError();
    }
  }

  private loadUserData() {
    this.authService.getCurrentUser().subscribe((user: User | null) => {
      this.isAdmin = !!(user && user.role === 'admin');
    });
  }

  async openAdminPanel() {
    if (!this.isAdmin) return;
    const modal = await this.modalController.create({
      component: AdminPanelComponent,
      presentingElement: await this.modalController.getTop(),
    });
    await modal.present();
  }

  async logout() {
    await this.authService.logout();
  }

  async recenterMap() {
    console.log('🎯 Recentering map on user location...');

    try {
      await this.geolocationService.centerMapOnUserLocation();
      this.showToast('📍 Mapa centrado en tu ubicación', 'success');
    } catch (error) {
      console.error('❌ Error recentering map:', error);
      this.showToast('❌ No se pudo obtener tu ubicación', 'danger');
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success'
  ) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

  private async showLocationError() {
    await this.showToast(
      '❌ No se pudo acceder a tu ubicación. Verifica los permisos.',
      'danger'
    );
  }

  async openMenu() {
    await this.menuController.open();
  }

  // Métodos para el menú lateral
  async closeMenu() {
    await this.menuController.close();
  }

  async navigateToUserManagement() {
    await this.closeMenu();
    this.router.navigate(['/admin/users']);
  }

  async navigateToOrganizations() {
    await this.closeMenu();
    this.showToast('Funcionalidad en desarrollo', 'warning');
  }

  async viewAnalytics() {
    await this.closeMenu();
    this.showToast('Análisis y reportes - Próximamente', 'warning');
  }

  async toggleMapLayers() {
    await this.closeMenu();
    this.showToast('Configuración de capas - Próximamente', 'warning');
  }

  async openSettings() {
    await this.closeMenu();
    this.showToast('Configuración - Próximamente', 'warning');
  }

  async showProfile() {
    await this.closeMenu();
    this.showToast('Perfil de usuario - Próximamente', 'warning');
  }

  // Métodos utilitarios
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
}
