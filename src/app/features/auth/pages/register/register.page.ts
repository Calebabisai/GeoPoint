import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonInput,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle, 
  IonCardContent,
  IonItem,
  IonLabel,
  IonCheckbox,
  AlertController,
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/services/auth.service';
import { OrganizationService } from 'src/app/features/invitations/services/organization.service';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  personAddOutline,
  alertCircleOutline,
  logInOutline,
  businessOutline,
  personOutline,
  arrowForwardOutline,
} from 'ionicons/icons';

export type AccountType = 'admin' | 'user';

interface ErrorMessages {
  [key: string]: string;
}
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonCheckbox,
    RouterModule,
  ],
})
export class RegisterPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly organizationService = inject(OrganizationService);
  private readonly alertController = inject(AlertController);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // Signals
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly currentStep = signal(1);
  readonly selectedAccountType = signal<AccountType>('user');

  // Constants
  readonly totalSteps = 3;

  // Form
  registerForm: FormGroup;

  // Computed
  readonly progress = computed(() => (this.currentStep() / this.totalSteps) * 100);
  readonly isAccountTypeStep = computed(() => this.currentStep() === 1);
  readonly isUserInfoStep = computed(() => this.currentStep() === 2);
  readonly isOrganizationStep = computed(() => this.currentStep() === 3);
  readonly isAdmin = computed(() => this.selectedAccountType() === 'admin');
  
  readonly isLastStep = computed(() => 
    this.selectedAccountType() === 'user' 
      ? this.currentStep() === 2 
      : this.currentStep() === 3
  );

  get canProceed(): boolean {
    switch (this.currentStep()) {
      case 1:
        return !!this.selectedAccountType();
      case 2:
        return this.canProceedFromUserInfo();
      case 3:
        return this.canProceedFromOrganization();
      default:
        return false;
    }
  }

  readonly stepTitle = computed(() => {
    switch (this.currentStep()) {
      case 1:
        return 'Selecciona tu tipo de cuenta';
      case 2:
        return 'Completa tu información personal';
      case 3:
        return 'Configura tu organización';
      default:
        return '';
    }
  });

  constructor() {
    addIcons({
      arrowBackOutline,
      arrowForwardOutline,
      personAddOutline,
      alertCircleOutline,
      logInOutline,
      businessOutline,
      personOutline,
    });this.registerForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        displayName: ['', [Validators.required]],
        accountType: ['user', [Validators.required]],
        organizationName: [''],
        organizationDescription: [''],
        acceptTerms: [false, [Validators.requiredTrue]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );
  }

  ngOnInit() {}

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }

    return null;
  }

  selectAccountType(accountType: AccountType): void {
    this.selectedAccountType.set(accountType);
    this.registerForm.patchValue({ accountType });

    const orgNameControl = this.registerForm.get('organizationName');
    if (accountType === 'admin') {
      orgNameControl?.setValidators([Validators.required]);
    } else {
      orgNameControl?.clearValidators();
    }
    orgNameControl?.updateValueAndValidity();
  }

  onTermsChange(event: CustomEvent): void {
  const checked = event.detail.checked;
  this.registerForm.patchValue({ acceptTerms: checked });
  this.registerForm.get('acceptTerms')?.markAsTouched();
}

  handleStepSubmit(): void {
  const step = this.currentStep();
  
  if (step === 1) {
    if (this.canProceed) { 
      this.nextStep();
    }
  } else if (step === 2) {
    if (this.canProceed) { 
      if (this.selectedAccountType() === 'admin') {
        this.nextStep();
      } else {
        this.register();
      }
    }
  } else if (step === 3) {
    this.register();
  }
}

  nextStep(): void {
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(step => step + 1);
    }
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(step => step - 1);
    }
  }

  private canProceedFromUserInfo(): boolean {
    const emailControl = this.registerForm.get('email');
    const passwordControl = this.registerForm.get('password');
    const confirmPasswordControl = this.registerForm.get('confirmPassword');
    const displayNameControl = this.registerForm.get('displayName');
    const termsControl = this.registerForm.get('acceptTerms');

    return !!(
      emailControl?.valid &&
      passwordControl?.valid &&
      confirmPasswordControl?.valid &&
      displayNameControl?.valid &&
      termsControl?.valid &&
      !this.registerForm.hasError('passwordMismatch')
    );
  }

  private canProceedFromOrganization(): boolean {
    if (this.selectedAccountType() !== 'admin') return true;

    const orgNameControl = this.registerForm.get('organizationName');
    return !!orgNameControl?.value?.trim();
  }

  async register(): Promise<void> {
    if (!this.canProceed) {
      await this.showErrorAlert(
        'Formulario incompleto',
        'Por favor, completa todos los campos correctamente antes de continuar.',
        'Entendido'
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const formData = this.registerForm.value;
      const accountType = formData.accountType || this.selectedAccountType();

      const user = await this.authService.register(
        formData.email,
        formData.password,
        accountType === 'admin' ? 'admin' : 'user',
        formData.displayName
      );

      if (!user) {
        throw new Error('Error al crear la cuenta');
      }

      if (accountType === 'admin') {
        await this.organizationService.createOrganization({
          name: formData.organizationName,
          description:
            formData.organizationDescription ||
            `Organización de ${formData.email}`,
          settings: {
            allowUserInvites: true,
            requireApproval: false,
            maxMembers: 0,
            features: {
              canCreateZones: true,
              canCreateMarkers: true,
              canExportData: true,
              canViewAnalytics: true,
              canManageMembers: true,
              canBulkInvite: true,
            },
            visibility: 'private',
          },
        });

        await this.showSuccessAlert(
          'Bienvenido!',
          `Hola ${formData.displayName}! Tu cuenta de administrador y organización han sido creadas exitosamente. Ya puedes comenzar a usar GeoPoint.`,
          'Comenzar'
        );
      } else {
        await this.showSuccessAlert(
          'Cuenta creada!',
          `Hola ${formData.displayName}! Tu cuenta ha sido creada exitosamente. Ya puedes acceder a todas las funciones de GeoPoint.`,
          'Comenzar'
        );
      }
    } catch (error: any) {
      await this.showErrorAlert(
        'Error en el registro',
        this.getErrorMessage(error),
        'Intentar de nuevo'
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async showSuccessAlert(
    title: string,
    message: string,
    buttonText: string = 'OK'
  ): Promise<void> {
    const alert = await this.alertController.create({
      header: title,
      message,
      cssClass: 'success-alert',
      buttons: [
        {
          text: buttonText,
          cssClass: 'success-button',
          handler: () => {
            this.router.navigate(['/home']);
          },
        },
      ],
      backdropDismiss: false,
    });

    await alert.present();
  }

  private async showErrorAlert(
    title: string,
    message: string,
    buttonText: string = 'OK'
  ): Promise<void> {
    const alert = await this.alertController.create({
      header: title,
      message,
      cssClass: 'error-alert',
      buttons: [
        {
          text: buttonText,
          cssClass: 'error-button',
        },
      ],
    });

    await alert.present();
  }

  private getErrorMessage(error: any): string {
    if (!error) return 'Ha ocurrido un error inesperado';

    const errorMessages: ErrorMessages = {
      'auth/email-already-in-use':
        'Este correo ya está registrado. Intenta iniciar sesión o usa otro correo.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/invalid-email': 'El formato del correo electrónico no es válido.',
      'auth/network-request-failed':
        'Error de conexión. Verifica tu conexión a internet.',
      'auth/too-many-requests':
        'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
      'auth/operation-not-allowed':
        'El registro con email/contraseña no está habilitado.',
    };

    const errorCode = error?.code;
    if (errorCode && errorMessages[errorCode]) {
      return errorMessages[errorCode];
    }

    return (
      error?.message || 'Error al crear la cuenta. Por favor, intenta de nuevo.'
    );
  }

  getAccountTypeDescription(type: AccountType): string {
    const descriptions = {
      admin:
        'Perfecto para equipos y empresas que necesitan gestionar usuarios y crear organizaciones.',
      user: 'Ideal para uso personal y colaboración en organizaciones existentes.',
    };
    return descriptions[type];
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
