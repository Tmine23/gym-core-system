# Requirements Document

## Introduction

Módulo de Configuración para Body Xtreme Gym OS. Este módulo centraliza la administración del sistema: gestión de sucursales, empleados, roles con permisos granulares, y ajustes generales del gimnasio. Reemplaza los valores hardcodeados actuales (SUCURSAL_ID, CAPACITY) con configuración dinámica por sucursal almacenada en base de datos. Toda la interfaz está en español (Bolivia), zona horaria America/La_Paz, moneda BOB.

## Glossary

- **Módulo_Configuración**: Sección del sistema Body Xtreme Gym OS accesible desde el sidebar bajo "Sistema > Configuración", que agrupa las pantallas de administración de sucursales, empleados, roles y ajustes generales.
- **Sucursal**: Sede física del gimnasio, representada en la tabla `sucursales` con atributos: nombre, dirección, teléfono, ciudad, NIT, estado activo y capacidad máxima.
- **Empleado**: Persona que opera el sistema, representada en la tabla `empleados` con CI, nombre, apellido, email, rol asignado, sucursal asignada y estado activo.
- **Rol**: Perfil de permisos asignable a empleados, representado en la tabla `roles` con permisos booleanos: ver_finanzas, editar_usuarios, gestionar_asistencias.
- **Ajustes_Generales**: Configuración a nivel de sucursal que incluye capacidad máxima de aforo, zona horaria y moneda predeterminada.
- **Panel_Tabs**: Interfaz de navegación por pestañas dentro del Módulo_Configuración que permite alternar entre las secciones Sucursales, Empleados, Roles y Ajustes.
- **Formulario_Modal**: Diálogo superpuesto (modal) utilizado para crear o editar registros de sucursales, empleados o roles.
- **Tabla_Listado**: Componente de tabla que muestra los registros existentes con columnas relevantes, indicadores de estado y acciones por fila.
- **Badge_Estado**: Indicador visual (verde para activo, rojo para inactivo) que muestra el estado de un registro.
- **Capacidad_Sucursal**: Número máximo de socios que pueden estar simultáneamente dentro de una sucursal, almacenado como configuración por sucursal.

## Requirements

### Requirement 1: Navegación al Módulo de Configuración

**User Story:** Como administrador del gimnasio, quiero acceder al módulo de Configuración desde el sidebar, para poder gestionar la configuración del sistema desde un punto centralizado.

#### Acceptance Criteria

1. WHEN el usuario navega a la ruta `/configuracion`, THE Módulo_Configuración SHALL renderizar la página con el Panel_Tabs mostrando las pestañas: Sucursales, Empleados, Roles y Ajustes.
2. WHEN el usuario hace clic en una pestaña del Panel_Tabs, THE Módulo_Configuración SHALL mostrar el contenido correspondiente a la pestaña seleccionada sin recargar la página.
3. THE Módulo_Configuración SHALL mostrar la pestaña "Sucursales" como pestaña activa por defecto al cargar la página.
4. WHEN la ruta `/configuracion` está activa, THE Sidebar SHALL resaltar el enlace "Configuración" como activo y remover la etiqueta "Pronto".

### Requirement 2: Gestión de Sucursales

**User Story:** Como administrador del gimnasio, quiero crear, ver, editar y desactivar sucursales, para poder gestionar las sedes físicas del negocio.

#### Acceptance Criteria

1. WHEN la pestaña Sucursales está activa, THE Tabla_Listado SHALL mostrar todas las sucursales con las columnas: nombre, ciudad, teléfono, NIT, estado (Badge_Estado) y acciones.
2. WHEN el usuario hace clic en el botón "Nueva Sucursal", THE Módulo_Configuración SHALL abrir un Formulario_Modal con los campos: nombre (obligatorio), dirección (obligatorio), teléfono (opcional), ciudad (obligatorio), NIT (opcional) y capacidad máxima (obligatorio, numérico, mayor a 0).
3. WHEN el usuario envía el Formulario_Modal de nueva sucursal con datos válidos, THE Módulo_Configuración SHALL insertar el registro en la tabla `sucursales` y actualizar la Tabla_Listado mostrando la nueva sucursal.
4. IF el usuario envía el Formulario_Modal de nueva sucursal con campos obligatorios vacíos, THEN THE Formulario_Modal SHALL mostrar mensajes de validación en español junto a cada campo inválido sin cerrar el modal.
5. WHEN el usuario hace clic en el botón editar de una sucursal, THE Módulo_Configuración SHALL abrir el Formulario_Modal precargado con los datos actuales de la sucursal seleccionada.
6. WHEN el usuario envía el Formulario_Modal de edición con datos válidos, THE Módulo_Configuración SHALL actualizar el registro en la tabla `sucursales` y refrescar la Tabla_Listado con los datos modificados.
7. WHEN el usuario hace clic en el botón de cambiar estado de una sucursal, THE Módulo_Configuración SHALL alternar el campo `esta_activa` de la sucursal y actualizar el Badge_Estado en la Tabla_Listado.
8. IF ocurre un error al guardar una sucursal en la base de datos, THEN THE Módulo_Configuración SHALL mostrar una notificación de error en español describiendo el problema.

