"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanRow = {
  id: string | number;
  nombre: string | null;
  descripcion: string | null;
  monto: number | null;
  codigo_moneda: "BOB" | "USD" | null;
  duracion_dias: number | null;
  permite_todas_sucursales: boolean | null;
  activo: boolean | null;
};

type PlanForm = {
  nombre: string;
  descripcion: string;
  monto: string;
  codigo_moneda: "BOB" | "USD";
  duracion_dias: string;
  permite_todas_sucursales: boolean;
};

const initialForm: PlanForm = {
  nombre: "", descripcion: "", monto: "",
  codigo_moneda: "BOB", duracion_dias: "", permite_todas_sucursales: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeDecimal(v: string) { return v.replace(",", ".").trim(); }

function validate(form: PlanForm) {
  const e: Partial<Record<keyof PlanForm, string>> = {};
  if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio.";
  const price = Number(normalizeDecimal(form.monto));
  if (!form.monto.trim()) e.monto = "El monto es obligatorio.";
  else if (!Number.isFinite(price) || price <= 0) e.monto = "Debe ser mayor a 0.";
  const days = Number(form.duracion_dias.trim());
  if (!form.duracion_dias.trim()) e.duracion_dias = "La duración es obligatoria.";
  else if (!Number.isInteger(days) || days <= 0) e.duracion_dias = "Debe ser un entero mayor a 0.";
  return e;
}

function fmtMonto(monto: number | null, moneda: string | null) {
  if (monto == null) return "—";
  const sym = moneda === "USD" ? "$" : "Bs";
  return `${sym} ${Number(monto).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PencilIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
}
function CheckIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>;
}
function XIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function LayersIcon() {
  return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z" /><path d="m3 12.5 9 4.5 9-4.5" /><path d="m3 17 9 4.5 9-4.5" /></svg>;
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>;
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, hint, error, success, children }: {
  label: string; hint?: string; error?: string; success?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
        {hint && <span className="text-xs text-slate-600">{hint}</span>}
      </div>
      <div className="relative mt-1.5">
        {children}
        {success && !error && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-green"><CheckIcon /></span>
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

function inputCls(err?: boolean, ok?: boolean) {
  return [
    "w-full rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors pr-10",
    err ? "border-red-500/60 focus:ring-2 focus:ring-red-500/30"
      : ok ? "border-brand-green/50 focus:ring-2 focus:ring-brand-green/40"
      : "border-[#1e293b] hover:border-slate-600 focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green/50",
  ].join(" ");
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={["relative inline-flex h-7 w-12 items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-brand-green/40",
        checked ? "border-brand-green/50 bg-brand-green/15" : "border-[#1e293b] bg-[#0b1220]"].join(" ")}>
      <span className={["inline-block h-5 w-5 transform rounded-full shadow transition-transform",
        checked ? "translate-x-6 bg-brand-green" : "translate-x-1 bg-slate-500"].join(" ")} />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanesPage() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [form, setForm] = useState<PlanForm>(initialForm);
  const [touched, setTouched] = useState<Partial<Record<keyof PlanForm, boolean>>>({});
  const [showForm, setShowForm] = useState(false);

  const formErrors = useMemo(() => validate(form), [form]);
  const isEditing = editingId != null;

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("planes")
      .select("id,nombre,descripcion,monto,codigo_moneda,duracion_dias,permite_todas_sucursales,activo")
      .order("activo", { ascending: false })
      .order("id", { ascending: false })
      .limit(100);
    if (error) setGlobalError(error.message);
    setRows((data ?? []) as PlanRow[]);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  function clearForm() {
    setForm(initialForm); setTouched({}); setEditingId(null); setShowForm(false); setGlobalError(null);
  }

  function openEdit(row: PlanRow) {
    setEditingId(row.id);
    setForm({
      nombre: row.nombre ?? "",
      descripcion: row.descripcion ?? "",
      monto: row.monto != null ? String(row.monto) : "",
      codigo_moneda: row.codigo_moneda === "USD" ? "USD" : "BOB",
      duracion_dias: row.duracion_dias != null ? String(row.duracion_dias) : "",
      permite_todas_sucursales: row.permite_todas_sucursales ?? false,
    });
    setTouched({}); setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }

  async function handleSave() {
    setGlobalError(null);
    const allTouched: Partial<Record<keyof PlanForm, boolean>> = {
      nombre: true, monto: true, duracion_dias: true,
    };
    setTouched(allTouched);
    if (Object.keys(validate(form)).length > 0) return;

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      monto: Number(normalizeDecimal(form.monto)),
      codigo_moneda: form.codigo_moneda,
      duracion_dias: Number(form.duracion_dias.trim()),
      permite_todas_sucursales: form.permite_todas_sucursales,
      activo: true,
    };

    setSaving(true);
    try {
      if (isEditing) {
        const { error } = await supabase.from("planes").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planes").insert(payload);
        if (error) throw error;
      }
      clearForm();
      await refresh();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(id: string | number, next: boolean) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, activo: next } : r));
    const { error } = await supabase.from("planes").update({ activo: next }).eq("id", id);
    if (error) setRows((prev) => prev.map((r) => r.id === id ? { ...r, activo: !next } : r));
  }

  async function toggleCobertura(id: string | number, next: boolean) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, permite_todas_sucursales: next } : r));
    const { error } = await supabase.from("planes").update({ permite_todas_sucursales: next }).eq("id", id);
    if (error) setRows((prev) => prev.map((r) => r.id === id ? { ...r, permite_todas_sucursales: !next } : r));
  }

  // Stats
  const activos = rows.filter((r) => r.activo).length;
  const inactivos = rows.filter((r) => !r.activo).length;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Configuración</p>
          <h1 className="text-xl font-bold text-slate-100 mt-0.5">Planes</h1>
          <p className="text-xs text-slate-500 mt-0.5">Gestiona los planes de membresía del gimnasio</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-2xl bg-brand-green px-4 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20">
            <PlusIcon /> Nuevo plan
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total planes", value: rows.length, color: "text-slate-100" },
          { label: "Activos", value: activos, color: "text-brand-green" },
          { label: "Inactivos", value: inactivos, color: "text-slate-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? "…" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="rounded-3xl border border-[#1e293b] bg-white/5 overflow-hidden animate-[fadeIn_0.2s_ease]">
          {/* Form header */}
          <div className="flex items-center justify-between border-b border-[#1e293b] px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green">
                {isEditing ? <PencilIcon /> : <PlusIcon />}
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {isEditing ? "Editando plan" : "Nuevo plan"}
                </p>
                <p className="text-sm font-bold text-slate-100">
                  {isEditing ? form.nombre || "Sin nombre" : "Completa los datos del plan"}
                </p>
              </div>
            </div>
            <button onClick={clearForm}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100 transition-colors">
              <XIcon />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-6">
              {/* Nombre */}
              <div className="md:col-span-4">
                <Field label="Nombre del plan" error={touched.nombre ? formErrors.nombre : undefined}
                  success={!!touched.nombre && !formErrors.nombre}>
                  <input value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    onBlur={() => setTouched((p) => ({ ...p, nombre: true }))}
                    placeholder="Ej. Mensual, Trimestral, VIP…"
                    className={inputCls(touched.nombre && !!formErrors.nombre, touched.nombre && !formErrors.nombre)} />
                </Field>
              </div>

              {/* Días */}
              <div className="md:col-span-2">
                <Field label="Duración (días)" error={touched.duracion_dias ? formErrors.duracion_dias : undefined}
                  success={!!touched.duracion_dias && !formErrors.duracion_dias}>
                  <input inputMode="numeric" value={form.duracion_dias}
                    onChange={(e) => setForm((p) => ({ ...p, duracion_dias: e.target.value }))}
                    onBlur={() => setTouched((p) => ({ ...p, duracion_dias: true }))}
                    placeholder="30"
                    className={inputCls(touched.duracion_dias && !!formErrors.duracion_dias, touched.duracion_dias && !formErrors.duracion_dias)} />
                </Field>
              </div>

              {/* Monto */}
              <div className="md:col-span-2">
                <Field label="Monto" error={touched.monto ? formErrors.monto : undefined}
                  success={!!touched.monto && !formErrors.monto}>
                  <input inputMode="decimal" value={form.monto}
                    onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
                    onBlur={() => setTouched((p) => ({ ...p, monto: true }))}
                    placeholder="120.00"
                    className={inputCls(touched.monto && !!formErrors.monto, touched.monto && !formErrors.monto)} />
                </Field>
              </div>

              {/* Moneda */}
              <div className="md:col-span-2">
                <Field label="Moneda">
                  <div className="flex gap-2">
                    {(["BOB", "USD"] as const).map((cur) => (
                      <button key={cur} type="button" onClick={() => setForm((p) => ({ ...p, codigo_moneda: cur }))}
                        className={["flex-1 rounded-2xl border py-3 text-sm font-bold transition-all",
                          form.codigo_moneda === cur
                            ? "border-brand-green/50 bg-brand-green/15 text-brand-green"
                            : "border-[#1e293b] bg-[#0b1220] text-slate-400 hover:text-slate-200"].join(" ")}>
                        {cur === "BOB" ? "Bs" : "$"} <span className="text-[10px] font-normal opacity-70">{cur}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Cobertura */}
              <div className="md:col-span-2">
                <Field label="Cobertura">
                  <div className="flex gap-2">
                    {([{ val: false, label: "Una sucursal", icon: "🏠" }, { val: true, label: "Todas", icon: "🌐" }] as const).map(({ val, label, icon }) => (
                      <button key={String(val)} type="button" onClick={() => setForm((p) => ({ ...p, permite_todas_sucursales: val }))}
                        className={["flex-1 flex flex-col items-center gap-0.5 rounded-2xl border py-2.5 text-xs font-semibold transition-all",
                          form.permite_todas_sucursales === val
                            ? "border-brand-green/50 bg-brand-green/15 text-brand-green"
                            : "border-[#1e293b] bg-[#0b1220] text-slate-400 hover:text-slate-200"].join(" ")}>
                        <span className="text-base">{icon}</span>
                        <span className="text-[10px]">{label}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Descripción */}
              <div className="md:col-span-6">
                <Field label="Descripción" hint="opcional">
                  <input value={form.descripcion}
                    onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Beneficios, restricciones, notas del plan…"
                    className={inputCls()} />
                </Field>
              </div>
            </div>

            {globalError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                {globalError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => void handleSave()} disabled={saving}
                className="flex items-center gap-2 rounded-2xl bg-brand-green px-5 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 disabled:opacity-50 transition-all shadow-lg shadow-brand-green/20">
                {saving ? "Guardando…" : isEditing ? <><CheckIcon /> Guardar cambios</> : <><PlusIcon /> Crear plan</>}
              </button>
              <button onClick={clearForm}
                className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[#1e293b] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1e293b] px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">Listado de planes</p>
          <span className="text-xs text-slate-500">{rows.length} plan{rows.length !== 1 ? "es" : ""}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e293b] bg-white/5">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Plan</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Monto</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Duración</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Cobertura</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Estado</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-slate-500">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-slate-500">Sin planes registrados. Crea el primero.</td></tr>
              ) : rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-[#1e293b]/60 hover:bg-white/5 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-100">{r.nombre ?? "—"}</div>
                    {r.descripcion && <div className="text-xs text-slate-500 mt-0.5 max-w-[240px] truncate">{r.descripcion}</div>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`font-bold ${r.codigo_moneda === "USD" ? "text-sky-400" : "text-brand-green"}`}>
                      {fmtMonto(r.monto, r.codigo_moneda)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center rounded-full border border-[#1e293b] bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      {r.duracion_dias != null ? `${r.duracion_dias}d` : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button onClick={() => void toggleCobertura(r.id, !(r.permite_todas_sucursales ?? false))}
                      title="Clic para cambiar"
                      className={["inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                        r.permite_todas_sucursales
                          ? "border-brand-green/30 bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
                          : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-200"].join(" ")}>
                      <LayersIcon />
                      {r.permite_todas_sucursales ? "Todas" : "Una sucursal"}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2.5">
                      <Toggle checked={Boolean(r.activo)} onChange={(v) => void toggleActivo(r.id, v)} />
                      <span className={["text-xs font-semibold", r.activo ? "text-brand-green" : "text-slate-500"].join(" ")}>
                        {r.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button onClick={() => openEdit(r)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e293b] bg-white/5 text-slate-400 hover:text-brand-green hover:border-brand-green/40 transition-all opacity-0 group-hover:opacity-100">
                      <PencilIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
