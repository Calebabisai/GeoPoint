import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
} from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonLabel,
  IonList,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonProgressBar,
  IonBadge,
  IonAccordion,
  IonAccordionGroup,
  ToastController,
  AlertController,
  LoadingController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  personAddOutline,
  sendOutline,
  addOutline,
  removeOutline,
  checkmarkOutline,
  closeOutline,
  copyOutline,
  shareOutline,
  timeOutline,
  peopleOutline,
  documentTextOutline, businessOutline, keyOutline, settingsOutline } from 'ionicons/icons';
import { OrganizationService } from '../../services/organization.service';
import { EmailService } from '../../services/email.service';
import { AuthService } from '../../../auth/services/auth.service';
import {
  OrganizationInvite,
} from '../../models/organization.model';
import { Router } from '@angular/router';

interface EmailInviteForm {
  emails: string[];
  role: 'admin' | 'moderator' | 'user';
  department: string;
  personalMessage: string;
  sendWelcomeEmail: boolean;
  expirationDays: number;
}

interface BulkInviteResult {
  successful: OrganizationInvite[];
  failed: { email: string; error: string }[];
}

@Component({
  selector: 'app-email-invitation-manager',
  templateUrl: './email-invitation-manager.component.html',
  styleUrls: ['./email-invitation-manager.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonIcon,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonItem,
    IonLabel,
    IonList,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonProgressBar,
    IonBadge,
    IonAccordion,
    IonAccordionGroup,
  ],
})
export class EmailInvitationManagerComponent implements OnInit {
  private fb = inject(FormBuilder);
  private organizationService = inject(OrganizationService);
  private emailService = inject(EmailService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);

  inviteForm: FormGroup;

  // Usar Signals directamente del servicio
  readonly currentOrganization = this.organizationService.currentOrganization;
  readonly currentUser = this.authService.getCurrentUser();

  private isLoadingSignal = signal(false);
  private recentInvitesSignal = signal<OrganizationInvite[]>([]);

  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly recentInvites = this.recentInvitesSignal.asReadonly();

  showPreview = false;
  emailPreview = '';

  readonly roleOptions = [
    {
      value: 'user',
      label: 'Miembro',
      description: 'Acceso básico a funcionalidades',
    },
    {
      value: 'moderator',
      label: 'Moderador',
      description: 'Puede gestionar contenido y algunos miembros',
    },
    {
      value: 'admin',
      label: 'Administrador',
      description: 'Acceso completo a la gestión',
    },
  ];

  readonly expirationOptions = [
    { value: 1, label: '1 día' },
    { value: 3, label: '3 días' },
    { value: 7, label: '7 días (recomendado)' },
    { value: 14, label: '14 días' },
    { value: 30, label: '30 días' },
  ];

  constructor() {
    addIcons({closeOutline,businessOutline,peopleOutline,keyOutline,mailOutline,addOutline,documentTextOutline,removeOutline,settingsOutline,sendOutline,timeOutline,copyOutline,personAddOutline,checkmarkOutline,shareOutline,});

    this.inviteForm = this.fb.group({
      emails: this.fb.array(
        [this.createEmailFormControl()],
        [Validators.required]
      ),
      role: ['user', Validators.required],
      department: ['General'],
      personalMessage: [''],
      expirationDays: [
        7,
        [Validators.required, Validators.min(1), Validators.max(30)],
      ],
    });
  }

  ngOnInit() {
    this.loadRecentInvites();
  }

  private createEmailFormControl() {
    return this.fb.control('', [Validators.required, Validators.email]);
  }

  get emailsFormArray() {
    return this.inviteForm.get('emails') as FormArray;
  }

  get emails() {
    return this.emailsFormArray.controls;
  }

  private async loadRecentInvites() {
    const org = this.currentOrganization();
    if (!org) {
      this.recentInvitesSignal.set([]);
      return;
    }

    try {
      const firebaseInvites =
        await this.organizationService.getFirebaseOrganizationInvitations(
          org.id
        );

      if (firebaseInvites.length > 0) {
        this.recentInvitesSignal.set(firebaseInvites.slice(0, 10));
      } else {
        const fallbackInvites = await this.organizationService.getAllInvitations(
          org.id
        );
        this.recentInvitesSignal.set(fallbackInvites.slice(0, 10));
      }
    } catch (error) {
      console.error('Error loading recent invites:', error);
      try {
        const fallbackInvites = await this.organizationService.getAllInvitations(
          org.id
        );
        this.recentInvitesSignal.set(fallbackInvites.slice(0, 10));
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        this.recentInvitesSignal.set([]);
      }
    }
  }

