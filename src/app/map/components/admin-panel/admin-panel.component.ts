import { Component, inject, OnDestroy } from '@angular/core';
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
import { Subscription } from 'rxjs';
import { FirestoreService } from '../../../services/firestore.service';
import { MapService } from '../../services/map.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ValidationService } from '../../../shared/services/validation.service';
import { MapMarker } from '../../../shared/models/marker.model';
import { MapZone } from '../../../shared/models/zone.model';
import { MapRoute } from '../../../shared/models/route.model';

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
export class AdminPanelComponent implements OnDestroy {
  private firestoreService = inject(FirestoreService);
  private mapService = inject(MapService);
  private authService = inject(AuthService);
  private validationService = inject(ValidationService);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  // ✅ Subscripción para cleanup
  private subscriptions = new Subscription();

  // Contador para números de zona
  private zoneCounter = 1;

  newMarker = {
    title: '',
    description: '',
    lat: 0,
    lng: 0,
    color: '#FF0000',
  };
  newZone = {
    name: '',
    description: '',
    color: '#FF0000',
    fillOpacity: 0.3,
    coordinates: [] as [number, number][],
  };
  newRoute = {
    name: '',
    description: '',
    color: '#FF0000',
    width: 3,
    waypoints: [] as [number, number][],
  };
  isAddingMarker = false;
  isAddingZone = false;
  isAddingRoute = false;

  constructor() {
    addIcons({ addOutline, colorPaletteOutline, navigateOutline });
    this.subscribeToMapClicks();
  }

  // ✅ Cleanup de suscripciones al destruir el componente
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private subscribeToMapClicks() {
    // ✅ Agregar suscripción a la cola para cleanup automático
    this.subscriptions.add(
      this.mapService.mapClick$.subscribe((latlng) => {
        if (this.isAddingMarker && latlng) {
          this.newMarker.lat = latlng.lat;
          this.newMarker.lng = latlng.lng;
        } else if (this.isAddingZone && latlng) {
          this.newZone.coordinates.push([latlng.lat, latlng.lng]);
        } else if (this.isAddingRoute && latlng) {
          this.newRoute.waypoints.push([latlng.lat, latlng.lng]);
        }
      })
    );
  }

  startAddingMarker() {
    this.isAddingMarker = true;
    this.resetOtherModes();
    this.showToast('Haz clic en el mapa para colocar el marcador', 'primary');
  }

  async saveMarker() {
    // ✅ Validar formulario antes de guardar
    const validation = this.validationService.validateMarkerForm({
      title: this.newMarker.title,
      description: this.newMarker.description,
      lat: this.newMarker.lat,
      lng: this.newMarker.lng,
      color: this.newMarker.color,
    });

    if (!validation.valid) {
      this.showToast(validation.errors.join('. '), 'warning');
      return;
    }

    try {
      const user: any = await this.getCurrentUser();
      if (!user) return;

      // Sanitizar datos antes de guardar
      const titleValidation = this.validationService.validateTitle(
        this.newMarker.title
      );
      const descValidation = this.validationService.validateDescription(
        this.newMarker.description
      );

      const marker: Omit<MapMarker, 'id'> = {
        title: titleValidation.sanitized!,
        description: descValidation.sanitized!,
        lat: this.newMarker.lat,
        lng: this.newMarker.lng,
        color: this.newMarker.color,
        type: 'marker',
        createdBy: user?.uid,
        organizationId: '',
        createdAt: new Date(),
      };

      await this.firestoreService.addMarker(marker);
      this.resetMarkerForm();
      this.showToast('Marcador agregado exitosamente', 'success');
    } catch (error) {
      console.error('Error agregando marcador:', error);
      this.showToast('Error al agregar marcador', 'danger');
    }
  }

  startAddingZone() {
    this.isAddingZone = true;
    this.resetOtherModes();
    this.newZone.coordinates = [];
    this.showToast(
      'Haz clic en el mapa para definir los puntos de la zona',
      'primary'
    );
  }

