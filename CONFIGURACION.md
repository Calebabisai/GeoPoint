# 🔐 Configuración de Credenciales - GeoPoint

## ⚠️ IMPORTANTE: Seguridad de Credenciales

Este proyecto usa Firebase y requiere credenciales que **NO deben subirse a GitHub**.

## 📁 Estructura de Archivos de Configuración

```
src/environments/
├── environment.ts              ✅ SUBIR A GIT (template sin credenciales reales)
├── environment.prod.ts         ✅ SUBIR A GIT (template sin credenciales reales)
├── environment.local.ts        ❌ NO SUBIR (credenciales reales de desarrollo)
└── environment.prod.local.ts   ❌ NO SUBIR (credenciales reales de producción)
```

## 🛠️ Configuración Inicial

### 1. Clona el repositorio
```bash
git clone https://github.com/Calebabisai/GeoPoint.git
cd GeoPoint/Geo-Point
```

### 2. Instala dependencias
```bash
npm install
```

### 3. Crea archivos locales con credenciales reales

#### Para desarrollo:
Crea `src/environments/environment.local.ts`:
```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "TU_API_KEY_REAL_AQUÍ",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
  }
};
```

#### Para producción:
Crea `src/environments/environment.prod.local.ts`:
```typescript
export const environment = {
  production: true,
  firebase: {
    apiKey: "TU_API_KEY_PRODUCCION",
    authDomain: "TU_AUTH_DOMAIN_PROD",
    projectId: "TU_PROJECT_ID_PROD",
    storageBucket: "TU_STORAGE_BUCKET_PROD",
    messagingSenderId: "TU_MESSAGING_SENDER_ID_PROD",
    appId: "TU_APP_ID_PROD"
  }
};
```

### 4. Configura tu app para usar archivos locales

En tu código, importa así:
```typescript
// Primero intenta cargar el archivo local, si no existe usa el template
import { environment } from './environments/environment.local';
```

## 🔒 Archivos Android/iOS Sensibles

Estos archivos **NUNCA** se deben subir a GitHub:

- `*.keystore` - Archivos de firma de Android
- `*.jks` - Java Key Store
- `android/app/google-services.json` - Configuración de Firebase para Android
- `ios/App/GoogleService-Info.plist` - Configuración de Firebase para iOS
- `android/key.properties` - Propiedades de firma

## ✅ Qué SÍ subir a GitHub

- Código fuente (`src/`)
- Archivos de configuración de proyecto (`angular.json`, `package.json`, etc.)
- Templates de environment sin credenciales reales
- Documentación
- `.gitignore`

## ❌ Qué NO subir a GitHub

- `node_modules/`
- Archivos con credenciales reales (`.local.ts`)
- Archivos de firma de Android/iOS
- `google-services.json` / `GoogleService-Info.plist`
- Builds compilados (`/dist`, `/www`, `/platforms`)

## 🚀 Comandos Útiles

```bash
# Ver qué archivos están siendo ignorados
git status --ignored

# Ver qué archivos están rastreados
git ls-files

# Agregar todos los archivos excepto los ignorados
git add .

# Commit y push
git commit -m "Tu mensaje"
git push origin master
```

## 📞 Soporte

Si tienes problemas con la configuración, contacta al administrador del proyecto.
