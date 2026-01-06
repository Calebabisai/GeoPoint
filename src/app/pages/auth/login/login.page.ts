import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonInput,
  IonButton,
  IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { location, logInOutline, personAddOutline } from 'ionicons/icons';
import { AuthService } from 'src/app/auth/services/auth.service';
import { UiService } from 'src/app/shared/services/ui.service';

interface ErrorMessages {
  [key: string]: string;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonSpinner, 
    CommonModule,
    FormsModule,
    RouterModule,
    IonContent,
    IonInput,
    IonButton,
    IonIcon,
  ],
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly uiService = inject(UiService);

  // Signals
  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);

  // Computed
  readonly canSubmit = computed(() => 
    this.email().trim().length > 0 && this.password().trim().length > 0 && !this.loading()
  );

  constructor() {
    addIcons({ 
      location, 
      logInOutline, 
      personAddOutline
    });
  }

  updateEmail(value: string): void {
    this.email.set(value);
  }

  updatePassword(value: string): void {
    this.password.set(value);
  }

  async login(): Promise<void> {
    if (!this.canSubmit()) return;

    this.loading.set(true);

    try {
      await this.authService.login(this.email(), this.password());
      this.router.navigate(['/map']);
    } catch (err: any) {
      const errorMessage = this.getErrorMessage(err.code);
      await this.uiService.showError(errorMessage);
    } finally {
      this.loading.set(false);
    }
  }

  private getErrorMessage(errorCode: string): string {
    const errorMessages: ErrorMessages = {
      'auth/invalid-email': 'El correo electrónico no es válido',
      'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
      'auth/user-not-found': 'No existe una cuenta con este correo electrónico',
      'auth/wrong-password': 'La contraseña es incorrecta',
      'auth/invalid-credential': 'Correo o contraseña incorrectos',
      'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta de nuevo más tarde',
      'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
      'auth/email-already-in-use': 'Este correo ya está registrado',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
    };

    return errorMessages[errorCode] || 'Error al iniciar sesión. Verifica tus credenciales';
  }
}
