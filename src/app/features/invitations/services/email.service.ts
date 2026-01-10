import { Injectable, signal, computed } from '@angular/core';
import { OrganizationInvite } from 'src/app/core/models/organization.model';
import emailjs from '@emailjs/browser';
import { EMAIL_TEMPLATES } from '../components/email-invitation-manager/email-templates';

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface EmailInviteConfig {
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  inviteToken: string;
  joinUrl: string;
  expirationDate: Date;
  personalMessage?: string;
  userRole: string;
  department?: string;
}

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  private readonly APP_URL = window.location.origin;
  private readonly EMAILJS_SERVICE_ID = 'service_gx21jeg';
  private readonly EMAILJS_TEMPLATE_ID = 'template_q2qdam4';
  private readonly EMAILJS_PUBLIC_KEY = 'P8VW0wTiHSQj6qIPX';

  // Signals
  private isSendingSignal = signal(false);
  private lastErrorSignal = signal<string | null>(null);
  private sentEmailsCountSignal = signal(0);

  // Readonly exports
  readonly isSending = this.isSendingSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();
  readonly sentEmailsCount = this.sentEmailsCountSignal.asReadonly();

  // Computed signals
  readonly hasSentEmails = computed(() => this.sentEmailsCountSignal() > 0);
  readonly hasError = computed(() => this.lastErrorSignal() !== null);

  constructor() {
    this.initializeEmailJS();
  }

  /**
   * Inicializa EmailJS
   */
  private initializeEmailJS(): void {
    if (this.EMAILJS_PUBLIC_KEY === 'P8VW0wTiHSQj6qIPX') {
      emailjs.init(this.EMAILJS_PUBLIC_KEY);
    }
  }

  /**
   * Envía una invitación por email
   */
  async sendInvitation(
    invite: OrganizationInvite,
    config: EmailInviteConfig
  ): Promise<void> {
    this.isSendingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      console.log(' Sending invitation to:', invite.invitedEmail);

      const emailTemplate = EMAIL_TEMPLATES.invitationTemplate(config);

      if (this.EMAILJS_SERVICE_ID === 'service_gx21jeg') {
        await this.sendEmailViaEmailJS(
          invite.invitedEmail,
          emailTemplate,
          config
        );
        this.sentEmailsCountSignal.update((count) => count + 1);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? `EmailJS Error: ${error.message}`
          : `EmailJS Error: ${JSON.stringify(error)}`;
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isSendingSignal.set(false);
    }
  }

  /**
   * Envía email usando EmailJS
   */
  private async sendEmailViaEmailJS(
    toEmail: string,
    emailTemplate: EmailTemplate,
    config: EmailInviteConfig
  ): Promise<void> {
    try {
      const systemFromEmail = 'GeoPointDev@hotmail.com';

      const templateParams = {
        to_email: toEmail,
        to_name: toEmail.split('@')[0],
        from_name: config.organizationName || 'GeoPoint',
        from_email: systemFromEmail,
        subject: emailTemplate.subject,
        message: emailTemplate.textBody,
        organization_name: config.organizationName,
        join_url: config.joinUrl,
        invite_token: config.inviteToken, // ← AGREGAR ESTA LÍNEA
        user_role: config.userRole,
        department: config.department || '',
        personal_message: config.personalMessage || '',
        expiration_date: config.expirationDate.toLocaleDateString('es-ES'),
        html_content: emailTemplate.htmlBody,
        text_content: emailTemplate.textBody,
        inviter_name: config.inviterName,
        inviter_email: config.inviterEmail,
        reply_to: systemFromEmail,
      };

      await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        templateParams
      );
    } catch (error) {
      console.error(' EmailJS Error:', error);
      throw error;
    }
  }

  /**
   * Envía un email de bienvenida
   */
  async sendWelcomeEmail(
    userEmail: string,
    organizationName: string,
    userRole: string
  ): Promise<void> {
    this.isSendingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const welcomeTemplate = EMAIL_TEMPLATES.welcomeTemplate(
        organizationName,
        userRole
      );

      if (this.EMAILJS_SERVICE_ID === 'service_gx21jeg') {
        await this.sendEmailViaEmailJS(userEmail, welcomeTemplate, {
          organizationName,
          inviterName: 'Sistema',
          inviterEmail: 'noreply@geopoint.com',
          inviteToken: '',
          joinUrl: '',
          expirationDate: new Date(),
          userRole,
        });
      }

      this.sentEmailsCountSignal.update((count) => count + 1);
      console.log(' Welcome email sent');
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : JSON.stringify(error);
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isSendingSignal.set(false);
    }
  }

  /**
   * Envía recordatorio de invitación
   */
  async sendInvitationReminder(
    invite: OrganizationInvite,
    config: EmailInviteConfig
  ): Promise<void> {
    this.isSendingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const daysUntilExpiration = Math.ceil(
        (config.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const reminderConfig = {
        ...config,
        personalMessage: `Recordatorio: Tu invitación expira en ${daysUntilExpiration} días.`,
      };

      const template = EMAIL_TEMPLATES.invitationTemplate(reminderConfig);
      template.subject = `Recordatorio: ${template.subject}`;

      if (this.EMAILJS_SERVICE_ID === 'service_gx21jeg') {
        await this.sendEmailViaEmailJS(invite.invitedEmail, template, reminderConfig);
      }

      this.sentEmailsCountSignal.update((count) => count + 1);
      console.log(' Reminder sent');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isSendingSignal.set(false);
    }
  }

  /**
   * Limpia el error
   */
  clearError(): void {
    this.lastErrorSignal.set(null);
  }

  /**
   * Resetea el contador
   */
  resetEmailCount(): void {
    this.sentEmailsCountSignal.set(0);
  }
}
