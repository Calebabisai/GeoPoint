import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonText,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  colorPaletteOutline,
  navigateOutline,
} from 'ionicons/icons';
import { MarkerForm, ZoneForm, RouteForm, ToastColor } from '../../../shared/models/admin-panel.model';
import { FirestoreService } from '../../../services/firestore.service';
import { MapService } from '../../services/map.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ValidationService } from '../../../shared/services/validation.service';
import { MapMarker } from '../../../shared/models/marker.model';
import { MapZone } from '../../../shared/models/zone.model';
import { MapRoute } from '../../../shared/models/route.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
/**
 * @component AdminPanelComponent
 * @description
 * Panel de administración para crear y gestionar elementos del mapa.
 *
 * **Funcionalidades principales:**
 * - Crear marcadores mediante clicks en el mapa
 * - Crear zonas poligonales con múltiples puntos
 * - Crear rutas con waypoints
 * - Validación de formularios antes de guardar
 * - Sanitización de datos para prevenir XSS
 * - Gestión de estados de modo (agregar marker, zona, ruta)
 * - Cleanup automático de subscripciones
 *
 * **Flujo de trabajo:**
 * 1. Usuario hace click en "Agregar Marcador/Zona/Ruta"
 * 2. Componente entra en modo de captura de clicks
 * 3. Usuario hace clicks en el mapa
 * 4. Coordenadas se agregan al formulario
 * 5. Usuario completa datos y guarda
 * 6. Datos se validan y sanitizan
 * 7. Se persisten en Firestore
 * 8. Formulario se resetea
 *
 * @example
 * ```html
 * <app-admin-panel></app-admin-panel>
 * ```
 *
 * @standalone true
 * @imports CommonModule, FormsModule, Ionic Components
 *
 */
@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonIcon,
    IonText,
  ],
})

export class AdminPanelComponent {
  private readonly DEFAULT_COLOR = '#FF0000';
  private readonly DEFAULT_FILL_OPACITY = 0.3;
  private readonly DEFAULT_ROUTE_WIDTH = 3;
  private readonly MIN_ROUTE_WAYPOINTS = 2;
  private readonly TOAST_DURATION_MS = 3000;

  private readonly firestoreService = inject(FirestoreService);
  private readonly mapService = inject(MapService);
  private readonly authService = inject(AuthService);
  private readonly validationService = inject(ValidationService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);

  private readonly currentUser = this.authService.getCurrentUser();
  private readonly _zoneCounter = signal(1);
  private readonly _isAddingMarker = signal(false);
  private readonly _isAddingZone = signal(false);
  private readonly _isAddingRoute = signal(false);

  private readonly _newMarker = signal<MarkerForm>({
    title: '',
    description: '',
    lat: 0,
    lng: 0,
    color: this.DEFAULT_COLOR,
  });

  private readonly _newZone = signal<ZoneForm>({
    name: '',
    description: '',
    color: this.DEFAULT_COLOR,
    fillOpacity: this.DEFAULT_FILL_OPACITY,
    coordinates: [],
  });

  private readonly _newRoute = signal<RouteForm>({
    name: '',
    description: '',
    color: this.DEFAULT_COLOR,
    width: this.DEFAULT_ROUTE_WIDTH,
    waypoints: [],
  });

  readonly isAddingMarker = computed(() => this._isAddingMarker());
  readonly isAddingZone = computed(() => this._isAddingZone());
  readonly isAddingRoute = computed(() => this._isAddingRoute());

  readonly newMarker = computed(() => this._newMarker());
  readonly newZone = computed(() => this._newZone());
  readonly newRoute = computed(() => this._newRoute());

  readonly isAnyModeActive = computed(
    () => this._isAddingMarker() || this._isAddingZone() || this._isAddingRoute()
  );

  readonly canSaveMarker = computed(() => {
    const marker = this._newMarker();
    return marker.title.trim() !== '' && marker.lat !== 0 && marker.lng !== 0;
  });

  readonly canSaveZone = computed(() => {
    const zone = this._newZone();
    return zone.name.trim() !== '' && zone.coordinates.length >= 3;
  });

