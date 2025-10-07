import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonAvatar,
  IonSpinner,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../auth/services/auth.service';
import {
  User,
  getUserDisplayName,
  getUserInitials,
} from '../../shared/models/user.model';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  personOutline,
  mailOutline,
  saveOutline,
  pencilOutline,
  checkmarkOutline,
  closeOutline,
  informationCircleOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonAvatar,
    IonSpinner,
  ],
})
export class ProfilePage implements OnInit {
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private fb = inject(FormBuilder);

  currentUser$: Observable<User | null>;
  profileForm: FormGroup;
  isEditing = false;
  isSaving = false;

  constructor() {
    addIcons({
      personOutline,
      mailOutline,
      saveOutline,
      pencilOutline,
      checkmarkOutline,
      closeOutline,
      informationCircleOutline,
    });

    this.currentUser$ = this.authService.getCurrentUser();

    this.profileForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }], // Email no editable
    });
  }

  ngOnInit() {
    // Cargar datos del usuario actual
    this.currentUser$.subscribe((user) => {
      if (user) {
        this.profileForm.patchValue({
          displayName: user.displayName || '',
          email: user.email || '',
        });
      }
    });
  }

  // Alternar modo de edición
  toggleEdit() {
    this.isEditing = !this.isEditing;

    if (!this.isEditing) {
      // Si se cancela la edición, restaurar valores originales
      this.currentUser$.subscribe((user) => {
        if (user) {
          this.profileForm.patchValue({
            displayName: user.displayName || '',
          });
        }
      });
    }
  }

  // Guardar cambios del perfil
  async saveProfile() {
    if (this.profileForm.invalid) {
      await this.showToast(
        'Por favor, completa todos los campos correctamente',
        'warning'
      );
      return;
    }

    // Confirmar cambios
    const alert = await this.alertController.create({
      header: 'Confirmar cambios',
      message:
        '¿Estás seguro de que quieres actualizar tu información de perfil?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar',
          role: 'confirm',
          handler: () => this.performSave(),
        },
      ],
    });

    await alert.present();
  }

  private async performSave() {
    this.isSaving = true;

    try {
      // Obtener usuario actual
      const currentUser = await this.currentUser$.pipe().toPromise();

      if (!currentUser?.uid) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      const formData = this.profileForm.value;

      // Actualizar en Firestore
      const userDoc = doc(this.firestore, `users/${currentUser.uid}`);
      await updateDoc(userDoc, {
        displayName: formData.displayName.trim(),
      });

      await this.showToast('Perfil actualizado exitosamente', 'success');
      this.isEditing = false;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      await this.showToast(
        error?.message || 'Error al actualizar el perfil',
        'danger'
      );
    } finally {
      this.isSaving = false;
    }
  }

  // Funciones utilitarias
  getUserDisplayName(user: User | null): string {
    return getUserDisplayName(user);
  }

  getUserInitials(user: User | null): string {
    return getUserInitials(user);
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger' = 'success'
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

  // Validación de campos
  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
