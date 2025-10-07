import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { location } from 'ionicons/icons';
import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
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
  email: string = '';
  password: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {
    addIcons({ location });
  }

  async login() {
    try {
      await this.authService.login(this.email, this.password);
      await this.showToast('¡Bienvenido!', 'success');
      this.router.navigate(['/map']);
    } catch (err: any) {
      console.error('Error en login:', err);
      const errorMessage = this.getErrorMessage(err.code);
      await this.showToast(errorMessage, 'danger');
    }
  }

  private getErrorMessage(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      'auth/invalid-email': '📧 El correo electrónico no es válido',
      'auth/user-disabled': '🚫 Esta cuenta ha sido deshabilitada',
      'auth/user-not-found':
        '❌ No existe una cuenta con este correo electrónico',
      'auth/wrong-password': '🔒 La contraseña es incorrecta',
      'auth/invalid-credential': '❌ Correo o contraseña incorrectos',
      'auth/too-many-requests':
        '⏳ Demasiados intentos fallidos. Intenta de nuevo más tarde',
      'auth/network-request-failed':
        '📡 Error de conexión. Verifica tu internet',
      'auth/email-already-in-use': '📧 Este correo ya está registrado',
      'auth/weak-password': '🔐 La contraseña debe tener al menos 6 caracteres',
    };

    return (
      errorMessages[errorCode] ||
      '❌ Error al iniciar sesión. Verifica tus credenciales'
    );
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning'
  ) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      cssClass: 'custom-toast',
    });
    await toast.present();
  }
}
