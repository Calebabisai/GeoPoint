import { Injectable } from '@angular/core';
import { Observable, combineLatest, firstValueFrom } from 'rxjs';
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
  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private organizationService: OrganizationService,
    private authorizationService: AuthorizationService,
    private firestoreService: FirestoreService
  ) {
    console.log('🗺️ MapDataService initialized with Firebase real-time sync');
    // Exponer para debugging
    if (typeof window !== 'undefined') {
      (window as any).mapDataService = this;
      console.log('🗺️ MapDataService exposed globally');
    }
  }

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
      updatedAt: firestoreMarker.createdAt, // Usamos createdAt si no hay updatedAt
      isVisible: true,
      metadata: {
        category: firestoreMarker.type,
        tags: [],
        customFields: {
          number: (firestoreMarker as any).number || 1, // ✅ EXTRAER el número del marcador
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
      type: 'polygon', // Por defecto polygon
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
    console.log('🔄 MapDataService: Getting markers from Firestore...');
    return this.firestoreService.getMarkers().pipe(
      map((firestoreMarkers) => {
        console.log(
          '📍 MapDataService: Raw Firestore markers:',
          firestoreMarkers.length
        );
        const convertedMarkers = firestoreMarkers.map((marker) =>
          this.convertFirestoreMarkerToMapMarker(marker)
        );
        console.log(
          '📍 MapDataService: Converted markers:',
          convertedMarkers.length
        );
        return convertedMarkers;
      })
    );
  }

  /**
   * Obtiene todas las zonas de la organización actual desde Firebase
   */
  getZones(): Observable<MapZone[]> {
    console.log('🔄 MapDataService: Getting zones from Firestore...');
    return this.firestoreService.getZones().pipe(
      map((firestoreZones) => {
        console.log(
          '🏗️ MapDataService: Raw Firestore zones:',
          firestoreZones.length
        );
        const convertedZones = firestoreZones.map((zone) =>
          this.convertFirestoreZoneToMapZone(zone)
        );
        console.log(
          '🏗️ MapDataService: Converted zones:',
          convertedZones.length
        );
        return convertedZones;
      })
    );
  }

  /**
   * Obtiene los permisos del usuario actual para mapas
   */
  getMapPermissions(): Observable<MapPermissions> {
    return combineLatest([
      this.authorizationService.getCurrentUserRole(),
      this.organizationService.getCurrentOrganizationRole(),
    ]).pipe(
      map(([userRole, orgRole]) => {
        const isAdmin =
          userRole === 'admin' || orgRole === 'owner' || orgRole === 'admin';
        const isModerator = orgRole === 'moderator';
        const isUser = orgRole === 'user';

        const permissions = {
          canView: true, // Todos los miembros pueden ver
          canCreate: isAdmin || isModerator || isUser, // Todos los miembros pueden crear
          canEdit: isAdmin || isModerator,
          canDelete: isAdmin || isModerator,
          canEditOwn: true, // Pueden editar sus propios elementos
          canDeleteOwn: true, // Pueden eliminar sus propios elementos
        };

        console.log(`🔐 Map permissions calculated:`, {
          userRole,
          orgRole,
          isAdmin,
          isModerator,
          isUser,
          permissions,
        });

        return permissions;
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
    try {
      // Obtener usuario y organización actual
      const currentUser = await firstValueFrom(
        this.authService.getCurrentUser()
      );
      const currentOrg = await firstValueFrom(
        this.organizationService.getCurrentOrganization()
      );

      console.log('🔄 Creating marker with:', {
        hasUser: !!currentUser,
        hasOrg: !!currentOrg,
        userEmail: currentUser?.email,
        orgName: currentOrg?.name,
      });

      if (!currentUser || !currentOrg) {
        console.error('❌ Missing user or organization:', {
          currentUser,
          currentOrg,
        });
        throw new Error('Usuario u organización no encontrados');
      }

      // Crear el marcador en formato Firestore
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
        // ✅ AGREGAR el número del marcador
        number: markerData.metadata?.customFields?.['number'] || 1,
      } as any;

      // Guardar en Firebase
      const savedMarkerId = await this.firestoreService.addMarker(
        firestoreMarkerData
      );

      // Crear el objeto completo con el ID devuelto
      const savedMarker: FirestoreMarker = {
        ...firestoreMarkerData,
        id: savedMarkerId,
      };

      console.log(`✅ Marker created successfully in Firebase:`, {
        id: savedMarker.id,
        title: savedMarker.title,
        orgId: currentOrg.id,
      });

      // Convertir y retornar en formato MapMarker
      return this.convertFirestoreMarkerToMapMarker(savedMarker);
    } catch (error) {
      console.error('❌ Error creating marker:', error);
      throw error;
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
    const currentUser = await firstValueFrom(this.authService.getCurrentUser());
    const currentOrg = await firstValueFrom(
      this.organizationService.getCurrentOrganization()
    );

    if (!currentUser || !currentOrg) {
      throw new Error('Usuario u organización no encontrados');
    }

    // Verificar permisos
    const permissions = await firstValueFrom(this.getMapPermissions());
    if (!permissions?.canCreate) {
      throw new Error('No tienes permisos para crear zonas');
    }

    // Convertir coordenadas del formato MapZone al formato FirestoreZone
    const coordinates = zoneData.coordinates.polygon
      ? zoneData.coordinates.polygon.map((coord) => ({
          lat: coord[0],
          lng: coord[1],
        }))
      : [];

    // Crear la zona en formato Firestore
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

    // Guardar en Firebase
    const savedZoneId = await this.firestoreService.addZone(firestoreZoneData);

    // Crear el objeto completo con el ID devuelto
    const savedZone: FirestoreZone = {
      ...firestoreZoneData,
      id: savedZoneId,
    };

    console.log(
      `📐 Zone created in Firebase: ${savedZone.name} in ${currentOrg.name}`
    );

    // Convertir y retornar en formato MapZone
    return this.convertFirestoreZoneToMapZone(savedZone);
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
    const currentUser = await firstValueFrom(this.authService.getCurrentUser());

    if (!currentUser) {
      throw new Error('Usuario no encontrado');
    }

    const permissions = await firstValueFrom(this.getMapPermissions());
    if (!permissions?.canEdit) {
      throw new Error('No tienes permisos para editar marcadores');
    }

    // Convertir actualizaciones al formato Firestore
    const firestoreUpdates = this.convertMapMarkerUpdatesToFirestore(updates);

    // Actualizar en Firebase usando el FirestoreService
    await this.firestoreService.updateMarker(markerId, firestoreUpdates);

    console.log(`📍 Marker updated in Firebase: ${markerId}`);
  }

  /**
   * Elimina un marcador de Firebase
   */
  async deleteMarker(markerId: string): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.getCurrentUser());

    if (!currentUser) {
      throw new Error('Usuario no encontrado');
    }

    const permissions = await firstValueFrom(this.getMapPermissions());
    if (!permissions?.canDelete) {
      throw new Error('No tienes permisos para eliminar marcadores');
    }

    // Eliminar de Firebase usando el FirestoreService
    await this.firestoreService.deleteMarker(markerId);

    console.log(`🗑️ Marker deleted from Firebase: ${markerId}`);
  }

  /**
   * Elimina una zona de Firebase
   */
  async deleteZone(zoneId: string): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.getCurrentUser());

    if (!currentUser) {
      throw new Error('Usuario no encontrado');
    }

    const permissions = await firstValueFrom(this.getMapPermissions());
    if (!permissions?.canDelete) {
      throw new Error('No tienes permisos para eliminar zonas');
    }

    // Eliminar de Firebase usando el FirestoreService
    await this.firestoreService.deleteZone(zoneId);

    console.log(`�️ Zone deleted from Firebase: ${zoneId}`);
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
