# Requisitos del Sistema - Body Xtreme Gym OS

Sistema de Inteligencia de Negocios con Análisis Predictivo y Prescriptivo para la Gestión Estratégica y Retención de Clientes en Gimnasios Multisucursal

---

## 5.2.1. Requisitos Funcionales

Los requisitos funcionales son los siguientes:

| N | Requisitos Funcionales | Descripción |
|---|------------------------|-------------|
| **1** | **Gestión de Usuarios y Roles** | Altas, bajas, modificaciones de cuentas de empleados con asignación de roles (Administrador, Recepcionista, Gerencia). Autenticación con email y contraseña hasheada (SHA-256). |
| **2** | **Registro de Socios** | Altas, bajas, modificaciones, almacenar información detallada de los socios, incluyendo datos personales (CI, nombre, apellido, fecha de nacimiento, género, WhatsApp, nacionalidad). |
| **3** | **Gestión de Planes de Membresía** | Crear, editar, activar y desactivar planes de membresía con diferentes duraciones, precios y permisos de acceso multisucursal. |
| **4** | **Registro de Pagos y Facturación** | Generar pagos de suscripciones, gestionar múltiples métodos de pago (efectivo, QR, transferencia, criptomoneda) y generar facturas fiscales según normativa Bolivia SIN con código QR. |
| **5** | **Control de Asistencias** | Registrar entrada y salida de socios con validación de suscripción activa, asignación automática de casilleros y cálculo de aforo en tiempo real. |
| **6** | **Gestión de Casilleros** | Administrar casilleros por sucursal con estados (libre, ocupado, mantenimiento), asignación automática al ingreso y liberación al egreso. |
| **7** | **Cierre de Caja Diario** | Realizar cierre de caja diario por sucursal, comparar efectivo físico vs sistema, detectar diferencias y generar reportes de cierres. |
| **8** | **Análisis Descriptivo (BI)** | Visualizar KPIs ejecutivos (ingresos, retención, ARPU), generar gráficos de ingresos mensuales, distribución por plan, mapa de calor de asistencias y análisis demográfico. |
| **9** | **Análisis Predictivo** | Implementar 3 modelos de pronóstico de ingresos (Regresión Lineal, Media Móvil Ponderada, Suavizado Exponencial de Holt) con proyección a 3 meses. |
| **10** | **Análisis Prescriptivo** | Generar insights automáticos con recomendaciones accionables (alertas de caída de ingresos, socios en riesgo, oportunidades de hora valle) con links directos a módulos. |
| **11** | **Identificación de Socios en Riesgo** | Calcular score de riesgo de churn (0-100 puntos) basado en días para vencer, asistencias y días sin visita. Segmentar en 4 categorías (baja asistencia, no renovaron, racha perdida, próximos a vencer). |
| **12** | **Retención de Clientes** | Enviar mensajes personalizados de retención por WhatsApp a socios en riesgo con templates predefinidos por segmento. |
| **13** | **Campañas de Marketing** | Crear y enviar campañas masivas de WhatsApp con filtros de audiencia (género, antigüedad, estado, país), adjuntar imágenes/PDFs y mostrar progreso en tiempo real. |
| **14** | **Integración WhatsApp** | Conectar con WhatsApp Web via Baileys, autenticación por QR, envío de mensajes de texto y multimedia con delay de 800ms entre envíos. |
| **15** | **Análisis de Cohortes** | Generar tabla heatmap de retención por mes de inscripción mostrando porcentaje de socios activos en meses posteriores. |
| **16** | **Detección de Hora Valle** | Identificar automáticamente horas de baja asistencia (valle < pico * 40%) y generar insight con sugerencia de campaña promocional. |
| **17** | **Reportes PDF** | Generar 3 tipos de reportes en PDF: BI completo (2 páginas), comparativo multisucursal y cierre mensual con gráficos y métricas. |
| **18** | **Gestión de Sucursales** | Administrar múltiples sucursales con datos fiscales independientes (NIT, razón social, CUF), capacidad máxima configurable y estado activo/inactivo. |
| **19** | **Auditoría del Sistema** | Registrar automáticamente todas las operaciones (INSERT, UPDATE, DELETE, LOGIN, LOGOUT) con valor anterior y nuevo en formato JSON, IP y user agent. |
| **20** | **Dashboard Ejecutivo** | Mostrar vista operativa (aforo, entradas del día, socios en riesgo, cumpleaños) y vista financiera (ingresos, pagos recientes, planes más vendidos). |
| **21** | **Selector de Sucursal** | Permitir a Administradores ver datos de una sucursal específica o todas las sucursales consolidadas en módulos con filtro. |
| **22** | **Aforo en Tiempo Real** | Calcular y mostrar aforo actual por sucursal usando Supabase Realtime con actualización automática en todos los clientes conectados. |
| **23** | **Historial de Asistencias** | Consultar historial completo de asistencias con estadísticas (total entradas, promedio diario, hora pico, racha de asistencia por socio). |
| **24** | **Configuración de Facturación** | Configurar datos fiscales por sucursal (NIT emisor, razón social, CUF) según normativa Bolivia SIN. |
| **25** | **Métricas Financieras Avanzadas** | Calcular ARPU (Average Revenue Per User), LTV estimado (Lifetime Value) y ticket promedio por método de pago. |

