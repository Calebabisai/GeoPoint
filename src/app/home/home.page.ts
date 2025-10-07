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
  mail,
  pinOutline,
  shapesOutline,
} from 'ionicons/icons';
import { MapViewComponent } from '../map/components/map-view/map-view.component';
import { GeolocationService } from '../map/services/geolocation.service';
import { FirestoreService } from '../services/firestore.service';
import { AuthService } from '../auth/services/auth.service';
import { AuthorizationService } from '../auth/services/authorization.service';
import { MapDataService } from '../shared/services/map-data.service';
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
  private mapDataService = inject(MapDataService);
  private menuController = inject(MenuController);
  private modalController = inject(ModalController);
  private toastController = inject(ToastController);
  private router = inject(Router);

  // Propiedades del componente
  isAdmin = false;
  userRole: 'admin' | 'user' | null = null;
  currentUserEmail: string | null = null;
  locationWatching = false;

  // Contadores para el dashboard
  markersCount = 0;
  zonesCount = 0;

  // Observables
  userRole$!: Observable<'admin' | 'user' | null>;

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
      mail,
      pinOutline,
      shapesOutline,
    });

    // Inicializar observables
    this.userRole$ = this.authorizationService.getCurrentUserRole();
  }

  ngOnInit() {
    console.log('🏠 HomePage initialized');
    this.loadUserData();
    this.initializeLocation();
    this.setupUserRoleSubscription();
    this.loadDashboardData();
  }

  ngOnDestroy() {
    console.log('🧹 HomePage destroyed - cleaning up');
    this.subscriptions.unsubscribe();
    this.geolocationService.stopWatching();
  }

  private setupUserRoleSubscription() {
    const roleSub = this.userRole$.subscribe((role) => {
      this.userRole = role;
      this.isAdmin = role === 'admin';
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

    // Auto-centrar mapa en ubicación del usuario al abrir la app
    this.startLocationTracking();
  }

  private async startLocationTracking() {
    try {
      console.log('🚀 Auto-centering map on user location at startup...');

      // Esperar un momento para que el mapa esté completamente cargado
      setTimeout(async () => {
        try {
          // Centrar automáticamente en la ubicación del usuario al abrir la app
          await this.geolocationService.centerMapOnUserLocation();
          console.log('✅ App automatically centered on user location');

          // Mostrar notificación de éxito
          this.showToast('📍 Mapa centrado en tu ubicación', 'success');
        } catch (error) {
          console.log('ℹ️ Could not auto-center map - GPS may be disabled');
          // No mostrar error al usuario para no ser molesto
        }
      }, 2000); // Delay de 2 segundos para asegurar que todo esté cargado
    } catch (error) {
      console.error('❌ Error in auto-location startup:', error);
    }
  }

  private loadUserData() {
    this.authService.getCurrentUser().subscribe((user: User | null) => {
      this.isAdmin = !!(user && user.role === 'admin');
    });
  }

  private loadDashboardData() {
    console.log('📊 Loading dashboard data...');

    // Cargar contadores de marcadores
    const markersSub = this.mapDataService.getMarkers().subscribe({
      next: (markers) => {
        console.log('📍 Dashboard: Received markers:', markers.length);
        this.markersCount = markers.length;
      },
      error: (error) => {
        console.error('❌ Dashboard: Error loading markers:', error);
      },
    });

    // Cargar contadores de zonas
    const zonesSub = this.mapDataService.getZones().subscribe({
      next: (zones) => {
        console.log('🏗️ Dashboard: Received zones:', zones.length);
        this.zonesCount = zones.length;
      },
      error: (error) => {
        console.error('❌ Dashboard: Error loading zones:', error);
      },
    });

    this.subscriptions.add(markersSub);
    this.subscriptions.add(zonesSub);
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
    console.log('🎯 Recentering map on user location (high precision mode)...');

    try {
      // Mostrar indicador de carga
      this.showToast('🔍 Obteniendo ubicación precisa...', 'warning');

      // Usar método de alta precisión para respuesta inmediata y precisa
      await this.geolocationService.centerMapOnUserLocation();

      // Asegurar que el tracking esté activo después de obtener ubicación precisa
      if (!this.locationWatching) {
        console.log(
          '📍 Starting location tracking after high precision fix...'
        );
        await this.geolocationService.startWatching();
      }

      this.showToast('✅ Ubicación actualizada con precisión GPS', 'success');
    } catch (error) {
      console.error('❌ Error recentering map:', error);
      this.showToast('❌ No se pudo obtener ubicación GPS precisa', 'danger');
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success'
  ) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'top',
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

  async navigateToInvitations() {
    await this.closeMenu();
    this.router.navigate(['/admin/invitations']);
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
      admin: 'Administrador',
      user: 'Usuario',
    };
    return roleNames[role as keyof typeof roleNames] || role;
  }

  getRoleColor(role: string): string {
    const roleColors = {
      admin: 'primary',
      user: 'medium',
    };
    return roleColors[role as keyof typeof roleColors] || 'medium';
  }
}
