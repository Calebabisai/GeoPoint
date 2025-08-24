import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  docData,
  getDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { MapMarker } from 'src/app/shared/models/marker.model';
import { MapZone } from 'src/app/shared/models/zone.model';
import { MapRoute } from 'src/app/shared/models/route.model';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore: Firestore = inject(Firestore);

  constructor() {}

  getMarkers(): Observable<MapMarker[]> {
    const markersCollection = collection(this.firestore, 'markers');
    return collectionData(markersCollection, { idField: 'id' }) as Observable<
      MapMarker[]
    >;
  }

  addMarker(marker: Omit<MapMarker, 'id'>) {
    const markersCollection = collection(this.firestore, 'markers');
    return addDoc(markersCollection, marker);
  }

  getZones(): Observable<MapZone[]> {
    const zonesCollection = collection(this.firestore, 'zones');
    return collectionData(zonesCollection, { idField: 'id' }) as Observable<
      MapZone[]
    >;
  }

  addZone(zone: Omit<MapZone, 'id'>) {
    const zonesCollection = collection(this.firestore, 'zones');
    return addDoc(zonesCollection, zone);
  }

  getRoutes(): Observable<MapRoute[]> {
    const routesCollection = collection(this.firestore, 'routes');
    return collectionData(routesCollection, { idField: 'id' }) as Observable<
      MapRoute[]
    >;
  }

  addRoute(route: Omit<MapRoute, 'id'>) {
    const routesCollection = collection(this.firestore, 'routes');
    return addDoc(routesCollection, route);
  }
}