  readonly canSaveRoute = computed(() => {
    const route = this._newRoute();
    return (
      route.name.trim() !== '' &&
      route.waypoints.length >= this.MIN_ROUTE_WAYPOINTS
    );
  });

  constructor() {
    addIcons({ addOutline, colorPaletteOutline, navigateOutline });
    this.subscribeToMapClicks();
  }

  private subscribeToMapClicks(): void {
    this.mapService.mapClick$.pipe(takeUntilDestroyed()).subscribe((latlng) => {
      if (this._isAddingMarker() && latlng) {
        this._newMarker.update((marker) => ({
          ...marker,
          lat: latlng.lat,
          lng: latlng.lng,
        }));
      } else if (this._isAddingZone() && latlng) {
        this._newZone.update((zone) => ({
          ...zone,
          coordinates: [...zone.coordinates, [latlng.lat, latlng.lng]],
        }));
      } else if (this._isAddingRoute() && latlng) {
        this._newRoute.update((route) => ({
          ...route,
          waypoints: [...route.waypoints, [latlng.lat, latlng.lng]],
        }));
      }
    });
  }

  startAddingMarker(): void {
    this._isAddingMarker.set(true);
    this.resetOtherModes();
    this.showToast('Haz clic en el mapa para colocar el marcador', 'primary');
  }

  async saveMarker(): Promise<void> {
    const marker = this._newMarker();

    const validation = this.validationService.validateMarkerForm({
      title: marker.title,
      description: marker.description,
      lat: marker.lat,
      lng: marker.lng,
      color: marker.color,
    });

    if (!validation.valid) {
      this.showToast(validation.errors.join('. '), 'warning');
      return;
    }

    try {
      const user = this.currentUser(); 
      if (!user?.uid) {
        this.showToast('Usuario no autenticado', 'danger');
        return;
      }

      const titleValidation = this.validationService.validateTitle(marker.title);
      const descValidation = this.validationService.validateDescription(
        marker.description
      );

      const newMarker: Omit<MapMarker, 'id'> = {
        title: titleValidation.sanitized!,
        description: descValidation.sanitized!,
        lat: marker.lat,
        lng: marker.lng,
        color: marker.color,
        type: 'marker',
        createdBy: user.uid,
        organizationId: '',
        createdAt: new Date(),
      };

      await this.firestoreService.addMarker(newMarker);
      this.resetMarkerForm();
      this.showToast('Marcador agregado exitosamente', 'success');
    } catch (error) {
      this.showToast('Error al agregar marcador', 'danger');
    }
  }

  startAddingZone(): void {
    this._isAddingZone.set(true);
    this.resetOtherModes();
    this._newZone.update((zone) => ({ ...zone, coordinates: [] }));
    this.showToast(
      'Haz clic en el mapa para definir los puntos de la zona',
      'primary'
    );
  }

  async saveZone(): Promise<void> {
    const zone = this._newZone();

    const validation = this.validationService.validateZoneForm({
      name: zone.name,
      description: zone.description,
      coordinates: zone.coordinates,
      color: zone.color,
    });

    if (!validation.valid) {
      this.showToast(validation.errors.join('. '), 'warning');
      return;
    }

    try {
      const user = this.currentUser();
      if (!user?.uid) {
        this.showToast('Usuario no autenticado', 'danger');
        return;
      }

      const nameValidation = this.validationService.validateTitle(zone.name);
      const descValidation = this.validationService.validateDescription(
        zone.description
      );

      const newZone: Omit<MapZone, 'id'> = {
        name: nameValidation.sanitized!,
        description: descValidation.sanitized!,
        coordinates: zone.coordinates.map((coord) => ({
          lat: coord[0],
          lng: coord[1],
        })),
        color: zone.color,
        number: this.getNextZoneNumber(),
        type: 'zone',
        createdBy: user.uid,
        organizationId: '',
        createdAt: new Date(),
      };

      await this.firestoreService.addZone(newZone);
      this.resetZoneForm();
      this.showToast('Zona agregada exitosamente', 'success');
    } catch (error) {
      this.showToast('Error al agregar zona', 'danger');
    }
  }

