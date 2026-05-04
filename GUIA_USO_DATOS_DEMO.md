# Guía de Uso de Datos Demostrativos

## 🎯 Objetivo

Los datos demostrativos han sido poblados exitosamente en tu sistema Body Xtreme Gym OS. Esta guía te ayudará a aprovechar al máximo estos datos para tu proyecto de grado y demostraciones.

---

## ✅ Estado Actual del Sistema

### Datos Poblados
- ✅ **651 socios** con perfiles realistas
- ✅ **1,888 suscripciones** con diferentes estados
- ✅ **1,356 pagos** distribuidos en 6 meses
- ✅ **933 facturas** con datos fiscales
- ✅ **11,516 asistencias** con patrones variados
- ✅ **173 cierres de caja** históricos

### Período Cubierto
- **Desde**: Octubre 2025
- **Hasta**: Abril 2026
- **Duración**: 6 meses de historial completo

---

## 📊 Módulos Listos para Demostración

### 1. Dashboard (app/page.tsx)
**Qué verás:**
- Aforo en tiempo real de cada sucursal
- Ingresos del día y del mes
- Socios en riesgo identificados
- Gráficos de tendencias de los últimos 7 días
- Planes más vendidos

**Cómo demostrarlo:**
1. Inicia sesión como Admin
2. Selecciona "Todas las sucursales" para ver datos consolidados
3. Cambia entre las pestañas "Operativo" y "Financiero"
4. Muestra los KPIs con sparklines de tendencia

### 2. Módulo de Retención (app/retencion/page.tsx)
**Qué verás:**
- **51+ socios** con baja asistencia
- **628 socios** que no renovaron
- **12 socios** próximos a vencer
- **5 socios** con racha perdida

**Cómo demostrarlo:**
1. Ve al módulo de Retención
2. Explica cada segmento de riesgo:
   - 🔴 **Baja asistencia**: Suscritos que casi no vienen
   - 🔴 **No renovaron**: Suscripción vencida sin renovar
   - 🟡 **Próximos a vencer**: Suscripción vence en 7 días
   - 🟡 **Racha perdida**: Venían bien pero pararon
3. Muestra el score de riesgo (0-100)
4. Demuestra el envío de mensajes WhatsApp personalizados

### 3. BI & Analytics (app/analytics/page.tsx)
**Análisis Descriptivo:**
- KPIs ejecutivos con tendencias de 6 meses
- Gráfico de ingresos mensuales (oct 2025 - abr 2026)
- Tasa de retención mensual
- Distribución por plan de membresía
- Mapa de calor de asistencias por hora/día

**Análisis Predictivo:**
- Pronóstico de ingresos a 3 meses con 3 modelos:
  1. Regresión Lineal
  2. Media Móvil Ponderada (WMA)
  3. Suavizado Exponencial de Holt

**Análisis Prescriptivo:**
- Insights automáticos generados
- Alertas de caída de ingresos
- Acciones sugeridas para retención
- Oportunidades identificadas

**Cómo demostrarlo:**
1. Selecciona "Últimos 6 meses" en el selector de período
2. Muestra cada sección explicando las 3 capas de BI
3. Genera el reporte PDF completo
4. Si eres Admin, selecciona "Todas las sucursales" para ver el análisis comparativo

### 4. Módulo de Pagos (app/pagos/page.tsx)
**Qué verás:**
- Historial de 1,356 pagos
- Distribución por método de pago
- Facturas generadas automáticamente

**Cómo demostrarlo:**
1. Muestra el historial de pagos con filtros
2. Selecciona un pago y genera la factura PDF
3. Explica el formato de factura boliviana (SIN)
4. Muestra los diferentes métodos de pago

### 5. Módulo de Asistencias (app/asistencias/page.tsx)
**Qué verás:**
- 11,516 asistencias históricas
- Estadísticas de frecuencia
- Rachas de asistencia por socio
- Hora pico identificada

**Cómo demostrarlo:**
1. Muestra el historial completo
2. Filtra por un socio específico para ver su racha
3. Muestra las estadísticas generales
4. Explica los diferentes patrones de asistencia

### 6. Módulo de Caja (app/caja/page.tsx)
**Qué verás:**
- 173 cierres de caja históricos
- Comparación sistema vs efectivo físico
- Gráfico de tendencia de cierres

