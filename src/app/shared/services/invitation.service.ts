import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { AuthService } from '../../auth/services/auth.service';
import { OrganizationService } from './organization.service';
import { OrganizationInvite } from '../models/organization.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  // Para desarrollo: invitaciones simuladas
  private developmentInvites: OrganizationInvite[] = [];

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private organizationService: OrganizationService
  ) {
    console.log('🔥 InvitationService initialized with constructor injection');
    // Exponer para debugging
    if (typeof window !== 'undefined') {
      (window as any).invitationService = this;
      console.log('📧 InvitationService exposed globally');
    }
  }

  /**
   * Envía una invitación a un usuario por email
   */
  async sendInvitation(
    email: string,
    role: 'admin' | 'moderator' | 'user' = 'user'
  ): Promise<OrganizationInvite> {
    const currentUser = await this.authService.getCurrentUser().toPromise();
    const currentOrg = await this.organizationService
      .getCurrentOrganization()
      .toPromise();

    if (!currentUser || !currentOrg) {
      throw new Error('Usuario u organización no encontrados');
    }

    // Verificar permisos
    const userMember = currentOrg.members.find(
      (m) => m.userId === currentUser.uid
    );
    if (
      !userMember ||
      (userMember.role !== 'owner' && userMember.role !== 'admin')
    ) {
      throw new Error('No tienes permisos para enviar invitaciones');
    }

    // Verificar si el usuario ya es miembro
    const existingMember = currentOrg.members.find((m) => m.email === email);
    if (existingMember) {
      throw new Error('Este usuario ya es miembro de la organización');
    }

    // Verificar si ya existe una invitación pendiente
    const existingInvite = this.developmentInvites.find(
      (inv) =>
        inv.invitedEmail === email &&
        inv.organizationId === currentOrg.id &&
        inv.status === 'pending'
    );
    if (existingInvite) {
      throw new Error('Ya existe una invitación pendiente para este email');
    }

    // Crear código de invitación único
    const inviteCode = this.generateInviteCode();

    const invite: OrganizationInvite = {
      id: `invite-${Date.now()}`,
      organizationId: currentOrg.id,
      organizationName: currentOrg.name,
      invitedEmail: email,
      invitedBy: currentUser.uid,
      role,
      code: inviteCode,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      createdAt: new Date(),
      status: 'pending',
    };

    // En desarrollo, agregar a la lista local
    this.developmentInvites.push(invite);

    console.log(
      `📧 Invitation sent to ${email} for organization ${currentOrg.name}`
    );
    console.log(`🔑 Invitation code: ${inviteCode}`);

    // TODO: Enviar email real con el código de invitación
    // await this.sendInvitationEmail(invite);

    return invite;
  }

  /**
   * Acepta una invitación usando el código
   */
  async acceptInvitation(inviteCode: string): Promise<void> {
    const currentUser = await this.authService.getCurrentUser().toPromise();
    if (!currentUser) {
      throw new Error('Usuario no autenticado');
    }

    console.log(`🔍 Looking for invitation with code: ${inviteCode}`);

    // 1. PRIMERO: Buscar la invitación en Firebase
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

        // Convertir Timestamp a Date si es necesario
        if (
          invite.expiresAt &&
          typeof invite.expiresAt === 'object' &&
          'toDate' in invite.expiresAt
        ) {
          invite.expiresAt = (invite.expiresAt as any).toDate();
        }

        console.log('✅ Found invitation in Firebase:', invite);
      } else {
        console.log(
          '📝 No Firebase invitation found, checking development data...'
        );

        // Fallback: buscar en datos de desarrollo
        invite =
          this.developmentInvites.find(
            (inv) => inv.code === inviteCode && inv.status === 'pending'
          ) || null;
      }
    } catch (firebaseError) {
      console.error('🔥 Firebase invitation lookup failed:', firebaseError);

      // Fallback a datos de desarrollo
      invite =
        this.developmentInvites.find(
          (inv) => inv.code === inviteCode && inv.status === 'pending'
        ) || null;
    }

    if (!invite) {
      throw new Error('Código de invitación inválido o expirado');
    }

    // Verificar si la invitación ha expirado
    if (invite.expiresAt < new Date()) {
      invite.status = 'expired';
      throw new Error('La invitación ha expirado');
    }

    // Verificar que el email coincida
    if (invite.invitedEmail !== currentUser.email) {
      throw new Error('Esta invitación no está destinada a tu cuenta');
    }

    try {
      // Agregar usuario a la organización
      await this.organizationService.addMemberToOrganization(
        invite.organizationId,
        {
          userId: currentUser.uid,
          email: currentUser.email || '',
          role: invite.role,
          department: invite.department,
        }
      );

      // Marcar invitación como aceptada en Firebase
      if (invite.id) {
        try {
          const inviteDocRef = doc(this.firestore, 'invitations', invite.id);
          await updateDoc(inviteDocRef, {
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: currentUser.uid,
          });
          console.log('✅ Invitation marked as accepted in Firebase');
        } catch (updateError) {
          console.error(
            '⚠️ Could not update invitation status in Firebase:',
            updateError
          );
        }
      }

      // Marcar invitación como aceptada (fallback local)
      invite.status = 'accepted';

      // ✅ CRUCIAL: Actualizar el usuario con la información de la organización Y EL ROL
      console.log(
        `📝 Updating user ${currentUser.email} with organization role: ${invite.role}`
      );
      await this.updateUserOrganization(
        currentUser.uid,
        invite.organizationId,
        invite.role
      );

      console.log(
        `✅ User ${currentUser.email} joined organization ${invite.organizationName} with role: ${invite.role}`
      );
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw new Error('Error al aceptar la invitación');
    }
  }

  /**
   * Rechaza una invitación
   */
  async rejectInvitation(inviteCode: string): Promise<void> {
    const invite = this.developmentInvites.find(
      (inv) => inv.code === inviteCode && inv.status === 'pending'
    );

    if (!invite) {
      throw new Error('Código de invitación inválido');
    }

    invite.status = 'rejected';
    console.log(`❌ Invitation rejected: ${invite.invitedEmail}`);
  }

  /**
   * Obtiene las invitaciones pendientes de una organización
   */
  getOrganizationInvitations(
    organizationId: string
  ): Observable<OrganizationInvite[]> {
    return of(
      this.developmentInvites.filter(
        (inv) => inv.organizationId === organizationId
      )
    );
  }

  /**
   * Obtiene las invitaciones pendientes para un email
   */
  getUserInvitations(email: string): Observable<OrganizationInvite[]> {
    return of(
      this.developmentInvites.filter(
        (inv) => inv.invitedEmail === email && inv.status === 'pending'
      )
    );
  }

  /**
   * Cancela una invitación
   */
  async cancelInvitation(inviteId: string): Promise<void> {
    const inviteIndex = this.developmentInvites.findIndex(
      (inv) => inv.id === inviteId
    );
    if (inviteIndex !== -1) {
      this.developmentInvites.splice(inviteIndex, 1);
      console.log(`🗑️ Invitation cancelled: ${inviteId}`);
    }
  }

  /**
   * Genera un código único de invitación
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
      // Actualizar el usuario en Firestore con su organizationRole real
      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        organizationId,
        organizationRole, // ✅ CORREGIDO: Guardar el rol de organización real
        updatedAt: new Date(),
      });

      console.log(
        `✅ User organization updated in Firebase: ${userId} -> org: ${organizationId}, role: ${organizationRole}`
      );
    } catch (error) {
      console.error('Error updating user organization in Firebase:', error);
      throw error;
    }
  }

  /**
   * Envía email de invitación (placeholder)
   */
  private async sendInvitationEmail(invite: OrganizationInvite): Promise<void> {
    // TODO: Implementar envío de email real
    console.log(`📧 Email invitation sent to ${invite.invitedEmail}`);
    console.log(`🔗 Invitation link: /invitation/${invite.code}`);
  }

  /**
   * Verifica si un código de invitación es válido
   */
  async validateInviteCode(code: string): Promise<OrganizationInvite | null> {
    const invite = this.developmentInvites.find(
      (inv) => inv.code === code && inv.status === 'pending'
    );

    if (!invite) return null;

    // Verificar si ha expirado
    if (invite.expiresAt < new Date()) {
      invite.status = 'expired';
      return null;
    }

    return invite;
  }
}
