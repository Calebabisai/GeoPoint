import { Injectable, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithPopup,
  GoogleAuthProvider,
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { User as AppUser } from 'src/app/shared/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  constructor() {}

  /**
   * Devuelve un Observable del usuario de la app (lee datos en Firestore si existen).
   */
  getCurrentUser(): Observable<AppUser | null> {
    return new Observable<AppUser | null>((observer) => {
      const unsubscribe = onAuthStateChanged(this.auth, async (user) => {
        if (!user) {
          observer.next(null);
          return;
        }
        try {
          const userRef = doc(this.firestore, `users/${user.uid}`);
          const snap = await getDoc(userRef);
          const data = snap.exists() ? (snap.data() as Partial<AppUser>) : {};
          const appUser: AppUser = {
            uid: user.uid,
            email: user.email ?? '',
            role: (data.role as AppUser['role']) ?? 'user',
            createdAt: data.createdAt
              ? new Date((data.createdAt as any).toString())
              : new Date(),
          } as AppUser;
          observer.next(appUser);
        } catch (err) {
          observer.error(err);
        }
      });
      // Cleanup
      return { unsubscribe };
    });
  }

  checkAuthStatus(): void {
    // Se podría iniciar lógica adicional aquí; dejamos como no-op útil.
  }

  async register(
    email: string,
    password: string
  ): Promise<FirebaseUser | null> {
    const cred = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );
    const user = cred.user;
    await this.saveUserData(user.uid, user.email, 'user');
    return user;
  }

  async login(email: string, password: string): Promise<FirebaseUser | null> {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    return cred.user;
  }

  async loginWithGoogle(): Promise<FirebaseUser | null> {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.auth, provider as any);
    const user = cred.user;
    await this.saveUserData(user.uid, user.email, 'user');
    return user;
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  private async saveUserData(
    uid: string,
    email: string | null,
    role: AppUser['role']
  ): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    const userData: Partial<AppUser> = {
      uid,
      email: email ?? '',
      role,
      createdAt: new Date(),
    };
    await setDoc(userRef, userData as any, { merge: true });
  }
}
