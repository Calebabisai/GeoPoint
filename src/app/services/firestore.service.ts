import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, of, take } from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collectionData,
  Timestamp,
  query,
  where,
} from '@angular/fire/firestore';
import { MapMarker } from '../shared/models/marker.model';
import { MapZone } from '../shared/models/zone.model';
import { OrganizationService } from '../shared/services/organization.service';
import { Organization } from '../shared/models/organization.model';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);
  private organizationService = inject(OrganizationService);

  constructor() {
    console.log('🔥 FirestoreService initialized with constructor injection');
  }

  // Marcadores por organización
  getMarkers(): Observable<MapMarker[]> {
    return this.organizationService.getCurrentOrganization().pipe(
      switchMap((org: Organization | null) => {
        if (!org) return of([]);

        const markersCollection = collection(this.firestore, 'markers');
        const q = query(
          markersCollection,
          where('organizationId', '==', org.id)
        );
        return collectionData(q, { idField: 'id' }) as Observable<MapMarker[]>;
      })
    );
  }

  async addMarker(marker: Omit<MapMarker, 'id'>): Promise<string> {
    return new Promise((resolve, reject) => {
      this.organizationService
        .getCurrentOrganization()
        .pipe(take(1))
        .subscribe({
          next: async (currentOrg: Organization | null) => {
            try {
              if (!currentOrg) {
                throw new Error('No hay organización activa');
              }

              const markersCollection = collection(this.firestore, 'markers');
              const markerData = {
                ...marker,
                organizationId: currentOrg.id,
                createdAt: Timestamp.now(),
              };

              console.log('🎯 Adding marker to Firebase:', markerData);
              const docRef = await addDoc(markersCollection, markerData);
              console.log('✅ Marker added with ID:', docRef.id);
              resolve(docRef.id);
            } catch (error) {
              reject(error);
            }
          },
          error: reject,
        });
    });
  }

  async updateMarker(id: string, marker: Partial<MapMarker>): Promise<void> {
    const markerDoc = doc(this.firestore, 'markers', id);
    await updateDoc(markerDoc, { ...marker });
  }

  async deleteMarker(id: string): Promise<void> {
    const markerDoc = doc(this.firestore, 'markers', id);
    await deleteDoc(markerDoc);
  }

  // Zonas por organización
  getZones(): Observable<MapZone[]> {
    return this.organizationService.getCurrentOrganization().pipe(
      switchMap((org: Organization | null) => {
        if (!org) return of([]);

        const zonesCollection = collection(this.firestore, 'zones');
        const q = query(zonesCollection, where('organizationId', '==', org.id));
        return collectionData(q, { idField: 'id' }) as Observable<MapZone[]>;
      })
    );
  }

  async addZone(zone: Omit<MapZone, 'id'>): Promise<string> {
    return new Promise((resolve, reject) => {
      this.organizationService
        .getCurrentOrganization()
        .pipe(take(1))
        .subscribe({
          next: async (currentOrg: Organization | null) => {
            try {
              if (!currentOrg) {
                throw new Error('No hay organización activa');
              }

              const zonesCollection = collection(this.firestore, 'zones');
              const zoneData = {
                ...zone,
                organizationId: currentOrg.id,
                createdAt: Timestamp.now(),
              };

              console.log('🗺️ Adding zone to Firebase:', zoneData);
              const docRef = await addDoc(zonesCollection, zoneData);
              console.log('✅ Zone added with ID:', docRef.id);
              resolve(docRef.id);
            } catch (error) {
              reject(error);
            }
          },
          error: reject,
        });
    });
  }

  async updateZone(id: string, zone: Partial<MapZone>): Promise<void> {
    const zoneDoc = doc(this.firestore, 'zones', id);
    await updateDoc(zoneDoc, { ...zone });
  }

  async deleteZone(id: string): Promise<void> {
    const zoneDoc = doc(this.firestore, 'zones', id);
    await deleteDoc(zoneDoc);
  }

  // Rutas por organización (mantener compatibilidad)
  getRoutes(): Observable<any[]> {
    return this.organizationService.getCurrentOrganization().pipe(
      switchMap((org: Organization | null) => {
        if (!org) return of([]);

        const routesCollection = collection(this.firestore, 'routes');
        const q = query(
          routesCollection,
          where('organizationId', '==', org.id)
        );
        return collectionData(q, { idField: 'id' });
      })
    );
  }

  async addRoute(route: any): Promise<string> {
    return new Promise((resolve, reject) => {
      this.organizationService
        .getCurrentOrganization()
        .pipe(take(1))
        .subscribe({
          next: async (currentOrg: Organization | null) => {
            try {
              if (!currentOrg) {
                throw new Error('No hay organización activa');
              }

              const routesCollection = collection(this.firestore, 'routes');
              const docRef = await addDoc(routesCollection, {
                ...route,
                organizationId: currentOrg.id,
                createdAt: Timestamp.now(),
              });
              resolve(docRef.id);
            } catch (error) {
              reject(error);
            }
          },
          error: reject,
        });
    });
  }
}
