import { Injectable, inject, signal, computed, Signal } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from '../../auth/services/auth.service';
import { OrganizationService } from './organization.service';
import { AuthorizationService } from '../../auth/services/authorization.service';
import { FirestoreService } from '../../services/firestore.service';
import { MapMarker, MapZone, MapPermissions } from '../models/map-data.model';
import { MapMarker as FirestoreMarker } from '../models/marker.model';
import { MapZone as FirestoreZone } from '../models/zone.model';

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

  // Readonly exports
  readonly markers = this.markersSignal.asReadonly();
  readonly zones = this.zonesSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();

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

  /**
   * Obtiene los permisos del usuario actual para mapas
   */
  getMapPermissions(): Observable<MapPermissions> {
    return this.organizationService.getCurrentOrganizationRole().pipe(
      map((orgRole) => {
        const isAdmin = orgRole === 'owner' || orgRole === 'admin';
        const isModerator = orgRole === 'moderator';
        const isUser = orgRole === 'user';

        return {
          canView: true,
          canCreate: isAdmin || isModerator || isUser,
          canEdit: isAdmin || isModerator,
          canDelete: isAdmin || isModerator,
          canEditOwn: true,
          canDeleteOwn: true,
        };
      })
    );
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

      const permissions = await this.getMapPermissionsValue();
      if (!permissions?.canCreate) {
        throw new Error('No tienes permisos para crear zonas');
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

      await this.firestoreService.deleteMarker(markerId);
      this.markersSignal.update((markers) =>
        markers.filter((marker) => marker.id !== markerId)
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error eliminando marcador';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Elimina una zona de Firebase
   */
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

      await this.firestoreService.deleteZone(zoneId);
      this.zonesSignal.update((zones) =>
        zones.filter((zone) => zone.id !== zoneId)
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error eliminando zona';
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
