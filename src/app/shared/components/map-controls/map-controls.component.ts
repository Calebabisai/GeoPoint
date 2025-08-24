import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
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
} from 'ionicons/icons';
import { MapService } from '../../../map/services/map.service';
import { MapMarker } from '../../models/marker.model';
import { MapZone } from '../../models/zone.model';
import { FirestoreService } from '../../../services/firestore.service';
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
  private authService = inject(AuthService);
  private authorizationService = inject(AuthorizationService);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  // Observables para permisos
  canCreateMarker$!: Observable<boolean>;
  canCreateZone$!: Observable<boolean>;
  isAdmin$!: Observable<boolean>;
  currentUserRole$!: Observable<'dev' | 'admin' | 'user' | null>;

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
    { name: 'Rojo', value: '#FF6B6B' },
    { name: 'Azul', value: '#4ECDC4' },
    { name: 'Verde', value: '#45B7D1' },
    { name: 'Amarillo', value: '#FFA07A' },
    { name: 'Púrpura', value: '#D6A2E8' },
    { name: 'Naranja', value: '#FFB347' },
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
      };

      console.log('📍 Marker object created:', marker);

      try {
        console.log('💾 Saving to Firestore...');
        const markerId = await this.firestoreService.addMarker(marker);
        console.log('💾 Marker saved with ID:', markerId);

        // No agregar manualmente al mapa - las suscripciones reactivas se encargan
        console.log('✅ Marker will be added via reactive subscription');
      } catch (firestoreError) {
        console.warn(
          '💾 Firestore not available, adding locally only:',
          firestoreError
        );

        // Solo agregar localmente si Firestore falla
        console.log('🗺️ Adding to map service with temp ID...');
        const tempMarkerId = Math.random().toString(36).substr(2, 9);
        this.mapService.addMarker({ ...marker, id: tempMarkerId });
        console.log('🗺️ Marker added to map with temp ID');
      }

      this.showToast('Marcador añadido correctamente');
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
      // Usar usuario anónimo por ahora para evitar problemas de autenticación
      console.log('🔐 Using anonymous user for now');
      const currentUser = { uid: 'anonymous' };

      const zone: Omit<MapZone, 'id'> = {
        name: this.zoneForm.name,
        description: this.zoneForm.description,
        coordinates: this.zonePoints,
        color: this.zoneForm.color,
        number: this.zoneForm.number,
        type: this.zoneForm.type,
        createdAt: new Date(),
        createdBy: currentUser?.uid || 'anonymous',
      };

      console.log('🏗️ Zone object created:', zone);

      try {
        console.log('💾 Saving to Firestore...');
        const zoneId = await this.firestoreService.addZone(zone);
        console.log('💾 Zone saved with ID:', zoneId);

        // No agregar manualmente al mapa - las suscripciones reactivas se encargan
        console.log('✅ Zone will be added via reactive subscription');
      } catch (firestoreError) {
        console.warn(
          '💾 Firestore not available, adding locally only:',
          firestoreError
        );

        // Solo agregar localmente si Firestore falla
        console.log('🗺️ Adding to map service with temp ID...');
        const tempZoneId = Math.random().toString(36).substr(2, 9);
        this.mapService.addZone({ ...zone, id: tempZoneId });
        console.log('🗺️ Zone added to map with temp ID');
      }

      this.showToast('Zona creada correctamente');
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
          this.showToast(
            '🔧 Modo editar activado - Toca elementos para eliminar'
          );
          this.enableDeleteMode();
        } else {
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
  }

  private async confirmDeleteMarker(markerId: string) {
    const toast = await this.toastCtrl.create({
      message: '¿Eliminar este marcador?',
      duration: 5000,
      position: 'bottom',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.deleteMarker(markerId);
          },
        },
      ],
    });
    await toast.present();
  }

  private async confirmDeleteZone(zoneId: string) {
    const toast = await this.toastCtrl.create({
      message: '¿Eliminar esta zona?',
      duration: 5000,
      position: 'bottom',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.deleteZone(zoneId);
          },
        },
      ],
    });
    await toast.present();
  }

  private async deleteMarker(markerId: string) {
    try {
      console.log('🗑️ Deleting marker:', markerId);

      // Solo eliminar de Firestore - las suscripciones reactivas se encargan del mapa
      try {
        await this.firestoreService.deleteMarker(markerId);
        console.log('� Marker deleted from Firestore:', markerId);
        console.log(
          '✅ Marker will be removed from map via reactive subscription'
        );
      } catch (firestoreError) {
        console.warn(
          '💾 Firestore not available for deletion:',
          firestoreError
        );
        // Si Firestore no está disponible, eliminar solo del mapa
        this.mapService.removeMarker(markerId);
        console.log('🗑️ Marker removed from map locally');
      }

      this.showToast('✅ Marcador eliminado');
    } catch (error) {
      console.error('❌ Error deleting marker:', error);
      this.showToast('❌ Error al eliminar marcador');
    }
  }

  private async deleteZone(zoneId: string) {
    try {
      console.log('🗑️ Deleting zone:', zoneId);

      // Solo eliminar de Firestore - las suscripciones reactivas se encargan del mapa
      try {
        await this.firestoreService.deleteZone(zoneId);
        console.log('� Zone deleted from Firestore:', zoneId);
        console.log(
          '✅ Zone will be removed from map via reactive subscription'
        );
      } catch (firestoreError) {
        console.warn(
          '💾 Firestore not available for deletion:',
          firestoreError
        );
        // Si Firestore no está disponible, eliminar solo del mapa
        this.mapService.removeZone(zoneId);
        console.log('🗑️ Zone removed from map locally');
      }

      this.showToast('✅ Zona eliminada');
    } catch (error) {
      console.error('❌ Error deleting zone:', error);
      this.showToast('❌ Error al eliminar zona');
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
}
