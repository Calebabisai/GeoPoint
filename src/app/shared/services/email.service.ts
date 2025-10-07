import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { OrganizationInvite } from '../models/organization.model';
import { environment } from '../../../environments/environment';
import emailjs from '@emailjs/browser';

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
  private readonly APP_URL = window.location.origin; // URL actual de tu app

  // Configuración de EmailJS - Obtendrás estos valores en emailjs.com
  private readonly EMAILJS_SERVICE_ID = 'service_gx21jeg';
  private readonly EMAILJS_TEMPLATE_ID = 'template_q2qdam4';
  private readonly EMAILJS_PUBLIC_KEY = 'P8VW0wTiHSQj6qIPX';

  constructor() {
    // Inicializar EmailJS
    if (this.EMAILJS_PUBLIC_KEY === 'P8VW0wTiHSQj6qIPX') {
      emailjs.init(this.EMAILJS_PUBLIC_KEY);
      console.log('✅ EmailJS initialized with your credentials');
    } else {
      console.log('⚠️ EmailJS not configured properly');
    }
  }

  /**
   * Envía una invitación por email
   */
  async sendInvitation(
    invite: OrganizationInvite,
    config: EmailInviteConfig
  ): Promise<void> {
    try {
      console.log('🚀 Starting sendInvitation process...');
      console.log('📧 Target email:', invite.invitedEmail);
      console.log('🏢 Organization:', config.organizationName);

      // Generar el template del email
      console.log('📝 Generating email template...');
      const emailTemplate = this.generateInvitationTemplate(config);
      console.log('✅ Email template generated successfully');

      // En desarrollo, mostrar el email en la consola Y enviarlo
      if (this.isDevelopmentMode()) {
        console.log('🔧 Development mode - logging email to console');
        this.logEmailToConsole({
          to: invite.invitedEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.htmlBody,
          text: emailTemplate.textBody,
        });
      }

      // Enviar email usando EmailJS (tanto en desarrollo como producción)
      console.log('🔑 Checking EmailJS configuration...');
      console.log('Service ID:', this.EMAILJS_SERVICE_ID);

      if (this.EMAILJS_SERVICE_ID === 'service_gx21jeg') {
        console.log('✅ EmailJS configured - proceeding to send...');
        await this.sendEmailViaEmailJS(
          invite.invitedEmail,
          emailTemplate,
          config
        );
        console.log(
          '✅ Invitation email sent successfully to:',
          invite.invitedEmail
        );
      } else {
        console.log('⚠️ EmailJS no configurado - Solo preview en desarrollo');
        console.log('Expected: service_gx21jeg, Got:', this.EMAILJS_SERVICE_ID);
      }
    } catch (error) {
      console.error('❌ Error sending invitation email:', error);

      // Propagar el error específico en lugar de uno genérico
      if (error instanceof Error) {
        throw new Error(`EmailJS Error: ${error.message}`);
      } else {
        throw new Error(`EmailJS Error: ${JSON.stringify(error)}`);
      }
    }
  }

  /**
   * Genera el template HTML del email de invitación
   */
  private generateInvitationTemplate(config: EmailInviteConfig): EmailTemplate {
    const joinUrl = `${this.APP_URL}/join/${config.inviteToken}`;
    const expirationDateStr = config.expirationDate.toLocaleDateString(
      'es-ES',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }
    );

    // Subject siguiendo el estándar de la industria
    const subject = `${config.inviterName} te invitó a unirte a ${config.organizationName} en GeoPoint`;

    const roleText =
      {
        owner: 'Propietario',
        admin: 'Administrador',
        moderator: 'Moderador',
        user: 'Miembro',
      }[config.userRole] || 'Miembro';

    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitación a ${config.organizationName}</title>
    <style>
        body {
            font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            color: #ffffff;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #000000 0%, #111111 100%);
            min-height: 100vh;
        }
        .email-container {
            background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%);
            border-radius: 16px;
            border: 1px solid #00d46a;
            box-shadow: 
                0 8px 32px rgba(0, 212, 106, 0.15),
                0 2px 8px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            position: relative;
        }
        .email-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, #00d46a, #00ff7f, #00d46a, transparent);
            opacity: 0.8;
        }
        .header {
            background: linear-gradient(135deg, #00d46a 0%, #00ff7f 100%);
            color: #000000;
            padding: 40px 30px;
            text-align: center;
            position: relative;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .content {
            padding: 40px 30px;
            color: #ffffff;
        }
        .welcome-message {
            font-size: 20px;
            margin-bottom: 24px;
            color: #d1d5db;
            font-weight: 500;
        }
        .organization-info {
            background: rgba(0, 212, 106, 0.1);
            border-left: 4px solid #00d46a;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
            border: 1px solid rgba(0, 212, 106, 0.3);
        }
        .organization-name {
            font-size: 22px;
            font-weight: 700;
            color: #00d46a;
            margin-bottom: 12px;
            text-shadow: 0 0 10px rgba(0, 212, 106, 0.3);
        }
        .invite-code-section {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d30 100%);
            border: 1px solid #00d46a;
            border-radius: 16px;
            padding: 32px 20px;
            margin: 32px 0;
            text-align: center;
            box-shadow: 0 8px 24px rgba(0, 212, 106, 0.15);
        }
        .invite-code {
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
            font-size: 26px;
            font-weight: 700;
            background: linear-gradient(135deg, #00d46a 0%, #00ff7f 100%);
            color: #000000;
            padding: 16px 24px;
            border-radius: 12px;
            display: inline-block;
            letter-spacing: 3px;
            margin: 16px 0;
            box-shadow: 0 4px 12px rgba(0, 212, 106, 0.3);
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #00d46a 0%, #00ff7f 100%);
            color: #000000 !important;
            text-decoration: none;
            padding: 18px 36px;
            border-radius: 30px;
            font-weight: 700;
            margin: 24px 0;
            transition: all 0.3s ease;
            box-shadow: 0 8px 24px rgba(0, 212, 106, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 18px;
        }
        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 32px rgba(0, 212, 106, 0.4);
        }
        .instructions {
            background: rgba(0, 212, 106, 0.05);
            border: 1px solid rgba(0, 212, 106, 0.3);
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
        }
        .instructions h3 {
            color: #00d46a;
            margin-top: 0;
            font-weight: 700;
        }
        .step {
            margin: 12px 0;
            padding-left: 24px;
            position: relative;
            color: #d1d5db;
            font-weight: 500;
        }
        .step:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #00d46a;
            font-weight: 700;
            font-size: 18px;
        }
        .personal-message {
            background: rgba(0, 168, 255, 0.1);
            border-left: 4px solid #00a8ff;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
            font-style: italic;
            color: #d1d5db;
        }
        .footer {
            background: linear-gradient(135deg, #111111 0%, #000000 100%);
            padding: 30px 20px;
            text-align: center;
            font-size: 14px;
            color: #9ca3af;
            border-top: 1px solid #00d46a;
        }
        .expiration-warning {
            background: rgba(255, 149, 0, 0.1);
            border: 1px solid #ff9500;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            font-size: 14px;
            color: #ff9500;
            font-weight: 500;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .content {
                padding: 20px;
            }
            .invite-code {
                font-size: 20px;
                padding: 10px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🎉 ¡Bienvenido al equipo!</h1>
        </div>
        
        <div class="content">
            <div class="welcome-message">
                Hola,
            </div>
            
            <p><strong>${config.inviterName}</strong> (${
      config.inviterEmail
    }) te ha invitado a unirte a su organización:</p>
            
            <div class="organization-info">
                <div class="organization-name">📋 ${
                  config.organizationName
                }</div>
                <p>Te invitamos a formar parte de nuestro equipo como <strong>${roleText}</strong>${
      config.department ? ` en el departamento de ${config.department}` : ''
    }.</p>
            </div>

            ${
              config.personalMessage
                ? `
            <div class="personal-message">
                <strong>Mensaje personal:</strong><br>
                "${config.personalMessage}"
            </div>
            `
                : ''
            }
            
            <div class="invite-code-section">
                <p><strong>¡Solo necesitas hacer clic en el botón!</strong></p>
                <p style="margin-top: 15px;">
                    <a href="${joinUrl}" class="cta-button">🚀 Unirme a ${
      config.organizationName
    }</a>
                </p>
                <p style="font-size: 12px; color: #666; margin-top: 15px;">
                    O copia este enlace en tu navegador:<br>
                    <a href="${joinUrl}" style="color: #00d46a;">${joinUrl}</a>
                </p>
            </div>
            
            <div class="instructions">
                <h3>📋 ¡Es muy fácil!</h3>
                <div class="step">Haz clic en el botón "Unirme a ${
                  config.organizationName
                }"</div>
                <div class="step">Se abrirá la aplicación GeoPoint</div>
                <div class="step">Serás agregado automáticamente al equipo</div>
                <div class="step">¡Listo! Ya puedes empezar a colaborar</div>
            </div>
            
            <div class="expiration-warning">
                ⏰ <strong>Importante:</strong> Esta invitación expira el ${expirationDateStr}. ¡No esperes demasiado!
            </div>
        </div>
        
        <div class="footer">
            <p>Este email fue enviado desde GeoPoint</p>
            <p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
        </div>
    </div>
</body>
</html>`;

    const textBody = `
¡Te invitamos a unirte a ${config.organizationName}!

Invitación enviada por:
${config.inviterName} (${config.inviterEmail})

Te ha invitado a formar parte de ${config.organizationName} como ${roleText}${
      config.department ? ` en el departamento de ${config.department}` : ''
    }.

Para unirte al equipo, simplemente abre este enlace:
${joinUrl}

¡Es muy fácil!
1. Haz clic en el enlace
2. Se abrirá la aplicación GeoPoint
3. Serás agregado automáticamente al equipo
4. ¡Listo! Ya puedes empezar a colaborar

Importante: Esta invitación expira el ${expirationDateStr}.

${
  config.personalMessage
    ? `Mensaje personal de ${config.inviterName}: "${config.personalMessage}"`
    : ''
}

Este email fue enviado desde GeoPoint.
`;

    return {
      subject,
      htmlBody,
      textBody,
    };
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
      console.log('🔥 Preparing to send email via EmailJS...');
      console.log('📧 To:', toEmail);
      console.log('🔑 Service ID:', this.EMAILJS_SERVICE_ID);
      console.log('📄 Template ID:', this.EMAILJS_TEMPLATE_ID);

      // ESTÁNDAR DE LA INDUSTRIA: Usar email de sistema único para todos los envíos
      // Los proveedores de email (Gmail, Outlook, iCloud) NO permiten que aplicaciones
      // envíen correos "en nombre de" usuarios sin autenticación OAuth específica.

      const systemFromEmail = 'GeoPointDev@hotmail.com'; // Email del sistema GeoPoint

      const templateParams = {
        // Campos estándar de EmailJS
        to_email: toEmail,
        to_name: toEmail.split('@')[0],
        from_name: config.organizationName || 'GeoPoint',
        from_email: systemFromEmail,
        subject: emailTemplate.subject,
        message: emailTemplate.textBody, // Contenido principal

        // Campos personalizados para el template
        name: toEmail.split('@')[0], // Para {{name}}
        organization: config.organizationName, // Para {{organization}}
        invitation_link: config.joinUrl, // Para [Invitation Link]
        organization_name: config.organizationName,
        join_url: config.joinUrl,
        user_role: config.userRole,
        department: config.department || '',
        personal_message: config.personalMessage || '',
        expiration_date: config.expirationDate.toLocaleDateString('es-ES'),
        html_content: emailTemplate.htmlBody,
        text_content: emailTemplate.textBody,

        // Info del invitador real (se mostrará en el contenido)
        inviter_name: config.inviterName,
        inviter_email: config.inviterEmail,

        // Campos alternativos por si EmailJS usa otros nombres
        reply_to: systemFromEmail,
        email_id: this.EMAILJS_TEMPLATE_ID,
      };

      console.log('📋 Template params:', templateParams);
      console.log('📧 Destination email (to_email):', templateParams.to_email);
      console.log('📧 From email (from_email):', templateParams.from_email);

      console.log('📤 Calling EmailJS send...');
      const result = await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        templateParams
      );

      console.log('✅ EmailJS Success:', result);
    } catch (error) {
      console.error('❌ EmailJS Error Details:', error);

      // Capturar información específica del error
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      // Revisar si es un error específico de EmailJS
      if (typeof error === 'object' && error !== null) {
        console.error('Error object:', JSON.stringify(error, null, 2));
      }

      throw error; // Propagar el error original en lugar de crear uno nuevo
    }
  }

  /**
   * Muestra el email en la consola para desarrollo
   */
  private logEmailToConsole(emailData: any): void {
    console.log('\n📧 EMAIL PREVIEW (Development Mode)');
    console.log('=====================================');
    console.log('To:', emailData.to);
    console.log('Subject:', emailData.subject);
    console.log('\n--- TEXT VERSION ---');
    console.log(emailData.text);
    console.log('\n--- HTML VERSION ---');
    console.log('Use browser dev tools to preview the HTML:');
    console.log(
      `data:text/html;charset=utf-8,${encodeURIComponent(emailData.html)}`
    );
    console.log('=====================================\n');

    // Crear un evento para mostrar el email en la UI
    window.dispatchEvent(
      new CustomEvent('emailPreview', {
        detail: {
          email: emailData,
          timestamp: new Date(),
        },
      })
    );
  }

  /**
   * Verifica si estamos en modo desarrollo
   */
  private isDevelopmentMode(): boolean {
    return !environment.production || window.location.hostname === 'localhost';
  }

  /**
   * Envía un email de bienvenida después de unirse
   */
  async sendWelcomeEmail(
    userEmail: string,
    organizationName: string,
    userRole: string
  ): Promise<void> {
    const welcomeTemplate = this.generateWelcomeTemplate(
      organizationName,
      userRole
    );

    const emailData = {
      to: userEmail,
      subject: welcomeTemplate.subject,
      html: welcomeTemplate.htmlBody,
      text: welcomeTemplate.textBody,
      metadata: {
        type: 'welcome_email',
        organizationName,
        userRole,
      },
    };

    if (this.isDevelopmentMode()) {
      this.logEmailToConsole(emailData);
      return;
    }

    // En producción, enviar usando EmailJS
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
    console.log('✅ Welcome email sent to:', userEmail);
  }

  /**
   * Genera el template de bienvenida
   */
  private generateWelcomeTemplate(
    organizationName: string,
    userRole: string
  ): EmailTemplate {
    const subject = `¡Bienvenido a ${organizationName}!`;

    const roleText =
      {
        owner: 'propietario',
        admin: 'administrador',
        moderator: 'moderador',
        user: 'miembro',
      }[userRole] || 'miembro';

    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a ${organizationName}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .email-container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #00d46a 0%, #00bb5d 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .welcome-box {
            background: #f0fff4;
            border: 2px solid #00d46a;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        .role-badge {
            background: #00d46a;
            color: white;
            padding: 5px 15px;
            border-radius: 15px;
            font-size: 14px;
            font-weight: 600;
            display: inline-block;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🎉 ¡Bienvenido a bordo!</h1>
        </div>
        
        <div class="content">
            <div class="welcome-box">
                <h2>Ya formas parte de ${organizationName}</h2>
                <p>Tu rol es: <span class="role-badge">${roleText}</span></p>
            </div>
            
            <p>¡Felicidades! Ahora puedes:</p>
            <ul>
                <li>📍 Crear y ver marcadores en el mapa</li>
                <li>🗺️ Definir zonas de trabajo</li>
                <li>👥 Colaborar con tu equipo</li>
                <li>📊 Acceder a los datos de tu organización</li>
            </ul>
            
            <p>Si tienes alguna pregunta, no dudes en contactar a tu administrador.</p>
        </div>
    </div>
</body>
</html>`;

    const textBody = `
¡Bienvenido a ${organizationName}!

Ya formas parte del equipo como ${roleText}.

Ahora puedes:
- Crear y ver marcadores en el mapa
- Definir zonas de trabajo  
- Colaborar con tu equipo
- Acceder a los datos de tu organización

Si tienes alguna pregunta, no dudes en contactar a tu administrador.
`;

    return {
      subject,
      htmlBody,
      textBody,
    };
  }

  /**
   * Envía recordatorio de invitación
   */
  async sendInvitationReminder(
    invite: OrganizationInvite,
    config: EmailInviteConfig
  ): Promise<void> {
    const daysUntilExpiration = Math.ceil(
      (config.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const reminderConfig = {
      ...config,
      personalMessage: `Recordatorio: Tu invitación expira en ${daysUntilExpiration} días. ${
        config.personalMessage || ''
      }`,
    };

    const template = this.generateInvitationTemplate(reminderConfig);
    template.subject = `Recordatorio: ${template.subject}`;

    const emailData = {
      to: invite.invitedEmail,
      subject: template.subject,
      html: template.htmlBody,
      text: template.textBody,
      metadata: {
        inviteId: invite.id,
        type: 'invitation_reminder',
      },
    };

    if (this.isDevelopmentMode()) {
      this.logEmailToConsole(emailData);
      return;
    }

    // En producción, enviar usando EmailJS
    if (this.EMAILJS_SERVICE_ID === 'service_gx21jeg') {
      const reminderTemplate = this.generateInvitationTemplate(reminderConfig);
      await this.sendEmailViaEmailJS(
        invite.invitedEmail,
        reminderTemplate,
        reminderConfig
      );
    }
    console.log('✅ Invitation reminder sent to:', invite.invitedEmail);
  }
}
