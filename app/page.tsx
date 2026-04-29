"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const TZ = "America/La_Paz";
const DEFAULT_SUCURSAL_ID = 1;
const DEFAULT_CAPACITY = 50;

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
    end: new Date(`${d}T23:59:59-04:00`).toISOString(),
  };
}
function pctChange(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SocioAdentro = { id: number; socio_id: number; fecha_entrada: string; socios: { nombre: string | null; apellido: string | null; foto_url: string | null } | null; };
type PagoRow = { id: number; monto_pagado: number; codigo_moneda: string; metodo_pago: string; fecha_pago: string; socios: { nombre: string | null; apellido: string | null } | null; };
type SocioRiesgo = { id: number; nombre: string | null; apellido: string | null; foto_url: string | null; diasAusente: number; };
type SubVencer = { id: number; fecha_fin: string; socios: { nombre: string | null; apellido: string | null } | null; planes: { nombre: string | null } | null; };

// ── Icons ─────────────────────────────────────────────────────────────────────

function Icon({ path, className = "h-5 w-5" }: { path: string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d={path} /></svg>;
}
function ArrowUpIcon() { return <Icon path="M12 19V5M5 12l7-7 7 7" className="h-3 w-3" />; }
function ArrowDownIcon() { return <Icon path="M12 5v14M5 12l7 7 7-7" className="h-3 w-3" />; }

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nombre, apellido, foto_url, size = "sm" }: { nombre: string | null; apellido: string | null; foto_url?: string | null; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  const initials = `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase() || "?";
  if (foto_url) return <img src={foto_url} className={`${dim} rounded-xl object-cover border border-[#1e293b] shrink-0`} alt="" />;
  return <div className={`${dim} rounded-xl border border-brand-green/20 bg-brand-green/10 flex items-center justify-center font-bold text-brand-green shrink-0`}>{initials}</div>;
}

// ── Delta Badge ───────────────────────────────────────────────────────────────

function DeltaBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-[10px] text-slate-500">= igual que mes anterior</span>;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? "text-brand-green" : "text-red-400"}`}>
      {up ? <ArrowUpIcon /> : <ArrowDownIcon />}
      {Math.abs(pct)}% vs mes anterior
    </span>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Sucursal dinámica
  const [sucursalId, setSucursalId] = useState<number>(DEFAULT_SUCURSAL_ID);
  const [capacity, setCapacity] = useState<number>(DEFAULT_CAPACITY);

  // Operativo
  const [aforo, setAforo] = useState<number | null>(null);
  const [adentro, setAdentro] = useState<SocioAdentro[]>([]);
  const [entradasHoy, setEntradasHoy] = useState<{ hora: number; count: number }[]>([]);
  const [totalEntradasHoy, setTotalEntradasHoy] = useState(0);
  const [sociosRiesgo, setSociosRiesgo] = useState<SocioRiesgo[]>([]);
  const [cumples, setCumples] = useState<{ hoy: { nombre: string | null; apellido: string | null }[]; semana: { nombre: string | null; apellido: string | null }[] }>({ hoy: [], semana: [] });
  const [sociosNuevosMes, setSociosNuevosMes] = useState(0);
  const [sociosNuevosMesAnterior, setSociosNuevosMesAnterior] = useState(0);
  const [totalSuscritos, setTotalSuscritos] = useState(0);
  const [asistieronSemana, setAsistieronSemana] = useState(0);

  // Financiero
  const [ingresosMes, setIngresosMes] = useState<{ bob: number; usd: number }>({ bob: 0, usd: 0 });
  const [ingresosMesAnterior, setIngresosMesAnterior] = useState<{ bob: number; usd: number }>({ bob: 0, usd: 0 });
  const [pagosHoy, setPagosHoy] = useState<PagoRow[]>([]);
  const [ingresos7dias, setIngresos7dias] = useState<{ fecha: string; bob: number }[]>([]);
  const [planesTop, setPlanesTop] = useState<{ nombre: string; count: number }[]>([]);
  const [subsPorVencer, setSubsPorVencer] = useState<SubVencer[]>([]);

  const [tab, setTab] = useState<"operativo" | "financiero">("operativo");

  useEffect(() => {
    async function init() {
      // Cargar sucursal activa desde la base de datos
      const { data: sucursalData } = await supabase
        .from("sucursales")
        .select("id, capacidad_maxima")
        .eq("esta_activa", true)
        .limit(1)
        .single();

      const sid = sucursalData?.id ?? DEFAULT_SUCURSAL_ID;
      const cap = sucursalData?.capacidad_maxima ?? DEFAULT_CAPACITY;
      setSucursalId(sid);
      setCapacity(cap);

      void loadAll(sid);
    }
    void init();
  }, []);

  async function loadAll(sucId: number = sucursalId) {
    const { start, end } = todayRange();
    const now = new Date();
    const mesStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
    const in7days = new Date(now.getTime() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
    const hace60 = new Date(now.getTime() - 60 * 86400000).toISOString();
    const hace7 = new Date(now.getTime() - 7 * 86400000).toISOString();

    // Mes anterior
    const mesAnteriorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesAnteriorStart = `${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth() + 1).padStart(2, "0")}-01`;
    const mesAnteriorEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const [
      aforoRes, adentroRes, entradasRes,
      riesgoAsisRes, sociosRes,
      cumpleRes,
      ingresosMesRes, ingresosMesAntRes,
      pagosHoyRes, ingresos7Res,
      planesRes, subsRes,
      sociosNuevosMesRes, sociosNuevosMesAntRes,
      asistieronSemanaRes,
    ] = await Promise.all([
      supabase.from("asistencias").select("id", { count: "exact", head: true }).eq("sucursal_id", sucId).is("fecha_salida", null),
      supabase.from("asistencias").select("id,socio_id,fecha_entrada,socios(nombre,apellido,foto_url)").eq("sucursal_id", sucId).is("fecha_salida", null).order("fecha_entrada", { ascending: false }),
      supabase.from("asistencias").select("fecha_entrada").eq("sucursal_id", sucId).gte("fecha_entrada", start).lte("fecha_entrada", end),
      supabase.from("asistencias").select("socio_id,fecha_entrada").gte("fecha_entrada", hace60).order("fecha_entrada", { ascending: false }),
      supabase.from("socios").select("id,nombre,apellido,foto_url,es_activo,suscrito"),
      supabase.from("socios").select("nombre,apellido,fecha_nacimiento").eq("es_activo", true).not("fecha_nacimiento", "is", null),
      supabase.from("pagos").select("monto_pagado,codigo_moneda").gte("fecha_pago", mesStart),
      supabase.from("pagos").select("monto_pagado,codigo_moneda").gte("fecha_pago", mesAnteriorStart).lt("fecha_pago", mesAnteriorEnd),
      supabase.from("pagos").select("id,monto_pagado,codigo_moneda,metodo_pago,fecha_pago,socios(nombre,apellido)").gte("fecha_pago", start).lte("fecha_pago", end).order("fecha_pago", { ascending: false }),
      supabase.from("pagos").select("monto_pagado,codigo_moneda,fecha_pago").gte("fecha_pago", new Date(now.getTime() - 7 * 86400000).toISOString()),
      supabase.from("suscripciones").select("planes(nombre)").gte("fecha_inicio", mesStart),
      supabase.from("suscripciones").select("id,fecha_fin,socios(nombre,apellido),planes(nombre)").eq("estado", "ACTIVA").gte("fecha_fin", today).lte("fecha_fin", in7days).order("fecha_fin"),
      // Socios nuevos este mes
      supabase.from("socios").select("id", { count: "exact", head: true }).gte("fecha_registro", mesStart),
      // Socios nuevos mes anterior
      supabase.from("socios").select("id", { count: "exact", head: true }).gte("fecha_registro", mesAnteriorStart).lt("fecha_registro", mesAnteriorEnd),
      // Socios suscritos que asistieron esta semana (retención)
      supabase.from("asistencias").select("socio_id").gte("fecha_entrada", hace7),
    ]);

    setAforo(aforoRes.count ?? 0);
    setAdentro((adentroRes.data ?? []) as unknown as SocioAdentro[]);

    const rawEntradas = entradasRes.data ?? [];
    setTotalEntradasHoy(rawEntradas.length);
    const byHour: Record<number, number> = {};
    for (const e of rawEntradas) { const h = getHour(e.fecha_entrada); byHour[h] = (byHour[h] ?? 0) + 1; }
    setEntradasHoy(Array.from({ length: 24 }, (_, h) => ({ hora: h, count: byHour[h] ?? 0 })));

    const lastVisit: Record<number, string> = {};
    for (const a of (riesgoAsisRes.data ?? [])) {
      if (!lastVisit[a.socio_id]) lastVisit[a.socio_id] = a.fecha_entrada;
    }
    const allSocios = (sociosRes.data ?? []) as { id: number; nombre: string | null; apellido: string | null; foto_url: string | null; es_activo: boolean; suscrito: boolean }[];
    const suscritosActivos = allSocios.filter((s) => s.es_activo && s.suscrito);
    setTotalSuscritos(suscritosActivos.length);

    const riesgo: SocioRiesgo[] = suscritosActivos
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

    // Retención: socios suscritos que asistieron en los últimos 7 días
    const asistieronIds = new Set((asistieronSemanaRes.data ?? []).map((a) => a.socio_id));
    setAsistieronSemana(suscritosActivos.filter((s) => asistieronIds.has(s.id)).length);

    const todayMD = today.slice(5);
    const in7MD = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() + i * 86400000);
      return d.toLocaleDateString("en-CA", { timeZone: TZ }).slice(5);
    });
    const cumpleData = (cumpleRes.data ?? []) as { nombre: string | null; apellido: string | null; fecha_nacimiento: string }[];
    setCumples({
      hoy: cumpleData.filter((s) => s.fecha_nacimiento?.slice(5) === todayMD),
      semana: cumpleData.filter((s) => in7MD.includes(s.fecha_nacimiento?.slice(5) ?? "")),
    });

    const pagosM = ingresosMesRes.data ?? [];
    setIngresosMes({
      bob: pagosM.filter((p) => p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0),
      usd: pagosM.filter((p) => p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0),
    });

    const pagosMAnt = ingresosMesAntRes.data ?? [];
    setIngresosMesAnterior({
      bob: pagosMAnt.filter((p) => p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0),
      usd: pagosMAnt.filter((p) => p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0),
    });

    setPagosHoy((pagosHoyRes.data ?? []) as unknown as PagoRow[]);

    const p7 = ingresos7Res.data ?? [];
    const byDay: Record<string, number> = {};
    for (const p of p7) {
      if (p.codigo_moneda !== "BOB") continue;
      const d = toBoDate(p.fecha_pago);
      byDay[d] = (byDay[d] ?? 0) + Number(p.monto_pagado);
    }
    setIngresos7dias(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
      return { fecha: d, bob: byDay[d] ?? 0 };
    }));

    const planCount: Record<string, number> = {};
    for (const s of (planesRes.data ?? []) as unknown as { planes: { nombre: string | null } | null }[]) {
      const n = s.planes?.nombre ?? "Sin nombre";
      planCount[n] = (planCount[n] ?? 0) + 1;
    }
    setPlanesTop(Object.entries(planCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([nombre, count]) => ({ nombre, count })));

    setSubsPorVencer((subsRes.data ?? []) as unknown as SubVencer[]);
    setSociosNuevosMes(sociosNuevosMesRes.count ?? 0);
    setSociosNuevosMesAnterior(sociosNuevosMesAntRes.count ?? 0);
  }

  useEffect(() => {
    const ch = supabase.channel("dash-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "asistencias" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "socios" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "sucursales" }, async () => {
        // Recargar configuración de sucursal cuando cambia
        const { data: sucursalData } = await supabase
          .from("sucursales")
          .select("id, capacidad_maxima")
          .eq("esta_activa", true)
          .limit(1)
          .single();
        const sid = sucursalData?.id ?? DEFAULT_SUCURSAL_ID;
        const cap = sucursalData?.capacidad_maxima ?? DEFAULT_CAPACITY;
        setSucursalId(sid);
        setCapacity(cap);
        void loadAll(sid);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const aforoPct = aforo !== null ? Math.round((aforo / capacity) * 100) : 0;
  const aforoColor = aforoPct >= 90 ? "text-red-400" : aforoPct >= 70 ? "text-amber-300" : "text-brand-green";
  const aforoBar = aforoPct >= 90 ? "bg-red-400" : aforoPct >= 70 ? "bg-amber-300" : "bg-brand-green";
  const semaforoColor = sociosRiesgo.length === 0 ? "text-brand-green" : sociosRiesgo.length <= 3 ? "text-amber-300" : "text-red-400";
  const semaforoBg = sociosRiesgo.length === 0 ? "border-brand-green/30 bg-brand-green/10" : sociosRiesgo.length <= 3 ? "border-amber-400/30 bg-amber-400/10" : "border-red-500/30 bg-red-500/10";
  const maxBob = Math.max(1, ...ingresos7dias.map((d) => d.bob));
  const retencionPct = totalSuscritos > 0 ? Math.round((asistieronSemana / totalSuscritos) * 100) : 0;

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
          <div className="rounded-2xl border border-[#1e293b] bg-[#0b1220] px-5 py-3 flex items-center gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Aforo</div>
              <div className={`text-3xl font-bold leading-none ${aforoColor}`}>{aforo ?? "…"}<span className="text-sm text-slate-500 ml-1">/ {capacity}</span></div>
            </div>
            <div className="w-24">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div className={`h-full transition-all duration-500 ${aforoBar}`} style={{ width: `${aforoPct}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-slate-500 text-right">{aforoPct}%</div>
            </div>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { href: "/recepcion", label: "↓ Registrar entrada", color: "border-brand-green/40 bg-brand-green/10 text-brand-green hover:bg-brand-green/20" },
            { href: "/pagos", label: "💳 Registrar pago", color: "border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20" },
            { href: "/socios", label: "👤 Ver socios", color: "border-[#1e293b] bg-white/5 text-slate-300 hover:bg-white/10" },
            { href: "/asistencias", label: "📊 Asistencias", color: "border-[#1e293b] bg-white/5 text-slate-300 hover:bg-white/10" },
          ].map((a) => (
            <Link key={a.href} href={a.href}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${a.color}`}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tabs — separados del header, pegados al contenido que controlan */}
      <div className="flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1 w-fit">
        {(["operativo", "financiero"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={["rounded-xl px-6 py-2 text-sm font-semibold transition-all", tab === t ? "bg-brand-green/15 text-brand-green border border-brand-green/30" : "text-slate-400 hover:text-slate-200"].join(" ")}>
            {t === "operativo" ? "⚡ Operativo" : "💰 Financiero"}
          </button>
        ))}
      </div>

      {tab === "operativo" && (
        <OperativoTab
          aforo={aforo} aforoPct={aforoPct} aforoColor={aforoColor} aforoBar={aforoBar}
          adentro={adentro} totalEntradasHoy={totalEntradasHoy} entradasHoy={entradasHoy}
          sociosRiesgo={sociosRiesgo} semaforoColor={semaforoColor} semaforoBg={semaforoBg}
          cumples={cumples}
          sociosNuevosMes={sociosNuevosMes}
          sociosNuevosMesAnterior={sociosNuevosMesAnterior}
          retencionPct={retencionPct}
          asistieronSemana={asistieronSemana}
          totalSuscritos={totalSuscritos}
        />
      )}
      {tab === "financiero" && (
        <FinancieroTab
          ingresosMes={ingresosMes} ingresosMesAnterior={ingresosMesAnterior}
          pagosHoy={pagosHoy}
          ingresos7dias={ingresos7dias} maxBob={maxBob}
          planesTop={planesTop} subsPorVencer={subsPorVencer}
        />
      )}
    </div>
  );
}

// ── Operativo Tab ─────────────────────────────────────────────────────────────

function OperativoTab({ adentro, totalEntradasHoy, entradasHoy, sociosRiesgo, semaforoColor, semaforoBg, cumples, aforo, aforoPct, aforoColor, sociosNuevosMes, sociosNuevosMesAnterior, retencionPct, asistieronSemana, totalSuscritos }: {
  aforo: number | null; aforoPct: number; aforoColor: string; aforoBar?: string;
  adentro: SocioAdentro[]; totalEntradasHoy: number;
  entradasHoy: { hora: number; count: number }[];
  sociosRiesgo: SocioRiesgo[]; semaforoColor: string; semaforoBg: string;
  cumples: { hoy: { nombre: string | null; apellido: string | null }[]; semana: { nombre: string | null; apellido: string | null }[] };
  sociosNuevosMes: number; sociosNuevosMesAnterior: number;
  retencionPct: number; asistieronSemana: number; totalSuscritos: number;
}) {
  const maxHour = Math.max(1, ...entradasHoy.map((e) => e.count));
  const deltaNuevos = pctChange(sociosNuevosMes, sociosNuevosMesAnterior);
  const retencionColor = retencionPct >= 70 ? "text-brand-green" : retencionPct >= 40 ? "text-amber-300" : "text-red-400";
  const retencionBar = retencionPct >= 70 ? "bg-brand-green" : retencionPct >= 40 ? "bg-amber-300" : "bg-red-400";

  return (
    <div className="space-y-6">
      {/* Stats rápidos — ahora con socios nuevos y retención */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Adentro ahora</div>
          <div className={`mt-1 text-3xl font-bold leading-none ${aforoColor}`}>{aforo ?? "…"}</div>
          <div className="mt-1 text-[11px] text-slate-500">{aforoPct}% del aforo</div>
        </div>
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Entradas hoy</div>
          <div className="mt-1 text-3xl font-bold leading-none text-slate-100">{totalEntradasHoy}</div>
          <div className="mt-1 text-[11px] text-slate-500">sesiones registradas</div>
        </div>
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Socios nuevos</div>
          <div className="mt-1 text-3xl font-bold leading-none text-violet-400">{sociosNuevosMes}</div>
          <div className="mt-1"><DeltaBadge pct={deltaNuevos} /></div>
        </div>
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Cumpleaños hoy</div>
          <div className={`mt-1 text-3xl font-bold leading-none ${cumples.hoy.length > 0 ? "text-pink-400" : "text-slate-500"}`}>{cumples.hoy.length}</div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">{cumples.hoy.length > 0 ? cumples.hoy.map((c) => c.nombre).join(", ") : "ninguno hoy"}</div>
        </div>
      </div>

      {/* Retención semanal — card destacada */}
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tasa de retención — últimos 7 días</p>
            <p className="text-xs text-slate-600 mt-0.5">{asistieronSemana} de {totalSuscritos} socios suscritos asistieron esta semana</p>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-bold ${retencionColor}`}>{retencionPct}%</span>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div className={`h-full rounded-full transition-all duration-700 ${retencionBar}`} style={{ width: `${retencionPct}%` }} />
        </div>
        <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
          <span className="text-brand-green">≥70% Buena</span>
          <span className="text-amber-300">40–69% Regular</span>
          <span className="text-red-400">&lt;40% Crítica</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Socios adentro ahora */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Adentro ahora</p>
            <span className="flex items-center gap-1.5 text-xs text-brand-green">
              <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />En vivo
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
                    <div className="text-sm font-semibold text-slate-100 truncate">{[a.socios?.nombre, a.socios?.apellido].filter(Boolean).join(" ") || "—"}</div>
                    <div className="text-xs text-slate-500">Entró: {toBoTime(a.fecha_entrada)}</div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-brand-green shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entradas por hora */}
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
                  {count > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-[#0b1220] border border-[#1e293b] px-1.5 py-0.5 text-[10px] text-slate-200 whitespace-nowrap z-10">
                      {hora}:00 — {count}x
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Semáforo retención */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Socios en riesgo de abandono</p>
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
              <Link href="/asistencias" className="block text-center text-xs text-slate-500 hover:text-brand-green transition-colors pt-1">Ver todos →</Link>
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

function FinancieroTab({
  ingresosMes, ingresosMesAnterior,
  pagosHoy, ingresos7dias, maxBob,
  planesTop, subsPorVencer,
}: {
  ingresosMes: { bob: number; usd: number };
  ingresosMesAnterior: { bob: number; usd: number };
  pagosHoy: PagoRow[];
  ingresos7dias: { fecha: string; bob: number }[];
  maxBob: number;
  planesTop: { nombre: string; count: number }[];
  subsPorVencer: SubVencer[];
}) {
  const deltaBob = pctChange(ingresosMes.bob, ingresosMesAnterior.bob);
  const deltaUsd = pctChange(ingresosMes.usd, ingresosMesAnterior.usd);
  const totalPagosHoyBob = pagosHoy.filter((p) => p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0);
  const totalPagosHoyUsd = pagosHoy.filter((p) => p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0);
  const maxPlan = Math.max(1, ...planesTop.map((p) => p.count));

  return (
    <div className="space-y-6">
      {/* Ingresos del mes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ingresos del mes — BOB</div>
          <div className="mt-1 text-3xl font-bold leading-none text-brand-green">Bs {fmtMoney(ingresosMes.bob)}</div>
          <div className="mt-1"><DeltaBadge pct={deltaBob} /></div>
        </div>
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ingresos del mes — USD</div>
          <div className="mt-1 text-3xl font-bold leading-none text-sky-400">$ {fmtMoney(ingresosMes.usd)}</div>
          <div className="mt-1"><DeltaBadge pct={deltaUsd} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ingresos últimos 7 días */}
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Ingresos BOB — últimos 7 días</p>
          </div>
          <div className="flex items-end gap-1 h-28">
            {ingresos7dias.map(({ fecha, bob }) => {
              const pct = Math.round((bob / maxBob) * 100);
              const label = new Date(fecha + "T12:00:00").toLocaleDateString("es-BO", { weekday: "short", timeZone: TZ });
              return (
                <div key={fecha} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full rounded-t-sm transition-all"
                    style={{ height: `${Math.max(3, pct * 1.0)}px`, backgroundColor: bob > 0 ? `rgba(118,203,62,${0.25 + pct / 100 * 0.75})` : "rgba(255,255,255,0.04)" }} />
                  <span className="text-[9px] text-slate-600 capitalize">{label}</span>
                  {bob > 0 && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-[#0b1220] border border-[#1e293b] px-2 py-0.5 text-[10px] text-slate-200 whitespace-nowrap z-10">
                      Bs {fmtMoney(bob)}
                    </div>
                  )}
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
              {planesTop.map(({ nombre, count }) => {
                const pct = Math.round((count / maxPlan) * 100);
                return (
                  <div key={nombre} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 truncate">{nombre}</span>
                      <span className="text-slate-500 ml-2 shrink-0">{count} venta{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-brand-green/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pagos de hoy */}
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100">Pagos de hoy</p>
          <div className="flex gap-3 text-xs text-slate-400">
            <span>BOB <span className="text-brand-green font-semibold">Bs {fmtMoney(totalPagosHoyBob)}</span></span>
            <span>USD <span className="text-sky-400 font-semibold">$ {fmtMoney(totalPagosHoyUsd)}</span></span>
          </div>
        </div>
        {pagosHoy.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">Sin pagos registrados hoy.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {pagosHoy.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2">
                <Avatar nombre={p.socios?.nombre ?? null} apellido={p.socios?.apellido ?? null} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">{[p.socios?.nombre, p.socios?.apellido].filter(Boolean).join(" ") || "—"}</div>
                  <div className="text-xs text-slate-500">{p.metodo_pago} · {toBoTime(p.fecha_pago)}</div>
                </div>
                <span className={`text-sm font-bold ${p.codigo_moneda === "USD" ? "text-sky-400" : "text-brand-green"}`}>
                  {p.codigo_moneda === "USD" ? "$" : "Bs"} {fmtMoney(Number(p.monto_pagado))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suscripciones por vencer */}
      {subsPorVencer.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-amber-300">⚠️ Suscripciones por vencer (próximos 7 días)</p>
          <div className="space-y-2">
            {subsPorVencer.map((s) => {
              const dias = Math.ceil((new Date(s.fecha_fin).getTime() - Date.now()) / 86400000);
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-amber-400/15 bg-[#0b1220] px-3 py-2">
                  <Avatar nombre={s.socios?.nombre ?? null} apellido={s.socios?.apellido ?? null} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">{[s.socios?.nombre, s.socios?.apellido].filter(Boolean).join(" ") || "—"}</div>
                    <div className="text-xs text-slate-500">{s.planes?.nombre ?? "—"}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${dias <= 2 ? "border-red-500/30 text-red-400" : "border-amber-400/30 text-amber-300"}`}>
                    {dias <= 0 ? "Hoy" : `${dias}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

