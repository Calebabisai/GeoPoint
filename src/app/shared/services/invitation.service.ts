import { Injectable, inject, signal, computed } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';
import { OrganizationService } from './organization.service';
import { OrganizationInvite } from '../models/organization.model';

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private organizationService = inject(OrganizationService);

  // Signals
  private developmentInvitesSignal = signal<OrganizationInvite[]>([]);
  private isProcessingSignal = signal(false);
  private lastErrorSignal = signal<string | null>(null);

  // Readonly exports
  readonly developmentInvites = this.developmentInvitesSignal.asReadonly();
  readonly isProcessing = this.isProcessingSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();

  // Computed signals
  readonly hasError = computed(() => this.lastErrorSignal() !== null);
  readonly invitationCount = computed(() => this.developmentInvitesSignal().length);

  /**
   * Envía una invitación a un usuario por email
   */
  async sendInvitation(
    email: string,
    role: 'admin' | 'moderator' | 'user' = 'user'
  ): Promise<OrganizationInvite> {
    this.isProcessingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const currentUser = this.authService.getCurrentUser()();
      const currentOrg = this.organizationService.currentOrganization();

      if (!currentUser || !currentOrg) {
        throw new Error('Usuario u organización no encontrados');
      }

      const userMember = currentOrg.members.find(
        (m) => m.userId === currentUser.uid
      );
      if (
        !userMember ||
        (userMember.role !== 'owner' && userMember.role !== 'admin')
      ) {
        throw new Error('No tienes permisos para enviar invitaciones');
      }

      const existingMember = currentOrg.members.find((m) => m.email === email);
      if (existingMember) {
        throw new Error('Este usuario ya es miembro de la organización');
      }

      const currentInvites = this.developmentInvitesSignal();
      const existingInvite = currentInvites.find(
        (inv) =>
          inv.invitedEmail === email &&
          inv.organizationId === currentOrg.id &&
          inv.status === 'pending'
      );
      if (existingInvite) {
        throw new Error('Ya existe una invitación pendiente para este email');
      }

      const inviteCode = this.generateInviteCode();
      const invite: OrganizationInvite = {
        id: `invite-${Date.now()}`,
        organizationId: currentOrg.id,
        organizationName: currentOrg.name,
        invitedEmail: email,
        invitedBy: currentUser.uid,
        role,
        code: inviteCode,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        status: 'pending',
      };

      this.developmentInvitesSignal.update((invites) => [...invites, invite]);

      console.log(`Invitation sent to ${email}`);

      return invite;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error enviando invitación';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
    }
  }

  /**
   * Acepta una invitación usando el código
   */
  async acceptInvitation(inviteCode: string): Promise<void> {
    this.isProcessingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const currentUser = this.authService.getCurrentUser()();
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      let invite: OrganizationInvite | null = null;

      try {
        const invitationsRef = collection(this.firestore, 'invitations');
        const q = query(
          invitationsRef,
          where('code', '==', inviteCode),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const inviteDoc = snapshot.docs[0];
          invite = {
            id: inviteDoc.id,
            ...inviteDoc.data(),
          } as OrganizationInvite;

          if (
            invite.expiresAt &&
            typeof invite.expiresAt === 'object' &&
            'toDate' in invite.expiresAt
          ) {
            invite.expiresAt = (invite.expiresAt as any).toDate();
          }
        } else {
          const currentInvites = this.developmentInvitesSignal();
          invite =
            currentInvites.find(
              (inv) => inv.code === inviteCode && inv.status === 'pending'
            ) || null;
        }
      } catch (firebaseError) {
        console.error('Firebase lookup failed:', firebaseError);
        const currentInvites = this.developmentInvitesSignal();
        invite =
          currentInvites.find(
            (inv) => inv.code === inviteCode && inv.status === 'pending'
          ) || null;
      }

      if (!invite) {
        throw new Error('Código de invitación inválido o expirado');
      }

      if (invite.expiresAt < new Date()) {
        this.developmentInvitesSignal.update((invites) =>
          invites.map((inv) =>
            inv.id === invite!.id ? { ...inv, status: 'expired' } : inv
          )
        );
        throw new Error('La invitación ha expirado');
      }

      if (invite.invitedEmail !== currentUser.email) {
        throw new Error('Esta invitación no está destinada a tu cuenta');
      }

      try {
        await this.organizationService.addMemberToOrganization(
          invite.organizationId,
          {
            userId: currentUser.uid,
            email: currentUser.email || '',
            role: invite.role,
            department: invite.department,
          }
        );

        if (invite.id) {
          try {
            const inviteDocRef = doc(this.firestore, 'invitations', invite.id);
            await updateDoc(inviteDocRef, {
              status: 'accepted',
              acceptedAt: new Date(),
              acceptedBy: currentUser.uid,
            });
          } catch (updateError) {
            console.error('Could not update invitation status:', updateError);
          }
        }

        this.developmentInvitesSignal.update((invites) =>
          invites.map((inv) =>
            inv.id === invite!.id ? { ...inv, status: 'accepted' } : inv
          )
        );

        await this.updateUserOrganization(
          currentUser.uid,
          invite.organizationId,
          invite.role
        );

        console.log(`User ${currentUser.email} joined organization ${invite.organizationName}`);
      } catch (error) {
        console.error('Error accepting invitation:', error);
        throw new Error('Error al aceptar la invitación');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error aceptando invitación';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
    }
  }

  /**
   * Rechaza una invitación
   */
  async rejectInvitation(inviteCode: string): Promise<void> {
    this.isProcessingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      const currentInvites = this.developmentInvitesSignal();
      const invite = currentInvites.find(
        (inv) => inv.code === inviteCode && inv.status === 'pending'
      );

      if (!invite) {
        throw new Error('Código de invitación inválido');
      }

      this.developmentInvitesSignal.update((invites) =>
        invites.map((inv) =>
          inv.id === invite.id ? { ...inv, status: 'rejected' } : inv
        )
      );

      console.log(`Invitation rejected: ${invite.invitedEmail}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error rechazando invitación';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
    }
  }

  /**
   * Obtiene invitaciones de una organización
   */
  getOrganizationInvitations(organizationId: string): OrganizationInvite[] {
    return this.developmentInvitesSignal().filter(
      (inv) => inv.organizationId === organizationId
    );
  }

  /**
   * Obtiene invitaciones para un email
   */
  getUserInvitations(email: string): OrganizationInvite[] {
    return this.developmentInvitesSignal().filter(
      (inv) => inv.invitedEmail === email && inv.status === 'pending'
    );
  }

  /**
   * Cancela una invitación
   */
  async cancelInvitation(inviteId: string): Promise<void> {
    this.isProcessingSignal.set(true);
    this.lastErrorSignal.set(null);

    try {
      this.developmentInvitesSignal.update((invites) =>
        invites.filter((inv) => inv.id !== inviteId)
      );

      console.log(`Invitation cancelled: ${inviteId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error cancelando invitación';
      this.lastErrorSignal.set(errorMessage);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
    }
  }

  /**
   * Valida un código de invitación
   */
  validateInviteCode(code: string): OrganizationInvite | null {
    const currentInvites = this.developmentInvitesSignal();
    const invite = currentInvites.find(
      (inv) => inv.code === code && inv.status === 'pending'
    );

    if (!invite) return null;

    if (invite.expiresAt < new Date()) {
      this.developmentInvitesSignal.update((invites) =>
        invites.map((inv) =>
          inv.id === invite.id ? { ...inv, status: 'expired' } : inv
        )
      );
      return null;
    }

    return invite;
  }

  /**
   * Genera código único de invitación
   */
  private generateInviteCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }

  /**
   * Actualiza la organización del usuario en Firestore
   */
  private async updateUserOrganization(
    userId: string,
    organizationId: string,
    organizationRole: 'admin' | 'moderator' | 'user'
  ): Promise<void> {
    try {
      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        organizationId,
        organizationRole,
        updatedAt: new Date(),
      });

      console.log(`User organization updated: ${userId}`);
    } catch (error) {
      console.error('Error updating user organization:', error);
      throw error;
    }
  }

  /**
   * Limpia el último error
   */
  clearLastError(): void {
    this.lastErrorSignal.set(null);
  }
}