### Requirement 3: Gestión de Empleados

**User Story:** Como administrador del gimnasio, quiero crear, ver, editar y desactivar empleados, para poder controlar quién opera el sistema y con qué permisos.

#### Acceptance Criteria

1. WHEN la pestaña Empleados está activa, THE Tabla_Listado SHALL mostrar todos los empleados con las columnas: nombre completo (nombre + apellido), CI, email, rol asignado (nombre del rol), sucursal asignada (nombre de la sucursal), estado (Badge_Estado) y acciones.
2. WHEN el usuario hace clic en el botón "Nuevo Empleado", THE Módulo_Configuración SHALL abrir un Formulario_Modal con los campos: nombre (obligatorio), apellido (obligatorio), CI (obligatorio), email (obligatorio, formato email válido), contraseña (obligatorio), rol (obligatorio, selector con roles existentes) y sucursal (obligatorio, selector con sucursales activas).
3. WHEN el usuario envía el Formulario_Modal de nuevo empleado con datos válidos, THE Módulo_Configuración SHALL insertar el registro en la tabla `empleados` con el `password_hash` generado y actualizar la Tabla_Listado.
4. IF el usuario envía el Formulario_Modal de nuevo empleado con un CI o email que ya existe en la base de datos, THEN THE Formulario_Modal SHALL mostrar un mensaje de error indicando que el CI o email ya está registrado.
5. WHEN el usuario hace clic en el botón editar de un empleado, THE Módulo_Configuración SHALL abrir el Formulario_Modal precargado con los datos actuales del empleado, excluyendo el campo contraseña.
6. WHEN el usuario envía el Formulario_Modal de edición de empleado con datos válidos, THE Módulo_Configuración SHALL actualizar el registro en la tabla `empleados` y refrescar la Tabla_Listado.
7. WHEN el usuario hace clic en el botón de cambiar estado de un empleado, THE Módulo_Configuración SHALL alternar el campo `es_activo` del empleado y actualizar el Badge_Estado en la Tabla_Listado.
8. IF ocurre un error al guardar un empleado en la base de datos, THEN THE Módulo_Configuración SHALL mostrar una notificación de error en español describiendo el problema.

### Requirement 4: Gestión de Roles

**User Story:** Como administrador del gimnasio, quiero crear, ver y editar roles con permisos específicos, para poder definir qué acciones puede realizar cada tipo de empleado en el sistema.

#### Acceptance Criteria

1. WHEN la pestaña Roles está activa, THE Tabla_Listado SHALL mostrar todos los roles con las columnas: nombre, descripción, permisos activos (lista de permisos habilitados como badges) y acciones.
2. WHEN el usuario hace clic en el botón "Nuevo Rol", THE Módulo_Configuración SHALL abrir un Formulario_Modal con los campos: nombre (obligatorio, único), descripción (opcional) y tres toggles de permisos: "Ver Finanzas" (permiso_ver_finanzas), "Editar Usuarios" (permiso_editar_usuarios) y "Gestionar Asistencias" (permiso_gestionar_asistencias).
3. WHEN el usuario envía el Formulario_Modal de nuevo rol con datos válidos, THE Módulo_Configuración SHALL insertar el registro en la tabla `roles` y actualizar la Tabla_Listado.
4. IF el usuario envía el Formulario_Modal de nuevo rol con un nombre que ya existe en la tabla `roles`, THEN THE Formulario_Modal SHALL mostrar un mensaje de error indicando que el nombre de rol ya está registrado.
5. WHEN el usuario hace clic en el botón editar de un rol, THE Módulo_Configuración SHALL abrir el Formulario_Modal precargado con los datos actuales del rol.
6. WHEN el usuario envía el Formulario_Modal de edición de rol con datos válidos, THE Módulo_Configuración SHALL actualizar el registro en la tabla `roles` y refrescar la Tabla_Listado.
7. IF el usuario intenta eliminar un rol que tiene empleados asignados, THEN THE Módulo_Configuración SHALL mostrar un mensaje de advertencia indicando que el rol no puede eliminarse porque tiene empleados asociados.

