import { Routes } from '@angular/router';
import {
  canActivate,
  redirectLoggedInTo,
  redirectUnauthorizedTo,
} from '@angular/fire/auth-guard';

// Redirige a la página de inicio de sesión si el usuario no está autenticado
const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['/auth']);

// Redirige al mapa si el usuario ya está autenticado
const redirectLoggedInToMap = () => redirectLoggedInTo(['/map']);

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./auth/pages/auth/auth.page').then((m) => m.AuthPage),
    ...canActivate(redirectLoggedInToMap),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/login/login.page').then((m) => m.LoginPage),
    ...canActivate(redirectLoggedInToMap),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/auth/register/register.page').then((m) => m.RegisterPage),
    ...canActivate(redirectLoggedInToMap),
  },
  {
    path: 'map',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    ...canActivate(redirectUnauthorizedToLogin),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    ...canActivate(redirectUnauthorizedToLogin),
  },
  {
    path: 'admin',
    children: [
      {
        path: 'users',
        loadComponent: () =>
          import(
            './admin/components/user-management/user-management.component'
          ).then((m) => m.UserManagementComponent),
        ...canActivate(redirectUnauthorizedToLogin),
      },
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full',
      },
    ],
  },
];
