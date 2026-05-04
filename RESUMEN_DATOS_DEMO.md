# Resumen de Población de Datos Demostrativos

## ✅ Ejecución Completada Exitosamente

Se ha poblado la base de datos con datos demostrativos realistas para el sistema Body Xtreme Gym OS, cubriendo el período desde **octubre 2025 hasta abril 2026** (6 meses de historial).

---

## 📊 Datos Creados

### Socios
- **Total de socios**: 651
- **Socios suscritos**: 352 (54%)
- **Rango de fechas**: 2025-10-01 a 2026-05-04
- **Distribución**: Nombres y apellidos bolivianos, CIs válidos, WhatsApp bolivianos
- **Géneros**: Distribución equilibrada entre M/F
- **Edades**: Rango de 18 a 46 años

### Suscripciones
- **Total de suscripciones**: 1,888
- **Suscripciones activas**: 515
- **Estados**:
  - ACTIVA: Suscripciones vigentes
  - VENCIDA: Suscripciones que no renovaron
  - CANCELADA: Suscripciones canceladas
- **Rango de fechas**: 2024-10-01 a 2027-05-04
- **Distribución**: Múltiples suscripciones por socio (renovaciones históricas)

### Pagos
- **Total de pagos**: 1,356
- **Ingresos totales**: BOB 861,522
- **Rango de fechas**: 2025-04-01 a 2026-05-06
- **Métodos de pago**:
  - Efectivo
  - QR Libélula
  - Transferencia
  - Criptomoneda
- **Distribución mensual** (oct 2025 - abr 2026):
  - 2025-10: 73 pagos (BOB 41,242)
  - 2025-11: 81 pagos (BOB 51,691)
  - 2025-12: 82 pagos (BOB 43,151)
  - 2026-01: 104 pagos (BOB 71,948)
  - 2026-02: 103 pagos (BOB 76,833)
  - 2026-03: 108 pagos (BOB 71,267)
  - 2026-04: 108 pagos (BOB 57,296)

### Facturas
- **Total de facturas**: 933
- **Rango de fechas**: 2025-10-02 a 2026-05-06
- **Cobertura**: ~80% de los pagos tienen factura asociada
- **Datos fiscales**: NIT/CI, razón social, CUFD, código de autorización

### Asistencias
- **Total de asistencias**: 11,516
- **Socios únicos con asistencias**: 417
- **Rango de fechas**: 2025-04-10 a 2026-05-20
- **Horarios**: Distribuidos entre 6:00 AM y 10:00 PM
- **Duración promedio**: 45 minutos a 2 horas

### Cierres de Caja
- **Total de cierres**: 173
- **Total efectivo BOB**: BOB 328,061
- **Rango de fechas**: 2025-10-04 a 2026-05-06
- **Cobertura**: Un cierre por día con pagos en cada sucursal
- **Diferencias**: Simuladas pequeñas diferencias (±5%) entre sistema y efectivo físico

---

## 🎯 Patrones de Asistencia Implementados

Se crearon diferentes perfiles de socios para que el módulo de retención y BI sean representativos:

### Clasificación por Frecuencia de Asistencia
1. **Ocasionales (1-19 visitas)**: 218 socios (53%)
   - Vienen esporádicamente, 1-2 veces por semana

2. **Activos regulares (40-79 visitas)**: 71 socios (17%)
   - Vienen consistentemente 3-4 veces por semana

3. **Racha perdida (30+ días sin visita)**: 46 socios (11%)
   - Empezaron bien pero dejaron de venir hace más de 30 días
   - **CRÍTICO para módulo de retención**

4. **Moderados (20-39 visitas)**: 44 socios (11%)
   - Vienen 2-3 veces por semana

5. **Muy activos (80+ visitas)**: 34 socios (8%)
   - Vienen 5-6 veces por semana

---

## 🚨 Segmentos de Riesgo (Módulo de Retención)

El sistema ahora puede identificar correctamente los siguientes segmentos:

