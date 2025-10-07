import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonChip,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personAddOutline,
  mailOutline,
  copyOutline,
  trashOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  shieldCheckmarkOutline,
  personOutline,
  businessOutline,
  peopleOutline,
  documentTextOutline,
  statsChartOutline,
  addCircleOutline,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { InvitationService } from '../../../shared/services/invitation.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { AuthService } from '../../../auth/services/auth.service';
import { OrganizationInvite } from '../../../shared/models/organization.model';

@Component({
  selector: 'app-invitation-manager',
  templateUrl: './invitation-manager.component.html',
  styleUrls: ['./invitation-manager.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonChip,
    IonSpinner,
    IonSelect,
    IonSelectOption,
    IonTextarea,
  ],
})
export class InvitationManagerComponent implements OnInit, OnDestroy {
  private invitationService = inject(InvitationService);
  private organizationService = inject(OrganizationService);
  private authService = inject(AuthService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // Estado del componente
  inviteEmail = '';
  inviteRole: 'admin' | 'moderator' | 'user' = 'user';
  inviteDepartment = '';
  inviteMessage = '';
  loading = false;
  pendingInvites: OrganizationInvite[] = [];
  organizationCode = '';
  organization: any;

  // Para invitaciones masivas
  showBulkInvite = false;
  bulkInviteEmails = '';
  bulkInviteRole: 'admin' | 'moderator' | 'user' = 'user';
  bulkInviteDepartment = '';
  bulkInviteMessage = '';

  // Estadísticas
  organizationStats: any = null;

  // Configuración
  availableDepartments: string[] = [];
  maxMembers = 100;

  private subscriptions = new Subscription();

  constructor() {
    addIcons({
      personAddOutline,
      mailOutline,
      copyOutline,
      trashOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      timeOutline,
      shieldCheckmarkOutline,
      personOutline,
      businessOutline,
      peopleOutline,
      documentTextOutline,
      statsChartOutline,
      addCircleOutline,
    });
  }

  ngOnInit() {
    console.log('📧 InvitationManager initialized');
    this.loadPendingInvites();
    this.loadOrganizationCode();
    this.loadOrganizationStats();
    this.loadAvailableDepartments();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /**
   * Carga las invitaciones pendientes de la organización
   */
  private async loadPendingInvites() {
    try {
      const currentOrg = await this.organizationService
        .getCurrentOrganization()
        .toPromise();

      if (currentOrg) {
        this.subscriptions.add(
          this.invitationService
            .getOrganizationInvitations(currentOrg.id)
            .subscribe((invites) => {
              this.pendingInvites = invites.filter(
                (inv) => inv.status === 'pending'
              );
            })
        );
      }
    } catch (error) {
      console.error('Error loading pending invites:', error);
    }
  }

  /**
   * Carga el código de la organización
   */
  private async loadOrganizationCode() {
    try {
      const currentOrg = await this.organizationService
        .getCurrentOrganization()
        .toPromise();

      if (currentOrg) {
        this.organizationCode = currentOrg.code;
        this.organization = currentOrg;
        this.maxMembers = currentOrg.settings.maxMembers || 100;
      }
    } catch (error) {
      console.error('Error loading organization code:', error);
    }
  }

  /**
   * Carga los departamentos disponibles
   */
  private async loadAvailableDepartments() {
    try {
      const currentOrg = await this.organizationService
        .getCurrentOrganization()
        .toPromise();

      if (currentOrg && currentOrg.settings.departments) {
        this.availableDepartments = currentOrg.settings.departments;
      } else {
        this.availableDepartments = [
          'General',
          'Administración',
          'Operaciones',
          'Técnico',
        ];
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      this.availableDepartments = [
        'General',
        'Administración',
        'Operaciones',
        'Técnico',
      ];
    }
  }

  /**
   * Envía una invitación por email
   */
  async sendInvitation() {
    if (!this.inviteEmail.trim()) {
      await this.showToast('Por favor ingresa un email válido', 'warning');
      return;
    }

    this.loading = true;

    try {
      const invite = await this.invitationService.sendInvitation(
        this.inviteEmail,
        this.inviteRole
      );

      // Mostrar mensaje de éxito con diseño mejorado
      await this.showSuccessInviteModal(invite);

      // Limpiar formulario
      this.inviteEmail = '';
      this.inviteRole = 'user';

      // Recargar invitaciones
      this.loadPendingInvites();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      await this.showToast(
        error.message || 'Error al enviar la invitación',
        'danger'
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Muestra un modal de éxito mejorado para la invitación
   */
  private async showSuccessInviteModal(invite: OrganizationInvite) {
    const alert = await this.alertController.create({
      header: '✅ Invitación Enviada',
      subHeader: `Para: ${invite.invitedEmail}`,
      cssClass: 'custom-alert success-alert',
      message: `
        <div class="success-content">
          <div class="icon-container">
            <ion-icon name="checkmark-circle" color="success"></ion-icon>
          </div>
          
          <div class="message-section">
            <p class="success-message">¡Invitación enviada exitosamente!</p>
            <p class="instructions">El usuario recibirá las instrucciones por correo electrónico.</p>
          </div>

          <div class="code-section">
            <p class="code-label"><strong>Código de invitación:</strong></p>
            <div class="code-container">
              <span class="invite-code">${invite.code}</span>
              <ion-button fill="clear" size="small" class="copy-btn">
                <ion-icon name="copy-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </div>
          </div>

          <div class="instructions-section">
            <p class="instructions-title"><strong>¿Cómo usar el código?</strong></p>
            <div class="steps-container">
              <div class="step">
                <span class="step-number">1</span>
                <span class="step-text">Iniciar sesión en la app</span>
              </div>
              <div class="step">
                <span class="step-number">2</span>
                <span class="step-text">Abrir el menú lateral (☰)</span>
              </div>
              <div class="step">
                <span class="step-number">3</span>
                <span class="step-text">Ir a "Gestión de Organizaciones"</span>
              </div>
              <div class="step">
                <span class="step-number">4</span>
                <span class="step-text">Seleccionar "Unirse con Código"</span>
              </div>
              <div class="step">
                <span class="step-number">5</span>
                <span class="step-text">Ingresar el código y confirmar</span>
              </div>
            </div>
          </div>

          <div class="expiry-notice">
            <ion-icon name="time-outline" color="medium"></ion-icon>
            <span>El código expira en 7 días</span>
          </div>
        </div>
      `,
      buttons: [
        {
          text: 'Copiar Código',
          cssClass: 'copy-button',
          handler: () => {
            this.copyToClipboard(invite.code);
            this.showToast('Código copiado al portapapeles', 'success');
          },
        },
        {
          text: 'Entendido',
          cssClass: 'confirm-button',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  /**
   * Muestra el código de invitación en un alert
   */
  private async showInviteCodeAlert(invite: OrganizationInvite) {
    const alert = await this.alertController.create({
      header: 'Invitación Enviada',
      subHeader: `Para: ${invite.invitedEmail}`,
      message: `
        <p><strong>El código de invitación es:</strong></p>
        <p style="font-size: 1.4em; font-weight: bold; color: var(--ion-color-primary); text-align: center; padding: 10px; background: var(--ion-color-light); border-radius: 8px; margin: 10px 0;">
          ${invite.code}
        </p>
        <p><strong>¿Cómo usar el código?</strong></p>
        <ol style="text-align: left; margin: 10px 0;">
          <li>El usuario debe iniciar sesión en la app</li>
          <li>Abrir el menú lateral (☰)</li>
          <li>Ir a "Gestión de Organizaciones"</li>
          <li>Seleccionar "Unirse con Código"</li>
          <li>Ingresar el código: <strong>${invite.code}</strong></li>
        </ol>
        <p style="color: var(--ion-color-medium); font-size: 0.9em;">
          ⏰ El código expira en 7 días
        </p>
      `,
      buttons: [
        {
          text: 'Copiar Código',
          handler: () => {
            this.copyToClipboard(invite.code);
          },
        },
        {
          text: 'OK',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  /**
   * Cancela una invitación
   */
  async cancelInvitation(invite: OrganizationInvite) {
    const alert = await this.alertController.create({
      header: 'Cancelar Invitación',
      message: `¿Estás seguro de cancelar la invitación para ${invite.invitedEmail}?`,
      buttons: [
        {
          text: 'No',
          role: 'cancel',
        },
        {
          text: 'Sí, Cancelar',
          handler: async () => {
            try {
              await this.invitationService.cancelInvitation(invite.id);
              await this.showToast('Invitación cancelada', 'success');
              this.loadPendingInvites();
            } catch (error: any) {
              await this.showToast('Error al cancelar la invitación', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Copia el código de organización al portapapeles
   */
  async copyOrganizationCode() {
    await this.copyToClipboard(this.organizationCode);
    await this.showToast('Código copiado al portapapeles', 'success');
  }

  /**
   * Copia el código de invitación al portapapeles
   */
  async copyInviteCode(code: string) {
    await this.copyToClipboard(code);
    await this.showToast('Código de invitación copiado', 'success');
  }

  /**
   * Copia texto al portapapeles
   */
  private async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  /**
   * Obtiene el color del chip según el rol
   */
  getRoleColor(role: string): string {
    switch (role) {
      case 'admin':
        return 'warning';
      case 'moderator':
        return 'secondary';
      case 'user':
        return 'primary';
      default:
        return 'medium';
    }
  }

  /**
   * Obtiene el nombre del rol para mostrar
   */
  getRoleDisplayName(role: string): string {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'moderator':
        return 'Moderador';
      case 'user':
        return 'Usuario';
      default:
        return role;
    }
  }

  /**
   * Obtiene el tiempo restante de una invitación
   */
  getTimeRemaining(expiresAt: Date): string {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) return 'Expirada';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return 'Menos de 1h';
  }

  /**
   * Muestra un toast
   */
  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

  /**
   * Alterna la vista de invitaciones masivas
   */
  toggleBulkInvite() {
    this.showBulkInvite = !this.showBulkInvite;
    if (this.showBulkInvite) {
      this.bulkInviteEmails = '';
      this.bulkInviteRole = 'user';
      this.bulkInviteDepartment = '';
      this.bulkInviteMessage = '';
    }
  }

  /**
   * Procesa invitaciones masivas
   */
  async processBulkInvites() {
    if (!this.bulkInviteEmails.trim()) {
      await this.showToast('Ingresa al menos un email', 'warning');
      return;
    }

    this.loading = true;

    try {
      // Separar emails por líneas o comas
      const emails = this.bulkInviteEmails
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      if (emails.length === 0) {
        await this.showToast('No se encontraron emails válidos', 'warning');
        return;
      }

      if (emails.length > 50) {
        await this.showToast('Máximo 50 invitaciones por lote', 'warning');
        return;
      }

      // Preparar invitaciones
      const invites = emails.map((email) => ({
        email,
        role: this.bulkInviteRole,
        department: this.bulkInviteDepartment || 'General',
        message: this.bulkInviteMessage,
      }));

      const bulkRequest = {
        organizationId: this.organization?.id || 'org-1',
        invites,
        defaultRole: this.bulkInviteRole,
        defaultDepartment: this.bulkInviteDepartment || 'General',
        personalMessage: this.bulkInviteMessage,
      };

      const result = await this.organizationService.processBulkInvites(
        bulkRequest
      );

      await this.showToast(
        `${result.sent.length} invitaciones enviadas exitosamente`,
        'success'
      );

      if (result.failed.length > 0) {
        await this.showBulkInviteResults(result);
      }

      // Limpiar formulario y recargar
      this.bulkInviteEmails = '';
      this.showBulkInvite = false;
      this.loadPendingInvites();
      this.loadOrganizationStats();
    } catch (error: any) {
      console.error('Error processing bulk invites:', error);
      await this.showToast(
        error.message || 'Error al procesar invitaciones',
        'danger'
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Muestra los resultados de invitaciones masivas
   */
  private async showBulkInviteResults(result: any) {
    const successCount = result.successful.length;
    const failCount = result.failed.length;

    let message = `✅ ${successCount} invitaciones enviadas\n`;

    if (failCount > 0) {
      message += `❌ ${failCount} fallaron:\n`;
      result.failed.slice(0, 5).forEach((fail: any) => {
        message += `• ${fail.email}: ${fail.error}\n`;
      });

      if (failCount > 5) {
        message += `• y ${failCount - 5} más...`;
      }
    }

    const alert = await this.alertController.create({
      header: 'Resultados de Invitaciones Masivas',
      message: message.replace(/\n/g, '<br>'),
      buttons: ['OK'],
    });

    await alert.present();
  }

  /**
   * Carga estadísticas de la organización
   */
  private async loadOrganizationStats() {
    try {
      const orgId = this.organization?.id || 'org-1';
      this.organizationService
        .getOrganizationStats(orgId)
        .subscribe((stats) => {
          this.organizationStats = stats;
        });
    } catch (error) {
      console.error('Error loading organization stats:', error);
    }
  }

  /**
   * Obtiene el icono para el rol
   */
  getRoleIcon(role: string): string {
    switch (role) {
      case 'admin':
        return 'shield-checkmark-outline';
      case 'moderator':
        return 'people-outline';
      case 'user':
        return 'person-outline';
      default:
        return 'person-outline';
    }
  }

  /**
   * Formatea el porcentaje de crecimiento
   */
  formatGrowthPercentage(growth: number): string {
    if (growth > 0) return `+${growth}%`;
    if (growth < 0) return `${growth}%`;
    return '0%';
  }

  /**
   * Obtiene el color del crecimiento
   */
  getGrowthColor(growth: number): string {
    if (growth > 0) return 'success';
    if (growth < 0) return 'danger';
    return 'medium';
  }
}
