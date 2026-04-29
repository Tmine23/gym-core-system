# Implementation Plan: Módulo de Configuración

## Overview

Implementación del módulo de Configuración para Body Xtreme Gym OS. Se construye una página `/configuracion` con 4 pestañas (Sucursales, Empleados, Roles, Ajustes), CRUD completo para cada entidad, registro de auditoría en `logs_sistema`, y reemplazo de constantes hardcodeadas. Sigue los mismos patrones de `app/socios/page.tsx` y `app/pagos/page.tsx`: componente `"use client"`, llamadas directas a Supabase, dark theme, todo en español.

## Tasks

- [ ] 1. Migración de base de datos y actualización del Sidebar
  - [ ] 1.1 Aplicar migración para agregar columna `capacidad_maxima` a la tabla `sucursales`
    - Ejecutar: `ALTER TABLE sucursales ADD COLUMN capacidad_maxima integer NOT NULL DEFAULT 50 CONSTRAINT capacidad_maxima_positiva CHECK (capacidad_maxima > 0);`
    - Verificar que la columna existe y el CHECK constraint funciona
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 1.2 Actualizar `app/_components/SidebarNav.tsx` para habilitar el enlace de Configuración
    - Remover `soon: true` del item con `href: "/configuracion"` en el grupo "Sistema"
    - Verificar que al navegar a `/configuracion` el enlace se resalta como activo y no muestra la etiqueta "Pronto"
    - _Requirements: 1.4_

- [ ] 2. Crear la página principal de Configuración con sistema de pestañas
  - [ ] 2.1 Crear `app/configuracion/page.tsx` con el componente `ConfiguracionPage`
    - Exportar componente `"use client"` por defecto
    - Definir todos los TypeScript types: `SucursalRow`, `EmpleadoRow`, `RolRow`, `SucursalForm`, `EmpleadoForm`, `RolForm`
    - Implementar estado `activeTab: "sucursales" | "empleados" | "roles" | "ajustes"` (default: `"sucursales"`)
    - Renderizar header con `section-kicker` ("Sistema"), `section-title` ("Configuración"), `section-description`
    - Renderizar `Panel_Tabs` como botones pill: 🏢 Sucursales, 👥 Empleados, 🔑 Roles, ⚙️ Ajustes
    - Estilos del tab bar: contenedor `rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1 w-fit`
    - Tab activa: `bg-brand-green/15 text-brand-green border border-brand-green/30 rounded-xl px-6 py-2`
    - Tab inactiva: `text-slate-400 hover:text-slate-200 rounded-xl px-6 py-2`
    - Renderizar condicionalmente el componente de la pestaña activa
    - Implementar componentes reutilizables: `Toast`, `Field`, `Badge_Estado`, `FormModal`, función `insertLog`
    - `insertLog` debe sanitizar `password_hash` de `valor_anterior` y `valor_nuevo` antes de insertar en `logs_sistema`
    - _Requirements: 1.1, 1.2, 1.3, 7.4_

- [ ] 3. Checkpoint - Verificar estructura base
  - Asegurar que la página `/configuracion` renderiza correctamente con las 4 pestañas
  - Verificar que el Sidebar resalta "Configuración" como activo
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implementar pestaña Sucursales con CRUD completo
  - [ ] 4.1 Implementar componente `SucursalesTab`
    - Cargar sucursales con `supabase.from("sucursales").select("*")`
    - Renderizar tabla con columnas: nombre, ciudad, teléfono, NIT, estado (`Badge_Estado`), acciones
    - Botón "Nueva Sucursal" abre `FormModal` en modo create
    - Botón editar por fila abre `FormModal` en modo edit precargado con datos actuales
    - Toggle de estado alterna `esta_activa` con optimistic update
    - Formulario con campos: nombre (obligatorio), dirección (obligatorio), teléfono (opcional), ciudad (obligatorio), NIT (opcional), capacidad máxima (obligatorio, numérico, > 0)
    - Validación client-side: campos obligatorios vacíos muestran error inline en rojo (`text-red-400`)
    - Manejo de errores de DB: mostrar Toast con mensaje en español
    - Cada operación CRUD (insert, update, toggle estado) llama a `insertLog` con tabla_afectada="sucursales"
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 7.1_