  startAddingRoute(): void {
    this._isAddingRoute.set(true);
    this.resetOtherModes();
    this._newRoute.update((route) => ({ ...route, waypoints: [] }));
    this.showToast(
      'Haz clic en el mapa para definir los puntos de la ruta',
      'primary'
    );
  }

  async saveRoute(): Promise<void> {
    const route = this._newRoute();

    if (!route.name || route.waypoints.length < this.MIN_ROUTE_WAYPOINTS) {
      this.showToast('Ingresa un nombre y define al menos 2 puntos', 'warning');
      return;
    }

    try {
      const user = this.currentUser();
      if (!user?.uid) {
        this.showToast('Usuario no autenticado', 'danger');
        return;
      }

      const newRoute: Omit<MapRoute, 'id'> = {
        name: route.name,
        description: route.description,
        waypoints: route.waypoints,
        color: route.color,
        width: route.width,
        createdBy: user.uid,
        createdAt: new Date(),
      };

      await this.firestoreService.addRoute(newRoute);
      this.resetRouteForm();
      this.showToast('Ruta agregada exitosamente', 'success');
    } catch (error) {
      this.showToast('Error al agregar ruta', 'danger');
    }
  }

  cancelCurrentAction(): void {
    this.resetAllModes();
    this.showToast('Acción cancelada', 'medium');
  }

  updateMarkerTitle(title: string): void {
    this._newMarker.update((marker) => ({ ...marker, title }));
  }

  updateMarkerDescription(description: string): void {
    this._newMarker.update((marker) => ({ ...marker, description }));
  }

  updateMarkerColor(color: string): void {
    this._newMarker.update((marker) => ({ ...marker, color }));
  }

  updateZoneName(name: string): void {
    this._newZone.update((zone) => ({ ...zone, name }));
  }

  updateZoneDescription(description: string): void {
    this._newZone.update((zone) => ({ ...zone, description }));
  }

  updateZoneColor(color: string): void {
    this._newZone.update((zone) => ({ ...zone, color }));
  }

  updateRouteName(name: string): void {
    this._newRoute.update((route) => ({ ...route, name }));
  }

  updateRouteDescription(description: string): void {
    this._newRoute.update((route) => ({ ...route, description }));
  }

  updateRouteColor(color: string): void {
    this._newRoute.update((route) => ({ ...route, color }));
  }

  updateRouteWidth(width: number): void {
    this._newRoute.update((route) => ({ ...route, width }));
  }

  private resetOtherModes(): void {
    if (this._isAddingMarker()) this._isAddingMarker.set(false);
    if (this._isAddingZone()) this._isAddingZone.set(false);
    if (this._isAddingRoute()) this._isAddingRoute.set(false);
  }

  private resetAllModes(): void {
    this._isAddingMarker.set(false);
    this._isAddingZone.set(false);
    this._isAddingRoute.set(false);
  }

  private resetMarkerForm(): void {
    this._newMarker.set({
      title: '',
      description: '',
      lat: 0,
      lng: 0,
      color: this.DEFAULT_COLOR,
    });
    this._isAddingMarker.set(false);
  }

  private resetZoneForm(): void {
    this._newZone.set({
      name: '',
      description: '',
      color: this.DEFAULT_COLOR,
      fillOpacity: this.DEFAULT_FILL_OPACITY,
      coordinates: [],
    });
    this._isAddingZone.set(false);
  }

  private resetRouteForm(): void {
    this._newRoute.set({
      name: '',
      description: '',
      color: this.DEFAULT_COLOR,
      width: this.DEFAULT_ROUTE_WIDTH,
      waypoints: [],
    });
    this._isAddingRoute.set(false);
  }

  private getNextZoneNumber(): number {
    const current = this._zoneCounter();
    this._zoneCounter.set(current + 1);
    return current;
  }

  private async showToast(message: string, color: ToastColor): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: this.TOAST_DURATION_MS,
      color,
      position: 'top',
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

  async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }
}
