export const EMAIL_TEMPLATES = {

    invitationTemplate: (config: {
        organizationName: string;
        inviterName: string;
        inviterEmail: string;
        inviteToken: string; // Cambiado de inviteCode a inviteToken
        joinUrl: string;
        expirationDate: Date;
        personalMessage?: string;
        userRole: string;
        department?: string;
    }) => {
        const expirationDateStr = config.expirationDate.toLocaleDateString(
        'es-ES',
        {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }
        );

        const roleText =
        {
            owner: 'Propietario',
            admin: 'Administrador',
            moderator: 'Moderador',
            user: 'Miembro',
        }[config.userRole] || 'Miembro';

        // URLs para la app - usar inviteToken
        const appDeepLink = `geopoint://join/${config.inviteToken}`;
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.imaginetz.geopoint';

        const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitacion a ${config.organizationName}</title>
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
            box-shadow: 0 8px 32px rgba(0, 212, 106, 0.15), 0 2px 8px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #00d46a 0%, #00ff7f 100%);
            color: #000000;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content {
            padding: 40px 30px;
            color: #ffffff;
        }
        .organization-info {
            background: rgba(0, 212, 106, 0.1);
            border-left: 4px solid #00d46a;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
        }
        .organization-name {
            font-size: 22px;
            font-weight: 700;
            color: #00d46a;
            margin-bottom: 12px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #00d46a 0%, #00ff7f 100%);
            color: #000000 !important;
            text-decoration: none;
            padding: 18px 36px;
            border-radius: 30px;
            font-weight: 700;
            margin: 12px 0;
            font-size: 16px;
        }
        .secondary-button {
            display: inline-block;
            background: transparent;
            color: #00d46a !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 30px;
            font-weight: 600;
            margin: 8px 0;
            border: 2px solid #00d46a;
            font-size: 14px;
        }
        .buttons-container {
            text-align: center;
            margin: 30px 0;
        }
        .divider {
            display: flex;
            align-items: center;
            margin: 20px 0;
            color: #6b7280;
        }
        .divider::before,
        .divider::after {
            content: '';
            flex: 1;
            border-bottom: 1px solid #374151;
        }
        .divider span {
            padding: 0 16px;
            font-size: 12px;
            text-transform: uppercase;
        }
        .footer {
            background: linear-gradient(135deg, #111111 0%, #000000 100%);
            padding: 30px 20px;
            text-align: center;
            font-size: 14px;
            color: #9ca3af;
            border-top: 1px solid #00d46a;
        }
        .help-text {
            font-size: 13px;
            color: #9ca3af;
            margin-top: 8px;
        }
        .warning-box {
            background: rgba(255, 149, 0, 0.1);
            border: 1px solid #ff9500;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            color: #ff9500;
        }
        @media (max-width: 600px) {
            body { padding: 10px; }
            .content { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>📍 ¡Te han invitado!</h1>
        </div>
        
        <div class="content">
            <p><strong>${config.inviterName}</strong> te ha invitado a unirte a su organizacion en GeoPoint:</p>
            
            <div class="organization-info">
                <div class="organization-name">${config.organizationName}</div>
                <p>Te uniras como <strong>${roleText}</strong>${config.department ? ` en el departamento de ${config.department}` : ''}.</p>
            </div>

            ${config.personalMessage ? `
            <div style="background: rgba(0, 168, 255, 0.1); border-left: 4px solid #00a8ff; padding: 20px; margin: 24px 0; border-radius: 8px;">
                <strong>Mensaje personal:</strong><br>"${config.personalMessage}"
            </div>
            ` : ''}

            <!-- Botones de accion -->
            <div class="buttons-container">
                <a href="${appDeepLink}" class="cta-button">📱 Abrir en GeoPoint</a>
                <p class="help-text">Toca aqui si ya tienes la app instalada</p>
                
                <div class="divider"><span>¿No tienes la app?</span></div>
                
                <a href="${playStoreUrl}" class="secondary-button">⬇️ Descargar desde Play Store</a>
                <p class="help-text">Instala la app y vuelve a tocar "Abrir en GeoPoint"</p>
            </div>
            
            <div class="warning-box">
                <strong>⏰ Importante:</strong> Esta invitacion expira el ${expirationDateStr}.
            </div>
        </div>
        
        <div class="footer">
            <p>Este email fue enviado desde <strong>GeoPoint</strong></p>
            <p style="font-size: 12px; margin-top: 8px;">Si no esperabas esta invitacion, puedes ignorar este correo.</p>
        </div>
    </div>
</body>
</html>`;

        const textBody = `
¡Te han invitado a unirte a ${config.organizationName}!

${config.inviterName} te ha invitado a formar parte de su organizacion en GeoPoint.

Tu rol sera: ${roleText}${config.department ? ` en el departamento de ${config.department}` : ''}

${config.personalMessage ? `Mensaje personal: "${config.personalMessage}"` : ''}

COMO UNIRTE:

1. Si ya tienes la app GeoPoint instalada:
   Abre este enlace en tu telefono: ${appDeepLink}

2. Si no tienes la app:
   - Descargala desde Play Store: ${playStoreUrl}
   - Despues de instalarla, vuelve a abrir este correo y toca el enlace de arriba

IMPORTANTE: Esta invitacion expira el ${expirationDateStr}.

---
Este email fue enviado desde GeoPoint.
Si no esperabas esta invitacion, puedes ignorar este correo.
`;

        return {
        subject: `📍 ${config.inviterName} te invito a ${config.organizationName}`,
        htmlBody,
        textBody,
        };
    },

  /**
   * Template de bienvenida
   */
  welcomeTemplate: (
    organizationName: string,
    userRole: string
  ) => {
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
            <h1>¡Bienvenido a bordo!</h1>
        </div>
        
        <div class="content">
            <div class="welcome-box">
                <h2>Ya formas parte de ${organizationName}</h2>
                <p>Tu rol es: <span class="role-badge">${roleText}</span></p>
            </div>
            
            <p>¡Felicidades! Ahora puedes:</p>
            <ul>
                <li>Crear y ver marcadores en el mapa</li>
                <li>Definir zonas de trabajo</li>
                <li>Colaborar con tu equipo</li>
                <li>Acceder a los datos de tu organización</li>
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
      subject: `¡Bienvenido a ${organizationName}!`,
      htmlBody,
      textBody,
    };
  },
};