- [ ] 5. Implementar pestaña Empleados con CRUD completo
  - [ ] 5.1 Implementar componente `EmpleadosTab`
    - Cargar empleados con join: `supabase.from("empleados").select("*, roles(nombre), sucursales(nombre)")`
    - Renderizar tabla con columnas: nombre completo, CI, email, rol, sucursal, estado (`Badge_Estado`), acciones
    - Botón "Nuevo Empleado" abre `FormModal` en modo create
    - Formulario con campos: nombre, apellido, CI, email, contraseña, rol (selector desde tabla `roles`), sucursal (selector desde `sucursales` activas)
    - Campo contraseña solo visible en modo create, excluido en modo edit
    - Password se hashea con `crypto.subtle.digest('SHA-256', ...)` antes de insertar
    - Validación de unicidad de CI y email: detectar error PostgreSQL `23505` y mostrar mensajes específicos ("El CI ya está registrado", "El email ya está registrado")
    - Botón editar precarga datos actuales excluyendo contraseña
    - Toggle de estado alterna `es_activo` con optimistic update
    - Cada operación CRUD llama a `insertLog` con tabla_afectada="empleados"
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 7.2_

- [ ] 6. Implementar pestaña Roles con CRUD completo
  - [ ] 6.1 Implementar componente `RolesTab`
    - Cargar roles con `supabase.from("roles").select("*")`
    - Renderizar tabla con columnas: nombre, descripción, permisos activos (como badges verde/gris), acciones
    - Botón "Nuevo Rol" abre `FormModal` en modo create
    - Formulario con campos: nombre (obligatorio, único), descripción (opcional), tres toggles de permisos: "Ver Finanzas", "Editar Usuarios", "Gestionar Asistencias"
    - Validación de nombre único: detectar error PostgreSQL `23505` y mostrar "El nombre de rol ya existe"
    - Botón editar precarga datos actuales del rol
    - Protección contra eliminación: consultar `empleados` con count antes de eliminar, mostrar advertencia si tiene empleados asignados
    - Cada operación CRUD llama a `insertLog` con tabla_afectada="roles"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.3_

- [ ] 7. Checkpoint - Verificar CRUD de las 3 entidades
  - Verificar que se pueden crear, editar y cambiar estado de sucursales
  - Verificar que se pueden crear, editar y cambiar estado de empleados
  - Verificar que se pueden crear y editar roles, y que no se pueden eliminar roles con empleados
  - Verificar que los logs se registran en `logs_sistema` para cada operación
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implementar pestaña Ajustes y reemplazo de constantes hardcodeadas
  - [ ] 8.1 Implementar componente `AjustesTab`
    - Selector de sucursal (dropdown con sucursales activas)
    - Al seleccionar sucursal, cargar `capacidad_maxima` desde la tabla `sucursales`
    - Campo editable: capacidad máxima (numérico, validación > 0)
    - Campos de solo lectura: zona horaria (America/La_Paz), moneda (BOB)
    - Botón guardar actualiza `capacidad_maxima` en la tabla `sucursales`
    - Toast de confirmación al guardar exitosamente
    - Validación: si capacidad ≤ 0, mostrar mensaje de error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 8.2 Actualizar `app/page.tsx` (Dashboard) para leer capacidad y sucursal desde la base de datos
    - Reemplazar constantes `SUCURSAL_ID = 1` y `CAPACITY = 50` con valores dinámicos
    - Cargar sucursal activa desde `supabase.from("sucursales").select("id, capacidad_maxima").eq("esta_activa", true).limit(1).single()`
    - Usar fallback `SUCURSAL_ID = 1` y `capacidad = 50` si la consulta falla
    - Actualizar el widget de aforo para usar `capacidad_maxima` de la sucursal
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 9. Final checkpoint - Verificar integración completa
  - Verificar que los Ajustes guardan la capacidad y se refleja en el Dashboard
  - Verificar que el Dashboard usa valores dinámicos en lugar de constantes
  - Verificar que el fallback funciona cuando no hay sucursal configurada
  - Verificar que todas las pestañas funcionan correctamente
  - Verificar que los logs de auditoría se registran para todas las operaciones
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Todos los textos de la interfaz están en español (Bolivia)
- Se sigue el mismo patrón de diseño que `app/socios/page.tsx` y `app/pagos/page.tsx`
- Dark theme: fondo #020617, bordes #1e293b, acentos brand-green, tarjetas rounded-2xl
- Las tablas `sucursales`, `empleados`, `roles` y `logs_sistema` ya existen — solo se agrega `capacidad_maxima`
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
