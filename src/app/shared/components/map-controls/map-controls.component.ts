import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  IonButton,
  IonIcon,
  IonFab,
  IonFabButton,
  IonFabList,
  IonInput,
  IonTextarea,
  IonChip,
  IonLabel,
  IonItem,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  home,
  locationOutline,
  colorPalette,
  close,
  location,
  checkmarkCircle,
  star,
  shapes,
  stop,
  addCircle,
  lockClosed,
  settings,
  shieldCheckmark,
  person,
  apps,
  create,
  trash,
  pencil,
  checkmark,
  pin,
  trashBin,
} from 'ionicons/icons';
import { MapService } from '../../../map/services/map.service';
import { MapMarker } from '../../models/marker.model';
import { MapZone } from '../../models/zone.model';
import { FirestoreService } from '../../../services/firestore.service';
import { MapDataService } from '../../services/map-data.service';
import { AuthorizationService } from '../../../auth/services/authorization.service';
import { RoleSelectorComponent } from '../role-selector/role-selector.component';

@Component({
  selector: 'app-map-controls',
  templateUrl: './map-controls.component.html',
  styleUrls: ['./map-controls-optimized.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    IonButton,
    IonIcon,
    IonFab,
    IonFabButton,
    IonFabList,
    IonInput,
    IonTextarea,
    IonChip,
    IonLabel,
    IonItem,
    RoleSelectorComponent
  ],
})
export class MapControlsComponent implements OnInit, OnDestroy {
  private mapService = inject(MapService);
  private firestoreService = inject(FirestoreService);
  private mapDataService = inject(MapDataService);
  private authorizationService = inject(AuthorizationService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  // Signals para permisos
  readonly canCreateMarker = computed(() => {
  const orgRole = this.authorizationService.currentUser()?.organizationRole;
  return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'moderator' || orgRole === 'user';
  });

  readonly canCreateZone = computed(() => {
    const orgRole = this.authorizationService.currentUser()?.organizationRole;
    return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'moderator';
  });

  readonly canEditOrDelete = computed(() => {
    const orgRole = this.authorizationService.currentUser()?.organizationRole;
    return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'moderator';
  });

  readonly isAdmin = computed(() => this.authorizationService.isAdmin());
  readonly currentUserRole = computed(() =>
    this.authorizationService.currentUserRole()
  );

  readonly organizationRole = computed(() =>
    this.authorizationService.currentUser()?.organizationRole
  );

  // Signals para controles del FAB y paneles
  private fabExpandedSignal = signal(false);
  private panelOpenSignal = signal(false);
  private panelTypeSignal = signal<'marker' | 'zone'>('marker');
  private clickedLocationSignal = signal<{ lat: number; lng: number } | null>(
    null
  );

  readonly fabExpanded = this.fabExpandedSignal.asReadonly();
  readonly panelOpen = this.panelOpenSignal.asReadonly();
  readonly panelType = this.panelTypeSignal.asReadonly();
  readonly clickedLocation = this.clickedLocationSignal.asReadonly();

  // Signals para modo editar
  private editModeSignal = signal(false);
  readonly editMode = this.editModeSignal.asReadonly();

  // Signals para modos de creación
  private isCreatingMarkerSignal = signal(false);
  private isCreatingZoneSignal = signal(false);
  private zonePointsSignal = signal<{ lat: number; lng: number }[]>([]);

  readonly isCreatingMarker = this.isCreatingMarkerSignal.asReadonly();
  readonly isCreatingZone = this.isCreatingZoneSignal.asReadonly();
  readonly zonePoints = this.zonePointsSignal.asReadonly();

  // Signals para formularios
  private markerFormSignal = signal({
    title: '',
    description: '',
    type: 'marker' as 'marker' | 'house' | 'poi',
    color: '#FF6B6B',
  });

  private zoneFormSignal = signal({
    name: '',
    description: '',
    number: 1,
    type: 'zone' as 'zone' | 'area' | 'sector',
    color: '#4ECDC4',
  });

  readonly markerForm = this.markerFormSignal.asReadonly();
  readonly zoneForm = this.zoneFormSignal.asReadonly();

  // Colores
  colors = [
    { name: 'Rojo', value: '#FF6B6B' },
    { name: 'Verde', value: '#45B7D1' },
    { name: 'Azul', value: '#4ECDC4' },
    { name: 'Amarillo', value: '#FFA07A' },
    { name: 'Púrpura', value: '#D6A2E8' },
    { name: 'Naranja', value: '#FFB347' },
    { name: 'Rosa', value: '#FF69B4' },
    { name: 'Turquesa', value: '#40E0D0' },
    { name: 'Lima', value: '#32CD32' },
    { name: 'Coral', value: '#FF7F50' },
    { name: 'Violeta', value: '#8A2BE2' },
    { name: 'Dorado', value: '#FFD700' },
    { name: 'Índigo', value: '#4B0082' },
    { name: 'Esmeralda', value: '#50C878' },
    { name: 'Magenta', value: '#FF1493' },
    { name: 'Cian', value: '#00FFFF' },
    { name: 'Salmón', value: '#FA8072' },
    { name: 'Oliva', value: '#9ACD32' },
    { name: 'Granate', value: '#800020' },
    { name: 'Verde Oscuro', value: '#006400' },
    { name: 'Azul Marino', value: '#000080' },
    { name: 'Marrón', value: '#8B4513' },
    { name: 'Gris Oscuro', value: '#696969' },
    { name: 'Negro', value: '#2C2C2C' },
  ];

  private zoneCounter = 1;

  // Marker form updates
  updateMarkerTitle(title: string): void {
    this.markerFormSignal.update(form => ({ ...form, title }));
  }

  updateMarkerDescription(description: string): void {
    this.markerFormSignal.update(form => ({ ...form, description }));
  }

  updateMarkerType(type: 'marker' | 'house' | 'poi'): void {
    this.markerFormSignal.update(form => ({ ...form, type }));
  }

  updateMarkerColor(color: string): void {
    this.markerFormSignal.update(form => ({ ...form, color }));
  }

  // Zone form updates
  updateZoneName(name: string): void {
    this.zoneFormSignal.update(form => ({ ...form, name }));
  }

  updateZoneDescription(description: string): void {
    this.zoneFormSignal.update(form => ({ ...form, description }));
  }

  updateZoneNumber(number: number): void {
    this.zoneFormSignal.update(form => ({ ...form, number }));
  }

  updateZoneType(type: 'zone' | 'area' | 'sector'): void {
    this.zoneFormSignal.update(form => ({ ...form, type }));
  }

  updateZoneColor(color: string): void {
    this.zoneFormSignal.update(form => ({ ...form, color }));
  }

  constructor() {
    addIcons({
      add,
      home,
      locationOutline,
      colorPalette,
      close,
      location,
      checkmarkCircle,
      star,
      shapes,
      stop,
      addCircle,
      lockClosed,
      settings,
      shieldCheckmark,
      person,
      apps,
      create,
      trash,
      pencil,
      checkmark,
      pin,
      trashBin,
    });

    this.resetZoneForm();

    // Escuchar cambios de rol
    window.addEventListener('roleChanged', () => {
      // Los computed signals se actualizan automáticamente
    });
  }

  ngOnInit() {
    this.mapService.mapClick$.subscribe(
      (coords: { lat: number; lng: number }) => {
        if (this.isCreatingZone()) {
          this.addZonePoint(coords);
        } else if (this.isCreatingMarker()) {
          this.clickedLocationSignal.set(coords);
          this.openMarkerPanel();
        } else {
          this.clickedLocationSignal.set(coords);
        }
      }
    );
  }

  toggleFab() {
    this.fabExpandedSignal.update((value) => !value);
    if (!this.fabExpandedSignal() && this.panelOpenSignal()) {
      this.closePanel();
    }
  }

  openMarkerPanel() {
    this.panelTypeSignal.set('marker');
    this.panelOpenSignal.set(true);
    this.fabExpandedSignal.set(false);

    if (!this.isCreatingMarker()) {
      this.resetMarkerForm();
    }
  }

  openZonePanel() {
    this.panelTypeSignal.set('zone');
    this.panelOpenSignal.set(true);
    this.fabExpandedSignal.set(false);

    if (!this.isCreatingZone()) {
      this.resetZoneForm();
    }
  }

  closePanel() {
    this.panelOpenSignal.set(false);
    this.fabExpandedSignal.set(false);

    if (!this.isCreatingZone()) {
      this.stopCreatingZone();
    }

    if (!this.isCreatingMarker()) {
      this.stopCreatingMarker();
    }
  }

  async addMarker() {
    if (!this.clickedLocationSignal()) {
      this.showToast('Selecciona una ubicación en el mapa');
      return;
    }

    const markerForm = this.markerFormSignal();
    if (!markerForm.title.trim()) {
      this.showToast('El título es obligatorio');
      return;
    }

    try {
      const currentUser = { uid: 'anonymous' };
      const marker: Omit<MapMarker, 'id'> = {
        lat: this.clickedLocationSignal()!.lat,
        lng: this.clickedLocationSignal()!.lng,
        title: markerForm.title,
        description: markerForm.description,
        type: markerForm.type,
        color: markerForm.color,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        organizationId: '',
      };

      try {
        const newMarker = await this.mapDataService.createMarker({
          title: markerForm.title,
          description: markerForm.description,
          latitude: this.clickedLocationSignal()!.lat,
          longitude: this.clickedLocationSignal()!.lng,
          type: this.mapMarkerTypeToDataType(markerForm.type),
          color: markerForm.color,
          isVisible: true,
        });
        this.showToast('Marcador añadido correctamente');
      } catch (mapDataError) {
        try {
          await this.firestoreService.addMarker(marker);
          this.showToast('Marcador añadido correctamente');
        } catch (firestoreError) {
          const tempMarkerId = Math.random().toString(36).substr(2, 9);
          this.mapService.addMarker({ ...marker, id: tempMarkerId });
          this.showToast('Marcador añadido localmente');
        }
      }

      this.stopCreatingMarker();
      this.closePanel();
      this.resetMarkerForm();
    } catch (error) {
      this.showToast('Error al añadir marcador');
    }
  }

  startCreatingMarker() {
    this.isCreatingMarkerSignal.set(true);
    this.clickedLocationSignal.set(null);
    this.triggerHapticFeedback('light');
    this.mapService.setCreatingMarkerMode(true);
    this.panelOpenSignal.set(false);
    this.fabExpandedSignal.set(false);
    this.showToast('Modo marcador activado - Toca el mapa para seleccionar ubicación');
  }

  stopCreatingMarker() {
    this.isCreatingMarkerSignal.set(false);
    this.clickedLocationSignal.set(null);
    this.mapService.setCreatingMarkerMode(false);
  }

  startCreatingZone() {
  // NUEVO: Verificar permisos antes de permitir crear zona
    if (!this.canCreateZone()) {
      this.showToast('No tienes permisos para crear zonas. Solo miembros con rol de Moderador o superior pueden crear zonas.');
      return;
    }

    this.isCreatingZoneSignal.set(true);
    this.zonePointsSignal.set([]);
    this.triggerHapticFeedback('light');
    this.mapService.setCreatingZoneMode(true);
    this.panelOpenSignal.set(false);
    this.fabExpandedSignal.set(false);
    this.showToast('Modo zona activado - Toca el mapa para agregar puntos');
  }

  addZonePoint(coords: { lat: number; lng: number }) {
    this.zonePointsSignal.update((points) => [...points, coords]);
    const count = this.zonePointsSignal().length;

    if (count === 1) {
      this.showToast('Primer punto agregado');
    } else if (count === 2) {
      this.showToast('Segundo punto agregado');
    } else if (count === 3) {
      this.showToast('Ya tienes los puntos mínimos para crear la zona');
    } else {
      this.showToast(`Punto ${count} agregado`);
    }
  }

  async createZone() {
    // NUEVO: Validación adicional de seguridad
    if (!this.canCreateZone()) {
      this.showToast('No tienes permisos para crear zonas');
      return;
    }

    const zonePoints = this.zonePointsSignal();
    if (zonePoints.length < 3) {
      this.showToast('Se necesitan al menos 3 puntos para crear una zona');
      return;
    }

    const zoneForm = this.zoneFormSignal();
    if (!zoneForm.name.trim()) {
      this.showToast('El nombre de la zona es obligatorio');
      return; 
    }

    try {
      const polygonCoordinates: [number, number][] = zonePoints.map((point) => [
        point.lat,
        point.lng,
      ]);

      const firstPoint = polygonCoordinates[0];
      const lastPoint = polygonCoordinates[polygonCoordinates.length - 1];
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        polygonCoordinates.push(firstPoint);
      }

      try {
        const newZone = await this.mapDataService.createZone({
          name: zoneForm.name,
          description: zoneForm.description,
          type: 'polygon',
          coordinates: {
            polygon: polygonCoordinates,
          },
          style: {
            fillColor: zoneForm.color,
            fillOpacity: 0.3,
            strokeColor: zoneForm.color,
            strokeWeight: 2,
            strokeOpacity: 0.8,
          },
          isVisible: true,
          metadata: {
            category: zoneForm.type,
            customFields: {
              number: zoneForm.number,
            },
          },
        });
        this.showToast('Zona creada correctamente');
      } catch (mapDataError) {
        try {
          const zone: Omit<MapZone, 'id'> = {
            name: zoneForm.name,
            description: zoneForm.description,
            coordinates: zonePoints,
            color: zoneForm.color,
            number: zoneForm.number,
            type: zoneForm.type,
            createdAt: new Date(),
            createdBy: 'anonymous',
            organizationId: '',
          };

          await this.firestoreService.addZone(zone);
          this.showToast('Zona creada correctamente');
        } catch (firestoreError) {
          const tempZoneId = Math.random().toString(36).substr(2, 9);
          const zone: Omit<MapZone, 'id'> = {
            name: zoneForm.name,
            description: zoneForm.description,
            coordinates: zonePoints,
            color: zoneForm.color,
            number: zoneForm.number,
            type: zoneForm.type,
            createdAt: new Date(),
            createdBy: 'anonymous',
            organizationId: '',
          };
          this.mapService.addZone({ ...zone, id: tempZoneId });
          this.showToast('Zona añadida localmente');
        }
      }

      this.stopCreatingZone();
      this.closePanel();
      this.resetZoneForm();
    } catch (error) {
      this.showToast('Error al crear zona');
    }
  }

