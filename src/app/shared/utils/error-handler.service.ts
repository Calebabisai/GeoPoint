import { ErrorHandler, Injectable, inject, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ToastController } from '@ionic/angular/standalone';

/**
 * Manejador global de errores para la aplicación
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private toastCtrl = inject(ToastController);

  // Signals
  private errorCountSignal = signal(0);
  private lastErrorSignal = signal<string | null>(null);
  private isProcessingToastSignal = signal(false);
  private toastQueueSignal = signal<string[]>([]);

  // Readonly exports
  readonly errorCount = this.errorCountSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();
  readonly isProcessingToast = this.isProcessingToastSignal.asReadonly();

  // Computed signals
  readonly hasErrors = computed(() => this.errorCountSignal() > 0);
  readonly queueLength = computed(() => this.toastQueueSignal().length);

  async handleError(error: any): Promise<void> {
    const errorMessage = this.getErrorMessage(error);

    this.errorCountSignal.update((count) => count + 1);
    this.lastErrorSignal.set(errorMessage);

    if (environment.production) {
      console.error('Error:', errorMessage);
      this.reportErrorToMonitoring(error);
      await this.showUserFriendlyError(error);
    } else {
      console.error('Error capturado:', errorMessage);
      console.error('Stack:', error?.stack);
      console.error('Error completo:', error);
      await this.showDevelopmentError(errorMessage);
    }
  }

  /**
   * Extrae un mensaje de error legible
   */
  private getErrorMessage(error: any): string {
    if (!error) {
      return 'Error desconocido';
    }

    if (error.code) {
      return this.getFirebaseErrorMessage(error.code);
    }

    if (error.status) {
      return `Error HTTP ${error.status}: ${error.statusText || 'Error de red'}`;
    }

    if (error.message) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Ha ocurrido un error inesperado';
  }

  /**
   * Traduce códigos de error de Firebase
   */
  private getFirebaseErrorMessage(code: string): string {
    const errorMessages: { [key: string]: string } = {
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/email-already-in-use': 'Este email ya está registrado',
      'auth/weak-password': 'La contraseña es demasiado débil',
      'auth/invalid-email': 'Email inválido',
      'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
      'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
      'permission-denied': 'No tienes permisos para realizar esta acción',
      unavailable: 'Servicio no disponible. Intenta más tarde',
      'not-found': 'Recurso no encontrado',
      'already-exists': 'El recurso ya existe',
      cancelled: 'Operación cancelada',
      'deadline-exceeded': 'Tiempo de espera agotado',
    };

    return errorMessages[code] || `Error: ${code}`;
  }

  /**
   * Muestra mensaje amigable al usuario en producción
   */
  private async showUserFriendlyError(error: any): Promise<void> {
    let userMessage = 'Ha ocurrido un error. Por favor, intenta nuevamente.';

    if (error?.code?.includes('auth/')) {
      userMessage = this.getFirebaseErrorMessage(error.code);
    } else if (error?.code === 'permission-denied') {
      userMessage = 'No tienes permisos para realizar esta acción';
    } else if (error?.code === 'unavailable') {
      userMessage = 'Servicio temporalmente no disponible. Intenta más tarde';
    } else if (
      error?.message?.includes('network') ||
      error?.message?.includes('conexión')
    ) {
      userMessage = 'Error de conexión. Verifica tu internet';
    } else if (error?.name === 'TimeoutError') {
      userMessage = 'La operación tardó demasiado. Intenta nuevamente';
    }

    await this.queueToast(userMessage, 'danger');
  }

  /**
   * Muestra errores detallados en desarrollo
   */
  private async showDevelopmentError(message: string): Promise<void> {
    await this.queueToast(`[DEV] ${message}`, 'warning');
  }

  /**
   * Cola de toasts para evitar múltiples simultáneos
   */
  private async queueToast(message: string, color: string = 'danger'): Promise<void> {
    this.toastQueueSignal.update((queue) => [...queue, message]);

    if (!this.isProcessingToastSignal()) {
      await this.processToastQueue(color);
    }
  }

  /**
   * Procesa la cola de toasts
   */
  private async processToastQueue(color: string): Promise<void> {
    this.isProcessingToastSignal.set(true);

    while (this.queueLength() > 0) {
      const currentQueue = this.toastQueueSignal();
      const message = currentQueue[0];

      if (message) {
        this.toastQueueSignal.update((queue) => queue.slice(1));

        const toast = await this.toastCtrl.create({
          message,
          duration: 3000,
          position: 'top',
          color,
          buttons: [
            {
              text: 'OK',
              role: 'cancel',
            },
          ],
        });

        await toast.present();
        await toast.onDidDismiss();
      }
    }

    this.isProcessingToastSignal.set(false);
  }

  /**
   * Reporta el error a servicio de monitoreo
   * TODO: Implementar con Firebase Crashlytics, Sentry, etc.
   */
  private reportErrorToMonitoring(error: any): void {
    if (environment.production) {
      console.error('[Monitoring]', {
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Resetea el contador de errores
   */
  resetErrorCount(): void {
    this.errorCountSignal.set(0);
  }

  /**
   * Limpia el último error
   */
  clearLastError(): void {
    this.lastErrorSignal.set(null);
  }
}
