# 🗺️ GeoPoint - Guía para Desarrolladores

> Sistema de gestión de ubicaciones en tiempo real para equipos de trabajo

[![Angular](https://img.shields.io/badge/Angular-18.0.0-red.svg)](https://angular.io/)
[![Ionic](https://img.shields.io/badge/Ionic-8.0.0-blue.svg)](https://ionicframework.com/)
[![Firebase](https://img.shields.io/badge/Firebase-11.0.0-orange.svg)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.2-blue.svg)](https://www.typescriptlang.org/)

---

## 🚀 Inicio Rápido

### Prerequisitos

```bash
Node.js >= 18.x
npm >= 9.x
Android Studio (para desarrollo Android)
```

### Instalación

```bash
# 1. Clonar repositorio
git clone https://github.com/Calebabisai/GeoPoint.git
cd GeoPoint/Geo-Point

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp src/environments/environment.template.ts src/environments/environment.ts
# Editar environment.ts con tus credenciales de Firebase

# 4. Iniciar servidor de desarrollo
ionic serve
```

La app estará disponible en `http://localhost:8100`

---

## 📱 Desarrollo Android

```bash
# 1. Sincronizar con Capacitor
npx cap sync android

# 2. Abrir en Android Studio
npx cap open android

# 3. Ejecutar en dispositivo/emulador desde Android Studio
# O desde terminal:
cd android
./gradlew installDebug
```

---

## 📚 Documentación Completa

Para documentación detallada del código, arquitectura y flujos:

👉 **[Ver DOCUMENTACION_CODIGO.md](./DOCUMENTACION_CODIGO.md)**

Incluye:

- 🏗️ Arquitectura del proyecto
- 📁 Estructura de carpetas
- 🧩 Componentes documentados
- 🔧 Servicios y su uso
- 📊 Modelos de datos
- 🔄 Flujos de usuario
- 🔥 Integración con Firebase
- 💻 Convenciones de código

---

## 🔑 Configuración de Firebase

### 1. Crear Proyecto

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un nuevo proyecto
3. Activa **Authentication** (Email/Password)
4. Activa **Firestore Database**

### 2. Obtener Configuración

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef",
  },
};
```

### 3. Reglas de Firestore

Copia las reglas desde `firestore.rules` (ver DOCUMENTACION_CODIGO.md)

---

## 🏗️ Arquitectura Rápida

```
┌─────────────────────────────────────────┐
│     UI Layer (Components + Pages)       │
│  MapView, AdminPanel, Home, Profile     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Business Logic (Services)             │
│  Auth, Map, Firestore, Organization     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Data Layer (Firebase)                 │
│  Firestore Collections + Auth           │
└─────────────────────────────────────────┘
```

---

## 📂 Estructura de Carpetas (Simplificada)

```
src/app/
├── auth/              # Autenticación (login, register)
├── home/              # Página principal
├── map/               # Componentes del mapa
│   ├── components/
│   │   ├── map-view/          # Vista principal del mapa
│   │   └── admin-panel/       # Panel de administración
│   └── services/
│       └── map.service.ts     # Lógica de Leaflet
├── shared/            # Recursos compartidos
│   ├── components/    # Componentes reutilizables
│   ├── models/        # Interfaces y tipos
│   └── services/      # Servicios compartidos
└── pages/             # Páginas adicionales
```

---

## 🔧 Servicios Principales

### AuthService

```typescript
// Login
await this.authService.login(email, password);

// Register
await this.authService.register(email, password, displayName);

// Get current user
this.authService.getCurrentUser().subscribe((user) => {});

// Logout
await this.authService.logout();
```

### MapService

```typescript
// Inicializar mapa
this.mapService.initMap("map-container");

// Agregar marcador
const id = this.mapService.addMarker(marker);

// Agregar zona
const id = this.mapService.addZone(zone);

// Eliminar elementos
this.mapService.removeMarker(id);
this.mapService.removeZone(id);
```

### OrganizationService

```typescript
// Crear organización
await this.orgService.createOrganization(name, creatorId);

// Agregar miembro
await this.orgService.addMemberToOrganization(orgId, userData);

// Obtener organización del usuario
this.orgService.getUserOrganization(userId).subscribe((org) => {});
```

### ValidationService

```typescript
// Validar email
const result = this.validationService.validateEmail(email);
if (result.valid) {
  /* OK */
}

// Validar formulario de marcador
const result = this.validationService.validateMarkerForm(data);
if (!result.valid) {
  console.error(result.errors);
}
```

---

## 🔄 Flujos Comunes

### 1. Crear un Marcador

```typescript
// 1. Usuario hace click en "Agregar Marcador"
startAddingMarker() {
  this.isAddingMarker = true;
}

// 2. Capturar click del mapa
this.mapService.mapClick$.subscribe(latlng => {
  if (this.isAddingMarker) {
    this.newMarker.lat = latlng.lat;
    this.newMarker.lng = latlng.lng;
  }
});

// 3. Guardar con validación
async saveMarker() {
  const validation = this.validationService.validateMarkerForm(this.newMarker);
  if (!validation.valid) return;

  await this.firestoreService.addMarker(marker);
  this.uiService.showSuccess('Marcador guardado');
}
```

### 2. Invitar un Miembro

```typescript
// 1. Admin crea invitación
await this.invitationService.createInvitation({
  email: 'usuario@email.com',
  organizationId: org.id,
  role: 'member'
});

// 2. Sistema envía email automáticamente
await this.emailService.sendInvitationEmail({...});

// 3. Usuario acepta invitación
await this.invitationService.acceptInvitation(invitationId, userId);

// 4. Usuario se agrega a organización
await this.orgService.addMemberToOrganization(orgId, userData);
```

---

## 🎨 Componentes UI

### Mostrar Toast

```typescript
// ✅ Usar UiService (recomendado)
this.uiService.showSuccess("Operación exitosa");
this.uiService.showError("Ocurrió un error");
this.uiService.showWarning("Advertencia");
this.uiService.showInfo("Información");
```

### Logger

```typescript
// Logging categorizado
this.logger.info("AUTH", "User logged in", { userId });
this.logger.error("FIREBASE", "Failed to save", error);
this.logger.warn("NETWORK", "Slow connection");
this.logger.debug("MAP", "Marker clicked", marker);
```

---

## 🧪 Testing

```bash
# Ejecutar tests unitarios
npm run test

# Tests con coverage
npm run test:coverage

# E2E tests
npm run e2e
```

---

## 📦 Build de Producción

### Web

```bash
ionic build --prod
```

### Android AAB (Play Store)

```bash
# 1. Build de producción
ionic build --prod

# 2. Sync con Capacitor
npx cap sync android

# 3. Generar AAB
cd android
./gradlew clean bundleRelease

# 4. AAB estará en:
# android/app/build/outputs/bundle/release/app-release.aab
```

---

## 🔐 Seguridad

### Validación de Datos

```typescript
// ✅ SIEMPRE validar antes de guardar
const validation = this.validationService.validateMarkerForm(data);
if (!validation.valid) {
  return; // No guardar datos inválidos
}

// ✅ Sanitizar inputs de usuario
const sanitized = this.validationService.validateTitle(userInput);
```

### Reglas de Firestore

- ✅ Solo usuarios autenticados pueden leer/escribir
- ✅ Usuarios solo ven datos de su organización
- ✅ Solo admins pueden modificar configuración de org
- ✅ Creadores de marcadores/zonas pueden editarlos

---

## 🐛 Debugging

### Console Logs

```typescript
// Los logs están categorizados:
[2025-10-22 14:30:15] [AUTH] [INFO] User logged in
[2025-10-22 14:30:20] [MAP] [DEBUG] Marker clicked
[2025-10-22 14:30:25] [FIREBASE] [ERROR] Failed to save marker
```

### Chrome DevTools

1. Abrir DevTools (F12)
2. Tab **Console**: Ver logs
3. Tab **Network**: Ver requests a Firebase
4. Tab **Application** > **IndexedDB**: Ver datos locales

### Android Debugging

```bash
# Ver logs en tiempo real
adb logcat | grep GeoPoint

# Instalar APK de debug
adb install app-debug.apk

# Limpiar datos de app
adb shell pm clear com.imaginetz.geopoint
```

---

## 📖 Recursos

### Documentación Oficial

- [Angular Docs](https://angular.io/docs)
- [Ionic Docs](https://ionicframework.com/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Leaflet Docs](https://leafletjs.com/reference.html)

### Guías Internas

- **[DOCUMENTACION_CODIGO.md](./DOCUMENTACION_CODIGO.md)** - Documentación completa del código
- **[CONFIGURACION.md](./CONFIGURACION.md)** - Configuración de Firebase y EmailJS
- **[PRUEBAS_API_KEYS.md](./PRUEBAS_API_KEYS.md)** - Guía de testing con diferentes API Keys

---

## 🤝 Contribuir

### Workflow de Git

```bash
# 1. Crear rama para feature
git checkout -b feature/nueva-funcionalidad

# 2. Hacer cambios y commits
git add .
git commit -m "feat: agregar nueva funcionalidad"

# 3. Push a GitHub
git push origin feature/nueva-funcionalidad

# 4. Crear Pull Request en GitHub
```

### Commits Convencionales

```
feat: Nueva funcionalidad
fix: Corrección de bug
docs: Cambios en documentación
style: Cambios de formato (no afectan funcionalidad)
refactor: Refactorización de código
test: Agregar o modificar tests
chore: Tareas de mantenimiento
```

---

## ❓ FAQ

### ¿Cómo agregar un nuevo componente?

```bash
ionic generate component shared/components/nuevo-componente --standalone
```

### ¿Cómo agregar un nuevo servicio?

```bash
ionic generate service shared/services/nuevo-servicio
```

### ¿Cómo cambiar el package name de Android?

1. Editar `android/app/build.gradle` → `applicationId`
2. Editar `capacitor.config.ts` → `appId`
3. Mover `MainActivity.java` a nueva carpeta de package
4. Actualizar `strings.xml` → `package_name`
5. Ejecutar `npx cap sync android`

### ¿Por qué los marcadores desaparecen después de 30 segundos?

Usar `getDocs()` con polling en lugar de `collectionData()`. Ver `map-data.service.ts`.

### ¿Cómo actualizar Firebase a una nueva versión?

```bash
npm install @angular/fire@latest firebase@latest
npx cap sync
```

---

## 📞 Contacto

**Desarrollador**: Caleb Abisai  
**Email**: gelndcaleb@gmail.com  
**GitHub**: [@Calebabisai](https://github.com/Calebabisai)

---

## 📝 Licencia

Este proyecto es propiedad de **ImagineTz** y está protegido por derechos de autor.

**© 2025 ImagineTz. Todos los derechos reservados.**

---

**Última actualización**: 22 de Octubre, 2025  
**Versión**: 1.0.0  
**Package**: com.imaginetz.geopoint
