import { Component, inject, signal, computed} from '@angular/core';
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
import { firstValueFrom } from 'rxjs';
import { InvitationService } from '../../../shared/services/invitation.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { OrganizationInvite } from '../../../shared/models/organization.model';
import { INVITATION_MODAL_TEMPLATES } from './invitation-modal-templates';
import { NgModel, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-invitation-manager',
  templateUrl: './invitation-manager.component.html',
  styleUrls: ['./invitation-manager.component.scss'],
  standalone: true,
  imports: [
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
export class InvitationManagerComponent {
  private invitationService = inject(InvitationService);
  private organizationService = inject(OrganizationService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  //Signals - Formulario individual
  inviteEmail = signal('');
  inviteRole = signal<'admin' | 'moderator' | 'user'>('user');
  inviteDepartment = signal('');
  inviteMessage = signal('');

  // Signals - Estado general
  isLoading = signal(false);
  pendingInvites = signal<OrganizationInvite[]>([]);
  organizationCode = signal('');
  organization = signal<any>(null);
  organizationStats = signal<any>(null);

    // Signals - Formulario masivo
  showBulkInvite = signal(false);
  bulkInviteEmails = signal('');
  bulkInviteRole = signal<'admin' | 'moderator' | 'user'>('user');
  bulkInviteDepartment = signal('');
  bulkInviteMessage = signal('');

  // Signals - Configuración
  availableDepartments = signal<string[]>([]);
  maxMembers = signal(100);

  // Computed signals
  hasPendingInvites = computed(() => this.pendingInvites().length > 0);
  pendingInvitesCount = computed(() => this.pendingInvites().length);
  isFormValid = computed(() => this.inviteEmail().trim().length > 0);
  isBulkFormValid = computed(() => this.bulkInviteEmails().trim().length > 0);

  constructor() {
    this.setupIcons();
    this.initialize();
  }

  private setupIcons(): void {
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

  private initialize(): void {
    this.loadPendingInvites();
    this.loadOrganizationCode();
    this.loadOrganizationStats();
    this.loadAvailableDepartments();
  }

  /**
   * Carga las invitaciones pendientes de la organización
   */
  private async loadPendingInvites(): Promise<void> {
  try {
    const currentOrg = await firstValueFrom(
      this.organizationService.getCurrentOrganization()
    );

    if (currentOrg) {
      // getOrganizationInvitations returns OrganizationInvite[] directly, not Observable
      const invites = this.invitationService.getOrganizationInvitations(currentOrg.id);
      const filtered = invites.filter((inv: OrganizationInvite) => inv.status === 'pending');
      this.pendingInvites.set(filtered);
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
      const currentOrg = await firstValueFrom(
        this.organizationService.getCurrentOrganization()
      );

      if (currentOrg) {
        this.organizationCode.set(currentOrg.code);
        this.organization.set(currentOrg);
        this.maxMembers.set(currentOrg.settings?.maxMembers || 100);
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
      const currentOrg = await firstValueFrom(
        this.organizationService.getCurrentOrganization()
      );

      if (currentOrg && currentOrg.settings.departments) {
        this.availableDepartments.set(currentOrg.settings.departments);
      } else {
        this.availableDepartments.set([
          'General',
          'Administración',
          'Operaciones',
          'Técnico',
        ]);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      this.availableDepartments.set([
        'General',
        'Administración',
        'Operaciones',
        'Técnico',
      ]);
    }
  }
  /**
   * Carga estadísticas de la organización
   */
  private loadOrganizationStats(): void {
  try {
    const orgId = this.organization()?.id || 'org-1';
    // getOrganizationStats returns Signal, not Observable
    const statsSignal = this.organizationService.getOrganizationStats(orgId);
    // Get current value from signal
    this.organizationStats.set(statsSignal());
  } catch (error) {
    console.error('Error loading organization stats:', error);
  }
}

  /**
   * Envía una invitación por email
   */
  async sendInvitation(): Promise<void> {
    if (!this.isFormValid()) {
      await this.showToast('Por favor ingresa un email válido', 'warning');
      return;
    }

    this.isLoading.set(true);

    try {
      console.log(`Sending invitation to ${this.inviteEmail()}`);

      const invite = await this.invitationService.sendInvitation(
        this.inviteEmail(),
        this.inviteRole()
      );


      // Mostrar modal de éxito
      await this.showSuccessInviteModal(invite);

      // Limpiar formulario
      this.inviteEmail.set('');
      this.inviteRole.set('user');

      // Recargar invitaciones
      this.loadPendingInvites();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      await this.showToast(
        error.message || 'Error al enviar la invitación',
        'danger'
      );
    } finally {
      this.isLoading.set(false);
    }
  }
  /**
   * Procesa invitaciones masivas
   */
  async processBulkInvites(): Promise<void> {
    if (!this.isBulkFormValid()) {
      await this.showToast('Ingresa al menos un email', 'warning');
      return;
    }

    this.isLoading.set(true);

    try {

      // Separar emails por líneas o comas
      const emails = this.bulkInviteEmails()
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
        role: this.bulkInviteRole(),
        department: this.bulkInviteDepartment() || 'General',
        message: this.bulkInviteMessage(),
      }));

      const bulkRequest = {
        organizationId: this.organization()?.id || 'org-1',
        invites,
        defaultRole: this.bulkInviteRole(),
        defaultDepartment: this.bulkInviteDepartment() || 'General',
        personalMessage: this.bulkInviteMessage(),
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

      // Limpiar formulario
      this.bulkInviteEmails.set('');
      this.showBulkInvite.set(false);
      this.loadPendingInvites();
      this.loadOrganizationStats();
    } catch (error: any) {
      console.error('Error processing bulk invites:', error);
      await this.showToast(
        error.message || 'Error al procesar invitaciones',
        'danger'
      );
    } finally {
      this.isLoading.set(false);
    }
  }
 /**
   * Cancela una invitación
   */
  async cancelInvitation(invite: OrganizationInvite): Promise<void> {
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

              console.log('Invitation canceled successfully');
            } catch (error: any) {
              console.error('Error canceling invitation:', error);
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
  async copyOrganizationCode(): Promise<void> {
    await this.copyToClipboard(this.organizationCode());
    await this.showToast('Código copiado al portapapeles', 'success');
  }

  /**
   * Copia el código de invitación al portapapeles
   */
  async copyInviteCode(code: string): Promise<void> {
    await this.copyToClipboard(code);
    await this.showToast('Código de invitación copiado', 'success');
  }

  /**
   * Copia texto al portapapeles
   */
  private async copyToClipboard(text: string): Promise<void> {
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
   * Alterna la vista de invitaciones masivas
   */
  toggleBulkInvite(): void {
    this.showBulkInvite.update((value) => !value);
    if (!this.showBulkInvite()) {
      this.bulkInviteEmails.set('');
      this.bulkInviteRole.set('user');
      this.bulkInviteDepartment.set('');
      this.bulkInviteMessage.set('');
    }
  }

  /**
   * Obtiene el color del chip según el rol
   */
  getRoleColor(role: string): string {
    const colors: Record<string, string> = {
      admin: 'warning',
      moderator: 'secondary',
      user: 'primary',
    };
    return colors[role] || 'medium';
  }

  /**
   * Obtiene el nombre del rol para mostrar
   */
  getRoleDisplayName(role: string): string {
    const names: Record<string, string> = {
      admin: 'Administrador',
      moderator: 'Moderador',
      user: 'Usuario',
    };
    return names[role] || role;
  }

  /**
   * Obtiene el icono para el rol
   */
  getRoleIcon(role: string): string {
    const icons: Record<string, string> = {
      admin: 'shield-checkmark-outline',
      moderator: 'people-outline',
      user: 'person-outline',
    };
    return icons[role] || 'person-outline';
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

  private async showSuccessInviteModal(
  invite: OrganizationInvite
): Promise<void> {
  const alert = await this.alertController.create({
    header: 'Invitación Enviada',
    subHeader: `Para: ${invite.invitedEmail}`,
    cssClass: 'custom-alert success-alert',
    message: INVITATION_MODAL_TEMPLATES.successModal(invite.code),
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
   * Muestra los resultados de invitaciones masivas
   */
  private async showBulkInviteResults(result: any): Promise<void> {
    const successCount = result.sent.length;
    const failCount = result.failed.length;

    let message = ` ${successCount} invitaciones enviadas\n`;

    if (failCount > 0) {
      message += ` ${failCount} fallaron:\n`;
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
   * Muestra un toast
   */
  private async showToast(message: string, color: string = 'primary'): Promise<void> {
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

