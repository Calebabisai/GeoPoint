# 🚀 GUÍA RÁPIDA - Publicación HOY

## ✅ Tu SHA-1 Fingerprint (Debug)

```
67:07:BA:47:11:BB:93:46:CE:37:02:0B:44:FE:0D:47:C7:D3:50:55
```

---

## 📋 Pasos Inmediatos (en orden)

### 1️⃣ Crear Release Keystore (5 minutos)

```powershell
cd c:\Users\gelnd\OneDrive\Desktop\GeoPoint\Geo-Point

& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore geopoint-release.keystore -alias geopoint -keyalg RSA -keysize 2048 -validity 10000
```

**Guarda la contraseña en lugar seguro** ⚠️

Luego obtén el SHA-1 del release:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore geopoint-release.keystore -alias geopoint
```

---

### 2️⃣ Crear 3 API Keys en Google Cloud (10 minutos)

Ve a: https://console.cloud.google.com/apis/credentials?project=geopoint-f1d56

#### API Key #1 - Android

```
Nombre: GeoPoint Android Key
Restricción: Aplicaciones de Android
  - Paquete: com.geopoint.app
  - SHA-1 (debug): 67:07:BA:47:11:BB:93:46:CE:37:02:0B:44:FE:0D:47:C7:D3:50:55
  - SHA-1 (release): [EL QUE OBTUVISTE EN PASO 1]
```

#### API Key #2 - iOS

```
Nombre: GeoPoint iOS Key
Restricción: Aplicaciones de iOS
  - Bundle ID: com.geopoint.app
```

#### API Key #3 - Web (opcional, para desarrollo)

```
Nombre: GeoPoint Web Key
Restricción: HTTP referrers
  - http://localhost:*/*
  - https://geopoint-f1d56.firebaseapp.com/*
```

**Copia las 3 API Keys** - las necesitarás en el paso 4

---

### 3️⃣ Configurar Firebase Console (5 minutos)

Ve a: https://console.firebase.google.com/project/geopoint-f1d56

#### Agregar Android App

```
1. Click en ⚙️ → Configuración del proyecto
2. En "Tus aplicaciones" → Agregar app → Android
3. Paquete: com.geopoint.app
4. SHA-1 debug: 67:07:BA:47:11:BB:93:46:CE:37:02:0B:44:FE:0D:47:C7:D3:50:55
5. SHA-1 release: [EL DEL PASO 1]
6. Descargar google-services.json
7. Colocar en: c:\Users\gelnd\OneDrive\Desktop\GeoPoint\Geo-Point\android\app\google-services.json
```

#### Agregar iOS App

```
1. Agregar app → iOS
2. Bundle ID: com.geopoint.app
3. Descargar GoogleService-Info.plist
4. Colocar en: c:\Users\gelnd\OneDrive\Desktop\GeoPoint\Geo-Point\ios\App\GoogleService-Info.plist
```

---

### 4️⃣ Actualizar environment.ts (3 minutos)

Abre: `src/environments/environment.ts`

Reemplaza las API keys:

```typescript
const API_KEYS: { [key: string]: string } = {
  android: "TU_API_KEY_ANDROID", // ← Del paso 2
  ios: "TU_API_KEY_IOS", // ← Del paso 2
  web: "TU_API_KEY_WEB", // ← Del paso 2
};
```

Haz lo mismo en: `src/environments/environment.prod.ts`

---

### 5️⃣ Verificar .gitignore (1 minuto)

Ya está configurado ✅. Verifica que estos archivos NO se suban:

```bash
git status
```

No deberían aparecer:

- environment.ts
- environment.prod.ts
- \*.keystore
- google-services.json

---

### 6️⃣ Build y Publicación (20 minutos)

#### Para Android:

```bash
# 1. Build
ionic build --prod

# 2. Sync
npx cap sync android

# 3. Abrir Android Studio
npx cap open android

# 4. En Android Studio:
# - Build → Generate Signed Bundle / APK
# - Selecciona Android App Bundle (AAB)
# - Usa tu geopoint-release.keystore
# - Genera el AAB para Play Store
```

#### Para iOS:

```bash
# 1. Build
ionic build --prod

# 2. Sync
npx cap sync ios

# 3. Abrir Xcode (necesitas Mac)
npx cap open ios

# 4. En Xcode:
# - Product → Archive
# - Distribute → App Store Connect
```

---

## 🔥 IMPORTANTE: Eliminar API Key Antigua

Una vez que todo funcione con las nuevas claves:

1. Ve a Google Cloud Console → Credenciales
2. Busca la key: `AIzaSyA5Vfvd4PYXlXj5X0YetLmYwDTVQZ6dpWE`
3. **ELIMÍNALA** ⚠️

---

## 🆘 Si algo falla

Ver detalles completos en: `PRODUCTION_SETUP.md`

---

**Tiempo Total Estimado: ~45 minutos**
**¡Éxito con tu lanzamiento! 🚀**
