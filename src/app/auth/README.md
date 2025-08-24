# Sistema de Autorización por Roles

## Descripción

Este sistema implementa control de acceso basado en roles (RBAC) para la aplicación GeoPoint, permitiendo diferentes niveles de permisos entre administradores y usuarios regulares.

## Roles Disponibles

### Administrador (`admin`)

- **Permisos completos:**
  - Crear, editar y eliminar marcadores
  - Crear, editar y eliminar zonas
  - Gestionar usuarios
  - Acceso a configuraciones del sistema
  - Panel de administración

### Usuario (`user`)

- **Permisos limitados:**
  - Ver marcadores y zonas
  - Crear marcadores básicos (con restricciones)
  - Sin acceso a funciones administrativas

## Componentes del Sistema

### 1. AuthorizationService (`services/authorization.service.ts`)

- Gestiona permisos y verificaciones de roles
- Métodos principales:
  - `hasPermission(permission: string): Observable<boolean>`
  - `isAdmin(): Observable<boolean>`
  - `getCurrentUserRole(): Observable<'admin' | 'user' | null>`

### 2. RoleSelectorComponent (`components/role-selector/role-selector.component.ts`)

- **Solo para desarrollo:** Permite cambiar roles para probar la aplicación
- Interfaz de popover con botones Admin/Usuario
- Indicadores visuales del rol actual

### 3. Integración en MapControlsComponent

- Los botones FAB se muestran/ocultan según permisos
- Indicador de rol en la parte superior derecha
- Panel de administración (solo para admins)

## Cómo Usar el Sistema

### Para Desarrollo

1. La aplicación inicia en modo "usuario" por defecto
2. Usa el selector de roles (esquina superior izquierda) para cambiar entre admin/usuario
3. Observa cómo cambia la interfaz según el rol seleccionado

### Para Producción

1. Conectar con Firebase Authentication
2. Asignar roles en la base de datos Firestore
3. El sistema detectará automáticamente el rol del usuario autenticado

## Permisos Específicos

```typescript
// Permisos de Administrador
const adminPermissions = ["create-marker", "edit-marker", "delete-marker", "create-zone", "edit-zone", "delete-zone", "manage-users", "system-settings"];

// Permisos de Usuario
const userPermissions = ["view-markers", "view-zones", "create-basic-marker"];
```

## Interfaz de Usuario

### Indicadores Visuales

- **Chip verde con escudo:** Usuario administrador
- **Chip azul con persona:** Usuario regular
- **Botones FAB:** Se muestran según permisos
- **Botón de configuración:** Solo visible para admins

### Funcionalidades por Rol

| Función             | Admin | Usuario       |
| ------------------- | ----- | ------------- |
| Crear marcadores    | ✅    | ⚠️ (limitado) |
| Crear zonas         | ✅    | ❌            |
| Panel admin         | ✅    | ❌            |
| Cambiar roles (dev) | ✅    | ✅            |

## Próximos Pasos

1. **Conectar con Firebase Auth:** Reemplazar simulación con autenticación real
2. **Gestión de usuarios:** Panel para admins para asignar/cambiar roles
3. **Permisos granulares:** Más niveles de permisos específicos
4. **Auditoría:** Registro de acciones por rol
5. **UI mejorada:** Más indicadores visuales de permisos

## Testing

Para probar el sistema:

1. Abre la aplicación
2. Cambia entre roles usando el selector (esquina superior izquierda)
3. Observa cómo cambian los botones disponibles en el FAB
4. Verifica que solo los admins ven el botón de configuración
5. Confirma que el indicador de rol se actualiza correctamente

---

_Nota: Este sistema está en desarrollo y usa simulación para testing. Para producción, conectar con Firebase Authentication y Firestore para persistencia de roles._
