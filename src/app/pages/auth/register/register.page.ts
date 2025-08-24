import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonInput,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../auth/services/auth';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  personAddOutline,
  alertCircleOutline,
  logInOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonButton,
    IonInput,
    IonIcon,
    IonSpinner,
    RouterModule,
  ],
})
export class RegisterPage {
  email = '';
  password = '';
  confirmPassword = '';
  loading = false;
  error: string | null = null;

  constructor(private auth: AuthService) {
    addIcons({
      arrowBackOutline,
      personAddOutline,
      alertCircleOutline,
      logInOutline,
    });
  }

  async register() {
    this.error = null;
    if (!this.email || !this.password) {
      this.error = 'Email y contraseña son obligatorios';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }
    this.loading = true;
    try {
      await this.auth.register(this.email, this.password);
    } catch (e: any) {
      this.error = e?.message || 'Error al registrar';
    } finally {
      this.loading = false;
    }
  }
}
