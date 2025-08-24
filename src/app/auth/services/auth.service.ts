import { Injectable, inject } from '@angular/core';
import {
  Auth,
  authState,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from '@angular/fire/auth';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { User } from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);

  async login(email: string, password: string) {
    return await signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(email: string, password: string) {
    return await createUserWithEmailAndPassword(this.auth, email, password);
  }

  async logout() {
    return await signOut(this.auth);
  }

  getAuthState(): Observable<FirebaseUser | null> {
    return authState(this.auth);
  }

  /**
   * Devuelve un Observable con la información del usuario en la sesión
   * (se ajusta al tipo `User | null` que espera el código existente).
   */
  getCurrentUser(): Observable<User | null> {
    return authState(this.auth).pipe(
      map((u) => {
        if (!u) return null;
        const user: User = {
          uid: u.uid,
          email: u.email || '',
          role: 'user',
          createdAt: u.metadata?.creationTime
            ? new Date(u.metadata.creationTime)
            : new Date(),
        };
        return user;
      })
    );
  }
}