### 1. Baja Asistencia
- **Cantidad**: 261 socios
- **Criterio**: Suscritos con 0-2 visitas en los últimos 30 días
- **Acción sugerida**: Enviar mensaje motivacional

### 2. No Renovaron
- **Cantidad**: 34 socios
- **Criterio**: Suscripción vencida sin renovar
- **Acción sugerida**: Ofrecer promoción de renovación

### 3. Racha Perdida
- **Cantidad**: 10 socios
- **Criterio**: Venían regularmente pero pararon hace 10+ días
- **Acción sugerida**: Mensaje personalizado preguntando qué pasó

### 4. Próximos a Vencer
- **Cantidad**: 2 socios
- **Criterio**: Suscripción vence en 7 días o menos
- **Acción sugerida**: Recordatorio de renovación

### 5. Sin Riesgo
- **Cantidad**: 344 socios
- **Estado**: Asisten regularmente y tienen suscripción activa

---

## 📈 Beneficios para BI & Analytics

### Análisis Descriptivo
- ✅ Datos históricos de 6 meses para gráficos de tendencias
- ✅ Distribución realista de ingresos mensuales
- ✅ Patrones de asistencia por hora y día de la semana
- ✅ Distribución por planes de membresía
- ✅ Métricas de retención calculables

### Análisis Predictivo
- ✅ Suficientes datos para modelos de pronóstico (Regresión Lineal, WMA, Holt)
- ✅ Tendencias identificables en ingresos
- ✅ Patrones estacionales simulados

### Análisis Prescriptivo
- ✅ Insights automáticos sobre caída de ingresos
- ✅ Alertas de retención baja
- ✅ Identificación de socios en riesgo de churn
- ✅ Oportunidades de mejora (horas valle, etc.)

### Análisis de Cohortes
- ✅ Datos de inscripción distribuidos en 6 meses
- ✅ Seguimiento de retención por mes de inscripción
- ✅ Cálculo de LTV (Lifetime Value)

---

## 🏢 Distribución por Sucursal

Los datos están distribuidos equitativamente entre las 3 sucursales activas:
1. **Body Xtreme Gym - Central** (La Paz)
2. **Body Xtreme Gym - Sur** (La Paz)
3. **Body Xtreme Gym - Sopocachi** (La Paz)

Cada sucursal tiene:
- Socios inscritos
- Pagos registrados
- Asistencias históricas
- Cierres de caja diarios

---

## 🎓 Uso para Proyecto de Grado

Este conjunto de datos permite demostrar:

1. **Sistema de Inteligencia de Negocios completo**
   - Capa descriptiva con KPIs y métricas
   - Capa predictiva con modelos de pronóstico
   - Capa prescriptiva con insights automáticos

2. **Módulo de Retención efectivo**
   - Identificación de socios en riesgo
   - Segmentación automática
   - Cálculo de score de riesgo

3. **Análisis multisucursal**
   - Comparativas entre sucursales
   - Consolidación de métricas
   - Ranking de performance

4. **Reportes ejecutivos**
   - Datos suficientes para reportes PDF
   - Métricas financieras calculables
   - Análisis de cohortes visualizable

---

## 🔧 Script de Población

El script `scripts/seed-demo-data.mjs` puede ejecutarse múltiples veces de forma segura:
- Verifica datos existentes antes de insertar
- Evita duplicados de CI y WhatsApp
- Maneja errores de conexión con reintentos
- Inserta datos en lotes para mejor performance

### Ejecución:
```bash
node scripts/seed-demo-data.mjs
```

---

## ✨ Resultado Final

El sistema ahora tiene datos demostrativos realistas que permiten:
- ✅ Demostrar todas las funcionalidades del sistema
- ✅ Mostrar el módulo de retención en acción
- ✅ Generar reportes de BI con datos significativos
- ✅ Probar modelos predictivos con datos históricos
- ✅ Presentar el proyecto de grado con casos de uso reales

**Fecha de población**: 2026-05-04
**Período cubierto**: Octubre 2025 - Abril 2026 (6 meses)
**Estado**: ✅ Completado exitosamente
