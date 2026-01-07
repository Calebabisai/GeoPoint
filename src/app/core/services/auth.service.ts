import { Injectable, inject, signal, computed } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  DocumentData,
  onSnapshot,
  Unsubscribe
} from '@angular/fire/firestore';
import { User } from '../models/user.model';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private logger = inject(LoggerService);
  private auth = inject(Auth);
  private firestore = inject(Firestore);

    // Listener para el documento del usuario en Firestore
  private userDocUnsubscribe: Unsubscribe | null = null;

  //Signals
  private firebaseUserSignal = signal<FirebaseUser | null>(null);
  private currentUserSignal = signal<User | null>(null);
  private isLoadingSignal = signal(true);
  private errorSignal = signal<string | null>(null);
  private authReadySignal = signal(false);
  
  //Readonly exports
  readonly firebaseUser = this.firebaseUserSignal.asReadonly();
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly authReady = this.authReadySignal.asReadonly();

  //Computed
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'admin');

  constructor() {
    this.initAuthStateListener();
  }

   private initAuthStateListener(): void {
  onAuthStateChanged(this.auth, async (firebaseUser) => {
    this.logger.auth('Auth state changed:', firebaseUser?.email ?? 'No user');
    
    this.firebaseUserSignal.set(firebaseUser);
    
    if (firebaseUser) {
      // User is logged in - setup realtime listener for their data
      this.setupUserDocumentListener(firebaseUser.uid);
    } else {
      // User is logged out - cleanup listener
      this.cleanupUserDocumentListener();
      this.currentUserSignal.set(null);
    }
    
    // Mark auth as ready (first check complete)
    this.authReadySignal.set(true);
    this.isLoadingSignal.set(false);
  });
}

  /**
   * Iniciar sesion con email y contrasenia 
  */

  async login(email: string, password: string) {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try{
      const cred = await signInWithEmailAndPassword(this.auth, email, password);
      this.logger.auth('Login Successful');
      return cred.user;
    }catch(error: any) {
      this.errorSignal.set(error.message);
      this.logger.error('Login erro:', error);
      throw error;
    }finally {
      this.isLoadingSignal.set(false);
    }
  }

    /**
   * Registrar un nuevo usuario
   */

    async register(
      email: string,
      password: string,
      role: 'admin' | 'user' = 'user',
      displayName?: string
    ) {
      this.isLoadingSignal.set(true);
      this.errorSignal.set(null);

      try{

      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      const user = userCredential.user;

      await this.saveUserData(user.uid, user.email, role, displayName);
      this.logger.auth('Registration successful');

      return user;
      }catch(error: any){
        this.errorSignal.set(error.message);
        this.logger.error('Registration error:', error);
        throw error;
      }finally{
        this.isLoadingSignal.set(false);
      }
    }
    /**
     * Cierra la sesión
     */
    async logout() {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      // Limpiar listener antes de cerrar sesión
      this.cleanupUserDocumentListener();
      
      await signOut(this.auth);
      this.currentUserSignal.set(null);
      this.logger.auth('Logout successful');
    } catch (error: any) {
      this.errorSignal.set(error.message);
      this.logger.error('Logout error:', error);
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Obtiene el usuario actual como Signal (para componentes)
   */
  getCurrentUser() {
    return this.currentUserSignal.asReadonly();
  }

  /**
   * Obtiene el usuario de Firebase como Signal
   */
  getFirebaseUser() {
    return this.firebaseUserSignal.asReadonly();
  }

  /**
 * Configura un listener en tiempo real para el documento del usuario
 * Se actualiza automáticamente cuando cambian sus datos en Firestore
 */
  private setupUserDocumentListener(userId: string): void {
    // Limpiar listener anterior si existe
    this.cleanupUserDocumentListener();

    const userDocRef = doc(this.firestore, `users/${userId}`);
    
    this.logger.firebase('Setting up realtime listener for user:', userId);

    // Configurar listener en tiempo real
    this.userDocUnsubscribe = onSnapshot(
      userDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data() as DocumentData;
          this.logger.firebase('User data updated from Firestore realtime listener');

          const firebaseUser = this.firebaseUserSignal();
          if (!firebaseUser) return;

          const appUser: User = {
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

          this.currentUserSignal.set(appUser);
          
          // Log cuando hay cambios importantes
          if (userData['organizationRole']) {
            this.logger.firebase('User organization role updated to:', userData['organizationRole']);
          }
          if (userData['organizationId']) {
            this.logger.firebase('User organization ID updated to:', userData['organizationId']);
          }
        } else {
          // Usuario sin datos en Firestore, usar valores por defecto
          this.logger.warn('User document not found in Firestore, using defaults');
          
          const firebaseUser = this.firebaseUserSignal();
          if (!firebaseUser) return;

          const appUser: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: '',
            role: 'user',
            createdAt: new Date(
              firebaseUser.metadata?.creationTime || Date.now()
            ),
          } as User;

          this.currentUserSignal.set(appUser);
        }
      },
      (error) => {
        this.logger.error('Error in user document listener:', error);
        // En caso de error, intentar cargar datos una vez sin listener
        this.loadUserDataFromFirestore(this.firebaseUserSignal()!).catch(err => {
          this.logger.error('Failed to load user data as fallback:', err);
        });
      }
    );
  }

  /**
   * Limpia el listener del documento del usuario
   */
  private cleanupUserDocumentListener(): void {
    if (this.userDocUnsubscribe) {
      this.logger.firebase('Cleaning up user document listener');
      this.userDocUnsubscribe();
      this.userDocUnsubscribe = null;
    }
  }

  /**
   * Carga los datos del usuario desde Firestore
   */
  private async loadUserDataFromFirestore(firebaseUser: FirebaseUser) {
    try {
      this.logger.firebase('Getting user data for:', firebaseUser.uid);
      const userDoc = doc(this.firestore, `users/${firebaseUser.uid}`);
      const userSnap = await getDoc(userDoc);

      if (userSnap.exists()) {
        const userData = userSnap.data() as DocumentData;
        this.logger.firebase('User data found in Firestore');

        const appUser: User = {
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

        this.currentUserSignal.set(appUser);
      } else {
        // Usuario sin datos en Firestore, usar valores por defecto
        this.logger.warn('User not found in Firestore, using defaults');

        const appUser: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: '',
          role: 'user',
          createdAt: new Date(
            firebaseUser.metadata?.creationTime || Date.now()
          ),
        } as User;

        this.currentUserSignal.set(appUser);
      }
    } catch (error) {
      this.logger.error('Error fetching user data from Firestore:', error);

      // Fallback
      const appUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: '',
        role: 'user',
        createdAt: new Date(
          firebaseUser.metadata?.creationTime || Date.now()
        ),
      } as User;

      this.currentUserSignal.set(appUser);
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

  /**
   * Recarga los datos del usuario desde Firestore
   * Útil después de cambios como aceptar una invitación
   */
  async reloadUserData(): Promise<void> {
    const firebaseUser = this.firebaseUserSignal();
    if (firebaseUser) {
      await this.loadUserDataFromFirestore(firebaseUser);
    }
  }

  /**
   * Actualiza el organizationId del usuario en el signal local
   * (sin ir a Firestore)
   */
  updateUserOrganization(
    organizationId: string, 
    organizationRole?: 'owner' | 'admin' | 'moderator' | 'user'
  ): void {
    const currentUser = this.currentUserSignal();
    if (currentUser) {
      this.currentUserSignal.set({
        ...currentUser,
        organizationId,
        organizationRole: organizationRole ?? currentUser.organizationRole,
      });
    }
  }
}




