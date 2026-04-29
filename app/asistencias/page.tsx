"use client";

import { supabase } from "@/lib/supabase";
import React, { useCallback, useEffect, useMemo, useState } from "react";

const TZ = "America/La_Paz";

// ── Types ─────────────────────────────────────────────────────────────────────

type Socio = { id: number; nombre: string | null; apellido: string | null; ci: string | null; foto_url: string | null; es_activo: boolean | null; suscrito: boolean | null; };
type Asistencia = { id: number; fecha_entrada: string; fecha_salida: string | null; casillero_id: number | null; };
type AsistenciaGlobal = { socio_id: number; fecha_entrada: string; };

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBoDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}
function toBoTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function durMin(entrada: string, salida: string | null): number {
  if (!salida) return 0;
  return Math.round((new Date(salida).getTime() - new Date(entrada).getTime()) / 60000);
}
function fmtDur(min: number) {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
}
function monthKey(year: number, month: number) { return `${year}-${String(month + 1).padStart(2, "0")}`; }
function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function firstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay(); }
function getDow(iso: string): number {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(day);
}
function getHour(iso: string): number {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date(iso)));
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_NAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

// ── Streak calculators ────────────────────────────────────────────────────────

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function calcMaxStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort();
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000);
    if (diff === 1) { cur++; max = Math.max(max, cur); }
    else cur = 1;
  }
  return max;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" /><path d="M16.5 16.5 21 21" /></svg>;
}
function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>;
}
function FlameIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" /></svg>;
}
function TrophyIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
}
function ClockIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
}
function CalendarIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
}
function AlertIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
}
function GlobeIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AsistenciasPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loadingA, setLoadingA] = useState(false);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [tab, setTab] = useState<"calendario" | "heatmap" | "hoy" | "global">("global");

  useEffect(() => {
    supabase.from("socios").select("id,nombre,apellido,ci,foto_url,es_activo,suscrito").order("apellido")
      .then(({ data }) => setSocios((data ?? []) as Socio[]));
  }, []);

  useEffect(() => {
    if (!selectedId) { setAsistencias([]); return; }
    setLoadingA(true);
    supabase.from("asistencias").select("id,fecha_entrada,fecha_salida,casillero_id")
      .eq("socio_id", selectedId).order("fecha_entrada", { ascending: false })
      .then(({ data }) => { setAsistencias((data ?? []) as Asistencia[]); setLoadingA(false); });
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return socios;
    return socios.filter((s) => {
      const name = [s.nombre, s.apellido].filter(Boolean).join(" ").toLowerCase();
      return name.includes(q) || (s.ci ?? "").includes(q);
    });
  }, [socios, search]);

  const selectedSocio = useMemo(() => socios.find((s) => s.id === selectedId) ?? null, [socios, selectedId]);

  const byDate = useMemo(() => {
    const map: Record<string, Asistencia[]> = {};
    for (const a of asistencias) {
      const d = toBoDate(a.fecha_entrada);
      if (!map[d]) map[d] = [];
      map[d].push(a);
    }
    return map;
  }, [asistencias]);

  const allDates = useMemo(() => Object.keys(byDate).sort(), [byDate]);

  const monthStats = useMemo(() => {
    const mk = monthKey(viewYear, viewMonth);
    const entries = asistencias.filter((a) => toBoDate(a.fecha_entrada).startsWith(mk));
    const dias = new Set(entries.map((a) => toBoDate(a.fecha_entrada))).size;
    const totalMin = entries.reduce((acc, a) => acc + durMin(a.fecha_entrada, a.fecha_salida), 0);
    return { dias, totalMin, sesiones: entries.length };
  }, [asistencias, viewYear, viewMonth]);

  const globalStats = useMemo(() => {
    const streak = calcStreak(allDates);
    const maxStreak = calcMaxStreak(allDates);
    const totalMin = asistencias.reduce((acc, a) => acc + durMin(a.fecha_entrada, a.fecha_salida), 0);
    return { streak, maxStreak, totalMin, totalSesiones: asistencias.length };
  }, [asistencias, allDates]);

  // Cuando se selecciona un socio, cambiar a tab calendario automáticamente
  function handleSelectSocio(id: number) {
    setSelectedId(id);
    setSelectedDay(null);
    if (tab === "global") setTab("calendario");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="section-kicker">Operaciones</div>
        <h1 className="section-title">Asistencias</h1>
        <p className="section-description">Historial de visitas, rachas y estadísticas por socio.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Panel izquierdo */}
        <div className="space-y-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar socio…"
              className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] py-3 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-brand-green/50"
            />
          </div>
          {/* Botón vista global */}
          <button
            onClick={() => { setSelectedId(null); setTab("global"); }}
            className={["w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all", tab === "global" && !selectedId ? "border-brand-green/30 bg-brand-green/8" : "border-[#1e293b] bg-white/5 hover:bg-white/8"].join(" ")}
          >
            <div className={["h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center", tab === "global" && !selectedId ? "border-brand-green/30 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-400"].join(" ")}>
              <GlobeIcon />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">Vista Global</div>
              <div className="text-xs text-slate-500">Todos los socios</div>
            </div>
          </button>
          <div className="space-y-1 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
            {filtered.map((s) => {
              const active = s.id === selectedId;
              const initials = `${s.nombre?.[0] ?? ""}${s.apellido?.[0] ?? ""}`.toUpperCase();
              return (
                <button
                  key={s.id}
                  onClick={() => handleSelectSocio(s.id)}
                  className={["w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all", active ? "border-brand-green/30 bg-brand-green/8" : "border-[#1e293b] bg-white/5 hover:bg-white/8"].join(" ")}
                >
                  <div className={["h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center text-xs font-bold", active ? "border-brand-green/30 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-400"].join(" ")}>
                    {s.foto_url ? <img src={s.foto_url} className="h-full w-full rounded-xl object-cover" alt="" /> : initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{[s.nombre, s.apellido].filter(Boolean).join(" ")}</div>
                    <div className="text-xs text-slate-500">CI: {s.ci ?? "—"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel derecho */}
        {tab === "global" && !selectedId ? (
          <GlobalView socios={socios} />
        ) : !selectedSocio ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1e293b] bg-white/5 py-20 text-center">
            <span className="text-slate-600"><UserIcon /></span>
            <p className="mt-3 text-sm text-slate-500">Selecciona un socio para ver sus asistencias</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Socio header */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 shrink-0 rounded-2xl border border-brand-green/30 bg-brand-green/10 flex items-center justify-center text-lg font-bold text-brand-green">
                  {selectedSocio.foto_url
                    ? <img src={selectedSocio.foto_url} className="h-full w-full rounded-2xl object-cover" alt="" />
                    : `${selectedSocio.nombre?.[0] ?? ""}${selectedSocio.apellido?.[0] ?? ""}`.toUpperCase()}
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-100">{[selectedSocio.nombre, selectedSocio.apellido].filter(Boolean).join(" ")}</div>
                  <div className="text-sm text-slate-500">CI: {selectedSocio.ci ?? "—"}</div>
                </div>
                {globalStats.streak > 0 ? (
                  <div className="ml-auto flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-2">
                    <span className="text-orange-400"><FlameIcon /></span>
                    <div>
                      <div className="text-xl font-bold text-orange-400 leading-none">{globalStats.streak}</div>
                      <div className="text-[10px] text-orange-400/70 uppercase tracking-wide">racha</div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: <FlameIcon />, label: "Racha actual", value: `${globalStats.streak} días`, color: "text-orange-400" },
                  { icon: <TrophyIcon />, label: "Mejor racha", value: `${globalStats.maxStreak} días`, color: "text-amber-300" },
                  { icon: <ClockIcon />, label: "Horas totales", value: fmtDur(globalStats.totalMin), color: "text-brand-green" },
                  { icon: <CalendarIcon />, label: "Total sesiones", value: String(globalStats.totalSesiones), color: "text-slate-100" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3">
                    <div className={["mb-1", s.color].join(" ")}>{s.icon}</div>
                    <div className={["text-xl font-bold leading-none", s.color].join(" ")}>{s.value}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1 w-fit overflow-x-auto flex-nowrap max-w-full">
              {(["calendario", "heatmap", "hoy"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={["rounded-xl px-5 py-2 text-sm font-semibold transition-all capitalize", tab === t ? "bg-brand-green/15 text-brand-green border border-brand-green/30" : "text-slate-400 hover:text-slate-200"].join(" ")}>
                  {t === "calendario" ? "📅 Calendario" : t === "heatmap" ? "🔥 Heatmap" : "📋 Hoy"}
                </button>
              ))}
            </div>

            {tab === "calendario" && (
              <CalendarioView
                byDate={byDate}
                viewYear={viewYear}
                viewMonth={viewMonth}
                setViewYear={setViewYear}
                setViewMonth={setViewMonth}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                monthStats={monthStats}
                loading={loadingA}
              />
            )}
            {tab === "heatmap" && <HeatmapView asistencias={asistencias} />}
            {tab === "hoy" && <HoyView byDate={byDate} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Global View ───────────────────────────────────────────────────────────────

type RankingEntry = { socio: Socio; diasMes: number; streak: number; };
type AlertaEntry = { socio: Socio; diasAusente: number; ultimaVisita: string | null; };
type AsistenciaHoy = { id: number; socio_id: number; fecha_entrada: string; fecha_salida: string | null; };

function GlobalView({ socios }: { socios: Socio[] }) {
  const now = new Date();
  const [globalAsistencias, setGlobalAsistencias] = useState<AsistenciaGlobal[]>([]);
  const [allAsistencias, setAllAsistencias] = useState<AsistenciaGlobal[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<AsistenciaHoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalTab, setGlobalTab] = useState<"heatmap" | "ranking" | "alertas" | "hoy">("heatmap");

  useEffect(() => {
    setLoading(true);
    const mk = monthKey(now.getFullYear(), now.getMonth());
    const desde = `${mk}-01`;
    // Inicio del día de hoy en UTC (Bolivia = UTC-4)
    const todayBo = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    const todayStart = new Date(`${todayBo}T00:00:00-04:00`).toISOString();
    const todayEnd   = new Date(`${todayBo}T23:59:59-04:00`).toISOString();
    Promise.all([
      supabase.from("asistencias").select("socio_id,fecha_entrada")
        .gte("fecha_entrada", desde).order("fecha_entrada"),
      supabase.from("asistencias").select("socio_id,fecha_entrada")
        .gte("fecha_entrada", new Date(Date.now() - 60 * 86400000).toISOString())
        .order("fecha_entrada", { ascending: false }),
      supabase.from("asistencias").select("id,socio_id,fecha_entrada,fecha_salida")
        .gte("fecha_entrada", todayStart)
        .lte("fecha_entrada", todayEnd)
        .order("fecha_entrada", { ascending: false }),
    ]).then(([{ data: mes }, { data: recientes }, { data: hoy }]) => {
      setGlobalAsistencias((mes ?? []) as AsistenciaGlobal[]);
      setAllAsistencias((recientes ?? []) as AsistenciaGlobal[]);
      setAsistenciasHoy((hoy ?? []) as AsistenciaHoy[]);
      setLoading(false);
    });
  }, []);

  // Heatmap global (mes actual)
  const { matrix, activeHours, maxVal } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const hours = Array(24).fill(0);
    for (const a of globalAsistencias) {
      const dow = getDow(a.fecha_entrada);
      const h = getHour(a.fecha_entrada);
      if (dow >= 0 && dow < 7 && h >= 0 && h < 24) { m[dow][h]++; hours[h]++; }
    }
    return { matrix: m, activeHours: hours, maxVal: Math.max(1, ...m.flat()) };
  }, [globalAsistencias]);

  const peakHour = activeHours.indexOf(Math.max(...activeHours));

  // Ranking del mes
  const ranking = useMemo((): RankingEntry[] => {
    const byId: Record<number, string[]> = {};
    for (const a of globalAsistencias) {
      if (!byId[a.socio_id]) byId[a.socio_id] = [];
      byId[a.socio_id].push(toBoDate(a.fecha_entrada));
    }
    return socios
      .map((s) => {
        const dates = byId[s.id] ?? [];
        return { socio: s, diasMes: new Set(dates).size, streak: calcStreak(dates) };
      })
      .filter((e) => e.diasMes > 0)
      .sort((a, b) => b.diasMes - a.diasMes || b.streak - a.streak)
      .slice(0, 10);
  }, [globalAsistencias, socios]);

  // Alertas de retención (socios activos sin asistir en 7+ días)
  const alertas = useMemo((): AlertaEntry[] => {
    const lastVisit: Record<number, string> = {};
    for (const a of allAsistencias) {
      if (!lastVisit[a.socio_id]) lastVisit[a.socio_id] = a.fecha_entrada;
    }
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    return socios
      .filter((s) => s.es_activo === true && s.suscrito === true)
      .map((s) => {
        const ultima = lastVisit[s.id] ?? null;
        const diasAusente = ultima
          ? Math.floor((new Date(today).getTime() - new Date(toBoDate(ultima)).getTime()) / 86400000)
          : 999;
        return { socio: s, diasAusente, ultimaVisita: ultima ? toBoDate(ultima) : null };
      })
      .filter((e) => e.diasAusente >= 7)
      .sort((a, b) => b.diasAusente - a.diasAusente)
      .slice(0, 20);
  }, [allAsistencias, socios]);

  const mk = monthKey(now.getFullYear(), now.getMonth());

  return (
    <div className="space-y-4">
      {/* Stats globales del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: `Sesiones en ${MONTH_NAMES[now.getMonth()]}`, value: loading ? "…" : globalAsistencias.length },
          { label: "Socios activos este mes", value: loading ? "…" : new Set(globalAsistencias.map((a) => a.socio_id)).size },
          { label: "Alertas de retención", value: loading ? "…" : alertas.length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-brand-green">{s.value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1 w-fit overflow-x-auto flex-nowrap max-w-full">
        {([
          { key: "heatmap", label: "🌐 Heatmap global" },
          { key: "ranking", label: "🏆 Ranking" },
          { key: "alertas", label: "⚠️ Retención" },
          { key: "hoy", label: "📋 Hoy" },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setGlobalTab(t.key)}
            className={["rounded-xl px-5 py-2 text-sm font-semibold transition-all", globalTab === t.key ? "bg-brand-green/15 text-brand-green border border-brand-green/30" : "text-slate-400 hover:text-slate-200"].join(" ")}>
            {t.label}
          </button>
        ))}
      </div>

      {globalTab === "heatmap" && (
        <div className="space-y-4">
          {/* Barras por hora */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-100">Horario pico del gym — {MONTH_NAMES[now.getMonth()]}</p>
              {Math.max(...activeHours) > 0 ? (
                <span className="text-xs text-slate-400">Pico: <span className="font-semibold text-brand-green">{peakHour}:00 – {peakHour + 1}:00</span></span>
              ) : null}
            </div>
            <div className="flex items-end gap-0.5 h-20">
              {activeHours.map((count, h) => {
                const pct = Math.round((count / Math.max(1, Math.max(...activeHours))) * 100);
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="w-full rounded-sm transition-all"
                      style={{ height: `${Math.max(2, pct * 0.72)}px`, backgroundColor: count > 0 ? `rgba(118,203,62,${0.15 + pct / 100 * 0.85})` : "rgba(255,255,255,0.03)" }} />
                    {h % 3 === 0 ? <span className="text-[8px] text-slate-600">{h}</span> : <span className="text-[8px] text-transparent">·</span>}
                    {count > 0 ? (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-[#0b1220] border border-[#1e293b] px-1.5 py-0.5 text-[10px] text-slate-200 whitespace-nowrap z-10">
                        {h}:00 — {count}x
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Grid día × hora */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 overflow-x-auto">
            <p className="text-sm font-semibold text-slate-100 mb-4">Mapa de calor global — día × hora</p>
            <div className="min-w-[600px]">
              <div className="grid gap-1" style={{ gridTemplateColumns: "40px repeat(24, 1fr)" }}>
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center text-[9px] text-slate-600">{h}</div>
                ))}
                {matrix.map((row, dow) => (
                  <React.Fragment key={dow}>
                    <div className="text-[10px] text-slate-500 flex items-center">{DAY_NAMES[dow]}</div>
                    {row.map((val, h) => (
                      <div key={h} title={val > 0 ? `${DAY_NAMES[dow]} ${h}:00 — ${val} sesión(es)` : undefined}
                        className="h-5 rounded-sm"
                        style={{ backgroundColor: val > 0 ? `rgba(118,203,62,${0.1 + (val / maxVal) * 0.9})` : "rgba(255,255,255,0.03)" }} />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {globalTab === "ranking" && (
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-100">Top socios — {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</p>
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : ranking.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos este mes.</p>
          ) : (
            <div className="space-y-2">
              {ranking.map((entry, i) => {
                const initials = `${entry.socio.nombre?.[0] ?? ""}${entry.socio.apellido?.[0] ?? ""}`.toUpperCase();
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                const daysInCurrentMonth = daysInMonth(now.getFullYear(), now.getMonth());
                const pct = Math.round((entry.diasMes / daysInCurrentMonth) * 100);
                return (
                  <div key={entry.socio.id} className="flex items-center gap-3 rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3">
                    <div className="w-6 text-center text-sm font-bold text-slate-500">
                      {medal ?? <span className="text-xs">{i + 1}</span>}
                    </div>
                    <div className="h-9 w-9 shrink-0 rounded-xl border border-[#1e293b] bg-white/5 flex items-center justify-center text-xs font-bold text-slate-400">
                      {entry.socio.foto_url ? <img src={entry.socio.foto_url} className="h-full w-full rounded-xl object-cover" alt="" /> : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {[entry.socio.nombre, entry.socio.apellido].filter(Boolean).join(" ")}
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-brand-green">{entry.diasMes} días</div>
                      {entry.streak > 0 ? (
                        <div className="flex items-center justify-end gap-1 text-[10px] text-orange-400">
                          <FlameIcon className="h-3 w-3" />{entry.streak}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {globalTab === "alertas" && (
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Socios sin asistir en 7+ días</p>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">{alertas.length}</span>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : alertas.length === 0 ? (
            <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 px-4 py-6 text-center">
              <p className="text-sm text-brand-green font-semibold">¡Todos los socios han asistido recientemente!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map((entry) => {
                const initials = `${entry.socio.nombre?.[0] ?? ""}${entry.socio.apellido?.[0] ?? ""}`.toUpperCase();
                const urgente = entry.diasAusente >= 14;
                return (
                  <div key={entry.socio.id} className={["flex items-center gap-3 rounded-2xl border px-4 py-3", urgente ? "border-red-500/20 bg-red-500/5" : "border-amber-400/15 bg-amber-400/5"].join(" ")}>
                    <div className="h-9 w-9 shrink-0 rounded-xl border border-[#1e293b] bg-white/5 flex items-center justify-center text-xs font-bold text-slate-400">
                      {entry.socio.foto_url ? <img src={entry.socio.foto_url} className="h-full w-full rounded-xl object-cover" alt="" /> : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {[entry.socio.nombre, entry.socio.apellido].filter(Boolean).join(" ")}
                      </div>
                      <div className="text-xs text-slate-500">
                        {entry.ultimaVisita
                          ? `Última visita: ${new Date(entry.ultimaVisita + "T12:00:00").toLocaleDateString("es-BO", { day: "numeric", month: "short" })}`
                          : "Sin visitas registradas"}
                      </div>
                    </div>
                    <div className={["flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold", urgente ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-amber-400/30 bg-amber-400/10 text-amber-300"].join(" ")}>
                      <AlertIcon />
                      {entry.diasAusente >= 999 ? "Nunca" : `${entry.diasAusente}d`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {globalTab === "hoy" && (
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">
              Asistencias de hoy — {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}
            </p>
            <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 text-xs font-semibold text-brand-green">
              {loading ? "…" : asistenciasHoy.length} sesiones
            </span>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : asistenciasHoy.length === 0 ? (
            <div className="rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-8 text-center">
              <p className="text-sm text-slate-500">Nadie ha asistido hoy todavía.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {asistenciasHoy.map((a) => {
                const socio = socios.find((s) => s.id === a.socio_id);
                const initials = `${socio?.nombre?.[0] ?? ""}${socio?.apellido?.[0] ?? ""}`.toUpperCase();
                const dur = durMin(a.fecha_entrada, a.fecha_salida);
                const adentro = !a.fecha_salida;
                return (
                  <div key={a.id} className={["flex items-center gap-3 rounded-2xl border px-4 py-3", adentro ? "border-brand-green/20 bg-brand-green/5" : "border-[#1e293b] bg-[#0b1220]"].join(" ")}>
                    <div className="h-9 w-9 shrink-0 rounded-xl border border-[#1e293b] bg-white/5 flex items-center justify-center text-xs font-bold text-slate-400">
                      {socio?.foto_url ? <img src={socio.foto_url} className="h-full w-full rounded-xl object-cover" alt="" /> : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {socio ? [socio.nombre, socio.apellido].filter(Boolean).join(" ") : `Socio #${a.socio_id}`}
                      </div>
                      <div className="text-xs text-slate-500">
                        Entrada: {toBoTime(a.fecha_entrada)}
                        {a.fecha_salida ? ` · Salida: ${toBoTime(a.fecha_salida)}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {adentro ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 text-[10px] font-bold text-brand-green">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-pulse" />
                          Adentro
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-slate-400">{fmtDur(dur)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Calendario View ───────────────────────────────────────────────────────────

function CalendarioView({ byDate, viewYear, viewMonth, setViewYear, setViewMonth, selectedDay, setSelectedDay, monthStats, loading }: {
  byDate: Record<string, Asistencia[]>;
  viewYear: number; viewMonth: number;
  setViewYear: (y: number) => void; setViewMonth: (m: number) => void;
  selectedDay: string | null; setSelectedDay: (d: string | null) => void;
  monthStats: { dias: number; totalMin: number; sesiones: number };
  loading: boolean;
}) {
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  const days = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedSessions = selectedDay ? (byDate[selectedDay] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Días asistidos", value: monthStats.dias },
          { label: "Sesiones", value: monthStats.sesiones },
          { label: "Horas entrenadas", value: fmtDur(monthStats.totalMin) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-brand-green">{loading ? "…" : s.value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100">
            <ChevronIcon dir="left" />
          </button>
          <span className="text-sm font-semibold text-slate-100">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100">
            <ChevronIcon dir="right" />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const sessions = byDate[dateStr] ?? [];
            const count = sessions.length;
            const isSelected = selectedDay === dateStr;
            const isToday = dateStr === new Date().toLocaleDateString("en-CA", { timeZone: TZ });
            return (
              <button key={i} onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={["relative flex flex-col items-center justify-center rounded-xl py-2 text-sm font-semibold transition-all",
                  isSelected ? "bg-brand-green text-black" :
                  count > 0 ? "bg-brand-green/15 text-brand-green border border-brand-green/25 hover:bg-brand-green/25" :
                  isToday ? "border border-[#1e293b] bg-white/5 text-slate-300" :
                  "text-slate-600 hover:text-slate-400"].join(" ")}>
                {day}
                {count > 0 && !isSelected ? (
                  <span className="mt-0.5 flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                      <span key={j} className="h-1 w-1 rounded-full bg-brand-green" />
                    ))}
                  </span>
                ) : count > 0 && isSelected ? (
                  <span className="mt-0.5 text-[9px] font-bold">{count}x</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          {selectedSessions.length === 0 ? (
            <p className="text-sm text-slate-500">Sin sesiones este día.</p>
          ) : (
            <div className="space-y-2">
              {selectedSessions.map((a) => {
                const dur = durMin(a.fecha_entrada, a.fecha_salida);
                return (
                  <div key={a.id} className="flex items-center gap-4 rounded-xl border border-[#1e293b] bg-[#0b1220] px-4 py-3">
                    <div><div className="text-xs text-slate-500">Entrada</div><div className="text-sm font-bold text-slate-100">{toBoTime(a.fecha_entrada)}</div></div>
                    <div className="text-slate-600">→</div>
                    <div><div className="text-xs text-slate-500">Salida</div><div className="text-sm font-bold text-slate-100">{a.fecha_salida ? toBoTime(a.fecha_salida) : "—"}</div></div>
                    <div className="ml-auto"><div className="text-xs text-slate-500">Duración</div><div className="text-sm font-bold text-brand-green">{fmtDur(dur)}</div></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Heatmap View ──────────────────────────────────────────────────────────────

function HeatmapView({ asistencias }: { asistencias: Asistencia[] }) {
  const matrix = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const a of asistencias) {
      const dow = getDow(a.fecha_entrada);
      const h = getHour(a.fecha_entrada);
      if (dow >= 0 && dow < 7 && h >= 0 && h < 24) m[dow][h]++;
    }
    return m;
  }, [asistencias]);

  const maxVal = useMemo(() => Math.max(1, ...matrix.flat()), [matrix]);

  const activeHours = useMemo(() => {
    const counts = Array(24).fill(0);
    for (const a of asistencias) {
      const h = getHour(a.fecha_entrada);
      if (h >= 0 && h < 24) counts[h]++;
    }
    return counts;
  }, [asistencias]);

  const peakHour = activeHours.indexOf(Math.max(...activeHours));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-100">Horarios más frecuentes</p>
          {peakHour >= 0 && Math.max(...activeHours) > 0 ? (
            <span className="text-xs text-slate-400">Pico: <span className="font-semibold text-brand-green">{peakHour}:00 – {peakHour + 1}:00</span></span>
          ) : null}
        </div>
        <div className="flex items-end gap-0.5 h-20">
          {activeHours.map((count, h) => {
            const pct = Math.round((count / Math.max(1, Math.max(...activeHours))) * 100);
            return (
              <div key={h} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full rounded-sm transition-all"
                  style={{ height: `${Math.max(2, pct * 0.72)}px`, backgroundColor: count > 0 ? `rgba(118,203,62,${0.15 + pct / 100 * 0.85})` : undefined }} />
                {h % 3 === 0 ? <span className="text-[8px] text-slate-600">{h}</span> : <span className="text-[8px] text-transparent">·</span>}
                {count > 0 ? (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-[#0b1220] border border-[#1e293b] px-1.5 py-0.5 text-[10px] text-slate-200 whitespace-nowrap z-10">
                    {h}:00 — {count}x
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 overflow-x-auto">
        <p className="text-sm font-semibold text-slate-100 mb-4">Mapa de calor — día × hora</p>
        <div className="min-w-[600px]">
          <div className="grid gap-1" style={{ gridTemplateColumns: "40px repeat(24, 1fr)" }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-center text-[9px] text-slate-600">{h}</div>
            ))}
            {matrix.map((row, dow) => (
              <React.Fragment key={dow}>
                <div className="text-[10px] text-slate-500 flex items-center">{DAY_NAMES[dow]}</div>
                {row.map((val, h) => (
                  <div key={h} title={val > 0 ? `${DAY_NAMES[dow]} ${h}:00 — ${val} sesión(es)` : undefined}
                    className="h-5 rounded-sm"
                    style={{ backgroundColor: val > 0 ? `rgba(118,203,62,${0.1 + (val / maxVal) * 0.9})` : "rgba(255,255,255,0.03)" }} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hoy View ──────────────────────────────────────────────────────────────────

function HoyView({ byDate }: { byDate: Record<string, Asistencia[]> }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const sessions = byDate[today] ?? [];

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 py-16 text-center">
        <p className="text-sm text-slate-500">Este socio no ha asistido hoy.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sesiones de hoy</p>
      {sessions.map((a) => {
        const dur = durMin(a.fecha_entrada, a.fecha_salida);
        return (
          <div key={a.id} className="flex items-center gap-4 rounded-xl border border-brand-green/20 bg-brand-green/5 px-4 py-3">
            <div><div className="text-xs text-slate-500">Entrada</div><div className="text-base font-bold text-slate-100">{toBoTime(a.fecha_entrada)}</div></div>
            <div className="text-slate-600">→</div>
            <div><div className="text-xs text-slate-500">Salida</div><div className="text-base font-bold text-slate-100">{a.fecha_salida ? toBoTime(a.fecha_salida) : <span className="text-brand-green">Adentro</span>}</div></div>
            {dur > 0 ? (
              <div className="ml-auto rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-sm font-bold text-brand-green">
                {fmtDur(dur)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