**Tabla 1.** Requisitos funcionales.  
**Fuente:** Elaboración propia.

---

## 5.2.2. Requisitos No Funcionales

Los requisitos no funcionales son los siguientes:

| N | Requisitos No Funcionales | Descripción |
|---|---------------------------|-------------|
| **1** | **Usabilidad** | La interfaz debe ser intuitiva y fácil de usar, con diseño dark mode exclusivo, navegación clara mediante sidebar y feedback visual inmediato en todas las operaciones. |
| **2** | **Rendimiento** | El sistema debe cargar el dashboard principal en menos de 2 segundos. Las consultas de BI deben ejecutarse en menos de 5 segundos para períodos de hasta 12 meses. |
| **3** | **Disponibilidad** | El sistema debe estar disponible 24/7 con un uptime mínimo del 99.5%. La base de datos en Supabase Cloud garantiza alta disponibilidad. |
| **4** | **Escalabilidad** | El sistema debe soportar hasta 10 sucursales simultáneas, 100 empleados activos, 10,000 socios registrados y 50,000 asistencias mensuales sin degradación de rendimiento. |
| **5** | **Seguridad - Autenticación** | Las contraseñas deben almacenarse hasheadas con SHA-256. Las sesiones deben almacenarse en localStorage con validación en cada operación. |
| **6** | **Seguridad - Autorización** | El sistema debe implementar control de acceso basado en roles (RBAC) con 3 niveles: Administrador (acceso total), Recepcionista (operaciones diarias), Gerencia (solo lectura de BI). |
| **7** | **Seguridad - Auditoría** | Todas las operaciones críticas (pagos, cambios de configuración, login/logout) deben registrarse en logs_sistema con timestamp, empleado, IP y valores antes/después. |
| **8** | **Integridad de Datos** | El sistema debe usar transacciones de base de datos (BEGIN/COMMIT/ROLLBACK) para operaciones críticas como registro de pagos para garantizar consistencia. |
| **9** | **Respaldo de Datos** | Supabase debe realizar backups automáticos diarios de la base de datos con retención de 7 días. |
| **10** | **Compatibilidad** | El sistema debe ser compatible con navegadores modernos (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+) y dispositivos móviles/tablets. |
| **11** | **Responsividad** | La interfaz debe ser responsive y adaptarse a diferentes tamaños de pantalla (desktop, tablet, móvil) manteniendo funcionalidad completa. |
| **12** | **Tiempo Real** | El aforo debe actualizarse en tiempo real (< 1 segundo) en todos los clientes conectados usando Supabase Realtime con WebSockets. |
| **13** | **Concurrencia** | El sistema debe soportar hasta 50 usuarios concurrentes sin conflictos de datos ni pérdida de información. |
| **14** | **Mantenibilidad** | El código debe estar organizado en módulos por funcionalidad, usar TypeScript para type safety y seguir convenciones de Next.js App Router. |
| **15** | **Portabilidad** | El sistema debe ser una PWA (Progressive Web App) instalable en dispositivos móviles y tablets con modo standalone. |
| **16** | **Accesibilidad** | La interfaz debe cumplir con estándares básicos de accesibilidad (contraste de colores, tamaño de fuente legible, navegación por teclado). |
| **17** | **Tolerancia a Fallos** | El sistema debe manejar errores de red, timeouts de base de datos y fallos de WhatsApp con mensajes claros al usuario y reintentos automáticos. |
| **18** | **Validación de Datos** | Todos los formularios deben validar datos en el cliente antes de enviar (formato de CI, email, WhatsApp, fechas, montos positivos). |
| **19** | **Internacionalización** | El sistema debe soportar formato de moneda boliviana (BOB), zona horaria America/La_Paz y formato de fecha DD/MM/YYYY. |
| **20** | **Cumplimiento Legal** | Las facturas deben cumplir con la normativa del SIN (Servicio de Impuestos Nacionales) de Bolivia incluyendo CUF, QR de verificación y leyenda obligatoria. |
| **21** | **Optimización de Consultas** | Las consultas de base de datos deben usar índices apropiados para búsquedas frecuentes (socios por CI, asistencias por fecha, pagos por sucursal). |
| **22** | **Caché de Datos** | Los datos de configuración (sucursales, roles, planes) deben cachearse en el cliente para reducir consultas a la base de datos. |
| **23** | **Límite de Envíos WhatsApp** | El sistema debe implementar delay de 800ms entre envíos de WhatsApp para evitar bloqueos por spam. |
| **24** | **Notificaciones Visuales** | El sistema debe mostrar toasts de confirmación/error con auto-dismiss de 2.5 segundos para todas las operaciones. |
| **25** | **Documentación** | El sistema debe incluir documentación técnica completa (diagramas UML, ERD, descripción de módulos, guías de uso). |

