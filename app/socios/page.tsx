"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

const TZ = "America/La_Paz";

// ── Types ─────────────────────────────────────────────────────────────────────

type SocioRow = {
  id: number;
  nombre: string | null;
  apellido: string | null;
  ci: string | null;
  es_activo: boolean | null;
  suscrito: boolean | null;
  whatsapp: string | null;
  genero: string | null;
  fecha_nacimiento: string | null;
  foto_url: string | null;
  fecha_registro: string | null;
};

type SuscripcionRow = {
  id: number;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  planes: { nombre: string | null; monto: number | null; codigo_moneda: string | null } | null;
};

type PagoRow = {
  id: number;
  monto_pagado: number;
  codigo_moneda: string;
  metodo_pago: string;
  fecha_pago: string;
};

type AsistenciaRow = {
  id: number;
  fecha_entrada: string;
  fecha_salida: string | null;
};

type SocioForm = {
  nombre: string;
  apellido: string;
  ci: string;
  whatsapp: string;
  genero: "M" | "F" | "O";
  fecha_nacimiento: string;
};

type SocioFormErrors = Partial<Record<keyof SocioForm, string>>;

type FilterEstado = "todos" | "activo" | "inactivo";
type FilterSub = "todos" | "suscrito" | "no_suscrito";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(p: string) { return p.replace(/[^\d]/g, ""); }

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(n: number, currency: string) {
  const sym = currency === "USD" ? "$" : "Bs";
  return `${sym} ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toBoTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function toBoDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

function durMin(entrada: string, salida: string | null) {
  if (!salida) return 0;
  return Math.round((new Date(salida).getTime() - new Date(entrada).getTime()) / 60000);
}

function fmtDur(min: number) {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
}

function validateForm(form: SocioForm): SocioFormErrors {
  const errors: SocioFormErrors = {};
  if (!form.nombre.trim()) errors.nombre = "Obligatorio";
  if (!form.apellido.trim()) errors.apellido = "Obligatorio";
  const ci = form.ci.trim();
  if (!ci) errors.ci = "Obligatorio";
  else if (ci.length < 4) errors.ci = "CI demasiado corto";
  const wa = normalizePhone(form.whatsapp.trim());
  if (!wa) errors.whatsapp = "Obligatorio";
  else if (wa.length < 8) errors.whatsapp = `Mín. 8 dígitos (tienes ${wa.length})`;
  if (!form.fecha_nacimiento.trim()) errors.fecha_nacimiento = "Obligatorio";
  return errors;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" /><path d="M16.5 16.5 21 21" /></svg>;
}
function PencilIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
}
function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 11.5a8 8 0 0 1-13.7 5.6L4 18l.9-2.2A8 8 0 1 1 20 11.5Z" /><path d="M8.8 9.6c.2-.5.3-.5.6-.5h.5c.2 0 .4.1.5.4l.6 1.4c.1.3.1.5 0 .7l-.4.5c-.1.2-.1.4 0 .6.4.8 1.3 1.6 2.1 2 .2.1.4.1.6 0l.6-.4c.2-.1.4-.1.7 0l1.4.6c.3.1.4.3.4.5v.5c0 .3 0 .4-.5.6-.4.2-1.2.4-2.1.2-1-.2-2.3-.8-3.7-2.1-1.3-1.3-2-2.6-2.2-3.6-.1-.9.1-1.7.3-2.2Z" /></svg>;
}
function XIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function CheckIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>;
}
function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
}
function CalIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}
function CreditIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
}
function ClockIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nombre, apellido, foto_url, size = "md" }: {
  nombre: string | null; apellido: string | null; foto_url?: string | null; size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "h-16 w-16 text-xl" : size === "md" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs";
  const initials = `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase() || "?";
  if (foto_url) {
    return <img src={foto_url} className={`${dims} rounded-2xl object-cover border border-[#1e293b] shrink-0`} alt="" />;
  }
  return (
    <div className={`${dims} rounded-2xl border border-brand-green/20 bg-brand-green/10 flex items-center justify-center font-bold text-brand-green shrink-0`}>
      {initials}
    </div>
  );
}

