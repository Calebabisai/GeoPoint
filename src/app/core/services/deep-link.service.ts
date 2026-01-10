
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root',
})
export class DeepLinkService {
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);

  // ID de tu app en Play Store (lo obtienes cuando la publiques)
  private readonly PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.imaginetz.geopoint';
  
  // ID de tu app en App Store (si tienes iOS)
  private readonly APP_STORE_URL = 'https://apps.apple.com/app/geopoint/id123456789';

  /**
   * Inicializa el listener de deep links
   * Debe llamarse en app.component.ts
   */
  async initialize(): Promise<void> {
    // En Capacitor siempre es nativo, pero verificamos por seguridad
    if (!Capacitor.isNativePlatform()) {
      this.logger.log('Deep links: Not a native platform');
      return;
    }

    this.logger.log('Deep links: Initializing listener...');

    // Listener para cuando la app se abre via deep link
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.logger.log('Deep link received:', event.url);
      this.handleDeepLink(event.url);
    });

    // Verificar si la app fue abierta con un deep link inicial
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) {
      this.logger.log('App launched with deep link:', launchUrl.url);
      // Pequeño delay para asegurar que la app esté lista
      setTimeout(() => {
        this.handleDeepLink(launchUrl.url);
      }, 500);
    }
  }

  /**
   * Procesa el deep link y navega a la ruta correspondiente
   */
  public handleDeepLink(url: string): void {
    try {
      let path = '';
      
      if (url.startsWith('geopoint://')) {
        // Esquema personalizado: geopoint://join/CODIGO
        path = url.replace('geopoint://', '/');
      } else if (url.includes('geopoint.app') || url.includes('localhost')) {
        // URL HTTP/HTTPS
        const urlObj = new URL(url);
        path = urlObj.pathname;
      } else {
        this.logger.warn('Unknown URL format:', url);
        return;
      }

      this.logger.log('Deep link path:', path);

      // Manejar rutas de invitación
      if (path.startsWith('/join/')) {
        const token = path.replace('/join/', '').split('?')[0]; // Remover query params
        if (token) {
          this.logger.log('Navigating to invitation with token:', token);
          this.router.navigate(['/invitations/join', token]);
        }
      } else if (path.startsWith('/invitations/join/')) {
        const token = path.replace('/invitations/join/', '').split('?')[0];
        if (token) {
          this.router.navigate(['/invitations/join', token]);
        }
      } else {
        this.logger.warn('Unhandled deep link path:', path);
      }
    } catch (error) {
      this.logger.error('Error handling deep link:', error);
    }
  }

  /**
   * Genera la URL para compartir invitaciones
   * Esta URL abre la app si está instalada, o Play Store si no
   */
  generateInvitationUrl(inviteCode: string): string {
    // Usar esquema personalizado para que Android lo intercepte
    return `geopoint://join/${inviteCode}`;
  }

  /**
   * Genera URL de fallback para el email
   * Si el usuario no tiene la app, redirige a Play Store
   */
  generateEmailInvitationUrl(inviteCode: string): string {
    // Esta URL usa un redirect inteligente
    // En producción, necesitarás una página web simple que haga el redirect
    return `https://geopoint.app/join/${inviteCode}`;
  }

  /**
   * Obtiene la URL de la tienda según la plataforma
   */
  getStoreUrl(): string {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      return this.APP_STORE_URL;
    }
    return this.PLAY_STORE_URL;
  }
}
