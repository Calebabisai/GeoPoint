# 🔐 Configuración de Seguridad - API Keys

## ⚠️ IMPORTANTE: API Keys Protegidas

Las claves API de Firebase **NUNCA** deben subirse a GitHub. Este proyecto está configurado para mantener tus credenciales seguras.

## 📋 Pasos para Configurar

### 1. Generar Nueva API Key en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **geopoint-f1d56**
3. Ve a **Configuración del proyecto** (ícono de engranaje)
4. En la pestaña **General**, baja hasta **Tus aplicaciones**
5. Encuentra tu aplicación web
6. Haz clic en **Regenerar clave API** o crea una nueva aplicación
7. **IMPORTANTE**: Elimina la clave antigua expuesta: `AIzaSyA5Vfvd4PYXlXj5X0YetLmYwDTVQZ6dpWE`

### 2. Configurar Archivos de Entorno Localmente

```bash
# Ve al directorio de environments
cd src/environments

# Copia el template para crear tu archivo de configuración
copy environment.template.ts environment.ts

# Abre environment.ts y reemplaza 'YOUR_API_KEY_HERE' con tu nueva API key
```

### 3. Actualizar environment.ts

Abre `src/environments/environment.ts` y reemplaza:

```typescript
apiKey: 'TU_NUEVA_API_KEY_AQUI',  // ← Pega aquí tu nueva API key
```

### 4. Configurar Producción

Si usas un entorno de producción:

```bash
# Edita environment.prod.ts con las mismas claves
# O diferentes si usas proyectos Firebase separados
```

## 🛡️ Protección Implementada

### ✅ Archivos Protegidos en .gitignore

```
/src/environments/environment.ts
/src/environments/environment.prod.ts
/src/environments/.env
/src/environments/.env.local
.env
.env.local
```

Estos archivos **NUNCA** se subirán a GitHub.

### ✅ Template Disponible

El archivo `environment.template.ts` es seguro para compartir - no contiene claves reales.

## 🚨 Si Accidentalmente Subiste una API Key

### Paso 1: Rotación Inmediata

1. Ve a Firebase Console
2. **ELIMINA** la clave expuesta inmediatamente
3. Genera una nueva clave

### Paso 2: Limpia el Historial de Git (Opcional)

```bash
# ADVERTENCIA: Esto reescribe la historia de Git
# Solo hazlo si es absolutamente necesario

# Instala git-filter-repo
pip install git-filter-repo

# Remueve el archivo del historial completo
git filter-repo --path src/environments/environment.ts --invert-paths

# Fuerza el push (CUIDADO: esto afecta a todos los colaboradores)
git push origin --force --all
```

### Paso 3: Verifica que .gitignore Funcione

```bash
# Verifica que Git ignore los archivos correctos
git status

# environment.ts NO debe aparecer en "Changes not staged" o "Untracked files"
# Si aparece, verifica tu .gitignore
```

## 👥 Para Nuevos Desarrolladores

Si eres nuevo en el proyecto:

1. Clona el repositorio
2. **NO** encontrarás `environment.ts` - es normal
3. Copia `environment.template.ts` → `environment.ts`
4. Contacta al administrador para obtener las API keys
5. Configura tu `environment.ts` con las claves proporcionadas
6. **NUNCA** hagas commit de este archivo

## 📞 Contacto

Si tienes problemas con la configuración de seguridad, contacta al administrador del proyecto.

---

**Última actualización**: Octubre 2024  
**Estado**: Sistema de seguridad implementado ✅
