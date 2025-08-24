import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { AsyncPipe, TitleCasePipe } from '@angular/common';
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
import { Observable } from 'rxjs';

@Component({
  selector: 'app-role-selector',
  template: `
    <ion-chip
      id="role-trigger"
      [color]="(currentRole$ | async) === 'admin' ? 'primary' : 'medium'"
      style="position: fixed; top: 10px; right: 10px; z-index: 1000;"
    >
      <ion-icon
        [name]="
          (currentRole$ | async) === 'admin' ? 'shield-checkmark' : 'person'
        "
      ></ion-icon>
      <ion-label>{{ currentRole$ | async | titlecase }} Mode</ion-label>
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
    AsyncPipe,
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
  private cdr = inject(ChangeDetectorRef);

  currentRole$: Observable<'dev' | 'admin' | 'user' | null>;

  constructor() {
    addIcons({ person, shieldCheckmark, settings });
    this.currentRole$ = this.authorizationService.getCurrentUserRole();
  }

  setRole(role: 'dev' | 'admin' | 'user') {
    // Cambio de rol temporal para desarrollo
    console.log(`🔐 Switching to ${role} mode`);

    try {
      // Usar el método de desarrollo del AuthorizationService
      this.authorizationService.setDevelopmentRole(role);

      // Forzar actualización del observable y detección de cambios
      setTimeout(() => {
        console.log('🔄 Forcing role check after setDevelopmentRole');
        this.currentRole$ = this.authorizationService.getCurrentUserRole();
        this.cdr.detectChanges();
      }, 100);

      console.log(`✅ Role changed to ${role} mode for development`);
    } catch (error) {
      console.error('❌ Error changing role:', error);
    }
  }
}
