# 🧪 Guía de Pruebas: API Keys por Plataforma

## 📋 Resumen de Configuración

Has configurado tu aplicación para usar **API Keys específicas por plataforma**:

- **Android**: `AIzaSyAs_Sr6wJinTsLn7jrz2Q4d1xEGYMPdcEc`
- **iOS**: `AIzaSyDy20Vr8fH2F0wl_Gsi-EADsiHB1aux27E`
- **Web (PC)**: `AIzaSyDVZEHMhc9QUqcGK6MQYjZjyJ1YaI7H3po`

## ✅ Cómo Probar Cada Plataforma

### 1️⃣ **Probar en WEB (navegador/PC)**

```bash
# Iniciar servidor de desarrollo
npm start
```

**Verificar en la consola del navegador (F12):**

```
🔧 CONFIGURACIÓN DE FIREBASE:
📱 Plataforma detectada: web
🔑 API Key seleccionada: AIzaSyDVZEHMhc9QUqcG...
```

**Qué probar:**

- ✅ Login funciona
- ✅ Firestore carga datos
- ✅ Mapas de Google se muestran correctamente
- ✅ No hay errores en consola

---

### 2️⃣ **Probar en ANDROID**

```bash
# Sincronizar con Android
npx cap sync android

# Abrir Android Studio
npx cap open android
```

**En Android Studio:**

1. Conecta tu dispositivo o inicia un emulador
2. Click en ▶️ Run
3. Abre Logcat (View → Tool Windows → Logcat)

**Buscar en Logcat:**

```
🔧 CONFIGURACIÓN DE FIREBASE:
📱 Plataforma detectada: android
🔑 API Key seleccionada: AIzaSyAs_Sr6wJinTsLn7...
```

**Qué probar:**

- ✅ Login funciona
- ✅ Firestore carga datos
- ✅ GPS y mapas funcionan
- ✅ No hay errores de autenticación

---

### 3️⃣ **Probar en iOS**

```bash
# Sincronizar con iOS
npx cap sync ios

# Abrir Xcode
npx cap open ios
```

**En Xcode:**

1. Selecciona tu dispositivo o simulador
2. Click en ▶️ Run
3. Abre la consola (View → Debug Area → Activate Console)

**Buscar en consola:**

```
🔧 CONFIGURACIÓN DE FIREBASE:
📱 Plataforma detectada: ios
🔑 API Key seleccionada: AIzaSyDy20Vr8fH2F0wl...
```

**Qué probar:**

- ✅ Login funciona
- ✅ Firestore carga datos
- ✅ GPS y mapas funcionan
- ✅ No hay errores de autenticación

---

## 🔍 Troubleshooting

### ❌ **Error: "API key not valid"**

**Causa:** La API key no tiene permisos para la plataforma actual.

**Solución:**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click en tu API key
3. En "Application restrictions", verifica:
   - **Android**: Package name = `com.geopoint.app` (o el que uses)
   - **iOS**: Bundle ID = `com.geopoint.app` (o el que uses)
   - **Web**: HTTP referrers = `localhost:8100`, tu dominio

---

### ❌ **Error: "Firebase App already exists"**

**Causa:** Doble inicialización de Firebase.

**Solución:** Ya está arreglado. Los archivos `environment.ts` NO deben llamar `initializeApp()`.

---

### ❌ **Datos no cargan en una plataforma específica**

**Verificar:**

1. **En Firebase Console → Authentication:**

   - Asegúrate que el método de login esté habilitado (Email/Password, Google, etc.)

2. **En Firebase Console → Firestore:**

   - Verifica las reglas de seguridad permitan lectura:

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

3. **API Key correcta:**
   - Verifica en consola que se use la API key correcta para tu plataforma

---

## 🎯 Checklist de Pruebas Completo

### **Web (PC)** ✅

- [ ] `npm start` inicia sin errores
- [ ] Consola muestra: `Plataforma detectada: web`
- [ ] Login funciona
- [ ] Dashboard carga usuarios
- [ ] Mapa se muestra correctamente
- [ ] Geolocalización funciona

### **Android** ✅

- [ ] `npx cap sync android` sin errores
- [ ] Logcat muestra: `Plataforma detectada: android`
- [ ] Login funciona
- [ ] Dashboard carga usuarios
- [ ] Mapa se muestra correctamente
- [ ] GPS funciona en dispositivo real

### **iOS** ✅

- [ ] `npx cap sync ios` sin errores
- [ ] Consola muestra: `Plataforma detectada: ios`
- [ ] Login funciona
- [ ] Dashboard carga usuarios
- [ ] Mapa se muestra correctamente
- [ ] GPS funciona en dispositivo real

---

## 📊 Comparación: Antes vs Ahora

| Aspecto       | ❌ Antes (1 API Key)                 | ✅ Ahora (3 API Keys)               |
| ------------- | ------------------------------------ | ----------------------------------- |
| **Seguridad** | Baja - cualquiera puede usar la key  | Alta - restricciones por plataforma |
| **Cuotas**    | Compartidas entre plataformas        | Independientes por plataforma       |
| **Monitoreo** | Difícil saber qué plataforma consume | Fácil ver uso por plataforma        |
| **Costos**    | Difícil controlar                    | Mejor control por plataforma        |

---

## 🔐 Restricciones Recomendadas en Google Cloud

### **API Key de Android**

```
Application restrictions:
  ☑ Android apps
  Package name: com.geopoint.app
  SHA-1 certificate fingerprint: [Tu fingerprint]

API restrictions:
  ☑ Restrict key
  ☑ Maps SDK for Android
  ☑ Geocoding API
  ☑ Geolocation API
```

### **API Key de iOS**

```
Application restrictions:
  ☑ iOS apps
  Bundle IDs: com.geopoint.app

API restrictions:
  ☑ Restrict key
  ☑ Maps SDK for iOS
  ☑ Geocoding API
  ☑ Geolocation API
```

### **API Key de Web**

```
Application restrictions:
  ☑ HTTP referrers (websites)
  Website restrictions:
    - localhost:8100/*
    - localhost:4200/*
    - https://tudominio.com/*

API restrictions:
  ☑ Restrict key
  ☑ Maps JavaScript API
  ☑ Geocoding API
  ☑ Geolocation API
```

---

## 🚀 Comandos Rápidos

```bash
# Instalar dependencias
npm install

# Web
npm start                    # Desarrollo
npm run build               # Producción

# Android
npx cap sync android        # Sincronizar
npx cap open android        # Abrir Android Studio
npx cap run android         # Compilar y ejecutar

# iOS
npx cap sync ios            # Sincronizar
npx cap open ios            # Abrir Xcode
npx cap run ios             # Compilar y ejecutar
```

---

## 📝 Notas Importantes

1. **Las API Keys están en `.gitignore`** - No se subirán a GitHub ✅
2. **Los logs de plataforma** ayudan a debugging - Puedes comentarlos en producción
3. **Cada plataforma** debe tener su propia configuración en Google Cloud Console
4. **Firebase Rules** deben permitir acceso a usuarios autenticados

---

## 💡 Tips

- Si cambias las API keys, reinicia el servidor/app completamente
- Limpia caché: `Remove-Item -Recurse -Force .angular/cache`
- Verifica siempre los logs de consola para confirmar la plataforma detectada
- En Android/iOS, usa Logcat/Console para debugging

---

**¿Todo funciona? ¡Genial! 🎉**

Si encuentras algún error, revisa esta guía y los logs de consola.
