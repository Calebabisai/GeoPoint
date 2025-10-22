import { Injectable, NgZone, inject } from '@angular/core';
import {
  Auth,
  authState,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  DocumentData,
} from '@angular/fire/firestore';
import { map, switchMap } from 'rxjs/operators';
import { Observable, from, of } from 'rxjs';
import { User } from '../../shared/models/user.model';
import { LoggerService } from '../../shared/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private logger = inject(LoggerService);

  // Cache de authState para evitar múltiples llamadas
  private authState$: Observable<FirebaseUser | null>;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private ngZone: NgZone
  ) {
    this.authState$ = authState(this.auth);
    this.logger.auth('Service initialized');
  }

  async login(email: string, password: string) {
    return await signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(
    email: string,
    password: string,
    role: 'admin' | 'user' = 'user',
    displayName?: string
  ) {
    const userCredential = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );
    const user = userCredential.user;

    // Guardar información adicional del usuario en Firestore
    await this.saveUserData(user.uid, user.email, role, displayName);

    return user;
  }

  async logout() {
    return await signOut(this.auth);
  }

  getAuthState(): Observable<FirebaseUser | null> {
    return this.authState$;
  }

  /**
   * Devuelve un Observable con la información del usuario en la sesión
   * (se ajusta al tipo `User | null` que espera el código existente).
   */
  getCurrentUser(): Observable<User | null> {
    return this.authState$.pipe(
      switchMap((firebaseUser) => {
        if (!firebaseUser) return of(null);

        // Usar from() para convertir la promesa en observable y mantener el contexto
        return from(this.getUserDataFromFirestore(firebaseUser));
      })
    );
  }

  /**
   * Método separado para obtener datos del usuario desde Firestore
   */
  private async getUserDataFromFirestore(
    firebaseUser: FirebaseUser
  ): Promise<User> {
    try {
      this.logger.firebase('Getting user data for:', firebaseUser.uid);
      const userDoc = doc(this.firestore, `users/${firebaseUser.uid}`);
      const userSnap = await getDoc(userDoc);

      if (userSnap.exists()) {
        const userData = userSnap.data() as DocumentData;
        this.logger.firebase('User data found in Firestore');
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: userData['displayName'] || '',
          role: userData['role'] || 'user',
          organizationId: userData['organizationId'] || undefined,
          organizationRole: userData['organizationRole'] || undefined,
          createdAt:
            userData['createdAt']?.toDate() ||
            new Date(firebaseUser.metadata?.creationTime || Date.now()),
        } as User;
      } else {
        // Usuario sin datos en Firestore, usar valores por defecto
        this.logger.warn('User not found in Firestore, using defaults');
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: '',
          role: 'user',
          createdAt: new Date(
            firebaseUser.metadata?.creationTime || Date.now()
          ),
        } as User;
      }
    } catch (error) {
      this.logger.error('Error fetching user data from Firestore:', error);
      // Fallback si no se puede acceder a Firestore
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: '',
        role: 'user',
        createdAt: new Date(firebaseUser.metadata?.creationTime || Date.now()),
      } as User;
    }
  }

  /**
   * Guarda información adicional del usuario en Firestore
   */
  private async saveUserData(
    uid: string,
    email: string | null,
    role: 'admin' | 'user',
    displayName?: string
  ): Promise<void> {
    try {
      this.logger.firebase('Saving user data to Firestore', {
        uid,
        email,
        role,
      });
      const userDoc = doc(this.firestore, `users/${uid}`);
      const userData: Partial<User> = {
        uid,
        email: email || '',
        role,
        displayName: displayName || '',
        createdAt: new Date(),
      };

      await setDoc(userDoc, userData, { merge: true });
      this.logger.firebase('User data saved successfully');
    } catch (error) {
      this.logger.error('Error saving user data to Firestore:', error);
      throw error;
    }
  }
}
