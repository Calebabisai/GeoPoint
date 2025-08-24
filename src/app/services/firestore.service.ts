import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collectionData,
  Timestamp,
} from '@angular/fire/firestore';
import { MapMarker } from '../shared/models/marker.model';
import { MapZone } from '../shared/models/zone.model';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);

  // Marcadores
  getMarkers(): Observable<MapMarker[]> {
    const markersCollection = collection(this.firestore, 'markers');
    return collectionData(markersCollection, { idField: 'id' }) as Observable<
      MapMarker[]
    >;
  }

  async addMarker(marker: Omit<MapMarker, 'id'>): Promise<string> {
    const markersCollection = collection(this.firestore, 'markers');
    const markerData = {
      ...marker,
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(markersCollection, markerData);
    return docRef.id;
  }

  async updateMarker(id: string, marker: Partial<MapMarker>): Promise<void> {
    const markerDoc = doc(this.firestore, 'markers', id);
    await updateDoc(markerDoc, { ...marker });
  }

  async deleteMarker(id: string): Promise<void> {
    const markerDoc = doc(this.firestore, 'markers', id);
    await deleteDoc(markerDoc);
  }

  // Zonas
  getZones(): Observable<MapZone[]> {
    const zonesCollection = collection(this.firestore, 'zones');
    return collectionData(zonesCollection, { idField: 'id' }) as Observable<
      MapZone[]
    >;
  }

  async addZone(zone: Omit<MapZone, 'id'>): Promise<string> {
    const zonesCollection = collection(this.firestore, 'zones');
    const zoneData = {
      ...zone,
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(zonesCollection, zoneData);
    return docRef.id;
  }

  async updateZone(id: string, zone: Partial<MapZone>): Promise<void> {
    const zoneDoc = doc(this.firestore, 'zones', id);
    await updateDoc(zoneDoc, { ...zone });
  }

  async deleteZone(id: string): Promise<void> {
    const zoneDoc = doc(this.firestore, 'zones', id);
    await deleteDoc(zoneDoc);
  }

  // Rutas (mantener compatibilidad)
  getRoutes(): Observable<any[]> {
    const routesCollection = collection(this.firestore, 'routes');
    return collectionData(routesCollection, { idField: 'id' });
  }

  async addRoute(route: any): Promise<string> {
    const routesCollection = collection(this.firestore, 'routes');
    const docRef = await addDoc(routesCollection, {
      ...route,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  }
}
