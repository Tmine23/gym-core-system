---
name: gym-core-system
description: Instrucciones maestras para el desarrollo del CRM Body Xtreme Gym (Socios, Planes, Pagos y Recepción).
---

# Body Xtreme Gym OS - Core Skill

Este es el manual de procedimientos para el Agente de Cursor en este proyecto.

## When to Use
- Siempre que se trabaje en el directorio `/app` o `/components`.
- Al realizar cambios en el esquema de base de datos de Supabase.
- Al implementar lógica de negocios sobre planes, monedas (Bs/$) o socios.

## Instructions

### 1. Estética y UI (Identidad Visual)
- **Modo:** Siempre Dark Mode (`#020617`).
- **Marca:** El color principal es `#76CB3E`. Úsalo en botones, bordes de inputs activos y badges de "Activo".
- Siempre busca usar buenas practicas de UI/UX desinng y aplica animaciones y validaciones de manera visualmente atractiva al usuario
- **Librerías:** Priorizar componentes de **Tremor** y **Tailwind CSS**.

### 2. Base de Datos y Tipos
- **Naming:** `snake_case` para todo en Supabase.
- **Manejo de Moneda:** Soporte para multimoneda. Columna `precio` (decimal) y `moneda` (VARCHAR 3, default 'BOB').
- **WhatsApp:** Prefijo automático `+591`.
- revisa siempre el esquema de las tablas y los campos para que no haya conflicto al crear un nuevo modulo.

### 3. Flujos de Trabajo (Workflows)
- **Registro de Socios:** Validar CI y WhatsApp. Mapear género (UI: Texto -> DB: M/F/U/O).
- **Módulo de Planes:** Calcular fechas de vencimiento automáticamente al registrar un pago.
- **Recepción:** Optimizar la búsqueda por CI para que sea el primer campo enfocado.

## Best Practices
- Usar `suppressHydrationWarning` en `layout.tsx`.
- Mantener los componentes pequeños y reutilizables en `/components/ui`.
- Antes de ejecutar un `INSERT` en Supabase, verifica los campos con la tabla real del usuario.
- **Soft delete only:** no eliminar registros de negocio (`DELETE`). Usar campos de estado como `activo` / `es_activo` para activar o desactivar y preservar auditoría.