  stopCreatingZone() {
    this.isCreatingZoneSignal.set(false);
    this.zonePointsSignal.set([]);
    this.mapService.setCreatingZoneMode(false);
  }

  cancelZoneCreation() {
    this.showToast('Creación de zona cancelada');
    this.stopCreatingZone();

    if (this.panelOpenSignal()) {
      this.resetZoneForm();
    }
  }

  ngOnDestroy() {
    window.removeEventListener('roleChanged', () => {});

    if (this.editModeSignal()) {
      this.disableDeleteMode();
    }
  }

  private resetMarkerForm() {
    this.markerFormSignal.set({
      title: '',
      description: '',
      type: 'marker',
      color: '#FF6B6B',
    });
    this.clickedLocationSignal.set(null);
  }

  private getNextZoneNumber(): number {
    return this.zoneCounter++;
  }

  private resetZoneForm() {
    this.zoneFormSignal.set({
      name: '',
      description: '',
      number: this.getNextZoneNumber(),
      type: 'zone',
      color: '#4ECDC4',
    });
    this.stopCreatingZone();
  }

  toggleEditMode() {
  // NUEVO: Verificar permisos antes de activar modo edición
    if (!this.canEditOrDelete()) {
      this.showToast('No tienes permisos para editar o eliminar elementos. Solo miembros con rol de Moderador o superior pueden hacerlo.');
      return;
    }

    this.editModeSignal.update((value) => !value);
    this.fabExpandedSignal.set(false);

    if (this.editModeSignal()) {
      this.triggerHapticFeedback('medium');
      this.showToast('Modo editar activado - Toca elementos para eliminar');
      this.enableDeleteMode();
    } else {
      this.triggerHapticFeedback('light');
      this.showToast('Modo editar desactivado');
      this.disableDeleteMode();
    }
  }

