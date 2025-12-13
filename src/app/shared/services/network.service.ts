import { Injectable, inject, signal, computed } from '@angular/core';
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
  private platform = inject(Platform);
  private logger = inject(LoggerService);

  // Signals
  private networkStatusSignal = signal<NetworkStatus>({
    connected: true,
    connectionType: 'unknown',
    isOnline: true,
  });

  private operationsQueueSignal = signal<QueuedOperation[]>([]);

  // Readonly exports
  readonly networkStatus = this.networkStatusSignal.asReadonly();
  readonly operationsQueue = this.operationsQueueSignal.asReadonly();

  // Computed signals
  readonly isOnlineComputed = computed(() => this.networkStatusSignal().isOnline);
  readonly isOfflineComputed = computed(() => !this.networkStatusSignal().isOnline);
  readonly pendingOperationsCount = computed(
    () => this.operationsQueueSignal().length
  );
  readonly hasOfflineOperations = computed(
    () => this.operationsQueueSignal().length > 0
  );

  private readonly QUEUE_KEY = 'geopoint_offline_queue';

  constructor() {
    this.initializeNetworkMonitoring();
    this.loadQueueFromStorage();

    // Exponer para debugging
    if (typeof window !== 'undefined') {
      (window as any).networkService = this;
      this.logger.log('Network Service exposed globally');
    }
  }

  /**
   * Inicializa el monitoreo de red
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    if (this.platform.is('capacitor')) {
      await this.initializeCapacitorNetwork();
    } else {
      this.initializeBrowserNetwork();
    }

    this.logger.log('Network monitoring initialized');
  }

  /**
   * Inicializa monitoreo en dispositivos móviles (Capacitor)
   */
  private async initializeCapacitorNetwork(): Promise<void> {
    try {
      const status = await Network.getStatus();
      this.updateNetworkStatus({
        connected: status.connected,
        connectionType: status.connectionType as any,
        isOnline: status.connected,
      });

      Network.addListener('networkStatusChange', (status) => {
        this.logger.log('Network status changed');

        this.updateNetworkStatus({
          connected: status.connected,
          connectionType: status.connectionType as any,
          isOnline: status.connected,
        });

        if (status.connected) {
          this.processOfflineQueue();
        }
      });

      this.logger.log('Capacitor Network monitoring enabled');
    } catch (error) {
      this.logger.error('Error initializing Capacitor Network', error);
      this.initializeBrowserNetwork();
    }
  }

  /**
   * Inicializa monitoreo en navegador
   */
  private initializeBrowserNetwork(): void {
    this.updateNetworkStatus({
      connected: navigator.onLine,
      connectionType: navigator.onLine ? 'unknown' : 'none',
      isOnline: navigator.onLine,
    });

    window.addEventListener('online', () => {
      this.logger.log('Browser went online');
      this.updateNetworkStatus({
        connected: true,
        connectionType: 'unknown',
        isOnline: true,
      });
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.logger.log('Browser went offline');
      this.updateNetworkStatus({
        connected: false,
        connectionType: 'none',
        isOnline: false,
      });
    });

    this.logger.log('Browser Network monitoring enabled');
  }

  /**
   * Actualiza el estado de la red
   */
  private updateNetworkStatus(status: NetworkStatus): void {
    const currentStatus = this.networkStatusSignal();
    this.networkStatusSignal.set(status);

    if (currentStatus.isOnline !== status.isOnline) {
      if (status.isOnline) {
        this.logger.log('Connection restored');
      } else {
        this.logger.log('No internet connection');
      }
    }
  }

  /**
   * Obtiene el estado actual de la red
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatusSignal();
  }

  /**
   * Verifica si hay conexión (método legacy)
   */
  isOnline(): boolean {
    return this.networkStatusSignal().isOnline;
  }

  /**
   * Verifica si está offline (método legacy)
   */
  isOffline(): boolean {
    return !this.networkStatusSignal().isOnline;
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

    this.operationsQueueSignal.update((queue) => [...queue, queuedOp]);
    this.saveQueueToStorage();

    this.logger.log('Operation queued for offline processing');
  }

  /**
   * Procesa la cola de operaciones pendientes
   */
  async processOfflineQueue(): Promise<void> {
    const queue = this.operationsQueueSignal();

    if (queue.length === 0) {
      this.logger.log('No pending operations in queue');
      return;
    }

    if (this.isOffline()) {
      this.logger.log('Still offline, cannot process queue');
      return;
    }

    this.logger.log(`Processing ${queue.length} queued operations`);

    const operations = [...queue];
    this.operationsQueueSignal.set([]);

    let successCount = 0;
    let failCount = 0;

    for (const operation of operations) {
      try {
        await this.executeQueuedOperation(operation);
        successCount++;
        this.logger.log('Operation processed successfully');
      } catch (error) {
        failCount++;
        this.logger.error('Failed to process operation', error);
        this.operationsQueueSignal.update((q) => [...q, operation]);
      }
    }

    this.saveQueueToStorage();

    this.logger.log(`Queue processing complete: ${successCount} success, ${failCount} failed`);
  }

  /**
   * Ejecuta una operación de la cola
   */
  private async executeQueuedOperation(
    operation: QueuedOperation
  ): Promise<void> {
    this.logger.log('Executing queued operation');

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Obtiene el número de operaciones pendientes
   */
  getPendingOperationsCount(): number {
    return this.operationsQueueSignal().length;
  }

  /**
   * Limpia la cola de operaciones
   */
  clearQueue(): void {
    this.operationsQueueSignal.set([]);
    this.saveQueueToStorage();
    this.logger.log('Operation queue cleared');
  }

  /**
   * Guarda la cola en localStorage
   */
  private saveQueueToStorage(): void {
    try {
      localStorage.setItem(
        this.QUEUE_KEY,
        JSON.stringify(this.operationsQueueSignal())
      );
    } catch (error) {
      this.logger.error('Error saving queue to storage', error);
    }
  }

  /**
   * Carga la cola desde localStorage
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.QUEUE_KEY);
      if (stored) {
        const queue = JSON.parse(stored) as QueuedOperation[];
        this.operationsQueueSignal.set(queue);
        this.logger.log(`Loaded ${queue.length} operations from storage`);
      }
    } catch (error) {
      this.logger.error('Error loading queue from storage', error);
      this.operationsQueueSignal.set([]);
    }
  }

  /**
   * Espera hasta que haya conexión (con timeout)
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    if (this.isOnline()) {
      return true;
    }

    this.logger.log(`Waiting for connection (timeout: ${timeoutMs}ms)`);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.log('Connection timeout reached');
        resolve(false);
      }, timeoutMs);

      const checkConnection = setInterval(() => {
        if (this.isOnline()) {
          clearTimeout(timeout);
          clearInterval(checkConnection);
          this.logger.log('Connection established');
          resolve(true);
        }
      }, 100);
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
        this.logger.error('Error checking network status', error);
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
