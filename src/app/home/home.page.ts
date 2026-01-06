import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
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
   IonFooter,
  IonTitle,
  ModalController,
  MenuController,
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
  shapesOutline, refreshOutline } from 'ionicons/icons';
import { MapViewComponent } from '../map/components/map-view/map-view.component';
import { GeolocationService } from '../map/services/geolocation.service';
import { UiService } from '../shared/services/ui.service';
import { AuthService } from '../auth/services/auth.service';
import { AuthorizationService } from '../auth/services/authorization.service';
import { MapDataService } from '../shared/services/map-data.service';
import { AdminPanelComponent } from '../map/components/admin-panel/admin-panel.component';

// Constants
const MAP_CENTER_DELAY_MS = 2000;
const ROLE_NAMES = {
  admin: 'Administrador',
  user: 'Usuario',
} as const;

const ROLE_COLORS = {
  admin: 'primary',
  user: 'medium',
} as const;

type UserRole = 'admin' | 'user' | null;

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
    IonFooter,
    IonTitle,
    MapViewComponent,
  ],
})
export class HomePage {
  private readonly geolocationService = inject(GeolocationService);
  private readonly authService = inject(AuthService);
  private readonly authorizationService = inject(AuthorizationService);
  private readonly mapDataService = inject(MapDataService);
  private readonly menuController = inject(MenuController);
  private readonly modalController = inject(ModalController);
  private readonly uiService = inject(UiService);
  private readonly router = inject(Router);

  // Signals from services (already signals, no toSignal needed)
  readonly userRole = this.authorizationService.currentUserRole;
  readonly currentUser = this.authService.currentUser;
  readonly locationWatching = this.geolocationService.isWatching;
  readonly currentLocation = this.geolocationService.currentLocation;

  // Local signals (toSignal for Observables)
  private readonly _markers = toSignal(this.mapDataService.getMarkers(), {
    initialValue: [],
  });
  private readonly _zones = toSignal(this.mapDataService.getZones(), {
    initialValue: [],
  });

  // Computed signals
  readonly isAdmin = computed(() => this.userRole() === 'admin');
  readonly currentUserEmail = computed(() => this.currentUser()?.email ?? null);
  readonly markersCount = computed(() => this._markers().length);
  readonly zonesCount = computed(() => this._zones().length);
  readonly hasLocation = computed(() => !!this.currentLocation());
  readonly roleDisplayName = computed(() => {
    const role = this.userRole();
    return role ? this.getRoleDisplayName(role) : '';
  });
  readonly roleColor = computed(() => {
    const role = this.userRole();
    return role ? this.getRoleColor(role) : 'medium';
  });

  constructor() {
    addIcons({locationOutline,shieldCheckmark,people,chevronForward,business,mail,
      analytics,mapOutline,layersOutline,settingsOutline,settings,personCircle,
      logOutOutline,menuOutline,pinOutline,shapesOutline,refreshOutline,peopleOutline,
      codeSlash,person,});

    // Auto-initialize location tracking
    this.initializeLocation();

    // Auto-center map on startup
    this.autoCenterMapOnStartup();
  }

  private initializeLocation(): void {
    // No need for manual subscription - we use toSignal for reactive state
    // Location watching starts automatically via GeolocationService initialization
  }

  private autoCenterMapOnStartup(): void {
    setTimeout(async () => {
      try {
        await this.geolocationService.centerMapOnUserLocation();
        await this.showSuccess('Mapa centrado en tu ubicación');
      } catch (error) {
        // Silent fail - don't annoy user if GPS is disabled
      }
    }, MAP_CENTER_DELAY_MS);
  }

  async openAdminPanel(): Promise<void> {
    if (!this.isAdmin()) return;

    const modal = await this.modalController.create({
      component: AdminPanelComponent,
      presentingElement: await this.modalController.getTop(),
    });
    await modal.present();
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  } 
  /**
 * Refresca completamente el mapa y todos sus datos
 * - Recentra el mapa en la ubicación actual
 * - Actualiza la ubicación GPS
 * - Recarga marcadores y zonas
 * - Reinicia el tracking de ubicación si está detenido
 */
async refreshAll(): Promise<void> {
  try {
    // Mostrar indicador de carga
    await this.uiService.showLoading('Actualizando...');
    
    // 1. Obtener ubicación precisa actualizada
    await this.geolocationService.centerMapOnUserLocation();
    
    // 2. Asegurar que el tracking está activo
    if (!this.locationWatching()) {
      await this.geolocationService.startWatching();
    }
    
    // 3. Forzar recarga de marcadores y zonas desde Firestore
    // Los observables en MapDataService se recargarán automáticamente
    // cuando el servicio detecte cambios en la organización
    
    // 4. Pequeño delay para asegurar que todo se actualice
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Ocultar indicador de carga
    await this.uiService.hideLoading();
    
    // Mostrar mensaje de éxito
    await this.showSuccess('Mapa actualizado correctamente');
    
  } catch (error) {
    await this.uiService.hideLoading();
    console.error('Error al refrescar:', error);
    await this.showError('No se pudo actualizar completamente. Verifica tu conexión');
  }
}
 /**
  * @deprecated Usa refreshAll() en su lugar
  */
  async recenterMap(): Promise<void> {
    try {
      await this.showWarning('Obteniendo ubicación precisa...');
      await this.geolocationService.centerMapOnUserLocation();

      // Ensure tracking is active after high precision fix
      if (!this.locationWatching()) {
        await this.geolocationService.startWatching();
      }

      await this.showSuccess('Ubicación actualizada con precisión GPS');
    } catch (error) {
      await this.showError('No se pudo obtener ubicación GPS precisa');
    }
  }

  async openMenu(): Promise<void> {
    await this.menuController.open();
  }

  async closeMenu(): Promise<void> {
    await this.menuController.close();
  }

  // Navigation methods
  async navigateToUserManagement(): Promise<void> {
    await this.closeMenu();
    this.router.navigate(['/admin/users']);
  }

  async navigateToOrganizations(): Promise<void> {
    await this.closeMenu();
    await this.showWarning('Funcionalidad en desarrollo');
  }

  async navigateToInvitations(): Promise<void> {
    await this.closeMenu();
    this.router.navigate(['/admin/invitations']);
  }

  async viewAnalytics(): Promise<void> {
    await this.closeMenu();
    await this.showWarning('Análisis y reportes - Próximamente');
  }

  async toggleMapLayers(): Promise<void> {
    await this.closeMenu();
    await this.showWarning('Configuración de capas - Próximamente');
  }

  async openSettings(): Promise<void> {
    await this.closeMenu();
    await this.showWarning('Configuración - Próximamente');
  }

  async showProfile(): Promise<void> {
    await this.closeMenu();
    await this.showWarning('Perfil de usuario - Próximamente');
  }

  // Utility methods
  getRoleDisplayName(role: UserRole): string {
    if (!role) return '';
    return ROLE_NAMES[role] || role;
  }

  getRoleColor(role: UserRole): string {
    if (!role) return 'medium';
    return ROLE_COLORS[role] || 'medium';
  }

  // Toast helpers
  private async showSuccess(message: string): Promise<void> {
    await this.uiService.showSuccess(message);
  }

  private async showError(message: string): Promise<void> {
    await this.uiService.showError(message);
  }

  private async showWarning(message: string): Promise<void> {
    await this.uiService.showWarning(message);
  }


}
