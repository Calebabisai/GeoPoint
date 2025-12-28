import { Component, inject, OnInit } from '@angular/core';
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
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  copyOutline,
  checkmarkOutline,
  openOutline,
} from 'ionicons/icons';
import { EmailService } from '../../shared/services/email.service';
import { OrganizationService } from '../../shared/services/organization.service';

@Component({
  selector: 'app-email-preview',
  templateUrl: './email-preview.page.html',
  styleUrls: ['./email-preview.page.scss'],
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
    IonButton,
    IonIcon,
    IonBadge,
    IonList,
    IonItem,
    IonLabel,
  ],
})
export class EmailPreviewPage implements OnInit {
  private emailService = inject(EmailService);
  private organizationService = inject(OrganizationService);
  private toastCtrl = inject(ToastController);

  sampleEmails: any[] = [];

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
  generateSampleEmails() {
    const sampleInvite = {
      id: 'invite-sample',
      organizationId: 'org-sample',
      organizationName: 'Mi Empresa Demo',
      invitedEmail: 'nuevo.usuario@ejemplo.com',
      invitedBy: 'admin-id',
      role: 'user' as const,
      code: 'ABC123XYZ',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      status: 'pending' as const,
    };

    const config = {
      organizationName: 'Mi Empresa Demo',
      inviterName: 'Juan Administrador',
      inviterEmail: 'admin@miempresa.com',
      inviteCode: 'ABC123XYZ',
      joinUrl: `${window.location.origin}/join-organization?code=ABC123XYZ`,
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      personalMessage:
        'Te invitamos a formar parte de nuestro equipo de trabajo. ¡Esperamos contar contigo!',
    };

    // Generar template de invitación
    const invitationTemplate = (
      this.emailService as any
    ).generateInvitationTemplate(config);

    // Generar template de bienvenida
    const welcomeTemplate = (this.emailService as any).generateWelcomeTemplate(
      'Mi Empresa Demo',
      'user'
    );

    this.sampleEmails = [
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
  }

  /**
   * Abre el preview HTML en una nueva ventana
   */
  openHtmlPreview(emailData: any) {
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    if (previewWindow) {
      previewWindow.document.write(emailData.html);
      previewWindow.document.close();
    }
  }

  /**
   * Copia el código de ejemplo al portapapeles
   */
  async copyExampleCode() {
    const code = 'ABC123XYZ';
    try {
      await navigator.clipboard.writeText(code);
      const toast = await this.toastCtrl.create({
        message: `Código de ejemplo copiado: ${code}`,
        duration: 2000,
        position: 'top',
        color: 'success',
        cssClass: 'custom-toast',
      });
      await toast.present();
    } catch (error) {
      console.error('Error copying code:', error);
    }
  }

}
