"use client";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { SucursalSelector } from "@/app/_components/SucursalSelector";
import { useCallback, useEffect, useRef, useState } from "react";

const TZ = "America/La_Paz";
function todayStr() { return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); }

// ── Types ─────────────────────────────────────────────────────────────────────

type SocioResult = {
  id: number;
  nombre: string | null;
  apellido: string | null;
  ci: string | null;
  foto_url: string | null;
  es_activo: boolean | null;
  suscrito: boolean | null;
  whatsapp: string | null;
};

type SuscripcionActiva = {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  planes: { nombre: string | null } | null;
};

type AsistenciaActiva = {
  id: number;
  fecha_entrada: string;
  casillero_id: number | null;
  casilleros: { identificador_visual: string } | null;
};

type CasilleroLibre = {
  id: number;
  identificador_visual: string;
};

type Tab = "entrada" | "salida";

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <path d="M16.5 16.5 21 21" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ socio, size = "lg" }: { socio: SocioResult; size?: "lg" | "sm" }) {
  const dim = size === "lg" ? "h-20 w-20" : "h-12 w-12";
  const text = size === "lg" ? "text-2xl" : "text-sm";
  const initials = `${socio.nombre?.[0] ?? ""}${socio.apellido?.[0] ?? ""}`.toUpperCase() || "?";

  if (socio.foto_url) {
    return (
      <img
        src={socio.foto_url}
        alt={initials}
        className={`${dim} rounded-2xl object-cover border border-[#1e293b]`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-2xl border border-brand-green/30 bg-brand-green/10 flex items-center justify-center ${text} font-bold text-brand-green`}>
      {initials}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ open, message, onClose }: { open: boolean; message: string; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [open, onClose]);
  return (
    <div className={["fixed right-4 top-4 z-[60] transition-all duration-200 transform-gpu", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"].join(" ")}>
      <div className="flex items-center gap-3 rounded-2xl border border-brand-green/25 bg-[#0b1220] px-4 py-3 shadow-[0_10px_35px_rgba(0,0,0,0.55)]">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green">
          <CheckIcon />
        </span>
        <span className="text-sm font-semibold text-slate-100">{message}</span>
      </div>
    </div>
  );
}

// ── Aforo widget ──────────────────────────────────────────────────────────────

function AforoLive({ sucursalId }: { sucursalId: number }) {
  const [count, setCount] = useState<number | null>(null);
  const CAPACITY = 50;

  async function load() {
    const { count: c } = await supabase
      .from("asistencias")
      .select("id", { count: "exact", head: true })
      .eq("sucursal_id", sucursalId)
      .is("fecha_salida", null);
    setCount(c ?? 0);
  }

  useEffect(() => {
    void load();

    // Realtime: escucha INSERT y UPDATE en asistencias y recalcula
    const channel = supabase
      .channel("aforo-live-" + sucursalId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "asistencias" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "asistencias" }, () => void load())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [sucursalId]);

  const pct = count !== null ? Math.round((count / CAPACITY) * 100) : 0;
  const color = pct >= 90 ? "text-red-400" : pct >= 70 ? "text-amber-300" : "text-brand-green";
  const bar = pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-300" : "bg-brand-green";

  return (
    <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-5 py-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Aforo actual</span>
        <span className="text-xs text-slate-500">{CAPACITY} máx.</span>
      </div>
      <div className="mt-1 flex items-end gap-2">
        <span className={`text-4xl font-bold leading-none ${color}`}>{count ?? "…"}</span>
        <span className="mb-1 text-sm text-slate-400">{pct}%</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#0b1220]">
        <div className={`h-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RecepcionPage() {
  const { user } = useAuth();
  const [selectedSucursal, setSelectedSucursal] = useState<number | null>(user?.sucursal_id ?? null);
  const [tab, setTab] = useState<Tab>("entrada");
  const [toast, setToast] = useState({ open: false, message: "" });
  const aforoRef = useRef<{ reload: () => void } | null>(null);

  function showToast(msg: string) { setToast({ open: true, message: msg }); }

  if (selectedSucursal === null) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
          <div className="section-kicker">Operaciones</div>
          <h1 className="section-title">Recepción</h1>
          <p className="section-description">Registra entradas y salidas de socios en tiempo real.</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <p className="text-lg font-semibold text-amber-300">Selecciona una sucursal</p>
          <p className="mt-2 text-sm text-slate-400">El módulo de recepción opera por sucursal. Selecciona una sucursal específica.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toast open={toast.open} message={toast.message} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="section-kicker">Operaciones</div>
            <h1 className="section-title">Recepción</h1>
            <p className="section-description">Registra entradas y salidas de socios en tiempo real.</p>
          </div>
          <div className="flex items-center gap-3">
            <SucursalSelector value={selectedSucursal} onChange={setSelectedSucursal} allowAll={false} />
            <AforoLive sucursalId={selectedSucursal ?? user?.sucursal_id ?? 1} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1 w-fit overflow-x-auto flex-nowrap">
          {(["entrada", "salida"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "rounded-xl px-6 py-2 text-sm font-semibold transition-all duration-150 capitalize",
                tab === t
                  ? t === "entrada"
                    ? "bg-brand-green text-black shadow-sm"
                    : "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {t === "entrada" ? "↓ Entrada" : "↑ Salida"}
            </button>
          ))}
        </div>
      </div>

      {tab === "entrada" ? (
        <EntradaPanel onSuccess={(msg) => showToast(msg)} />
      ) : (
        <SalidaPanel onSuccess={(msg) => showToast(msg)} />
      )}
    </div>
  );
}

// ── Panel Entrada ─────────────────────────────────────────────────────────────

function EntradaPanel({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const { user } = useAuth();
  const [ci, setCi] = useState("");
  const [searching, setSearching] = useState(false);
  const [socio, setSocio] = useState<SocioResult | null>(null);
  const [suscripcion, setSuscripcion] = useState<SuscripcionActiva | null>(null);
  const [suscripcionFutura, setSuscripcionFutura] = useState<SuscripcionActiva | null>(null);
  const [asistenciaActiva, setAsistenciaActiva] = useState<AsistenciaActiva | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [needsLocker, setNeedsLocker] = useState(false);
  const [casilleroAsignado, setCasilleroAsignado] = useState<CasilleroLibre | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function buscar(ciVal: string) {
    const q = ciVal.trim();
    if (!q) { setSocio(null); setNotFound(false); return; }
    setSearching(true);
    setSocio(null); setNotFound(false); setSuscripcion(null); setSuscripcionFutura(null); setAsistenciaActiva(null); setNeedsLocker(false); setCasilleroAsignado(null);

    const { data } = await supabase
      .from("socios")
      .select("id,nombre,apellido,ci,foto_url,es_activo,suscrito,whatsapp")
      .eq("ci", q)
      .single();

    if (!data) { setNotFound(true); setSearching(false); return; }
    const s = data as SocioResult;
    setSocio(s);

    // Cargar suscripción activa y asistencia activa en paralelo
    const [{ data: subData }, { data: subFuturaData }, { data: asisData }] = await Promise.all([
      supabase.from("suscripciones")
        .select("id,fecha_inicio,fecha_fin,planes(nombre)")
        .eq("socio_id", s.id)
        .eq("estado", "ACTIVA")
        .lte("fecha_inicio", todayStr())
        .gte("fecha_fin", todayStr())
        .order("fecha_fin", { ascending: false })
        .limit(1),
      // Suscripción futura: empieza después de hoy
      supabase.from("suscripciones")
        .select("id,fecha_inicio,fecha_fin,planes(nombre)")
        .eq("socio_id", s.id)
        .eq("estado", "ACTIVA")
        .gt("fecha_inicio", todayStr())
        .order("fecha_inicio", { ascending: true })
        .limit(1),
      supabase.from("asistencias")
        .select("id,fecha_entrada,casillero_id,casilleros(identificador_visual)")
        .eq("socio_id", s.id)
        .is("fecha_salida", null)
        .limit(1),
    ]);

    setSuscripcion(subData && subData.length > 0 ? (subData[0] as unknown as SuscripcionActiva) : null);
    setSuscripcionFutura(subFuturaData && subFuturaData.length > 0 ? (subFuturaData[0] as unknown as SuscripcionActiva) : null);
    setAsistenciaActiva(asisData && asisData.length > 0 ? (asisData[0] as unknown as AsistenciaActiva) : null);
    setSearching(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => { void buscar(ci); }, 350);
    return () => clearTimeout(timer);
  }, [ci]);

  async function toggleLocker(val: boolean) {
    setNeedsLocker(val);
    if (!val) { setCasilleroAsignado(null); return; }
    // Elegir casillero libre aleatorio
    const { data } = await supabase
      .from("casilleros")
      .select("id,identificador_visual")
      .eq("sucursal_id", user?.sucursal_id ?? 1)
      .eq("estado", "LIBRE");
    const libres = (data ?? []) as CasilleroLibre[];
    if (libres.length === 0) { setCasilleroAsignado(null); return; }
    const random = libres[Math.floor(Math.random() * libres.length)];
    setCasilleroAsignado(random);
  }

  async function handleEntrada() {
    if (!socio) return;
    setSubmitting(true);

    // Asignar casillero si aplica
    let casilleroId: number | null = null;
    if (needsLocker && casilleroAsignado) {
      const { error } = await supabase.from("casilleros").update({ estado: "OCUPADO" }).eq("id", casilleroAsignado.id);
      if (!error) casilleroId = casilleroAsignado.id;
    }

    // Registrar asistencia
    const { error } = await supabase.from("asistencias").insert({
      socio_id: socio.id,
      sucursal_id: user?.sucursal_id ?? 1,
      casillero_id: casilleroId,
      fecha_entrada: new Date().toISOString(),
    });

    setSubmitting(false);
    if (error) { onSuccess("Error al registrar entrada"); return; }

    onSuccess(`Entrada registrada${casilleroId ? ` · Casillero ${casilleroAsignado?.identificador_visual}` : ""}`);
    setCi(""); setSocio(null); setSuscripcion(null); setSuscripcionFutura(null); setAsistenciaActiva(null);
    setNeedsLocker(false); setCasilleroAsignado(null); setNotFound(false);
    inputRef.current?.focus();
  }

  const canEnter = socio && socio.es_activo && !!suscripcion && !asistenciaActiva;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Buscador */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Buscar socio por CI</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              value={ci}
              onChange={(e) => setCi(e.target.value)}
              placeholder="Escribe el CI…"
              className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] py-4 pl-12 pr-4 text-lg font-semibold text-slate-100 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/50"
              autoComplete="off"
            />
            {searching ? (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">Buscando…</span>
            ) : null}
          </div>
        </div>

        {/* Resultado */}
        {notFound && ci.trim() ? (
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 flex items-center gap-3 text-slate-400">
            <span className="text-slate-600"><XCircleIcon /></span>
            <span className="text-sm">No se encontró ningún socio con CI <span className="font-semibold text-slate-200">{ci.trim()}</span></span>
          </div>
        ) : null}

        {socio ? <SocioCard socio={socio} suscripcion={suscripcion} suscripcionFutura={suscripcionFutura} asistenciaActiva={asistenciaActiva} /> : null}
      </div>

      {/* Acciones */}
      {socio && !notFound ? (
        <div className="space-y-4">
          {canEnter ? (
            <>
              {/* Casillero */}
              <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Casillero</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">¿Necesita casillero?</span>
                  <button
                    onClick={() => void toggleLocker(!needsLocker)}
                    className={[
                      "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors",
                      needsLocker ? "bg-brand-green/25 border-brand-green/50" : "bg-white/5 border-[#1e293b]",
                    ].join(" ")}
                  >
                    <span className={["inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform", needsLocker ? "translate-x-6 bg-brand-green" : "translate-x-1 bg-slate-400"].join(" ")} />
                  </button>
                </div>
                {needsLocker ? (
                  casilleroAsignado ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/5 px-4 py-3">
                      <span className="text-brand-green"><LockIcon /></span>
                      <div>
                        <div className="text-xs text-slate-500">Casillero asignado</div>
                        <div className="text-lg font-bold text-brand-green">{casilleroAsignado.identificador_visual}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-300">
                      No hay casilleros disponibles en este momento.
                    </div>
                  )
                ) : null}
              </div>

              {/* Botón registrar */}
              <button
                onClick={() => void handleEntrada()}
                disabled={submitting || (needsLocker && !casilleroAsignado)}
                className="w-full rounded-2xl border border-brand-green bg-brand-green py-4 text-base font-bold text-black hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(118,203,62,0.25)] transition-all"
              >
                {submitting ? "Registrando…" : "✓ Registrar entrada"}
              </button>
            </>
          ) : (
          <BlockedInfo socio={socio} suscripcionFutura={suscripcionFutura} asistenciaActiva={asistenciaActiva} />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Panel Salida ──────────────────────────────────────────────────────────────

function SalidaPanel({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [ci, setCi] = useState("");
  const [searching, setSearching] = useState(false);
  const [socio, setSocio] = useState<SocioResult | null>(null);
  const [suscripcion, setSuscripcion] = useState<SuscripcionActiva | null>(null);
  const [asistencia, setAsistencia] = useState<AsistenciaActiva | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [noAsistencia, setNoAsistencia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = ci.trim();
      if (!q) { setSocio(null); setNotFound(false); setNoAsistencia(false); setAsistencia(null); setSuscripcion(null); return; }
      setSearching(true);
      setSocio(null); setNotFound(false); setNoAsistencia(false); setAsistencia(null); setSuscripcion(null);

      const { data: socioData } = await supabase
        .from("socios").select("id,nombre,apellido,ci,foto_url,es_activo,suscrito,whatsapp").eq("ci", q).single();

      if (!socioData) { setNotFound(true); setSearching(false); return; }
      const s = socioData as SocioResult;
      setSocio(s);

      const [{ data: subData }, { data: asisData }] = await Promise.all([
        supabase.from("suscripciones")
          .select("id,fecha_inicio,fecha_fin,planes(nombre)")
          .eq("socio_id", s.id).eq("estado", "ACTIVA")
          .lte("fecha_inicio", todayStr()).gte("fecha_fin", todayStr())
          .order("fecha_fin", { ascending: false }).limit(1),
        supabase.from("asistencias")
          .select("id,fecha_entrada,casillero_id,casilleros(identificador_visual)")
          .eq("socio_id", s.id).is("fecha_salida", null).limit(1),
      ]);

      setSuscripcion(subData && subData.length > 0 ? (subData[0] as unknown as SuscripcionActiva) : null);
      if (!asisData || asisData.length === 0) { setNoAsistencia(true); } else {
        setAsistencia(asisData[0] as unknown as AsistenciaActiva);
      }
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [ci]);

  async function handleSalida() {
    if (!asistencia) return;
    setSubmitting(true);

    const { error } = await supabase.from("asistencias").update({ fecha_salida: new Date().toISOString() }).eq("id", asistencia.id);
    if (error) { setSubmitting(false); onSuccess("Error al registrar salida"); return; }

    // Liberar casillero si tenía
    if (asistencia.casillero_id) {
      await supabase.from("casilleros").update({ estado: "LIBRE" }).eq("id", asistencia.casillero_id);
    }

    setSubmitting(false);
    onSuccess(`Salida registrada${asistencia.casillero_id ? ` · Casillero ${asistencia.casilleros?.identificador_visual} liberado` : ""}`);
    setCi(""); setSocio(null); setSuscripcion(null); setAsistencia(null); setNoAsistencia(false);
    inputRef.current?.focus();
  }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Buscar socio por CI</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
            <input
              ref={inputRef}
              value={ci}
              onChange={(e) => setCi(e.target.value)}
              placeholder="Escribe el CI…"
              className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] py-4 pl-12 pr-4 text-lg font-semibold text-slate-100 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40"
              autoComplete="off"
            />
            {searching ? <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">Buscando…</span> : null}
          </div>
        </div>

        {notFound && ci.trim() ? (
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 flex items-center gap-3 text-slate-400">
            <span className="text-slate-600"><XCircleIcon /></span>
            <span className="text-sm">No se encontró ningún socio con CI <span className="font-semibold text-slate-200">{ci.trim()}</span></span>
          </div>
        ) : null}

        {socio ? <SocioCard socio={socio} suscripcion={suscripcion} suscripcionFutura={null} asistenciaActiva={asistencia} /> : null}
      </div>

      {socio && !notFound ? (
        <div className="space-y-4">
          {noAsistencia ? (
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 flex items-center gap-3">
              <span className="text-slate-500"><AlertIcon /></span>
              <span className="text-sm text-slate-400">Este socio no tiene una entrada activa registrada.</span>
            </div>
          ) : asistencia ? (
            <>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Asistencia activa</p>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Hora de entrada</div>
                    <div className="text-2xl font-bold text-slate-100">{formatHora(asistencia.fecha_entrada)}</div>
                  </div>
                  {asistencia.casillero_id ? (
                    <div className="ml-auto">
                      <div className="text-xs text-slate-500">Casillero</div>
                      <div className="text-2xl font-bold text-amber-300">{asistencia.casilleros?.identificador_visual ?? "—"}</div>
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                onClick={() => void handleSalida()}
                disabled={submitting}
                className="w-full rounded-2xl border border-red-500/40 bg-red-500/10 py-4 text-base font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <LogOutIcon />
                {submitting ? "Registrando…" : "Registrar salida"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Socio Card ────────────────────────────────────────────────────────────────

function SocioCard({ socio, suscripcion, suscripcionFutura, asistenciaActiva }: {
  socio: SocioResult;
  suscripcion: SuscripcionActiva | null;
  suscripcionFutura: SuscripcionActiva | null;
  asistenciaActiva: AsistenciaActiva | null;
}) {
  const bloqueado = socio.es_activo === false;
  const dentroAhora = !!asistenciaActiva;
  const sinSub = !bloqueado && !suscripcion;
  const ok = !bloqueado && !!suscripcion && !dentroAhora;

  const borderColor = bloqueado ? "border-red-500/30" : dentroAhora ? "border-amber-400/30" : sinSub ? "border-amber-400/30" : "border-brand-green/30";
  const bgColor = bloqueado ? "bg-red-500/5" : dentroAhora ? "bg-amber-400/5" : sinSub ? "bg-amber-400/5" : "bg-brand-green/5";

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${borderColor} ${bgColor}`}>
      <div className="flex items-start gap-4">
        <Avatar socio={socio} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-slate-100 leading-tight">
            {[socio.nombre, socio.apellido].filter(Boolean).join(" ") || "—"}
          </div>
          <div className="mt-0.5 text-sm text-slate-400">CI: {socio.ci}</div>
          {suscripcion ? (
            <div className="mt-1 text-xs text-slate-500">
              {suscripcion.planes?.nombre} · Vence <span className="text-slate-300">{suscripcion.fecha_fin}</span>
            </div>
          ) : suscripcionFutura ? (
            <div className="mt-1 text-xs text-amber-400">
              Inicia el <span className="font-semibold">{suscripcionFutura.fecha_inicio}</span> · {suscripcionFutura.planes?.nombre}
            </div>
          ) : null}
        </div>
        <StatusBadge bloqueado={bloqueado} sinSub={sinSub} dentroAhora={dentroAhora} ok={ok} />
      </div>

      {dentroAhora ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
          <AlertIcon />
          Ya tiene una entrada activa sin salida registrada.
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ bloqueado, sinSub, dentroAhora, ok }: { bloqueado: boolean; sinSub: boolean; dentroAhora: boolean; ok: boolean }) {
  if (bloqueado) return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
      <XCircleIcon /> Bloqueado
    </span>
  );
  if (sinSub) return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
      <AlertIcon /> Sin suscripción
    </span>
  );
  if (dentroAhora) return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
      <AlertIcon /> Ya adentro
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-xs font-semibold text-brand-green">
      <CheckIcon /> Puede ingresar
    </span>
  );
}

function BlockedInfo({ socio, suscripcionFutura, asistenciaActiva }: { socio: SocioResult; suscripcionFutura: SuscripcionActiva | null; asistenciaActiva: AsistenciaActiva | null }) {
  if (asistenciaActiva) return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-300 space-y-1">
      <div className="font-semibold flex items-center gap-2"><AlertIcon /> Socio ya registrado adentro</div>
      <div className="text-xs text-slate-400">Registra primero la salida antes de una nueva entrada.</div>
    </div>
  );
  if (!socio.es_activo) return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300 space-y-1">
      <div className="font-semibold flex items-center gap-2"><XCircleIcon /> Socio bloqueado</div>
      <div className="text-xs text-slate-400">El socio está deshabilitado manualmente. Contacta administración.</div>
    </div>
  );
  if (suscripcionFutura) return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-300 space-y-1">
      <div className="font-semibold flex items-center gap-2"><AlertIcon /> Suscripción aún no vigente</div>
      <div className="text-xs text-slate-400">
        Tu suscripción inicia el <span className="font-semibold text-amber-300">{suscripcionFutura.fecha_inicio}</span>. Aún no puedes ingresar.
      </div>
    </div>
  );
  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-300 space-y-1">
      <div className="font-semibold flex items-center gap-2"><AlertIcon /> Sin suscripción activa</div>
      <div className="text-xs text-slate-400">El socio no tiene una suscripción vigente. Dirígelo a caja.</div>
    </div>
  );
}