**Tabla 2.** Requisitos no funcionales.  
**Fuente:** Elaboración propia.

---

## 5.2.3. Matriz de Trazabilidad Requisitos-Módulos

| Módulo | Requisitos Funcionales | Requisitos No Funcionales |
|--------|------------------------|---------------------------|
| **Login** | RF-1 | RNF-5, RNF-6, RNF-7 |
| **Dashboard** | RF-20 | RNF-1, RNF-2, RNF-11 |
| **Recepción** | RF-5, RF-22 | RNF-12, RNF-13 |
| **Asistencias** | RF-5, RF-23 | RNF-2, RNF-21 |
| **Casilleros** | RF-6 | RNF-1, RNF-18 |
| **Socios** | RF-2 | RNF-18, RNF-22 |
| **Planes** | RF-3 | RNF-18 |
| **Pagos** | RF-4, RF-24 | RNF-8, RNF-20 |
| **Caja** | RF-7 | RNF-8, RNF-18 |
| **Retención** | RF-11, RF-12 | RNF-2, RNF-23 |
| **Campañas** | RF-13, RF-14 | RNF-17, RNF-23 |
| **BI & Analytics** | RF-8, RF-9, RF-10, RF-15, RF-16, RF-17, RF-25 | RNF-2, RNF-4, RNF-21 |
| **Configuración** | RF-18, RF-24 | RNF-7, RNF-18 |
| **Auditoría** | RF-19 | RNF-7, RNF-9 |

---

## 5.2.4. Priorización de Requisitos (Método MoSCoW)

### **Must Have (Debe tener) - Prioridad Alta**
- RF-1, RF-2, RF-4, RF-5: Gestión básica de usuarios, socios, pagos y asistencias
- RF-20, RF-22: Dashboard y aforo en tiempo real
- RNF-5, RNF-6, RNF-7: Seguridad (autenticación, autorización, auditoría)
- RNF-8: Integridad de datos con transacciones

### **Should Have (Debería tener) - Prioridad Media**
- RF-8, RF-11, RF-12: BI descriptivo y retención de clientes
- RF-7, RF-19: Cierre de caja y auditoría
- RNF-2, RNF-12: Rendimiento y tiempo real
- RNF-20: Cumplimiento legal (facturación Bolivia)

### **Could Have (Podría tener) - Prioridad Baja**
- RF-9, RF-10: Análisis predictivo y prescriptivo
- RF-13, RF-14: Campañas de marketing y WhatsApp
- RF-15, RF-16: Análisis de cohortes y hora valle
- RNF-15: PWA instalable

### **Won't Have (No tendrá) - Fuera de Alcance**
- Integración con sistemas de pago online (tarjetas de crédito)
- Módulo de entrenadores y rutinas personalizadas
- App móvil nativa (iOS/Android)
- Integración con dispositivos biométricos (huella digital)

---

## 5.2.5. Resumen de Requisitos

| Categoría | Cantidad |
|-----------|----------|
| **Requisitos Funcionales** | 25 |
| **Requisitos No Funcionales** | 25 |
| **Total de Requisitos** | 50 |

**Distribución por Tipo:**
- **Funcionales de Gestión**: 7 (RF-1 a RF-7)
- **Funcionales de BI**: 10 (RF-8 a RF-17)
- **Funcionales de Retención**: 3 (RF-11 a RF-13)
- **Funcionales de Configuración**: 5 (RF-18, RF-19, RF-21, RF-24, RF-25)

**Distribución No Funcionales:**
- **Usabilidad**: 3 (RNF-1, RNF-11, RNF-24)
- **Rendimiento**: 4 (RNF-2, RNF-12, RNF-21, RNF-22)
- **Seguridad**: 4 (RNF-5, RNF-6, RNF-7, RNF-8)
- **Disponibilidad**: 2 (RNF-3, RNF-9)
- **Escalabilidad**: 2 (RNF-4, RNF-13)
- **Compatibilidad**: 4 (RNF-10, RNF-15, RNF-16, RNF-19)
- **Otros**: 6 (RNF-14, RNF-17, RNF-18, RNF-20, RNF-23, RNF-25)

---

**Fecha de creación:** 2026-05-08  
**Versión:** 1.0  
**Autor:** Sistema Body Xtreme Gym OS
