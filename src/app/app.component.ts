import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { MenuComponent } from './shared/components/menu/menu.component';
import { NetworkStatusComponent } from './shared/components/network-status/network-status.component';
import { AuthService } from './core/services/auth.service';
import { MobilePlatformService } from './core/services/platform.service';
import { NetworkService } from './core/services/network.service';
import { LoggerService } from './core/services/logger.service';
import { App } from '@capacitor/app';
import { DeepLinkService } from './core/services/deep-link.service';

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
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private mobilePlatformService = inject(MobilePlatformService);
  private platform = inject(Platform);
  private networkService = inject(NetworkService);
  private logger = inject(LoggerService);
  private deepLinkService = inject(DeepLinkService);

  ngOnInit() {
    this.initializeAppLifecycle();
    this.deepLinkService.initialize();
  }

  private initializeAppLifecycle() {
  if (this.platform.is('capacitor')) {
    App.addListener('appStateChange', ({ isActive }) => {
      this.logger.log(
        `App state changed: ${isActive ? 'Active' : 'Background'}`
      );

      if (isActive) {
        this.networkService.processOfflineQueue();
      } else {
        this.logger.log('App going to background - pausing heavy operations');
      }
    });

    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      }
    });
  }
}
}
