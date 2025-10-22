import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Network } from '@capacitor/network';
import { Platform } from '@ionic/angular/standalone';
import { LoggerService } from './logger.service';

export interface NetworkStatus {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
  isOnline: boolean;
}

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  data: any;
  timestamp: number;
}

/**
 * Servicio para manejar el estado de la conexión de red
 * y operaciones offline
 */
@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private networkStatusSubject = new BehaviorSubject<NetworkStatus>({
    connected: true,
    connectionType: 'unknown',
    isOnline: true,
  });

  private operationsQueue: QueuedOperation[] = [];
  private readonly QUEUE_KEY = 'geopoint_offline_queue';

  public networkStatus$ = this.networkStatusSubject.asObservable();

  constructor(private platform: Platform, private logger: LoggerService) {
    this.initializeNetworkMonitoring();
    this.loadQueueFromStorage();

    // Exponer para debugging
    if (typeof window !== 'undefined') {
      (window as any).networkService = this;
      this.logger.log('🌐 NetworkService exposed globally');
    }
  }

  /**
   * Inicializa el monitoreo de red
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    if (this.platform.is('capacitor')) {
      // En dispositivo móvil, usar Capacitor Network Plugin
      await this.initializeCapacitorNetwork();
    } else {
      // En navegador, usar Navigator API
      this.initializeBrowserNetwork();
    }

    this.logger.log('🌐 Network monitoring initialized');
  }

  /**
   * Inicializa monitoreo en dispositivos móviles (Capacitor)
   */
  private async initializeCapacitorNetwork(): Promise<void> {
    try {
      // Obtener estado inicial
      const status = await Network.getStatus();
      this.updateNetworkStatus({
        connected: status.connected,
        connectionType: status.connectionType as any,
        isOnline: status.connected,
      });

      // Escuchar cambios en el estado de la red
      Network.addListener('networkStatusChange', (status) => {
        this.logger.log('🌐 Network status changed:', status);

        this.updateNetworkStatus({
          connected: status.connected,
          connectionType: status.connectionType as any,
          isOnline: status.connected,
        });

        // Si volvió la conexión, procesar cola
        if (status.connected) {
          this.processOfflineQueue();
        }
      });

      this.logger.log('✅ Capacitor Network monitoring enabled');
    } catch (error) {
      this.logger.error('❌ Error initializing Capacitor Network:', error);
      // Fallback a navegador
      this.initializeBrowserNetwork();
    }
  }

  /**
   * Inicializa monitoreo en navegador
   */
  private initializeBrowserNetwork(): void {
    // Estado inicial
    this.updateNetworkStatus({
      connected: navigator.onLine,
      connectionType: navigator.onLine ? 'unknown' : 'none',
      isOnline: navigator.onLine,
    });

    // Escuchar eventos online/offline
    fromEvent(window, 'online').subscribe(() => {
      this.logger.log('🌐 Browser went online');
      this.updateNetworkStatus({
        connected: true,
        connectionType: 'unknown',
        isOnline: true,
      });
      this.processOfflineQueue();
    });

    fromEvent(window, 'offline').subscribe(() => {
      this.logger.warn('⚠️ Browser went offline');
      this.updateNetworkStatus({
        connected: false,
        connectionType: 'none',
        isOnline: false,
      });
    });

    this.logger.log('✅ Browser Network monitoring enabled');
  }

  /**
   * Actualiza el estado de la red
   */
  private updateNetworkStatus(status: NetworkStatus): void {
    this.networkStatusSubject.next(status);

    // Mostrar notificación al usuario si cambió el estado
    const currentStatus = this.networkStatusSubject.value;
    if (currentStatus.isOnline !== status.isOnline) {
      if (status.isOnline) {
        this.logger.log('✅ Conexión restaurada');
      } else {
        this.logger.warn('⚠️ Sin conexión a internet');
      }
    }
  }

  /**
   * Obtiene el estado actual de la red
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatusSubject.value;
  }

  /**
   * Verifica si hay conexión
   */
  isOnline(): boolean {
    return this.networkStatusSubject.value.isOnline;
  }

  /**
   * Verifica si está offline
   */
  isOffline(): boolean {
    return !this.networkStatusSubject.value.isOnline;
  }

  /**
   * Agrega una operación a la cola offline
   */
  queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp'>): void {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.operationsQueue.push(queuedOp);
    this.saveQueueToStorage();

    this.logger.log('📥 Operation queued for offline processing:', queuedOp);
  }

  /**
   * Procesa la cola de operaciones pendientes
   */
  async processOfflineQueue(): Promise<void> {
    if (this.operationsQueue.length === 0) {
      this.logger.log('✅ No pending operations in queue');
      return;
    }

    if (this.isOffline()) {
      this.logger.warn('⚠️ Still offline, cannot process queue');
      return;
    }

    this.logger.log(
      `🔄 Processing ${this.operationsQueue.length} queued operations...`
    );

    const operations = [...this.operationsQueue];
    this.operationsQueue = [];

    let successCount = 0;
    let failCount = 0;

    for (const operation of operations) {
      try {
        await this.executeQueuedOperation(operation);
        successCount++;
        this.logger.log('✅ Operation processed:', operation.id);
      } catch (error) {
        failCount++;
        this.logger.error(
          '❌ Failed to process operation:',
          operation.id,
          error
        );
        // Volver a agregar a la cola si falla
        this.operationsQueue.push(operation);
      }
    }

    this.saveQueueToStorage();

    this.logger.log(
      `✅ Queue processing complete: ${successCount} success, ${failCount} failed`
    );
  }

  /**
   * Ejecuta una operación de la cola
   * TODO: Implementar lógica específica según la operación
   */
  private async executeQueuedOperation(
    operation: QueuedOperation
  ): Promise<void> {
    this.logger.log('🔄 Executing queued operation:', operation);

    // Aquí deberías llamar a los servicios correspondientes
    // según el tipo de operación y colección
    // Ejemplo:
    // if (operation.collection === 'markers') {
    //   await this.firestoreService.addMarker(operation.data);
    // }

    // Por ahora solo simulamos
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Obtiene el número de operaciones pendientes
   */
  getPendingOperationsCount(): number {
    return this.operationsQueue.length;
  }

  /**
   * Limpia la cola de operaciones
   */
  clearQueue(): void {
    this.operationsQueue = [];
    this.saveQueueToStorage();
    this.logger.log('🗑️ Operation queue cleared');
  }

  /**
   * Guarda la cola en localStorage
   */
  private saveQueueToStorage(): void {
    try {
      localStorage.setItem(
        this.QUEUE_KEY,
        JSON.stringify(this.operationsQueue)
      );
    } catch (error) {
      this.logger.error('❌ Error saving queue to storage:', error);
    }
  }

  /**
   * Carga la cola desde localStorage
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.QUEUE_KEY);
      if (stored) {
        this.operationsQueue = JSON.parse(stored);
        this.logger.log(
          `📥 Loaded ${this.operationsQueue.length} operations from storage`
        );
      }
    } catch (error) {
      this.logger.error('❌ Error loading queue from storage:', error);
      this.operationsQueue = [];
    }
  }

  /**
   * Espera hasta que haya conexión (con timeout)
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    if (this.isOnline()) {
      return true;
    }

    this.logger.log(`⏳ Waiting for connection (timeout: ${timeoutMs}ms)...`);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        this.logger.warn('⏱️ Connection timeout reached');
        resolve(false);
      }, timeoutMs);

      const subscription = this.networkStatus$.subscribe((status) => {
        if (status.isOnline) {
          clearTimeout(timeout);
          subscription.unsubscribe();
          this.logger.log('✅ Connection established');
          resolve(true);
        }
      });
    });
  }

  /**
   * Verifica la conexión actual
   */
  async checkConnection(): Promise<NetworkStatus> {
    if (this.platform.is('capacitor')) {
      try {
        const status = await Network.getStatus();
        return {
          connected: status.connected,
          connectionType: status.connectionType as any,
          isOnline: status.connected,
        };
      } catch (error) {
        this.logger.error('Error checking network status:', error);
        return this.getNetworkStatus();
      }
    } else {
      return {
        connected: navigator.onLine,
        connectionType: navigator.onLine ? 'unknown' : 'none',
        isOnline: navigator.onLine,
      };
    }
  }
}