  private enableDeleteMode() {
    this.mapService.setDeleteMode(true);

    this.mapService.markerDelete$.subscribe((markerId: string) => {
      if (this.editModeSignal()) {
        this.confirmDeleteMarker(markerId);
      }
    });

    this.mapService.zoneDelete$.subscribe((zoneId: string) => {
      if (this.editModeSignal()) {
        this.confirmDeleteZone(zoneId);
      }
    });
  }

  private disableDeleteMode() {
    this.mapService.setDeleteMode(false);
    this.cleanupDeleteModeStyles();
  }

  private cleanupDeleteModeStyles() {
    const deleteElements = document.querySelectorAll('.delete-mode');
    deleteElements.forEach((element) => {
      element.classList.remove('delete-mode');
      (element as HTMLElement).style.cursor = '';
    });

    document.body.style.cursor = '';

    const mapContainer = document.querySelector('#map-container');
    if (mapContainer) {
      (mapContainer as HTMLElement).style.cursor = '';
      mapContainer.classList.remove('delete-mode');
    }

    const leafletContainer = document.querySelector('.leaflet-container');
    if (leafletContainer) {
      (leafletContainer as HTMLElement).style.cursor = '';
      leafletContainer.classList.remove('delete-mode');
    }
  }

  private async confirmDeleteMarker(markerId: string) {
    this.triggerHapticFeedback();

    const alert = await this.alertCtrl.create({
      header: 'Eliminar Marcador',
      message: '¿Estás seguro de que quieres eliminar este marcador?\n\nEsta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
        },
        {
          text: 'Eliminar',
          cssClass: 'alert-button-destructive',
          handler: () => {
            this.triggerHapticFeedback('medium');
            this.deleteMarker(markerId);
          },
        },
      ],
      cssClass: 'delete-confirmation-alert mobile-optimized',
    });

    await alert.present();
  }

  private async confirmDeleteZone(zoneId: string) {
    this.triggerHapticFeedback();

    const alert = await this.alertCtrl.create({
      header: 'Eliminar Zona',
      message: '¿Estás seguro de que quieres eliminar esta zona?\n\nEsta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
        },
        {
          text: 'Eliminar',
          cssClass: 'alert-button-destructive',
          handler: () => {
            this.triggerHapticFeedback('medium');
            this.deleteZone(zoneId);
          },
        },
      ],
      cssClass: 'delete-confirmation-alert mobile-optimized',
    });

    await alert.present();
  }

  private async deleteMarker(markerId: string) {
  try {
    // Actualización optimista - remover de la UI inmediatamente
    this.mapService.removeMarker(markerId);
    this.showToast('Marcador eliminado');

    // Luego intentar eliminar del backend
    await this.mapDataService.deleteMarker(markerId);
  } catch (error) {
    // Si falla, mostrarlo pero el marcador ya está fuera de la UI
    console.error('Error eliminando marcador del backend:', error);
    this.showToast('Advertencia: El marcador se eliminó localmente pero puede persistir en el servidor');
  }
}

