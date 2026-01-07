import { Component, inject, computed, effect } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import {
  IonIcon,
  IonChip,
  IonLabel,
  IonPopover,
  IonContent,
  IonList,
  IonItem,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { person, shieldCheckmark } from 'ionicons/icons';
import { AuthorizationService } from 'src/app/core/services/authorization.service';

@Component({
  selector: 'app-role-selector',
  templateUrl: './role-selector.component.html',
  styleUrls: ['./role-selector.component.scss'],
  standalone: true,
  imports: [
    TitleCasePipe,
    IonIcon,
    IonChip,
    IonLabel,
    IonPopover,
    IonContent,
    IonList,
    IonItem,
  ],
})
export class RoleSelectorComponent {
  private authorizationService = inject(AuthorizationService);

  readonly currentRole = computed(() =>
    this.authorizationService.currentUserRole()
  );

  readonly isAdmin = computed(() => this.currentRole() === 'admin');
  readonly roleIcon = computed(() =>
    this.currentRole() === 'admin' ? 'shield-checkmark' : 'person'
  );
  readonly roleColor = computed(() =>
    this.currentRole() === 'admin' ? 'primary' : 'medium'
  );

  constructor() {
    addIcons({ person, shieldCheckmark });
  }

  /**
   * Cambia el rol de desarrollo
   */
  setRole(role: 'admin' | 'user'): void {
    try {
      this.authorizationService.setDevelopmentRole(role);
    } catch (error) {
      console.error('Error changing role', error);
    }
  }
}
