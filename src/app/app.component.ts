import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// removi RouterOutlet : en el template se usa IonRouterOutlet
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { MenuComponent } from './shared/components/menu/menu.component';
import { AuthService } from './auth/services/auth';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonApp, IonRouterOutlet, MenuComponent],
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);

  constructor() {}

  ngOnInit() {
    this.authService.checkAuthStatus(); // Verifica el estado de autenticación al iniciar
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark }); // Estilo de la barra de estado en nativo
    }
  }
}