private async deleteZone(zoneId: string) {
  try {
    // Actualización optimista - remover de la UI inmediatamente
    this.mapService.removeZone(zoneId);
    this.showToast('Zona eliminada');

    // Luego intentar eliminar del backend
    await this.mapDataService.deleteZone(zoneId);
  } catch (error) {
    // Si falla, mostrarlo pero la zona ya está fuera de la UI
    console.error('Error eliminando zona del backend:', error);
    this.showToast('Advertencia: La zona se eliminó localmente pero puede persistir en el servidor');
  }
}

  private mapMarkerTypeToDataType(
    formType: 'marker' | 'house' | 'poi'
  ): 'default' | 'warning' | 'danger' | 'success' | 'info' {
    switch (formType) {
      case 'marker':
        return 'default';
      case 'house':
        return 'info';
      case 'poi':
        return 'success';
      default:
        return 'default';
    }
  }

  private async showToast(message: string) {
  const toast = await this.toastCtrl.create({
    message,
    duration: 1500, // Reducido de 2000 a 1500ms (más rápido)
    position: 'bottom', // Cambiar de 'top' a 'bottom'
    cssClass: 'custom-toast-compact',
    mode: 'ios', // Modo iOS más discreto
  });
  await toast.present();
}

  private async triggerHapticFeedback(
    style: 'light' | 'medium' | 'heavy' = 'medium'
  ) {
    try {
      const impactStyle =
        style === 'light'
          ? ImpactStyle.Light
          : style === 'heavy'
          ? ImpactStyle.Heavy
          : ImpactStyle.Medium;

      await Haptics.impact({ style: impactStyle });
    } catch (error) {
      // Haptic feedback not available
    }
  }
}
