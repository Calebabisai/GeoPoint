import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
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
import { AuthService } from 'src/app/core/services/auth.service';
import { getUserDisplayName, getUserInitials } from 'src/app/core/models/user.model';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
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

  private readonly authService = inject(AuthService);
  private readonly firestore = inject(Firestore);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly fb = inject(FormBuilder);

  // Signals - authService.currentUser ya es un Signal
  readonly currentUser = this.authService.currentUser;
  readonly isEditing = signal(false);
  readonly isSaving = signal(false);

  // Computed
  readonly displayName = computed(() => getUserDisplayName(this.currentUser()));
  readonly initials = computed(() => getUserInitials(this.currentUser()));
  readonly email = computed(() => this.currentUser()?.email || '');
  readonly canSave = computed(() => 
    this.profileForm.valid && !this.isSaving() && this.isEditing()
  );

  profileForm: FormGroup;

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

    this.profileForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }],
    });

    // Effect para actualizar el formulario cuando cambia el usuario
    effect(() => {
      const user = this.currentUser();
      if (user && !this.isEditing()) {
        this.profileForm.patchValue({
          displayName: user.displayName || '',
          email: user.email || '',
        }, { emitEvent: false });
      }
    });
  }

  ngOnInit() {
    // Inicialización si es necesario
  }

  toggleEdit(): void {
    const currentlyEditing = this.isEditing();
    
    if (currentlyEditing) {
      // Cancelar edición: restaurar valores originales
      const user = this.currentUser();
      if (user) {
        this.profileForm.patchValue({
          displayName: user.displayName || '',
        }, { emitEvent: false });
      }
    }
    
    this.isEditing.set(!currentlyEditing);
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      await this.showToast(
        'Por favor, completa todos los campos correctamente',
        'warning'
      );
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar cambios',
      message: '¿Estás seguro de que quieres actualizar tu información de perfil?',
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

  private async performSave(): Promise<void> {
    this.isSaving.set(true);

    try {
      const user = this.currentUser();

      if (!user?.uid) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      const { displayName } = this.profileForm.value;

      const userDoc = doc(this.firestore, `users/${user.uid}`);
      await updateDoc(userDoc, {
        displayName: displayName.trim(),
      });

      await this.showToast('Perfil actualizado exitosamente', 'success');
      this.isEditing.set(false);
    } catch (error) {
      const err = error as { message?: string };
      await this.showToast(
        err.message || 'Error al actualizar el perfil',
        'danger'
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger' = 'success'
  ): Promise<void> {
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
