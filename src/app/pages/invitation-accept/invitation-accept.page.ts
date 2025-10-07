import { Component, OnInit, inject } from '@angular/core';
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
  private invitationService = inject(InvitationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastController = inject(ToastController);

  inviteCode = '';
  loading = false;
  inviteDetails: any = null;
  isValidating = false;
  validationMessage = '';
  validationStatus: 'valid' | 'invalid' | 'expired' | '' = '';

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
    // Verificar si se pasó un código en la URL
    const codeFromUrl = this.route.snapshot.paramMap.get('code');
    if (codeFromUrl) {
      this.inviteCode = codeFromUrl;
      await this.validateCode();
    }
  }

  /**
   * Valida el código de invitación
   */
  async validateCode() {
    if (!this.inviteCode.trim()) {
      this.resetValidation();
      return;
    }

    this.isValidating = true;
    this.validationMessage = '';

    try {
      const invite = await this.invitationService.validateInviteCode(
        this.inviteCode.trim()
      );

      if (invite) {
        this.inviteDetails = invite;
        this.validationStatus = 'valid';
        this.validationMessage = `Invitación válida para unirse a "${invite.organizationName}"`;
      } else {
        this.validationStatus = 'invalid';
        this.validationMessage = 'Código de invitación no válido';
      }
    } catch (error: any) {
      this.validationStatus = 'invalid';
      if (error.message?.includes('expired')) {
        this.validationStatus = 'expired';
        this.validationMessage = 'Este código de invitación ha expirado';
      } else {
        this.validationMessage = 'Error al validar el código';
      }
    } finally {
      this.isValidating = false;
    }
  }

  /**
   * Acepta la invitación
   */
  async acceptInvitation() {
    if (!this.inviteDetails || this.loading) return;

    this.loading = true;

    try {
      // Verificar si el usuario está logueado
      const currentUser = await this.authService.getCurrentUser();

      if (!currentUser) {
        // Si no está logueado, redirigir al login con el código
        await this.showToast(
          'Debes iniciar sesión para aceptar la invitación',
          'warning'
        );
        this.router.navigate(['/auth/login'], {
          queryParams: { inviteCode: this.inviteCode },
        });
        return;
      }

      await this.invitationService.acceptInvitation(this.inviteCode);

      await this.showToast(
        `¡Te has unido exitosamente a ${this.inviteDetails.organizationName}!`,
        'success'
      );

      // Redirigir al home
      this.router.navigate(['/home']);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      await this.showToast(
        error.message || 'Error al aceptar la invitación',
        'danger'
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Rechaza la invitación
   */
  async rejectInvitation() {
    if (!this.inviteDetails) return;

    try {
      await this.invitationService.rejectInvitation(this.inviteCode);
      await this.showToast('Invitación rechazada', 'medium');
      this.resetValidation();
      this.inviteCode = '';
    } catch (error: any) {
      console.error('Error rejecting invitation:', error);
      await this.showToast('Error al rechazar la invitación', 'danger');
    }
  }

  /**
   * Restablece el estado de validación
   */
  private resetValidation() {
    this.inviteDetails = null;
    this.validationStatus = '';
    this.validationMessage = '';
  }

  /**
   * Obtiene el color del estado de validación
   */
  getValidationColor(): string {
    switch (this.validationStatus) {
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

  /**
   * Obtiene el icono del estado de validación
   */
  getValidationIcon(): string {
    switch (this.validationStatus) {
      case 'valid':
        return 'checkmark-circle-outline';
      case 'invalid':
      case 'expired':
        return 'alert-circle-outline';
      default:
        return 'key-outline';
    }
  }

  /**
   * Muestra un toast
   */
  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
