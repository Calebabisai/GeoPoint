import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// removi RouterOutlet : en el template se usa IonRouterOutlet
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { MenuComponent } from './shared/components/menu/menu.component';
import { AuthService } from './auth/services/auth';
import { MobilePlatformService } from './services/mobile-platform.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonApp, IonRouterOutlet, MenuComponent],
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private mobilePlatformService = inject(MobilePlatformService);

  constructor() {}

  ngOnInit() {
    // Inicializar servicios
    this.authService.checkAuthStatus(); // Verifica el estado de autenticación al iniciar

    // La inicialización móvil se maneja automáticamente en el constructor del servicio
    console.log('🚀 GeoPoint App initialized');
    console.log('📱 Device Info:', this.mobilePlatformService.getDeviceInfo());
    console.log(
      '🌐 Network Status:',
      this.mobilePlatformService.getNetworkStatus()
    );
  }
}
