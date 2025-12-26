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
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar color="dark">
        <ion-title>Invitación a Organización</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true" class="join-invitation">
      @if (isLoading()) {
        <div class="loading-container">
          <div class="loading-content">
            <ion-spinner name="crescent" color="secondary"></ion-spinner>
            <h2>Procesando invitación...</h2>
            <p>Esto solo tomará un momento</p>
          </div>
        </div>
      }

      @if (!isLoading()) {
        <div class="content-container">
          @if (status() === 'success') {
            <div class="success-container">
              <ion-card class="success-card">
                <ion-card-header>
                  <div class="success-icon">
                    <ion-icon name="checkmark-circle" color="success"></ion-icon>
                  </div>
                  <ion-card-title>¡Bienvenido al equipo!</ion-card-title>
                </ion-card-header>
                <ion-card-content>
                  <div class="organization-info">
                    <ion-item lines="none">
                      <ion-icon
                        name="business"
                        slot="start"
                        color="secondary"
                      ></ion-icon>
                      <ion-label>
                        <h2>{{ organization()?.name }}</h2>
                        <p>Te has unido exitosamente</p>
                      </ion-label>
                    </ion-item>

                    @if (invitationDetails()) {
                      <ion-item lines="none">
                        <ion-icon
                          name="person"
                          slot="start"
                          color="medium"
                        ></ion-icon>
                        <ion-label>
                          <h3>
                            Tu rol: {{ getRoleDisplayName(invitationDetails()!.role) }}
                          </h3>
                          @if (invitationDetails()!.department) {
                            <p>Departamento: {{ invitationDetails()!.department }}</p>
                          }
                        </ion-label>
                      </ion-item>
                    }
                  </div>

                  <div class="action-buttons">
                    <ion-button
                      expand="block"
                      color="secondary"
                      (click)="goToMap()"
                    >
                      <ion-icon name="home" slot="start"></ion-icon>
                      Ir al Mapa
                    </ion-button>
                  </div>

                  <p class="auto-redirect">
                    Serás redirigido automáticamente en unos segundos...
                  </p>
                </ion-card-content>
              </ion-card>
            </div>
          }

          @if (status() === 'error') {
            <div class="error-container">
              <ion-card class="error-card">
                <ion-card-header>
                  <div class="error-icon">
                    <ion-icon name="close-circle" color="danger"></ion-icon>
                  </div>
                  <ion-card-title>Error en la invitación</ion-card-title>
                </ion-card-header>
                <ion-card-content>
                  <p class="error-message">{{ errorMessage() }}</p>

                  <div class="action-buttons">
                    <ion-button expand="block" fill="outline" (click)="goHome()">
                      <ion-icon name="home" slot="start"></ion-icon>
                      Ir al Inicio
                    </ion-button>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
          }

          @if (status() === 'expired') {
            <div class="expired-container">
              <ion-card class="expired-card">
                <ion-card-header>
                  <div class="expired-icon">
                    <ion-icon name="time" color="warning"></ion-icon>
                  </div>
                  <ion-card-title>Invitación expirada</ion-card-title>
                </ion-card-header>
                <ion-card-content>
                  <p>Esta invitación ha expirado y ya no es válida.</p>
                  <p>
                    Contacta al administrador de la organización para solicitar una
                    nueva invitación.
                  </p>

                  <div class="action-buttons">
                    <ion-button expand="block" fill="outline" (click)="goHome()">
                      <ion-icon name="home" slot="start"></ion-icon>
                      Ir al Inicio
                    </ion-button>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .join-invitation {
        --background: var(--ion-color-dark);
      }

      .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
      }

      .loading-content {
        text-align: center;
      }

      .loading-content ion-spinner {
        width: 60px;
        height: 60px;
        margin-bottom: 20px;
      }

      .loading-content h2 {
        color: var(--ion-color-light);
        margin: 20px 0 10px;
        font-weight: 600;
      }

      .loading-content p {
        color: var(--ion-color-medium);
        margin: 0;
      }

      .content-container {
        padding: 20px;
        max-width: 500px;
        margin: 0 auto;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }

      .success-card,
      .error-card,
      .expired-card {
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      .success-card {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 2px solid var(--ion-color-secondary);
      }

      .error-card {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 2px solid var(--ion-color-danger);
      }

      .expired-card {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 2px solid var(--ion-color-warning);
      }

      .success-card ion-card-header,
      .error-card ion-card-header,
      .expired-card ion-card-header {
        text-align: center;
        padding-bottom: 10px;
      }

      .success-icon,
      .error-icon,
      .expired-icon {
        margin-bottom: 15px;
      }

      .success-icon ion-icon,
      .error-icon ion-icon,
      .expired-icon ion-icon {
        font-size: 64px;
      }

      ion-card-title {
        font-size: 24px;
        font-weight: 600;
        color: var(--ion-color-light);
      }

      .organization-info {
        margin: 20px 0;
      }

      .organization-info ion-item {
        --background: transparent;
        --border-color: transparent;
        --color: var(--ion-color-light);
      }

      .organization-info ion-label h2,
      .organization-info ion-label h3 {
        color: var(--ion-color-light);
        margin: 0 0 5px;
        font-weight: 600;
      }

      .organization-info ion-label p {
        color: var(--ion-color-medium);
        margin: 0;
        font-size: 14px;
      }

      .action-buttons {
        margin: 30px 0 20px;
      }

      .action-buttons ion-button {
        --border-radius: 25px;
        height: 50px;
        font-weight: 600;
        margin: 10px 0;
      }

      .auto-redirect {
        text-align: center;
        color: var(--ion-color-medium);
        font-size: 12px;
        font-style: italic;
        margin: 20px 0 0;
      }

      .error-message {
        color: var(--ion-color-light);
        text-align: center;
        margin: 20px 0;
        padding: 15px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        border-left: 4px solid var(--ion-color-danger);
      }
    `,
  ],
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