// ── StatusToggle ──────────────────────────────────────────────────────────────

function StatusToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={["relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none", checked ? "bg-brand-green/25 border-brand-green/50" : "bg-white/5 border-[#1e293b]"].join(" ")}
      aria-pressed={checked}>
      <span className={["inline-block h-4 w-4 transform rounded-full shadow transition-transform", checked ? "translate-x-6 bg-brand-green" : "translate-x-1 bg-slate-400"].join(" ")} />
    </button>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, hint, error, success, children }: {
  label: string; hint?: string; error?: string; success?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      <div className="relative mt-1.5">
        {children}
        {success && !error && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-green">
            <CheckIcon />
          </span>
        )}
      </div>
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-400 animate-[shake_0.3s_ease]">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ open, message, onClose }: { open: boolean; message: string; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [open, onClose]);
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

// ── Perfil Panel ──────────────────────────────────────────────────────────────

function PerfilPanel({ socio, onClose, onEdit }: {
  socio: SocioRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [subs, setSubs] = useState<SuscripcionRow[]>([]);
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("suscripciones")
        .select("id,estado,fecha_inicio,fecha_fin,planes(nombre,monto,codigo_moneda)")
        .eq("socio_id", socio.id)
        .order("fecha_inicio", { ascending: false })
        .limit(5),
      supabase.from("pagos")
        .select("id,monto_pagado,codigo_moneda,metodo_pago,fecha_pago")
        .eq("socio_id", socio.id)
        .order("fecha_pago", { ascending: false })
        .limit(5),
      supabase.from("asistencias")
        .select("id,fecha_entrada,fecha_salida")
        .eq("socio_id", socio.id)
        .order("fecha_entrada", { ascending: false })
        .limit(8),
    ]).then(([s, p, a]) => {
      setSubs((s.data ?? []) as unknown as SuscripcionRow[]);
      setPagos((p.data ?? []) as PagoRow[]);
      setAsistencias((a.data ?? []) as AsistenciaRow[]);
      setLoading(false);
    });
  }, [socio.id]);

  const activeSub = subs.find((s) => s.estado === "ACTIVA");
  const wa = socio.whatsapp ? normalizePhone(socio.whatsapp) : null;
  const waHref = wa ? `https://wa.me/${wa}` : null;

  const diasRestantes = activeSub
    ? Math.ceil((new Date(activeSub.fecha_fin).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative w-full max-w-md h-full bg-[#020617] border-l border-[#1e293b] flex flex-col shadow-2xl overflow-hidden animate-[slideInRight_0.25s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#1e293b] px-5 py-4 shrink-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Perfil del socio</span>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 rounded-xl border border-[#1e293b] bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-all">
              <PencilIcon /> Editar
            </button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Identidad */}
          <div className="flex items-center gap-4">
            <Avatar nombre={socio.nombre} apellido={socio.apellido} foto_url={socio.foto_url} size="lg" />
            <div className="min-w-0">
              <div className="text-lg font-bold text-slate-100 truncate">
                {[socio.nombre, socio.apellido].filter(Boolean).join(" ") || "—"}
              </div>
              <div className="text-sm text-slate-500">CI: {socio.ci ?? "—"}</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className={["inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", socio.es_activo ? "border-brand-green/30 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-500"].join(" ")}>
                  <span className={["h-1.5 w-1.5 rounded-full", socio.es_activo ? "bg-brand-green" : "bg-slate-500"].join(" ")} />
                  {socio.es_activo ? "Activo" : "Inactivo"}
                </span>
                <span className={["inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", socio.suscrito ? "border-sky-400/30 bg-sky-400/10 text-sky-400" : "border-[#1e293b] bg-white/5 text-slate-500"].join(" ")}>
                  {socio.suscrito ? "Suscrito" : "Sin suscripción"}
                </span>
              </div>
            </div>
          </div>

          {/* Datos personales */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Datos personales</p>
            {[
              { label: "Género", value: socio.genero === "M" ? "Masculino" : socio.genero === "F" ? "Femenino" : socio.genero === "O" ? "Otro" : "—" },
              { label: "Nacimiento", value: fmtDate(socio.fecha_nacimiento) },
              { label: "Registro", value: socio.fecha_registro ? fmtDate(toBoDate(socio.fecha_registro)) : "—" },
              { label: "WhatsApp", value: socio.whatsapp ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-xs font-semibold text-slate-200 text-right">{value}</span>
              </div>
            ))}
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer"
                className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 py-2 text-xs font-semibold text-brand-green hover:bg-brand-green/20 transition-all">
                <WhatsAppIcon /> Contactar por WhatsApp
              </a>
            )}
          </div>

          {/* Suscripción activa */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <CreditIcon />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Suscripción activa</p>
            </div>
            {loading ? (
              <p className="text-xs text-slate-500">Cargando…</p>
            ) : activeSub ? (
              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-100">{activeSub.planes?.nombre ?? "—"}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Vence</span>
                  <span className={["font-semibold", diasRestantes !== null && diasRestantes <= 3 ? "text-red-400" : diasRestantes !== null && diasRestantes <= 7 ? "text-amber-300" : "text-slate-200"].join(" ")}>
                    {fmtDate(activeSub.fecha_fin)}
                    {diasRestantes !== null && ` (${diasRestantes}d)`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Precio</span>
                  <span className="font-semibold text-brand-green">
                    {activeSub.planes ? fmtMoney(Number(activeSub.planes.monto), activeSub.planes.codigo_moneda ?? "BOB") : "—"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sin suscripción activa.</p>
            )}
          </div>

          {/* Pagos recientes */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <CalIcon />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Últimos pagos</p>
            </div>
            {loading ? (
              <p className="text-xs text-slate-500">Cargando…</p>
            ) : pagos.length === 0 ? (
              <p className="text-xs text-slate-500">Sin pagos registrados.</p>
            ) : (
              <div className="space-y-1.5">
                {pagos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{fmtMoney(Number(p.monto_pagado), p.codigo_moneda)}</div>
                      <div className="text-[10px] text-slate-500">{p.metodo_pago}</div>
                    </div>
                    <div className="text-[10px] text-slate-500 text-right">
                      {new Date(p.fecha_pago).toLocaleDateString("es-BO", { day: "numeric", month: "short", timeZone: TZ })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asistencias recientes */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <ClockIcon />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Asistencias recientes</p>
            </div>
            {loading ? (
              <p className="text-xs text-slate-500">Cargando…</p>
            ) : asistencias.length === 0 ? (
              <p className="text-xs text-slate-500">Sin asistencias registradas.</p>
            ) : (
              <div className="space-y-1.5">
                {asistencias.map((a) => {
                  const dur = durMin(a.fecha_entrada, a.fecha_salida);
                  const adentro = !a.fecha_salida;
                  return (
                    <div key={a.id} className={["flex items-center justify-between rounded-xl border px-3 py-2", adentro ? "border-brand-green/20 bg-brand-green/5" : "border-[#1e293b] bg-[#0b1220]"].join(" ")}>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200">
                          {new Date(a.fecha_entrada).toLocaleDateString("es-BO", { day: "numeric", month: "short", timeZone: TZ })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {toBoTime(a.fecha_entrada)}
                          {a.fecha_salida ? ` → ${toBoTime(a.fecha_salida)}` : ""}
                        </div>
                      </div>
                      {adentro ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-brand-green shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-pulse" />Adentro
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 shrink-0">{fmtDur(dur)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Form ────────────────────────────────────────────────────────────────

function SocioModal({ mode, form, setForm, touched, setTouched, fieldErrors, onSave, onClose, saving, error }: {
  mode: "create" | "edit";
  form: SocioForm;
  setForm: React.Dispatch<React.SetStateAction<SocioForm>>;
  touched: Partial<Record<keyof SocioForm, boolean>>;
  setTouched: React.Dispatch<React.SetStateAction<Partial<Record<keyof SocioForm, boolean>>>>;
  fieldErrors: SocioFormErrors;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const anyTouched = Object.keys(touched).length > 0;

  const fields: (keyof SocioForm)[] = ["nombre", "apellido", "ci", "whatsapp", "fecha_nacimiento"];
  const filled = fields.filter((k) => {
    if (k === "whatsapp") return normalizePhone(form.whatsapp).length >= 8;
    return form[k].trim().length > 0;
  }).length;
  const pct = Math.round((filled / fields.length) * 100);

  const inputCls = (key: keyof SocioForm) => [
    "w-full rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all",
    "focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/60",
    touched[key] && fieldErrors[key] ? "border-red-500/60" : touched[key] && !fieldErrors[key] ? "border-brand-green/50 pr-10" : "border-[#1e293b] hover:border-slate-600",
  ].join(" ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#1e293b] bg-[#020617] shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_circle_at_15%_0%,rgba(118,203,62,0.10),transparent_50%)]" />

        {/* Header */}
        <div className="relative flex items-center justify-between gap-4 border-b border-[#1e293b] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-green/25 bg-brand-green/10 text-brand-green font-bold text-lg">
              {mode === "create" ? "+" : <PencilIcon />}
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">{mode === "create" ? "Nuevo registro" : "Editar registro"}</p>
              <h2 className="text-base font-semibold text-slate-100">{mode === "create" ? "Registrar socio" : "Actualizar datos"}</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
        </div>

        {/* Progress */}
        <div className="relative h-0.5 w-full bg-[#1e293b]">
          <div className="h-full bg-brand-green transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        {/* Body */}
        <div className="relative max-h-[65vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre" hint="Obligatorio" error={touched.nombre ? fieldErrors.nombre : undefined} success={!!touched.nombre && !fieldErrors.nombre && form.nombre.trim().length > 0}>
              <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, nombre: true }))} placeholder="Ej. María" className={inputCls("nombre")} />
            </Field>
            <Field label="Apellido" hint="Obligatorio" error={touched.apellido ? fieldErrors.apellido : undefined} success={!!touched.apellido && !fieldErrors.apellido && form.apellido.trim().length > 0}>
              <input value={form.apellido} onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, apellido: true }))} placeholder="Ej. Rojas" className={inputCls("apellido")} />
            </Field>
            <Field label="CI" hint="Obligatorio" error={touched.ci ? fieldErrors.ci : undefined} success={!!touched.ci && !fieldErrors.ci && form.ci.trim().length > 0}>
              <input value={form.ci} onChange={(e) => setForm((f) => ({ ...f, ci: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, ci: true }))} placeholder="Ej. 7832145" className={inputCls("ci")} />
            </Field>
            <Field label="WhatsApp" hint="Mín. 8 dígitos" error={touched.whatsapp ? fieldErrors.whatsapp : undefined} success={!!touched.whatsapp && !fieldErrors.whatsapp}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><WhatsAppIcon /></span>
                <input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, whatsapp: true }))} placeholder="+591 7xxxxxxx"
                  className={[inputCls("whatsapp"), "pl-9 pr-14"].join(" ")} />
                {form.whatsapp.trim() && (
                  <span className={["pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold", normalizePhone(form.whatsapp).length >= 8 ? "text-brand-green" : "text-slate-500"].join(" ")}>
                    {normalizePhone(form.whatsapp).length}/8
                  </span>
                )}
              </div>
            </Field>
            <Field label="Fecha de nacimiento" hint="Obligatorio" error={touched.fecha_nacimiento ? fieldErrors.fecha_nacimiento : undefined} success={!!touched.fecha_nacimiento && !fieldErrors.fecha_nacimiento && form.fecha_nacimiento.trim().length > 0}>
              <input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm((f) => ({ ...f, fecha_nacimiento: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, fecha_nacimiento: true }))}
                className={[inputCls("fecha_nacimiento"), "[color-scheme:dark]"].join(" ")} />
            </Field>
            <Field label="Género" hint="Opcional">
              <div className="flex gap-2">
                {(["M", "F", "O"] as const).map((code) => (
                  <button key={code} type="button" onClick={() => setForm((f) => ({ ...f, genero: code }))}
                    className={["flex-1 rounded-2xl border py-3 text-xs font-semibold transition-all", form.genero === code ? "border-brand-green/40 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-[#0b1220] text-slate-400 hover:border-slate-600"].join(" ")}>
                    {code === "M" ? "Masc." : code === "F" ? "Fem." : "Otro"}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>}
        </div>

        {/* Footer */}
        <div className="relative flex items-center justify-between gap-3 border-t border-[#1e293b] px-6 py-4">
          <button onClick={onClose} className="rounded-full border border-[#1e293b] bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-all">Cancelar</button>
          <button onClick={onSave} disabled={saving || (hasErrors && anyTouched)}
            className={["rounded-full border px-6 py-2.5 text-sm font-semibold transition-all", saving || (hasErrors && anyTouched) ? "border-[#1e293b] bg-white/5 text-slate-500 cursor-not-allowed" : "border-brand-green bg-brand-green text-black hover:opacity-90 shadow-[0_4px_20px_rgba(118,203,62,0.25)]"].join(" ")}>
            {saving ? "Guardando…" : mode === "create" ? "Registrar socio" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SociosPage() {
  const [rows, setRows] = useState<SocioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<FilterEstado>("todos");
  const [filterSub, setFilterSub] = useState<FilterSub>("todos");

  const pageSize = 12;
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [perfilSocio, setPerfilSocio] = useState<SocioRow | null>(null);

  const [toast, setToast] = useState({ open: false, message: "" });

  const [form, setForm] = useState<SocioForm>({ nombre: "", apellido: "", ci: "", whatsapp: "", genero: "M", fecha_nacimiento: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof SocioForm, boolean>>>({});
  const fieldErrors = useMemo(() => validateForm(form), [form]);

  async function refresh() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("socios")
      .select("id,nombre,apellido,ci,whatsapp,genero,fecha_nacimiento,es_activo,suscrito,foto_url,fecha_registro")
      .order("apellido");
    if (err) { setError(err.message); setLoading(false); return; }
    setRows((data ?? []) as SocioRow[]);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    let r = rows;
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((s) => [s.nombre, s.apellido].filter(Boolean).join(" ").toLowerCase().includes(q) || (s.ci ?? "").toLowerCase().includes(q));
    if (filterEstado === "activo") r = r.filter((s) => s.es_activo);
    if (filterEstado === "inactivo") r = r.filter((s) => !s.es_activo);
    if (filterSub === "suscrito") r = r.filter((s) => s.suscrito);
    if (filterSub === "no_suscrito") r = r.filter((s) => !s.suscrito);
    return r;
  }, [rows, search, filterEstado, filterSub]);

  useEffect(() => { setPage(1); }, [search, filterEstado, filterSub]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = useMemo(() => ({
    total: rows.length,
    activos: rows.filter((r) => r.es_activo).length,
    inactivos: rows.filter((r) => !r.es_activo).length,
    suscritos: rows.filter((r) => r.suscrito).length,
  }), [rows]);

  function showToast(msg: string) { setToast({ open: true, message: msg }); }

  function openCreate() {
    setMode("create"); setEditingId(null);
    setForm({ nombre: "", apellido: "", ci: "", whatsapp: "", genero: "M", fecha_nacimiento: "" });
    setTouched({}); setModalError(null); setModalOpen(true);
  }

  function openEdit(row: SocioRow) {
    setMode("edit"); setEditingId(row.id);
    setForm({
      nombre: row.nombre ?? "", apellido: row.apellido ?? "", ci: row.ci ?? "",
      whatsapp: row.whatsapp ?? "",
      genero: (row.genero === "M" || row.genero === "F" || row.genero === "O") ? row.genero : "M",
      fecha_nacimiento: row.fecha_nacimiento ?? "",
    });
    setTouched({}); setModalError(null); setModalOpen(true);
    setPerfilSocio(null);
  }

  async function handleSave() {
    const allTouched: Partial<Record<keyof SocioForm, boolean>> = { nombre: true, apellido: true, ci: true, whatsapp: true, fecha_nacimiento: true };
    setTouched(allTouched);
    if (Object.keys(validateForm(form)).length > 0) return;
    setSaving(true); setModalError(null);
    const payload = {
      nombre: form.nombre.trim(), apellido: form.apellido.trim(), ci: form.ci.trim(),
      whatsapp: form.whatsapp.trim(), genero: form.genero, fecha_nacimiento: form.fecha_nacimiento.trim(),
    };
    const { error: err } = mode === "create"
      ? await supabase.from("socios").insert({ ...payload, es_activo: true })
      : await supabase.from("socios").update(payload).eq("id", editingId!);
    setSaving(false);
    if (err) { setModalError(err.message); return; }
    setModalOpen(false);
    await refresh();
    showToast(mode === "create" ? "Socio registrado" : "Cambios guardados");
  }

  async function toggleActivo(id: number, next: boolean) {
    const { error: err } = await supabase.from("socios").update({ es_activo: next }).eq("id", id);
    if (err) { setError(err.message); return; }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, es_activo: next } : r));
    if (perfilSocio?.id === id) setPerfilSocio((p) => p ? { ...p, es_activo: next } : p);
  }

  const pageNums = useMemo(() => {
    const max = 5, half = Math.floor(max / 2);
    let start = Math.max(1, safePage - half);
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [safePage, totalPages]);

  return (
    <div className="space-y-6">
      <Toast open={toast.open} message={toast.message} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="section-kicker">Socios</div>
            <h1 className="section-title">Gestión de socios</h1>
            <p className="section-description">Administra perfiles, membresías y contacta por WhatsApp.</p>
          </div>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full border border-brand-green bg-brand-green px-5 py-2.5 text-sm font-bold text-black hover:opacity-95 shadow-[0_0_0_1px_rgba(118,203,62,0.15),0_8px_30px_rgba(118,203,62,0.15)] transition-all">
            + Nuevo Socio
          </button>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total socios", value: stats.total, color: "text-slate-100" },
            { label: "Activos", value: stats.activos, color: "text-brand-green" },
            { label: "Inactivos", value: stats.inactivos, color: "text-slate-500" },
            { label: "Suscritos", value: stats.suscritos, color: "text-sky-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-bold leading-none ${s.color}`}>{loading ? "…" : s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros + búsqueda */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o CI…"
            className="w-full rounded-full border border-[#1e293b] bg-[#0b1220] py-3 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-brand-green/50" />
        </div>
        {/* Filtro estado */}
        <div className="flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1">
          {(["todos", "activo", "inactivo"] as FilterEstado[]).map((f) => (
            <button key={f} onClick={() => setFilterEstado(f)}
              className={["rounded-xl px-3 py-1.5 text-xs font-semibold transition-all capitalize", filterEstado === f ? "bg-brand-green/15 text-brand-green border border-brand-green/30" : "text-slate-400 hover:text-slate-200"].join(" ")}>
              {f === "todos" ? "Todos" : f === "activo" ? "Activos" : "Inactivos"}
            </button>
          ))}
        </div>
        {/* Filtro suscripción */}
        <div className="flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1">
          {(["todos", "suscrito", "no_suscrito"] as FilterSub[]).map((f) => (
            <button key={f} onClick={() => setFilterSub(f)}
              className={["rounded-xl px-3 py-1.5 text-xs font-semibold transition-all", filterSub === f ? "bg-sky-400/15 text-sky-400 border border-sky-400/30" : "text-slate-400 hover:text-slate-200"].join(" ")}>
              {f === "todos" ? "Todos" : f === "suscrito" ? "Suscritos" : "Sin sub."}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => void refresh()} className="rounded-xl border border-[#1e293b] bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Reintentar</button>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e293b] bg-white/5">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Socio</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">CI / WhatsApp</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Suscripción</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Estado</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">Cargando…</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">Sin resultados.</td></tr>
              ) : paged.map((r) => {
                const isActive = Boolean(r.es_activo);
                const wa = r.whatsapp ? normalizePhone(r.whatsapp) : null;
                const waHref = wa ? `https://wa.me/${wa}` : null;
                return (
                  <tr key={r.id} className={["border-b border-[#1e293b] transition-colors hover:bg-white/5 cursor-pointer", !isActive ? "opacity-60" : ""].join(" ")}
                    onClick={() => setPerfilSocio(r)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nombre={r.nombre} apellido={r.apellido} foto_url={r.foto_url} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">{[r.nombre, r.apellido].filter(Boolean).join(" ") || "—"}</div>
                          <div className="text-xs text-slate-500">
                            {r.genero === "M" ? "Masculino" : r.genero === "F" ? "Femenino" : r.genero === "O" ? "Otro" : "—"}
                            {r.fecha_nacimiento ? ` · ${fmtDate(r.fecha_nacimiento)}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-slate-200">{r.ci ?? "—"}</div>
                      <div className="text-xs text-slate-500">{r.whatsapp ?? "Sin WhatsApp"}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={["inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", r.suscrito ? "border-sky-400/30 bg-sky-400/10 text-sky-400" : "border-[#1e293b] bg-white/5 text-slate-500"].join(" ")}>
                        {r.suscrito ? "Suscrito" : "Sin suscripción"}
                      </span>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <StatusToggle checked={isActive} onChange={(next) => void toggleActivo(r.id, next)} />
                        <span className="text-xs text-slate-400">{isActive ? "Activo" : "Inactivo"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(r)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-300 hover:bg-white/10 transition-all" title="Editar">
                          <PencilIcon />
                        </button>
                        <a href={waHref ?? "#"} target={waHref ? "_blank" : undefined} rel="noreferrer"
                          aria-disabled={!waHref}
                          onClick={(e) => { if (!waHref) e.preventDefault(); }}
                          className={["flex h-9 w-9 items-center justify-center rounded-full border transition-all", waHref ? "border-brand-green/40 bg-brand-green/10 text-brand-green hover:bg-brand-green/20" : "border-[#1e293b] bg-white/5 text-slate-600 pointer-events-none"].join(" ")}
                          title={waHref ? "WhatsApp" : "Sin WhatsApp"}>
                          <WhatsAppIcon />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-[#1e293b] bg-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-slate-400">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} de {filtered.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronIcon dir="left" />
              </button>
              {pageNums.map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  className={["h-8 w-8 rounded-full border text-xs font-semibold transition-all", n === safePage ? "border-brand-green/30 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-300 hover:bg-white/10"].join(" ")}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronIcon dir="right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Panel de perfil */}
      {perfilSocio && (
        <PerfilPanel
          socio={perfilSocio}
          onClose={() => setPerfilSocio(null)}
          onEdit={() => openEdit(perfilSocio)}
        />
      )}

      {/* Modal crear/editar */}
      {modalOpen && (
        <SocioModal
          mode={mode}
          form={form}
          setForm={setForm}
          touched={touched}
          setTouched={setTouched}
          fieldErrors={fieldErrors}
          onSave={() => void handleSave()}
          onClose={() => setModalOpen(false)}
          saving={saving}
          error={modalError}
        />
      )}
    </div>
  );
}
