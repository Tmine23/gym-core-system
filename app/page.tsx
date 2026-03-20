"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

const TZ = "America/La_Paz";
const SUCURSAL_ID = 1;
const CAPACITY = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBoDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}
function toBoTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function fmtMoney(n: number) {
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function getHour(iso: string) {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date(iso)));
}
function todayRange() {
  const d = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  return {
    start: new Date(`${d}T00:00:00-04:00`).toISOString(),
    end:   new Date(`${d}T23:59:59-04:00`).toISOString(),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SocioAdentro = { id: number; socio_id: number; fecha_entrada: string; socios: { nombre: string | null; apellido: string | null; foto_url: string | null } | null; };
type PagoRow = { id: number; monto_pagado: number; codigo_moneda: string; metodo_pago: string; fecha_pago: string; socios: { nombre: string | null; apellido: string | null } | null; };
type SocioRiesgo = { id: number; nombre: string | null; apellido: string | null; foto_url: string | null; diasAusente: number; };
type SubVencer = { id: number; fecha_fin: string; socios: { nombre: string | null; apellido: string | null } | null; planes: { nombre: string | null } | null; };
type CierreCaja = { id: number; efectivo_fisico_bob: number; efectivo_fisico_usd: number; notas: string | null; fecha_registro: string; };

// ── Icons ─────────────────────────────────────────────────────────────────────

function Icon({ path, className = "h-5 w-5" }: { path: string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d={path} /></svg>;
}
function UsersIcon() { return <Icon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />; }
function FlameIcon() { return <Icon path="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />; }
function AlertIcon() { return <Icon path="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" />; }
function CashIcon() { return <Icon path="M2 6h20v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6ZM2 10h20M6 14h2M10 14h2" />; }
function CalIcon() { return <Icon path="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" />; }
function TrendIcon() { return <Icon path="M3 17l4-4 4 4 4-4 4-4" />; }
function CheckIcon() { return <Icon path="M20 6 9 17l-5-5" />; }
function ClockIcon() { return <Icon path="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 6v6l4 2" />; }

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nombre, apellido, foto_url, size = "sm" }: { nombre: string | null; apellido: string | null; foto_url?: string | null; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  const initials = `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase() || "?";
  if (foto_url) return <img src={foto_url} className={`${dim} rounded-xl object-cover border border-[#1e293b] shrink-0`} alt="" />;
  return <div className={`${dim} rounded-xl border border-brand-green/20 bg-brand-green/10 flex items-center justify-center font-bold text-brand-green shrink-0`}>{initials}</div>;
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Operativo
  const [aforo, setAforo] = useState<number | null>(null);
  const [adentro, setAdentro] = useState<SocioAdentro[]>([]);
  const [entradasHoy, setEntradasHoy] = useState<{ hora: number; count: number }[]>([]);
  const [totalEntradasHoy, setTotalEntradasHoy] = useState(0);
  const [sociosRiesgo, setSociosRiesgo] = useState<SocioRiesgo[]>([]);
  const [cumples, setCumples] = useState<{ hoy: { nombre: string | null; apellido: string | null }[]; semana: { nombre: string | null; apellido: string | null }[] }>({ hoy: [], semana: [] });

  // Financiero
  const [ingresosMes, setIngresosMes] = useState<{ bob: number; usd: number }>({ bob: 0, usd: 0 });
  const [pagosHoy, setPagosHoy] = useState<PagoRow[]>([]);
  const [ingresos7dias, setIngresos7dias] = useState<{ fecha: string; bob: number }[]>([]);
  const [planesTop, setPlanesTop] = useState<{ nombre: string; count: number }[]>([]);
  const [subsPorVencer, setSubsPorVencer] = useState<SubVencer[]>([]);
  const [cierreCaja, setCierreCaja] = useState<CierreCaja | null>(null);
  const [modalCaja, setModalCaja] = useState(false);

  const [tab, setTab] = useState<"operativo" | "financiero">("operativo");

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    const { start, end } = todayRange();
    const now = new Date();
    const mesStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
    const in7days = new Date(now.getTime() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
    const hace60 = new Date(now.getTime() - 60 * 86400000).toISOString();

    const [
      aforoRes, adentroRes, entradasRes,
      riesgoAsisRes, sociosRes,
      cumpleRes,
      ingresosMesRes, pagosHoyRes, ingresos7Res,
      planesRes, subsRes,
      cierreRes,
    ] = await Promise.all([
      // Aforo
      supabase.from("asistencias").select("id", { count: "exact", head: true }).eq("sucursal_id", SUCURSAL_ID).is("fecha_salida", null),
      // Socios adentro ahora
      supabase.from("asistencias").select("id,socio_id,fecha_entrada,socios(nombre,apellido,foto_url)").eq("sucursal_id", SUCURSAL_ID).is("fecha_salida", null).order("fecha_entrada", { ascending: false }),
      // Entradas de hoy
      supabase.from("asistencias").select("fecha_entrada").eq("sucursal_id", SUCURSAL_ID).gte("fecha_entrada", start).lte("fecha_entrada", end),
      // Últimas asistencias para calcular riesgo
      supabase.from("asistencias").select("socio_id,fecha_entrada").gte("fecha_entrada", hace60).order("fecha_entrada", { ascending: false }),
      // Socios suscritos y activos
      supabase.from("socios").select("id,nombre,apellido,foto_url,es_activo,suscrito"),
      // Cumpleaños
      supabase.from("socios").select("nombre,apellido,fecha_nacimiento").eq("es_activo", true).not("fecha_nacimiento", "is", null),
      // Ingresos del mes
      supabase.from("pagos").select("monto_pagado,codigo_moneda").gte("fecha_pago", mesStart),
      // Pagos de hoy
      supabase.from("pagos").select("id,monto_pagado,codigo_moneda,metodo_pago,fecha_pago,socios(nombre,apellido)").gte("fecha_pago", start).lte("fecha_pago", end).order("fecha_pago", { ascending: false }),
      // Ingresos últimos 7 días
      supabase.from("pagos").select("monto_pagado,codigo_moneda,fecha_pago").gte("fecha_pago", new Date(now.getTime() - 7 * 86400000).toISOString()),
      // Planes más vendidos del mes
      supabase.from("suscripciones").select("planes(nombre)").gte("fecha_inicio", mesStart),
      // Suscripciones por vencer
      supabase.from("suscripciones").select("id,fecha_fin,socios(nombre,apellido),planes(nombre)").eq("estado", "ACTIVA").gte("fecha_fin", today).lte("fecha_fin", in7days).order("fecha_fin"),
      // Cierre de caja hoy
      supabase.from("cierres_caja").select("id,efectivo_fisico_bob,efectivo_fisico_usd,notas,fecha_registro").eq("sucursal_id", SUCURSAL_ID).eq("fecha", today).maybeSingle(),
    ]);

    // Aforo
    setAforo(aforoRes.count ?? 0);

    // Adentro
    setAdentro((adentroRes.data ?? []) as unknown as SocioAdentro[]);

    // Entradas hoy por hora
    const rawEntradas = entradasRes.data ?? [];
    setTotalEntradasHoy(rawEntradas.length);
    const byHour: Record<number, number> = {};
    for (const e of rawEntradas) { const h = getHour(e.fecha_entrada); byHour[h] = (byHour[h] ?? 0) + 1; }
    setEntradasHoy(Array.from({ length: 24 }, (_, h) => ({ hora: h, count: byHour[h] ?? 0 })));

    // Socios en riesgo (suscritos, activos, sin venir 10+ días)
    const lastVisit: Record<number, string> = {};
    for (const a of (riesgoAsisRes.data ?? [])) {
      if (!lastVisit[a.socio_id]) lastVisit[a.socio_id] = a.fecha_entrada;
    }
    const riesgo: SocioRiesgo[] = ((sociosRes.data ?? []) as { id: number; nombre: string | null; apellido: string | null; foto_url: string | null; es_activo: boolean; suscrito: boolean }[])
      .filter((s) => s.es_activo && s.suscrito)
      .map((s) => {
        const ultima = lastVisit[s.id] ?? null;
        const diasAusente = ultima
          ? Math.floor((new Date(today).getTime() - new Date(toBoDate(ultima)).getTime()) / 86400000)
          : 999;
        return { id: s.id, nombre: s.nombre, apellido: s.apellido, foto_url: s.foto_url, diasAusente };
      })
      .filter((s) => s.diasAusente >= 10)
      .sort((a, b) => b.diasAusente - a.diasAusente)
      .slice(0, 5);
    setSociosRiesgo(riesgo);

    // Cumpleaños
    const todayMD = today.slice(5); // MM-DD
    const in7MD = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() + i * 86400000);
      return d.toLocaleDateString("en-CA", { timeZone: TZ }).slice(5);
    });
    const cumpleData = (cumpleRes.data ?? []) as { nombre: string | null; apellido: string | null; fecha_nacimiento: string }[];
    setCumples({
      hoy: cumpleData.filter((s) => s.fecha_nacimiento?.slice(5) === todayMD),
      semana: cumpleData.filter((s) => in7MD.includes(s.fecha_nacimiento?.slice(5) ?? "")),
    });

    // Ingresos del mes
    const pagosM = ingresosMesRes.data ?? [];
    setIngresosMes({
      bob: pagosM.filter((p) => p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0),
      usd: pagosM.filter((p) => p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0),
    });

    // Pagos hoy
    setPagosHoy((pagosHoyRes.data ?? []) as unknown as PagoRow[]);

    // Ingresos 7 días
    const p7 = ingresos7Res.data ?? [];
    const byDay: Record<string, number> = {};
    for (const p of p7) {
      if (p.codigo_moneda !== "BOB") continue;
      const d = toBoDate(p.fecha_pago);
      byDay[d] = (byDay[d] ?? 0) + Number(p.monto_pagado);
    }
    const days7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
      return { fecha: d, bob: byDay[d] ?? 0 };
    });
    setIngresos7dias(days7);

    // Planes top
    const planCount: Record<string, number> = {};
    for (const s of (planesRes.data ?? []) as unknown as { planes: { nombre: string | null } | null }[]) {
      const n = s.planes?.nombre ?? "Sin nombre";
      planCount[n] = (planCount[n] ?? 0) + 1;
    }
    setPlanesTop(Object.entries(planCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([nombre, count]) => ({ nombre, count })));

    // Subs por vencer
    setSubsPorVencer((subsRes.data ?? []) as unknown as SubVencer[]);

    // Cierre de caja
    setCierreCaja(cierreRes.data as CierreCaja | null);
  }

  // Realtime aforo
  useEffect(() => {
    const ch = supabase.channel("dash-aforo")
      .on("postgres_changes", { event: "*", schema: "public", table: "asistencias" }, () => void loadAll())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const aforoPct = aforo !== null ? Math.round((aforo / CAPACITY) * 100) : 0;
  const aforoColor = aforoPct >= 90 ? "text-red-400" : aforoPct >= 70 ? "text-amber-300" : "text-brand-green";
  const aforoBar = aforoPct >= 90 ? "bg-red-400" : aforoPct >= 70 ? "bg-amber-300" : "bg-brand-green";

  // Semáforo retención
  const totalSuscritos = sociosRiesgo.length; // ya filtrado
  const semaforoColor = totalSuscritos === 0 ? "text-brand-green" : totalSuscritos <= 3 ? "text-amber-300" : "text-red-400";
  const semaforoBg = totalSuscritos === 0 ? "border-brand-green/30 bg-brand-green/10" : totalSuscritos <= 3 ? "border-amber-400/30 bg-amber-400/10" : "border-red-500/30 bg-red-500/10";

  // Gráfico 7 días
  const maxBob = Math.max(1, ...ingresos7dias.map((d) => d.bob));

  // Efectivo esperado hoy (pagos en efectivo)
  const efectivoEsperadoBob = pagosHoy.filter((p) => p.metodo_pago === "EFECTIVO" && p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0);
  const efectivoEsperadoUsd = pagosHoy.filter((p) => p.metodo_pago === "EFECTIVO" && p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="section-kicker">Sistema</div>
            <h1 className="section-title">Dashboard</h1>
            <p className="section-description">
              {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ })}
            </p>
          </div>
          {/* Aforo compacto en header */}
          <div className="rounded-2xl border border-[#1e293b] bg-[#0b1220] px-5 py-3 flex items-center gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Aforo</div>
              <div className={`text-3xl font-bold leading-none ${aforoColor}`}>{aforo ?? "…"}<span className="text-sm text-slate-500 ml-1">/ {CAPACITY}</span></div>
            </div>
            <div className="w-24">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div className={`h-full transition-all duration-500 ${aforoBar}`} style={{ width: `${aforoPct}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-slate-500 text-right">{aforoPct}%</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1 w-fit">
          {(["operativo", "financiero"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={["rounded-xl px-6 py-2 text-sm font-semibold transition-all capitalize", tab === t ? "bg-brand-green/15 text-brand-green border border-brand-green/30" : "text-slate-400 hover:text-slate-200"].join(" ")}>
              {t === "operativo" ? "⚡ Operativo" : "💰 Financiero"}
            </button>
          ))}
        </div>
      </div>

      {tab === "operativo" && (
        <OperativoTab
          aforo={aforo} aforoPct={aforoPct} aforoColor={aforoColor} aforoBar={aforoBar}
          adentro={adentro} totalEntradasHoy={totalEntradasHoy} entradasHoy={entradasHoy}
          sociosRiesgo={sociosRiesgo} semaforoColor={semaforoColor} semaforoBg={semaforoBg}
          cumples={cumples}
        />
      )}
      {tab === "financiero" && (
        <FinancieroTab
          ingresosMes={ingresosMes} pagosHoy={pagosHoy}
          ingresos7dias={ingresos7dias} maxBob={maxBob}
          planesTop={planesTop} subsPorVencer={subsPorVencer}
          cierreCaja={cierreCaja} setCierreCaja={setCierreCaja}
          efectivoEsperadoBob={efectivoEsperadoBob} efectivoEsperadoUsd={efectivoEsperadoUsd}
          modalCaja={modalCaja} setModalCaja={setModalCaja}
          onReload={loadAll}
        />
      )}
    </div>
  );
}

// ── Operativo Tab ─────────────────────────────────────────────────────────────

function OperativoTab({ adentro, totalEntradasHoy, entradasHoy, sociosRiesgo, semaforoColor, semaforoBg, cumples, aforo, aforoPct, aforoColor, aforoBar }: {
  aforo: number | null; aforoPct: number; aforoColor: string; aforoBar: string;
  adentro: SocioAdentro[]; totalEntradasHoy: number;
  entradasHoy: { hora: number; count: number }[];
  sociosRiesgo: SocioRiesgo[]; semaforoColor: string; semaforoBg: string;
  cumples: { hoy: { nombre: string | null; apellido: string | null }[]; semana: { nombre: string | null; apellido: string | null }[] };
}) {
  const maxHour = Math.max(1, ...entradasHoy.map((e) => e.count));

  return (
    <div className="space-y-6">
      {/* Fila 1: stats rápidos */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Adentro ahora", value: aforo ?? "…", color: aforoColor, sub: `${aforoPct}% del aforo` },
          { label: "Entradas hoy", value: totalEntradasHoy, color: "text-slate-100", sub: "sesiones registradas" },
          { label: "En riesgo", value: sociosRiesgo.length, color: sociosRiesgo.length === 0 ? "text-brand-green" : sociosRiesgo.length <= 3 ? "text-amber-300" : "text-red-400", sub: "sin venir 10+ días" },
          { label: "Cumpleaños hoy", value: cumples.hoy.length, color: cumples.hoy.length > 0 ? "text-pink-400" : "text-slate-500", sub: cumples.hoy.length > 0 ? cumples.hoy.map((c) => c.nombre).join(", ") : "ninguno hoy" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{s.label}</div>
            <div className={`mt-1 text-3xl font-bold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Socios adentro ahora */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Adentro ahora</p>
            <span className="flex items-center gap-1.5 text-xs text-brand-green">
              <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />
              En vivo
            </span>
          </div>
          {adentro.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Nadie adentro en este momento.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {adentro.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2">
                  <Avatar nombre={a.socios?.nombre ?? null} apellido={a.socios?.apellido ?? null} foto_url={a.socios?.foto_url} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {[a.socios?.nombre, a.socios?.apellido].filter(Boolean).join(" ") || "—"}
                    </div>
                    <div className="text-xs text-slate-500">Entró: {toBoTime(a.fecha_entrada)}</div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-brand-green shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mini gráfico entradas por hora */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Entradas por hora — hoy</p>
            <span className="text-xs text-slate-500">{totalEntradasHoy} total</span>
          </div>
          <div className="flex items-end gap-0.5 h-24">
            {entradasHoy.map(({ hora, count }) => {
              const pct = Math.round((count / maxHour) * 100);
              return (
                <div key={hora} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full rounded-sm transition-all"
                    style={{ height: `${Math.max(2, pct * 0.88)}px`, backgroundColor: count > 0 ? `rgba(118,203,62,${0.2 + pct / 100 * 0.8})` : "rgba(255,255,255,0.03)" }} />
                  {hora % 4 === 0 ? <span className="text-[8px] text-slate-600">{hora}</span> : <span className="text-[8px] text-transparent">·</span>}
                  {count > 0 ? (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-[#0b1220] border border-[#1e293b] px-1.5 py-0.5 text-[10px] text-slate-200 whitespace-nowrap z-10">
                      {hora}:00 — {count}x
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Semáforo de retención */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Semáforo de retención</p>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${semaforoBg} ${semaforoColor}`}>
              <span className={`h-2 w-2 rounded-full ${sociosRiesgo.length === 0 ? "bg-brand-green" : sociosRiesgo.length <= 3 ? "bg-amber-300" : "bg-red-400"}`} />
              {sociosRiesgo.length === 0 ? "Todo bien" : sociosRiesgo.length <= 3 ? "Atención" : "Crítico"}
            </span>
          </div>
          {sociosRiesgo.length === 0 ? (
            <div className="rounded-xl border border-brand-green/20 bg-brand-green/5 px-4 py-5 text-center">
              <p className="text-sm font-semibold text-brand-green">Todos los socios suscritos han asistido recientemente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sociosRiesgo.map((s) => (
                <div key={s.id} className={["flex items-center gap-3 rounded-xl border px-3 py-2", s.diasAusente >= 20 ? "border-red-500/20 bg-red-500/5" : "border-amber-400/15 bg-amber-400/5"].join(" ")}>
                  <Avatar nombre={s.nombre} apellido={s.apellido} foto_url={s.foto_url} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">{[s.nombre, s.apellido].filter(Boolean).join(" ")}</div>
                    <div className="text-xs text-slate-500">{s.diasAusente >= 999 ? "Nunca ha asistido" : `Sin venir hace ${s.diasAusente} días`}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${s.diasAusente >= 20 ? "border-red-500/30 text-red-400" : "border-amber-400/30 text-amber-300"}`}>
                    {s.diasAusente >= 999 ? "Nunca" : `${s.diasAusente}d`}
                  </span>
                </div>
              ))}
              <Link href="/asistencias" className="block text-center text-xs text-slate-500 hover:text-brand-green transition-colors pt-1">
                Ver todos →
              </Link>
            </div>
          )}
        </div>

        {/* Cumpleaños */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-100">🎂 Cumpleaños</p>
          {cumples.hoy.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-400">Hoy</p>
              {cumples.hoy.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-pink-500/20 bg-pink-500/5 px-3 py-2">
                  <span className="text-base">🎉</span>
                  <span className="text-sm font-semibold text-slate-100">{[c.nombre, c.apellido].filter(Boolean).join(" ")}</span>
                </div>
              ))}
            </div>
          )}
          {cumples.semana.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Esta semana</p>
              {cumples.semana.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2">
                  <span className="text-sm">🎈</span>
                  <span className="text-sm text-slate-300">{[c.nombre, c.apellido].filter(Boolean).join(" ")}</span>
                </div>
              ))}
            </div>
          ) : cumples.hoy.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Sin cumpleaños esta semana.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Financiero Tab ────────────────────────────────────────────────────────────

function FinancieroTab({ ingresosMes, pagosHoy, ingresos7dias, maxBob, planesTop, subsPorVencer, cierreCaja, setCierreCaja, efectivoEsperadoBob, efectivoEsperadoUsd, modalCaja, setModalCaja, onReload }: {
  ingresosMes: { bob: number; usd: number };
  pagosHoy: PagoRow[];
  ingresos7dias: { fecha: string; bob: number }[];
  maxBob: number;
  planesTop: { nombre: string; count: number }[];
  subsPorVencer: SubVencer[];
  cierreCaja: CierreCaja | null;
  setCierreCaja: (c: CierreCaja | null) => void;
  efectivoEsperadoBob: number;
  efectivoEsperadoUsd: number;
  modalCaja: boolean;
  setModalCaja: (v: boolean) => void;
  onReload: () => void;
}) {
  const totalPagosHoyBob = pagosHoy.filter((p) => p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0);
  const totalPagosHoyUsd = pagosHoy.filter((p) => p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0);
  const maxPlan = Math.max(1, ...planesTop.map((p) => p.count));

  return (
    <div className="space-y-6">
      {/* Fila 1: ingresos del mes */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Ingresos mes (BOB)", value: `Bs ${fmtMoney(ingresosMes.bob)}`, color: "text-brand-green" },
          { label: "Ingresos mes (USD)", value: `$ ${fmtMoney(ingresosMes.usd)}`, color: "text-sky-400" },
          { label: "Pagos hoy (BOB)", value: `Bs ${fmtMoney(totalPagosHoyBob)}`, color: "text-slate-100" },
          { label: "Pagos hoy (USD)", value: `$ ${fmtMoney(totalPagosHoyUsd)}`, color: "text-slate-100" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{s.label}</div>
            <div className={`mt-1 text-xl font-bold leading-tight ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico 7 días */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-100">Ingresos BOB — últimos 7 días</p>
          <div className="flex items-end gap-1 h-28">
            {ingresos7dias.map(({ fecha, bob }) => {
              const pct = Math.round((bob / maxBob) * 100);
              const label = new Date(fecha + "T12:00:00").toLocaleDateString("es-BO", { weekday: "short", timeZone: TZ });
              const isToday = fecha === new Date().toLocaleDateString("en-CA", { timeZone: TZ });
              return (
                <div key={fecha} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full rounded-t-sm transition-all"
                    style={{ height: `${Math.max(3, pct * 1.0)}px`, backgroundColor: isToday ? "rgba(118,203,62,0.9)" : bob > 0 ? "rgba(118,203,62,0.35)" : "rgba(255,255,255,0.04)" }} />
                  <span className={`text-[9px] ${isToday ? "text-brand-green font-bold" : "text-slate-600"}`}>{label}</span>
                  {bob > 0 ? (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-[#0b1220] border border-[#1e293b] px-2 py-0.5 text-[10px] text-slate-200 whitespace-nowrap z-10">
                      Bs {fmtMoney(bob)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Planes más vendidos */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-100">Planes más vendidos — este mes</p>
          {planesTop.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Sin ventas este mes.</p>
          ) : (
            <div className="space-y-3">
              {planesTop.map((p, i) => {
                const pct = Math.round((p.count / maxPlan) * 100);
                return (
                  <div key={p.nombre} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 truncate">{i + 1}. {p.nombre}</span>
                      <span className="font-bold text-brand-green ml-2 shrink-0">{p.count}x</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Suscripciones por vencer */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Suscripciones por vencer</p>
            <span className="text-xs text-slate-500">próximos 7 días</span>
          </div>
          {subsPorVencer.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Ninguna suscripción vence esta semana.</p>
          ) : (
            <div className="space-y-2">
              {subsPorVencer.map((s) => {
                const diasRestantes = Math.ceil((new Date(s.fecha_fin).getTime() - Date.now()) / 86400000);
                const urgente = diasRestantes <= 2;
                return (
                  <div key={s.id} className={["flex items-center gap-3 rounded-xl border px-3 py-2", urgente ? "border-red-500/20 bg-red-500/5" : "border-amber-400/15 bg-amber-400/5"].join(" ")}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {[s.socios?.nombre, s.socios?.apellido].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{s.planes?.nombre ?? "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold ${urgente ? "text-red-400" : "text-amber-300"}`}>
                        {diasRestantes === 0 ? "Hoy" : diasRestantes === 1 ? "Mañana" : `${diasRestantes}d`}
                      </div>
                      <div className="text-[10px] text-slate-500">{s.fecha_fin}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cierre de caja virtual */}
        <CierreCajaWidget
          cierreCaja={cierreCaja}
          efectivoEsperadoBob={efectivoEsperadoBob}
          efectivoEsperadoUsd={efectivoEsperadoUsd}
          onOpen={() => setModalCaja(true)}
        />
      </div>

      {/* Pagos de hoy */}
      {pagosHoy.length > 0 && (
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-100">Pagos registrados hoy</p>
          <div className="space-y-2">
            {pagosHoy.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">
                    {[p.socios?.nombre, p.socios?.apellido].filter(Boolean).join(" ") || "—"}
                  </div>
                  <div className="text-xs text-slate-500">{p.metodo_pago} · {toBoTime(p.fecha_pago)}</div>
                </div>
                <div className={`text-sm font-bold ${p.codigo_moneda === "BOB" ? "text-brand-green" : "text-sky-400"}`}>
                  {p.codigo_moneda === "BOB" ? "Bs" : "$"} {fmtMoney(Number(p.monto_pagado))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalCaja && (
        <ModalCierre
          efectivoEsperadoBob={efectivoEsperadoBob}
          efectivoEsperadoUsd={efectivoEsperadoUsd}
          existing={cierreCaja}
          onClose={() => setModalCaja(false)}
          onSaved={(c) => { setCierreCaja(c); setModalCaja(false); onReload(); }}
        />
      )}
    </div>
  );
}

// ── Cierre de Caja Widget ─────────────────────────────────────────────────────

function CierreCajaWidget({ cierreCaja, efectivoEsperadoBob, efectivoEsperadoUsd, onOpen }: {
  cierreCaja: CierreCaja | null;
  efectivoEsperadoBob: number;
  efectivoEsperadoUsd: number;
  onOpen: () => void;
}) {
  const difBob = cierreCaja ? Number(cierreCaja.efectivo_fisico_bob) - efectivoEsperadoBob : null;
  const difUsd = cierreCaja ? Number(cierreCaja.efectivo_fisico_usd) - efectivoEsperadoUsd : null;

  return (
    <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">Cierre de caja virtual</p>
        <button onClick={onOpen}
          className="rounded-xl border border-brand-green/30 bg-brand-green/10 px-3 py-1.5 text-xs font-semibold text-brand-green hover:bg-brand-green/20 transition-all">
          {cierreCaja ? "Actualizar" : "Registrar efectivo"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Esperado BOB</div>
          <div className="text-lg font-bold text-slate-100">Bs {fmtMoney(efectivoEsperadoBob)}</div>
        </div>
        <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Esperado USD</div>
          <div className="text-lg font-bold text-slate-100">$ {fmtMoney(efectivoEsperadoUsd)}</div>
        </div>
      </div>

      {cierreCaja ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Físico BOB</div>
              <div className="text-lg font-bold text-brand-green">Bs {fmtMoney(Number(cierreCaja.efectivo_fisico_bob))}</div>
            </div>
            <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Físico USD</div>
              <div className="text-lg font-bold text-sky-400">$ {fmtMoney(Number(cierreCaja.efectivo_fisico_usd))}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Diferencia BOB", val: difBob!, currency: "Bs" },
              { label: "Diferencia USD", val: difUsd!, currency: "$" },
            ].map(({ label, val, currency }) => {
              const color = Math.abs(val) < 0.01 ? "text-brand-green" : val > 0 ? "text-sky-400" : "text-red-400";
              const sign = val > 0.01 ? "+" : "";
              return (
                <div key={label} className={["rounded-xl border px-3 py-3", Math.abs(val) < 0.01 ? "border-brand-green/20 bg-brand-green/5" : val > 0 ? "border-sky-400/20 bg-sky-400/5" : "border-red-500/20 bg-red-500/5"].join(" ")}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
                  <div className={`text-lg font-bold ${color}`}>{sign}{currency} {fmtMoney(Math.abs(val))}</div>
                </div>
              );
            })}
          </div>
          {cierreCaja.notas && <p className="text-xs text-slate-500 italic">"{cierreCaja.notas}"</p>}
        </>
      ) : (
        <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-4 py-4 text-center">
          <p className="text-sm text-slate-500">Aún no se ha registrado el efectivo físico de hoy.</p>
        </div>
      )}
    </div>
  );
}

// ── Modal Cierre de Caja ──────────────────────────────────────────────────────

function ModalCierre({ efectivoEsperadoBob, efectivoEsperadoUsd, existing, onClose, onSaved }: {
  efectivoEsperadoBob: number;
  efectivoEsperadoUsd: number;
  existing: CierreCaja | null;
  onClose: () => void;
  onSaved: (c: CierreCaja) => void;
}) {
  const [bob, setBob] = useState(existing ? String(existing.efectivo_fisico_bob) : "");
  const [usd, setUsd] = useState(existing ? String(existing.efectivo_fisico_usd) : "");
  const [notas, setNotas] = useState(existing?.notas ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  async function handleSave() {
    const bobVal = parseFloat(bob) || 0;
    const usdVal = parseFloat(usd) || 0;
    setSaving(true); setError("");

    const payload = { sucursal_id: SUCURSAL_ID, empleado_id: 1, fecha: today, efectivo_fisico_bob: bobVal, efectivo_fisico_usd: usdVal, notas: notas.trim() || null };

    let result;
    if (existing) {
      result = await supabase.from("cierres_caja").update(payload).eq("id", existing.id).select().single();
    } else {
      result = await supabase.from("cierres_caja").insert(payload).select().single();
    }

    setSaving(false);
    if (result.error) { setError("Error al guardar. Intenta de nuevo."); return; }
    onSaved(result.data as CierreCaja);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#1e293b] bg-[#0b1220] p-6 space-y-5 shadow-2xl">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Cierre de caja — hoy</h2>
          <p className="text-xs text-slate-500 mt-0.5">Ingresa el efectivo físico contado en caja.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
          <div className="rounded-xl border border-[#1e293b] bg-white/5 px-3 py-2">
            <div className="uppercase tracking-wide">Esperado BOB</div>
            <div className="text-base font-bold text-slate-300">Bs {fmtMoney(efectivoEsperadoBob)}</div>
          </div>
          <div className="rounded-xl border border-[#1e293b] bg-white/5 px-3 py-2">
            <div className="uppercase tracking-wide">Esperado USD</div>
            <div className="text-base font-bold text-slate-300">$ {fmtMoney(efectivoEsperadoUsd)}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Efectivo físico BOB</label>
            <input type="number" min="0" step="0.01" value={bob} onChange={(e) => setBob(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border border-[#1e293b] bg-[#020617] px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Efectivo físico USD</label>
            <input type="number" min="0" step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border border-[#1e293b] bg-[#020617] px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Notas (opcional)</label>
            <input value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: faltaron Bs 20 por cambio…"
              className="mt-1 w-full rounded-xl border border-[#1e293b] bg-[#020617] px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50 text-sm" />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[#1e293b] bg-white/5 py-3 text-sm font-semibold text-slate-400 hover:text-slate-100 transition-all">
            Cancelar
          </button>
          <button onClick={() => void handleSave()} disabled={saving}
            className="flex-1 rounded-xl border border-brand-green bg-brand-green py-3 text-sm font-bold text-black hover:opacity-95 disabled:opacity-50 transition-all">
            {saving ? "Guardando…" : "Guardar cierre"}
          </button>
        </div>
      </div>
    </div>
  );
}
