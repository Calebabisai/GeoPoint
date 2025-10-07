import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  documentTextOutline,
} from 'ionicons/icons';
import { OrganizationService } from '../../services/organization.service';
import { EmailService } from '../../services/email.service';
import { AuthService } from '../../../auth/services/auth.service';
import {
  Organization,
  OrganizationInvite,
} from '../../models/organization.model';
import { User } from '../../models/user.model';
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
    CommonModule,
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
  currentOrganization: Organization | null = null;
  currentUser: User | null = null;
  isLoading = false;
  recentInvites: OrganizationInvite[] = [];
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
    addIcons({
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
      documentTextOutline,
    });

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
    this.loadCurrentOrganization();
    this.loadCurrentUser();
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

  private async loadCurrentOrganization() {
    this.organizationService.getCurrentOrganization().subscribe((org) => {
      this.currentOrganization = org;
      if (org && org.settings.departments) {
        // Actualizar el departamento por defecto si existe
        this.inviteForm.patchValue({
          department: org.settings.departments[0] || 'General',
        });
      }
    });
  }

  private async loadCurrentUser() {
    this.authService.getCurrentUser().subscribe((user) => {
      this.currentUser = user;
    });
  }

  private async loadRecentInvites() {
    console.log('📧 Loading recent invitations...');

    if (this.currentOrganization) {
      try {
        // Intentar cargar desde Firebase primero
        const firebaseInvites =
          await this.organizationService.getFirebaseOrganizationInvitations(
            this.currentOrganization.id
          );

        if (firebaseInvites.length > 0) {
          console.log(
            `✅ Loaded ${firebaseInvites.length} recent invitations from Firebase`
          );
          this.recentInvites = firebaseInvites.slice(0, 10); // Mostrar las 10 más recientes
        } else {
          // Fallback: usar invitaciones del servicio
          console.log('📝 No Firebase invitations, using fallback...');
          const fallbackInvites =
            await this.organizationService.getAllInvitations(
              this.currentOrganization.id
            );
          this.recentInvites = fallbackInvites.slice(0, 10);
        }
      } catch (error) {
        console.error('❌ Error loading recent invites:', error);
        // Fallback en caso de error
        try {
          const fallbackInvites =
            await this.organizationService.getAllInvitations(
              this.currentOrganization.id
            );
          this.recentInvites = fallbackInvites.slice(0, 10);
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          this.recentInvites = [];
        }
      }
    } else {
      console.log('⚠️ No current organization for loading invites');
      this.recentInvites = [];
    }
  }

  /**
   * Agrega un nuevo campo de email
   */
  addEmailField() {
    if (this.emailsFormArray.length < 50) {
      // Límite de 50 invitaciones
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
    // Extraer emails usando regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = emailText.match(emailRegex) || [];

    if (emails.length > 0) {
      // Limpiar el array actual
      while (this.emailsFormArray.length > 0) {
        this.emailsFormArray.removeAt(0);
      }

      // Agregar los emails importados
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

    // Verificar duplicados
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
    if (!this.currentOrganization || !this.currentUser) {
      this.showToast(
        'Error: No se pudo cargar la información necesaria',
        'danger'
      );
      return;
    }

    const formValue = this.inviteForm.value;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + formValue.expirationDays);

    // Simular un código de invitación para la preview
    const sampleCode = 'PREVIEW-CODE';

    const config = {
      organizationName: this.currentOrganization.name,
      inviterName: this.currentUser.email || 'Admin',
      inviterEmail: this.currentUser.email || 'admin@ejemplo.com',
      inviteCode: sampleCode,
      joinUrl: `${window.location.origin}/join-organization?code=${sampleCode}`,
      expirationDate,
      personalMessage: formValue.personalMessage,
    };

    // Crear preview del email
    const emailTemplate = (this.emailService as any).generateInvitationTemplate(
      config
    );

    const alert = await this.alertCtrl.create({
      header: 'Vista Previa del Email',
      message: `
        <div style="max-height: 400px; overflow-y: auto;">
          <h4>Asunto: ${emailTemplate.subject}</h4>
          <hr>
          <div style="font-size: 12px; white-space: pre-wrap;">${emailTemplate.textBody}</div>
        </div>
      `,
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
    if (
      !this.inviteForm.valid ||
      !this.currentOrganization ||
      !this.currentUser
    ) {
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
      this.isLoading = true;
      const formValue = this.inviteForm.value;
      const results: BulkInviteResult = { successful: [], failed: [] };

      for (const email of validEmails) {
        try {
          console.log('📧 Creating invitation for:', email);
          console.log(
            '📧 Current organization:',
            this.currentOrganization?.name
          );
          console.log('📧 Current user:', this.currentUser?.email);
          console.log('📧 Form values:', formValue);

          // Preparar datos de la invitación
          const invitationData = {
            organizationId: this.currentOrganization.id,
            organizationName: this.currentOrganization.name,
            invitedEmail: email,
            role: formValue.role,
            invitedBy: this.currentUser.uid,
            department: formValue.department,
            message: formValue.personalMessage,
            expiresAt: new Date(
              Date.now() + formValue.expirationDays * 24 * 60 * 60 * 1000
            ),
          };

          console.log('📧 Invitation data prepared:', invitationData);

          // Intentar crear en Firebase primero
          let invite: any;
          try {
            console.log('🔥 Attempting to create invitation in Firebase...');
            console.log('🔥 Firebase available:', !!this.organizationService);

            invite = await this.organizationService.createInvitationInFirebase(
              invitationData
            );
            console.log('✅ Firebase invitation created successfully:', invite);

            // Crear la respuesta en formato esperado
            invite = {
              id: invite,
              ...invitationData,
              createdAt: new Date(),
              status: 'pending',
            };
          } catch (firebaseError) {
            console.error(
              '🔥 Firebase invitation failed, using fallback:',
              firebaseError
            );
            console.log('📝 Attempting fallback method...');

            // Fallback: usar el método original
            try {
              invite = await this.organizationService.inviteUserWithEmail(
                email,
                formValue.role,
                formValue.department,
                formValue.personalMessage
              );
              console.log('✅ Fallback invitation successful:', invite);
            } catch (fallbackError) {
              console.error('❌ Fallback also failed:', fallbackError);
              throw fallbackError;
            }
          }

          results.successful.push(invite);
          console.log(`✅ Invitation sent successfully to: ${email}`);
        } catch (error) {
          console.error(`❌ Error inviting ${email}:`, error);
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
      this.isLoading = false;
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
      message += `✅ ${successCount} invitación(es) enviada(s) correctamente.\n`;
    }
    if (failCount > 0) {
      message += `❌ ${failCount} invitación(es) fallaron:\n`;
      results.failed.forEach((failure) => {
        message += `• ${failure.email}: ${failure.error}\n`;
      });
    }

    const alert = await this.alertCtrl.create({
      header: 'Resultados del Envío',
      message: message.replace(/\n/g, '<br>'),
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
      .join('<br>');

    const alert = await this.alertCtrl.create({
      header: 'Códigos de Invitación',
      message: `
        <div style="font-family: monospace; font-size: 12px;">
          ${codesList}
        </div>
      `,
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
    // Limpiar emails
    while (this.emailsFormArray.length > 1) {
      this.emailsFormArray.removeAt(this.emailsFormArray.length - 1);
    }
    this.emailsFormArray.at(0).setValue('');

    // Resetear otros campos
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
      position: 'bottom',
      color,
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
    return this.currentOrganization?.settings?.departments || ['General'];
  }

  /**
   * Obtiene el rol seleccionado
   */
  get selectedRole() {
    const roleValue = this.inviteForm.get('role')?.value;
    return this.roleOptions.find((option) => option.value === roleValue);
  }
}
