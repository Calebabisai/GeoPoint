# GeoPoint - Enterprise Geolocation Management System

[![Angular](https://img.shields.io/badge/Angular-17+-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.io/)
[![Ionic](https://img.shields.io/badge/Ionic-8+-3880FF?style=flat-square&logo=ionic&logoColor=white)](https://ionicframework.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Latest-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](LICENSE)

## Overview

GeoPoint is a cross-platform hybrid mobile application built with Ionic and Angular, designed for enterprise-level geolocation management, real-time mapping, and organizational user administration. The application leverages Firebase for authentication, real-time data synchronization, and cloud storage, providing a scalable solution for location-based business operations.

## Key Features

### Authentication & Authorization
- Firebase Authentication integration with email/password
- JWT-based session management
- Multi-level role-based access control (RBAC)
- Secure logout with session cleanup

### User Management
- Complete CRUD operations for organizational users
- Hierarchical role system with four levels:
  - **Owner**: Full organizational control and configuration
  - **Admin**: User management and system administration
  - **Moderator**: Limited moderation capabilities
  - **User**: Basic access and viewing permissions
- Real-time user status tracking
- Bulk invitation system via email

### Mapping & Geolocation
- Interactive map interface powered by Leaflet.js
- Real-time marker placement and management
- Zone definition with polygon drawing
- Route creation with waypoint tracking
- GPS tracking with permission management
- Offline tile caching for low-connectivity scenarios
- Delete mode with visual feedback

### Organization System
- Multi-tenant architecture
- Organization creation and management
- Member invitation system with unique tokens
- Organization code-based joining
- Real-time member synchronization

### Technical Features
- Signal-based reactive state management
- Offline-first architecture with operation queuing
- Network status monitoring
- Global error handling with user-friendly messages
- Responsive design (mobile, tablet, desktop)
- Cross-platform support (Android, iOS, Web)

## System Requirements

### Development Environment
- Node.js 18.x or higher
- npm 9.x or higher
- Angular CLI 17+
- Ionic CLI 8+
- Git 2.x or higher

### Target Platforms
- **Web**: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- **Android**: API Level 24+ (Android 7.0+)
- **iOS**: iOS 13.0+

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/Calebabisai/GeoPoint.git
cd GeoPoint

### Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/Calebabisai/GeoPoint.git
cd GeoPoint/Geo-Point
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar Firebase**

   - Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
   - Copia tus credenciales de Firebase
   - Crea `src/environments/environment.local.ts` con tus credenciales (ver `CONFIGURACION.md`)

4. **Ejecutar en desarrollo**

## Builds


# Web development server
ionic serve

# Android emulator
ionic capacitor run android -l --external

# iOS simulator
ionic capacitor run ios -l --external


##  Estructura del Proyecto

```
GeoPoint/
├── src/
│   ├── app/
│   │   ├── core/                           # Singleton services and global models
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts         # Firebase authentication
│   │   │   │   ├── authorization.service.ts # Role-based permissions
│   │   │   │   ├── firestore.service.ts    # Firestore CRUD operations
│   │   │   │   ├── logger.service.ts       # Centralized logging
│   │   │   │   ├── network.service.ts      # Connectivity monitoring
│   │   │   │   └── platform.service.ts     # Platform detection
│   │   │   └── models/
│   │   │       ├── user.model.ts           # User interface definitions
│   │   │       └── organization.model.ts   # Organization models
│   │   │
│   │   ├── shared/                         # Reusable components and utilities
│   │   │   ├── components/
│   │   │   │   ├── menu/                   # Side navigation menu
│   │   │   │   ├── network-status/         # Connection indicator
│   │   │   │   ├── loading/                # Global loading spinner
│   │   │   │   └── role-selector/          # Development role switcher
│   │   │   └── utils/
│   │   │       ├── error-handler.service.ts # Global error handling
│   │   │       ├── ui.service.ts           # Toast and alert helpers
│   │   │       └── validation.service.ts   # Input validation utilities
│   │   │
│   │   ├── features/                       # Feature modules
│   │   │   ├── auth/                       # Authentication module
│   │   │   │   ├── pages/
│   │   │   │   │   ├── login/
│   │   │   │   │   ├── register/
│   │   │   │   │   └── auth/
│   │   │   │   └── services/
│   │   │   │
│   │   │   ├── home/                       # Main application page
│   │   │   │   └── home.page.ts/html/scss
│   │   │   │
│   │   │   ├── map/                        # Mapping system
│   │   │   │   ├── pages/
│   │   │   │   │   └── map-view/           # Map container component
│   │   │   │   ├── components/
│   │   │   │   │   └── map-controls/       # Map interaction controls
│   │   │   │   ├── services/
│   │   │   │   │   ├── map.service.ts      # Leaflet integration
│   │   │   │   │   ├── map-data.service.ts # Firebase data bridge
│   │   │   │   │   ├── map-cache.service.ts # Offline tile caching
│   │   │   │   │   └── geolocation.service.ts # GPS management
│   │   │   │   └── models/
│   │   │   │       ├── marker.model.ts
│   │   │   │   │   ├── zone.model.ts
│   │   │   │   │   └── route.model.ts
│   │   │   │
│   │   │   ├── admin/                      # Administration module
│   │   │   │   ├── pages/
│   │   │   │   │   ├── user-management/
│   │   │   │   │   └── admin-panel/
│   │   │   │   └── services/
│   │   │   │       └── user-management.service.ts
│   │   │   │
│   │   │   ├── invitations/                # Invitation system
│   │   │   │   ├── pages/
│   │   │   │   │   ├── email-invitations/
│   │   │   │   │   └── join-invitation/
│   │   │   │   └── services/
│   │   │   │       └── organization.service.ts
│   │   │   │
│   │   │   └── profile/                    # User profile
│   │   │       └── pages/profile/
│   │   │
│   │   ├── app.component.ts                # Root component
│   │   ├── app.routes.ts                   # Route configuration
│   │   └── main.ts                         # Application bootstrap
│   │
│   ├── environments/                       # Environment configurations
│   │   ├── environment.ts                  # Development
│   │   ├── environment.prod.ts             # Production
│   │   └── environment.template.ts         # Template for local config
│   │
│   ├── assets/                             # Static resources
│   ├── theme/                              # Global SCSS styles
│   └── global.scss                         # Global style definitions
│
├── android/                                # Android native project
├── ios/                                    # iOS native project
├── capacitor.config.ts                     # Capacitor configuration
├── angular.json                            # Angular CLI configuration
├── ionic.config.json                       # Ionic CLI configuration
└── package.json                            # npm dependencies
```

##  Tecnologías

- **Frontend Framework**: Angular 20+
- **UI Framework**: Ionic 8+
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Language**: TypeScript 
- **Mobile Bridge**: Capacitor 
- **State Management**: RxJS
- **Routing**: Angular Router
- **Icons**: Ionicons

##  Documentación Adicional

- [CONFIGURACION.md](./CONFIGURACION.md) - Guía de configuración de credenciales
- [Ionic Documentation](https://ionicframework.com/docs)
- [Angular Documentation](https://angular.io/docs)
- [Firebase Documentation](https://firebase.google.com/docs)



##  Gestión de Usuarios

El sistema incluye una interfaz completa de gestión de usuarios con:

- Listado de usuarios de la organización
- Cambio de roles (Owner/Admin/Moderator/User)
- Eliminación de usuarios
- Permisos basados en roles

Solo los propietarios (Owners) y administradores (Admins) pueden gestionar usuarios.

##  Licencia

Este proyecto es privado. Todos los derechos reservados.

## Autor

**Caleb Trevizo**

- GitHub: [@Calebabisai](https://github.com/Calebabisai)

## Contribuciones

Este es un proyecto privado. No se aceptan contribuciones externas en este momento.

## Soporte

Para soporte o consultas, contacta al administrador del proyecto.

---

**Hecho con pasion, usando Ionic + Angular + Firebase**