  async saveZone() {
    // ✅ Validar formulario antes de guardar
    const validation = this.validationService.validateZoneForm({
      name: this.newZone.name,
      description: this.newZone.description,
      coordinates: this.newZone.coordinates,
      color: this.newZone.color,
    });

    if (!validation.valid) {
      this.showToast(validation.errors.join('. '), 'warning');
      return;
    }

    try {
      const user: any = await this.getCurrentUser();
      if (!user) return;

      // Sanitizar datos antes de guardar
      const nameValidation = this.validationService.validateTitle(
        this.newZone.name
      );
      const descValidation = this.validationService.validateDescription(
        this.newZone.description
      );

      const zone: Omit<MapZone, 'id'> = {
        name: nameValidation.sanitized!,
        description: descValidation.sanitized!,
        coordinates: this.newZone.coordinates.map((coord: any) =>
          typeof coord === 'object' && 'lat' in coord && 'lng' in coord
            ? coord
            : { lat: coord[0], lng: coord[1] }
        ),
        color: this.newZone.color,
        number: this.getNextZoneNumber(),
        type: 'zone',
        createdBy: user?.uid,
        organizationId: '',
        createdAt: new Date(),
      };

      await this.firestoreService.addZone(zone);
      this.resetZoneForm();
      this.showToast('Zona agregada exitosamente', 'success');
    } catch (error) {
      console.error('Error agregando zona:', error);
      this.showToast('Error al agregar zona', 'danger');
    }
  }

  startAddingRoute() {
    this.isAddingRoute = true;
    this.resetOtherModes();
    this.newRoute.waypoints = [];
    this.showToast(
      'Haz clic en el mapa para definir los puntos de la ruta',
      'primary'
    );
  }

  async saveRoute() {
    if (!this.newRoute.name || this.newRoute.waypoints.length < 2) {
      this.showToast('Ingresa un nombre y define al menos 2 puntos', 'warning');
      return;
    }
    try {
      const user: any = await this.getCurrentUser();
      if (!user) return;
      const route: Omit<MapRoute, 'id'> = {
        name: this.newRoute.name,
        description: this.newRoute.description,
        waypoints: this.newRoute.waypoints,
        color: this.newRoute.color,
        width: this.newRoute.width,
        createdBy: user?.uid,
        createdAt: new Date(),
      };
      await this.firestoreService.addRoute(route);
      this.resetRouteForm();
      this.showToast('Ruta agregada exitosamente', 'success');
    } catch (error) {
      console.error('Error agregando ruta:', error);
      this.showToast('Error al agregar ruta', 'danger');
    }
  }

  cancelCurrentAction() {
    this.resetAllModes();
    this.showToast('Acción cancelada', 'medium');
  }

  private resetOtherModes() {
    if (this.isAddingMarker) this.isAddingMarker = false;
    if (this.isAddingZone) this.isAddingZone = false;
    if (this.isAddingRoute) this.isAddingRoute = false;
  }

  private resetAllModes() {
    this.isAddingMarker = false;
    this.isAddingZone = false;
    this.isAddingRoute = false;
  }

  private resetMarkerForm() {
    this.newMarker = {
      title: '',
      description: '',
      lat: 0,
      lng: 0,
      color: '#FF0000',
    };
    this.isAddingMarker = false;
  }

  private resetZoneForm() {
    this.newZone = {
      name: '',
      description: '',
      color: '#FF0000',
      fillOpacity: 0.3,
      coordinates: [],
    };
    this.isAddingZone = false;
  }

  private resetRouteForm() {
    this.newRoute = {
      name: '',
      description: '',
      color: '#FF0000',
      width: 3,
      waypoints: [],
    };
    this.isAddingRoute = false;
  }

  private async getCurrentUser() {
    return new Promise((resolve) => {
      // ✅ Agregar suscripción temporal al cleanup
      const sub = this.authService.getCurrentUser().subscribe((user) => {
        resolve(user);
        sub.unsubscribe(); // Unsubscribe inmediato después de obtener el valor
      });
    });
  }

  private getNextZoneNumber(): number {
    // Retorna el siguiente número disponible
    return this.zoneCounter++;
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      cssClass: 'custom-toast',
    });
    toast.present();
  }

  async dismiss() {
    await this.modalCtrl.dismiss();
  }
}
