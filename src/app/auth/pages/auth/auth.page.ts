import { Component, inject, effect } from '@angular/core';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { RouterModule, Router } from '@angular/router';
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
  imports: [IonContent, IonButton, IonIcon, RouterModule],
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
})
export class AuthPage {
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

    effect(() => {
      const user = this.authService.getCurrentUser()();
      if(user) {
        this.router.navigate(['/map'])
      }
    })
  }
}
