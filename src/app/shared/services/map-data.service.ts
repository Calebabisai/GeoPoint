import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from '../../auth/services/auth.service';
import { OrganizationService } from './organization.service';
import { AuthorizationService } from '../../auth/services/authorization.service';
import { FirestoreService } from '../../services/firestore.service';
import { MapMarker, MapZone, MapPermissions} from '../models/map-data.model';
import { MapMarker as FirestoreMarker } from '../models/marker.model';
import { MapZone as FirestoreZone } from '../models/zone.model';
import { MapRoute } from '../models/route.model';

@Injectable({
  providedIn: 'root',
})
export class MapDataService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private organizationService = inject(OrganizationService);
  private authorizationService = inject(AuthorizationService);
  private firestoreService = inject(FirestoreService);

  // Signals
  private markersSignal = signal<MapMarker[]>([]);
  private zonesSignal = signal<MapZone[]>([]);
  private isLoadingSignal = signal(false);
  private lastErrorSignal = signal<string | null>(null);

  // Agregar signal para rutas
  private routesSignal = signal<MapRoute[]>([]);

  // Readonly exports
  readonly markers = this.markersSignal.asReadonly();
  readonly zones = this.zonesSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();
  readonly routes = this.routesSignal.asReadonly();

  // Computed signals
  readonly hasError = computed(() => this.lastErrorSignal() !== null);
  readonly totalMarkers = computed(() => this.markersSignal().length);
  readonly totalZones = computed(() => this.zonesSignal().length);
  readonly markersByType = computed(() => {
    const byType: Record<string, number> = {};
    this.markersSignal().forEach((marker) => {
      byType[marker.type] = (byType[marker.type] || 0) + 1;
    });
    return byType;
  });
  readonly zonesByType = computed(() => {
    const byType: Record<string, number> = {};
    this.zonesSignal().forEach((zone) => {
      byType[zone.type] = (byType[zone.type] || 0) + 1;
    });
    return byType;
  });

  /**
   * Convierte el tipo de marcador del mapa al formato de Firestore
   */
  private convertMapTypeToFirestore(
    mapType: 'default' | 'warning' | 'danger' | 'success' | 'info'
  ): 'marker' | 'house' | 'poi' {
    switch (mapType) {
      case 'default':
        return 'marker';
      case 'info':
        return 'house';
      case 'success':
        return 'poi';
      case 'warning':
      case 'danger':
      default:
        return 'marker';
    }
  }

  /**
   * Convierte el tipo de zona del mapa al formato de Firestore
   */
  private convertMapZoneTypeToFirestore(
    mapType: 'polygon' | 'circle' | 'rectangle'
  ): 'zone' | 'area' | 'sector' {
    switch (mapType) {
      case 'polygon':
        return 'zone';
      case 'circle':
        return 'area';
      case 'rectangle':
        return 'sector';
      default:
        return 'zone';
    }
  }

  /**
   * Convierte un marcador de Firestore al formato del mapa
   */
  private convertFirestoreMarkerToMapMarker(
    firestoreMarker: FirestoreMarker
  ): MapMarker {
    return {
      id: firestoreMarker.id,
      organizationId: firestoreMarker.organizationId,
      title: firestoreMarker.title,
      description: firestoreMarker.description,
      latitude: firestoreMarker.lat,
      longitude: firestoreMarker.lng,
      type: this.convertMarkerType(firestoreMarker.type),
      iconName: undefined,
      color: firestoreMarker.color,
      createdBy: firestoreMarker.createdBy,
      createdAt: firestoreMarker.createdAt,
      updatedAt: firestoreMarker.createdAt,
      isVisible: true,
      metadata: {
        category: firestoreMarker.type,
        tags: [],
        customFields: {
          number: (firestoreMarker as any).number || 1,
        },
      },
    };
  }

  /**
   * Convierte una zona de Firestore al formato del mapa
   */
  private convertFirestoreZoneToMapZone(firestoreZone: FirestoreZone): MapZone {
    return {
      id: firestoreZone.id,
      organizationId: firestoreZone.organizationId,
      name: firestoreZone.name,
      description: firestoreZone.description,
      type: 'polygon',
      coordinates: {
        polygon: firestoreZone.coordinates.map((coord) => [
          coord.lat,
          coord.lng,
        ]),
      },
      style: {
        fillColor: firestoreZone.color,
        fillOpacity: 0.3,
        strokeColor: firestoreZone.color,
        strokeWeight: 2,
        strokeOpacity: 1,
      },
      createdBy: firestoreZone.createdBy,
      createdAt: firestoreZone.createdAt,
      updatedAt: firestoreZone.createdAt,
      isVisible: true,
      metadata: {
        category: firestoreZone.type,
        tags: [],
        customFields: { number: firestoreZone.number },
      },
    };
  }

  /**
   * Convierte el tipo de marcador de Firestore al formato del mapa
   */
  private convertMarkerType(
    firestoreType: 'marker' | 'house' | 'poi'
  ): 'default' | 'warning' | 'danger' | 'success' | 'info' {
    switch (firestoreType) {
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

  /**
   * Obtiene todos los marcadores de la organización actual desde Firebase
   */
  getMarkers(): Observable<MapMarker[]> {
    return this.firestoreService.getMarkers().pipe(
      map((firestoreMarkers) => {
        const convertedMarkers = firestoreMarkers.map((marker) =>
          this.convertFirestoreMarkerToMapMarker(marker)
        );
        this.markersSignal.set(convertedMarkers);
        return convertedMarkers;
      })
    );
  }

  /**
   * Obtiene todas las zonas de la organización actual desde Firebase
   */
  getZones(): Observable<MapZone[]> {
    return this.firestoreService.getZones().pipe(
      map((firestoreZones) => {
        const convertedZones = firestoreZones.map((zone) =>
          this.convertFirestoreZoneToMapZone(zone)
        );
        this.zonesSignal.set(convertedZones);
        return convertedZones;
      })
    );
  }

  // NUEVO: Método para obtener rutas
  getRoutes(): Observable<MapRoute[]> {
    return this.firestoreService.getRoutes().pipe(
      map((firestoreRoutes) => {
        const convertedRoutes = firestoreRoutes.map((route: any) => ({
          id: route.id,
          name: route.name || '',
          description: route.description || '',
          waypoints: route.waypoints || [],
          color: route.color || '#3388ff',
          width: route.width || 4,
          createdBy: route.createdBy || '',
          createdAt: route.createdAt?.toDate?.() || new Date(),
          organizationId: route.organizationId || '',
        } as MapRoute));
        this.routesSignal.set(convertedRoutes);
        return convertedRoutes;
      })
    );
  }

  /**
   * Obtiene los permisos del usuario actual para mapas
   */
  getMapPermissions(): Observable<MapPermissions> {
    const orgRole = this.organizationService.organizationRole();

    if (!orgRole) {
      return of({
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canEditOwn: false,
        canDeleteOwn: false,
      });
    }

    const isOwner = orgRole === 'owner';
    const isAdmin = orgRole === 'admin';
    const isModerator = orgRole === 'moderator';
    const isUser = orgRole === 'user';

    return of({
      canView: true,
      canCreate: isOwner || isAdmin || isModerator || isUser, // Todos pueden crear marcadores
      canEdit: isOwner || isAdmin || isModerator, // Owner, Admin y Moderator pueden editar
      canDelete: isOwner || isAdmin || isModerator, // Owner, Admin y Moderator pueden eliminar
      canEditOwn: true, // Todos pueden editar los suyos
      canDeleteOwn: true, // Todos pueden eliminar los suyos
    });
  }

  /**
  * Verifica si el usuario puede crear zonas
  */
  canCreateZones(): boolean {
    const orgRole = this.organizationService.organizationRole();
    // Solo owner, admin y moderator pueden crear zonas
    return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'moderator';
  }

  /**
   * Verifica si el usuario puede crear marcadores
   */
  canCreateMarkers(): boolean {
    const orgRole = this.organizationService.organizationRole();
    // Todos los roles pueden crear marcadores
    return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'moderator' || orgRole === 'user';
  }

  /**
   * Verifica si el usuario puede editar/eliminar elementos
   */
  canEditOrDelete(): boolean {
    const orgRole = this.organizationService.organizationRole();
    // Solo owner, admin y moderator pueden activar modo edición
    return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'moderator';
  }       

  /**
   * Crea un nuevo marcador en Firebase
   */
  async createMarker(
    markerData: Omit<
      MapMarker,
      'id' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt'
    >
  ): Promise<MapMarker> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const currentUser = this.authService.getCurrentUser()();
      const currentOrg = this.organizationService.currentOrganization();

      if (!currentUser || !currentOrg) {
        throw new Error('Usuario u organización no encontrados');
      }

      const firestoreMarkerData: Omit<FirestoreMarker, 'id'> = {
        title: markerData.title,
        description: markerData.description || '',
        lat: markerData.latitude,
        lng: markerData.longitude,
        color: markerData.color || '#007bff',
        type: this.convertMapTypeToFirestore(markerData.type),
        createdBy: currentUser.uid,
        organizationId: currentOrg.id,
        createdAt: new Date(),
        number: markerData.metadata?.customFields?.['number'] || 1,
      } as any;

      const savedMarkerId = await this.firestoreService.addMarker(
        firestoreMarkerData
      );

      const savedMarker: FirestoreMarker = {
        ...firestoreMarkerData,
        id: savedMarkerId,
      };

      const convertedMarker = this.convertFirestoreMarkerToMapMarker(savedMarker);
      this.markersSignal.update((markers) => [...markers, convertedMarker]);

      return convertedMarker;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error creando marcador';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Crea una nueva zona en Firebase
   */
  async createZone(
  zoneData: Omit<
    MapZone,
    'id' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt'
  >
): Promise<MapZone> {
  this.isLoadingSignal.set(true);
  this.lastErrorSignal.set(null);

  try {
    const currentUser = this.authService.getCurrentUser()();
    const currentOrg = this.organizationService.currentOrganization();

    if (!currentUser || !currentOrg) {
      throw new Error('Usuario u organización no encontrados');
    }

    // CAMBIO: Verificar específicamente si puede crear zonas
    const orgRole = currentUser.organizationRole;
    if (orgRole !== 'owner' && orgRole !== 'admin' && orgRole !== 'moderator') {
      throw new Error('No tienes permisos para crear zonas. Solo miembros con rol de Moderador o superior.');
    }

    const coordinates = zoneData.coordinates.polygon
      ? zoneData.coordinates.polygon.map((coord) => ({
          lat: coord[0],
          lng: coord[1],
        }))
      : [];

    const zoneNumber = zoneData.metadata?.customFields?.['number'] || 1;

    const firestoreZoneData: Omit<FirestoreZone, 'id'> = {
      name: zoneData.name,
      description: zoneData.description || '',
      coordinates: coordinates,
      color: zoneData.style?.fillColor || '#007bff',
      number: zoneNumber,
      type: this.convertMapZoneTypeToFirestore(zoneData.type),
      createdBy: currentUser.uid,
      organizationId: currentOrg.id,
      createdAt: new Date(),
    };

    const savedZoneId = await this.firestoreService.addZone(firestoreZoneData);

    const savedZone: FirestoreZone = {
      ...firestoreZoneData,
      id: savedZoneId,
    };

    const convertedZone = this.convertFirestoreZoneToMapZone(savedZone);
    this.zonesSignal.update((zones) => [...zones, convertedZone]);

    return convertedZone;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error creando zona';
    this.lastErrorSignal.set(errorMessage);
    throw error;
  } finally {
    this.isLoadingSignal.set(false);
  }
}

  /**
   * Convierte actualizaciones de MapMarker a formato Firestore
   */
  private convertMapMarkerUpdatesToFirestore(
    updates: Partial<MapMarker>
  ): Partial<FirestoreMarker> {
    const firestoreUpdates: Partial<FirestoreMarker> = {};

    if (updates.title !== undefined) firestoreUpdates.title = updates.title;
    if (updates.description !== undefined)
      firestoreUpdates.description = updates.description;
    if (updates.latitude !== undefined) firestoreUpdates.lat = updates.latitude;
    if (updates.longitude !== undefined)
      firestoreUpdates.lng = updates.longitude;
    if (updates.color !== undefined) firestoreUpdates.color = updates.color;
    if (updates.type !== undefined)
      firestoreUpdates.type = this.convertMapTypeToFirestore(updates.type);

    return firestoreUpdates;
  }

  /**
   * Actualiza un marcador en Firebase
   */
  async updateMarker(
    markerId: string,
    updates: Partial<MapMarker>
  ): Promise<void> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const currentUser = this.authService.getCurrentUser()();

      if (!currentUser) {
        throw new Error('Usuario no encontrado');
      }

      const permissions = await this.getMapPermissionsValue();
      if (!permissions?.canEdit) {
        throw new Error('No tienes permisos para editar marcadores');
      }

      const firestoreUpdates = this.convertMapMarkerUpdatesToFirestore(updates);
      await this.firestoreService.updateMarker(markerId, firestoreUpdates);

      this.markersSignal.update((markers) =>
        markers.map((marker) =>
          marker.id === markerId ? { ...marker, ...updates } : marker
        )
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error actualizando marcador';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Elimina un marcador de Firebase
   */
    async deleteMarker(markerId: string): Promise<void> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const currentUser = this.authService.getCurrentUser()();

      if (!currentUser) {
        throw new Error('Usuario no encontrado');
      }

      const permissions = await this.getMapPermissionsValue();
      if (!permissions?.canDelete) {
        throw new Error('No tienes permisos para eliminar marcadores');
      }

      // CAMBIO: Actualización optimista - remover del signal ANTES de la llamada
      this.markersSignal.update((markers) =>
        markers.filter((marker) => marker.id !== markerId)
      );

      // Luego eliminar del backend
      await this.firestoreService.deleteMarker(markerId);
      // El onSnapshot actualizará automáticamente si hay cambios
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error eliminando marcador';
      this.lastErrorSignal.set(errorMessage);
      
      // Si falla, revertir sería complejo, pero onSnapshot lo arreglará
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  async deleteZone(zoneId: string): Promise<void> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const currentUser = this.authService.getCurrentUser()();

      if (!currentUser) {
        throw new Error('Usuario no encontrado');
      }

      const permissions = await this.getMapPermissionsValue();
      if (!permissions?.canDelete) {
        throw new Error('No tienes permisos para eliminar zonas');
      }

      // CAMBIO: Actualización optimista - remover del signal ANTES de la llamada
      this.zonesSignal.update((zones) =>
        zones.filter((zone) => zone.id !== zoneId)
      );

      // Luego eliminar del backend
      await this.firestoreService.deleteZone(zoneId);
      // El onSnapshot actualizará automáticamente si hay cambios
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error eliminando zona';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  // NUEVO: Método para crear rutas
  async createRoute(routeData: {
    name: string;
    description?: string;
    waypoints: [number, number][];
    color?: string;
    width?: number;
  }): Promise<MapRoute> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const currentUser = this.authService.getCurrentUser()();
      const currentOrg = this.organizationService.currentOrganization();

      if (!currentUser || !currentOrg) {
        throw new Error('Usuario u organización no encontrados');
      }

      // Convertir waypoints de [lat, lng][] a {lat, lng}[] para Firebase
      const waypointsAsObjects = routeData.waypoints.map(([lat, lng]) => ({ lat, lng }));

      const firestoreRouteData = {
        name: routeData.name,
        description: routeData.description || '',
        waypoints: waypointsAsObjects, // Ahora es [{lat, lng}, {lat, lng}]
        color: routeData.color || '#3388ff',
        width: routeData.width || 4,
        createdBy: currentUser.uid,
        organizationId: currentOrg.id,
        createdAt: new Date(),
      };

      const savedRouteId = await this.firestoreService.addRoute(firestoreRouteData);

      const savedRoute: MapRoute = {
        ...firestoreRouteData,
        id: savedRouteId,
        waypoints: routeData.waypoints, // Mantener el formato original para el mapa
      };

      this.routesSignal.update((routes) => [...routes, savedRoute]);

      return savedRoute;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error creando línea';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Elimina una ruta
   */
  async deleteRoute(routeId: string): Promise<void> {
    this.isLoadingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      await this.firestoreService.deleteRoute(routeId);
      this.routesSignal.update((routes) =>
        routes.filter((route) => route.id !== routeId)
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error eliminando línea';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Obtiene permisos como Promise (helper interno)
   */
  private async getMapPermissionsValue(): Promise<MapPermissions | null> {
    return new Promise((resolve, reject) => {
      this.getMapPermissions().subscribe({
        next: (permissions) => resolve(permissions),
        error: (error) => reject(error),
      });
    });
  }

  /**
   * Obtiene estadísticas de la organización
   */
  getOrganizationStats(): Observable<{
    totalMarkers: number;
    totalZones: number;
    markersByType: Record<string, number>;
    zonesByType: Record<string, number>;
    lastActivity: Date;
  }> {
    return combineLatest([this.getMarkers(), this.getZones()]).pipe(
      map(([markers, zones]) => {
        const markersByType: Record<string, number> = {};
        const zonesByType: Record<string, number> = {};

        markers.forEach((marker) => {
          markersByType[marker.type] = (markersByType[marker.type] || 0) + 1;
        });

        zones.forEach((zone) => {
          zonesByType[zone.type] = (zonesByType[zone.type] || 0) + 1;
        });

        const lastActivity = Math.max(
          ...markers.map((m) => m.updatedAt.getTime()),
          ...zones.map((z) => z.updatedAt.getTime()),
          0
        );

        return {
          totalMarkers: markers.length,
          totalZones: zones.length,
          markersByType,
          zonesByType,
          lastActivity: new Date(lastActivity),
        };
      })
    );
  }
}