**Cómo demostrarlo:**
1. Selecciona una sucursal
2. Muestra el resumen del día
3. Registra un nuevo cierre de caja
4. Muestra el historial con filtros por período

---

## 🎓 Puntos Clave para tu Proyecto de Grado

### 1. Sistema de Inteligencia de Negocios
**Tesis:** "Sistema de Inteligencia de Negocios con Análisis Predictivo y Prescriptivo para la Gestión Estratégica y Retención de Clientes en Gimnasios Multisucursal"

**Demuestra:**
- ✅ **Capa Descriptiva**: KPIs, métricas, visualizaciones
- ✅ **Capa Predictiva**: 3 modelos de pronóstico implementados
- ✅ **Capa Prescriptiva**: Motor de insights automático

### 2. Módulo de Retención
**Demuestra:**
- ✅ Identificación automática de socios en riesgo
- ✅ Segmentación por tipo de riesgo
- ✅ Score de riesgo calculado (0-100)
- ✅ Integración con WhatsApp para acciones

### 3. Sistema Multisucursal
**Demuestra:**
- ✅ Gestión de 3 sucursales simultáneas
- ✅ Análisis comparativo entre sucursales
- ✅ Consolidación de métricas
- ✅ Control de acceso por rol

### 4. Análisis Avanzado
**Demuestra:**
- ✅ Análisis de cohortes (retención por mes de inscripción)
- ✅ Segmentación demográfica (género, edad)
- ✅ Frecuencia de asistencia correlacionada con renovación
- ✅ Métricas financieras (ARPU, LTV)

---

## 🚀 Escenarios de Demostración

### Escenario 1: Gerente revisando el dashboard
**Narrativa:** "Es lunes por la mañana y el gerente quiere ver cómo fue el fin de semana"

1. Login como Admin
2. Dashboard → Pestaña "Operativo"
3. Muestra el aforo actual
4. Muestra las entradas del día
5. Dashboard → Pestaña "Financiero"
6. Muestra los ingresos del fin de semana

### Escenario 2: Identificando socios en riesgo
**Narrativa:** "El gerente quiere reducir el churn y retener más clientes"

1. Ve a Retención
2. Muestra los 4 segmentos de riesgo
3. Selecciona "Baja asistencia"
4. Ordena por score de riesgo (mayor a menor)
5. Selecciona los de mayor riesgo
6. Envía mensaje WhatsApp personalizado

### Escenario 3: Análisis de tendencias y pronóstico
**Narrativa:** "El gerente quiere proyectar ingresos para el próximo trimestre"

1. Ve a BI & Analytics
2. Selecciona "Últimos 6 meses"
3. Muestra el gráfico de ingresos mensuales
4. Explica la tendencia observada
5. Muestra la sección de Análisis Predictivo
6. Explica los 3 modelos de pronóstico
7. Muestra las proyecciones a 3 meses

### Escenario 4: Comparativa multisucursal
**Narrativa:** "El gerente quiere saber qué sucursal está rindiendo mejor"

1. Ve a BI & Analytics
2. Selecciona "Todas las sucursales"
3. Muestra las tarjetas comparativas
4. Muestra el gráfico de barras comparativo
5. Genera el reporte comparativo PDF
6. Identifica la sucursal con mejor performance

### Escenario 5: Análisis de cohortes
**Narrativa:** "El gerente quiere saber qué tan bien retienen a los socios inscritos en cada mes"

1. Ve a BI & Analytics
2. Scroll hasta "Análisis de Cohortes"
3. Explica la tabla heatmap
4. Identifica los meses con mejor retención
5. Identifica los meses con peor retención
6. Sugiere acciones basadas en los insights

---

## 📈 Métricas Clave para Destacar

### Métricas Operativas
- **Aforo en tiempo real**: Capacidad utilizada por sucursal
- **Tasa de asistencia**: Promedio de visitas por socio
- **Hora pico**: Momento de mayor afluencia

### Métricas Financieras
- **Ingresos mensuales**: Tendencia de 6 meses
- **ARPU** (Average Revenue Per User): Ingreso promedio por socio
- **LTV** (Lifetime Value): Valor de vida del cliente
- **Ticket promedio**: Por método de pago

