import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { person, shieldCheckmark, settings } from 'ionicons/icons';
import { AuthorizationService } from '../../../auth/services/authorization.service';

@Component({
  selector: 'app-role-selector',
  template: `
    <ion-chip
      id="role-trigger"
      [color]="currentRole() === 'admin' ? 'primary' : 'medium'"
      style="position: fixed; top: 10px; right: 10px; z-index: 1000;"
    >
      <ion-icon
        [name]="currentRole() === 'admin' ? 'shield-checkmark' : 'person'"
      ></ion-icon>
      <ion-label>{{ currentRole() | titlecase }} Mode</ion-label>
    </ion-chip>

    <ion-popover trigger="role-trigger" triggerAction="click">
      <ion-content>
        <ion-list>
          <ion-item button (click)="setRole('admin')">
            <ion-icon
              name="shield-checkmark"
              slot="start"
              color="primary"
            ></ion-icon>
            <ion-label>Modo Administrador</ion-label>
          </ion-item>
          <ion-item button (click)="setRole('user')">
            <ion-icon name="person" slot="start" color="medium"></ion-icon>
            <ion-label>Modo Usuario</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-popover>
  `,
  standalone: true,
  imports: [
    CommonModule,
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

  // Signals
  private currentRoleSignal = signal<'admin' | 'user' | null>(null);

  // Readonly exports
  readonly currentRole = this.currentRoleSignal.asReadonly();

  // Computed signals
  readonly isAdmin = computed(() => this.currentRoleSignal() === 'admin');
  readonly isUser = computed(() => this.currentRoleSignal() === 'user');
  readonly roleIcon = computed(() =>
    this.currentRoleSignal() === 'admin' ? 'shield-checkmark' : 'person'
  );
  readonly roleColor = computed(() =>
    this.currentRoleSignal() === 'admin' ? 'primary' : 'medium'
  );

  constructor() {
    addIcons({ person, shieldCheckmark, settings });

    // Effect para sincronizar el rol desde AuthorizationService
    effect(() => {
      const role = this.authorizationService.currentUserRole();
      if (role) {
        this.currentRoleSignal.set(role);
      }
    });
  }

  /**
   * Cambia el rol de desarrollo
   */
  setRole(role: 'admin' | 'user'): void {
    try {
      this.authorizationService.setDevelopmentRole(role);
      this.currentRoleSignal.set(role);
    } catch (error) {
      console.error('Error changing role', error);
    }
  }
}
