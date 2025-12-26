import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  ToastController,
  LoadingController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  closeCircle,
  business,
  person,
  time,
  home,
  warning,
} from 'ionicons/icons';

import { OrganizationService } from '../../shared/services/organization.service';
import { AuthService } from '../../auth/services/auth.service';

@Component({
  selector: 'app-join-invitation',
  templateUrl: './join-invitation.page.html',
  styleUrls: ['./join-invitation.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSpinner,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
  ],
})
export class JoinInvitationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly organizationService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);

  // Signals
  readonly inviteToken = signal('');
  readonly isLoading = signal(true);
  readonly isProcessing = signal(false);
  readonly status = signal<'loading' | 'success' | 'error' | 'expired'>('loading');
  readonly errorMessage = signal('');
  readonly organization = signal<any>(null);
  readonly invitationDetails = signal<any>(null);

  // Computed
  readonly canProceed = computed(() => this.inviteToken().trim().length > 0);
  readonly isSuccessful = computed(() => this.status() === 'success');
  readonly hasError = computed(() => this.status() === 'error');

  constructor() {
    addIcons({
      checkmarkCircle,
      closeCircle,
      business,
      person,
      time,
      home,
      warning,
    });
  }

  async ngOnInit() {
    // Obtener el token de la URL
    const token = this.route.snapshot.paramMap.get('token') || '';
    this.inviteToken.set(token);

    if (!this.canProceed()) {
      this.status.set('error');
      this.errorMessage.set('Token de invitación no válido');
      this.isLoading.set(false);
      return;
    }

    await this.processInvitation();
  }

  private async processInvitation() {
    try {
      this.isLoading.set(true);
      
      // Mostrar loading para dar tiempo al usuario a ver la información
      await this.showProcessingLoader();

      // Procesar la invitación directamente usando Firebase
      const org = await this.organizationService.acceptEmailInvite(
        this.inviteToken()
      );
      this.organization.set(org);

      this.status.set('success');

      await this.showSuccessMessage();

      // Redirigir al mapa después de 3 segundos
      setTimeout(() => {
        this.goToMap();
      }, 3000);
    } catch (error: any) {
      this.status.set('error');
      this.errorMessage.set(error.message || 'Error al procesar la invitación');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async showProcessingLoader() {
    const loading = await this.loadingController.create({
      message: 'Procesando invitación...',
      duration: 2000,
    });
    await loading.present();
    await loading.onDidDismiss();
  }

  private async showSuccessMessage() {
    const org = this.organization();
    const toast = await this.toastController.create({
      message: `Te has unido exitosamente a ${org?.name}!`,
      duration: 3000,
      color: 'success',
      position: 'top',
      icon: 'checkmark-circle',
    });
    await toast.present();
  }

  async goToMap() {
    this.router.navigate(['/map']);
  }

  async goHome() {
    this.router.navigate(['/']);
  }

  getRoleDisplayName(role: string): string {
    const roleNames = {
      owner: 'Propietario',
      admin: 'Administrador',
      moderator: 'Moderador',
      user: 'Miembro',
    };
    return roleNames[role as keyof typeof roleNames] || role;
  }

  getTimeUntilExpiration(): string {
    const details = this.invitationDetails();
    if (!details) return '';

    const now = new Date();
    const expiresAt = new Date(details.expiresAt);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      return `${diffDays} días`;
    } else if (diffHours > 1) {
      return `${diffHours} horas`;
    } else {
      return 'Menos de 1 hora';
    }
  }
}
