import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
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
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  personAddOutline,
  alertCircleOutline,
  logInOutline,
  businessOutline,
  personOutline,
  shieldCheckmarkOutline,
  peopleOutline,
} from 'ionicons/icons';

export type AccountType = 'admin' | 'user';

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
  private authService = inject(AuthService);
  private organizationService = inject(OrganizationService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private router = inject(Router);

  // Formulario y estado
  registerForm: FormGroup;
  loading = false;
  errorMessage: string | null = null;
  currentStep = 1;
  totalSteps = 3;

  // Tipo de cuenta seleccionado
  selectedAccountType: AccountType = 'user';

  // Datos de la organización (para admins)
  organizationData = {
    name: '',
    description: '',
    acceptTerms: false,
  };

  constructor(private fb: FormBuilder) {
    addIcons({
      arrowBackOutline,
      personAddOutline,
      alertCircleOutline,
      logInOutline,
      businessOutline,
      personOutline,
      shieldCheckmarkOutline,
      peopleOutline,
    });

    this.registerForm = this.fb.group(
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

  ngOnInit() {
    console.log('🔐 RegisterPage initialized');
  }

  // Validador personalizado para confirmar contraseña
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      return { passwordMismatch: true };
    }

    return null;
  }

  // Selección del tipo de cuenta
  onAccountTypeChange(accountType: AccountType) {
    this.selectedAccountType = accountType;
    this.registerForm.patchValue({ accountType });

    // Actualizar validaciones según el tipo de cuenta
    const orgNameControl = this.registerForm.get('organizationName');
    if (accountType === 'admin') {
      orgNameControl?.setValidators([Validators.required]);
    } else {
      orgNameControl?.clearValidators();
    }
    orgNameControl?.updateValueAndValidity();

    console.log('📋 Account type selected:', accountType);
  }

  // Navegación entre pasos - DEPRECATED (usar nextStep/previousStep)
  goToNextStep() {
    this.nextStep();
  }

  goToPreviousStep() {
    this.previousStep();
  }

  // Validaciones por paso
  canProceedFromAccountType(): boolean {
    return !!this.selectedAccountType;
  }

  canProceedFromUserInfo(): boolean {
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

  canProceedFromOrganization(): boolean {
    if (this.selectedAccountType !== 'admin') return true;

    const orgNameControl = this.registerForm.get('organizationName');
    return !!orgNameControl?.value?.trim();
  }

  // Registro de usuario
  async register() {
    if (!this.canProceed()) {
      await this.showErrorAlert(
        'Formulario incompleto',
        'Por favor, completa todos los campos correctamente antes de continuar.',
        'Entendido'
      );
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    try {
      const formData = this.registerForm.value;

      console.log('🚀 Starting registration process...');
      console.log(
        '📋 Account type from selectedAccountType:',
        this.selectedAccountType
      );
      console.log('📋 Account type from form:', formData.accountType);

      // Usar el valor del formulario para determinar el rol
      const accountType = formData.accountType || this.selectedAccountType;

      // Registrar usuario con el tipo de cuenta seleccionado
      const user = await this.authService.register(
        formData.email,
        formData.password,
        accountType === 'admin' ? 'admin' : 'user',
        formData.displayName
      );

      if (!user) {
        throw new Error('Error al crear la cuenta');
      }

      console.log('✅ User registered successfully with role:', accountType);

      // Si es administrador, crear la organización
      if (accountType === 'admin') {
        console.log('🏢 Creating organization...');

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

        console.log('✅ Organization created successfully');
        await this.showSuccessAlert(
          '¡Bienvenido!',
          `Hola ${formData.displayName}! Tu cuenta de administrador y organización han sido creadas exitosamente. Ya puedes comenzar a usar GeoPoint.`,
          'Comenzar'
        );
      } else {
        await this.showSuccessAlert(
          '¡Cuenta creada!',
          `Hola ${formData.displayName}! Tu cuenta ha sido creada exitosamente. Ya puedes acceder a todas las funciones de GeoPoint.`,
          'Comenzar'
        );
      }

      // La redirección se maneja en el botón del alert
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      await this.showErrorAlert(
        'Error en el registro',
        this.getErrorMessage(error),
        'Intentar de nuevo'
      );
    } finally {
      this.loading = false;
    }
  }

  // Utilidades
  private showError(message: string) {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = null;
    }, 5000);
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  private async showSuccessAlert(
    title: string,
    message: string,
    buttonText: string = 'OK'
  ) {
    const alert = await this.alertController.create({
      header: title,
      message: message,
      cssClass: 'success-alert',
      buttons: [
        {
          text: buttonText,
          cssClass: 'success-button',
          handler: () => {
            // Redirigir inmediatamente al aceptar
            this.router.navigate(['/home']);
          },
        },
      ],
      backdropDismiss: false, // Evitar cerrar tocando fuera
    });

    await alert.present();
  }

  private async showErrorAlert(
    title: string,
    message: string,
    buttonText: string = 'OK'
  ) {
    const alert = await this.alertController.create({
      header: title,
      message: message,
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

    // Mensajes de error específicos de Firebase Auth
    const errorMessages: Record<string, string> = {
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

    // Fallback a mensaje genérico
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

  // Getters para el template
  get isAccountTypeStep() {
    return this.currentStep === 1;
  }
  get isUserInfoStep() {
    return this.currentStep === 2;
  }
  get isOrganizationStep() {
    return this.currentStep === 3;
  }
  get isAdmin() {
    return this.selectedAccountType === 'admin';
  }

  /**
   * Selecciona el tipo de cuenta
   */
  selectAccountType(accountType: AccountType) {
    this.selectedAccountType = accountType;
    this.registerForm.patchValue({ accountType });

    // Actualizar validaciones según el tipo de cuenta
    const orgNameControl = this.registerForm.get('organizationName');
    if (accountType === 'admin') {
      orgNameControl?.setValidators([Validators.required]);
    } else {
      orgNameControl?.clearValidators();
    }
    orgNameControl?.updateValueAndValidity();
  }

  /**
   * Maneja el envío de cada paso del formulario
   */
  handleStepSubmit() {
    if (this.currentStep === 1) {
      if (this.canProceed()) {
        this.nextStep();
      }
    } else if (this.currentStep === 2) {
      if (this.canProceed()) {
        if (this.selectedAccountType === 'admin') {
          this.nextStep();
        } else {
          this.register();
        }
      }
    } else if (this.currentStep === 3) {
      this.register();
    }
  }

  /**
   * Avanza al siguiente paso del registro
   */
  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  /**
   * Regresa al paso anterior
   */
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  /**
   * Verifica si se puede proceder desde el paso actual
   */
  canProceed(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.canProceedFromAccountType();
      case 2:
        return this.canProceedFromUserInfo();
      case 3:
        return this.canProceedFromOrganization();
      default:
        return false;
    }
  }

  /**
   * Verifica si es el último paso
   */
  isLastStep(): boolean {
    return this.selectedAccountType === 'user'
      ? this.currentStep === 2
      : this.currentStep === 3;
  }

  /**
   * Obtiene el título del paso actual
   */
  getStepTitle(): string {
    switch (this.currentStep) {
      case 1:
        return 'Selecciona tu tipo de cuenta';
      case 2:
        return 'Completa tu información personal';
      case 3:
        return 'Configura tu organización';
      default:
        return '';
    }
  }

  /**
   * Verifica si un campo específico es inválido y fue tocado
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
