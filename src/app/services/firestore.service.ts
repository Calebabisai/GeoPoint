import { Injectable, inject } from '@angular/core';
import {
  Observable,
  switchMap,
  of,
  take,
  timeout,
  catchError,
  throwError,
  from,
  startWith,
  interval,
  mergeMap,
} from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  query,
  where,
  getDocs,
  QuerySnapshot,
  DocumentData,
} from '@angular/fire/firestore';
import { MapMarker } from '../shared/models/marker.model';
import { MapZone } from '../shared/models/zone.model';
import { OrganizationService } from '../shared/services/organization.service';
import { Organization } from '../shared/models/organization.model';
import { LoggerService } from '../shared/services/logger.service';
import { NetworkService } from '../shared/services/network.service';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);
  private organizationService = inject(OrganizationService);
  private logger = inject(LoggerService);
  private networkService = inject(NetworkService);

  // ✅ Timeout para operaciones de Firestore (en milisegundos)
  private readonly FIRESTORE_TIMEOUT = 30000; // 30 segundos

  constructor() {
    this.logger.firebase(
      'FirestoreService initialized - using getDocs() polling instead of real-time listeners'
    );
  }

  // Marcadores por organización
  // ✅ CAMBIADO: Usar getDocs() con polling en lugar de collectionData() real-time listener
  getMarkers(): Observable<MapMarker[]> {
    this.logger.firebase('🔍 getMarkers() called');
    return this.organizationService.getCurrentOrganization().pipe(
      switchMap((org: Organization | null) => {
        if (!org) {
          this.logger.warn(
            '❌ No organization available - returning empty markers'
          );
          return of([]);
        }

        this.logger.firebase(
          `✅ Organization available: ${org.name} (${org.id})`
        );
        this.logger.firebase(`🔍 Querying markers for organization: ${org.id}`);

        const markersCollection = collection(this.firestore, 'markers');
        const q = query(
          markersCollection,
          where('organizationId', '==', org.id)
        );

        // ✅ Polling cada 5 segundos usando getDocs() en lugar de listener en tiempo real
        return interval(5000).pipe(
          startWith(0), // Ejecutar inmediatamente
          mergeMap(() => from(getDocs(q))),
          timeout(this.FIRESTORE_TIMEOUT),
          catchError((error) => {
            if (error.name === 'TimeoutError') {
              this.logger.error(
                `⏱️ TIMEOUT al cargar marcadores para org: ${org.id} después de ${this.FIRESTORE_TIMEOUT}ms`
              );
              this.logger.error(
                '🔧 Verifica: 1) Reglas de Firestore, 2) Conexión a internet, 3) Índices de Firestore'
              );
            } else {
              this.logger.error('❌ Error al cargar marcadores:', error);
            }
            return of(null); // Retornar null para que el map siguiente lo maneje
          }),
          switchMap((snapshot: QuerySnapshot<DocumentData> | null) => {
            if (!snapshot) {
              return of([]);
            }

            const markers: MapMarker[] = [];
            snapshot.forEach((doc) => {
              markers.push({ id: doc.id, ...doc.data() } as MapMarker);
            });

            this.logger.firebase(
              `✅ Loaded ${markers.length} markers from Firestore`
            );
            return of(markers);
          })
        );
      })
    );
  }

  async addMarker(marker: Omit<MapMarker, 'id'>): Promise<string> {
    // ✅ Verificar conexión antes de intentar guardar
    if (this.networkService.isOffline()) {
      this.logger.warn('Sin conexión. Guardando marcador en cola offline...');
      this.networkService.queueOperation({
        type: 'create',
        collection: 'markers',
        data: marker,
      });
      throw new Error(
        'Sin conexión. El marcador se guardará cuando vuelva la conexión.'
      );
    }

    return new Promise((resolve, reject) => {
      this.organizationService
        .getCurrentOrganization()
        .pipe(take(1), timeout(this.FIRESTORE_TIMEOUT))
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

              this.logger.firebase('Adding marker', markerData);
              const docRef = await addDoc(markersCollection, markerData);
              this.logger.firebase('Marker added with ID:', docRef.id);
              resolve(docRef.id);
            } catch (error) {
              this.logger.error('Error adding marker:', error);
              reject(error);
            }
          },
          error: (error) => {
            if (error.name === 'TimeoutError') {
              this.logger.error('Timeout al agregar marcador');
              reject(
                new Error('La operación tardó demasiado. Intenta nuevamente.')
              );
            } else {
              reject(error);
            }
          },
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
  // ✅ CAMBIADO: Usar getDocs() con polling en lugar de collectionData() real-time listener
  getZones(): Observable<MapZone[]> {
    this.logger.firebase('🔍 getZones() called');
    return this.organizationService.getCurrentOrganization().pipe(
      switchMap((org: Organization | null) => {
        if (!org) {
          this.logger.warn(
            '❌ No organization available - returning empty zones'
          );
          return of([]);
        }

        this.logger.firebase(
          `✅ Organization available: ${org.name} (${org.id})`
        );
        this.logger.firebase(`🔍 Querying zones for organization: ${org.id}`);

        const zonesCollection = collection(this.firestore, 'zones');
        const q = query(zonesCollection, where('organizationId', '==', org.id));

        // ✅ Polling cada 5 segundos usando getDocs() en lugar de listener en tiempo real
        return interval(5000).pipe(
          startWith(0), // Ejecutar inmediatamente
          mergeMap(() => from(getDocs(q))),
          timeout(this.FIRESTORE_TIMEOUT),
          catchError((error) => {
            if (error.name === 'TimeoutError') {
              this.logger.error(
                `⏱️ TIMEOUT al cargar zonas para org: ${org.id} después de ${this.FIRESTORE_TIMEOUT}ms`
              );
              this.logger.error(
                '🔧 Verifica: 1) Reglas de Firestore, 2) Conexión a internet, 3) Índices de Firestore'
              );
            } else {
              this.logger.error('❌ Error al cargar zonas:', error);
            }
            return of(null);
          }),
          switchMap((snapshot: QuerySnapshot<DocumentData> | null) => {
            if (!snapshot) {
              return of([]);
            }

            const zones: MapZone[] = [];
            snapshot.forEach((doc) => {
              zones.push({ id: doc.id, ...doc.data() } as MapZone);
            });

            this.logger.firebase(
              `✅ Loaded ${zones.length} zones from Firestore`
            );
            return of(zones);
          })
        );
      })
    );
  }

  async addZone(zone: Omit<MapZone, 'id'>): Promise<string> {
    // ✅ Verificar conexión
    if (this.networkService.isOffline()) {
      this.logger.warn('Sin conexión. Guardando zona en cola offline...');
      this.networkService.queueOperation({
        type: 'create',
        collection: 'zones',
        data: zone,
      });
      throw new Error(
        'Sin conexión. La zona se guardará cuando vuelva la conexión.'
      );
    }

    return new Promise((resolve, reject) => {
      this.organizationService
        .getCurrentOrganization()
        .pipe(take(1), timeout(this.FIRESTORE_TIMEOUT))
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

              this.logger.firebase('Adding zone', zoneData);
              const docRef = await addDoc(zonesCollection, zoneData);
              this.logger.firebase('Zone added with ID:', docRef.id);
              resolve(docRef.id);
            } catch (error) {
              this.logger.error('Error adding zone:', error);
              reject(error);
            }
          },
          error: (error) => {
            if (error.name === 'TimeoutError') {
              this.logger.error('Timeout al agregar zona');
              reject(
                new Error('La operación tardó demasiado. Intenta nuevamente.')
              );
            } else {
              reject(error);
            }
          },
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
  // ✅ CAMBIADO: Usar getDocs() con polling en lugar de collectionData() real-time listener
  getRoutes(): Observable<any[]> {
    return this.organizationService.getCurrentOrganization().pipe(
      switchMap((org: Organization | null) => {
        if (!org) return of([]);

        const routesCollection = collection(this.firestore, 'routes');
        const q = query(
          routesCollection,
          where('organizationId', '==', org.id)
        );

        // ✅ Polling cada 5 segundos usando getDocs()
        return interval(5000).pipe(
          startWith(0),
          mergeMap(() => from(getDocs(q))),
          timeout(this.FIRESTORE_TIMEOUT),
          catchError((error) => {
            this.logger.error('Error al cargar rutas:', error);
            return of(null);
          }),
          switchMap((snapshot: QuerySnapshot<DocumentData> | null) => {
            if (!snapshot) return of([]);

            const routes: any[] = [];
            snapshot.forEach((doc) => {
              routes.push({ id: doc.id, ...doc.data() });
            });
            return of(routes);
          })
        );
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
