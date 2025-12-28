import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonText,
  IonChip,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  mailOpenOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  businessOutline,
  keyOutline,
  closeCircleOutline,
  shieldCheckmarkOutline,
  personOutline,
} from 'ionicons/icons';
import { InvitationService } from '../../shared/services/invitation.service';
import { AuthService } from '../../auth/services/auth.service';

type ValidationStatus = 'valid' | 'invalid' | 'expired' | '';
@Component({
  selector: 'app-invitation-accept',
  templateUrl: './invitation-accept.page.html',
  styleUrls: ['./invitation-accept.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSpinner,
    IonText,
    IonChip,
  ],
})
export class InvitationAcceptPage implements OnInit {
  private readonly invitationService = inject(InvitationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastController = inject(ToastController);

  readonly inviteCode = signal('');
  readonly loading = signal(false);
  readonly inviteDetails = signal<any>(null);
  readonly isValidating = signal(false);
  readonly validationMessage = signal('');
  readonly validationStatus = signal<ValidationStatus>('');

  //Computed
  readonly isValid = computed(() => this.validationStatus() === 'valid');
  readonly hasError = computed(() => 
    this.validationStatus() === 'invalid' || this.validationStatus() === 'expired'
  );
  readonly canAccept = computed(() => 
    this.isValid() && !this.loading() && this.inviteDetails() !== null
  );

  constructor() {
    addIcons({
      mailOpenOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      businessOutline,
      keyOutline,
      closeCircleOutline,
      shieldCheckmarkOutline,
      personOutline,
    });
  }

  async ngOnInit() {
    const codeFromUrl = this.route.snapshot.paramMap.get('code');
    if (codeFromUrl) {
      this.inviteCode.set(codeFromUrl);
      await this.validateCode();
    }
  }

  updateInviteCode(value: string): void {
    this.inviteCode.set(value);
    this.validateCode();
  }

  async validateCode(): Promise<void> {
    const code = this.inviteCode().trim();
    
    if (!code) {
      this.resetValidation();
      return;
    }

    this.isValidating.set(true);
    this.validationMessage.set('');

    try {
      const invite = await this.invitationService.validateInviteCode(code);

      if (invite) {
        this.inviteDetails.set(invite);
        this.validationStatus.set('valid');
        this.validationMessage.set(
          `Invitación válida para unirse a "${invite.organizationName}"`
        );
      } else {
        this.validationStatus.set('invalid');
        this.validationMessage.set('Código de invitación no válido');
      }
    } catch (error: any) {
      this.validationStatus.set('invalid');
      if (error.message?.includes('expired')) {
        this.validationStatus.set('expired');
        this.validationMessage.set('Este código de invitación ha expirado');
      } else {
        this.validationMessage.set('Error al validar el código');
      }
    } finally {
      this.isValidating.set(false);
    }
  }

  async acceptInvitation(): Promise<void> {
    if (!this.canAccept()) return;

    this.loading.set(true);

    try {
      const currentUser = this.authService.currentUser();

      if (!currentUser) {
        await this.showToast(
          'Debes iniciar sesión para aceptar la invitación',
          'warning'
        );
        this.router.navigate(['/auth/login'], {
          queryParams: { inviteCode: this.inviteCode() },
        });
        return;
      }

      await this.invitationService.acceptInvitation(this.inviteCode());

      const details = this.inviteDetails();
      await this.showToast(
        `Te has unido exitosamente a ${details?.organizationName}!`,
        'success'
      );

      this.router.navigate(['/home']);
    } catch (error: any) {
      await this.showToast(
        error.message || 'Error al aceptar la invitación',
        'danger'
      );
    } finally {
      this.loading.set(false);
    }
  }

  async rejectInvitation(): Promise<void> {
    if (!this.inviteDetails()) return;

    try {
      await this.invitationService.rejectInvitation(this.inviteCode());
      await this.showToast('Invitación rechazada', 'medium');
      this.resetValidation();
      this.inviteCode.set('');
    } catch (error: any) {
      await this.showToast('Error al rechazar la invitación', 'danger');
    }
  }

  private resetValidation(): void {
    this.inviteDetails.set(null);
    this.validationStatus.set('');
    this.validationMessage.set('');
  }

  getValidationColor(): string {
    switch (this.validationStatus()) {
      case 'valid':
        return 'success';
      case 'invalid':
        return 'danger';
      case 'expired':
        return 'warning';
      default:
        return 'medium';
    }
  }

  getValidationIcon(): string {
    switch (this.validationStatus()) {
      case 'valid':
        return 'checkmark-circle-outline';
      case 'invalid':
      case 'expired':
        return 'alert-circle-outline';
      default:
        return 'key-outline';
    }
  }

  private async showToast(
    message: string,
    color: 'primary' | 'success' | 'warning' | 'danger' | 'medium' = 'primary'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      cssClass: 'custom-toast',
    });
    await toast.present();
  }
}
