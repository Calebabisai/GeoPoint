export const INVITATION_MODAL_TEMPLATES = {
  successModal: (code: string) => `
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
          <span class="invite-code">${code}</span>
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

  inviteCodeAlert: (code: string) => `
    <p><strong>El código de invitación es:</strong></p>
    <p style="font-size: 1.4em; font-weight: bold; color: var(--ion-color-primary); text-align: center; padding: 10px; background: var(--ion-color-light); border-radius: 8px; margin: 10px 0;">
      ${code}
    </p>
    <p><strong>¿Cómo usar el código?</strong></p>
    <ol style="text-align: left; margin: 10px 0;">
      <li>El usuario debe iniciar sesión en la app</li>
      <li>Abrir el menú lateral (☰)</li>
      <li>Ir a "Gestión de Organizaciones"</li>
      <li>Seleccionar "Unirse con Código"</li>
      <li>Ingresar el código: <strong>${code}</strong></li>
    </ol>
    <p style="color: var(--ion-color-medium); font-size: 0.9em;">
      ⏰ El código expira en 7 días
    </p>
  `,
};