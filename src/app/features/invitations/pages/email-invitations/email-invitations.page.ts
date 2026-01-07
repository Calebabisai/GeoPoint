import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonBackButton,
  IonButtons,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { EmailInvitationManagerComponent } from '../../components/email-invitation-manager/email-invitation-manager.component';
import { addIcons } from 'ionicons';
import { home } from 'ionicons/icons';

@Component({
  selector: 'app-email-invitations',
  templateUrl: './email-invitations.page.html',
  styleUrls: ['./email-invitations.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonBackButton,
    IonButtons,
    EmailInvitationManagerComponent,
  ],
})
export class EmailInvitationsPage {
  constructor() {
    addIcons({ home });
  }
}
