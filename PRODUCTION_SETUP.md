# 🚀 Configuración de Producción - iOS y Android

## 📱 Tu Información de la App

- **Bundle ID:** `com.geopoint.app`
- **App Name:** `GeoPoint`
- **Firebase Project:** `geopoint-f1d56`

---

## 🔐 PASO 1: Configurar API Key para ANDROID

### 1.1 Información que Necesitas

**SHA-1 Fingerprint (Debug - para desarrollo):**

```
67:07:BA:47:11:BB:93:46:CE:37:02:0B:44:FE:0D:47:C7:D3:50:55
```

**SHA-256 Fingerprint (Debug):**

```
47:40:66:BE:52:79:3B:52:22:21:AF:25:E7:30:55:29:27:70:DE:1B:67:61:70:8C:2A:DB:9C:7E:DF:F1:7E:D3
```

### 1.2 Generar Release Keystore (Para Play Store)

Si aún no tienes tu keystore de producción, créalo:

```powershell
# Navega al directorio del proyecto
cd c:\Users\gelnd\OneDrive\Desktop\GeoPoint\Geo-Point

# Crea el keystore de release
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore geopoint-release.keystore -alias geopoint -keyalg RSA -keysize 2048 -validity 10000

# Te pedirá:
# - Password del keystore (GUÁRDALO EN LUGAR SEGURO)
# - Password del alias
# - Nombre, organización, etc.
```

### 1.3 Obtener SHA-1 del Release Keystore

Después de crear tu keystore de release:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore geopoint-release.keystore -alias geopoint
```

**Guarda los SHA-1 y SHA-256 que te muestre.**

### 1.4 Configurar en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona el proyecto: **geopoint-f1d56**
3. Ve a **APIs y servicios → Credenciales**
4. Haz clic en **+ CREAR CREDENCIALES → Clave de API**
5. Se creará una nueva API key → Haz clic en **RESTRINGIR CLAVE**

**Configuración de Restricciones:**

```
Restricciones de aplicación:
● Aplicaciones de Android

Nombre del paquete: com.geopoint.app
Huella digital SHA-1: 67:07:BA:47:11:BB:93:46:CE:37:02:0B:44:FE:0D:47:C7:D3:50:55

[+ Agregar elemento] (para release keystore)
Nombre del paquete: com.geopoint.app
Huella digital SHA-1: [EL SHA-1 DE TU RELEASE KEYSTORE]
```

**Restricciones de API:**

- ✅ Maps JavaScript API
- ✅ Geolocation API
- ✅ Firebase APIs (todas)

6. **Guarda** la clave
7. **Copia la API Key** - la necesitarás para environment.ts

---

## 🍎 PASO 2: Configurar API Key para iOS

### 2.1 Crear API Key para iOS

1. En Google Cloud Console → **APIs y servicios → Credenciales**
2. Haz clic en **+ CREAR CREDENCIALES → Clave de API**
3. Se creará una nueva API key → Haz clic en **RESTRINGIR CLAVE**

**Configuración de Restricciones:**

```
Restricciones de aplicación:
● Aplicaciones de iOS

ID del paquete: com.geopoint.app
```

**Restricciones de API:**

- ✅ Maps JavaScript API
- ✅ Geolocation API
- ✅ Firebase APIs (todas)

4. **Guarda** la clave
5. **Copia la API Key**

---

## 🔄 PASO 3: Actualizar Firebase Console

### 3.1 Agregar App de Android

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto **geopoint-f1d56**
3. En la configuración del proyecto → **Agregar app → Android**

**Configuración:**

```
Nombre del paquete de Android: com.geopoint.app
Alias de la app (opcional): GeoPoint Android
Certificado de firma de depuración SHA-1: 67:07:BA:47:11:BB:93:46:CE:37:02:0B:44:FE:0D:47:C7:D3:50:55
```

4. Descarga el archivo `google-services.json`
5. Colócalo en: `android/app/google-services.json`

### 3.2 Agregar App de iOS

1. En Firebase Console → **Agregar app → iOS**

**Configuración:**

```
ID del paquete de iOS: com.geopoint.app
Alias de la app (opcional): GeoPoint iOS
```

2. Descarga el archivo `GoogleService-Info.plist`
3. Colócalo en: `ios/App/GoogleService-Info.plist`

---

## 📝 PASO 4: Actualizar Archivos Environment

### 4.1 Estructura Recomendada

Necesitas usar **condicionales** para detectar la plataforma:

```typescript
// environment.ts
import { Capacitor } from "@capacitor/core";

