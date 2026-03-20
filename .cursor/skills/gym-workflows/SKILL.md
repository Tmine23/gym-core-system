---
name: gym-workflows
description: Define la interacción de los roles (Socio, Recepcionista, Trainer) y la lógica de automatización de Body Xtreme Gym.
---

# 🔄 Flujos de Trabajo y Roles - Body Xtreme Gym

## When to Use
- Al programar el módulo de Recepción/Check-in.
- Al diseñar el sistema de Aforo en tiempo real.
- Al implementar las alertas de WhatsApp y lógica de retención.

## Roles e Interacciones

### 1. El Socio (Experiencia de Entrada/Salida)
- **Check-in:** Ingresa su CI (o huella a futuro). El sistema valida su plan.
- **Asignación:** Si está habilitado, el sistema le asigna un casillero disponible.
- **Check-out:** Marca salida. Esto libera el casillero y actualiza el **Aforo Actual**.
- **Valor Agregado:** El socio puede ver desde su cel (o pantalla) la "Predicción de Aforo" para decidir si ir ahora o más tarde.

### 2. El Recepcionista (Control y Validación)
- **Vista de Monitor:** Al marcar el socio, el recepcionista ve en grande: Foto, Nombre y Estado del Plan.
- **Gestión de Pagos:** Si el socio sale en Amarillo/Rojo, el recepcionista debe poder cobrar el plan en 2 clics.

### 3. El Trainer (Motivación y Mantenimiento)
- **Panel de Abandono:** Ve una lista de socios que no han venido en +4 días.
- **Acción:** Puede disparar mensajes de WhatsApp ("Te extrañamos, ven a entrenar con [Nombre Trainer]").
- **Estado del Gym:** El Trainer marca si una máquina está "Fuera de Servicio" para que el socio lo vea en la predicción de aforo.

## Lógica de Automatización (IA y Marketing)
- **Aforo Inteligente:** Guardar historial de `hora_entrada` y `hora_salida` para alimentar el modelo de predicción de horas pico.
- **Fidelización:** Si `días_sin_venir >= 4` -> Gatillar alerta de mensaje motivador.
- **Balance de Carga:** Si el sistema detecta "Hora Pico", sugerir al socio (vía notificación/pantalla) ir en horario concurrente bajo a cambio de algún beneficio o comodidad.

## Instructions para Cursor
- Al crear la tabla de `asistencias`, asegúrate de incluir `casillero_id` y `hora_salida` (nullable).
- La tabla de `maquinas` debe tener un estado `booleano` de disponibilidad.
- Siempre que trabajes en la UI de Recepción, prioriza la visibilidad de alertas de deuda.