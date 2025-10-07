import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
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
  ModalController,
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
import { AuthService } from '../../../auth/services/auth.service';
import { AuthorizationService } from '../../../auth/services/authorization.service';
import { RoleSelectorComponent } from '../role-selector/role-selector.component';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-map-controls',
  templateUrl: './map-controls.component.html',
  styleUrls: ['./map-controls.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    AsyncPipe,
    TitleCasePipe,
    RoleSelectorComponent,
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
  ],
})
export class MapControlsComponent implements OnInit, OnDestroy {
  private mapService = inject(MapService);
  private firestoreService = inject(FirestoreService);
  private mapDataService = inject(MapDataService);
  private authService = inject(AuthService);
  private authorizationService = inject(AuthorizationService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);

  // Observables para permisos
  canCreateMarker$!: Observable<boolean>;
  canCreateZone$!: Observable<boolean>;
  isAdmin$!: Observable<boolean>;
  currentUserRole$!: Observable<'admin' | 'user' | null>;

  // Subscripción para eventos de cambio de rol
  private roleChangeSubscription?: Subscription;
  private deleteEventsSubscription?: Subscription;

  // Control del FAB y paneles
  fabExpanded = false;
  panelOpen = false;
  panelType: 'marker' | 'zone' = 'marker';
  clickedLocation: { lat: number; lng: number } | null = null;

  // Modo editar (solo para admins/dev)
  editMode = false;

  // Modos de creación
  isCreatingMarker = false;

  // Formulario de marcador
  markerForm = {
    title: '',
    description: '',
    type: 'marker' as 'marker' | 'house' | 'poi',
    color: '#FF6B6B',
  };

  // Formulario de zona
  zoneForm = {
    name: '',
    description: '',
    number: 1,
    type: 'zone' as 'zone' | 'area' | 'sector',
    color: '#4ECDC4',
  };

  // Zona en proceso de creación
  zonePoints: { lat: number; lng: number }[] = [];
  isCreatingZone = false;

  colors = [
    // Colores principales
    { name: 'Rojo', value: '#FF6B6B' },
    { name: 'Verde', value: '#45B7D1' },
    { name: 'Azul', value: '#4ECDC4' },
    { name: 'Amarillo', value: '#FFA07A' },
    { name: 'Púrpura', value: '#D6A2E8' },
    { name: 'Naranja', value: '#FFB347' },

    // Colores adicionales - Tonos vibrantes
    { name: 'Rosa', value: '#FF69B4' },
    { name: 'Turquesa', value: '#40E0D0' },
    { name: 'Lima', value: '#32CD32' },
    { name: 'Coral', value: '#FF7F50' },
    { name: 'Violeta', value: '#8A2BE2' },
    { name: 'Dorado', value: '#FFD700' },

    // Colores neutros profesionales
    { name: 'Índigo', value: '#4B0082' },
    { name: 'Esmeralda', value: '#50C878' },
    { name: 'Magenta', value: '#FF1493' },
    { name: 'Cian', value: '#00FFFF' },
    { name: 'Salmón', value: '#FA8072' },
    { name: 'Oliva', value: '#9ACD32' },

    // Tonos oscuros para contraste
    { name: 'Granate', value: '#800020' },
    { name: 'Verde Oscuro', value: '#006400' },
    { name: 'Azul Marino', value: '#000080' },
    { name: 'Marrón', value: '#8B4513' },
    { name: 'Gris Oscuro', value: '#696969' },
    { name: 'Negro', value: '#2C2C2C' },
  ];

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

    // Inicializar observables de permisos
    this.canCreateMarker$ =
      this.authorizationService.hasPermission('create-marker');
    this.canCreateZone$ =
      this.authorizationService.hasPermission('create-zone');
    this.isAdmin$ = this.authorizationService.isAdmin();
    this.currentUserRole$ = this.authorizationService.getCurrentUserRole();

