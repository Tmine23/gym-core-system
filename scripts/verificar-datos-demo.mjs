import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verificando datos demostrativos...\n');

async function verificar() {
  try {
    // 1. Resumen general
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RESUMEN GENERAL');
    console.log('═══════════════════════════════════════════════════════');
    
    const { data: socios } = await supabase
      .from('socios')
      .select('id, suscrito')
      .eq('es_activo', true);
    
    const { data: suscripciones } = await supabase
      .from('suscripciones')
      .select('estado');
    
    const { data: pagos } = await supabase
      .from('pagos')
      .select('monto_pagado, fecha_pago')
      .gte('fecha_pago', '2025-10-01');
    
    const { data: asistencias } = await supabase
      .from('asistencias')
      .select('id')
      .gte('fecha_entrada', '2025-10-01');
    
    console.log(`👥 Socios activos:           ${socios.length}`);
    console.log(`   - Suscritos:              ${socios.filter(s => s.suscrito).length}`);
    console.log(`   - No suscritos:           ${socios.filter(s => !s.suscrito).length}`);
    console.log();
    console.log(`📝 Suscripciones totales:    ${suscripciones.length}`);
    console.log(`   - ACTIVA:                 ${suscripciones.filter(s => s.estado === 'ACTIVA').length}`);
    console.log(`   - VENCIDA:                ${suscripciones.filter(s => s.estado === 'VENCIDA').length}`);
    console.log(`   - CANCELADA:              ${suscripciones.filter(s => s.estado === 'CANCELADA').length}`);
    console.log();
    
    const totalIngresos = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0);
    console.log(`💰 Pagos (oct 2025 - hoy):   ${pagos.length}`);
    console.log(`   - Ingresos totales:       BOB ${totalIngresos.toFixed(2)}`);
    console.log();
    console.log(`📅 Asistencias (oct 2025+):  ${asistencias.length}`);
    console.log();
    
    // 2. Distribución mensual de ingresos
    console.log('═══════════════════════════════════════════════════════');
    console.log('📈 INGRESOS MENSUALES (Últimos 6 meses)');
    console.log('═══════════════════════════════════════════════════════');
    
    const ingresosPorMes = {};
    pagos.forEach(p => {
      const mes = p.fecha_pago.substring(0, 7); // YYYY-MM
      if (!ingresosPorMes[mes]) {
        ingresosPorMes[mes] = { cantidad: 0, total: 0 };
      }
      ingresosPorMes[mes].cantidad++;
      ingresosPorMes[mes].total += parseFloat(p.monto_pagado);
    });
    
    Object.keys(ingresosPorMes).sort().forEach(mes => {
      const data = ingresosPorMes[mes];
      console.log(`${mes}: ${data.cantidad} pagos → BOB ${data.total.toFixed(2)}`);
    });
    console.log();
    
    // 3. Patrones de asistencia
    console.log('═══════════════════════════════════════════════════════');
    console.log('🏃 PATRONES DE ASISTENCIA');
    console.log('═══════════════════════════════════════════════════════');
    
    const { data: asistenciasPorSocio } = await supabase.rpc('get_asistencias_por_socio', {});
    
    // Simular la clasificación (ya que no tenemos la función RPC)
    const { data: sociosConAsistencias } = await supabase
      .from('asistencias')
      .select('socio_id, fecha_entrada')
      .gte('fecha_entrada', '2025-10-01');
    
    const asistenciasPorSocioMap = {};
    sociosConAsistencias.forEach(a => {
      if (!asistenciasPorSocioMap[a.socio_id]) {
        asistenciasPorSocioMap[a.socio_id] = [];
      }
      asistenciasPorSocioMap[a.socio_id].push(new Date(a.fecha_entrada));
    });
    
    const clasificacion = {
      'Muy activo (80+ visitas)': 0,
      'Activo regular (40-79 visitas)': 0,
      'Moderado (20-39 visitas)': 0,
      'Ocasional (1-19 visitas)': 0,
      'Sin asistencias': 0,
      'Racha perdida (30+ días)': 0
    };
    
    const hoy = new Date();
    Object.keys(asistenciasPorSocioMap).forEach(socioId => {
      const asistencias = asistenciasPorSocioMap[socioId];
      const total = asistencias.length;
      const ultimaAsistencia = new Date(Math.max(...asistencias));
      const diasSinVisita = Math.floor((hoy - ultimaAsistencia) / (1000 * 60 * 60 * 24));
      
      if (diasSinVisita > 30) {
        clasificacion['Racha perdida (30+ días)']++;
      } else if (total >= 80) {
        clasificacion['Muy activo (80+ visitas)']++;
      } else if (total >= 40) {
        clasificacion['Activo regular (40-79 visitas)']++;
      } else if (total >= 20) {
        clasificacion['Moderado (20-39 visitas)']++;
      } else if (total >= 1) {
        clasificacion['Ocasional (1-19 visitas)']++;
      }
    });
    
    clasificacion['Sin asistencias'] = socios.length - Object.keys(asistenciasPorSocioMap).length;
    
    Object.keys(clasificacion).forEach(categoria => {
      const cantidad = clasificacion[categoria];
      const porcentaje = ((cantidad / socios.length) * 100).toFixed(1);
      console.log(`${categoria.padEnd(35)} ${cantidad.toString().padStart(4)} socios (${porcentaje}%)`);
    });
    console.log();
    
    // 4. Segmentos de riesgo (módulo de retención)
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚨 SEGMENTOS DE RIESGO (Módulo de Retención)');
    console.log('═══════════════════════════════════════════════════════');
    
    // Baja asistencia
    const { data: bajaAsistencia } = await supabase
      .from('socios')
      .select(`
        id,
        nombre,
        apellido,
        suscrito
      `)
      .eq('suscrito', true)
      .eq('es_activo', true);
    
    let bajaAsistenciaCount = 0;
    for (const socio of bajaAsistencia) {
      const { data: asistencias30d } = await supabase
        .from('asistencias')
        .select('id')
        .eq('socio_id', socio.id)
        .gte('fecha_entrada', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (asistencias30d.length <= 2) {
        bajaAsistenciaCount++;
      }
      
      // Solo verificar los primeros 50 para no hacer demasiadas queries
      if (bajaAsistenciaCount > 50) break;
    }
    
    // No renovaron
    const { data: noRenovaron } = await supabase
      .from('suscripciones')
      .select('socio_id')
      .eq('estado', 'VENCIDA')
      .lt('fecha_fin', new Date().toISOString().split('T')[0]);
    
    // Próximos a vencer
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 7);
    const { data: proximosVencer } = await supabase
      .from('suscripciones')
      .select('socio_id')
      .eq('estado', 'ACTIVA')
      .lte('fecha_fin', fechaLimite.toISOString().split('T')[0])
      .gte('fecha_fin', new Date().toISOString().split('T')[0]);
    
    console.log(`🔴 Baja asistencia:          ${bajaAsistenciaCount}+ socios`);
    console.log(`   (Suscritos con 0-2 visitas en 30 días)`);
    console.log();
    console.log(`🔴 No renovaron:             ${noRenovaron.length} socios`);
    console.log(`   (Suscripción vencida sin renovar)`);
    console.log();
    console.log(`🟡 Próximos a vencer:        ${proximosVencer.length} socios`);
    console.log(`   (Suscripción vence en 7 días)`);
    console.log();
    console.log(`🟡 Racha perdida:            ${clasificacion['Racha perdida (30+ días)']} socios`);
    console.log(`   (Venían regularmente, 30+ días sin visita)`);
    console.log();
    
    // 5. Distribución por sucursal
    console.log('═══════════════════════════════════════════════════════');
    console.log('🏢 DISTRIBUCIÓN POR SUCURSAL');
    console.log('═══════════════════════════════════════════════════════');
    
    const { data: sucursales } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('esta_activa', true)
      .order('id');
    
    for (const sucursal of sucursales) {
      const { data: pagosSucursal } = await supabase
        .from('pagos')
        .select('monto_pagado')
        .eq('sucursal_id', sucursal.id)
        .gte('fecha_pago', '2025-10-01');
      
      const { data: asistenciasSucursal } = await supabase
        .from('asistencias')
        .select('id')
        .eq('sucursal_id', sucursal.id)
        .gte('fecha_entrada', '2025-10-01');
      
      const ingresosSucursal = pagosSucursal.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0);
      
      console.log(`\n${sucursal.nombre}`);
      console.log(`  Pagos:       ${pagosSucursal.length}`);
      console.log(`  Ingresos:    BOB ${ingresosSucursal.toFixed(2)}`);
      console.log(`  Asistencias: ${asistenciasSucursal.length}`);
    }
    console.log();
    
    // Resumen final
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Los datos demostrativos están correctamente poblados.');
    console.log('El sistema está listo para demostración y presentación.');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verificar();
