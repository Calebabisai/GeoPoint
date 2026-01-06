import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  Observable,
  switchMap,
  of,
  startWith,
  shareReplay,
  BehaviorSubject,
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
  onSnapshot,
} from '@angular/fire/firestore';
import { MapMarker } from '../shared/models/marker.model';
import { MapZone } from '../shared/models/zone.model';
import { OrganizationService } from '../shared/services/organization.service';
import { Organization } from '../shared/models/organization.model';
import { LoggerService } from '../shared/services/logger.service';
import { NetworkService } from '../shared/services/network.service';

export interface FirestoreState {
  isLoading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export interface OfflineOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  data?: unknown;
  id?: string;
}

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private readonly firestore = inject(Firestore);
  private readonly organizationService = inject(OrganizationService);
  private readonly logger = inject(LoggerService);
  private readonly networkService = inject(NetworkService);

  // Configuración
  private readonly FIRESTORE_TIMEOUT = 30000;

  // BehaviorSubject para la organización actual (reactivo)
  private currentOrg$ = new BehaviorSubject<Organization | null>(null);

  // Signals para estado
  private readonly _markersState = signal<FirestoreState>({
    isLoading: false,
    error: null,
    lastSync: null,
  });
  private readonly _zonesState = signal<FirestoreState>({
    isLoading: false,
    error: null,
    lastSync: null,
  });
  private readonly _routesState = signal<FirestoreState>({
    isLoading: false,
    error: null,
    lastSync: null,
  });

  // Signals públicos (solo lectura)
  readonly markersState = this._markersState.asReadonly();
  readonly zonesState = this._zonesState.asReadonly();
  readonly routesState = this._routesState.asReadonly();

  // Computed
  readonly isAnyLoading = computed(
    () =>
      this._markersState().isLoading ||
      this._zonesState().isLoading ||
      this._routesState().isLoading
  );

  readonly hasErrors = computed(
    () =>
      !!this._markersState().error ||
      !!this._zonesState().error ||
      !!this._routesState().error
  );

  // Cache de observables para evitar múltiples subscripciones
  private markersCache$: Observable<MapMarker[]> | null = null;
  private zonesCache$: Observable<MapZone[]> | null = null;
  private routesCache$: Observable<unknown[]> | null = null;

  constructor() {
    this.logger.firebase('FirestoreService initialized - using onSnapShot for real-time updates');
    
    // Effect para sincronizar el signal de organización con el BehaviorSubject
    effect(() => {
      const org = this.organizationService.currentOrganization();
      this.logger.firebase('Organization changed:', org?.name || 'null');
      this.currentOrg$.next(org);
    });
  }

  // Markers per organization
  getMarkers(): Observable<MapMarker[]> {
    if (this.markersCache$) {
      return this.markersCache$;
    }

    this.markersCache$ = this.currentOrg$.pipe(
      switchMap((org) => this.fetchMarkersForOrg(org)),
      shareReplay(1)
    );

    return this.markersCache$;
  }

    private fetchMarkersForOrg(org: Organization | null): Observable<MapMarker[]> {
      if (!org) {
        this.logger.warn('No organization available - returning empty markers');
        return of([]);
      }

      this._markersState.update((state) => ({ ...state, isLoading: true, error: null }));

      const markersCollection = collection(this.firestore, 'markers');
      const q = query(markersCollection, where('organizationId', '==', org.id));

      // CAMBIO: Usar onSnapshot en lugar de polling
      return new Observable<MapMarker[]>((subscriber) => {
        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const items = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as MapMarker[];

            this._markersState.update((state) => ({
              ...state,
              isLoading: false,
              error: null,
              lastSync: new Date(),
            }));

            subscriber.next(items);
          },
          (error) => {
            const errorMessage = this.handleFirestoreError(error, 'markers');
            this._markersState.update((state) => ({
              ...state,
              isLoading: false,
              error: errorMessage,
            }));
            subscriber.error(error);
          }
        );

        // Cleanup
        return () => unsubscribe();
      }).pipe(
        startWith([]), // Emitir array vacío mientras carga
        shareReplay(1)
      );
    }

  async addMarker(marker: Omit<MapMarker, 'id'>): Promise<string> {
    this.ensureOnlineOrQueue('markers', 'create', marker);

    const currentOrg = await this.getCurrentOrgOrThrow();
    const markersCollection = collection(this.firestore, 'markers');

    const markerData = {
      ...marker,
      organizationId: currentOrg.id,
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

  // ==================== ZONES ====================

  getZones(): Observable<MapZone[]> {
    if (this.zonesCache$) {
      return this.zonesCache$;
    }

    // Cambiar de getCurrentOrganization() a currentOrg$
    this.zonesCache$ = this.currentOrg$.pipe(
      switchMap((org) => this.fetchZonesForOrg(org)),
      shareReplay(1)
    );

    return this.zonesCache$;
  }
  //Obtener zonas para una organización
  private fetchZonesForOrg(org: Organization | null): Observable<MapZone[]> {
    if (!org) {
      this.logger.warn('No organization available - returning empty zones');
      return of([]);
    }

    this._zonesState.update((state) => ({ ...state, isLoading: true, error: null }));

    const zonesCollection = collection(this.firestore, 'zones');
    const q = query(zonesCollection, where('organizationId', '==', org.id));

    // CAMBIO: Usar onSnapshot en lugar de polling
    return new Observable<MapZone[]>((subscriber) => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as MapZone[];

          this._zonesState.update((state) => ({
            ...state,
            isLoading: false,
            error: null,
            lastSync: new Date(),
          }));

          subscriber.next(items);
        },
        (error) => {
          const errorMessage = this.handleFirestoreError(error, 'zones');
          this._zonesState.update((state) => ({
            ...state,
            isLoading: false,
            error: errorMessage,
          }));
          subscriber.error(error);
        }
      );

      // Cleanup
      return () => unsubscribe();
    }).pipe(
      startWith([]), // Emitir array vacío mientras carga
      shareReplay(1)
    );
  }

  async addZone(zone: Omit<MapZone, 'id'>): Promise<string> {
    this.ensureOnlineOrQueue('zones', 'create', zone);

    const currentOrg = await this.getCurrentOrgOrThrow();
    const zonesCollection = collection(this.firestore, 'zones');

    const zoneData = {
      ...zone,
      organizationId: currentOrg.id,
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


  // ==================== ROUTES ====================

  getRoutes(): Observable<unknown[]> {
    if (this.routesCache$) {
      return this.routesCache$;
    }

    this.routesCache$ = this.currentOrg$.pipe(
      switchMap((org) => this.fetchRoutesForOrg(org)),
      shareReplay(1)
    );

    return this.routesCache$;
  }

  private fetchRoutesForOrg(org: Organization | null): Observable<unknown[]> {
    if (!org) {
      this.logger.warn('No organization available - returning empty routes');
      return of([]);
    }

    this._routesState.update((state) => ({ ...state, isLoading: true, error: null }));

    const routesCollection = collection(this.firestore, 'routes');
    const q = query(routesCollection, where('organizationId', '==', org.id));

    // CAMBIO: Usar onSnapshot en lugar de polling
    return new Observable<unknown[]>((subscriber) => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          this._routesState.update((state) => ({
            ...state,
            isLoading: false,
            error: null,
            lastSync: new Date(),
          }));

          subscriber.next(items);
        },
        (error) => {
          const errorMessage = this.handleFirestoreError(error, 'routes');
          this._routesState.update((state) => ({
            ...state,
            isLoading: false,
            error: errorMessage,
          }));
          subscriber.error(error);
        }
      );

      // Cleanup cuando se desuscriba
      return () => unsubscribe();
    }).pipe(
      startWith([]), // Emitir array vacío mientras carga
      shareReplay(1)
    );
  }

  async addRoute(route: unknown): Promise<string> {
    const currentOrg = await this.getCurrentOrgOrThrow();
    const routesCollection = collection(this.firestore, 'routes');

    const docRef = await addDoc(routesCollection, {
      ...(route as object),
      organizationId: currentOrg.id,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  }

  // ==================== HELPERS ====================

  private getStateSignal(collectionName: string) {
    switch (collectionName) {
      case 'markers':
        return this._markersState;
      case 'zones':
        return this._zonesState;
      case 'routes':
        return this._routesState;
      default:
        return this._markersState;
    }
  }

  private handleFirestoreError(error: unknown, collectionName: string): string {
    const err = error as { name?: string };
    
    if (err.name === 'TimeoutError') {
      this.logger.error(
        `Timeout loading ${collectionName} after ${this.FIRESTORE_TIMEOUT}ms`
      );
      return 'La operación tardó demasiado. Verifica tu conexión.';
    }

    this.logger.error(`Error loading ${collectionName}:`, error);
    return 'Error al cargar datos. Intenta nuevamente.';
  }

  private ensureOnlineOrQueue(
    collectionName: string,
    type: OfflineOperation['type'],
    data?: unknown
  ): void {
    if (this.networkService.isOffline()) {
      this.logger.warn(`Sin conexión. Guardando en cola offline...`);
      this.networkService.queueOperation({ type, collection: collectionName, data });
      throw new Error('Sin conexión. Se guardará cuando vuelva la conexión.');
    }
  }

  // También actualizar getCurrentOrgOrThrow para usar el BehaviorSubject
  private async getCurrentOrgOrThrow(): Promise<Organization> {
    const org = this.currentOrg$.getValue();
    if (!org) {
      throw new Error('No hay organización activa');
    }
    return org;
  }

  // ==================== PUBLIC UTILITIES ====================

  /**
   * Invalida todos los caches para forzar recarga
   */
  invalidateAllCaches(): void {
    this.markersCache$ = null;
    this.zonesCache$ = null;
    this.routesCache$ = null;
  }

  /**
   * Limpia errores de estado
   */
  clearErrors(): void {
    this._markersState.update((state) => ({ ...state, error: null }));
    this._zonesState.update((state) => ({ ...state, error: null }));
    this._routesState.update((state) => ({ ...state, error: null }));
  }
}
