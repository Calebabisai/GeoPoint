export const EMAIL_TEMPLATES = {
  /**
   * Template de invitación
   */
  invitationTemplate: (config: {
    organizationName: string;
    inviterName: string;
    inviterEmail: string;
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
            box-shadow: 0 8px 32px rgba(0, 212, 106, 0.15), 0 2px 8px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            position: relative;
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
            margin: 24px 0;
        }
        .footer {
            background: linear-gradient(135deg, #111111 0%, #000000 100%);
            padding: 30px 20px;
            text-align: center;
            font-size: 14px;
            color: #9ca3af;
            border-top: 1px solid #00d46a;
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
            <h1>🎉 ¡Bienvenido al equipo!</h1>
        </div>
        
        <div class="content">
            <p><strong>${config.inviterName}</strong> (${config.inviterEmail}) te ha invitado a unirte a su organización:</p>
            
            <div class="organization-info">
                <div class="organization-name">📋 ${config.organizationName}</div>
                <p>Te invitamos a formar parte de nuestro equipo como <strong>${roleText}</strong>${config.department ? ` en el departamento de ${config.department}` : ''}.</p>
            </div>

            ${
              config.personalMessage
                ? `<div style="background: rgba(0, 168, 255, 0.1); border-left: 4px solid #00a8ff; padding: 20px; margin: 24px 0; border-radius: 8px;"><strong>Mensaje personal:</strong><br>"${config.personalMessage}"</div>`
                : ''
            }
            
            <div style="text-align: center;">
                <a href="${config.joinUrl}" class="cta-button">🚀 Unirme a ${config.organizationName}</a>
            </div>
            
            <div style="background: rgba(255, 149, 0, 0.1); border: 1px solid #ff9500; border-radius: 8px; padding: 16px; margin: 20px 0; color: #ff9500;">
                ⏰ <strong>Importante:</strong> Esta invitación expira el ${expirationDateStr}.
            </div>
        </div>
        
        <div class="footer">
            <p>Este email fue enviado desde GeoPoint</p>
        </div>
    </div>
</body>
</html>`;

    const textBody = `
¡Te invitamos a unirte a ${config.organizationName}!

Invitación enviada por: ${config.inviterName} (${config.inviterEmail})

Para unirte al equipo, abre este enlace:
${config.joinUrl}

Importante: Esta invitación expira el ${expirationDateStr}.

${config.personalMessage ? `Mensaje personal: "${config.personalMessage}"` : ''}

Este email fue enviado desde GeoPoint.
`;

    return {
      subject: `${config.inviterName} te invitó a unirte a ${config.organizationName} en GeoPoint`,
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
      subject: `¡Bienvenido a ${organizationName}!`,
      htmlBody,
      textBody,
    };
  },
};