  /**
   * Agrega un nuevo campo de email
   */
  addEmailField() {
    if (this.emailsFormArray.length < 50) {
      this.emailsFormArray.push(this.createEmailFormControl());
    }
  }

  /**
   * Remueve un campo de email
   */
  removeEmailField(index: number) {
    if (this.emailsFormArray.length > 1) {
      this.emailsFormArray.removeAt(index);
    }
  }

  /**
   * Importa emails desde texto (separados por comas, espacios o saltos de línea)
   */
  async importEmails() {
    const alert = await this.alertCtrl.create({
      header: 'Importar Emails',
      message:
        'Pega una lista de emails separados por comas, espacios o saltos de línea:',
      inputs: [
        {
          name: 'emailText',
          type: 'textarea',
          placeholder:
            'usuario1@ejemplo.com, usuario2@ejemplo.com\nusuario3@ejemplo.com',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Importar',
          handler: (data) => {
            if (data.emailText) {
              this.processEmailImport(data.emailText);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private processEmailImport(emailText: string) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = emailText.match(emailRegex) || [];

    if (emails.length > 0) {
      while (this.emailsFormArray.length > 0) {
        this.emailsFormArray.removeAt(0);
      }

      emails.forEach((email) => {
        const control = this.createEmailFormControl();
        control.setValue(email.trim());
        this.emailsFormArray.push(control);
      });

      this.showToast(
        `${emails.length} emails importados correctamente`,
        'success'
      );
    } else {
      this.showToast('No se encontraron emails válidos en el texto', 'warning');
    }
  }

  /**
   * Valida todos los emails antes de enviar
   */
  private validateEmails(): string[] {
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];

    this.emailsFormArray.controls.forEach((control) => {
      const email = control.value?.trim();
      if (email) {
        if (control.valid) {
          validEmails.push(email);
        } else {
          invalidEmails.push(email);
        }
      }
    });

    if (invalidEmails.length > 0) {
      this.showToast(`Emails inválidos: ${invalidEmails.join(', ')}`, 'danger');
      return [];
    }

    const uniqueEmails = [...new Set(validEmails)];
    if (uniqueEmails.length !== validEmails.length) {
      this.showToast(
        'Se encontraron emails duplicados. Se enviarán solo una vez.',
        'warning'
      );
    }

    return uniqueEmails;
  }

  /**
   * Previsualiza el email que se enviará
   */
  async previewEmail() {
    const org = this.currentOrganization();
    const user = this.currentUser();

    if (!org || !user) {
      this.showToast(
        'Error: No se pudo cargar la información necesaria',
        'danger'
      );
      return;
    }

    const formValue = this.inviteForm.value;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + formValue.expirationDays);

    const sampleCode = 'PREVIEW-CODE';

    const config = {
      organizationName: org.name,
      inviterName: user.email || 'Admin',
      inviterEmail: user.email || 'admin@ejemplo.com',
      inviteCode: sampleCode,
      joinUrl: `${window.location.origin}/join-organization?code=${sampleCode}`,
      expirationDate,
      personalMessage: formValue.personalMessage,
    };

    const emailTemplate = (this.emailService as any).generateInvitationTemplate(
      config
    );

    const alert = await this.alertCtrl.create({
      header: 'Vista Previa del Email',
      message: `Asunto: ${emailTemplate.subject}\n\n${emailTemplate.textBody}`,
      buttons: [
        {
          text: 'Ver HTML Completo',
          handler: () => {
            this.openEmailPreview(emailTemplate.htmlBody);
          },
        },
        {
          text: 'Cerrar',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  private openEmailPreview(htmlContent: string) {
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(htmlContent);
      previewWindow.document.close();
    }
  }

  /**
   * Envía las invitaciones por email
   */
  async sendInvitations() {
    const org = this.currentOrganization();
    const user = this.currentUser();

    if (!this.inviteForm.valid || !org || !user) {
      this.showToast(
        'Por favor, completa todos los campos requeridos',
        'danger'
      );
      return;
    }

    const validEmails = this.validateEmails();
    if (validEmails.length === 0) {
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: `Enviando ${validEmails.length} invitación(es)...`,
    });
    await loading.present();

    try {
      this.isLoadingSignal.set(true);
      const formValue = this.inviteForm.value;
      const results: BulkInviteResult = { successful: [], failed: [] };

      // inviteUserWithEmail genera el código correctamente
      for (const email of validEmails) {
        try {
          const invite = await this.organizationService.inviteUserWithEmail(
            email,
            formValue.role,
            formValue.department,
            formValue.personalMessage
          );

          results.successful.push(invite);
        } catch (error) {
          console.error(`Error inviting ${email}:`, error);
          results.failed.push({
            email,
            error: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      }

      await this.showInvitationResults(results);

      if (results.successful.length > 0) {
        this.resetForm();
        this.loadRecentInvites();
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
      this.showToast('Error al enviar las invitaciones', 'danger');
    } finally {
      this.isLoadingSignal.set(false);
      await loading.dismiss();
    }
  }

  /**
   * Muestra los resultados de las invitaciones
   */
  private async showInvitationResults(results: BulkInviteResult) {
    const successCount = results.successful.length;
    const failCount = results.failed.length;

    let message = '';
    if (successCount > 0) {
      message += `${successCount} invitación(es) enviada(s) correctamente.`;
    }
    if (failCount > 0) {
      if (successCount > 0) {
        message += '\n\n';
      }
      message += `${failCount} invitación(es) fallaron:\n`;
      results.failed.forEach((failure) => {
        message += `• ${failure.email}: ${failure.error}\n`;
      });
    }

    const alert = await this.alertCtrl.create({
      header: 'Resultados del Envío',
      message: message,
      buttons: [
        {
          text: 'Ver Códigos',
          handler: () => {
            this.showInvitationCodes(results.successful);
          },
        },
        {
          text: 'Cerrar',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  /**
   * Muestra los códigos de invitación generados
   */
  private async showInvitationCodes(invites: OrganizationInvite[]) {
    if (invites.length === 0) return;

    const codesList = invites
      .map((invite) => `• ${invite.invitedEmail}: ${invite.code}`)
      .join('\n');

    const alert = await this.alertCtrl.create({
      header: 'Códigos de Invitación',
      message: codesList,
      buttons: [
        {
          text: 'Copiar Todos',
          handler: () => {
            const textToCopy = invites
              .map((invite) => `${invite.invitedEmail}: ${invite.code}`)
              .join('\n');
            navigator.clipboard.writeText(textToCopy);
            this.showToast('Códigos copiados al portapapeles', 'success');
          },
        },
        {
          text: 'Cerrar',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  /**
   * Resetea el formulario
   */
  private resetForm() {
    while (this.emailsFormArray.length > 1) {
      this.emailsFormArray.removeAt(this.emailsFormArray.length - 1);
    }
    this.emailsFormArray.at(0)?.setValue('');

    this.inviteForm.patchValue({
      role: 'user',
      department: 'General',
      personalMessage: '',
      sendWelcomeEmail: true,
      expirationDays: 7,
    });
  }

  /**
   * Navega de regreso
   */
  goBack() {
    this.router.navigate(['/admin']);
  }

  /**
   * Muestra un toast
   */
  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger' = 'success'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

  /**
   * Copia un código de invitación al portapapeles
   */
  async copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      this.showToast(`Código ${code} copiado al portapapeles`, 'success');
    } catch (error) {
      console.error('Error copying code:', error);
      this.showToast('Error al copiar el código', 'danger');
    }
  }

  /**
   * Obtiene el departamento actual o por defecto
   */
  get availableDepartments(): string[] {
    const org = this.currentOrganization();
    return org?.settings?.departments || ['General'];
  }

  /**
   * Obtiene el rol seleccionado
   */
  get selectedRole() {
    const roleValue = this.inviteForm.get('role')?.value;
    return this.roleOptions.find((option) => option.value === roleValue);
  }
}
