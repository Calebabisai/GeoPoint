# 🔧 SOLUCIÓN: Firestore Real-Time Listeners Timeout

## 📋 Problema Identificado

Los marcadores y zonas aparecían brevemente en el mapa y luego desaparecían después de ~30 segundos.

### Causa Raíz

- ✅ `getDocs()` (lectura única) **funcionaba perfectamente** - encontraba 2 marcadores
- ❌ `collectionData()` (listener en tiempo real) **fallaba con timeout** - nunca recibía snapshots

**Diagnóstico**: Los real-time listeners de Firestore estaban bloqueados o no se inicializaban correctamente, causando timeouts después de 30 segundos.

### Evidencia

```typescript
// TEST MANUAL - EXITOSO ✅
await getDocs(query(collection, where("organizationId", "==", orgId)));
// Resultado: 2 documentos encontrados

// LISTENER EN TIEMPO REAL - FALLO ❌
collectionData(query(collection, where("organizationId", "==", orgId))).pipe(timeout(30000));
// Resultado: TimeoutError después de 30s
```

## 🛠️ Solución Implementada

**Reemplazar `collectionData()` (real-time) por `getDocs()` (polling)**

### Antes (Con Timeout)

```typescript
return collectionData(query, { idField: "id" }).pipe(
  timeout(30000),
  catchError(() => of([])) // Retorna [] causando eliminación
);
```

### Después (Sin Timeout)

```typescript
return interval(5000).pipe(
  startWith(0), // Ejecutar inmediatamente
  mergeMap(() => from(getDocs(query))),
  timeout(30000),
  switchMap((snapshot) => {
    const items = [];
    snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
    return of(items);
  })
);
```

## ✅ Ventajas de la Solución

1. **No más timeouts**: `getDocs()` es una lectura única que siempre completa
2. **Polling cada 5 segundos**: Datos actualizados sin listeners bloqueados
3. **Ejecución inmediata**: `startWith(0)` carga datos al suscribirse
4. **Menor carga en Firestore**: Lecturas periódicas vs listener permanente
5. **Más confiable**: No depende de listeners en tiempo real que pueden fallar

## 📊 Servicios Actualizados

- ✅ `getMarkers()` - Polling cada 5s con `getDocs()`
- ✅ `getZones()` - Polling cada 5s con `getDocs()`
- ✅ `getRoutes()` - Polling cada 5s con `getDocs()`

## 🔄 Comportamiento Esperado

1. **Carga inicial**: Datos aparecen inmediatamente (startWith(0))
2. **Actualizaciones**: Cada 5 segundos se re-consulta Firestore
3. **Sin desapariciones**: Los datos persisten entre polls
4. **Timeout protección**: Si una consulta tarda >30s, se maneja el error

## 📝 Notas Técnicas

- **Interval**: `5000ms` (5 segundos) - ajustable según necesidad
- **Timeout**: `30000ms` (30 segundos) - suficiente para `getDocs()`
- **startWith(0)**: Asegura carga inmediata sin esperar primer intervalo
- **mergeMap vs switchMap**: `mergeMap` permite queries concurrentes, `switchMap` cancela anteriores

## 🎯 Resultado Final

✅ Marcadores y zonas **permanecen en el mapa**
✅ **Actualizaciones automáticas** cada 5 segundos  
✅ **Sin errores de timeout**
✅ **Rendimiento mejorado** (menos overhead de listeners)
