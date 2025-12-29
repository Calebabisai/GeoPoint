import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonBadge,
  IonList,
  IonItem,
  IonLabel,
  ToastController, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  copyOutline,
  checkmarkOutline,
  openOutline,
} from 'ionicons/icons';
import { EmailService } from '../../shared/services/email.service';
import { OrganizationService } from '../../shared/services/organization.service';
import { EmailData, SampleEmail, InviteConfig } from 'src/app/shared/models/email-preview.model';


@Component({
  selector: 'app-email-preview',
  templateUrl: './email-preview.page.html',
  styleUrls: ['./email-preview.page.scss'],
  standalone: true,
  imports: [IonSpinner, 
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonBadge,
    IonList,
    IonItem,
    IonLabel,
  ],
})
export class EmailPreviewPage implements OnInit {
  private readonly emailService = inject(EmailService);
  private readonly organizationService = inject(OrganizationService);
  private readonly toastCtrl = inject(ToastController);

  // Signals
  readonly sampleEmails = signal<SampleEmail[]>([]);
  readonly isGenerating = signal(false);

  // Computed
  readonly hasEmails = computed(() => this.sampleEmails().length > 0);
  readonly emailCount = computed(() => this.sampleEmails().length);

  constructor() {
    addIcons({
      mailOutline,
      copyOutline,
      checkmarkOutline,
      openOutline,
    });
  }

  ngOnInit() {
    this.generateSampleEmails();
  }

  /**
   * Genera emails de ejemplo para mostrar
   */
  private generateSampleEmails(): void {
    this.isGenerating.set(true);

    try {
      const config: InviteConfig = {
        organizationName: 'Mi Empresa Demo',
        inviterName: 'Juan Administrador',
        inviterEmail: 'admin@miempresa.com',
        inviteCode: 'ABC123XYZ',
        joinUrl: `${window.location.origin}/join-organization?code=ABC123XYZ`,
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        personalMessage:
          'Te invitamos a formar parte de nuestro equipo de trabajo. Esperamos contar contigo!',
      };

      const invitationTemplate = (this.emailService as any).generateInvitationTemplate(config);
      const welcomeTemplate = (this.emailService as any).generateWelcomeTemplate(
        'Mi Empresa Demo',
        'user'
      );

      const emails: SampleEmail[] = [
        {
          type: 'invitation',
          title: 'Email de Invitación',
          description:
            'Este es el email que reciben los usuarios cuando los invitas',
          data: {
            to: 'nuevo.usuario@ejemplo.com',
            subject: invitationTemplate.subject,
            html: invitationTemplate.htmlBody,
            text: invitationTemplate.textBody,
          },
        },
        {
          type: 'welcome',
          title: 'Email de Bienvenida',
          description:
            'Este email se envía automáticamente cuando un usuario se une',
          data: {
            to: 'nuevo.usuario@ejemplo.com',
            subject: welcomeTemplate.subject,
            html: welcomeTemplate.htmlBody,
            text: welcomeTemplate.textBody,
          },
        },
      ];

      this.sampleEmails.set(emails);
    } finally {
      this.isGenerating.set(false);
    }
  }

  openHtmlPreview(emailData: EmailData): void {
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    if (previewWindow) {
      previewWindow.document.write(emailData.html);
      previewWindow.document.close();
    }
  }

  async copyExampleCode(): Promise<void> {
    const code = 'ABC123XYZ';
    try {
      await navigator.clipboard.writeText(code);
      await this.showToast(`Código de ejemplo copiado: ${code}`, 'success');
    } catch (error) {
      await this.showToast('Error al copiar el código', 'danger');
    }
  }

  async showImplementationSteps(): Promise<void> {
    await this.showToast('Revisa la sección de implementación abajo', 'primary');
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'primary' = 'primary'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
      color,
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

}
