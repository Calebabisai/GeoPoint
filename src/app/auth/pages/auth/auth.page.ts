import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { RouterModule, Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { addIcons } from 'ionicons';
import {
  locationOutline,
  logInOutline,
  personAddOutline,
  mapOutline,
  navigateOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, IonContent, IonButton, IonIcon, RouterModule],
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
})
export class AuthPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    addIcons({
      locationOutline,
      logInOutline,
      personAddOutline,
      mapOutline,
      navigateOutline,
    });
  }

  ngOnInit() {
    // Redirigir automáticamente si el usuario ya está autenticado
    this.authService
      .getCurrentUser()
      .pipe(take(1))
      .subscribe((u) => {
        if (u) {
          this.router.navigate(['/map']);
        }
      });
  }
}
