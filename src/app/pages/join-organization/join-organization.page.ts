import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonText,
  IonBackButton,
  IonButtons,
  ToastController,
  LoadingController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  keyOutline,
  businessOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { OrganizationService } from '../../shared/services/organization.service';
import { AuthService } from '../../auth/services/auth.service';

@Component({
  selector: 'app-join-organization',
  templateUrl: './join-organization.page.html',
  styleUrls: ['./join-organization.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonText,
    IonBackButton,
    IonButtons,
  ],
})
export class JoinOrganizationPage {
  private organizationService = inject(OrganizationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);

  inviteCode = '';
  isLoading = false;

  constructor() {
    addIcons({
      keyOutline,
      businessOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
    });
  }

  async joinOrganization() {
    if (!this.inviteCode.trim()) {
      this.showToast('Por favor ingresa un código de invitación', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Uniéndose a la organización...',
    });
    await loading.present();

    try {
      // Obtener usuario actual
      const user = await this.authService.getCurrentUser().toPromise();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Aceptar la invitación
      const organization = await this.organizationService.acceptInvite(
        this.inviteCode.trim().toUpperCase()
      );

      await loading.dismiss();

      await this.showToast(`¡Bienvenido a ${organization.name}!`, 'success');

      // Navegar al home
      this.router.navigate(['/home']);
    } catch (error) {
      await loading.dismiss();
      console.error('Error joining organization:', error);

      let message = 'Error al unirse a la organización';
      if (error instanceof Error) {
        message = error.message;
      }

      await this.showToast(message, 'danger');
    }
  }

  formatInviteCode() {
    // Convertir a mayúsculas automáticamente
    this.inviteCode = this.inviteCode.toUpperCase();
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
