"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

// ─── PDF helper ───────────────────────────────────────────────────────────────

async function generarFacturaPDF(pago: PagoRow, sucursal: SucursalInfo) {
  const { abrirFacturaPDF } = await import("./FacturaPDF");
  await abrirFacturaPDF({ pago, sucursal });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MetodoPago = "EFECTIVO" | "QR_LIBELULA" | "TRANSFERENCIA" | "CRIPTOMONEDA";
type Moneda = "BOB" | "USD";
type FilterMetodo = "todos" | MetodoPago;
type FilterMoneda = "todos" | Moneda;
type FilterFecha = "todos" | "hoy" | "semana" | "mes";

type FacturaRow = {
  id: number; numero: number; nit_ci_comprador: string;
  razon_social_comprador: string; cufd: string | null;
  codigo_autorizacion: string | null; fecha_emision: string;
};

type PagoRow = {
  id: number; monto_pagado: number; codigo_moneda: Moneda;
  metodo_pago: MetodoPago; referencia_transaccion: string | null;
  fecha_pago: string; socio_id: number; suscripcion_id: number;
  facturas: FacturaRow | null;
  socios: { nombre: string | null; apellido: string | null; ci: string | null } | null;
  suscripciones: {
    plan_id: number; fecha_inicio: string; fecha_fin: string;
    planes: { nombre: string | null; descripcion: string | null } | null;
  } | null;
};

type SocioSearch = {
  id: number; nombre: string | null; apellido: string | null;
  ci: string | null; whatsapp: string | null; es_activo: boolean | null;
};

type PlanRow = {
  id: number; nombre: string | null; monto: number;
  codigo_moneda: Moneda; duracion_dias: number; activo: boolean;
};

type SuscripcionActiva = {
  id: number; plan_id: number; fecha_inicio: string; fecha_fin: string; estado: string;
  planes: { nombre: string | null; monto: number; codigo_moneda: Moneda } | null;
};

type SucursalInfo = {
  id: number; nombre: string; direccion: string;
  telefono: string | null; ciudad: string; nit: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPLEADO_ID = 1;
const SUCURSAL_ID = 1;
const TZ = "America/La_Paz";

const METODOS: { value: MetodoPago; label: string; icon: string }[] = [
  { value: "EFECTIVO", label: "Efectivo", icon: "💵" },
  { value: "QR_LIBELULA", label: "QR Libélula", icon: "📱" },
  { value: "TRANSFERENCIA", label: "Transferencia", icon: "🏦" },
  { value: "CRIPTOMONEDA", label: "Cripto", icon: "₿" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBoDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}
function formatDate(iso: string) {
  if (!iso) return "—";
  // Parsear como fecha local (sin conversión UTC) agregando hora noon para evitar drift
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function fmtMoney(n: number, currency: Moneda) {
  return `${currency === "BOB" ? "Bs" : "$"} ${Number(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr); d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function todayStr() { return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); }
function weekAgoStr() { return new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA", { timeZone: TZ }); }
function monthStartStr() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function metodoBadge(m: MetodoPago) {
  const map: Record<MetodoPago, string> = {
    EFECTIVO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    QR_LIBELULA: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    TRANSFERENCIA: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    CRIPTOMONEDA: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  };
  const labels: Record<MetodoPago, string> = {
    EFECTIVO: "Efectivo", QR_LIBELULA: "QR Libélula",
    TRANSFERENCIA: "Transferencia", CRIPTOMONEDA: "Cripto",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${map[m]}`}>{labels[m]}</span>;
}

function exportCSV(rows: PagoRow[]) {
  const headers = ["ID", "Socio", "CI", "Plan", "Monto", "Moneda", "Método", "Referencia", "Fecha", "Factura #"];
  const lines = rows.map((r) => [
    r.id,
    [r.socios?.nombre, r.socios?.apellido].filter(Boolean).join(" "),
    r.socios?.ci ?? "",
    r.suscripciones?.planes?.nombre ?? "",
    Number(r.monto_pagado).toFixed(2),
    r.codigo_moneda,
    r.metodo_pago,
    r.referencia_transaccion ?? "",
    formatDateTime(r.fecha_pago),
    r.facturas?.numero ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `pagos_${todayStr()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" /><path d="M16.5 16.5 21 21" /></svg>; }
function XIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>; }
function CashIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>; }
function DownloadIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function ChevronIcon({ dir }: { dir: "left" | "right" }) { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>; }
function CreditIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>; }

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ open, message, onClose }: { open: boolean; message: string; onClose: () => void }) {
  useEffect(() => { if (!open) return; const t = setTimeout(onClose, 2400); return () => clearTimeout(t); }, [open, onClose]);
  return (
    <div className={["fixed right-4 top-4 z-[70] transition-all duration-200", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"].join(" ")} role="status">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-green/25 bg-[#0b1220] px-4 py-3 shadow-2xl">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green"><CheckIcon /></span>
        <span className="text-sm font-semibold text-slate-100">{message}</span>
        <button onClick={onClose} className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, hint, error, success, children }: { label: string; hint?: string; error?: string; success?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      <div className="relative mt-1.5">
        {children}
        {success && !error && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-green"><CheckIcon /></span>}
      </div>
      {error && <p className="mt-1 flex items-center gap-1 text-xs text-red-400 animate-[shake_0.3s_ease]"><span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />{error}</p>}
    </div>
  );
}

function inputCls(hasError?: boolean, hasSuccess?: boolean) {
  return ["w-full rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors pr-10",
    hasError ? "border-red-500/60 focus:ring-2 focus:ring-red-500/40"
      : hasSuccess ? "border-brand-green/50 focus:ring-2 focus:ring-brand-green/40"
      : "border-[#1e293b] focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/50"].join(" ");
}

// ─── Historial Panel ──────────────────────────────────────────────────────────

function HistorialPanel({ socioId, socioNombre, sucursal, onClose }: {
  socioId: number; socioNombre: string; sucursal: SucursalInfo | null; onClose: () => void;
}) {
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from("pagos")
      .select(`id,monto_pagado,codigo_moneda,metodo_pago,referencia_transaccion,fecha_pago,socio_id,suscripcion_id,
        facturas(id,numero,nit_ci_comprador,razon_social_comprador,cufd,codigo_autorizacion,fecha_emision),
        socios(nombre,apellido,ci),
        suscripciones(plan_id,fecha_inicio,fecha_fin,planes(nombre,descripcion))`)
      .eq("socio_id", socioId)
      .order("fecha_pago", { ascending: false })
      .then(({ data }) => { setPagos((data ?? []) as unknown as PagoRow[]); setLoading(false); });
  }, [socioId]);

  const totalBob = pagos.filter((p) => p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0);
  const totalUsd = pagos.filter((p) => p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative w-full max-w-md h-full bg-[#020617] border-l border-[#1e293b] flex flex-col shadow-2xl animate-[slideInRight_0.25s_ease]">
        <div className="flex items-center justify-between gap-3 border-b border-[#1e293b] px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green"><UserIcon /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Historial de pagos</p>
              <p className="text-sm font-bold text-slate-100 truncate max-w-[200px]">{socioNombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 py-4 border-b border-[#1e293b] shrink-0">
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Total BOB</div>
            <div className="text-base font-bold text-brand-green">{fmtMoney(totalBob, "BOB")}</div>
          </div>
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Total USD</div>
            <div className="text-base font-bold text-sky-400">{fmtMoney(totalUsd, "USD")}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <p className="text-sm text-slate-500 text-center py-8">Cargando…</p>
          ) : pagos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Sin pagos registrados.</p>
          ) : pagos.map((p) => (
            <div key={p.id} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100">{p.suscripciones?.planes?.nombre ?? "—"}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(p.fecha_pago)}</div>
                  {p.referencia_transaccion && (
                    <div className="text-[10px] text-slate-600 mt-0.5">Ref: {p.referencia_transaccion}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${p.codigo_moneda === "BOB" ? "text-brand-green" : "text-sky-400"}`}>
                    {fmtMoney(Number(p.monto_pagado), p.codigo_moneda)}
                  </div>
                  {p.facturas?.numero && <div className="text-[10px] text-slate-500">Fact. #{p.facturas.numero}</div>}
                </div>
              </div>
              <div className="flex items-center justify-between">
                {metodoBadge(p.metodo_pago)}
                {sucursal && (
                  <button onClick={() => void generarFacturaPDF(p, sucursal)}
                    className="flex items-center gap-1.5 rounded-xl border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 text-xs font-semibold text-brand-green hover:bg-brand-green/20 transition-all">
                    <DownloadIcon /> PDF
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function PagosPage() {
  const [rows, setRows] = useState<PagoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sucursal, setSucursal] = useState<SucursalInfo | null>(null);
  const [search, setSearch] = useState("");
  const [filterMetodo, setFilterMetodo] = useState<FilterMetodo>("todos");
  const [filterMoneda, setFilterMoneda] = useState<FilterMoneda>("todos");
  const [filterFecha, setFilterFecha] = useState<FilterFecha>("todos");
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState({ open: false, message: "" });
  const [historialSocio, setHistorialSocio] = useState<{ id: number; nombre: string } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  // steps: 0=buscar+ficha, 1=fecha inicio, 2=plan, 3=pago+factura
  const [step, setStep] = useState(0);
  const [socios, setSocios] = useState<SocioSearch[]>([]);
  const [socioSearch, setSocioSearch] = useState("");
  const [socioSel, setSocioSel] = useState<SocioSearch | null>(null);
  const [planes, setPlanes] = useState<PlanRow[]>([]);
  const [planSel, setPlanSel] = useState<PlanRow | null>(null);
  const [suscActiva, setSuscActiva] = useState<SuscripcionActiva | null>(null);
  // null = no decidido, true = sí renovar, false = no (cancelar)
  const [confirmarRenovacion, setConfirmarRenovacion] = useState<boolean | null>(null);
  const [fechaInicioPago, setFechaInicioPago] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("BOB");
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [nitCi, setNitCi] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cufd, setCufd] = useState("");
  const [codAutorizacion, setCodAutorizacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showToast = (message: string) => setToast({ open: true, message });

  async function refresh() {
    setLoading(true);
    const { data } = await supabase.from("pagos")
      .select(`id,monto_pagado,codigo_moneda,metodo_pago,referencia_transaccion,fecha_pago,socio_id,suscripcion_id,
        facturas(id,numero,nit_ci_comprador,razon_social_comprador,cufd,codigo_autorizacion,fecha_emision),
        socios(nombre,apellido,ci),
        suscripciones(plan_id,fecha_inicio,fecha_fin,planes(nombre,descripcion))`)
      .order("fecha_pago", { ascending: false });
    setRows((data ?? []) as unknown as PagoRow[]);
    setLoading(false);
  }

  async function loadSucursal() {
    const { data } = await supabase.from("sucursales").select("*").eq("id", SUCURSAL_ID).single();
    if (data) setSucursal(data as SucursalInfo);
  }

  useEffect(() => { void refresh(); void loadSucursal(); }, []);

  // Stats
  const monthStart = monthStartStr();
  const todayDate = todayStr();
  const mesBOB = rows.filter((r) => r.codigo_moneda === "BOB" && toBoDate(r.fecha_pago) >= monthStart).reduce((a, r) => a + Number(r.monto_pagado), 0);
  const mesUSD = rows.filter((r) => r.codigo_moneda === "USD" && toBoDate(r.fecha_pago) >= monthStart).reduce((a, r) => a + Number(r.monto_pagado), 0);
  const pagosHoy = rows.filter((r) => toBoDate(r.fecha_pago) === todayDate).length;

  // Filters
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const nombre = [r.socios?.nombre, r.socios?.apellido].filter(Boolean).join(" ").toLowerCase();
      const ci = (r.socios?.ci ?? "").toLowerCase();
      const plan = (r.suscripciones?.planes?.nombre ?? "").toLowerCase();
      const ref = (r.referencia_transaccion ?? "").toLowerCase();
      if (q && !nombre.includes(q) && !ci.includes(q) && !plan.includes(q) && !ref.includes(q)) return false;
      if (filterMetodo !== "todos" && r.metodo_pago !== filterMetodo) return false;
      if (filterMoneda !== "todos" && r.codigo_moneda !== filterMoneda) return false;
      if (filterFecha !== "todos") {
        const d = toBoDate(r.fecha_pago);
        if (filterFecha === "hoy" && d !== todayDate) return false;
        if (filterFecha === "semana" && d < weekAgoStr()) return false;
        if (filterFecha === "mes" && d < monthStart) return false;
      }
      return true;
    });
  }, [rows, search, filterMetodo, filterMoneda, filterFecha]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const rand12 = () => Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");

  function openModal() {
    setStep(0); setSocioSearch(""); setSocioSel(null); setPlanSel(null);
    setSuscActiva(null); setConfirmarRenovacion(null); setFechaInicioPago(todayStr());
    setMonto(""); setMoneda("BOB"); setMetodo("EFECTIVO");
    setReferencia(""); setNitCi(""); setRazonSocial("");
    setCufd(rand12()); setCodAutorizacion(rand12());
    setErrors({});
    setShowModal(true);
  }

  async function searchSocios(q: string) {
    setSocioSearch(q);
    if (q.length < 2) { setSocios([]); return; }
    const { data } = await supabase.from("socios").select("id,nombre,apellido,ci,whatsapp,es_activo")
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,ci.ilike.%${q}%`).limit(8);
    setSocios((data ?? []) as SocioSearch[]);
  }

  async function selectSocio(s: SocioSearch) {
    setSocioSel(s); setSocios([]); setSocioSearch([s.nombre, s.apellido].filter(Boolean).join(" "));
    setNitCi(s.ci ?? "");
    // Razón social: solo apellido paterno
    setRazonSocial((s.apellido ?? s.nombre ?? "").toUpperCase());
    const { data: susc } = await supabase.from("suscripciones")
      .select("id,plan_id,fecha_inicio,fecha_fin,estado,planes(nombre,monto,codigo_moneda)")
      .eq("socio_id", s.id)
      .gte("fecha_fin", todayStr())
      .order("fecha_fin", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSuscActiva(susc as SuscripcionActiva | null);
    setConfirmarRenovacion(null);
    const { data: pl } = await supabase.from("planes").select("*").eq("activo", true).order("monto");
    setPlanes((pl ?? []) as PlanRow[]);
    // Si no tiene suscripción activa, fecha inicio = hoy por defecto
    if (!susc) setFechaInicioPago(todayStr());
    else setFechaInicioPago("");
  }

  function validateStep(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!socioSel) e.socio = "Selecciona un socio";
      if (socioSel && suscActiva && confirmarRenovacion === null) e.renovar = "Confirma si deseas renovar con anticipación";
    }
    if (step === 1) {
      if (!fechaInicioPago) e.fechaInicio = "Selecciona la fecha de inicio";
      if (suscActiva && fechaInicioPago && fechaInicioPago <= suscActiva.fecha_fin) {
        e.fechaInicio = `Debe ser posterior al ${formatDate(suscActiva.fecha_fin)}`;
      }
    }
    if (step === 2) {
      if (!planSel) e.plan = "Selecciona un plan";
    }
    if (step === 3) {
      if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) e.monto = "Monto inválido";
      if (!nitCi.trim()) e.nitCi = "NIT/CI requerido";
      if (!razonSocial.trim()) e.razonSocial = "Razón social requerida";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validateStep()) return;
    if (!socioSel || !planSel) return;
    setSaving(true);
    try {
      const fechaInicio = fechaInicioPago;
      const fechaFin = addDays(fechaInicio, planSel.duracion_dias);

      // Marcar suscripción anterior como vencida si existe
      if (suscActiva) {
        await supabase.from("suscripciones").update({ estado: "VENCIDA" }).eq("id", suscActiva.id);
      }

      const { data: susc, error: suscErr } = await supabase.from("suscripciones").insert({
        socio_id: socioSel.id, plan_id: planSel.id,
        sucursal_inscripcion_id: SUCURSAL_ID,
        empleado_registro_id: EMPLEADO_ID,
        fecha_inicio: fechaInicio, fecha_fin: fechaFin, estado: "ACTIVA",
      }).select().single();
      if (suscErr) throw suscErr;

      const { data: pago, error: pagoErr } = await supabase.from("pagos").insert({
        socio_id: socioSel.id, suscripcion_id: susc.id,
        monto_pagado: Number(monto), codigo_moneda: moneda,
        metodo_pago: metodo, referencia_transaccion: referencia || null,
        empleado_cobrador_id: EMPLEADO_ID, sucursal_id: SUCURSAL_ID,
      }).select(`id,monto_pagado,codigo_moneda,metodo_pago,referencia_transaccion,fecha_pago,socio_id,suscripcion_id,
        facturas(id,numero,nit_ci_comprador,razon_social_comprador,cufd,codigo_autorizacion,fecha_emision),
        socios(nombre,apellido,ci),
        suscripciones(plan_id,fecha_inicio,fecha_fin,planes(nombre,descripcion))`).single();
      if (pagoErr) throw pagoErr;

      // numero es GENERATED ALWAYS AS IDENTITY — Postgres lo asigna automáticamente
      const { error: facturaErr } = await supabase.from("facturas").insert({
        pago_id: pago.id,
        nit_ci_comprador: nitCi.trim(),
        razon_social_comprador: razonSocial.trim().toUpperCase(),
        fecha_emision: new Date().toISOString(),
        cufd: cufd,
        codigo_autorizacion: codAutorizacion,
      });
      if (facturaErr) throw facturaErr;

      setShowModal(false);
      showToast(suscActiva ? "Renovación anticipada registrada" : "Pago registrado correctamente");
      // Actualizar campo suscrito del socio
      await supabase.from("socios").update({ suscrito: true }).eq("id", socioSel.id);
      void refresh();
      // Re-consultar el pago con la factura ya insertada para el PDF
      if (sucursal) {
        const { data: pagoConFactura } = await supabase.from("pagos")
          .select(`id,monto_pagado,codigo_moneda,metodo_pago,referencia_transaccion,fecha_pago,socio_id,suscripcion_id,
            facturas(id,numero,nit_ci_comprador,razon_social_comprador,cufd,codigo_autorizacion,fecha_emision),
            socios(nombre,apellido,ci),
            suscripciones(plan_id,fecha_inicio,fecha_fin,planes(nombre,descripcion))`)
          .eq("id", pago.id)
          .single();
        if (pagoConFactura) void generarFacturaPDF(pagoConFactura as unknown as PagoRow, sucursal);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar. Intenta de nuevo.";
      setErrors({ general: msg });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <Toast open={toast.open} message={toast.message} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      {historialSocio && (
        <HistorialPanel
          socioId={historialSocio.id}
          socioNombre={historialSocio.nombre}
          sucursal={sucursal}
          onClose={() => setHistorialSocio(null)}
        />
      )}

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Finanzas</div>
            <h1 className="section-title">Pagos</h1>
            <p className="section-description">Registro y seguimiento de cobros</p>
          </div>
          <button onClick={openModal}
            className="flex items-center gap-2 rounded-2xl bg-brand-green px-5 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20">
            <CashIcon /> Registrar pago
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Recaudado mes (BOB)", value: fmtMoney(mesBOB, "BOB"), color: "text-brand-green" },
          { label: "Recaudado mes (USD)", value: fmtMoney(mesUSD, "USD"), color: "text-sky-400" },
          { label: "Pagos hoy", value: String(pagosHoy), color: "text-violet-400" },
          { label: "Total registros", value: String(rows.length), color: "text-slate-100" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
            <div className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><SearchIcon /></span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar socio, CI, plan, referencia…"
              className="w-full rounded-2xl border border-[#1e293b] bg-white/5 pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green/50" />
          </div>
          <button onClick={() => exportCSV(filtered)}
            className="flex items-center gap-1.5 rounded-2xl border border-[#1e293b] bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:border-brand-green/40 transition-all">
            <DownloadIcon /> CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["todos", ...METODOS.map((m) => m.value)] as FilterMetodo[]).map((v) => (
            <button key={v} onClick={() => { setFilterMetodo(v); setPage(0); }}
              className={["rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                filterMetodo === v ? "border-brand-green/50 bg-brand-green/15 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
              {v === "todos" ? "Todos los métodos" : METODOS.find((m) => m.value === v)?.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {(["todos", "BOB", "USD"] as FilterMoneda[]).map((v) => (
            <button key={v} onClick={() => { setFilterMoneda(v); setPage(0); }}
              className={["rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                filterMoneda === v ? "border-sky-500/50 bg-sky-500/15 text-sky-400" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
              {v === "todos" ? "Todas las monedas" : v}
            </button>
          ))}
          <span className="w-px bg-[#1e293b] mx-1" />
          {(["todos", "hoy", "semana", "mes"] as FilterFecha[]).map((v) => (
            <button key={v} onClick={() => { setFilterFecha(v); setPage(0); }}
              className={["rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                filterFecha === v ? "border-violet-500/50 bg-violet-500/15 text-violet-400" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
              {v === "todos" ? "Todas las fechas" : v === "hoy" ? "Hoy" : v === "semana" ? "Última semana" : "Este mes"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#1e293b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e293b] bg-white/5">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Socio</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Plan</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Monto</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Método</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Referencia</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Fecha</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Factura</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500">Cargando…</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500">Sin resultados</td></tr>
              ) : paginated.map((r) => {
                const nombre = [r.socios?.nombre, r.socios?.apellido].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={r.id}
                    onClick={() => setHistorialSocio({ id: r.socio_id, nombre })}
                    className="border-b border-[#1e293b]/60 hover:bg-white/5 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{nombre}</div>
                      <div className="text-xs text-slate-500">{r.socios?.ci ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.suscripciones?.planes?.nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${r.codigo_moneda === "BOB" ? "text-brand-green" : "text-sky-400"}`}>
                        {fmtMoney(Number(r.monto_pagado), r.codigo_moneda)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{metodoBadge(r.metodo_pago)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate">{r.referencia_transaccion ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(r.fecha_pago)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.facturas?.numero ? (
                        <button onClick={(e) => { e.stopPropagation(); if (sucursal) void generarFacturaPDF(r, sucursal); }}
                          className="inline-flex items-center gap-1 rounded-xl border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 text-xs font-semibold text-brand-green hover:bg-brand-green/20 transition-all">
                          <DownloadIcon /> #{r.facturas.numero}
                        </button>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#1e293b] px-4 py-3">
            <span className="text-xs text-slate-500">{filtered.length} resultados · página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100 disabled:opacity-30 transition-all">
                <ChevronIcon dir="left" />
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100 disabled:opacity-30 transition-all">
                <ChevronIcon dir="right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo pago */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg rounded-3xl border border-[#1e293b] bg-[#020617] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[#1e293b] px-6 py-4 shrink-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Registrar pago</p>
                <p className="text-sm font-bold text-slate-100">
                  {["Buscar socio", "Fecha de inicio", "Seleccionar plan", "Pago y facturación"][step]}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
            </div>

            {/* Progress */}
            <div className="flex gap-1.5 px-6 pt-4 shrink-0">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={["h-1 flex-1 rounded-full transition-all duration-300", i <= step ? "bg-brand-green" : "bg-[#1e293b]"].join(" ")} />
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {errors.general && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 animate-[shake_0.3s_ease]">
                  {errors.general}
                </p>
              )}

              {/* ── Step 0: Buscar socio ── */}
              {step === 0 && (
                <div className="space-y-3">
                  <Field label="Buscar socio" error={errors.socio}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><SearchIcon /></span>
                      <input
                        value={socioSearch}
                        onChange={(e) => void searchSocios(e.target.value)}
                        placeholder="Nombre, apellido o CI…"
                        className={["w-full rounded-2xl border bg-[#0b1220] pl-9 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors",
                          errors.socio ? "border-red-500/60 focus:ring-2 focus:ring-red-500/40"
                            : socioSel ? "border-brand-green/50 focus:ring-2 focus:ring-brand-green/40"
                            : "border-[#1e293b] focus:ring-2 focus:ring-brand-green/50"].join(" ")}
                      />
                    </div>
                    {/* Dropdown resultados */}
                    {socios.length > 0 && (
                      <div className="mt-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] shadow-xl overflow-hidden">
                        {socios.map((s) => (
                          <button key={s.id} onClick={() => void selectSocio(s)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-[#1e293b]/50 last:border-0">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green text-sm font-bold">
                              {(s.nombre?.[0] ?? "?").toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-100">{[s.nombre, s.apellido].filter(Boolean).join(" ")}</div>
                              <div className="text-xs text-slate-500">CI: {s.ci ?? "—"}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.es_activo ? "border-brand-green/30 text-brand-green bg-brand-green/10" : "border-slate-600 text-slate-500 bg-white/5"}`}>
                              {s.es_activo ? "Activo" : "Inactivo"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>

                  {/* Ficha del socio seleccionado */}
                  {socioSel && (
                    <div className="rounded-2xl border border-[#1e293b] bg-white/5 overflow-hidden">
                      <div className="flex items-center gap-4 px-4 py-4 border-b border-[#1e293b]">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-green/15 text-brand-green text-lg font-bold border border-brand-green/25">
                          {(socioSel.nombre?.[0] ?? "?").toUpperCase()}
                        </span>
                        <div>
                          <p className="text-base font-bold text-slate-100">{[socioSel.nombre, socioSel.apellido].filter(Boolean).join(" ")}</p>
                          <p className="text-xs text-slate-500">CI: {socioSel.ci ?? "—"} {socioSel.whatsapp ? `· 📱 ${socioSel.whatsapp}` : ""}</p>
                        </div>
                        <button onClick={() => { setSocioSel(null); setSocioSearch(""); setSuscActiva(null); setConfirmarRenovacion(null); }}
                          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-500 hover:text-slate-200 transition-colors">
                          <XIcon />
                        </button>
                      </div>

                      {/* Estado suscripción */}
                      {suscActiva ? (
                        <div className="px-4 py-4 space-y-3">
                          {/* Tarjeta plan activo */}
                          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Plan activo</p>
                                <p className="text-sm font-bold text-slate-100 mt-0.5">{suscActiva.planes?.nombre}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Vence el <span className="font-semibold text-amber-300">{formatDate(suscActiva.fecha_fin)}</span>
                                </p>
                              </div>
                              <span className="text-sm font-bold text-amber-300 shrink-0">
                                {suscActiva.planes ? fmtMoney(suscActiva.planes.monto, suscActiva.planes.codigo_moneda) : ""}
                              </span>
                            </div>
                          </div>
                          {/* Pregunta renovación anticipada */}
                          <div>
                            <p className="text-xs text-slate-400 mb-2">
                              Tienes una suscripción activa, ¿quieres renovar con anticipación?
                            </p>
                            {errors.renovar && (
                              <p className="mb-2 text-xs text-red-400 animate-[shake_0.3s_ease]">{errors.renovar}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => setConfirmarRenovacion(true)}
                                className={["flex-1 rounded-2xl border py-2.5 text-sm font-bold transition-all",
                                  confirmarRenovacion === true
                                    ? "border-brand-green/50 bg-brand-green/15 text-brand-green"
                                    : "border-[#1e293b] bg-white/5 text-slate-300 hover:border-brand-green/30 hover:text-brand-green"].join(" ")}>
                                ✓ Sí, renovar
                              </button>
                              <button
                                onClick={() => { setConfirmarRenovacion(false); setShowModal(false); }}
                                className="flex-1 rounded-2xl border border-[#1e293b] bg-white/5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all">
                                No, cancelar
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-brand-green/5">
                          <p className="text-xs font-bold text-brand-green uppercase tracking-wide">✓ Sin suscripción activa</p>
                          <p className="text-xs text-slate-500 mt-0.5">Podrás elegir la fecha de inicio en el siguiente paso</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 1: Fecha de inicio ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green text-xs font-bold">
                      {(socioSel?.nombre?.[0] ?? "?").toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{[socioSel?.nombre, socioSel?.apellido].filter(Boolean).join(" ")}</p>
                      {suscActiva
                        ? <p className="text-xs text-amber-400">Renovación anticipada · vence {formatDate(suscActiva.fecha_fin)}</p>
                        : <p className="text-xs text-brand-green">Nueva suscripción</p>}
                    </div>
                  </div>
                  <Field
                    label="Fecha de inicio"
                    hint={suscActiva ? `Debe ser posterior al ${formatDate(suscActiva.fecha_fin)}` : "Desde cuándo aplica la suscripción"}
                    error={errors.fechaInicio}
                    success={!!fechaInicioPago && !errors.fechaInicio}>
                    <input
                      type="date"
                      value={fechaInicioPago}
                      min={suscActiva ? addDays(suscActiva.fecha_fin, 1) : todayStr()}
                      onChange={(e) => setFechaInicioPago(e.target.value)}
                      className={inputCls(!!errors.fechaInicio, !!fechaInicioPago && !errors.fechaInicio)}
                    />
                  </Field>
                  {fechaInicioPago && !errors.fechaInicio && (
                    <div className="rounded-xl border border-brand-green/20 bg-brand-green/5 px-4 py-2.5 text-xs text-slate-400">
                      Inicio: <span className="font-bold text-brand-green">{formatDate(fechaInicioPago)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 2: Plan ── */}
              {step === 2 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 mb-1">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green text-xs font-bold">
                      {(socioSel?.nombre?.[0] ?? "?").toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{[socioSel?.nombre, socioSel?.apellido].filter(Boolean).join(" ")}</p>
                      <p className="text-xs text-slate-400">Inicio: <span className="text-brand-green font-semibold">{formatDate(fechaInicioPago)}</span></p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Selecciona un plan</p>
                  {errors.plan && <p className="text-xs text-red-400 animate-[shake_0.3s_ease]">{errors.plan}</p>}
                  {planes.map((p) => (
                    <button key={p.id} onClick={() => { setPlanSel(p); setMonto(String(p.monto)); setMoneda(p.codigo_moneda); }}
                      className={["w-full flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-all",
                        planSel?.id === p.id ? "border-brand-green/50 bg-brand-green/10 shadow-sm shadow-brand-green/10" : "border-[#1e293b] bg-white/5 hover:border-brand-green/30"].join(" ")}>
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{p.nombre}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.duracion_dias} días · vence {formatDate(addDays(fechaInicioPago, p.duracion_dias))}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-bold ${p.codigo_moneda === "BOB" ? "text-brand-green" : "text-sky-400"}`}>
                          {fmtMoney(p.monto, p.codigo_moneda)}
                        </span>
                        {planSel?.id === p.id && <span className="text-brand-green"><CheckIcon /></span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* ── Step 3: Pago + Facturación ── */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Resumen */}
                  <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">Resumen</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{[socioSel?.nombre, socioSel?.apellido].filter(Boolean).join(" ")}</span>
                      <span className="text-sm font-bold text-slate-100">{planSel?.nombre}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(fechaInicioPago)} → {planSel ? formatDate(addDays(fechaInicioPago, planSel.duracion_dias)) : "—"}
                      {suscActiva && <span className="ml-2 text-amber-400">· Renovación anticipada</span>}
                    </p>
                  </div>

                  {/* Monto y moneda */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Monto" error={errors.monto} success={!!monto && !errors.monto}>
                      <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)}
                        className={inputCls(!!errors.monto, !!monto && !errors.monto)} />
                    </Field>
                    <Field label="Moneda">
                      <div className="flex gap-2 mt-1.5">
                        {(["BOB", "USD"] as Moneda[]).map((c) => (
                          <button key={c} onClick={() => setMoneda(c)}
                            className={["flex-1 rounded-2xl border py-3 text-sm font-bold transition-all",
                              moneda === c ? "border-brand-green/50 bg-brand-green/15 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-200"].join(" ")}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>

                  {/* Método */}
                  <Field label="Método de pago">
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {METODOS.map((m) => (
                        <button key={m.value} onClick={() => setMetodo(m.value)}
                          className={["rounded-2xl border px-3 py-3 text-xs font-semibold transition-all text-left flex items-center gap-2",
                            metodo === m.value ? "border-brand-green/50 bg-brand-green/15 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-200"].join(" ")}>
                          <span className="text-base">{m.icon}</span> {m.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  {metodo !== "EFECTIVO" && (
                    <Field label="Referencia / Comprobante">
                      <input value={referencia} onChange={(e) => setReferencia(e.target.value)}
                        placeholder="Nro. de transacción…"
                        className={inputCls()} />
                    </Field>
                  )}

                  {/* Facturación Bolivia */}
                  <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Datos de facturación</p>
                    <Field label="NIT / CI del comprador" error={errors.nitCi} success={!!nitCi && !errors.nitCi}>
                      <input value={nitCi} onChange={(e) => setNitCi(e.target.value)}
                        placeholder="Ej: 12345678"
                        className={inputCls(!!errors.nitCi, !!nitCi && !errors.nitCi)} />
                    </Field>
                    <Field label="Razón social" error={errors.razonSocial} success={!!razonSocial && !errors.razonSocial}>
                      <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value.toUpperCase())}
                        placeholder="APELLIDO PATERNO"
                        className={inputCls(!!errors.razonSocial, !!razonSocial && !errors.razonSocial)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="CUFD" hint="Generado automáticamente">
                        <input value={cufd} readOnly
                          className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220]/60 px-4 py-3 text-sm text-slate-400 outline-none cursor-default font-mono tracking-wider" />
                      </Field>
                      <Field label="Cód. Autorización" hint="Generado automáticamente">
                        <input value={codAutorizacion} readOnly
                          className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220]/60 px-4 py-3 text-sm text-slate-400 outline-none cursor-default font-mono tracking-wider" />
                      </Field>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#1e293b] px-6 py-4 shrink-0">
              <button onClick={() => step > 0 ? setStep((s) => s - 1) : setShowModal(false)}
                className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-all">
                {step === 0 ? "Cancelar" : "← Atrás"}
              </button>
              {step < 3 ? (
                <button
                  onClick={() => {
                    if (!validateStep()) return;
                    // Si tiene susc activa, solo avanzar si confirmó renovar
                    if (step === 0 && suscActiva && confirmarRenovacion !== true) return;
                    setStep((s) => s + 1);
                  }}
                  className="rounded-2xl bg-brand-green px-6 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 transition-all disabled:opacity-50"
                  disabled={step === 0 && !socioSel}>
                  Siguiente →
                </button>
              ) : (
                <button onClick={() => void handleSave()} disabled={saving}
                  className="flex items-center gap-2 rounded-2xl bg-brand-green px-6 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 disabled:opacity-50 transition-all">
                  {saving ? "Guardando…" : <><CreditIcon /> Confirmar pago</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
