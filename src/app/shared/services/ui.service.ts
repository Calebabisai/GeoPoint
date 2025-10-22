import { Injectable, inject } from '@angular/core';
import {
  ToastController,
  AlertController,
  LoadingController,
} from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root',
})
export class UiService {
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private loadingController = inject(LoadingController);

  /**
   * Muestra un toast centrado (no tapa contenido)
   */
  async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'primary' = 'success',
    duration: number = 2500
  ) {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'middle', // Centrado para no tapar nada
      color,
      cssClass: 'custom-toast-centered',
      buttons: [
        {
          text: '✕',
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
  ) {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom', // Parte inferior
      color,
      cssClass: 'custom-toast-bottom',
    });
    await toast.present();
  }

  /**
   * Muestra un alert centrado
   */
  async showAlert(header: string, message: string, buttons: any[] = ['OK']) {
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
  async showLoading(message: string = 'Cargando...') {
    const loading = await this.loadingController.create({
      message,
      cssClass: 'custom-loading-centered',
      backdropDismiss: false,
    });
    await loading.present();
    return loading;
  }

  /**
   * Toast de éxito (verde)
   */
  async showSuccess(message: string) {
    await this.showToast(message, 'success');
  }

  /**
   * Toast de error (rojo)
   */
  async showError(message: string) {
    await this.showToast(message, 'danger', 3000);
  }

  /**
   * Toast de advertencia (amarillo)
   */
  async showWarning(message: string) {
    await this.showToast(message, 'warning');
  }
}
