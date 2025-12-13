import { Injectable, inject, signal, computed } from '@angular/core';
import {
  ToastController,
  AlertController,
  LoadingController,
} from '@ionic/angular/standalone';

export interface UiState {
  isLoading: boolean;
  loadingMessage: string;
}

@Injectable({
  providedIn: 'root',
})
export class UiService {
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private loadingController = inject(LoadingController);

  // Signals
  private uiStateSignal = signal<UiState>({
    isLoading: false,
    loadingMessage: 'Cargando...',
  });

  private currentLoadingRef = signal<any>(null);

  // Readonly exports
  readonly uiState = this.uiStateSignal.asReadonly();
  readonly currentLoading = this.currentLoadingRef.asReadonly();

  // Computed signals
  readonly isLoading = computed(() => this.uiStateSignal().isLoading);
  readonly loadingMessage = computed(() => this.uiStateSignal().loadingMessage);

  /**
   * Muestra un toast centrado (no tapa contenido)
   */
  async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'primary' = 'success',
    duration: number = 2500
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'middle',
      color,
      cssClass: 'custom-toast-centered',
      buttons: [
        {
          text: 'X',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }

  /**
   * Muestra un toast en la parte inferior (alternativa)
   */
  async showToastBottom(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'primary' = 'success',
    duration: number = 2500
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      color,
      cssClass: 'custom-toast-bottom',
    });
    await toast.present();
  }

  /**
   * Muestra un alert centrado
   */
  async showAlert(
    header: string,
    message: string,
    buttons: any[] = ['OK']
  ): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons,
      cssClass: 'custom-alert-centered',
    });
    await alert.present();
  }

  /**
   * Muestra un loading centrado
   */
  async showLoading(message: string = 'Cargando...'): Promise<any> {
    this.uiStateSignal.update((state) => ({
      ...state,
      isLoading: true,
      loadingMessage: message,
    }));

    const loading = await this.loadingController.create({
      message,
      cssClass: 'custom-loading-centered',
      backdropDismiss: false,
    });

    await loading.present();
    this.currentLoadingRef.set(loading);

    return loading;
  }

  /**
   * Oculta el loading actual
   */
  async hideLoading(): Promise<void> {
    const loading = this.currentLoadingRef();

    if (loading) {
      await loading.dismiss();
      this.currentLoadingRef.set(null);
    }

    this.uiStateSignal.update((state) => ({
      ...state,
      isLoading: false,
      loadingMessage: 'Cargando...',
    }));
  }

  /**
   * Toast de éxito (verde)
   */
  async showSuccess(message: string): Promise<void> {
    await this.showToast(message, 'success');
  }

  /**
   * Toast de error (rojo)
   */
  async showError(message: string): Promise<void> {
    await this.showToast(message, 'danger', 3000);
  }

  /**
   * Toast de advertencia (amarillo)
   */
  async showWarning(message: string): Promise<void> {
    await this.showToast(message, 'warning');
  }
}
