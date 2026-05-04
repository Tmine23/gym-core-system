import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Utilidades
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (arr) => arr[randomInt(0, arr.length - 1)];
const randomFloat = (min, max) => Math.random() * (max - min) + min;

// Generar fecha aleatoria entre dos fechas
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Nombres y apellidos bolivianos
const nombresHombres = ['Juan', 'Carlos', 'Luis', 'Miguel', 'José', 'Pedro', 'Diego', 'Fernando', 'Roberto', 'Andrés', 'Javier', 'Ricardo', 'Daniel', 'Sergio', 'Alejandro', 'Raúl', 'Gustavo', 'Mauricio', 'Pablo', 'Rodrigo'];
const nombresMujeres = ['María', 'Ana', 'Carmen', 'Rosa', 'Patricia', 'Laura', 'Claudia', 'Gabriela', 'Daniela', 'Andrea', 'Verónica', 'Silvia', 'Mónica', 'Paola', 'Carla', 'Lucía', 'Fernanda', 'Valeria', 'Natalia', 'Isabel'];
const apellidos = ['García', 'Rodríguez', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes', 'Gutiérrez', 'Ortiz', 'Mendoza', 'Vargas', 'Castillo', 'Jiménez', 'Romero', 'Herrera', 'Medina'];

// Generar CI boliviano aleatorio
const generarCI = () => {
  const departamento = randomChoice(['LP', 'CB', 'SC', 'OR', 'PT', 'TJ', 'CH', 'BE', 'PD']);
  const numero = randomInt(1000000, 9999999);
  return `${numero}${departamento}`;
};

// Generar WhatsApp boliviano
const generarWhatsApp = () => {
  const prefijos = ['7', '6'];
  const prefijo = randomChoice(prefijos);
  const numero = randomInt(1000000, 9999999);
  return `591${prefijo}${numero}`;
};

console.log('🚀 Iniciando población de datos demostrativos...\n');

// Fechas de referencia
const fechaInicio = new Date('2025-10-01');
const fechaFin = new Date('2026-04-30');
const hoy = new Date('2026-05-04');

async function main() {
  try {
    // 1. Obtener datos existentes
    console.log('📊 Obteniendo datos existentes...');
    
    const { data: sucursales } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('esta_activa', true)
      .order('id');
    
    const { data: empleados } = await supabase
      .from('empleados')
      .select('id, sucursal_id')
      .eq('es_activo', true);
    
    const { data: planes } = await supabase
      .from('planes')
      .select('id, nombre, monto, duracion_dias, codigo_moneda')
      .eq('activo', true);
    
    const { data: sociosExistentes } = await supabase
      .from('socios')
      .select('id, ci');
    
    console.log(`✅ ${sucursales.length} sucursales activas`);
    console.log(`✅ ${empleados.length} empleados activos`);
    console.log(`✅ ${planes.length} planes activos`);
    console.log(`✅ ${sociosExistentes.length} socios existentes\n`);
    
    const cisExistentes = new Set(sociosExistentes.map(s => s.ci));
    
    // 2. Crear socios adicionales (150 socios más para tener ~200 total)
    console.log('👥 Creando socios adicionales...');
    const sociosNuevos = [];
    const targetSocios = 150;
    
    for (let i = 0; i < targetSocios; i++) {
      const genero = randomChoice(['M', 'F']);
      const nombre = genero === 'M' ? randomChoice(nombresHombres) : randomChoice(nombresMujeres);
      const apellido = randomChoice(apellidos);
      
      let ci = generarCI();
      while (cisExistentes.has(ci)) {
        ci = generarCI();
      }
      cisExistentes.add(ci);
      
      const fechaNacimiento = randomDate(new Date('1980-01-01'), new Date('2005-12-31'));
      const fechaRegistro = randomDate(fechaInicio, fechaFin);
      
      // 70% de probabilidad de estar suscrito
      const suscrito = Math.random() < 0.7;
      
      sociosNuevos.push({
        ci,
        nombre,
        apellido,
        fecha_nacimiento: fechaNacimiento.toISOString().split('T')[0],
        genero,
        whatsapp: generarWhatsApp(),
        es_activo: true,
        fecha_registro: fechaRegistro.toISOString(),
        suscrito,
        nacionalidad: 'BO',
        codigo_telefono: '591'
      });
    }
    
    const { data: sociosCreados, error: errorSocios } = await supabase
      .from('socios')
      .insert(sociosNuevos)
      .select('id, ci, nombre, apellido, fecha_registro, suscrito');
    
    if (errorSocios) {
      console.error('❌ Error creando socios:', errorSocios);
      throw errorSocios;
    }
    
    console.log(`✅ ${sociosCreados.length} socios creados\n`);
    
    // Combinar socios existentes y nuevos
    const todosSocios = [...sociosExistentes, ...sociosCreados];
    
    // 3. Crear suscripciones para todos los socios
    console.log('📝 Creando suscripciones...');
    const suscripciones = [];
    
    for (const socio of todosSocios) {
      const socioData = sociosCreados.find(s => s.id === socio.id) || { fecha_registro: new Date().toISOString(), suscrito: false };
      const fechaRegistroSocio = new Date(socioData.fecha_registro || socio.fecha_registro || fechaInicio);
      
      // Determinar cuántas suscripciones ha tenido este socio
      const numSuscripciones = socioData.suscrito ? randomInt(1, 4) : randomInt(0, 2);
      
      let fechaInicioSuscripcion = new Date(fechaRegistroSocio);
      
      for (let i = 0; i < numSuscripciones; i++) {
        const plan = randomChoice(planes);
        const sucursal = randomChoice(sucursales);
        const empleadosSucursal = empleados.filter(e => e.sucursal_id === sucursal.id);
        const empleado = empleadosSucursal.length > 0 ? randomChoice(empleadosSucursal) : randomChoice(empleados);
        
        const fechaFin = new Date(fechaInicioSuscripcion);
        fechaFin.setDate(fechaFin.getDate() + plan.duracion_dias);
        
        // Determinar estado de la suscripción
        let estado;
        if (i < numSuscripciones - 1) {
          // Suscripciones anteriores: 80% VENCIDA, 20% CANCELADA
          estado = Math.random() < 0.8 ? 'VENCIDA' : 'CANCELADA';
        } else {
          // Última suscripción
          if (fechaFin > hoy) {
            estado = 'ACTIVA';
          } else {
            // Suscripción vencida: 60% no renovó, 40% cancelada
            estado = Math.random() < 0.6 ? 'VENCIDA' : 'CANCELADA';
          }
        }
        
        suscripciones.push({
          socio_id: socio.id,
          plan_id: plan.id,
          sucursal_inscripcion_id: sucursal.id,
          empleado_registro_id: empleado.id,
          fecha_inicio: fechaInicioSuscripcion.toISOString().split('T')[0],
          fecha_fin: fechaFin.toISOString().split('T')[0],
          estado,
          fecha_creacion: fechaInicioSuscripcion.toISOString()
        });
        
        // Siguiente suscripción empieza después de que vence la anterior (con gap aleatorio)
        fechaInicioSuscripcion = new Date(fechaFin);
        fechaInicioSuscripcion.setDate(fechaInicioSuscripcion.getDate() + randomInt(1, 30));
        
        // Si la siguiente suscripción sería después de hoy, no crear más
        if (fechaInicioSuscripcion > hoy) break;
      }
    }
    
    const { data: suscripcionesCreadas, error: errorSuscripciones } = await supabase
      .from('suscripciones')
      .insert(suscripciones)
      .select('id, socio_id, plan_id, sucursal_inscripcion_id, fecha_inicio, fecha_fin, estado');
    
    if (errorSuscripciones) {
      console.error('❌ Error creando suscripciones:', errorSuscripciones);
      throw errorSuscripciones;
    }
    
    console.log(`✅ ${suscripcionesCreadas.length} suscripciones creadas\n`);
    
    // 4. Crear pagos para las suscripciones
    console.log('💰 Creando pagos...');
    const pagos = [];
    
    for (const suscripcion of suscripcionesCreadas) {
      const plan = planes.find(p => p.id === suscripcion.plan_id);
      const empleadosSucursal = empleados.filter(e => e.sucursal_id === suscripcion.sucursal_inscripcion_id);
      const empleado = empleadosSucursal.length > 0 ? randomChoice(empleadosSucursal) : randomChoice(empleados);
      
      // 90% de las suscripciones tienen pago
      if (Math.random() < 0.9) {
        const metodoPago = randomChoice(['EFECTIVO', 'QR_LIBELULA', 'TRANSFERENCIA', 'CRIPTOMONEDA']);
        const fechaInicioPago = new Date(suscripcion.fecha_inicio);
        const fechaFinPago = new Date(suscripcion.fecha_inicio);
        fechaFinPago.setDate(fechaFinPago.getDate() + 3);
        const fechaPago = randomDate(fechaInicioPago, fechaFinPago);
        
        pagos.push({
          suscripcion_id: suscripcion.id,
          socio_id: suscripcion.socio_id,
          empleado_cobrador_id: empleado.id,
          sucursal_id: suscripcion.sucursal_inscripcion_id,
          monto_pagado: plan.monto,
          codigo_moneda: plan.codigo_moneda,
          metodo_pago: metodoPago,
          referencia_transaccion: metodoPago !== 'EFECTIVO' ? `REF-${randomInt(100000, 999999)}` : null,
          fecha_pago: fechaPago.toISOString()
        });
      }
    }
    
    const { data: pagosCreados, error: errorPagos } = await supabase
      .from('pagos')
      .insert(pagos)
      .select('id, suscripcion_id, sucursal_id, fecha_pago, monto_pagado');
    
    if (errorPagos) {
      console.error('❌ Error creando pagos:', errorPagos);
      throw errorPagos;
    }
    
    console.log(`✅ ${pagosCreados.length} pagos creados\n`);
    
    // 5. Crear facturas para los pagos
    console.log('🧾 Creando facturas...');
    const facturas = [];
    
    for (const pago of pagosCreados) {
      // 80% de los pagos tienen factura
      if (Math.random() < 0.8) {
        facturas.push({
          pago_id: pago.id,
          nit_ci_comprador: Math.random() < 0.3 ? generarCI() : '0',
          razon_social_comprador: Math.random() < 0.3 ? 'EMPRESA DEMO S.R.L.' : 'S/N',
          cufd: `CUFD-${randomInt(100000, 999999)}`,
          codigo_autorizacion: `AUTH-${randomInt(1000000, 9999999)}`,
          fecha_emision: pago.fecha_pago
        });
      }
    }
    
    const { data: facturasCreadas, error: errorFacturas } = await supabase
      .from('facturas')
      .insert(facturas)
      .select('id');
    
    if (errorFacturas) {
      console.error('❌ Error creando facturas:', errorFacturas);
      throw errorFacturas;
    }
    
    console.log(`✅ ${facturasCreadas.length} facturas creadas\n`);
    
    // 6. Crear asistencias con patrones realistas
    console.log('📅 Creando asistencias...');
    const asistencias = [];
    
    // Obtener casilleros por sucursal
    const { data: casilleros } = await supabase
      .from('casilleros')
      .select('id, sucursal_id')
      .eq('estado', 'LIBRE');
    
    const casillerosPorSucursal = {};
    casilleros.forEach(c => {
      if (!casillerosPorSucursal[c.sucursal_id]) {
        casillerosPorSucursal[c.sucursal_id] = [];
      }
      casillerosPorSucursal[c.sucursal_id].push(c.id);
    });
    
    // Categorizar socios por patrón de asistencia
    for (const suscripcion of suscripcionesCreadas) {
      if (suscripcion.estado === 'CANCELADA') continue;
      
      const fechaInicioSub = new Date(suscripcion.fecha_inicio);
      const fechaFinSub = new Date(suscripcion.fecha_fin);
      const fechaLimite = fechaFinSub < hoy ? fechaFinSub : hoy;
      
      // Determinar patrón de asistencia
      const patron = Math.random();
      let frecuenciaSemanal;
      let probabilidadAsistencia;
      
      if (patron < 0.15) {
        // 15% - Muy activos (5-6 veces/semana)
        frecuenciaSemanal = randomInt(5, 6);
        probabilidadAsistencia = 0.85;
      } else if (patron < 0.35) {
        // 20% - Activos regulares (3-4 veces/semana)
        frecuenciaSemanal = randomInt(3, 4);
        probabilidadAsistencia = 0.75;
      } else if (patron < 0.60) {
        // 25% - Moderados (2-3 veces/semana)
        frecuenciaSemanal = randomInt(2, 3);
        probabilidadAsistencia = 0.65;
      } else if (patron < 0.75) {
        // 15% - Ocasionales (1-2 veces/semana)
        frecuenciaSemanal = randomInt(1, 2);
        probabilidadAsistencia = 0.50;
      } else if (patron < 0.85) {
        // 10% - Racha perdida (empezaron bien, luego pararon)
        frecuenciaSemanal = 0; // Se manejará especialmente
        probabilidadAsistencia = 0;
      } else {
        // 15% - Inscritos que no vienen
        frecuenciaSemanal = 0;
        probabilidadAsistencia = 0;
      }
      
      // Generar asistencias
      let fechaActual = new Date(fechaInicioSub);
      let diasSinVisita = 0;
      
      // Para patrón "racha perdida"
      const esRachaPerdida = patron >= 0.75 && patron < 0.85;
      const fechaCortaRacha = esRachaPerdida ? randomDate(fechaInicioSub, new Date(fechaInicioSub.getTime() + (fechaLimite.getTime() - fechaInicioSub.getTime()) * 0.6)) : null;
      
      while (fechaActual <= fechaLimite) {
        const debeAsistir = esRachaPerdida 
          ? (fechaActual < fechaCortaRacha && Math.random() < 0.8)
          : (Math.random() < probabilidadAsistencia && diasSinVisita < 7);
        
        if (debeAsistir) {
          // Horarios realistas (6am - 10pm)
          const hora = randomChoice([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
          const minuto = randomInt(0, 59);
          
          const fechaEntrada = new Date(fechaActual);
          fechaEntrada.setHours(hora, minuto, 0, 0);
          
          // Duración de entrenamiento: 45min - 2h
          const duracionMinutos = randomInt(45, 120);
          const fechaSalida = new Date(fechaEntrada);
          fechaSalida.setMinutes(fechaSalida.getMinutes() + duracionMinutos);
          
          const casillerosSucursal = casillerosPorSucursal[suscripcion.sucursal_inscripcion_id] || [];
          const casillero = casillerosSucursal.length > 0 ? randomChoice(casillerosSucursal) : null;
          
          asistencias.push({
            socio_id: suscripcion.socio_id,
            sucursal_id: suscripcion.sucursal_inscripcion_id,
            casillero_id: casillero,
            fecha_entrada: fechaEntrada.toISOString(),
            fecha_salida: fechaSalida.toISOString()
          });
          
          diasSinVisita = 0;
        } else {
          diasSinVisita++;
        }
        
        // Avanzar al siguiente día
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
    }
    
    // Insertar asistencias en lotes de 500 con reintentos
    console.log(`📊 Insertando ${asistencias.length} asistencias en lotes...`);
    const batchSize = 500;
    let asistenciasCreadas = 0;
    const maxReintentos = 3;
    
    for (let i = 0; i < asistencias.length; i += batchSize) {
      const batch = asistencias.slice(i, i + batchSize);
      let intentos = 0;
      let exito = false;
      
      while (intentos < maxReintentos && !exito) {
        try {
          const { error: errorAsistencias } = await supabase
            .from('asistencias')
            .insert(batch);
          
          if (errorAsistencias) {
            throw errorAsistencias;
          }
          
          asistenciasCreadas += batch.length;
          console.log(`  ✓ ${asistenciasCreadas}/${asistencias.length} asistencias insertadas`);
          exito = true;
        } catch (error) {
          intentos++;
          if (intentos < maxReintentos) {
            console.log(`  ⚠️  Error en lote ${Math.floor(i / batchSize) + 1}, reintentando (${intentos}/${maxReintentos})...`);
            // Esperar 2 segundos antes de reintentar
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.error(`  ❌ Error insertando lote ${Math.floor(i / batchSize) + 1} después de ${maxReintentos} intentos:`, error.message || error);
            // Continuar con el siguiente lote en lugar de fallar completamente
          }
        }
      }
    }
    
    console.log(`✅ ${asistenciasCreadas} asistencias creadas\n`);
    
    // 7. Crear cierres de caja históricos
    console.log('💼 Creando cierres de caja...');
    
    // Obtener cierres existentes
    const { data: cierresExistentes } = await supabase
      .from('cierres_caja')
      .select('sucursal_id, fecha');
    
    const cierresExistentesSet = new Set(
      cierresExistentes.map(c => `${c.sucursal_id}-${c.fecha}`)
    );
    
    const cierresCaja = [];
    
    // Agrupar pagos por sucursal y fecha
    const pagosPorSucursalFecha = {};
    for (const pago of pagosCreados) {
      const fecha = pago.fecha_pago.split('T')[0];
      const key = `${pago.sucursal_id}-${fecha}`;
      
      if (!pagosPorSucursalFecha[key]) {
        pagosPorSucursalFecha[key] = {
          sucursal_id: pago.sucursal_id,
          fecha,
          total: 0
        };
      }
      
      pagosPorSucursalFecha[key].total += parseFloat(pago.monto_pagado);
    }
    
    // Crear cierres para cada día con pagos (solo si no existe)
    for (const key in pagosPorSucursalFecha) {
      const { sucursal_id, fecha, total } = pagosPorSucursalFecha[key];
      
      // Verificar si ya existe un cierre para esta sucursal y fecha
      if (cierresExistentesSet.has(key)) {
        continue;
      }
      
      const empleadosSucursal = empleados.filter(e => e.sucursal_id === sucursal_id);
      const empleado = empleadosSucursal.length > 0 ? randomChoice(empleadosSucursal) : randomChoice(empleados);
      
      // Simular pequeñas diferencias en el efectivo físico (±5%)
      const diferencia = randomFloat(-0.05, 0.05);
      const efectivoFisico = total * (1 + diferencia);
      
      cierresCaja.push({
        sucursal_id,
        empleado_id: empleado.id,
        fecha,
        efectivo_fisico_bob: efectivoFisico.toFixed(2),
        efectivo_fisico_usd: 0,
        notas: diferencia > 0.02 ? 'Sobrante en caja' : diferencia < -0.02 ? 'Faltante en caja' : null,
        fecha_registro: new Date(fecha + 'T18:00:00').toISOString()
      });
    }
    
    let cierresCreados = [];
    if (cierresCaja.length > 0) {
      const { data, error: errorCierres } = await supabase
        .from('cierres_caja')
        .insert(cierresCaja)
        .select('id');
      
      if (errorCierres) {
        console.error('❌ Error creando cierres de caja:', errorCierres);
        throw errorCierres;
      }
      
      cierresCreados = data;
    }
    
    console.log(`✅ ${cierresCreados.length} cierres de caja creados (${cierresExistentesSet.size} ya existían)\n`);
    
    // Resumen final
    console.log('═══════════════════════════════════════════════════════');
    console.log('✨ RESUMEN DE DATOS CREADOS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`👥 Socios nuevos:        ${sociosCreados.length}`);
    console.log(`📝 Suscripciones:        ${suscripcionesCreadas.length}`);
    console.log(`💰 Pagos:                ${pagosCreados.length}`);
    console.log(`🧾 Facturas:             ${facturasCreadas.length}`);
    console.log(`📅 Asistencias:          ${asistenciasCreadas}`);
    console.log(`💼 Cierres de caja:      ${cierresCreados.length}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Población de datos completada exitosamente!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
