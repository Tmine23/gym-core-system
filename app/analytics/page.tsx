"use client";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { SucursalSelector } from "@/app/_components/SucursalSelector";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { generarReporteBI, type ReporteData } from "./ReportePDF";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Periodo = "6m" | "12m" | "todo";

type IngresoMes = { mes: string; bob: number; usd: number; count: number };
type PlanDist = { name: string; value: number; color: string };
type RetencionMes = { mes: string; vencieron: number; renovaron: number; tasa: number };
type PronosticoMes = { mes: string; real: number | null; regresion: number; wma: number | null; holt: number | null };
type AsistenciaHora = { hora: number; lun: number; mar: number; mie: number; jue: number; vie: number; sab: number; dom: number };

// Insight prescriptivo — el corazón del BI
type Insight = {
  id: string;
  tipo: "alerta" | "oportunidad" | "accion";
  prioridad: "alta" | "media" | "baja";
  titulo: string;
  descripcion: string;
  metrica: string;
  accion: { label: string; href: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TZ = "America/La_Paz";
const COLORS = ["#76CB3E", "#38bdf8", "#a78bfa", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

const PAISES_MAP: Record<string, { name: string; flag: string }> = {
  BO: { name: "Bolivia", flag: "🇧🇴" }, PE: { name: "Perú", flag: "🇵🇪" },
  CO: { name: "Colombia", flag: "🇨🇴" }, AR: { name: "Argentina", flag: "🇦🇷" },
  CL: { name: "Chile", flag: "🇨🇱" }, BR: { name: "Brasil", flag: "🇧🇷" },
  EC: { name: "Ecuador", flag: "🇪🇨" }, PY: { name: "Paraguay", flag: "🇵🇾" },
  VE: { name: "Venezuela", flag: "🇻🇪" }, MX: { name: "México", flag: "🇲🇽" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); }
function mesLabel(iso: string) {
  return new Date(iso + "-15").toLocaleDateString("es-BO", { month: "short", year: "2-digit" });
}
function fmtMoney(n: number) { return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

// ─── Modelos predictivos ──────────────────────────────────────────────────────

function linearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] ?? 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) { sumX += i; sumY += data[i]; sumXY += i * data[i]; sumX2 += i * i; }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function forecastWMA(data: number[], ahead: number, window = 3): number[] {
  const ext = [...data];
  for (let i = 0; i < ahead; i++) {
    let sum = 0, ws = 0;
    for (let j = 0; j < window; j++) { const w = j + 1; sum += ext[ext.length - window + j] * w; ws += w; }
    ext.push(Math.max(0, Math.round(sum / ws)));
  }
  return ext.slice(data.length);
}

function weightedMovingAverage(data: number[], window = 3): number[] {
  return data.map((_, i) => {
    if (i < window - 1) return data[i];
    let sum = 0, ws = 0;
    for (let j = 0; j < window; j++) { const w = j + 1; sum += data[i - window + 1 + j] * w; ws += w; }
    return Math.round(sum / ws);
  });
}

function holtForecast(data: number[], ahead: number, alpha = 0.4, beta = 0.3) {
  if (data.length < 2) return { smoothed: data, forecast: Array(ahead).fill(data[0] ?? 0) as number[] };
  let level = data[0], trend = data[1] - data[0];
  const smoothed = [Math.round(level)];
  for (let i = 1; i < data.length; i++) {
    const prev = level;
    level = alpha * data[i] + (1 - alpha) * (prev + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
    smoothed.push(Math.round(level + trend));
  }
  const forecast: number[] = [];
  for (let i = 1; i <= ahead; i++) forecast.push(Math.max(0, Math.round(level + trend * i)));
  return { smoothed, forecast };
}

function periodoMeses(p: Periodo) { return p === "6m" ? 6 : p === "12m" ? 12 : 36; }

// ─── Motor de Insights (prescriptivo) ─────────────────────────────────────────

function generarInsights(data: {
  ingresosMes: IngresoMes[];
  retencionMes: RetencionMes[];
  sociosEnRiesgo: number;
  sociosSinAsistencia30d: number;
  totalSuscritos: number;
  totalSocios: number;
  vencenEn7dias: number;
  horasPico: { hora: number; total: number }[];
  horasValle: { hora: number; total: number }[];
  pronosticoProxMes: number;
}): Insight[] {
  const insights: Insight[] = [];
  const hoy = todayStr().slice(0, 7);
  const mesActual = data.ingresosMes.find((m) => m.mes === hoy);
  const mesAnterior = data.ingresosMes.length >= 2 ? data.ingresosMes[data.ingresosMes.length - 2] : null;

  // 1. Alerta de ingresos
  if (mesActual && mesAnterior && mesActual.bob < mesAnterior.bob * 0.8) {
    const caida = Math.round(((mesAnterior.bob - mesActual.bob) / mesAnterior.bob) * 100);
    insights.push({
      id: "ingresos-caida", tipo: "alerta", prioridad: "alta",
      titulo: `Ingresos cayeron ${caida}% vs mes anterior`,
      descripcion: `Este mes llevas ${fmtMoney(mesActual.bob)} vs ${fmtMoney(mesAnterior.bob)} el mes pasado. Considera lanzar una campaña de renovación para recuperar ingresos.`,
      metrica: `${fmtMoney(mesActual.bob)} / ${fmtMoney(mesAnterior.bob)}`,
      accion: { label: "Crear campaña de renovación", href: "/campanas" },
    });
  }

  // 2. Retención baja
  const ultRet = data.retencionMes.length > 0 ? data.retencionMes[data.retencionMes.length - 1] : null;
  if (ultRet && ultRet.tasa < 70) {
    insights.push({
      id: "retencion-baja", tipo: "alerta", prioridad: "alta",
      titulo: `Retención del ${ultRet.tasa}% — por debajo del objetivo (70%)`,
      descripcion: `De ${ultRet.vencieron} socios que vencieron, solo ${ultRet.renovaron} renovaron. Envía una oferta a los que no renovaron para recuperarlos.`,
      metrica: `${ultRet.renovaron}/${ultRet.vencieron} renovaron`,
      accion: { label: "Enviar campaña WhatsApp", href: "/campanas" },
    });
  }

  // 3. Socios en riesgo de churn
  if (data.sociosEnRiesgo > 0) {
    const esAlto = data.sociosEnRiesgo > 5;
    insights.push({
      id: "churn-riesgo", tipo: "accion", prioridad: esAlto ? "alta" : "media",
      titulo: `${data.sociosEnRiesgo} socios con riesgo ${esAlto ? "alto" : "moderado"} de abandono`,
      descripcion: esAlto
        ? `Se detectaron ${data.sociosEnRiesgo} socios que probablemente no renovarán. Es urgente contactarlos para evitar la pérdida.`
        : `Hay ${data.sociosEnRiesgo} socios que podrían no renovar. Contactarlos a tiempo puede evitar que se vayan.`,
      metrica: `${data.sociosEnRiesgo} socios sin asistencia 30+ días`,
      accion: { label: "Ver socios en riesgo", href: "/retencion?segmento=todos" },
    });
  }

  // 4. Socios sin asistencia
  if (data.sociosSinAsistencia30d > 3) {
    const pct = data.totalSuscritos > 0 ? Math.round((data.sociosSinAsistencia30d / data.totalSuscritos) * 100) : 0;
    insights.push({
      id: "sin-asistencia", tipo: "accion", prioridad: pct > 30 ? "alta" : "media",
      titulo: `${data.sociosSinAsistencia30d} socios suscritos no asisten hace más de 30 días`,
      descripcion: `El ${pct}% de tus socios activos no viene al gym. Un mensaje motivacional a tiempo puede evitar que cancelen su suscripción.`,
      metrica: `${pct}% inactivos`,
      accion: { label: "Campaña de reactivación", href: "/campanas" },
    });
  }

  // 5. Vencen pronto
  if (data.vencenEn7dias > 0) {
    insights.push({
      id: "vencen-pronto", tipo: "accion", prioridad: "media",
      titulo: `${data.vencenEn7dias} suscripciones vencen en los próximos 7 días`,
      descripcion: `Estos socios están por vencer. Un recordatorio oportuno puede asegurar que renueven a tiempo.`,
      metrica: `${data.vencenEn7dias} por vencer`,
      accion: { label: "Enviar recordatorio", href: "/campanas" },
    });
  }

  // 6. Oportunidad hora valle
  if (data.horasValle.length > 0) {
    const valle = data.horasValle[0];
    const pico = data.horasPico[0];
    if (pico && valle.total < pico.total * 0.3) {
      insights.push({
        id: "hora-valle", tipo: "oportunidad", prioridad: "baja",
        titulo: `Horario ${valle.hora}:00 tiene muy baja ocupación`,
        descripcion: `Solo ${valle.total} asistencias vs ${pico.total} en hora pico (${pico.hora}:00). Ofrece descuento "hora valle" para redistribuir la demanda.`,
        metrica: `${valle.total} vs ${pico.total} asistencias`,
        accion: null,
      });
    }
  }

  // 7. Pronóstico positivo
  if (mesActual && data.pronosticoProxMes > mesActual.bob * 1.1) {
    insights.push({
      id: "pronostico-positivo", tipo: "oportunidad", prioridad: "baja",
      titulo: `Pronóstico: ingresos subirían a ${fmtMoney(data.pronosticoProxMes)} el próximo mes`,
      descripcion: `Los modelos predictivos proyectan un aumento. Aprovecha la tendencia para captar nuevos socios.`,
      metrica: fmtMoney(data.pronosticoProxMes),
      accion: null,
    });
  }

  // Ordenar por prioridad
  const prioOrder = { alta: 0, media: 1, baja: 2 };
  insights.sort((a, b) => prioOrder[a.prioridad] - prioOrder[b.prioridad]);
  return insights;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BrainIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z" /></svg>; }
function RefreshIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>; }
function DownloadIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function ArrowIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>; }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? p.value.toLocaleString("es-BO") : p.value}</p>
      ))}
    </div>
  );
}