const platform = Capacitor.getPlatform(); // 'ios', 'android', o 'web'

// API Keys por plataforma
const API_KEYS = {
  android: "TU_API_KEY_ANDROID_AQUI",
  ios: "TU_API_KEY_IOS_AQUI",
  web: "TU_API_KEY_WEB_AQUI",
};

const firebaseConfig = {
  apiKey: API_KEYS[platform] || API_KEYS.web,
  authDomain: "geopoint-f1d56.firebaseapp.com",
  projectId: "geopoint-f1d56",
  storageBucket: "geopoint-f1d56.firebasestorage.app",
  messagingSenderId: "815851668907",
  appId: "1:815851668907:web:48fbf0ee98bd8d329bfeee",
  measurementId: "G-YHTVJ3JEH4",
};
```

---

## 🏗️ PASO 5: Preparar para Publicación

### Android (Play Store)

```bash
# 1. Build de producción
ionic build --prod

# 2. Sync con Capacitor
npx cap sync android

# 3. Abre Android Studio
npx cap open android

# 4. En Android Studio:
# Build → Generate Signed Bundle / APK
# Selecciona tu keystore de release
# Genera AAB para Play Store
```

### iOS (App Store)

```bash
# 1. Build de producción
ionic build --prod

# 2. Sync con Capacitor
npx cap sync ios

# 3. Abre Xcode
npx cap open ios

# 4. En Xcode:
# - Configura tu equipo de desarrollo
# - Selecciona Generic iOS Device
# - Product → Archive
# - Distribute App → App Store Connect
```

---

## ⚠️ IMPORTANTE: Seguridad

### Archivos que NO deben subirse a GitHub:

- ✅ Ya están en `.gitignore`:

  - `/src/environments/environment.ts`
  - `/src/environments/environment.prod.ts`

- ⚠️ Agregar también:
  - `*.keystore`
  - `*.jks`
  - `android/app/google-services.json`
  - `ios/App/GoogleService-Info.plist`

### Eliminar la API Key Antigua

Una vez que las nuevas claves estén funcionando:

1. Ve a Google Cloud Console → Credenciales
2. **ELIMINA** la clave antigua: `AIzaSyA5Vfvd4PYXlXj5X0YetLmYwDTVQZ6dpWE`
3. Confirma que la app sigue funcionando con las nuevas claves

---

## 📋 Checklist Final

### Antes de Publicar:

- [ ] Release keystore creado y guardado en lugar seguro
- [ ] SHA-1 de release keystore agregado a Google Cloud
- [ ] API Keys de Android e iOS creadas y restringidas
- [ ] `google-services.json` descargado y colocado en `android/app/`
- [ ] `GoogleService-Info.plist` descargado y colocado en `ios/App/`
- [ ] Archivos `environment.ts` actualizados con nuevas API keys
- [ ] `.gitignore` incluye keystore y archivos de configuración
- [ ] API key antigua eliminada de Google Cloud
- [ ] App probada en dispositivo físico Android
- [ ] App probada en dispositivo físico iOS (si tienes Mac)
- [ ] Build de producción generado (AAB para Android)
- [ ] Build de producción generado (IPA para iOS)

---

**¡Listo para producción!** 🚀