### Métricas de Retención
- **Tasa de retención**: % de socios que renuevan
- **Churn rate**: % de socios que abandonan
- **Score de riesgo**: Probabilidad de abandono (0-100)
- **Socios en riesgo**: Por segmento

---

## 🔧 Comandos Útiles

### Ejecutar el script de población (si necesitas más datos)
```bash
node scripts/seed-demo-data.mjs
```

### Verificar el estado de los datos
```bash
node scripts/verificar-datos-demo.mjs
```

### Iniciar el servidor de desarrollo
```bash
npm run dev
```

### Generar reportes PDF
1. Ve a BI & Analytics
2. Haz clic en "Descargar Reporte PDF"
3. Selecciona el tipo de reporte:
   - Reporte BI Completo
   - Reporte Comparativo Multisucursal
   - Reporte de Cierre Mensual

---

## 💡 Tips para la Presentación

### 1. Prepara el ambiente
- ✅ Asegúrate de tener conexión a internet (Supabase en la nube)
- ✅ Abre el sistema en pantalla completa
- ✅ Ten preparados los escenarios de demostración
- ✅ Genera los PDFs con anticipación por si hay problemas de conexión

### 2. Estructura de la presentación
1. **Introducción** (5 min)
   - Problema: Gimnasios pierden clientes por falta de seguimiento
   - Solución: Sistema de BI con retención predictiva

2. **Demostración del sistema** (15 min)
   - Dashboard ejecutivo
   - Módulo de retención (punto fuerte)
   - BI & Analytics (3 capas)
   - Análisis multisucursal

3. **Resultados y métricas** (5 min)
   - Muestra los datos históricos
   - Explica los modelos predictivos
   - Muestra los insights generados

4. **Conclusiones** (5 min)
   - Beneficios para el gimnasio
   - Escalabilidad del sistema
   - Trabajo futuro

### 3. Preguntas frecuentes preparadas
**P: ¿Cómo se calculan los modelos predictivos?**
R: Implementamos 3 modelos: Regresión Lineal (tendencia general), Media Móvil Ponderada (suaviza picos), y Suavizado Exponencial de Holt (captura nivel + tendencia).

**P: ¿Cómo se identifica a los socios en riesgo?**
R: Usamos un score de 0-100 basado en 3 variables: días para vencer suscripción (40pts), asistencias en 30 días (35pts), y días sin visita (25pts).

**P: ¿El sistema es escalable?**
R: Sí, está diseñado para múltiples sucursales. Actualmente maneja 3 sucursales con 651 socios y 11,516 asistencias sin problemas de performance.

**P: ¿Qué tecnologías usaste?**
R: Next.js 16 (React 19), TypeScript, Supabase (PostgreSQL), Tailwind CSS, Recharts para gráficos, y Baileys para WhatsApp.

---

## 🎯 Checklist Pre-Presentación

- [ ] Verificar que el servidor de desarrollo está corriendo
- [ ] Verificar conexión a Supabase
- [ ] Probar login con usuario Admin
- [ ] Verificar que todos los módulos cargan correctamente
- [ ] Generar PDFs de ejemplo
- [ ] Preparar escenarios de demostración
- [ ] Tener backup de los datos (por si acaso)
- [ ] Preparar respuestas a preguntas frecuentes

---

## 📞 Soporte

Si encuentras algún problema con los datos o el sistema:

1. **Verificar datos**: Ejecuta `node scripts/verificar-datos-demo.mjs`
2. **Revisar logs**: Verifica la consola del navegador (F12)
3. **Regenerar datos**: Ejecuta `node scripts/seed-demo-data.mjs` nuevamente

---

## ✨ ¡Éxito en tu Presentación!

Tienes un sistema completo y funcional con datos realistas que demuestran todas las capacidades de tu proyecto de grado. Los datos están diseñados específicamente para mostrar:

- ✅ Casos de uso reales
- ✅ Patrones de comportamiento variados
- ✅ Escenarios de riesgo identificables
- ✅ Tendencias y proyecciones calculables
- ✅ Análisis multisucursal comparativo

**¡Mucha suerte con tu proyecto de grado!** 🎓🚀
