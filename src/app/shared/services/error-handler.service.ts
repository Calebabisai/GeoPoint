import { ErrorHandler, Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ToastController } from '@ionic/angular/standalone';

/**
 * Manejador global de errores para la aplicación
 * Captura errores no manejados y los procesa de forma segura
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private toastCtrl = inject(ToastController);
  private toastQueue: string[] = [];
  private showingToast = false;

  async handleError(error: any): Promise<void> {
    // Extraer mensaje de error
    const errorMessage = this.getErrorMessage(error);
    const errorStack = error?.stack;

    // En producción, solo mostrar mensaje genérico
    if (environment.production) {
      console.error('Error:', errorMessage);

      // Aquí puedes enviar el error a un servicio de monitoreo
      // como Firebase Crashlytics, Sentry, etc.
      this.reportErrorToMonitoring(error);

      // Mostrar mensaje amigable al usuario
      await this.showUserFriendlyError(error);
    } else {
      // En desarrollo, mostrar todo el detalle
      console.error('❌ Error capturado por GlobalErrorHandler:');
      console.error('Mensaje:', errorMessage);
      console.error('Stack:', errorStack);
      console.error('Error completo:', error);

      // También mostrar en UI para desarrollo
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

    // Error de Firebase
    if (error.code) {
      return this.getFirebaseErrorMessage(error.code);
    }

    // Error HTTP
    if (error.status) {
      return `Error HTTP ${error.status}: ${
        error.statusText || 'Error de red'
      }`;
    }

    // Error estándar
    if (error.message) {
      return error.message;
    }

    // Error como string
    if (typeof error === 'string') {
      return error;
    }

    return 'Ha ocurrido un error inesperado';
  }

  /**
   * Traduce códigos de error de Firebase a mensajes amigables
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
   * Muestra un mensaje amigable al usuario en producción
   */
  private async showUserFriendlyError(error: any): Promise<void> {
    let userMessage = 'Ha ocurrido un error. Por favor, intenta nuevamente.';

    // Personalizar mensaje según el tipo de error
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
   * Cola de toasts para evitar múltiples toasts simultáneos
   */
  private async queueToast(
    message: string,
    color: string = 'danger'
  ): Promise<void> {
    this.toastQueue.push(message);

    if (!this.showingToast) {
      await this.processToastQueue(color);
    }
  }

  /**
   * Procesa la cola de toasts
   */
  private async processToastQueue(color: string): Promise<void> {
    this.showingToast = true;

    while (this.toastQueue.length > 0) {
      const message = this.toastQueue.shift();
      if (message) {
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

    this.showingToast = false;
  }

  /**
   * Reporta el error a un servicio de monitoreo
   * TODO: Implementar con Firebase Crashlytics, Sentry, etc.
   */
  private reportErrorToMonitoring(error: any): void {
    // Aquí puedes integrar con servicios como:
    // - Firebase Crashlytics
    // - Sentry
    // - Bugsnag
    // - etc.

    // Ejemplo con Firebase Crashlytics (requiere instalación):
    // import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
    // FirebaseCrashlytics.recordException({ message: error.message, stacktrace: error.stack });

    // Por ahora solo guardamos en consola
    if (environment.production) {
      // En producción, enviar a servicio de monitoreo
      console.error('[Monitoring]', {
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
