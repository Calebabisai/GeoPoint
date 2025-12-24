import { Component, computed, inject, signal } from '@angular/core';
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
  LoadingController, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  keyOutline,
  businessOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { OrganizationService } from '../../shared/services/organization.service';
import { AuthService } from '../../auth/services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-join-organization',
  templateUrl: './join-organization.page.html',
  styleUrls: ['./join-organization.page.scss'],
  standalone: true,
  imports: [IonSpinner, 
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
  private readonly organizationService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);

  // Signals
  readonly inviteCode = signal('');
  readonly isLoading = signal(false);

  // Computed
  readonly isValidCode = computed(() => this.inviteCode().trim().length > 0);
  readonly canSubmit = computed(() => this.isValidCode() && !this.isLoading());

  constructor() {
    addIcons({
      keyOutline,
      businessOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
    });
  }

  updateInviteCode(value: string): void {
    this.inviteCode.set(value.toUpperCase());
  }

  async joinOrganization(): Promise<void> {
    if (!this.isValidCode()) {
      await this.showToast('Por favor ingresa un codigo de invitacion', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Uniendose a la organizacion...',
    });
    await loading.present();

    try {
      const user = this.authService.currentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const organization = await this.organizationService.acceptInvite(
        this.inviteCode().trim()
      );

      await loading.dismiss();
      await this.showToast(`Bienvenido a ${organization.name}!`, 'success');
      this.router.navigate(['/home']);
    } catch (error) {
      await loading.dismiss();
      const err = error as { message?: string };
      await this.showToast(
        err.message || 'Error al unirse a la organizacion',
        'danger'
      );
    }
  }

  private async showToast(
    message: string,
    color: 'primary' | 'success' | 'warning' | 'danger' = 'primary'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      cssClass: 'custom-toast',
    });
    await toast.present();
  }
}