### Requirement 5: Ajustes Generales por Sucursal

**User Story:** Como administrador del gimnasio, quiero configurar ajustes generales por sucursal como la capacidad máxima de aforo, para que el sistema use valores dinámicos en lugar de constantes hardcodeadas.

#### Acceptance Criteria

1. WHEN la pestaña Ajustes está activa, THE Módulo_Configuración SHALL mostrar un selector de sucursal y los ajustes configurables para la sucursal seleccionada.
2. WHEN el usuario selecciona una sucursal en el selector, THE Módulo_Configuración SHALL cargar y mostrar los ajustes actuales de la sucursal seleccionada: capacidad máxima de aforo, zona horaria (valor fijo: America/La_Paz) y moneda predeterminada (valor fijo: BOB).
3. WHEN el usuario modifica la capacidad máxima de aforo e ingresa un valor numérico mayor a 0, THE Módulo_Configuración SHALL guardar el nuevo valor en la base de datos asociado a la sucursal seleccionada.
4. IF el usuario ingresa un valor de capacidad menor o igual a 0, THEN THE Módulo_Configuración SHALL mostrar un mensaje de validación indicando que la capacidad debe ser mayor a 0.
5. WHEN los ajustes se guardan exitosamente, THE Módulo_Configuración SHALL mostrar una notificación de confirmación en español.
6. THE Módulo_Configuración SHALL mostrar la zona horaria (America/La_Paz) y la moneda predeterminada (BOB) como campos de solo lectura informativos.

### Requirement 6: Reemplazo de Constantes Hardcodeadas

**User Story:** Como desarrollador, quiero que el Dashboard y otros módulos lean la capacidad y sucursal desde la base de datos, para eliminar las constantes hardcodeadas SUCURSAL_ID y CAPACITY.

#### Acceptance Criteria

1. WHEN el Dashboard carga, THE Dashboard SHALL obtener la capacidad máxima de aforo desde la configuración de la sucursal en la base de datos en lugar de usar la constante CAPACITY = 50.
2. WHEN el Dashboard carga, THE Dashboard SHALL obtener el identificador de sucursal desde la configuración del sistema en lugar de usar la constante SUCURSAL_ID = 1.
3. WHILE no exista una sucursal configurada en la base de datos, THE Dashboard SHALL usar los valores por defecto: SUCURSAL_ID = 1 y capacidad = 50.
4. WHEN la capacidad de una sucursal se actualiza en Ajustes Generales, THE Dashboard SHALL reflejar el nuevo valor de capacidad en el widget de aforo sin necesidad de despliegue de código.

### Requirement 7: Registro de Auditoría

**User Story:** Como administrador del gimnasio, quiero que todas las operaciones de configuración queden registradas, para poder auditar los cambios realizados en el sistema.

#### Acceptance Criteria

1. WHEN se crea, edita o cambia el estado de una sucursal, THE Módulo_Configuración SHALL insertar un registro en la tabla `logs_sistema` con la tabla afectada ("sucursales"), el tipo de operación, el valor anterior y el valor nuevo.
2. WHEN se crea, edita o cambia el estado de un empleado, THE Módulo_Configuración SHALL insertar un registro en la tabla `logs_sistema` con la tabla afectada ("empleados"), el tipo de operación, el valor anterior y el valor nuevo.
3. WHEN se crea o edita un rol, THE Módulo_Configuración SHALL insertar un registro en la tabla `logs_sistema` con la tabla afectada ("roles"), el tipo de operación, el valor anterior y el valor nuevo.
4. THE Módulo_Configuración SHALL excluir campos sensibles (password_hash) del valor registrado en `logs_sistema`.

### Requirement 8: Esquema de Base de Datos para Capacidad por Sucursal

**User Story:** Como desarrollador, quiero almacenar la capacidad máxima por sucursal en la base de datos, para que cada sede pueda tener su propia configuración de aforo.

#### Acceptance Criteria

1. THE Base_de_Datos SHALL incluir una columna `capacidad_maxima` de tipo entero en la tabla `sucursales` con un valor por defecto de 50.
2. THE Base_de_Datos SHALL aplicar una restricción CHECK que asegure que `capacidad_maxima` sea mayor a 0.
3. WHEN se crea una nueva sucursal sin especificar capacidad, THE Base_de_Datos SHALL asignar el valor por defecto de 50 a la columna `capacidad_maxima`.
