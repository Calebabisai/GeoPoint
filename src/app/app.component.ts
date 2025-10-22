import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// removi RouterOutlet : en el template se usa IonRouterOutlet
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { MenuComponent } from './shared/components/menu/menu.component';
import { NetworkStatusComponent } from './shared/components/network-status/network-status.component';
import { AuthService } from './auth/services/auth';
import { MobilePlatformService } from './services/mobile-platform.service';
import { NetworkService } from './shared/services/network.service';
import { LoggerService } from './shared/services/logger.service';
import { App } from '@capacitor/app';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    IonApp,
    IonRouterOutlet,
    CommonModule,
    MenuComponent,
    NetworkStatusComponent,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private mobilePlatformService = inject(MobilePlatformService);
  private platform = inject(Platform);
  private networkService = inject(NetworkService);
  private logger = inject(LoggerService);
  private subscriptions = new Subscription();

  async ngOnInit() {
    // MobilePlatformService se inicializa automáticamente en su constructor
    this.authService.checkAuthStatus();
    this.initializeAppLifecycle();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private initializeAppLifecycle() {
    if (this.platform.is('capacitor')) {
      // Manejo de estado de la app (foreground/background)
      App.addListener('appStateChange', ({ isActive }) => {
        this.logger.log(
          `App state changed: ${isActive ? 'Active' : 'Background'}`
        );

        if (isActive) {
          // La app vuelve a primer plano - sincronizar operaciones pendientes
          this.networkService.processOfflineQueue();
        } else {
          // La app va a segundo plano - limpiar recursos
          this.logger.log('App going to background - pausing heavy operations');
        }
      });

      // Manejo de URLs profundas (deep links)
      App.addListener('appUrlOpen', (data) => {
        this.logger.log('App opened with URL:', data.url);
      });

      // Manejo del botón atrás en Android
      App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          App.exitApp();
        }
      });
    }
  }
}