    // Escuchar cambios de rol (para desarrollo)
    this.roleChangeSubscription = new Subscription();
    window.addEventListener('roleChanged', (event: any) => {
      console.log('🔄 Role changed:', event.detail);
      // Actualizar observables
      this.canCreateMarker$ =
        this.authorizationService.hasPermission('create-marker');
      this.canCreateZone$ =
        this.authorizationService.hasPermission('create-zone');
      this.isAdmin$ = this.authorizationService.isAdmin();
      this.currentUserRole$ = this.authorizationService.getCurrentUserRole();
    });

    // Inicializar formulario de zona con número
    this.resetZoneForm();
  }

  ngOnInit() {
    console.log('🎮 MapControls component initialized');

    // Escuchar clicks en el mapa
    this.mapService.mapClick$.subscribe(
      (coords: { lat: number; lng: number }) => {
        console.log('🎯 MapControls received click:', coords);

        if (this.isCreatingZone) {
          console.log('🔨 Adding zone point');
          this.addZonePoint(coords);
        } else if (this.isCreatingMarker) {
          console.log('📍 Setting marker location and opening panel');
          this.clickedLocation = coords;
          // Abrir automáticamente el panel para completar el marcador
          this.openMarkerPanel();
        } else {
          console.log('📍 Setting clicked location');
          this.clickedLocation = coords;
        }
      }
    );
  }

  // Control del FAB
  toggleFab() {
    this.fabExpanded = !this.fabExpanded;
    if (!this.fabExpanded && this.panelOpen) {
      this.closePanel();
    }
  }

  // Abrir panel de marcadores
  openMarkerPanel() {
    this.panelType = 'marker';
    this.panelOpen = true;
    this.fabExpanded = false;

    // Si ya estamos en modo creación, no resetear el formulario
    // para mantener cualquier progreso
    if (!this.isCreatingMarker) {
      this.resetMarkerForm();
    }
  }

  // Abrir panel de zonas
  openZonePanel() {
    this.panelType = 'zone';
    this.panelOpen = true;
    this.fabExpanded = false;

    // Solo resetear el formulario si no estamos en modo creación activa
    // Esto permite reabrir el panel sin perder el progreso
    if (!this.isCreatingZone) {
      this.resetZoneForm();
    }
  }

  // Cerrar panel
  closePanel() {
    this.panelOpen = false;
    this.fabExpanded = false;

    // Solo detener la creación si no estamos en modo activo de creación
    // Esto permite cerrar el panel sin perder el progreso
    if (!this.isCreatingZone) {
      this.stopCreatingZone();
    }

    if (!this.isCreatingMarker) {
      this.stopCreatingMarker();
    }
  }

  async addMarker() {
    console.log('📍 ADD MARKER called');
    console.log('Clicked location:', this.clickedLocation);
    console.log('Marker title:', this.markerForm.title);

    if (!this.clickedLocation) {
      this.showToast('Selecciona una ubicación en el mapa');
      return;
    }

    if (!this.markerForm.title.trim()) {
      this.showToast('El título es obligatorio');
      return;
    }

    try {
      // Usar usuario anónimo por ahora para evitar problemas de autenticación
      console.log('🔐 Using anonymous user for now');
      const currentUser = { uid: 'anonymous' };

      const marker: Omit<MapMarker, 'id'> = {
        lat: this.clickedLocation.lat,
        lng: this.clickedLocation.lng,
        title: this.markerForm.title,
        description: this.markerForm.description,
        type: this.markerForm.type,
        color: this.markerForm.color,
        createdAt: new Date(),
        createdBy: currentUser?.uid || 'anonymous',
        organizationId: '', // Se asignará en FirestoreService
      };

      console.log('📍 Marker object created:', marker);

      try {
        console.log('💾 Saving via MapDataService...');
        // Usar MapDataService en lugar de FirestoreService
        const newMarker = await this.mapDataService.createMarker({
          title: this.markerForm.title,
          description: this.markerForm.description,
          latitude: this.clickedLocation.lat,
          longitude: this.clickedLocation.lng,
          type: this.mapMarkerTypeToDataType(this.markerForm.type),
          color: this.markerForm.color,
          isVisible: true,
        });
        console.log('✅ Marker created successfully:', newMarker.id);
        this.showToast('Marcador añadido correctamente');
      } catch (mapDataError) {
        console.warn(
          'MapDataService failed, falling back to FirestoreService:',
          mapDataError
        );

        try {
          console.log('💾 Falling back to Firestore...');
          const markerId = await this.firestoreService.addMarker(marker);
          console.log('💾 Marker saved with ID:', markerId);
          this.showToast('Marcador añadido correctamente');
        } catch (firestoreError) {
          console.warn(
            '💾 Firestore not available, adding locally only:',
            firestoreError
          );

          // Solo agregar localmente si todo falla
          console.log('🗺️ Adding to map service with temp ID...');
          const tempMarkerId = Math.random().toString(36).substr(2, 9);
          this.mapService.addMarker({ ...marker, id: tempMarkerId });
          console.log('🗺️ Marker added to map with temp ID');
          this.showToast('Marcador añadido localmente');
        }
      }
      this.stopCreatingMarker(); // Finalizar el modo de creación
      this.closePanel();
      this.resetMarkerForm();
    } catch (error) {
      console.error('❌ Error adding marker:', error);
      this.showToast('Error al añadir marcador: ' + (error as Error).message);
    }
  }

  startCreatingMarker() {
    this.isCreatingMarker = true;
    this.clickedLocation = null;

    // Feedback háptico para inicio de modo creación
    this.triggerHapticFeedback('light');

    // Comunicar al MapService que estamos en modo de creación de marcadores
    this.mapService.setCreatingMarkerMode(true);

    // Cerrar el panel para permitir ver el mapa
    this.panelOpen = false;
    this.fabExpanded = false;

    console.log('🚀 Starting marker creation mode');
    this.showToast(
      '🎯 Modo marcador activado - Toca el mapa para seleccionar ubicación'
    );
  }

  stopCreatingMarker() {
    this.isCreatingMarker = false;
    this.clickedLocation = null;

    // Comunicar al MapService que salimos del modo de creación
    this.mapService.setCreatingMarkerMode(false);

    console.log('🛑 Stopped marker creation mode');
  }

  startCreatingZone() {
    this.isCreatingZone = true;
    this.zonePoints = [];

    // Feedback háptico para inicio de modo creación
    this.triggerHapticFeedback('light');

    // Comunicar al MapService que estamos en modo de creación de zonas
    this.mapService.setCreatingZoneMode(true);

    // Cerrar el panel para permitir ver el mapa
    this.panelOpen = false;
    this.fabExpanded = false;

    console.log('🚀 Starting zone creation mode');
    this.showToast('🎯 Modo zona activado - Toca el mapa para agregar puntos');
  }

  addZonePoint(coords: { lat: number; lng: number }) {
    this.zonePoints.push(coords);
    console.log(
      '🎯 Zone point added:',
      coords,
      'Total points:',
      this.zonePoints.length
    );

    if (this.zonePoints.length === 1) {
      this.showToast('🎯 Primer punto agregado');
    } else if (this.zonePoints.length === 2) {
      this.showToast('🎯 Segundo punto agregado');
    } else if (this.zonePoints.length === 3) {
      this.showToast('✅ Ya tienes los puntos mínimos para crear la zona');
    } else {
      this.showToast(`🎯 Punto ${this.zonePoints.length} agregado`);
    }
  }

  async createZone() {
    console.log('🏗️ CREATE ZONE called');
    console.log('Zone points:', this.zonePoints.length);
    console.log('Zone name:', this.zoneForm.name);

    if (this.zonePoints.length < 3) {
      this.showToast('Se necesitan al menos 3 puntos para crear una zona');
      return;
    }

    if (!this.zoneForm.name.trim()) {
      this.showToast('El nombre de la zona es obligatorio');
      return;
    }

    try {
      // Convertir coordenadas al formato esperado por MapDataService
      const polygonCoordinates: [number, number][] = this.zonePoints.map(
        (point) => [point.lat, point.lng]
      );

      // Cerrar el polígono si no está cerrado
      const firstPoint = polygonCoordinates[0];
      const lastPoint = polygonCoordinates[polygonCoordinates.length - 1];
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        polygonCoordinates.push(firstPoint);
      }

      console.log('🏗️ Zone coordinates prepared:', polygonCoordinates);

      try {
        console.log('� Saving via MapDataService...');
        // Usar MapDataService en lugar de FirestoreService
        const newZone = await this.mapDataService.createZone({
          name: this.zoneForm.name,
          description: this.zoneForm.description,
          type: 'polygon',
          coordinates: {
            polygon: polygonCoordinates,
          },
          style: {
            fillColor: this.zoneForm.color,
            fillOpacity: 0.3,
            strokeColor: this.zoneForm.color,
            strokeWeight: 2,
            strokeOpacity: 0.8,
          },
          isVisible: true,
          metadata: {
            category: this.zoneForm.type,
            customFields: {
              number: this.zoneForm.number,
            },
          },
        });
        console.log('✅ Zone created successfully:', newZone.id);
        this.showToast('Zona creada correctamente');
      } catch (mapDataError) {
        console.warn(
          'MapDataService failed, falling back to FirestoreService:',
          mapDataError
        );

        try {
          // Crear zona en formato legacy como fallback
          const zone: Omit<MapZone, 'id'> = {
            name: this.zoneForm.name,
            description: this.zoneForm.description,
            coordinates: this.zonePoints,
            color: this.zoneForm.color,
            number: this.zoneForm.number,
            type: this.zoneForm.type,
            createdAt: new Date(),
            createdBy: 'anonymous',
            organizationId: '', // Se asignará en FirestoreService
          };

          console.log('💾 Falling back to Firestore...');
          const zoneId = await this.firestoreService.addZone(zone);
          console.log('💾 Zone saved with ID:', zoneId);
          this.showToast('Zona creada correctamente');
        } catch (firestoreError) {
          console.warn(
            '💾 Firestore not available, adding locally only:',
            firestoreError
          );

          // Solo agregar localmente si todo falla
          console.log('🗺️ Adding to map service with temp ID...');
          const tempZoneId = Math.random().toString(36).substr(2, 9);
          const zone: Omit<MapZone, 'id'> = {
            name: this.zoneForm.name,
            description: this.zoneForm.description,
            coordinates: this.zonePoints,
            color: this.zoneForm.color,
            number: this.zoneForm.number,
            type: this.zoneForm.type,
            createdAt: new Date(),
            createdBy: 'anonymous',
            organizationId: '', // Se asignará en FirestoreService
          };
          this.mapService.addZone({ ...zone, id: tempZoneId });
          console.log('🗺️ Zone added to map with temp ID');
          this.showToast('Zona añadida localmente');
        }
      }

      this.stopCreatingZone();
      this.closePanel();
      this.resetZoneForm();
    } catch (error) {
      console.error('❌ Error creating zone:', error);
      this.showToast('Error al crear zona: ' + (error as Error).message);
    }
  }

  stopCreatingZone() {
    this.isCreatingZone = false;
    this.zonePoints = [];

    // Comunicar al MapService que salimos del modo de creación
    this.mapService.setCreatingZoneMode(false);
  }

  // Método para cancelar explícitamente la creación de zona
  cancelZoneCreation() {
    this.showToast('❌ Creación de zona cancelada');
    this.stopCreatingZone();

    // Si el panel está abierto, mantenerlo abierto pero resetear el formulario
    if (this.panelOpen) {
      this.resetZoneForm();
    }
  }

  ngOnDestroy() {
    // Limpiar subscripciones
    if (this.roleChangeSubscription) {
      this.roleChangeSubscription.unsubscribe();
    }

    if (this.deleteEventsSubscription) {
      this.deleteEventsSubscription.unsubscribe();
    }

    // Remover event listener
    window.removeEventListener('roleChanged', () => {});

    // Desactivar modo editar si está activo
    if (this.editMode) {
      this.disableDeleteMode();
    }
  }

  private resetMarkerForm() {
    this.markerForm = {
      title: '',
      description: '',
      type: 'marker',
      color: '#FF6B6B',
    };
    this.clickedLocation = null;
  }

  // Contador para números de zona
  private zoneCounter = 1;

  private getNextZoneNumber(): number {
    // Retorna el siguiente número disponible
    return this.zoneCounter++;
  }

  private resetZoneForm() {
    this.zoneForm = {
      name: '',
      description: '',
      number: this.getNextZoneNumber(),
      type: 'zone',
      color: '#4ECDC4',
    };
    this.stopCreatingZone();
  }

  openAdminPanel() {
    // Cerrar FAB
    this.fabExpanded = false;

    // Verificar permisos y navegar a gestión de usuarios
    this.authorizationService
      .hasPermission('manage-users')
      .subscribe((hasPermission) => {
        if (hasPermission) {
          this.router.navigate(['/admin/users']);
        } else {
          this.showToast('❌ No tienes permisos de administración');
        }
      });
  }

  // Métodos para modo editar
  toggleEditMode() {
    // Verificar permisos antes de activar (solo admin o dev)
    this.authorizationService.isAdmin().subscribe((isAdmin) => {
      this.authorizationService.isDev().subscribe((isDev) => {
        const canEdit = isAdmin || isDev;

        if (!canEdit) {
          this.showToast('❌ No tienes permisos para editar elementos');
          return;
        }

        this.editMode = !this.editMode;
        this.fabExpanded = false;

        if (this.editMode) {
          this.triggerHapticFeedback('medium');
          this.showToast(
            '🔧 Modo editar activado - Toca elementos para eliminar'
          );
          this.enableDeleteMode();
        } else {
          this.triggerHapticFeedback('light');
          this.showToast('✅ Modo editar desactivado');
          this.disableDeleteMode();
        }
      });
    });
  }

  private enableDeleteMode() {
    // Configurar el mapService para que permita clicks de eliminación
    this.mapService.setDeleteMode(true);

    // Limpiar subscripciones anteriores
    if (this.deleteEventsSubscription) {
      this.deleteEventsSubscription.unsubscribe();
    }

    // Crear nueva subscripción combinada
    this.deleteEventsSubscription = new Subscription();

    // Suscribirse a los eventos de eliminación
    this.deleteEventsSubscription.add(
      this.mapService.markerDelete$.subscribe((markerId: string) => {
        if (this.editMode) {
          this.confirmDeleteMarker(markerId);
        }
      })
    );

    this.deleteEventsSubscription.add(
      this.mapService.zoneDelete$.subscribe((zoneId: string) => {
        if (this.editMode) {
          this.confirmDeleteZone(zoneId);
        }
      })
    );
  }

  private disableDeleteMode() {
    // Deshabilitar modo de eliminación en el mapService
    this.mapService.setDeleteMode(false);

    // Limpiar subscripciones de eventos de eliminación
    if (this.deleteEventsSubscription) {
      this.deleteEventsSubscription.unsubscribe();
      this.deleteEventsSubscription = undefined;
    }

    // Limpieza adicional del DOM para asegurar que no queden clases CSS o cursores
    this.cleanupDeleteModeStyles();
  }

  private cleanupDeleteModeStyles() {
    // Limpiar clases delete-mode que puedan haber quedado en el DOM
    const deleteElements = document.querySelectorAll('.delete-mode');
    deleteElements.forEach((element) => {
      element.classList.remove('delete-mode');
      (element as HTMLElement).style.cursor = '';
    });

    // Limpiar el cursor del cuerpo del documento
    document.body.style.cursor = '';

    // Limpiar cursor de elementos específicos del mapa
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

    console.log('🧹 Delete mode styles cleaned up');
  }

  private async confirmDeleteMarker(markerId: string) {
    // Feedback haptic para móviles
    this.triggerHapticFeedback();

    // Usar AlertController mejorado para móvil
    const alert = await this.alertCtrl.create({
      header: '🗑️ Eliminar Marcador',
      message:
        '¿Estás seguro de que quieres eliminar este marcador?\n\nEsta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
          handler: () => {
            this.triggerHapticFeedback('light');
            console.log('❌ Delete marker cancelled');
          },
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
    // Feedback haptic para móviles
    this.triggerHapticFeedback();

    // Usar AlertController mejorado para móvil
    const alert = await this.alertCtrl.create({
      header: '🗑️ Eliminar Zona',
      message:
        '¿Estás seguro de que quieres eliminar esta zona?\n\nEsta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
          handler: () => {
            this.triggerHapticFeedback('light');
            console.log('❌ Delete zone cancelled');
          },
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
      console.log('🗑️ Deleting marker:', markerId);

      try {
        console.log('💾 Deleting via MapDataService...');
        // Usar MapDataService en lugar de FirestoreService
        await this.mapDataService.deleteMarker(markerId);
        console.log('✅ Marker deleted from MapDataService:', markerId);
        this.showToast('✅ Marcador eliminado');
      } catch (mapDataError) {
        console.warn(
          'MapDataService failed, falling back to FirestoreService:',
          mapDataError
        );

        try {
          await this.firestoreService.deleteMarker(markerId);
          console.log('� Marker deleted from Firestore:', markerId);
          this.showToast('✅ Marcador eliminado');
        } catch (firestoreError) {
          console.warn(
            '💾 Firestore not available for deletion:',
            firestoreError
          );
          // Si Firestore no está disponible, eliminar solo del mapa
          this.mapService.removeMarker(markerId);
          console.log('🗑️ Marker removed from map locally');
          this.showToast('✅ Marcador eliminado localmente');
        }
      }
    } catch (error) {
      console.error('❌ Error deleting marker:', error);
      this.showToast('❌ Error al eliminar marcador');
    }
  }

  private async deleteZone(zoneId: string) {
    try {
      console.log('🗑️ Deleting zone:', zoneId);

      try {
        console.log('💾 Deleting via MapDataService...');
        // Usar MapDataService en lugar de FirestoreService
        await this.mapDataService.deleteZone(zoneId);
        console.log('✅ Zone deleted from MapDataService:', zoneId);
        this.showToast('✅ Zona eliminada');
      } catch (mapDataError) {
        console.warn(
          'MapDataService failed, falling back to FirestoreService:',
          mapDataError
        );

        try {
          await this.firestoreService.deleteZone(zoneId);
          console.log('� Zone deleted from Firestore:', zoneId);
          this.showToast('✅ Zona eliminada');
        } catch (firestoreError) {
          console.warn(
            '💾 Firestore not available for deletion:',
            firestoreError
          );
          // Si Firestore no está disponible, eliminar solo del mapa
          this.mapService.removeZone(zoneId);
          console.log('🗑️ Zone removed from map locally');
          this.showToast('✅ Zona eliminada localmente');
        }
      }
    } catch (error) {
      console.error('❌ Error deleting zone:', error);
      this.showToast('❌ Error al eliminar zona');
    }
  }

  /**
   * Convierte el tipo de marcador del formulario al tipo esperado por MapDataService
   */
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
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }

  /**
   * Trigger haptic feedback for mobile devices
   * @param style Intensity of the haptic feedback
   */
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
      console.log('📳 Haptic feedback triggered:', style);
    } catch (error) {
      console.log('📱 Haptic feedback not available on this device:', error);
    }
  }
}
