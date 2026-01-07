import { Routes } from '@angular/router';
import {
  canActivate,
  redirectLoggedInTo,
  redirectUnauthorizedTo,
} from '@angular/fire/auth-guard';

// Guards y redirecciones
const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['/auth/login']);
const redirectLoggedInToHome = () => redirectLoggedInTo(['/home']);

export const routes: Routes = [
  // Root redirect
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },

  // ============================================
  // AUTH FEATURE
  // ============================================
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/pages/login/login.page').then(
            (m) => m.LoginPage
          ),
        // SIN GUARD - el login no necesita protección
        // El componente mismo redirigirá si ya está logueado
        data: { title: 'Iniciar Sesión' },
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/pages/register/register.page').then(
            (m) => m.RegisterPage
          ),
        // SIN GUARD
        data: { title: 'Registrarse' },
      },
      {
        path: 'auth',
        loadComponent: () =>
          import('./features/auth/pages/auth/auth.page').then(
            (m) => m.AuthPage
          ),
        // SIN GUARD
        data: { title: 'Autenticación' },
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },

  // ============================================
  // HOME FEATURE
  // ============================================
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home.page').then((m) => m.HomePage),
    ...canActivate(redirectUnauthorizedToLogin),
    data: { title: 'Inicio' },
  },

  // ============================================
  // MAP FEATURE (Solo mapa, sin UI - para casos específicos)
  // ============================================
  {
    path: 'map',
    loadComponent: () =>
      import('./features/map/pages/map-view/map-view.component').then(
        (m) => m.MapViewComponent
      ),
    ...canActivate(redirectUnauthorizedToLogin),
    data: { title: 'Mapa' },
  },

  // ============================================
  // PROFILE FEATURE
  // ============================================
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/pages/profile/profile.page').then(
        (m) => m.ProfilePage
      ),
    ...canActivate(redirectUnauthorizedToLogin),
    data: { title: 'Perfil' },
  },

  // ============================================
  // ADMIN FEATURE
  // ============================================
  {
    path: 'admin',
    children: [
      {
        path: 'users',
        loadComponent: () =>
          import(
            './features/admin/pages/user-management/user-management.component'
          ).then((m) => m.UserManagementComponent),
        ...canActivate(redirectUnauthorizedToLogin),
        data: { title: 'Gestión de Usuarios' },
      },
      {
        path: 'admin-panel',
        loadComponent: () =>
          import('./features/admin/pages/admin-panel/admin-panel.component').then(
            (m) => m.AdminPanelComponent
          ),
        ...canActivate(redirectUnauthorizedToLogin),
        data: { title: 'Panel de Administración' },
      },
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full',
      },
    ],
  },

  // ============================================
  // INVITATIONS FEATURE
  // ============================================
  {
    path: 'invitations',
    children: [
      {
        path: 'email',
        loadComponent: () =>
          import(
            './features/invitations/pages/email-invitations/email-invitations.page'
          ).then((m) => m.EmailInvitationsPage),
        ...canActivate(redirectUnauthorizedToLogin),
        data: { title: 'Invitaciones por Email' },
      },
      {
        path: 'join/:token',
        loadComponent: () =>
          import(
            './features/invitations/pages/join-invitation/join-invitation.page'
          ).then((m) => m.JoinInvitationPage),
        data: { title: 'Unirse a Organización' },
      },
      {
        path: '',
        redirectTo: 'email',
        pathMatch: 'full',
      },
    ],
  },

  // ============================================
  // LEGACY PATHS (Keep for backward compatibility)
  // ============================================
  {
    path: 'join/:token',
    redirectTo: 'invitations/join/:token',
  },

  // ============================================
  // 404 Not Found
  // ============================================
  {
    path: '**',
    redirectTo: 'home',
  },
];