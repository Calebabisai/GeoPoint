# 📍 GeoPoint - Sistema de Gestión de Localización

[![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)
[![Ionic](https://img.shields.io/badge/Ionic-3880FF?style=for-the-badge&logo=ionic&logoColor=white)](https://ionicframework.com/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## 📖 Descripción

GeoPoint es una aplicación móvil híbrida construida con **Ionic + Angular** para gestión de localización, usuarios y organizaciones. Incluye autenticación con Firebase, gestión de roles, y sistema administrativo completo.

## ✨ Características Principales

- 🔐 **Autenticación Firebase** - Login/Register con email y password
- 👥 **Gestión de Usuarios** - CRUD completo de usuarios de la organización
- 🏢 **Sistema de Organizaciones** - Múltiples usuarios por organización
- 🎭 **Roles Jerárquicos**:
  - 👑 **Owner** (Propietario) - Control total de la organización
  - 🛡️ **Admin** (Administrador) - Gestión de usuarios y configuración
  - ⚙️ **Moderator** (Moderador) - Permisos limitados
  - 👤 **User** (Usuario) - Acceso básico
- 📱 **Responsive Design** - Funciona en Android, iOS y Web
- 🗺️ **Gestión de Mapas** - Integración con servicios de geolocalización

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ 
- npm 9+
- Ionic CLI: `npm install -g @ionic/cli`
- Angular CLI: `npm install -g @angular/cli`

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
```bash
# Web
ionic serve
# o
ng serve --port 8100

# Android
ionic capacitor run android

# iOS
ionic capacitor run ios
```

## 📱 Builds

### Web
```bash
ng build --configuration production
```

### Android
```bash
ionic capacitor build android --prod
```

### iOS
```bash
ionic capacitor build ios --prod
```

## 🏗️ Estructura del Proyecto

```
Geo-Point/
├── src/
│   ├── app/
│   │   ├── admin/              # Módulo administrativo
│   │   │   ├── components/
│   │   │   │   └── user-management/  # Gestión de usuarios
│   │   │   └── services/
│   │   │       └── user-management.service.ts
│   │   ├── auth/               # Autenticación
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── services/
│   │   │       └── auth.service.ts
│   │   ├── home/               # Página principal
│   │   ├── shared/             # Componentes compartidos
│   │   │   └── models/
│   │   │       └── user.model.ts
│   │   └── app.routes.ts       # Rutas de la aplicación
│   ├── environments/           # Configuración de entornos
│   ├── assets/                 # Recursos estáticos
│   └── theme/                  # Estilos globales
├── android/                    # Proyecto Android (Capacitor)
├── ios/                        # Proyecto iOS (Capacitor)
├── capacitor.config.ts         # Configuración Capacitor
├── angular.json                # Configuración Angular
├── ionic.config.json           # Configuración Ionic
└── package.json                # Dependencias del proyecto
```

## 🔧 Tecnologías

- **Frontend Framework**: Angular 17+
- **UI Framework**: Ionic 8+
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Language**: TypeScript 5+
- **Mobile Bridge**: Capacitor 6+
- **State Management**: RxJS
- **Routing**: Angular Router
- **Icons**: Ionicons

## 📚 Documentación Adicional

- [CONFIGURACION.md](./CONFIGURACION.md) - Guía de configuración de credenciales
- [Ionic Documentation](https://ionicframework.com/docs)
- [Angular Documentation](https://angular.io/docs)
- [Firebase Documentation](https://firebase.google.com/docs)

## 🔐 Seguridad

⚠️ **IMPORTANTE**: Nunca subas archivos con credenciales reales a GitHub:
- `environment.local.ts`
- `*.keystore`
- `google-services.json`
- `GoogleService-Info.plist`

Ver [CONFIGURACION.md](./CONFIGURACION.md) para más detalles.

## 👥 Gestión de Usuarios

El sistema incluye una interfaz completa de gestión de usuarios con:
- Listado de usuarios de la organización
- Cambio de roles (Owner/Admin/Moderator/User)
- Eliminación de usuarios
- Permisos basados en roles

Solo los propietarios (Owners) y administradores (Admins) pueden gestionar usuarios.

## 🐛 Debugging

Para habilitar logs detallados en desarrollo:
```typescript
// En environment.local.ts
export const environment = {
  production: false,
  enableDebugLogs: true,
  // ...
};
```

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.

## 👨‍💻 Autor

**Caleb Abisai**
- GitHub: [@Calebabisai](https://github.com/Calebabisai)

## 🤝 Contribuciones

Este es un proyecto privado. No se aceptan contribuciones externas en este momento.

## 📞 Soporte

Para soporte o consultas, contacta al administrador del proyecto.

---

**Hecho con ❤️ usando Ionic + Angular + Firebase**