function insightConfig(tipo: Insight["tipo"], prioridad: Insight["prioridad"]) {
  const configs = {
    alerta: { icon: "🚨", border: "border-red-500/30", bg: "bg-red-500/5", badge: "bg-red-500/15 text-red-400 border-red-500/30" },
    accion: { icon: "⚡", border: "border-amber-400/30", bg: "bg-amber-400/5", badge: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
    oportunidad: { icon: "💡", border: "border-brand-green/30", bg: "bg-brand-green/5", badge: "bg-brand-green/15 text-brand-green border-brand-green/30" },
  };
  return configs[tipo];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  useAuth(); // ensure auth context is available
  const [selectedSucursal, setSelectedSucursal] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("12m");
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [ingresosMes, setIngresosMes] = useState<IngresoMes[]>([]);
  const [retencionMes, setRetencionMes] = useState<RetencionMes[]>([]);
  const [pronostico, setPronostico] = useState<PronosticoMes[]>([]);
  const [planDist, setPlanDist] = useState<PlanDist[]>([]);
  const [nacionalidades, setNacionalidades] = useState<{ pais: string; flag: string; count: number }[]>([]);
  const [asistHoras, setAsistHoras] = useState<{ hora: number; lun: number; mar: number; mie: number; jue: number; vie: number; sab: number; dom: number }[]>([]);
  const [totalSocios, setTotalSocios] = useState(0);
  const [totalSuscritos, setTotalSuscritos] = useState(0);
  const [comparativa, setComparativa] = useState<{ id: number; nombre: string; ingresosMes: number; asistenciasMes: number; suscActivas: number; tasaRetencion: number }[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const hoy = todayStr();
    const mesActual = hoy.slice(0, 7);
    const mesesAtras = periodoMeses(periodo);
    const desde = new Date(); desde.setMonth(desde.getMonth() - mesesAtras);
    const desdeStr = desde.toISOString();

    // ── Ingresos ──
    let pagosQuery = supabase.from("pagos").select("monto_pagado, codigo_moneda, fecha_pago").gte("fecha_pago", desdeStr);
    if (selectedSucursal !== null) {
      pagosQuery = pagosQuery.eq("sucursal_id", selectedSucursal);
    }
    const { data: pagos } = await pagosQuery;
    const ingMap = new Map<string, IngresoMes>();
    for (const p of pagos ?? []) {
      const mes = (p.fecha_pago as string).slice(0, 7);
      if (mes > mesActual) continue;
      const prev = ingMap.get(mes) ?? { mes, bob: 0, usd: 0, count: 0 };
      if (p.codigo_moneda === "BOB") prev.bob += Number(p.monto_pagado); else prev.usd += Number(p.monto_pagado);
      prev.count++; ingMap.set(mes, prev);
    }
    const ingArr = Array.from(ingMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));
    setIngresosMes(ingArr);

    // ── Pronóstico 3 modelos ──
    const bobMensual = ingArr.map((m) => m.bob);
    let pronosticoProxMes = 0;
    if (bobMensual.length >= 3) {
      const AHEAD = 3;
      const { slope, intercept } = linearRegression(bobMensual);
      const wmaSmoothed = weightedMovingAverage(bobMensual, 3);
      const wmaForecastVals = forecastWMA(bobMensual, AHEAD, 3);
      const { smoothed: holtSmoothed, forecast: holtForecastVals } = holtForecast(bobMensual, AHEAD);
      const arr: PronosticoMes[] = ingArr.map((m, i) => ({
        mes: mesLabel(m.mes), real: m.bob, regresion: Math.round(intercept + slope * i),
        wma: wmaSmoothed[i] ?? null, holt: holtSmoothed[i] ?? null,
      }));
      for (let i = 0; i < AHEAD; i++) {
        const fd = new Date(); fd.setMonth(fd.getMonth() + i + 1);
        arr.push({
          mes: mesLabel(fd.toISOString().slice(0, 7)), real: null,
          regresion: Math.max(0, Math.round(intercept + slope * (bobMensual.length + i))),
          wma: wmaForecastVals[i] ?? null, holt: holtForecastVals[i] ?? null,
        });
      }
      setPronostico(arr);
      pronosticoProxMes = holtForecastVals[0] ?? 0;
    }

    // ── Retención ──
    let subVencidasQuery = supabase.from("suscripciones").select("socio_id, fecha_fin, fecha_inicio").gte("fecha_fin", desdeStr).lte("fecha_fin", hoy);
    if (selectedSucursal !== null) {
      subVencidasQuery = subVencidasQuery.eq("sucursal_inscripcion_id", selectedSucursal);
    }
    const { data: subVencidas } = await subVencidasQuery;
    // Todas las suscripciones para verificar renovaciones (incluye futuras)
    let todasSubsQuery = supabase.from("suscripciones").select("socio_id, fecha_inicio");
    if (selectedSucursal !== null) {
      todasSubsQuery = todasSubsQuery.eq("sucursal_inscripcion_id", selectedSucursal);
    }
    const { data: todasSubs } = await todasSubsQuery;
    const retMap = new Map<string, { vencieron: number; renovaron: number }>();
    for (const s of subVencidas ?? []) {
      const mes = (s.fecha_fin as string).slice(0, 7);
      if (mes > mesActual) continue;
      const prev = retMap.get(mes) ?? { vencieron: 0, renovaron: 0 };
      prev.vencieron++;
      // Buscar en TODAS las suscripciones si hay una posterior
      if ((todasSubs ?? []).some((o) => o.socio_id === s.socio_id && o.fecha_inicio > s.fecha_fin)) prev.renovaron++;
      retMap.set(mes, prev);
    }
    const retArr = Array.from(retMap.entries()).map(([mes, v]) => ({ mes, ...v, tasa: v.vencieron > 0 ? Math.round((v.renovaron / v.vencieron) * 100) : 0 })).sort((a, b) => a.mes.localeCompare(b.mes));
    setRetencionMes(retArr);

    // ── Planes ──
    let subsQuery = supabase.from("suscripciones").select("planes(nombre)").eq("estado", "ACTIVA");
    if (selectedSucursal !== null) {
      subsQuery = subsQuery.eq("sucursal_inscripcion_id", selectedSucursal);
    }
    const { data: subs } = await subsQuery;
    const plMap = new Map<string, number>();
    for (const s of (subs ?? []) as unknown as { planes: { nombre: string | null } | null }[]) {
      const n = s.planes?.nombre ?? "Sin plan"; plMap.set(n, (plMap.get(n) ?? 0) + 1);
    }
    setPlanDist(Array.from(plMap.entries()).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] })));

    // ── Socios ──
    const { count: total } = await supabase.from("socios").select("*", { count: "exact", head: true }).eq("es_activo", true);
    const { count: suscritos } = await supabase.from("socios").select("*", { count: "exact", head: true }).eq("es_activo", true).eq("suscrito", true);
    setTotalSocios(total ?? 0); setTotalSuscritos(suscritos ?? 0);

    // ── Nacionalidades ──
    const { data: nacData } = await supabase.from("socios").select("nacionalidad").eq("es_activo", true);
    const nacMap = new Map<string, number>();
    for (const s of nacData ?? []) { const c = (s.nacionalidad as string) ?? "BO"; nacMap.set(c, (nacMap.get(c) ?? 0) + 1); }
    setNacionalidades(Array.from(nacMap.entries()).map(([pais, count]) => ({ pais, flag: PAISES_MAP[pais]?.flag ?? "🏳️", count })).sort((a, b) => b.count - a.count));

    // ── Datos para insights ──
    const treintaDias = new Date(Date.now() - 30 * 86400000).toISOString();
    let asistRecientesQuery = supabase.from("asistencias").select("socio_id").gte("fecha_entrada", treintaDias);
    if (selectedSucursal !== null) {
      asistRecientesQuery = asistRecientesQuery.eq("sucursal_id", selectedSucursal);
    }
    const { data: asistRecientes } = await asistRecientesQuery;
    const conAsist = new Set((asistRecientes ?? []).map((a) => a.socio_id));
    let suscActivasQuery = supabase.from("suscripciones").select("socio_id").eq("estado", "ACTIVA").gte("fecha_fin", hoy);
    if (selectedSucursal !== null) {
      suscActivasQuery = suscActivasQuery.eq("sucursal_inscripcion_id", selectedSucursal);
    }
    const { data: suscActivas } = await suscActivasQuery;
    const sociosSuscritos = new Set((suscActivas ?? []).map((s) => s.socio_id));
    const sinAsist30d = Array.from(sociosSuscritos).filter((id) => !conAsist.has(id)).length;

    // Socios en riesgo (churn score alto — simplificado)
    const sociosEnRiesgo = sinAsist30d; // los que no vienen son los de mayor riesgo

    // Vencen en 7 días (solo si no tienen ya una renovación posterior)
    const en7d = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    let subsVencenProntoQuery = supabase.from("suscripciones")
      .select("socio_id, fecha_fin")
      .eq("estado", "ACTIVA").gte("fecha_fin", hoy).lte("fecha_fin", en7d);
    if (selectedSucursal !== null) {
      subsVencenProntoQuery = subsVencenProntoQuery.eq("sucursal_inscripcion_id", selectedSucursal);
    }
    const { data: subsVencenPronto } = await subsVencenProntoQuery;
    // Filtrar los que ya tienen renovación
    let subsRenovadasQuery = supabase.from("suscripciones")
      .select("socio_id, fecha_inicio").eq("estado", "ACTIVA");
    if (selectedSucursal !== null) {
      subsRenovadasQuery = subsRenovadasQuery.eq("sucursal_inscripcion_id", selectedSucursal);
    }
    const { data: subsRenovadas } = await subsRenovadasQuery;
    const vencenReal = (subsVencenPronto ?? []).filter((s) =>
      !(subsRenovadas ?? []).some((r) => r.socio_id === s.socio_id && r.fecha_inicio > s.fecha_fin)
    );
    const vencen7 = vencenReal.length;

    // Horas pico/valle
    let asistAllQuery = supabase.from("asistencias").select("fecha_entrada").gte("fecha_entrada", treintaDias);
    if (selectedSucursal !== null) {
      asistAllQuery = asistAllQuery.eq("sucursal_id", selectedSucursal);
    }
    const { data: asistAll } = await asistAllQuery;
    const horaCount = new Map<number, number>();
    for (const a of asistAll ?? []) { const h = new Date(a.fecha_entrada).getHours(); horaCount.set(h, (horaCount.get(h) ?? 0) + 1); }
    const horasArr = Array.from(horaCount.entries()).map(([hora, total]) => ({ hora, total })).sort((a, b) => b.total - a.total);
    const horasPico = horasArr.slice(0, 3);
    const horasValle = horasArr.filter((h) => h.hora >= 6 && h.hora <= 20).sort((a, b) => a.total - b.total).slice(0, 3);

    // Heatmap de asistencias por hora y día
    const dias = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"] as const;
    const heatmap: AsistenciaHora[] = Array.from({ length: 16 }, (_, i) => ({
      hora: i + 6, lun: 0, mar: 0, mie: 0, jue: 0, vie: 0, sab: 0, dom: 0,
    }));
    for (const a of asistAll ?? []) {
      const d = new Date(a.fecha_entrada);
      const row = heatmap.find((r) => r.hora === d.getHours());
      if (row) (row as Record<string, number>)[dias[d.getDay()]]++;
    }
    setAsistHoras(heatmap);

    // ── Generar insights prescriptivos ──
    setInsights(generarInsights({
      ingresosMes: ingArr, retencionMes: retArr,
      sociosEnRiesgo, sociosSinAsistencia30d: sinAsist30d,
      totalSuscritos: suscritos ?? 0, totalSocios: total ?? 0,
      vencenEn7dias: vencen7 ?? 0, horasPico, horasValle,
      pronosticoProxMes,
    }));

    // ── Comparativa entre sucursales (solo cuando selectedSucursal es null = "Todas") ──
    if (selectedSucursal === null) {
      const { data: allSucs } = await supabase.from("sucursales").select("id, nombre").eq("esta_activa", true);
      const comp: typeof comparativa = [];
      for (const suc of allSucs ?? []) {
        const { data: pagSuc } = await supabase.from("pagos").select("monto_pagado, codigo_moneda").eq("sucursal_id", suc.id).gte("fecha_pago", `${mesActual}-01T00:00:00`);
        const ingMes = (pagSuc ?? []).filter((p) => p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0);
        const { count: asistMes } = await supabase.from("asistencias").select("id", { count: "exact", head: true }).eq("sucursal_id", suc.id).gte("fecha_entrada", `${mesActual}-01T00:00:00`);
        const { count: suscAct } = await supabase.from("suscripciones").select("id", { count: "exact", head: true }).eq("sucursal_inscripcion_id", suc.id).eq("estado", "ACTIVA");
        // Retención: vencieron vs renovaron último mes
        const mesAnt = new Date(); mesAnt.setMonth(mesAnt.getMonth() - 1);
        const mesAntStr = mesAnt.toISOString().slice(0, 7);
        const { data: vencSuc } = await supabase.from("suscripciones").select("socio_id, fecha_fin").eq("sucursal_inscripcion_id", suc.id).gte("fecha_fin", `${mesAntStr}-01`).lte("fecha_fin", `${mesAntStr}-31`);
        let venc = 0, renov = 0;
        for (const s of vencSuc ?? []) {
          venc++;
          if ((todasSubs ?? []).some((o) => o.socio_id === s.socio_id && o.fecha_inicio > s.fecha_fin)) renov++;
        }
        comp.push({ id: suc.id, nombre: suc.nombre, ingresosMes: ingMes, asistenciasMes: asistMes ?? 0, suscActivas: suscAct ?? 0, tasaRetencion: venc > 0 ? Math.round((renov / venc) * 100) : 100 });
      }
      setComparativa(comp);
    } else {
      setComparativa([]);
    }

    setLoading(false);
  }, [periodo, selectedSucursal]);

  useEffect(() => { void cargar(); }, [cargar]);

  const mesActualData = ingresosMes.find((m) => m.mes === todayStr().slice(0, 7));
  const mesAnteriorData = ingresosMes.length >= 2 ? ingresosMes[ingresosMes.length - 2] : null;
  const trendPct = mesActualData && mesAnteriorData && mesAnteriorData.bob > 0
    ? Math.round(((mesActualData.bob - mesAnteriorData.bob) / mesAnteriorData.bob) * 100) : 0;
  const ultRet = retencionMes.length > 0 ? retencionMes[retencionMes.length - 1] : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Inteligencia de Negocios</div>
            <h1 className="section-title">Analytics & Insights</h1>
            <p className="section-description">Análisis descriptivo, predictivo y prescriptivo</p>
          </div>
          <div className="flex items-center gap-2">
            <SucursalSelector value={selectedSucursal} onChange={setSelectedSucursal} allowAll={true} />
            <div className="flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1">
              {(["6m", "12m", "todo"] as Periodo[]).map((p) => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={["rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                    periodo === p ? "bg-brand-green/15 text-brand-green border border-brand-green/30" : "text-slate-400 hover:text-slate-200"].join(" ")}>
                  {p === "todo" ? "Todo" : p}
                </button>
              ))}
            </div>
            <button onClick={() => void cargar()} className="flex items-center gap-2 rounded-2xl border border-[#1e293b] bg-white/5 px-3 py-2.5 text-slate-300 hover:text-slate-100"><RefreshIcon /></button>
            <button onClick={() => {
              const hoy = new Date().toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/La_Paz" });
              const reporteData: ReporteData = {
                periodo: periodo === "6m" ? "Últimos 6 meses" : periodo === "12m" ? "Últimos 12 meses" : "Todo el historial",
                fechaGeneracion: hoy,
                gymNombre: "Body Xtreme Gym",
                ingresosMes: mesActualData?.bob ?? 0,
                ingresosAnterior: mesAnteriorData?.bob ?? 0,
                trendPct,
                pagosCount: mesActualData?.count ?? 0,
                tasaRetencion: ultRet?.tasa ?? 0,
                churnRate: 100 - (ultRet?.tasa ?? 0),
                totalSocios,
                totalSuscritos,
                ingresosMensuales: ingresosMes.map((m) => ({ mes: mesLabel(m.mes), bob: m.bob, count: m.count })),
                retencionMensual: retencionMes.map((m) => ({ mes: mesLabel(m.mes), tasa: m.tasa, vencieron: m.vencieron, renovaron: m.renovaron })),
                planes: planDist.map((p) => ({ nombre: p.name, cantidad: p.value })),
                insights: insights.map((i) => ({ titulo: i.titulo, descripcion: i.descripcion, prioridad: i.prioridad })),
                pronostico: pronostico.filter((p) => p.real === null).map((p) => ({ mes: p.mes, regresion: p.regresion, wma: p.wma, holt: p.holt })),
              };
              void generarReporteBI(reporteData);
            }}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl bg-brand-green px-4 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 disabled:opacity-50 transition-all">
              <DownloadIcon /> Reporte PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">Analizando datos y generando insights…</div>
      ) : (
        <>
          {/* ═══ SECCIÓN 1: INSIGHTS PRESCRIPTIVOS (¿Qué hacer?) ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green"><BrainIcon /></span>
              <div>
                <p className="text-sm font-bold text-slate-100">Insights del sistema — ¿Qué hacer ahora?</p>
                <p className="text-xs text-slate-500">Recomendaciones generadas automáticamente por los modelos de BI</p>
              </div>
            </div>

            {insights.length === 0 ? (
              <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 px-5 py-8 text-center">
                <p className="text-brand-green text-lg mb-1">✓ Todo en orden</p>
                <p className="text-xs text-slate-400">No hay alertas ni acciones pendientes. El negocio está saludable.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {insights.map((ins) => {
                  const cfg = insightConfig(ins.tipo, ins.prioridad);
                  return (
                    <div key={ins.id} className={`rounded-2xl border ${cfg.border} ${cfg.bg} px-5 py-4`}>
                      <div className="flex items-start gap-4">
                        <span className="text-2xl mt-0.5">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-slate-100">{ins.titulo}</span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}>
                              {ins.prioridad}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{ins.descripcion}</p>
                          <p className="text-[10px] text-slate-500 mt-1 font-mono">{ins.metrica}</p>
                        </div>
                        {ins.accion && (
                          <Link href={ins.accion.href}
                            className="shrink-0 flex items-center gap-1.5 rounded-2xl bg-white/10 border border-[#1e293b] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/15 transition-all">
                            {ins.accion.label} <ArrowIcon />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ SECCIÓN 2: KPIs RESUMEN (¿Qué pasó?) ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Ingresos este mes</div>
              <div className="text-2xl font-bold mt-1 text-brand-green">{fmtMoney(mesActualData?.bob ?? 0)}</div>
              {trendPct !== 0 && <div className={`text-xs mt-1 font-semibold ${trendPct >= 0 ? "text-brand-green" : "text-red-400"}`}>{trendPct >= 0 ? "↑" : "↓"} {Math.abs(trendPct)}% vs anterior</div>}
            </div>
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Tasa retención</div>
              <div className={`text-2xl font-bold mt-1 ${ultRet && ultRet.tasa >= 70 ? "text-brand-green" : "text-red-400"}`}>{ultRet?.tasa ?? 0}%</div>
              <div className="text-xs text-slate-500 mt-0.5">último mes cerrado</div>
            </div>
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Socios suscritos</div>
              <div className="text-2xl font-bold mt-1 text-sky-400">{totalSuscritos}</div>
              <div className="text-xs text-slate-500 mt-0.5">{totalSocios > 0 ? Math.round((totalSuscritos / totalSocios) * 100) : 0}% del total</div>
            </div>
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Pagos este mes</div>
              <div className="text-2xl font-bold mt-1 text-violet-400">{mesActualData?.count ?? 0}</div>
            </div>
          </div>

          {/* ═══ SECCIÓN 3: PRONÓSTICO (¿Qué va a pasar?) ═══ */}
          {pronostico.length > 0 && (
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green"><BrainIcon /></span>
                <div>
                  <p className="text-sm font-bold text-slate-100">¿Qué va a pasar? — Pronóstico de ingresos</p>
                  <p className="text-xs text-slate-400">3 modelos predictivos comparados · proyección 3 meses</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={pronostico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="real" name="Real" stroke="#76CB3E" fill="#76CB3E" fillOpacity={0.12} strokeWidth={2.5} connectNulls={false} />
                  <Line type="monotone" dataKey="regresion" name="Regresión Lineal" stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                  <Line type="monotone" dataKey="wma" name="Media Móvil Ponderada" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="holt" name="Holt (Exp. Doble)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                  <span className="text-xs font-bold text-violet-400">Regresión Lineal</span>
                  <p className="text-[10px] text-slate-500">Tendencia general. No captura estacionalidad.</p>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2">
                  <span className="text-xs font-bold text-amber-400">Media Móvil Ponderada</span>
                  <p className="text-[10px] text-slate-500">Promedio últimos 3 meses. Suaviza picos atípicos.</p>
                </div>
                <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-3 py-2">
                  <span className="text-xs font-bold text-sky-400">Holt (Exp. Doble)</span>
                  <p className="text-[10px] text-slate-500">Captura nivel + tendencia. Se adapta a cambios recientes.</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SECCIÓN 4: ANÁLISIS DESCRIPTIVO (¿Qué pasó?) ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Ingresos mensuales */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Ingresos mensuales</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ingresosMes.map((m) => ({ ...m, label: mesLabel(m.mes) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="bob" name="BOB" fill="#76CB3E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Retención */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Tasa de retención mensual</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={retencionMes.map((m) => ({ ...m, label: mesLabel(m.mes) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="tasa" name="Retención %" stroke="#76CB3E" strokeWidth={2.5} dot={{ fill: "#76CB3E", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Distribución por plan */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Distribución por plan</p>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={planDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                      {planDist.map((p, i) => <Cell key={i} fill={p.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-1">
                  {planDist.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-slate-300 text-xs">{p.name}</span></div>
                      <span className="font-bold text-slate-100 text-xs">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Nacionalidades */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Socios por nacionalidad</p>
              <div className="space-y-2">
                {nacionalidades.map((n) => {
                  const pct = totalSocios > 0 ? Math.round((n.count / totalSocios) * 100) : 0;
                  return (
                    <div key={n.pais} className="flex items-center gap-3">
                      <span className="text-lg">{n.flag}</span>
                      <span className="text-xs text-slate-300 w-20">{PAISES_MAP[n.pais]?.name ?? n.pais}</span>
                      <div className="flex-1 h-5 rounded-full bg-[#1e293b] overflow-hidden">
                        <div className="h-full bg-brand-green/40 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-100 w-12 text-right">{n.count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Heatmap de asistencias — evidencia para insights de hora pico/valle */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Mapa de calor — Asistencias por hora y día</p>
            <p className="text-[10px] text-slate-600 mb-4">Fuente de datos para los insights de ocupación. Últimos 30 días.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-slate-500">Hora</th>
                    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                      <th key={d} className="px-2 py-1 text-center text-slate-500">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {asistHoras.filter((h) => h.hora >= 6 && h.hora <= 21).map((h) => {
                    const vals = [h.lun, h.mar, h.mie, h.jue, h.vie, h.sab, h.dom];
                    const maxVal = Math.max(...asistHoras.flatMap((r) => [r.lun, r.mar, r.mie, r.jue, r.vie, r.sab, r.dom]), 1);
                    return (
                      <tr key={h.hora}>
                        <td className="px-2 py-1 text-slate-400 font-mono">{String(h.hora).padStart(2, "0")}:00</td>
                        {vals.map((v, i) => {
                          const intensity = v / maxVal;
                          const bg = v === 0 ? "bg-white/5" : intensity > 0.7 ? "bg-brand-green/40" : intensity > 0.4 ? "bg-brand-green/25" : "bg-brand-green/10";
                          return (
                            <td key={i} className="px-1 py-1 text-center">
                              <span className={`inline-block w-full rounded-lg py-1.5 text-[10px] font-bold ${bg} ${v > 0 ? "text-slate-200" : "text-slate-600"}`}>
                                {v || "·"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ COMPARATIVA ENTRE SUCURSALES (solo cuando "Todas") ═══ */}
          {selectedSucursal === null && comparativa.length > 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-400">📊</span>
                <div>
                  <p className="text-sm font-bold text-slate-100">Comparativa entre sucursales</p>
                  <p className="text-xs text-slate-500">Rendimiento del mes actual por sede</p>
                </div>
              </div>

              {/* Tarjetas comparativas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {comparativa.map((suc) => (
                  <div key={suc.id} className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
                    <p className="text-sm font-bold text-slate-100">📍 {suc.nombre}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Ingresos mes</div>
                        <div className="text-lg font-bold text-brand-green">{fmtMoney(suc.ingresosMes)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Asistencias mes</div>
                        <div className="text-lg font-bold text-sky-400">{suc.asistenciasMes}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Susc. activas</div>
                        <div className="text-lg font-bold text-violet-400">{suc.suscActivas}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Retención</div>
                        <div className={`text-lg font-bold ${suc.tasaRetencion >= 70 ? "text-brand-green" : "text-red-400"}`}>{suc.tasaRetencion}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Gráfico de barras comparativo */}
              <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Ingresos del mes por sucursal</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={comparativa} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v: number) => fmtMoney(v)} />
                    <YAxis type="category" dataKey="nombre" tick={{ fill: "#94a3b8", fontSize: 11 }} width={160} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="ingresosMes" name="Ingresos Bs" fill="#76CB3E" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla ranking */}
              <div className="rounded-2xl border border-[#1e293b] overflow-hidden">
                <div className="border-b border-[#1e293b] px-5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Ranking de sucursales</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e293b] bg-white/5">
                      <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">#</th>
                      <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Sucursal</th>
                      <th className="px-5 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ingresos</th>
                      <th className="px-5 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Asistencias</th>
                      <th className="px-5 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Suscritos</th>
                      <th className="px-5 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Retención</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...comparativa].sort((a, b) => b.ingresosMes - a.ingresosMes).map((suc, i) => (
                      <tr key={suc.id} className="border-b border-[#1e293b]/60 hover:bg-white/5">
                        <td className="px-5 py-3 text-slate-500 font-bold">{i + 1}</td>
                        <td className="px-5 py-3 font-semibold text-slate-100">{suc.nombre}</td>
                        <td className="px-5 py-3 text-right text-brand-green font-semibold">{fmtMoney(suc.ingresosMes)}</td>
                        <td className="px-5 py-3 text-right text-sky-400">{suc.asistenciasMes}</td>
                        <td className="px-5 py-3 text-right text-violet-400">{suc.suscActivas}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${suc.tasaRetencion >= 70 ? "border-brand-green/30 bg-brand-green/10 text-brand-green" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                            {suc.tasaRetencion}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Embudo */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Embudo de conversión</p>
            <div className="space-y-2">
              {[
                { label: "Registrados", value: totalSocios, color: "bg-slate-400", pct: 100 },
                { label: "Suscritos", value: totalSuscritos, color: "bg-brand-green", pct: totalSocios > 0 ? Math.round((totalSuscritos / totalSocios) * 100) : 0 },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-slate-400 text-right">{step.label}</span>
                  <div className="flex-1 h-8 rounded-xl bg-[#1e293b] overflow-hidden relative">
                    <div className={`h-full ${step.color} transition-all duration-700 rounded-xl flex items-center px-3`} style={{ width: `${step.pct}%` }}>
                      <span className="text-xs font-bold text-black">{step.value} ({step.pct}%)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
